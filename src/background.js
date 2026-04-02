import browser from "webextension-polyfill";

browser.runtime.onInstalled.addListener(() => {
  if (browser.sidePanel && browser.sidePanel.setPanelBehavior) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

async function syncRules() {
  const data = await browser.storage.local.get(['rules', 'masterSwitch']);
  const rulesObj = data.rules || {};
  const masterSwitch = data.masterSwitch !== false;

  const currentRules = await browser.declarativeNetRequest.getDynamicRules();
  const currentRuleIds = new Set(currentRules.map(r => r.id));

  const rulesToNodes = (rule) => {
    const nodes = [];
    let safeSource = rule.source.replace(/^https?:\/\//, '').replace(/\/?$/, '');
    const baseId = parseInt(rule.id, 10);

    const condition = {
      urlFilter: `||${safeSource}`,
      resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other']
    };

    // 1. Primary Action Rule (Redirect or Block)
    if (rule.type === 'block') {
      nodes.push({
        id: baseId,
        priority: 1,
        action: { type: 'block' },
        condition
      });
    } else if (rule.type === 'redirect' || !rule.type) {
      let host = 'localhost';
      let port = '';
      const cleanDest = rule.destination.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

      if (cleanDest.includes(':')) {
        const parts = cleanDest.split(':');
        host = parts[0] || 'localhost';
        port = parts[1].replace(/\D/g, '');
      } else if (/^\d+$/.test(cleanDest)) {
        host = 'localhost';
        port = cleanDest;
      } else {
        host = cleanDest;
      }
      host = host.replace(/^\/+|\/+$/g, '');

      nodes.push({
        id: baseId,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            transform: {
              scheme: 'http',
              host: host,
              ...(port ? { port: port } : {})
            }
          }
        },
        condition
      });
    }

    // 2. Headers Rule (DNR allows only one action per rule, so we use a second rule for headers)
    if (rule.headers) {
      const requestHeaders = [];
      rule.headers.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const value = parts.slice(1).join(':').trim();
          if (name) {
            requestHeaders.push({ header: name, operation: 'set', value: value });
          }
        }
      });

      if (requestHeaders.length > 0) {
        nodes.push({
          id: 100000 + baseId,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: requestHeaders
          },
          condition
        });
      }
    }

    return nodes;
  };

  const addRules = [];
  const removeRuleIds = [];

  // Rules that should be active for DNR
  const activeRulesInStorage = Object.values(rulesObj).filter(r =>
    r.active && r.source && masterSwitch && (r.type === 'redirect' || r.type === 'block' || !r.type)
  );

  const allGeneratedNodes = activeRulesInStorage.flatMap(r => rulesToNodes(r));
  const activeNodeIds = new Set(allGeneratedNodes.map(n => n.id));

  // Determine what to remove: 
  for (const id of currentRuleIds) {
    if (!activeNodeIds.has(id)) {
      removeRuleIds.push(id);
    }
  }

  // Determine what to add or update:
  for (const node of allGeneratedNodes) {
    const existingRule = currentRules.find(r => r.id === node.id);

    if (!existingRule) {
      addRules.push(node);
    } else {
      // Check for changes
      const hasChanged = JSON.stringify(existingRule.condition) !== JSON.stringify(node.condition) ||
        JSON.stringify(existingRule.action) !== JSON.stringify(node.action);
      if (hasChanged) {
        removeRuleIds.push(node.id);
        addRules.push(node);
      }
    }
  }

  if (removeRuleIds.length > 0 || addRules.length > 0) {
    console.log("Updating DNR rules:", { add: addRules.length, remove: removeRuleIds.length });
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeRuleIds,
      addRules: addRules
    });
  }

  // Update Proxy Settings (Phase 3)
  await updateProxySettings(rulesObj, masterSwitch);

  // Sync rules to Engine (Phase 4)
  if (bgState.isEngineActive) {
    syncRulesToEngine(rulesObj, masterSwitch);
  }
}

async function syncRulesToEngine(rulesObj, masterSwitch) {
  const port = getNativePort();
  if (!port) return;

  const engineRules = Object.values(rulesObj)
    .filter(r => r.active && masterSwitch && (r.type === 'engine' || r.type === 'passthrough'))
    .map(r => ({
      source: r.source,
      destination: r.destination,
      type: r.type,
      cert: r.cert || ''
    }));

  console.log("Syncing rules to engine:", engineRules);
  port.postMessage({
    command: "sync_rules",
    rules: engineRules
  });
}

// --- PROXY IMPLEMENTATION ---

let bgState = {
  rules: {},
  masterSwitch: true,
  isEngineActive: false,
  isBrowserLogActive: false,
  isEngineLogActive: false,
  isRecordingActive: false,
  remoteEngineUrl: '',
  nativePort: null
};

function getNativePort() {
  if (!bgState.isEngineActive) {
    if (bgState.nativePort) {
      bgState.nativePort.disconnect();
      bgState.nativePort = null;
    }
    return null;
  }

  if (bgState.nativePort) return bgState.nativePort;

  try {
    console.log("Connecting to Straws Engine...");
    bgState.nativePort = browser.runtime.connectNative("com.kaber420.straws.core");
    bgState.nativePort.onDisconnect.addListener((p) => {
      console.log("Native port disconnected:", p.error);
      bgState.nativePort = null;
    });

    bgState.nativePort.onMessage.addListener((msg) => {
      if (msg.type === "log" || msg.type === "tls_match" || msg.type === "tls_error" || msg.type === "http") {
        if (bgState.isEngineLogActive) {
          sendLog({
            url: msg.url || msg.host || msg.message || msg.error,
            method: msg.method || (msg.type === "tls_match" ? "MATCH" : (msg.type === "tls_error" ? "SSL-FAIL" : "LOG")),
            status: msg.status || (msg.success === false ? "Error" : "Info"),
            ip: msg.ip || "-",
            latency: msg.latency || "-",
            from: msg.from || (msg.type === "log" ? "Straws Engine" : "Native"),
            type: msg.type,
            size: msg.size || "-",
            headers: msg.headers || null,
            payload: msg.payload !== undefined && msg.payload !== null ? msg.payload : null,
            response: msg.response !== undefined && msg.response !== null ? msg.response : null,
            hasPayload: (msg.payload && msg.payload.length > 0) || (msg.response && msg.response.length > 0)
          });
        }
      }
    });
    return bgState.nativePort;
  } catch (e) {
    console.error("Failed to connect to native host:", e);
    return null;
  }
}

async function updateProxySettings(rulesObj, masterSwitch) {
  bgState.rules = rulesObj;
  bgState.masterSwitch = masterSwitch;

  const proxyRules = Object.values(rulesObj).filter(r =>
    r.active && r.source && r.destination && masterSwitch && r.type === 'engine'
  );

  const isFirefox = typeof browser.proxy.onRequest !== 'undefined';

  if (proxyRules.length === 0 || !masterSwitch) {
    if (isFirefox) {
      if (browser.proxy.onRequest.hasListener(handleFirefoxProxy)) {
        browser.proxy.onRequest.removeListener(handleFirefoxProxy);
      }
    } else if (typeof chrome !== 'undefined' && chrome.proxy) {
      chrome.proxy.settings.clear({ scope: 'regular' });
    }
    return;
  }

  if (isFirefox) {
    // Firefox uses a listener
    if (!browser.proxy.onRequest.hasListener(handleFirefoxProxy)) {
      browser.proxy.onRequest.addListener(handleFirefoxProxy, { urls: ["<all_urls>"] });
    }
  } else if (typeof chrome !== 'undefined' && chrome.proxy) {
    // Chrome uses a PAC script
    const pacScript = generatePACScript(proxyRules);
    chrome.proxy.settings.set({
      value: {
        mode: "pac_script",
        pacScript: { data: pacScript }
      },
      scope: 'regular'
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Chrome Proxy Error:", chrome.runtime.lastError);
      }
    });
  }
}

function generatePACScript(rules) {
  const cases = rules.map(rule => {
    return `if (shExpMatch(host, "${rule.source}")) return "PROXY 127.0.0.1:5782";`;
  }).join('\n    ');

  return `
    function FindProxyForURL(url, host) {
      ${cases}
      return "DIRECT";
    }
  `;
}

// Firefox listener optimized with background cache
function handleFirefoxProxy(requestInfo) {
  if (!bgState.masterSwitch) return { type: "direct" };

  const url = new URL(requestInfo.url);
  const rules = Object.values(bgState.rules).filter(r => r.active && r.type === 'engine');
  const matchingRule = rules.find(r => url.hostname === r.source || url.hostname.endsWith('.' + r.source));

  if (matchingRule) {
    let proxyHost = "127.0.0.1";
    let proxyPort = 5782;

    if (bgState.remoteEngineUrl) {
      const parts = bgState.remoteEngineUrl.split(':');
      proxyHost = parts[0];
      proxyPort = parseInt(parts[1]) || 5782;
    }

    return { type: "http", host: proxyHost, port: proxyPort };
  }

  return { type: "direct" };
}



// Robust Debounce
let syncTimeout = null;
let isSyncing = false;
let needsSyncAgain = false;

async function runSync() {
  if (isSyncing) {
    needsSyncAgain = true;
    return;
  }
  isSyncing = true;
  do {
    needsSyncAgain = false;
    await syncRules();
  } while (needsSyncAgain);
  isSyncing = false;
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LOGS') {
    sendResponse({ logs: logBuffer });
    return false;
  }
  if (message.type === 'GET_CERTS') {
    const port = getNativePort();
    if (!port) {
      sendResponse({ certs: [] });
      return true;
    }

    const listener = (res) => {
      if (res.type === 'certs_list') {
        port.onMessage.removeListener(listener);
        sendResponse({ certs: res.certs });
      }
    };
    port.onMessage.addListener(listener);
    port.postMessage({ command: "get_certs" });
    return true; // async response
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.rules || changes.masterSwitch || changes.isEngineActive || changes.remoteEngineUrl) {
      if (changes.isEngineActive) {
        bgState.isEngineActive = !!changes.isEngineActive.newValue;
        getNativePort(); // Trigger connect/disconnect
      }
      if (changes.remoteEngineUrl) {
        bgState.remoteEngineUrl = changes.remoteEngineUrl.newValue || '';
      }
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(runSync, 150);
    }
    if (changes.isBrowserLogActive !== undefined) {
      bgState.isBrowserLogActive = !!changes.isBrowserLogActive.newValue;
    }
    if (changes.isEngineLogActive !== undefined) {
      bgState.isEngineLogActive = !!changes.isEngineLogActive.newValue;
      syncLoggingToEngine(bgState.isEngineLogActive);
    }
    if (changes.isRecordingActive !== undefined) {
      bgState.isRecordingActive = !!changes.isRecordingActive.newValue;
      syncRecordingToEngine(bgState.isRecordingActive);
    }
  }
});

async function syncRecordingToEngine(enabled) {
  const port = getNativePort();
  if (!port) return;
  
  console.log("Syncing recording state to engine:", enabled);
  port.postMessage({
    command: "set_recording",
    enabled: enabled
  });
}

async function syncLoggingToEngine(enabled) {
  const port = getNativePort();
  if (!port) return;
  
  console.log("Syncing logging state to engine:", enabled);
  port.postMessage({
    command: "set_logging",
    enabled: enabled
  });
}

// Try syncing on start
syncRules();

// Init state from storage
browser.storage.local.get(['isBrowserLogActive', 'isEngineLogActive', 'isEngineActive', 'isRecordingActive', 'remoteEngineUrl']).then(data => {
  bgState.isBrowserLogActive = !!data.isBrowserLogActive;
  bgState.isEngineLogActive = !!data.isEngineLogActive;
  bgState.isEngineActive = !!data.isEngineActive;
  bgState.isRecordingActive = !!data.isRecordingActive;
  bgState.remoteEngineUrl = data.remoteEngineUrl || '';
  if (bgState.isEngineActive) getNativePort();
  if (bgState.isEngineLogActive) syncLoggingToEngine(true);
});

// Alarms (auto-off Live Log)
if (typeof browser.alarms !== 'undefined') {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'liveLogOff') {
      browser.storage.local.set({ isBrowserLogActive: false, isEngineLogActive: false });
    }
  });
}

// --- NETWORK MONITOR (Observational) ---

const activeRequests = new Map();
const logBuffer = [];
const MAX_BUFFER = 100;

// Helper to send logs to UI
function sendLog(log) {
  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    ...log
  };
  
  // Push to buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();

  browser.runtime.sendMessage({
    type: 'LOG_ENTRY',
    log: entry
  }).catch(() => { /* No listeners active */ });
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!bgState.isBrowserLogActive) return;
    activeRequests.set(details.requestId, {
      startTime: Date.now(),
      url: details.url,
      method: details.method,
      type: details.type
    });
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!bgState.isBrowserLogActive) return;
    const req = activeRequests.get(details.requestId);
    if (req) {
      req.requestHeaders = details.requestHeaders;
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

browser.webRequest.onResponseStarted.addListener(
  (details) => {
    if (!bgState.isBrowserLogActive) return;
    const req = activeRequests.get(details.requestId);
    if (req) {
      req.status = details.statusCode;
      req.ip = details.ip || '-';
      req.fromCache = details.fromCache;

      // Get content-type from headers
      const ctHeader = details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-type');
      req.contentType = ctHeader ? ctHeader.value.split(';')[0] : 'unknown';
      req.responseHeaders = details.responseHeaders;
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.webRequest.onCompleted.addListener(
  (details) => {
    if (!bgState.isBrowserLogActive) return;
    const req = activeRequests.get(details.requestId);
    if (req) {
      const latency = Date.now() - req.startTime;

      // Get content-length for size
      const sizeHeader = details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-length');
      const size = sizeHeader ? `${(parseInt(sizeHeader.value) / 1024).toFixed(2)} KB` : '-';

      // Identify source of the request for logs
      let from = 'Direct';
      if (details.fromCache) {
        from = 'Cache';
      } else {
        const urlObj = new URL(req.url);
        const isStrawDNR = req.url.includes('127.0.0.1') || req.url.includes('localhost');
        const isStrawProxy = Object.values(bgState.rules).some(r => 
          r.active && (r.type === 'proxy' || r.type === 'engine' || r.type === 'passthrough') && (urlObj.hostname === r.source || urlObj.hostname.endsWith('.' + r.source))
        );

        if (isStrawDNR) from = 'Straws (Redir)';
        else if (isStrawProxy) from = 'Straws (Proxy)';
      }

      sendLog({
        url: req.url,
        method: req.method,
        status: details.statusCode,
        ip: details.ip || '-',
        latency: `${latency}ms`,
        from: from,
        type: req.contentType || 'unknown',
        size: size,
        headers: {
          request: req.requestHeaders || "Not available in observer mode",
          response: req.responseHeaders || "Not available"
        }
      });
      activeRequests.delete(details.requestId);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (!bgState.isBrowserLogActive) return;
    const req = activeRequests.get(details.requestId);
    if (req) {
      const urlObj = new URL(req.url);
      const isStrawProxy = Object.values(bgState.rules).some(r => 
        r.active && (r.type === 'proxy' || r.type === 'engine' || r.type === 'passthrough') && (urlObj.hostname === r.source || urlObj.hostname.endsWith('.' + r.source))
      );
      
      let from = 'Network';
      if (isStrawProxy) from = 'Straws (Proxy)';

      sendLog({
        url: req.url,
        method: req.method,
        status: 'Error',
        ip: '-',
        latency: `${Date.now() - req.startTime}ms`,
        from: from,
        type: details.error,
        size: '-'
      });
      activeRequests.delete(details.requestId);
    }
  },
  { urls: ["<all_urls>"] }
);


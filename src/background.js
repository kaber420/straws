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
    let safeSource = rule.source.replace(/^https?:\/\//, '').replace(/\/?$/, '');

    return {
      id: parseInt(rule.id, 10),
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
      condition: {
        urlFilter: `||${safeSource}`,
        resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other']
      }
    };
  };

  const addRules = [];
  const removeRuleIds = [];

  // Rules that should be active for DNR (Redirect mode)
  const activeRulesInStorage = Object.values(rulesObj).filter(r => 
    r.active && r.source && r.destination && masterSwitch && (r.type === 'redirect' || !r.type)
  );
  const activeRuleIdsInStorage = new Set(activeRulesInStorage.map(r => parseInt(r.id, 10)));

  // Determine what to remove: 
  // 1. Rules in DNR that are no longer active or don't exist in storage
  for (const id of currentRuleIds) {
    if (!activeRuleIdsInStorage.has(id)) {
      removeRuleIds.push(id);
    }
  }

  // Determine what to add or update:
  // 2. Rules in storage that are not in DNR, or have changed
  for (const rule of activeRulesInStorage) {
    const id = parseInt(rule.id, 10);
    const generatedRule = rulesToNodes(rule);
    const existingRule = currentRules.find(r => r.id === id);

    if (!existingRule) {
      addRules.push(generatedRule);
    } else {
      // Check for changes (simple deep comparison of condition and action)
      const hasChanged = JSON.stringify(existingRule.condition) !== JSON.stringify(generatedRule.condition) ||
                         JSON.stringify(existingRule.action) !== JSON.stringify(generatedRule.action);
      if (hasChanged) {
        removeRuleIds.push(id);
        addRules.push(generatedRule);
      }
    }
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
  isLiveLogActive: false,
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
      if (msg.type === "log" || msg.type === "tls_match" || msg.type === "tls_error") {
        sendLog({
          url: msg.host || msg.message || msg.error,
          method: msg.type === "tls_match" ? "MATCH" : (msg.type === "tls_error" ? "SSL-FAIL" : "LOG"),
          status: msg.success === false ? "Error" : "Info",
          ip: "-",
          latency: "-",
          from: msg.type === "log" ? "Engine" : "Native",
          type: msg.type,
          size: "-"
        });
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
    return { type: "http", host: "127.0.0.1", port: 5782 };
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
    if (changes.rules || changes.masterSwitch || changes.isEngineActive) {
      if (changes.isEngineActive) {
        bgState.isEngineActive = !!changes.isEngineActive.newValue;
        getNativePort(); // Trigger connect/disconnect
      }
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(runSync, 150);
    }
    if (changes.isLiveLogActive !== undefined) {
      bgState.isLiveLogActive = !!changes.isLiveLogActive.newValue;
    }
  }
});

// Try syncing on start
syncRules();

// Init state from storage
browser.storage.local.get(['isLiveLogActive', 'isEngineActive']).then(data => {
  bgState.isLiveLogActive = !!data.isLiveLogActive;
  bgState.isEngineActive = !!data.isEngineActive;
  if (bgState.isEngineActive) getNativePort();
});

// Alarms (auto-off Live Log)
if (typeof browser.alarms !== 'undefined') {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'liveLogOff') {
      browser.storage.local.set({ isLiveLogActive: false });
    }
  });
}

// --- NETWORK MONITOR (Observational) ---

const activeRequests = new Map();

// Helper to send logs to UI
function sendLog(log) {
  browser.runtime.sendMessage({
    type: 'LOG_ENTRY',
    log: {
      timestamp: new Date().toLocaleTimeString(),
      ...log
    }
  }).catch(() => { /* Side panel closed */ });
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!bgState.isLiveLogActive) return;
    activeRequests.set(details.requestId, {
      startTime: Date.now(),
      url: details.url,
      method: details.method,
      type: details.type
    });
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onResponseStarted.addListener(
  (details) => {
    if (!bgState.isLiveLogActive) return;
    const req = activeRequests.get(details.requestId);
    if (req) {
      req.status = details.statusCode;
      req.ip = details.ip || '-';
      req.fromCache = details.fromCache;
      
      // Get content-type from headers
      const ctHeader = details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-type');
      req.contentType = ctHeader ? ctHeader.value.split(';')[0] : 'unknown';
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.webRequest.onCompleted.addListener(
  (details) => {
    if (!bgState.isLiveLogActive) return;
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
          r.active && r.type === 'proxy' && (urlObj.hostname === r.source || urlObj.hostname.endsWith('.' + r.source))
        );
        
        if (isStrawDNR) from = 'Straw (Redir)';
        else if (isStrawProxy) from = 'Straw (Proxy)';
      }

      sendLog({
        url: req.url,
        method: req.method,
        status: details.statusCode,
        ip: details.ip || '-',
        latency: `${latency}ms`,
        from: from,
        type: req.contentType || 'unknown',
        size: size
      });
      activeRequests.delete(details.requestId);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (!bgState.isLiveLogActive) return;
    const req = activeRequests.get(details.requestId);
    if (req) {
      sendLog({
        url: req.url,
        method: req.method,
        status: 'Error',
        ip: '-',
        latency: `${Date.now() - req.startTime}ms`,
        from: 'Network',
        type: details.error,
        size: '-'
      });
      activeRequests.delete(details.requestId);
    }
  },
  { urls: ["<all_urls>"] }
);


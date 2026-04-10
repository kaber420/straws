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
    let safeSource = normalizeHostname(rule.source);
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
  isEngineLogActive: true,
  isRecordingActive: false,
  remoteEngineUrl: '',
  nativePort: null,
  leafRulesApplied: new Set(),
  leafChaosModes: {}, containerChaosModes: {} // Persistent object (tabId -> mode)
};

async function saveChaosModes() {
  await browser.storage.local.set({ 
    leafChaosModes: bgState.leafChaosModes,
    containerChaosModes: bgState.containerChaosModes
  });
}

async function loadChaosModes() {
  const data = await browser.storage.local.get(['leafChaosModes', 'containerChaosModes']);
  if (data.leafChaosModes) bgState.leafChaosModes = data.leafChaosModes;
  if (data.containerChaosModes) bgState.containerChaosModes = data.containerChaosModes;
  console.log("[Identity] Loaded persistent chaos modes. Tabs:", Object.keys(bgState.leafChaosModes).length, "Containers:", Object.keys(bgState.containerChaosModes).length);
}

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

    bgState.nativePort.onMessage.addListener(async (msg) => {
      if (msg.type === "ready" && msg.port) {
        console.log("Straws Engine synchronized on port:", msg.port);
        // Normalize port format: msg.port can be ":5782", "5782", or "127.0.0.1:5782"
        const rawPort = String(msg.port).trim();
        if (rawPort.includes('.')) {
          // Already a full "host:port" string (e.g. "127.0.0.1:5782")
          bgState.remoteEngineUrl = rawPort.replace(/^:/, '');
        } else {
          // Just a port number possibly prefixed with ":" (e.g. ":5782" or "5782")
          const portNum = rawPort.replace(/^:/, '').replace(/\D/g, '');
          bgState.remoteEngineUrl = `127.0.0.1:${portNum}`;
        }
        console.log("Resolved remoteEngineUrl:", bgState.remoteEngineUrl);
        updateProxySettings(bgState.rules, bgState.masterSwitch).then(() => {
          syncRules();
        });
      }
      if (msg.type === "log" || msg.type === "tls_match" || msg.type === "tls_error" || msg.type === "http" || msg.type === "tls_handshake") {
        if (bgState.isEngineLogActive) {
          const url = msg.url || msg.host;
          const reqHeaders = msg.headers?.request || {};
          let rawLeafHeader = reqHeaders['X-Straws-Leaf'] || 
                              reqHeaders['x-straws-leaf'] || 
                              reqHeaders['X-STRAWS-LEAF'];
          
          let leafHeader = Array.isArray(rawLeafHeader) ? rawLeafHeader[0] : rawLeafHeader;

          let tabId, windowId, leafTitle;
          if (leafHeader && typeof leafHeader === 'string') {
            const parts = leafHeader.split('-');
            tabId = parseInt(parts[parts.length - 1]);
            windowId = parts.length > 1 ? parseInt(parts[0]) : -1;
            
            // AGGRESSIVE RESOLUTION: If window is unknown, try to find it now
            if (windowId === -1 || isNaN(windowId)) {
                const refreshedInfo = await getTabInfo(tabId);
                windowId = refreshedInfo.windowId !== null ? refreshedInfo.windowId : -1;
                leafTitle = refreshedInfo.title;
            } else {
                const cached = tabInfoCache.get(tabId);
                if (cached) leafTitle = cached.title;
            }
          } else {
            const enriched = urlToTabMap.get(normalizeUrl(url)) || {};
            tabId = enriched.tabId !== undefined ? enriched.tabId : -1;
            const refreshedInfo = await getTabInfo(tabId);
            windowId = refreshedInfo.windowId !== null ? refreshedInfo.windowId : -1;
            leafTitle = refreshedInfo.title || 'System';
          }

          let size = msg.size || "-";
          if (size === "-" && (msg.payload || msg.response)) {
             const pLen = typeof msg.payload === 'string' ? msg.payload.length : 0;
             const rLen = typeof msg.response === 'string' ? msg.response.length : 0;
             const total = pLen + rLen;
             if (total > 0) {
               size = (total > 1024) ? (total/1024).toFixed(1) + " KB" : total + " B";
             }
          }
          
          await sendLog({
            url: msg.url || msg.host || msg.message || msg.error,
            method: msg.type === "tls_handshake" ? "TLS" : (msg.method || (msg.type === "tls_match" ? "MATCH" : (msg.type === "tls_error" ? "SSL-FAIL" : "LOG"))),
            status: msg.type === "tls_handshake" ? "Handshake" : (msg.status || (msg.success === false ? "Error" : "Info")),
            ip: msg.ip || "-",
            latency: msg.latency || "-",
            from: msg.from || (msg.type === "log" ? "Straws Engine" : "Native"),
            type: msg.type,
            size: size,
            tabId: tabId,
            windowId: windowId,
            leafTitle: leafTitle,
            headers: msg.headers || null,
            payload: msg.payload !== undefined && msg.payload !== null ? msg.payload : null,
            response: msg.response !== undefined && msg.response !== null ? msg.response : null,
            hasPayload: (msg.payload && msg.payload.length > 0) || (msg.response && msg.response.length > 0),
            tlsInfo: msg.tls || null  // TLS Handshake Inspector data
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

function parseEngineUrl(defaultPort = 5783) {
  let proxyHost = "127.0.0.1";
  let proxyPort = defaultPort;

  if (bgState.remoteEngineUrl) {
    // remoteEngineUrl is always "host:port" after the fix in the ready handler
    const colonIdx = bgState.remoteEngineUrl.lastIndexOf(':');
    if (colonIdx !== -1) {
      const h = bgState.remoteEngineUrl.substring(0, colonIdx);
      const p = parseInt(bgState.remoteEngineUrl.substring(colonIdx + 1), 10);
      if (h) proxyHost = h;
      if (!isNaN(p) && p > 0) proxyPort = p;
    }
  }

  return { proxyHost, proxyPort };
}

function generatePACScript(rules) {
  const { proxyHost, proxyPort } = parseEngineUrl(5783);

  const cases = rules.map(rule => {
    return `if (shExpMatch(host, "${rule.source}")) return "PROXY ${proxyHost}:${proxyPort}";`;
  }).join('\n    ');

  return `
    function FindProxyForURL(url, host) {
      ${cases}
      return "DIRECT";
    }
  `;
}

// Firefox identity serializer for Proxy-Authorization
// Firefox identity serializer (JSON Protocol - Clean Metadata Pro)
async function encodeIdentity(tabId) {
  if (tabId < 0) return btoa(JSON.stringify({ type: "system" }));
  
  const tabInfo = await getTabInfo(tabId);
  const winId = (tabInfo.windowId !== undefined && tabInfo.windowId !== null) ? tabInfo.windowId : -1;
  
  // 1. Try Tab ID first
  let chaosMode = bgState.leafChaosModes[Number(tabId)] || "";
  
  // 2. Try Container Name fallback
  let containerName = "";
  if (tabInfo.cookieStoreId && tabInfo.cookieStoreId !== 'firefox-default') {
     try {
       const container = await browser.contextualIdentities.get(tabInfo.cookieStoreId);
       if (container) {
         containerName = container.name;
         if (!chaosMode) chaosMode = bgState.containerChaosModes[containerName] || "";
       }
     } catch (e) {}
  }

  if (chaosMode) {
    console.log(`[Identity] TRACE: Found Chaos Mode '${chaosMode}' for Tab ${tabId} (Container: ${containerName})`);
  }
  
  const payload = {
    win: winId,
    tab: Number(tabId),
    chaos: chaosMode
  };

  if (chaosMode) {
    console.log(`[Identity] Tab ${tabId} has Chaos Mode: ${chaosMode}`);
  }

  // Add container info if available
  if (tabInfo.cookieStoreId && tabInfo.cookieStoreId !== 'firefox-default') {
    try {
      const container = await getContainerInfo(tabId);
      if (container) {
        payload.cont = container.name;
        payload.color = container.colorCode;
      }
    } catch (e) {}
  }
  
  const jsonStr = JSON.stringify(payload);
  console.log("[Identity] Serializing payload:", payload);
  const identity = btoa(unescape(encodeURIComponent(jsonStr)));
  return identity;
}

function normalizeHostname(host) {
  if (!host) return "";
  let h = host.trim();
  // Remove protocol
  if (h.includes("://")) {
    h = h.split("://")[1];
  }
  // Remove path
  if (h.includes("/")) {
    h = h.split("/")[0];
  }
  // Remove port
  if (h.includes(":")) {
    const parts = h.split(":");
    // Check if it's not part of an IPv6 address
    if (!h.includes("]") || h.lastIndexOf(":") > h.lastIndexOf("]")) {
      h = parts[0];
    }
  }
  return h.toLowerCase().replace(/\.$/, "");
}

function matchDomain(pattern, hostname) {
  const h = hostname.toLowerCase();
  const p = pattern.toLowerCase();

  // 1. Exact match
  if (h === p) return true;

  // 2. Wildcard match
  if (p.includes("*")) {
    const regexSource = "^" + p.split("*").map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(".*") + "$";
    const regex = new RegExp(regexSource);
    return regex.test(h);
  }

  // 3. Implicit subdomain match
  return h.endsWith("." + p);
}

// Firefox listener optimized with proxy authentication for identity
async function handleFirefoxProxy(requestInfo) {
  if (!bgState.masterSwitch) return { type: "direct" };

  const url = new URL(requestInfo.url);
  const rules = Object.values(bgState.rules).filter(r => r.active && r.type === 'engine');
  
  const matchingRule = rules.find(r => matchDomain(normalizeHostname(r.source), url.hostname));

  if (matchingRule) {
    const { proxyHost, proxyPort } = parseEngineUrl(5783);

    // Generate identity for Proxy-Authorization
    // Defensive check: ensure tabId is valid
    const cleanTabId = (requestInfo.tabId !== undefined && requestInfo.tabId !== null) ? requestInfo.tabId : -1;
    const identity = await encodeIdentity(cleanTabId);

    const res = { 
      type: "http", 
      host: proxyHost, 
      port: proxyPort,
      username: identity,
      password: "straws" 
    };
    console.log("[AUDIT] Proxy Settings:", res);
    return res;
  }

  return { type: "direct" };
}

// Automatic Proxy Auth Fulfiller (Zero-Prompt)
browser.webRequest.onAuthRequired.addListener(
  async (details) => {
    if (details.isProxy) {
      const cleanTabId = (details.tabId !== undefined && details.tabId !== null) ? details.tabId : -1;
      const identity = await encodeIdentity(cleanTabId);
      console.log(`[AUDIT] Auto-filling Auth for tab ${cleanTabId}`);
      return {
        authCredentials: {
          username: identity,
          password: "straws"
        }
      };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);



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
  if (message.type === 'DELETE_CERT') {
    const port = getNativePort();
    if (!port) {
      sendResponse({ success: false, error: "Engine not connected" });
      return false;
    }
    port.postMessage({ command: "delete_cert", cert_name: message.name });
    sendResponse({ success: true });
    return false;
  }
  if (message.type === 'SET_LEAF_CHAOS') {
    const { tabId, mode, containerName } = message;
    const cleanTabId = Number(tabId);
    if (mode) {
      bgState.leafChaosModes[cleanTabId] = mode;
      if (containerName) bgState.containerChaosModes[containerName] = mode;
    } else {
      delete bgState.leafChaosModes[cleanTabId];
      if (containerName) delete bgState.containerChaosModes[containerName];
    }
    saveChaosModes();
    
    // Engine Sync (Real-time)
    const port = getNativePort();
    if (port) {
      port.postMessage({
        command: "sync_chaos",
        tabId: cleanTabId,
        container: containerName || "",
        mode: mode || "none"
      });
    }

    console.log(`[Identity] Chaos Mode '${mode}' SET for Tab ${cleanTabId} (Container: ${containerName})`);
    sendResponse({ success: true });
    return false;
  }
  if (message.type === 'REFRESH_TAGS') {
    // Legacy support: Tags are now handled via Proxy-Auth
    sendResponse({ success: true });
    return false;
  }
  if (message.type === 'LAUNCH_ISOLATED_LEAF') {
    launchIsolatedLeaf().then(tab => sendResponse({ success: true, tabId: tab.id }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function getContainerInfo(tabId) {
  if (tabId < 0) return null;
  const cached = tabInfoCache.get(tabId);
  if (!cached || !cached.cookieStoreId) return null;

  if (cached.cookieStoreId === 'firefox-default') return null;

  try {
    const container = await browser.contextualIdentities.get(cached.cookieStoreId);
    return {
      name: container.name,
      color: container.color,
      colorCode: getContainerColorCode(container.color)
    };
  } catch (e) {
    return null;
  }
}

function getContainerColorCode(color) {
  const colors = {
    'blue': '#37adff',
    'turquoise': '#00c79a',
    'green': '#51cd00',
    'yellow': '#ffcb00',
    'orange': '#ff9f00',
    'red': '#ff613d',
    'pink': '#ff4bda',
    'purple': '#af51f5'
  };
  return colors[color] || '#808080';
}

async function launchIsolatedLeaf() {
  const containers = await browser.contextualIdentities.query({});
  const strawsContainers = containers.filter(c => c.name.startsWith('Straws Leaf'));
  const nextId = strawsContainers.length + 1;
  const name = `Straws Leaf ${nextId}`;
  
  // Choose sequence of colors
  const colorList = ['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple'];
  const color = colorList[strawsContainers.length % colorList.length];

  const container = await browser.contextualIdentities.create({
    name: name,
    color: color,
    icon: 'fingerprint'
  });

  return await browser.tabs.create({
    cookieStoreId: container.cookieStoreId
  });
}

async function refreshAllLeafTagging() {
  console.log(`[Identity] Identity is now handled via Proxy Authentication.`);
}

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
  
  // Initial Tab Identity Sync
  syncTabCache();
  loadChaosModes();
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
const tabInfoCache = new Map();
const urlToTabMap = new Map(); 

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.hash = ''; // Remove fragment
    return u.toString().replace(/\/$/, ''); // Remove trailing slash
  } catch (e) { return url; }
}
const logBuffer = [];
const MAX_BUFFER = 100;

async function getTabInfo(tabId) {
  if (tabId < 0) return { title: 'Background', url: '', windowId: -1 };
  
  // Only trust cache if windowId is resolved
  if (tabInfoCache.has(tabId)) {
      const cached = tabInfoCache.get(tabId);
      if (cached.windowId !== -1 && cached.windowId !== null) return cached;
  }

  try {
    const tab = await browser.tabs.get(tabId);
    const info = { 
      title: tab.title || 'Untitled Tab', 
      url: tab.url || '', 
      windowId: (tab.windowId !== undefined && tab.windowId !== null && tab.windowId !== -1) ? tab.windowId : -1,
      cookieStoreId: tab.cookieStoreId
    };
    tabInfoCache.set(tabId, info);
    return info;
  } catch (e) {
    // Fallback: search all tabs
    try {
      const tabs = await browser.tabs.query({});
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        const info = {
          title: tab.title || 'Untitled Tab',
          url: tab.url || '',
          windowId: (tab.windowId !== undefined && tab.windowId !== null && tab.windowId !== -1) ? tab.windowId : -1,
          cookieStoreId: tab.cookieStoreId
        };
        tabInfoCache.set(tabId, info);
        return info;
      }
    } catch (e2) {}
    return { title: 'External Tab', url: '', windowId: -1 };
  }
}

// Robust Identity Cache Management
async function syncTabCache() {
  try {
    const tabs = await browser.tabs.query({});
    tabInfoCache.clear();
    for (const tab of tabs) {
      tabInfoCache.set(tab.id, {
        title: tab.title || 'Untitled',
        url: tab.url || '',
        windowId: (tab.windowId !== undefined && tab.windowId !== null) ? tab.windowId : -1,
        cookieStoreId: tab.cookieStoreId
      });
    }
    console.log(`[Identity] Sync complete. Tracking ${tabInfoCache.size} tabs.`);
  } catch (e) {
    console.error("[Identity] Failed to sync tabs:", e);
  }
}

// Event Listeners for Identity Changes
browser.tabs.onCreated.addListener(async (tab) => {
  tabInfoCache.set(tab.id, {
    title: tab.title || 'Untitled',
    url: tab.url || '',
    windowId: tab.windowId,
    cookieStoreId: tab.cookieStoreId
  });
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.title || changeInfo.url || changeInfo.status === 'complete') {
    tabInfoCache.set(tabId, {
      title: tab.title || 'Untitled',
      url: tab.url || '',
      windowId: tab.windowId,
      cookieStoreId: tab.cookieStoreId
    });
  }
});

browser.tabs.onAttached.addListener(async (tabId, attachInfo) => {
  tabInfoCache.set(tabId, {
    title: tab.title || 'Untitled',
    url: tab.url || '',
    windowId: attachInfo.newWindowId,
    cookieStoreId: tab.cookieStoreId
  });
  console.log(`[Identity] Tab ${tabId} moved to window ${attachInfo.newWindowId}`);
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  // Identity is now handled via Proxy-Auth, which catches the tabId directly
});

browser.tabs.onRemoved.addListener((tabId) => {
  tabInfoCache.delete(tabId);
  bgState.leafChaosModes.delete(tabId);
  console.log(`[Identity] Cleaned up state for closed tab ${tabId}`);
});

// Helper to send logs to UI
async function sendLog(log) {
  const container = await getContainerInfo(log.tabId);
  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    ...log,
    container: container
  };
  
  // Push to buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();

  browser.runtime.sendMessage({
    type: 'LOG_ENTRY',
    log: entry
  }).catch(() => { /* No listeners active */ });
}

// setupLeafTagging was here (now handled via Proxy-Auth)

// Cleanup rules when tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
  // tabInfoCache cleanup is handled by the primary onRemoved listener
});

// Update tagging on new requests or tab updates handled by event listeners

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (!bgState.isBrowserLogActive && !bgState.isEngineLogActive) return;
    
    // Identity is now handled via Proxy-Auth directly in handleFirefoxProxy

    const tabInfo = await getTabInfo(details.tabId);
    urlToTabMap.set(normalizeUrl(details.url), { 
      tabId: details.tabId, 
      windowId: details.windowId, 
      title: tabInfo.title,
      time: Date.now()
    });

    // Cleanup old mappings (older than 1 minute)
    if (urlToTabMap.size > 500) {
      const now = Date.now();
      for (const [url, data] of urlToTabMap.entries()) {
        if (now - data.time > 60000) urlToTabMap.delete(url);
      }
    }

    if (!bgState.isBrowserLogActive) return;
    activeRequests.set(details.requestId, {
      startTime: Date.now(),
      url: details.url,
      method: details.method,
      type: details.type,
      tabId: details.tabId,
      windowId: details.windowId
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
  async (details) => {
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

      const tabInfo = await getTabInfo(req.tabId);

      await sendLog({
        url: req.url,
        method: req.method,
        status: details.statusCode,
        ip: details.ip || '-',
        latency: `${latency}ms`,
        from: from,
        type: req.contentType || 'unknown',
        size: size,
        tabId: req.tabId,
        windowId: req.windowId,
        leafTitle: tabInfo.title,
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
  async (details) => {
    if (!bgState.isBrowserLogActive) return;
    const req = activeRequests.get(details.requestId);
    if (req) {
      const urlObj = new URL(req.url);
      const isStrawProxy = Object.values(bgState.rules).some(r => 
        r.active && (r.type === 'proxy' || r.type === 'engine' || r.type === 'passthrough') && (urlObj.hostname === r.source || urlObj.hostname.endsWith('.' + r.source))
      );
      
      let from = 'Network';
      if (isStrawProxy) from = 'Straws (Proxy)';

      const tabInfo = await getTabInfo(req.tabId);

      await sendLog({
        url: req.url,
        method: req.method,
        status: 'Error',
        ip: '-',
        latency: `${Date.now() - req.startTime}ms`,
        from: from,
        type: details.error,
        size: '-',
        tabId: req.tabId,
        windowId: req.windowId,
        leafTitle: tabInfo.title
      });
      activeRequests.delete(details.requestId);
    }
  },
  { urls: ["<all_urls>"] }
);


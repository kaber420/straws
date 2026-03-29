let nativePort = null;
let recentRequests = [];
const MAX_LOGS = 50;

// --- Native Messaging ---

function connectNative() {
  nativePort = chrome.runtime.connectNative("com.omni.straws");
  nativePort.onMessage.addListener((msg) => {
    if (msg.type === "request_log") {
      recentRequests.unshift(msg.log);
      if (recentRequests.length > MAX_LOGS) recentRequests.pop();
      
      // Update sidepanel if open
      chrome.runtime.sendMessage({ type: "new_log", log: msg.log });
    }
  });
  nativePort.onDisconnect.addListener(() => {
    nativePort = null;
    chrome.runtime.sendMessage({ type: "connection_status", status: "disconnected" });
  });
}

function sendNative(msg) {
  if (!nativePort) connectNative();
  if (nativePort) {
    nativePort.postMessage(msg);
  }
}

function logToBridge(text) {
  sendNative({ type: "log", text: text });
}

// --- PAC Management ---

function generatePacScript(rules) {
  let pacRules = "";
  for (const [hostname, config] of Object.entries(rules)) {
    pacRules += `if (shExpMatch(host, "${hostname}")) return "PROXY 127.0.0.1:9000";\n    `;
  }
  
  return `
function FindProxyForURL(url, host) {
    ${pacRules}
    return "DIRECT";
}
  `;
}

async function updateProxy() {
  const data = await chrome.storage.local.get("rules");
  const rules = data.rules || {};
  
  sendNative({ type: "set_rules", rules });

  const pacScript = generatePacScript(rules);
  const config = {
    mode: "pac_script",
    pacScript: {
      data: pacScript
    }
  };

  chrome.proxy.settings.set({ value: config, scope: "regular" });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.rules) {
    updateProxy();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
    const data = await chrome.storage.local.get("rules");
    if (!data.rules) {
        chrome.storage.local.set({ rules: {} });
    }
    connectNative();
});


chrome.runtime.onStartup.addListener(() => {
    connectNative();
    updateProxy();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "open_sidepanel") {
        chrome.sidePanel.open({ windowId: sender.tab?.windowId || chrome.windows.WINDOW_ID_CURRENT });
    } else if (msg.type === "get_logs") {
        sendResponse({ logs: recentRequests });
    } else if (msg.type === "clear_logs") {
        recentRequests = [];
        sendResponse({ success: true });
    } else if (msg.type === "get_status") {
        sendResponse({ status: nativePort ? "connected" : "disconnected" });
    }
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error) => console.error(error));

setInterval(() => {
    sendNative({ type: "ping" });
}, 30000);

let socket = null;
let isPaused = false;
let rules = {};
let isConnected = false;

function connectWS() {
  console.log("Connecting to WebSocket...");
  socket = new WebSocket("ws://127.0.0.1:9002");

  socket.onopen = () => {
    console.log("WebSocket connected");
    isConnected = true;
    chrome.runtime.sendMessage({ type: "status_updated", connected: true }).catch(() => { });
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log("WS msg:", msg);

    if (msg.type === "ready") {
      rules = msg.rules || {};
      isPaused = !!msg.paused;
      updateProxy();
    } else if (msg.type === "rules_updated") {
      rules = msg.rules;
      updateProxy();
      chrome.runtime.sendMessage({ type: "rules_updated", rules }).catch(() => { });
    } else if (msg.type === "status_updated") {
      isPaused = !!msg.paused;
      updateProxy();
      chrome.runtime.sendMessage({ type: "status_updated", paused: isPaused }).catch(() => { });
    } else if (msg.type === "traffic") {
      chrome.runtime.sendMessage({ type: "traffic", data: msg.data }).catch(() => { });
    } else if (msg.status === "ok") {
      // Generic OK response handled if needed
    }
  };

  socket.onclose = () => {
    console.warn("WebSocket disconnected, retrying in 3s...");
    isConnected = false;
    socket = null;
    // We NO LONGER wipe rules here. 
    // We keep the last known state so the UI doesn't flicker to empty.
    updateProxy(); // Still check if we need to clear proxy due to disconnection (if desired)
    chrome.runtime.sendMessage({ type: "status_updated", connected: false }).catch(() => { });
    setTimeout(connectWS, 3000);
  };

  socket.onerror = (err) => {
    console.error("WebSocket error:", err);
    socket.close();
  };
}

function generatePacScript(rules) {
  // Entregamos un objeto literal a Chrome para búsqueda O(1) (máxima eficiencia)
  const hostMap = {};
  for (const hostname in rules) {
    hostMap[hostname] = 1;
  }
  
  const pacCode = `
    var rules = ${JSON.stringify(hostMap)};
    function FindProxyForURL(url, host) {
      if (rules[host]) {
        return "PROXY 127.0.0.1:9000";
      }
      return "DIRECT";
    }
  `.trim();

  return pacCode;
}

async function updateProxy() {
  if (!isConnected || isPaused || Object.keys(rules).length === 0) {
    chrome.proxy.settings.clear({ scope: "regular" }, () => {
      if (chrome.runtime.lastError) console.error("Clear error:", chrome.runtime.lastError);
      else console.log("Proxy settings cleared (Internet direct).");
    });
    return;
  }

  const pacScript = generatePacScript(rules);
  const config = {
    mode: "pac_script",
    pacScript: { data: pacScript }
  };

  chrome.proxy.settings.set({ value: config, scope: "regular" }, () => {
    if (chrome.runtime.lastError) console.error("Proxy error:", chrome.runtime.lastError);
  });
}

// Side Panel behavior: open on click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => connectWS());
chrome.runtime.onStartup.addListener(() => connectWS());
chrome.runtime.onSuspend.addListener(() => {
  chrome.proxy.settings.clear({ scope: "regular" });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "get_status") {
    sendResponse({ connected: isConnected, paused: isPaused, rules });
  } else if (msg.type === "toggle_pause") {
    if (isConnected) socket.send(JSON.stringify({ type: "toggle_pause" }));
  } else if (msg.type === "add_rule") {
    if (isConnected) socket.send(JSON.stringify({ type: "add_rule", host: msg.host, target: msg.target }));
  } else if (msg.type === "remove_rule") {
    if (isConnected) socket.send(JSON.stringify({ type: "remove_rule", host: msg.host }));
  }
  return true;
});

import browser from "webextension-polyfill";

// UI Elements
const tableBody = document.getElementById('network-body');
const detailPanel = document.getElementById('detail-panel');
const noSelection = document.getElementById('no-selection');
const requestDetails = document.getElementById('request-details');
const headerData = document.getElementById('header-data');
const payloadData = document.getElementById('payload-data');
const responseData = document.getElementById('response-data');
const closeDetail = document.getElementById('close-detail');
const liveBtn = document.getElementById('live-btn');
const engineLogBtn = document.getElementById('engine-log-btn');
const recordBtn = document.getElementById('record-btn');
const clearBtn = document.getElementById('clear-btn');
const statusBadge = document.getElementById('engine-status');
const statusText = statusBadge.querySelector('.status-text');
const filterInput = document.getElementById('filter-input');
const logCountBadge = document.getElementById('log-count');

// Data Providers (Lego Architecture)
const provider = {
    onLogMsg: (callback) => {
        browser.runtime.onMessage.addListener((message) => {
            if (message.type === 'LOG_ENTRY') callback(message.log);
        });
    },
    getLogs: async () => {
        try {
            const res = await browser.runtime.sendMessage({ type: 'GET_LOGS' });
            return res.logs || [];
        } catch (e) { return []; }
    },
    setRecording: (enabled) => browser.storage.local.set({ isRecordingActive: enabled }),
    setBrowserLog: (enabled) => browser.storage.local.set({ isBrowserLogActive: enabled }),
    setEngineLog: (enabled) => browser.storage.local.set({ isEngineLogActive: enabled }),
    getRecordingState: async () => (await browser.storage.local.get(['isRecordingActive'])).isRecordingActive || false,
    getBrowserLogState: async () => (await browser.storage.local.get(['isBrowserLogActive'])).isBrowserLogActive || false,
    getEngineLogState: async () => (await browser.storage.local.get(['isEngineLogActive'])).isEngineLogActive || false,
    onStatusChange: (callback) => {
        setInterval(async () => {
            const data = await browser.storage.local.get(['isEngineActive']);
            callback(!!data.isEngineActive);
        }, 2000);
    }
};

// Application State
let logs = [];
let selectedLogId = null;
let currentCategory = 'all';
let startTimeRef = Date.now();

// --- Logic ---

provider.onLogMsg((logData) => {
    const log = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        rawTime: Date.now(),
        ...logData
    };
    
    if (logs.length === 0) startTimeRef = log.rawTime;
    
    logs.push(log);
    if (logs.length > 1000) logs.shift();
    
    updateLogCount();
    if (matchesFilter(log)) renderLogRow(log);
});

function updateLogCount() {
    logCountBadge.textContent = logs.length;
}

function matchesFilter(log) {
    // 1. Text Filter
    const filterText = filterInput.value.toLowerCase();
    const textMatch = !filterText || 
                      log.url.toLowerCase().includes(filterText) || 
                      log.method.toLowerCase().includes(filterText);
    
    if (!textMatch) return false;

    // 2. Category Filter
    if (currentCategory === 'all') return true;
    
    const type = log.type.toLowerCase();
    if (currentCategory === 'api') return type.includes('json') || type.includes('xhr') || type.includes('fetch');
    if (currentCategory === 'asset') return type.includes('image') || type.includes('css') || type.includes('script') || type.includes('font');
    if (currentCategory === 'doc') return type.includes('html');
    
    return true;
}

function renderLogRow(log) {
    const tr = document.createElement('tr');
    tr.dataset.id = log.id;
    if (selectedLogId === log.id) tr.classList.add('selected');
    
    const statusVal = parseInt(log.status);
    const statusGroup = isNaN(statusVal) ? 'unknown' : Math.floor(statusVal / 100) + 'xx';
    const statusColorClass = `status-${statusGroup}`;

    // Waterfall Calculation (Simple visualization)
    const totalTimeRange = 5000; // 5s window for visualization
    const offset = Math.min(((log.rawTime - startTimeRef) % totalTimeRange) / totalTimeRange * 100, 90);
    const latencyVal = parseInt(log.latency) || 10;
    const width = Math.max(Math.min((latencyVal / 1000) * 100, 100 - offset), 2);

    tr.innerHTML = `
        <td class="col-time">${log.timestamp}</td>
        <td class="col-method ${log.method}">${log.method}</td>
        <td class="col-url" title="${log.url}">
            ${log.hasPayload ? '<span class="payload-badge" title="Full Content Available">📦</span> ' : ''}
            ${shortenUrl(log.url)}
        </td>
        <td class="col-status"><span class="status-cell ${statusColorClass}">${log.status}</span></td>
        <td class="col-type">${log.type}</td>
        <td class="col-from"><span class="from-badge ${log.from === 'Straws Engine' ? 'engine' : 'browser'}">${log.from || 'Direct'}</span></td>
        <td class="col-size">${log.size}</td>
        <td class="waterfall-col">
            <div class="wf-track">
                <div class="wf-bar" style="left: ${offset}%; width: ${width}%"></div>
            </div>
        </td>
    `;
    
    tr.addEventListener('click', () => selectRow(log.id));
    tableBody.insertBefore(tr, tableBody.firstChild);
}

function shortenUrl(url) {
    try {
        const u = new URL(url);
        return u.pathname + u.search;
    } catch { return url; }
}

function renderHeaders(headers) {
    if (!headers) return "No headers available.";
    if (typeof headers === 'string') return headers;

    const formatSection = (section) => {
        if (!section || typeof section !== 'object') return section || "";
        if (Array.isArray(section)) {
            return section.map(h => `${h.name || h.Name || '?'}: ${h.value || h.Value || '?'}`).join('\n');
        }
        return Object.entries(section).map(([k, v]) => {
            const val = Array.isArray(v) ? v.join(', ') : v;
            return `${k}: ${val}`;
        }).join('\n');
    };

    if (headers.request || headers.response) {
        let output = "";
        if (headers.request) {
            output += "--- Request Headers ---\n" + formatSection(headers.request) + "\n\n";
        }
        if (headers.response) {
            output += "--- Response Headers ---\n" + formatSection(headers.response);
        }
        return output.trim() || "No headers found in trace.";
    }

    return formatSection(headers);
}

function selectRow(id) {
    selectedLogId = id;
    const log = logs.find(l => l.id === id);
    
    document.querySelectorAll('tbody tr').forEach(tr => tr.classList.remove('selected'));
    const selectedTr = document.querySelector(`tr[data-id="${id}"]`);
    if (selectedTr) selectedTr.classList.add('selected');
    
    detailPanel.classList.add('open');
    noSelection.classList.add('hidden');
    requestDetails.classList.remove('hidden');
    
    const sourceText = document.getElementById('source-text');
    if (sourceText) {
        sourceText.textContent = (log.from === "Straws Engine") ? "Straws Engine" : (log.from || "Browser Extension");
    }

    headerData.textContent = renderHeaders(log.headers);
    
    // Improved payload display
    const formatBody = (body) => {
        if (!body) return "";
        if (typeof body === 'string' && body.trim() === "") return "";
        try {
            if (typeof body === 'string' && (body.startsWith('{') || body.startsWith('['))) {
                return JSON.stringify(JSON.parse(body), null, 2);
            }
        } catch (e) {}
        return typeof body === 'object' ? JSON.stringify(body, null, 2) : body;
    };

    payloadData.textContent = "";
    responseData.textContent = "";

    const formattedPayload = formatBody(log.payload);
    const formattedResponse = formatBody(log.response);

    if (log.from === "Straws Engine" || log.payload) {
        payloadData.textContent = formattedPayload || "(Empty Body)";
    } else {
        payloadData.innerHTML = "<i>Data only available in Straws Engine mode. Engine must be ACTIVE for SSL Termination.</i>";
    }

    if (log.from === "Straws Engine" || log.response) {
        responseData.textContent = formattedResponse || "(Empty Body)";
    } else {
        responseData.innerHTML = "<i>Data only available in Straws Engine mode. Engine must be ACTIVE for SSL Termination.</i>";
    }

    // Update timing
    const timingView = document.getElementById('timing-view');
    if (timingView) {
        timingView.innerHTML = `
            <div class="timing-row" style="display: flex; justify-content: space-between; padding: 10px 12px; background: var(--bg-deep); border-radius: 8px; border: 1px solid var(--border-subtle);">
                <span class="label" style="color: var(--text-muted); font-size: 0.85rem;">Total latency:</span>
                <span class="value" style="color: var(--accent-cyan); font-family: var(--font-mono); font-weight: 700;">${log.latency || 'Unknown'}</span>
            </div>
            <div class="timing-info" style="margin-top: 12px; font-size: 0.7rem; color: var(--text-dim); text-align: center; opacity: 0.6;">
                ℹ️ Waterfall visualization details provided by Engine telemetry.
            </div>`.trim();
    }
}

// Event Listeners
closeDetail.addEventListener('click', () => {
    detailPanel.classList.remove('open');
    selectedLogId = null;
    document.querySelectorAll('tbody tr').forEach(tr => tr.classList.remove('selected'));
});

// Tab Switching
document.querySelectorAll('.insp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.insp-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
        
        tab.classList.add('active');
        document.getElementById(`tab-${target}`).classList.remove('hidden');
    });
});

// Category Pills
document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
        currentCategory = pill.dataset.filter;
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        refreshTable();
    });
});

function refreshTable() {
    tableBody.innerHTML = '';
    logs.filter(matchesFilter).forEach(renderLogRow);
}

filterInput.addEventListener('input', refreshTable);

clearBtn.addEventListener('click', () => {
    logs = [];
    tableBody.innerHTML = '';
    updateLogCount();
    closeDetail.click();
});

recordBtn.addEventListener('click', async () => {
    const currentState = await provider.getRecordingState();
    const newState = !currentState;
    provider.setRecording(newState);
    updateRecordUI(newState);
});

liveBtn.addEventListener('click', async () => {
    const currentState = await provider.getBrowserLogState();
    const newState = !currentState;
    provider.setBrowserLog(newState);
    updateBrowserUI(newState);
});

engineLogBtn.addEventListener('click', async () => {
    const currentState = await provider.getEngineLogState();
    const newState = !currentState;
    provider.setEngineLog(newState);
    updateEngineUI(newState);
});

function updateRecordUI(active) {
    recordBtn.classList.toggle('active', active);
    recordBtn.querySelector('.btn-text').textContent = active ? 'Recording...' : 'Record Session';
}

function updateBrowserUI(active) {
    liveBtn.classList.toggle('active', active);
    liveBtn.querySelector('.btn-text').textContent = active ? 'Browser ON' : 'Browser Logs';
}

function updateEngineUI(active) {
    engineLogBtn.classList.toggle('active', active);
    engineLogBtn.querySelector('.btn-text').textContent = active ? 'Engine ON' : 'Engine Logs';
}

// Status Polling
provider.onStatusChange((isOnline) => {
    statusBadge.classList.toggle('online', isOnline);
    statusText.textContent = isOnline ? "Straws Engine Online" : "Straws Engine Offline";
});

// Init
(async () => {
    updateRecordUI(await provider.getRecordingState());
    updateBrowserUI(await provider.getBrowserLogState());
    updateEngineUI(await provider.getEngineLogState());
    
    // Load history
    const history = await provider.getLogs();
    history.forEach(logData => {
        const log = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            rawTime: Date.now(),
            ...logData
        };
        logs.push(log);
        if (matchesFilter(log)) renderLogRow(log);
    });
    updateLogCount();
})();

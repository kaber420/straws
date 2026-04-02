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
let startTimeRef = null; // Will be set by first log

// Metrics State
const aggregatedStats = {
    totalRequests: 0,
    totalBytes: 0,
    statusCounts: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, "other": 0 },
    latencies: [],
    domainStats: {}, // host -> { count, bytes }
    leaves: new Map() // id -> { title, tabId, windowId, count, bytes, lastSeen, meta: {} }
};

// --- Utilities ---
function parseUA(ua) {
    if (!ua) return { os: 'Unknown OS', browser: 'Unknown Browser' };
    
    let os = 'Unknown OS';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('like Mac')) os = 'iOS';

    let browser = 'Unknown Browser';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    
    const versionMatch = ua.match(/(Firefox|Chrome|Safari|Edge)\/([\d\.]+)/);
    const version = versionMatch ? versionMatch[2].split('.')[0] : '';

    return { os, browser, version: version ? `${browser} ${version}` : browser };
}

// --- Logic ---

provider.onLogMsg((logData) => {
    const log = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        rawTime: Date.now(),
        ...logData
    };
    
    if (logs.length === 0 || !startTimeRef) startTimeRef = log.rawTime;
    
    logs.push(log);
    updateMetrics(log);
    
    if (logs.length > 2000) {
        const removed = logs.shift();
        // Option: Re-calculate metrics if precise history is needed, 
        // but for now we'll keep cumulative stats.
    }
    
    updateLogCount();
    if (matchesFilter(log)) renderLogRow(log);
    updateMetricsUI();
});

function updateMetrics(log) {
    aggregatedStats.totalRequests++;
    
    // Parse size
    const sizeMatch = log.size.match(/([\d\.]+)\s*(KB|MB|B)/i);
    if (sizeMatch) {
        let val = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();
        if (unit === 'KB') val *= 1024;
        else if (unit === 'MB') val *= 1024 * 1024;
        aggregatedStats.totalBytes += val;
    }

    // Status logic
    const s = parseInt(log.status);
    if (s >= 200 && s < 300) aggregatedStats.statusCounts["2xx"]++;
    else if (s >= 300 && s < 400) aggregatedStats.statusCounts["3xx"]++;
    else if (s >= 400 && s < 500) aggregatedStats.statusCounts["4xx"]++;
    else if (s >= 500) aggregatedStats.statusCounts["5xx"]++;
    else aggregatedStats.statusCounts["other"]++;

    // Domain stats
    try {
        const host = new URL(log.url).hostname;
        if (!aggregatedStats.domainStats[host]) aggregatedStats.domainStats[host] = { count: 0, bytes: 0 };
        aggregatedStats.domainStats[host].count++;
    } catch(e) {}

    // Leaf stats
    if (log.tabId !== undefined) {
        const leafId = `${log.windowId}-${log.tabId}`;
        if (!aggregatedStats.leaves.has(leafId)) {
            aggregatedStats.leaves.set(leafId, {
                id: leafId,
                tabId: log.tabId,
                windowId: log.windowId,
                title: log.leafTitle || 'Untitled',
                count: 0,
                bytes: 0,
                lastSeen: Date.now(),
                meta: { os: '', browser: '', lang: '' }
            });
        }
        const leaf = aggregatedStats.leaves.get(leafId);
        leaf.count++;
        leaf.lastSeen = Date.now();
        leaf.title = log.leafTitle || leaf.title;

        // Extract metadata from headers if present
        if (log.headers && log.headers.request) {
            const req = log.headers.request;
            const uaHeader = req['User-Agent'] || req['user-agent'];
            const langHeader = req['Accept-Language'] || req['accept-language'];

            if (uaHeader) {
                const info = parseUA(Array.isArray(uaHeader) ? uaHeader[0] : uaHeader);
                leaf.meta.os = info.os;
                leaf.meta.browser = info.version;
            }
            if (langHeader) {
                leaf.meta.lang = (Array.isArray(langHeader) ? langHeader[0] : langHeader).split(',')[0];
            }
        }

        // Parse size for leaf
        const sizeMatch = log.size.match(/([\d\.]+)\s*(KB|MB|B)/i);
        if (sizeMatch) {
            let val = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2].toUpperCase();
            if (unit === 'KB') val *= 1024;
            else if (unit === 'MB') val *= 1024 * 1024;
            leaf.bytes += val;
        }
    }
}

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

    // Waterfall Calculation (Accurate relative timing)
    const totalTimeRange = 30000; // 30s window for session visualization
    const elapsedSinceStart = log.rawTime - startTimeRef;
    const offset = (elapsedSinceStart % totalTimeRange) / totalTimeRange * 100;
    
    // Parse latency (e.g. "1.2ms" or "450ms")
    let latencyMs = 10;
    const latMatch = log.latency.match(/([\d\.]+)(ms|s)/);
    if (latMatch) {
        latencyMs = parseFloat(latMatch[1]);
        if (latMatch[2] === 's') latencyMs *= 1000;
    }
    const width = Math.max(Math.min((latencyMs / totalTimeRange) * 100, 100 - offset), 1);

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
    
    const requestHeaders = headers.request || {};
    const responseHeaders = headers.response || {};

    const sensitiveKeys = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'token', 'bearer', 'proxy-authorization'];

    const createTable = (data, title) => {
        if (!data || Object.keys(data).length === 0) return "";
        let html = `<div class="inspector-section-title">${title}</div>`;
        html += `<table class="kv-table">`;
        Object.entries(data).forEach(([k, v]) => {
            const val = Array.isArray(v) ? v.join(', ') : v;
            const isSensitive = sensitiveKeys.includes(k.toLowerCase());
            const isLong = val && val.length > 50;

            let valueDisplay = val;
            
            // 1. Marquee if long
            if (isLong) {
                const duration = Math.max(5, Math.floor(val.length / 10));
                valueDisplay = `<div class="marquee-wrapper" style="--marq-duration: ${duration}s">
                                    <div class="marquee-content">${val}</div>
                                </div>`;
            }

            // 2. Sensitive Masking
            if (isSensitive) {
                valueDisplay = `<div class="sensitive-mask">${valueDisplay}</div>`;
            }

            html += `<tr><td class="key">${k}</td><td class="value">${valueDisplay}</td></tr>`;
        });
        html += `</table>`;
        return html;
    };

    let finalHtml = "";
    finalHtml += createTable(requestHeaders, "Request Headers");
    finalHtml += createTable(responseHeaders, "Response Headers");
    
    return finalHtml || '<div class="insp-empty-hint">No structured headers found.</div>';
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

    headerData.innerHTML = renderHeaders(log.headers);
    
    // Improved payload display
    const formatBody = (body, isResponse = false) => {
        if (!body) return `<div class="insp-empty-hint">(Empty ${isResponse ? 'Response' : 'Request'} Body)</div>`;
        
        // Check for binary hint from engine
        if (typeof body === 'string' && body.startsWith('(Binary Data:')) {
            return `<div class="binary-view">
                        <div class="binary-icon">📦</div>
                        <div class="binary-info">${body}</div>
                        <button class="btn btn-small" onclick="alert('Hex view coming soon')">Show Hex Dump</button>
                    </div>`;
        }

        try {
            if (typeof body === 'string' && (body.trim().startsWith('{') || body.trim().startsWith('['))) {
                const formatted = JSON.stringify(JSON.parse(body), null, 2);
                return `<pre class="code-view language-json">${formatted}</pre>`;
            }
        } catch (e) {}
        
        return `<pre class="code-view">${typeof body === 'object' ? JSON.stringify(body, null, 2) : body}</pre>`;
    };

    payloadData.innerHTML = formatBody(log.payload, false);
    responseData.innerHTML = formatBody(log.response, true);

    if (log.from !== "Straws Engine" && !log.payload && !log.response) {
        const hint = `<div class="engine-only-hint">
                        ℹ️ Full payload decryption requires <b>Straws Engine</b> with SSL Termination active.
                      </div>`;
        payloadData.innerHTML += hint;
        responseData.innerHTML += hint;
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

// Navigation Switching
document.querySelectorAll('.nav-item').forEach(nav => {
    nav.addEventListener('click', (e) => {
        const view = nav.dataset.view;
        if (!view) return; // Non-view items like Settings
        
        e.preventDefault();
        
        // Update nav UI
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        
        // Switch Views
        document.querySelectorAll('.view-container').forEach(v => v.classList.add('hidden'));
        const targetView = document.getElementById(`view-${view}`);
        if (targetView) targetView.classList.remove('hidden');
        
        // If switching to metrics, certs, or leaves, refresh UI
        if (view === 'metrics') updateMetricsUI();
        if (view === 'certificates') fetchCertificates();
        if (view === 'leaves') renderLeavesInventory();
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

function updateMetricsUI() {
    const tReq = document.getElementById('stat-total-req');
    const tData = document.getElementById('stat-total-data');
    const tErr = document.getElementById('stat-error-rate');
    
    if (tReq) tReq.textContent = aggregatedStats.totalRequests;
    if (tData) {
        const mb = (aggregatedStats.totalBytes / (1024 * 1024)).toFixed(2);
        tData.textContent = mb + " MB";
    }
    if (tErr) {
        const errors = aggregatedStats.statusCounts["4xx"] + aggregatedStats.statusCounts["5xx"];
        const rate = aggregatedStats.totalRequests > 0 ? (errors / aggregatedStats.totalRequests * 100).toFixed(1) : 0;
        tErr.textContent = rate + "%";
    }

    const tDomains = document.getElementById('stat-active-domains');
    if (tDomains) {
        tDomains.textContent = Object.keys(aggregatedStats.domainStats).length;
    }

    // Status bar update
    const statusBar = document.getElementById('status-distribution-bar');
    if (statusBar) {
        const total = aggregatedStats.totalRequests || 1;
        const p2xx = (aggregatedStats.statusCounts["2xx"] / total * 100);
        const p3xx = (aggregatedStats.statusCounts["3xx"] / total * 100);
        const p4xx = (aggregatedStats.statusCounts["4xx"] / total * 100);
        const p5xx = (aggregatedStats.statusCounts["5xx"] / total * 100);
        
        statusBar.innerHTML = `
            <div class="seg seg-2xx" style="width: ${p2xx}%" title="2xx: ${aggregatedStats.statusCounts["2xx"]}"></div>
            <div class="seg seg-3xx" style="width: ${p3xx}%" title="3xx: ${aggregatedStats.statusCounts["3xx"]}"></div>
            <div class="seg seg-4xx" style="width: ${p4xx}%" title="4xx: ${aggregatedStats.statusCounts["4xx"]}"></div>
            <div class="seg seg-5xx" style="width: ${p5xx}%" title="5xx: ${aggregatedStats.statusCounts["5xx"]}"></div>
        `;
    }

    // Real-time Leaf refresh
    const leavesView = document.getElementById('view-leaves');
    if (leavesView && !leavesView.classList.contains('hidden')) {
        renderLeavesInventory();
    }
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

// --- Certificate Management ---

async function fetchCertificates() {
    try {
        const response = await browser.runtime.sendMessage({ type: 'GET_CERTS' });
        if (response && response.certs) {
            renderCertificates(response.certs);
        }
    } catch (e) {
        console.error("Failed to fetch certs:", e);
    }
}

function renderCertificates(certs) {
    const list = document.getElementById('certs-list');
    if (!list) return;

    if (!certs || certs.length === 0) {
        list.innerHTML = `<div class="certs-empty">
            <span class="icon" style="font-size: 2rem; display: block; margin-bottom: 12px;">📭</span>
            No certificates found in engine directory.
        </div>`;
        return;
    }

    list.innerHTML = certs.map(name => `
        <div class="cert-card">
            <div class="cert-main">
                <span class="cert-name">${name}</span>
                <span class="cert-type">SSL/TLS KeyPair</span>
            </div>
            <button class="btn-danger delete-cert-btn" data-name="${name}">
                Delete
            </button>
        </div>
    `).join('');

    // Attach delete listeners
    list.querySelectorAll('.delete-cert-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            if (confirm(`Are you sure you want to delete the certificate for "${name}"? This will remove physical files from the engine.`)) {
                deleteCertificate(name);
            }
        });
    });
}

async function deleteCertificate(name) {
    try {
        const response = await browser.runtime.sendMessage({ type: 'DELETE_CERT', name: name });
        if (response && response.success) {
            fetchCertificates(); // Refresh
        } else {
            alert("Failed to delete certificate: " + (response.error || "Unknown error"));
        }
    } catch (e) {
        console.error("Delete cert error:", e);
    }
}

// Refresh button listener
const refreshCertsBtn = document.getElementById('refresh-certs-btn');
if (refreshCertsBtn) {
    refreshCertsBtn.addEventListener('click', fetchCertificates);
}

// --- Leaves Inventory ---

function renderLeavesInventory() {
    const list = document.getElementById('leaves-inventory');
    const countBadge = document.getElementById('leaf-count');
    if (!list) return;

    if (aggregatedStats.leaves.size === 0) {
        list.innerHTML = `<div class="insp-empty">
            <div class="insp-empty-icon">🍃</div>
            <p>Waiting for traffic logic to identify active leaves...</p>
        </div>`;
        if (countBadge) countBadge.textContent = "0";
        return;
    }

    if (countBadge) countBadge.textContent = aggregatedStats.leaves.size;

    const sortedLeaves = Array.from(aggregatedStats.leaves.values())
        .sort((a, b) => b.lastSeen - a.lastSeen);

    list.innerHTML = sortedLeaves.map(leaf => {
        const mb = (leaf.bytes / (1024 * 1024)).toFixed(2);
        const isBackground = leaf.tabId < 0;
        
        return `
            <div class="leaf-card" data-id="${leaf.id}">
                ${leaf.id.includes('multi') ? '<span class="leaf-pro-badge">PRO</span>' : ''}
                <div class="leaf-header">
                    <div class="leaf-icon">${isBackground ? '⚙️' : '📑'}</div>
                    <div class="leaf-meta">
                        <span class="leaf-title" title="${leaf.title}">${leaf.title}</span>
                        <span class="leaf-id">ID: ${leaf.id} ${isBackground ? '(System)' : ''}</span>
                    </div>
                </div>
                <div class="leaf-meta-row">
                    ${leaf.meta.os ? `<span class="l-badge badge-os">${leaf.meta.os}</span>` : ''}
                    ${leaf.meta.browser ? `<span class="l-badge badge-browser">${leaf.meta.browser}</span>` : ''}
                    ${leaf.meta.lang ? `<span class="l-badge badge-lang">${leaf.meta.lang}</span>` : ''}
                </div>
                <div class="leaf-stats">
                    <div class="l-stat">
                        <span class="l-stat-label">Requests</span>
                        <span class="l-stat-value">${leaf.count}</span>
                    </div>
                    <div class="l-stat">
                        <span class="l-stat-label">Data</span>
                        <span class="l-stat-value">${mb} MB</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

const refreshLeavesBtn = document.getElementById('refresh-leaves-btn');
if (refreshLeavesBtn) {
    refreshLeavesBtn.addEventListener('click', renderLeavesInventory);
}

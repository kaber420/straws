import { dom } from './dom.js';
import { state, setSelectedLogId, setSelectedRequests } from './state.js';
import { renderDiffPaneView } from './diffEngine.js';
import { formatBytes, parseUA, shortenUrl } from './utils.js';
import { renderLeavesInventory } from './leaves.js';

export function updateMetrics(log) {
    state.aggregatedStats.totalRequests++;
    
    const sizeMatch = log.size ? log.size.match(/([\d\.]+)\s*(KB|MB|B)/i) : null;
    if (sizeMatch) {
        let val = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();
        if (unit === 'KB') val *= 1024;
        else if (unit === 'MB') val *= 1024 * 1024;
        state.aggregatedStats.totalBytes += val;
    }

    const s = parseInt(log.status);
    if (!isNaN(s)) {
        if (s >= 200 && s < 300) state.aggregatedStats.statusCounts["2xx"]++;
        else if (s >= 300 && s < 400) state.aggregatedStats.statusCounts["3xx"]++;
        else if (s >= 400 && s < 500) state.aggregatedStats.statusCounts["4xx"]++;
        else if (s >= 500) state.aggregatedStats.statusCounts["5xx"]++;
        else state.aggregatedStats.statusCounts["other"]++;
    }

    try {
        if (log.url) {
            const host = new URL(log.url).hostname;
            if (!state.aggregatedStats.domainStats[host]) state.aggregatedStats.domainStats[host] = { count: 0, bytes: 0 };
            state.aggregatedStats.domainStats[host].count++;
        }
    } catch(e) {}

    if (log.tabId !== undefined && log.tabId !== null && log.tabId >= 0) {
        const winId = (log.windowId !== undefined && log.windowId !== null) ? log.windowId : -1;
        const leafId = `${winId}-${log.tabId}`;
        if (!state.aggregatedStats.leaves.has(leafId)) {
            state.aggregatedStats.leaves.set(leafId, {
                id: leafId,
                tabId: log.tabId,
                windowId: log.windowId,
                title: log.leafTitle || 'Untitled',
                container: log.container || null,
                count: 0,
                bytes: 0,
                lastSeen: Date.now(),
                meta: { os: '', browser: '', lang: '' },
                latencies: [],
                statusCounts: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, "other": 0 },
                domains: {},
                chaosMode: null
            });
        }
        const leaf = state.aggregatedStats.leaves.get(leafId);
        leaf.count++;
        leaf.lastSeen = Date.now();
        leaf.title = log.leafTitle || leaf.title;
        if (log.container) leaf.container = log.container;

        const latMatch = log.latency ? log.latency.match(/([\d\.]+)(ms|s)/) : null;
        if (latMatch) {
            let latencyMs = parseFloat(latMatch[1]);
            if (latMatch[2] === 's') latencyMs *= 1000;
            leaf.latencies.push(latencyMs);
            if (leaf.latencies.length > 100) leaf.latencies.shift();
        }

        const leafStatus = parseInt(log.status);
        if (!isNaN(leafStatus)) {
            if (leafStatus >= 200 && leafStatus < 300) leaf.statusCounts["2xx"]++;
            else if (leafStatus >= 300 && leafStatus < 400) leaf.statusCounts["3xx"]++;
            else if (leafStatus >= 400 && leafStatus < 500) leaf.statusCounts["4xx"]++;
            else if (leafStatus >= 500) leaf.statusCounts["5xx"]++;
            else leaf.statusCounts["other"]++;
        }

        try {
            if (log.url) {
                const host = new URL(log.url).hostname;
                leaf.domains[host] = (leaf.domains[host] || 0) + 1;
            }
        } catch(e) {}

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

        const leafSizeMatch = log.size ? log.size.match(/([\d\.]+)\s*(KB|MB|B)/i) : null;
        if (leafSizeMatch) {
            let val = parseFloat(leafSizeMatch[1]);
            const unit = leafSizeMatch[2].toUpperCase();
            if (unit === 'KB') val *= 1024;
            else if (unit === 'MB') val *= 1024 * 1024;
            leaf.bytes += val;
        }
    }
}

export function updateLogCount() {
    if (dom.logCountBadge) dom.logCountBadge.textContent = state.logs.length;
}

export function matchesFilter(log) {
    const filterText = dom.filterInput ? dom.filterInput.value.toLowerCase() : '';
    const textMatch = !filterText || 
                      (log.url && log.url.toLowerCase().includes(filterText)) || 
                      (log.method && log.method.toLowerCase().includes(filterText));
    
    if (!textMatch) return false;

    if (state.currentCategory === 'all') return true;
    
    const type = log.type ? log.type.toLowerCase() : '';
    if (state.currentCategory === 'api') return type.includes('json') || type.includes('xhr') || type.includes('fetch');
    if (state.currentCategory === 'asset') return type.includes('image') || type.includes('css') || type.includes('script') || type.includes('font');
    if (state.currentCategory === 'doc') return type.includes('html');
    
    return true;
}

export function renderLogRow(log) {
    const tr = document.createElement('tr');
    tr.dataset.id = log.id;
    if (state.selectedLogId === log.id) tr.classList.add('selected');
    
    const statusVal = parseInt(log.status);
    const statusGroup = isNaN(statusVal) ? 'unknown' : Math.floor(statusVal / 100) + 'xx';
    const statusColorClass = `status-${statusGroup}`;

    const totalTimeRange = 30000;
    const elapsedSinceStart = log.rawTime - state.startTimeRef;
    const offset = (elapsedSinceStart % totalTimeRange) / totalTimeRange * 100;
    
    let latencyMs = 10;
    const latMatch = log.latency ? log.latency.match(/([\d\.]+)(ms|s)/) : null;
    if (latMatch) {
        latencyMs = parseFloat(latMatch[1]);
        if (latMatch[2] === 's') latencyMs *= 1000;
    }
    const width = Math.max(Math.min((latencyMs / totalTimeRange) * 100, 100 - offset), 1);

    const isChecked = state.selectedRequests.includes(log.id) ? 'checked' : '';

    tr.innerHTML = `
        <td class="compare-checkbox-cell" onclick="event.stopPropagation()">
            <input type="checkbox" class="compare-checkbox" data-id="${log.id}" ${isChecked}>
        </td>
        <td class="col-time">${log.timestamp || ''}</td>
        <td class="col-method ${log.method}">${log.method}</td>
        <td class="col-url" title="${log.url}">
            ${log.container ? `<span class="container-badge" style="border-color: ${log.container.colorCode}; color: ${log.container.colorCode}">${log.container.name}</span>` : ''}
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

    const checkbox = tr.querySelector('.compare-checkbox');
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (state.selectedRequests.length >= 2) {
                const removedId = state.selectedRequests.shift();
                const oldRowCv = document.querySelector(`.compare-checkbox[data-id="${removedId}"]`);
                if (oldRowCv) oldRowCv.checked = false;
            }
            state.selectedRequests.push(log.id);
        } else {
            setSelectedRequests(state.selectedRequests.filter(id => id !== log.id));
        }
        
        if (state.selectedRequests.length === 2) {
            dom.globalCompareBtn.classList.remove('hidden');
        } else {
            dom.globalCompareBtn.classList.add('hidden');
        }
    });

    if (dom.tableBody) dom.tableBody.insertBefore(tr, dom.tableBody.firstChild);
}

export function refreshTable() {
    if (!dom.tableBody) return;
    dom.tableBody.innerHTML = '';
    state.logs.filter(matchesFilter).forEach(renderLogRow);
}

export function renderHeaders(headers) {
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
            
            if (isLong) {
                const duration = Math.max(5, Math.floor(val.length / 10));
                valueDisplay = `<div class="marquee-wrapper" style="--marq-duration: ${duration}s">
                                    <div class="marquee-content">${val}</div>
                                </div>`;
            }

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

export function selectRow(id) {
    setSelectedLogId(id);
    const log = state.logs.find(l => l.id === id);
    if (!log) return;
    
    document.querySelectorAll('tbody tr').forEach(tr => tr.classList.remove('selected'));
    const selectedTr = document.querySelector(`tr[data-id="${id}"]`);
    if (selectedTr) selectedTr.classList.add('selected');
    
    dom.detailPanel.classList.add('open');
    dom.noSelection.classList.add('hidden');
    dom.requestDetails.classList.remove('hidden');
    
    const sourceText = document.getElementById('source-text');
    if (sourceText) {
        const winIdStr = (log.windowId !== null && log.windowId !== -1) ? log.windowId : '?';
        const idStr = (log.tabId !== undefined && log.tabId !== -1) ? ` [ID: ${winIdStr}-${log.tabId}]` : '';
        sourceText.textContent = ((log.from === "Straws Engine") ? "Straws Engine" : (log.from || "Extension")) + idStr;
    }

    dom.headerData.innerHTML = renderHeaders(log.headers);
    
    const formatBody = (body, isResponse = false) => {
        if (!body) return `<div class="insp-empty-hint">(Empty ${isResponse ? 'Response' : 'Request'} Body)</div>`;
        
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

    dom.payloadData.innerHTML = formatBody(log.payload, false);
    dom.responseData.innerHTML = formatBody(log.response, true);

    if (log.from !== "Straws Engine" && !log.payload && !log.response) {
        const hint = `<div class="engine-only-hint">
                        ℹ️ Full payload decryption requires <b>Straws Engine</b> with SSL Termination active.
                      </div>`;
        dom.payloadData.innerHTML += hint;
        dom.responseData.innerHTML += hint;
    }

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

export function updateMetricsUI() {
    const tReq = document.getElementById('stat-total-req');
    const tData = document.getElementById('stat-total-data');
    const tErr = document.getElementById('stat-error-rate');
    
    if (tReq) tReq.textContent = state.aggregatedStats.totalRequests;
    if (tData) {
        const mb = (state.aggregatedStats.totalBytes / (1024 * 1024)).toFixed(2);
        tData.textContent = mb + " MB";
    }
    if (tErr) {
        const errors = state.aggregatedStats.statusCounts["4xx"] + state.aggregatedStats.statusCounts["5xx"];
        const rate = state.aggregatedStats.totalRequests > 0 ? (errors / state.aggregatedStats.totalRequests * 100).toFixed(1) : 0;
        tErr.textContent = rate + "%";
    }

    const tDomains = document.getElementById('stat-active-domains');
    if (tDomains) {
        tDomains.textContent = Object.keys(state.aggregatedStats.domainStats).length;
    }

    const statusBar = document.getElementById('status-distribution-bar');
    if (statusBar) {
        const total = state.aggregatedStats.totalRequests || 1;
        const p2xx = (state.aggregatedStats.statusCounts["2xx"] / total * 100);
        const p3xx = (state.aggregatedStats.statusCounts["3xx"] / total * 100);
        const p4xx = (state.aggregatedStats.statusCounts["4xx"] / total * 100);
        const p5xx = (state.aggregatedStats.statusCounts["5xx"] / total * 100);
        
        statusBar.innerHTML = `
            <div class="seg seg-2xx" style="width: ${p2xx}%" title="2xx: ${state.aggregatedStats.statusCounts["2xx"]}"></div>
            <div class="seg seg-3xx" style="width: ${p3xx}%" title="3xx: ${state.aggregatedStats.statusCounts["3xx"]}"></div>
            <div class="seg seg-4xx" style="width: ${p4xx}%" title="4xx: ${state.aggregatedStats.statusCounts["4xx"]}"></div>
            <div class="seg seg-5xx" style="width: ${p5xx}%" title="5xx: ${state.aggregatedStats.statusCounts["5xx"]}"></div>
        `;
    }

    const leavesView = document.getElementById('view-leaves');
    if (leavesView && !leavesView.classList.contains('hidden')) {
        renderLeavesInventory();
    }
}

export function updateRecordUI(active) {
    if (dom.recordBtn) {
        dom.recordBtn.classList.toggle('active', active);
        const btnText = dom.recordBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = active ? 'Recording...' : 'Record Session';
    }
}

export function updateBrowserUI(active) {
    if (dom.liveBtn) {
        dom.liveBtn.classList.toggle('active', active);
        const btnText = dom.liveBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = active ? 'Browser ON' : 'Browser Logs';
    }
}

export function updateEngineUI(active) {
    if (dom.engineLogBtn) {
        dom.engineLogBtn.classList.toggle('active', active);
        const btnText = dom.engineLogBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = active ? 'Engine ON' : 'Engine Logs';
    }
}

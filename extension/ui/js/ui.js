window.StrawsUI = {
    root: document,
    
    init: async (root = document) => {
        StrawsUI.root = root;
        StrawsUI.bindEvents();
        await StrawsUI.refreshStraws();
    },

    elements: {
        strawList: () => StrawsUI.root.getElementById('strawList') || StrawsUI.root.getElementById('ruleList'),
        hostInput: () => StrawsUI.root.getElementById('hostInput'),
        targetInput: () => StrawsUI.root.getElementById('targetInput'),
        headerList: () => StrawsUI.root.getElementById('headerList'),
        addHeaderBtn: () => StrawsUI.root.getElementById('addHeaderBtn'),
        addStrawBtn: () => StrawsUI.root.getElementById('addStrawBtn') || StrawsUI.root.getElementById('addRuleBtn'),
        logList: () => StrawsUI.root.getElementById('logList'),
        clearLogsBtn: () => StrawsUI.root.getElementById('clearLogsBtn'),
        statusPill: () => StrawsUI.root.getElementById('statusPill'),
        statusText: () => StrawsUI.root.getElementById('statusText')
    },

    bindEvents: () => {
        const addHdr = StrawsUI.elements.addHeaderBtn();
        if (addHdr) addHdr.onclick = () => StrawsUI.createHeaderRow();
        
        const addStraw = StrawsUI.elements.addStrawBtn();
        if (addStraw) addStraw.onclick = StrawsUI.handleAddStraw;
        
        const clearLogs = StrawsUI.elements.clearLogsBtn();
        if (clearLogs) clearLogs.onclick = () => {
            const list = StrawsUI.elements.logList();
            if (list) list.innerHTML = '';
        };

        // Background Listeners
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === "traffic") {
                StrawsUI.addLogEntry(msg.data);
            } else if (msg.type === "rules_updated") {
                StrawsUI.refreshStraws();
            } else if (msg.type === "status_updated") {
                StrawsUI.checkStatus();
            }
        });

        StrawsUI.checkStatus();
    },

    checkStatus: async () => {
        const response = await chrome.runtime.sendMessage({ type: "get_status" });
        if (response) {
            StrawsUI.updateStatus(response.connected, response.paused);
            if (response.rules) StrawsUI.renderRules(response.rules);
        } else {
            StrawsUI.updateStatus(false, false);
        }
    },

    updateStatus: (connected, paused) => {
        const pill = StrawsUI.elements.statusPill();
        const text = StrawsUI.elements.statusText();
        
        if (pill) {
            pill.className = `status-pill ${connected ? (paused ? 'paused' : 'connected') : 'disconnected'}`;
        }
        
        if (text) {
            if (!connected) {
                text.textContent = 'HOST DISCONNECTED';
            } else {
                text.textContent = paused ? 'PROXY PAUSED' : 'STRAWS ACTIVE';
            }
        }
    },

    addLogEntry: (log) => {
        const container = StrawsUI.elements.logList();
        if (!container) return;

        const entry = document.createElement('div');
        entry.className = 'log-item';
        
        const statusClass = log.status >= 500 ? 'status-5xx' : (log.status >= 400 ? 'status-4xx' : 'status-2xx');
        
        entry.innerHTML = `
            <div class="log-header">
                <div>
                    <span class="log-method">${log.method}</span>
                    <span style="opacity:0.8">${log.host}</span>
                </div>
                <span class="log-status ${statusClass}">${log.status}</span>
            </div>
            <div class="log-details">
                <div>➡️ ${log.target}</div>
            </div>
        `;

        container.prepend(entry);
        if (container.children.length > 50) container.lastElementChild.remove();
    },

    createHeaderRow: (key = '', value = '') => {
        const list = StrawsUI.elements.headerList();
        if (!list) return;

        const row = document.createElement('div');
        row.className = 'header-row';
        row.innerHTML = `
            <input type="text" class="header-key" placeholder="Key" value="${key}">
            <input type="text" class="header-value" placeholder="Value" value="${value}">
            <button class="remove-header" title="Remove">&times;</button>
        `;
        row.querySelector('.remove-header').onclick = () => row.remove();
        list.appendChild(row);
    },

    handleAddStraw: async () => {
        const hostEl = StrawsUI.elements.hostInput();
        const targetEl = StrawsUI.elements.targetInput();
        const host = hostEl.value.trim();
        const target = targetEl.value.trim();
        
        if (host && target) {
            const headers = {};
            const rows = StrawsUI.root.querySelectorAll('.header-row');
            rows.forEach(row => {
                const k = row.querySelector('.header-key').value.trim();
                const v = row.querySelector('.header-value').value.trim();
                if (k) headers[k] = v;
            });

            await StrawsStorage.saveStraw(host, { target, headers });
            
            hostEl.value = '';
            targetEl.value = '';
            const list = StrawsUI.elements.headerList();
            if (list) list.innerHTML = '';
            
            StrawsUI.refreshStraws();
        } else {
            alert("Host and Target are required.");
        }
    },

    refreshStraws: async () => {
        const straws = await StrawsStorage.getStraws();
        StrawsUI.renderRules(straws);
    },

    renderRules: (straws) => {
        const container = StrawsUI.elements.strawList();
        if (!container) return;
        
        if (!straws || Object.keys(straws).length === 0) {
            container.innerHTML = `<div class="empty-state">No redirection straws.</div>`;
            return;
        }

        container.innerHTML = '';
        for (const [host, target] of Object.entries(straws)) {
            const card = document.createElement('div');
            card.className = 'glass-bubble rule-item';
            
            card.innerHTML = `
                <div class="rule-header">
                    <div class="rule-info">
                        <div class="rule-host">${host}</div>
                        <div class="rule-target" style="opacity: 0.7; font-size: 0.8rem;">➡️ ${typeof target === 'object' ? target.target : target}</div>
                    </div>
                    <button class="delete-btn" data-host="${host}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            
            card.querySelector('.delete-btn').onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Remove redirection for ${host}?`)) {
                    await StrawsStorage.deleteStraw(host);
                    StrawsUI.refreshStraws();
                }
            };
            
            container.appendChild(card);
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => StrawsUI.init());
} else {
    StrawsUI.init();
}

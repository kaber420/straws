window.StrawsUI = {
    root: document,
    
    init: async (root = document) => {
        StrawsUI.root = root;
        if (window.ThemeEngine) await ThemeEngine.init(root);
        StrawsUI.bindEvents();
        await StrawsUI.refreshStraws();
        // i18n init
        StrawsUI.applyI18n();
    },

    applyI18n: () => {
        const elements = StrawsUI.root.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const msg = chrome.i18n.getMessage(el.dataset.i18n);
            if (msg) el.textContent = msg;
        });
        const placeholders = StrawsUI.root.querySelectorAll('[data-i18n-placeholder]');
        placeholders.forEach(el => {
            const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
            if (msg) el.placeholder = msg;
        });
    },

    elements: {
        strawList: () => StrawsUI.root.getElementById('strawList') || StrawsUI.root.getElementById('ruleList'),
        hostInput: () => StrawsUI.root.getElementById('hostInput'),
        targetInput: () => StrawsUI.root.getElementById('targetInput'),
        headerList: () => StrawsUI.root.getElementById('headerList'),
        addHeaderBtn: () => StrawsUI.root.getElementById('addHeaderBtn'),
        addStrawBtn: () => StrawsUI.root.getElementById('addStrawBtn') || StrawsUI.root.getElementById('addRuleBtn'),
        themeBtns: () => StrawsUI.root.querySelectorAll('.theme-btn'),
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
        
        StrawsUI.elements.themeBtns().forEach(btn => {
            btn.onclick = () => ThemeEngine.set(btn.dataset.theme, StrawsUI.root);
        });

        const clearLogs = StrawsUI.elements.clearLogsBtn();
        if (clearLogs) clearLogs.onclick = async () => {
            await chrome.runtime.sendMessage({ type: "clear_logs" });
            StrawsUI.refreshLogs();
        };

        const presetBtns = StrawsUI.root.querySelectorAll('.preset-btn[data-type]');
        presetBtns.forEach(btn => {
            btn.onclick = () => StrawsUI.handlePreset(btn.dataset.type);
        });

        // Background Listeners
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === "new_log") {
                StrawsUI.addLogEntry(msg.log);
            } else if (msg.type === "connection_status") {
                StrawsUI.updateStatus(msg.status);
            }
        });

        // Initial fetch
        StrawsUI.refreshLogs();
        StrawsUI.checkStatus();
    },

    checkStatus: async () => {
        const response = await chrome.runtime.sendMessage({ type: "get_status" });
        if (response && response.status) StrawsUI.updateStatus(response.status);
    },

    updateStatus: (status) => {
        const pill = StrawsUI.elements.statusPill();
        const text = StrawsUI.elements.statusText();
        if (!pill || !text) return;

        pill.className = `status-pill ${status}`;
        text.textContent = status.toUpperCase() === 'CONNECTED' ? 'STRAWS ACTIVE' : 'HOST DISCONNECTED';
    },

    refreshLogs: async () => {
        const response = await chrome.runtime.sendMessage({ type: "get_logs" });
        const container = StrawsUI.elements.logList();
        if (!container) return;
        
        container.innerHTML = '';
        if (response && response.logs) {
            response.logs.forEach(log => StrawsUI.addLogEntry(log));
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
                    <span style="opacity:0.8">${log.hostname}</span>
                </div>
                <span class="log-status ${statusClass}">${log.status}</span>
            </div>
            <div class="log-details">
                <div style="margin-bottom: 4px;">Path: ${log.path}</div>
                <div>Target: ${log.target}</div>
            </div>
        `;

        entry.onclick = () => entry.classList.toggle('expanded');
        
        container.prepend(entry);
        if (container.children.length > 50) container.lastElementChild.remove();
    },

    createHeaderRow: (key = '', value = '') => {
        const row = document.createElement('div');
        row.className = 'header-row';
        row.innerHTML = `
            <input type="text" class="header-key" placeholder="Key" value="${key}">
            <input type="text" class="header-value" placeholder="Value" value="${value}">
            <button class="remove-header" title="Remove">&times;</button>
        `;
        row.querySelector('.remove-header').onclick = () => row.remove();
        StrawsUI.elements.headerList().appendChild(row);
        
        const focusTarget = key && !value ? '.header-value' : (!key ? '.header-key' : null);
        if (focusTarget) row.querySelector(focusTarget).focus();
    },

    handlePreset: (type) => {
        switch (type) {
            case 'bearer': StrawsUI.createHeaderRow('Authorization', 'Bearer '); break;
            case 'basic': {
                const user = prompt("Username:");
                const pass = prompt("Password:");
                if (user && pass) StrawsUI.createHeaderRow('Authorization', `Basic ${btoa(user + ':' + pass)}`);
                break;
            }
            case 'user': StrawsUI.createHeaderRow('X-User', ''); break;
            case 'debug': StrawsUI.createHeaderRow('X-Debug', '1'); break;
        }
    },

    getHeaders: () => {
        const headers = {};
        StrawsUI.root.querySelectorAll('.header-row').forEach(row => {
            const k = row.querySelector('.header-key').value.trim();
            const v = row.querySelector('.header-value').value.trim();
            if (k) headers[k] = v;
        });
        return headers;
    },

    handleAddStraw: async () => {
        const hostEl = StrawsUI.elements.hostInput();
        const targetEl = StrawsUI.elements.targetInput();
        const host = hostEl.value.trim();
        const target = targetEl.value.trim();
        const headers = StrawsUI.getHeaders();
        
        if (host && target) {
            await StrawsStorage.saveStraw(host, { target, headers });
            hostEl.value = '';
            targetEl.value = '';
            StrawsUI.elements.headerList().innerHTML = '';
            await StrawsUI.refreshStraws();
        } else {
            alert("Host and Target are required.");
        }
    },

    refreshStraws: async () => {
        const straws = await StrawsStorage.getStraws();
        const container = StrawsUI.elements.strawList();
        if (!container) return;
        
        if (Object.keys(straws).length === 0) {
            const msg = chrome.i18n.getMessage("noStraws") || "No redirection straws.";
            container.innerHTML = `<div class="empty-state">${msg}</div>`;
            return;
        }

        container.innerHTML = '';
        const disposeMsg = chrome.i18n.getMessage("disposeStraw") || "Dispose Straw";

        for (const [host, config] of Object.entries(straws)) {
            const card = document.createElement('div');
            card.className = 'glass-bubble rule-item';
            
            const tags = Object.entries(config.headers || {})
                .map(([k, v]) => `<span class="tag">${k}: ${v}</span>`).join('');

            card.innerHTML = `
                <div class="rule-header">
                    <div class="rule-info">
                        <div class="rule-host">${host}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <svg class="rule-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>
                <div class="rule-details">
                    <div class="rule-target" style="word-break: break-all; margin-bottom: 8px;">➡️ ${config.target}</div>
                    ${tags ? `<div class="tags-container" style="border-top:none; margin-top:0; padding-top:0;">${tags}</div>` : ''}
                    <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                        <button class="delete-btn" data-host="${host}" style="font-size: 0.7rem; display: flex; align-items: center; gap: 6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            ${disposeMsg}
                        </button>
                    </div>
                </div>
            `;
            
            card.onclick = (e) => {
                if (e.target.closest('.delete-btn')) return;
                card.classList.toggle('expanded');
            };

            card.querySelector('.delete-btn').onclick = async (e) => {
                e.stopPropagation();
                await StrawsStorage.deleteStraw(host);
                await StrawsUI.refreshStraws();
            };
            
            container.appendChild(card);
        }
    }
};

if (document.getElementById('strawList') || document.getElementById('ruleList')) {
    document.addEventListener('DOMContentLoaded', () => StrawsUI.init(document));
}

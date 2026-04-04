import browser from "webextension-polyfill";
import { exportToHAR, importFromHAR } from './har.js';
import { renderDiffPaneView } from './diffEngine.js';
import { dom } from './dom.js';
import { state, setCurrentCategory, setStartTimeRef, addLog, setSelectedLogId, setSelectedRequests } from './state.js';
import { provider } from './provider.js';
import { fetchCertificates, deleteCertificate } from './certificates.js';
import {
    renderLeavesInventory, closeLeafModal, strobeLeaf,
    setLeafChaos, resetAllSimulations
} from './leaves.js';
import {
    updateRecordUI, updateBrowserUI, updateEngineUI,
    updateMetrics, updateLogCount, matchesFilter,
    renderLogRow, refreshTable, updateMetricsUI
} from './render.js';

// Setup provider message listener
provider.onLogMsg((logData) => {
    const log = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        rawTime: Date.now(),
        ...logData
    };
    
    if (state.logs.length === 0 || !state.startTimeRef) setStartTimeRef(log.rawTime);
    
    addLog(log);
    updateMetrics(log);
    
    if (state.logs.length > 2000) {
        state.logs.shift();
    }
    
    updateLogCount();
    if (matchesFilter(log)) renderLogRow(log);
    updateMetricsUI();
});

// Setup provider status polling
provider.onStatusChange((isOnline) => {
    dom.statusBadge?.classList.toggle('online', isOnline);
    if (dom.statusText) dom.statusText.textContent = isOnline ? "Straws Engine Online" : "Straws Engine Offline";
});

// Init
(async () => {
    updateRecordUI(await provider.getRecordingState());
    updateBrowserUI(await provider.getBrowserLogState());
    updateEngineUI(await provider.getEngineLogState());
    
    const history = await provider.getLogs();
    history.forEach(logData => {
        const log = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            rawTime: Date.now(),
            ...logData
        };
        addLog(log);
        if (matchesFilter(log)) renderLogRow(log);
    });
    updateLogCount();
})();

// Attach DOM event listeners
if (dom.closeDetail) {
    dom.closeDetail.addEventListener('click', () => {
        if (dom.detailPanel) dom.detailPanel.classList.remove('open');
        setSelectedLogId(null);
        document.querySelectorAll('tbody tr').forEach(tr => tr.classList.remove('selected'));
    });
}

document.querySelectorAll('.insp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.insp-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
        
        tab.classList.add('active');
        const content = document.getElementById(`tab-${target}`);
        if(content) content.classList.remove('hidden');
    });
});

document.querySelectorAll('.nav-item').forEach(nav => {
    nav.addEventListener('click', (e) => {
        const view = nav.dataset.view;
        if (!view) return;
        
        e.preventDefault();
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        
        document.querySelectorAll('.view-container').forEach(v => v.classList.add('hidden'));
        const targetView = document.getElementById(`view-${view}`);
        if (targetView) targetView.classList.remove('hidden');
        
        if (view === 'metrics') updateMetricsUI();
        if (view === 'certificates') fetchCertificates();
        if (view === 'leaves') renderLeavesInventory();
    });
});

document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
        setCurrentCategory(pill.dataset.filter);
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        refreshTable();
    });
});

if (dom.filterInput) {
    dom.filterInput.addEventListener('input', refreshTable);
}

if (dom.clearBtn) {
    dom.clearBtn.addEventListener('click', () => {
        state.logs.length = 0; 
        if (dom.tableBody) dom.tableBody.innerHTML = '';
        updateLogCount();
        if (dom.closeDetail) dom.closeDetail.click();
    });
}

if (dom.exportHarBtn) {
    dom.exportHarBtn.addEventListener('click', () => {
        if (state.logs.length === 0) {
            alert("No traces to export.");
            return;
        }
        exportToHAR(state.logs);
    });
}

if (dom.importHarBtn) {
    dom.importHarBtn.addEventListener('click', () => {
        if (dom.harFileInput) dom.harFileInput.click();
    });
}

if (dom.harFileInput) {
    dom.harFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const importedLogs = importFromHAR(ev.target.result);
            if (importedLogs.length > 0) {
                importedLogs.forEach(logData => {
                    const log = {
                        ...logData,
                        id: Date.now() + Math.random().toString(36).substr(2, 9)
                    };
                    if (state.logs.length === 0 || !state.startTimeRef) setStartTimeRef(log.rawTime);
                    addLog(log);
                    updateMetrics(log);
                    if (matchesFilter(log)) renderLogRow(log);
                });
                updateLogCount();
                updateMetricsUI();
            } else {
                alert("Failed to import HAR or file contains no entries.");
            }
            if (dom.harFileInput) dom.harFileInput.value = '';
        };
        reader.readAsText(file);
    });
}

if (dom.globalCompareBtn) {
    dom.globalCompareBtn.addEventListener('click', () => {
        if (state.selectedRequests.length !== 2) return;
        
        const reqs = state.selectedRequests.map(id => state.logs.find(l => l.id === id));
        reqs.sort((a, b) => a.rawTime - b.rawTime);
        
        const [olderReq, newerReq] = reqs;

        if (dom.diffOlderContent) dom.diffOlderContent.innerHTML = renderDiffPaneView(olderReq, 'older', newerReq);
        if (dom.diffNewerContent) dom.diffNewerContent.innerHTML = renderDiffPaneView(newerReq, 'newer', olderReq);

        if (dom.diffModal) dom.diffModal.classList.remove('hidden');
    });
}

if (dom.closeDiffModalBtn) {
    dom.closeDiffModalBtn.addEventListener('click', () => {
        if (dom.diffModal) dom.diffModal.classList.add('hidden');
    });
}

if (dom.recordBtn) {
    dom.recordBtn.addEventListener('click', async () => {
        const currentState = await provider.getRecordingState();
        const newState = !currentState;
        provider.setRecording(newState);
        updateRecordUI(newState);
    });
}

if (dom.liveBtn) {
    dom.liveBtn.addEventListener('click', async () => {
        const currentState = await provider.getBrowserLogState();
        const newState = !currentState;
        provider.setBrowserLog(newState);
        updateBrowserUI(newState);
    });
}

if (dom.engineLogBtn) {
    dom.engineLogBtn.addEventListener('click', async () => {
        const currentState = await provider.getEngineLogState();
        const newState = !currentState;
        provider.setEngineLog(newState);
        updateEngineUI(newState);
    });
}

if (dom.refreshCertsBtn) {
    dom.refreshCertsBtn.addEventListener('click', fetchCertificates);
}

if (dom.closeModalBtn) {
    dom.closeModalBtn.addEventListener('click', closeLeafModal);
}

if (dom.leafModal) {
    dom.leafModal.addEventListener('click', (e) => {
        if (e.target === dom.leafModal) closeLeafModal();
    });
}

if (dom.strobeBtn) {
    dom.strobeBtn.addEventListener('click', strobeLeaf);
}

document.querySelectorAll('.chaos-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setLeafChaos(btn.dataset.mode));
});

if (dom.clearChaosBtn) {
    dom.clearChaosBtn.addEventListener('click', resetAllSimulations);
}

if (dom.refreshLeavesBtn) {
    dom.refreshLeavesBtn.addEventListener('click', renderLeavesInventory);
}

browser.runtime.sendMessage({ type: 'REFRESH_TAGS' }).catch(() => {});

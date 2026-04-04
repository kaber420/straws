import browser from "webextension-polyfill";

export const provider = {
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

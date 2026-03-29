const StrawsStorage = {
    getStraws: () => new Promise(resolve => {
        chrome.storage.local.get("rules", data => resolve(data.rules || {}));
    }),
    saveStraw: (host, config) => new Promise(resolve => {
        chrome.storage.local.get("rules", data => {
            const rules = data.rules || {};
            rules[host] = config;
            chrome.storage.local.set({ rules }, resolve);
        });
    }),
    deleteStraw: (host) => new Promise(resolve => {
        chrome.storage.local.get("rules", data => {
            const rules = data.rules || {};
            delete rules[host];
            chrome.storage.local.set({ rules }, resolve);
        });
    }),
    getTheme: () => new Promise(resolve => {
        chrome.storage.local.get("theme", data => resolve(data.theme || 'frost'));
    }),
    setTheme: (theme) => new Promise(resolve => {
        chrome.storage.local.set({ theme }, resolve);
    })
};

window.StrawsStorage = StrawsStorage;

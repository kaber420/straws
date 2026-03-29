const StrawsStorage = {
    getStraws: () => new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "get_status" }, (resp) => {
            resolve(resp ? resp.rules : {});
        });
    }),
    saveStraw: (host, config) => new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "add_rule", host, ...config }, resolve);
    }),
    deleteStraw: (host) => new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "remove_rule", host }, resolve);
    }),
    getTheme: () => new Promise(resolve => {
        chrome.storage.local.get("theme", data => resolve(data.theme || 'frost'));
    }),
    setTheme: (theme) => new Promise(resolve => {
        chrome.storage.local.set({ theme }, resolve);
    })
};

window.StrawsStorage = StrawsStorage;

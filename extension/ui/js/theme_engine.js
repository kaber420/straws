const ThemeEngine = {
    themes: ['frost', 'neo'],
    
    init: async (root = document) => {
        if (!window.StrawsStorage) return;
        const currentTheme = await StrawsStorage.getTheme();
        ThemeEngine.apply(currentTheme, root);
    },
    
    apply: (themeName, root = document) => {
        const head = root === document ? document.head : root;
        let themeLink = root.getElementById('theme-link');
        
        if (!themeLink) {
            themeLink = document.createElement('link');
            themeLink.id = 'theme-link';
            themeLink.rel = 'stylesheet';
            head.appendChild(themeLink);
        }
        
        // Path adjusted for standalone repo structure
        themeLink.href = chrome.runtime.getURL(`ui/css/themes/${themeName}.css`);
        
        const target = root === document ? document.body : root.querySelector('.widget-container');
        if (target) target.setAttribute('data-theme', themeName);
        
        const btns = root.querySelectorAll('.theme-btn');
        btns.forEach(b => {
            b.classList.toggle('active', b.dataset.theme === themeName);
            if (themeName === 'neo') {
                b.style.boxShadow = b.dataset.theme === 'neo' ? 'inset 2px 2px 5px rgba(0,0,0,0.2)' : 'none';
            } else {
                b.style.background = b.dataset.theme === themeName ? 'rgba(255,255,255,0.2)' : 'transparent';
            }
        });
    },
    
    set: async (themeName, root = document) => {
        await StrawsStorage.setTheme(themeName);
        ThemeEngine.apply(themeName, root);
    }
};

window.ThemeEngine = ThemeEngine;

import browser from "webextension-polyfill";
import { state, setActiveDiagnosticId } from './state.js';
import { dom } from './dom.js';
import { formatBytes } from './utils.js';

export function renderLeavesInventory() {
    const list = document.getElementById('leaves-inventory');
    const countBadge = document.getElementById('leaf-count');
    if (!list) return;

    if (state.aggregatedStats.leaves.size === 0) {
        list.innerHTML = `<div class="insp-empty">
            <div class="insp-empty-icon">🍃</div>
            <p>Waiting for traffic logic to identify active leaves...</p>
        </div>`;
        if (countBadge) countBadge.textContent = "0";
        return;
    }

    if (countBadge) countBadge.textContent = state.aggregatedStats.leaves.size;

    const sortedLeaves = Array.from(state.aggregatedStats.leaves.values())
        .sort((a, b) => b.lastSeen - a.lastSeen);

    list.innerHTML = sortedLeaves.map(leaf => {
        const displayTitle = leaf.title || 'Untitled Session';
        const isBackground = leaf.tabId < 0;
        const container = leaf.container;
        const containerHtml = container ? `
            <div class="leaf-container-tag" style="--container-color: ${container.colorCode}">
                ${container.name}
            </div>
        ` : '';

        return `
            <div class="leaf-card ${container ? 'has-container' : ''}" data-id="${leaf.id}" style="--container-color: ${container ? container.colorCode : ''}">
                ${leaf.id.includes('multi') ? '<span class="leaf-pro-badge">PRO</span>' : ''}
                <div class="leaf-header">
                    <div class="leaf-icon" style="border-right: 2px solid ${container ? container.colorCode : 'transparent'}">${isBackground ? '⚙️' : '📑'}</div>
                    <div class="leaf-meta">
                        <span class="leaf-title" title="${displayTitle}">${displayTitle}</span>
                        <span class="leaf-id">ID: ${leaf.windowId !== null && leaf.windowId !== -1 ? leaf.windowId : '?'}-${leaf.tabId}</span>
                        ${containerHtml}
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
                        <span class="l-stat-value">${formatBytes(leaf.bytes)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.leaf-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            openLeafDiagnostic(id);
        });
    });
}

export function openLeafDiagnostic(id) {
    try {
        const leaf = state.aggregatedStats.leaves.get(id);
        if (!leaf) return;

        setActiveDiagnosticId(id);
        const winIdStr = (leaf.windowId !== null && leaf.windowId !== -1) ? leaf.windowId : '?';
        dom.modalLeafTitle.textContent = leaf.title || 'Untitled Session';
        dom.modalLeafId.textContent = `ID: ${winIdStr}-${leaf.tabId}`;

        const avgLat = leaf.latencies.length > 0 
            ? (leaf.latencies.reduce((a, b) => a + b, 0) / leaf.latencies.length).toFixed(1) + 'ms'
            : '0ms';
        
        const errors = leaf.statusCounts["4xx"] + leaf.statusCounts["5xx"];
        const errRate = leaf.count > 0 ? (errors / leaf.count * 100).toFixed(1) + '%' : '0%';

        document.getElementById('modal-avg-latency').textContent = avgLat;
        document.getElementById('modal-error-rate').textContent = errRate;
        document.getElementById('modal-data-vol').textContent = formatBytes(leaf.bytes);
        document.getElementById('modal-total-req').textContent = leaf.count;

        updateChaosUI(leaf.chaosMode);

        const topDomains = Object.entries(leaf.domains)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const domainListEl = document.getElementById('modal-top-domains');
        domainListEl.innerHTML = topDomains.length > 0 
            ? topDomains.map(([name, count]) => `
                <div class="domain-row">
                    <span class="domain-name">${name}</span>
                    <span class="domain-count">${count} req</span>
                </div>
            `).join('')
            : '<div class="insp-empty-hint">No domain data yet</div>';

        if (dom.leafModal) dom.leafModal.classList.remove('hidden');
    } catch (e) {
        console.error("Failed to open diagnostic modal:", e);
        if (dom.leafModal) dom.leafModal.classList.remove('hidden');
    }
}

export function closeLeafModal() {
    if (dom.leafModal) dom.leafModal.classList.add('hidden');
    setActiveDiagnosticId(null);
}

export async function strobeLeaf() {
    if (!state.activeDiagnosticId) return;
    const leaf = state.aggregatedStats.leaves.get(state.activeDiagnosticId);
    if (!leaf || leaf.tabId < 0) {
        alert("Cannot strobe system or background process.");
        return;
    }

    try {
        await browser.tabs.update(leaf.tabId, { active: true });
        await browser.scripting.executeScript({
            target: { tabId: leaf.tabId },
            func: () => {
                const div = document.createElement('div');
                div.style.position = 'fixed';
                div.style.top = '0';
                div.style.left = '0';
                div.style.width = '100vw';
                div.style.height = '100vh';
                div.style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
                div.style.zIndex = '999999';
                div.style.pointerEvents = 'none';
                div.style.animation = 'strobe-blink 0.2s 10';
                
                const style = document.createElement('style');
                style.textContent = '@keyframes strobe-blink { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }';
                document.head.appendChild(style);
                document.body.appendChild(div);
                
                setTimeout(() => {
                    div.remove();
                    style.remove();
                }, 2000);
            }
        });
    } catch (e) {
        console.error("Strobe failed:", e);
        browser.tabs.highlight({ tabs: leaf.tabId, windowId: leaf.windowId });
    }
}

export function updateChaosUI(activeMode) {
    document.querySelectorAll('.chaos-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === activeMode);
    });
    
    // Show/Hide params panel based on mode
    if (dom.chaosParamsPanel) {
        if (activeMode === 'latency' || activeMode === 'jitter') {
            dom.chaosParamsPanel.classList.remove('hidden');
            dom.latencyParam.classList.toggle('hidden', activeMode !== 'latency');
            dom.jitterParam.classList.toggle('hidden', activeMode !== 'jitter');
        } else {
            dom.chaosParamsPanel.classList.add('hidden');
        }
    }

    if (dom.chaosStatusIndicator) {
        if (activeMode) {
            dom.chaosStatusIndicator.classList.remove('hidden');
            const pulse = dom.chaosStatusIndicator.querySelector('.pulse');
            if (pulse) pulse.textContent = getChaosIcon(activeMode);
        } else {
            dom.chaosStatusIndicator.classList.add('hidden');
        }
    }
}

export function getChaosIcon(mode) {
    if (mode === 'latency') return '⏲️';
    if (mode === 'jitter') return '🎲';
    if (mode === 'drop') return '✂️';
    if (mode === 'error') return '🔥';
    return '🌀';
}

export function setLeafChaos(mode, isParamUpdate = false) {
    if (!state.activeDiagnosticId) return;
    const leaf = state.aggregatedStats.leaves.get(state.activeDiagnosticId);
    if (!leaf) return;

    const previousMode = leaf.chaosMode;

    if (!isParamUpdate) {
        if (leaf.chaosMode === mode) {
            leaf.chaosMode = null;
        } else {
            leaf.chaosMode = mode;
        }
        // Only trigger UI update if the mode actually changed (avoid re-animating panel)
        if (previousMode !== leaf.chaosMode) {
            updateChaosUI(leaf.chaosMode);
        }
    }

    // Read relevant valueMs from sliders
    let valueMs = 0;
    const activeMode = leaf.chaosMode;
    if (activeMode === 'latency' && dom.latencySlider) {
        valueMs = parseInt(dom.latencySlider.value);
    } else if (activeMode === 'jitter' && dom.jitterSlider) {
        valueMs = parseInt(dom.jitterSlider.value);
    }

    browser.runtime.sendMessage({ 
        type: 'SET_LEAF_CHAOS', 
        tabId: leaf.tabId, 
        containerName: leaf.container ? leaf.container.name : null,
        mode: activeMode || "none",
        valueMs: valueMs
    }).catch(() => {});
    
    if (activeMode && !isParamUpdate) {
        console.log(`[Laboratory] Chaos Mode ${mode} enabled (${valueMs}ms) for leaf ${leaf.title}`);
    }
}

// Initialize Slider Listeners
if (dom.latencySlider) {
    dom.latencySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (dom.latencyValueDisplay) dom.latencyValueDisplay.textContent = val;
        e.target.style.setProperty('--slider-pct', ((val - 50) / (10000 - 50) * 100) + '%');
        
        // Update live without toggling
        const leaf = state.aggregatedStats.leaves.get(state.activeDiagnosticId);
        if (leaf && leaf.chaosMode === 'latency') {
            setLeafChaos('latency', true);
        }
    });
}

if (dom.jitterSlider) {
    dom.jitterSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (dom.jitterValueDisplay) dom.jitterValueDisplay.textContent = val;
        e.target.style.setProperty('--slider-pct', ((val - 50) / (5000 - 50) * 100) + '%');
        
        // Update live without toggling
        const leaf = state.aggregatedStats.leaves.get(state.activeDiagnosticId);
        if (leaf && leaf.chaosMode === 'jitter') {
            setLeafChaos('jitter', true);
        }
    });
}

export function resetAllSimulations() {
    if (!state.activeDiagnosticId) return;
    const leaf = state.aggregatedStats.leaves.get(state.activeDiagnosticId);
    if (leaf) {
        leaf.chaosMode = null;
        updateChaosUI(null);
        browser.runtime.sendMessage({ type: 'SET_LEAF_CHAOS', tabId: leaf.tabId, mode: null }).catch(() => {});
    }
}

export function launchIsolatedLeaf() {
    browser.runtime.sendMessage({ type: 'LAUNCH_ISOLATED_LEAF' })
        .then(res => {
            if (res.success) {
                console.log("[Leaves] New isolated leaf launched:", res.tabId);
            } else {
                console.error("[Leaves] Failed to launch isolated leaf:", res.error);
                alert("Error launching isolated leaf: " + res.error);
            }
        })
        .catch(err => {
            console.error("[Leaves] Messaging error:", err);
        });
}

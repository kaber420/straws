// js/app.js
import browser from "webextension-polyfill";

document.addEventListener('DOMContentLoaded', () => {
  const rulesList = document.getElementById('rules-list');
  const masterSwitch = document.getElementById('master-switch');
  const engineSwitch = document.getElementById('engine-switch');
  const addBtn = document.getElementById('add-rule-btn');
  const importBtn = document.getElementById('import-btn');
  const exportBtn = document.getElementById('export-btn');
  const importFile = document.getElementById('import-file');
  const clearLogsBtn = document.getElementById('clear-logs-btn');
  
  const modal = document.getElementById('rule-modal');
  const ruleForm = document.getElementById('rule-form');
  const cancelRuleBtn = document.getElementById('cancel-rule-btn');
  const modalTitle = document.getElementById('modal-title');
  const ruleIdInput = document.getElementById('rule-id');
  const ruleSourceInput = document.getElementById('rule-source');
  const ruleDestInput = document.getElementById('rule-dest');
  const ruleCertSelect = document.getElementById('rule-cert');
  const engineOptions = document.getElementById('engine-options');
  const certStatusBadge = document.getElementById('cert-status-badge');
  
  const headersModal = document.getElementById('headers-modal');
  const headersForm = document.getElementById('headers-form');
  const headerRuleIdInput = document.getElementById('header-rule-id');
  const headerListInput = document.getElementById('header-list');
  const cancelHeadersBtn = document.getElementById('cancel-headers-btn');
  
  const terminalContent = document.querySelector('.terminal-content');

  let state = {
    rules: {},
    masterSwitch: true,
    isEngineActive: false,
    availableCerts: []
  };

  const ICONS = {
    edit: `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`,
    key: `<svg viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>`
  };

  // --- Init & Load ---
  
  async function loadState() {
    const data = await browser.storage.local.get(['rules', 'masterSwitch', 'isEngineActive']);
    state.rules = data.rules || {};
    state.masterSwitch = (data.masterSwitch !== false); // Default to true
    state.isEngineActive = !!data.isEngineActive;
    
    // Migration: Ensure all rules have a valid type
    let migrated = false;
    Object.keys(state.rules).forEach(id => {
      const type = state.rules[id].type;
      if (!type || type === 'proxy') {
        state.rules[id].type = (type === 'proxy') ? 'engine' : 'redirect';
        migrated = true;
      }
    });
    if (migrated) await saveState();

    masterSwitch.checked = state.masterSwitch;
    engineSwitch.checked = state.isEngineActive;
    renderRules();
  }

  async function saveState() {
    await browser.storage.local.set({
      rules: state.rules,
      masterSwitch: state.masterSwitch,
      isEngineActive: state.isEngineActive
    });
  }

  // --- Rendering ---
  
  function renderRules() {
    const ruleIds = Object.keys(state.rules);
    if (ruleIds.length === 0) {
      rulesList.innerHTML = '';
      rulesList.classList.add('empty');
      return;
    }
    
    rulesList.classList.remove('empty');
    rulesList.innerHTML = '';
    
    ruleIds.forEach(id => {
      const rule = state.rules[id];
      const el = document.createElement('div');
      el.className = `rule-card ${rule.active && state.masterSwitch ? '' : 'inactive'}`;
      
      el.innerHTML = `
        <div class="rule-info">
          <div class="rule-source" title="${escapeHtml(rule.source)}">
            ${escapeHtml(rule.source)}
            <span class="rule-type-badge badge-${rule.type}">
              ${rule.type === 'engine' ? 'Straws Engine' : (rule.type === 'passthrough' ? 'Passthrough' : 'DNR Redirect')}
            </span>
          </div>
          <div class="rule-dest">${escapeHtml(rule.destination)}</div>
        </div>
        <div class="rule-actions">
          <label class="switch">
            <input type="checkbox" class="rule-toggle" data-id="${rule.id}" ${rule.active && state.masterSwitch ? 'checked' : ''} ${!state.masterSwitch ? 'disabled' : ''}>
            <span class="slider round"></span>
          </label>
          <button class="btn-icon key-rule-btn" data-id="${rule.id}" title="Headers & Keys">${ICONS.key}</button>
          <button class="btn-icon edit-rule-btn" data-id="${rule.id}" title="Edit">${ICONS.edit}</button>
          <button class="btn-icon delete-rule-btn" data-id="${rule.id}" title="Delete">${ICONS.delete}</button>
        </div>
      `;
      rulesList.appendChild(el);
    });

    // Attach listeners
    document.querySelectorAll('.rule-toggle').forEach(el => {
      el.addEventListener('change', (e) => toggleRule(parseInt(e.target.dataset.id), e.target.checked));
    });
    
    document.querySelectorAll('.key-rule-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        openHeadersModal(state.rules[id]);
      });
    });

    document.querySelectorAll('.edit-rule-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        openModal(state.rules[id]);
      });
    });
    
    document.querySelectorAll('.delete-rule-btn').forEach(el => {
      el.addEventListener('click', (e) => deleteRule(parseInt(e.currentTarget.dataset.id)));
    });
  }

  // --- Logic ---

  masterSwitch.addEventListener('change', async (e) => {
    state.masterSwitch = e.target.checked;
    await saveState();
    renderRules();
    addLog(`System ${state.masterSwitch ? 'Activated' : 'Paused'}.`, 'warn');
  });

  engineSwitch.addEventListener('change', async (e) => {
    state.isEngineActive = e.target.checked;
    await saveState();
    addLog(`Straws Engine ${state.isEngineActive ? 'Starting...' : 'Stopping...'}`, state.isEngineActive ? 'success' : 'warn');
  });

  function toggleRule(id, active) {
    const rule = state.rules[id];
    if (rule) {
      rule.active = active;
      saveState().then(renderRules);
    }
  }

  function deleteRule(id) {
    delete state.rules[id];
    saveState().then(renderRules);
  }

  // --- Modal ---
  
  addBtn.addEventListener('click', () => openModal());
  cancelRuleBtn.addEventListener('click', closeModal);

  async function openModal(rule = null) {
    ruleForm.reset();
    ruleIdInput.value = '';
    modalTitle.textContent = 'Add New Straw';
    certStatusBadge.classList.add('hidden');
    
    // Fetch certs first to ensure dropdown is ready
    await fetchAvailableCerts();

    // Set default mode
    const redirectRadio = document.getElementById('type-redirect');
    if (redirectRadio) redirectRadio.checked = true;
    toggleRuleType('redirect');

    if (rule) {
      modalTitle.textContent = 'Edit Straw';
      ruleIdInput.value = rule.id || '';
      ruleSourceInput.value = rule.source || '';
      ruleDestInput.value = rule.destination || '';
      
      const typeRadio = document.querySelector(`input[name="rule-type"][value="${rule.type}"]`);
      if (typeRadio) {
        typeRadio.checked = true;
        toggleRuleType(rule.type);
      }
      
      if (rule.type === 'engine') {
        const certValue = rule.certificate || rule.cert || '';
        ruleCertSelect.value = certValue;
      }
    }

    updateCertStatus();
    modal.classList.remove('hidden');
    setTimeout(() => ruleSourceInput.focus(), 50);
  }

  function toggleRuleType(type) {
    if (type === 'engine') {
      engineOptions.classList.remove('hidden');
      fetchAvailableCerts();
    } else {
      engineOptions.classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
    ruleSourceInput.focus();
  }

  // --- Headers Modal ---
  
  function openHeadersModal(rule) {
    if (!rule) return;
    headersForm.reset();
    headerRuleIdInput.value = rule.id;
    headerListInput.value = rule.headers || '';
    headersModal.classList.remove('hidden');
    setTimeout(() => headerListInput.focus(), 50);
  }

  function closeHeadersModal() {
    headersModal.classList.add('hidden');
  }

  cancelHeadersBtn.addEventListener('click', closeHeadersModal);

  headersForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseInt(headerRuleIdInput.value);
    if (state.rules[id]) {
      state.rules[id].headers = headerListInput.value;
      await saveState();
      addLog(`Headers updated for Straw #${id}`, 'success');
      closeHeadersModal();
    }
  });

  // Handle mode selection change
  ruleForm.querySelectorAll('input[name="rule-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      toggleRuleType(e.target.value);
    });
  });

  async function fetchAvailableCerts() {
    try {
      console.log("Fetching available certs...");
      const response = await browser.runtime.sendMessage({ type: 'GET_CERTS' });
      console.log("Certs response:", response);
      if (response && response.certs) {
        state.availableCerts = response.certs;
        ruleCertSelect.innerHTML = '<option value="">Auto (SNI)</option>';
        response.certs.forEach(cert => {
          const option = document.createElement('option');
          option.value = cert;
          option.textContent = cert;
          ruleCertSelect.appendChild(option);
        });
      }
    } catch (e) {
      console.error("Failed to fetch certs:", e);
    }
  }

  function updateCertStatus() {
    const domain = ruleSourceInput.value.trim();
    const type = document.querySelector('input[name="rule-type"]:checked').value;
    const selectedCert = ruleCertSelect.value;
    
    if (type !== 'engine' || !domain) {
      certStatusBadge.classList.add('hidden');
      return;
    }

    certStatusBadge.classList.remove('hidden');
    
    // Help function for wildcard match
    const isMatch = (pattern, host) => {
      if (!pattern || !host) return false;
      if (!pattern.includes('*')) return pattern === host;
      const parts = pattern.split('*');
      if (parts.length !== 2) return false;
      return host.startsWith(parts[0]) && host.endsWith(parts[1]);
    };

    if (!selectedCert) {
      // Auto Mode: Check if ANY available cert matches the domain
      const anyMatch = state.availableCerts.some(cert => isMatch(cert, domain));
      if (anyMatch) {
         certStatusBadge.textContent = 'Auto (SNI) Ready';
         certStatusBadge.className = 'cert-status found';
      } else {
         certStatusBadge.textContent = 'Auto (No Match)';
         certStatusBadge.className = 'cert-status missing';
      }
      return;
    }

    // Manual Mode
    const match = state.availableCerts.includes(selectedCert);
    if (match) {
      certStatusBadge.textContent = 'Cert Locked';
      certStatusBadge.className = 'cert-status found';
    } else {
      certStatusBadge.textContent = 'Cert Missing';
      certStatusBadge.className = 'cert-status missing';
    }
  }

  ruleSourceInput.addEventListener('input', updateCertStatus);
  document.querySelectorAll('input[name="rule-type"]').forEach(input => {
    input.addEventListener('change', updateCertStatus);
  });

  function closeModal() {
    modal.classList.add('hidden');
  }

  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let source = ruleSourceInput.value.trim();
    let dest = ruleDestInput.value.trim();
    const id = ruleIdInput.value;

    source = source.replace(/^https?:\/\//, '').replace(/\/?$/, '');
    dest = dest.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

    if (!source || !dest) return;

    // Validate that source looks like a valid hostname
    const isValidDomain = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(source);
    if (!isValidDomain) {
      addLog('Invalid source domain. Use a format like: myapi.dev or api.local', 'warn');
      return;
    }

    // Check for duplicate source
    const existingId = id ? parseInt(id) : null;
    const ruleIds = Object.keys(state.rules);
    const duplicate = ruleIds.find(rid => state.rules[rid].source === source && state.rules[rid].id !== existingId);
    if (duplicate) {
      addLog(`Duplicate source: "${source}" already exists.`, 'warn');
      return;
    }

    const type = ruleForm.querySelector('input[name="rule-type"]:checked').value;

    if (id) {
      // Edit
      const rid = parseInt(id);
      if (state.rules[rid]) {
        state.rules[rid].source = source;
        state.rules[rid].destination = dest;
        state.rules[rid].type = type;
        state.rules[rid].cert = type === 'engine' ? ruleCertSelect.value : '';
        // Note: Headers are now managed via the dedicated Headers Modal
      }
    } else {
      // Add new
      const nextId = Object.keys(state.rules).reduce((max, ridd) => Math.max(max, parseInt(ridd)), 0) + 1;
      state.rules[nextId] = {
        id: nextId,
        source: source,
        destination: dest,
        type: type,
        cert: type === 'engine' ? ruleCertSelect.value : '',
        headers: '', // Initialized empty, set via dedicated modal
        active: true
      };
    }

    await saveState();
    renderRules();
    closeModal();
  });

  ruleCertSelect.addEventListener('change', updateCertStatus);

  // --- Logs Handling moved to monitor.js ---
  
  clearLogsBtn.addEventListener('click', () => {
    terminalContent.innerHTML = '';
  });

  // --- Import / Export ---
  
  exportBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.rules, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "strawslight_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addLog('Rules exported to JSON.');
  });

  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (Array.isArray(imported)) {
          // Merge or Override? Let's Override for simplicity, but adjust IDs
          state.rules = {};
          imported.forEach((r, i) => {
            if (r.source && r.destination) {
              const id = i + 1;
              state.rules[id] = {
                id: id,
                source: r.source,
                destination: r.destination,
                type: r.type || 'redirect',
                active: r.active !== false
              };
            }
          });
          
          await saveState();
          renderRules();
          addLog('Rules imported successfully.', 'success');
        }
      } catch (err) {
        addLog('Failed to import rules. Invalid format.', 'error');
      }
      importFile.value = ""; // reset
    };
    reader.readAsText(file);
  });

  // Utils
  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  // Load state
  loadState();
});

export const ruleModalHTML = `
<form id="rule-form">
  <input type="hidden" id="rule-id">
  <div class="form-group">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <label for="rule-source">Source Domain</label>
      <span id="cert-status-badge" class="cert-status hidden"></span>
    </div>
    <input type="text" id="rule-source" placeholder="e.g. myapi.dev" required>
  </div>
  <div class="form-group">
    <label for="rule-dest">Destination</label>
    <input type="text" id="rule-dest" placeholder="e.g. localhost:3000" required>
  </div>
  <div class="form-group">
    <label>Mode</label>
    <div class="mode-selector">
      <label class="mode-option">
        <input type="radio" name="rule-type" value="redirect" checked>
        <div class="mode-card">
          <span class="mode-icon">🔄</span>
          <div class="mode-details">
            <span class="mode-name">DNR Redirect</span>
            <span class="mode-desc">Cambia la URL (visible)</span>
          </div>
        </div>
      </label>
      <label class="mode-option">
        <input type="radio" name="rule-type" value="engine">
        <div class="mode-card">
          <span class="mode-icon">🚀</span>
          <div class="mode-details">
            <span class="mode-name">Straws Engine</span>
            <span class="mode-desc">Reverse Proxy (HTTPS)</span>
          </div>
        </div>
      </label>
      <label class="mode-option">
        <input type="radio" name="rule-type" value="passthrough">
        <div class="mode-card">
          <span class="mode-icon">🛰️</span>
          <div class="mode-details">
            <span class="mode-name">Passthrough</span>
            <span class="mode-desc">Simple TCP Tunnel</span>
          </div>
        </div>
      </label>
    </div>
  </div>
  <div id="engine-options" class="form-group hidden">
    <label for="rule-cert">Certificate (Legal Domain)</label>
    <select id="rule-cert">
      <option value="">Auto-select (by hostname)</option>
    </select>
    <span class="help-text">Drop .crt/.key in the /certs folder of the engine</span>
  </div>
  <div class="modal-actions">
    <button type="button" class="btn secondary" data-action="close">Cancel</button>
    <button type="submit" class="btn primary">Save</button>
  </div>
</form>
`;

export const headersModalHTML = `
<p class="help-text">Configure secure credentials for this Straw.</p>
<form id="headers-form">
  <input type="hidden" id="header-rule-id">
  <div class="form-group">
    <label for="header-list">Custom Headers</label>
    <textarea id="header-list" placeholder="Authorization: Bearer my-token" rows="4" style="font-family: var(--font-mono); font-size: 0.8rem; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-primary); border-radius: var(--radius-sm); padding: 0.5rem;"></textarea>
    <span class="help-text">One per line. Key: Value</span>
  </div>
  <div class="modal-actions">
    <button type="button" class="btn secondary" data-action="close">Cancel</button>
    <button type="submit" class="btn primary">Save Keys</button>
  </div>
</form>
`;

export const settingsModalHTML = `
<form id="settings-form">
  <div class="form-group">
    <label for="remote-engine-url">Remote Engine URL</label>
    <input type="text" id="remote-engine-url" placeholder="e.g. 192.168.1.50:5782">
    <span class="help-text">Leave empty for local engine (Native)</span>
  </div>
  <div class="form-group">
    <label for="master-key">Master Key / Auth Token</label>
    <input type="password" id="master-key" placeholder="••••••••••••••••">
    <span class="help-text">Used for remote controller authentication</span>
  </div>
  <div class="form-group">
    <label for="global-presets">Presets</label>
    <div id="presets-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;">
      <!-- Presets injected here -->
      <div class="help-text">No presets saved.</div>
    </div>
  </div>
  <button type="button" id="save-current-preset" class="btn secondary" style="width: 100%; margin-top: 0.5rem;">Save Current as Preset</button>
  <div class="modal-actions">
    <button type="button" class="btn secondary" data-action="close">Close</button>
    <button type="submit" class="btn primary">Save Config</button>
  </div>
</form>
`;

import{b}from"./browser-polyfill.js";document.addEventListener("DOMContentLoaded",()=>{const m=document.getElementById("terminal-output"),$=document.getElementById("clear-logs-btn"),v=document.getElementById("engine-log-switch"),R=100,E=document.getElementById("log-overlay"),O=document.getElementById("log-overlay-content"),L=document.getElementById("close-log-overlay");function P(t){try{const r=new URL(t);let i=r.pathname;if(i.length>20){const d=i.split("/");d.length>3&&(i=`/${d[1]}/.../${d[d.length-1]}`)}return`${r.hostname}${i}`}catch{return t.length>40?t.substring(0,37)+"...":t}}function A(t){const r=document.createElement("div"),i=t.type==="tls_handshake";r.className=`log ${t.status==="Error"?"warn":""} ${i?"log-tls":""}`;let d="status-other";typeof t.status=="number"&&(t.status>=200&&t.status<300?d="status-2xx":t.status>=300&&t.status<400?d="status-3xx":t.status>=400&&(d="status-4xx"));const p=t.from==="Straws Engine"?"from-straw":"from-direct",w=i?t.url:P(t.url),o=i&&t.tlsInfo?`<span class="tls-version-pill tls-v-${t.tlsInfo.tls_version.replace(/[\s.]/g,"-")}">${t.tlsInfo.tls_version}</span>`:t.type;return r.innerHTML=`
            <span class="time">${t.timestamp}</span>
            <span class="from ${p}">[${t.from||"Direct"}]</span>
            <span class="method ${i?"method-tls":""}">${i?"🔒 TLS":t.method}</span>
            <span class="url" title="${t.url}">${w}</span>
            <div class="log-details">
                <span class="latency">${t.latency}</span>
                <span class="ip">${t.ip}</span>
                <span class="status ${d}">${t.status}</span>
                <span class="type">${o}</span>
                <span class="size">${t.size}</span>
            </div>
        `,r.addEventListener("click",()=>D(t)),r}function D(t){const r=t.type==="tls_handshake",i=c=>{if(!c||typeof c=="string"&&c.trim()==="")return"";try{if(typeof c=="string"&&(c.startsWith("{")||c.startsWith("[")))return JSON.stringify(JSON.parse(c),null,2)}catch{}return typeof c=="object"?JSON.stringify(c,null,2):c},d=i(t.payload),p=i(t.response),w=t.headers?JSON.stringify(t.headers,null,2):"";let o="";if(r&&t.tlsInfo){const c=t.tlsInfo,k=`tls-version-badge tls-v-${c.tls_version.replace(/[\s.]/g,"-")}`;o=`
<div class="tls-inspector-section">
    <div class="tls-inspector-header">🔒 TLS Handshake Inspector</div>
    <div class="tls-field"><span class="tls-label">SNI</span><code class="tls-value">${c.sni}</code></div>
    <div class="tls-field">
        <span class="tls-label">Version</span>
        <span class="${k}">${c.tls_version}</span>
    </div>
    <div class="tls-field"><span class="tls-label">Cipher Suite</span><code class="tls-value">${c.cipher_suite}</code></div>
    <div class="tls-field"><span class="tls-label">Protocol (ALPN)</span><code class="tls-value">${c.negotiated_protocol||"http/1.1"}</code></div>
    <div class="tls-field"><span class="tls-label">Peer Certs</span><span class="tls-value">${c.peer_certs}</span></div>
</div>`}O.innerHTML=`
<div class="detail-row"><span class="label">Timestamp:</span>${t.timestamp}</div>
<div class="detail-row"><span class="label">From:</span>${t.from}</div>
<div class="detail-row"><span class="label">Method:</span>${t.method}</div>
<div class="detail-row"><span class="label">URL:</span>${t.url}</div>
<div class="detail-row"><span class="label">ID:</span>${t.windowId!==null&&t.windowId!==-1?t.windowId:"?"}-${t.tabId}</div>
<div class="detail-row"><span class="label">Status:</span>${t.status}</div>
<div class="detail-row"><span class="label">Latency:</span>${t.latency}</div>
<div class="detail-row"><span class="label">IP:</span>${t.ip}</div>
<div class="detail-row"><span class="label">Type:</span>${t.type}</div>
${w?`<div class="detail-section"><span class="label">Headers:</span><pre class="code-view">${w}</pre></div>`:""}
${d?`<div class="detail-section"><span class="label">Payload:</span><pre class="code-view">${d}</pre></div>`:""}
${p?`<div class="detail-section"><span class="label">Response:</span><pre class="code-view">${p}</pre></div>`:""}
${t.error?`<div class="detail-row"><span class="label">Error:</span>${t.error}</div>`:""}
${o}
`.trim(),E.classList.add("active")}L==null||L.addEventListener("click",()=>{E.classList.remove("active")}),document.addEventListener("keydown",t=>{t.key==="Escape"&&E.classList.contains("active")&&E.classList.remove("active")}),b.runtime.onMessage.addListener(t=>{if(t.type==="LOG_ENTRY"){const r=m.querySelector(".terminal-content")||m,i=r.querySelector(".info");i&&i.textContent.includes("Waiting")&&i.remove();const d=A(t.log);for(r.appendChild(d);r.children.length>R;)r.removeChild(r.firstChild);m.scrollTop=m.scrollHeight}}),$==null||$.addEventListener("click",()=>{const t=m.querySelector(".terminal-content")||m;t.innerHTML='<span class="log info">Logs cleared.</span>',E.classList.remove("active")}),b.storage.local.get(["isBrowserLogActive","isEngineLogActive"]).then(t=>{v&&(v.checked=!!t.isEngineLogActive)}),b.storage.onChanged.addListener((t,r)=>{r==="local"&&t.isEngineLogActive!==void 0&&v&&(v.checked=!!t.isEngineLogActive.newValue)}),v==null||v.addEventListener("change",()=>{b.storage.local.set({isEngineLogActive:v.checked})})});const ie=`
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
`,re=`
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
`,le=`
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
`;document.addEventListener("DOMContentLoaded",()=>{const m=document.getElementById("rules-list"),$=document.getElementById("master-switch"),v=document.getElementById("engine-switch"),R=document.getElementById("add-rule-btn"),E=document.getElementById("import-btn"),O=document.getElementById("export-btn"),L=document.getElementById("import-file"),P=document.getElementById("clear-logs-btn"),A=document.getElementById("open-dashboard-btn");document.getElementById("dynamic-modal"),document.getElementById("dm-title");const D=document.getElementById("dm-body");D.innerHTML=ie+re+le;const t=document.getElementById("rule-form"),r=document.getElementById("rule-id"),i=document.getElementById("rule-source"),d=document.getElementById("rule-dest"),p=document.getElementById("rule-cert"),w=document.getElementById("engine-options"),o=document.getElementById("cert-status-badge"),c=document.getElementById("headers-form"),k=document.getElementById("header-rule-id"),q=document.getElementById("header-list"),V=document.getElementById("settings-btn"),_=document.getElementById("settings-form"),J=document.getElementById("remote-engine-url"),j=document.getElementById("master-key"),U=document.getElementById("presets-list"),Z=document.getElementById("save-current-preset");let n={rules:{},masterSwitch:!0,isEngineActive:!1,availableCerts:[],remoteEngineUrl:"",masterKey:"",presets:[]};const W=document.querySelector(".terminal-content"),z={edit:'<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',delete:'<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>',key:'<svg viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>'};async function X(){const e=await b.storage.local.get(["rules","masterSwitch","isEngineActive","remoteEngineUrl","masterKey","presets"]);n.rules=e.rules||{},n.masterSwitch=e.masterSwitch!==!1,n.isEngineActive=!!e.isEngineActive,n.remoteEngineUrl=e.remoteEngineUrl||"",n.masterKey=e.masterKey||"",n.presets=e.presets||[],$.checked=n.masterSwitch,v.checked=n.isEngineActive,J.value=n.remoteEngineUrl,j.value=n.masterKey,I(),T()}async function y(){await b.storage.local.set({rules:n.rules,masterSwitch:n.masterSwitch,isEngineActive:n.isEngineActive,remoteEngineUrl:n.remoteEngineUrl,masterKey:n.masterKey,presets:n.presets})}function M(e,s){document.getElementById("dm-title").textContent=e,document.getElementById("rule-form").style.display="none",document.getElementById("headers-form").style.display="none",document.getElementById("settings-form").style.display="none",s.style.display="block",document.getElementById("dynamic-modal").classList.remove("hidden")}function B(){document.getElementById("dynamic-modal").classList.add("hidden")}document.getElementById("dynamic-modal").addEventListener("click",e=>{(e.target.dataset.action==="close"||e.target.id==="dynamic-modal")&&B()}),V.addEventListener("click",()=>{T(),M("Global Settings",_)}),_.addEventListener("submit",async e=>{e.preventDefault(),n.remoteEngineUrl=J.value.trim(),n.masterKey=j.value.trim(),await y(),g("Global settings saved.","success"),B()}),Z.addEventListener("click",async()=>{const e=prompt("Enter a name for this preset:");if(!e)return;const s={id:Date.now(),name:e,rules:JSON.parse(JSON.stringify(n.rules))};n.presets.push(s),await y(),T(),g(`Preset "${e}" saved.`,"success")});function T(){if(n.presets.length===0){U.innerHTML='<div class="help-text">No presets saved.</div>';return}U.innerHTML="",n.presets.forEach(e=>{const s=document.createElement("div");s.className="preset-item",s.style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 0.5rem;",s.innerHTML=`
        <span style="font-size: 0.875rem; font-weight: 500;">${N(e.name)}</span>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn primary load-preset-btn" data-id="${e.id}" style="padding: 2px 8px; font-size: 0.75rem;">Load</button>
          <button type="button" class="btn-icon delete-preset-btn" data-id="${e.id}" title="Delete">🗑️</button>
        </div>
      `,U.appendChild(s)}),document.querySelectorAll(".load-preset-btn").forEach(e=>{e.addEventListener("click",s=>Y(parseInt(s.target.dataset.id)))}),document.querySelectorAll(".delete-preset-btn").forEach(e=>{e.addEventListener("click",s=>Q(parseInt(s.target.dataset.id)))})}async function Y(e){const s=n.presets.find(a=>a.id===e);s&&confirm(`Load preset "${s.name}"? This will replace current rules.`)&&(n.rules=JSON.parse(JSON.stringify(s.rules)),await y(),I(),g(`Preset "${s.name}" loaded.`,"success"),B())}async function Q(e){n.presets=n.presets.filter(s=>s.id!==e),await y(),T()}function g(e,s="info"){if(typeof window.addLog=="function")window.addLog(e,s);else{console.log(`[Log] ${s}: ${e}`);const a=document.querySelector(".terminal-content");if(a){const l=document.createElement("div");l.className=`log ${s}`,l.textContent=e,a.appendChild(l),a.scrollTop=a.scrollHeight}}}function I(){const e=Object.keys(n.rules);if(e.length===0){m.innerHTML="",m.classList.add("empty");return}m.classList.remove("empty"),m.innerHTML="",e.forEach(s=>{const a=n.rules[s],l=document.createElement("div");l.className=`rule-card ${a.active&&n.masterSwitch?"":"inactive"}`,l.innerHTML=`
        <div class="rule-info">
          <div class="rule-source" title="${N(a.source)}">
            ${N(a.source)}
            <span class="rule-type-badge badge-${a.type}">
              ${a.type==="engine"?"Straws Engine":a.type==="passthrough"?"Passthrough":"DNR Redirect"}
            </span>
          </div>
          <div class="rule-dest">${N(a.destination)}</div>
        </div>
        <div class="rule-actions">
          <label class="switch">
            <input type="checkbox" class="rule-toggle" data-id="${a.id}" ${a.active&&n.masterSwitch?"checked":""} ${n.masterSwitch?"":"disabled"}>
            <span class="slider round"></span>
          </label>
          <button class="btn-icon key-rule-btn" data-id="${a.id}" title="Headers & Keys">${z.key}</button>
          <button class="btn-icon edit-rule-btn" data-id="${a.id}" title="Edit">${z.edit}</button>
          <button class="btn-icon delete-rule-btn" data-id="${a.id}" title="Delete">${z.delete}</button>
        </div>
      `,m.appendChild(l)}),document.querySelectorAll(".rule-toggle").forEach(s=>{s.addEventListener("change",a=>ee(parseInt(a.target.dataset.id),a.target.checked))}),document.querySelectorAll(".key-rule-btn").forEach(s=>{s.addEventListener("click",a=>{const l=parseInt(a.currentTarget.dataset.id);se(n.rules[l])})}),document.querySelectorAll(".edit-rule-btn").forEach(s=>{s.addEventListener("click",a=>{const l=parseInt(a.currentTarget.dataset.id);F(n.rules[l])})}),document.querySelectorAll(".delete-rule-btn").forEach(s=>{s.addEventListener("click",a=>te(parseInt(a.currentTarget.dataset.id)))})}$.addEventListener("change",async e=>{n.masterSwitch=e.target.checked,await y(),I(),g(`System ${n.masterSwitch?"Activated":"Paused"}.`,"warn")}),v.addEventListener("change",async e=>{n.isEngineActive=e.target.checked,await y(),g(`Straws Engine ${n.isEngineActive?"Starting...":"Stopping..."}`,n.isEngineActive?"success":"warn")});function ee(e,s){const a=n.rules[e];a&&(a.active=s,y().then(I))}function te(e){delete n.rules[e],y().then(I)}R.addEventListener("click",()=>F());async function F(e=null){t.reset(),r.value="",o.classList.add("hidden"),await G();const s=document.getElementById("type-redirect");if(s&&(s.checked=!0),K("redirect"),e){r.value=e.id||"",i.value=e.source||"",d.value=e.destination||"";const a=document.querySelector(`input[name="rule-type"][value="${e.type}"]`);if(a&&(a.checked=!0,K(e.type)),e.type==="engine"){const l=e.certificate||e.cert||"";p.value=l}}x(),M(e?"Edit Straw":"Add New Straw",t),setTimeout(()=>i.focus(),50)}function K(e){e==="engine"?(w.classList.remove("hidden"),G()):w.classList.add("hidden"),M(document.getElementById("rule-id").value?"Edit Straw":"Add New Straw",t),i.focus()}function se(e){e&&(c.reset(),k.value=e.id,q.value=e.headers||"",M("Headers & Keys",c),setTimeout(()=>q.focus(),50))}c.addEventListener("submit",async e=>{e.preventDefault();const s=parseInt(k.value);n.rules[s]&&(n.rules[s].headers=q.value,await y(),g(`Headers updated for Straw #${s}`,"success"),B())}),t.querySelectorAll('input[name="rule-type"]').forEach(e=>{e.addEventListener("change",s=>{K(s.target.value)})});async function G(){try{console.log("Fetching available certs...");const e=await b.runtime.sendMessage({type:"GET_CERTS"});console.log("Certs response:",e),e&&e.certs&&(n.availableCerts=e.certs,p.innerHTML='<option value="">Auto (SNI)</option>',e.certs.forEach(s=>{const a=document.createElement("option");a.value=s,a.textContent=s,p.appendChild(a)}))}catch(e){console.error("Failed to fetch certs:",e)}}function x(){const e=i.value.trim(),s=document.querySelector('input[name="rule-type"]:checked').value,a=p.value;if(s!=="engine"||!e){o.classList.add("hidden");return}o.classList.remove("hidden");const l=(u,h)=>{if(!u||!h)return!1;if(!u.includes("*"))return u===h;const S=u.split("*");return S.length!==2?!1:h.startsWith(S[0])&&h.endsWith(S[1])};if(!a){n.availableCerts.some(h=>l(h,e))?(o.textContent="Auto (SNI) Ready",o.className="cert-status found"):(o.textContent="Auto (No Match)",o.className="cert-status missing");return}n.availableCerts.includes(a)?(o.textContent="Cert Locked",o.className="cert-status found"):(o.textContent="Cert Missing",o.className="cert-status missing")}i.addEventListener("input",x),document.querySelectorAll('input[name="rule-type"]').forEach(e=>{e.addEventListener("change",x)}),p.addEventListener("change",x),t.addEventListener("submit",async e=>{e.preventDefault();let s=i.value.trim(),a=d.value.trim();const l=r.value;if(s=s.replace(/^https?:\/\//,"").replace(/\/?$/,""),a=a.replace(/^https?:\/\//i,"").replace(/\/+$/,""),!s||!a)return;if(!/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(s)){g("Invalid source domain. Use a format like: myapi.dev or api.local","warn");return}const u=l?parseInt(l):null;if(Object.keys(n.rules).find(f=>n.rules[f].source===s&&n.rules[f].id!==u)){g(`Duplicate source: "${s}" already exists.`,"warn");return}const H=t.querySelector('input[name="rule-type"]:checked').value;if(l){const f=parseInt(l);n.rules[f]&&(n.rules[f].source=s,n.rules[f].destination=a,n.rules[f].type=H,n.rules[f].cert=H==="engine"?p.value:"")}else{const f=Object.keys(n.rules).reduce((ne,ae)=>Math.max(ne,parseInt(ae)),0)+1;n.rules[f]={id:f,source:s,destination:a,type:H,cert:H==="engine"?p.value:"",headers:"",active:!0}}await y(),I(),B()}),p.addEventListener("change",x),P.addEventListener("click",()=>{W.innerHTML=""}),A&&A.addEventListener("click",()=>{b.tabs.create({url:b.runtime.getURL("dashboard.html")})}),O.addEventListener("click",()=>{const e="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(n.rules,null,2)),s=document.createElement("a");s.setAttribute("href",e),s.setAttribute("download","strawslight_backup.json"),document.body.appendChild(s),s.click(),s.remove(),g("Rules exported to JSON.")}),E.addEventListener("click",()=>{L.click()}),L.addEventListener("change",e=>{const s=e.target.files[0];if(!s)return;const a=new FileReader;a.onload=async l=>{try{const C=JSON.parse(l.target.result);Array.isArray(C)&&(n.rules={},C.forEach((u,h)=>{if(u.source&&u.destination){const S=h+1;n.rules[S]={id:S,source:u.source,destination:u.destination,type:u.type||"redirect",active:u.active!==!1}}}),await y(),I(),g("Rules imported successfully.","success"))}catch{g("Failed to import rules. Invalid format.","error")}L.value=""},a.readAsText(s)});function N(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}X()});

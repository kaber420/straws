import{b}from"./browser-polyfill.js";document.addEventListener("DOMContentLoaded",()=>{const m=document.getElementById("terminal-output"),S=document.getElementById("clear-logs-btn"),v=document.getElementById("engine-log-switch"),N=100,E=document.getElementById("log-overlay"),H=document.getElementById("log-overlay-content"),L=document.getElementById("close-log-overlay");function R(s){try{const r=new URL(s);let i=r.pathname;if(i.length>20){const d=i.split("/");d.length>3&&(i=`/${d[1]}/.../${d[d.length-1]}`)}return`${r.hostname}${i}`}catch{return s.length>40?s.substring(0,37)+"...":s}}function x(s){const r=document.createElement("div");r.className=`log ${s.status==="Error"?"warn":""}`;let i="status-other";typeof s.status=="number"&&(s.status>=200&&s.status<300?i="status-2xx":s.status>=300&&s.status<400?i="status-3xx":s.status>=400&&(i="status-4xx"));const d=s.from==="Straws Engine"?"from-straw":"from-direct",o=R(s.url);return r.innerHTML=`
            <span class="time">${s.timestamp}</span>
            <span class="from ${d}">[${s.from||"Direct"}]</span>
            <span class="method">${s.method}</span>
            <span class="url" title="${s.url}">${o}</span>
            <div class="log-details">
                <span class="latency">${s.latency}</span>
                <span class="ip">${s.ip}</span>
                <span class="status ${i}">${s.status}</span>
                <span class="type">${s.type}</span>
                <span class="size">${s.size}</span>
            </div>
        `,r.addEventListener("click",()=>O(s)),r}function O(s){const r=u=>{if(!u||typeof u=="string"&&u.trim()==="")return"";try{if(typeof u=="string"&&(u.startsWith("{")||u.startsWith("[")))return JSON.stringify(JSON.parse(u),null,2)}catch{}return typeof u=="object"?JSON.stringify(u,null,2):u},i=r(s.payload),d=r(s.response),o=s.headers?JSON.stringify(s.headers,null,2):"";H.innerHTML=`
<div class="detail-row"><span class="label">Timestamp:</span>${s.timestamp}</div>
<div class="detail-row"><span class="label">From:</span>${s.from}</div>
<div class="detail-row"><span class="label">Method:</span>${s.method}</div>
<div class="detail-row"><span class="label">URL:</span>${s.url}</div>
<div class="detail-row"><span class="label">ID:</span>${s.windowId!==null&&s.windowId!==-1?s.windowId:"?"}-${s.tabId}</div>
<div class="detail-row"><span class="label">Status:</span>${s.status}</div>
<div class="detail-row"><span class="label">Latency:</span>${s.latency}</div>
<div class="detail-row"><span class="label">IP:</span>${s.ip}</div>
<div class="detail-row"><span class="label">Type:</span>${s.type}</div>
${o?`<div class="detail-section"><span class="label">Headers:</span><pre class="code-view">${o}</pre></div>`:""}
${i?`<div class="detail-section"><span class="label">Payload:</span><pre class="code-view">${i}</pre></div>`:""}
${d?`<div class="detail-section"><span class="label">Response:</span><pre class="code-view">${d}</pre></div>`:""}
${s.error?`<div class="detail-row"><span class="label">Error:</span>${s.error}</div>`:""}
`.trim(),E.classList.add("active")}L==null||L.addEventListener("click",()=>{E.classList.remove("active")}),document.addEventListener("keydown",s=>{s.key==="Escape"&&E.classList.contains("active")&&E.classList.remove("active")}),b.runtime.onMessage.addListener(s=>{if(s.type==="LOG_ENTRY"){const r=m.querySelector(".terminal-content")||m,i=r.querySelector(".info");i&&i.textContent.includes("Waiting")&&i.remove();const d=x(s.log);for(r.appendChild(d);r.children.length>N;)r.removeChild(r.firstChild);m.scrollTop=m.scrollHeight}}),S==null||S.addEventListener("click",()=>{const s=m.querySelector(".terminal-content")||m;s.innerHTML='<span class="log info">Logs cleared.</span>',E.classList.remove("active")}),b.storage.local.get(["isBrowserLogActive","isEngineLogActive"]).then(s=>{v&&(v.checked=!!s.isEngineLogActive)}),b.storage.onChanged.addListener((s,r)=>{r==="local"&&s.isEngineLogActive!==void 0&&v&&(v.checked=!!s.isEngineLogActive.newValue)}),v==null||v.addEventListener("change",()=>{b.storage.local.set({isEngineLogActive:v.checked})})});const re=`
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
`,ie=`
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
`;document.addEventListener("DOMContentLoaded",()=>{const m=document.getElementById("rules-list"),S=document.getElementById("master-switch"),v=document.getElementById("engine-switch"),N=document.getElementById("add-rule-btn"),E=document.getElementById("import-btn"),H=document.getElementById("export-btn"),L=document.getElementById("import-file"),R=document.getElementById("clear-logs-btn"),x=document.getElementById("open-dashboard-btn");document.getElementById("dynamic-modal"),document.getElementById("dm-title");const O=document.getElementById("dm-body");O.innerHTML=re+ie+le;const s=document.getElementById("rule-form"),r=document.getElementById("rule-id"),i=document.getElementById("rule-source"),d=document.getElementById("rule-dest"),o=document.getElementById("rule-cert"),u=document.getElementById("engine-options"),p=document.getElementById("cert-status-badge"),D=document.getElementById("headers-form"),K=document.getElementById("header-rule-id"),q=document.getElementById("header-list"),Z=document.getElementById("settings-btn"),J=document.getElementById("settings-form"),j=document.getElementById("remote-engine-url"),F=document.getElementById("master-key"),U=document.getElementById("presets-list"),W=document.getElementById("save-current-preset");let n={rules:{},masterSwitch:!0,isEngineActive:!1,availableCerts:[],remoteEngineUrl:"",masterKey:"",presets:[]};const _=document.querySelector(".terminal-content"),P={edit:'<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',delete:'<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>',key:'<svg viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>'};async function X(){const e=await b.storage.local.get(["rules","masterSwitch","isEngineActive","remoteEngineUrl","masterKey","presets"]);n.rules=e.rules||{},n.masterSwitch=e.masterSwitch!==!1,n.isEngineActive=!!e.isEngineActive,n.remoteEngineUrl=e.remoteEngineUrl||"",n.masterKey=e.masterKey||"",n.presets=e.presets||[],S.checked=n.masterSwitch,v.checked=n.isEngineActive,j.value=n.remoteEngineUrl,F.value=n.masterKey,w(),C()}async function y(){await b.storage.local.set({rules:n.rules,masterSwitch:n.masterSwitch,isEngineActive:n.isEngineActive,remoteEngineUrl:n.remoteEngineUrl,masterKey:n.masterKey,presets:n.presets})}function A(e,t){document.getElementById("dm-title").textContent=e,document.getElementById("rule-form").style.display="none",document.getElementById("headers-form").style.display="none",document.getElementById("settings-form").style.display="none",t.style.display="block",document.getElementById("dynamic-modal").classList.remove("hidden")}function $(){document.getElementById("dynamic-modal").classList.add("hidden")}document.getElementById("dynamic-modal").addEventListener("click",e=>{(e.target.dataset.action==="close"||e.target.id==="dynamic-modal")&&$()}),Z.addEventListener("click",()=>{C(),A("Global Settings",J)}),J.addEventListener("submit",async e=>{e.preventDefault(),n.remoteEngineUrl=j.value.trim(),n.masterKey=F.value.trim(),await y(),g("Global settings saved.","success"),$()}),W.addEventListener("click",async()=>{const e=prompt("Enter a name for this preset:");if(!e)return;const t={id:Date.now(),name:e,rules:JSON.parse(JSON.stringify(n.rules))};n.presets.push(t),await y(),C(),g(`Preset "${e}" saved.`,"success")});function C(){if(n.presets.length===0){U.innerHTML='<div class="help-text">No presets saved.</div>';return}U.innerHTML="",n.presets.forEach(e=>{const t=document.createElement("div");t.className="preset-item",t.style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 0.5rem;",t.innerHTML=`
        <span style="font-size: 0.875rem; font-weight: 500;">${M(e.name)}</span>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn primary load-preset-btn" data-id="${e.id}" style="padding: 2px 8px; font-size: 0.75rem;">Load</button>
          <button type="button" class="btn-icon delete-preset-btn" data-id="${e.id}" title="Delete">🗑️</button>
        </div>
      `,U.appendChild(t)}),document.querySelectorAll(".load-preset-btn").forEach(e=>{e.addEventListener("click",t=>Y(parseInt(t.target.dataset.id)))}),document.querySelectorAll(".delete-preset-btn").forEach(e=>{e.addEventListener("click",t=>Q(parseInt(t.target.dataset.id)))})}async function Y(e){const t=n.presets.find(a=>a.id===e);t&&confirm(`Load preset "${t.name}"? This will replace current rules.`)&&(n.rules=JSON.parse(JSON.stringify(t.rules)),await y(),w(),g(`Preset "${t.name}" loaded.`,"success"),$())}async function Q(e){n.presets=n.presets.filter(t=>t.id!==e),await y(),C()}function g(e,t="info"){if(typeof window.addLog=="function")window.addLog(e,t);else{console.log(`[Log] ${t}: ${e}`);const a=document.querySelector(".terminal-content");if(a){const l=document.createElement("div");l.className=`log ${t}`,l.textContent=e,a.appendChild(l),a.scrollTop=a.scrollHeight}}}function w(){const e=Object.keys(n.rules);if(e.length===0){m.innerHTML="",m.classList.add("empty");return}m.classList.remove("empty"),m.innerHTML="",e.forEach(t=>{const a=n.rules[t],l=document.createElement("div");l.className=`rule-card ${a.active&&n.masterSwitch?"":"inactive"}`,l.innerHTML=`
        <div class="rule-info">
          <div class="rule-source" title="${M(a.source)}">
            ${M(a.source)}
            <span class="rule-type-badge badge-${a.type}">
              ${a.type==="engine"?"Straws Engine":a.type==="passthrough"?"Passthrough":"DNR Redirect"}
            </span>
          </div>
          <div class="rule-dest">${M(a.destination)}</div>
        </div>
        <div class="rule-actions">
          <label class="switch">
            <input type="checkbox" class="rule-toggle" data-id="${a.id}" ${a.active&&n.masterSwitch?"checked":""} ${n.masterSwitch?"":"disabled"}>
            <span class="slider round"></span>
          </label>
          <button class="btn-icon key-rule-btn" data-id="${a.id}" title="Headers & Keys">${P.key}</button>
          <button class="btn-icon edit-rule-btn" data-id="${a.id}" title="Edit">${P.edit}</button>
          <button class="btn-icon delete-rule-btn" data-id="${a.id}" title="Delete">${P.delete}</button>
        </div>
      `,m.appendChild(l)}),document.querySelectorAll(".rule-toggle").forEach(t=>{t.addEventListener("change",a=>ee(parseInt(a.target.dataset.id),a.target.checked))}),document.querySelectorAll(".key-rule-btn").forEach(t=>{t.addEventListener("click",a=>{const l=parseInt(a.currentTarget.dataset.id);se(n.rules[l])})}),document.querySelectorAll(".edit-rule-btn").forEach(t=>{t.addEventListener("click",a=>{const l=parseInt(a.currentTarget.dataset.id);G(n.rules[l])})}),document.querySelectorAll(".delete-rule-btn").forEach(t=>{t.addEventListener("click",a=>te(parseInt(a.currentTarget.dataset.id)))})}S.addEventListener("change",async e=>{n.masterSwitch=e.target.checked,await y(),w(),g(`System ${n.masterSwitch?"Activated":"Paused"}.`,"warn")}),v.addEventListener("change",async e=>{n.isEngineActive=e.target.checked,await y(),g(`Straws Engine ${n.isEngineActive?"Starting...":"Stopping..."}`,n.isEngineActive?"success":"warn")});function ee(e,t){const a=n.rules[e];a&&(a.active=t,y().then(w))}function te(e){delete n.rules[e],y().then(w)}N.addEventListener("click",()=>G());async function G(e=null){s.reset(),r.value="",p.classList.add("hidden"),await V();const t=document.getElementById("type-redirect");if(t&&(t.checked=!0),z("redirect"),e){r.value=e.id||"",i.value=e.source||"",d.value=e.destination||"";const a=document.querySelector(`input[name="rule-type"][value="${e.type}"]`);if(a&&(a.checked=!0,z(e.type)),e.type==="engine"){const l=e.certificate||e.cert||"";o.value=l}}B(),A(e?"Edit Straw":"Add New Straw",s),setTimeout(()=>i.focus(),50)}function z(e){e==="engine"?(u.classList.remove("hidden"),V()):u.classList.add("hidden"),A(document.getElementById("rule-id").value?"Edit Straw":"Add New Straw",s),i.focus()}function se(e){e&&(D.reset(),K.value=e.id,q.value=e.headers||"",A("Headers & Keys",D),setTimeout(()=>q.focus(),50))}D.addEventListener("submit",async e=>{e.preventDefault();const t=parseInt(K.value);n.rules[t]&&(n.rules[t].headers=q.value,await y(),g(`Headers updated for Straw #${t}`,"success"),$())}),s.querySelectorAll('input[name="rule-type"]').forEach(e=>{e.addEventListener("change",t=>{z(t.target.value)})});async function V(){try{console.log("Fetching available certs...");const e=await b.runtime.sendMessage({type:"GET_CERTS"});console.log("Certs response:",e),e&&e.certs&&(n.availableCerts=e.certs,o.innerHTML='<option value="">Auto (SNI)</option>',e.certs.forEach(t=>{const a=document.createElement("option");a.value=t,a.textContent=t,o.appendChild(a)}))}catch(e){console.error("Failed to fetch certs:",e)}}function B(){const e=i.value.trim(),t=document.querySelector('input[name="rule-type"]:checked').value,a=o.value;if(t!=="engine"||!e){p.classList.add("hidden");return}p.classList.remove("hidden");const l=(c,h)=>{if(!c||!h)return!1;if(!c.includes("*"))return c===h;const I=c.split("*");return I.length!==2?!1:h.startsWith(I[0])&&h.endsWith(I[1])};if(!a){n.availableCerts.some(h=>l(h,e))?(p.textContent="Auto (SNI) Ready",p.className="cert-status found"):(p.textContent="Auto (No Match)",p.className="cert-status missing");return}n.availableCerts.includes(a)?(p.textContent="Cert Locked",p.className="cert-status found"):(p.textContent="Cert Missing",p.className="cert-status missing")}i.addEventListener("input",B),document.querySelectorAll('input[name="rule-type"]').forEach(e=>{e.addEventListener("change",B)}),o.addEventListener("change",B),s.addEventListener("submit",async e=>{e.preventDefault();let t=i.value.trim(),a=d.value.trim();const l=r.value;if(t=t.replace(/^https?:\/\//,"").replace(/\/?$/,""),a=a.replace(/^https?:\/\//i,"").replace(/\/+$/,""),!t||!a)return;if(!/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(t)){g("Invalid source domain. Use a format like: myapi.dev or api.local","warn");return}const c=l?parseInt(l):null;if(Object.keys(n.rules).find(f=>n.rules[f].source===t&&n.rules[f].id!==c)){g(`Duplicate source: "${t}" already exists.`,"warn");return}const T=s.querySelector('input[name="rule-type"]:checked').value;if(l){const f=parseInt(l);n.rules[f]&&(n.rules[f].source=t,n.rules[f].destination=a,n.rules[f].type=T,n.rules[f].cert=T==="engine"?o.value:"")}else{const f=Object.keys(n.rules).reduce((ne,ae)=>Math.max(ne,parseInt(ae)),0)+1;n.rules[f]={id:f,source:t,destination:a,type:T,cert:T==="engine"?o.value:"",headers:"",active:!0}}await y(),w(),$()}),o.addEventListener("change",B),R.addEventListener("click",()=>{_.innerHTML=""}),x&&x.addEventListener("click",()=>{b.tabs.create({url:b.runtime.getURL("dashboard.html")})}),H.addEventListener("click",()=>{const e="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(n.rules,null,2)),t=document.createElement("a");t.setAttribute("href",e),t.setAttribute("download","strawslight_backup.json"),document.body.appendChild(t),t.click(),t.remove(),g("Rules exported to JSON.")}),E.addEventListener("click",()=>{L.click()}),L.addEventListener("change",e=>{const t=e.target.files[0];if(!t)return;const a=new FileReader;a.onload=async l=>{try{const k=JSON.parse(l.target.result);Array.isArray(k)&&(n.rules={},k.forEach((c,h)=>{if(c.source&&c.destination){const I=h+1;n.rules[I]={id:I,source:c.source,destination:c.destination,type:c.type||"redirect",active:c.active!==!1}}}),await y(),w(),g("Rules imported successfully.","success"))}catch{g("Failed to import rules. Invalid format.","error")}L.value=""},a.readAsText(t)});function M(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}X()});

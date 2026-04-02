import{b as u}from"./browser-polyfill.js";const h=document.getElementById("network-body"),k=document.getElementById("detail-panel"),K=document.getElementById("no-selection"),W=document.getElementById("request-details"),P=document.getElementById("header-data"),M=document.getElementById("payload-data"),T=document.getElementById("response-data"),A=document.getElementById("close-detail"),x=document.getElementById("live-btn"),w=document.getElementById("engine-log-btn"),L=document.getElementById("record-btn"),V=document.getElementById("clear-btn"),D=document.getElementById("engine-status"),_=D.querySelector(".status-text"),H=document.getElementById("filter-input"),J=document.getElementById("log-count"),d={onLogMsg:t=>{u.runtime.onMessage.addListener(e=>{e.type==="LOG_ENTRY"&&t(e.log)})},getLogs:async()=>{try{return(await u.runtime.sendMessage({type:"GET_LOGS"})).logs||[]}catch{return[]}},setRecording:t=>u.storage.local.set({isRecordingActive:t}),setBrowserLog:t=>u.storage.local.set({isBrowserLogActive:t}),setEngineLog:t=>u.storage.local.set({isEngineLogActive:t}),getRecordingState:async()=>(await u.storage.local.get(["isRecordingActive"])).isRecordingActive||!1,getBrowserLogState:async()=>(await u.storage.local.get(["isBrowserLogActive"])).isBrowserLogActive||!1,getEngineLogState:async()=>(await u.storage.local.get(["isEngineLogActive"])).isEngineLogActive||!1,onStatusChange:t=>{setInterval(async()=>{const e=await u.storage.local.get(["isEngineActive"]);t(!!e.isEngineActive)},2e3)}};let m=[],S=null,y="all",E=null;const i={totalRequests:0,totalBytes:0,statusCounts:{"2xx":0,"3xx":0,"4xx":0,"5xx":0,other:0},latencies:[],domainStats:{},leaves:new Map};d.onLogMsg(t=>{const e={id:Date.now()+Math.random().toString(36).substr(2,9),rawTime:Date.now(),...t};(m.length===0||!E)&&(E=e.rawTime),m.push(e),Y(e),m.length>2e3&&m.shift(),B(),b(e)&&$(e),N()});function Y(t){i.totalRequests++;const e=t.size.match(/([\d\.]+)\s*(KB|MB|B)/i);if(e){let s=parseFloat(e[1]);const o=e[2].toUpperCase();o==="KB"?s*=1024:o==="MB"&&(s*=1024*1024),i.totalBytes+=s}const n=parseInt(t.status);n>=200&&n<300?i.statusCounts["2xx"]++:n>=300&&n<400?i.statusCounts["3xx"]++:n>=400&&n<500?i.statusCounts["4xx"]++:n>=500?i.statusCounts["5xx"]++:i.statusCounts.other++;try{const s=new URL(t.url).hostname;i.domainStats[s]||(i.domainStats[s]={count:0,bytes:0}),i.domainStats[s].count++}catch{}if(t.tabId!==void 0){const s=`${t.windowId}-${t.tabId}`;i.leaves.has(s)||i.leaves.set(s,{id:s,tabId:t.tabId,windowId:t.windowId,title:t.leafTitle||"Untitled",count:0,bytes:0,lastSeen:Date.now()});const o=i.leaves.get(s);o.count++,o.lastSeen=Date.now(),o.title=t.leafTitle||o.title;const c=t.size.match(/([\d\.]+)\s*(KB|MB|B)/i);if(c){let a=parseFloat(c[1]);const r=c[2].toUpperCase();r==="KB"?a*=1024:r==="MB"&&(a*=1024*1024),o.bytes+=a}}}function B(){J.textContent=m.length}function b(t){const e=H.value.toLowerCase();if(!(!e||t.url.toLowerCase().includes(e)||t.method.toLowerCase().includes(e)))return!1;if(y==="all")return!0;const s=t.type.toLowerCase();return y==="api"?s.includes("json")||s.includes("xhr")||s.includes("fetch"):y==="asset"?s.includes("image")||s.includes("css")||s.includes("script")||s.includes("font"):y==="doc"?s.includes("html"):!0}function $(t){const e=document.createElement("tr");e.dataset.id=t.id,S===t.id&&e.classList.add("selected");const n=parseInt(t.status),o=`status-${isNaN(n)?"unknown":Math.floor(n/100)+"xx"}`,c=3e4,r=(t.rawTime-E)%c/c*100;let l=10;const f=t.latency.match(/([\d\.]+)(ms|s)/);f&&(l=parseFloat(f[1]),f[2]==="s"&&(l*=1e3));const g=Math.max(Math.min(l/c*100,100-r),1);e.innerHTML=`
        <td class="col-time">${t.timestamp}</td>
        <td class="col-method ${t.method}">${t.method}</td>
        <td class="col-url" title="${t.url}">
            ${t.hasPayload?'<span class="payload-badge" title="Full Content Available">📦</span> ':""}
            ${Q(t.url)}
        </td>
        <td class="col-status"><span class="status-cell ${o}">${t.status}</span></td>
        <td class="col-type">${t.type}</td>
        <td class="col-from"><span class="from-badge ${t.from==="Straws Engine"?"engine":"browser"}">${t.from||"Direct"}</span></td>
        <td class="col-size">${t.size}</td>
        <td class="waterfall-col">
            <div class="wf-track">
                <div class="wf-bar" style="left: ${r}%; width: ${g}%"></div>
            </div>
        </td>
    `,e.addEventListener("click",()=>Z(t.id)),h.insertBefore(e,h.firstChild)}function Q(t){try{const e=new URL(t);return e.pathname+e.search}catch{return t}}function X(t){if(!t)return"No headers available.";const e=t.request||{},n=t.response||{},s=["authorization","cookie","set-cookie","x-api-key","token","bearer","proxy-authorization"],o=(a,r)=>{if(!a||Object.keys(a).length===0)return"";let l=`<div class="inspector-section-title">${r}</div>`;return l+='<table class="kv-table">',Object.entries(a).forEach(([f,g])=>{const v=Array.isArray(g)?g.join(", "):g,j=s.includes(f.toLowerCase()),G=v&&v.length>50;let p=v;G&&(p=`<div class="marquee-wrapper" style="--marq-duration: ${Math.max(5,Math.floor(v.length/10))}s">
                                    <div class="marquee-content">${v}</div>
                                </div>`),j&&(p=`<div class="sensitive-mask">${p}</div>`),l+=`<tr><td class="key">${f}</td><td class="value">${p}</td></tr>`}),l+="</table>",l};let c="";return c+=o(e,"Request Headers"),c+=o(n,"Response Headers"),c||'<div class="insp-empty-hint">No structured headers found.</div>'}function Z(t){S=t;const e=m.find(a=>a.id===t);document.querySelectorAll("tbody tr").forEach(a=>a.classList.remove("selected"));const n=document.querySelector(`tr[data-id="${t}"]`);n&&n.classList.add("selected"),k.classList.add("open"),K.classList.add("hidden"),W.classList.remove("hidden");const s=document.getElementById("source-text");s&&(s.textContent=e.from==="Straws Engine"?"Straws Engine":e.from||"Browser Extension"),P.innerHTML=X(e.headers);const o=(a,r=!1)=>{if(!a)return`<div class="insp-empty-hint">(Empty ${r?"Response":"Request"} Body)</div>`;if(typeof a=="string"&&a.startsWith("(Binary Data:"))return`<div class="binary-view">
                        <div class="binary-icon">📦</div>
                        <div class="binary-info">${a}</div>
                        <button class="btn btn-small" onclick="alert('Hex view coming soon')">Show Hex Dump</button>
                    </div>`;try{if(typeof a=="string"&&(a.trim().startsWith("{")||a.trim().startsWith("[")))return`<pre class="code-view language-json">${JSON.stringify(JSON.parse(a),null,2)}</pre>`}catch{}return`<pre class="code-view">${typeof a=="object"?JSON.stringify(a,null,2):a}</pre>`};if(M.innerHTML=o(e.payload,!1),T.innerHTML=o(e.response,!0),e.from!=="Straws Engine"&&!e.payload&&!e.response){const a=`<div class="engine-only-hint">
                        ℹ️ Full payload decryption requires <b>Straws Engine</b> with SSL Termination active.
                      </div>`;M.innerHTML+=a,T.innerHTML+=a}const c=document.getElementById("timing-view");c&&(c.innerHTML=`
            <div class="timing-row" style="display: flex; justify-content: space-between; padding: 10px 12px; background: var(--bg-deep); border-radius: 8px; border: 1px solid var(--border-subtle);">
                <span class="label" style="color: var(--text-muted); font-size: 0.85rem;">Total latency:</span>
                <span class="value" style="color: var(--accent-cyan); font-family: var(--font-mono); font-weight: 700;">${e.latency||"Unknown"}</span>
            </div>
            <div class="timing-info" style="margin-top: 12px; font-size: 0.7rem; color: var(--text-dim); text-align: center; opacity: 0.6;">
                ℹ️ Waterfall visualization details provided by Engine telemetry.
            </div>`.trim())}A.addEventListener("click",()=>{k.classList.remove("open"),S=null,document.querySelectorAll("tbody tr").forEach(t=>t.classList.remove("selected"))});document.querySelectorAll(".insp-tab").forEach(t=>{t.addEventListener("click",()=>{const e=t.dataset.tab;document.querySelectorAll(".insp-tab").forEach(n=>n.classList.remove("active")),document.querySelectorAll(".tab-panel").forEach(n=>n.classList.add("hidden")),t.classList.add("active"),document.getElementById(`tab-${e}`).classList.remove("hidden")})});document.querySelectorAll(".nav-item").forEach(t=>{t.addEventListener("click",e=>{const n=t.dataset.view;if(!n)return;e.preventDefault(),document.querySelectorAll(".nav-item").forEach(o=>o.classList.remove("active")),t.classList.add("active"),document.querySelectorAll(".view-container").forEach(o=>o.classList.add("hidden"));const s=document.getElementById(`view-${n}`);s&&s.classList.remove("hidden"),n==="metrics"&&N(),n==="certificates"&&C(),n==="leaves"&&I()})});document.querySelectorAll(".pill").forEach(t=>{t.addEventListener("click",()=>{y=t.dataset.filter,document.querySelectorAll(".pill").forEach(e=>e.classList.remove("active")),t.classList.add("active"),z()})});function z(){h.innerHTML="",m.filter(b).forEach($)}H.addEventListener("input",z);V.addEventListener("click",()=>{m=[],h.innerHTML="",B(),A.click()});L.addEventListener("click",async()=>{const e=!await d.getRecordingState();d.setRecording(e),O(e)});x.addEventListener("click",async()=>{const e=!await d.getBrowserLogState();d.setBrowserLog(e),U(e)});w.addEventListener("click",async()=>{const e=!await d.getEngineLogState();d.setEngineLog(e),F(e)});function O(t){L.classList.toggle("active",t),L.querySelector(".btn-text").textContent=t?"Recording...":"Record Session"}function U(t){x.classList.toggle("active",t),x.querySelector(".btn-text").textContent=t?"Browser ON":"Browser Logs"}function F(t){w.classList.toggle("active",t),w.querySelector(".btn-text").textContent=t?"Engine ON":"Engine Logs"}function N(){const t=document.getElementById("stat-total-req"),e=document.getElementById("stat-total-data"),n=document.getElementById("stat-error-rate");if(t&&(t.textContent=i.totalRequests),e){const a=(i.totalBytes/1048576).toFixed(2);e.textContent=a+" MB"}if(n){const a=i.statusCounts["4xx"]+i.statusCounts["5xx"],r=i.totalRequests>0?(a/i.totalRequests*100).toFixed(1):0;n.textContent=r+"%"}const s=document.getElementById("stat-active-domains");s&&(s.textContent=Object.keys(i.domainStats).length);const o=document.getElementById("status-distribution-bar");if(o){const a=i.totalRequests||1,r=i.statusCounts["2xx"]/a*100,l=i.statusCounts["3xx"]/a*100,f=i.statusCounts["4xx"]/a*100,g=i.statusCounts["5xx"]/a*100;o.innerHTML=`
            <div class="seg seg-2xx" style="width: ${r}%" title="2xx: ${i.statusCounts["2xx"]}"></div>
            <div class="seg seg-3xx" style="width: ${l}%" title="3xx: ${i.statusCounts["3xx"]}"></div>
            <div class="seg seg-4xx" style="width: ${f}%" title="4xx: ${i.statusCounts["4xx"]}"></div>
            <div class="seg seg-5xx" style="width: ${g}%" title="5xx: ${i.statusCounts["5xx"]}"></div>
        `}const c=document.getElementById("view-leaves");c&&!c.classList.contains("hidden")&&I()}d.onStatusChange(t=>{D.classList.toggle("online",t),_.textContent=t?"Straws Engine Online":"Straws Engine Offline"});(async()=>(O(await d.getRecordingState()),U(await d.getBrowserLogState()),F(await d.getEngineLogState()),(await d.getLogs()).forEach(e=>{const n={id:Date.now()+Math.random().toString(36).substr(2,9),rawTime:Date.now(),...e};m.push(n),b(n)&&$(n)}),B()))();async function C(){try{const t=await u.runtime.sendMessage({type:"GET_CERTS"});t&&t.certs&&tt(t.certs)}catch(t){console.error("Failed to fetch certs:",t)}}function tt(t){const e=document.getElementById("certs-list");if(e){if(!t||t.length===0){e.innerHTML=`<div class="certs-empty">
            <span class="icon" style="font-size: 2rem; display: block; margin-bottom: 12px;">📭</span>
            No certificates found in engine directory.
        </div>`;return}e.innerHTML=t.map(n=>`
        <div class="cert-card">
            <div class="cert-main">
                <span class="cert-name">${n}</span>
                <span class="cert-type">SSL/TLS KeyPair</span>
            </div>
            <button class="btn-danger delete-cert-btn" data-name="${n}">
                Delete
            </button>
        </div>
    `).join(""),e.querySelectorAll(".delete-cert-btn").forEach(n=>{n.addEventListener("click",()=>{const s=n.dataset.name;confirm(`Are you sure you want to delete the certificate for "${s}"? This will remove physical files from the engine.`)&&et(s)})})}}async function et(t){try{const e=await u.runtime.sendMessage({type:"DELETE_CERT",name:t});e&&e.success?C():alert("Failed to delete certificate: "+(e.error||"Unknown error"))}catch(e){console.error("Delete cert error:",e)}}const q=document.getElementById("refresh-certs-btn");q&&q.addEventListener("click",C);function I(){const t=document.getElementById("leaves-inventory"),e=document.getElementById("leaf-count");if(!t)return;if(i.leaves.size===0){t.innerHTML=`<div class="insp-empty">
            <div class="insp-empty-icon">🍃</div>
            <p>Waiting for traffic logic to identify active leaves...</p>
        </div>`,e&&(e.textContent="0");return}e&&(e.textContent=i.leaves.size);const n=Array.from(i.leaves.values()).sort((s,o)=>o.lastSeen-s.lastSeen);t.innerHTML=n.map(s=>{const o=(s.bytes/1048576).toFixed(2),c=s.tabId<0;return`
            <div class="leaf-card" data-id="${s.id}">
                ${s.id.includes("multi")?'<span class="leaf-pro-badge">PRO</span>':""}
                <div class="leaf-header">
                    <div class="leaf-icon">${c?"⚙️":"📑"}</div>
                    <div class="leaf-meta">
                        <span class="leaf-title" title="${s.title}">${s.title}</span>
                        <span class="leaf-id">ID: ${s.id} ${c?"(System)":""}</span>
                    </div>
                </div>
                <div class="leaf-stats">
                    <div class="l-stat">
                        <span class="l-stat-label">Requests</span>
                        <span class="l-stat-value">${s.count}</span>
                    </div>
                    <div class="l-stat">
                        <span class="l-stat-label">Data</span>
                        <span class="l-stat-value">${o} MB</span>
                    </div>
                </div>
            </div>
        `}).join("")}const R=document.getElementById("refresh-leaves-btn");R&&R.addEventListener("click",I);

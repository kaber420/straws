import{b as m}from"./browser-polyfill.js";const h=document.getElementById("network-body"),k=document.getElementById("detail-panel"),G=document.getElementById("no-selection"),K=document.getElementById("request-details"),P=document.getElementById("header-data"),M=document.getElementById("payload-data"),q=document.getElementById("response-data"),R=document.getElementById("close-detail"),w=document.getElementById("live-btn"),x=document.getElementById("engine-log-btn"),L=document.getElementById("record-btn"),V=document.getElementById("clear-btn"),H=document.getElementById("engine-status"),_=H.querySelector(".status-text"),D=document.getElementById("filter-input"),J=document.getElementById("log-count"),d={onLogMsg:e=>{m.runtime.onMessage.addListener(t=>{t.type==="LOG_ENTRY"&&e(t.log)})},getLogs:async()=>{try{return(await m.runtime.sendMessage({type:"GET_LOGS"})).logs||[]}catch{return[]}},setRecording:e=>m.storage.local.set({isRecordingActive:e}),setBrowserLog:e=>m.storage.local.set({isBrowserLogActive:e}),setEngineLog:e=>m.storage.local.set({isEngineLogActive:e}),getRecordingState:async()=>(await m.storage.local.get(["isRecordingActive"])).isRecordingActive||!1,getBrowserLogState:async()=>(await m.storage.local.get(["isBrowserLogActive"])).isBrowserLogActive||!1,getEngineLogState:async()=>(await m.storage.local.get(["isEngineLogActive"])).isEngineLogActive||!1,onStatusChange:e=>{setInterval(async()=>{const t=await m.storage.local.get(["isEngineActive"]);e(!!t.isEngineActive)},2e3)}};let f=[],S=null,p="all",E=null;const o={totalRequests:0,totalBytes:0,statusCounts:{"2xx":0,"3xx":0,"4xx":0,"5xx":0,other:0},latencies:[],domainStats:{},leaves:new Map};function Y(e){if(!e)return{os:"Unknown OS",browser:"Unknown Browser"};let t="Unknown OS";e.includes("Win")?t="Windows":e.includes("Mac")?t="macOS":e.includes("Linux")?t="Linux":e.includes("Android")?t="Android":e.includes("like Mac")&&(t="iOS");let n="Unknown Browser";e.includes("Firefox")?n="Firefox":e.includes("Chrome")?n="Chrome":e.includes("Safari")&&!e.includes("Chrome")?n="Safari":e.includes("Edge")&&(n="Edge");const s=e.match(/(Firefox|Chrome|Safari|Edge)\/([\d\.]+)/),i=s?s[2].split(".")[0]:"";return{os:t,browser:n,version:i?`${n} ${i}`:n}}d.onLogMsg(e=>{const t={id:Date.now()+Math.random().toString(36).substr(2,9),rawTime:Date.now(),...e};(f.length===0||!E)&&(E=t.rawTime),f.push(t),Q(t),f.length>2e3&&f.shift(),b(),B(t)&&$(t),N()});function Q(e){o.totalRequests++;const t=e.size.match(/([\d\.]+)\s*(KB|MB|B)/i);if(t){let s=parseFloat(t[1]);const i=t[2].toUpperCase();i==="KB"?s*=1024:i==="MB"&&(s*=1024*1024),o.totalBytes+=s}const n=parseInt(e.status);n>=200&&n<300?o.statusCounts["2xx"]++:n>=300&&n<400?o.statusCounts["3xx"]++:n>=400&&n<500?o.statusCounts["4xx"]++:n>=500?o.statusCounts["5xx"]++:o.statusCounts.other++;try{const s=new URL(e.url).hostname;o.domainStats[s]||(o.domainStats[s]={count:0,bytes:0}),o.domainStats[s].count++}catch{}if(e.tabId!==void 0){const s=`${e.windowId}-${e.tabId}`;o.leaves.has(s)||o.leaves.set(s,{id:s,tabId:e.tabId,windowId:e.windowId,title:e.leafTitle||"Untitled",count:0,bytes:0,lastSeen:Date.now(),meta:{os:"",browser:"",lang:""}});const i=o.leaves.get(s);if(i.count++,i.lastSeen=Date.now(),i.title=e.leafTitle||i.title,e.headers&&e.headers.request){const a=e.headers.request,c=a["User-Agent"]||a["user-agent"],l=a["Accept-Language"]||a["accept-language"];if(c){const u=Y(Array.isArray(c)?c[0]:c);i.meta.os=u.os,i.meta.browser=u.version}l&&(i.meta.lang=(Array.isArray(l)?l[0]:l).split(",")[0])}const r=e.size.match(/([\d\.]+)\s*(KB|MB|B)/i);if(r){let a=parseFloat(r[1]);const c=r[2].toUpperCase();c==="KB"?a*=1024:c==="MB"&&(a*=1024*1024),i.bytes+=a}}}function b(){J.textContent=f.length}function B(e){const t=D.value.toLowerCase();if(!(!t||e.url.toLowerCase().includes(t)||e.method.toLowerCase().includes(t)))return!1;if(p==="all")return!0;const s=e.type.toLowerCase();return p==="api"?s.includes("json")||s.includes("xhr")||s.includes("fetch"):p==="asset"?s.includes("image")||s.includes("css")||s.includes("script")||s.includes("font"):p==="doc"?s.includes("html"):!0}function $(e){const t=document.createElement("tr");t.dataset.id=e.id,S===e.id&&t.classList.add("selected");const n=parseInt(e.status),i=`status-${isNaN(n)?"unknown":Math.floor(n/100)+"xx"}`,r=3e4,c=(e.rawTime-E)%r/r*100;let l=10;const u=e.latency.match(/([\d\.]+)(ms|s)/);u&&(l=parseFloat(u[1]),u[2]==="s"&&(l*=1e3));const g=Math.max(Math.min(l/r*100,100-c),1);t.innerHTML=`
        <td class="col-time">${e.timestamp}</td>
        <td class="col-method ${e.method}">${e.method}</td>
        <td class="col-url" title="${e.url}">
            ${e.hasPayload?'<span class="payload-badge" title="Full Content Available">📦</span> ':""}
            ${X(e.url)}
        </td>
        <td class="col-status"><span class="status-cell ${i}">${e.status}</span></td>
        <td class="col-type">${e.type}</td>
        <td class="col-from"><span class="from-badge ${e.from==="Straws Engine"?"engine":"browser"}">${e.from||"Direct"}</span></td>
        <td class="col-size">${e.size}</td>
        <td class="waterfall-col">
            <div class="wf-track">
                <div class="wf-bar" style="left: ${c}%; width: ${g}%"></div>
            </div>
        </td>
    `,t.addEventListener("click",()=>ee(e.id)),h.insertBefore(t,h.firstChild)}function X(e){try{const t=new URL(e);return t.pathname+t.search}catch{return e}}function Z(e){if(!e)return"No headers available.";const t=e.request||{},n=e.response||{},s=["authorization","cookie","set-cookie","x-api-key","token","bearer","proxy-authorization"],i=(a,c)=>{if(!a||Object.keys(a).length===0)return"";let l=`<div class="inspector-section-title">${c}</div>`;return l+='<table class="kv-table">',Object.entries(a).forEach(([u,g])=>{const v=Array.isArray(g)?g.join(", "):g,j=s.includes(u.toLowerCase()),W=v&&v.length>50;let y=v;W&&(y=`<div class="marquee-wrapper" style="--marq-duration: ${Math.max(5,Math.floor(v.length/10))}s">
                                    <div class="marquee-content">${v}</div>
                                </div>`),j&&(y=`<div class="sensitive-mask">${y}</div>`),l+=`<tr><td class="key">${u}</td><td class="value">${y}</td></tr>`}),l+="</table>",l};let r="";return r+=i(t,"Request Headers"),r+=i(n,"Response Headers"),r||'<div class="insp-empty-hint">No structured headers found.</div>'}function ee(e){S=e;const t=f.find(a=>a.id===e);document.querySelectorAll("tbody tr").forEach(a=>a.classList.remove("selected"));const n=document.querySelector(`tr[data-id="${e}"]`);n&&n.classList.add("selected"),k.classList.add("open"),G.classList.add("hidden"),K.classList.remove("hidden");const s=document.getElementById("source-text");s&&(s.textContent=t.from==="Straws Engine"?"Straws Engine":t.from||"Browser Extension"),P.innerHTML=Z(t.headers);const i=(a,c=!1)=>{if(!a)return`<div class="insp-empty-hint">(Empty ${c?"Response":"Request"} Body)</div>`;if(typeof a=="string"&&a.startsWith("(Binary Data:"))return`<div class="binary-view">
                        <div class="binary-icon">📦</div>
                        <div class="binary-info">${a}</div>
                        <button class="btn btn-small" onclick="alert('Hex view coming soon')">Show Hex Dump</button>
                    </div>`;try{if(typeof a=="string"&&(a.trim().startsWith("{")||a.trim().startsWith("[")))return`<pre class="code-view language-json">${JSON.stringify(JSON.parse(a),null,2)}</pre>`}catch{}return`<pre class="code-view">${typeof a=="object"?JSON.stringify(a,null,2):a}</pre>`};if(M.innerHTML=i(t.payload,!1),q.innerHTML=i(t.response,!0),t.from!=="Straws Engine"&&!t.payload&&!t.response){const a=`<div class="engine-only-hint">
                        ℹ️ Full payload decryption requires <b>Straws Engine</b> with SSL Termination active.
                      </div>`;M.innerHTML+=a,q.innerHTML+=a}const r=document.getElementById("timing-view");r&&(r.innerHTML=`
            <div class="timing-row" style="display: flex; justify-content: space-between; padding: 10px 12px; background: var(--bg-deep); border-radius: 8px; border: 1px solid var(--border-subtle);">
                <span class="label" style="color: var(--text-muted); font-size: 0.85rem;">Total latency:</span>
                <span class="value" style="color: var(--accent-cyan); font-family: var(--font-mono); font-weight: 700;">${t.latency||"Unknown"}</span>
            </div>
            <div class="timing-info" style="margin-top: 12px; font-size: 0.7rem; color: var(--text-dim); text-align: center; opacity: 0.6;">
                ℹ️ Waterfall visualization details provided by Engine telemetry.
            </div>`.trim())}R.addEventListener("click",()=>{k.classList.remove("open"),S=null,document.querySelectorAll("tbody tr").forEach(e=>e.classList.remove("selected"))});document.querySelectorAll(".insp-tab").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.tab;document.querySelectorAll(".insp-tab").forEach(n=>n.classList.remove("active")),document.querySelectorAll(".tab-panel").forEach(n=>n.classList.add("hidden")),e.classList.add("active"),document.getElementById(`tab-${t}`).classList.remove("hidden")})});document.querySelectorAll(".nav-item").forEach(e=>{e.addEventListener("click",t=>{const n=e.dataset.view;if(!n)return;t.preventDefault(),document.querySelectorAll(".nav-item").forEach(i=>i.classList.remove("active")),e.classList.add("active"),document.querySelectorAll(".view-container").forEach(i=>i.classList.add("hidden"));const s=document.getElementById(`view-${n}`);s&&s.classList.remove("hidden"),n==="metrics"&&N(),n==="certificates"&&C(),n==="leaves"&&I()})});document.querySelectorAll(".pill").forEach(e=>{e.addEventListener("click",()=>{p=e.dataset.filter,document.querySelectorAll(".pill").forEach(t=>t.classList.remove("active")),e.classList.add("active"),U()})});function U(){h.innerHTML="",f.filter(B).forEach($)}D.addEventListener("input",U);V.addEventListener("click",()=>{f=[],h.innerHTML="",b(),R.click()});L.addEventListener("click",async()=>{const t=!await d.getRecordingState();d.setRecording(t),O(t)});w.addEventListener("click",async()=>{const t=!await d.getBrowserLogState();d.setBrowserLog(t),z(t)});x.addEventListener("click",async()=>{const t=!await d.getEngineLogState();d.setEngineLog(t),F(t)});function O(e){L.classList.toggle("active",e),L.querySelector(".btn-text").textContent=e?"Recording...":"Record Session"}function z(e){w.classList.toggle("active",e),w.querySelector(".btn-text").textContent=e?"Browser ON":"Browser Logs"}function F(e){x.classList.toggle("active",e),x.querySelector(".btn-text").textContent=e?"Engine ON":"Engine Logs"}function N(){const e=document.getElementById("stat-total-req"),t=document.getElementById("stat-total-data"),n=document.getElementById("stat-error-rate");if(e&&(e.textContent=o.totalRequests),t){const a=(o.totalBytes/1048576).toFixed(2);t.textContent=a+" MB"}if(n){const a=o.statusCounts["4xx"]+o.statusCounts["5xx"],c=o.totalRequests>0?(a/o.totalRequests*100).toFixed(1):0;n.textContent=c+"%"}const s=document.getElementById("stat-active-domains");s&&(s.textContent=Object.keys(o.domainStats).length);const i=document.getElementById("status-distribution-bar");if(i){const a=o.totalRequests||1,c=o.statusCounts["2xx"]/a*100,l=o.statusCounts["3xx"]/a*100,u=o.statusCounts["4xx"]/a*100,g=o.statusCounts["5xx"]/a*100;i.innerHTML=`
            <div class="seg seg-2xx" style="width: ${c}%" title="2xx: ${o.statusCounts["2xx"]}"></div>
            <div class="seg seg-3xx" style="width: ${l}%" title="3xx: ${o.statusCounts["3xx"]}"></div>
            <div class="seg seg-4xx" style="width: ${u}%" title="4xx: ${o.statusCounts["4xx"]}"></div>
            <div class="seg seg-5xx" style="width: ${g}%" title="5xx: ${o.statusCounts["5xx"]}"></div>
        `}const r=document.getElementById("view-leaves");r&&!r.classList.contains("hidden")&&I()}d.onStatusChange(e=>{H.classList.toggle("online",e),_.textContent=e?"Straws Engine Online":"Straws Engine Offline"});(async()=>(O(await d.getRecordingState()),z(await d.getBrowserLogState()),F(await d.getEngineLogState()),(await d.getLogs()).forEach(t=>{const n={id:Date.now()+Math.random().toString(36).substr(2,9),rawTime:Date.now(),...t};f.push(n),B(n)&&$(n)}),b()))();async function C(){try{const e=await m.runtime.sendMessage({type:"GET_CERTS"});e&&e.certs&&te(e.certs)}catch(e){console.error("Failed to fetch certs:",e)}}function te(e){const t=document.getElementById("certs-list");if(t){if(!e||e.length===0){t.innerHTML=`<div class="certs-empty">
            <span class="icon" style="font-size: 2rem; display: block; margin-bottom: 12px;">📭</span>
            No certificates found in engine directory.
        </div>`;return}t.innerHTML=e.map(n=>`
        <div class="cert-card">
            <div class="cert-main">
                <span class="cert-name">${n}</span>
                <span class="cert-type">SSL/TLS KeyPair</span>
            </div>
            <button class="btn-danger delete-cert-btn" data-name="${n}">
                Delete
            </button>
        </div>
    `).join(""),t.querySelectorAll(".delete-cert-btn").forEach(n=>{n.addEventListener("click",()=>{const s=n.dataset.name;confirm(`Are you sure you want to delete the certificate for "${s}"? This will remove physical files from the engine.`)&&se(s)})})}}async function se(e){try{const t=await m.runtime.sendMessage({type:"DELETE_CERT",name:e});t&&t.success?C():alert("Failed to delete certificate: "+(t.error||"Unknown error"))}catch(t){console.error("Delete cert error:",t)}}const T=document.getElementById("refresh-certs-btn");T&&T.addEventListener("click",C);function I(){const e=document.getElementById("leaves-inventory"),t=document.getElementById("leaf-count");if(!e)return;if(o.leaves.size===0){e.innerHTML=`<div class="insp-empty">
            <div class="insp-empty-icon">🍃</div>
            <p>Waiting for traffic logic to identify active leaves...</p>
        </div>`,t&&(t.textContent="0");return}t&&(t.textContent=o.leaves.size);const n=Array.from(o.leaves.values()).sort((s,i)=>i.lastSeen-s.lastSeen);e.innerHTML=n.map(s=>{const i=(s.bytes/1048576).toFixed(2),r=s.tabId<0;return`
            <div class="leaf-card" data-id="${s.id}">
                ${s.id.includes("multi")?'<span class="leaf-pro-badge">PRO</span>':""}
                <div class="leaf-header">
                    <div class="leaf-icon">${r?"⚙️":"📑"}</div>
                    <div class="leaf-meta">
                        <span class="leaf-title" title="${s.title}">${s.title}</span>
                        <span class="leaf-id">ID: ${s.id} ${r?"(System)":""}</span>
                    </div>
                </div>
                <div class="leaf-meta-row">
                    ${s.meta.os?`<span class="l-badge badge-os">${s.meta.os}</span>`:""}
                    ${s.meta.browser?`<span class="l-badge badge-browser">${s.meta.browser}</span>`:""}
                    ${s.meta.lang?`<span class="l-badge badge-lang">${s.meta.lang}</span>`:""}
                </div>
                <div class="leaf-stats">
                    <div class="l-stat">
                        <span class="l-stat-label">Requests</span>
                        <span class="l-stat-value">${s.count}</span>
                    </div>
                    <div class="l-stat">
                        <span class="l-stat-label">Data</span>
                        <span class="l-stat-value">${i} MB</span>
                    </div>
                </div>
            </div>
        `}).join("")}const A=document.getElementById("refresh-leaves-btn");A&&A.addEventListener("click",I);

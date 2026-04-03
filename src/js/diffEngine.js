export function diffDictionaries(oldDict, newDict) {
    if (!oldDict) oldDict = {};
    if (!newDict) newDict = {};

    const allKeys = Array.from(new Set([...Object.keys(oldDict), ...Object.keys(newDict)])).sort();
    const diffs = {};

    allKeys.forEach(k => {
        const hasOld = oldDict.hasOwnProperty(k);
        const hasNew = newDict.hasOwnProperty(k);
        
        const oldVal = hasOld ? (Array.isArray(oldDict[k]) ? oldDict[k].join(', ') : oldDict[k]) : null;
        const newVal = hasNew ? (Array.isArray(newDict[k]) ? newDict[k].join(', ') : newDict[k]) : null;

        if (hasOld && !hasNew) {
            diffs[k] = { type: 'removed', oldVal };
        } else if (!hasOld && hasNew) {
            diffs[k] = { type: 'added', newVal };
        } else if (oldVal !== newVal) {
            diffs[k] = { type: 'modified', oldVal, newVal };
        } else {
            diffs[k] = { type: 'unchanged', val: oldVal };
        }
    });

    return { diffs, allKeys };
}

export function formatStringify(data) {
    if (typeof data === 'string') {
        try {
            if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
                return JSON.stringify(JSON.parse(data), null, 2);
            }
        } catch(e) {}
    } else if (typeof data === 'object' && data !== null) {
        return JSON.stringify(data, null, 2);
    }
    return data || "";
}

function renderSectionTitle(title) {
    return `<div class="diff-section-title">${title}</div>`;
}

function renderRow(key, value, statusClass = "") {
    return `
        <div class="diff-dict-row ${statusClass}">
            <span class="diff-key">${key}</span>
            <span class="diff-val">${value || ""}</span>
        </div>`;
}

export function renderDiffPaneView(req, paneType, otherReq) {
    let html = '';

    // -- 1. General Info (Synchronized) --
    html += `<div class="diff-section">`;
    html += renderSectionTitle(`General Info [${paneType === 'older' ? 'Request A' : 'Request B'}]`);
    
    const fields = ['url', 'method', 'status'];
    fields.forEach(f => {
        const val = req[f] || 'unknown';
        const otherVal = otherReq[f] || 'unknown';
        let statusClass = "";
        if (val !== otherVal) {
            statusClass = paneType === 'older' ? 'diff-remove' : 'diff-add';
        }
        html += renderRow(f.toUpperCase(), val, statusClass);
    });
    html += `</div>`;

    // -- 2. Headers (Synchronized Rows) --
    ['request', 'response'].forEach(phase => {
        const title = phase === 'request' ? 'Request Headers' : 'Response Headers';
        const { diffs, allKeys } = diffDictionaries(
            paneType === 'older' ? req.headers?.[phase] : otherReq.headers?.[phase],
            paneType === 'newer' ? req.headers?.[phase] : otherReq.headers?.[phase]
        );

        html += `<div class="diff-section">`;
        html += renderSectionTitle(title);
        
        allKeys.forEach(k => {
            const d = diffs[k];
            if (paneType === 'older') {
                if (d.type === 'removed' || d.type === 'modified') {
                    html += renderRow(k, d.oldVal, 'diff-remove');
                } else if (d.type === 'unchanged') {
                    html += renderRow(k, d.val);
                } else {
                    // Added in newer - render empty row to keep alignment
                    html += renderRow(k, "", "diff-empty-spacer");
                }
            } else {
                if (d.type === 'added') {
                    html += renderRow(k, d.newVal, 'diff-add');
                } else if (d.type === 'modified') {
                    const modHtml = `<span class="diff-mod-val">${d.newVal}</span>`;
                    html += renderRow(k, modHtml, 'diff-add');
                } else if (d.type === 'unchanged') {
                    html += renderRow(k, d.val);
                } else {
                    // Removed in newer - render empty row to keep alignment
                    html += renderRow(k, "", "diff-empty-spacer");
                }
            }
        });
        html += `</div>`;
    });

    // -- 3. Bodies --
    html += `<div class="diff-section">`;
    html += renderSectionTitle("Request Body (Payload)");
    html += `<pre>${formatStringify(req.payload) || '(empty)'}</pre></div>`;

    html += `<div class="diff-section">`;
    html += renderSectionTitle("Response Body");
    html += `<pre>${formatStringify(req.response) || '(empty)'}</pre></div>`;

    return html;
}

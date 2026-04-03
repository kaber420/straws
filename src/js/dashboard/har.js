export function exportToHAR(logs, version = "1.2") {
    const har = {
        log: {
            version: version,
            creator: {
                name: "Straws Cyber-Laboratory",
                version: "1.0.0"
            },
            pages: [],
            entries: logs.map(log => {
                const requestHeaders = log.headers?.request || {};
                const responseHeaders = log.headers?.response || {};
                const latency = log.latency ? parseFloat(log.latency.match(/[\d.]+/)[0]) * (log.latency.includes('ms') ? 1 : 1000) : 0;

                return {
                    startedDateTime: new Date(log.rawTime || Date.now()).toISOString(),
                    time: latency,
                    request: {
                        method: log.method || "GET",
                        url: log.url || "",
                        httpVersion: "HTTP/1.1",
                        cookies: [],
                        headers: Object.entries(requestHeaders).map(([name, value]) => ({ name, value: Array.isArray(value) ? value.join(', ') : value })),
                        queryString: [],
                        headersSize: -1,
                        bodySize: -1,
                        postData: log.payload ? {
                            mimeType: "application/json",
                            text: typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload)
                        } : undefined
                    },
                    response: {
                        status: parseInt(log.status) || 0,
                        statusText: "",
                        httpVersion: "HTTP/1.1",
                        cookies: [],
                        headers: Object.entries(responseHeaders).map(([name, value]) => ({ name, value: Array.isArray(value) ? value.join(', ') : value })),
                        content: {
                            size: parseFloat(log.size || 0) * ((log.size || '').toUpperCase().includes('KB') ? 1024 : ((log.size || '').toUpperCase().includes('MB') ? 1048576 : 1)),
                            mimeType: log.type || "text/plain",
                            text: log.response ? (typeof log.response === 'string' ? log.response : JSON.stringify(log.response)) : ""
                        },
                        redirectURL: "",
                        headersSize: -1,
                        bodySize: -1
                    },
                    cache: {},
                    timings: {
                        send: 0,
                        wait: latency,
                        receive: 0
                    },
                    _straws: { // custom data preservation
                        id: log.id,
                        type: log.type,
                        from: log.from,
                        tabId: log.tabId,
                        windowId: log.windowId,
                        leafTitle: log.leafTitle,
                        sizeStr: log.size
                    }
                };
            })
        }
    };

    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `straws-session-${new Date().toISOString().replace(/[:.]/g, '-')}.har`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importFromHAR(harString) {
    try {
        const har = JSON.parse(harString);
        if (!har.log || !har.log.entries) {
            throw new Error("Invalid HAR file format.");
        }
        
        return har.log.entries.map(entry => {
            const rawTime = new Date(entry.startedDateTime).getTime();
            
            // Reconstruct headers
            const requestHeaders = {};
            if (entry.request.headers) {
                entry.request.headers.forEach(h => requestHeaders[h.name] = h.value);
            }
            
            const responseHeaders = {};
            if (entry.response.headers) {
                entry.response.headers.forEach(h => responseHeaders[h.name] = h.value);
            }

            const isCustom = entry._straws || {};

            let sizeFormatted = isCustom.sizeStr;
            if (!sizeFormatted && entry.response.content) {
                const b = entry.response.content.size || 0;
                sizeFormatted = b < 1024 ? `${b} B` : (b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`);
            }

            return {
                id: isCustom.id || (Date.now() + Math.random().toString(36).substr(2, 9)),
                rawTime: rawTime,
                timestamp: new Date(rawTime).toLocaleTimeString(),
                method: entry.request.method,
                url: entry.request.url,
                status: entry.response.status,
                type: isCustom.type || entry.response.content.mimeType || "unknown",
                from: isCustom.from || "HAR Import",
                size: sizeFormatted || "0 B",
                latency: `${entry.time || 0}ms`,
                headers: {
                    request: requestHeaders,
                    response: responseHeaders
                },
                payload: entry.request.postData ? entry.request.postData.text : null,
                response: entry.response.content ? entry.response.content.text : null,
                hasPayload: !!entry.request.postData || !!entry.response.content?.text,
                tabId: isCustom.tabId !== undefined ? isCustom.tabId : -1,
                windowId: isCustom.windowId !== undefined ? isCustom.windowId : -1,
                leafTitle: isCustom.leafTitle || "Imported Session"
            };
        });
    } catch (e) {
        console.error("HAR Import Error:", e);
        return [];
    }
}

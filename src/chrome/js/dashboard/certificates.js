import browser from "webextension-polyfill";

export async function fetchCertificates() {
    try {
        const response = await browser.runtime.sendMessage({ type: 'GET_CERTS' });
        if (response && response.certs) {
            renderCertificates(response.certs);
        }
    } catch (e) {
        console.error("Failed to fetch certs:", e);
    }
}

export function renderCertificates(certs) {
    const list = document.getElementById('certs-list');
    if (!list) return;

    if (!certs || certs.length === 0) {
        list.innerHTML = `<div class="certs-empty">
            <span class="icon" style="font-size: 2rem; display: block; margin-bottom: 12px;">📭</span>
            No certificates found in engine directory.
        </div>`;
        return;
    }

    list.innerHTML = certs.map(name => `
        <div class="cert-card">
            <div class="cert-main">
                <span class="cert-name">${name}</span>
                <span class="cert-type">SSL/TLS KeyPair</span>
            </div>
            <button class="btn-danger delete-cert-btn" data-name="${name}">
                Delete
            </button>
        </div>
    `).join('');

    list.querySelectorAll('.delete-cert-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            if (confirm(`Are you sure you want to delete the certificate for "${name}"? This will remove physical files from the engine.`)) {
                deleteCertificate(name);
            }
        });
    });
}

export async function deleteCertificate(name) {
    try {
        const response = await browser.runtime.sendMessage({ type: 'DELETE_CERT', name: name });
        if (response && response.success) {
            fetchCertificates(); // Refresh
        } else {
            alert("Failed to delete certificate: " + (response.error || "Unknown error"));
        }
    } catch (e) {
        console.error("Delete cert error:", e);
    }
}

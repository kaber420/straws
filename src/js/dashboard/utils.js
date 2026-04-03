export function parseUA(ua) {
    if (!ua) return { os: 'Unknown OS', browser: 'Unknown Browser' };
    
    let os = 'Unknown OS';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('like Mac')) os = 'iOS';

    let browser = 'Unknown Browser';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    
    const versionMatch = ua.match(/(Firefox|Chrome|Safari|Edge)\/([\d\.]+)/);
    const version = versionMatch ? versionMatch[2].split('.')[0] : '';

    return { os, browser, version: version ? `${browser} ${version}` : browser };
}

export function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (isNaN(bytes)) return '-';
    if (bytes < 1024) return bytes + ' B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function shortenUrl(url) {
    try {
        const u = new URL(url);
        return u.pathname + u.search;
    } catch { return url; }
}

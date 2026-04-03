export const state = {
    logs: [],
    selectedLogId: null,
    selectedRequests: [],
    currentCategory: 'all',
    startTimeRef: null,
    activeDiagnosticId: null,

    // Metrics State
    aggregatedStats: {
        totalRequests: 0,
        totalBytes: 0,
        statusCounts: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, "other": 0 },
        latencies: [],
        domainStats: {}, // host -> { count, bytes }
        leaves: new Map(), // id -> { ..., chaosMode: null }
        activeSimulations: new Set()
    }
};

export function setLogs(newLogs) { state.logs = newLogs; }
export function addLog(log) { state.logs.push(log); }
export function setSelectedLogId(id) { state.selectedLogId = id; }
export function setSelectedRequests(reqs) { state.selectedRequests = reqs; }
export function setCurrentCategory(cat) { state.currentCategory = cat; }
export function setStartTimeRef(time) { state.startTimeRef = time; }
export function setActiveDiagnosticId(id) { state.activeDiagnosticId = id; }

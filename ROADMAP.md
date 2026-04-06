# Straws Ecosystem: Unified Professional Roadmap 🚀
Evolution from a proxy tool to a "Cyber-Laboratory" for developers and security researchers.

## 🟢 Phase 1: High-Fidelity Observability (Current)
*Focus: Data accuracy, professional presentation, and deep-engine integration.*

- [x] **Accurate Waterfall Timing**: Precise latency and temporal mapping.
- [x] **Structured Inspector**: Key-Value tables for headers and payloads.
- [x] **Cyber-Aesthetics**: Responsive design, marquee scrolling, and sensitive data masking.
- [x] **Real-time Metrics**: KPI dashboard and traffic health bar.
- [x] **Physical Cert Management**: Domain-based listing and deletion from engine.
- [x] **Session Isolation (Containers)**: Support for Firefox Container Tabs with isolated cookies and storage.
- [x] **Native Identity (Proxy-Auth)**: Secure leaf identification via standard `Proxy-Authorization` headers.
- [x] **High-Performance Streaming**: Engine optimized with `io.Copy` to handle large traffic without latency.
- [ ] **Low-Level Resource Tracking (PID-based / Hybrid)**: **Estrategia Zero-JS**. PID-based RAM (RSS) and CPU monitoring for each Leaf (Firefox/Chrome) via `gopsutil` to maintain security integrity.
- [ ] **Cross-Browser Server Mapping**: Automated extraction of Server IP, Port, and Protocol (H2/H3) via BiDi/CDP for deep infrastructure analysis.

## 🟡 Phase 2: Active Manipulation (Next)
*Focus: Interactivity, workflow efficiency, and rule orchestration.*

- [x] **Request Diffing**: Side-by-side comparison of headers/payloads between any two traces.
- [x] **HAR Export/Import**: Full compatibility with standard devtools formats (`.har`).
- [ ] **Active Interception (Edit & Resend)**: Modify any intercepted request and manually re-emit it via the Go engine.
- [ ] **Global Search & Filter**: Search across headers, body content, and status codes simultaneously.
- [ ] **Traffic Replay Engine**: Re-running captured traffic with different engine configurations to test WAF/Proxy behavior.

## 🟠 Phase 3: Security & Health Audit
*Focus: Automated intelligence and protocol deep-dive.*

- [x] **SSL/TLS Handshake Inspector**: Detailed view of the TLS negotiation (Ciphers, SNI, Version). ✅ *Implementado en Engine Go.*
- [ ] **Credential Guard**: Highlight exposed secrets (API Keys, Tokens) in URLs or unprotected payloads.
- [ ] **Security Scanners**: Automatic detection of missing security headers (`CSP`, `HSTS`, `XFO`).
- [ ] **Fingerprinting (Request DNA)**: Visual icons per request to identify patterns without reading content.
- [ ] **Broken Link & Dead End Discovery**: Automated background checks for 404s or broken resources during browsing.

## 🔴 Phase 4: Distributed Command & Control (Straws-Mesh) 🌐
*Focus: Scale, orchestration, and industrial security via the Mesh Architecture.*

- [ ] **mTLS Reverse Tunnel Core (Secure Mesh)**: Persistent socket for all nodes using `Certberus` for identity and mTLS for the "secure tube".
- [ ] **Centralized "C2" Master**: Dashboard to manage multiple engines (nodes/VPS) from a single screen.
- [ ] **Straws-Relay (Omni-Relay)**: Cascading rules where traffic can hop through multiple Straws nodes (Direct vs Relay modes).
- [ ] **Kiosk Orchestrator (Hardened Node)**: Specific adapter for managed kiosks with Watchdog and OS-level hardening.
- [ ] **Sensor Node (Lightweight)**: Browser-only connection for standard users (data tunneling without local Go motor).
- [ ] **Remote Policy Injection**: Update WAF rules (Coraza) and domain lists across the entire fleet in one click.

## 🟣 Phase 5: Environment Orchestration
*Focus: From observability to complete environment management.*

- [ ] **Debugging Worksets**: Save and restore entire tab groups associated with a specific task (e.g., "Payment Gateway Refactor"). One-click environment launch.
- [ ] **Lab Snapshotting**: Export a full state (captured traffic, open URLs, and local DB entries) for bug reproduction sharing.
- [ ] **Automated Service Routines**: Run health-checks or "warm-up" scripts in the Go core upon launching a workset.
- [ ] **Session Re-injection**: Automatically re-inject authentication headers or session tokens into new tabs based on previous captures.
- [ ] **Endpoint-Specific Monitoring**: Real-time health and performance monitoring for critical URLs with visual alerts.
- [ ] **Performance History Persistence**: Trend analysis of latency and status stored in DB for historical reporting.
- [ ] **Throughput & Peak Load Analysis**: RPM metrics, peak detection, and heatmaps for critical endpoints.

---
> [!TIP]
> This roadmap is designed to be modular ("Lego" style). Each phase builds upon the existing core (`straws-core`) without requiring a complete rewrite, transitioning from a local proxy to a globally distributed mesh.

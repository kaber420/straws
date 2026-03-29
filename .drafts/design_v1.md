# Straws Proxy: Advanced Architecture & Security Enhancements

This document outlines the design for the next evolution of Straws Proxy, focusing on stealth operation, secure pairing, and data portability.

## Proposed Changes

### 1. Unified Control Center: System Tray (Host)
Instead of a background terminal, the Host will provide a professional Presence in the system tray (indicators area).

*   **Technology**: `pystray` + `PIL`. On Linux, it uses the standard System Tray/AppIndicator spec.
*   **Visual Status Indicator**:
    *   **Green Icon**: Active & Proxying.
    *   **Red/Grey Icon**: Paired but Inactive (Safe Mode).
    *   **Yellow/Pulsing**: Pairing in progress.
*   **Quick Controls (Tray Menu)**:
    *   **Pause Proxy**: Instantly stops redirection for security/protection.
    *   **Generate Link PIN**: Shows the code to pair a new browser.
    *   **Open Activity Log**: Quick access to `/tmp/straws.log`.
    *   **Kill Switch**: Stops the entire bridge process completely.

### 2. Security Pairing (PIN-based Linking)
A robust handshake to prevent unauthorized extensions from hijacking the Straws bridge.

*   **Handshake Protocol**:
    1.  **Request**: Extension sends `{"type": "pair_request"}`.
    2.  **Challenge**: Host shows a PIN via System Tray notification and enters `PAIRING` state for 60 seconds.
    3.  **Verify**: Extension sends `{"type": "pair_verify", "pin": "123456"}`.
    4.  **Token Generation**: Host generates a `UUID4` token, stores it in `straws.json`, and sends it to the extension.
    5.  **Persistence**: Extension stores the token in `chrome.storage.local`. All subsequent commands must include this token.
*   **Security Benefit**: Even if another malicious extension is installed, it won't have the token and cannot redirect traffic or leak rules.

### 3. Rule Portability & Backups
Empowering users to move their configurations between browsers or devices.

*   **Export/Import**: Standardized JSON format for redirection rules.
*   **Schema (Straws V1)**:
    ```json
    {
      "version": "1.0",
      "timestamp": "2026-03-29T...",
      "rules": {
        "api.local": {
          "target": "http://localhost:8000",
          "headers": { "X-Proxy-By": "Straws" }
        }
      }
    }
    ```
*   **Extension UI**:
    *   **Backup Button**: Generates a `.straws` file.
    *   **Import Button**: Merges rules with conflict resolution (Overwrite, Skip, or Duplicate).
*   **Cross-Browser Support**: Ensuring the exact same JSON format works in both Chromium and Gecko-based extensions.

### 4. Safety & Protection Features
Ensuring the user has absolute control over the traffic.

*   **Manual Deactivation**: A prominent "OFF" switch in the tray menu to stop all proxying instantly.
*   **Auto-Deactivation**: Option to automatically turn off Straws when the browser is closed or after X hours.
*   **Rule Validation**: Preventing malicious rules from being imported.

## Verification Plan

### Manual Verification
- [ ] Verify System Tray icon appears on Linux (using `libayatana-appindicator`).
- [ ] Perform a full pairing flow with a fresh extension install.
- [ ] Export rules from one browser instance and successfully import into another.
- [ ] Trigger a "Emergency Deactivation" from the Tray to see the proxy stop immediately.

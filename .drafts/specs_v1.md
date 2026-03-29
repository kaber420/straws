# Straws Proxy: Detailed Technical Specifications

Continuing our expert planning session, here are the granular specifications for the upcoming features.

## 1. Rule Backup Schema (V1.0)
The backup file (`.straws`) will be a JSON object with metadata for versioning and conflict resolution.

```json
{
  "header": {
    "app": "straws-proxy",
    "version": "1.0",
    "exported_at": "ISO8601-Timestamp",
    "generator": "extension-v1.2"
  },
  "configurations": {
    "default": {
      "rules": {
        "api.local": {
          "target": "http://localhost:8000",
          "headers": { "X-Proxy": "Straws" },
          "enabled": true
        }
      },
      "settings": {
        "auto_deactivate": false,
        "theme": "glass-dark"
      }
    }
  }
}
```

## 2. System Tray Menu Hierarchy (Linux/Windows)
Based on `pystray` library, the menu will be reactive to the bridge state.

*   **Header**: `Straws Bridge (Active/Paused)` (Disabled item)
*   **Separator**
*   **Action**: `[ ] Pause Proxy` (Checkbox toggle)
*   **Menu**: `Pairing & Security`
    *   `Show Pairing PIN` (Triggers notification)
    *   `Reset Security Token` (Requires confirmation)
*   **Menu**: `Logs & Diagnostics`
    *   `Openstraws.log`
    *   `Debug Mode (ON/OFF)`
*   **Separator**
*   **Action**: `Exit Straws`

## 3. Security Handshake (State Machine)
To prevent "Ghost" pairing (unauthorized connections), the Host follows this state:

1.  **IDLE**: Accepts incoming Native Messaging connections but ignores non-auth commands.
2.  **PAIR_REQUESTED**: Received from Extension. Host generates PIN and sets `EXPIRE_STAMP`.
3.  **WAITING_FOR_PIN**: Host listens for `pair_verify`.
4.  **ESTABLISHED**: PIN matches. Host generates `auth_token` (persistent) and sends to Extension.
5.  **SECURE**: All future commands MUST include the `auth_token`.

## 4. Pairing UX Flow (Step-by-Step)
For a "Zero Ritual" yet secure experience:

1.  **Extension**: Detects "Unpaired" state. Shows a subtle amber banner: "Bridge not linked. [Pair Now]".
2.  **User**: Clicks [Pair Now].
3.  **Host**: (Triggered via Native Messaging) Shows a System Tray notification: "Straws Pairing Request! PIN: 482-192".
4.  **Extension**: Shows a sleek PIN input field (glassmorphism style).
5.  **User**: Enters PIN.
6.  **Extension**: "Pairing Successful! [OK]". The amber banner turns green and disappears.

## 5. Linux Daemon Integration (`systemd --user`)
To ensure the bridge is "always there" without a terminal:
*   Unit name: `straws.service`
*   Type: `simple`
*   ExecStart: `/usr/bin/python3 [path]/bridge.py --tray`
*   Restart: `on-failure`

## 6. Cross-Platform Strategy (Windows & Linux Coexistence)
As expert developers, we should aim for **"Build Once, Run Anywhere"** with platform-specific "Shims".

### A. One Codebase, Two Faces
We keep a single Python file (`bridge.py`) and use `sys.platform` to switch OS-specific behavior:
*   **Tray**: `pystray` handles both Windows (using `ctypes` internally) and Linux (using `D-Bus/AppIndicator`). No difference in code!
*   **Storage**: 
    *   Linux: `~/.config/straws/straws.json`
    *   Windows: `%APPDATA%/Straws/straws.json`

### B. The "Portable" Approach (No Proton needed!)
Instead of a complex "Proton" layer, we use **Nuitka** or **PyInstaller** to compile the bridge into a single executable:
*   **Windows**: A single `straws.exe`.
*   **Linux**: A single `straws.bin`.
The browser treats both identically via the Native Messaging JSON manifest, which simply points to the right path depending on the OS.

### C. OS-Specific Shims (The "Expert" way)
*   **Windows Startup**: Add a shortcut to the `.exe` in the `shell:startup` folder.
*   **Linux Startup**: Use the `systemd` user service mentioned above.
*   **Tray Integration**: On Windows, the icon sits in the notification area; on Linux, it sits in the top bar or tray depending on the DE (GNOME/KDE/XFCE).

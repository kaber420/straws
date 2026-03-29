# StrawsProxy 🥤

**Straws Proxy** (formerly OmniBridge) is a zero-ritual, rootless traffic redirection tool for modern web development. It allows you to use custom domains (like `.kbr` or `.local`) and forward them to any local service with custom headers and zero system-level configuration.

## Features

- **Zero-Ritual:** No Nginx, no Traefik, no `/etc/hosts` tinkering.
- **Rootless:** Runs entirely in user space.
- **Header Injection:** Easily add Authorization, X-User, or Debug headers to specific domains.
- **Privacy First:** All redirection rules are handled locally.
- **Premium UI:** Glassmorphism-inspired interface with multiple themes (Frost/Neo).
- **Multi-language:** Support for English and Spanish.

## Installation

### 1. The Native Host (Python)

Straws uses a Python native messaging host to manage rules and provide a lightweight proxy server.

```bash
cd host
# (Optional) Create a venv
python3 -m venv venv
source venv/bin/activate
# Install the host manifest
python3 install.py
```

### 2. The Chrome Extension

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder in this repository.

## Usage

1. Open the **Straws Proxy** popup or side panel.
2. Click **ADD STRAW**.
3. Enter a domain (e.g., `api.local`) and a target (e.g., `localhost:8080`).
4. Click **Activate Straws**.
5. Your browser will now forward traffic for `api.local` to your local service!

## Architecture

- **Extension:** Manages the Proxy Auto-Configuration (PAC) script dynamically.
- **Native Host:** A Python script that receives rules from the extension and runs a local HTTP/HTTPS proxy on port 9000.
- **Logs:** Check `/tmp/straws.log` for real-time redirection logs.

---
*Created as part of the OmniSuite ecosystem, now a standalone soloist.*

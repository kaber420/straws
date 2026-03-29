import os
import sys
import json
import platform
import shutil

HOST_NAME = "com.omni.straws_proxy"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BRIDGE_PY = os.path.join(SCRIPT_DIR, "bridge.py")

# Extension ID - Update this to match your local installation ID
ALLOWED_EXTENSIONS = [
    "chrome-extension://bebpaiomkcldlljdfmccmeeipbndlkll/"
]

def install_linux():
    # 1. Create wrapper script with relative paths for portability
    wrapper_path = os.path.join(SCRIPT_DIR, "bridge.sh")
    with open(wrapper_path, "w") as f:
        f.write("#!/bin/bash\n")
        f.write('DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"\n')
        f.write('python3 "$DIR/bridge.py" "$@"\n')
    os.chmod(wrapper_path, 0o755)

    # 2. Define manifest
    manifest = {
        "name": HOST_NAME,
        "description": "Straws Proxy Native Messaging Host",
        "path": wrapper_path,
        "type": "stdio",
        "allowed_origins": ALLOWED_EXTENSIONS
    }

    # 3. Save manifest
    config_dir = os.path.expanduser("~/.config/google-chrome/NativeMessagingHosts")
    os.makedirs(config_dir, exist_ok=True)
    
    manifest_path = os.path.join(config_dir, f"{HOST_NAME}.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=4)
    
    print(f"Installed Straws host manifest at: {manifest_path}")

def install_windows():
    print("Windows installation requires manual registry setup:")
    print(f"Key: HKEY_CURRENT_USER\\Software\\Google\\Chrome\\NativeMessagingHosts\\{HOST_NAME}")
    print(f"Value: {SCRIPT_DIR}\\{HOST_NAME}.json")

if __name__ == "__main__":
    if platform.system() == "Linux":
        install_linux()
    elif platform.system() == "Windows":
        install_windows()
    else:
        print(f"Unsupported OS: {platform.system()}")

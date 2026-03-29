#!/bin/bash
# Entry point for Straws Proxy TUI

# Get the script's directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Path to the venv python
VENV_PYTHON="$DIR/host/.venv/bin/python3"

# Check if venv exists
if [ -f "$VENV_PYTHON" ]; then
    echo "Starting Straws TUI via Virtual Env..."
    "$VENV_PYTHON" "$DIR/host/tui.py"
else
    # Fallback to system python if venv is missing
    echo "Warning: Virtual Env not found at $VENV_PYTHON. Trying system python3..."
    python3 "$DIR/host/tui.py"
fi

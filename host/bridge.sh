#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
exec /usr/bin/python3 "$DIR/bridge.py" "$@"

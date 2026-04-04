#!/bin/bash

# Este script configura el manifiesto nativo para Chrome
# Necesitas pasar el ID de tu extensión como argumento.

if [ "$#" -ne 1 ]; then
    echo "Uso: $0 <CHROME_EXTENSION_ID>"
    echo "Ejemplo: $0 abcdefghijklmnopqrsxyz123456789"
    exit 1
fi

EXTENSION_ID=$1
HOST_NAME="com.kaber420.straws.core"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Asumiendo que el motor está en ../straws-core/bin/straws-engine
ENGINE_PATH="$(cd "$SCRIPT_DIR/../straws-core/bin" && pwd)/straws-engine"

# Directorio de Chrome en Linux
TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"

mkdir -p "$TARGET_DIR"

cat << EOF > "$TARGET_DIR/$HOST_NAME.json"
{
  "name": "com.kaber420.straws.core",
  "description": "StrawsCore Proxy Engine",
  "path": "$ENGINE_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "Manifiesto de Native Messaging para Chrome configurado con éxito en:"
echo "$TARGET_DIR/$HOST_NAME.json"
echo "Permitido el ID: $EXTENSION_ID"

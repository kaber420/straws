# Hoja de Ruta: Straws Light (Extensión Pura)

## Objetivo
Crear una herramienta de redirección web ultraligera, segura y sin dependencias externas (sin Python, sin Host).

## Componentes Técnicos
- **Manifest V3**: Uso de `declarativeNetRequest` para redirecciones de red nativas.
- **Side Panel**: Interfaz de usuario integrada en el panel lateral de Chrome.
- **Almacenamiento**: `chrome.storage.local` para persistencia de reglas.

## Funcionalidades Core
1. **Redirección HTTP/HTTPS -> HTTP**: Mapear dominios locales o remotos a puertos locales (ej: `myapi.dev` -> `localhost:3000`).
2. **Gestión de Straws**: Añadir, editar, pausar y eliminar reglas de redirección desde la UI.
3. **Logs en Tiempo Real**: Visualizar qué peticiones están siendo interceptadas y hacia dónde se redirigen.
4. **Exportar/Importar JSON**: Guardar y cargar la configuración de reglas en un archivo local.

## Seguridad
- **Sandbox Total**: La extensión no puede acceder al sistema de archivos del usuario.
- **Sin Ejecución Externa**: Todo el código reside dentro del paquete de la extensión.
- **Control de Usuario**: La redirección solo actúa sobre los dominios que el usuario defina explícitamente.

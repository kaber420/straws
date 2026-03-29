# Plan Maestro de Reestructuración - Straws Proxy

Este plan se ejecutará en 4 fases secuenciales. NO se avanzará a la siguiente fase sin confirmación.

## Fase 1: Simplificación y Limpieza del Código
**Objetivo**: Eliminar funciones "ruidosas" que no aportan valor o confunden.

1.  **Eliminar Temas (CSS/JS)**:
    - Borrar físicamente `extension/ui/js/theme_engine.js`.
    - Eliminar los archivos CSS en `extension/ui/css/themes/` (frost.css, neo.css).
    - Consolidar las variables de color de "Frost" en `base.css` como predeterminadas.
    - Quitar los botones de cambio de tema en `sidepanel.html`.
2.  **Eliminar Soporte Multi-idioma (i18n)**:
    - Borrar la carpeta `extension/_locales`.
    - Limpiar `sidepanel.html` de todos los atributos `data-i18n`. Escribir el texto directamente en el HTML.
    - Eliminar la función `applyI18n` y sus llamadas en `ui.js`.
3.  **Eliminar Elementos Legados de la UI**:
    - Quitar los botones de "Pause" y "Stop Host" (ya no se usan en la nueva lógica).
    - Eliminar el texto "Port: 9000 & 9001" que causa confusión.

## Fase 1.5: Optimización de Rendimiento
**Objetivo**: Eliminar la latencia del proxy y corregir llamadas UI redundantes al arrancar.

1.  **Optimización del proxy (`bridge.py`)**:
    - Cambiar `HTTPServer` por `ThreadingHTTPServer` para atender peticiones web en paralelo y sin demoras.
    - Mover `import http.client` al inicio del archivo (fuera de la rutina por cada solicitud).
2.  **Optimización de carga en la UI (`ui.js`)**:
    - Eliminar la llamada redundante `StrawsUI.refreshStraws()` durante la inicialización, aprovechando que `checkStatus` ya lo hace simultáneamente.

## Fase 2: Reparación del Núcleo (Core) y Almacenamiento
**Objetivo**: Asegurar que los datos (especialmente cabeceras) lleguen correctamente al Host.

1.  **Actualizar el Host (`bridge.py`)**:
    - Modificar el comando `add_rule` para que acepte un objeto JSON completo (con el campo `headers`).
    - Ajustar la lógica de guardado en `straws.json` para persistir estas cabeceras.
2.  **Actualizar el Background (`background.js`)**:
    - Corregir el paso de mensajes: asegurar que el objeto `headers` se envíe a través del WebSocket al Host.
3.  **Verificación de Persistencia**:
    - Comprobar manualmente que al añadir una regla, esta se guarde con sus cabeceras en el archivo del host.

## Fase 3: Mejora de "Add Straw" y Presets
**Objetivo**: Facilitar la creación de reglas con cabeceras comunes.

1.  **Rediseño de la sección "Headers" en `sidepanel.html`**:
    - Añadir botones de acceso rápido (Presets) para:
        - `Authorization: Bearer <token>`
        - `Authorization: Basic <user:pass>`
2.  **Lógica de Presets en `ui.js`**:
    - Crear funciones que inserten automáticamente estas claves en los campos de cabecera.
3.  **Arreglar el flujo de guardado**:
    - Asegurar que el botón "Activate Straw" capture correctamente todas las filas de cabeceras (actualmente parece que ignora algunas configuraciones).

## Fase 4: Limpieza de Puertos y TUI
**Objetivo**: Sincronizar el Dashboard de terminal con la nueva lógica.

1.  **Limpieza de Puertos en `bridge.py`**:
    - Eliminar las constantes de puerto hardcodeadas que ya no funcionan o son falsas.
2.  **Actualización del TUI (`tui.py`)**:
    - Quitar las menciones al puerto 9000 y a la función de "Pause" en la interfaz de terminal.

# Arquitectura: Straws Light (Extensión Pura de Chrome)

## Objetivo
Explorar y documentar la creación de una versión "Light" de Straws, funcionalmente independiente y sin dependencias externas. Esta versión operará al 100% dentro del "sandbox" del navegador aprovechando las APIs nativas de Chrome, eliminando la necesidad de un Native Messaging Host (Python) o una interfaz de terminal (TUI).

Su propósito principal es servir como un enrutador o controlador de tráfico web ligero y flexible, ideal para desarrolladores y usuarios avanzados que ya tienen servidores (locales o remotos) exponiendo puertos HTTP/HTTPS y solo necesitan que el navegador envíe o redirija el tráfico hacia ellos.

---

## 1. APIs Nativas Clave de Chrome

Para lograr que la extensión funcione por sí sola como un proxy/enrutador, se utilizarán las siguientes herramientas de WebExtensions:

### A. `chrome.declarativeNetRequest` (DNR)
Es el motor principal para interceptar, bloquear o modificar peticiones de red "en vuelo" dentro de las extensiones modernas (Manifest V3).

*   **Uso en Straws Light:** 
    *   **Redirecciones Dinámicas:** Capturar peticiones a un dominio específico (por ejemplo, `produccion.com` o recursos en producción) y redirigirlas instantáneamente a un servidor de desarrollo corriendo en otro puerto (ej. `localhost:8080`).
    *   **Modificación de Cabeceras (Headers):** Añadir, eliminar o modificar cabeceras HTTP (como `Authorization`, `User-Agent`, tokens de autenticación) al vuelo sin que la petición salga de la visión del navegador.
    *   **Rapidez:** Al ser evaluado por el motor interno de Chrome en C++ y no en JavaScript puro, no añade latencia a la conexión.

### B. `chrome.proxy`
Permite a la extensión gestionar, interceptar y reconfigurar por completo los ajustes de proxy del navegador Chrome.

*   **Uso en Straws Light:** 
    *   **Túneles de Tráfico:** Configurar Chrome para que envíe todo el tráfico, o el tráfico de ciertas URLs muy puntuales, a un servidor de entorno de pruebas (SOCKS5, HTTP/HTTPS).
    *   **Reglas PAC (Proxy Auto-Configuration):** Utilizar scripts PAC instalados por la extensión para decidir de forma inteligente y programática qué tráfico pasa por un proxy remoto y qué tráfico va directo a internet, sin necesidad de infraestructura de sistema local.

### C. `chrome.dns` (Contextual)
Permite a la extensión resolver nombres de dominio de forma paralela.
*   **Uso en Straws Light:** Útil si se necesita precargar la resolución de IPs internas o verificar la salud de un túnel.

---

## 2. Almacenamiento y Control de Estado

Dado que no hay un programa con permisos sobre el disco duro manejando las reglas (como el archivo Python en nuestro proyecto base), la persistencia del estado reside exclusivamente en el ecosistema seguro del navegador.

*   **Almacenamiento: `chrome.storage.local` / `chrome.storage.sync`:** 
    *   Guardará el esquema de configuración y mapeos de los usuarios.
    *   Ejemplo de estructura de reglas puras de UI: `[{ origen: "mi-api.dev", destino: "localhost:3000", activo: true }]`.
    *   **Ventaja clave:** Usar `chrome.storage.sync` permite que todas las reglas de mapeo viajen con la cuenta de Google Chrome del usuario, sincronizándose automáticamente en cualquier otra computadora donde inicie sesión.

---

## 3. Flujo de Trabajo (Service Worker Architecture)

Al eliminar el host externo, el "Cerebro" lógico pasa a ser el **Background Service Worker** (`background.js`):

1.  **Captura en UI (SidePanel / Popup):** La interfaz visual es la encargada de recoger las reglas de red que el usuario introduce.
2.  **Mensajería:** La interfaz visual se comunica vía `chrome.runtime.sendMessage` con el Service Worker que corre en segundo plano informándole de las nuevas configuraciones.
3.  **Procesamiento y Despliegue (Service Worker):**
    *   Recibe las instrucciones de la interfaz.
    *   Convierte las configuraciones sencillas del usuario en complejas **Reglas Declarativas JSON** exigidas por Chrome.
    *   Llama al método dinámico `chrome.declarativeNetRequest.updateDynamicRules({ addRules: [...] })` para "inyectar" e instar las reglas en el motor de red del navegador, cobrando efecto de inmediato.

---

## 4. Comparativa: Straws "Full" vs. Straws "Light"

| Característica | Straws Full (Native Host Python) | Straws Light (Extensión Pura) |
| :--- | :--- | :--- |
| **Instalación** | Requiere Scripts de Setup, Terminal, Python. | Instalación a un solo clic desde un archivo `.crx` o la Web Store. |
| **Interoperabilidad Externa** | Controlable desde TUI, scripts externos o terminal de Linux usando WebSockets. | Estrictamente limitado al panel o la ventana emergente de Chrome. |
| **Servidor de Archivos Locales**| Puede interceptar URLs y servir carpetas completas en crudo desde el disco (`file:///home/...`). | **Totalmente Bloqueado.** Chrome evita deliberadamente las redirecciones de la web hacia el disco duro local, las redirecciones deben ir hacia servicios HTTP (`http://localhost`). |
| **Rendimiento de Red** | El tráfico hace escala: _Navegador -> Host Local Python -> Internet/Servidor._ | **Máximo rendimiento Nativo:** _Navegador -> Internet/Servidor._ |

## 5. Conclusión
El enfoque "Light" es el camino adecuado, limpio y moderno para el público objetivo general (Desarrolladores Web, Analistas QA) que ya exponen puertos a través de sus entornos de Node, PHP, Docker o servidores físicos de su empresa. Esta versión permite evitar la arquitectura cliente/servidor local al interior del sistema operativo, resultando mucho más estable, fácil de distribuir y con un rendimiento superior para simples mapeos y redirecciones HTTP.

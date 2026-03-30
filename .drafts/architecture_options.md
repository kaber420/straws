# Análisis de Arquitecturas: Straws Proxy

Este documento analiza las opciones de arquitectura para la comunicación entre la extensión del navegador y el host local (`bridge.py`), evaluando el equilibrio entre **Simplicidad** y **Seguridad**, así como el manejo del ciclo de vida (evitar que el proxy quede de fondo de manera autónoma o zombi).

## Opción 1: Native Messaging Puro (El Estándar de Extensiones Chrome)
La extensión lanza el script de Python y se comunican internamente por `stdio` (entrada y salida estándar del sistema operativo).

**Pros:**
*   **Ciclo de vida automático:** El navegador enciende el proxy al abrirse/activar la extensión y lo mata (le envía la señal de cerrado) apenas se cierra o desactiva. Cero procesos zombis garantizado.
*   **Seguridad nativa (Insuperable):** Es arquitectónicamente imposible que otra aplicación local o página web maliciosa se conecte al canal de control del proxy. El Sistema Operativo y el navegador forman un escudo alrededor del túnel de control.
*   **Cero fricción de red local:** No requiere abrir ni lidiar con puertos para el intercambio de comandos (aunque el tráfico proxy en sí, sí requiere el puerto 9000).

**Contras:**
*   **Depuración difícil:** Desarrollar leyendo el `stdout` puede ser tedioso y requiere librerías para decodificar los bytes estructurales (como ya tienes en tu código con `struct.unpack`).
*   **Aislamiento forzado:** El script no puede ser controlado directamente por una interfaz de terminal (TUI) sin crear sockets secundarios paralelos.

---

## Opción 2: WebSockets Puros (Standalone / Independiente)
El usuario (o el OS al arrancar) lanza el script `bridge.py` manualmente. La extensión se conecta por la red local a un puerto, por ejemplo, `ws://127.0.0.1:9002`.

**Pros:**
*   **Extrema simplicidad de desarrollo:** Depurar mensajes de WebSockets es inmediato viendo la pestaña de Red de Chrome.
*   **Desacoplamiento:** El proxy puede ser manejado por la extensión, pero al mismo tiempo puedes tener un Panel TUI en tu terminal viendo los registros de los túneles.
*   **Inmune al navegador:** Si el navegador se cuelga, el proxy sigue vivo manteniendo las descargas a medio camino intactas.

**Contras:**
*   **Manejo Zombi (El Problema Autónomo):** El archivo queda en ejecución de de fondo. Obliga a programar lógicas de temporizadores (ej: "Si nadie me habla por WS en 5 minutos, me suicido").
*   **Riesgo de Seguridad en HostLocal:** Ese puerto 9002 está vivo en tu máquina. Un programa de terceros o malware podría conectarse, y cambiar las reglas de "Straws Proxy" para espiarte o redirigir tu tráfico bancario a servidores piratas.

---

## Opción 3: WebSockets + Seguridad de Token (Casamiento Bidireccional)
Una variante elaborada de la Opción 2. Se mantiene la comunicación WebSockets, pero bloqueamos la puerta a desconocidos.

**Lógica de Enlace (Pareo):**
1. Al iniciar `bridge.py`, genera un Token aleatorio temporal o lee un "Secreto" de un archivo oculto.
2. El usuario copia y pega ese secreto en las opciones de la extensión (o el host lo pasa al navegador mediante un mensaje Native de una sola vía ("ping de arranque")).
3. Todos los comandos enviados por la extensión van cifrados o verificados bajo ese Token.

**Pros:**
*   **Mejor relación Flexibilidad/Certeza:** Permite las TUI y desconexiones de pestañas, pero erradica por completo la posibilidad de inyecciones maliciosas.
*   **Escalable:** Permite en el futuro tener una app de móvil o de escritorio conectándose a ese mismo proxy local de manera autenticada.

**Contras:**
*   **Exceso de Ingeniería para "Pajitas":** Pierde la esencia de ser una herramienta simple y a nivel de navegador y que no ensucia al host con configuraciones complejas.
*   **UX Afectada:** El usuario ahora tiene que lidiar con claves o un paso extra al instalarlo por primera vez.
*   **Persiste el problema de Ciclo de Vida:** Sigue requiriendo lógica de Cierre Inteligente programado a medida.

---

## Veredicto y Estrategia de Ramas (Branches) Recomendada

A nivel arquitectónico, basándome en tu filosofía:
> *"son túneles super cortitos y locales como una pajita (...) y está al alcance del navegador que es donde se usan estas cosas realmente sin tanta configuración"*

**La opción equilibrada es la Opción 1 (Native Messaging).** Te asegura la muerte del proceso al desinstalarlo o cerrarlo y da una seguridad perfecta de inyección de reglas, sin pedir un "Token" al desarrollador y manteniendo la promesa de "1-click túnel".

### Cómo puedes organizar tus Ramas para experimentación:

1.  **Rama `core-native`**: Priorizar el ciclo de vida del navegador. En este modelo perfeccionas `bridge.py` para que ignore peticiones complejas y sea 100% esclavo de lo que le entra por `stdin` desde Chrome. Una vez Chrome lo mata, limpia recursos y se cierra.
2.  **Rama `experimental-ws-auth`**: Rama de experimentación Standalone. Aquí pruebas implementar un servidor WebSockets que expone el API de control en el puerto 9002 verificando la cabecera `Origin: chrome-extension://[tu-id]` más un intercambio de Tokens. El enfoque está en crear múltiples clientes de control (TUI + Extensión).

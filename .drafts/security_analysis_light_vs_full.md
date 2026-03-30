# Análisis de Seguridad: Straws Full (Host) vs. Straws Light (Extensión Pura)

Este documento detalla por qué la arquitectura de **Straws Light** es intrínsecamente más segura para el usuario que la arquitectura original basada en un Host de Python (Native Messaging).

## 1. Comparación de Arquitecturas

| Característica | Straws Full (Python + Extension) | Straws Light (Solo Extensión MV3) |
| :--- | :--- | :--- |
| **Entorno de Ejecución** | Sistema Operativo (Linux/Windows) | Navegador (Sandbox de Chrome) |
| **Privilegios** | Mismos que el usuario actual | Restringidos por el Navegador |
| **Acceso al Disco** | Total (Lectura/Escritura de archivos) | **Ninguno** (Solo almacenamiento interno) |
| **Acceso a Red** | Puede abrir puertos (9000, 9001, etc) | No puede abrir puertos en el sistema |
| **Control de Tráfico** | Realizado por un script personalizado | Realizado por el motor nativo de Chrome |

---

## 2. El "Sandbox" del Navegador: Tu Escudo
La versión Light vive dentro de una **Caja de Arena**. Esto significa que:
*   **Aislamiento de Archivos:** Aunque la extensión fuera comprometida, Chrome le prohíbe físicamente acceder a tu carpeta `/home/`, tus fotos, o tus documentos de configuración.
*   **Sin Código Externo:** Manifest V3 prohíbe cargar scripts de servidores externos. Todo el código debe estar dentro del paquete de la extensión y ser revisado.
*   **Sin Procesos Hijos:** La extensión no puede lanzar comandos de terminal (`bash`, `rm -rf`, etc.).

---

## 3. Permisos Mínimos (The "Manifest" Safety)
Para que Straws Light sea segura, el archivo `manifest.json` solo solicitará los permisos estrictamente necesarios:

```json
{
  "permissions": [
    "declarativeNetRequest",
    "declarativeNetRequestFeedback",
    "storage",
    "sidePanel"
  ],
  "host_permissions": [
    "*://*/*" 
  ]
}
```
*   **declarativeNetRequest:** Solo permite dar instrucciones al navegador sobre cómo cambiar una URL. No le da a la extensión el poder de "leer" el contenido de tus páginas (como contraseñas) de forma indiscriminada.
*   **storage:** Para guardar tus "Straws" (reglas) localmente en el navegador.
*   **host_permissions:** Aunque se pide para cualquier sitio, el motor de Chrome solo activa la lógica de la extensión cuando la URL coincide exactamente con una regla que tú (el usuario) hayas guardado.

---

## 4. Control de Ejecución y Ciclo de Vida

Uno de los mayores riesgos que has identificado es la **autoejecución silenciosa**:

### Straws Full (Native Messaging)
*   **Inicio Silencioso:** Cada vez que abres el navegador, la extensión puede invocar el script de Python sin preguntarte. Chrome lo lanza "por debajo".
*   **Dificultad para detenerlo:** Aunque cierres la pestaña, el proceso de Python puede quedar "huérfano" (zombie) corriendo en tu Linux, consumiendo recursos o manteniendo puertos abiertos.
*   **Revocación técnica:** Para quitarle el permiso al script de Python, tendrías que borrar archivos del sistema (`/usr/share/google-chrome/native-messaging-hosts/`) o desinstalar la extensión por completo. No hay un "interruptor" intermedio fácil.

### Straws Light (Pure Extension)
*   **Ciclo controlado por Chrome:** No hay procesos externos. El "cerebro" de la extensión (Service Worker) solo se activa cuando es estrictamente necesario y Chrome lo "duerme" automáticamente si no se está usando.
*   **Botón de Apagado Real:** Si desactivas la extensión en el menú de Chrome, se detiene **todo**. No queda ningún script de Python "escondido" en tu terminal ni en tu lista de procesos (`ps aux`).
*   **Transparencia:** Puedes ver exactamente qué memoria y CPU consume la extensión desde el Administrador de Tareas de Chrome (`Shift + Esc`), algo que es mucho más difícil de rastrear con un host de Linux externo.

## 6. Mitos de Desarrollo y la Realidad de las Extensiones

Es común que algunos desarrolladores digan que las extensiones de Chrome son "basura" o "limitadas" porque Google impone restricciones de seguridad muy fuertes (especialmente en Manifest V3). Sin embargo, esto no es porque sean malas, sino porque están **diseñadas para proteger al usuario**.

### ¿Por qué te impusieron Native Messaging?
1.  **Comodidad del Programador:** Es mucho más fácil escribir código normal en Python que aprender las APIs específicas y restrictivas de Chrome como `declarativeNetRequest`.
2.  **Control Total (Peligroso):** El Native Messaging le da al programador "superpoderes" sobre tu PC, lo cual es más "cómodo" para ellos pero mucho más arriesgado para ti.

### La Alternativa Segura: Extensión como Cliente (WebSockets/HTTP)
En lugar de que la extensión **lance** el programa de Python (como hace Native Messaging), la extensión puede simplemente **hablar** con un programa que tú ya tengas abierto, usando:
*   **WebSockets con Token:** La extensión se conecta a `ws://localhost:puerto` enviando una clave de seguridad. Si el programa no está abierto, la extensión simplemente no hace nada. **No tiene el poder de lanzarlo por su cuenta.**
*   **Redirecciones Nativas:** Como discutimos, para redirigir tráfico de red, ni siquiera hace falta hablar con Python. Chrome lo hace solo.

## Conclusión
**Straws Light no es "basura", es una evolución hacia la seguridad profesional.** Los desarrolladores que te dijeron que era "imposible" probablemente no querían enfrentarse a las restricciones de seguridad de Google. Al usar las APIs oficiales, recuperas el control total de tu privacidad, eliminas procesos automáticos no deseados y demuestras que una herramienta profesional puede ser segura y ligera al mismo tiempo.

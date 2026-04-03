# 🥤 Straws (Active Interceptor)

> **"El Laboratorio Cibernético Definitivo para Observabilidad e Ingeniería del Caos en el Navegador"**

**Straws** es la iteración avanzada (Versión Normal/Pro) del ecosistema Straws. A diferencia de _StrawsLite_ (enfocado en direccionamiento rápido y ligero), **Straws** está diseñado como un proxy de intercepción manual y un centro de mando para diagnósticos profundos de red. 

Actuando como una "Transmisión Manual", te permite observar, pausar, modificar e inyectar anomalías al tráfico de red con una precisión quirúrgica a nivel de pestaña.

## 🚀 Características Principales

*   **Identidad y Aislamiento por Pestaña ("Active Leaves") 📑:** 
    A diferencia de los proxies tradicionales que mezclan todo el tráfico en un solo torrente, Straws identifica y aísla el tráfico por origen específico (`windowId-tabId`). Ideal para probar múltiples versiones de un frontend (A/B testing o despliegues Blue/Green) en pestañas paralelas sin confusión.
*   **Ingeniería del Caos Focalizada (Caos & Resiliencia) 💥:** 
    Desde el panel de control, puedes aplicar reglas destructivas a pestañas específicas sin afectar el resto del navegador.
    *   Inyección de Jitter y Latencia sintética.
    *   Simulación de errores (HTTP 500, bloqueos de conexión).
    *   Comprobación de resiliencia real del cliente ante fallos parciales.
*   **Panel de Control de Observabilidad Unificado 🎛️:**
    Una interfaz premium que reemplaza a las limitadas DevTools del navegador. Incluye inspección de cascadas de red (waterfalls), carga de recursos, y monitoreo del inventario de pestañas activas.
*   **Edición Declarativa (DNR) y Modificación de Cabeceras 🛠️:**
    Intercepta respuestas, reescribe cabeceras HTTP sobre la marcha y bloquea peticiones basado en reglas dinámicas, todo directamente desde la interfaz y sin recargar la página.
*   **Integración Transparente con el Motor Go:**
    Envía y recibe datos complejos de telemetría a través del proxy binario `straws-core` usando comunicaciones de ultra-baja latencia (Native Messaging).

## 🏢 Arquitectura "Team-Ready" (Visión a Futuro)
La arquitectura descentralizada de Straws (Navegador ↔ Proxy Engine) está diseñada pensando en la colaboración. En el futuro, permitirá que múltiples desarrolladores utilicen la extensión como "agentes", enviando tráfico selectivo a un Proxy Manager centralizado para que los equipos de QA e Ingeniería puedan depurar colaborativamente en tiempo real.

---

## 🛠️ Desarrollo y Compilación

El proyecto está empaquetado usando **Vite** para ofrecer una experiencia de desarrollo rápida.

### Requisitos previos
* Node.js (v18 o superior recomendado)
* Configuración del motor `straws-core` (Go) para el enrutamiento completo.

### Scripts Disponibles

En el directorio raíz del componente `straws`:

```bash
# Instalar dependencias
npm install

# 🖥️ Modo Desarrollo (Hot-Reload)
npm run dev:chrome      # Inicia el dev server para Chrome
npm run dev:firefox     # Inicia el dev server para Firefox

# 📦 Compilación para Producción (Build)

> **⚠️ Precaución con la carpeta `dist/`:** El empaquetador Vite elimina automáticamente el directorio `dist/` al iniciar cualquier comando de compilación. Si cancelas o se interrumpe un build en progreso, la carpeta quedará vacía y la extensión dejará de funcionar localmente. Para restaurarla, vuelve a ejecutar el comando hasta que finalice exitosamente.

npm run build:chrome    # Genera la extensión lista para usar en Chrome
npm run build:firefox   # Genera la extensión lista para usar en Firefox

# 🔨 Compilar el Motor Go emparejado
npm run build:engine

# 🧪 Pruebas E2E (End-to-End)
npm run test:chrome     # Ejecuta las pruebas automatizadas con Puppeteer en Chrome
npm run test:firefox    # Ejecuta las pruebas automatizadas con Puppeteer en Firefox
```

## 🛡️ Licencia
straws-engine AGPL-3.0
straws GPL-3.0
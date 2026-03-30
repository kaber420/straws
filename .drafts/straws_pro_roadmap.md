# Hoja de Ruta: Straws Pro (Secure Connect)

## Objetivo
Proporcionar una interfaz profesional de control para un Proxy/Servidor Python independiente, con énfasis en la seguridad cifrada y el aislamiento.

## Arquitectura (Modelo Cliente-Servidor)
- **Frontend (Extensión)**: Actúa solo como cliente y visor. No lanza el host.
- **Backend (Python)**: Servidor independiente ejecutado por el usuario (puede estar "sandboxeado").
- **Puente**: WebSocket Seguro (`wss://`) sobre TLS.

## Funcionalidades Avanzadas
1. **Gestión de Certificados (.p12)**: Botón para importar certificados de cliente y servidor para cifrar la comunicación local.
2. **Autenticación por Token**: Conexión protegida mediante llaves de acceso para evitar que otras apps locales intercepten el tráfico.
3. **Carga Dinámica de Reglas**: La extensión solicita y carga la configuración directamente desde el servidor Python.
4. **Sandboxing de Sistema**: Diseño del host para operar con permisos mínimos, ciego al sistema de archivos personal del usuario.

## Seguridad Pro
- **Cifrado de Extremo a Extremo**: Comunicación totalmente privada entre navegador y host.
- **Aislamiento de Procesos**: El ciclo de vida del host es independiente del navegador; tú decides cuándo iniciarlo y cuándo matarlo.
- **Control de Acceso**: Solo extensiones autorizadas con el certificado correcto pueden hablar con el host.

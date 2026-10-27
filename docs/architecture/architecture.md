# Arquitectura del Cliente de Terreno (PWA)

**Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI)**  
**Municipalidad de Valdivia — Dirección de Gestión de Riesgos de Desastres (DGRD)**

---

## 1. Visión General del Sistema

El cliente móvil `sgrai-pwa` está diseñado específicamente para operar en condiciones de terreno adversas bajo conectividad celular intermitente o nula. Atiende de forma exclusiva a:
- **Patrulla Verificadora** (Triage primario y evaluación en terreno).
- **Delegado de Cuadrilla** (Intervención operativa pesada, evidencia y cierre).

```
                      +------------------------------------------+
                      |         sgrai-api (Backend REST)         |
                      |   - JWT / Socket.io / PostgreSQL / PostGIS |
                      +------------------------------------------+
                                       ^            ^
                        HTTPS (REST)  |            | WebSockets
                                       v            v
+---------------------------------------------------------------------------------+
|                                 sgrai-pwa                                       |
|                                                                                 |
|  +--------------------+   +-----------------------+   +----------------------+  |
|  | Interfaz Terreno   |   | Motor Sincronización  |   | Cliente WebSocket    |  |
|  | (Touch >= 48px,    |-->| & Cola Outbox         |<--| - Evento asignación  |  |
|  |  Noto Sans, Flat)  |   | (IndexedDB / idb)     |   | - Telemetría GPS     |  |
|  +--------------------+   +-----------------------+   +----------------------+  |
|                                       ^                                          |
|                                       |                                          |
|                          +-------------------------+                             |
|                          | Capacidades del Navegador|                            |
|                          | - Geolocation API (GPS) |                            |
|                          | - Media Capture (Cámara)|                            |
|                          | - Service Worker / Cache|                            |
|                          +-------------------------+                             |
+---------------------------------------------------------------------------------+
```

---

## 2. Paradigma Offline-First y Almacenamiento Local

La aplicación utiliza IndexedDB como fuente local de la verdad mediante el wrapper `idb` ([src/services/offlineQueue.ts](file:///home/zetastormy/Development/SGRAI/web-app/src/services/offlineQueue.ts)), estructurado en tres almacenes clave:

1. **`misiones`:**
   - Almacena las misiones asignadas a la unidad en terreno.
   - Permite consultar detalles del incidente, coordenadas e historial sin red celular.
2. **`catalogos`:**
   - Caché de catálogos oficiales descargados desde `sgrai-api` (tipologías de incidentes, niveles de severidad y prioridades).
3. **`outbox`:**
   - Cola de mutaciones diferidas.
   - Si una acción se ejecuta sin conexión (`POST /misiones/{id}/aceptar`, `POST /misiones/{id}/reporte`, etc.), se serializa y encola con timestamp e identificador único.
   - Al detectar el evento `online` en el navegador, el hook `useConnectivity` procesa ordenadamente la cola enviando cada mutación al backend y removiéndola tras la confirmación HTTP exitosa.

---

## 3. Telemetría GPS en Tiempo Real (H70)

Para mantener actualizado el mapa operacional del Centro de Mando:
- El hook `useTelemetry` activa el sensor de geolocalización de alta precisión (`enableHighAccuracy: true`).
- Transmite periódicamente mediante WebSocket el evento `telemetria:posicion` a la sala del servidor con:
  - Identificador y tipo de unidad (`PATRULLA` o `CUADRILLA`).
  - Coordenadas geográficas (`lat`, `lng`).
  - Precisión en metros y velocidad instantánea.
- Cuenta con limitador de frecuencia (*throttling*) de 15 segundos para conservar la batería del dispositivo móvil durante jornadas operativas extensas.

---

## 4. Requisitos de Seguridad y RBAC Perimetral

- Todas las peticiones HTTP autenticadas inyectan el encabezado `Authorization: Bearer <jwt_token>`.
- El token JWT y el perfil del usuario se almacenan en cookies seguras gestionadas por [src/lib/utils/cookieUtils.ts](file:///home/zetastormy/Development/SGRAI/web-app/src/lib/utils/cookieUtils.ts).
- Restricción perimetral: el cliente verifica en el inicio de sesión que el rol sea `PATRULLA_VERIFICADORA` o `DELEGADO_CUADRILLA`. Cualquier intento de acceso con roles de oficina o externos es rechazado de inmediato con error 403.

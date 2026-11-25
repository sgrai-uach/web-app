# Auditoría Técnica y Matriz de Casos de Prueba — HU-[70]: Transmisión Automática de Telemetría GPS en Terreno (Cliente Terreno `sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `feature/H70-telemetria-gps-terreno` (lista para integración hacia `develop`)  
**Historia de Usuario:** HU-[70] — Transmisión automática de telemetría GPS en segundo plano mientras la unidad se encuentra en misión activa  
**Desarrollador Asignado:** `DsAlenRupailaf`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `24/11/2026 23:44 -03:00`  
**Fecha y Hora de Ciclo Re-Test Final:** `24/11/2026 23:50 -03:00`  
**Entorno de Ejecución Re-Test:** Linux, Node.js, Vitest v3.2.7, Next.js 16.3.4 (Turbopack), ESLint, TypeScript (`tsc --noEmit`)  
**Dictamen de Auditoría Final:** **APROBADO PARA INTEGRACIÓN EN `develop` (`6` de `6` defectos corregidos; `20` de `20` casos en estado `APROBADO`)**

---

## Alcance Arquitectónico en `sgrai-pwa`

De acuerdo con la separación de responsabilidades del ecosistema SGRAI, el listener backend del evento `telemetria:posicion`, la validación Zod en servidor, la persistencia volátil en Redis (`unidad:{id}:posicion`) y la retransmisión a la sala `mapa` residen en `sgrai-api` (`v0.11.0`), mientras que el renderizado de marcadores en tiempo real sobre el mapa comunal reside en `sgrai-web` (Centro de Mando).

En el cliente de terreno `sgrai-pwa` (exclusivo para los roles `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA`), la implementación auditada y aprobada cubre:

- Contrato tipado `TelemetriaPosicionPayload` (`src/types/telemetria.ts`) alineado con `sgrai-api` (`unidadId`, `tipoUnidad`, `lat`, `lng`, `timestamp`, `rumbo`, `precision`, `velocidad`).
- Gestor compartido de cliente Socket.io (`src/lib/socket/terrenoSocket.ts`) reutilizado entre `useTerrenoSocket` y `useTelemetry` con autenticación JWT en el handshake (`auth: { token }`).
- Hook reactivo `useTelemetry` (`src/hooks/useTelemetry.ts`) con sondeo controlado cada `30000 ms`, configuración óptima de batería de Geolocation API (`enableHighAccuracy: true`, `timeout: 10000`, `maximumAge: 30000`), saneamiento WGS84, detención inmediata al concluir la misión, monitoreo de `navigator.permissions` y retransmisión silenciosa tras desconexiones de red.
- Componentes visuales no intrusivos (`TelemetryStatusBadge` y `TelemetryWarningBanner`) bajo estándar Flat UI, esquinas rectas (`--radius-none: 0px`), iconografía `lucide-react` y ergonomía táctil mínima de `48px`.
- Integración en vistas operativas de misión activa de patrulla (`/terreno/patrulla/misiones/[id]`) y cuadrilla (`/terreno/cuadrilla/misiones/[id]`) con resguardo de rol (`esPatrulla` / `esCuadrilla`).
- Manual de usuario (`docs/manuals/H70-telemetria-gps-terreno.md`) y documentación técnica actualizada (`docs/api/contratos-terreno.md`, `docs/architecture/architecture.md`, `docs/qa/matrices/matriz-pruebas-terreno.md`).

---

## 1. Resumen Ejecutivo

Durante la auditoría forense inicial sobre `feature/H70-telemetria-gps-terreno` (`24/11/2026 23:44`), se identificaron **6 defectos reales** (`3` de severidad Alta y `3` de severidad Media): condiciones de carrera asíncronas en callbacks GPS/permisos (`BUG-H70-PWA-01`), duplicación de conexiones Socket.io por orden de ejecución de efectos React y destrucción de socket durante reconexión (`BUG-H70-PWA-02`), validación incompleta de límites WGS84/saneamiento de sensores y ausencia de guarda de rol cruzado (`BUG-H70-PWA-03`), incumplimiento de objetivo táctil mínimo de `48px` y semántica ARIA interactiva (`BUG-H70-PWA-04`), brechas de cobertura unitaria en `terrenoSocket.ts`, `useTelemetry.test.ts` y `PatrullaDetailPage.test.tsx` (`BUG-H70-PWA-05`), y desfases en documentación técnica y manual (`BUG-H70-PWA-06`).

En el ciclo de **Re-Test Final** (`24/11/2026 23:50`), se verificó la resolución íntegra de los **6 defectos**. La verificación estricta de tipos (`npx tsc --noEmit`), el análisis estático (`npm run lint`) y la compilación productiva (`npm run build`) finalizan sin errores, y la suite completa de Vitest alcanza `125` pruebas aprobadas en `32` archivos (`6` suites y `35` pruebas directamente vinculadas a HU-70, Socket.io y vistas activas de terreno).

| Indicador / Verificación | Auditoría Inicial (24/11/2026 23:44) | Re-Test Final (24/11/2026 23:50) | Observación Técnica |
|---|---|---|---|
| Total de casos en matriz (HU-70 PWA) | `20` casos | `20` casos | `6` defectos `APROBADO` tras corrección + `14` casos funcionales/técnicos `APROBADO` (`0` abiertos) |
| Defectos abiertos por severidad | `0` Crítica, `3` Alta, `3` Media | `0` Crítica, `0` Alta, `0` Media | Subsanados todos los defectos altos y medios detectados |
| Suite automatizada completa (`npm test`) | `31` archivos / `118` tests (`9.04s`) | `32` archivos / `125` tests (`6.84s`) | Incorpora `terrenoSocket.test.ts` (`3`) y ampliación de casos de borde en `useTelemetry`, `PatrullaDetailPage` y `CuadrillaDetailPage` |
| Subconjunto HU-70 y Socket.io (`npx vitest run`) | `5` archivos / `28` tests | `6` archivos / `35` tests (`3.56s`) | `terrenoSocket`, `useTerrenoSocket`, `useTelemetry`, `TelemetryStatusBadge`, `PatrullaDetailPage` y `CuadrillaDetailPage` |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `4` advertencias | `0` errores, `4` advertencias | Advertencias preexistentes en `@next/next/no-location-assign-relative-destination` |
| Verificación de tipos (`npx tsc --noEmit`) | `0` errores (exit `0`) | **APROBADO** (`0` errores, exit `0`) | Tipado estricto validado sin errores ni uso de `any` |
| Build de producción (`npm run build`) | Aprobado (exit `0`) | **APROBADO** (exit `0`, TS en `6.5s`) | Compilación Turbopack (`2.9s`) y prerenderizado estático (`8/8` en `499ms`) |
| Prohibición de emojis en UI (`src/`) | Aprobado (`0` coincidencias) | Aprobado (`0` coincidencias) | Validado mediante búsqueda de rangos Unicode en `src/` (`NO_EMOJIS_IN_SRC`) |

---

## 2. Registro Técnico de Defectos y Verificación de Subsanación (Re-Test Final)

### BUG-H70-PWA-01 — Condición de carrera asíncrona en `useTelemetry`: emisión de coordenadas tras finalizar la misión y fuga de listener en `navigator.permissions.query`
- **Severidad:** Alta
- **Estado:** **CORREGIDO (Verificado en Re-Test — 24/11/2026 23:50)**
- **Archivos afectados:**
  - `src/hooks/useTelemetry.ts`
  - `src/hooks/__tests__/useTelemetry.test.ts`
- **Descripción del defecto:** Los callbacks asíncronos de `navigator.geolocation.getCurrentPosition` (hasta `10000 ms` de latencia) no validaban si la telemetría seguía activa ni si correspondían a la solicitud vigente, permitiendo emitir `telemetria:posicion` y restaurar `TRANSMITIENDO` tras finalizar la misión o desmontar la vista (incumpliendo CA-4). Adicionalmente, si el hook se desmontaba antes de resolver `navigator.permissions.query`, el listener `change` se registraba sin limpieza posible, y `ultimaPosicionRef` conservaba posiciones obsoletas tras desactivación.
- **Verificación en Re-Test:** Se incorporaron `activoRef`, contador secuencial `solicitudSeqRef`, bandera de cancelación `cancelado` en `navigator.permissions.query` y limpieza de `ultimaPosicionRef.current` al pasar a `INACTIVO`. Validado mediante pruebas automatizadas dedicadas en `useTelemetry.test.ts` (`11/11` aprobadas en `107ms`).

---

### BUG-H70-PWA-02 — Fuga de conexiones Socket.io duplicadas por orden de ejecución de `useEffect` (hijo antes que padre) y destrucción indebida durante reconexión
- **Severidad:** Alta
- **Estado:** **CORREGIDO (Verificado en Re-Test — 24/11/2026 23:50)**
- **Archivos afectados:**
  - `src/lib/socket/terrenoSocket.ts`
  - `src/hooks/useTerrenoSocket.ts`
  - `src/lib/socket/__tests__/terrenoSocket.test.ts`
- **Descripción del defecto:** En React, el `useEffect` de las páginas hijas (`useTelemetry`) se ejecuta antes que el `useEffect` de `TerrenoLayout` (`useTerrenoSocket`). `useTelemetry` creaba un primer socket al encontrar la referencia vacía y luego `useTerrenoSocket` invocaba `io(...)` directamente creando una segunda conexión sin desconectar la primera, dejando el listener de reconexión de telemetría atado a un socket huérfano. Además, `conectarSocketTerreno` exigía `socketInstance.connected === true`, destruyendo conexiones que aún estaban en handshake o reconectándose en zonas de sombra.
- **Verificación en Re-Test:** `conectarSocketTerreno(token)` reutiliza la instancia existente cuando coincide el token (`socketToken`) incluso durante handshake o reconexión; `useTerrenoSocket` delega la creación en `conectarSocketTerreno(token)`, suscribe salas inmediatamente si el socket ya está conectado y limpia listeners (`off('connect')`) y conexión con `desconectarSocketTerreno(socket)`. Validado en `terrenoSocket.test.ts` (`3/3`, `14ms`) y `useTerrenoSocket.test.ts` (`3/3`, `50ms`).

---

### BUG-H70-PWA-03 — Validación incompleta de límites WGS84/saneamiento de sensores en `useTelemetry` y ausencia de guarda de rol cruzado en vistas de misión
- **Severidad:** Alta
- **Estado:** **CORREGIDO (Verificado en Re-Test — 24/11/2026 23:50)**
- **Archivos afectados:**
  - `src/hooks/useTelemetry.ts`
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx`
  - `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx`
- **Descripción del defecto:** `useTelemetry` no validaba los límites WGS84 (`lat ∈ [-90, 90]`, `lng ∈ [-180, 180]`), ni saneaba valores fuera de rango reportados por dispositivos móviles en `heading` (`< 0` o `> 360`), `accuracy` (`< 0`) o `speed` (`< 0`), lo que provocaba rechazos Zod en `sgrai-api`. Tampoco recortaba `unidadId` con espacios ni protegía `intervaloMs <= 0`. Asimismo, las vistas de detalle hardcodeaban `tipoUnidad` sin validar `esPatrulla` / `esCuadrilla` desde `useAuth()`.
- **Verificación en Re-Test:** Se añadieron validadores `esCoordenadaWGS84Valida`, `sanitizarRumbo`, `sanitizarNoNegativo`, saneamiento de `unidadId.trim()` y umbral mínimo `INTERVALO_MIN_MS` con fallback a `30000 ms`. Ambas vistas validan `esPatrulla` y `esCuadrilla` antes de activar `useTelemetry`. Verificado en `useTelemetry.test.ts` y `CuadrillaDetailPage.test.tsx`.

---

### BUG-H70-PWA-04 — Incumplimiento de ergonomía táctil mínima (`48px`), semántica ARIA interactiva en `TelemetryStatusBadge` y color hex hardcodeado
- **Severidad:** Media
- **Estado:** **CORREGIDO (Verificado en Re-Test — 24/11/2026 23:50)**
- **Archivos afectados:**
  - `src/components/terreno/TelemetryStatusBadge.tsx`
  - `src/components/terreno/TelemetryStatusBadge.module.css`
  - `src/components/terreno/__tests__/TelemetryStatusBadge.test.tsx`
- **Descripción del defecto:** `.retryButton` usaba `min-height: 36px` incumpliendo el objetivo táctil mínimo obligatorio de `48px` (`--touch-target-min: 48px`) definido en `AGENTS.md §2` y `GEMINI.md §3`. El distintivo clickeable utilizaba `<div role="status" tabIndex={0} onClick>` en lugar de un `<button type="button">` nativo accesible, y `.inactivo` usaba `border-color: #D2D6DC` hardcodeado en lugar de `var(--border-color-neutral, #DFE3E8)`.
- **Verificación en Re-Test:** `.retryButton` y `.clickable` aplican `min-height: var(--touch-target-min, 48px)`, los estados reintentables renderizan un `<button type="button">` accesible verificado con `getByRole('button')` en `TelemetryStatusBadge.test.tsx` (`8/8`, `368ms`), y `.inactivo` utiliza `var(--border-color-neutral, #DFE3E8)`.

---

### BUG-H70-PWA-05 — Brechas de cobertura unitaria e integración (`AGENTS.md §4`): ausencia de pruebas para `terrenoSocket.ts` y vistas activas de patrulla
- **Severidad:** Media
- **Estado:** **CORREGIDO (Verificado en Re-Test — 24/11/2026 23:50)**
- **Archivos corregidos / agregados:**
  - `src/lib/socket/__tests__/terrenoSocket.test.ts` (nuevo, `3` pruebas)
  - `src/hooks/__tests__/useTelemetry.test.ts` (ampliado de `9` a `11` pruebas)
  - `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx` (ampliado de `6` a `7` pruebas)
  - `src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx` (ampliado de `2` a `3` pruebas)
- **Verificación en Re-Test:** Todas las unidades nuevas disponen de suite automatizada; `npm test` aprueba `32/32` archivos (`125/125` pruebas) en `6.84s`.

---

### BUG-H70-PWA-06 — Desfase documental en `contratos-terreno.md`, `architecture.md`, `matriz-pruebas-terreno.md` y cita en manual H70
- **Severidad:** Media
- **Estado:** **CORREGIDO (Verificado en Re-Test — 24/11/2026 23:50)**
- **Archivos corregidos:**
  - `docs/api/contratos-terreno.md`: actualizado payload `telemetria:posicion` sustituyendo `precisionMetros` por `precision` e incorporando `rumbo`.
  - `docs/architecture/architecture.md`: actualizada sección 3 reemplazando throttling de `15s` por sondeo controlado de `30s` (rango 30–60s) y opciones reales de Geolocation API.
  - `docs/qa/matrices/matriz-pruebas-terreno.md`: actualizado `TC-17` alineándolo con `getCurrentPosition` cada `30s` y tolerancia offline.
  - `docs/manuals/H70-telemetria-gps-terreno.md`: cita literal del banner de permiso denegado homologada exactamente con `TelemetryWarningBanner`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-H70-PWA-01 | Descarte de lecturas GPS asíncronas tardías al desactivar misión y prevención de fuga en `navigator.permissions.query` | Concurrencia / Unitaria | Unitaria | Alta | Hook `useTelemetry` activo con `getCurrentPosition` y `permissions.query` diferidos | Transición `activa: true -> false` antes de resolver GPS y `unmount()` antes de resolver `permissions.query` | Descarta callback GPS tardío sin emitir ni cambiar a `TRANSMITIENDO`; no registra listener en `PermissionStatus` tras desmontaje | `useTelemetry.test.ts` verifica ausencia de emisión tardía, permanencia en `INACTIVO` y `0` listeners registrados tras `unmount` (`107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | fix(telemetria): corregir condiciones de carrera, reutilizacion Socket.io y saneamiento WGS84 en useTelemetry (H70) |
| BUG-H70-PWA-02 | Reutilización única de instancia Socket.io compartida sin duplicación ni desconexión durante handshake o reconexión | Tiempo Real / Integración | Unitaria / Integración | Alta | `terrenoSocket.ts` y `useTerrenoSocket.ts` bajo mock de `socket.io-client` | Llamadas sucesivas a `conectarSocketTerreno('jwt-patrulla-1')` con `connected: false`, cambio de token y `desconectarSocketTerreno` selectivo | Invoca `io()` una sola vez para el mismo token aunque esté desconectado; reconecta solo al cambiar token; no borra instancia más reciente | `terrenoSocket.test.ts` (`3/3`, `14ms`) y `useTerrenoSocket.test.ts` (`3/3`, `50ms`) verifican singleton compartido y limpieza de salas | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | fix(telemetria): corregir condiciones de carrera, reutilizacion Socket.io y saneamiento WGS84 en useTelemetry (H70) |
| BUG-H70-PWA-03 | Validación de rangos WGS84, saneamiento de `rumbo`/`precision`/`velocidad`, resguardo de `intervaloMs` y prevención de rol cruzado | Validación / Seguridad RBAC | Unitaria / Componentes | Alta | `useTelemetry` y vistas detalle de patrulla/cuadrilla con datos anómalos y roles cruzados | `lat: 95.5`, `heading: 420`, `accuracy: -3`, `speed: -1`, `unidadId: '   '`, `intervaloMs: 0`, operador patrulla en ruta cuadrilla | Rechaza coordenadas fuera de `[-90,90]`/`[-180,180]` (`ERROR_GPS`), sanea campos a `null`, usa `30000 ms` y bloquea emisión en rol cruzado | `useTelemetry.test.ts` (`11/11`) y `CuadrillaDetailPage.test.tsx` (`3/3`) aprueban todas las aserciones de saneamiento y control de rol | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | fix(ui): corregir ergonomia tactil de 48px, boton accesible ARIA y resguardo de rol cruzado en telemetria (H70) |
| BUG-H70-PWA-04 | Ergonomía táctil mínima `48px`, botón nativo accesible en `TelemetryStatusBadge` y token `--border-color-neutral` | UI / Accesibilidad | Componentes | Media | `TelemetryStatusBadge` y `TelemetryWarningBanner` en estado `SIN_PERMISO` con `onRetry` | Renderizado en jsdom e inspección CSS de `.retryButton`, `.clickable` e `.inactivo` | Renderiza `<button type="button">` accesible, `min-height: var(--touch-target-min, 48px)` en controles interactivos y uso de token neutral | `TelemetryStatusBadge.test.tsx` (`8/8`, `368ms`) valida `BUTTON` con `getByRole('button')` y estilos alineados con `tokens.css` | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | fix(ui): corregir ergonomia tactil de 48px, boton accesible ARIA y resguardo de rol cruzado en telemetria (H70) |
| BUG-H70-PWA-05 | Cobertura de pruebas automatizadas en `terrenoSocket.test.ts`, casos de borde de `useTelemetry` e integración en `PatrullaDetailPage` | Calidad / Regresión | Unitaria / Integración | Media | Suite Vitest completa del repositorio `web-app` | Ejecución de `npm test` y suites específicas HU-70 (`6` archivos) | Cero módulos nuevos sin pruebas (`AGENTS.md §4`) y cobertura de permisos, offline, rol cruzado y vistas activas | `32/32` archivos y `125/125` pruebas aprobadas (`6.84s`); subconjunto HU-70 `6/6` archivos y `35/35` pruebas en verde | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | test(telemetria): agregar suite terrenoSocket y ampliar cobertura de casos de borde HU-70 |
| BUG-H70-PWA-06 | Alineación documental de contratos WebSocket, arquitectura de telemetría, matriz general y manual H70 | Documentación | Documentación | Media | Archivos en `docs/api/`, `docs/architecture/`, `docs/manuals/` y `docs/qa/matrices/` | Inspección cruzada de `contratos-terreno.md`, `architecture.md`, `H70-telemetria-gps-terreno.md` y `matriz-pruebas-terreno.md` | Payload unificado (`precision`, `rumbo`), frecuencia `30s`, configuración Geolocation API y cita textual idéntica a `TelemetryWarningBanner` | Documentación técnica, matriz `TC-17` y manual H70 100% homologados con la implementación real | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | docs(telemetria): alinear contratos WebSocket, arquitectura y manual H70 con implementacion final |
| CP-H70-PWA-01 | Estado inicial `INACTIVO` sin captura GPS ni emisiones cuando la misión no está en curso (`activa: false`) | Funcional / Unitaria | Unitaria | Alta | `useTelemetry` inicializado con `activa: false` y `unidadId: 'pat-001'` | `{ unidadId: 'pat-001', tipoUnidad: 'PATRULLA', activa: false }` | Retorna `estado: 'INACTIVO'`, `transmitiendo: false`, `ultimaPosicion: null`; `0` llamadas a GPS/socket | Aprobado en `useTelemetry.test.ts` (`11/11` en `107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS |
| CP-H70-PWA-02 | Bloqueo de captura cuando falta `unidadId`, es vacía o falta `tipoUnidad` aunque `activa` sea `true` | Validación / Unitaria | Unitaria | Alta | `useTelemetry` con `activa: true` y parámetros incompletos | `{ unidadId: null | '   ', tipoUnidad: 'PATRULLA', activa: true }` | Permanece en `INACTIVO` sin invocar `navigator.geolocation.getCurrentPosition` | Aprobado en `useTelemetry.test.ts` (`11/11` en `107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | fix(telemetria): corregir condiciones de carrera, reutilizacion Socket.io y saneamiento WGS84 en useTelemetry (H70) |
| CP-H70-PWA-03 | Activación automática y emisión de evento `telemetria:posicion` con contrato completo y opciones de batería | Funcional / Contrato | Unitaria | Alta | `useTelemetry` con `activa: true`, GPS simulado y socket conectado | `lat: -39.8142, lng: -73.2459, heading: 180, accuracy: 5.5, speed: 12.3` | Invoca `getCurrentPosition` con `{ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }`; emite `telemetria:posicion` con contrato exacto y estado `TRANSMITIENDO` | Aprobado en `useTelemetry.test.ts` (`11/11` en `107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS |
| CP-H70-PWA-04 | Emisión periódica controlada cada 30 segundos en segundo plano mediante temporizador | Funcional / Eficiencia | Unitaria | Alta | `useTelemetry` activo con `vi.useFakeTimers()` y `tipoUnidad: 'CUADRILLA'` | Avance temporal simulado `+30000 ms` y `+30000 ms` (`60s` totales) | Emite al inicio (`t=0s`), a los `30s` y a los `60s` (`3` emisiones exactas) sin sobrecarga de batería | Aprobado en `useTelemetry.test.ts` (`11/11` en `107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS |
| CP-H70-PWA-05 | Detención automática inmediata y limpieza de temporizador al finalizar, rechazar o cancelar la misión | Funcional / Ciclo de Vida | Unitaria | Alta | `useTelemetry` en estado `TRANSMITIENDO` | Cambio de prop `activa: true -> false` y avance de `60000 ms` | Estado cambia a `INACTIVO`, se cancela `setInterval` y no se ejecutan nuevas capturas ni emisiones | Aprobado en `useTelemetry.test.ts` (`11/11` en `107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | fix(telemetria): corregir condiciones de carrera, reutilizacion Socket.io y saneamiento WGS84 en useTelemetry (H70) |
| CP-H70-PWA-06 | Manejo no bloqueante de permiso denegado (`PERMISSION_DENIED`) pasando a estado `SIN_PERMISO` | Resiliencia / UX | Unitaria | Alta | `getCurrentPosition` rechazando con `code: 1` (`PERMISSION_DENIED`) | Error mock `{ code: 1, message: 'User denied Geolocation' }` | Actualiza estado a `SIN_PERMISO`, registra mensaje no bloqueante y no lanza excepciones ni emite payload | Aprobado en `useTelemetry.test.ts` (`11/11` en `107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS |
| CP-H70-PWA-07 | Manejo no bloqueante de fallas satelitales (`POSITION_UNAVAILABLE` / `TIMEOUT`) y ausencia de Geolocation API | Resiliencia / Hardware | Unitaria | Media | `getCurrentPosition` fallando con `code: 2` y escenario `navigator.geolocation = undefined` | Error mock `{ code: 2, message: 'Position unavailable' }` y `geolocation: undefined` | Actualiza estado a `ERROR_GPS` con mensaje descriptivo sin interrumpir la aplicación | Aprobado en `useTelemetry.test.ts` (`11/11` en `107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | test(telemetria): agregar suite terrenoSocket y ampliar cobertura de casos de borde HU-70 |
| CP-H70-PWA-08 | Tolerancia a zona de sombra (socket desconectado) y retransmisión silenciosa inmediata al reconectar | Resiliencia / Offline | Unitaria | Alta | Socket mock inicializado con `connected: false` | Captura GPS offline seguida de `connected = true` y disparo de evento `connect` | Conserva `ultimaPosicion` sin errores ni alertas bloqueantes; al reconectar emite inmediatamente `telemetria:posicion` | Aprobado en `useTelemetry.test.ts` (`11/11` en `107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS |
| CP-H70-PWA-09 | Reintento manual mediante `reintentar()` sin recargar la página | Funcional / UX | Unitaria | Media | `useTelemetry` activo con `reintentar` expuesto | Invocación manual `result.current.reintentar()` | Ejecuta una nueva solicitud inmediata de `getCurrentPosition` | Aprobado en `useTelemetry.test.ts` (`11/11` en `107ms`) | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS |
| CP-H70-PWA-10 | Renderizado de `TelemetryStatusBadge` (`TRANSMITIENDO`, `SIN_PERMISO`, `ERROR_GPS`, `INACTIVO`) y `TelemetryWarningBanner` | UI / Componentes | Componentes | Media | Componentes montados en jsdom con props por estado | Estados `'INACTIVO'`, `'TRANSMITIENDO'`, `'SIN_PERMISO'`, `'ERROR_GPS'`, `mostrarInactivo` y `onRetry` | Oculta `INACTIVO` por defecto; muestra `GPS activo`, `GPS sin permiso`, `Sin señal GPS` y banner no bloqueante con botón `Reintentar` | `TelemetryStatusBadge.test.tsx` aprueba `8/8` casos en `368ms` | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | fix(ui): corregir ergonomia tactil de 48px, boton accesible ARIA y resguardo de rol cruzado en telemetria (H70) |
| CP-H70-PWA-11 | Integración en vista de Patrulla Verificadora (`PatrullaMisionDetailPage`): `GPS activo` en `EN_CURSO` y aviso no bloqueante sin permiso | Integración / UI | Componentes | Alta | `useAuth` con `PATRULLA_VERIFICADORA` activa y misión `EN_CURSO` | Escenario GPS permitido y escenario `PERMISSION_DENIED` sobre `PatrullaMisionDetailPage` | Muestra badge `GPS activo` al operar; ante permiso denegado muestra `Ubicación GPS no autorizada` manteniendo habilitados los formularios técnicos | `PatrullaDetailPage.test.tsx` aprueba `7/7` casos en `794ms` | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | test(telemetria): agregar suite terrenoSocket y ampliar cobertura de casos de borde HU-70 |
| CP-H70-PWA-12 | Integración en vista de Delegado de Cuadrilla (`CuadrillaMisionDetailPage`): `GPS activo` en `EN_CURSO` e inactivo en `FINALIZADA` | Integración / UI | Componentes | Alta | `useAuth` con `DELEGADO_CUADRILLA` activa y misiones `EN_CURSO` / `FINALIZADA` | Misión `INC-2026-0002` en estado `EN_CURSO` vs `FINALIZADA` | Despliega `GPS activo` y captura GPS en `EN_CURSO`; oculta badge cuando la misión está `FINALIZADA` | `CuadrillaDetailPage.test.tsx` aprueba `3/3` casos en `287ms` | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | feat(telemetria): integrar telemetría GPS en vistas de misión activa de patrulla y cuadrilla |
| CP-H70-PWA-13 | Compilación estricta TypeScript, análisis ESLint, build productiva Next.js y ausencia de emojis en `src/` | Estática / Build | Sistema | Alta | Rama `feature/H70-telemetria-gps-terreno` con todos los fixes aplicados | `npx tsc --noEmit`, `npm run lint`, `npm run build` y `rg` Unicode emojis | Exit code `0` en los 4 comandos, `0` errores TypeScript/ESLint y `0` emojis en `src/` | `tsc` exit `0`, `lint` `0 errors`, `build` exitoso (`2.9s`, `8/8` páginas) y `NO_EMOJIS_IN_SRC` | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | fix(ui): corregir ergonomia tactil de 48px, boton accesible ARIA y resguardo de rol cruzado en telemetria (H70) |
| CP-H70-PWA-14 | Manual de usuario operativo H70 (`docs/manuals/H70-telemetria-gps-terreno.md`) con permisos de hardware y modo offline | Documentación | Documentación | Baja | Archivo `docs/manuals/H70-telemetria-gps-terreno.md` presente en repositorio | Revisión estructural según `AGENTS.md §5` y `GEMINI.md §7` | Incluye pasos de permisos GPS (Android/iOS), contrato emitido, indicadores visuales, detención automática y comportamiento sin conexión | Estructura completa y verificada con cita literal homologada | APROBADO | 24/11/2026 23:44 | 24/11/2026 23:50 | docs(telemetria): alinear contratos WebSocket, arquitectura y manual H70 con implementacion final |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H70-PWA-01	Descarte de lecturas GPS asíncronas tardías al desactivar misión y prevención de fuga en navigator.permissions.query	Concurrencia / Unitaria	Unitaria	Alta	Hook useTelemetry activo con getCurrentPosition y permissions.query diferidos	Transición activa: true -> false antes de resolver GPS y unmount() antes de resolver permissions.query	Descarta callback GPS tardío sin emitir ni cambiar a TRANSMITIENDO; no registra listener en PermissionStatus tras desmontaje	useTelemetry.test.ts verifica ausencia de emisión tardía, permanencia en INACTIVO y 0 listeners registrados tras unmount (107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	fix(telemetria): corregir condiciones de carrera, reutilizacion Socket.io y saneamiento WGS84 en useTelemetry (H70)
BUG-H70-PWA-02	Reutilización única de instancia Socket.io compartida sin duplicación ni desconexión durante handshake o reconexión	Tiempo Real / Integración	Unitaria / Integración	Alta	terrenoSocket.ts y useTerrenoSocket.ts bajo mock de socket.io-client	Llamadas sucesivas a conectarSocketTerreno('jwt-patrulla-1') con connected: false, cambio de token y desconectarSocketTerreno selectivo	Invoca io() una sola vez para el mismo token aunque esté desconectado; reconecta solo al cambiar token; no borra instancia más reciente	terrenoSocket.test.ts (3/3, 14ms) y useTerrenoSocket.test.ts (3/3, 50ms) verifican singleton compartido y limpieza de salas	APROBADO	24/11/2026 23:44	24/11/2026 23:50	fix(telemetria): corregir condiciones de carrera, reutilizacion Socket.io y saneamiento WGS84 en useTelemetry (H70)
BUG-H70-PWA-03	Validación de rangos WGS84, saneamiento de rumbo/precision/velocidad, resguardo de intervaloMs y prevención de rol cruzado	Validación / Seguridad RBAC	Unitaria / Componentes	Alta	useTelemetry y vistas detalle de patrulla/cuadrilla con datos anómalos y roles cruzados	lat: 95.5, heading: 420, accuracy: -3, speed: -1, unidadId: '   ', intervaloMs: 0, operador patrulla en ruta cuadrilla	Rechaza coordenadas fuera de [-90,90]/[-180,180] (ERROR_GPS), sanea campos a null, usa 30000 ms y bloquea emisión en rol cruzado	useTelemetry.test.ts (11/11) y CuadrillaDetailPage.test.tsx (3/3) aprueban todas las aserciones de saneamiento y control de rol	APROBADO	24/11/2026 23:44	24/11/2026 23:50	fix(ui): corregir ergonomia tactil de 48px, boton accesible ARIA y resguardo de rol cruzado en telemetria (H70)
BUG-H70-PWA-04	Ergonomía táctil mínima 48px, botón nativo accesible en TelemetryStatusBadge y token --border-color-neutral	UI / Accesibilidad	Componentes	Media	TelemetryStatusBadge y TelemetryWarningBanner en estado SIN_PERMISO con onRetry	Renderizado en jsdom e inspección CSS de .retryButton, .clickable e .inactivo	Renderiza <button type="button"> accesible, min-height: var(--touch-target-min, 48px) en controles interactivos y uso de token neutral	TelemetryStatusBadge.test.tsx (8/8, 368ms) valida BUTTON con getByRole('button') y estilos alineados con tokens.css	APROBADO	24/11/2026 23:44	24/11/2026 23:50	fix(ui): corregir ergonomia tactil de 48px, boton accesible ARIA y resguardo de rol cruzado en telemetria (H70)
BUG-H70-PWA-05	Cobertura de pruebas automatizadas en terrenoSocket.test.ts, casos de borde de useTelemetry e integración en PatrullaDetailPage	Calidad / Regresión	Unitaria / Integración	Media	Suite Vitest completa del repositorio web-app	Ejecución de npm test y suites específicas HU-70 (6 archivos)	Cero módulos nuevos sin pruebas (AGENTS.md §4) y cobertura de permisos, offline, rol cruzado y vistas activas	32/32 archivos y 125/125 pruebas aprobadas (6.84s); subconjunto HU-70 6/6 archivos y 35/35 pruebas en verde	APROBADO	24/11/2026 23:44	24/11/2026 23:50	test(telemetria): agregar suite terrenoSocket y ampliar cobertura de casos de borde HU-70
BUG-H70-PWA-06	Alineación documental de contratos WebSocket, arquitectura de telemetría, matriz general y manual H70	Documentación	Documentación	Media	Archivos en docs/api/, docs/architecture/, docs/manuals/ y docs/qa/matrices/	Inspección cruzada de contratos-terreno.md, architecture.md, H70-telemetria-gps-terreno.md y matriz-pruebas-terreno.md	Payload unificado (precision, rumbo), frecuencia 30s, configuración Geolocation API y cita textual idéntica a TelemetryWarningBanner	Documentación técnica, matriz TC-17 y manual H70 100% homologados con la implementación real	APROBADO	24/11/2026 23:44	24/11/2026 23:50	docs(telemetria): alinear contratos WebSocket, arquitectura y manual H70 con implementacion final
CP-H70-PWA-01	Estado inicial INACTIVO sin captura GPS ni emisiones cuando la misión no está en curso (activa: false)	Funcional / Unitaria	Unitaria	Alta	useTelemetry inicializado con activa: false y unidadId: 'pat-001'	{ unidadId: 'pat-001', tipoUnidad: 'PATRULLA', activa: false }	Retorna estado: 'INACTIVO', transmitiendo: false, ultimaPosicion: null; 0 llamadas a GPS/socket	Aprobado en useTelemetry.test.ts (11/11 en 107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS
CP-H70-PWA-02	Bloqueo de captura cuando falta unidadId, es vacía o falta tipoUnidad aunque activa sea true	Validación / Unitaria	Unitaria	Alta	useTelemetry con activa: true y parámetros incompletos	{ unidadId: null | '   ', tipoUnidad: 'PATRULLA', activa: true }	Permanece en INACTIVO sin invocar navigator.geolocation.getCurrentPosition	Aprobado en useTelemetry.test.ts (11/11 en 107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	fix(telemetria): corregir condiciones de carrera, reutilizacion Socket.io y saneamiento WGS84 en useTelemetry (H70)
CP-H70-PWA-03	Activación automática y emisión de evento telemetria:posicion con contrato completo y opciones de batería	Funcional / Contrato	Unitaria	Alta	useTelemetry con activa: true, GPS simulado y socket conectado	lat: -39.8142, lng: -73.2459, heading: 180, accuracy: 5.5, speed: 12.3	Invoca getCurrentPosition con { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }; emite telemetria:posicion con contrato exacto y estado TRANSMITIENDO	Aprobado en useTelemetry.test.ts (11/11 en 107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS
CP-H70-PWA-04	Emisión periódica controlada cada 30 segundos en segundo plano mediante temporizador	Funcional / Eficiencia	Unitaria	Alta	useTelemetry activo con vi.useFakeTimers() y tipoUnidad: 'CUADRILLA'	Avance temporal simulado +30000 ms y +30000 ms (60s totales)	Emite al inicio (t=0s), a los 30s y a los 60s (3 emisiones exactas) sin sobrecarga de batería	Aprobado en useTelemetry.test.ts (11/11 en 107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS
CP-H70-PWA-05	Detención automática inmediata y limpieza de temporizador al finalizar, rechazar o cancelar la misión	Funcional / Ciclo de Vida	Unitaria	Alta	useTelemetry en estado TRANSMITIENDO	Cambio de prop activa: true -> false y avance de 60000 ms	Estado cambia a INACTIVO, se cancela setInterval y no se ejecutan nuevas capturas ni emisiones	Aprobado en useTelemetry.test.ts (11/11 en 107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	fix(telemetria): corregir condiciones de carrera, reutilizacion Socket.io y saneamiento WGS84 en useTelemetry (H70)
CP-H70-PWA-06	Manejo no bloqueante de permiso denegado (PERMISSION_DENIED) pasando a estado SIN_PERMISO	Resiliencia / UX	Unitaria	Alta	getCurrentPosition rechazando con code: 1 (PERMISSION_DENIED)	Error mock { code: 1, message: 'User denied Geolocation' }	Actualiza estado a SIN_PERMISO, registra mensaje no bloqueante y no lanza excepciones ni emite payload	Aprobado en useTelemetry.test.ts (11/11 en 107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS
CP-H70-PWA-07	Manejo no bloqueante de fallas satelitales (POSITION_UNAVAILABLE / TIMEOUT) y ausencia de Geolocation API	Resiliencia / Hardware	Unitaria	Media	getCurrentPosition fallando con code: 2 y escenario navigator.geolocation = undefined	Error mock { code: 2, message: 'Position unavailable' } y geolocation: undefined	Actualiza estado a ERROR_GPS con mensaje descriptivo sin interrumpir la aplicación	Aprobado en useTelemetry.test.ts (11/11 en 107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	test(telemetria): agregar suite terrenoSocket y ampliar cobertura de casos de borde HU-70
CP-H70-PWA-08	Tolerancia a zona de sombra (socket desconectado) y retransmisión silenciosa inmediata al reconectar	Resiliencia / Offline	Unitaria	Alta	Socket mock inicializado con connected: false	Captura GPS offline seguida de connected = true y disparo de evento connect	Conserva ultimaPosicion sin errores ni alertas bloqueantes; al reconectar emite inmediatamente telemetria:posicion	Aprobado en useTelemetry.test.ts (11/11 en 107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS
CP-H70-PWA-09	Reintento manual mediante reintentar() sin recargar la página	Funcional / UX	Unitaria	Media	useTelemetry activo con reintentar expuesto	Invocación manual result.current.reintentar()	Ejecuta una nueva solicitud inmediata de getCurrentPosition	Aprobado en useTelemetry.test.ts (11/11 en 107ms)	APROBADO	24/11/2026 23:44	24/11/2026 23:50	feat(telemetria): implementar hook useTelemetry con captura y emisión periódica GPS
CP-H70-PWA-10	Renderizado de TelemetryStatusBadge (TRANSMITIENDO, SIN_PERMISO, ERROR_GPS, INACTIVO) y TelemetryWarningBanner	UI / Componentes	Componentes	Media	Componentes montados en jsdom con props por estado	Estados 'INACTIVO', 'TRANSMITIENDO', 'SIN_PERMISO', 'ERROR_GPS', mostrarInactivo y onRetry	Oculta INACTIVO por defecto; muestra GPS activo, GPS sin permiso, Sin señal GPS y banner no bloqueante con botón Reintentar	TelemetryStatusBadge.test.tsx aprueba 8/8 casos en 368ms	APROBADO	24/11/2026 23:44	24/11/2026 23:50	fix(ui): corregir ergonomia tactil de 48px, boton accesible ARIA y resguardo de rol cruzado en telemetria (H70)
CP-H70-PWA-11	Integración en vista de Patrulla Verificadora (PatrullaMisionDetailPage): GPS activo en EN_CURSO y aviso no bloqueante sin permiso	Integración / UI	Componentes	Alta	useAuth con PATRULLA_VERIFICADORA activa y misión EN_CURSO	Escenario GPS permitido y escenario PERMISSION_DENIED sobre PatrullaMisionDetailPage	Muestra badge GPS activo al operar; ante permiso denegado muestra Ubicación GPS no autorizada manteniendo habilitados los formularios técnicos	PatrullaDetailPage.test.tsx aprueba 7/7 casos en 794ms	APROBADO	24/11/2026 23:44	24/11/2026 23:50	test(telemetria): agregar suite terrenoSocket y ampliar cobertura de casos de borde HU-70
CP-H70-PWA-12	Integración en vista de Delegado de Cuadrilla (CuadrillaMisionDetailPage): GPS activo en EN_CURSO e inactivo en FINALIZADA	Integración / UI	Componentes	Alta	useAuth con DELEGADO_CUADRILLA activa y misiones EN_CURSO / FINALIZADA	Misión INC-2026-0002 en estado EN_CURSO vs FINALIZADA	Despliega GPS activo y captura GPS en EN_CURSO; oculta badge cuando la misión está FINALIZADA	CuadrillaDetailPage.test.tsx aprueba 3/3 casos en 287ms	APROBADO	24/11/2026 23:44	24/11/2026 23:50	feat(telemetria): integrar telemetría GPS en vistas de misión activa de patrulla y cuadrilla
CP-H70-PWA-13	Compilación estricta TypeScript, análisis ESLint, build productiva Next.js y ausencia de emojis en src/	Estática / Build	Sistema	Alta	Rama feature/H70-telemetria-gps-terreno con todos los fixes aplicados	npx tsc --noEmit, npm run lint, npm run build y rg Unicode emojis	Exit code 0 en los 4 comandos, 0 errores TypeScript/ESLint y 0 emojis en src/	tsc exit 0, lint 0 errors, build exitoso (2.9s, 8/8 páginas) y NO_EMOJIS_IN_SRC	APROBADO	24/11/2026 23:44	24/11/2026 23:50	fix(ui): corregir ergonomia tactil de 48px, boton accesible ARIA y resguardo de rol cruzado en telemetria (H70)
CP-H70-PWA-14	Manual de usuario operativo H70 (docs/manuals/H70-telemetria-gps-terreno.md) con permisos de hardware y modo offline	Documentación	Documentación	Baja	Archivo docs/manuals/H70-telemetria-gps-terreno.md presente en repositorio	Revisión estructural según AGENTS.md §5 y GEMINI.md §7	Incluye pasos de permisos GPS (Android/iOS), contrato emitido, indicadores visuales, detención automática y comportamiento sin conexión	Estructura completa y verificada con cita literal homologada	APROBADO	24/11/2026 23:44	24/11/2026 23:50	docs(telemetria): alinear contratos WebSocket, arquitectura y manual H70 con implementacion final
```

---

## 5. Guía de Ejecución y Replicabilidad Paso a Paso (Re-Test Final)

Todos los comandos indicados a continuación fueron ejecutados desde la raíz del repositorio `web-app`.

### 5.1 Ejecución del subconjunto HU-70 y Socket.io (`24/11/2026 23:50`)

```bash
npx vitest run \
  src/lib/socket/__tests__/terrenoSocket.test.ts \
  src/hooks/__tests__/useTerrenoSocket.test.ts \
  src/hooks/__tests__/useTelemetry.test.ts \
  src/components/terreno/__tests__/TelemetryStatusBadge.test.tsx \
  "src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx" \
  "src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx"
```

Salida observada:

```text
 ✓ src/lib/socket/__tests__/terrenoSocket.test.ts (3 tests) 14ms
 ✓ src/hooks/__tests__/useTerrenoSocket.test.ts (3 tests) 50ms
 ✓ src/hooks/__tests__/useTelemetry.test.ts (11 tests) 107ms
 ✓ src/components/terreno/__tests__/TelemetryStatusBadge.test.tsx (8 tests) 368ms
 ✓ src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx (3 tests) 287ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx (7 tests) 794ms

 Test Files  6 passed (6)
      Tests  35 passed (35)
```

Ejecuciones filtradas por suite con `npm test -- -t`:

```bash
npm test -- -t "useTelemetry Hook"
npm test -- -t "terrenoSocket"
npm test -- -t "TelemetryStatusBadge"
```

### 5.2 Suite automatizada completa del repositorio

```bash
npm test
```

Salida observada:

```text
 Test Files  32 passed (32)
      Tests  125 passed (125)
   Start at  23:50:48
   Duration  6.84s (transform 2.93s, setup 7.99s, collect 11.94s, tests 7.38s, environment 45.83s, prepare 5.75s)
```

### 5.3 Verificación de tipos TypeScript, ESLint, Build de producción y escaneo de emojis

```bash
npx tsc --noEmit
npm run lint
npm run build
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS_IN_SRC"
```

Salidas observadas:
- `npx tsc --noEmit`: exit code `0` (`0` errores).
- `npm run lint`: exit code `0`, `0 errors` y `4 warnings` preexistentes en `@next/next/no-location-assign-relative-destination` (`src/app/(auth)/login/page.tsx:51`, `src/app/(terreno)/page.tsx:26`, `src/context/AuthContext.tsx:147`, `src/lib/api/client.ts:47`).
- `npm run build` (Next.js 16.3.4 Turbopack): exit code `0` (`✓ Compiled successfully in 2.9s`, `✓ Finished TypeScript in 6.5s`, `✓ Generating static pages using 11 workers (8/8) in 499ms`).
- Escaneo de emojis en `src/`: `NO_EMOJIS_IN_SRC`.

### 5.4 Verificación de integración en entorno local con `sgrai-api` (Referencia cURL / Socket.io)

*(En la sesión de auditoría del `24/11/2026`, la inspección de sockets locales mediante `ss -tlnp` confirmó ausencia de procesos escuchando en los puertos `3000`, `3001` y `3002`. Cuando `sgrai-api` `:3001` y `sgrai-pwa` `:3002` estén levantados detrás de Caddy HTTPS, ejecutar las verificaciones siguientes):*

```bash
# 1. Autenticación de Patrulla Verificadora para obtener JWT de handshake Socket.io
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"patrulla@valdivia.cl","password":"<PASSWORD_ENTORNO>"}'

# 2. Verificación de endpoint polling handshake de Socket.io en sgrai-api
curl -s -i "http://localhost:3001/socket.io/?EIO=4&transport=polling" | head -n 6
```

Payload contractual emitido por `useTelemetry` sobre el canal Socket.io `telemetria:posicion`:

```json
{
  "unidadId": "f1000000-0000-4000-8000-000000000050",
  "tipoUnidad": "PATRULLA",
  "lat": -39.8142,
  "lng": -73.2459,
  "timestamp": "2026-11-24T23:50:00.000Z",
  "rumbo": 180,
  "precision": 5.5,
  "velocidad": 12.3
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación / Subtarea (HU-70) | Responsabilidad Arquitectónica | Cobertura en `sgrai-pwa` | Estado tras Re-Test Final | Referencia |
|---|---|---|---|---|
| **CA-1:** Al aceptar o estar en misión `EN_CURSO`, solicitar permisos de geolocalización y activar captura GPS vía Geolocation API | `sgrai-pwa` | Activación automática en `PatrullaMisionDetailPage` y `CuadrillaMisionDetailPage` cuando `unidadActiva && esEnCurso` y rol coincidente; solicitud inicial inmediata + monitoreo `navigator.permissions` | Aprobado | `CP-H70-PWA-03`, `CP-H70-PWA-11`, `CP-H70-PWA-12`, `BUG-H70-PWA-03` |
| **CA-2:** Emitir periódicamente (cada 30 a 60s) evento WebSocket `telemetria:posicion` con `{ unidadId, tipoUnidad, lat, lng, timestamp }` (+ metadatos) | `sgrai-pwa` + `sgrai-api` | Sondeo controlado cada `30000 ms` con opciones de batería (`enableHighAccuracy: true`, `timeout: 10000`, `maximumAge: 30000`), saneamiento WGS84/campos opcionales y socket compartido JWT | Aprobado | `CP-H70-PWA-03`, `CP-H70-PWA-04`, `BUG-H70-PWA-02`, `BUG-H70-PWA-03` |
| **CA-3:** Retransmisión de posiciones hacia la sala `mapa` vía Socket.io y Redis | `sgrai-api` (`v0.11.0`) / `sgrai-web` | Fuera de lógica local de `sgrai-pwa`; contrato `TelemetriaPosicionPayload` y nombre de evento `telemetria:posicion` validados y documentados en `contratos-terreno.md` | Aprobado | `CP-H70-PWA-03`, `BUG-H70-PWA-06` |
| **CA-4:** Pausa y detención automática al finalizar misión o volver a estado `DISPONIBLE` | `sgrai-pwa` | Limpieza inmediata de `setInterval`, cancelación lógica de callbacks GPS en vuelo (`activoRef`/`solicitudSeqRef`) y limpieza de `ultimaPosicionRef` al pasar a `INACTIVO` | Aprobado | `CP-H70-PWA-01`, `CP-H70-PWA-05`, `CP-H70-PWA-12`, `BUG-H70-PWA-01` |
| **CA-5:** Tolerancia a pérdida de conectividad sin interrumpir operativa ni mostrar alertas bloqueantes | `sgrai-pwa` | Conservación de `ultimaPosicion` en zonas de sombra, retransmisión silenciosa en `connect`, reutilización de socket en reconexión y feedback visual no bloqueante (`TelemetryStatusBadge` / `TelemetryWarningBanner`) | Aprobado | `CP-H70-PWA-06`, `CP-H70-PWA-07`, `CP-H70-PWA-08`, `CP-H70-PWA-10`, `BUG-H70-PWA-02`, `BUG-H70-PWA-04` |
| **Estándares UI/UX, Pruebas y Documentación (`GEMINI.md` / `AGENTS.md`)** | `sgrai-pwa` | Flat UI `--radius-none: 0px`, `min-height: 48px`, botón nativo accesible, `0` emojis, `32/32` suites (`125` tests), `tsc`/`lint`/`build` en verde y manual H70 completo | Aprobado | `CP-H70-PWA-13`, `CP-H70-PWA-14`, `BUG-H70-PWA-04`, `BUG-H70-PWA-05`, `BUG-H70-PWA-06` |

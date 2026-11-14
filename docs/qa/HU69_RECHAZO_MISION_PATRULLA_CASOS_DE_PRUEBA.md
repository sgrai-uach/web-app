# Auditoría Técnica y Matriz de Casos de Prueba — HU-[69]: Rechazo Motivado de Misión por Patrulla Verificadora (`sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `feature/H69-rechazo-mision-patrulla`  
**Historia de Usuario:** HU-[69] — Rechazo motivado de asignación de misión de verificación en terreno  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `12/11/2026 12:22 -03:00`  
**Fecha y Hora de Ciclo Re-Test Final:** `13/11/2026 22:28 -03:00`  
**Entorno de Ejecución Re-Test:** Linux, Node.js, Vitest v3.2.7, Next.js 16.3.4 (Turbopack), ESLint 9, TypeScript (`tsc --noEmit`), Zod v4.5.4  
**Dictamen de Auditoría Final:** **APROBADO PARA INTEGRACIÓN EN `develop` (`6` de `6` defectos corregidos en ciclo de Re-Test; `20` de `20` casos en estado `APROBADO`)**

---

## Alcance Arquitectónico en `sgrai-pwa`

De acuerdo con la separación de responsabilidades del sistema SGRAI (`AGENTS.md §1`), la persistencia transaccional en PostgreSQL (`mision.estado = 'RECHAZADA'`, `justificacion_rechazo`, `patrulla.estado = 'DISPONIBLE'`, `incidente.estado = 'REPORTADO'`, registro en `mision_hito`) y la emisión WebSocket del evento `mision:rechazada` hacia la sala `encargado` corresponden al backend `sgrai-api`.

En el cliente móvil de terreno `sgrai-pwa` (restringido a los roles `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA`), la implementación verificada cubre:

- Visibilidad y control de acceso del botón **"Rechazar Misión"** en el detalle de misión de patrulla (`/patrulla/misiones/[id]`) y navegación sin doble prefijo desde la alerta de nueva asignación (`NuevaMisionBanner`).
- Despliegue obligatorio del modal `RechazoMisionModal` con validación en tiempo real (`justificacion_rechazo` $\ge 5$ caracteres tras `trim()`, Regla Crítica §3.3), captura no bloqueante de coordenadas GPS y cumplimiento de diseño plano institucional (Noto Sans, esquinas rectas `0px`, altura táctil mínima de `48px`, iconografía exclusiva `lucide-react` sin emojis).
- Validación estricta con esquema Zod (`rechazoMisionSchema` compatible con Zod v4) y consumo tipado del endpoint `POST /api/misiones/{id}/rechazar` mediante `openapi-fetch` y tipos OpenAPI generados (`src/types/api-generated.d.ts`), tipando excepciones con `MisionServiceError`.
- Operación Offline-First mediante cola `outbox` (`RECHAZAR_MISION`) en IndexedDB (`idb`) con marcado `sincronizacionPendiente: true`, actualización inmediata del contador en `ConnectionStatusBadge`, manejo seguro de conflictos HTTP `409`/`422` y sincronización automática al restablecer conectividad (`useConnectivity`).
- Aislamiento estricto multi-unidad (`patrullaId`) sin inyección de datos ficticios al quedar vacía la bandeja y documentación completa del contrato operacional en `docs/api/contratos-terreno.md` y manual de usuario en `docs/manuals/H69-rechazo-mision-patrulla.md`.

---

## 1. Resumen Ejecutivo

Tras el ciclo de **Re-Test** ejecutado el `13/11/2026 22:28 -03:00`, se comprobó la subsanación total de los **6 defectos** identificados en la auditoría inicial (`BUG-H69-PWA-01` Crítico, `BUG-H69-PWA-02`, `BUG-H69-PWA-03`, `BUG-H69-PWA-04` y `BUG-H69-PWA-05` Altos, y `BUG-H69-PWA-06` Medio).

La verificación de tipos estáticos (`npx tsc --noEmit`) finalizó con `0` errores (exit code `0`), el build productivo de Next.js (`npm run build`) compiló exitosamente generando las `8` rutas estáticas y dinámicas, ESLint concluyó sin errores (`0 errors`, `4 warnings` preexistentes de navegación interna) y la suite completa de pruebas unitarias e integración en Vitest alcanzó **`133` pruebas aprobadas en `33` archivos** (`100%` de aprobación).

| Indicador / Verificación | Auditoría Inicial (12/11/2026) | Re-Test Final (13/11/2026) | Observación Técnica |
|---|---|---|---|
| Total de casos en matriz (HU-69 PWA) | `20` casos | `20` casos | `6` defectos `CORREGIDO` + `14` casos `APROBADO` (`0` abiertos) |
| Defectos abiertos por severidad | `1` Crítico, `4` Altos, `1` Medio | `0` Crítico, `0` Altos, `0` Medio | Todos los defectos subsanados y verificados en código y pruebas |
| Suite automatizada completa (`npm test -- --run`) | `33` archivos / `126` tests (`6.92s`) | `33` archivos / `133` tests (`9.95s`) | Incorpora cobertura para `client.ts`, `NuevaMisionBanner`, `useConnectivity` y RBAC |
| Subconjunto dirigido H69 (`npx vitest run` 4 archivos) | `4` archivos / `35` tests (`1.94s`) | `4` archivos / `38` tests (`5.39s`) | `misiones.test.ts` (`5`), `RechazoMisionModal.test.tsx` (`9`), `misionesService.test.ts` (`14`), `PatrullaDetailPage.test.tsx` (`10`) |
| Ejecución filtrada H69 (`npm test -- -t "H69 — Rechazo Motivado de Misión"`) | **FALLIDO** (`4` fallidos / `9` aprobados) | **APROBADO** (`15` aprobados / `0` fallidos) | Corregido mock de `useConnectivity` en `beforeEach` |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `4` advertencias | `0` errores, `4` advertencias | Advertencias preexistentes `@next/next/no-location-assign-relative-destination` |
| Verificación de tipos (`npx tsc --noEmit`) | **FALLIDO** (exit `2`, `6` errores) | **APROBADO** (`0` errores, exit `0`) | Compatibilidad Zod v4, tipado ReactNode y mocks `AuthContextValue` |
| Build de producción (`npm run build`) | **FALLIDO** (exit `1`, `Failed to type check`) | **APROBADO** (`exit 0`, `8/8` rutas) | Next.js 16.3.4 (Turbopack) compiló exitosamente |
| Verificación estática de emojis en `src/` | **APROBADO** (`NO_EMOJIS_IN_SRC`) | **APROBADO** (`NO_EMOJIS_IN_SRC`) | Uso exclusivo de iconografía `lucide-react` |
| Documentación de contratos en `docs/api/` | Incompleta (solo resumen en tabla) | Completa (`docs/api/contratos-terreno.md §2.2`) | Detalla endpoint, payloads, respuestas, errores y WebSocket |

---

## 2. Registro Técnico de Defectos y Verificación de Solución (Re-Test)

### BUG-H69-PWA-01 — Fallo de compilación TypeScript, fallo de build de producción y ruptura de pruebas filtradas de H69
- **Severidad:** Crítica (Bloqueante de build, CI/CD y despliegue)
- **Estado:** **CORREGIDO (Verificado en Re-Test — 13/11/2026)**
- **Archivos corregidos:**
  - `src/lib/validations/misiones.ts` (líneas 10–12)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (línea 296)
  - `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx` (líneas 40–70, 312–348, 415–445)
  - `src/app/(terreno)/patrulla/misiones/__tests__/PatrullaMisionesPage.test.tsx` (líneas 70–98)
- **Verificación:**
  - `src/lib/validations/misiones.ts` migró la definición del mensaje obligatorio a `{ error: 'La justificación de rechazo es obligatoria.' }`, resolviendo la incompatibilidad con Zod v4.
  - `PatrullaDetailPage.tsx` evalúa de forma segura `{Boolean(mision.datosAdicionales?.justificacionRechazo) && (...)}`, eliminando el error `TS2322`.
  - Los mocks de `useAuth` en `PatrullaDetailPage.test.tsx` y `PatrullaMisionesPage.test.tsx` incorporan `tieneUnidadAsignada: true` y `estadoAsignacion: 'ACTIVA' | 'DESACTIVADA'`, resolviendo `TS2345`.
  - Se configuró el mock de `useConnectivity` en el `beforeEach` del bloque H69 en `PatrullaDetailPage.test.tsx`, logrando que la ejecución filtrada `npm test -- -t "H69 — Rechazo Motivado de Misión"` apruebe de forma autónoma.
  - `npx tsc --noEmit` y `npm run build` finalizan con exit code `0`.

---

### BUG-H69-PWA-02 — Ausencia de validación RBAC en botón `"Rechazar Misión"` (CA-5) e inconsistencia en `rechazarMision`
- **Severidad:** Alta (Seguridad / RBAC — CA-5)
- **Estado:** **CORREGIDO (Verificado en Re-Test — 13/11/2026)**
- **Archivos corregidos:**
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 172–196)
  - `src/services/misionesService.ts` (líneas 319–338)
  - `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx` (líneas 370–395)
- **Verificación:**
  - `esRechazable` en `PatrullaDetailPage.tsx` exige estrictamente `unidadActiva && esPatrulla && tienePermisoVerificar && (estadoNormalizado === 'DESPACHADA' || estadoNormalizado === 'ASIGNADA' || estadoNormalizado === 'PENDIENTE')`.
  - Se agregó una prueba unitaria específica en `PatrullaDetailPage.test.tsx` comprobando que el botón `"Rechazar Misión"` permanece oculto si el operador carece del permiso `misiones:terreno:verificar`.
  - En `misionesService.ts`, `rechazarMision` eliminó la cabecera forzada `header: { authorization: '' }`, permitiendo que el interceptor de `apiClient` inyecte el JWT o cabecera demo automáticamente.
  - Las respuestas HTTP `400`, `401`, `403`, `404` y `409` son tipadas con la clase `MisionServiceError(status, errorMsg)`.

---

### BUG-H69-PWA-03 — Navegación 404 por doble prefijo `/terreno/terreno/` desde `NuevaMisionBanner` (CA-1)
- **Severidad:** Alta (Funcional / Navegación — CA-1)
- **Estado:** **CORREGIDO (Verificado en Re-Test — 13/11/2026)**
- **Archivos corregidos:**
  - `src/components/misiones/NuevaMisionBanner.tsx` (línea 26)
  - `src/app/(terreno)/patrulla/misiones/page.tsx` (línea 153)
  - `src/app/(terreno)/page.tsx` (líneas 68–71)
  - `src/components/misiones/__tests__/NuevaMisionBanner.test.tsx` (líneas 36–58)
- **Verificación:**
  - `NuevaMisionBanner.tsx` resuelve `destino` de forma relativa a `basePath`: `urlDetalle || (misionId ? `/patrulla/misiones/${misionId}` : undefined)`.
  - `PatrullaMisionesPage.tsx` y `TerrenoHomePage` (`page.tsx`) envían rutas relativas (`/patrulla/misiones/${id}` y `/cuadrilla/misiones/${id}`), evitando la duplicación del prefijo `/terreno/`.
  - Las pruebas unitarias de `NuevaMisionBanner.test.tsx` verifican la navegación hacia `/patrulla/misiones/mis-42` y contemplan tanto la presencia como la ausencia de `urlDetalle`.

---

### BUG-H69-PWA-04 — Desincronización de `ConnectionStatusBadge`, omisión de `sincronizacionPendiente`, captura offline en WebKit y manejo de conflictos en `outbox`
- **Severidad:** Alta (Offline-First / Resiliencia)
- **Estado:** **CORREGIDO (Verificado en Re-Test — 13/11/2026)**
- **Archivos corregidos:**
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 197–232)
  - `src/services/misionesService.ts` (líneas 340–385)
  - `src/hooks/useConnectivity.ts` (líneas 60–135)
  - `src/hooks/__tests__/useConnectivity.test.ts` (líneas 50–98)
- **Verificación:**
  - `handleConfirmarRechazo` en `PatrullaDetailPage.tsx` invoca `await actualizarPendientes()` inmediatamente tras registrar el rechazo (online u offline) y despacha el evento global `sgrai:mision_actualizada`, reflejando el incremento del badge al instante.
  - `rechazarMision` marca `sincronizacionPendiente: true` en IndexedDB en modo offline y ante fallas de transporte, y `sincronizacionPendiente: false` al recibir `200 OK`.
  - El bloque `catch` de `rechazarMision` captura cualquier excepción de red o transporte (incluyendo `TypeError: Load failed` de WebKit/Safari y `AbortError`) tras descartar `MisionServiceError`.
  - `useConnectivity.ts` procesa `RECHAZAR_MISION` en el drenado de la cola `outbox`, limpiando `sincronizacionPendiente: false` y manejando respuestas `409`/`422` sin corruptelas locales.
  - La suite `useConnectivity.test.ts` incorpora prueba automatizada verificando la sincronización de `RECHAZAR_MISION` en cola outbox.

---

### BUG-H69-PWA-05 — Regresión post-merge de aislamiento multi-patrulla e inyección de misiones ficticias
- **Severidad:** Alta (Integridad de Datos / Concurrencia)
- **Estado:** **CORREGIDO (Verificado en Re-Test — 13/11/2026)**
- **Archivos corregidos:**
  - `src/app/(terreno)/patrulla/misiones/page.tsx` (líneas 42–60)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 60–72, 121–155)
  - `src/components/terreno/TerrenoMisionesPendientes.tsx` (líneas 26–38)
  - `src/components/terreno/TerrenoResumenOperativo.tsx` (líneas 30–42)
  - `src/services/misionesService.ts` (líneas 180–186)
  - `src/services/offlineQueue.ts`, `src/context/AuthContext.tsx`, `src/app/(terreno)/layout.tsx`, `src/hooks/useTerrenoSocket.ts`
- **Verificación:**
  - Se eliminaron por completo las inyecciones de misiones hardcodeadas (`60000000-...0001` y datos de ejemplo) en `PatrullaMisionesPage.tsx` y `PatrullaDetailPage.tsx`.
  - Cuando `obtenerDetalleMision` retorna `null` (misión inexistente o ajena), `PatrullaDetailPage.tsx` renderiza un estado limpio de `"Misión no encontrada"` con botón de retorno, sin controles de aceptación ni rechazo.
  - `sincronizarMisiones` en `PatrullaMisionesPage.tsx` y componentes del hub filtra estrictamente por `patrullaId: usuario?.unidadId`.
  - Se restauraron `limpiarMisionesLocales()` en sincronización, `limpiarAlmacenamientoOffline()` en logout/inhabilitación, y el hook reactivo `useTerrenoSocket()` en `TerrenoLayout`.

---

### BUG-H69-PWA-06 — Configuración de `client.ts` Socket.io sin `auth.token` y falta de especificación detallada en `docs/api/`
- **Severidad:** Media (Tiempo Real / Documentación)
- **Estado:** **CORREGIDO (Verificado en Re-Test — 13/11/2026)**
- **Archivos corregidos / actualizados:**
  - `src/lib/socket/client.ts` (líneas 4–26)
  - `src/lib/socket/__tests__/client.test.ts` (líneas 38–47)
  - `docs/api/contratos-terreno.md` (líneas 143–204)
- **Verificación:**
  - `src/lib/socket/client.ts` resuelve `window.location.origin` antes del fallback a `localhost:4001` e inyecta `{ auth: { token } }` extrayendo la cookie mediante `getAuthCookie()`.
  - `client.test.ts` valida que `getSocket()` suministra `auth: { token: 'jwt-token-cookie' }` en el handshake.
  - `docs/api/contratos-terreno.md` incorpora la subsección **2.2 Rechazo Motivado de Misión por Patrulla Verificadora (H41, H69)** detallando método `POST`, ruta `/api/misiones/{id}/rechazar`, permisos RBAC, request body con Regla Crítica §3.3 ($\ge 5$ caracteres), response exitosa `200 OK`, códigos de error `400`, `401`, `403`, `404`, `409`, evento Socket.io `mision:rechazada` hacia la sala `encargado` y especificación del comportamiento Offline-First.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-H69-PWA-01 | Compilación estricta TypeScript (`tsc --noEmit`), build Next.js y ejecución filtrada de suite H69 | Estática / Compilación / Unitaria | Sistema / Integración | Crítica | Rama `feature/H69-rechazo-mision-patrulla` con fixes aplicados | Comandos `npx tsc --noEmit`, `npm run build` y `npm test -- -t "H69 — Rechazo Motivado de Misión"` | `tsc` y `next build` finalizan con exit `0`; las pruebas H69 en `PatrullaDetailPage.test.tsx` pasan de forma aislada sin depender de otro `describe` | `npx tsc --noEmit` finaliza con exit `0` (`0` errores); `npm run build` genera `8/8` rutas estáticas con exit `0`; ejecución filtrada aprueba `15/15` tests | CORREGIDO | 12/11/2026 12:18 | 13/11/2026 22:28 | fix(patrulla): implementar validacion RBAC, tipar errores MisionServiceError y refrescar badge (H69) |
| BUG-H69-PWA-02 | Control RBAC en botón `"Rechazar Misión"` (CA-5) y tipado de errores HTTP con `MisionServiceError` | Seguridad / RBAC | Integración / Componentes | Alta | Usuario autenticado sin permiso `misiones:terreno:verificar` o con rol ajeno accediendo a `/patrulla/misiones/[id]` | Sesión con `permisos: []` o rol `DELEGADO_CUADRILLA` y misión `DESPACHADA`; invocación de `rechazarMision` | El botón `"Rechazar Misión"` permanece oculto sin `esPatrulla && tienePermisoVerificar`; `rechazarMision` usa JWT del cliente y arroja `MisionServiceError` con statusCode | `esRechazable` exige rol patrulla y permiso; prueba unitaria verifica botón ausente sin permiso (`PatrullaDetailPage.test.tsx`); errores HTTP tipados con `MisionServiceError` | CORREGIDO | 12/11/2026 12:19 | 13/11/2026 22:28 | fix(patrulla): implementar validacion RBAC, tipar errores MisionServiceError y refrescar badge (H69) |
| BUG-H69-PWA-03 | Navegación directa desde alerta en tiempo real (`NuevaMisionBanner`) hacia detalle de misión con `"Rechazar Misión"` (CA-1) | Funcional / Navegación | Integración / Componentes | Alta | `next.config.ts` configurado con `basePath: "/terreno"` y evento `mision:asignada` recibido | `misionId: "mis-42"`, navegación mediante `router.push(...)` desde `NuevaMisionBanner` | `router.push` recibe ruta relativa `/patrulla/misiones/mis-42` para que Next.js resuelva a `/terreno/patrulla/misiones/mis-42` sin duplicación de ruta | `NuevaMisionBanner.tsx`, `PatrullaMisionesPage.tsx` y `TerrenoHomePage` usan rutas relativas `/patrulla/misiones/...`; suite `NuevaMisionBanner.test.tsx` aprueba `4/4` tests | CORREGIDO | 12/11/2026 12:20 | 13/11/2026 22:28 | fix(navigation): resolver rutas relativas a basePath para evitar 404 en alertas de terreno (H35, H69) |
| BUG-H69-PWA-04 | Sincronización de `ConnectionStatusBadge`, bandera `sincronizacionPendiente`, captura de red en WebKit y manejo de conflicto `409`/`422` en `outbox` | Offline-First / Resiliencia | Integración / Hook | Alta | Patrulla offline o con corte de red ejecutando rechazo motivado y posterior reconexión | `navigator.onLine = false` o `TypeError("Load failed")`; mutación `RECHAZAR_MISION` procesada en `useConnectivity` | `ConnectionStatusBadge` incrementa pendientes de inmediato; `MisionLocal` marca `sincronizacionPendiente: true`; WebKit encola en `outbox`; `409`/`422` limpia la cola sin corruptelas | `handleConfirmarRechazo` invoca `actualizarPendientes()`; `rechazarMision` marca `sincronizacionPendiente: true`; `useConnectivity.ts` procesa `RECHAZAR_MISION` y aprueba en `useConnectivity.test.ts` | CORREGIDO | 12/11/2026 12:19 | 13/11/2026 22:28 | fix(offline): persistir sincronizacionPendiente y resolver mutaciones RECHAZAR_MISION en outbox (H69) |
| BUG-H69-PWA-05 | Aislamiento multi-patrulla, ausencia de datos ficticios post-rechazo y preservación de ciclo de vida de sesión | Integridad de Datos / Concurrencia | Integración / Servicios | Alta | Patrulla rechaza su única misión activa (`locales.length === 0`) o consulta ID inexistente/ajeno | `sincronizarMisiones` con `patrullaId`, consulta a misión inexistente retornando `null` | Bandeja muestra estado vacío institucional; detalle inexistente muestra `"Misión no encontrada"`; IndexedDB purga misiones al cerrar sesión y `useTerrenoSocket` activo | Eliminadas misiones ficticias; `PatrullaDetailPage.tsx` muestra tarjeta de no encontrada; restaurados `limpiarMisionesLocales()`, `limpiarAlmacenamientoOffline()` y `useTerrenoSocket()` | CORREGIDO | 12/11/2026 12:20 | 13/11/2026 22:28 | fix(terreno): eliminar misiones ficticias, aislar por unidad y restaurar sincronizacion reactiva (H69, H85) |
| BUG-H69-PWA-06 | Handshake JWT en cliente Socket.io (`client.ts`) y documentación detallada del contrato `POST /api/misiones/{id}/rechazar` | Tiempo Real / Documentación | Integración / Documentación | Media | Variables de entorno de WebSocket vacías; revisión de especificación en `docs/api/` | Inspección de `src/lib/socket/client.ts` y lectura de `docs/api/contratos-terreno.md §2.2` | `getSocket()` resuelve origen de ventana y envía `{ auth: { token } }`; `contratos-terreno.md` detalla endpoint, payload, respuestas y evento `mision:rechazada` | `client.ts` incorpora `getAuthCookie()` en handshake y origen dinámico (`client.test.ts` aprueba `3/3`); `docs/api/contratos-terreno.md §2.2` documentado completamente | CORREGIDO | 12/11/2026 12:20 | 13/11/2026 22:28 | fix(realtime): incorporar auth token y resolver origen en socket client (H69) |
| CP-H69-PWA-01 | Validación Zod de `justificacion_rechazo` vacía o solo espacios en blanco (Regla Crítica §3.3) | Funcional / Validación | Unitaria | Crítica | Esquema `rechazoMisionSchema` importado desde `src/lib/validations/misiones.ts` | `{ justificacion_rechazo: "" }` y `{ justificacion_rechazo: "   ab  " }` | `safeParse` retorna `success: false` con mensaje `"La justificación de rechazo debe contener al menos 5 caracteres."` | `misiones.test.ts` verifica rechazo de cadena vacía y `'   ab  '` tras `trim()` con `5/5` pruebas aprobadas | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | feat(api): agregar contrato y validacion zod para rechazo motivado de mision |
| CP-H69-PWA-02 | Validación límite inferior exacto: `4` caracteres inválidos vs `5` caracteres válidos en `rechazoMisionSchema` | Funcional / Valores Límite | Unitaria | Crítica | Esquema `rechazoMisionSchema` y servicio `rechazarMision` | `{ justificacion_rechazo: "1234" }` vs `{ justificacion_rechazo: "Falla" }` | `4` caracteres rechazados (`success: false`); `5` caracteres aceptados (`success: true`) con coordenadas GPS opcionales | `misiones.test.ts` aprueba casos límite; `rechazarMision` valida localmente antes de invocar red o IndexedDB | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | feat(api): agregar contrato y validacion zod para rechazo motivado de mision |
| CP-H69-PWA-03 | Despliegue obligatorio de `RechazoMisionModal` con título, código de misión, contador en tiempo real y botón inicialmente deshabilitado | UI / UX / Funcional | Componentes | Alta | `RechazoMisionModal` renderizado con `abierto={true}` y `codigoMision="INC-2026-0042"` | Prop `abierto={false}` vs `abierto={true}`; texto `""`, `"   abc  "` (`3/5`) y `"Falla"` (`5/5`) | Oculto si `abierto=false`; visible con `role="dialog"`, contador `0 / 5 caracteres mín.` y botón `"Confirmar Rechazo"` deshabilitado hasta alcanzar $\ge 5$ caracteres | `RechazoMisionModal.test.tsx` valida render condicional, contador dinámico tras `trim()` y activación exacta al llegar a `5` caracteres | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69) |
| CP-H69-PWA-04 | Retroalimentación visual de error al perder el foco (`onBlur`) con justificación insuficiente | UI / Accesibilidad | Componentes | Media | Modal `RechazoMisionModal` abierto en pantalla | Ingresar `"No"` y disparar evento `blur` en `<textarea id="justificacion-rechazo-input">` | Muestra alerta `role="alert"` con `"La justificación debe contener al menos 5 caracteres."` y `aria-invalid="true"` | `RechazoMisionModal.test.tsx` verifica despliegue del mensaje accesible al perder foco | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69) |
| CP-H69-PWA-05 | Captura transparente y no bloqueante de coordenadas GPS al confirmar rechazo en `RechazoMisionModal` | Hardware / Geolocation | Componentes | Media | Navegador con `navigator.geolocation.getCurrentPosition` activo o denegado | `coords: { latitude: -39.8142, longitude: -73.2458 }`; motivo `"Desperfecto mecánico en vehículo"` | Invoca `alConfirmar` con texto trimmed y `{ lat: -39.8142, lng: -73.2458 }`; si no hay GPS permite enviar sin bloquear | `RechazoMisionModal.test.tsx` confirma envío de texto y coordenadas GPS mockeadas | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69) |
| CP-H69-PWA-06 | Manejo de error HTTP desde API dentro del modal y cierre con botón `"Cancelar"` o tecla `Escape` | Funcional / Manejo de Errores | Componentes | Alta | Modal abierto con promesa `alConfirmar` rechazada o interacción de cancelación | `mockRejectedValueOnce(new Error("La misión ya se encuentra en curso."))`; evento `keydown` `Escape` | Despliega caja `role="alert"` con el mensaje del servidor sin cerrar el modal; `Cancelar` o `Escape` ejecutan `alCancelar` | `RechazoMisionModal.test.tsx` verifica `9/9` aserciones aprobadas (`908ms`) | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69) |
| CP-H69-PWA-07 | Invocación online a `POST /api/misiones/{id}/rechazar` y actualización local a `RECHAZADA` en `misionesService` | Integración / API Client | Servicios | Crítica | `navigator.onLine = true` y respuesta simulada `200 OK` acorde al contrato OpenAPI | `id: "mis-001"`, `body: { justificacion_rechazo: "Desperfecto mecánico en vehículo", latitud: -39.8142, longitud: -73.2458 }` | Llama `apiClient.POST('/api/misiones/{id}/rechazar')`, actualiza IndexedDB (`estado: 'RECHAZADA'`) y retorna `exito: true` | `misionesService.test.ts` verifica ruta OpenAPI, payload, ausencia de cabecera vacía y persistencia en IndexedDB | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | feat(misiones): implementar servicio de rechazo con soporte offline y outbox en misionesService |
| CP-H69-PWA-08 | Rechazo de propagación ante respuesta de error `409 Conflict` / `400 Bad Request` en `rechazarMision` online | Negativa / Concurrencia | Servicios | Alta | `navigator.onLine = true` y misión en estado `EN_CURSO` en servidor | `response: { ok: false, status: 409 }`, `error: { message: "La misión no se encuentra en estado DESPACHADA." }` | Lanza `MisionServiceError` con `statusCode: 409` sin encolar en `outbox` ni sobreescribir el estado local | `misionesService.test.ts` verifica captura de `MisionServiceError` con código HTTP 409 | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | fix(patrulla): implementar validacion RBAC, tipar errores MisionServiceError y refrescar badge (H69) |
| CP-H69-PWA-09 | Encolamiento offline (`RECHAZAR_MISION`) en IndexedDB `outbox` cuando `navigator.onLine === false` | Offline-First / Persistencia | Servicios | Alta | Dispositivo sin conectividad (`navigator.onLine = false`) y misión local en IndexedDB | `id: "mis-001"`, `justificacion_rechazo: "Corte de ruta total por derrumbe"` | Encola `{ tipo: 'RECHAZAR_MISION', url: '/api/misiones/mis-001/rechazar', metodo: 'POST' }`, actualiza local a `RECHAZADA` con `sincronizacionPendiente: true` | `misionesService.test.ts` verifica `encolarAccionOutbox` y persistencia con `sincronizacionPendiente: true` | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | fix(offline): persistir sincronizacionPendiente y resolver mutaciones RECHAZAR_MISION en outbox (H69) |
| CP-H69-PWA-10 | Integración visual en `PatrullaMisionDetailPage`: recuadro `"Acciones de Despacho"`, flujo completo de rechazo, modo solo lectura y banner post-rechazo | Funcional / E2E Simulado | Componentes | Alta | `PatrullaDetailPage` montada con misión `DESPACHADA`, unidad inactiva o misión `RECHAZADA` | Misión `mis-desp-1` (`INC-2026-00100`), motivo `"Desperfecto mecánico en radiador"` | Muestra botón `"Rechazar Misión"`, oculta controles si `unidadActiva=false` o sin permiso, muestra banner `"Misión Rechazada por Patrulla Verificadora"` con motivo | `PatrullaDetailPage.test.tsx` aprueba `10/10` pruebas (`921ms`) incluyendo control RBAC y tarjeta de no encontrada | APROBADO | 12/11/2026 12:21 | 13/11/2026 22:28 | refactor(terreno): unificar tarjeta de acciones de despacho y sintetizar textos operativos |
| CP-H69-PWA-11 | Suscripción WebSocket en tiempo real (`useMisionesSocket`) a sala patrulla:`{id}`, eventos `mision:asignada` / `mision:rechazada` y vibración háptica | Tiempo Real / Hardware | Integración / Hook | Media | Usuario patrulla con `unidadId: "pat-100"` y cliente Socket.io mockeado | Evento `mision:asignada` para `pat-100` vs `pat-OTRA-999`; desmontaje del hook | Se une a `patrulla:pat-100`, filtra unidades ajenas, activa `navigator.vibrate([200, 100, 200])`, escucha `mision:rechazada` y abandona sala al desmontar | `useMisionesSocket.test.ts` aprueba `4/4` pruebas unitarias | APROBADO | 12/11/2026 12:18 | 13/11/2026 22:28 | feat(realtime): implementar cliente socket.io y hook useMisionesSocket para terreno (H35) |
| CP-H69-PWA-12 | Cumplimiento de diseño plano institucional (Flat UI, esquinas rectas `0px`, mínimo táctil `48px`, Noto Sans, `lucide-react` y cero emojis) | UI / Estándar Visual | Estática / CSS | Media | Código fuente en `src/` incluyendo `RechazoMisionModal.module.css`, `PatrullaDetailPage.module.css` y `Button.module.css` | Búsqueda regex de emojis en `src/` y revisión de tokens CSS | `0` emojis en `src/`; `border-radius: 0`; `box-shadow: none`; `min-height: 48px` en `.md` / `54px` en `.lg`; textos sin jerga interna (§3.3) | `NO_EMOJIS_IN_SRC`; CSS de modal y detalle cumple esquinas rectas, diseño plano y objetivos táctiles $\ge 48$px | APROBADO | 12/11/2026 12:19 | 13/11/2026 22:28 | fix(ui): eliminar referencias a secciones internas (§3.3, §3.7) en textos dirigidos al usuario |
| CP-H69-PWA-13 | Análisis estático ESLint sobre la base de código completa | Estática / Calidad | Sistema | Media | Proyecto en rama `feature/H69-rechazo-mision-patrulla` | Comando `npm run lint` | Finaliza con exit code `0` y `0` errores de ESLint | `npm run lint` termina con exit `0`, `0 errors` y `4` advertencias preexistentes (`no-location-assign-relative-destination`) | APROBADO | 12/11/2026 12:18 | 13/11/2026 22:28 | refactor(terreno): unificar tarjeta de acciones de despacho y sintetizar textos operativos |
| CP-H69-PWA-14 | Manual de usuario operativo H69 con secciones obligatorias de modo sin conexión y permisos GPS (`AGENTS.md §5`) | Documentación | Documental | Media | Archivo `docs/manuals/H69-rechazo-mision-patrulla.md` | Revisión estructural frente a `AGENTS.md §5` y `RechazoMisionModal.tsx` | Contiene propósito, pasos con textos reales de UI, sección **Comportamiento sin Conexión** y permisos de hardware GPS | Manual completo de `87` líneas con secciones de permisos GPS, pasos de UI y arquitectura Offline-First | APROBADO | 12/11/2026 12:18 | 13/11/2026 22:28 | docs(manuals): agregar manual de usuario para rechazo motivado de patrulla verificadora (H69) |

---

## 4. Bloque TSV Consolidado (Listo para Copiar y Pegar en Google Sheets)

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H69-PWA-01	Compilación estricta TypeScript (tsc --noEmit), build Next.js y ejecución filtrada de suite H69	Estática / Compilación / Unitaria	Sistema / Integración	Crítica	Rama feature/H69-rechazo-mision-patrulla con fixes aplicados	Comandos npx tsc --noEmit, npm run build y npm test -- -t "H69 — Rechazo Motivado de Misión"	tsc y next build finalizan con exit 0; las pruebas H69 en PatrullaDetailPage.test.tsx pasan de forma aislada sin depender de otro describe	npx tsc --noEmit finaliza con exit 0 (0 errores); npm run build genera 8/8 rutas estáticas con exit 0; ejecución filtrada aprueba 15/15 tests	CORREGIDO	12/11/2026 12:18	13/11/2026 22:28	fix(patrulla): implementar validacion RBAC, tipar errores MisionServiceError y refrescar badge (H69)
BUG-H69-PWA-02	Control RBAC en botón "Rechazar Misión" (CA-5) y tipado de errores HTTP con MisionServiceError	Seguridad / RBAC	Integración / Componentes	Alta	Usuario autenticado sin permiso misiones:terreno:verificar o con rol ajeno accediendo a /patrulla/misiones/[id]	Sesión con permisos: [] o rol DELEGADO_CUADRILLA y misión DESPACHADA; invocación de rechazarMision	El botón "Rechazar Misión" permanece oculto sin esPatrulla && tienePermisoVerificar; rechazarMision usa JWT del cliente y arroja MisionServiceError con statusCode	esRechazable exige rol patrulla y permiso; prueba unitaria verifica botón ausente sin permiso (PatrullaDetailPage.test.tsx); errores HTTP tipados con MisionServiceError	CORREGIDO	12/11/2026 12:19	13/11/2026 22:28	fix(patrulla): implementar validacion RBAC, tipar errores MisionServiceError y refrescar badge (H69)
BUG-H69-PWA-03	Navegación directa desde alerta en tiempo real (NuevaMisionBanner) hacia detalle de misión con "Rechazar Misión" (CA-1)	Funcional / Navegación	Integración / Componentes	Alta	next.config.ts configurado con basePath "/terreno" y evento mision:asignada recibido	misionId: mis-42, navegación mediante router.push(...) desde NuevaMisionBanner	router.push recibe ruta relativa /patrulla/misiones/mis-42 para que Next.js resuelva a /terreno/patrulla/misiones/mis-42 sin duplicación de ruta	NuevaMisionBanner.tsx, PatrullaMisionesPage.tsx y TerrenoHomePage usan rutas relativas /patrulla/misiones/...; suite NuevaMisionBanner.test.tsx aprueba 4/4 tests	CORREGIDO	12/11/2026 12:20	13/11/2026 22:28	fix(navigation): resolver rutas relativas a basePath para evitar 404 en alertas de terreno (H35, H69)
BUG-H69-PWA-04	Sincronización de ConnectionStatusBadge, bandera sincronizacionPendiente, captura de red en WebKit y manejo de conflicto 409/422 en outbox	Offline-First / Resiliencia	Integración / Hook	Alta	Patrulla offline o con corte de red ejecutando rechazo motivado y posterior reconexión	navigator.onLine = false o TypeError("Load failed"); mutación RECHAZAR_MISION procesada en useConnectivity	ConnectionStatusBadge incrementa pendientes de inmediato; MisionLocal marca sincronizacionPendiente: true; WebKit encola en outbox; 409/422 limpia la cola sin corruptelas	handleConfirmarRechazo invoca actualizarPendientes(); rechazarMision marca sincronizacionPendiente: true; useConnectivity.ts procesa RECHAZAR_MISION y aprueba en useConnectivity.test.ts	CORREGIDO	12/11/2026 12:19	13/11/2026 22:28	fix(offline): persistir sincronizacionPendiente y resolver mutaciones RECHAZAR_MISION en outbox (H69)
BUG-H69-PWA-05	Aislamiento multi-patrulla, ausencia de datos ficticios post-rechazo y preservación de ciclo de vida de sesión	Integridad de Datos / Concurrencia	Integración / Servicios	Alta	Patrulla rechaza su única misión activa (locales.length === 0) o consulta ID inexistente/ajeno	sincronizarMisiones con patrullaId, consulta a misión inexistente retornando null	Bandeja muestra estado vacío institucional; detalle inexistente muestra "Misión no encontrada"; IndexedDB purga misiones al cerrar sesión y useTerrenoSocket activo	Eliminadas misiones ficticias; PatrullaDetailPage.tsx muestra tarjeta de no encontrada; restaurados limpiarMisionesLocales(), limpiarAlmacenamientoOffline() y useTerrenoSocket()	CORREGIDO	12/11/2026 12:20	13/11/2026 22:28	fix(terreno): eliminar misiones ficticias, aislar por unidad y restaurar sincronizacion reactiva (H69, H85)
BUG-H69-PWA-06	Handshake JWT en cliente Socket.io (client.ts) y documentación detallada del contrato POST /api/misiones/{id}/rechazar	Tiempo Real / Documentación	Integración / Documentación	Media	Variables de entorno de WebSocket vacías; revisión de especificación en docs/api/	Inspección de src/lib/socket/client.ts y lectura de docs/api/contratos-terreno.md §2.2	getSocket() resuelve origen de ventana y envía { auth: { token } }; contratos-terreno.md detalla endpoint, payload, respuestas y evento mision:rechazada	client.ts incorpora getAuthCookie() en handshake y origen dinámico (client.test.ts aprueba 3/3); docs/api/contratos-terreno.md §2.2 documentado completamente	CORREGIDO	12/11/2026 12:20	13/11/2026 22:28	fix(realtime): incorporar auth token y resolver origen en socket client (H69)
CP-H69-PWA-01	Validación Zod de justificacion_rechazo vacía o solo espacios en blanco (Regla Crítica §3.3)	Funcional / Validación	Unitaria	Crítica	Esquema rechazoMisionSchema importado desde src/lib/validations/misiones.ts	{ justificacion_rechazo: "" } y { justificacion_rechazo: "   ab  " }	safeParse retorna success: false con mensaje "La justificación de rechazo debe contener al menos 5 caracteres."	misiones.test.ts verifica rechazo de cadena vacía y "   ab  " tras trim() con 5/5 pruebas aprobadas	APROBADO	12/11/2026 12:21	13/11/2026 22:28	feat(api): agregar contrato y validacion zod para rechazo motivado de mision
CP-H69-PWA-02	Validación límite inferior exacto: 4 caracteres inválidos vs 5 caracteres válidos en rechazoMisionSchema	Funcional / Valores Límite	Unitaria	Crítica	Esquema rechazoMisionSchema y servicio rechazarMision	{ justificacion_rechazo: "1234" } vs { justificacion_rechazo: "Falla" }	4 caracteres rechazados (success: false); 5 caracteres aceptados (success: true) con coordenadas GPS opcionales	misiones.test.ts aprueba casos límite; rechazarMision valida localmente antes de invocar red o IndexedDB	APROBADO	12/11/2026 12:21	13/11/2026 22:28	feat(api): agregar contrato y validacion zod para rechazo motivado de mision
CP-H69-PWA-03	Despliegue obligatorio de RechazoMisionModal con título, código de misión, contador en tiempo real y botón inicialmente deshabilitado	UI / UX / Funcional	Componentes	Alta	RechazoMisionModal renderizado con abierto={true} y codigoMision="INC-2026-0042"	Prop abierto={false} vs abierto={true}; texto "", "   abc  " (3/5) y "Falla" (5/5)	Oculto si abierto=false; visible con role="dialog", contador 0 / 5 caracteres mín. y botón "Confirmar Rechazo" deshabilitado hasta alcanzar >= 5 caracteres	RechazoMisionModal.test.tsx valida render condicional, contador dinámico tras trim() y activación exacta al llegar a 5 caracteres	APROBADO	12/11/2026 12:21	13/11/2026 22:28	feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69)
CP-H69-PWA-04	Retroalimentación visual de error al perder el foco (onBlur) con justificación insuficiente	UI / Accesibilidad	Componentes	Media	Modal RechazoMisionModal abierto en pantalla	Ingresar "No" y disparar evento blur en textarea justificacion-rechazo-input	Muestra alerta role="alert" con "La justificación debe contener al menos 5 caracteres." y aria-invalid="true"	RechazoMisionModal.test.tsx verifica despliegue del mensaje accesible al perder foco	APROBADO	12/11/2026 12:21	13/11/2026 22:28	feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69)
CP-H69-PWA-05	Captura transparente y no bloqueante de coordenadas GPS al confirmar rechazo en RechazoMisionModal	Hardware / Geolocation	Componentes	Media	Navegador con navigator.geolocation.getCurrentPosition activo o denegado	coords: { latitude: -39.8142, longitude: -73.2458 }; motivo "Desperfecto mecánico en vehículo"	Invoca alConfirmar con texto trimmed y { lat: -39.8142, lng: -73.2458 }; si no hay GPS permite enviar sin bloquear	RechazoMisionModal.test.tsx confirma envío de texto y coordenadas GPS mockeadas	APROBADO	12/11/2026 12:21	13/11/2026 22:28	feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69)
CP-H69-PWA-06	Manejo de error HTTP desde API dentro del modal y cierre con botón "Cancelar" o tecla Escape	Funcional / Manejo de Errores	Componentes	Alta	Modal abierto con promesa alConfirmar rechazada o interacción de cancelación	mockRejectedValueOnce(new Error("La misión ya se encuentra en curso.")); evento keydown Escape	Despliega caja role="alert" con el mensaje del servidor sin cerrar el modal; Cancelar o Escape ejecutan alCancelar	RechazoMisionModal.test.tsx verifica 9/9 aserciones aprobadas (908ms)	APROBADO	12/11/2026 12:21	13/11/2026 22:28	feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69)
CP-H69-PWA-07	Invocación online a POST /api/misiones/{id}/rechazar y actualización local a RECHAZADA en misionesService	Integración / API Client	Servicios	Crítica	navigator.onLine = true y respuesta simulada 200 OK acorde al contrato OpenAPI	id: "mis-001", body: { justificacion_rechazo: "Desperfecto mecánico en vehículo", latitud: -39.8142, longitud: -73.2458 }	Llama apiClient.POST(/api/misiones/{id}/rechazar), actualiza IndexedDB (estado: RECHAZADA) y retorna exito: true	misionesService.test.ts verifica ruta OpenAPI, payload, ausencia de cabecera vacía y persistencia en IndexedDB	APROBADO	12/11/2026 12:21	13/11/2026 22:28	feat(misiones): implementar servicio de rechazo con soporte offline y outbox en misionesService
CP-H69-PWA-08	Rechazo de propagación ante respuesta de error 409 Conflict / 400 Bad Request en rechazarMision online	Negativa / Concurrencia	Servicios	Alta	navigator.onLine = true y misión en estado EN_CURSO en servidor	response: { ok: false, status: 409 }, error: { message: "La misión no se encuentra en estado DESPACHADA." }	Lanza MisionServiceError con statusCode: 409 sin encolar en outbox ni sobreescribir el estado local	misionesService.test.ts verifica captura de MisionServiceError con código HTTP 409	APROBADO	12/11/2026 12:21	13/11/2026 22:28	fix(patrulla): implementar validacion RBAC, tipar errores MisionServiceError y refrescar badge (H69)
CP-H69-PWA-09	Encolamiento offline (RECHAZAR_MISION) en IndexedDB outbox cuando navigator.onLine === false	Offline-First / Persistencia	Servicios	Alta	Dispositivo sin conectividad (navigator.onLine = false) y misión local en IndexedDB	id: "mis-001", justificacion_rechazo: "Corte de ruta total por derrumbe"	Encola { tipo: RECHAZAR_MISION, url: /api/misiones/mis-001/rechazar, metodo: POST }, actualiza local a RECHAZADA con sincronizacionPendiente: true	misionesService.test.ts verifica encolarAccionOutbox y persistencia con sincronizacionPendiente: true	APROBADO	12/11/2026 12:21	13/11/2026 22:28	fix(offline): persistir sincronizacionPendiente y resolver mutaciones RECHAZAR_MISION en outbox (H69)
CP-H69-PWA-10	Integración visual en PatrullaMisionDetailPage: recuadro "Acciones de Despacho", flujo completo de rechazo, modo solo lectura y banner post-rechazo	Funcional / E2E Simulado	Componentes	Alta	PatrullaDetailPage montada con misión DESPACHADA, unidad inactiva o misión RECHAZADA	Misión mis-desp-1 (INC-2026-00100), motivo "Desperfecto mecánico en radiador"	Muestra botón "Rechazar Misión", oculta controles si unidadActiva=false o sin permiso, muestra banner "Misión Rechazada por Patrulla Verificadora" con motivo	PatrullaDetailPage.test.tsx aprueba 10/10 pruebas (921ms) incluyendo control RBAC y tarjeta de no encontrada	APROBADO	12/11/2026 12:21	13/11/2026 22:28	refactor(terreno): unificar tarjeta de acciones de despacho y sintetizar textos operativos
CP-H69-PWA-11	Suscripción WebSocket en tiempo real (useMisionesSocket) a sala patrulla:{id}, eventos mision:asignada / mision:rechazada y vibración háptica	Tiempo Real / Hardware	Integración / Hook	Media	Usuario patrulla con unidadId: "pat-100" y cliente Socket.io mockeado	Evento mision:asignada para pat-100 vs pat-OTRA-999; desmontaje del hook	Se une a patrulla:pat-100, filtra unidades ajenas, activa navigator.vibrate([200, 100, 200]), escucha mision:rechazada y abandona sala al desmontar	useMisionesSocket.test.ts aprueba 4/4 pruebas unitarias	APROBADO	12/11/2026 12:18	13/11/2026 22:28	feat(realtime): implementar cliente socket.io y hook useMisionesSocket para terreno (H35)
CP-H69-PWA-12	Cumplimiento de diseño plano institucional (Flat UI, esquinas rectas 0px, mínimo táctil 48px, Noto Sans, lucide-react y cero emojis)	UI / Estándar Visual	Estática / CSS	Media	Código fuente en src/ incluyendo RechazoMisionModal.module.css, PatrullaDetailPage.module.css y Button.module.css	Búsqueda regex de emojis en src/ y revisión de tokens CSS	0 emojis en src/; border-radius: 0; box-shadow: none; min-height: 48px en .md / 54px en .lg; textos sin jerga interna (§3.3)	NO_EMOJIS_IN_SRC; CSS de modal y detalle cumple esquinas rectas, diseño plano y objetivos táctiles >= 48px	APROBADO	12/11/2026 12:19	13/11/2026 22:28	fix(ui): eliminar referencias a secciones internas (§3.3, §3.7) en textos dirigidos al usuario
CP-H69-PWA-13	Análisis estático ESLint sobre la base de código completa	Estática / Calidad	Sistema	Media	Proyecto en rama feature/H69-rechazo-mision-patrulla	Comando npm run lint	Finaliza con exit code 0 y 0 errores de ESLint	npm run lint termina con exit 0, 0 errors y 4 advertencias preexistentes (no-location-assign-relative-destination)	APROBADO	12/11/2026 12:18	13/11/2026 22:28	refactor(terreno): unificar tarjeta de acciones de despacho y sintetizar textos operativos
CP-H69-PWA-14	Manual de usuario operativo H69 con secciones obligatorias de modo sin conexión y permisos GPS (AGENTS.md §5)	Documentación	Documental	Media	Archivo docs/manuals/H69-rechazo-mision-patrulla.md	Revisión estructural frente a AGENTS.md §5 y RechazoMisionModal.tsx	Contiene propósito, pasos con textos reales de UI, sección Comportamiento sin Conexión y permisos de hardware GPS	Manual completo de 87 líneas con secciones de permisos GPS, pasos de UI y arquitectura Offline-First	APROBADO	12/11/2026 12:18	13/11/2026 22:28	docs(manuals): agregar manual de usuario para rechazo motivado de patrulla verificadora (H69)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencia Replicable (Re-Test)

### 5.1 Suite completa y subconjunto dirigido de HU-69 (Vitest)

Ejecutar la suite completa del proyecto:

```bash
npm test -- --run
```

Salida observada en Re-Test (`13/11/2026 22:26`):

```text
 Test Files  33 passed (33)
      Tests  133 passed (133)
   Start at  22:26:19
   Duration  9.95s (transform 6.04s, setup 15.03s, collect 24.64s, tests 12.41s, environment 56.77s, prepare 7.78s)
```

Ejecutar los 4 archivos de pruebas directamente vinculados a HU-69:

```bash
npx vitest run \
  src/lib/validations/misiones.test.ts \
  src/components/misiones/__tests__/RechazoMisionModal.test.tsx \
  src/services/__tests__/misionesService.test.ts \
  "src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx"
```

Salida observada en Re-Test (`13/11/2026 22:27`):

```text
 ✓ src/lib/validations/misiones.test.ts (5 tests) 13ms
 ✓ src/services/__tests__/misionesService.test.ts (14 tests) 108ms
 ✓ src/components/misiones/__tests__/RechazoMisionModal.test.tsx (9 tests) 908ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx (10 tests) 921ms

 Test Files  4 passed (4)
      Tests  38 passed (38)
   Start at  22:27:09
   Duration  5.39s (transform 1.72s, setup 1.74s, collect 4.18s, tests 1.95s, environment 6.77s, prepare 654ms)
```

### 5.2 Ejecución filtrada por nombre de suite (`npm test -- -t "..."`)

```bash
npm test -- -t "H69 — Rechazo Motivado de Misión"
npm test -- -t "rechazarMision"
npm test -- -t "rechazoMisionSchema"
npm test -- -t "RechazoMisionModal"
npm test -- -t "NuevaMisionBanner"
```

Salidas observadas en Re-Test:

- `-t "H69 — Rechazo Motivado de Misión"`: `2 passed | 31 skipped (33)` test files, `15 passed | 118 skipped (133)` tests (`9.29s`).
- `-t "rechazarMision"`: `1 passed | 32 skipped (33)` test files, `5 passed | 128 skipped (133)` tests (`18ms`).
- `-t "rechazoMisionSchema"`: `1 passed | 32 skipped (33)` test files, `5 passed | 128 skipped (133)` tests (`7ms`).
- `-t "RechazoMisionModal"`: `1 passed | 32 skipped (33)` test files, `9 passed | 124 skipped (133)` tests (`462ms`).
- `-t "NuevaMisionBanner"`: `1 passed | 32 skipped (33)` test files, `4 passed | 129 skipped (133)` tests (`217ms`).

### 5.3 Verificación de tipos TypeScript, Build de producción y ESLint

```bash
npx tsc --noEmit
npm run build
npm run lint
```

Salidas observadas en Re-Test:

- `npx tsc --noEmit`: exit code `0` (`0` errores de compilación).
- `npm run build` (Next.js 16.3.4 Turbopack): exit code `0` (`✓ Compiled successfully in 4.2s`, `✓ Finished TypeScript in 5.8s`, `✓ Generating static pages using 11 workers (8/8)`).
- `npm run lint`: exit code `0`, `0 errors` y `4 warnings` preexistentes en `@next/next/no-location-assign-relative-destination` (`src/app/(auth)/login/page.tsx:51`, `src/app/(terreno)/page.tsx:32`, `src/context/AuthContext.tsx:148`, `src/lib/api/client.ts:47`).

### 5.4 Verificación estática de emojis en `src/`

```bash
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS_IN_SRC"
```

Salida observada: `NO_EMOJIS_IN_SRC`.

### 5.5 Comandos de validación de contrato contra `sgrai-api`

Comandos de verificación en vivo del contrato `POST /api/misiones/{id}/rechazar`:

```bash
# 1. Autenticación de Patrulla Verificadora (H59)
TOKEN=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"patrulla@valdivia.cl","password":"Password123!"}' | jq -r '.data.token // .token')

# 2. Caso negativo: justificación menor a 5 caracteres (esperado: 400 Bad Request)
curl -i -s -X POST "http://localhost:3001/api/misiones/${MISION_ID}/rechazar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"abcd"}'

# 3. Caso negativo: sin cabecera de autenticación (esperado: 401 Unauthorized)
curl -i -s -X POST "http://localhost:3001/api/misiones/${MISION_ID}/rechazar" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en radiador"}'

# 4. Caso positivo: justificación >= 5 caracteres y coordenadas GPS opcionales (esperado: 200 OK)
curl -i -s -X POST "http://localhost:3001/api/misiones/${MISION_ID}/rechazar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en radiador institucional","latitud":-39.81422,"longitud":-73.24589}'
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación / Regla (HU-69) | Responsabilidad Arquitectónica | Cobertura en `sgrai-pwa` | Estado tras Re-Test | Referencia |
|---|---|---|---|---|
| **CA-1:** Opción visible `'Rechazar Misión'` al recibir notificación de nueva misión en la PWA | `sgrai-pwa` (`PatrullaDetailPage`, `NuevaMisionBanner`, `useMisionesSocket`) | Botón visible en `/patrulla/misiones/[id]`; navegación directa desde `NuevaMisionBanner` y bandeja sin duplicación de `/terreno/` | **Aprobado** | `CP-H69-PWA-10`, `CP-H69-PWA-11`, `BUG-H69-PWA-03` |
| **CA-2:** Modal obligatorio con `justificacion_rechazo` $\ge 5$ caracteres (§3.3) y bloqueo de envío inválido | `sgrai-pwa` (`RechazoMisionModal`, `rechazoMisionSchema`) | Validación UI en tiempo real, contador de caracteres, bloqueo en formulario y esquema Zod tipado compatible con Zod v4 | **Aprobado** | `CP-H69-PWA-01` .. `CP-H69-PWA-06`, `BUG-H69-PWA-01` |
| **CA-3:** Transacción atómica (`RECHAZADA`, `justificacion_rechazo`, `patrulla = DISPONIBLE`, `incidente = REPORTADO`) | `sgrai-api` (Backend) + sincronización en `sgrai-pwa` | Contrato consumido en `misionesService.ts`; persistencia `RECHAZAR_MISION` en `outbox` con `sincronizacionPendiente: true`, drenado en `useConnectivity` y sin misiones ficticias | **Aprobado** | `CP-H69-PWA-07` .. `CP-H69-PWA-09`, `BUG-H69-PWA-04`, `BUG-H69-PWA-05` |
| **CA-4:** Emisión WebSocket `mision:rechazada` hacia sala `encargado` | `sgrai-api` (emisión) + `sgrai-pwa` (escucha en sala de unidad) | `useMisionesSocket` escucha `mision:rechazada` en `patrulla:{id}`, `client.ts` inyecta token en handshake y `useTerrenoSocket` activo en `TerrenoLayout` | **Aprobado** | `CP-H69-PWA-11`, `BUG-H69-PWA-05`, `BUG-H69-PWA-06` |
| **CA-5:** Validación de autenticación de patrulla verificadora en `POST /api/misiones/{id}/rechazar` | `sgrai-api` (Auth/RBAC) + `sgrai-pwa` (Gating UI/cliente) | `esRechazable` en `PatrullaDetailPage` exige `esPatrulla && tienePermisoVerificar`; errores tipados con `MisionServiceError(status, ...)` | **Aprobado** | `CP-H69-PWA-08`, `BUG-H69-PWA-02` |
| **Calidad, Build, Ergonomía Terreno y Documentación (`AGENTS.md`)** | `sgrai-pwa` | `0` emojis, Flat UI `0px`, mínimo táctil `48px`, Noto Sans, `tsc --noEmit` exit `0`, `npm run build` exit `0`, `lint` limpio y documentación completa en `docs/` | **Aprobado** | `CP-H69-PWA-12` .. `CP-H69-PWA-14`, `BUG-H69-PWA-01`, `BUG-H69-PWA-06` |

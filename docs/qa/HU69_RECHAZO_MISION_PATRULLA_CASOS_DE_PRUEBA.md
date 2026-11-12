# Auditoría Técnica y Matriz de Casos de Prueba — HU-[69]: Rechazo Motivado de Misión por Patrulla Verificadora (`sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `feature/H69-rechazo-mision-patrulla`  
**Historia de Usuario:** HU-[69] — Rechazo motivado de asignación de misión de verificación en terreno  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría:** `12/11/2026 12:22 -03:00`  
**Entorno de Ejecución:** Linux, Node.js, Vitest v3.2.7, Next.js 16.3.4 (Turbopack), ESLint 9, TypeScript (`tsc --noEmit`), Zod v4.5.4  
**Dictamen de Auditoría:** **RECHAZADO EN CODE REVIEW (`Changes Requested`) — `6` defectos abiertos (`1` Crítico, `4` Altos, `1` Medio); `14` de `20` casos en estado `APROBADO`**

---

## Alcance Arquitectónico en `sgrai-pwa`

De acuerdo con la separación de responsabilidades del sistema SGRAI (`AGENTS.md §1`), la persistencia transaccional en PostgreSQL (`mision.estado = 'RECHAZADA'`, `justificacion_rechazo`, `patrulla.estado = 'DISPONIBLE'`, `incidente.estado = 'REPORTADO'`, registro en `mision_hito`) y la emisión WebSocket del evento `mision:rechazada` hacia la sala `encargado` corresponden al backend `sgrai-api`.

En el cliente móvil de terreno `sgrai-pwa` (restringido a los roles `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA`), el alcance evaluado comprende:

- Visibilidad y control de acceso del botón **"Rechazar Misión"** en el detalle de misión de patrulla (`/patrulla/misiones/[id]`) y navegación desde la alerta de nueva asignación (`NuevaMisionBanner`).
- Despliegue obligatorio del modal `RechazoMisionModal` con validación en tiempo real (`justificacion_rechazo` $\ge 5$ caracteres tras `trim()`, Regla Crítica §3.3), captura no bloqueante de coordenadas GPS y cumplimiento de diseño plano institucional (Noto Sans, esquinas rectas `0px`, altura táctil mínima de `48px`, iconografía exclusiva `lucide-react` sin emojis).
- Validación estricta con esquema Zod (`rechazoMisionSchema`) y consumo tipado del endpoint `POST /api/misiones/{id}/rechazar` mediante `openapi-fetch` y tipos OpenAPI generados (`src/types/api-generated.d.ts`).
- Operación Offline-First mediante cola `outbox` (`RECHAZAR_MISION`) en IndexedDB (`idb`) y sincronización automática al restablecer conectividad (`useConnectivity`).
- Manual de usuario y documentación técnica de contratos en `docs/`.

---

## 1. Resumen Ejecutivo

Durante la auditoría técnica sobre la rama `feature/H69-rechazo-mision-patrulla`, la suite completa de Vitest arroja `126` pruebas aprobadas en `33` archivos al ejecutarse de forma íntegra (`npm test -- --run`) y ESLint finaliza sin errores (`0 errors`, `4 warnings` preexistentes). Sin embargo, la verificación estricta de tipos (`npx tsc --noEmit`) y el empaquetado de producción (`npm run build`) **fallan** con `6` errores TypeScript en `4` archivos.

Asimismo, la ejecución aislada de la suite de H69 (`npm test -- -t "H69 — Rechazo Motivado de Misión"`) falla en `4/4` casos por fuga de estado de mocks entre bloques `describe`, y la inspección forense del código detectó **6 defectos reales**: `1` Crítico (bloqueo de compilación/build e incompatibilidad Zod v4 + aislamiento de pruebas), `4` Altos (omisión de validación RBAC en botón de rechazo, rutas rotas `/terreno/terreno/...` en `NuevaMisionBanner` por `basePath`, desincronización de `ConnectionStatusBadge` y cola `outbox` en `RECHAZAR_MISION`, y regresión multi-patrulla/datos ficticios tras el merge de integración con `develop`) y `1` Medio (configuración de handshake Socket.io y ausencia de especificación detallada del endpoint en `docs/api/`).

| Indicador / Verificación | Resultado Observado | Observación Técnica |
|---|---|---|
| Total de casos en matriz (HU-69 PWA) | `20` casos | `6` defectos `ABIERTO` (`1` Crítico, `4` Altos, `1` Medio) + `14` casos `APROBADO` |
| Suite automatizada completa (`npm test -- --run`) | `33` archivos / `126` tests (`6.92s`) | `100%` aprobada en ejecución global; oculta fuga de mock en `PatrullaDetailPage.test.tsx` |
| Subconjunto dirigido H69 (`npx vitest run` 4 archivos) | `4` archivos / `35` tests (`1.94s`) | `misiones.test.ts` (`5`), `RechazoMisionModal.test.tsx` (`9`), `misionesService.test.ts` (`13`), `PatrullaDetailPage.test.tsx` (`8`) |
| Ejecución filtrada H69 (`npm test -- -t "H69 — Rechazo Motivado de Misión"`) | **FALLIDO** (`4` fallidos / `9` aprobados / `113` omitidos) | `TypeError: Cannot destructure property 'status' of 'useConnectivity(...)' as it is undefined` |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `4` advertencias | Advertencias preexistentes `@next/next/no-location-assign-relative-destination` |
| Verificación de tipos (`npx tsc --noEmit`) | **FALLIDO** (exit `2`, `6` errores en `4` archivos) | `TS2769` en `misiones.ts`, `TS2322` en `PatrullaDetailPage`, `TS2345` en mocks `useAuth` |
| Build de producción (`npm run build`) | **FALLIDO** (exit `1`, `Failed to type check`) | Bloqueado en verificación TypeScript de Next.js 16.3.4 (Turbopack) |
| Verificación estática de emojis en `src/` | **APROBADO** (`NO_EMOJIS_IN_SRC`) | Uso exclusivo de iconografía `lucide-react` |
| Prueba de contrato en vivo (`localhost:3001` / `localhost:3002`) | `404` en `:3001` / `:3002` inactivo | El servicio `:3001` activo corresponde a rama previa (`feature/h35`) sin endpoint `/rechazar`; `:3002` detenido |

---

## 2. Registro Técnico de Defectos

### BUG-H69-PWA-01 — Fallo de compilación TypeScript, fallo de build de producción y ruptura de pruebas filtradas de H69
- **Severidad:** Crítica (Bloqueante de build, CI/CD y despliegue)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/lib/validations/misiones.ts` (línea 11)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (línea 249)
  - `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx` (líneas 40, 287–317, 386)
  - `src/app/(terreno)/patrulla/misiones/__tests__/PatrullaMisionesPage.test.tsx` (línea 70)
- **Descripción técnica:**
  1. `src/lib/validations/misiones.ts:11` utiliza `z.string({ errorMap: () => ({ message: '...' }) })`, parámetro obsoleto en `zod` `^4.5.4`, generando `TS2769`.
  2. `src/app/(terreno)/patrulla/misiones/[id]/page.tsx:249` evalúa directamente `{mision.datosAdicionales?.justificacionRechazo && (...)}` donde el valor es de tipo `unknown`, produciendo `TS2322` (`Type 'unknown' is not assignable to type 'ReactNode'`).
  3. Los mocks de `useAuth()` en `PatrullaDetailPage.test.tsx` (líneas 40, 290, 386) y `PatrullaMisionesPage.test.tsx` (línea 70) omiten las propiedades `tieneUnidadAsignada` y `estadoAsignacion` de `AuthContextValue`, generando `4` errores `TS2345`.
  4. El segundo bloque `describe` (`PatrullaMisionDetailPage (H69 — Rechazo Motivado de Misión)`) en `PatrullaDetailPage.test.tsx` (líneas 287–317) ejecuta `vi.clearAllMocks()` sin configurar `useConnectivity`, dependiendo del leak de `mockReturnValue` del bloque superior (HU-36). Al ejecutarse de forma filtrada (`npm test -- -t "H69 — Rechazo Motivado de Misión"`), los `4` casos de prueba fallan con `TypeError`.

---

### BUG-H69-PWA-02 — Ausencia de validación RBAC en botón `"Rechazar Misión"` e inconsistencia en manejo de errores HTTP / cabecera `authorization`
- **Severidad:** Alta (Seguridad / RBAC — CA-5)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 147–166)
  - `src/services/misionesService.ts` (líneas 317–332)
- **Descripción técnica:**
  - En `src/app/(terreno)/patrulla/misiones/[id]/page.tsx`, `mostrarBotonAceptar` exige `unidadActiva && esDespachada && tienePermisoVerificar`, pero `esRechazable` (líneas 164–166) omite `esPatrulla` y `tienePermisoVerificar` (`misiones:terreno:verificar`). Como resultado, un usuario sin el permiso de verificación o un `DELEGADO_CUADRILLA` que acceda a `/patrulla/misiones/[id]` visualiza y puede accionar `"Rechazar Misión"`.
  - En `src/services/misionesService.ts:320-322`, `rechazarMision` inyecta explícitamente `header: { authorization: '' }` en la llamada a `apiClient.POST` y arroja un `Error` genérico ante respuestas `400`/`401`/`403`/`404`/`409` en lugar de utilizar `MisionServiceError` tipado con `statusCode` como `aceptarMisionPatrulla`.

---

### BUG-H69-PWA-03 — Navegación 404 por doble prefijo `/terreno/terreno/` desde la alerta de nueva misión (`NuevaMisionBanner`)
- **Severidad:** Alta (Funcional — CA-1)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `next.config.ts` (línea 44: `basePath: "/terreno"`)
  - `src/components/misiones/NuevaMisionBanner.tsx` (líneas 25–33)
  - `src/app/(terreno)/patrulla/misiones/page.tsx` (línea 186)
  - `src/app/(terreno)/page.tsx` (líneas 68–70)
  - `src/components/misiones/__tests__/NuevaMisionBanner.test.tsx` (líneas 36, 43)
- **Descripción técnica:**
  - La aplicación está configurada con `basePath: "/terreno"` en `next.config.ts`. En Next.js App Router, `router.push(...)` antepone automáticamente el `basePath`.
  - Sin embargo, `NuevaMisionBanner.tsx:26`, `PatrullaMisionesPage.tsx:186` y `TerrenoHomePage` (`page.tsx:69-70`) construyen rutas con `/terreno` incluido (`/terreno/patrulla/misiones/${misionId}`). Al pulsar `"Ver Misión Asignada"`, `router.push` navega hacia `/terreno/terreno/patrulla/misiones/${misionId}` (HTTP `404`), impidiendo acceder al detalle donde se ubica **"Rechazar Misión"** tras recibir la notificación en tiempo real.

---

### BUG-H69-PWA-04 — Desincronización de `ConnectionStatusBadge`, omisión de `sincronizacionPendiente`, captura offline incompleta en WebKit y confirmación ciega en `useConnectivity`
- **Severidad:** Alta (Funcional / Offline-First)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 168–197)
  - `src/services/misionesService.ts` (líneas 292–300, 353–375)
  - `src/hooks/useConnectivity.ts` (líneas 61–97)
- **Descripción técnica:**
  1. `handleConfirmarRechazo` en `PatrullaDetailPage.tsx` no invoca `await actualizarPendientes()` tras ejecutar `rechazarMision` offline, manteniendo el contador del `ConnectionStatusBadge` en `0` hasta el siguiente ciclo de polling (15s), en contradicción con `docs/manuals/H69-rechazo-mision-patrulla.md:67-68`.
  2. `rechazarMision` no establece `sincronizacionPendiente: true` en el registro `MisionLocal` en IndexedDB cuando se encola la mutación `RECHAZAR_MISION`.
  3. El bloque `catch` de `rechazarMision` (`misionesService.ts:353-356`) solo captura `TypeError` si el mensaje contiene `'fetch'`, `'network'` o `'Failed'` (sensible a mayúsculas), fallando en Safari/iOS (`TypeError: Load failed`) o ante cancelaciones `AbortError`.
  4. `useConnectivity.ts` no actualiza `sincronizacionPendiente` para `RECHAZAR_MISION` al sincronizarse, no maneja la reversión del estado local optimista ante respuestas `409`/`422` y presenta una regresión respecto a `develop` en `ACEPTAR_MISION` al promover localmente a `EN_CURSO` incluso ante HTTP `409`/`422`. Adicionalmente, el rechazo local no emite eventos para refrescar `TerrenoMisionesPendientes` / `TerrenoResumenOperativo`.

---

### BUG-H69-PWA-05 — Regresión de aislamiento multi-patrulla e inyección de misiones ficticias tras rechazar la última misión asignada
- **Severidad:** Alta (Integridad de Datos / Concurrencia / Regresión post-merge)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/app/(terreno)/patrulla/misiones/page.tsx` (líneas 46–98)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 66–79)
  - `src/components/terreno/TerrenoMisionesPendientes.tsx` (líneas 26–28)
  - `src/components/terreno/TerrenoResumenOperativo.tsx` (línea 31)
  - `src/services/misionesService.ts` (línea 181)
  - `src/services/offlineQueue.ts`, `src/context/AuthContext.tsx`, `src/app/(terreno)/layout.tsx`
- **Descripción técnica:**
  - Al rechazar la última misión activa de la patrulla (`locales.length === 0`), `PatrullaMisionesPage.tsx:77-98` inyecta nuevamente en IndexedDB una misión ficticia en estado `DESPACHADA` (`60000000-0000-4000-8000-000000000001`), simulando una asignación inexistente.
  - En `PatrullaDetailPage.tsx:66-79`, cuando `obtenerDetalleMision` retorna `null` (misión inexistente o `403`/`404`), la pantalla fabrica una misión ficticia `DESPACHADA` con botones activos para aceptar o rechazar.
  - Durante el merge `b9d937d` se revirtieron protecciones ya integradas en `develop`: filtrado por `patrullaId` en `sincronizarMisiones`, `limpiarMisionesLocales()` en `offlineQueue.ts`, `limpiarAlmacenamientoOffline()` en `AuthContext.tsx` y la suscripción `useTerrenoSocket()` en `TerrenoLayout`.

---

### BUG-H69-PWA-06 — Configuración de cliente Socket.io desalineada con handshake JWT y omisión de detalle del contrato en `docs/api/`
- **Severidad:** Media (Tiempo Real / Documentación)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/lib/socket/client.ts` (líneas 3–28)
  - `docs/api/contratos-terreno.md` (línea 71)
- **Descripción técnica:**
  - `src/lib/socket/client.ts` recurre al fallback hardcodeado `'http://localhost:4001'` cuando `NEXT_PUBLIC_SOCKET_URL` y `NEXT_PUBLIC_API_URL` están vacías (como ocurre en `.env.local`), en lugar de resolver `window.location.origin`, y omite `auth: { token }` en la configuración de `io(...)`, incumpliendo `docs/api/contratos-terreno.md §3` (línea 150).
  - `docs/api/contratos-terreno.md` lista `POST /api/misiones/{id}/rechazar` únicamente en la tabla resumen (línea 71), sin subsección de payload, respuestas (`200`, `400`, `401`, `403`, `404`, `409`) ni evento `mision:rechazada` hacia la sala `encargado`; tampoco existe `docs/api/misiones.md` en el repositorio.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-H69-PWA-01 | Compilación estricta TypeScript (`tsc --noEmit`), build Next.js y ejecución filtrada de suite H69 | Estática / Compilación / Unitaria | Sistema / Integración | Crítica | Rama `feature/H69-rechazo-mision-patrulla` con dependencias instaladas | Comandos `npx tsc --noEmit`, `npm run build` y `npm test -- -t "H69 — Rechazo Motivado de Misión"` | `tsc` y `next build` finalizan con exit `0`; las `4` pruebas H69 en `PatrullaDetailPage.test.tsx` pasan aisladamente sin depender de otro `describe` | `tsc` falla (`6` errores en `4` archivos, exit `2`); `next build` falla (`Failed to type check`, exit `1`); ejecución filtrada H69 falla `4/4` por `useConnectivity` undefined | ABIERTO | 12/11/2026 12:18 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H69-PWA-02 | Control RBAC en botón `"Rechazar Misión"` (CA-5) y manejo de cabecera/errores HTTP en `rechazarMision` | Seguridad / RBAC | Integración / Componentes | Alta | Usuario autenticado sin permiso `misiones:terreno:verificar` o con rol `DELEGADO_CUADRILLA` accediendo a `/patrulla/misiones/[id]` | Sesión con `permisos: []` o `rolCodigo: 'DELEGADO_CUADRILLA'` y misión `DESPACHADA`; revisión de `apiClient.POST` en `misionesService.ts` | El botón `"Rechazar Misión"` permanece oculto sin `esPatrulla && tienePermiso('misiones:terreno:verificar')`; `apiClient.POST` delega JWT sin `authorization: ''` y arroja `MisionServiceError` | `esRechazable` omite validación de rol y permiso (`PatrullaDetailPage.tsx:164-166`), exponiendo el botón; `misionesService.ts:320` envía `authorization: ''` y lanza `Error` genérico | ABIERTO | 12/11/2026 12:19 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H69-PWA-03 | Navegación directa desde alerta en tiempo real (`NuevaMisionBanner`) hacia detalle de misión con `"Rechazar Misión"` (CA-1) | Funcional / Navegación | Integración / Componentes | Alta | `next.config.ts` configurado con `basePath: "/terreno"` y evento `mision:asignada` recibido | `misionId: "mis-42"`, `urlDetalle: "/terreno/patrulla/misiones/mis-42"` pasado a `router.push(...)` | `router.push` recibe ruta relativa `/patrulla/misiones/mis-42` para resolver a `/terreno/patrulla/misiones/mis-42` | `NuevaMisionBanner`, `PatrullaMisionesPage` y `TerrenoHomePage` pasan `/terreno/patrulla/misiones/...`, provocando doble prefijo `/terreno/terreno/...` (HTTP `404`) | ABIERTO | 12/11/2026 12:20 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H69-PWA-04 | Sincronización de `ConnectionStatusBadge`, bandera `sincronizacionPendiente`, captura de red en WebKit y manejo de conflicto `409`/`422` en `outbox` | Offline-First / Resiliencia | Integración / Hook | Alta | Patrulla offline o con corte de red ejecutando rechazo motivado y posterior reconexión | `navigator.onLine = false` o `TypeError("Load failed")`; respuesta servidor `409 Conflict` al drenar `outbox` en `useConnectivity` | `ConnectionStatusBadge` incrementa pendientes de inmediato; `MisionLocal` marca `sincronizacionPendiente: true`; WebKit encola en `outbox`; `409`/`422` no confirma falsamente estado local | `handleConfirmarRechazo` no llama `actualizarPendientes()`; no marca `sincronizacionPendiente: true`; `Load failed` no coincide con `'Failed'`; `useConnectivity` ignora `RECHAZAR_MISION` y revierte fix de `409`/`422` | ABIERTO | 12/11/2026 12:19 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H69-PWA-05 | Aislamiento multi-patrulla, ausencia de datos ficticios post-rechazo y preservación de ciclo de vida de sesión | Integridad de Datos / Concurrencia | Integración / Servicios | Alta | Patrulla rechaza su única misión activa (`locales.length === 0`) o consulta ID inexistente/ajeno | `sincronizarMisiones` sin `patrullaId`, `obtenerDetalleMision("id-ajeno")` retornando `null` | Bandeja muestra estado vacío `"La patrulla se encuentra disponible para despacho"`; detalle inexistente muestra error/404; IndexedDB purga misiones al cerrar sesión | `PatrullaMisionesPage:77-98` y `PatrullaDetailPage:66-79` inyectan misiones ficticias `DESPACHADA`; se perdieron `patrullaId`, `limpiarMisionesLocales` y `useTerrenoSocket` en merge | ABIERTO | 12/11/2026 12:20 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H69-PWA-06 | Handshake JWT en cliente Socket.io (`client.ts`) y documentación detallada del contrato `POST /api/misiones/{id}/rechazar` | Tiempo Real / Documentación | Integración / Documentación | Media | Variables `NEXT_PUBLIC_SOCKET_URL` y `NEXT_PUBLIC_API_URL` vacías en `.env.local`; revisión de `docs/api/` | Inspección de `src/lib/socket/client.ts` y `docs/api/contratos-terreno.md` | `getSocket()` usa `window.location.origin` y envía `{ auth: { token } }` según contrato; `docs/api/` detalla payload, códigos y evento `mision:rechazada` | `client.ts` cae a `http://localhost:4001` sin `auth.token`; `contratos-terreno.md` solo incluye resumen en tabla sin especificación completa ni existe `docs/api/misiones.md` | ABIERTO | 12/11/2026 12:20 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| CP-H69-PWA-01 | Validación Zod de `justificacion_rechazo` vacía o solo espacios en blanco (Regla Crítica §3.3) | Funcional / Validación | Unitaria | Crítica | Esquema `rechazoMisionSchema` importado desde `src/lib/validations/misiones.ts` | `{ justificacion_rechazo: "" }` y `{ justificacion_rechazo: "   ab  " }` | `safeParse` retorna `success: false` con mensaje `"La justificación de rechazo debe contener al menos 5 caracteres."` | `misiones.test.ts` verifica rechazo de cadena vacía y `'   ab  '` tras `trim()` | APROBADO | 12/11/2026 12:21 | N/A | feat(api): agregar contrato y validacion zod para rechazo motivado de mision |
| CP-H69-PWA-02 | Validación límite inferior exacto: `4` caracteres inválidos vs `5` caracteres válidos en `rechazoMisionSchema` | Funcional / Valores Límite | Unitaria | Crítica | Esquema `rechazoMisionSchema` y servicio `rechazarMision` | `{ justificacion_rechazo: "1234" }` vs `{ justificacion_rechazo: "Falla" }` | `4` caracteres rechazados (`success: false`); `5` caracteres aceptados (`success: true`) con coordenadas GPS opcionales | `misiones.test.ts` aprueba `5/5` casos límite y `rechazarMision` rechaza `' abc '` y `'   '` antes de invocar red | APROBADO | 12/11/2026 12:21 | N/A | feat(api): agregar contrato y validacion zod para rechazo motivado de mision |
| CP-H69-PWA-03 | Despliegue obligatorio de `RechazoMisionModal` con título, código de misión, contador en tiempo real y botón inicialmente deshabilitado | UI / UX / Funcional | Componentes | Alta | `RechazoMisionModal` renderizado con `abierto={true}` y `codigoMision="INC-2026-0042"` | Prop `abierto={false}` vs `abierto={true}`; texto `""`, `"   abc  "` (`3/5`) y `"Falla"` (`5/5`) | Oculto si `abierto=false`; visible con `role="dialog"`, contador `0 / 5 caracteres mín.` y botón `"Confirmar Rechazo"` deshabilitado hasta alcanzar $\ge 5$ caracteres | `RechazoMisionModal.test.tsx` valida render condicional, contador dinámico tras `trim()` y activación exacta al llegar a `5` caracteres | APROBADO | 12/11/2026 12:21 | N/A | feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69) |
| CP-H69-PWA-04 | Retroalimentación visual de error al perder el foco (`onBlur`) con justificación insuficiente | UI / Accesibilidad | Componentes | Media | Modal `RechazoMisionModal` abierto en pantalla | Ingresar `"No"` y disparar evento `blur` en `<textarea id="justificacion-rechazo-input">` | Muestra alerta `role="alert"` con `"La justificación debe contener al menos 5 caracteres."` y `aria-invalid="true"` | `RechazoMisionModal.test.tsx` verifica despliegue del mensaje accesible al perder foco | APROBADO | 12/11/2026 12:21 | N/A | feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69) |
| CP-H69-PWA-05 | Captura transparente y no bloqueante de coordenadas GPS al confirmar rechazo en `RechazoMisionModal` | Hardware / Geolocation | Componentes | Media | Navegador con `navigator.geolocation.getCurrentPosition` activo o denegado | `coords: { latitude: -39.8142, longitude: -73.2458 }`; motivo `"Desperfecto mecánico en vehículo"` | Invoca `alConfirmar` con texto trimmed y `{ lat: -39.8142, lng: -73.2458 }`; si no hay GPS permite enviar sin bloquear | `RechazoMisionModal.test.tsx` confirma envío de texto y coordenadas GPS mockeadas | APROBADO | 12/11/2026 12:21 | N/A | feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69) |
| CP-H69-PWA-06 | Manejo de error HTTP desde API dentro del modal y cierre con botón `"Cancelar"` o tecla `Escape` | Funcional / Manejo de Errores | Componentes | Alta | Modal abierto con promesa `alConfirmar` rechazada o interacción de cancelación | `mockRejectedValueOnce(new Error("La misión ya se encuentra en curso."))`; evento `keydown` `Escape` | Despliega caja `role="alert"` con el mensaje del servidor sin cerrar el modal; `Cancelar` o `Escape` ejecutan `alCancelar` | `RechazoMisionModal.test.tsx` verifica `9/9` aserciones (`278ms`) | APROBADO | 12/11/2026 12:21 | N/A | feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69) |
| CP-H69-PWA-07 | Invocación online a `POST /api/misiones/{id}/rechazar` y actualización local a `RECHAZADA` en `misionesService` | Integración / API Client | Servicios | Crítica | `navigator.onLine = true` y respuesta simulada `200 OK` acorde al contrato OpenAPI | `id: "mis-001"`, `body: { justificacion_rechazo: "Desperfecto mecánico en vehículo", latitud: -39.8142, longitud: -73.2458 }` | Llama `apiClient.POST('/api/misiones/{id}/rechazar')`, actualiza IndexedDB (`estado: 'RECHAZADA'`) y retorna `exito: true` | `misionesService.test.ts` verifica ruta OpenAPI, payload y persistencia en `offlineQueue.guardarMisionLocal` | APROBADO | 12/11/2026 12:21 | N/A | feat(misiones): implementar servicio de rechazo con soporte offline y outbox en misionesService |
| CP-H69-PWA-08 | Rechazo de propagación ante respuesta de error `409 Conflict` / `400 Bad Request` en `rechazarMision` online | Negativa / Concurrencia | Servicios | Alta | `navigator.onLine = true` y misión en estado `EN_CURSO` en servidor | `response: { ok: false, status: 409 }`, `error: { message: "La misión no se encuentra en estado DESPACHADA." }` | Lanza excepción sin encolar en `outbox` ni sobreescribir el estado local a `RECHAZADA` | `misionesService.test.ts` confirma rechazo de promesa con el mensaje de conflicto `409` | APROBADO | 12/11/2026 12:21 | N/A | feat(misiones): implementar servicio de rechazo con soporte offline y outbox en misionesService |
| CP-H69-PWA-09 | Encolamiento offline (`RECHAZAR_MISION`) en IndexedDB `outbox` cuando `navigator.onLine === false` | Offline-First / Persistencia | Servicios | Alta | Dispositivo sin conectividad (`navigator.onLine = false`) y misión local en IndexedDB | `id: "mis-001"`, `justificacion_rechazo: "Corte de ruta total por derrumbe"` | Encola `{ tipo: 'RECHAZAR_MISION', url: '/api/misiones/mis-001/rechazar', metodo: 'POST' }`, actualiza local a `RECHAZADA` y retorna `modoOffline: true` | `misionesService.test.ts` aprueba aserciones de `encolarAccionOutbox` y actualización local | APROBADO | 12/11/2026 12:21 | N/A | feat(misiones): implementar servicio de rechazo con soporte offline y outbox en misionesService |
| CP-H69-PWA-10 | Integración visual en `PatrullaMisionDetailPage`: recuadro `"Acciones de Despacho"`, flujo completo de rechazo, modo solo lectura y banner post-rechazo | Funcional / E2E Simulado | Componentes | Alta | `PatrullaDetailPage` montada con misión `DESPACHADA`, unidad inactiva o misión `RECHAZADA` | Misión `mis-desp-1` (`INC-2026-00100`), motivo `"Desperfecto mecánico en radiador"` | Muestra botón `"Rechazar Misión"`, oculta controles si `unidadActiva=false`, muestra banner `"Misión Rechazada por Patrulla Verificadora"` con motivo | En ejecución conjunta (`PatrullaDetailPage.test.tsx`), `8/8` tests aprueban (`387ms`) verificando flujo completo y estado `RECHAZADA` | APROBADO | 12/11/2026 12:21 | N/A | refactor(terreno): unificar tarjeta de acciones de despacho y sintetizar textos operativos |
| CP-H69-PWA-11 | Suscripción WebSocket en tiempo real (`useMisionesSocket`) a sala `patrulla:{id}`, eventos `mision:asignada` / `mision:rechazada` y vibración háptica | Tiempo Real / Hardware | Integración / Hook | Media | Usuario patrulla con `unidadId: "pat-100"` y cliente Socket.io mockeado | Evento `mision:asignada` para `pat-100` vs `pat-OTRA-999`; desmontaje del hook | Se une a `patrulla:pat-100`, filtra unidades ajenas, activa `navigator.vibrate([200, 100, 200])`, escucha `mision:rechazada` y abandona sala al desmontar | `useMisionesSocket.test.ts` aprueba `4/4` pruebas unitarias | APROBADO | 12/11/2026 12:18 | N/A | feat(realtime): implementar cliente socket.io y hook useMisionesSocket para terreno (H35) |
| CP-H69-PWA-12 | Cumplimiento de diseño plano institucional (Flat UI, esquinas rectas `0px`, mínimo táctil `48px`, Noto Sans, `lucide-react` y cero emojis) | UI / Estándar Visual | Estática / CSS | Media | Código fuente en `src/` incluyendo `RechazoMisionModal.module.css`, `PatrullaDetailPage.module.css` y `Button.module.css` | Búsqueda regex de emojis en `src/` y revisión de tokens CSS | `0` emojis en `src/`; `border-radius: 0`; `box-shadow: none`; `min-height: 48px` en `.md` / `54px` en `.lg`; textos sin jerga interna (§3.3) | `NO_EMOJIS_IN_SRC`; CSS de modal y detalle cumple esquinas rectas, diseño plano y objetivos táctiles $\ge 48$px | APROBADO | 12/11/2026 12:19 | N/A | fix(ui): eliminar referencias a secciones internas (§3.3, §3.7) en textos dirigidos al usuario |
| CP-H69-PWA-13 | Análisis estático ESLint sobre la base de código completa | Estática / Calidad | Sistema | Media | Proyecto en rama `feature/H69-rechazo-mision-patrulla` | Comando `npm run lint` | Finaliza con exit code `0` y `0` errores de ESLint | `npm run lint` termina con exit `0`, `0 errors` y `4` advertencias preexistentes (`no-location-assign-relative-destination`) | APROBADO | 12/11/2026 12:18 | N/A | refactor(terreno): unificar tarjeta de acciones de despacho y sintetizar textos operativos |
| CP-H69-PWA-14 | Manual de usuario operativo H69 con secciones obligatorias de modo sin conexión y permisos GPS (`AGENTS.md §5`) | Documentación | Documental | Media | Archivo `docs/manuals/H69-rechazo-mision-patrulla.md` | Revisión estructural frente a `AGENTS.md §5` y `RechazoMisionModal.tsx` | Contiene propósito, pasos con textos reales de UI, sección **Comportamiento sin Conexión** y permisos de hardware GPS | Manual completo de `87` líneas con secciones de permisos GPS, pasos de UI y arquitectura Offline-First | APROBADO | 12/11/2026 12:18 | N/A | docs(manuals): agregar manual de usuario para rechazo motivado de patrulla verificadora (H69) |

---

## 4. Bloque TSV Consolidado

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H69-PWA-01	Compilación estricta TypeScript (tsc --noEmit), build Next.js y ejecución filtrada de suite H69	Estática / Compilación / Unitaria	Sistema / Integración	Crítica	Rama feature/H69-rechazo-mision-patrulla con dependencias instaladas	Comandos npx tsc --noEmit, npm run build y npm test -- -t "H69 — Rechazo Motivado de Misión"	tsc y next build finalizan con exit 0; las 4 pruebas H69 en PatrullaDetailPage.test.tsx pasan aisladamente sin depender de otro describe	tsc falla (6 errores en 4 archivos, exit 2); next build falla (Failed to type check, exit 1); ejecución filtrada H69 falla 4/4 por useConnectivity undefined	ABIERTO	12/11/2026 12:18	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H69-PWA-02	Control RBAC en botón "Rechazar Misión" (CA-5) y manejo de cabecera/errores HTTP en rechazarMision	Seguridad / RBAC	Integración / Componentes	Alta	Usuario autenticado sin permiso misiones:terreno:verificar o con rol DELEGADO_CUADRILLA accediendo a /patrulla/misiones/[id]	Sesión con permisos: [] o rolCodigo: DELEGADO_CUADRILLA y misión DESPACHADA; revisión de apiClient.POST en misionesService.ts	El botón "Rechazar Misión" permanece oculto sin esPatrulla && tienePermiso(misiones:terreno:verificar); apiClient.POST delega JWT sin authorization vacío y arroja MisionServiceError	esRechazable omite validación de rol y permiso (PatrullaDetailPage.tsx:164-166), exponiendo el botón; misionesService.ts:320 envía authorization vacío y lanza Error genérico	ABIERTO	12/11/2026 12:19	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H69-PWA-03	Navegación directa desde alerta en tiempo real (NuevaMisionBanner) hacia detalle de misión con "Rechazar Misión" (CA-1)	Funcional / Navegación	Integración / Componentes	Alta	next.config.ts configurado con basePath "/terreno" y evento mision:asignada recibido	misionId: mis-42, urlDetalle: /terreno/patrulla/misiones/mis-42 pasado a router.push(...)	router.push recibe ruta relativa /patrulla/misiones/mis-42 para resolver a /terreno/patrulla/misiones/mis-42	NuevaMisionBanner, PatrullaMisionesPage y TerrenoHomePage pasan /terreno/patrulla/misiones/..., provocando doble prefijo /terreno/terreno/... (HTTP 404)	ABIERTO	12/11/2026 12:20	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H69-PWA-04	Sincronización de ConnectionStatusBadge, bandera sincronizacionPendiente, captura de red en WebKit y manejo de conflicto 409/422 en outbox	Offline-First / Resiliencia	Integración / Hook	Alta	Patrulla offline o con corte de red ejecutando rechazo motivado y posterior reconexión	navigator.onLine = false o TypeError("Load failed"); respuesta servidor 409 Conflict al drenar outbox en useConnectivity	ConnectionStatusBadge incrementa pendientes de inmediato; MisionLocal marca sincronizacionPendiente: true; WebKit encola en outbox; 409/422 no confirma falsamente estado local	handleConfirmarRechazo no llama actualizarPendientes(); no marca sincronizacionPendiente: true; Load failed no coincide con Failed; useConnectivity ignora RECHAZAR_MISION y revierte fix de 409/422	ABIERTO	12/11/2026 12:19	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H69-PWA-05	Aislamiento multi-patrulla, ausencia de datos ficticios post-rechazo y preservación de ciclo de vida de sesión	Integridad de Datos / Concurrencia	Integración / Servicios	Alta	Patrulla rechaza su única misión activa (locales.length === 0) o consulta ID inexistente/ajeno	sincronizarMisiones sin patrullaId, obtenerDetalleMision("id-ajeno") retornando null	Bandeja muestra estado vacío "La patrulla se encuentra disponible para despacho"; detalle inexistente muestra error/404; IndexedDB purga misiones al cerrar sesión	PatrullaMisionesPage:77-98 y PatrullaDetailPage:66-79 inyectan misiones ficticias DESPACHADA; se perdieron patrullaId, limpiarMisionesLocales y useTerrenoSocket en merge	ABIERTO	12/11/2026 12:20	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H69-PWA-06	Handshake JWT en cliente Socket.io (client.ts) y documentación detallada del contrato POST /api/misiones/{id}/rechazar	Tiempo Real / Documentación	Integración / Documentación	Media	Variables NEXT_PUBLIC_SOCKET_URL y NEXT_PUBLIC_API_URL vacías en .env.local; revisión de docs/api/	Inspección de src/lib/socket/client.ts y docs/api/contratos-terreno.md	getSocket() usa window.location.origin y envía { auth: { token } } según contrato; docs/api/ detalla payload, códigos y evento mision:rechazada	client.ts cae a http://localhost:4001 sin auth.token; contratos-terreno.md solo incluye resumen en tabla sin especificación completa ni existe docs/api/misiones.md	ABIERTO	12/11/2026 12:20	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H69-PWA-01	Validación Zod de justificacion_rechazo vacía o solo espacios en blanco (Regla Crítica §3.3)	Funcional / Validación	Unitaria	Crítica	Esquema rechazoMisionSchema importado desde src/lib/validations/misiones.ts	{ justificacion_rechazo: "" } y { justificacion_rechazo: "   ab  " }	safeParse retorna success: false con mensaje "La justificación de rechazo debe contener al menos 5 caracteres."	misiones.test.ts verifica rechazo de cadena vacía y "   ab  " tras trim()	APROBADO	12/11/2026 12:21	N/A	feat(api): agregar contrato y validacion zod para rechazo motivado de mision
CP-H69-PWA-02	Validación límite inferior exacto: 4 caracteres inválidos vs 5 caracteres válidos en rechazoMisionSchema	Funcional / Valores Límite	Unitaria	Crítica	Esquema rechazoMisionSchema y servicio rechazarMision	{ justificacion_rechazo: "1234" } vs { justificacion_rechazo: "Falla" }	4 caracteres rechazados (success: false); 5 caracteres aceptados (success: true) con coordenadas GPS opcionales	misiones.test.ts aprueba 5/5 casos límite y rechazarMision rechaza " abc " y "   " antes de invocar red	APROBADO	12/11/2026 12:21	N/A	feat(api): agregar contrato y validacion zod para rechazo motivado de mision
CP-H69-PWA-03	Despliegue obligatorio de RechazoMisionModal con título, código de misión, contador en tiempo real y botón inicialmente deshabilitado	UI / UX / Funcional	Componentes	Alta	RechazoMisionModal renderizado con abierto={true} y codigoMision="INC-2026-0042"	Prop abierto={false} vs abierto={true}; texto "", "   abc  " (3/5) y "Falla" (5/5)	Oculto si abierto=false; visible con role="dialog", contador 0 / 5 caracteres mín. y botón "Confirmar Rechazo" deshabilitado hasta alcanzar >= 5 caracteres	RechazoMisionModal.test.tsx valida render condicional, contador dinámico tras trim() y activación exacta al llegar a 5 caracteres	APROBADO	12/11/2026 12:21	N/A	feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69)
CP-H69-PWA-04	Retroalimentación visual de error al perder el foco (onBlur) con justificación insuficiente	UI / Accesibilidad	Componentes	Media	Modal RechazoMisionModal abierto en pantalla	Ingresar "No" y disparar evento blur en textarea justificacion-rechazo-input	Muestra alerta role="alert" con "La justificación debe contener al menos 5 caracteres." y aria-invalid="true"	RechazoMisionModal.test.tsx verifica despliegue del mensaje accesible al perder foco	APROBADO	12/11/2026 12:21	N/A	feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69)
CP-H69-PWA-05	Captura transparente y no bloqueante de coordenadas GPS al confirmar rechazo en RechazoMisionModal	Hardware / Geolocation	Componentes	Media	Navegador con navigator.geolocation.getCurrentPosition activo o denegado	coords: { latitude: -39.8142, longitude: -73.2458 }; motivo "Desperfecto mecánico en vehículo"	Invoca alConfirmar con texto trimmed y { lat: -39.8142, lng: -73.2458 }; si no hay GPS permite enviar sin bloquear	RechazoMisionModal.test.tsx confirma envío de texto y coordenadas GPS mockeadas	APROBADO	12/11/2026 12:21	N/A	feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69)
CP-H69-PWA-06	Manejo de error HTTP desde API dentro del modal y cierre con botón "Cancelar" o tecla Escape	Funcional / Manejo de Errores	Componentes	Alta	Modal abierto con promesa alConfirmar rechazada o interacción de cancelación	mockRejectedValueOnce(new Error("La misión ya se encuentra en curso.")); evento keydown Escape	Despliega caja role="alert" con el mensaje del servidor sin cerrar el modal; Cancelar o Escape ejecutan alCancelar	RechazoMisionModal.test.tsx verifica 9/9 aserciones (278ms)	APROBADO	12/11/2026 12:21	N/A	feat(patrulla): implementar modal de rechazo motivado e integrar en detalle de mision (H69)
CP-H69-PWA-07	Invocación online a POST /api/misiones/{id}/rechazar y actualización local a RECHAZADA en misionesService	Integración / API Client	Servicios	Crítica	navigator.onLine = true y respuesta simulada 200 OK acorde al contrato OpenAPI	id: "mis-001", body: { justificacion_rechazo: "Desperfecto mecánico en vehículo", latitud: -39.8142, longitud: -73.2458 }	Llama apiClient.POST(/api/misiones/{id}/rechazar), actualiza IndexedDB (estado: RECHAZADA) y retorna exito: true	misionesService.test.ts verifica ruta OpenAPI, payload y persistencia en offlineQueue.guardarMisionLocal	APROBADO	12/11/2026 12:21	N/A	feat(misiones): implementar servicio de rechazo con soporte offline y outbox en misionesService
CP-H69-PWA-08	Rechazo de propagación ante respuesta de error 409 Conflict / 400 Bad Request en rechazarMision online	Negativa / Concurrencia	Servicios	Alta	navigator.onLine = true y misión en estado EN_CURSO en servidor	response: { ok: false, status: 409 }, error: { message: "La misión no se encuentra en estado DESPACHADA." }	Lanza excepción sin encolar en outbox ni sobreescribir el estado local a RECHAZADA	misionesService.test.ts confirma rechazo de promesa con el mensaje de conflicto 409	APROBADO	12/11/2026 12:21	N/A	feat(misiones): implementar servicio de rechazo con soporte offline y outbox en misionesService
CP-H69-PWA-09	Encolamiento offline (RECHAZAR_MISION) en IndexedDB outbox cuando navigator.onLine === false	Offline-First / Persistencia	Servicios	Alta	Dispositivo sin conectividad (navigator.onLine = false) y misión local en IndexedDB	id: "mis-001", justificacion_rechazo: "Corte de ruta total por derrumbe"	Encola { tipo: RECHAZAR_MISION, url: /api/misiones/mis-001/rechazar, metodo: POST }, actualiza local a RECHAZADA y retorna modoOffline: true	misionesService.test.ts aprueba aserciones de encolarAccionOutbox y actualización local	APROBADO	12/11/2026 12:21	N/A	feat(misiones): implementar servicio de rechazo con soporte offline y outbox en misionesService
CP-H69-PWA-10	Integración visual en PatrullaMisionDetailPage: recuadro "Acciones de Despacho", flujo completo de rechazo, modo solo lectura y banner post-rechazo	Funcional / E2E Simulado	Componentes	Alta	PatrullaDetailPage montada con misión DESPACHADA, unidad inactiva o misión RECHAZADA	Misión mis-desp-1 (INC-2026-00100), motivo "Desperfecto mecánico en radiador"	Muestra botón "Rechazar Misión", oculta controles si unidadActiva=false, muestra banner "Misión Rechazada por Patrulla Verificadora" con motivo	En ejecución conjunta (PatrullaDetailPage.test.tsx), 8/8 tests aprueban (387ms) verificando flujo completo y estado RECHAZADA	APROBADO	12/11/2026 12:21	N/A	refactor(terreno): unificar tarjeta de acciones de despacho y sintetizar textos operativos
CP-H69-PWA-11	Suscripción WebSocket en tiempo real (useMisionesSocket) a sala patrulla:{id}, eventos mision:asignada / mision:rechazada y vibración háptica	Tiempo Real / Hardware	Integración / Hook	Media	Usuario patrulla con unidadId: "pat-100" y cliente Socket.io mockeado	Evento mision:asignada para pat-100 vs pat-OTRA-999; desmontaje del hook	Se une a patrulla:pat-100, filtra unidades ajenas, activa navigator.vibrate([200, 100, 200]), escucha mision:rechazada y abandona sala al desmontar	useMisionesSocket.test.ts aprueba 4/4 pruebas unitarias	APROBADO	12/11/2026 12:18	N/A	feat(realtime): implementar cliente socket.io y hook useMisionesSocket para terreno (H35)
CP-H69-PWA-12	Cumplimiento de diseño plano institucional (Flat UI, esquinas rectas 0px, mínimo táctil 48px, Noto Sans, lucide-react y cero emojis)	UI / Estándar Visual	Estática / CSS	Media	Código fuente en src/ incluyendo RechazoMisionModal.module.css, PatrullaDetailPage.module.css y Button.module.css	Búsqueda regex de emojis en src/ y revisión de tokens CSS	0 emojis en src/; border-radius: 0; box-shadow: none; min-height: 48px en .md / 54px en .lg; textos sin jerga interna (§3.3)	NO_EMOJIS_IN_SRC; CSS de modal y detalle cumple esquinas rectas, diseño plano y objetivos táctiles >= 48px	APROBADO	12/11/2026 12:19	N/A	fix(ui): eliminar referencias a secciones internas (§3.3, §3.7) en textos dirigidos al usuario
CP-H69-PWA-13	Análisis estático ESLint sobre la base de código completa	Estática / Calidad	Sistema	Media	Proyecto en rama feature/H69-rechazo-mision-patrulla	Comando npm run lint	Finaliza con exit code 0 y 0 errores de ESLint	npm run lint termina con exit 0, 0 errors y 4 advertencias preexistentes (no-location-assign-relative-destination)	APROBADO	12/11/2026 12:18	N/A	refactor(terreno): unificar tarjeta de acciones de despacho y sintetizar textos operativos
CP-H69-PWA-14	Manual de usuario operativo H69 con secciones obligatorias de modo sin conexión y permisos GPS (AGENTS.md §5)	Documentación	Documental	Media	Archivo docs/manuals/H69-rechazo-mision-patrulla.md	Revisión estructural frente a AGENTS.md §5 y RechazoMisionModal.tsx	Contiene propósito, pasos con textos reales de UI, sección Comportamiento sin Conexión y permisos de hardware GPS	Manual completo de 87 líneas con secciones de permisos GPS, pasos de UI y arquitectura Offline-First	APROBADO	12/11/2026 12:18	N/A	docs(manuals): agregar manual de usuario para rechazo motivado de patrulla verificadora (H69)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencia Replicable

### 5.1 Suite completa y subconjunto dirigido de HU-69 (Vitest)

Ejecutar la suite completa del proyecto:

```bash
npm test -- --run
```

Salida observada:

```text
 Test Files  33 passed (33)
      Tests  126 passed (126)
   Start at  12:17:40
   Duration  6.92s (transform 5.94s, setup 12.24s, collect 16.14s, tests 8.71s, environment 39.79s, prepare 4.55s)
```

Ejecutar los 4 archivos de pruebas vinculados a HU-69:

```bash
npx vitest run \
  src/lib/validations/misiones.test.ts \
  src/components/misiones/__tests__/RechazoMisionModal.test.tsx \
  src/services/__tests__/misionesService.test.ts \
  "src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx"
```

Salida observada:

```text
 ✓ src/lib/validations/misiones.test.ts (5 tests) 6ms
 ✓ src/services/__tests__/misionesService.test.ts (13 tests) 23ms
 ✓ src/components/misiones/__tests__/RechazoMisionModal.test.tsx (9 tests) 278ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx (8 tests) 387ms

 Test Files  4 passed (4)
      Tests  35 passed (35)
   Start at  12:21:00
   Duration  1.94s (transform 493ms, setup 618ms, collect 1.03s, tests 694ms, environment 2.65s, prepare 328ms)
```

### 5.2 Ejecución filtrada por nombre de suite (`npm test -- -t "..."`)

```bash
npm test -- -t "rechazarMision"
npm test -- -t "rechazoMisionSchema"
npm test -- -t "RechazoMisionModal"
npm test -- -t "H69 — Rechazo Motivado de Misión"
```

Salidas observadas:

- `-t "rechazarMision"`: `1 passed | 32 skipped (33)` test files, `4 passed | 122 skipped (126)` tests (`18ms`).
- `-t "rechazoMisionSchema"`: `1 passed | 32 skipped (33)` test files, `5 passed | 121 skipped (126)` tests (`7ms`).
- `-t "RechazoMisionModal"`: `1 passed | 32 skipped (33)` test files, `9 passed | 117 skipped (126)` tests (`462ms`).
- `-t "H69 — Rechazo Motivado de Misión"`: **FALLIDO** (`1 failed | 1 passed | 31 skipped (33)`, `4 failed | 9 passed | 113 skipped (126)`):

```text
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx > PatrullaMisionDetailPage (H69 — Rechazo Motivado de Misión) > muestra el botón "Rechazar Misión" y el recuadro unificado de acciones de despacho cuando la misión está DESPACHADA
 FAIL  src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx > PatrullaMisionDetailPage (H69 — Rechazo Motivado de Misión) > abre el modal de rechazo y permite rechazar motivadamente la misión con >= 5 caracteres
 FAIL  src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx > PatrullaMisionDetailPage (H69 — Rechazo Motivado de Misión) > no muestra el botón "Rechazar Misión" si la unidad está inactiva y muestra aviso de solo lectura
 FAIL  src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx > PatrullaMisionDetailPage (H69 — Rechazo Motivado de Misión) > muestra el banner descriptivo si la misión ya fue rechazada previamente
TypeError: Cannot destructure property 'status' of '(0 , useConnectivity)(...)' as it is undefined.
 ❯ PatrullaMisionDetailPage src/app/(terreno)/patrulla/misiones/[id]/page.tsx:47:11
```

### 5.3 Verificación de tipos TypeScript, Build de producción y ESLint

```bash
npx tsc --noEmit
npm run build
npm run lint
```

Salidas observadas:

```text
src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx:40:56 - error TS2345: ... is missing the following properties from type 'AuthContextValue': tieneUnidadAsignada, estadoAsignacion
src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx:290:58 - error TS2345: ... is missing the following properties from type 'AuthContextValue': tieneUnidadAsignada, estadoAsignacion
src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx:386:58 - error TS2345: ... is missing the following properties from type 'AuthContextValue': tieneUnidadAsignada, estadoAsignacion
src/app/(terreno)/patrulla/misiones/[id]/page.tsx:249:11 - error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
src/app/(terreno)/patrulla/misiones/__tests__/PatrullaMisionesPage.test.tsx:70:58 - error TS2345: ... is missing the following properties from type 'AuthContextValue': tieneUnidadAsignada, estadoAsignacion
src/lib/validations/misiones.ts:11:7 - error TS2769: ... 'errorMap' does not exist in type ...

Found 6 errors in 4 files.
```

- `npm run build`: exit code `1` (`Failed to type check.`).
- `npm run lint`: exit code `0`, `0 errors` y `4 warnings` en `@next/next/no-location-assign-relative-destination` (`src/app/(auth)/login/page.tsx:51`, `src/app/(terreno)/page.tsx:32`, `src/context/AuthContext.tsx:146`, `src/lib/api/client.ts:47`).

### 5.4 Verificación estática de emojis en `src/`

```bash
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS_IN_SRC"
```

Salida observada: `NO_EMOJIS_IN_SRC`.

### 5.5 Evidencia cURL sobre entorno local (`:3001` y `:3002`) y comandos de validación de contrato

Sondeo ejecutado el `12/11/2026 12:21 -03:00`:

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST \
  http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{}'
```

Respuesta real observada (`:3001` activo en rama `feature/h35`):

```json
{"error":"Datos de autenticación inválidos","details":{"identificador":["Invalid input: expected string, received undefined"],"password":["Invalid input: expected string, received undefined"]}}
HTTP_STATUS:400
```

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST \
  http://localhost:3001/api/misiones/00000000-0000-4000-8000-000000000001/rechazar \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecanico"}' | tail -n 5

curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  http://localhost:3002/terreno/patrulla/misiones | tail -n 5
```

Salidas observadas:
- `POST http://localhost:3001/api/misiones/.../rechazar`: `HTTP_STATUS:404` (el proceso corriendo en `:3001` corresponde a una rama previa sin la ruta `/rechazar`).
- `GET http://localhost:3002/terreno/patrulla/misiones`: `HTTP_STATUS:000` (el servidor de `sgrai-pwa` en `:3002` no se encuentra levantado ni puede compilarse para producción debido a `BUG-H69-PWA-01`).

Comandos de validación de contrato `POST /api/misiones/{id}/rechazar` para ejecución contra instancia `sgrai-api` con rama `feature/H69-rechazo-mision-patrulla` desplegada:

```bash
# 1. Autenticación de Patrulla Verificadora
TOKEN=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"patrulla@valdivia.cl","password":"Password123!"}' | jq -r '.data.token // .token')

# 2. Caso negativo: justificación con 4 caracteres (esperado: 400 Bad Request)
curl -i -s -X POST "http://localhost:3001/api/misiones/${MISION_ID}/rechazar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"abcd"}'

# 3. Caso negativo: petición sin credenciales (esperado: 401 Unauthorized)
curl -i -s -X POST "http://localhost:3001/api/misiones/${MISION_ID}/rechazar" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en radiador"}'

# 4. Caso positivo: justificación >= 5 caracteres con coordenadas GPS (esperado: 200 OK)
curl -i -s -X POST "http://localhost:3001/api/misiones/${MISION_ID}/rechazar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Desperfecto mecánico en radiador","latitud":-39.81422,"longitud":-73.24589}'
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación / Regla (HU-69) | Responsabilidad Arquitectónica | Cobertura en `sgrai-pwa` | Estado | Referencia |
|---|---|---|---|---|
| **CA-1:** Opción visible `'Rechazar Misión'` al recibir notificación de nueva misión en la PWA | `sgrai-pwa` (`PatrullaDetailPage`, `NuevaMisionBanner`, `useMisionesSocket`) | Botón visible en `/patrulla/misiones/[id]`, pero navegación desde `NuevaMisionBanner` falla (`404`) por doble prefijo `/terreno/terreno/` | **Observado (Bloqueado)** | `BUG-H69-PWA-03`, `CP-H69-PWA-10`, `CP-H69-PWA-11` |
| **CA-2:** Modal obligatorio con `justificacion_rechazo` $\ge 5$ caracteres (§3.3) y bloqueo de envío inválido | `sgrai-pwa` (`RechazoMisionModal`, `rechazoMisionSchema`) | Validación UI en tiempo real y bloqueo correcto en modal; esquema Zod con sintaxis obsoleta de Zod v4 rompe `tsc --noEmit` | **Observado (Bloqueado)** | `BUG-H69-PWA-01`, `CP-H69-PWA-01` .. `CP-H69-PWA-06` |
| **CA-3:** Transacción atómica (`RECHAZADA`, `justificacion_rechazo`, `patrulla = DISPONIBLE`, `incidente = REPORTADO`) | `sgrai-api` (Backend) + sincronización en `sgrai-pwa` | Contrato OpenAPI `POST /api/misiones/{id}/rechazar` consumido en `misionesService.ts`; persisten fallos de sincronización offline (`outbox`) e inyección de datos ficticios al quedar vacía la bandeja | **Observado (Bloqueado)** | `BUG-H69-PWA-04`, `BUG-H69-PWA-05`, `CP-H69-PWA-07` .. `CP-H69-PWA-09` |
| **CA-4:** Emisión WebSocket `mision:rechazada` hacia sala `encargado` | `sgrai-api` (emisión) + `sgrai-pwa` (escucha en sala de unidad) | `useMisionesSocket` escucha `mision:rechazada` en `patrulla:{id}`, pero `client.ts` cae a `localhost:4001` sin `auth.token` y `useTerrenoSocket` fue eliminado en merge | **Observado (Bloqueado)** | `BUG-H69-PWA-05`, `BUG-H69-PWA-06`, `CP-H69-PWA-11` |
| **CA-5:** Validación de autenticación de patrulla verificadora en `POST /api/misiones/{id}/rechazar` | `sgrai-api` (Auth/RBAC) + `sgrai-pwa` (Gating UI/cliente) | `esRechazable` en `PatrullaDetailPage` omite validar `esPatrulla` y permiso `misiones:terreno:verificar`; `rechazarMision` envía `authorization: ''` y no usa `MisionServiceError` | **Observado (Bloqueado)** | `BUG-H69-PWA-02`, `CP-H69-PWA-08` |
| **Calidad, Build, Ergonomía Terreno y Documentación (`AGENTS.md`)** | `sgrai-pwa` | `0` emojis, Flat UI `0px`, mínimo táctil `48px`, `lint` sin errores y manual `H69` completo; falla `tsc`/`next build` y falta detalle en `docs/api/` | **Observado (Bloqueado)** | `BUG-H69-PWA-01`, `BUG-H69-PWA-06`, `CP-H69-PWA-12` .. `CP-H69-PWA-14` |


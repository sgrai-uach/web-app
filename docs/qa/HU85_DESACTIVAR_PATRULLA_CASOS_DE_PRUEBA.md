# Auditoría Técnica y Matriz de Casos de Prueba — HU-[85]: Desactivar Patrulla (Cliente Terreno `sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `revert-2-feature/H85-desactivar-patrulla` (lista para integración hacia `develop`)  
**Historia de Usuario:** HU-[85] — Desactivar Patrulla Verificadora (baja lógica §3.7 y comportamiento en terreno)  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `11/11/2026 11:41 -03:00`  
**Fecha y Hora de Ciclo Re-Test Final:** `12/11/2026 11:49 -03:00`  
**Entorno de Ejecución Re-Test:** Linux, Node.js, Vitest v3.2.7, Next.js 16.3.4 (Turbopack), ESLint, TypeScript (`tsc --noEmit`)  
**Dictamen de Auditoría Final:** **APROBADO PARA INTEGRACIÓN EN `develop` (`7` de `7` defectos corregidos; `24` de `24` casos en estado `APROBADO`)**

---

## Alcance Arquitectónico en `sgrai-pwa`

De acuerdo con la separación de responsabilidades de SGRAI, la acción administrativa **'Desactivar Patrulla'**, su modal de confirmación y la mutación `DELETE /api/patrullas/[id]` (soft delete `activo = false`, `eliminado_en = CURRENT_TIMESTAMP`, liberación de vehículo/personal y rechazo `409 Conflict` ante misiones activas o estado `EN_VERIFICACION`) pertenecen a `sgrai-web` y `sgrai-api`.

En el cliente de terreno `sgrai-pwa` (cuyo alcance se restringe a los roles `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA`), la implementación aprobada cubre la contraparte operativa en campo ante la baja lógica o ausencia de asignación de la unidad:

- Mapeo de `unidadId`, `unidadNombre`, `delegacionNombre` y `unidadActiva` en `AuthContext` usando tipos generados desde OpenAPI (`api-generated.d.ts`), discriminando `ACTIVA`, `DESACTIVADA` y `SIN_ASIGNACION`.
- Escucha en tiempo real (`useTerrenoSocket`) para reaccionar a `patrulla:desactivada` y `cuadrilla:desactivada` filtrando por `patrullaId`/`cuadrillaId`/`id`, invalidación de sesión ante HTTP `401`/`403` y protección de cola offline ante rechazos `409`/`422`.
- Visualización de banners diferenciados (`UnidadInactivaBanner` y `SinUnidadBanner`) en el hub `/terreno`, listados de misiones de patrulla/cuadrilla y detalle de misión, sin datos ficticios hardcodeados y filtrando por `patrullaId`/`cuadrillaId`.
- Registro y consulta local del historial de unidades asignadas (`historial_unidades_<usuarioId>`) en `/terreno/perfil`.
- Manual de usuario `docs/manuals/H85-patrulla-desactivada-terreno.md` alineado con los textos reales de interfaz.

---

## 1. Resumen Ejecutivo

Tras completar el ciclo final de **Re-Test** (`12/11/2026 11:49`), se comprobó la subsanación íntegra de los **7 defectos** identificados durante la auditoría (`BUG-H85-PWA-01` Crítico, `BUG-H85-PWA-02`, `BUG-H85-PWA-03` y `BUG-H85-PWA-04` Altos, y `BUG-H85-PWA-05`, `BUG-H85-PWA-06` y `BUG-H85-PWA-07` Medios).

La compilación estricta de TypeScript (`npx tsc --noEmit`) y el empaquetado productivo de Next.js (`npm run build`) finalizan sin errores, ESLint concluye con `0` errores y la suite completa de Vitest alcanza `99` pruebas aprobadas en `28` archivos (`12` suites y `48` pruebas directamente asociadas a HU-85, conectividad y Socket.io).

| Indicador / Verificación | Auditoría Inicial (11/11/2026) | Re-Test Final (12/11/2026) | Observación Técnica |
|---|---|---|---|
| Total de casos en matriz (HU-85 PWA) | `21` casos | `24` casos | `7` defectos `CORREGIDO`/`APROBADO` + `17` casos `APROBADO` (`0` abiertos) |
| Defectos abiertos por severidad | `1` Crítica, `3` Alta, `2` Media | `0` Crítica, `0` Alta, `0` Media | Subsanados todos los defectos bloqueantes, altos y medios |
| Suite automatizada completa (`npm test`) | `27` archivos / `92` tests (`4.58s`) | `28` archivos / `99` tests (`16.63s`) | Incluye nueva suite `useTerrenoSocket.test.ts` (`3`) y verificación `SIN_ASIGNACION` en cuadrilla |
| Subconjunto H85 y servicios (`npx vitest run`) | `9` archivos / `29` tests (`2.07s`) | `12` archivos / `48` tests (`2.43s`) | `AuthContext`, `perfilTerrenoService`, `misionesService`, `useConnectivity`, `useTerrenoSocket`, vistas y banners |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `4` advertencias | `0` errores, `4` advertencias | Advertencias preexistentes `@next/next/no-location-assign-relative-destination` |
| Verificación de tipos (`npx tsc --noEmit`) | **FALLIDO** (exit `2`, `TS2345`) | **APROBADO** (`0` errores, exit `0`) | Tipado estricto validado sin errores ni uso de `any` |
| Build de producción (`npm run build`) | **FALLIDO** (exit `1`) | **APROBADO** (exit `0`, TS en `2.5s`) | Compilación (`1341ms`) y prerenderizado estático (`8/8`) completados |
| Prohibición de emojis en UI (`src/`) | Aprobado (`0` coincidencias) | Aprobado (`0` coincidencias) | Verificado mediante búsqueda de rangos Unicode en `src/` |

---

## 2. Registro Técnico de Defectos y Verificación de Subsanación (Re-Test Final)

### BUG-H85-PWA-01 — Fallo de compilación TypeScript y build de producción por mock incompleto de `AuthContextValue`
- **Severidad:** Crítica (Bloqueante de build y despliegue)
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026)**
- **Archivos afectados:**
  - `src/context/AuthContext.tsx` (líneas 63–78)
  - `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx` (líneas 29–75, 273–324)
- **Verificación:**
  - `configurarAuthMock` en `PatrullaDetailPage.test.tsx` incorpora `tieneUnidadAsignada`, `estadoAsignacion` y `unidadId`, más `2` casos que validan el bloqueo operativo en `DESACTIVADA` y `SIN_ASIGNACION`.
  - `npx tsc --noEmit` finalizó con exit code `0` y `npm run build` completó exitosamente (`exit code 0`).

---

### BUG-H85-PWA-02 — Fuga multi-patrulla, inyección de misiones ficticias y persistencia residual en IndexedDB
- **Severidad:** Alta
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026)**
- **Archivos afectados:**
  - `src/app/(terreno)/patrulla/misiones/page.tsx` y `src/app/(terreno)/cuadrilla/misiones/page.tsx`
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` y `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx`
  - `src/components/terreno/TerrenoResumenOperativo.tsx` y `src/components/terreno/TerrenoSiguienteMision.tsx`
  - `src/services/perfilTerrenoService.ts`, `src/services/misionesService.ts`, `src/services/offlineQueue.ts` y `src/context/AuthContext.tsx`
- **Verificación:**
  - Todas las vistas de patrulla/cuadrilla, resumen operativo, siguiente misión y métricas de perfil filtran por `patrullaId` o `cuadrillaId` usando `usuario.unidadId` y omiten la sincronización cuando `!tieneUnidadAsignada` / `SIN_ASIGNACION`.
  - Retiradas todas las misiones ficticias hardcodeadas; `misionesService.ts` invoca `limpiarMisionesLocales()` antes de persistir remotas y `AuthContext.tsx` invoca `limpiarAlmacenamientoOffline()` en `logout()` y ante HTTP `401`/`403`.

---

### BUG-H85-PWA-03 — Desincronización con OpenAPI (`api-generated.d.ts`), casts forzados y pérdida de `delegacionNombre`
- **Severidad:** Alta
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026)**
- **Archivos afectados:**
  - `src/types/api-generated.d.ts` (líneas 9144–9208, 9267–9341)
  - `src/types/seguridad.ts` (líneas 19–23)
  - `src/services/seguridadService.ts` (líneas 65, 93)
  - `src/context/AuthContext.tsx` (líneas 108–109)
- **Verificación:**
  - `api-generated.d.ts` incluye `delegacionNombre`, `unidadId`, `unidadNombre` y `unidadActiva` en los esquemas de seguridad y `activo`, `eliminadoEn` y `eliminadoPorId` en `/api/patrullas/{id}`.
  - `seguridad.ts` consume directamente `components['schemas']` y `seguridadService.ts` prescinde de casts forzados.

---

### BUG-H85-PWA-04 — Sesión obsoleta tras baja remota, bypass de estado ante HTTP 401/403 y confirmación optimista indebida en outbox HTTP 409/422
- **Severidad:** Alta
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026)**
- **Archivos afectados:**
  - `src/hooks/useTerrenoSocket.ts` y `src/app/(terreno)/layout.tsx`
  - `src/context/AuthContext.tsx` (líneas 271–293)
  - `src/hooks/useConnectivity.ts` (líneas 71–97)
- **Verificación:**
  - `useTerrenoSocket()` queda activo en `TerrenoLayout`, `recargarSesion` invalida caché/IndexedDB/cookie ante `401`/`403`, y `useConnectivity` solo transiciona localmente a `EN_CURSO` cuando `res.ok` es verdadero.

---

### BUG-H85-PWA-05 — Colisión por nombre en historial de patrullas, registro tardío en `/perfil` y omisión de delegación en tarjetas
- **Severidad:** Media
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026)**
- **Archivos afectados:**
  - `src/services/perfilTerrenoService.ts` (línea 52)
  - `src/context/AuthContext.tsx` (líneas 36, 268–270, 300–302)
  - `src/app/(terreno)/perfil/page.tsx` (líneas 210–215)
- **Verificación:**
  - `registrarPatrullaEnHistorial` indexa por `item.unidadId === usuario.unidadId`, el registro se dispara al iniciar/hidratar sesión y las tarjetas de historial en `/terreno/perfil` muestran `item.delegacion`.

---

### BUG-H85-PWA-06 — Contaminación de etiquetas `DESACTIVADA` sobre `SIN_ASIGNACION`/SSR, variable CSS inexistente y desfase de copy con manual
- **Severidad:** Media
- **Estado:** **CORREGIDO (Verificado en Re-Test Final — 12/11/2026 11:49)**
- **Archivos corregidos:**
  - `src/components/terreno/TerrenoBottomNav.tsx`, `src/components/terreno/TerrenoSiguienteMision.tsx`, `src/components/terreno/TerrenoResumenOperativo.tsx`
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 38–44, 150) y `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (líneas 23–28, 75): los enlaces de retorno utilizan `estadoAsignacion === 'DESACTIVADA' ? 'Historial' : 'Misiones'` / `'Faenas'`.
  - `src/app/(terreno)/cuadrilla/misiones/page.tsx` (líneas 161–168) y `src/app/(terreno)/cuadrilla/misiones/__tests__/CuadrillaMisionesPage.test.tsx` (líneas 93–101): `emptyState` discrimina `!tieneUnidadAsignada` mostrando `"El funcionario no posee una cuadrilla asignada. Solicite su asignación en el Centro de Mando."` con aserción automatizada verificada.
  - `src/app/(terreno)/perfil/PerfilPage.module.css` (líneas 43, 59, 108, 157), `src/components/common/UnidadInactivaBanner.module.css` (línea 3) y `src/components/common/SinUnidadBanner.module.css` (línea 3): migrados completamente a `var(--border-color-neutral, #DFE3E8)` (`0` coincidencias de `color-border` en módulos H85).
  - `docs/manuals/H85-patrulla-desactivada-terreno.md` (línea 38): cita de `<SinUnidadBanner />` homologada literalmente con `SinUnidadBanner.tsx`.

---

### BUG-H85-PWA-07 — Desajuste de identificador en payload Socket.io (`data?.id` vs `patrullaId`) y ausencia de pruebas unitarias para `useTerrenoSocket.ts`
- **Severidad:** Media
- **Estado:** **CORREGIDO (Verificado en Re-Test Final — 12/11/2026 11:49)**
- **Archivos corregidos / agregados:**
  - `src/hooks/useTerrenoSocket.ts` (líneas 48–59): incorpora interfaz tipada `DesactivacionPayload` (`id?`, `patrullaId?`, `cuadrillaId?`) y valida `const unidadPayloadId = data?.patrullaId ?? data?.cuadrillaId ?? data?.id` antes de invocar `recargarSesion()`, evitando recargas globales ante desactivaciones de otras unidades.
  - `src/hooks/__tests__/useTerrenoSocket.test.ts` (nuevo): agrega `3` pruebas unitarias verificando omisión de conexión sin `token`/`unidadId`, suscripción a salas `patrulla:{id}`/`cuadrilla:{id}`, recarga selectiva ante `patrullaId`/`cuadrillaId`/`id` coincidente, rechazo de eventos para otras unidades y limpieza completa (`off`, `leave`, `salir`, `disconnect`) al desmontar.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-H85-PWA-06 | Discriminación visual `ACTIVA` vs `DESACTIVADA` vs `SIN_ASIGNACION`, tokens CSS y alineación con manual H85 | UI / UX / Documentación | Componentes / SSR | Media | Vistas de detalle, listado de cuadrilla, hojas CSS de perfil/banner y manual H85 | Inspección de `patrulla/misiones/[id]`, `cuadrilla/misiones/[id]`, `cuadrilla/misiones`, `PerfilPage.module.css`, `UnidadInactivaBanner.module.css` y `H85-patrulla-desactivada-terreno.md` | Enlaces de detalle solo muestran `Historial` bajo `DESACTIVADA`; `emptyState` discrimina `!tieneUnidadAsignada`; uso uniforme de `--border-color-neutral`; manual homologado | Enlaces en detalle restringen `Historial` a `DESACTIVADA`; `CuadrillaMisionesPage.test.tsx` valida mensaje de `SIN_ASIGNACION` (`22ms`); `0` usos de `--color-border` en H85; manual alineado | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85) |
| BUG-H85-PWA-07 | Filtrado por `patrullaId`/`cuadrillaId` en `useTerrenoSocket.ts` y cobertura de pruebas unitarias del hook (`AGENTS.md §4`) | Tiempo Real / Unitaria | Integración / Unitaria | Media | Hook `src/hooks/useTerrenoSocket.ts` con soporte tipado y suite en `src/hooks/__tests__/useTerrenoSocket.test.ts` | Eventos mock `patrulla:desactivada` (`patrullaId: pat-otra` vs `pat-123`) y `cuadrilla:desactivada` (`cuadrillaId`/`id`) | Ignora bajas de unidades ajenas; recarga sesión si coincide `patrullaId`/`cuadrillaId`/`id`; limpia listeners y salas al desmontar | `useTerrenoSocket.test.ts` aprueba `3/3` casos en `23ms` (`32ms` en ejecución filtrada); `npm run lint` y `tsc --noEmit` sin errores | APROBADO | 12/11/2026 11:37 | 12/11/2026 11:49 | fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85) |
| BUG-H85-PWA-01 | Compilación TypeScript y build productiva Next.js ante nuevos campos en `AuthContextValue` | Estática / Compilación | Integración / Sistema | Crítica | Rama actualizada con fix de mock en `PatrullaDetailPage.test.tsx` | Comandos `npx tsc --noEmit` y `npm run build` | Compilación de tipos TS y bundle productivo Next.js con exit code `0`, más cobertura en `DESACTIVADA` y `SIN_ASIGNACION` | `npx tsc --noEmit` finaliza con `0` errores (`exit 0`) y `npm run build` compila (`1341ms`) y genera rutas (`8/8`) con `exit 0` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| BUG-H85-PWA-02 | Aislamiento de misiones por `unidadId`, ausencia de datos ficticios y limpieza local IndexedDB | Integración / Seguridad | Integración | Alta | Operador patrulla/cuadrilla en estados `ACTIVA`, `DESACTIVADA` y `SIN_ASIGNACION` | Páginas de misiones/detalle, `TerrenoResumenOperativo`, `TerrenoSiguienteMision`, `misionesService`, `offlineQueue` y `AuthContext.logout` | Filtrado por `patrullaId`/`cuadrillaId`; omisión en `SIN_ASIGNACION`; cero misiones ficticias; limpieza de IndexedDB al sincronizar y al cerrar sesión | Listados, detalle, resumen, siguiente misión y métricas filtran por `unidadId` y limpian IndexedDB; `limpiarAlmacenamientoOffline` limpia `misiones` y `outbox` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| BUG-H85-PWA-03 | Sincronización de tipos `api-generated.d.ts` con OpenAPI de `sgrai-api` y mapeo de `delegacionNombre` | Contrato / Tipado | Sistema | Alta | Contrato `src/types/api-generated.d.ts` regenerado | Revisión de `api-generated.d.ts`, `src/types/seguridad.ts`, `src/services/seguridadService.ts` y `AuthContext.tsx` | Tipos autogenerados con `unidadId`, `unidadNombre`, `unidadActiva`, `delegacionNombre` sin DTOs manuales ni casts `as unknown as` | `seguridad.ts` deriva directamente de `components['schemas']`; `seguridadService.ts` sin casts forzados; `AuthContext` mapea `delegacionNombre` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| BUG-H85-PWA-04 | Escucha Socket.io de baja lógica, invalidación ante HTTP `401`/`403` y protección de outbox ante `409`/`422` | Seguridad / Resiliencia | Sistema | Alta | `useTerrenoSocket.ts` conectado en `TerrenoLayout`, `AuthContext` y `useConnectivity` | Inspección y ejecución de `useTerrenoSocket.ts`, `AuthContext.tsx:271-293` y `useConnectivity.ts:71-97` | Suscripción a salas `patrulla:{id}`/`cuadrilla:{id}`; limpieza de sesión ante `401`/`403`; outbox no promueve a `EN_CURSO` ante `409`/`422` | `useTerrenoSocket` validado en `3/3` pruebas; `recargarSesion` invalida sesión en `401`/`403`; `useConnectivity` solo promueve a `EN_CURSO` cuando `res.ok` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85) |
| BUG-H85-PWA-05 | Trazabilidad por `unidadId` en historial de patrullas, registro en autenticación y delegación en tarjetas | Funcional / Regresión | Unitaria / Integración | Media | Servicios y vistas de `/terreno/perfil` y `AuthContext` | `perfilTerrenoService.ts:52`, `AuthContext.tsx:36,268,300` y `perfil/page.tsx:210-215` | Indexación exclusiva por `unidadId`, invocación en `login`/`recargarSesion`, `unidadId` en demo y delegación visible en tarjetas | Búsqueda exclusiva por `item.unidadId === usuario.unidadId`, registro en hidratación de sesión y tarjeta con `item.delegacion` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-01 | Mapeo Fail-Closed `unidadActiva=false` cuando la patrulla verificadora figura desactivada | Funcional / Unitaria | Unitaria | Alta | Sesión simulada con cookie válida y `obtenerUsuarioActivo` mockeado | `rolCodigo: PATRULLA_VERIFICADORA`, `unidadId` asignado, `unidadActiva: false` | `useAuth()` expone `unidadActiva=false`, `tieneUnidadAsignada=true` y `estadoAsignacion='DESACTIVADA'` | Prueba aprobada en `AuthContext.test.tsx` (`7/7` en `65ms`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-02 | Mapeo operativo `unidadActiva=true` cuando la patrulla verificadora se encuentra activa | Funcional / Unitaria | Unitaria | Alta | Sesión simulada con cookie válida y `obtenerUsuarioActivo` mockeado | `rolCodigo: PATRULLA_VERIFICADORA`, `unidadId` asignado, `unidadActiva: true` | `useAuth()` expone `unidadActiva=true`, `tieneUnidadAsignada=true` y `estadoAsignacion='ACTIVA'` | Prueba aprobada en `AuthContext.test.tsx` (`7/7` en `65ms`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-03 | Detección de estado `SIN_ASIGNACION` cuando el funcionario no tiene patrulla asignada | Funcional / Unitaria | Unitaria | Alta | Sesión simulada de funcionario de terreno sin `unidadId` asignado | `rolCodigo: PATRULLA_VERIFICADORA`, `unidadId: null`, `unidadNombre: null`, `unidadActiva: false` | `useAuth()` expone `tieneUnidadAsignada=false`, `unidadActiva=false` y `estadoAsignacion='SIN_ASIGNACION'` | Prueba aprobada en `AuthContext.test.tsx` (`7/7` en `65ms`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | feat(ui): alertar a operadores sin patrulla asignada mediante SinUnidadBanner y discriminación de estado |
| CP-H85-PWA-04 | Control RBAC en `AuthContext` ante roles de oficina (`CALL_CENTER` / `ADMIN`) sin destruir sesión web | Seguridad / RBAC | Unitaria | Alta | Login o ingreso a `/terreno` con rol no autorizado | Usuarios mock `CALL_CENTER` o `ADMIN` y cookie `sgrai_auth_token` previa | Rechaza login con `403` y preserva `sgrai_auth_token` al redirigir | Pruebas aprobadas en `AuthContext.test.tsx` (`7/7` en `65ms`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-05 | Renderizado de `UnidadInactivaBanner` para patrulla y cuadrilla desactivadas | UI / Componentes | Componentes | Media | `UnidadInactivaBanner` montado en jsdom | Props `tipoUnidad="CUADRILLA"` y `tipoUnidad="PATRULLA"` con `nombreUnidad` y rol `alert` | Muestra banner compacto de advertencia diferenciando patrulla verificadora de cuadrilla en modo solo lectura | `UnidadInactivaBanner.test.tsx` aprueba `2/2` casos en `167ms` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | style(ui): hacer mas discreto y compacto el banner de unidad desactivada (H85) |
| CP-H85-PWA-06 | Renderizado de `SinUnidadBanner` para operador sin patrulla o cuadrilla asignada | UI / Componentes | Componentes | Media | `SinUnidadBanner` montado en jsdom | Props `tipoUnidad="PATRULLA"` y `tipoUnidad="CUADRILLA"` con rol `status` | Muestra aviso informativo indicando falta de unidad asignada y canal de contacto con Centro de Mando | `SinUnidadBanner.test.tsx` aprueba `2/2` casos en `174ms` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | style(ui): asegurar salto de linea final en componentes de SinUnidadBanner |
| CP-H85-PWA-07 | Modo histórico sin misiones ficticias en `PatrullaMisionesPage` cuando `unidadActiva=false` | Funcional / UI | Componentes | Alta | `useAuth` mockeado con `PATRULLA_VERIFICADORA`, `unidadActiva=false`, `tieneUnidadAsignada=true` | Renderizado de `PatrullaMisionesPage` con `sincronizarMisiones` devolviendo `[]` | Renderiza `UnidadInactivaBanner`, título `Historial` y estado vacío real sin inyectar misiones ficticias | `PatrullaMisionesPage.test.tsx` aprueba `2/2` casos en `242ms` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-08 | Modo histórico sin misiones ficticias en `CuadrillaMisionesPage` cuando `unidadActiva=false` | Funcional / UI | Componentes | Media | `useAuth` mockeado con `DELEGADO_CUADRILLA`, `unidadActiva=false`, `tieneUnidadAsignada=true` | Renderizado de `CuadrillaMisionesPage` con `sincronizarMisiones` devolviendo `[]` | Renderiza `UnidadInactivaBanner`, título `Historial` y estado vacío real de faenas históricas | `CuadrillaMisionesPage.test.tsx` aprueba `2/2` casos en `249ms` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85) |
| CP-H85-PWA-09 | Exposición de alerta de unidad inactiva y enlaces adaptados en Hub `/terreno` (`TerrenoHomePage`) | Funcional / UI | Integración | Media | `useAuth` mockeado en estados activo e inactivo (`useTerrenoSocket` mockeado) | Renderizado de `TerrenoHomePage` y `TerrenoBottomNav` bajo entorno Vitest | Muestra bienvenida, resumen operativo, faenas y banner cuando `unidadActiva=false` | `TerrenoHomePage.test.tsx` aprueba `3/3` casos en `353ms` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-10 | Gestión de historial local de patrullas (`perfilTerrenoService`): registro, actualización a desactivada y ordenamiento | Funcional / Unitaria | Unitaria | Alta | `localStorage` limpio en entorno de pruebas Vitest | Llamadas secuenciales a `registrarPatrullaEnHistorial` y `obtenerHistorialUnidades` | Ignora usuarios sin `unidadId`, registra unidad nueva, actualiza estado a desactivada y ordena descendentemente | `perfilTerrenoService.test.ts` aprueba `6/6` pruebas en `12ms` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85) |
| CP-H85-PWA-11 | Renderizado de `/terreno/perfil` con estadísticas limpias, estado sin asignación e historial previo | Funcional / UI | Componentes | Media | `useAuth` y `perfilTerrenoService` mockeados | Renderizado de `TerrenoPerfilPage` en jsdom | Muestra perfil sin enums crudos, estado sin asignación operativa e historial de unidades previas | `PerfilPage.test.tsx` aprueba `3/3` casos en `165ms` (`585ms` en suite completa) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85) |
| CP-H85-PWA-12 | Flujo de aceptación de misión en `PatrullaDetailPage` (unidad activa, RBAC y cola offline) | Funcional / Offline | Componentes | Media | `useAuth` mockeado en modo activo (`unidadActiva: true`, `estadoAsignacion: 'ACTIVA'`) | Clic en `Aceptar Misión` online y offline, y ausencia de permiso `misiones:terreno:verificar` | Botón visible solo con permiso, transición a `En Trayecto / Evaluación` y sincronización offline diferida | `PatrullaDetailPage.test.tsx` aprueba `6/6` casos totales en `361ms` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-13 | Verificación de ausencia de emojis en `src/` y conformidad ESLint de la rama | Estática / Calidad UI | Estática | Baja | Repositorio `web-app` con todas las correcciones aplicadas | Comandos `rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/` y `npm run lint` | Cero emojis en código fuente y `0` errores ESLint | Cero emojis detectados (`NO_EMOJIS_IN_SRC`); `npm run lint` finaliza con exit code `0`, `0 errors` y `4 warnings` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85) |
| CP-H85-PWA-14 | Integración en vivo `sgrai-api` (`login`, `usuario-activo`, rechazo `403` en baja de patrulla) y redirección protegida PWA `307` | Integración / Seguridad | Sistema | Alta | Servicios ejecutándose en `http://localhost:3001` y `http://localhost:3002` durante la sesión inicial | `POST /api/seguridad/login`, `GET /api/seguridad/usuario-activo`, `DELETE /api/patrullas/f1000000-...-0050`, `GET :3002/terreno/patrulla/misiones` | Login retorna JWT y `unidadActiva=true`; `/usuario-activo` exige Bearer (`401`); rol patrulla recibe `403` en `DELETE`; PWA sin cookie redirige `307` | Verificado en vivo el 11/11/2026 (`200`, `401`, `403` `recursos:eliminar`, `307`); servidores locales `:3001`/`:3002` inactivos en sesión del 12/11/2026 | APROBADO | 11/11/2026 11:41 | N/A | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-15 | Documentación de usuario en terreno (`H85-patrulla-desactivada-terreno.md`) con secciones offline, permisos y copy alineado | Documentación | Documentación | Baja | Archivo presente en `docs/manuals/H85-patrulla-desactivada-terreno.md` | Revisión de secciones obligatorias del manual y comparación con `SinUnidadBanner.tsx` | Presencia de alcance H85, comportamiento sin conexión, permisos GPS/Cámara y texto homologado | Estructura completa y cita literal homologada con `SinUnidadBanner.tsx` en línea 38 | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:49 | fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85) |
| CP-H85-PWA-16 | Despliegue de `SinUnidadBanner` en `PatrullaMisionesPage` y `CuadrillaMisionesPage` bajo estado `SIN_ASIGNACION` | Funcional / UI | Componentes | Alta | `useAuth` mockeado con `tieneUnidadAsignada: false` y `estadoAsignacion: 'SIN_ASIGNACION'` | Renderizado de `PatrullaMisionesPage` y `CuadrillaMisionesPage` en Vitest | Renderiza `SinUnidadBanner` con título `Misiones`, mensaje de asignación pendiente y sin invocar sincronización operativa | `PatrullaMisionesPage.test.tsx` (`2/2`, `242ms`) y `CuadrillaMisionesPage.test.tsx` (`2/2`, `249ms`) verifican banner y texto vacío en `SIN_ASIGNACION` | APROBADO | 12/11/2026 11:37 | 12/11/2026 11:49 | fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85) |
| CP-H85-PWA-17 | Bloqueo de controles operativos en detalle de patrulla (`PatrullaDetailPage`) en estados `DESACTIVADA` y `SIN_ASIGNACION` | Funcional / Seguridad UI | Componentes | Alta | `useAuth` mockeado en `DESACTIVADA` y `SIN_ASIGNACION` con misión despachada mockeada | Renderizado de `PatrullaMisionDetailPage` verificando banners, etiqueta de retorno y ausencia de botón `Aceptar Misión` | Muestra `UnidadInactivaBanner` o `SinUnidadBanner` según estado, etiqueta `'Misiones'` en `SIN_ASIGNACION` y oculta botón `Aceptar Misión` | `PatrullaDetailPage.test.tsx` aprueba `6/6` en `361ms` y enlace en detalle discrimina `estadoAsignacion === 'DESACTIVADA'` | APROBADO | 12/11/2026 11:37 | 12/11/2026 11:49 | fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85) |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H85-PWA-06	Discriminación visual ACTIVA vs DESACTIVADA vs SIN_ASIGNACION, tokens CSS y alineación con manual H85	UI / UX / Documentación	Componentes / SSR	Media	Vistas de detalle, listado de cuadrilla, hojas CSS de perfil/banner y manual H85	Inspección de patrulla/misiones/[id], cuadrilla/misiones/[id], cuadrilla/misiones, PerfilPage.module.css, UnidadInactivaBanner.module.css y H85-patrulla-desactivada-terreno.md	Enlaces de detalle solo muestran Historial bajo DESACTIVADA; emptyState discrimina !tieneUnidadAsignada; uso uniforme de --border-color-neutral; manual homologado	Enlaces en detalle restringen Historial a DESACTIVADA; CuadrillaMisionesPage.test.tsx valida mensaje de SIN_ASIGNACION (22ms); 0 usos de --color-border en H85; manual alineado	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85)
BUG-H85-PWA-07	Filtrado por patrullaId/cuadrillaId en useTerrenoSocket.ts y cobertura de pruebas unitarias del hook (AGENTS.md §4)	Tiempo Real / Unitaria	Integración / Unitaria	Media	Hook src/hooks/useTerrenoSocket.ts con soporte tipado y suite en src/hooks/__tests__/useTerrenoSocket.test.ts	Eventos mock patrulla:desactivada (patrullaId: pat-otra vs pat-123) y cuadrilla:desactivada (cuadrillaId/id)	Ignora bajas de unidades ajenas; recarga sesión si coincide patrullaId/cuadrillaId/id; limpia listeners y salas al desmontar	useTerrenoSocket.test.ts aprueba 3/3 casos en 23ms (32ms en ejecución filtrada); npm run lint y tsc --noEmit sin errores	APROBADO	12/11/2026 11:37	12/11/2026 11:49	fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85)
BUG-H85-PWA-01	Compilación TypeScript y build productiva Next.js ante nuevos campos en AuthContextValue	Estática / Compilación	Integración / Sistema	Crítica	Rama actualizada con fix de mock en PatrullaDetailPage.test.tsx	Comandos npx tsc --noEmit y npm run build	Compilación de tipos TS y bundle productivo Next.js con exit code 0, más cobertura en DESACTIVADA y SIN_ASIGNACION	npx tsc --noEmit finaliza con 0 errores (exit 0) y npm run build compila (1341ms) y genera rutas (8/8) con exit 0	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
BUG-H85-PWA-02	Aislamiento de misiones por unidadId, ausencia de datos ficticios y limpieza local IndexedDB	Integración / Seguridad	Integración	Alta	Operador patrulla/cuadrilla en estados ACTIVA, DESACTIVADA y SIN_ASIGNACION	Páginas de misiones/detalle, TerrenoResumenOperativo, TerrenoSiguienteMision, misionesService, offlineQueue y AuthContext.logout	Filtrado por patrullaId/cuadrillaId; omisión en SIN_ASIGNACION; cero misiones ficticias; limpieza de IndexedDB al sincronizar y al cerrar sesión	Listados, detalle, resumen, siguiente misión y métricas filtran por unidadId y limpian IndexedDB; limpiarAlmacenamientoOffline limpia misiones y outbox	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
BUG-H85-PWA-03	Sincronización de tipos api-generated.d.ts con OpenAPI de sgrai-api y mapeo de delegacionNombre	Contrato / Tipado	Sistema	Alta	Contrato src/types/api-generated.d.ts regenerado	Revisión de api-generated.d.ts, src/types/seguridad.ts, src/services/seguridadService.ts y AuthContext.tsx	Tipos autogenerados con unidadId, unidadNombre, unidadActiva, delegacionNombre sin DTOs manuales ni casts as unknown as	seguridad.ts deriva directamente de components['schemas']; seguridadService.ts sin casts forzados; AuthContext mapea delegacionNombre	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
BUG-H85-PWA-04	Escucha Socket.io de baja lógica, invalidación ante HTTP 401/403 y protección de outbox ante 409/422	Seguridad / Resiliencia	Sistema	Alta	useTerrenoSocket.ts conectado en TerrenoLayout, AuthContext y useConnectivity	Inspección y ejecución de useTerrenoSocket.ts, AuthContext.tsx:271-293 y useConnectivity.ts:71-97	Suscripción a salas patrulla:{id}/cuadrilla:{id}; limpieza de sesión ante 401/403; outbox no promueve a EN_CURSO ante 409/422	useTerrenoSocket validado en 3/3 pruebas; recargarSesion invalida sesión en 401/403; useConnectivity solo promueve a EN_CURSO cuando res.ok	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85)
BUG-H85-PWA-05	Trazabilidad por unidadId en historial de patrullas, registro en autenticación y delegación en tarjetas	Funcional / Regresión	Unitaria / Integración	Media	Servicios y vistas de /terreno/perfil y AuthContext	perfilTerrenoService.ts:52, AuthContext.tsx:36,268,300 y perfil/page.tsx:210-215	Indexación exclusiva por unidadId, invocación en login/recargarSesion, unidadId en demo y delegación visible en tarjetas	Búsqueda exclusiva por item.unidadId === usuario.unidadId, registro en hidratación de sesión y tarjeta con item.delegacion	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-01	Mapeo Fail-Closed unidadActiva=false cuando la patrulla verificadora figura desactivada	Funcional / Unitaria	Unitaria	Alta	Sesión simulada con cookie válida y obtenerUsuarioActivo mockeado	rolCodigo: PATRULLA_VERIFICADORA, unidadId asignado, unidadActiva: false	useAuth() expone unidadActiva=false, tieneUnidadAsignada=true y estadoAsignacion='DESACTIVADA'	Prueba aprobada en AuthContext.test.tsx (7/7 en 65ms)	APROBADO	11/11/2026 11:41	12/11/2026 11:49	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-02	Mapeo operativo unidadActiva=true cuando la patrulla verificadora se encuentra activa	Funcional / Unitaria	Unitaria	Alta	Sesión simulada con cookie válida y obtenerUsuarioActivo mockeado	rolCodigo: PATRULLA_VERIFICADORA, unidadId asignado, unidadActiva: true	useAuth() expone unidadActiva=true, tieneUnidadAsignada=true y estadoAsignacion='ACTIVA'	Prueba aprobada en AuthContext.test.tsx (7/7 en 65ms)	APROBADO	11/11/2026 11:41	12/11/2026 11:49	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-03	Detección de estado SIN_ASIGNACION cuando el funcionario no tiene patrulla asignada	Funcional / Unitaria	Unitaria	Alta	Sesión simulada de funcionario de terreno sin unidadId asignado	rolCodigo: PATRULLA_VERIFICADORA, unidadId: null, unidadNombre: null, unidadActiva: false	useAuth() expone tieneUnidadAsignada=false, unidadActiva=false y estadoAsignacion='SIN_ASIGNACION'	Prueba aprobada en AuthContext.test.tsx (7/7 en 65ms)	APROBADO	11/11/2026 11:41	12/11/2026 11:49	feat(ui): alertar a operadores sin patrulla asignada mediante SinUnidadBanner y discriminación de estado
CP-H85-PWA-04	Control RBAC en AuthContext ante roles de oficina (CALL_CENTER / ADMIN) sin destruir sesión web	Seguridad / RBAC	Unitaria	Alta	Login o ingreso a /terreno con rol no autorizado	Usuarios mock CALL_CENTER o ADMIN y cookie sgrai_auth_token previa	Rechaza login con 403 y preserva sgrai_auth_token al redirigir	Pruebas aprobadas en AuthContext.test.tsx (7/7 en 65ms)	APROBADO	11/11/2026 11:41	12/11/2026 11:49	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-05	Renderizado de UnidadInactivaBanner para patrulla y cuadrilla desactivadas	UI / Componentes	Componentes	Media	UnidadInactivaBanner montado en jsdom	Props tipoUnidad="CUADRILLA" y tipoUnidad="PATRULLA" con nombreUnidad y rol alert	Muestra banner compacto de advertencia diferenciando patrulla verificadora de cuadrilla en modo solo lectura	UnidadInactivaBanner.test.tsx aprueba 2/2 casos en 167ms	APROBADO	11/11/2026 11:41	12/11/2026 11:49	style(ui): hacer mas discreto y compacto el banner de unidad desactivada (H85)
CP-H85-PWA-06	Renderizado de SinUnidadBanner para operador sin patrulla o cuadrilla asignada	UI / Componentes	Componentes	Media	SinUnidadBanner montado en jsdom	Props tipoUnidad="PATRULLA" y tipoUnidad="CUADRILLA" con rol status	Muestra aviso informativo indicando falta de unidad asignada y canal de contacto con Centro de Mando	SinUnidadBanner.test.tsx aprueba 2/2 casos en 174ms	APROBADO	11/11/2026 11:41	12/11/2026 11:49	style(ui): asegurar salto de linea final en componentes de SinUnidadBanner
CP-H85-PWA-07	Modo histórico sin misiones ficticias en PatrullaMisionesPage cuando unidadActiva=false	Funcional / UI	Componentes	Alta	useAuth mockeado con PATRULLA_VERIFICADORA, unidadActiva=false, tieneUnidadAsignada=true	Renderizado de PatrullaMisionesPage con sincronizarMisiones devolviendo []	Renderiza UnidadInactivaBanner, título Historial y estado vacío real sin inyectar misiones ficticias	PatrullaMisionesPage.test.tsx aprueba 2/2 casos en 242ms	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-08	Modo histórico sin misiones ficticias en CuadrillaMisionesPage cuando unidadActiva=false	Funcional / UI	Componentes	Media	useAuth mockeado con DELEGADO_CUADRILLA, unidadActiva=false, tieneUnidadAsignada=true	Renderizado de CuadrillaMisionesPage con sincronizarMisiones devolviendo []	Renderiza UnidadInactivaBanner, título Historial y estado vacío real de faenas históricas	CuadrillaMisionesPage.test.tsx aprueba 2/2 casos en 249ms	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85)
CP-H85-PWA-09	Exposición de alerta de unidad inactiva y enlaces adaptados en Hub /terreno (TerrenoHomePage)	Funcional / UI	Integración	Media	useAuth mockeado en estados activo e inactivo (useTerrenoSocket mockeado)	Renderizado de TerrenoHomePage y TerrenoBottomNav bajo entorno Vitest	Muestra bienvenida, resumen operativo, faenas y banner cuando unidadActiva=false	TerrenoHomePage.test.tsx aprueba 3/3 casos en 353ms	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-10	Gestión de historial local de patrullas (perfilTerrenoService): registro, actualización a desactivada y ordenamiento	Funcional / Unitaria	Unitaria	Alta	localStorage limpio en entorno de pruebas Vitest	Llamadas secuenciales a registrarPatrullaEnHistorial y obtenerHistorialUnidades	Ignora usuarios sin unidadId, registra unidad nueva, actualiza estado a desactivada y ordena descendentemente	perfilTerrenoService.test.ts aprueba 6/6 pruebas en 12ms	APROBADO	11/11/2026 11:41	12/11/2026 11:49	feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85)
CP-H85-PWA-11	Renderizado de /terreno/perfil con estadísticas limpias, estado sin asignación e historial previo	Funcional / UI	Componentes	Media	useAuth y perfilTerrenoService mockeados	Renderizado de TerrenoPerfilPage en jsdom	Muestra perfil sin enums crudos, estado sin asignación operativa e historial de unidades previas	PerfilPage.test.tsx aprueba 3/3 casos en 165ms (585ms en suite completa)	APROBADO	11/11/2026 11:41	12/11/2026 11:49	feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85)
CP-H85-PWA-12	Flujo de aceptación de misión en PatrullaDetailPage (unidad activa, RBAC y cola offline)	Funcional / Offline	Componentes	Media	useAuth mockeado en modo activo (unidadActiva: true, estadoAsignacion: 'ACTIVA')	Clic en Aceptar Misión online y offline, y ausencia de permiso misiones:terreno:verificar	Botón visible solo con permiso, transición a En Trayecto / Evaluación y sincronización offline diferida	PatrullaDetailPage.test.tsx aprueba 6/6 casos totales en 361ms	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-13	Verificación de ausencia de emojis en src/ y conformidad ESLint de la rama	Estática / Calidad UI	Estática	Baja	Repositorio web-app con todas las correcciones aplicadas	Comandos rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ y npm run lint	Cero emojis en código fuente y 0 errores ESLint	Cero emojis detectados (NO_EMOJIS_IN_SRC); npm run lint finaliza con exit code 0, 0 errors y 4 warnings	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85)
CP-H85-PWA-14	Integración en vivo sgrai-api (login, usuario-activo, rechazo 403 en baja de patrulla) y redirección protegida PWA 307	Integración / Seguridad	Sistema	Alta	Servicios ejecutándose en http://localhost:3001 y http://localhost:3002 durante la sesión inicial	POST /api/seguridad/login, GET /api/seguridad/usuario-activo, DELETE /api/patrullas/f1000000-...-0050, GET :3002/terreno/patrulla/misiones	Login retorna JWT y unidadActiva=true; /usuario-activo exige Bearer (401); rol patrulla recibe 403 en DELETE; PWA sin cookie redirige 307	Verificado en vivo el 11/11/2026 (200, 401, 403 recursos:eliminar, 307); servidores locales :3001/:3002 inactivos en sesión del 12/11/2026	APROBADO	11/11/2026 11:41	N/A	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-15	Documentación de usuario en terreno (H85-patrulla-desactivada-terreno.md) con secciones offline, permisos y copy alineado	Documentación	Documentación	Baja	Archivo presente en docs/manuals/H85-patrulla-desactivada-terreno.md	Revisión de secciones obligatorias del manual y comparación con SinUnidadBanner.tsx	Presencia de alcance H85, comportamiento sin conexión, permisos GPS/Cámara y texto homologado	Estructura completa y cita literal homologada con SinUnidadBanner.tsx en línea 38	APROBADO	11/11/2026 11:41	12/11/2026 11:49	fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85)
CP-H85-PWA-16	Despliegue de SinUnidadBanner en PatrullaMisionesPage y CuadrillaMisionesPage bajo estado SIN_ASIGNACION	Funcional / UI	Componentes	Alta	useAuth mockeado con tieneUnidadAsignada: false y estadoAsignacion: 'SIN_ASIGNACION'	Renderizado de PatrullaMisionesPage y CuadrillaMisionesPage en Vitest	Renderiza SinUnidadBanner con título Misiones, mensaje de asignación pendiente y sin invocar sincronización operativa	PatrullaMisionesPage.test.tsx (2/2, 242ms) y CuadrillaMisionesPage.test.tsx (2/2, 249ms) verifican banner y texto vacío en SIN_ASIGNACION	APROBADO	12/11/2026 11:37	12/11/2026 11:49	fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85)
CP-H85-PWA-17	Bloqueo de controles operativos en detalle de patrulla (PatrullaDetailPage) en estados DESACTIVADA y SIN_ASIGNACION	Funcional / Seguridad UI	Componentes	Alta	useAuth mockeado en DESACTIVADA y SIN_ASIGNACION con misión despachada mockeada	Renderizado de PatrullaMisionDetailPage verificando banners, etiqueta de retorno y ausencia de botón Aceptar Misión	Muestra UnidadInactivaBanner o SinUnidadBanner según estado, etiqueta 'Misiones' en SIN_ASIGNACION y oculta botón Aceptar Misión	PatrullaDetailPage.test.tsx aprueba 6/6 en 361ms y enlace en detalle discrimina estadoAsignacion === 'DESACTIVADA'	APROBADO	12/11/2026 11:37	12/11/2026 11:49	fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85)
```

---

## 5. Guía de Ejecución y Replicabilidad Paso a Paso (Re-Test Final)

Todos los comandos listados a continuación fueron ejecutados desde la raíz del repositorio `web-app`.

### 5.1 Suite completa Vitest y subconjunto H85 (`12/11/2026`)

```bash
npm test
```

Salida observada:

```text
 Test Files  28 passed (28)
      Tests  99 passed (99)
   Start at  11:48:06
   Duration  16.63s (transform 9.04s, setup 23.44s, collect 31.73s, tests 16.08s, environment 112.02s, prepare 13.05s)
```

Ejecución específica de las `12` suites vinculadas a HU-85, misiones, conectividad y Socket.io:

```bash
npx vitest run \
  src/context/__tests__/AuthContext.test.tsx \
  src/services/__tests__/perfilTerrenoService.test.ts \
  'src/app/(terreno)/perfil/__tests__/PerfilPage.test.tsx' \
  'src/app/(terreno)/patrulla/misiones' \
  'src/app/(terreno)/cuadrilla/misiones/__tests__/CuadrillaMisionesPage.test.tsx' \
  src/components/common/__tests__/SinUnidadBanner.test.tsx \
  src/components/common/__tests__/UnidadInactivaBanner.test.tsx \
  'src/app/(terreno)/__tests__/TerrenoHomePage.test.tsx' \
  src/services/__tests__/misionesService.test.ts \
  src/hooks/__tests__/useConnectivity.test.ts \
  src/hooks/__tests__/useTerrenoSocket.test.ts
```

Salida observada:

```text
 Test Files  12 passed (12)
      Tests  48 passed (48)
   Start at  11:49:32
   Duration  2.43s (transform 1.74s, setup 2.41s, collect 5.22s, tests 1.88s, environment 10.72s, prepare 1.27s)
```

Ejecución individual filtrada para la nueva suite de Socket.io (`useTerrenoSocket.test.ts`):

```bash
npm test -- -t "useTerrenoSocket hook"
```

Salida observada:

```text
 ✓ src/hooks/__tests__/useTerrenoSocket.test.ts (3 tests) 32ms
 Test Files  1 passed | 27 skipped (28)
      Tests  3 passed | 96 skipped (99)
   Start at  11:49:21
   Duration  5.25s (transform 3.08s, setup 7.79s, collect 11.20s, tests 32ms, environment 37.11s, prepare 4.44s)
```

### 5.2 Verificación de tipos TypeScript, Build de producción y ESLint

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Salidas observadas:
- `npx tsc --noEmit`: exit code `0` (`0` errores).
- `npm run lint`: exit code `0`, `0 errors` y `4 warnings` en `@next/next/no-location-assign-relative-destination` (`src/app/(auth)/login/page.tsx:51`, `src/app/(terreno)/page.tsx:26`, `src/context/AuthContext.tsx:147`, `src/lib/api/client.ts:47`).
- `npm run build` (Next.js 16.3.4 Turbopack): exit code `0` (`✓ Compiled successfully in 1341ms`, `✓ Finished TypeScript in 2.5s`, `✓ Generating static pages using 11 workers (8/8)`).

### 5.3 Verificación estática de emojis y tokens CSS H85

```bash
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS_IN_SRC"
rg -n "color-border" src/app/\(terreno\)/perfil/PerfilPage.module.css src/components/common/UnidadInactivaBanner.module.css || echo "NO_COLOR_BORDER_IN_H85"
```

Salidas observadas: `NO_EMOJIS_IN_SRC` y `NO_COLOR_BORDER_IN_H85`.

### 5.4 Evidencia cURL de referencia (`11/11/2026`, entorno `sgrai-api` `:3001` y `sgrai-pwa` `:3002`)

*(En la sesión del `12/11/2026` no hay procesos escuchando en los puertos `3001` ni `3002`; la evidencia cURL de contrato en vivo corresponde a la ejecución del `11/11/2026`)*

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"francisca.patrulla@valdivia.cl","password":"Valdivia2026!"}'

curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3001/api/seguridad/usuario-activo \
  -H "Authorization: Bearer $TOKEN"

curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X DELETE \
  http://localhost:3001/api/patrullas/f1000000-0000-4000-8000-000000000050 \
  -H "Authorization: Bearer $TOKEN"

curl -s -i http://localhost:3002/terreno/patrulla/misiones | head -n 6
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación / Regla (HU-85) | Responsabilidad Arquitectónica | Cobertura en `sgrai-pwa` | Estado tras Re-Test Final | Referencia |
|---|---|---|---|---|
| **CA-1:** Acción 'Desactivar Patrulla' en panel de administración | `sgrai-web` (Administración) | Fuera de alcance en PWA (`AGENTS.md §1`). RBAC bloquea rol patrulla (`403`) y redirige roles de oficina sin destruir cookie | Aprobado | `CP-H85-PWA-04`, `CP-H85-PWA-14` |
| **CA-2:** Modal de confirmación advirtiendo impacto de la acción | `sgrai-web` (Administración) | En terreno se muestran banners diferenciados `UnidadInactivaBanner` y `SinUnidadBanner` alineados con manual | Aprobado | `CP-H85-PWA-05`, `CP-H85-PWA-06`, `CP-H85-PWA-15`, `CP-H85-PWA-16`, `BUG-H85-PWA-06` |
| **CA-3:** API rechaza baja con `409 Conflict` si está `EN_VERIFICACION` o con misiones activas | `sgrai-api` (Backend) | La PWA maneja rechazo `409`/`422` en outbox sin confirmar falsamente `EN_CURSO`, filtra eventos Socket.io y bloquea controles si `DESACTIVADA` | Aprobado | `BUG-H85-PWA-01`, `BUG-H85-PWA-04`, `BUG-H85-PWA-07`, `CP-H85-PWA-17` |
| **CA-4:** Baja lógica (`activo = false`, `eliminado_en`) sin borrar historial | `sgrai-api` (Backend / BD) | Modo histórico solo lectura (`DESACTIVADA`), historial local por `unidadId` en `/terreno/perfil` con delegación y cero datos ficticios | Aprobado | `BUG-H85-PWA-02`, `BUG-H85-PWA-05`, `CP-H85-PWA-01`, `CP-H85-PWA-10` |
| **CA-5:** Liberación de vehículo y personal a disponibilidad comunal | `sgrai-api` / `sgrai-web` | Detección `SIN_ASIGNACION`, `SinUnidadBanner`, aislamiento de misiones previas, escucha Socket.io tipada y discriminación en listados/detalle | Aprobado | `CP-H85-PWA-03`, `CP-H85-PWA-16`, `BUG-H85-PWA-06`, `BUG-H85-PWA-07` |
| **Regla Crítica §3.7, OpenAPI, Build y Calidad (`AGENTS.md §4`)** | Transversal (`sgrai-api` + `sgrai-pwa`) | `api-generated.d.ts` sincronizado, `tsc`/`lint`/`build` verdes y cobertura unitaria completa incluyendo `useTerrenoSocket.test.ts` | Aprobado | `BUG-H85-PWA-01`, `BUG-H85-PWA-03`, `BUG-H85-PWA-07`, `CP-H85-PWA-13` |

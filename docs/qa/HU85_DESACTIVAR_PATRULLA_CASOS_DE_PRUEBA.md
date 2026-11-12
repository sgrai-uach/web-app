# Auditoría Técnica y Matriz de Casos de Prueba — HU-[85]: Desactivar Patrulla (Cliente Terreno `sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `revert-2-feature/H85-desactivar-patrulla` (integra `feature/H85-desactivar-patrulla` y `merge: integrar resolucion de defectos QA de HU-85`)  
**Historia de Usuario:** HU-[85] — Desactivar Patrulla Verificadora (baja lógica §3.7 y comportamiento en terreno)  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `11/11/2026 11:41 -03:00`  
**Fecha y Hora de Ciclo Re-Test:** `12/11/2026 11:37 -03:00`  
**Entorno de Ejecución Re-Test:** Linux, Node.js, Vitest v3.2.7, Next.js 16.3.4 (Turbopack), ESLint, TypeScript (`tsc --noEmit`)  
**Dictamen de Auditoría Re-Test:** **NO APTO PARA INTEGRACIÓN — OBSERVACIONES MENORES PENDIENTES (5 de 6 defectos iniciales corregidos; 2 defectos `ABIERTO` de severidad Media)**

---

## Alcance Arquitectónico en `sgrai-pwa`

De acuerdo con la separación de responsabilidades de SGRAI, la acción administrativa **'Desactivar Patrulla'**, su modal de confirmación y la mutación `DELETE /api/patrullas/[id]` (soft delete `activo = false`, `eliminado_en = CURRENT_TIMESTAMP`, liberación de vehículo/personal y rechazo `409 Conflict` ante misiones activas o estado `EN_VERIFICACION`) pertenecen a `sgrai-web` y `sgrai-api`.

En el cliente de terreno `sgrai-pwa` (cuyo alcance se restringe a los roles `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA`), la implementación evaluada cubre la contraparte operativa en campo ante la baja lógica o ausencia de asignación de la unidad:

- Mapeo de `unidadId`, `unidadNombre`, `delegacionNombre` y `unidadActiva` en `AuthContext` usando tipos generados desde OpenAPI (`api-generated.d.ts`), discriminando `ACTIVA`, `DESACTIVADA` y `SIN_ASIGNACION`.
- Escucha en tiempo real (`useTerrenoSocket`) para reaccionar a `patrulla:desactivada` y `cuadrilla:desactivada`, invalidación de sesión ante HTTP `401`/`403` y protección de cola offline ante rechazos `409`/`422`.
- Visualización de banners diferenciados (`UnidadInactivaBanner` y `SinUnidadBanner`) en el hub `/terreno`, listados de misiones de patrulla/cuadrilla y detalle de misión, sin datos ficticios hardcodeados y filtrando por `patrullaId`/`cuadrillaId`.
- Registro y consulta local del historial de unidades asignadas (`historial_unidades_<usuarioId>`) en `/terreno/perfil`.
- Manual de usuario `docs/manuals/H85-patrulla-desactivada-terreno.md`.

---

## 1. Resumen Ejecutivo

Durante el ciclo de **Re-Test** (`12/11/2026 11:37`), se comprobó la subsanación íntegra de **5 de los 6 defectos** detectados en la auditoría inicial (`BUG-H85-PWA-01` Crítico, `BUG-H85-PWA-02`, `BUG-H85-PWA-03` y `BUG-H85-PWA-04` Altos, y `BUG-H85-PWA-05` Medio). La compilación estricta de TypeScript (`npx tsc --noEmit`) y la compilación productiva (`npm run build`) ahora finalizan sin errores, y la suite automatizada en Vitest incrementó su cobertura a `96` pruebas aprobadas en `27` archivos.

No obstante, la inspección forense de código reveló **4 observaciones residuales** dentro de `BUG-H85-PWA-06` (etiquetas `Historial` en enlaces de detalle bajo `SIN_ASIGNACION`, mensaje vacío en `CuadrillaMisionesPage`, tokens `--color-border` pendientes y diferencia de copy frente al manual) y **1 nuevo defecto de severidad Media** (`BUG-H85-PWA-07`) en el nuevo hook `useTerrenoSocket.ts` (propiedad `data?.id` vs `patrullaId` del contrato de `sgrai-api` y ausencia de archivo de pruebas unitarias para dicho hook).

| Indicador / Verificación | Auditoría Inicial (11/11/2026) | Ciclo Re-Test (12/11/2026) | Observación Técnica |
|---|---|---|---|
| Total de casos en matriz (HU-85 PWA) | `21` casos | `24` casos | `2` `ABIERTO` (`BUG-H85-PWA-06`, `07`) + `5` defectos `CORREGIDO`/`APROBADO` + `17` casos `APROBADO` |
| Defectos abiertos por severidad | `1` Crítica, `3` Alta, `2` Media | `0` Crítica, `0` Alta, `2` Media | Subsanados el bloqueante de build y todos los defectos de severidad Alta |
| Suite automatizada completa (`npm test`) | `27` archivos / `92` tests (`4.58s`) | `27` archivos / `96` tests (`5.12s`) | Ejecutada con mocks de IndexedDB/servicios (`+4` casos en patrulla/cuadrilla/detalle) |
| Subconjunto H85 y servicios (`npx vitest run`) | `9` archivos / `29` tests (`2.07s`) | `11` archivos / `45` tests (`2.77s`) | Incluye `misionesService.test.ts` (`9`) y `useConnectivity.test.ts` (`3`) |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `4` advertencias | `0` errores, `4` advertencias | Regla `@next/next/no-location-assign-relative-destination` en 4 archivos |
| Verificación de tipos (`npx tsc --noEmit`) | **FALLIDO** (exit `2`, `TS2345`) | **APROBADO** (`0` errores, exit `0`) | Mock de `useAuth` actualizado en `PatrullaDetailPage.test.tsx` |
| Build de producción (`npm run build`) | **FALLIDO** (exit `1`) | **APROBADO** (exit `0`, TS en `4.1s`) | Compilación (`1809ms`) y prerenderizado estático (`8/8`) completados |
| Prohibición de emojis en UI (`src/`) | Aprobado (`0` coincidencias) | Aprobado (`0` coincidencias) | Verificado mediante búsqueda de rangos Unicode en `src/` |

---

## 2. Registro Técnico de Defectos y Verificación de Subsanación (Re-Test)

### BUG-H85-PWA-01 — Fallo de compilación TypeScript y build de producción por mock incompleto de `AuthContextValue`
- **Severidad:** Crítica (Bloqueante de build y despliegue)
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026 11:37)**
- **Archivos afectados:**
  - `src/context/AuthContext.tsx` (líneas 63–78)
  - `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx` (líneas 29–75, 273–324)
- **Verificación en Re-Test:**
  - Se actualizaron `configurarAuthMock` en `PatrullaDetailPage.test.tsx` incorporando `tieneUnidadAsignada`, `estadoAsignacion` y `unidadId`, y se añadieron `2` casos de prueba que verifican el bloqueo de controles operativos en los estados `DESACTIVADA` y `SIN_ASIGNACION`.
  - `npx tsc --noEmit` finalizó con `0` errores (`exit code 0`) y `npm run build` completó exitosamente (`exit code 0`).

---

### BUG-H85-PWA-02 — Fuga multi-patrulla, inyección de misiones ficticias y persistencia residual en IndexedDB
- **Severidad:** Alta
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026 11:37)**
- **Archivos afectados:**
  - `src/app/(terreno)/patrulla/misiones/page.tsx` (líneas 40–61)
  - `src/app/(terreno)/cuadrilla/misiones/page.tsx` (líneas 40–61)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (línea 54) y `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (línea 36)
  - `src/components/terreno/TerrenoResumenOperativo.tsx` (líneas 31–68) y `src/components/terreno/TerrenoSiguienteMision.tsx` (líneas 27–69)
  - `src/services/perfilTerrenoService.ts` (líneas 145–163), `src/services/misionesService.ts` (líneas 181–184), `src/services/offlineQueue.ts` (líneas 68–72) y `src/context/AuthContext.tsx` (líneas 278, 289, 310)
- **Verificación en Re-Test:**
  - Todas las vistas de patrulla/cuadrilla, resumen operativo, siguiente misión y métricas de perfil filtran por `patrullaId` o `cuadrillaId` usando `usuario.unidadId` y omiten la sincronización cuando `!tieneUnidadAsignada` / `SIN_ASIGNACION`.
  - Se retiraron las listas y misiones ficticias hardcodeadas en listados y páginas de detalle (`setMision(null)`).
  - `misionesService.ts` invoca `limpiarMisionesLocales()` antes de persistir datos remotos y `AuthContext.tsx` invoca `limpiarAlmacenamientoOffline()` (limpiando `misiones` y `outbox`) en `logout()` y al recibir HTTP `401`/`403`.

---

### BUG-H85-PWA-03 — Desincronización con OpenAPI (`api-generated.d.ts`), casts forzados y pérdida de `delegacionNombre`
- **Severidad:** Alta
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026 11:37)**
- **Archivos afectados:**
  - `src/types/api-generated.d.ts` (líneas 9144–9208, 9267–9341)
  - `src/types/seguridad.ts` (líneas 19–23)
  - `src/services/seguridadService.ts` (líneas 65, 93)
  - `src/context/AuthContext.tsx` (líneas 108–109)
- **Verificación en Re-Test:**
  - `api-generated.d.ts` fue regenerado incluyendo `delegacionNombre`, `unidadId`, `unidadNombre` y `unidadActiva` en `UsuarioActivoItem` y `UsuarioPerfilSesion`, así como `activo`, `eliminadoEn` y `eliminadoPorId` en `/api/patrullas/{id}`.
  - `seguridad.ts` consume directamente `components['schemas'][...]` y `seguridadService.ts` eliminó todos los casts `as unknown as LoginResponseData` / `UsuarioActivoDetalle`.
  - `AuthContext.tsx` mapea `delegacionNombre: detalle.delegacionNombre ?? null` conforme al nuevo contrato OpenAPI (sujeto a que la instancia desplegada de `sgrai-api` popule el campo en tiempo de ejecución).

---

### BUG-H85-PWA-04 — Sesión obsoleta tras baja remota, bypass de estado ante HTTP 401/403 y confirmación optimista indebida en outbox HTTP 409/422
- **Severidad:** Alta
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026 11:37)** *(desajuste de payload y falta de prueba unitaria del hook Socket registrados como `BUG-H85-PWA-07`)*
- **Archivos afectados:**
  - `src/hooks/useTerrenoSocket.ts` (nuevo) y `src/app/(terreno)/layout.tsx` (líneas 5, 9)
  - `src/context/AuthContext.tsx` (líneas 271–293)
  - `src/hooks/useConnectivity.ts` (líneas 71–97)
- **Verificación en Re-Test:**
  - Se incorporó `useTerrenoSocket()` en `TerrenoLayout`, conectando a `/socket.io` con envío de `join`/`unirse` a `patrulla:{id}` / `cuadrilla:{id}` y escuchando `patrulla:desactivada` / `cuadrilla:desactivada`.
  - `recargarSesion` en `AuthContext.tsx` captura `SeguridadServiceError` con status `401` o `403`, limpiando cookie, caché de sesión e IndexedDB en vez de restaurar `sessionStorage`.
  - `useConnectivity.ts` diferencia `res.ok` (transiciona localmente a `EN_CURSO`) de rechazos de negocio (`409`/`422`), retirando el estado `sincronizacionPendiente` sin promover la misión a `EN_CURSO`.

---

### BUG-H85-PWA-05 — Colisión por nombre en historial de patrullas, registro tardío en `/perfil` y omisión de delegación en tarjetas
- **Severidad:** Media
- **Estado:** **CORREGIDO (Verificado en Re-Test — 12/11/2026 11:37)**
- **Archivos afectados:**
  - `src/services/perfilTerrenoService.ts` (línea 52)
  - `src/context/AuthContext.tsx` (líneas 36, 268–270, 300–302)
  - `src/app/(terreno)/perfil/page.tsx` (líneas 210–215) y `src/app/(terreno)/perfil/PerfilPage.module.css` (líneas 179–185)
- **Verificación en Re-Test:**
  - `registrarPatrullaEnHistorial` indexa exclusivamente por `item.unidadId === usuario.unidadId`, evitando sobrescrituras cuando distintas patrullas comparten nombre.
  - El registro se invoca automáticamente en `AuthContext.tsx` tanto en `recargarSesion()` como en `login()`, y `PERFIL_DEMO_PATRULLA` ya incluye `unidadId`.
  - Las tarjetas del historial en `perfil/page.tsx` muestran `item.delegacion` junto al icono `MapPin`.

---

### BUG-H85-PWA-06 — Contaminación de etiquetas `DESACTIVADA` sobre `SIN_ASIGNACION`/SSR, variable CSS inexistente y desfase de copy con manual
- **Severidad:** Media
- **Estado:** **`ABIERTO` (Parcialmente corregido en Re-Test — 12/11/2026 11:37)**
- **Archivos con corrección verificada:**
  - `src/components/terreno/TerrenoBottomNav.tsx` (líneas 20–25): ahora restringe `'Historial'` exclusivamente a `estadoAsignacion === 'DESACTIVADA'`.
  - `src/components/terreno/TerrenoSiguienteMision.tsx` (líneas 97–102): diferencia explícitamente `SIN_ASIGNACION`, `DESACTIVADA` y `ACTIVA`.
  - `src/components/terreno/TerrenoResumenOperativo.tsx` (línea 103): restringe `kpiCardWarning` a `tieneUnidadAsignada && !unidadActiva`.
  - `src/components/common/SinUnidadBanner.module.css` (línea 3) y `src/app/(terreno)/perfil/PerfilPage.module.css` (línea 157): adoptan `--border-color-neutral`.
  - `src/components/common/UnidadInactivaBanner.tsx` (línea 29): incorpora referencia a `(§3.7 de baja lógica)`.
- **Hallazgos que permanecen abiertos:**
  1. `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (línea 144) y `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (línea 70) mantienen `{unidadActiva ? 'Misiones' : 'Historial'}` y `{unidadActiva ? 'Faenas' : 'Historial'}`, por lo que ante estado `SIN_ASIGNACION` el enlace de retorno continúa mostrando `'Historial'`.
  2. `src/app/(terreno)/cuadrilla/misiones/page.tsx` (líneas 162–164) no comprueba `!tieneUnidadAsignada` en el bloque `emptyState`, mostrando `"No se encontraron faenas históricas registradas para esta cuadrilla."` cuando el funcionario está sin cuadrilla asignada (a diferencia de `patrulla/misiones/page.tsx:162`).
  3. Persiste `var(--color-border, #CBD5E1)` (token ausente en `src/styles/tokens.css`) en `src/app/(terreno)/perfil/PerfilPage.module.css` (líneas 43, 59, 108) y `src/components/common/UnidadInactivaBanner.module.css` (línea 3).
  4. El texto de `src/components/common/SinUnidadBanner.tsx` (líneas 26–33) mantiene diferencias literales frente a la cita descrita en `docs/manuals/H85-patrulla-desactivada-terreno.md` (línea 38).
- **Recomendación técnica:** Evaluar `estadoAsignacion === 'DESACTIVADA'` en ambos enlaces de retorno de detalle, añadir la rama `!tieneUnidadAsignada` al `emptyState` de `cuadrilla/misiones/page.tsx`, unificar `--border-color-neutral` en `PerfilPage.module.css` / `UnidadInactivaBanner.module.css` y homologar el copy del manual con `SinUnidadBanner.tsx`.

---

### BUG-H85-PWA-07 — Desajuste de identificador en payload Socket.io (`data?.id` vs `patrullaId`) y ausencia de pruebas unitarias para `useTerrenoSocket.ts`
- **Severidad:** Media *(Detectado en Re-Test — 12/11/2026 11:37)*
- **Estado:** **`ABIERTO`**
- **Archivos afectados:**
  - `src/hooks/useTerrenoSocket.ts` (líneas 48–55)
  - Ausencia de archivo de pruebas en `src/hooks/__tests__/useTerrenoSocket.test.ts` (requerido por `AGENTS.md §4`)
- **Pasos para reproducir:**
  1. Inspeccionar el manejador `manejarDesactivacion` en `src/hooks/useTerrenoSocket.ts:48-52` frente al contrato emitido por `sgrai-api` en `patrulla:desactivada` (`{ patrullaId, nombre, eliminadoPorId, eliminadoEn }`).
  2. Listar archivos en `src/hooks/__tests__/`.
- **Comportamiento actual:**
  - `manejarDesactivacion` espera `{ id?: string }` y valida `if (!data?.id || data.id === usuario.unidadId)`. Como el evento `patrulla:desactivada` emitido por el backend contiene `patrullaId` y no `id`, `data?.id` resulta `undefined` y `!data?.id` evalúa siempre verdadero. Dado que el servidor emite también broadcast global de `patrulla:desactivada`, **todas las patrullas activas conectadas** ejecutan `recargarSesion()` innecesariamente al desactivarse cualquier otra unidad de la comuna.
  - No existe prueba unitaria que cubra la suscripción a salas, filtrado por `unidadId` y limpieza al desmontar `useTerrenoSocket`.
- **Comportamiento esperado:** Validar `const unidadEventoId = data?.patrullaId ?? data?.cuadrillaId ?? data?.id; if (unidadEventoId === usuario.unidadId) { void recargarSesion(); }` y acompañar el hook con pruebas unitarias en `src/hooks/__tests__/useTerrenoSocket.test.ts` (así como casos para `401`/`403` y `409`/`422` en las suites de sesión y conectividad).
- **Recomendación técnica:** Aceptar `patrullaId`, `cuadrillaId` o `id` en `manejarDesactivacion` comparando estrictamente con `usuario.unidadId`, y agregar `useTerrenoSocket.test.ts` mockeando `socket.io-client`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-H85-PWA-06 | Discriminación visual `ACTIVA` vs `DESACTIVADA` vs `SIN_ASIGNACION`, tokens CSS y alineación con manual H85 | UI / UX / Documentación | Componentes / SSR | Media | Rama `revert-2-feature/H85-desactivar-patrulla` tras corrección parcial en `TerrenoBottomNav` y hub | Inspección de `patrulla/misiones/[id]/page.tsx:144`, `cuadrilla/misiones/[id]/page.tsx:70`, `cuadrilla/misiones/page.tsx:162`, `PerfilPage.module.css:43`, `SinUnidadBanner.tsx` | Etiqueta `'Historial'` y textos históricos restringidos a `estadoAsignacion === 'DESACTIVADA'`; uso de `--border-color-neutral`; copy alineado con manual | `TerrenoBottomNav` y hub corregidos; persisten `'Historial'` en breadcrumbs de detalle en `SIN_ASIGNACION`, `emptyState` de cuadrilla sin `!tieneUnidadAsignada`, `--color-border` en `PerfilPage.module.css` y desfase de copy en manual | ABIERTO | 11/11/2026 11:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H85-PWA-07 | Filtrado por `patrullaId`/`cuadrillaId` en `useTerrenoSocket.ts` y cobertura de pruebas unitarias del hook (`AGENTS.md §4`) | Tiempo Real / Unitaria | Integración / Unitaria | Media | Hook `src/hooks/useTerrenoSocket.ts` integrado en `TerrenoLayout` | Payload `patrulla:desactivada` (`{ patrullaId, nombre, eliminadoEn }`) y verificación de `src/hooks/__tests__/` | `manejarDesactivacion` compara `patrullaId`/`cuadrillaId` con `usuario.unidadId` sin recargar ante bajas ajenas; existe suite `useTerrenoSocket.test.ts` | `useTerrenoSocket.ts:48-52` evalúa `!data?.id`, provocando `recargarSesion()` global cuando se desactiva otra unidad; no existe `useTerrenoSocket.test.ts` | ABIERTO | 12/11/2026 11:37 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H85-PWA-01 | Compilación TypeScript y build productiva Next.js ante nuevos campos en `AuthContextValue` | Estática / Compilación | Integración / Sistema | Crítica | Rama actualizada con fix de mock en `PatrullaDetailPage.test.tsx` | Comandos `npx tsc --noEmit` y `npm run build` | Compilación de tipos TS y bundle productivo Next.js con exit code `0`, más cobertura en `DESACTIVADA` y `SIN_ASIGNACION` | `npx tsc --noEmit` finaliza con `0` errores (`exit 0`) y `npm run build` compila y genera rutas con `exit 0`; `PatrullaDetailPage.test.tsx` aprueba `6/6` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| BUG-H85-PWA-02 | Aislamiento de misiones por `unidadId`, ausencia de datos ficticios y limpieza local IndexedDB | Integración / Seguridad | Integración | Alta | Operador patrulla/cuadrilla en estados `ACTIVA`, `DESACTIVADA` y `SIN_ASIGNACION` | Páginas de misiones/detalle, `TerrenoResumenOperativo`, `TerrenoSiguienteMision`, `misionesService`, `offlineQueue` y `AuthContext.logout` | Filtrado por `patrullaId`/`cuadrillaId`; omisión en `SIN_ASIGNACION`; cero misiones ficticias; limpieza de IndexedDB al sincronizar y al cerrar sesión | Listados, detalle, resumen, siguiente misión y métricas filtran por `unidadId` y limpian IndexedDB; `limpiarAlmacenamientoOffline` limpia `misiones` y `outbox` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| BUG-H85-PWA-03 | Sincronización de tipos `api-generated.d.ts` con OpenAPI de `sgrai-api` y mapeo de `delegacionNombre` | Contrato / Tipado | Sistema | Alta | Contrato `src/types/api-generated.d.ts` regenerado | Revisión de `api-generated.d.ts`, `src/types/seguridad.ts`, `src/services/seguridadService.ts` y `AuthContext.tsx` | Tipos autogenerados con `unidadId`, `unidadNombre`, `unidadActiva`, `delegacionNombre` sin DTOs manuales ni casts `as unknown as` | `seguridad.ts` deriva directamente de `components['schemas']`; `seguridadService.ts` sin casts forzados; `AuthContext` mapea `delegacionNombre` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| BUG-H85-PWA-04 | Escucha Socket.io de baja lógica, invalidación ante HTTP `401`/`403` y protección de outbox ante `409`/`422` | Seguridad / Resiliencia | Sistema | Alta | `useTerrenoSocket.ts` conectado en `TerrenoLayout`, `AuthContext` y `useConnectivity` | Inspección y compilación de `useTerrenoSocket.ts`, `AuthContext.tsx:271-293` y `useConnectivity.ts:71-97` | Suscripción a salas `patrulla:{id}`/`cuadrilla:{id}`; limpieza de sesión ante `401`/`403`; outbox no promueve a `EN_CURSO` ante `409`/`422` | Hook `useTerrenoSocket` activo en layout; `recargarSesion` invalida sesión en `401`/`403`; `useConnectivity` solo promueve a `EN_CURSO` cuando `res.ok` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| BUG-H85-PWA-05 | Trazabilidad por `unidadId` en historial de patrullas, registro en autenticación y delegación en tarjetas | Funcional / Regresión | Unitaria / Integración | Media | Servicios y vistas de `/terreno/perfil` y `AuthContext` | `perfilTerrenoService.ts:52`, `AuthContext.tsx:36,268,300` y `perfil/page.tsx:210-215` | Indexación exclusiva por `unidadId`, invocación en `login`/`recargarSesion`, `unidadId` en demo y delegación visible en tarjetas | Búsqueda exclusiva por `item.unidadId === usuario.unidadId`, registro en hidratación de sesión y tarjeta con `item.delegacion` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-01 | Mapeo Fail-Closed `unidadActiva=false` cuando la patrulla verificadora figura desactivada | Funcional / Unitaria | Unitaria | Alta | Sesión simulada con cookie válida y `obtenerUsuarioActivo` mockeado | `rolCodigo: PATRULLA_VERIFICADORA`, `unidadId` asignado, `unidadActiva: false` | `useAuth()` expone `unidadActiva=false`, `tieneUnidadAsignada=true` y `estadoAsignacion='DESACTIVADA'` | Prueba aprobada en `6ms` (`AuthContext.test.tsx`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-02 | Mapeo operativo `unidadActiva=true` cuando la patrulla verificadora se encuentra activa | Funcional / Unitaria | Unitaria | Alta | Sesión simulada con cookie válida y `obtenerUsuarioActivo` mockeado | `rolCodigo: PATRULLA_VERIFICADORA`, `unidadId` asignado, `unidadActiva: true` | `useAuth()` expone `unidadActiva=true`, `tieneUnidadAsignada=true` y `estadoAsignacion='ACTIVA'` | Prueba aprobada en `7ms` (`AuthContext.test.tsx`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-03 | Detección de estado `SIN_ASIGNACION` cuando el funcionario no tiene patrulla asignada | Funcional / Unitaria | Unitaria | Alta | Sesión simulada de funcionario de terreno sin `unidadId` asignado | `rolCodigo: PATRULLA_VERIFICADORA`, `unidadId: null`, `unidadNombre: null`, `unidadActiva: false` | `useAuth()` expone `tieneUnidadAsignada=false`, `unidadActiva=false` y `estadoAsignacion='SIN_ASIGNACION'` | Prueba `detecta estado SIN_ASIGNACION cuando el funcionario no tiene patrulla asignada` aprobada en `4ms` (`AuthContext.test.tsx`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | feat(ui): alertar a operadores sin patrulla asignada mediante SinUnidadBanner y discriminación de estado |
| CP-H85-PWA-04 | Control RBAC en `AuthContext` ante roles de oficina (`CALL_CENTER` / `ADMIN`) sin destruir sesión web | Seguridad / RBAC | Unitaria | Alta | Login o ingreso a `/terreno` con rol no autorizado | Usuarios mock `CALL_CENTER` o `ADMIN` y cookie `sgrai_auth_token` previa | Rechaza login con `403` y preserva `sgrai_auth_token` al redirigir | Pruebas aprobadas (`4ms` rechazo 403 y `16ms` preservación de cookie en `AuthContext.test.tsx`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-05 | Renderizado de `UnidadInactivaBanner` para patrulla y cuadrilla desactivadas | UI / Componentes | Componentes | Media | `UnidadInactivaBanner` montado en jsdom | Props `tipoUnidad="CUADRILLA"` y `tipoUnidad="PATRULLA"` con `nombreUnidad` y rol `alert` | Muestra banner compacto de advertencia diferenciando patrulla verificadora de cuadrilla en modo solo lectura | `UnidadInactivaBanner.test.tsx` aprueba `2/2` casos en `180ms` (`170ms` cuadrilla, `8ms` patrulla) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | style(ui): hacer mas discreto y compacto el banner de unidad desactivada (H85) |
| CP-H85-PWA-06 | Renderizado de `SinUnidadBanner` para operador sin patrulla o cuadrilla asignada | UI / Componentes | Componentes | Media | `SinUnidadBanner` montado en jsdom | Props `tipoUnidad="PATRULLA"` y `tipoUnidad="CUADRILLA"` con rol `status` | Muestra aviso informativo indicando falta de unidad asignada y canal de contacto con Centro de Mando | `SinUnidadBanner.test.tsx` aprueba `2/2` casos en `184ms` (`168ms` patrulla, `15ms` cuadrilla) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | style(ui): asegurar salto de linea final en componentes de SinUnidadBanner |
| CP-H85-PWA-07 | Modo histórico sin misiones ficticias en `PatrullaMisionesPage` cuando `unidadActiva=false` | Funcional / UI | Componentes | Alta | `useAuth` mockeado con `PATRULLA_VERIFICADORA`, `unidadActiva=false`, `tieneUnidadAsignada=true` | Renderizado de `PatrullaMisionesPage` con `sincronizarMisiones` devolviendo `[]` | Renderiza `UnidadInactivaBanner`, título `Historial` y estado vacío real sin inyectar misiones ficticias | Prueba aprobada en `251ms` verificando `Sin registros disponibles` y texto histórico real | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-08 | Modo histórico sin misiones ficticias en `CuadrillaMisionesPage` cuando `unidadActiva=false` | Funcional / UI | Componentes | Media | `useAuth` mockeado con `DELEGADO_CUADRILLA`, `unidadActiva=false`, `tieneUnidadAsignada=true` | Renderizado de `CuadrillaMisionesPage` con `sincronizarMisiones` devolviendo `[]` | Renderiza `UnidadInactivaBanner`, título `Historial` y estado vacío real de faenas históricas | Prueba aprobada en `255ms` verificando `Sin registros disponibles` y texto de faenas históricas | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-09 | Exposición de alerta de unidad inactiva y enlaces adaptados en Hub `/terreno` (`TerrenoHomePage`) | Funcional / UI | Integración | Media | `useAuth` mockeado en estados activo e inactivo (`useTerrenoSocket` mockeado) | Renderizado de `TerrenoHomePage` y `TerrenoBottomNav` bajo entorno Vitest | Muestra bienvenida, resumen operativo, faenas y banner cuando `unidadActiva=false` | `TerrenoHomePage.test.tsx` aprueba `3/3` casos en `415ms` (`355ms`, `30ms`, `28ms`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-10 | Gestión de historial local de patrullas (`perfilTerrenoService`): registro, actualización a desactivada y ordenamiento | Funcional / Unitaria | Unitaria | Alta | `localStorage` limpio en entorno de pruebas Vitest | Llamadas secuenciales a `registrarPatrullaEnHistorial` y `obtenerHistorialUnidades` | Ignora usuarios sin `unidadId`, registra unidad nueva, actualiza estado a desactivada y ordena descendentemente | `perfilTerrenoService.test.ts` aprueba `6/6` pruebas en `11ms` (`4` específicas de H85) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85) |
| CP-H85-PWA-11 | Renderizado de `/terreno/perfil` con estadísticas limpias, estado sin asignación e historial previo | Funcional / UI | Componentes | Media | `useAuth` y `perfilTerrenoService` mockeados | Renderizado de `TerrenoPerfilPage` en jsdom | Muestra perfil sin enums crudos, estado sin asignación operativa e historial de unidades previas | `PerfilPage.test.tsx` aprueba `3/3` casos en `199ms` (`140ms`, `23ms`, `35ms`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85) |
| CP-H85-PWA-12 | Flujo de aceptación de misión en `PatrullaDetailPage` (unidad activa, RBAC y cola offline) | Funcional / Offline | Componentes | Media | `useAuth` mockeado en modo activo (`unidadActiva: true`, `estadoAsignacion: 'ACTIVA'`) | Clic en `Aceptar Misión` online y offline, y ausencia de permiso `misiones:terreno:verificar` | Botón visible solo con permiso, transición a `En Trayecto / Evaluación` y sincronización offline diferida | `4/4` casos iniciales de HU-36 aprobados en `PatrullaDetailPage.test.tsx` (`227ms`, `31ms`, `66ms`, `50ms`) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-13 | Verificación de ausencia de emojis en `src/` y conformidad ESLint de la rama | Estática / Calidad UI | Estática | Baja | Repositorio `web-app` con últimos commits integrados | Comandos `rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/` y `npm run lint` | Cero emojis en código fuente y `0` errores ESLint | Cero emojis detectados en `src/`; `npm run lint` finaliza con exit code `0`, `0 errors` y `4 warnings` | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | style(ui): asegurar salto de linea final en componentes de SinUnidadBanner |
| CP-H85-PWA-14 | Integración en vivo `sgrai-api` (`login`, `usuario-activo`, rechazo `403` en baja de patrulla) y redirección protegida PWA `307` | Integración / Seguridad | Sistema | Alta | Servicios ejecutándose en `http://localhost:3001` y `http://localhost:3002` durante la sesión inicial | `POST /api/seguridad/login`, `GET /api/seguridad/usuario-activo`, `DELETE /api/patrullas/f1000000-...-0050`, `GET :3002/terreno/patrulla/misiones` | Login retorna JWT y `unidadActiva=true`; `/usuario-activo` exige Bearer (`401`); rol patrulla recibe `403` en `DELETE`; PWA sin cookie redirige `307` | Verificado en vivo el 11/11/2026 (`200`, `401`, `403` `recursos:eliminar`, `307`); servidores locales `:3001`/`:3002` inactivos en sesión del 12/11/2026 | APROBADO | 11/11/2026 11:41 | N/A | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-15 | Documentación de usuario en terreno (`H85-patrulla-desactivada-terreno.md`) con secciones offline y permisos | Documentación | Documentación | Baja | Archivo presente en `docs/manuals/H85-patrulla-desactivada-terreno.md` | Revisión estructural de secciones obligatorias del manual | Presencia de alcance H85, comportamiento sin conexión y requisitos de permisos GPS/Cámara | Archivo completo en estructura (observación de copy tratada en BUG-H85-PWA-06) | APROBADO | 11/11/2026 11:41 | 12/11/2026 11:37 | docs(manuals): documentar alerta sin unidad asignada e historial de patrullas en terreno (H85) |
| CP-H85-PWA-16 | Despliegue de `SinUnidadBanner` en `PatrullaMisionesPage` y `CuadrillaMisionesPage` bajo estado `SIN_ASIGNACION` | Funcional / UI | Componentes | Alta | `useAuth` mockeado con `tieneUnidadAsignada: false` y `estadoAsignacion: 'SIN_ASIGNACION'` | Renderizado de `PatrullaMisionesPage` y `CuadrillaMisionesPage` en Vitest | Renderiza `SinUnidadBanner` con título `Misiones` (no `Historial`) y sin invocar sincronización operativa | Casos aprobados en `23ms` (`PatrullaMisionesPage.test.tsx`, `1 passed, 95 skipped` con `-t`) y `28ms` (`CuadrillaMisionesPage.test.tsx`) | APROBADO | 12/11/2026 11:37 | N/A | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |
| CP-H85-PWA-17 | Bloqueo de controles operativos en detalle de patrulla (`PatrullaDetailPage`) en estados `DESACTIVADA` y `SIN_ASIGNACION` | Funcional / Seguridad UI | Componentes | Alta | `useAuth` mockeado en `DESACTIVADA` y `SIN_ASIGNACION` con misión despachada mockeada | Renderizado de `PatrullaMisionDetailPage` verificando banners y ausencia de botón `Aceptar Misión` | Muestra `UnidadInactivaBanner` o `SinUnidadBanner` según estado y oculta botón `Aceptar Misión` | Casos aprobados en `18ms` (`DESACTIVADA`, `1 passed, 95 skipped` con `-t`) y `19ms` (`SIN_ASIGNACION`) | APROBADO | 12/11/2026 11:37 | N/A | fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H85-PWA-06	Discriminación visual ACTIVA vs DESACTIVADA vs SIN_ASIGNACION, tokens CSS y alineación con manual H85	UI / UX / Documentación	Componentes / SSR	Media	Rama revert-2-feature/H85-desactivar-patrulla tras corrección parcial en TerrenoBottomNav y hub	Inspección de patrulla/misiones/[id]/page.tsx:144, cuadrilla/misiones/[id]/page.tsx:70, cuadrilla/misiones/page.tsx:162, PerfilPage.module.css:43, SinUnidadBanner.tsx	Etiqueta 'Historial' y textos históricos restringidos a estadoAsignacion === 'DESACTIVADA'; uso de --border-color-neutral; copy alineado con manual	TerrenoBottomNav y hub corregidos; persisten 'Historial' en breadcrumbs de detalle en SIN_ASIGNACION, emptyState de cuadrilla sin !tieneUnidadAsignada, --color-border en PerfilPage.module.css y desfase de copy en manual	ABIERTO	11/11/2026 11:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-PWA-07	Filtrado por patrullaId/cuadrillaId en useTerrenoSocket.ts y cobertura de pruebas unitarias del hook (AGENTS.md §4)	Tiempo Real / Unitaria	Integración / Unitaria	Media	Hook src/hooks/useTerrenoSocket.ts integrado en TerrenoLayout	Payload patrulla:desactivada ({ patrullaId, nombre, eliminadoEn }) y verificación de src/hooks/__tests__/	manejarDesactivacion compara patrullaId/cuadrillaId con usuario.unidadId sin recargar ante bajas ajenas; existe suite useTerrenoSocket.test.ts	useTerrenoSocket.ts:48-52 evalúa !data?.id, provocando recargarSesion() global cuando se desactiva otra unidad; no existe useTerrenoSocket.test.ts	ABIERTO	12/11/2026 11:37	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-PWA-01	Compilación TypeScript y build productiva Next.js ante nuevos campos en AuthContextValue	Estática / Compilación	Integración / Sistema	Crítica	Rama actualizada con fix de mock en PatrullaDetailPage.test.tsx	Comandos npx tsc --noEmit y npm run build	Compilación de tipos TS y bundle productivo Next.js con exit code 0, más cobertura en DESACTIVADA y SIN_ASIGNACION	npx tsc --noEmit finaliza con 0 errores (exit 0) y npm run build compila y genera rutas con exit 0; PatrullaDetailPage.test.tsx aprueba 6/6	APROBADO	11/11/2026 11:41	12/11/2026 11:37	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
BUG-H85-PWA-02	Aislamiento de misiones por unidadId, ausencia de datos ficticios y limpieza local IndexedDB	Integración / Seguridad	Integración	Alta	Operador patrulla/cuadrilla en estados ACTIVA, DESACTIVADA y SIN_ASIGNACION	Páginas de misiones/detalle, TerrenoResumenOperativo, TerrenoSiguienteMision, misionesService, offlineQueue y AuthContext.logout	Filtrado por patrullaId/cuadrillaId; omisión en SIN_ASIGNACION; cero misiones ficticias; limpieza de IndexedDB al sincronizar y al cerrar sesión	Listados, detalle, resumen, siguiente misión y métricas filtran por unidadId y limpian IndexedDB; limpiarAlmacenamientoOffline limpia misiones y outbox	APROBADO	11/11/2026 11:41	12/11/2026 11:37	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
BUG-H85-PWA-03	Sincronización de tipos api-generated.d.ts con OpenAPI de sgrai-api y mapeo de delegacionNombre	Contrato / Tipado	Sistema	Alta	Contrato src/types/api-generated.d.ts regenerado	Revisión de api-generated.d.ts, src/types/seguridad.ts, src/services/seguridadService.ts y AuthContext.tsx	Tipos autogenerados con unidadId, unidadNombre, unidadActiva, delegacionNombre sin DTOs manuales ni casts as unknown as	seguridad.ts deriva directamente de components['schemas']; seguridadService.ts sin casts forzados; AuthContext mapea delegacionNombre	APROBADO	11/11/2026 11:41	12/11/2026 11:37	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
BUG-H85-PWA-04	Escucha Socket.io de baja lógica, invalidación ante HTTP 401/403 y protección de outbox ante 409/422	Seguridad / Resiliencia	Sistema	Alta	useTerrenoSocket.ts conectado en TerrenoLayout, AuthContext y useConnectivity	Inspección y compilación de useTerrenoSocket.ts, AuthContext.tsx:271-293 y useConnectivity.ts:71-97	Suscripción a salas patrulla:{id}/cuadrilla:{id}; limpieza de sesión ante 401/403; outbox no promueve a EN_CURSO ante 409/422	Hook useTerrenoSocket activo en layout; recargarSesion invalida sesión en 401/403; useConnectivity solo promueve a EN_CURSO cuando res.ok	APROBADO	11/11/2026 11:41	12/11/2026 11:37	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
BUG-H85-PWA-05	Trazabilidad por unidadId en historial de patrullas, registro en autenticación y delegación en tarjetas	Funcional / Regresión	Unitaria / Integración	Media	Servicios y vistas de /terreno/perfil y AuthContext	perfilTerrenoService.ts:52, AuthContext.tsx:36,268,300 y perfil/page.tsx:210-215	Indexación exclusiva por unidadId, invocación en login/recargarSesion, unidadId en demo y delegación visible en tarjetas	Búsqueda exclusiva por item.unidadId === usuario.unidadId, registro en hidratación de sesión y tarjeta con item.delegacion	APROBADO	11/11/2026 11:41	12/11/2026 11:37	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-01	Mapeo Fail-Closed unidadActiva=false cuando la patrulla verificadora figura desactivada	Funcional / Unitaria	Unitaria	Alta	Sesión simulada con cookie válida y obtenerUsuarioActivo mockeado	rolCodigo: PATRULLA_VERIFICADORA, unidadId asignado, unidadActiva: false	useAuth() expone unidadActiva=false, tieneUnidadAsignada=true y estadoAsignacion='DESACTIVADA'	Prueba aprobada en 6ms (AuthContext.test.tsx)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-02	Mapeo operativo unidadActiva=true cuando la patrulla verificadora se encuentra activa	Funcional / Unitaria	Unitaria	Alta	Sesión simulada con cookie válida y obtenerUsuarioActivo mockeado	rolCodigo: PATRULLA_VERIFICADORA, unidadId asignado, unidadActiva: true	useAuth() expone unidadActiva=true, tieneUnidadAsignada=true y estadoAsignacion='ACTIVA'	Prueba aprobada en 7ms (AuthContext.test.tsx)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-03	Detección de estado SIN_ASIGNACION cuando el funcionario no tiene patrulla asignada	Funcional / Unitaria	Unitaria	Alta	Sesión simulada de funcionario de terreno sin unidadId asignado	rolCodigo: PATRULLA_VERIFICADORA, unidadId: null, unidadNombre: null, unidadActiva: false	useAuth() expone tieneUnidadAsignada=false, unidadActiva=false y estadoAsignacion='SIN_ASIGNACION'	Prueba detecta estado SIN_ASIGNACION cuando el funcionario no tiene patrulla asignada aprobada en 4ms (AuthContext.test.tsx)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	feat(ui): alertar a operadores sin patrulla asignada mediante SinUnidadBanner y discriminación de estado
CP-H85-PWA-04	Control RBAC en AuthContext ante roles de oficina (CALL_CENTER / ADMIN) sin destruir sesión web	Seguridad / RBAC	Unitaria	Alta	Login o ingreso a /terreno con rol no autorizado	Usuarios mock CALL_CENTER o ADMIN y cookie sgrai_auth_token previa	Rechaza login con 403 y preserva sgrai_auth_token al redirigir	Pruebas aprobadas (4ms rechazo 403 y 16ms preservación de cookie en AuthContext.test.tsx)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-05	Renderizado de UnidadInactivaBanner para patrulla y cuadrilla desactivadas	UI / Componentes	Componentes	Media	UnidadInactivaBanner montado en jsdom	Props tipoUnidad="CUADRILLA" y tipoUnidad="PATRULLA" con nombreUnidad y rol alert	Muestra banner compacto de advertencia diferenciando patrulla verificadora de cuadrilla en modo solo lectura	UnidadInactivaBanner.test.tsx aprueba 2/2 casos en 180ms (170ms cuadrilla, 8ms patrulla)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	style(ui): hacer mas discreto y compacto el banner de unidad desactivada (H85)
CP-H85-PWA-06	Renderizado de SinUnidadBanner para operador sin patrulla o cuadrilla asignada	UI / Componentes	Componentes	Media	SinUnidadBanner montado en jsdom	Props tipoUnidad="PATRULLA" y tipoUnidad="CUADRILLA" con rol status	Muestra aviso informativo indicando falta de unidad asignada y canal de contacto con Centro de Mando	SinUnidadBanner.test.tsx aprueba 2/2 casos en 184ms (168ms patrulla, 15ms cuadrilla)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	style(ui): asegurar salto de linea final en componentes de SinUnidadBanner
CP-H85-PWA-07	Modo histórico sin misiones ficticias en PatrullaMisionesPage cuando unidadActiva=false	Funcional / UI	Componentes	Alta	useAuth mockeado con PATRULLA_VERIFICADORA, unidadActiva=false, tieneUnidadAsignada=true	Renderizado de PatrullaMisionesPage con sincronizarMisiones devolviendo []	Renderiza UnidadInactivaBanner, título Historial y estado vacío real sin inyectar misiones ficticias	Prueba aprobada en 251ms verificando Sin registros disponibles y texto histórico real	APROBADO	11/11/2026 11:41	12/11/2026 11:37	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-08	Modo histórico sin misiones ficticias en CuadrillaMisionesPage cuando unidadActiva=false	Funcional / UI	Componentes	Media	useAuth mockeado con DELEGADO_CUADRILLA, unidadActiva=false, tieneUnidadAsignada=true	Renderizado de CuadrillaMisionesPage con sincronizarMisiones devolviendo []	Renderiza UnidadInactivaBanner, título Historial y estado vacío real de faenas históricas	Prueba aprobada en 255ms verificando Sin registros disponibles y texto de faenas históricas	APROBADO	11/11/2026 11:41	12/11/2026 11:37	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-09	Exposición de alerta de unidad inactiva y enlaces adaptados en Hub /terreno (TerrenoHomePage)	Funcional / UI	Integración	Media	useAuth mockeado en estados activo e inactivo (useTerrenoSocket mockeado)	Renderizado de TerrenoHomePage y TerrenoBottomNav bajo entorno Vitest	Muestra bienvenida, resumen operativo, faenas y banner cuando unidadActiva=false	TerrenoHomePage.test.tsx aprueba 3/3 casos en 415ms (355ms, 30ms, 28ms)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-10	Gestión de historial local de patrullas (perfilTerrenoService): registro, actualización a desactivada y ordenamiento	Funcional / Unitaria	Unitaria	Alta	localStorage limpio en entorno de pruebas Vitest	Llamadas secuenciales a registrarPatrullaEnHistorial y obtenerHistorialUnidades	Ignora usuarios sin unidadId, registra unidad nueva, actualiza estado a desactivada y ordena descendentemente	perfilTerrenoService.test.ts aprueba 6/6 pruebas en 11ms (4 específicas de H85)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85)
CP-H85-PWA-11	Renderizado de /terreno/perfil con estadísticas limpias, estado sin asignación e historial previo	Funcional / UI	Componentes	Media	useAuth y perfilTerrenoService mockeados	Renderizado de TerrenoPerfilPage en jsdom	Muestra perfil sin enums crudos, estado sin asignación operativa e historial de unidades previas	PerfilPage.test.tsx aprueba 3/3 casos en 199ms (140ms, 23ms, 35ms)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85)
CP-H85-PWA-12	Flujo de aceptación de misión en PatrullaDetailPage (unidad activa, RBAC y cola offline)	Funcional / Offline	Componentes	Media	useAuth mockeado en modo activo (unidadActiva: true, estadoAsignacion: 'ACTIVA')	Clic en Aceptar Misión online y offline, y ausencia de permiso misiones:terreno:verificar	Botón visible solo con permiso, transición a En Trayecto / Evaluación y sincronización offline diferida	4/4 casos iniciales de HU-36 aprobados en PatrullaDetailPage.test.tsx (227ms, 31ms, 66ms, 50ms)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-13	Verificación de ausencia de emojis en src/ y conformidad ESLint de la rama	Estática / Calidad UI	Estática	Baja	Repositorio web-app con últimos commits integrados	Comandos rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ y npm run lint	Cero emojis en código fuente y 0 errores ESLint	Cero emojis detectados en src/; npm run lint finaliza con exit code 0, 0 errors y 4 warnings	APROBADO	11/11/2026 11:41	12/11/2026 11:37	style(ui): asegurar salto de linea final en componentes de SinUnidadBanner
CP-H85-PWA-14	Integración en vivo sgrai-api (login, usuario-activo, rechazo 403 en baja de patrulla) y redirección protegida PWA 307	Integración / Seguridad	Sistema	Alta	Servicios ejecutándose en http://localhost:3001 y http://localhost:3002 durante la sesión inicial	POST /api/seguridad/login, GET /api/seguridad/usuario-activo, DELETE /api/patrullas/f1000000-...-0050, GET :3002/terreno/patrulla/misiones	Login retorna JWT y unidadActiva=true; /usuario-activo exige Bearer (401); rol patrulla recibe 403 en DELETE; PWA sin cookie redirige 307	Verificado en vivo el 11/11/2026 (200, 401, 403 recursos:eliminar, 307); servidores locales :3001/:3002 inactivos en sesión del 12/11/2026	APROBADO	11/11/2026 11:41	N/A	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-15	Documentación de usuario en terreno (H85-patrulla-desactivada-terreno.md) con secciones offline y permisos	Documentación	Documentación	Baja	Archivo presente en docs/manuals/H85-patrulla-desactivada-terreno.md	Revisión estructural de secciones obligatorias del manual	Presencia de alcance H85, comportamiento sin conexión y requisitos de permisos GPS/Cámara	Archivo completo en estructura (observación de copy tratada en BUG-H85-PWA-06)	APROBADO	11/11/2026 11:41	12/11/2026 11:37	docs(manuals): documentar alerta sin unidad asignada e historial de patrullas en terreno (H85)
CP-H85-PWA-16	Despliegue de SinUnidadBanner en PatrullaMisionesPage y CuadrillaMisionesPage bajo estado SIN_ASIGNACION	Funcional / UI	Componentes	Alta	useAuth mockeado con tieneUnidadAsignada: false y estadoAsignacion: 'SIN_ASIGNACION'	Renderizado de PatrullaMisionesPage y CuadrillaMisionesPage en Vitest	Renderiza SinUnidadBanner con título Misiones (no Historial) y sin invocar sincronización operativa	Casos aprobados en 23ms (PatrullaMisionesPage.test.tsx, 1 passed, 95 skipped con -t) y 28ms (CuadrillaMisionesPage.test.tsx)	APROBADO	12/11/2026 11:37	N/A	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
CP-H85-PWA-17	Bloqueo de controles operativos en detalle de patrulla (PatrullaDetailPage) en estados DESACTIVADA y SIN_ASIGNACION	Funcional / Seguridad UI	Componentes	Alta	useAuth mockeado en DESACTIVADA y SIN_ASIGNACION con misión despachada mockeada	Renderizado de PatrullaMisionDetailPage verificando banners y ausencia de botón Aceptar Misión	Muestra UnidadInactivaBanner o SinUnidadBanner según estado y oculta botón Aceptar Misión	Casos aprobados en 18ms (DESACTIVADA, 1 passed, 95 skipped con -t) y 19ms (SIN_ASIGNACION)	APROBADO	12/11/2026 11:37	N/A	fix(terreno): resolver defectos de QA para HU-85 sobre modo historico y fail-closed
```

---

## 5. Guía de Ejecución y Replicabilidad Paso a Paso (Ciclo Re-Test)

Todos los comandos listados a continuación fueron ejecutados desde la raíz del repositorio `web-app`.

### 5.1 Suite completa Vitest y subconjunto H85 (Re-Test `12/11/2026`)

```bash
npm test
```

Salida observada:

```text
 Test Files  27 passed (27)
      Tests  96 passed (96)
   Start at  11:35:06
   Duration  5.12s (transform 3.06s, setup 7.30s, collect 10.35s, tests 6.44s, environment 32.48s, prepare 4.13s)
```

Ejecución específica de las `11` suites vinculadas a HU-85, misiones y conectividad:

```bash
npx vitest run --reporter=verbose \
  src/context/__tests__/AuthContext.test.tsx \
  src/services/__tests__/perfilTerrenoService.test.ts \
  'src/app/(terreno)/perfil/__tests__/PerfilPage.test.tsx' \
  'src/app/(terreno)/patrulla/misiones/__tests__/PatrullaMisionesPage.test.tsx' \
  'src/app/(terreno)/cuadrilla/misiones/__tests__/CuadrillaMisionesPage.test.tsx' \
  src/components/common/__tests__/SinUnidadBanner.test.tsx \
  src/components/common/__tests__/UnidadInactivaBanner.test.tsx \
  'src/app/(terreno)/__tests__/TerrenoHomePage.test.tsx' \
  'src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx' \
  src/services/__tests__/misionesService.test.ts \
  src/hooks/__tests__/useConnectivity.test.ts
```

Salida observada:

```text
 Test Files  11 passed (11)
      Tests  45 passed (45)
   Start at  11:37:00
   Duration  2.77s (transform 1.68s, setup 2.79s, collect 5.32s, tests 2.10s, environment 11.04s, prepare 1.44s)
```

Ejecución individual de los nuevos casos incorporados con filtro `-t`:

```bash
npm test -- -t "bloquea controles operativos cuando la patrulla está DESACTIVADA"
npm test -- -t "banner SinUnidadBanner cuando el funcionario no tiene patrulla asignada"
```

Salidas observadas:

```text
# Filtro 1: "bloquea controles operativos cuando la patrulla está DESACTIVADA"
 Test Files  1 passed | 26 skipped (27)
      Tests  1 passed | 95 skipped (96)
   Start at  11:37:52
   Duration  5.38s (transform 3.34s, setup 7.54s, collect 11.64s, tests 588ms, environment 36.15s, prepare 5.06s)

# Filtro 2: "banner SinUnidadBanner cuando el funcionario no tiene patrulla asignada"
 Test Files  1 passed | 26 skipped (27)
      Tests  1 passed | 95 skipped (96)
   Start at  11:37:58
   Duration  4.88s (transform 2.83s, setup 6.81s, collect 9.10s, tests 158ms, environment 32.49s, prepare 4.16s)
```

### 5.2 Verificación de tipos TypeScript, Build de producción y ESLint (Verificación de `BUG-H85-PWA-01`)

```bash
npx tsc --noEmit
npm run build
npm run lint
```

Salidas observadas:
- `npx tsc --noEmit`: exit code `0` (`0` errores).
- `npm run build` (Next.js 16.3.4 Turbopack): exit code `0` (`✓ Compiled successfully in 1809ms`, `✓ Finished TypeScript in 4.1s`, `✓ Generating static pages using 11 workers (8/8)`).
- `npm run lint`: exit code `0`, `0 errors` y `4 warnings` en `@next/next/no-location-assign-relative-destination` (`src/app/(auth)/login/page.tsx:51`, `src/app/(terreno)/page.tsx:26`, `src/context/AuthContext.tsx:147`, `src/lib/api/client.ts:47`).

### 5.3 Inspección de reglas visuales, CSS y cobertura de Socket.io (Evidencia de `BUG-H85-PWA-06` y `07`)

```bash
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS_IN_SRC"
rg -n -e socket -e "patrulla:desactivada" src/hooks/useTerrenoSocket.ts 'src/app/(terreno)/layout.tsx'
rg -n "color-border" src/app/\(terreno\)/perfil/PerfilPage.module.css src/components/common/UnidadInactivaBanner.module.css
ls src/hooks/__tests__/
```

### 5.4 Evidencia cURL de referencia (`11/11/2026`, entorno `sgrai-api` `:3001` y `sgrai-pwa` `:3002`)

*(Nota: en la sesión del `12/11/2026` no hay procesos escuchando en los puertos `3001` ni `3002`; la evidencia cURL de contrato en vivo corresponde a la ejecución del `11/11/2026`)*

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

| Criterio de Aceptación / Regla (HU-85) | Responsabilidad Arquitectónica | Cobertura en `sgrai-pwa` | Estado tras Re-Test | Referencia / Brechas |
|---|---|---|---|---|
| **CA-1:** Acción 'Desactivar Patrulla' en panel de administración | `sgrai-web` (Administración) | Fuera de alcance en PWA (`AGENTS.md §1`). RBAC bloquea rol patrulla (`403`) y redirige roles de oficina sin destruir cookie | Aprobado | `CP-H85-PWA-04`, `CP-H85-PWA-14` |
| **CA-2:** Modal de confirmación advirtiendo impacto de la acción | `sgrai-web` (Administración) | En terreno se muestran banners diferenciados `UnidadInactivaBanner` y `SinUnidadBanner` | Con observaciones menores | `CP-H85-PWA-05`, `CP-H85-PWA-06`, `CP-H85-PWA-16`, `BUG-H85-PWA-06` |
| **CA-3:** API rechaza baja con `409 Conflict` si está `EN_VERIFICACION` o con misiones activas | `sgrai-api` (Backend) | La PWA maneja rechazo `409`/`422` en outbox sin confirmar falsamente `EN_CURSO` y bloquea controles si `DESACTIVADA` | Aprobado en código (con observación de test) | `BUG-H85-PWA-01`, `BUG-H85-PWA-04`, `CP-H85-PWA-17`, `BUG-H85-PWA-07` |
| **CA-4:** Baja lógica (`activo = false`, `eliminado_en`) sin borrar historial | `sgrai-api` (Backend / BD) | Modo histórico solo lectura (`DESACTIVADA`), historial local por `unidadId` en `/terreno/perfil` con delegación y cero datos ficticios | Aprobado | `BUG-H85-PWA-02`, `BUG-H85-PWA-05`, `CP-H85-PWA-01`, `CP-H85-PWA-10` |
| **CA-5:** Liberación de vehículo y personal a disponibilidad comunal | `sgrai-api` / `sgrai-web` | Detección `SIN_ASIGNACION`, `SinUnidadBanner`, aislamiento de misiones previas, escucha Socket.io | Con observaciones menores | `CP-H85-PWA-03`, `CP-H85-PWA-16`, `BUG-H85-PWA-06`, `BUG-H85-PWA-07` |
| **Regla Crítica §3.7, OpenAPI, Build y Calidad (`AGENTS.md §4`)** | Transversal (`sgrai-api` + `sgrai-pwa`) | `api-generated.d.ts` sincronizado, `tsc`/`build` verdes, pendiente cobertura unitaria de `useTerrenoSocket.ts` | Con observaciones menores | `BUG-H85-PWA-01`, `BUG-H85-PWA-03`, `BUG-H85-PWA-07` |

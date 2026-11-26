# Auditoría Técnica y Matriz de Casos de Prueba — HU-41: Rechazo Motivado de Misión por Delegado de Cuadrilla (`sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Estándar Aplicado:** IEEE 829 / ISO/IEC/IEEE 29119  
**Repositorio Auditado:** `sgrai-pwa` (`web-app` — Cliente Móvil de Terreno PWA)  
**Rama Evaluada:** `feature/h41-cuadrilla-rechazar-asignacion`  
**Historia de Usuario:** HU-41 — *"Como Delegado de cuadrilla Quiero rechazar la solicitud de asignación a un incidente ingresando una justificación técnica obligatoria. Para informar oportunamente al Centro de Mando los motivos de fuerza mayor que impiden la atención para que la emergencia sea reasignada de inmediato a otra unidad."*  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
**Commits Evaluados en la Rama (Auditoría Inicial y Ciclo de Re-Test):**
* `feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41)`
* `feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41)`
* `feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)`
* `test(cuadrilla): agregar pruebas unitarias y de integracion para rechazo motivado (H41)`
* `docs(manuals): agregar manual de usuario para rechazo motivado de cuadrilla (H41)`
* `docs(qa): agregar informe de auditoria tecnica y matriz de casos de prueba para HU-41`
* `merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y resolver conflictos de PWA`
* `fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41`
* `test(h41): agregar pruebas de regresión y actualizar documentación QA`

**Fecha y Hora de Auditoría Inicial:** `24/11/2026 01:36 -03:00`  
**Fecha y Hora de Ciclo Re-Test Final:** `25/11/2026 14:17 -03:00`  
**Entorno de Ejecución Re-Test:** Linux, Node.js, Next.js 16.3.4 (Webpack), React 19.2.8, TypeScript 5, Zod 4.5.4, IndexedDB `idb` 8.0.2 (`fake-indexeddb` 6.2.6), `openapi-fetch` 0.17.0, `socket.io-client` 4.8.3, `lucide-react` 1.48.0, Vitest 3.2.7, React Testing Library 16.3.3, ESLint 9.  
**Dictamen de Auditoría Final:** **APROBADO PARA INTEGRACIÓN EN `develop` (`5` de `5` Defectos Corregidos; `19` de `19` Casos Aprobados — `100.0%` Pass)**

---

## 1. Resumen Ejecutivo

Tras completar el ciclo formal de **Re-Test** (`25/11/2026 14:17 -03:00`) sobre la rama `feature/h41-cuadrilla-rechazar-asignacion` en el repositorio `sgrai-pwa` (`web-app`), se certificó la resolución íntegra de los `5` defectos detectados durante la auditoría inicial (`BUG-H41-PWA-01` Crítico, `BUG-H41-PWA-02`, `BUG-H41-PWA-03` y `BUG-H41-PWA-04` Altos, y `BUG-H41-PWA-05` Medio), sin regresiones sobre las historias previamente integradas en `develop` (HU-35, HU-36, HU-37, HU-38, HU-69, HU-82 y HU-85).

Las correcciones restauraron la firma estricta `params: Promise<{ id: string }>` en `CuadrillaMisionDetailPage` (habilitando `npx tsc --noEmit` y `npm run build` con código de salida `0`), integraron limpiamente los cambios de `origin/develop` (`0` commits detrás y `0` conflictos), completaron el mapeo remoto de `justificacionRechazo` y la persistencia optimista de respaldo en IndexedDB (`misionesService.ts`), incorporaron retroalimentación persistente en la bandeja `/cuadrilla/misiones` tras redirigir y rollback consistente en `useConnectivity.ts` ante respuestas `409`/`403`/`400`, añadieron filtrado por `cuadrillaId` en `useTerrenoSocket.ts` junto con `8` pruebas específicas de regresión (`BUG-H41`) distribuidas en `6` suites, reemplazaron la variable CSS inexistente `--color-border` por `--border-color-neutral`, agregaron cancelación limpia del efecto GPS en `RechazoMisionModal.tsx` y homologaron el manual de usuario y los contratos en `docs/api/contratos-terreno.md`.

| Métrica de Calidad | Auditoría Inicial (`24/11/2026`) | Ciclo Re-Test Final (`25/11/2026`) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos en Matriz (HU-41 PWA)** | **19** | **19** | `5` Defectos Verificados (`BUG-H41-PWA-01` a `05`) + `14` Casos Base (`CP-H41-PWA-01` a `14`) |
| **Casos Aprobados (`APROBADO`)** | 14 | **19** | **`100.0%` de efectividad de pruebas en Re-Test** |
| **Defectos Abiertos (`ABIERTO`)** | 5 (`1` Crítico, `3` Altos, `1` Medio) | **0** | **`5` de `5` defectos corregidos y verificados** |
| **Suite Global PWA (`npm test`)** | `35` archivos / `143` tests pass | **`51` archivos / `280` tests pass** | Duración `14.61s`; 100% en verde tras integrar `develop` (H37, H38, H69) y fixes H41 |
| **Subconjunto Focalizado HU-41 (Vitest)** | `7` archivos / `36` tests pass | **`7` archivos / `63` tests pass** | Incremento de cobertura en `CuadrillaDetailPage`, `CuadrillaMisionesPage`, `RechazoMisionModal`, `useConnectivity`, `useTerrenoSocket` y `misionesService` |
| **Pruebas de Regresión Filtradas (`-t "BUG-H41"`)** | N/A | **`6` archivos / `8` tests pass** | Ejecución focalizada en `9.93s` cubriendo todos los hallazgos |
| **Verificación de Tipos (`npx tsc --noEmit`)** | **FALLIDO** (`exit 2`, `2` errores) | **APROBADO** (`exit 0`, `0` errores) | Tipado estricto validado sin errores ni uso de `any` |
| **Build de Producción (`npm run build`)** | **FALLIDO** (`exit 1`) | **APROBADO** (`exit 0`) | Compilación Webpack (`12.4s`), TypeScript (`6.8s`) y `8/8` páginas estáticas generadas |
| **Análisis Estático ESLint (`npm run lint`)** | **APROBADO** (`0` errores / `0` advertencias) | **APROBADO** (`0` errores / `0` advertencias) | Sin incidencias de linter |
| **Divergencia con `origin/develop`** | `55` commits detrás (`10` conflictos) | **`0` commits detrás (`0` conflictos)** | Rama lista para integración en `develop` |
| **Verificación de Emojis, Google Fonts y `any`** | Aprobado (`0` coincidencias) | **APROBADO** (`0` coincidencias) | `NO_EMOJIS`, `OK_NO_GOOGLE_FONTS`, `NO_COLOR_BORDER_DETAIL`, `NO_ANY` |

---

## 2. Registro Técnico de Defectos y Verificación de Subsanación (Re-Test Final)

### `BUG-H41-PWA-01` — Fallo de compilación TypeScript (`TS2344`, `TS2614`) y build de producción Next.js 16 en `CuadrillaMisionDetailPage` y `socketClient.ts`
* **Severidad:** Crítica (Bloqueante de build, CI/CD y despliegue Docker)
* **Estado:** **CORREGIDO / APROBADO (Verificado en Re-Test — 25/11/2026)**
* **Commits de Solución:**
  * `merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y resolver conflictos de PWA`
  * `fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41`
  * `test(h41): agregar pruebas de regresión y actualizar documentación QA`
* **Archivos Corregidos:**
  * `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (líneas 36–42)
  * `src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx` (líneas 1, 80–288)
  * `src/lib/socket/socketClient.ts` (líneas 1–4)
* **Verificación Técnica en Re-Test:**  
  1. `CuadrillaMisionDetailPage` restauró `interface PageProps { params: Promise<{ id: string }>; }` y `const resolvedParams = use(params);`, cumpliendo el contrato de App Router de Next.js 16.
  2. `CuadrillaDetailPage.test.tsx` envuelve los renders en `<Suspense fallback={null}>` pasando `params={Promise.resolve({ id: misionDespachada.id })}` dentro de `await act(async () => render(...))`.
  3. `socketClient.ts` ya no importa `DEV_PATRULLA_TOKEN` tras integrar `origin/develop`.
  4. `npx tsc --noEmit` finaliza con `exit code 0` (`0` errores) y `npm run build` completa exitosamente (`exit code 0`, `✓ Compiled successfully in 12.4s`, `✓ Finished TypeScript in 6.8s`, `8/8` páginas estáticas).

---

### `BUG-H41-PWA-02` — Desactualización severa (`55` commits detrás) y conflictos directos en `10` archivos compartidos con `origin/develop`
* **Severidad:** Alta (Riesgo de regresión funcional en HU-37 / HU-38 / HU-69 e inconsistencia de contratos OpenAPI)
* **Estado:** **CORREGIDO / APROBADO (Verificado en Re-Test — 25/11/2026)**
* **Commit de Solución:** `merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y resolver conflictos de PWA`
* **Verificación Técnica en Re-Test:**  
  1. `git rev-list --left-right --count origin/develop...HEAD` retorna `0 9` (`0` commits por detrás de `origin/develop`).
  2. Se preservaron las funcionalidades integradas en `develop` (HU-37, HU-38, HU-69), incluyendo ordenamiento causal de `outbox` (`offlineQueue.ts`), `useMisionesSocket` y `NuevaMisionBanner` en `CuadrillaMisionesPage`, valores por defecto de `RechazoMisionModal` compatibles con H69 (`titulo` / `unidadEtiqueta`) y los contratos OpenAPI unificados en `src/types/api-generated.d.ts`.
  3. Las `51` suites globales (`280` tests) aprueban sin regresiones.

---

### `BUG-H41-PWA-03` — Omisión de `justificacionRechazo` en `obtenerDetalleMision`, pérdida de feedback visual por `router.push` inmediato y consistencia parcial en `outbox`
* **Severidad:** Alta (Integridad Offline-First y pérdida de trazabilidad / retroalimentación operativa)
* **Estado:** **CORREGIDO / APROBADO (Verificado en Re-Test — 25/11/2026)**
* **Commits de Solución:**
  * `fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41`
  * `test(h41): agregar pruebas de regresión y actualizar documentación QA`
* **Archivos Corregidos:**
  * `src/services/misionesService.ts` (líneas 382–404 y 670–699)
  * `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (líneas 193–197)
  * `src/app/(terreno)/cuadrilla/misiones/page.tsx` (líneas 33–50 y 168–199) y `src/app/(terreno)/cuadrilla/misiones/CuadrillaMisionesPage.module.css` (líneas 107–151)
  * `src/hooks/useConnectivity.ts` (líneas 81–84 y 278–336)
* **Verificación Técnica en Re-Test:**  
  1. `obtenerDetalleMision` mapea explícitamente `justificacionRechazo` y `estadoCuadrilla`, omitiendo `estadoPatrulla` cuando `d.patrulla` es `null`.
  2. `persistirRechazoLocal` crea un registro de respaldo `MisionLocal` en IndexedDB cuando `obtenerMisionLocalPorId(id)` retorna `undefined`.
  3. `handleConfirmarRechazo` navega con parámetros `?rechazo=ok|offline&msg=...` y `CuadrillaMisionesPage` renderiza el banner persistente (`role="status"`) en variante éxito u offline con botón de cierre accesible (`descartarFeedbackRechazo`).
  4. En `useConnectivity.ts`, ante errores terminales/irrecuperables (`409`/`403`/`400`/`422`) sobre `RECHAZAR_MISION`, se revierte el registro local a `estado: 'DESPACHADA'`, se elimina `datosAdicionales.justificacionRechazo`, se limpia `sincronizacionPendiente: false`, se invoca `eliminarAccionOutbox(accion.id)` y se ejecuta `obtenerDetalleMision(misionId)`. Ante `401 Unauthorized` se invoca `handleUnauthorizedSession()`.

---

### `BUG-H41-PWA-04` — Cobertura insuficiente de pruebas automatizadas (`AGENTS.md §4`) y ausencia de filtro por `cuadrillaId` en `useTerrenoSocket.ts`
* **Severidad:** Alta (Incumplimiento de estándar de pruebas `AGENTS.md §4` y riesgo de eventos cruzados)
* **Estado:** **CORREGIDO / APROBADO (Verificado en Re-Test — 25/11/2026)**
* **Commits de Solución:**
  * `fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41`
  * `test(h41): agregar pruebas de regresión y actualizar documentación QA`
* **Archivos Corregidos:**
  * `src/hooks/useTerrenoSocket.ts` (líneas 61–74) y `src/hooks/__tests__/useTerrenoSocket.test.ts` (líneas 211–264)
  * `src/hooks/__tests__/useConnectivity.test.ts` (líneas 400–502)
  * `src/app/(terreno)/cuadrilla/misiones/__tests__/CuadrillaMisionesPage.test.tsx` (líneas 125–183)
  * `src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx` (líneas 181–288)
  * `src/components/misiones/__tests__/RechazoMisionModal.test.tsx` (líneas 211–274)
  * `src/services/__tests__/misionesService.test.ts` (líneas 1025–1092)
* **Verificación Técnica en Re-Test:**  
  1. `useTerrenoSocket.ts` evalúa `const unidadPayloadId = esCuadrilla ? data?.cuadrillaId : data?.patrullaId` y solo despacha `sgrai:mision-rechazada` cuando coincide con `usuario.unidadId` o viene sin identificador específico.
  2. La ejecución focalizada de `7` suites alcanza `63/63` pruebas en verde (`3.23s`), y el filtro `npm test -- -t "BUG-H41"` verifica `8/8` nuevas pruebas de regresión en `6` archivos.

---

### `BUG-H41-PWA-05` — Variable CSS inexistente `--color-border` en `CuadrillaDetailPage.module.css`, limpieza incompleta de efecto GPS en modal y desfase en manual/contratos
* **Severidad:** Media (Deuda de diseño visual, ciclo de vida React y precisión documental)
* **Estado:** **CORREGIDO / APROBADO (Verificado en Re-Test — 25/11/2026)**
* **Commits de Solución:**
  * `fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41`
  * `test(h41): agregar pruebas de regresión y actualizar documentación QA`
* **Archivos Corregidos:**
  * `src/app/(terreno)/cuadrilla/misiones/[id]/CuadrillaDetailPage.module.css` (líneas 19, 48, 106, 157, 175)
  * `src/components/misiones/RechazoMisionModal.tsx` (líneas 38–74)
  * `docs/manuals/H41-rechazo-mision-cuadrilla.md` (línea 47)
  * `docs/api/contratos-terreno.md` (sección `§2.3`, líneas 187–265)
* **Verificación Técnica en Re-Test:**  
  1. Las `5` ocurrencias de `--color-border` en `CuadrillaDetailPage.module.css` fueron migradas a `var(--border-color-neutral, #DFE3E8)` (`NO_COLOR_BORDER_DETAIL`).
  2. `RechazoMisionModal.tsx` reinicia `setObteniendoGps(false)` al cerrarse (`!abierto`) y protege los callbacks de `navigator.geolocation.getCurrentPosition` con la bandera `cancelado` en la limpieza del efecto, verificado en `RechazoMisionModal.test.tsx`.
  3. El manual H41 cita textualmente **"Trabajando offline"** / **"Trabajando offline (N pendientes)"** y **"Sincronizando (N pendientes)..."**, y `docs/api/contratos-terreno.md` documenta en `§2.3` el endpoint `POST /api/misiones/{id}/rechazar` con el permiso `misiones:terreno:ejecutar` y el evento `mision:rechazada`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H41-PWA-01` | Compilación estricta TypeScript y empaquetado de producción Next.js 16 en vista de detalle de cuadrilla y cliente Socket.io | Compilación / Estática | Integración / Sistema | Crítica | Rama `feature/h41-cuadrilla-rechazar-asignacion` actualizada con `params: Promise<{ id: string }>` y `socketClient.ts` limpio | Comandos `npx tsc --noEmit` y `npm run build` | Compilación TypeScript y build Next.js exitosos (`exit 0`) con `params: Promise<{ id: string }>` | `npx tsc --noEmit` finaliza con `exit 0` (`0` errores) y `npm run build` compila (`12.4s`), valida TS (`6.8s`) y genera `8/8` páginas estáticas (`exit 0`) | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41 |
| `BUG-H41-PWA-02` | Sincronización de rama con `origin/develop`, ausencia de conflictos de merge y preservación de contratos HU-37 / HU-38 / HU-69 | Integración / Control de Cambios | Sistema / Contrato | Alta | Comparativa entre `origin/develop` y `feature/h41-cuadrilla-rechazar-asignacion` tras merge | `git rev-list --left-right --count origin/develop...HEAD` y suite global `npm test` | Rama actualizada sin conflictos (`0` detrás de `origin/develop`) y contratos OpenAPI/offline compatibles con HU-37, HU-38 y HU-69 | `0` commits detrás de `origin/develop`; `0` conflictos; `51/51` archivos (`280/280` pruebas) aprobados sin regresiones | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y resolver conflictos de PWA |
| `BUG-H41-PWA-03` | Persistencia y lectura de `justificacionRechazo` remota en `obtenerDetalleMision`, visibilidad de feedback tras rechazar y rollback en `outbox` | Funcional / Offline-First | Servicio / UI / Hook | Alta | Consulta de misión `RECHAZADA` online, flujo `handleConfirmarRechazo` y sincronización `RECHAZAR_MISION` en `useConnectivity` | `obtenerDetalleMision(id)` con `justificacionRechazo`, redirección `?rechazo=ok|offline&msg=...` y error `409`/`403`/`400` en `outbox` | Mapear `justificacionRechazo` remota, mostrar banner descartable en `/cuadrilla/misiones`, crear respaldo local si falta caché y revertir a `DESPACHADA` ante fallos en `outbox` | Mapeo remoto de `justificacionRechazo`, banner persistente en bandeja, creación de respaldo local y rollback `409`/`403`/`400` verificados en pruebas automatizadas | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41 |
| `BUG-H41-PWA-04` | Cobertura automatizada de `RECHAZAR_MISION` en `useConnectivity`, filtrado/pruebas de `mision:rechazada` en `useTerrenoSocket` y casos límite en vistas de cuadrilla | Automatización / Tiempo Real | Unitaria / Componentes | Alta | Suites de prueba en `hooks/__tests__`, `cuadrilla/misiones/__tests__`, `services/__tests__` y `RechazoMisionModal.test.tsx` | `npm test -- -t "BUG-H41"` y ejecución de las `7` suites focalizadas HU-41 | Filtrado por `cuadrillaId` en socket y cobertura completa de estados, errores HTTP, GPS, eventos socket y `outbox` | `useTerrenoSocket` filtra por `cuadrillaId`; `8/8` pruebas de regresión (`BUG-H41`) y `63/63` pruebas focalizadas en `7` suites aprobadas | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | test(h41): agregar pruebas de regresión y actualizar documentación QA |
| `BUG-H41-PWA-05` | Uso de token CSS `--border-color-neutral`, cancelación del efecto GPS al cerrar `RechazoMisionModal` y alineación documental | UI / Ciclo de Vida / Documentación | CSS / Componente / Docs | Media | Hojas de estilo de detalle, `RechazoMisionModal.tsx`, manual H41 y `docs/api/contratos-terreno.md` | Búsqueda `--color-border`, prueba de callback GPS tardío en modal y revisión de manual H41 / `contratos-terreno.md §2.3` | Uso de `var(--border-color-neutral, #DFE3E8)`, cancelación limpia de GPS y manual/contratos homologados con `misiones:terreno:ejecutar` | `NO_COLOR_BORDER_DETAIL`; cancelación GPS verificada en `RechazoMisionModal.test.tsx`; manual cita `"Trabajando offline"` y `contratos-terreno.md §2.3` documenta H41 | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41 |
| `CP-H41-PWA-01` | Visualización del botón táctil 'Rechazar Misión' cuando la misión está en estado `DESPACHADA`, cuadrilla activa y permiso `misiones:terreno:ejecutar` | Funcional / UI (CA-1, CA-7) | Componente / Integración | Crítica | Misión `70000000-0000-4000-8000-000000000001` en `DESPACHADA`, `unidadActiva: true`, `esCuadrilla: true`, permiso `misiones:terreno:ejecutar` | Renderizado de `CuadrillaMisionDetailPage` con mock autenticado de `DELEGADO_CUADRILLA` y `params: Promise` | Sección `'Acciones de Despacho'` visible con botón `'Rechazar Misión'` (`variant="destructive"`, `size="md"`, `min-height: 48px`) | Botón `'Rechazar Misión'` renderizado y accesible en `CuadrillaDetailPage.test.tsx` (`5/5` tests) | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-02` | Ocultamiento del botón 'Rechazar Misión' cuando el usuario no posee el permiso RBAC `misiones:terreno:ejecutar` | Seguridad / RBAC (CA-7) | Componente / UI | Crítica | Misión en `DESPACHADA` y `tienePermiso('misiones:terreno:ejecutar') === false` | Renderizado de `CuadrillaMisionDetailPage` con `tienePermiso: () => false` | El botón `'Rechazar Misión'` no se renderiza en el DOM | `queryByRole('button', { name: /Rechazar Misión/i })` retorna `null` | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-03` | Despliegue del modal 'Rechazar Asignación de Cuadrilla' con campo obligatorio y contador al presionar 'Rechazar Misión' | Funcional / UI (CA-2) | Componente | Crítica | Vista de detalle en estado `DESPACHADA` y botón `'Rechazar Misión'` visible | Clic sobre `'Rechazar Misión'` en `CuadrillaMisionDetailPage` | Se abre diálogo modal (`role="dialog"`, `aria-modal="true"`) con textarea obligatorio, contador `0 / 5 caracteres mín.` y botón `'Confirmar Rechazo'` deshabilitado | Modal desplegado con título `'Rechazar Asignación de Cuadrilla'`, campo `'Motivo del Rechazo'` y botón confirmar inicialmente deshabilitado | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-04` | Bloqueo de confirmación y feedback de error en cliente cuando la justificación posee menos de 5 caracteres útiles | Validación UI (CA-2, CA-3, §3.3) | Componente | Crítica | `RechazoMisionModal` abierto (`abierto={true}`) | Ingreso de `'  abc  '` en `'Motivo del Rechazo'` y evento `blur` | Contador marca `3 / 5 caracteres mín.`, botón `'Confirmar Rechazo'` permanece `disabled` y tras `blur` muestra `'La justificación debe contener al menos 5 caracteres.'` | Botón deshabilitado, contador `3 / 5 caracteres mín.` y alerta `role="alert"` renderizada tras `blur` | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-05` | Validación estricta de `rechazoMisionSchema` (Zod) ante cadena vacía, solo espacios, `< 5` caracteres y recorte `trim()` | Validación / Contrato (CA-3, §3.3) | Unitaria | Crítica | Esquema `rechazoMisionSchema` en `src/lib/validations/misiones.ts` | Entradas `{ justificacion_rechazo: '' }`, `'     '`, `'  abc  '`, `'1234'`, `'Falla'` y `'  Falla hidráulica en camión tolva  '` | Rechaza entradas con `< 5` caracteres útiles y acepta `>= 5` recortando espacios circundantes | `misiones.test.ts` (`5/5` tests en `8ms`) valida rechazo de entradas inválidas y transformación `trim()` en entradas válidas | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41) |
| `CP-H41-PWA-06` | Validación Zod de coordenadas GPS opcionales en `rechazoMisionSchema` (par `latitud`/`longitud` y rangos WGS84) | Validación / Contrato | Unitaria | Media | Esquema `rechazoMisionSchema` | `{ latitud: -39.81422, longitud: -73.24589 }`, solo `latitud: -39.81` y fuera de rango `latitud: -95` | Acepta par completo dentro de `[-90, 90]` / `[-180, 180]` y rechaza coordenada huérfana o fuera de rango | `misiones.test.ts` verifica rechazo de latitud aislada y valores fuera de rango WGS84 | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41) |
| `CP-H41-PWA-07` | Ejecución online de `rechazarMision` hacia `POST /api/misiones/{id}/rechazar` (`200 OK`), actualización de IndexedDB y retorno con feedback a bandeja | Funcional / Integración (CA-4) | Servicio / Componente | Crítica | `navigator.onLine = true`, misión `70000000-0000-4000-8000-000000000001` en IndexedDB en estado `DESPACHADA` | `rechazarMision(id, { justificacion_rechazo: 'Camión tolva presenta falla hidráulica.', latitud: -39.81422, longitud: -73.24589 })` | Invoca `POST /api/misiones/{id}/rechazar`, actualiza misión en IndexedDB a `RECHAZADA` (`sincronizacionPendiente: false`) sin encolar en `outbox` y navega a `/cuadrilla/misiones?rechazo=ok&msg=...` | `misionesService.test.ts` y `CuadrillaDetailPage.test.tsx` aprueban invocación tipada, persistencia local y redirección con mensaje de confirmación | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41 |
| `CP-H41-PWA-08` | Manejo de rechazo HTTP (`400`/`403`/`409`) lanzando `MisionServiceError` sin encolar en `outbox` y despliegue de alerta en modal sin redirigir | Manejo de Errores / RBAC (CA-3, CA-7) | Servicio / Componente | Alta | Respuesta HTTP `409 Conflict` o `403 Forbidden` simulada desde API | `rechazarMision` con `status: 409` y rechazo de promesa en `CuadrillaMisionDetailPage` / `RechazoMisionModal` | Lanza `MisionServiceError` sin llamar a `encolarAccionOutbox`, exhibe el error en `.apiErrorBox` (`role="alert"`) y no redirige | `misionesService.test.ts`, `RechazoMisionModal.test.tsx` y `CuadrillaDetailPage.test.tsx` verifican excepción controlada, alerta visible y `mockPush` no invocado | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | test(h41): agregar pruebas de regresión y actualizar documentación QA |
| `CP-H41-PWA-09` | Resiliencia Offline-First ante falla de transporte en `rechazarMision`: encolamiento `RECHAZAR_MISION` en `outbox` y actualización optimista local | Offline-First / Persistencia | Servicio / IndexedDB | Crítica | Falla de red (`TypeError: Failed to fetch`) tras validar con `rechazoMisionSchema` | `rechazarMision(id, { justificacion_rechazo: 'Desperfecto eléctrico en camión' })` | Encola `RECHAZAR_MISION` hacia `/api/misiones/{id}/rechazar` en `outbox` y guarda `estado: 'RECHAZADA'` con `sincronizacionPendiente: true` | `misionesService.test.ts` y `useConnectivity.test.ts` validan encolamiento, persistencia optimista y sincronización diferida | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41) |
| `CP-H41-PWA-10` | Tipado estricto derivado de OpenAPI generado (`api-generated.d.ts`) para `POST /api/misiones/{id}/rechazar` sin uso de `any` | Contrato OpenAPI / Tipado | Estática / Tipos | Alta | Contrato `src/types/api-generated.d.ts` y `src/types/offline.ts` | Revisión de `paths['/api/misiones/{id}/rechazar']['post']`, `RechazarMisionPayload` y búsqueda `\bany\b` en archivos H41 | Tipos derivados de `api-generated.d.ts` sin DTOs manuales y `0` usos de `any` en módulos HU-41 | `RechazarMisionPayload` y `RechazarMisionApiData` derivan de `api-generated.d.ts`; búsqueda `\bany\b` devuelve `NO_ANY` | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41) |
| `CP-H41-PWA-11` | Protección perimetral en `src/proxy.ts` sobre build de producción para `/terreno/cuadrilla/misiones` y `[id]` sin y con cookie `sgrai_auth_token` | Seguridad / Perímetro | Sistema / HTTP | Alta | Servidor productivo `next start` escuchando en `http://127.0.0.1:3002` | `GET /terreno/cuadrilla/misiones/70000000-0000-4000-8000-000000000001` sin/con cookie y `GET /terreno/cuadrilla/misiones?rechazo=ok&msg=...` | `307 Temporary Redirect` hacia `/terreno/login?returnUrl=...` sin cookie y `200 OK` con cookie | `curl` sin cookie responde `HTTP/1.1 307 Temporary Redirect`; con cookie responde `HTTP/1.1 200 OK` tanto en detalle como en bandeja con query de feedback | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41 |
| `CP-H41-PWA-12` | Conformidad de diseño plano municipal (`border-radius: 0`, mínimo `48px` táctil, Noto Sans auto-alojada, `lucide-react`, cero emojis) y ESLint limpio | UI / Accesibilidad / Linter | Estática / CSS | Media | Código fuente completo en `src/` | Inspección de `Button.module.css`, `RechazoMisionModal.module.css`, `npm run lint`, búsqueda `next/font/google` y regex Unicode de emojis | `0` emojis en `src/`, `0` usos de `next/font/google`, esquinas rectas, altura `48px` y `npm run lint` con `0` errores | `NO_EMOJIS`, `OK_NO_GOOGLE_FONTS`, `npm run lint` retorna `exit 0` (`0` errores / `0` advertencias), esquinas rectas y altura `48px` verificadas | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-13` | Ejecución completa de la suite Vitest del repositorio y subconjunto focalizado HU-41 en Re-Test | Automatización | Unitaria / Integración | Alta | Dependencias instaladas y configuración JSDOM / `fake-indexeddb` | `npm test`, ejecución de `7` suites HU-41 y filtro `npm test -- -t "BUG-H41"` | `100%` de suites aprobadas sin errores ni regresiones | `51/51` archivos (`280/280` tests) globales aprobados, `7/7` archivos (`63/63` tests) focalizados y `8/8` tests de regresión `BUG-H41` aprobados | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | test(h41): agregar pruebas de regresión y actualizar documentación QA |
| `CP-H41-PWA-14` | Disponibilidad y consistencia de manual de usuario `H41-rechazo-mision-cuadrilla.md` y contratos en `docs/api/contratos-terreno.md` | Documentación | Documentación | Media | Archivos `docs/manuals/H41-rechazo-mision-cuadrilla.md` y `docs/api/contratos-terreno.md` | Revisión estructural y textual frente a `AGENTS.md §5`, `ConnectionStatusBadge.tsx` y `api-generated.d.ts` | Secciones obligatorias offline y GPS con copy `"Trabajando offline"` homologado y sección `§2.3` de contratos con permiso `misiones:terreno:ejecutar` | Manual H41 y sección `§2.3` de `contratos-terreno.md` completos y alineados con la implementación real | APROBADO | 24/11/2026 01:36 | 25/11/2026 14:17 | test(h41): agregar pruebas de regresión y actualizar documentación QA |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H41-PWA-01	Compilación estricta TypeScript y empaquetado de producción Next.js 16 en vista de detalle de cuadrilla y cliente Socket.io	Compilación / Estática	Integración / Sistema	Crítica	Rama feature/h41-cuadrilla-rechazar-asignacion actualizada con params: Promise<{ id: string }> y socketClient.ts limpio	Comandos npx tsc --noEmit y npm run build	Compilación TypeScript y build Next.js exitosos (exit 0) con params: Promise<{ id: string }>	npx tsc --noEmit finaliza con exit 0 (0 errores) y npm run build compila (12.4s), valida TS (6.8s) y genera 8/8 páginas estáticas (exit 0)	APROBADO	24/11/2026 01:36	25/11/2026 14:17	fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41
BUG-H41-PWA-02	Sincronización de rama con origin/develop, ausencia de conflictos de merge y preservación de contratos HU-37 / HU-38 / HU-69	Integración / Control de Cambios	Sistema / Contrato	Alta	Comparativa entre origin/develop y feature/h41-cuadrilla-rechazar-asignacion tras merge	git rev-list --left-right --count origin/develop...HEAD y suite global npm test	Rama actualizada sin conflictos (0 detrás de origin/develop) y contratos OpenAPI/offline compatibles con HU-37, HU-38 y HU-69	0 commits detrás de origin/develop; 0 conflictos; 51/51 archivos (280/280 pruebas) aprobados sin regresiones	APROBADO	24/11/2026 01:36	25/11/2026 14:17	merge: integrar develop en feature/h41-cuadrilla-rechazar-asignacion y resolver conflictos de PWA
BUG-H41-PWA-03	Persistencia y lectura de justificacionRechazo remota en obtenerDetalleMision, visibilidad de feedback tras rechazar y rollback en outbox	Funcional / Offline-First	Servicio / UI / Hook	Alta	Consulta de misión RECHAZADA online, flujo handleConfirmarRechazo y sincronización RECHAZAR_MISION en useConnectivity	obtenerDetalleMision(id) con justificacionRechazo, redirección ?rechazo=ok|offline&msg=... y error 409/403/400 en outbox	Mapear justificacionRechazo remota, mostrar banner descartable en /cuadrilla/misiones, crear respaldo local si falta caché y revertir a DESPACHADA ante fallos en outbox	Mapeo remoto de justificacionRechazo, banner persistente en bandeja, creación de respaldo local y rollback 409/403/400 verificados en pruebas automatizadas	APROBADO	24/11/2026 01:36	25/11/2026 14:17	fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41
BUG-H41-PWA-04	Cobertura automatizada de RECHAZAR_MISION en useConnectivity, filtrado/pruebas de mision:rechazada en useTerrenoSocket y casos límite en vistas de cuadrilla	Automatización / Tiempo Real	Unitaria / Componentes	Alta	Suites de prueba en hooks/__tests__, cuadrilla/misiones/__tests__, services/__tests__ y RechazoMisionModal.test.tsx	npm test -- -t "BUG-H41" y ejecución de las 7 suites focalizadas HU-41	Filtrado por cuadrillaId en socket y cobertura completa de estados, errores HTTP, GPS, eventos socket y outbox	useTerrenoSocket filtra por cuadrillaId; 8/8 pruebas de regresión (BUG-H41) y 63/63 pruebas focalizadas en 7 suites aprobadas	APROBADO	24/11/2026 01:36	25/11/2026 14:17	test(h41): agregar pruebas de regresión y actualizar documentación QA
BUG-H41-PWA-05	Uso de token CSS --border-color-neutral, cancelación del efecto GPS al cerrar RechazoMisionModal y alineación documental	UI / Ciclo de Vida / Documentación	CSS / Componente / Docs	Media	Hojas de estilo de detalle, RechazoMisionModal.tsx, manual H41 y docs/api/contratos-terreno.md	Búsqueda --color-border, prueba de callback GPS tardío en modal y revisión de manual H41 / contratos-terreno.md §2.3	Uso de var(--border-color-neutral, #DFE3E8), cancelación limpia de GPS y manual/contratos homologados con misiones:terreno:ejecutar	NO_COLOR_BORDER_DETAIL; cancelación GPS verificada en RechazoMisionModal.test.tsx; manual cita "Trabajando offline" y contratos-terreno.md §2.3 documenta H41	APROBADO	24/11/2026 01:36	25/11/2026 14:17	fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41
CP-H41-PWA-01	Visualización del botón táctil 'Rechazar Misión' cuando la misión está en estado DESPACHADA, cuadrilla activa y permiso misiones:terreno:ejecutar	Funcional / UI (CA-1, CA-7)	Componente / Integración	Crítica	Misión 70000000-0000-4000-8000-000000000001 en DESPACHADA, unidadActiva: true, esCuadrilla: true, permiso misiones:terreno:ejecutar	Renderizado de CuadrillaMisionDetailPage con mock autenticado de DELEGADO_CUADRILLA y params: Promise	Sección 'Acciones de Despacho' visible con botón 'Rechazar Misión' (variant="destructive", size="md", min-height: 48px)	Botón 'Rechazar Misión' renderizado y accesible en CuadrillaDetailPage.test.tsx (5/5 tests)	APROBADO	24/11/2026 01:36	25/11/2026 14:17	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-02	Ocultamiento del botón 'Rechazar Misión' cuando el usuario no posee el permiso RBAC misiones:terreno:ejecutar	Seguridad / RBAC (CA-7)	Componente / UI	Crítica	Misión en DESPACHADA y tienePermiso('misiones:terreno:ejecutar') === false	Renderizado de CuadrillaMisionDetailPage con tienePermiso: () => false	El botón 'Rechazar Misión' no se renderiza en el DOM	queryByRole('button', { name: /Rechazar Misión/i }) retorna null	APROBADO	24/11/2026 01:36	25/11/2026 14:17	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-03	Despliegue del modal 'Rechazar Asignación de Cuadrilla' con campo obligatorio y contador al presionar 'Rechazar Misión'	Funcional / UI (CA-2)	Componente	Crítica	Vista de detalle en estado DESPACHADA y botón 'Rechazar Misión' visible	Clic sobre 'Rechazar Misión' en CuadrillaMisionDetailPage	Se abre diálogo modal (role="dialog", aria-modal="true") con textarea obligatorio, contador 0 / 5 caracteres mín. y botón 'Confirmar Rechazo' deshabilitado	Modal desplegado con título 'Rechazar Asignación de Cuadrilla', campo 'Motivo del Rechazo' y botón confirmar inicialmente deshabilitado	APROBADO	24/11/2026 01:36	25/11/2026 14:17	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-04	Bloqueo de confirmación y feedback de error en cliente cuando la justificación posee menos de 5 caracteres útiles	Validación UI (CA-2, CA-3, §3.3)	Componente	Crítica	RechazoMisionModal abierto (abierto={true})	Ingreso de '  abc  ' en 'Motivo del Rechazo' y evento blur	Contador marca 3 / 5 caracteres mín., botón 'Confirmar Rechazo' permanece disabled y tras blur muestra 'La justificación debe contener al menos 5 caracteres.'	Botón deshabilitado, contador 3 / 5 caracteres mín. y alerta role="alert" renderizada tras blur	APROBADO	24/11/2026 01:36	25/11/2026 14:17	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-05	Validación estricta de rechazoMisionSchema (Zod) ante cadena vacía, solo espacios, < 5 caracteres y recorte trim()	Validación / Contrato (CA-3, §3.3)	Unitaria	Crítica	Esquema rechazoMisionSchema en src/lib/validations/misiones.ts	Entradas { justificacion_rechazo: '' }, '     ', '  abc  ', '1234', 'Falla' y '  Falla hidráulica en camión tolva  '	Rechaza entradas con < 5 caracteres útiles y acepta >= 5 recortando espacios circundantes	misiones.test.ts (5/5 tests en 8ms) valida rechazo de entradas inválidas y transformación trim() en entradas válidas	APROBADO	24/11/2026 01:36	25/11/2026 14:17	feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41)
CP-H41-PWA-06	Validación Zod de coordenadas GPS opcionales en rechazoMisionSchema (par latitud/longitud y rangos WGS84)	Validación / Contrato	Unitaria	Media	Esquema rechazoMisionSchema	{ latitud: -39.81422, longitud: -73.24589 }, solo latitud: -39.81 y fuera de rango latitud: -95	Acepta par completo dentro de [-90, 90] / [-180, 180] y rechaza coordenada huérfana o fuera de rango	misiones.test.ts verifica rechazo de latitud aislada y valores fuera de rango WGS84	APROBADO	24/11/2026 01:36	25/11/2026 14:17	feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41)
CP-H41-PWA-07	Ejecución online de rechazarMision hacia POST /api/misiones/{id}/rechazar (200 OK), actualización de IndexedDB y retorno con feedback a bandeja	Funcional / Integración (CA-4)	Servicio / Componente	Crítica	navigator.onLine = true, misión 70000000-0000-4000-8000-000000000001 en IndexedDB en estado DESPACHADA	rechazarMision(id, { justificacion_rechazo: 'Camión tolva presenta falla hidráulica.', latitud: -39.81422, longitud: -73.24589 })	Invoca POST /api/misiones/{id}/rechazar, actualiza misión en IndexedDB a RECHAZADA (sincronizacionPendiente: false) sin encolar en outbox y navega a /cuadrilla/misiones?rechazo=ok&msg=...	misionesService.test.ts y CuadrillaDetailPage.test.tsx aprueban invocación tipada, persistencia local y redirección con mensaje de confirmación	APROBADO	24/11/2026 01:36	25/11/2026 14:17	fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41
CP-H41-PWA-08	Manejo de rechazo HTTP (400/403/409) lanzando MisionServiceError sin encolar en outbox y despliegue de alerta en modal sin redirigir	Manejo de Errores / RBAC (CA-3, CA-7)	Servicio / Componente	Alta	Respuesta HTTP 409 Conflict o 403 Forbidden simulada desde API	rechazarMision con status: 409 y rechazo de promesa en CuadrillaMisionDetailPage / RechazoMisionModal	Lanza MisionServiceError sin llamar a encolarAccionOutbox, exhibe el error en .apiErrorBox (role="alert") y no redirige	misionesService.test.ts, RechazoMisionModal.test.tsx y CuadrillaDetailPage.test.tsx verifican excepción controlada, alerta visible y mockPush no invocado	APROBADO	24/11/2026 01:36	25/11/2026 14:17	test(h41): agregar pruebas de regresión y actualizar documentación QA
CP-H41-PWA-09	Resiliencia Offline-First ante falla de transporte en rechazarMision: encolamiento RECHAZAR_MISION en outbox y actualización optimista local	Offline-First / Persistencia	Servicio / IndexedDB	Crítica	Falla de red (TypeError: Failed to fetch) tras validar con rechazoMisionSchema	rechazarMision(id, { justificacion_rechazo: 'Desperfecto eléctrico en camión' })	Encola RECHAZAR_MISION hacia /api/misiones/{id}/rechazar en outbox y guarda estado: 'RECHAZADA' con sincronizacionPendiente: true	misionesService.test.ts y useConnectivity.test.ts validan encolamiento, persistencia optimista y sincronización diferida	APROBADO	24/11/2026 01:36	25/11/2026 14:17	feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41)
CP-H41-PWA-10	Tipado estricto derivado de OpenAPI generado (api-generated.d.ts) para POST /api/misiones/{id}/rechazar sin uso de any	Contrato OpenAPI / Tipado	Estática / Tipos	Alta	Contrato src/types/api-generated.d.ts y src/types/offline.ts	Revisión de paths['/api/misiones/{id}/rechazar']['post'], RechazarMisionPayload y búsqueda \bany\b en archivos H41	Tipos derivados de api-generated.d.ts sin DTOs manuales y 0 usos de any en módulos HU-41	RechazarMisionPayload y RechazarMisionApiData derivan de api-generated.d.ts; búsqueda \bany\b devuelve NO_ANY	APROBADO	24/11/2026 01:36	25/11/2026 14:17	feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41)
CP-H41-PWA-11	Protección perimetral en src/proxy.ts sobre build de producción para /terreno/cuadrilla/misiones y [id] sin y con cookie sgrai_auth_token	Seguridad / Perímetro	Sistema / HTTP	Alta	Servidor productivo next start escuchando en http://127.0.0.1:3002	GET /terreno/cuadrilla/misiones/70000000-0000-4000-8000-000000000001 sin/con cookie y GET /terreno/cuadrilla/misiones?rechazo=ok&msg=...	307 Temporary Redirect hacia /terreno/login?returnUrl=... sin cookie y 200 OK con cookie	curl sin cookie responde HTTP/1.1 307 Temporary Redirect; con cookie responde HTTP/1.1 200 OK tanto en detalle como en bandeja con query de feedback	APROBADO	24/11/2026 01:36	25/11/2026 14:17	fix(cuadrilla): resolver contratos, caché offline y UX de rechazo QA H41
CP-H41-PWA-12	Conformidad de diseño plano municipal (border-radius: 0, mínimo 48px táctil, Noto Sans auto-alojada, lucide-react, cero emojis) y ESLint limpio	UI / Accesibilidad / Linter	Estática / CSS	Media	Código fuente completo en src/	Inspección de Button.module.css, RechazoMisionModal.module.css, npm run lint, búsqueda next/font/google y regex Unicode de emojis	0 emojis en src/, 0 usos de next/font/google, esquinas rectas, altura 48px y npm run lint con 0 errores	NO_EMOJIS, OK_NO_GOOGLE_FONTS, npm run lint retorna exit 0 (0 errores / 0 advertencias), esquinas rectas y altura 48px verificadas	APROBADO	24/11/2026 01:36	25/11/2026 14:17	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-13	Ejecución completa de la suite Vitest del repositorio y subconjunto focalizado HU-41 en Re-Test	Automatización	Unitaria / Integración	Alta	Dependencias instaladas y configuración JSDOM / fake-indexeddb	npm test, ejecución de 7 suites HU-41 y filtro npm test -- -t "BUG-H41"	100% de suites aprobadas sin errores ni regresiones	51/51 archivos (280/280 tests) globales aprobados, 7/7 archivos (63/63 tests) focalizados y 8/8 tests de regresión BUG-H41 aprobados	APROBADO	24/11/2026 01:36	25/11/2026 14:17	test(h41): agregar pruebas de regresión y actualizar documentación QA
CP-H41-PWA-14	Disponibilidad y consistencia de manual de usuario H41-rechazo-mision-cuadrilla.md y contratos en docs/api/contratos-terreno.md	Documentación	Documentación	Media	Archivos docs/manuals/H41-rechazo-mision-cuadrilla.md y docs/api/contratos-terreno.md	Revisión estructural y textual frente a AGENTS.md §5, ConnectionStatusBadge.tsx y api-generated.d.ts	Secciones obligatorias offline y GPS con copy "Trabajando offline" homologado y sección §2.3 de contratos con permiso misiones:terreno:ejecutar	Manual H41 y sección §2.3 de contratos-terreno.md completos y alineados con la implementación real	APROBADO	24/11/2026 01:36	25/11/2026 14:17	test(h41): agregar pruebas de regresión y actualizar documentación QA
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test Final)

Todos los comandos fueron ejecutados desde la raíz del repositorio `web-app` sobre la rama `feature/h41-cuadrilla-rechazar-asignacion`.

### 5.1 Suite Automatizada Global, Subconjunto HU-41 y Pruebas de Regresión (Vitest)

#### 5.1.1 Suite completa del repositorio
```bash
npm test
```
**Salida observada (Re-Test):**
```text
 Test Files  51 passed (51)
      Tests  280 passed (280)
   Start at  14:15:42
   Duration  14.61s (transform 4.79s, setup 16.79s, collect 25.91s, tests 28.57s, environment 75.88s, prepare 9.11s)
```

#### 5.1.2 Ejecución conjunta de las `7` suites vinculadas a HU-41
```bash
npx vitest run \
  src/lib/validations/misiones.test.ts \
  src/services/__tests__/misionesService.test.ts \
  src/components/misiones/__tests__/RechazoMisionModal.test.tsx \
  'src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx' \
  src/hooks/__tests__/useConnectivity.test.ts \
  src/hooks/__tests__/useTerrenoSocket.test.ts \
  'src/app/(terreno)/cuadrilla/misiones/__tests__/CuadrillaMisionesPage.test.tsx'
```
**Salida observada (Re-Test):**
```text
 ✓ src/lib/validations/misiones.test.ts (5 tests) 8ms
 ✓ src/services/__tests__/misionesService.test.ts (25 tests) 43ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (12 tests) 135ms
 ✓ src/hooks/__tests__/useTerrenoSocket.test.ts (4 tests) 31ms
 ✓ src/components/misiones/__tests__/RechazoMisionModal.test.tsx (9 tests) 412ms
 ✓ src/app/(terreno)/cuadrilla/misiones/__tests__/CuadrillaMisionesPage.test.tsx (3 tests) 293ms
 ✓ src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx (5 tests) 427ms

 Test Files  7 passed (7)
      Tests  63 passed (63)
   Start at  14:15:55
   Duration  3.23s (transform 1.14s, setup 1.71s, collect 2.72s, tests 1.35s, environment 7.65s, prepare 1.33s)
```

#### 5.1.3 Ejecución filtrada de pruebas de regresión QA (`BUG-H41`)
```bash
npm test -- -t "BUG-H41"
```
**Salida observada (Re-Test):**
```text
 Test Files  6 passed | 45 skipped (51)
      Tests  8 passed | 272 skipped (280)
   Start at  14:17:33
   Duration  9.93s (transform 5.83s, setup 14.12s, collect 22.58s, tests 2.48s, environment 69.37s, prepare 8.90s)
```

---

### 5.2 Verificación Estática: TypeScript, Build de Producción, ESLint, Emojis y Divergencia Git

#### 5.2.1 Chequeo estático TypeScript, ESLint y Build de Producción (`BUG-H41-PWA-01`)
```bash
npx tsc --noEmit && npm run lint && npm run build
```
**Salida observada (`exit code 0`):**
```text
npm notice run sgrai-pwa@0.1.0 npx
npm notice run 'tsc' --noEmit
npm notice run sgrai-pwa@0.1.0 lint
npm notice run eslint
npm notice run sgrai-pwa@0.1.0 build
npm notice run next build --webpack
▲ Next.js 16.3.4 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 250ms

  Creating an optimized production build ...
✓ Compiled successfully in 12.4s
✓ Finished TypeScript in 6.8s
✓ Collecting page data using 11 workers in 553ms
✓ Generating static pages using 11 workers (8/8) in 745ms
✓ Collecting build traces in 14.6s
✓ Finalizing page optimization in 14.7s

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /cuadrilla/misiones
├ ƒ /cuadrilla/misiones/[id]
├ ○ /login
├ ○ /manifest.webmanifest
├ ○ /patrulla/misiones
├ ƒ /patrulla/misiones/[id]
└ ○ /perfil

ƒ Proxy (Middleware)
```

#### 5.2.2 Emojis, Google Fonts, `any`, Variables CSS y Sincronización Git (`BUG-H41-PWA-02`, `BUG-H41-PWA-05`)
```bash
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS"
rg -n "next/font/google" src/ || echo "OK_NO_GOOGLE_FONTS"
rg -n -- "--color-border" 'src/app/(terreno)/cuadrilla/misiones/[id]/CuadrillaDetailPage.module.css' || echo "NO_COLOR_BORDER_DETAIL"
rg -n '\bany\b' src/app/\(terreno\)/cuadrilla/ src/components/misiones/Rechazo* src/lib/validations/misiones* src/services/misionesService.ts src/hooks/useConnectivity.ts src/hooks/useTerrenoSocket.ts || echo "NO_ANY"
git rev-list --left-right --count origin/develop...HEAD
```
**Salidas observadas (Re-Test):**
- `NO_EMOJIS`
- `OK_NO_GOOGLE_FONTS`
- `NO_COLOR_BORDER_DETAIL`
- `NO_ANY`
- `git rev-list --left-right --count origin/develop...HEAD`: `0	9` (`0` commits detrás de `origin/develop`).

---

### 5.3 Verificación HTTP Perimetral con `curl` sobre Servidor Productivo (`next start`)

*(Nota de entorno: Las pruebas `curl` de Re-Test se ejecutaron sobre el artefacto productivo compilado mediante `npx next start -H 127.0.0.1 -p 3002`; la instancia de `sgrai-api` en puertos `3001`/`4001` no se encuentra activa en esta sesión y los contratos de `POST /api/misiones/{id}/rechazar` se validan contra `api-generated.d.ts` y `misionesService.test.ts`.)*

#### 5.3.1 Acceso sin cookie a detalle de misión de cuadrilla (`307 Temporary Redirect` — `CP-H41-PWA-11`)
```bash
curl -s -i "http://127.0.0.1:3002/terreno/cuadrilla/misiones/70000000-0000-4000-8000-000000000001" | head -n 10
```
**Respuesta HTTP obtenida (Re-Test):**
```http
HTTP/1.1 307 Temporary Redirect
location: /terreno/login?returnUrl=%2Fterreno%2Fcuadrilla%2Fmisiones%2F70000000-0000-4000-8000-000000000001
Date: Wed, 25 Nov 2026 17:17:44 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked
```

#### 5.3.2 Acceso con cookie a detalle de misión y bandeja con query de confirmación (`200 OK` — `CP-H41-PWA-11`, `BUG-H41-PWA-03`)
```bash
curl -s -i -H "Cookie: sgrai_auth_token=jwt-mock-token" \
  "http://127.0.0.1:3002/terreno/cuadrilla/misiones/70000000-0000-4000-8000-000000000001" | head -n 10
```
**Respuesta HTTP obtenida (Re-Test):**
```http
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Link: </terreno/_next/static/media/10feed5d5dd084de-s.p.woff2>; rel=preload; as="font"; crossorigin=""; type="font/woff2", </terreno/_next/static/media/1d02f490f5cc37ac-s.p.woff2>; rel=preload; as="font"; crossorigin=""; type="font/woff2", </terreno/_next/static/media/cb57c6a98d46fca0-s.p.woff2>; rel=preload; as="font"; crossorigin=""; type="font/woff2", </terreno/_next/static/media/e19986ff22578d0b-s.p.woff2>; rel=preload; as="font"; crossorigin=""; type="font/woff2", </terreno/_next/static/media/fd476b27505e146e-s.p.woff2>; rel=preload; as="font"; crossorigin=""; type="font/woff2"
X-Powered-By: Next.js
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
Content-Type: text/html; charset=utf-8
Date: Wed, 25 Nov 2026 17:17:44 GMT
Connection: keep-alive
```

```bash
curl -s -i -H "Cookie: sgrai_auth_token=jwt-mock-token" \
  "http://127.0.0.1:3002/terreno/cuadrilla/misiones?rechazo=ok&msg=Misi%C3%B3n+rechazada+exitosamente." | head -n 10
```
**Respuesta HTTP obtenida (Re-Test):**
```http
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
x-nextjs-cache: HIT
x-nextjs-prerender: 1
x-nextjs-stale-time: 300
X-Powered-By: Next.js
Cache-Control: s-maxage=31536000
ETag: "8d7mcky8fccn7"
Content-Type: text/html; charset=utf-8
```

#### 5.3.3 Payload de referencia `POST /api/misiones/{id}/rechazar` (Contrato OpenAPI en `api-generated.d.ts`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/70000000-0000-4000-8000-000000000001/rechazar" \
  -H "Authorization: Bearer <jwt_delegado_cuadrilla>" \
  -H "Content-Type: application/json" \
  -d '{"justificacion_rechazo":"Camión tolva presenta falla hidráulica en ruta de salida.","latitud":-39.81422,"longitud":-73.24589}'
```
**Contrato esperado (`200 OK` según `RechazarMisionResponse` en `src/types/api-generated.d.ts` y `misionesService.test.ts`):**
```json
{
  "message": "Misión rechazada exitosamente.",
  "data": {
    "mision": {
      "id": "70000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0005",
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "RECHAZADA",
      "justificacionRechazo": "Camión tolva presenta falla hidráulica en ruta de salida.",
      "fechaCierre": "2026-11-16T23:15:00.000Z",
      "actualizadoEn": "2026-11-16T23:15:00.000Z"
    }
  }
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (HU-41 en `sgrai-pwa`)

| Criterio de Aceptación (CA) | Responsabilidad Arquitectónica | Cobertura / Casos en `sgrai-pwa` | Estado tras Re-Test Final | Observaciones Técnicas |
|---|---|---|---|---|
| **CA-1:** La pantalla de solicitud de misión en la PWA debe proveer una opción visible `'Rechazar Misión'`. | `sgrai-pwa` | `CP-H41-PWA-01`, `CP-H41-PWA-12`, `BUG-H41-PWA-01`, `BUG-H41-PWA-04`, `BUG-H41-PWA-05` | **CUMPLIDO** | Botón táctil visible (`size="md"`, `48px`, esquinas rectas) en `CuadrillaMisionDetailPage` solo para `DESPACHADA` con unidad activa, rol cuadrilla y permiso; build y tokens `--border-color-neutral` certificados. |
| **CA-2:** Al presionar `'Rechazar Misión'`, el sistema debe desplegar un modal o campo de texto obligatorio para ingresar la justificación del rechazo. | `sgrai-pwa` | `CP-H41-PWA-03`, `CP-H41-PWA-04`, `BUG-H41-PWA-03`, `BUG-H41-PWA-05` | **CUMPLIDO** | `RechazoMisionModal` despliega diálogo accesible con contador, bloqueo de envío, cancelación segura de GPS y retorno con banner persistente a `/cuadrilla/misiones`. |
| **CA-3:** Regla de negocio §3.3: validar `justificacion_rechazo` $\ge 5$ caracteres o rechazar con `400 Bad Request`. | `sgrai-api` + validación UX/Zod en `sgrai-pwa` | `CP-H41-PWA-04`, `CP-H41-PWA-05`, `CP-H41-PWA-06`, `CP-H41-PWA-08` | **CUMPLIDO EN PWA** | `RechazoMisionModal` bloquea envíos $< 5$ caracteres tras `trim()`, `rechazoMisionSchema` valida longitud y paridad WGS84 antes de red/IndexedDB y `rechazarMision` propaga `MisionServiceError(400)`. |
| **CA-4:** Al confirmar el rechazo motivado, actualizar `mision.estado = 'RECHAZADA'`, almacenar `justificacion_rechazo`, devolver cuadrilla a `DISPONIBLE` y registrar hito en `mision_hito`. | `sgrai-api` (transacción) + reflejo local en `sgrai-pwa` | `CP-H41-PWA-07`, `CP-H41-PWA-09`, `BUG-H41-PWA-03` | **CUMPLIDO EN PWA** | `rechazarMision` persiste `RECHAZADA` y respaldo local; `obtenerDetalleMision` mapea `justificacionRechazo` remota y `estadoCuadrilla`; `useConnectivity` revierte el estado local ante errores terminales. |
| **CA-5:** El incidente debe retornar a estado `REPORTADO` o `VERIFICANDO` para permitir su reasignación en el Centro de Mando. | `sgrai-api` + `sgrai-web` | *(Fuera de alcance visual en `sgrai-pwa`)* | **N/A EN PWA** | Transición de incidente y tablero Kanban residen en `sgrai-api` y `sgrai-web` (`AGENTS.md §1`). |
| **CA-6:** Emisión de alerta prioritaria vía WebSocket (`mision:rechazada`) hacia la sala `encargado` del Centro de Mando. | `sgrai-api` (emisión) + escucha en `sgrai-web` / refresco de unidad en `sgrai-pwa` | `BUG-H41-PWA-02`, `BUG-H41-PWA-04` | **CUMPLIDO EN PWA** | `useTerrenoSocket` filtra `mision:rechazada` por `cuadrillaId` con prueba unitaria dedicada, `CuadrillaMisionesPage` refresca la bandeja y mantiene integración con `useMisionesSocket` de `develop`. |
| **CA-7:** El endpoint `POST /api/misiones/{id}/rechazar` debe requerir el permiso RBAC `misiones:terreno:ejecutar`. | `sgrai-api` + guarda UI en `sgrai-pwa` | `CP-H41-PWA-02`, `CP-H41-PWA-08`, `CP-H41-PWA-10`, `CP-H41-PWA-11`, `CP-H41-PWA-14` | **CUMPLIDO EN PWA** | `CuadrillaMisionDetailPage` exige `tienePermiso('misiones:terreno:ejecutar')`, `rechazarMision` no encola respuestas `403`, y `api-generated.d.ts` + `docs/api/contratos-terreno.md §2.3` reflejan el permiso. |

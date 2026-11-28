# Auditoría Técnica y Matriz de Casos de Prueba — HU-43: Adjuntar Evidencia Multimedia en Terreno (Cliente PWA `sgrai-pwa`)

**Estándar:** IEEE 829 / ISO/IEC/IEEE 29119 (Test Plan and Test Results Report)  
**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `feature/h43-adjuntar-evidencia-multimedia`  
**Historia de Usuario:** HU-43 — *"Como Delegado de cuadrilla Quiero adjuntar fotografías, videos y documentos técnicos al incidente y su misión desde el dispositivo móvil. Para respaldar las condiciones del lugar, documentar los trabajos ejecutados y contar con evidencia técnica para la auditoría operativa."*  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `24/11/2026 14:15 -03:00`  
**Fecha y Hora de Re-Test:** `26/11/2026 21:55 -03:00`  
**Entorno de Ejecución:** Linux, Node.js, Vitest v3.2.7, React Testing Library v16.3.3, JSDOM, Fake IndexedDB v6.2.6, Next.js 16.3.4 (Webpack), TypeScript v5, ESLint v9, PostgreSQL 16 (PostGIS 3.4) / Redis 7  
**Dictamen de Auditoría:** **APROBADO EN RE-TEST (`Approved` — `6/6` defectos resueltos y cerrados; `22/22` registros en matriz aprobados; `npm run lint`, `npx tsc --noEmit`, `npm test` y `npm run build` en verde)**

---

## 1. Resumen Ejecutivo

La presente auditoría técnica evalúa la implementación y el ciclo formal de **Re-Test** de la Historia de Usuario **HU-43** sobre la rama `feature/h43-adjuntar-evidencia-multimedia` del cliente móvil de terreno `sgrai-pwa` (`web-app`). La funcionalidad introduce el módulo `CargaEvidenciaCard`, el servicio multipart y cola offline `evidenciaService.ts`, utilidades de validación y compresión Canvas (`mediaUtils.ts` / `evidencia.ts`), sincronización de adjuntos en `useConnectivity.ts` / `offlineQueue.ts`, la integración en `CuadrillaMisionDetailPage` y su acoplamiento con `EvaluacionReporteCierreCard` (HU-39).

En la auditoría inicial (`24/11/2026 14:15 -03:00`) se levantaron **6 defectos reales** (`BUG-H43-PWA-01` a `BUG-H43-PWA-06`: `3` críticos bloqueantes, `1` alto, `1` medio y `1` bajo) que motivaron el rechazo en Code Review. Posteriormente, el equipo de desarrollo integró `develop` (`merge: integrar develop (QA H39/H41) en feature/h43-adjuntar-evidencia-multimedia`) y aplicó las correcciones integrales mediante el commit `fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)`, coordinado con la contraparte backend `fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)` en `sgrai-api`.

En el ciclo de **Re-Test formal** (`26/11/2026 21:55 -03:00`) se verificó la resolución del **100% de los defectos** (`6/6`) y la aprobación de los **3 casos previamente fallidos** (`CP-H43-PWA-08`, `CP-H43-PWA-09` y `CP-H43-PWA-14`), sin regresiones sobre las suites de terreno existentes:

1. **Compilación y análisis estático limpios (`BUG-H43-PWA-02`):** `CuadrillaMisionDetailPage` adopta estrictamente `params: Promise<{ id: string }>` con invocación incondicional de `use(params)` y retira la variable sin uso `prioridadClase`. `npm run lint` (`0` errores, `0` warnings), `npx tsc --noEmit` (`exit 0`) y `npm run build` (`exit 0`, Next.js 16.3.4 Webpack) finalizan en verde.
2. **Persistencia y consolidación de adjuntos asociados a `incidente_id` (`BUG-H43-PWA-01`):** `obtenerDetalleMision` consolida `d.adjuntos` y `d.reportesTerreno[].adjuntos` sin duplicados y preserva adjuntos locales pendientes, con `errorSincronizacion` o sincronizados no presentes aún en la respuesta remota. `CuadrillaMisionDetailPage` normaliza `incidenteIdMision` / `reporteTerrenoIdMision` y exige al menos un identificador válido para habilitar la carga. La contraparte `sgrai-api` expone `adjuntos` directos en `GET /api/misiones/{id}` y `GET /api/incidentes/{id}`.
3. **Flujo offline completo en `EvaluacionReporteCierreCard` (HU-39) (`BUG-H43-PWA-03`):** Se sincroniza `adjuntosEvidencia` vía `useEffect` ante actualizaciones de `misionActual`, se excluyen IDs `local-*` y URLs `data:`/`blob:` antes de la validación Zod (`crearReporteVerificacionSchema`), se despliega `<CargaEvidenciaCard soloLectura />` en el resumen `yaEnviado`, y se coordina el orden causal `SUBIR_EVIDENCIA` $\to$ `ENVIAR_REPORTE` en `offlineQueue.ts` + `useConnectivity.ts` resolviendo los UUID definitivos del servidor antes de transmitir el informe.
4. **Contrato OpenAPI, `x-user-id` y control de sesión `401` (`BUG-H43-PWA-04`):** `src/types/api-generated.d.ts` incorpora `GET`/`POST /api/evidencia/adjuntos` y `adjuntos` en misiones/incidentes; `evidenciaService.ts` deriva `AdjuntoCreadoOpenApi` desde `paths`, inyecta `x-user-id` y mapea HTTP `409`; `useConnectivity.ts` inyecta `x-user-id`, detiene el polling/reintento ante `401` mediante `handleUnauthorizedSession()` + `sesionExpiradaRef` y propaga `body.message` / `body.error` en rechazos `4xx`.
5. **Rutas relativas `/uploads`, PDF offline y ergonomía táctil (`BUG-H43-PWA-05`):** `resolverUrlEvidencia` utiliza ruta relativa normalizada (`/uploads/...`) en navegador productivo respetando el rewrite `/uploads/:path*`; `esUrlDescargable` habilita `data:application/pdf` y `blob:` con atributo `download`; `.downloadLink` aumenta a `min-height: 48px`; `procesarArchivos` acumula todos los errores en lotes múltiples.
6. **Normalización MIME con códecs, guardia `0` bytes post-Canvas, RBAC estricto y matriz global (`BUG-H43-PWA-06`):** `normalizarMimeBase()` acepta parámetros de códec (ej. `video/webm;codecs=vp9`); `prepararEvidenciaParaSubida` rechaza `blob.size <= 0`; `AuthContext.tsx` retira el fallback implícito de `reportes:crear`; `TC-14` en `docs/qa/matrices/matriz-pruebas-terreno.md` se alinea al cierre formal `APROBADO`.

| Indicador / Verificación | Auditoría Inicial (`24/11/2026`) | Re-Test Final (`26/11/2026`) | Observación Técnica |
|---|---|---|---|
| Total de registros en matriz (HU-43 PWA) | `22` (`6` defectos + `16` casos base) | `22` (`6` defectos + `16` casos base) | `22/22` en estado `APROBADO` (`100%` tasa de aprobación) |
| Defectos por severidad (Abiertos / Cerrados) | `6` Abiertos (`3` Crít., `1` Alta, `1` Med., `1` Baja) | `0` Abiertos / `6` Resueltos (`100%`) | Cierre formal verificado en código, tipos y pruebas |
| Suite global PWA (`npm test`) | `56` archivos / `270` pruebas (`25.86s`) | `61` archivos / `351` pruebas (`12.70s`) | `100%` aprobadas (`+5` archivos y `+81` pruebas acumuladas) |
| Suite focalizada HU-43 (`7` módulos base) | `7` archivos / `39` pruebas (`4.42s`) | `7` archivos / `63` pruebas (`5.08s`) | `mediaUtils`, `evidenciaService`, `CargaEvidenciaCard`, `CuadrillaDetailPage`, `useConnectivity`, `offlineQueue`, `EvaluacionReporteCierreCard` |
| Suite focalizada ampliada HU-43 (`9` módulos) | No medida por separado | `9` archivos / `97` pruebas (`4.23s`) | Incluye `misionesService.test.ts` (`29`) y `reporteVerificacionService.test.ts` (`5`) |
| Filtro por etiqueta `npm test -- -t "(H43)"` | `4` archivos / `18` pruebas (`12.10s`) | `8` archivos / `26` pruebas (`12.22s`) | `325` pruebas omitidas por filtro nominal |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `1` advertencia (`exit 0`) | `0` errores, `0` advertencias (`exit 0`) | Warning de `prioridadClase` eliminado |
| Verificación de tipos (`npx tsc --noEmit`) | **FALLIDO** (`exit 2`, `2` errores `TS2344`) | **APROBADO** (`exit 0`, `0` errores) | Firma `Promise<{ id: string }>` y OpenAPI validados |
| Build de producción (`npm run build`) | **FALLIDO** (`exit 1`) | **APROBADO** (`exit 0`) | Next.js 16.3.4 Webpack compilado (`4.7s`), TS OK (`10.5s`), `8/8` rutas |
| Guardias de fuentes y seguridad (`grep`) | N/A | **APROBADO** (`0` hallazgos) | Sin `next/font/google`, sin `DEV_PATRULLA`, sin emojis, sin `any` |
| Verificación HTTP/cURL en vivo (`:3002` + `:4001`) | Ejecutada (`401`, `403`, `400`, `415`, `307`, `sw.js`) | Validada en ciclo inicial | Entorno local de servidores inactivo durante Re-Test; contratos API re-verificados en código `sgrai-api` y OpenAPI |

---

## 2. Registro Técnico de Defectos

### `BUG-H43-PWA-01`: Pérdida de evidencia asociada a `incidente_id` tras sincronización o recarga (`obtenerDetalleMision`), ocultamiento de errores de cola y fallo con `incidenteId` vacío
- **Severidad:** Crítica
- **Estado:** **RESUELTO (VERIFICADO EN RE-TEST)**
- **Archivos afectados:**
  - `src/services/misionesService.ts` (líneas 421–474)
  - `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (líneas 162–180, 378–386)
  - `src/services/evidenciaService.ts` (líneas 157–168)
  - `src/types/api-generated.d.ts` (líneas 2034–2043, 4088–4117)
- **Descripción y Causa Raíz (Auditoría Inicial):**
  1. En misiones operativas activas de cuadrilla (`ATENCION_CUADRILLA` en estado `EN_CURSO`), `reportesTerreno` retornada por `GET /api/misiones/{id}` viene vacía (`[]`), asociando la evidencia únicamente mediante `incidente_id`.
  2. `obtenerDetalleMision` extraía adjuntos solo desde `d.reportesTerreno.flatMap((rep) => rep.adjuntos)` y conservaba únicamente ítems previos con `sincronizacionPendiente === true`, eliminando adjuntos recién sincronizados tras `sgrai:outbox-synced` y adjuntos rechazados con `errorSincronizacion`.
  3. En misiones sin incidente asociado (`PREVENCION` / `RECUPERACION`), `incidenteId` vacío (`""`) habilitaba `CargaEvidenciaCard` y provocaba error de validación UUID al subir.
  4. En la contraparte backend (`sgrai-api`), `GET /api/misiones/{id}` y `GET /api/incidentes/{id}` no exponían adjuntos vinculados directamente a `incidente_id` (`reporte_terreno_id IS NULL`).
- **Resolución y Verificación en Re-Test (`26/11/2026 21:55 -03:00`):**
  - `misionesService.ts:421-473` consolida `d.adjuntos` (`adjuntosDirectosRemotos`) y `d.reportesTerreno[].adjuntos` (`adjuntosDeReportesRemotos`) deduplicados en `mapaRemotos`, y conserva en `adjuntosLocalesConservados` los adjuntos con `sincronizacionPendiente`, `errorSincronizacion` o ID definitivo ausente en remoto (`!item.id.startsWith('local-') && !mapaRemotos.has(item.id)`).
  - `CuadrillaMisionDetailPage` (`page.tsx:163-179`) normaliza `incidenteIdMision` / `reporteTerrenoIdMision` y exige `(incidenteIdMision || reporteTerrenoIdMision)` en `puedeAdjuntarEvidencia`; `evidenciaService.ts:157-158` normaliza espacios/vacíos a `undefined`.
  - La contraparte `sgrai-api` (`fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)`) expone `adjuntos` directos por `incidente_id` en `obtenerMisionDetallePorIdRepo` y `obtenerIncidenteDetallePorIdRepo`, reflejado en `src/types/api-generated.d.ts`.
  - Verificado con pruebas automatizadas en `misionesService.test.ts` (`29/29`), `CuadrillaDetailPage.test.tsx` (`8/8`) y `evidenciaService.test.ts` (`5/5`).

---

### `BUG-H43-PWA-02`: Fallo de compilación estática TypeScript (`tsc --noEmit`) y build de producción (`npm run build`) en `CuadrillaMisionDetailPage`
- **Severidad:** Crítica
- **Estado:** **RESUELTO (VERIFICADO EN RE-TEST)**
- **Archivos afectados:**
  - `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (líneas 38–44)
  - `src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx`
- **Descripción y Causa Raíz (Auditoría Inicial):**
  `CuadrillaMisionDetailPage` definía `params: Promise<{ id: string }> | { id: string }` con invocación condicional de `use(params)`, fallando en Next.js 16 con error `TS2344` durante `npx tsc --noEmit` (`exit 2`) y `npm run build` (`exit 1`), además de registrar advertencia ESLint por variable sin uso `prioridadClase`.
- **Resolución y Verificación en Re-Test (`26/11/2026 21:55 -03:00`):**
  - `page.tsx:38-44` declara `interface PageProps { params: Promise<{ id: string }>; }` e invoca `const resolvedParams = use(params)` incondicionalmente; `prioridadClase` fue eliminada.
  - Verificado en Re-Test con `npm run lint` (`exit 0`, `0` errores, `0` warnings), `npx tsc --noEmit` (`exit 0`) y `npm run build` (`exit 0`, Webpack `4.7s`, TypeScript `10.5s`, `8/8` rutas generadas).

---

### `BUG-H43-PWA-03`: Bloqueo del envío del Informe Técnico de Cierre (HU-39) al adjuntar evidencia offline y pérdida de estado/visualización en `EvaluacionReporteCierreCard`
- **Severidad:** Crítica
- **Estado:** **RESUELTO (VERIFICADO EN RE-TEST)**
- **Archivos afectados:**
  - `src/components/misiones/EvaluacionReporteCierreCard.tsx` (líneas 57–62, 112–127, 157–194, 404–414, 707–741)
  - `src/services/reporteVerificacionService.ts` (líneas 176–204, 323–352)
  - `src/services/offlineQueue.ts` (líneas 483–489)
  - `src/hooks/useConnectivity.ts` (líneas 68, 97–180, 407)
- **Descripción y Causa Raíz (Auditoría Inicial):**
  1. En modo offline dentro de `EvaluacionReporteCierreCard`, `alAdjuntarEvidencia` incorporaba `id: "local-..."` y `url: "data:..."` a `form.adjuntoIds`/`form.adjuntos`, fallando `crearReporteVerificacionSchema.parse` (`.uuid()` y `.max(500)`).
  2. `adjuntosEvidencia` no se resincronizaba al actualizar `misionActual`, y la vista `yaEnviado === true` no mostraba un visor multimedia consolidado de los adjuntos.
- **Resolución y Verificación en Re-Test (`26/11/2026 21:55 -03:00`):**
  - `EvaluacionReporteCierreCard.tsx:194-196` sincroniza `adjuntosEvidencia` ante cambios de `misionActual`; `líneas 718-740` solo añaden a `form.adjuntoIds`/`form.adjuntos` adjuntos sincronizados con UUID válido y URL no `data:`/`blob:`; `líneas 157-193, 404-414` consolidan `adjuntosResumenCierre` y renderizan `<CargaEvidenciaCard soloLectura />` en la vista `yaEnviado`.
  - `reporteVerificacionService.ts:184-203` sanitiza `adjuntoIds`/`adjuntos` antes de Zod y en modo offline (`líneas 324-352`) registra `__adjuntosLocalesPendientes` en el payload de `ENVIAR_REPORTE`.
  - `offlineQueue.ts:483-489` asigna clave causal `mision:${misionId}` a `SUBIR_EVIDENCIA` para ejecutarse estrictamente antes de `ENVIAR_REPORTE`, y `useConnectivity.ts:68, 97-180, 407` sustituye los IDs temporales por los UUID/URLs definitivos del servidor al sincronizar.
  - Verificado con pruebas automatizadas en `EvaluacionReporteCierreCard.test.tsx` (`7/7`), `reporteVerificacionService.test.ts` (`5/5`), `offlineQueue.test.ts` (`13/13`) y `useConnectivity.test.ts` (`15/15`).
  - *Nota técnica no bloqueante para mejora continua:* En `misionesService.ts:576-577`, `reporteTerrenoId` continúa apuntando a `reportesRemotos[0]?.id` (que puede corresponder a un reporte previo de prioridad HU-38 sobre el mismo incidente abierto, aceptado por backend pero semánticamente distinto al cierre), y en `reporteVerificacionService.ts:447` el fallback `catch` ante caída súbita de red con `navigator.onLine = true` puede homologarse para adjuntar también `__adjuntosLocalesPendientes`.

---

### `BUG-H43-PWA-04`: Desincronización del contrato OpenAPI (`api-generated.d.ts`), omisión de `x-user-id` y bucle infinito sin manejo de HTTP `401` en `useConnectivity`
- **Severidad:** Alta
- **Estado:** **RESUELTO (VERIFICADO EN RE-TEST)**
- **Archivos afectados:**
  - `src/types/api-generated.d.ts` (líneas 9524+)
  - `src/services/evidenciaService.ts` (líneas 39–50, 110–115, 223–230)
  - `src/hooks/useConnectivity.ts` (líneas 39, 53, 71–78, 192–196, 417–436, 616–620)
- **Descripción y Causa Raíz (Auditoría Inicial):**
  `src/types/api-generated.d.ts` no incluía `/api/evidencia/adjuntos`; `evidenciaService.ts` definía tipos manuales y omitía `x-user-id`; `useConnectivity.ts` no detenía reintentos ni cerraba sesión ante HTTP `401` y omitía `body.message` en errores definitivos `4xx` de `SUBIR_EVIDENCIA`.
- **Resolución y Verificación en Re-Test (`26/11/2026 21:55 -03:00`):**
  - `src/types/api-generated.d.ts` regenerado con `GET` y `POST /api/evidencia/adjuntos` y `adjuntos` en misiones/incidentes.
  - `evidenciaService.ts:39-50` tipa respuestas derivando `AdjuntoCreadoOpenApi` desde `paths['/api/evidencia/adjuntos']['post']['responses']['201']['content']['application/json']`, inyecta `x-user-id` mediante `extractUserIdFromJwt(token)` (`líneas 226-229`) y mapea HTTP `409` (`líneas 110-115`).
  - `useConnectivity.ts` inyecta `x-user-id` (`líneas 74-77`), detiene definitivamente el ciclo de sincronización/polling ante HTTP `401` mediante `sesionExpiradaRef` + `handleUnauthorizedSession()` (`líneas 39, 53, 192-196, 616-619`) y extrae `bodyErr.message || bodyErr.error` al marcar rechazos `4xx`/`409` en `SUBIR_EVIDENCIA` (`líneas 417-435`).
  - Verificado en `evidenciaService.test.ts` (`5/5`) y `useConnectivity.test.ts` (`15/15`).

---

### `BUG-H43-PWA-05`: Resolución directa de `NEXT_PUBLIC_API_URL` en navegador evadiendo rewrite `/uploads/:path*`, enlace PDF deshabilitado offline y área táctil de `36px`
- **Severidad:** Media
- **Estado:** **RESUELTO (VERIFICADO EN RE-TEST)**
- **Archivos afectados:**
  - `src/components/misiones/CargaEvidenciaCard.tsx` (líneas 49–56, 85–130, 277–282, 344–346)
  - `src/components/misiones/CargaEvidenciaCard.module.css` (línea 272)
- **Descripción y Causa Raíz (Auditoría Inicial):**
  `resolverUrlEvidencia` anteponía `NEXT_PUBLIC_API_URL` en navegador evadiendo `/uploads/:path*`; `esUrlDescargable` excluía `data:application/pdf`; `.downloadLink` poseía `min-height: 36px` (< `48px`); `procesarArchivos` sobrescribía errores en selecciones múltiples.
- **Resolución y Verificación en Re-Test (`26/11/2026 21:55 -03:00`):**
  - `CargaEvidenciaCard.tsx:49-52` retorna la ruta relativa normalizada (`/uploads/...`) cuando `typeof window !== 'undefined' && process.env.NODE_ENV !== 'test'`.
  - `CargaEvidenciaCard.tsx:277-281, 344-346` incluye `data:application/pdf` y `blob:` en `esUrlDescargable` y asigna atributo `download={item.nombreArchivo}` para `data:`.
  - `CargaEvidenciaCard.tsx:85-129` acumula errores de lotes múltiples en `erroresAcumulados` y los despliega consolidados.
  - `CargaEvidenciaCard.module.css:272` actualiza `.downloadLink` a `min-height: 48px` manteniendo `border-radius: 0`.
  - Verificado en `CargaEvidenciaCard.test.tsx` (`6/6`).

---

### `BUG-H43-PWA-06`: Validación rígida de MIME con parámetros de códec, ausencia de control `blob.size <= 0` post-Canvas, fallback RBAC permisivo y desfase en matriz global
- **Severidad:** Baja
- **Estado:** **RESUELTO (VERIFICADO EN RE-TEST)**
- **Archivos afectados:**
  - `src/lib/utils/mediaUtils.ts` (líneas 36–63, 226–228, 244–254)
  - `src/context/AuthContext.tsx` (líneas 256–263)
  - `docs/qa/matrices/matriz-pruebas-terreno.md` (línea 27)
- **Descripción y Causa Raíz (Auditoría Inicial):**
  `esMimePermitidoEvidencia` rechazaba MIME con parámetros de códec (`video/webm;codecs=vp8`); `prepararEvidenciaParaSubida` no validaba `blob.size <= 0` tras compresión Canvas; `AuthContext.tsx` otorgaba fallback implícito para `reportes:crear` en `PATRULLA_VERIFICADORA`; `TC-14` figuraba `APROBADO` prematuramente en la matriz global.
- **Resolución y Verificación en Re-Test (`26/11/2026 21:55 -03:00`):**
  - `mediaUtils.ts:36-63, 253` introduce `normalizarMimeBase()` en todas las utilidades MIME aceptando parámetros de códec; `líneas 226-228` y `244-246` rechazan `blob.size <= 0` y archivos vacíos de `0` bytes.
  - `AuthContext.tsx:256-263` (integrado vía `merge: integrar develop (QA H39/H41) en feature/h43-adjuntar-evidencia-multimedia`) restringe el fallback únicamente a prefijos `patrulla:` / `cuadrilla:`, exigiendo permiso explícito `reportes:crear`.
  - `docs/qa/matrices/matriz-pruebas-terreno.md:27` pasó a `EN RE-TEST` durante la corrección y queda cerrado en estado `APROBADO` tras superar este ciclo de Re-Test.
  - Verificado en `mediaUtils.test.ts` (`9/9`).

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|:---:|:---:|---|
| `BUG-H43-PWA-01` | Pérdida de evidencia asociada a incidente_id tras sincronización o recarga (obtenerDetalleMision), ocultamiento de errores y falla con incidenteId vacío | Funcional / Offline-First | Servicio / Integración / API | Crítica | Misión activa `ATENCION_CUADRILLA` (`d1000000-...-0002`, `reportesTerreno: []`) o `PREVENCION` sin incidente | Carga online/offline con `incidente_id`, disparo de `sgrai:outbox-synced` o recarga vía `obtenerDetalleMision`, y rechazo `415` en background | Conservar adjuntos sincronizados y con `errorSincronizacion` en `datosAdicionales.adjuntos`, exponer adjuntos por `incidente_id` en detalle y normalizar `incidenteId` vacío | `obtenerDetalleMision` consolida `d.adjuntos` y `reportesTerreno[].adjuntos` preservando locales/errores; `CuadrillaMisionDetailPage` valida `incidenteIdMision` / `reporteTerrenoIdMision`; `misionesService.test.ts` (`29/29`) y `CuadrillaDetailPage.test.tsx` (`8/8`) aprueban | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) / fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06) |
| `BUG-H43-PWA-02` | Fallo de verificación de tipos TypeScript (tsc --noEmit) y build productivo (npm run build) en CuadrillaMisionDetailPage | Compilación / Estática | Sistema / CI | Crítica | Rama `feature/h43-adjuntar-evidencia-multimedia` con `CuadrillaMisionDetailPage` y `CuadrillaDetailPage.test.tsx` | Comandos `npx tsc --noEmit`, `npm run build` y `npm run lint` | `0` errores TypeScript (`Promise<{ id: string }>`), `0` advertencias ESLint y build productivo limpio con exit `0` | `npm run lint` (`exit 0`, `0` errores, `0` warnings), `npx tsc --noEmit` (`exit 0`, `0` errores) y `npm run build` (`exit 0`, Next.js 16.3.4 Webpack limpio, `8/8` rutas) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `BUG-H43-PWA-03` | Bloqueo de envío del Informe Técnico de Cierre (H39) con evidencia offline en EvaluacionReporteCierreCard e inconsistencia en vista resumen | Funcional / Integración | Componente / Validación | Crítica | Patrulla verificadora en Paso 3 (`EvaluacionReporteCierreCard`) bajo modo offline (`navigator.onLine = false`) | Adjunto offline (`id: "local-<uuid>"`, `url: "data:image/jpeg;base64,..."`) seguido de confirmación en `EvaluacionReporteCierreCard` | Filtrar/diferir IDs `local-*` y URLs `data:`, sincronizar estado de `adjuntosEvidencia` ante `misionActual` y mostrar adjuntos en vista resumen `yaEnviado` | `EvaluacionReporteCierreCard` sincroniza `misionActual`, excluye `local-*`/`data:` antes de Zod y despliega visor multimedia en `yaEnviado`; `offlineQueue`/`useConnectivity` resuelven UUID reales en `ENVIAR_REPORTE` (`7/7`, `13/13`, `15/15` en verde) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `BUG-H43-PWA-04` | Desincronización de OpenAPI (api-generated.d.ts), tipos manuales, omisión de x-user-id y bucle 401 sin manejo de mensaje en useConnectivity | Contrato / Seguridad / Sync | Servicio / Hook | Alta | Especificación OpenAPI con `/api/evidencia/adjuntos` en `sgrai-api` y sesión JWT expirada durante cola `outbox` | Revisión de `api-generated.d.ts`, `evidenciaService.ts` (`AdjuntoCreadoOpenApi`) y `useConnectivity.ts` ante HTTP `401` y `400`/`409`/`415` | Tipos derivados de `api-generated.d.ts`, inyección de `x-user-id`, cierre de sesión deteniendo polling ante `401` y extracción de `body.message` en `4xx` | `/api/evidencia/adjuntos` presente en `api-generated.d.ts`; `AdjuntoCreadoOpenApi` derivado de `paths`; `x-user-id` inyectado; `useConnectivity` detiene reintentos tras `401` y propaga `body.message` (`5/5` y `15/15` en verde) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `BUG-H43-PWA-05` | Bypass de rewrite /uploads/:path* por NEXT_PUBLIC_API_URL en navegador, PDF offline sin enlace y objetivo táctil < 48px | UI / Ergonomía / Red | Componente / CSS | Media | `CargaEvidenciaCard` montado en navegador con `NEXT_PUBLIC_API_URL` configurada o PDF adjunto offline | `resolverUrlEvidencia('/uploads/evidencia/foto.webp')`, PDF con `url: "data:application/pdf;base64,..."` e inspección CSS `.downloadLink` | Resolver `/uploads/...` relativo vía rewrite en navegador, habilitar descarga de PDF offline, `.downloadLink >= 48px` y acumular errores múltiples | `resolverUrlEvidencia` retorna ruta relativa en navegador productivo; `Ver PDF` habilitado para `data:application/pdf` y `blob:`; `.downloadLink` con `min-height: 48px`; errores acumulados en lote múltiple (`CargaEvidenciaCard.test.tsx` `6/6` en verde) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `BUG-H43-PWA-06` | Validación rígida de MIME con parámetros de códec, ausencia de control blob.size <= 0 post-Canvas, fallback RBAC y matriz global prematura | Validación / RBAC / Docs | Utilidad / Contexto | Baja | Archivo `video/webm;codecs=vp9`, fallo Canvas (`blob.size === 0`) y usuario `PATRULLA_VERIFICADORA` sin `reportes:crear` | `validarArchivoEvidencia`, `prepararEvidenciaParaSubida`, `AuthContext.tienePermiso('reportes:crear')` y `matriz-pruebas-terreno.md:27` | Aceptar MIME base con parámetros de códec, rechazar `blob.size <= 0`, exigir `reportes:crear` explícito y alinear estado QA en matriz global | `normalizarMimeBase()` acepta `video/webm;codecs=vp9`; `prepararEvidenciaParaSubida` rechaza `0` bytes (`mediaUtils.test.ts` `9/9`); `AuthContext` sin fallback implícito; `TC-14` alineado tras Re-Test | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | merge: integrar develop (QA H39/H41) en feature/h43-adjuntar-evidencia-multimedia / fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-01` | Visibilidad condicional del módulo Evidencia Multimedia en CuadrillaMisionDetailPage según estado activo y permiso RBAC reportes:crear | Funcional / RBAC (CA-1, CA-7) | Componente / Integración | Crítica | `CuadrillaMisionDetailPage` con usuario `DELEGADO_CUADRILLA` y `unidadActiva: true` | Misión `EN_CURSO` con permiso `reportes:crear` vs misión `DESPACHADA`, sin `reportes:crear` o sin IDs válidos | Renderiza `CargaEvidenciaCard` con botones de captura solo en faena activa con permiso `reportes:crear` e ID válido; oculto en `DESPACHADA` o sin permiso | Verificado en regresión: `CuadrillaDetailPage.test.tsx` (`8/8` tests en verde, `944ms`) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-02` | Presencia de controles de captura directa desde cámara (Tomar Foto, Grabar Video) y selector múltiple Galería / PDF | Funcional / UI (CA-2) | Componente | Alta | `CargaEvidenciaCard` montado en modo editable (`soloLectura: false`) | Inspección de `input-captura-foto`, `input-captura-video` e `input-seleccion-archivo` | Botones táctiles visibles; inputs de cámara con `capture="environment"` y `accept` específicos; selector general con `multiple` | Verificado en regresión: `CargaEvidenciaCard.test.tsx` (`6/6` tests en verde, `609ms`) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43) |
| `CP-H43-PWA-03` | Validación estricta de tipos MIME autorizados, archivos vacíos (0 bytes) y límite máximo de 10 MB en cliente | Validación (CA-3) | Unidad / Componente | Crítica | Utilidad `validarArchivoEvidencia` y `CargaEvidenciaCard` | Archivos `JPEG`, `PNG`, `WebP`, `MP4`, `WebM` (con/sin códec), `MOV`, `PDF`; inválidos `image/gif`, `text/plain`; `0 B` y `10 MB + 1 byte` | Acepta los 7 formatos válidos dentro de 10 MB; bloquea antes de invocar subida los MIME no permitidos, vacíos y mayores a 10 MB | Verificado en regresión: `mediaUtils.test.ts` (`9/9` tests en verde, `23ms`) y `CargaEvidenciaCard.test.tsx` (`6/6`) aprueban | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-04` | Compresión de imágenes en cliente mediante Canvas a JPEG <= 1280px y preservación íntegra de videos y documentos PDF | Funcional / Optimización | Unidad | Alta | `prepararEvidenciaParaSubida` con mocks de `Canvas`, `FileReader` e `Image` (2560x1440) | `evidencia.png` (`image/png`), `inspeccion.mp4` (`video/mp4`), `video/webm;codecs=vp9` y `acta.pdf` (`application/pdf`) | Redimensiona imagen manteniendo relación de aspecto a `1280x720` JPEG (`.jpg`); rechaza `0` bytes post-Canvas; mantiene intactos MP4/WebM/PDF sin compresión | Verificado en regresión: `mediaUtils.test.ts` (`9/9` tests en verde, `23ms`) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-05` | Construcción y envío de FormData multipart online hacia POST /api/evidencia/adjuntos con incidente_id y retorno de DTO del servidor | Funcional / Integración (CA-4) | Servicio | Crítica | `navigator.onLine = true`, `fetch` mockeado con HTTP `201 Created` | `subirEvidenciaMultimedia({ archivo: video.mp4, misionId, incidenteId })` con JWT Bearer + `x-user-id` | Envía `POST /api/evidencia/adjuntos` con `FormData` (`file`, `incidente_id`) y `x-user-id`, notifica progreso `100%` y retorna URL definitiva sin usar `outbox` | Verificado en regresión: `evidenciaService.test.ts` (`5/5` tests en verde, `66ms`) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-06` | Encolamiento offline en IndexedDB (outbox SUBIR_EVIDENCIA) sin sobrescritura de múltiples archivos y rechazo sin encolar ante 409/413/415 | Offline-First / Persistencia (CA-5) | Servicio / IndexedDB | Crítica | `navigator.onLine = false` o respuestas HTTP `409`/`415` en `subirEvidenciaMultimedia` | Carga de `video1.mp4` y `video2.mp4` offline; respuestas `409` y `415` online | Encola ambos adjuntos independientes en `outbox` (`SUBIR_EVIDENCIA`) validados por Zod con orden causal por misión; ante `409`/`415` lanza `EvidenciaServiceError` sin encolar | Verificado en regresión: `evidenciaService.test.ts` (`5/5`, `66ms`) y `offlineQueue.test.ts` (`13/13`, `70ms`) en verde | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-07` | Sincronización diferida de SUBIR_EVIDENCIA en useConnectivity mediante FormData y manejo terminal de HTTP 401/415 | Offline-First / Sincronización (CA-5) | Hook / Servicio | Crítica | Acción `SUBIR_EVIDENCIA` encolada y retorno de conectividad (`navigator.onLine = true`) | `useConnectivity.sincronizar()` con respuestas mock HTTP `201`, `401` y `415` (`body.message`) | Reconstruye `Blob` desde `dataUrl`, envía `FormData` multipart con `x-user-id`, propaga `body.message` en `415`, detiene polling en `401` y remueve ítem bloqueante de `outbox` | Verificado en regresión: `useConnectivity.test.ts` (`15/15` tests en verde, `252ms`) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-08` | Persistencia y visualización continua en galería de misión tras recarga de página o disparo de sgrai:outbox-synced para adjuntos con incidente_id | Funcional / Resiliencia (CA-4, CA-5, CA-6) | Integración / Servicio | Crítica | Misión activa `ATENCION_CUADRILLA` (`MIS-2026-0002`, `reportesTerreno: []`) con adjunto cargado por `incidente_id` | Subida online u offline + disparo de `sgrai:outbox-synced` / `obtenerDetalleMision(id)` con `d.adjuntos` y adjuntos locales previos | El adjunto sincronizado permanece visible en la galería con badge `Sincronizado` y se preservan errores/locales pendientes tras recargar detalle desde API | Verificado en Re-Test: `misionesService.test.ts` (`29/29`, `68ms`) valida consolidación sin duplicados de `d.adjuntos`, `reportesTerreno[].adjuntos` y preservación de locales/errores | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-09` | Integración de carga de evidencia multimedia dentro de EvaluacionReporteCierreCard (H39) en modo online y offline | Funcional / Integración | Componente / Validación | Crítica | Patrulla en Paso 3 (`EvaluacionReporteCierreCard`) con permiso `reportes:crear` | Renderizado del componente en modo editable, actualización de `misionActual`, adjunto offline (`local-*`) y vista resumen `yaEnviado` | Permite adjuntar evidencia online/offline sin bloquear la validación Zod, resuelve UUID reales en `useConnectivity` y renderiza visor multimedia en resumen cerrado | Verificado en Re-Test: `EvaluacionReporteCierreCard.test.tsx` (`7/7`, `1291ms`), `reporteVerificacionService.test.ts` (`5/5`, `40ms`) y `useConnectivity.test.ts` (`15/15`, `252ms`) aprueban | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-10` | Previsualización en interfaz de miniaturas de imagen, reproductor de video y tarjeta de documento PDF con badges de estado | Funcional / UI | Componente | Alta | `CargaEvidenciaCard` con arreglo de `AdjuntoLocal` (`image/webp`, `video/mp4`, `application/pdf` online y offline `data:`) | Items con `sincronizacionPendiente: false` y `true`, enlace `Ver PDF` (`48px`) y URL relativa en navegador | Renderiza `<img>` con `alt`, `<video controls>`, tarjeta PDF con enlace `Ver PDF` (`>= 48px`) incluso en `data:application/pdf` y badges `Sincronizado` / `Pendiente offline` | Verificado en regresión: `CargaEvidenciaCard.test.tsx` (`6/6` tests en verde, `609ms`) y CSS `.downloadLink` en `48px` | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-11` | Verificación en vivo de endpoint POST /api/evidencia/adjuntos vía proxy PWA: RBAC (401/403), asociación (400) y MIME/magic bytes (415) | Seguridad / Contrato API (CA-3, CA-7) | Sistema / HTTP | Crítica | Servidores `sgrai-api` (`:4001`) y `sgrai-pwa` (`:3002`) activos contra PostgreSQL | Peticiones `curl` sin token, con JWT `CALL_CENTER`, con JWT `DELEGADO_CUADRILLA` sin IDs, con `text/plain` y con `image/jpeg` falsificado | Retorna `401` sin Bearer, `403` (`reportes:crear`) para `CALL_CENTER`, `400` sin IDs y `415` ante MIME o firma binaria inválida | Confirmado en vivo vía `http://localhost:3002/api/evidencia/adjuntos` (`401`, `403`, `400`, `415`, `415` magic bytes) en auditoría inicial | APROBADO | 24/11/2026 14:19 | N/A | feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43) |
| `CP-H43-PWA-12` | Protección perimetral SSR en ruta de cuadrilla (307), cabeceras de Service Worker (/terreno/sw.js) y manifiesto PWA | Seguridad / Infraestructura PWA | Sistema / HTTP | Alta | Servidor `sgrai-pwa` ejecutándose en `:3002` sin cookie `sgrai_auth_token` | `GET /terreno/cuadrilla/misiones/d1000000-...-0002`, `HEAD /terreno/sw.js` y `GET /terreno/manifest.webmanifest` | Redirección `307` a `/terreno/login?returnUrl=...`; `/terreno/sw.js` con `Service-Worker-Allowed: /terreno` y `200 OK`; manifiesto JSON válido `200 OK` | Confirmado en vivo con `curl`: `307 Temporary Redirect`, `sw.js` `200 OK` (`2998` bytes) y `manifest.webmanifest` `200 OK` en auditoría inicial | APROBADO | 24/11/2026 14:19 | N/A | feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43) |
| `CP-H43-PWA-13` | Cumplimiento de diseño institucional Flat UI (border-radius: 0), ergonomía >= 48px, iconografía lucide-react, ausencia de emojis, next/font/google y cero uso de any | Calidad UI / Estándares | Estática | Media | Código fuente actualizado tras correcciones en rama `feature/h43-adjuntar-evidencia-multimedia` | Búsqueda regex Unicode de emojis, inspección de `\bany\b`, `next/font/google`, `DEV_PATRULLA` y CSS `CargaEvidenciaCard.module.css` | Cero emojis en UI, cero declaraciones `any`, sin Google Fonts, esquinas rectas a `0px`, área táctil `>= 48px` y uso exclusivo de `lucide-react` | Re-verificado en Re-Test: `NO_EMOJIS`, `NO_ANY_FOUND`, `OK: sin Google Fonts`, `OK: sin DEV_PATRULLA`, `border-radius: 0` y `.downloadLink min-height: 48px` | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-14` | Compilación TypeScript estricta (npx tsc --noEmit), análisis ESLint (npm run lint) y empaquetado Next.js (npm run build) | Compilación / Calidad | Sistema / CI | Crítica | Repositorio `web-app` limpio en rama evaluada tras correcciones | Ejecución de `npm run lint`, `npx tsc --noEmit` y `npm run build` | Compilación limpia (`exit 0`) en las tres herramientas sin errores de tipos ni advertencias | Verificado en Re-Test: `npm run lint` (`exit 0`, `0` errores, `0` warnings), `npx tsc --noEmit` (`exit 0`) y `npm run build` (`exit 0`, Webpack `4.7s`, TS `10.5s`, `8/8` rutas) | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-15` | Ejecución de suite automatizada completa (351 tests), focalizada HU-43 (63/97 tests) y filtro nominal -t "(H43)" en Vitest y React Testing Library | Automatización | Unit / Component / Service | Alta | Entorno Vitest v3.2.7 + JSDOM + `fake-indexeddb` | `npm test`, suite focalizada de `7` y `9` archivos y `npm test -- -t "(H43)"` | `100%` de las pruebas unitarias y de componentes existentes y de regresión HU-43 aprueban sin fallos | Verificado en Re-Test: `61/61` archivos (`351/351` tests) en global (`12.70s`), `7/7` (`63/63`) base (`5.08s`), `9/9` (`97/97`) ampliada (`4.23s`) y `8/61` (`26` tests) bajo `-t "(H43)"` (`12.22s`) | APROBADO | 24/11/2026 14:21 | 26/11/2026 21:55 | fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) |
| `CP-H43-PWA-16` | Revisión del manual de usuario H43-adjuntar-evidencia-multimedia.md, contrato docs/api/contratos-terreno.md y matriz global de terreno | Documentación | Documentación | Media | Archivos `docs/manuals/H43-adjuntar-evidencia-multimedia.md`, `docs/api/contratos-terreno.md` y `docs/qa/matrices/matriz-pruebas-terreno.md` | Verificación de estructura obligatoria (`AGENTS.md §5`: Comportamiento sin conexión, permisos del dispositivo y consistencia de `TC-14`) | Manual y contrato conformes a normativa; `TC-14` actualizado a `APROBADO` tras superar Re-Test | Manual `H43` (`57` líneas), contrato sección `2.2` y `TC-14` en `matriz-pruebas-terreno.md` alineados y aprobados tras Re-Test | APROBADO | 24/11/2026 14:15 | 26/11/2026 21:55 | docs(qa): actualizar casos de prueba y dictamen de re-test de HU-43 |

---

## 4. Bloque TSV para Hoja de Cálculo

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H43-PWA-01	Pérdida de evidencia asociada a incidente_id tras sincronización o recarga (obtenerDetalleMision), ocultamiento de errores y falla con incidenteId vacío	Funcional / Offline-First	Servicio / Integración / API	Crítica	Misión activa ATENCION_CUADRILLA (d1000000-...-0002, reportesTerreno: []) o PREVENCION sin incidente	Carga online/offline con incidente_id, disparo de sgrai:outbox-synced o recarga vía obtenerDetalleMision, y rechazo 415 en background	Conservar adjuntos sincronizados y con errorSincronizacion en datosAdicionales.adjuntos, exponer adjuntos por incidente_id en detalle y normalizar incidenteId vacío	obtenerDetalleMision consolida d.adjuntos y reportesTerreno[].adjuntos preservando locales/errores; CuadrillaMisionDetailPage valida incidenteIdMision / reporteTerrenoIdMision; misionesService.test.ts (29/29) y CuadrillaDetailPage.test.tsx (8/8) aprueban	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06) / fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)
BUG-H43-PWA-02	Fallo de verificación de tipos TypeScript (tsc --noEmit) y build productivo (npm run build) en CuadrillaMisionDetailPage	Compilación / Estática	Sistema / CI	Crítica	Rama feature/h43-adjuntar-evidencia-multimedia con CuadrillaMisionDetailPage y CuadrillaDetailPage.test.tsx	Comandos npx tsc --noEmit, npm run build y npm run lint	0 errores TypeScript (Promise<{ id: string }>), 0 advertencias ESLint y build productivo limpio con exit 0	npm run lint (exit 0, 0 errores, 0 warnings), npx tsc --noEmit (exit 0, 0 errores) y npm run build (exit 0, Next.js 16.3.4 Webpack limpio, 8/8 rutas)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
BUG-H43-PWA-03	Bloqueo de envío del Informe Técnico de Cierre (H39) con evidencia offline en EvaluacionReporteCierreCard e inconsistencia en vista resumen	Funcional / Integración	Componente / Validación	Crítica	Patrulla verificadora en Paso 3 (EvaluacionReporteCierreCard) bajo modo offline (navigator.onLine = false)	Adjunto offline (id: "local-<uuid>", url: "data:image/jpeg;base64,...") seguido de confirmación en EvaluacionReporteCierreCard	Filtrar/diferir IDs local-* y URLs data:, sincronizar estado de adjuntosEvidencia ante misionActual y mostrar adjuntos en vista resumen yaEnviado	EvaluacionReporteCierreCard sincroniza misionActual, excluye local-*/data: antes de Zod y despliega visor multimedia en yaEnviado; offlineQueue/useConnectivity resuelven UUID reales en ENVIAR_REPORTE (7/7, 13/13, 15/15 en verde)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
BUG-H43-PWA-04	Desincronización de OpenAPI (api-generated.d.ts), tipos manuales, omisión de x-user-id y bucle 401 sin manejo de mensaje en useConnectivity	Contrato / Seguridad / Sync	Servicio / Hook	Alta	Especificación OpenAPI con /api/evidencia/adjuntos en sgrai-api y sesión JWT expirada durante cola outbox	Revisión de api-generated.d.ts, evidenciaService.ts (AdjuntoCreadoOpenApi) y useConnectivity.ts ante HTTP 401 y 400/409/415	Tipos derivados de api-generated.d.ts, inyección de x-user-id, cierre de sesión deteniendo polling ante 401 y extracción de body.message en 4xx	/api/evidencia/adjuntos presente en api-generated.d.ts; AdjuntoCreadoOpenApi derivado de paths; x-user-id inyectado; useConnectivity detiene reintentos tras 401 y propaga body.message (5/5 y 15/15 en verde)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
BUG-H43-PWA-05	Bypass de rewrite /uploads/:path* por NEXT_PUBLIC_API_URL en navegador, PDF offline sin enlace y objetivo táctil < 48px	UI / Ergonomía / Red	Componente / CSS	Media	CargaEvidenciaCard montado en navegador con NEXT_PUBLIC_API_URL configurada o PDF adjunto offline	resolverUrlEvidencia('/uploads/evidencia/foto.webp'), PDF con url: "data:application/pdf;base64,..." e inspección CSS .downloadLink	Resolver /uploads/... relativo vía rewrite en navegador, habilitar descarga de PDF offline, .downloadLink >= 48px y acumular errores múltiples	resolverUrlEvidencia retorna ruta relativa en navegador productivo; Ver PDF habilitado para data:application/pdf y blob:; .downloadLink con min-height: 48px; errores acumulados en lote múltiple (CargaEvidenciaCard.test.tsx 6/6 en verde)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
BUG-H43-PWA-06	Validación rígida de MIME con parámetros de códec, ausencia de control blob.size <= 0 post-Canvas, fallback RBAC y matriz global prematura	Validación / RBAC / Docs	Utilidad / Contexto	Baja	Archivo video/webm;codecs=vp9, fallo Canvas (blob.size === 0) y usuario PATRULLA_VERIFICADORA sin reportes:crear	validarArchivoEvidencia, prepararEvidenciaParaSubida, AuthContext.tienePermiso('reportes:crear') y matriz-pruebas-terreno.md:27	Aceptar MIME base con parámetros de códec, rechazar blob.size <= 0, exigir reportes:crear explícito y alinear estado QA en matriz global	normalizarMimeBase() acepta video/webm;codecs=vp9; prepararEvidenciaParaSubida rechaza 0 bytes (mediaUtils.test.ts 9/9); AuthContext sin fallback implícito; TC-14 alineado tras Re-Test	APROBADO	24/11/2026 14:15	26/11/2026 21:55	merge: integrar develop (QA H39/H41) en feature/h43-adjuntar-evidencia-multimedia / fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-01	Visibilidad condicional del módulo Evidencia Multimedia en CuadrillaMisionDetailPage según estado activo y permiso RBAC reportes:crear	Funcional / RBAC (CA-1, CA-7)	Componente / Integración	Crítica	CuadrillaMisionDetailPage con usuario DELEGADO_CUADRILLA y unidadActiva: true	Misión EN_CURSO con permiso reportes:crear vs misión DESPACHADA, sin reportes:crear o sin IDs válidos	Renderiza CargaEvidenciaCard con botones de captura solo en faena activa con permiso reportes:crear e ID válido; oculto en DESPACHADA o sin permiso	Verificado en regresión: CuadrillaDetailPage.test.tsx (8/8 tests en verde, 944ms)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-02	Presencia de controles de captura directa desde cámara (Tomar Foto, Grabar Video) y selector múltiple Galería / PDF	Funcional / UI (CA-2)	Componente	Alta	CargaEvidenciaCard montado en modo editable (soloLectura: false)	Inspección de input-captura-foto, input-captura-video e input-seleccion-archivo	Botones táctiles visibles; inputs de cámara con capture="environment" y accept específicos; selector general con multiple	Verificado en regresión: CargaEvidenciaCard.test.tsx (6/6 tests en verde, 609ms)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43)
CP-H43-PWA-03	Validación estricta de tipos MIME autorizados, archivos vacíos (0 bytes) y límite máximo de 10 MB en cliente	Validación (CA-3)	Unidad / Componente	Crítica	Utilidad validarArchivoEvidencia y CargaEvidenciaCard	Archivos JPEG, PNG, WebP, MP4, WebM (con/sin códec), MOV, PDF; inválidos image/gif, text/plain; 0 B y 10 MB + 1 byte	Acepta los 7 formatos válidos dentro de 10 MB; bloquea antes de invocar subida los MIME no permitidos, vacíos y mayores a 10 MB	Verificado en regresión: mediaUtils.test.ts (9/9 tests en verde, 23ms) y CargaEvidenciaCard.test.tsx (6/6) aprueban	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-04	Compresión de imágenes en cliente mediante Canvas a JPEG <= 1280px y preservación íntegra de videos y documentos PDF	Funcional / Optimización	Unidad	Alta	prepararEvidenciaParaSubida con mocks de Canvas, FileReader e Image (2560x1440)	evidencia.png (image/png), inspeccion.mp4 (video/mp4), video/webm;codecs=vp9 y acta.pdf (application/pdf)	Redimensiona imagen manteniendo relación de aspecto a 1280x720 JPEG (.jpg); rechaza 0 bytes post-Canvas; mantiene intactos MP4/WebM/PDF sin compresión	Verificado en regresión: mediaUtils.test.ts (9/9 tests en verde, 23ms)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-05	Construcción y envío de FormData multipart online hacia POST /api/evidencia/adjuntos con incidente_id y retorno de DTO del servidor	Funcional / Integración (CA-4)	Servicio	Crítica	navigator.onLine = true, fetch mockeado con HTTP 201 Created	subirEvidenciaMultimedia({ archivo: video.mp4, misionId, incidenteId }) con JWT Bearer + x-user-id	Envía POST /api/evidencia/adjuntos con FormData (file, incidente_id) y x-user-id, notifica progreso 100% y retorna URL definitiva sin usar outbox	Verificado en regresión: evidenciaService.test.ts (5/5 tests en verde, 66ms)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-06	Encolamiento offline en IndexedDB (outbox SUBIR_EVIDENCIA) sin sobrescritura de múltiples archivos y rechazo sin encolar ante 409/413/415	Offline-First / Persistencia (CA-5)	Servicio / IndexedDB	Crítica	navigator.onLine = false o respuestas HTTP 409/415 en subirEvidenciaMultimedia	Carga de video1.mp4 y video2.mp4 offline; respuestas 409 y 415 online	Encola ambos adjuntos independientes en outbox (SUBIR_EVIDENCIA) validados por Zod con orden causal por misión; ante 409/415 lanza EvidenciaServiceError sin encolar	Verificado en regresión: evidenciaService.test.ts (5/5, 66ms) y offlineQueue.test.ts (13/13, 70ms) en verde	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-07	Sincronización diferida de SUBIR_EVIDENCIA en useConnectivity mediante FormData y manejo terminal de HTTP 401/415	Offline-First / Sincronización (CA-5)	Hook / Servicio	Crítica	Acción SUBIR_EVIDENCIA encolada y retorno de conectividad (navigator.onLine = true)	useConnectivity.sincronizar() con respuestas mock HTTP 201, 401 y 415 (body.message)	Reconstruye Blob desde dataUrl, envía FormData multipart con x-user-id, propaga body.message en 415, detiene polling en 401 y remueve ítem bloqueante de outbox	Verificado en regresión: useConnectivity.test.ts (15/15 tests en verde, 252ms)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-08	Persistencia y visualización continua en galería de misión tras recarga de página o disparo de sgrai:outbox-synced para adjuntos con incidente_id	Funcional / Resiliencia (CA-4, CA-5, CA-6)	Integración / Servicio	Crítica	Misión activa ATENCION_CUADRILLA (MIS-2026-0002, reportesTerreno: []) con adjunto cargado por incidente_id	Subida online u offline + disparo de sgrai:outbox-synced / obtenerDetalleMision(id) con d.adjuntos y adjuntos locales previos	El adjunto sincronizado permanece visible en la galería con badge Sincronizado y se preservan errores/locales pendientes tras recargar detalle desde API	Verificado en Re-Test: misionesService.test.ts (29/29, 68ms) valida consolidación sin duplicados de d.adjuntos, reportesTerreno[].adjuntos y preservación de locales/errores	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-09	Integración de carga de evidencia multimedia dentro de EvaluacionReporteCierreCard (H39) en modo online y offline	Funcional / Integración	Componente / Validación	Crítica	Patrulla en Paso 3 (EvaluacionReporteCierreCard) con permiso reportes:crear	Renderizado del componente en modo editable, actualización de misionActual, adjunto offline (local-*) y vista resumen yaEnviado	Permite adjuntar evidencia online/offline sin bloquear la validación Zod, resuelve UUID reales en useConnectivity y renderiza visor multimedia en resumen cerrado	Verificado en Re-Test: EvaluacionReporteCierreCard.test.tsx (7/7, 1291ms), reporteVerificacionService.test.ts (5/5, 40ms) y useConnectivity.test.ts (15/15, 252ms) aprueban	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-10	Previsualización en interfaz de miniaturas de imagen, reproductor de video y tarjeta de documento PDF con badges de estado	Funcional / UI	Componente	Alta	CargaEvidenciaCard con arreglo de AdjuntoLocal (image/webp, video/mp4, application/pdf online y offline data:)	Items con sincronizacionPendiente: false y true, enlace Ver PDF (48px) y URL relativa en navegador	Renderiza img con alt, video controls, tarjeta PDF con enlace Ver PDF (>= 48px) incluso en data:application/pdf y badges Sincronizado / Pendiente offline	Verificado en regresión: CargaEvidenciaCard.test.tsx (6/6 tests en verde, 609ms) y CSS .downloadLink en 48px	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-11	Verificación en vivo de endpoint POST /api/evidencia/adjuntos vía proxy PWA: RBAC (401/403), asociación (400) y MIME/magic bytes (415)	Seguridad / Contrato API (CA-3, CA-7)	Sistema / HTTP	Crítica	Servidores sgrai-api (:4001) y sgrai-pwa (:3002) activos contra PostgreSQL	Peticiones curl sin token, con JWT CALL_CENTER, con JWT DELEGADO_CUADRILLA sin IDs, con text/plain y con image/jpeg falsificado	Retorna 401 sin Bearer, 403 (reportes:crear) para CALL_CENTER, 400 sin IDs y 415 ante MIME o firma binaria inválida	Confirmado en vivo vía http://localhost:3002/api/evidencia/adjuntos (401, 403, 400, 415, 415 magic bytes) en auditoría inicial	APROBADO	24/11/2026 14:19	N/A	feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43)
CP-H43-PWA-12	Protección perimetral SSR en ruta de cuadrilla (307), cabeceras de Service Worker (/terreno/sw.js) y manifiesto PWA	Seguridad / Infraestructura PWA	Sistema / HTTP	Alta	Servidor sgrai-pwa ejecutándose en :3002 sin cookie sgrai_auth_token	GET /terreno/cuadrilla/misiones/d1000000-...-0002, HEAD /terreno/sw.js y GET /terreno/manifest.webmanifest	Redirección 307 a /terreno/login?returnUrl=...; /terreno/sw.js con Service-Worker-Allowed: /terreno y 200 OK; manifiesto JSON válido 200 OK	Confirmado en vivo con curl: 307 Temporary Redirect, sw.js 200 OK (2998 bytes) y manifest.webmanifest 200 OK en auditoría inicial	APROBADO	24/11/2026 14:19	N/A	feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43)
CP-H43-PWA-13	Cumplimiento de diseño institucional Flat UI (border-radius: 0), ergonomía >= 48px, iconografía lucide-react, ausencia de emojis, next/font/google y cero uso de any	Calidad UI / Estándares	Estática	Media	Código fuente actualizado tras correcciones en rama feature/h43-adjuntar-evidencia-multimedia	Búsqueda regex Unicode de emojis, inspección de any, next/font/google, DEV_PATRULLA y CSS CargaEvidenciaCard.module.css	Cero emojis en UI, cero declaraciones any, sin Google Fonts, esquinas rectas a 0px, área táctil >= 48px y uso exclusivo de lucide-react	Re-verificado en Re-Test: NO_EMOJIS, NO_ANY_FOUND, OK: sin Google Fonts, OK: sin DEV_PATRULLA, border-radius: 0 y .downloadLink min-height: 48px	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-14	Compilación TypeScript estricta (npx tsc --noEmit), análisis ESLint (npm run lint) y empaquetado Next.js (npm run build)	Compilación / Calidad	Sistema / CI	Crítica	Repositorio web-app limpio en rama evaluada tras correcciones	Ejecución de npm run lint, npx tsc --noEmit y npm run build	Compilación limpia (exit 0) en las tres herramientas sin errores de tipos ni advertencias	Verificado en Re-Test: npm run lint (exit 0, 0 errores, 0 warnings), npx tsc --noEmit (exit 0) y npm run build (exit 0, Webpack 4.7s, TS 10.5s, 8/8 rutas)	APROBADO	24/11/2026 14:15	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-15	Ejecución de suite automatizada completa (351 tests), focalizada HU-43 (63/97 tests) y filtro nominal -t "(H43)" en Vitest y React Testing Library	Automatización	Unit / Component / Service	Alta	Entorno Vitest v3.2.7 + JSDOM + fake-indexeddb	npm test, suite focalizada de 7 y 9 archivos y npm test -- -t "(H43)"	100% de las pruebas unitarias y de componentes existentes y de regresión HU-43 aprueban sin fallos	Verificado en Re-Test: 61/61 archivos (351/351 tests) en global (12.70s), 7/7 (63/63) base (5.08s), 9/9 (97/97) ampliada (4.23s) y 8/61 (26 tests) bajo -t "(H43)" (12.22s)	APROBADO	24/11/2026 14:21	26/11/2026 21:55	fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)
CP-H43-PWA-16	Revisión del manual de usuario H43-adjuntar-evidencia-multimedia.md, contrato docs/api/contratos-terreno.md y matriz global de terreno	Documentación	Documentación	Media	Archivos docs/manuals/H43-adjuntar-evidencia-multimedia.md, docs/api/contratos-terreno.md y docs/qa/matrices/matriz-pruebas-terreno.md	Verificación de estructura obligatoria (AGENTS.md §5: Comportamiento sin conexión, permisos del dispositivo y consistencia de TC-14)	Manual y contrato conformes a normativa; TC-14 actualizado a APROBADO tras superar Re-Test	Manual H43 (57 líneas), contrato sección 2.2 y TC-14 en matriz-pruebas-terreno.md alineados y aprobados tras Re-Test	APROBADO	24/11/2026 14:15	26/11/2026 21:55	docs(qa): actualizar casos de prueba y dictamen de re-test de HU-43
````

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

Todos los comandos se ejecutaron desde la raíz de `web-app` (`sgrai-pwa`) sobre la rama `feature/h43-adjuntar-evidencia-multimedia`.

### 5.1. Línea Base de Auditoría Inicial (`24/11/2026`) — Vitest y Compilación

En el ciclo inicial (previo a las correcciones de `fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)`):
- `npm test`: `56/56` archivos (`270/270` pruebas aprobadas en `25.86s`).
- Suite focalizada de `7` archivos: `7/7` archivos (`39/39` pruebas aprobadas en `4.42s`).
- `npm test -- -t "(H43)"`: `4/56` archivos (`18` pruebas aprobadas, `252` omitidas en `12.10s`).
- `npm run lint`: `exit 0` con `1` advertencia (`prioridadClase` en `cuadrilla/misiones/[id]/page.tsx:150`).
- `npx tsc --noEmit`: fallido (`exit 2`, `2` errores `TS2344` por `PageProps.params` en `CuadrillaMisionDetailPage`).
- `npm run build`: fallido (`exit 1`) en fase de typechecking.
- `rg -n "/api/evidencia" src/types/api-generated.d.ts`: ausente (`NOT_FOUND_IN_OPENAPI_TYPES`).

### 5.2. Evidencias de Verificación en Vivo con `curl` (Auditoría Inicial, `24/11/2026`)

Con `sgrai-api` escuchando en `http://localhost:4001` y `sgrai-pwa` en `http://localhost:3002`:

#### 5.2.1. Protección Perimetral SSR, Service Worker y Manifiesto PWA
```bash
curl -s -i "http://localhost:3002/terreno/cuadrilla/misiones/d1000000-0000-4000-8000-000000000002" | head -n 10
curl -s -I "http://localhost:3002/terreno/sw.js"
curl -s -i "http://localhost:3002/terreno/manifest.webmanifest" | head -n 12
```

**Respuestas Obtenidas:**
```http
HTTP/1.1 307 Temporary Redirect
location: /terreno/login?returnUrl=%2Fterreno%2Fcuadrilla%2Fmisiones%2Fd1000000-0000-4000-8000-000000000002

HTTP/1.1 200 OK
Content-Type: application/javascript; charset=utf-8
Service-Worker-Allowed: /terreno
Cache-Control: no-cache, no-store, must-revalidate
X-Content-Type-Options: nosniff
Content-Length: 2998

HTTP/1.1 200 OK
content-type: application/manifest+json
{"name":"SGRAI — App Terreno","short_name":"SGRAI Terreno",...,"id":"/terreno","start_url":"/terreno","scope":"/"}
```

#### 5.2.2. Control de Acceso RBAC (`401`/`403`), Asociación (`400`) y Magic Bytes (`415`) en `POST /api/evidencia/adjuntos`
- Sin cabecera `Authorization`: `HTTP/1.1 401 Unauthorized` (`{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}`).
- Rol `CALL_CENTER` sin `reportes:crear`: `HTTP/1.1 403 Forbidden` (`{"message":"No cuenta con el permiso requerido: reportes:crear"}`).
- Rol `DELEGADO_CUADRILLA` sin `incidente_id` ni `reporte_terreno_id`: `HTTP/1.1 400 Bad Request` (`Debe proporcionar al menos incidente_id o reporte_terreno_id.`).
- Archivo `text/plain` y archivo texto plano con MIME falsificado `image/jpeg`: `HTTP/1.1 415 Unsupported Media Type` (rechazo por tipo MIME y verificación de firma binaria).

---

### 5.3. Evidencias de Re-Test Formal (`26/11/2026 21:55 -03:00`)

Comandos ejecutados tras el commit `fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)` en la rama `feature/h43-adjuntar-evidencia-multimedia`:

#### 5.3.1. Batería Completa de Validación CI (`lint`, `tsc`, `test`, `build` y Guardias)
```bash
grep -rn "next/font/google" src || echo "OK: sin Google Fonts"
grep -rn "DEV_PATRULLA" src || echo "OK: sin DEV_PATRULLA"
npm run lint
npx tsc --noEmit
npm test
npm run build
```

**Evidencia Obtenida:**
```text
=== 1. GUARD CHECKS ===
OK: sin Google Fonts
OK: sin DEV_PATRULLA
=== 2. ESLINT ===
LINT_EXIT=0
=== 3. TSC ===
TSC_EXIT=0
=== 4. VITEST ===
 Test Files  61 passed (61)
      Tests  351 passed (351)
   Start at  21:52:39
   Duration  12.70s (transform 5.11s, setup 16.32s, collect 28.82s, tests 26.71s, environment 78.82s, prepare 9.04s)
TEST_EXIT=0
=== 5. BUILD ===
▲ Next.js 16.3.4 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 105ms
✓ Compiled successfully in 4.7s
✓ Finished TypeScript in 10.5s
✓ Collecting page data using 11 workers in 502ms
✓ Generating static pages using 11 workers (8/8) in 733ms
✓ Collecting build traces in 47s
✓ Finalizing page optimization in 51s
BUILD_EXIT=0
=== SUMMARY ===
lint=0 tsc=0 test=0 build=0
```

#### 5.3.2. Suites Focalizadas HU-43 (`7` Módulos Base, `9` Módulos Ampliados y Filtro `-t "(H43)"`)
```bash
npx vitest run \
  src/lib/utils/__tests__/mediaUtils.test.ts \
  src/services/__tests__/evidenciaService.test.ts \
  src/components/misiones/__tests__/CargaEvidenciaCard.test.tsx \
  'src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx' \
  src/hooks/__tests__/useConnectivity.test.ts \
  src/services/__tests__/offlineQueue.test.ts \
  src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx

npx vitest run \
  src/lib/utils/__tests__/mediaUtils.test.ts \
  src/services/__tests__/evidenciaService.test.ts \
  src/components/misiones/__tests__/CargaEvidenciaCard.test.tsx \
  'src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx' \
  src/hooks/__tests__/useConnectivity.test.ts \
  src/services/__tests__/offlineQueue.test.ts \
  src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx \
  src/services/__tests__/misionesService.test.ts \
  src/services/__tests__/reporteVerificacionService.test.ts

npm test -- -t "(H43)"
```

**Evidencia Obtenida (Suite Base `7` Módulos):**
```text
 ✓ src/services/__tests__/offlineQueue.test.ts (13 tests) 70ms
 ✓ src/lib/utils/__tests__/mediaUtils.test.ts (9 tests) 23ms
 ✓ src/services/__tests__/evidenciaService.test.ts (5 tests) 66ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (15 tests) 252ms
 ✓ src/components/misiones/__tests__/CargaEvidenciaCard.test.tsx (6 tests) 609ms
 ✓ src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx (8 tests) 944ms
 ✓ src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx (7 tests) 1291ms

 Test Files  7 passed (7)
      Tests  63 passed (63)
   Duration  5.08s
```

**Evidencia Obtenida (Suite Ampliada `9` Módulos):**
```text
 ✓ src/services/__tests__/misionesService.test.ts (29 tests) 68ms
 ✓ src/services/__tests__/reporteVerificacionService.test.ts (5 tests) 40ms
 Test Files  9 passed (9)
      Tests  97 passed (97)
   Duration  4.23s
```

**Evidencia Obtenida (`npm test -- -t "(H43)"`):**
```text
 Test Files  8 passed | 53 skipped (61)
      Tests  26 passed | 325 skipped (351)
   Duration  12.22s
```

#### 5.3.3. Verificación Estática de Estándares UI, Tipado y Contrato OpenAPI
```bash
rg -n "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/components/misiones/CargaEvidenciaCard* src/components/misiones/EvaluacionReporteCierreCard* src/services/evidenciaService.ts src/services/misionesService.ts src/services/offlineQueue.ts src/services/reporteVerificacionService.ts src/hooks/useConnectivity.ts src/lib/utils/mediaUtils.ts src/lib/validations/evidencia.ts 'src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx' || echo "NO_EMOJIS"
rg -n "\bany\b" src/components/misiones/CargaEvidenciaCard.tsx src/components/misiones/EvaluacionReporteCierreCard.tsx src/services/evidenciaService.ts src/services/misionesService.ts src/services/offlineQueue.ts src/services/reporteVerificacionService.ts src/hooks/useConnectivity.ts src/lib/utils/mediaUtils.ts src/lib/validations/evidencia.ts src/types/offline.ts 'src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx' || echo "NO_ANY_FOUND"
rg -n "/api/evidencia" src/types/api-generated.d.ts
rg -n "border-radius|min-height" src/components/misiones/CargaEvidenciaCard.module.css
```

**Salida Observada:**
```text
NO_EMOJIS
NO_ANY_FOUND
9524:    "/api/evidencia/adjuntos": {
9..280:  border-radius: 0; (13 declaraciones, todas en 0)
272:     min-height: 48px;
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Cobertura en `sgrai-pwa` / Alcance | Casos de Prueba y Defectos Asociados | Estado Actual | Observaciones Técnicas |
|---|---|---|---|---|
| **CA-1:** La PWA debe proveer un módulo de carga de evidencia multimedia dentro de la misión activa. | Implementado en `CuadrillaMisionDetailPage` (`CargaEvidenciaCard`) y en `EvaluacionReporteCierreCard`. | `CP-H43-PWA-01`, `CP-H43-PWA-09`, `BUG-H43-PWA-01`, `BUG-H43-PWA-02`, `BUG-H43-PWA-03` | **Cumplido** | Compilación productiva limpia (`exit 0`), habilitación condicional solo con estado activo, permiso `reportes:crear` e ID válido, e integración online/offline completa en Paso 3 de patrulla. |
| **CA-2:** Debe permitir la captura directa desde la cámara del dispositivo móvil o la selección desde la galería de archivos. | Inputs `capture="environment"` para foto/video y selector múltiple `Galería / PDF`. | `CP-H43-PWA-02`, `BUG-H43-PWA-05` | **Cumplido** | Atributos `capture`, `accept` y `multiple` verificados; acumulación de errores por lote y objetivos táctiles `>= 48px`. |
| **CA-3:** Validación estricta de archivos: solo se permiten tipos MIME autorizados (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`, además de videos `MP4`/`WebM`/`MOV`) y un peso máximo de 10 MB por archivo. | Validado en `mediaUtils.ts`, `evidencia.ts` y backend `POST /api/evidencia/adjuntos`. | `CP-H43-PWA-03`, `CP-H43-PWA-04`, `CP-H43-PWA-11`, `BUG-H43-PWA-06` | **Cumplido** | Normalización de parámetros de códec (`normalizarMimeBase()`), control `blob.size <= 0` post-Canvas, compresión JPEG `<= 1280px` y validación de magic bytes en servidor. |
| **CA-4:** Al cargar exitosamente, la API debe persistir los metadatos en la tabla `adjunto` asociando el archivo a `reporte_terreno_id` o `incidente_id`. | `evidenciaService.ts` construye `FormData` con `file` e `incidente_id` / `reporte_terreno_id`, tipado con `AdjuntoCreadoOpenApi` (`api-generated.d.ts`). | `CP-H43-PWA-05`, `CP-H43-PWA-08`, `CP-H43-PWA-11`, `BUG-H43-PWA-01`, `BUG-H43-PWA-04` | **Cumplido** | Contrato OpenAPI regenerado, inyección de `x-user-id`, mapeo HTTP `409` y consolidación persistente de `d.adjuntos` + `reportesTerreno[].adjuntos` en `obtenerDetalleMision`. |
| **CA-5:** Soporte offline: si no hay conectividad a internet en terreno, los archivos deben almacenarse localmente en IndexedDB y sincronizarse automáticamente en segundo plano al recuperar red. | Cola `outbox` `SUBIR_EVIDENCIA`, `offlineQueue.ts`, `useConnectivity.ts` y Service Worker `public/sw.js`. | `CP-H43-PWA-06`, `CP-H43-PWA-07`, `CP-H43-PWA-08`, `CP-H43-PWA-12`, `BUG-H43-PWA-01`, `BUG-H43-PWA-03`, `BUG-H43-PWA-04`, `BUG-H43-PWA-05` | **Cumplido** | Orden causal `SUBIR_EVIDENCIA` $\to$ `ENVIAR_REPORTE`, preservación de adjuntos locales/errores tras recarga, descarga PDF `data:` offline, propagación de `body.message` en `4xx` y detención limpia ante `401`. |
| **CA-6:** Los adjuntos deben visualizarse inmediatamente en la galería de evidencia del Centro de Mando. | Integración coordinada con `sgrai-api` (`adjunto:creado` + `adjuntos` en `GET /api/misiones/{id}` y `GET /api/incidentes/{id}`) y `sgrai-pwa` (`resolverUrlEvidencia` relativo `/uploads/...`). | `CP-H43-PWA-08`, `BUG-H43-PWA-01`, `BUG-H43-PWA-05` | **Cumplido** | Contraparte `sgrai-api` (`fix(evidencia): resolver observaciones QA de HU-43 (BUG-H43-API-01..06)`) expone adjuntos directos por `incidente_id` en detalle de misión e incidente, reflejado en `api-generated.d.ts`. |
| **CA-7:** El endpoint de subida debe requerir el permiso RBAC `reportes:crear`. | Validado en `AuthContext.tsx`, `CuadrillaMisionDetailPage`, `TerrenoModulosGrid` y endpoint `POST /api/evidencia/adjuntos`. | `CP-H43-PWA-01`, `CP-H43-PWA-11`, `BUG-H43-PWA-06` | **Cumplido** | Control estricto sin fallback implícito en `AuthContext.tsx` y validación `401`/`403` confirmada en servidor. |

---

## 7. Dictamen Final de QA (QA Sign-Off)

**Dictamen:** **APROBADO EN RE-TEST (`Approved`)**  
**Fecha y Hora de Cierre:** `26/11/2026 21:55 -03:00`  
**Responsable:** QA Lead — SGRAI (`sgrai-pwa`)

Tras la ejecución del Re-Test formal sobre el commit `fix(terreno): resolver observaciones QA de HU-43 (BUG-H43-PWA-01..06)` en la rama `feature/h43-adjuntar-evidencia-multimedia`, se certifica la resolución del **100% de los defectos** levantados en la auditoría inicial (`6/6` cerrados: `BUG-H43-PWA-01` a `BUG-H43-PWA-06`), el paso íntegro de los **16 casos de prueba** (`22/22` registros en matriz aprobados) y el estado verde de toda la batería de validación CI (`npm run lint`, `npx tsc --noEmit`, `npm test` con `61/61` suites / `351/351` pruebas y `npm run build` con código de salida `0`).

### Condición Operativa Previa al Merge hacia `develop`

1. **Sincronización con la Ola 3 de `origin/develop`:** La rama `feature/h43-adjuntar-evidencia-multimedia` integró `develop` tras la Ola 2 (`merge: integrar develop (QA H39/H41) en feature/h43-adjuntar-evidencia-multimedia`), encontrándose actualmente por detrás de los `5` commits posteriores de estabilización post-merge de la Ola 3 en `origin/develop` (ajustes en `useConnectivity.ts`, `offlineQueue.ts`, `misionesService.ts` y homologación de eventos `sgrai:*`). Antes de completar el merge del Pull Request hacia `develop`, se debe integrar `origin/develop` en la rama resolviendo eventuales conflictos en esos tres archivos y revalidar el pipeline CI del PR.
2. **Recomendaciones no bloqueantes de mejora continua:** (a) Evaluar en una iteración posterior restringir `reporteTerrenoId` en `misionesService.ts:576-577` exclusivamente a reportes de cierre cuando se inyecte en `EvaluacionReporteCierreCard`; (b) homologar la captura de `__adjuntosLocalesPendientes` en el bloque `catch` de caída súbita de red de `reporteVerificacionService.ts:447` con el flujo `!isOnline`.

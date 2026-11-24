# Auditoría Técnica y Matriz de Casos de Prueba — HU-43: Adjuntar Evidencia Multimedia en Terreno (Cliente PWA `sgrai-pwa`)

**Estándar:** IEEE 829 (Test Plan and Test Results Report)  
**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `feature/h43-adjuntar-evidencia-multimedia`  
**Historia de Usuario:** HU-43 — *"Como Delegado de cuadrilla Quiero adjuntar fotografías, videos y documentos técnicos al incidente y su misión desde el dispositivo móvil. Para respaldar las condiciones del lugar, documentar los trabajos ejecutados y contar con evidencia técnica para la auditoría operativa."*  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `24/11/2026 14:15 -03:00`  
**Fecha y Hora de Re-Test:** `(Pendiente)`  
**Entorno de Ejecución:** Linux, Node.js, Vitest v3.2.7, React Testing Library v16.3.3, JSDOM, Fake IndexedDB v6.2.6, Next.js 16.3.4 (Webpack), TypeScript v5, ESLint v9, PostgreSQL 16 (PostGIS 3.4) / Redis 7  
**Dictamen de Auditoría:** **RECHAZADO EN CODE REVIEW (`Changes Requested` — `6` defectos abiertos: `3` Críticos, `1` Alto, `1` Medio, `1` Bajo; `npx tsc --noEmit` y `npm run build` fallidos)**

---

## 1. Resumen Ejecutivo

La presente auditoría técnica evalúa la implementación de la Historia de Usuario **HU-43** sobre la rama `feature/h43-adjuntar-evidencia-multimedia` del cliente móvil de terreno `sgrai-pwa` (`web-app`). La funcionalidad introduce el módulo `CargaEvidenciaCard`, el servicio multipart y cola offline `evidenciaService.ts`, utilidades de validación y compresión Canvas (`mediaUtils.ts` / `evidencia.ts`), sincronización de adjuntos en `useConnectivity.ts` / `offlineQueue.ts`, la integración en `CuadrillaMisionDetailPage` y su acoplamiento con `EvaluacionReporteCierreCard` (HU-39).

Si bien las pruebas unitarias y de componentes aislados en Vitest (`56` archivos / `270` pruebas totales y `7` archivos / `39` pruebas focalizadas) finalizan en verde y los controles básicos de captura, validación MIME/peso (10 MB), compresión JPEG en Canvas y verificación RBAC (`401`/`403`) responden conforme a especificación, la inspección forense de flujo completo y la compilación productiva evidenciaron **6 defectos reales** (`3` críticos bloqueantes, `1` alto, `1` medio y `1` bajo) que impiden aprobar la integración hacia `develop`:

1. **Bloqueo de compilación CI/CD (`BUG-H43-PWA-02`):** `npx tsc --noEmit` y `npm run build` fallan con error `TS2344` en `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` por firma incompatible de `PageProps.params` y uso condicional del hook `use()`.
2. **Pérdida de evidencia asociada a `incidente_id` tras recarga o sincronización (`BUG-H43-PWA-01`):** En misiones activas de cuadrilla sin reportes previos (`reportesTerreno: []`), `obtenerDetalleMision` descarta cualquier adjunto local con `sincronizacionPendiente: false` (incluyendo los recién sincronizados tras `sgrai:outbox-synced` y los rechazados con `errorSincronizacion`), haciendo desaparecer las evidencias de la vista.
3. **Bloqueo al cerrar verificación con evidencia offline en HU-39 (`BUG-H43-PWA-03`):** `EvaluacionReporteCierreCard` inserta IDs temporales (`local-...`) y Data URLs en `adjuntoIds`/`adjuntos`, provocando fallo de validación Zod (`z.string().uuid()` y `.max(500)`) al enviar el informe técnico de cierre.
4. **Desincronización OpenAPI y bucle `401` en `useConnectivity` (`BUG-H43-PWA-04`):** `src/types/api-generated.d.ts` carece de `/api/evidencia/adjuntos`; `evidenciaService.ts` utiliza tipos escritos a mano y `fetch` directo sin `x-user-id`, mientras `useConnectivity` no gestiona HTTP `401` ni extrae mensajes de error JSON del servidor al fallar `SUBIR_EVIDENCIA`.
5. **Resolución de URLs en móvil y ergonomía (`BUG-H43-PWA-05`):** `resolverUrlEvidencia` antepone `NEXT_PUBLIC_API_URL` en el navegador evadiendo el rewrite `/uploads/:path*`, deshabilita el acceso offline a PDFs (`data:`) y define `.downloadLink` con `36px` de altura (inferior al mínimo táctil de `48px`).
6. **Casos de borde multimedia y trazabilidad documental (`BUG-H43-PWA-06`):** Rechazo de MIME con parámetros de códec (`video/webm;codecs=vp8`), omisión de verificación `blob.size <= 0` post-Canvas, fallback permisivo para `reportes:crear` en `PATRULLA_VERIFICADORA` y marcación anticipada como `APROBADO` de `TC-14` en `docs/qa/matrices/matriz-pruebas-terreno.md`.

| Indicador / Verificación | Resultado en Auditoría Inicial (`24/11/2026`) | Observación Técnica |
|---|---|---|
| Total de casos en matriz (HU-43 PWA) | `22` registros (`6` defectos + `16` casos base) | `6` defectos `ABIERTO`, `3` casos `FALLIDO`, `13` casos `APROBADO` |
| Defectos abiertos por severidad | `3` Crítica, `1` Alta, `1` Media, `1` Baja | Rechazo formal en Code Review hasta subsanación y Re-Test |
| Suite global PWA (`npm test`) | `56` archivos / `270` pruebas (`25.86s`) | 100% aprobadas con mocks de red/IndexedDB |
| Suite focalizada HU-43 (`npx vitest run`) | `7` archivos / `39` pruebas (`4.42s`) | Incluye `mediaUtils`, `evidenciaService`, `CargaEvidenciaCard`, `CuadrillaDetailPage`, `useConnectivity`, `offlineQueue`, `EvaluacionReporteCierreCard` |
| Filtro por etiqueta `npm test -- -t "(H43)"` | `4` archivos / `18` pruebas aprobadas (`12.10s`) | `252` pruebas omitidas por filtro nominal |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `1` advertencia | Warning `@typescript-eslint/no-unused-vars` en `prioridadClase` (`cuadrilla/misiones/[id]/page.tsx:150`) |
| Verificación de tipos (`npx tsc --noEmit`) | **FALLIDO** (exit `2`, `2` errores `TS2344`) | Error de tipo `PageProps` en `.next/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts:39` |
| Build de producción (`npm run build`) | **FALLIDO** (exit `1`) | Compilación Webpack OK (`4.5s`); falla en etapa de typechecking de Next.js 16 |
| Verificación HTTP/cURL en vivo (`:3002` + `:4001`) | Ejecutada | Validados `307`, `/terreno/sw.js`, `/terreno/manifest.webmanifest`, `401`, `403`, `400`, `415` y `GET /api/misiones/{id}` |
| Prohibición de emojis y tipo `any` en módulos H43 | `0` emojis / `0` usos de `any` | Uso exclusivo de `lucide-react` y esquemas tipados |

---

## 2. Registro Técnico de Defectos

### `BUG-H43-PWA-01`: Pérdida de evidencia asociada a `incidente_id` tras sincronización o recarga (`obtenerDetalleMision`), ocultamiento de errores de cola y fallo con `incidenteId` vacío
- **Severidad:** Crítica
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/services/misionesService.ts` (líneas 332–360, 459–461, 497)
  - `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (líneas 80–88, 180–185, 380–388)
  - `src/services/offlineQueue.ts` (líneas 20–41, 468–540)
- **Descripción y Causa Raíz:**
  1. En misiones operativas activas de cuadrilla (`ATENCION_CUADRILLA` en estado `EN_CURSO`), la propiedad `reportesTerreno` retornada por `GET /api/misiones/{id}` viene vacía (`[]`, confirmado en vivo contra `MIS-2026-0002`), por lo que `reporteTerrenoIdMision` es `undefined` y la evidencia cargada desde `CargaEvidenciaCard` se asocia únicamente mediante `incidente_id`.
  2. Dentro de `obtenerDetalleMision` (`src/services/misionesService.ts:332-360`), `adjuntosRemotos` extrae adjuntos **exclusivamente** desde `d.reportesTerreno.flatMap((rep) => rep.adjuntos)`, y `adjuntosPendientesLocales` conserva **exclusivamente** los elementos previos con `item.sincronizacionPendiente === true`.
  3. En consecuencia, todo archivo cargado con `incidente_id` (sin `reporte_terreno_id`):
     - Si se carga **online**, desaparece de la lista al recargar la vista o al dispararse cualquier evento de sincronización (`sgrai:mision-sincronizada`, `visibilitychange`).
     - Si se carga **offline**, al recuperar conectividad `useConnectivity.ts:234-240` reemplaza el temporal marcando `sincronizacionPendiente: false` y en la línea `297` emite `sgrai:outbox-synced`. El listener de `CuadrillaMisionDetailPage:80-88` ejecuta inmediatamente `cargarDetalle()` $\rightarrow$ `obtenerDetalleMision()`, eliminando el adjunto recién sincronizado de `mision.datosAdicionales.adjuntos`.
     - Si la sincronización en segundo plano recibe un rechazo definitivo (`400`, `403`, `413`, `415`), `marcarErrorAdjuntoLocalEnMision` (`offlineQueue.ts:526`) asigna `sincronizacionPendiente: false` junto a `errorSincronizacion`, pero el mismo evento `sgrai:outbox-synced` hace que `obtenerDetalleMision` descarte el elemento antes de que el delegado visualice el badge `.badgeError`.
  4. Adicionalmente, en misiones sin incidente asociado (`PREVENCION` o `RECUPERACION`), `mision.incidenteId` se asigna como cadena vacía `""` (`misionesService.ts:497`), y `CuadrillaMisionDetailPage:383` monta `CargaEvidenciaCard` enviando `incidente_id: ""` a `evidenciaOutboxPayloadSchema.parse`, lo que falla por validación UUID después de comprimir el archivo.
  5. En el plano de integración transversal hacia **CA-6**, `GET /api/misiones/{id}` (`api/src/modules/misiones/mision.repository.ts:374-389`) y `GET /api/incidentes/{id}` (`api/src/modules/incidentes/incidente-kanban.repository.ts:589-608`) tampoco exponen los registros de `adjunto` vinculados únicamente a `incidente_id` (`reporte_terreno_id IS NULL`), impidiendo que la recarga automática en `IncidenteDetalleDrawer` muestre en el Centro de Mando la evidencia subida por la cuadrilla.
- **Impacto:** Pérdida inmediata en pantalla de las fotografías, videos y PDFs cargados por la cuadrilla tras sincronizar o refrescar, imposibilidad de visualizar errores de rechazo en segundo plano y ruptura de visibilidad inmediata en Centro de Mando para adjuntos sin reporte previo.
- **Pasos de Reproducción:**
  1. Iniciar sesión como `DELEGADO_CUADRILLA` y abrir una misión `EN_CURSO` sin reportes previos (`d1000000-0000-4000-8000-000000000002`).
  2. Desactivar conectividad, adjuntar una fotografía en `CargaEvidenciaCard` y verificar el badge `Pendiente offline`.
  3. Restablecer red para disparar `useConnectivity.sincronizar()` $\rightarrow$ `sgrai:outbox-synced` $\rightarrow$ `cargarDetalle()`.
  4. Observar que `adjuntosRemotos` retorna `[]` y `adjuntosCombinados` descarta el archivo recién sincronizado.

---

### `BUG-H43-PWA-02`: Fallo de compilación estática TypeScript (`tsc --noEmit`) y build de producción (`npm run build`) en `CuadrillaMisionDetailPage`
- **Severidad:** Crítica
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (líneas 38–47, 145–151)
  - `src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx` (líneas 80, 101, 118, 182, 192)
- **Descripción y Causa Raíz:**
  `CuadrillaMisionDetailPage` define `interface PageProps { params: Promise<{ id: string }> | { id: string }; }` e invoca `use(params)` de forma condicional dentro de un operador ternario. El generador de tipos de Next.js 16 (`.next/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts:39`) exige estrictamente `params: Promise<any> | undefined`, fallando con error `TS2344`. Asimismo, la variable `prioridadClase` (líneas 146–151) nunca se utiliza en el JSX, produciendo advertencia en ESLint.
- **Impacto:** Bloqueo total del pipeline CI/CD (`npx tsc --noEmit` termina con código `2` y `npm run build` falla con código `1` en fase de typechecking) e imposibilidad de generar la imagen Docker de producción.
- **Pasos de Reproducción:**
  1. Ejecutar `npx tsc --noEmit` o `npm run build` en la raíz de `web-app`.
  2. Verificar error `TS2344` en `.next/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts(39,29)` y advertencia ESLint en línea `150` de `page.tsx`.

---

### `BUG-H43-PWA-03`: Bloqueo del envío del Informe Técnico de Cierre (HU-39) al adjuntar evidencia offline y pérdida de estado/visualización en `EvaluacionReporteCierreCard`
- **Severidad:** Crítica
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/components/misiones/EvaluacionReporteCierreCard.tsx` (líneas 96–102, 259–330, 599–627)
  - `src/services/evidenciaService.ts` (líneas 64–69, 171–179)
  - `src/lib/validations/reporteVerificacion.ts` (líneas 29–35, 81–90)
- **Descripción y Causa Raíz:**
  1. Al cargar evidencia dentro de `EvaluacionReporteCierreCard` sin conexión, `subirEvidenciaMultimedia` asigna un identificador local no UUID (`local-${crypto.randomUUID()}`) y coloca la cadena Base64 (`data:...`) en `adjunto.url`.
  2. El callback `alAdjuntarEvidencia` (`EvaluacionReporteCierreCard.tsx:610-625`) incorpora directamente ese `adjunto.id` a `form.adjuntoIds` y `{ id, url, ... }` a `form.adjuntos`.
  3. Al confirmar el envío del informe, `enviarReporteVerificacionTerreno` invoca `crearReporteVerificacionSchema.parse(input)` (`reporteVerificacion.ts:30,32,82`), que exige formato UUID estricto en `adjuntoIds` / `adjuntos[].id` y longitud máxima de `500` caracteres en `adjuntos[].url`, abortando la operación con excepción Zod.
  4. Adicionalmente, `adjuntosEvidencia` se inicializa solo una vez en `useState(() => extraerAdjuntosDeMision(misionActual))` (`línea 96`) sin `useEffect` que sincronice cambios de `misionActual` tras `sgrai:outbox-synced`; la vista de resumen `yaEnviado === true` (`líneas 259–330`) omite renderizar los adjuntos del reporte cerrado; y `reporteTerrenoIdActual` (`líneas 99–102`) toma `reportesRemotos[0].id`, que corresponde al reporte previo de prioridad (HU-38) y no al informe de cierre.
- **Impacto:** Un operador de patrulla que tome fotografías offline dentro del paso 3 no puede enviar ni encolar el informe técnico de verificación para cerrar la misión; las misiones cerradas ocultan la evidencia en la vista de resumen.
- **Pasos de Reproducción:**
  1. En `PatrullaMisionDetailPage`, abrir paso 3 (`EvaluacionReporteCierreCard`) con `navigator.onLine = false`.
  2. Adjuntar una fotografía mediante `CargaEvidenciaCard` (genera `id: "local-..."` y `url: "data:image/jpeg;base64,..."`).
  3. Completar resumen técnico ($\ge 10$ caracteres) y confirmar envío del reporte.
  4. Observar rechazo de `crearReporteVerificacionSchema.parse` por UUID inválido y URL mayor a 500 caracteres.

---

### `BUG-H43-PWA-04`: Desincronización del contrato OpenAPI (`api-generated.d.ts`), omisión de `x-user-id` y bucle infinito sin manejo de HTTP `401` en `useConnectivity`
- **Severidad:** Alta
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/types/api-generated.d.ts` (ausencia de `/api/evidencia/adjuntos` y `AdjuntoCreadoResponse`)
  - `src/services/evidenciaService.ts` (líneas 38–55, 220–229)
  - `src/hooks/useConnectivity.ts` (líneas 63–81, 111–120, 222–251)
- **Descripción y Causa Raíz:**
  1. `src/types/api-generated.d.ts` no fue regenerado desde `sgrai-api` (que ya registra `POST /api/evidencia/adjuntos` en `../api/src/lib/openapi/index.ts:2772`), incumpliendo la regla de contratos tipados de `AGENTS.md §3`. En su lugar, `evidenciaService.ts:38-55` declara la interfaz manual `RespuestaAdjuntoApi` y utiliza `fetch` directo omitiendo `apiClient` (`src/lib/api/client.ts`).
  2. Tanto `evidenciaService.ts` como `useConnectivity.ts` omiten inyectar la cabecera `x-user-id` extraída del JWT.
  3. En `useConnectivity.ts` (`líneas 111–120` y `222–251`), el código HTTP `401` no se maneja mediante `handleUnauthorizedSession()` ni detiene el ciclo: si el token expira mientras el dispositivo está offline, el temporizador de `15s` reintenta indefinidamente `SUBIR_EVIDENCIA` (incrementando `intentos` sin límite) sin redirigir a `/terreno/login`.
  4. Ante errores definitivos (`400`/`403`/`413`/`415`), `useConnectivity.ts:248` llama a `extraerMensajeErrorHttp(res.status)` sin leer el campo `message` del cuerpo JSON retornado por el backend.
- **Impacto:** Degradación de contratos OpenAPI, ausencia de cierre de sesión ante token expirado durante sincronización en segundo plano y pérdida del detalle de error del servidor al fallar una subida en cola.

---

### `BUG-H43-PWA-05`: Resolución directa de `NEXT_PUBLIC_API_URL` en navegador evadiendo rewrite `/uploads/:path*`, enlace PDF deshabilitado offline y área táctil de `36px`
- **Severidad:** Media
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/components/misiones/CargaEvidenciaCard.tsx` (líneas 39–52, 75–124, 267–268, 326–336)
  - `src/components/misiones/CargaEvidenciaCard.module.css` (línea 272)
- **Descripción y Causa Raíz:**
  1. A diferencia de `client.ts`, `evidenciaService.ts` y `useConnectivity.ts` (que retornan cadena vacía en navegador para utilizar los rewrites de `next.config.ts`), `resolverUrlEvidencia` (`CargaEvidenciaCard.tsx:49-51`) antepone `process.env.NEXT_PUBLIC_API_URL` en el navegador. Si `NEXT_PUBLIC_API_URL` está configurada con una URL local (`http://localhost:4001`) o interna de contenedor (`http://api:4001`), dispositivos móviles conectados por LAN o HTTPS intentarán resolver un origen inaccesible o bloqueado por *Mixed Content*, rompiendo la carga de miniaturas, videos y PDFs pese a existir el rewrite `/uploads/:path*`.
  2. La guarda `esUrlDescargable = item.url.startsWith('/uploads/') || item.url.startsWith('http')` (`líneas 267–268`) omite URLs `data:application/pdf;base64,...`, impidiendo abrir o descargar un PDF mientras permanece en cola offline.
  3. La regla `.downloadLink` (`CargaEvidenciaCard.module.css:272`) establece `min-height: 36px`, por debajo del objetivo táctil mínimo institucional de `48px` (`AGENTS.md §2`).
  4. En cargas múltiples (`multiple`), `procesarArchivos` sobrescribe `errorMensaje` y `estadoMensaje` dentro del ciclo `for` en lugar de consolidar resultados por archivo.
- **Impacto:** Ruptura potencial de visualización multimedia en terreno sobre HTTPS/Docker cuando `NEXT_PUBLIC_API_URL` está definida, imposibilidad de revisar PDFs adjuntos offline y objetivo táctil reducido para uso con guantes.

---

### `BUG-H43-PWA-06`: Validación rígida de MIME con parámetros de códec, ausencia de control `blob.size <= 0` post-Canvas, fallback RBAC permisivo y desfase en matriz global
- **Severidad:** Baja
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/lib/utils/mediaUtils.ts` (líneas 67–90, 172–181, 212–217)
  - `src/context/AuthContext.tsx` (líneas 256–264)
  - `docs/qa/matrices/matriz-pruebas-terreno.md` (línea 27)
- **Descripción y Causa Raíz:**
  1. `esMimePermitidoEvidencia` realiza comparación exacta contra `MIME_PERMITIDOS_EVIDENCIA`; navegadores móviles que reportan parámetros de códec (`video/webm;codecs=vp8`) o MIME vacío `""` en ciertos contenedores `.mov` son rechazados en cliente. Además, `prepararEvidenciaParaSubida` (`línea 215`) valida `blob.size > MAX_BYTES_EVIDENCIA` tras `comprimirImagenEnCliente`, pero omite verificar `blob.size <= 0` si Canvas retorna un Data URL vacío (`data:,`).
  2. En `AuthContext.tsx:259-261`, `tienePermiso('reportes:crear')` retorna `true` implícitamente para `PATRULLA_VERIFICADORA` si posee `misiones:terreno:verificar`, pudiendo habilitar controles de subida en UI aun si el permiso `reportes:crear` fuese revocado en base de datos.
  3. En `docs/qa/matrices/matriz-pruebas-terreno.md:27`, el caso `TC-14 (H43)` figura en estado `APROBADO` antes del cierre formal de auditoría QA.
- **Impacto:** Falsos rechazos en ciertos dispositivos móviles ante parámetros de códec y discrepancia documental en la matriz general de terreno.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|:---:|:---:|---|
| `BUG-H43-PWA-01` | Pérdida de evidencia asociada a incidente_id tras sincronización o recarga (obtenerDetalleMision), ocultamiento de errores y falla con incidenteId vacío | Funcional / Offline-First | Servicio / Integración / API | Crítica | Misión activa `ATENCION_CUADRILLA` (`d1000000-...-0002`, `reportesTerreno: []`) o `PREVENCION` sin incidente | Carga online/offline con `incidente_id`, disparo de `sgrai:outbox-synced` o recarga vía `obtenerDetalleMision`, y rechazo `415` en background | Conservar adjuntos sincronizados y con `errorSincronizacion` en `datosAdicionales.adjuntos`, exponer adjuntos por `incidente_id` en detalle y normalizar `incidenteId` vacío | `obtenerDetalleMision` filtra solo `sincronizacionPendiente: true` sobre `adjuntosPrevios` y solo lee `reportesTerreno` (`[]`), borrando adjuntos sincronizados o con error al ejecutarse `sgrai:outbox-synced` | ABIERTO | 24/11/2026 14:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-PWA-02` | Fallo de verificación de tipos TypeScript (tsc --noEmit) y build productivo (npm run build) en CuadrillaMisionDetailPage | Compilación / Estática | Sistema / CI | Crítica | Rama `feature/h43-adjuntar-evidencia-multimedia` con `CuadrillaMisionDetailPage` y `CuadrillaDetailPage.test.tsx` | Comandos `npx tsc --noEmit`, `npm run build` y `npm run lint` | `0` errores TypeScript (`Promise<{ id: string }>`), `0` advertencias ESLint y build productivo limpio con exit `0` | Falla con 2 errores `TS2344` en `.next/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts:39` (`params` incompatible con `Promise<any>`), abortando `npm run build`; 1 warning `prioridadClase` sin uso en ESLint | ABIERTO | 24/11/2026 14:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-PWA-03` | Bloqueo de envío del Informe Técnico de Cierre (H39) con evidencia offline en EvaluacionReporteCierreCard e inconsistencia en vista resumen | Funcional / Integración | Componente / Validación | Crítica | Patrulla verificadora en Paso 3 (`EvaluacionReporteCierreCard`) bajo modo offline (`navigator.onLine = false`) | Adjunto offline (`id: "local-<uuid>"`, `url: "data:image/jpeg;base64,..."`) seguido de confirmación en `EvaluacionReporteCierreCard` | Filtrar/diferir IDs `local-*` y URLs `data:`, sincronizar estado de `adjuntosEvidencia` ante `misionActual` y mostrar adjuntos en vista resumen `yaEnviado` | `alAdjuntarEvidencia` inserta `local-*` y `data:...` en `form.adjuntoIds`/`form.adjuntos`, fallando `crearReporteVerificacionSchema.parse` (`.uuid()` / `.max(500)`); vista `yaEnviado` omite los adjuntos | ABIERTO | 24/11/2026 14:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-PWA-04` | Desincronización de OpenAPI (api-generated.d.ts), tipos manuales, omisión de x-user-id y bucle 401 sin manejo de mensaje en useConnectivity | Contrato / Seguridad / Sync | Servicio / Hook | Alta | Especificación OpenAPI con `/api/evidencia/adjuntos` en `sgrai-api` y sesión JWT expirada durante cola `outbox` | Revisión de `api-generated.d.ts`, `evidenciaService.ts` (`RespuestaAdjuntoApi`) y `useConnectivity.ts` ante HTTP `401` y `400`/`415` | Tipos derivados de `api-generated.d.ts`, uso de `apiClient` / `x-user-id`, cierre de sesión ante `401` y extracción de `body.message` en `4xx` | `/api/evidencia/adjuntos` ausente en `api-generated.d.ts`; `fetch` directo sin `x-user-id`; `useConnectivity` reintenta indefinidamente `401` cada `15s` y omite `bodyErr.message` en `4xx` | ABIERTO | 24/11/2026 14:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-PWA-05` | Bypass de rewrite /uploads/:path* por NEXT_PUBLIC_API_URL en navegador, PDF offline sin enlace y objetivo táctil < 48px | UI / Ergonomía / Red | Componente / CSS | Media | `CargaEvidenciaCard` montado en navegador con `NEXT_PUBLIC_API_URL` configurada o PDF adjunto offline | `resolverUrlEvidencia('/uploads/evidencia/foto.webp')`, PDF con `url: "data:application/pdf;base64,..."` e inspección CSS `.downloadLink` | Resolver `/uploads/...` relativo vía rewrite en navegador, habilitar descarga de PDF offline, `.downloadLink >= 48px` y acumular errores múltiples | `resolverUrlEvidencia` concatena `NEXT_PUBLIC_API_URL` en navegador; `esUrlDescargable` excluye `data:`; `.downloadLink` tiene `min-height: 36px`; `procesarArchivos` sobrescribe error previo | ABIERTO | 24/11/2026 14:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H43-PWA-06` | Validación rígida de MIME con parámetros de códec, ausencia de control blob.size <= 0 post-Canvas, fallback RBAC y matriz global prematura | Validación / RBAC / Docs | Utilidad / Contexto | Baja | Archivo `video/webm;codecs=vp8`, fallo Canvas (`blob.size === 0`) y usuario `PATRULLA_VERIFICADORA` sin `reportes:crear` | `validarArchivoEvidencia`, `prepararEvidenciaParaSubida`, `AuthContext.tienePermiso('reportes:crear')` y `matriz-pruebas-terreno.md:27` | Aceptar MIME base con parámetros de códec, rechazar `blob.size <= 0`, exigir `reportes:crear` explícito y alinear estado QA en matriz global | `esMimePermitidoEvidencia` exige coincidencia literal exacta; `prepararEvidenciaParaSubida` no verifica `blob.size <= 0`; `AuthContext` otorga fallback implícito; `TC-14` figura `APROBADO` prematuramente | ABIERTO | 24/11/2026 14:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H43-PWA-01` | Visibilidad condicional del módulo Evidencia Multimedia en CuadrillaMisionDetailPage según estado activo y permiso RBAC reportes:crear | Funcional / RBAC (CA-1, CA-7) | Componente / Integración | Crítica | `CuadrillaMisionDetailPage` con usuario `DELEGADO_CUADRILLA` y `unidadActiva: true` | Misión `EN_CURSO` con permiso `reportes:crear` vs misión `DESPACHADA` sin `reportes:crear` | Renderiza `CargaEvidenciaCard` con botones de captura solo en faena activa con permiso `reportes:crear`; oculto en `DESPACHADA` o sin permiso | Verificado en `CuadrillaDetailPage.test.tsx` (`5/5` tests en verde, `706ms`) | APROBADO | 24/11/2026 14:15 | N/A | test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43) |
| `CP-H43-PWA-02` | Presencia de controles de captura directa desde cámara (Tomar Foto, Grabar Video) y selector múltiple Galería / PDF | Funcional / UI (CA-2) | Componente | Alta | `CargaEvidenciaCard` montado en modo editable (`soloLectura: false`) | Inspección de `input-captura-foto`, `input-captura-video` e `input-seleccion-archivo` | Botones táctiles visibles; inputs de cámara con `capture="environment"` y `accept` específicos; selector general con `multiple` | Verificado en `CargaEvidenciaCard.test.tsx` (`renderiza botones de captura fotográfica...`, `365ms`) | APROBADO | 24/11/2026 14:15 | N/A | test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43) |
| `CP-H43-PWA-03` | Validación estricta de tipos MIME autorizados, archivos vacíos (0 bytes) y límite máximo de 10 MB en cliente | Validación (CA-3) | Unidad / Componente | Crítica | Utilidad `validarArchivoEvidencia` y `CargaEvidenciaCard` | Archivos `JPEG`, `PNG`, `WebP`, `MP4`, `WebM`, `MOV`, `PDF`; inválidos `image/gif`, `text/plain`; `0 B` y `10 MB + 1 byte` | Acepta los 7 formatos válidos dentro de 10 MB; bloquea antes de invocar subida los MIME no permitidos, vacíos y mayores a 10 MB | `mediaUtils.test.ts` (`4/4` en `validarArchivoEvidencia`) y `CargaEvidenciaCard.test.tsx` aprueban mostrando `role="alert"` sin invocar servicio | APROBADO | 24/11/2026 14:15 | N/A | feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43) |
| `CP-H43-PWA-04` | Compresión de imágenes en cliente mediante Canvas a JPEG <= 1280px y preservación íntegra de videos y documentos PDF | Funcional / Optimización | Unidad | Alta | `prepararEvidenciaParaSubida` con mocks de `Canvas`, `FileReader` e `Image` (2560x1440) | `evidencia.png` (`image/png`), `inspeccion.mp4` (`video/mp4`) y `acta.pdf` (`application/pdf`) | Redimensiona imagen manteniendo relación de aspecto a `1280x720` JPEG (`.jpg`); mantiene intactos MP4 y PDF sin compresión | Verificado en `mediaUtils.test.ts` (`8/8` tests en verde, `22ms`) | APROBADO | 24/11/2026 14:15 | N/A | feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43) |
| `CP-H43-PWA-05` | Construcción y envío de FormData multipart online hacia POST /api/evidencia/adjuntos con incidente_id y retorno de DTO del servidor | Funcional / Integración (CA-4) | Servicio | Crítica | `navigator.onLine = true`, `fetch` mockeado con HTTP `201 Created` | `subirEvidenciaMultimedia({ archivo: video.mp4, misionId, incidenteId })` | Envía `POST /api/evidencia/adjuntos` con `FormData` (`file`, `incidente_id`), notifica progreso `100%` y retorna URL definitiva sin usar `outbox` | Verificado en `evidenciaService.test.ts` (`sube multipart FormData online...`, `outbox` vacío) | APROBADO | 24/11/2026 14:15 | N/A | feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43) |
| `CP-H43-PWA-06` | Encolamiento offline en IndexedDB (outbox SUBIR_EVIDENCIA) sin sobrescritura de múltiples archivos y rechazo sin encolar ante 413/415 | Offline-First / Persistencia (CA-5) | Servicio / IndexedDB | Crítica | `navigator.onLine = false` o respuesta HTTP `415` en `subirEvidenciaMultimedia` | Carga de `video1.mp4` y `video2.mp4` offline; respuesta `415` online | Encola ambos adjuntos independientes en `outbox` (`SUBIR_EVIDENCIA`) validados por Zod; ante `415` lanza `EvidenciaServiceError` sin encolar | Verificado en `evidenciaService.test.ts` (`4/4` tests en verde, `71ms`) y `offlineQueue.ts:350` | APROBADO | 24/11/2026 14:15 | N/A | feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43) |
| `CP-H43-PWA-07` | Sincronización diferida de SUBIR_EVIDENCIA en useConnectivity mediante FormData y manejo terminal de HTTP 415 | Offline-First / Sincronización (CA-5) | Hook / Servicio | Crítica | Acción `SUBIR_EVIDENCIA` encolada y retorno de conectividad (`navigator.onLine = true`) | `useConnectivity.sincronizar()` con respuesta mock HTTP `415` | Reconstruye `Blob` desde `dataUrl`, envía `FormData` multipart, marca error en adjunto local y remueve ítem bloqueante de `outbox` | Verificado en `useConnectivity.test.ts` (`5/5` tests en verde, `140ms`) | APROBADO | 24/11/2026 14:15 | N/A | feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43) |
| `CP-H43-PWA-08` | Persistencia y visualización continua en galería de misión tras recarga de página o disparo de sgrai:outbox-synced para adjuntos con incidente_id | Funcional / Resiliencia (CA-4, CA-5) | Integración / Servicio | Crítica | Misión activa `ATENCION_CUADRILLA` (`MIS-2026-0002`, `reportesTerreno: []`) con adjunto cargado por `incidente_id` | Subida online u offline + disparo de `sgrai:outbox-synced` / `obtenerDetalleMision(id)` | El adjunto sincronizado permanece visible en la galería con badge `Sincronizado` tras recargar detalle desde API | Falla por `BUG-H43-PWA-01`: `obtenerDetalleMision` sobrescribe `adjuntos` desde `reportesTerreno` (`[]`) descartando ítems locales sincronizados | FALLIDO | 24/11/2026 14:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H43-PWA-09` | Integración de carga de evidencia multimedia dentro de EvaluacionReporteCierreCard (H39) en modo online y offline | Funcional / Integración | Componente / Validación | Crítica | Patrulla en Paso 3 (`EvaluacionReporteCierreCard`) con permiso `reportes:crear` | Renderizado del componente en modo editable, adjunto offline y envío del informe de cierre | Permite adjuntar evidencia online/offline sin bloquear la validación Zod ni ocultar adjuntos tras cierre del reporte | Falla en flujo offline por `BUG-H43-PWA-03` (`id: "local-..."` viola `.uuid()` y `dataUrl` excede `.max(500)` en `crearReporteVerificacionSchema`) | FALLIDO | 24/11/2026 14:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H43-PWA-10` | Previsualización en interfaz de miniaturas de imagen, reproductor de video y tarjeta de documento PDF con badges de estado | Funcional / UI | Componente | Alta | `CargaEvidenciaCard` con arreglo de `AdjuntoLocal` (`image/webp`, `video/mp4`, `application/pdf`) | Items con `sincronizacionPendiente: false` y `true` | Renderiza `<img>` con `alt`, `<video controls>`, tarjeta PDF con enlace `Ver PDF` y badges `Sincronizado` / `Pendiente offline` | Verificado en `CargaEvidenciaCard.test.tsx` (`5/5` tests en verde, `600ms`) | APROBADO | 24/11/2026 14:15 | N/A | fix(terreno): mejorar feedback de validacion al enviar reporte de cierre y resolver URLs de evidencia contra NEXT_PUBLIC_API_URL |
| `CP-H43-PWA-11` | Verificación en vivo de endpoint POST /api/evidencia/adjuntos vía proxy PWA: RBAC (401/403), asociación (400) y MIME/magic bytes (415) | Seguridad / Contrato API (CA-3, CA-7) | Sistema / HTTP | Crítica | Servidores `sgrai-api` (`:4001`) y `sgrai-pwa` (`:3002`) activos contra PostgreSQL | Peticiones `curl` sin token, con JWT `CALL_CENTER`, con JWT `DELEGADO_CUADRILLA` sin IDs, con `text/plain` y con `image/jpeg` falsificado | Retorna `401` sin Bearer, `403` (`reportes:crear`) para `CALL_CENTER`, `400` sin IDs y `415` ante MIME o firma binaria inválida | Confirmado en vivo vía `http://localhost:3002/api/evidencia/adjuntos` (`401`, `403`, `400`, `415`, `415` magic bytes) | APROBADO | 24/11/2026 14:19 | N/A | feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43) |
| `CP-H43-PWA-12` | Protección perimetral SSR en ruta de cuadrilla (307), cabeceras de Service Worker (/terreno/sw.js) y manifiesto PWA | Seguridad / Infraestructura PWA | Sistema / HTTP | Alta | Servidor `sgrai-pwa` ejecutándose en `:3002` sin cookie `sgrai_auth_token` | `GET /terreno/cuadrilla/misiones/d1000000-...-0002`, `HEAD /terreno/sw.js` y `GET /terreno/manifest.webmanifest` | Redirección `307` a `/terreno/login?returnUrl=...`; `/terreno/sw.js` con `Service-Worker-Allowed: /terreno` y `200 OK`; manifiesto JSON válido `200 OK` | Confirmado en vivo con `curl`: `307 Temporary Redirect`, `sw.js` `200 OK` (`2998` bytes) y `manifest.webmanifest` `200 OK` | APROBADO | 24/11/2026 14:19 | N/A | feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43) |
| `CP-H43-PWA-13` | Cumplimiento de diseño institucional Flat UI (border-radius: 0), iconografía lucide-react, ausencia de emojis y cero uso de any | Calidad UI / Estándares | Estática | Media | Código fuente en rama `feature/h43-adjuntar-evidencia-multimedia` | Búsqueda regex Unicode de emojis, inspección de `\bany\b` y CSS `CargaEvidenciaCard.module.css` | Cero emojis en UI, cero declaraciones `any`, esquinas rectas a `0px` y uso exclusivo de `lucide-react` | `NO_EMOJIS`, `NO_ANY_FOUND` y `border-radius: 0` verificados en todos los módulos H43 | APROBADO | 24/11/2026 14:15 | N/A | test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43) |
| `CP-H43-PWA-14` | Compilación TypeScript estricta (npx tsc --noEmit), análisis ESLint (npm run lint) y empaquetado Next.js (npm run build) | Compilación / Calidad | Sistema / CI | Crítica | Repositorio `web-app` limpio en rama evaluada | Ejecución de `npx tsc --noEmit`, `npm run lint` y `npm run build` | Compilación limpia (`exit 0`) en las tres herramientas sin errores de tipos ni warnings | `npm run lint` pasa con `1` warning; `tsc --noEmit` (`exit 2`) y `npm run build` (`exit 1`) fallan por `BUG-H43-PWA-02` | FALLIDO | 24/11/2026 14:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H43-PWA-15` | Ejecución de suite automatizada completa (270 tests) y subconjunto focalizado HU-43 (39 tests) en Vitest y React Testing Library | Automatización | Unit / Component / Service | Alta | Entorno Vitest v3.2.7 + JSDOM + `fake-indexeddb` | `npm test`, suite focalizada de 7 archivos y `npm test -- -t "(H43)"` | `100%` de las pruebas unitarias y de componentes existentes aprueban sin fallos | `56/56` archivos (`270/270` tests) en global, `7/7` (`39/39`) en focalizada y `4/4` (`18` tests) bajo `-t "(H43)"` | APROBADO | 24/11/2026 14:21 | N/A | test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43) |
| `CP-H43-PWA-16` | Revisión del manual de usuario H43-adjuntar-evidencia-multimedia.md y contrato docs/api/contratos-terreno.md | Documentación | Documentación | Media | Archivos `docs/manuals/H43-adjuntar-evidencia-multimedia.md` y `docs/api/contratos-terreno.md` | Verificación de estructura obligatoria (`AGENTS.md §5`: Comportamiento sin conexión y Permisos del dispositivo) | Manual y contrato presentes con secciones offline, permisos de cámara/micrófono/almacenamiento y especificación multipart | Manual `H43` (`57` líneas) y contrato sección `2.2` presentes y conformes a estructura normativa | APROBADO | 24/11/2026 14:15 | N/A | docs(evidencia): agregar manual de usuario, contrato API y matriz QA (H43) |

---

## 4. Bloque TSV para Hoja de Cálculo

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H43-PWA-01	Pérdida de evidencia asociada a incidente_id tras sincronización o recarga (obtenerDetalleMision), ocultamiento de errores y falla con incidenteId vacío	Funcional / Offline-First	Servicio / Integración / API	Crítica	Misión activa ATENCION_CUADRILLA (d1000000-...-0002, reportesTerreno: []) o PREVENCION sin incidente	Carga online/offline con incidente_id, disparo de sgrai:outbox-synced o recarga vía obtenerDetalleMision, y rechazo 415 en background	Conservar adjuntos sincronizados y con errorSincronizacion en datosAdicionales.adjuntos, exponer adjuntos por incidente_id en detalle y normalizar incidenteId vacío	obtenerDetalleMision filtra solo sincronizacionPendiente: true sobre adjuntosPrevios y solo lee reportesTerreno ([]), borrando adjuntos sincronizados o con error al ejecutarse sgrai:outbox-synced	ABIERTO	24/11/2026 14:15	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-PWA-02	Fallo de verificación de tipos TypeScript (tsc --noEmit) y build productivo (npm run build) en CuadrillaMisionDetailPage	Compilación / Estática	Sistema / CI	Crítica	Rama feature/h43-adjuntar-evidencia-multimedia con CuadrillaMisionDetailPage y CuadrillaDetailPage.test.tsx	Comandos npx tsc --noEmit, npm run build y npm run lint	0 errores TypeScript (Promise<{ id: string }>), 0 advertencias ESLint y build productivo limpio con exit 0	Falla con 2 errores TS2344 en .next/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts:39 (params incompatible con Promise<any>), abortando npm run build; 1 warning prioridadClase sin uso en ESLint	ABIERTO	24/11/2026 14:15	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-PWA-03	Bloqueo de envío del Informe Técnico de Cierre (H39) con evidencia offline en EvaluacionReporteCierreCard e inconsistencia en vista resumen	Funcional / Integración	Componente / Validación	Crítica	Patrulla verificadora en Paso 3 (EvaluacionReporteCierreCard) bajo modo offline (navigator.onLine = false)	Adjunto offline (id: "local-<uuid>", url: "data:image/jpeg;base64,...") seguido de confirmación en EvaluacionReporteCierreCard	Filtrar/diferir IDs local-* y URLs data:, sincronizar estado de adjuntosEvidencia ante misionActual y mostrar adjuntos en vista resumen yaEnviado	alAdjuntarEvidencia inserta local-* y data:... en form.adjuntoIds/form.adjuntos, fallando crearReporteVerificacionSchema.parse (.uuid() / .max(500)); vista yaEnviado omite los adjuntos	ABIERTO	24/11/2026 14:15	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-PWA-04	Desincronización de OpenAPI (api-generated.d.ts), tipos manuales, omisión de x-user-id y bucle 401 sin manejo de mensaje en useConnectivity	Contrato / Seguridad / Sync	Servicio / Hook	Alta	Especificación OpenAPI con /api/evidencia/adjuntos en sgrai-api y sesión JWT expirada durante cola outbox	Revisión de api-generated.d.ts, evidenciaService.ts (RespuestaAdjuntoApi) y useConnectivity.ts ante HTTP 401 y 400/415	Tipos derivados de api-generated.d.ts, uso de apiClient / x-user-id, cierre de sesión ante 401 y extracción de body.message en 4xx	/api/evidencia/adjuntos ausente en api-generated.d.ts; fetch directo sin x-user-id; useConnectivity reintenta indefinidamente 401 cada 15s y omite bodyErr.message en 4xx	ABIERTO	24/11/2026 14:15	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-PWA-05	Bypass de rewrite /uploads/:path* por NEXT_PUBLIC_API_URL en navegador, PDF offline sin enlace y objetivo táctil < 48px	UI / Ergonomía / Red	Componente / CSS	Media	CargaEvidenciaCard montado en navegador con NEXT_PUBLIC_API_URL configurada o PDF adjunto offline	resolverUrlEvidencia('/uploads/evidencia/foto.webp'), PDF con url: "data:application/pdf;base64,..." e inspección CSS .downloadLink	Resolver /uploads/... relativo vía rewrite en navegador, habilitar descarga de PDF offline, .downloadLink >= 48px y acumular errores múltiples	resolverUrlEvidencia concatena NEXT_PUBLIC_API_URL en navegador; esUrlDescargable excluye data:; .downloadLink tiene min-height: 36px; procesarArchivos sobrescribe error previo	ABIERTO	24/11/2026 14:15	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H43-PWA-06	Validación rígida de MIME con parámetros de códec, ausencia de control blob.size <= 0 post-Canvas, fallback RBAC y matriz global prematura	Validación / RBAC / Docs	Utilidad / Contexto	Baja	Archivo video/webm;codecs=vp8, fallo Canvas (blob.size === 0) y usuario PATRULLA_VERIFICADORA sin reportes:crear	validarArchivoEvidencia, prepararEvidenciaParaSubida, AuthContext.tienePermiso('reportes:crear') y matriz-pruebas-terreno.md:27	Aceptar MIME base con parámetros de códec, rechazar blob.size <= 0, exigir reportes:crear explícito y alinear estado QA en matriz global	esMimePermitidoEvidencia exige coincidencia literal exacta; prepararEvidenciaParaSubida no verifica blob.size <= 0; AuthContext otorga fallback implícito; TC-14 figura APROBADO prematuramente	ABIERTO	24/11/2026 14:15	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H43-PWA-01	Visibilidad condicional del módulo Evidencia Multimedia en CuadrillaMisionDetailPage según estado activo y permiso RBAC reportes:crear	Funcional / RBAC (CA-1, CA-7)	Componente / Integración	Crítica	CuadrillaMisionDetailPage con usuario DELEGADO_CUADRILLA y unidadActiva: true	Misión EN_CURSO con permiso reportes:crear vs misión DESPACHADA sin reportes:crear	Renderiza CargaEvidenciaCard con botones de captura solo en faena activa con permiso reportes:crear; oculto en DESPACHADA o sin permiso	Verificado en CuadrillaDetailPage.test.tsx (5/5 tests en verde, 706ms)	APROBADO	24/11/2026 14:15	N/A	test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43)
CP-H43-PWA-02	Presencia de controles de captura directa desde cámara (Tomar Foto, Grabar Video) y selector múltiple Galería / PDF	Funcional / UI (CA-2)	Componente	Alta	CargaEvidenciaCard montado en modo editable (soloLectura: false)	Inspección de input-captura-foto, input-captura-video e input-seleccion-archivo	Botones táctiles visibles; inputs de cámara con capture="environment" y accept específicos; selector general con multiple	Verificado en CargaEvidenciaCard.test.tsx (renderiza botones de captura fotográfica..., 365ms)	APROBADO	24/11/2026 14:15	N/A	test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43)
CP-H43-PWA-03	Validación estricta de tipos MIME autorizados, archivos vacíos (0 bytes) y límite máximo de 10 MB en cliente	Validación (CA-3)	Unidad / Componente	Crítica	Utilidad validarArchivoEvidencia y CargaEvidenciaCard	Archivos JPEG, PNG, WebP, MP4, WebM, MOV, PDF; inválidos image/gif, text/plain; 0 B y 10 MB + 1 byte	Acepta los 7 formatos válidos dentro de 10 MB; bloquea antes de invocar subida los MIME no permitidos, vacíos y mayores a 10 MB	mediaUtils.test.ts (4/4 en validarArchivoEvidencia) y CargaEvidenciaCard.test.tsx aprueban mostrando role="alert" sin invocar servicio	APROBADO	24/11/2026 14:15	N/A	feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43)
CP-H43-PWA-04	Compresión de imágenes en cliente mediante Canvas a JPEG <= 1280px y preservación íntegra de videos y documentos PDF	Funcional / Optimización	Unidad	Alta	prepararEvidenciaParaSubida con mocks de Canvas, FileReader e Image (2560x1440)	evidencia.png (image/png), inspeccion.mp4 (video/mp4) y acta.pdf (application/pdf)	Redimensiona imagen manteniendo relación de aspecto a 1280x720 JPEG (.jpg); mantiene intactos MP4 y PDF sin compresión	Verificado en mediaUtils.test.ts (8/8 tests en verde, 22ms)	APROBADO	24/11/2026 14:15	N/A	feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43)
CP-H43-PWA-05	Construcción y envío de FormData multipart online hacia POST /api/evidencia/adjuntos con incidente_id y retorno de DTO del servidor	Funcional / Integración (CA-4)	Servicio	Crítica	navigator.onLine = true, fetch mockeado con HTTP 201 Created	subirEvidenciaMultimedia({ archivo: video.mp4, misionId, incidenteId })	Envía POST /api/evidencia/adjuntos con FormData (file, incidente_id), notifica progreso 100% y retorna URL definitiva sin usar outbox	Verificado en evidenciaService.test.ts (sube multipart FormData online..., outbox vacío)	APROBADO	24/11/2026 14:15	N/A	feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43)
CP-H43-PWA-06	Encolamiento offline en IndexedDB (outbox SUBIR_EVIDENCIA) sin sobrescritura de múltiples archivos y rechazo sin encolar ante 413/415	Offline-First / Persistencia (CA-5)	Servicio / IndexedDB	Crítica	navigator.onLine = false o respuesta HTTP 415 en subirEvidenciaMultimedia	Carga de video1.mp4 y video2.mp4 offline; respuesta 415 online	Encola ambos adjuntos independientes en outbox (SUBIR_EVIDENCIA) validados por Zod; ante 415 lanza EvidenciaServiceError sin encolar	Verificado en evidenciaService.test.ts (4/4 tests en verde, 71ms) y offlineQueue.ts:350	APROBADO	24/11/2026 14:15	N/A	feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43)
CP-H43-PWA-07	Sincronización diferida de SUBIR_EVIDENCIA en useConnectivity mediante FormData y manejo terminal de HTTP 415	Offline-First / Sincronización (CA-5)	Hook / Servicio	Crítica	Acción SUBIR_EVIDENCIA encolada y retorno de conectividad (navigator.onLine = true)	useConnectivity.sincronizar() con respuesta mock HTTP 415	Reconstruye Blob desde dataUrl, envía FormData multipart, marca error en adjunto local y remueve ítem bloqueante de outbox	Verificado en useConnectivity.test.ts (5/5 tests en verde, 140ms)	APROBADO	24/11/2026 14:15	N/A	feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43)
CP-H43-PWA-08	Persistencia y visualización continua en galería de misión tras recarga de página o disparo de sgrai:outbox-synced para adjuntos con incidente_id	Funcional / Resiliencia (CA-4, CA-5)	Integración / Servicio	Crítica	Misión activa ATENCION_CUADRILLA (MIS-2026-0002, reportesTerreno: []) con adjunto cargado por incidente_id	Subida online u offline + disparo de sgrai:outbox-synced / obtenerDetalleMision(id)	El adjunto sincronizado permanece visible en la galería con badge Sincronizado tras recargar detalle desde API	Falla por BUG-H43-PWA-01: obtenerDetalleMision sobrescribe adjuntos desde reportesTerreno ([]) descartando ítems locales sincronizados	FALLIDO	24/11/2026 14:15	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H43-PWA-09	Integración de carga de evidencia multimedia dentro de EvaluacionReporteCierreCard (H39) en modo online y offline	Funcional / Integración	Componente / Validación	Crítica	Patrulla en Paso 3 (EvaluacionReporteCierreCard) con permiso reportes:crear	Renderizado del componente en modo editable, adjunto offline y envío del informe de cierre	Permite adjuntar evidencia online/offline sin bloquear la validación Zod ni ocultar adjuntos tras cierre del reporte	Falla en flujo offline por BUG-H43-PWA-03 (id: "local-..." viola .uuid() y dataUrl excede .max(500) en crearReporteVerificacionSchema)	FALLIDO	24/11/2026 14:15	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H43-PWA-10	Previsualización en interfaz de miniaturas de imagen, reproductor de video y tarjeta de documento PDF con badges de estado	Funcional / UI	Componente	Alta	CargaEvidenciaCard con arreglo de AdjuntoLocal (image/webp, video/mp4, application/pdf)	Items con sincronizacionPendiente: false y true	Renderiza img con alt, video controls, tarjeta PDF con enlace Ver PDF y badges Sincronizado / Pendiente offline	Verificado en CargaEvidenciaCard.test.tsx (5/5 tests en verde, 600ms)	APROBADO	24/11/2026 14:15	N/A	fix(terreno): mejorar feedback de validacion al enviar reporte de cierre y resolver URLs de evidencia contra NEXT_PUBLIC_API_URL
CP-H43-PWA-11	Verificación en vivo de endpoint POST /api/evidencia/adjuntos vía proxy PWA: RBAC (401/403), asociación (400) y MIME/magic bytes (415)	Seguridad / Contrato API (CA-3, CA-7)	Sistema / HTTP	Crítica	Servidores sgrai-api (:4001) y sgrai-pwa (:3002) activos contra PostgreSQL	Peticiones curl sin token, con JWT CALL_CENTER, con JWT DELEGADO_CUADRILLA sin IDs, con text/plain y con image/jpeg falsificado	Retorna 401 sin Bearer, 403 (reportes:crear) para CALL_CENTER, 400 sin IDs y 415 ante MIME o firma binaria inválida	Confirmado en vivo vía http://localhost:3002/api/evidencia/adjuntos (401, 403, 400, 415, 415 magic bytes)	APROBADO	24/11/2026 14:19	N/A	feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43)
CP-H43-PWA-12	Protección perimetral SSR en ruta de cuadrilla (307), cabeceras de Service Worker (/terreno/sw.js) y manifiesto PWA	Seguridad / Infraestructura PWA	Sistema / HTTP	Alta	Servidor sgrai-pwa ejecutándose en :3002 sin cookie sgrai_auth_token	GET /terreno/cuadrilla/misiones/d1000000-...-0002, HEAD /terreno/sw.js y GET /terreno/manifest.webmanifest	Redirección 307 a /terreno/login?returnUrl=...; /terreno/sw.js con Service-Worker-Allowed: /terreno y 200 OK; manifiesto JSON válido 200 OK	Confirmado en vivo con curl: 307 Temporary Redirect, sw.js 200 OK (2998 bytes) y manifest.webmanifest 200 OK	APROBADO	24/11/2026 14:19	N/A	feat(evidencia): implementar servicio multipart, cola offline y sincronizacion (H43)
CP-H43-PWA-13	Cumplimiento de diseño institucional Flat UI (border-radius: 0), iconografía lucide-react, ausencia de emojis y cero uso de any	Calidad UI / Estándares	Estática	Media	Código fuente en rama feature/h43-adjuntar-evidencia-multimedia	Búsqueda regex Unicode de emojis, inspección de any y CSS CargaEvidenciaCard.module.css	Cero emojis en UI, cero declaraciones any, esquinas rectas a 0px y uso exclusivo de lucide-react	NO_EMOJIS, NO_ANY_FOUND y border-radius: 0 verificados en todos los módulos H43	APROBADO	24/11/2026 14:15	N/A	test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43)
CP-H43-PWA-14	Compilación TypeScript estricta (npx tsc --noEmit), análisis ESLint (npm run lint) y empaquetado Next.js (npm run build)	Compilación / Calidad	Sistema / CI	Crítica	Repositorio web-app limpio en rama evaluada	Ejecución de npx tsc --noEmit, npm run lint y npm run build	Compilación limpia (exit 0) en las tres herramientas sin errores de tipos ni warnings	npm run lint pasa con 1 warning; tsc --noEmit (exit 2) y npm run build (exit 1) fallan por BUG-H43-PWA-02	FALLIDO	24/11/2026 14:15	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H43-PWA-15	Ejecución de suite automatizada completa (270 tests) y subconjunto focalizado HU-43 (39 tests) en Vitest y React Testing Library	Automatización	Unit / Component / Service	Alta	Entorno Vitest v3.2.7 + JSDOM + fake-indexeddb	npm test, suite focalizada de 7 archivos y npm test -- -t "(H43)"	100% de las pruebas unitarias y de componentes existentes aprueban sin fallos	56/56 archivos (270/270 tests) en global, 7/7 (39/39) en focalizada y 4/4 (18 tests) bajo -t "(H43)"	APROBADO	24/11/2026 14:21	N/A	test(evidencia): agregar pruebas unitarias y de integracion para carga multimedia (H43)
CP-H43-PWA-16	Revisión del manual de usuario H43-adjuntar-evidencia-multimedia.md y contrato docs/api/contratos-terreno.md	Documentación	Documentación	Media	Archivos docs/manuals/H43-adjuntar-evidencia-multimedia.md y docs/api/contratos-terreno.md	Verificación de estructura obligatoria (AGENTS.md §5: Comportamiento sin conexión y Permisos del dispositivo)	Manual y contrato presentes con secciones offline, permisos de cámara/micrófono/almacenamiento y especificación multipart	Manual H43 (57 líneas) y contrato sección 2.2 presentes y conformes a estructura normativa	APROBADO	24/11/2026 14:15	N/A	docs(evidencia): agregar manual de usuario, contrato API y matriz QA (H43)
````

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

Todos los comandos se ejecutaron desde la raíz de `web-app` (`sgrai-pwa`) sobre el commit `ab760b9` en la rama `feature/h43-adjuntar-evidencia-multimedia`.

### 5.1. Suite Automatizada Vitest (Global, Focalizada y Filtrada)

#### 5.1.1. Ejecución Filtrada por Historia de Usuario (`npm test -- -t "(H43)"`)
```bash
npm test -- -t "(H43)"
```

**Evidencia Obtenida:**
```text
 ✓ src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx (5 tests | 4 skipped) 712ms
   ✓ CuadrillaMisionDetailPage — Rechazo Motivado (H41) > muestra el módulo Evidencia Multimedia (H43) cuando la misión está EN_CURSO y el usuario tiene permiso reportes:crear  705ms
 ✓ src/services/__tests__/evidenciaService.test.ts (4 tests) 86ms
 ✓ src/lib/utils/__tests__/mediaUtils.test.ts (8 tests) 15ms
 ✓ src/components/misiones/__tests__/CargaEvidenciaCard.test.tsx (5 tests) ...

 Test Files  4 passed | 52 skipped (56)
      Tests  18 passed | 252 skipped (270)
   Start at  14:21:35
   Duration  12.10s (transform 7.36s, setup 16.83s, collect 33.37s, tests 1.47s, environment 87.70s, prepare 10.76s)
```

#### 5.1.2. Ejecución Focalizada de los 7 Módulos Relacionados con HU-43
```bash
npx vitest run \
  src/lib/utils/__tests__/mediaUtils.test.ts \
  src/services/__tests__/evidenciaService.test.ts \
  src/components/misiones/__tests__/CargaEvidenciaCard.test.tsx \
  'src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx' \
  src/hooks/__tests__/useConnectivity.test.ts \
  src/services/__tests__/offlineQueue.test.ts \
  src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx
```

**Evidencia Obtenida:**
```text
 ✓ src/services/__tests__/offlineQueue.test.ts (6 tests) 37ms
 ✓ src/lib/utils/__tests__/mediaUtils.test.ts (8 tests) 22ms
 ✓ src/services/__tests__/evidenciaService.test.ts (4 tests) 71ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (5 tests) 140ms
 ✓ src/components/misiones/__tests__/CargaEvidenciaCard.test.tsx (5 tests) 600ms
 ✓ src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx (5 tests) 706ms
 ✓ src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx (6 tests) 1018ms

 Test Files  7 passed (7)
      Tests  39 passed (39)
   Start at  14:21:06
   Duration  4.42s (transform 1.78s, setup 2.23s, collect 4.60s, tests 2.59s, environment 8.83s, prepare 1.13s)
```

#### 5.1.3. Ejecución Completa del Repositorio PWA
```bash
npm test
```

**Evidencia Obtenida:**
```text
 Test Files  56 passed (56)
      Tests  270 passed (270)
   Start at  14:13:35
   Duration  25.86s (transform 13.00s, setup 32.50s, collect 55.80s, tests 40.17s, environment 141.60s, prepare 21.00s)
```

---

### 5.2. Verificación Estática: ESLint, TypeScript (`tsc --noEmit`) y Build (`npm run build`)

```bash
npm run lint
npx tsc --noEmit
npm run build
```

**Evidencia Obtenida en ESLint (`exit 0` con 1 warning):**
```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx
  150:5  warning  'prioridadClase' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (0 errors, 1 warning)
```

**Evidencia Obtenida en TypeScript (`exit 2`):**
```text
.next/dev/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts:39:29 - error TS2344: Type 'PageProps' does not satisfy the constraint 'import("/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/.next/dev/types/app/(terreno)/cuadrilla/misiones/[id]/page").PageProps'.
  Types of property 'params' are incompatible.
    Type 'Promise<{ id: string; }> | { id: string; }' is not assignable to type 'Promise<any> | undefined'.
      Type '{ id: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]

Found 2 errors in 2 files.
```

**Evidencia Obtenida en Build de Producción (`exit 1`):**
```text
▲ Next.js 16.3.4 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 90ms
  Creating an optimized production build ...
✓ Compiled successfully in 4.5s
.next/dev/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts(39,29): error TS2344: Type 'PageProps' does not satisfy the constraint ...
Failed to type check.
```

**Verificación de Ausencia de Emojis, Tipo `any` y Cobertura en `api-generated.d.ts`:**
```bash
rg -n "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/components/misiones/CargaEvidenciaCard* src/services/evidenciaService.ts src/lib/utils/mediaUtils.ts src/lib/validations/evidencia.ts 'src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx' || echo "NO_EMOJIS"
rg -n "\bany\b" src/components/misiones/CargaEvidenciaCard.tsx src/services/evidenciaService.ts src/lib/utils/mediaUtils.ts src/lib/validations/evidencia.ts src/types/offline.ts 'src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx' || echo "NO_ANY_FOUND"
rg -n "/api/evidencia" src/types/api-generated.d.ts || echo "NOT_FOUND_IN_OPENAPI_TYPES"
```

**Salida Observada:** `NO_EMOJIS`, `NO_ANY_FOUND`, `NOT_FOUND_IN_OPENAPI_TYPES`.

---

### 5.3. Pruebas Replicables en Vivo con `curl` (Perímetro PWA y Proxy API)

Con `sgrai-api` escuchando en `http://localhost:4001` y `sgrai-pwa` en `http://localhost:3002`:

#### 5.3.1. Protección Perimetral SSR, Service Worker y Manifiesto PWA
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

#### 5.3.2. Autenticación de Usuarios de Prueba (`DELEGADO_CUADRILLA` y `CALL_CENTER`)
```bash
LOGIN_DELEGADO=$(curl -s -X POST "http://localhost:3002/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"supervisor@valdivia.cl","password":"Valdivia2026!"}')

LOGIN_CALL=$(curl -s -X POST "http://localhost:3002/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}')
```

#### 5.3.3. Control de Acceso RBAC en `POST /api/evidencia/adjuntos` (`401` y `403`)
```bash
# Caso sin token -> 401 Unauthorized
curl -s -i -X POST "http://localhost:3002/api/evidencia/adjuntos" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004" \
  -F "file=@public/favicon.ico;type=image/jpeg"

# Caso rol CALL_CENTER (sin permiso reportes:crear) -> 403 Forbidden
curl -s -i -X POST "http://localhost:3002/api/evidencia/adjuntos" \
  -H "Authorization: Bearer $TOKEN_CALL" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004" \
  -F "file=@public/favicon.ico;type=image/jpeg"
```

**Respuestas HTTP/JSON Obtenidas:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No cuenta con el permiso requerido: reportes:crear"}
```

#### 5.3.4. Validación de Asociación (`400`), Tipo MIME y Magic Bytes (`415`)
```bash
# Caso sin incidente_id ni reporte_terreno_id -> 400 Bad Request
curl -s -i -X POST "http://localhost:3002/api/evidencia/adjuntos" \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "file=@public/favicon.ico;type=image/jpeg"

# Caso MIME text/plain -> 415 Unsupported Media Type
printf "hola mundo prueba" > /tmp/qa_bad.txt
curl -s -i -X POST "http://localhost:3002/api/evidencia/adjuntos" \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004" \
  -F "file=@/tmp/qa_bad.txt;type=text/plain"

# Caso MIME image/jpeg falsificado sobre texto plano (magic bytes) -> 415 Unsupported Media Type
curl -s -i -X POST "http://localhost:3002/api/evidencia/adjuntos" \
  -H "Authorization: Bearer $TOKEN_DELEGADO" \
  -F "incidente_id=a1000000-0000-4000-8000-000000000004" \
  -F "file=@/tmp/qa_bad.txt;type=image/jpeg"
rm -f /tmp/qa_bad.txt
```

**Respuestas HTTP/JSON Obtenidas:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Datos de asociación inválidos para el adjunto.","errors":[{"campo":"asociacion","mensaje":"Debe proporcionar al menos incidente_id o reporte_terreno_id."}]}
```
```http
HTTP/1.1 415 Unsupported Media Type
content-type: application/json

{"message":"Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WebP), videos (MP4, WebM, MOV) y documentos PDF."}
```
```http
HTTP/1.1 415 Unsupported Media Type
content-type: application/json

{"message":"No se pudo verificar la firma binaria del archivo. Formato no soportado o corrupto."}
```

#### 5.3.5. Verificación de Misión Activa de Cuadrilla Sin `reportesTerreno` (`BUG-H43-PWA-01`)
```bash
curl -s -i -H "Authorization: Bearer $TOKEN_DELEGADO" \
  "http://localhost:3002/api/misiones/d1000000-0000-4000-8000-000000000002"
```

**Extracto JSON Real Obtenido (`HTTP/1.1 200 OK`):**
```json
{
  "message": "Detalle de misión obtenido exitosamente.",
  "data": {
    "id": "d1000000-0000-4000-8000-000000000002",
    "codigo": "MIS-2026-0002",
    "tipoMision": "ATENCION_CUADRILLA",
    "estado": "EN_CURSO",
    "incidente": {
      "id": "a1000000-0000-4000-8000-000000000004",
      "codigo": "INC-2026-0004",
      "estado": "EN_ATENCION"
    },
    "reportesTerreno": []
  }
}
```
Este resultado confirma que en faenas activas de cuadrilla `reportesTerreno` es `[]` (`reporteTerrenoId` indefinido), dejando los adjuntos ligados exclusivamente a `incidente_id` y provocando su desaparición en `obtenerDetalleMision` al sincronizar o recargar (`BUG-H43-PWA-01`).

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Cobertura en `sgrai-pwa` / Alcance | Casos de Prueba y Defectos Asociados | Estado Actual | Observaciones Técnicas |
|---|---|---|---|---|
| **CA-1:** La PWA debe proveer un módulo de carga de evidencia multimedia dentro de la misión activa. | Implementado en `CuadrillaMisionDetailPage` (`CargaEvidenciaCard`) y en `EvaluacionReporteCierreCard`. | `CP-H43-PWA-01`, `CP-H43-PWA-09`, `BUG-H43-PWA-01`, `BUG-H43-PWA-02`, `BUG-H43-PWA-03` | **No Cumplido (Bloqueado)** | El componente existe y rinde correctamente en pruebas unitarias, pero el build productivo de la ruta de cuadrilla falla (`BUG-H43-PWA-02`) y los adjuntos en Paso 3 offline bloquean el envío del reporte (`BUG-H43-PWA-03`). |
| **CA-2:** Debe permitir la captura directa desde la cámara del dispositivo móvil o la selección desde la galería de archivos. | Inputs `capture="environment"` para foto/video y selector múltiple `Galería / PDF`. | `CP-H43-PWA-02` | **Cumplido** | Atributos `capture` y `accept` verificados en DOM y pruebas de componente. |
| **CA-3:** Validación estricta de archivos: solo se permiten tipos MIME autorizados (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`, además de videos `MP4`/`WebM`/`MOV`) y un peso máximo de 10 MB por archivo. | Validado en `mediaUtils.ts`, `evidencia.ts` y backend `POST /api/evidencia/adjuntos`. | `CP-H43-PWA-03`, `CP-H43-PWA-04`, `CP-H43-PWA-11`, `BUG-H43-PWA-06` | **Cumplido con Observaciones** | Cumplido para los formatos base y límite de 10 MB; pendiente normalización de parámetros de códec y verificación `blob.size <= 0` tras compresión (`BUG-H43-PWA-06`). |
| **CA-4:** Al cargar exitosamente, la API debe persistir los metadatos en la tabla `adjunto` asociando el archivo a `reporte_terreno_id` o `incidente_id`. | `evidenciaService.ts` construye `FormData` con `file` e `incidente_id` / `reporte_terreno_id`; persistencia canónica reside en `sgrai-api`. | `CP-H43-PWA-05`, `CP-H43-PWA-08`, `CP-H43-PWA-11`, `BUG-H43-PWA-01`, `BUG-H43-PWA-04` | **Parcial / Fallido en Persistencia de Vista** | Envío multipart conforme, pero `obtenerDetalleMision` descarta los adjuntos sincronizados asociados solo a `incidente_id` al recargar (`BUG-H43-PWA-01`) y `api-generated.d.ts` no está regenerado (`BUG-H43-PWA-04`). |
| **CA-5:** Soporte offline: si no hay conectividad a internet en terreno, los archivos deben almacenarse localmente en IndexedDB y sincronizarse automáticamente en segundo plano al recuperar red. | Cola `outbox` `SUBIR_EVIDENCIA`, `useConnectivity.ts` y Service Worker `public/sw.js`. | `CP-H43-PWA-06`, `CP-H43-PWA-07`, `CP-H43-PWA-08`, `CP-H43-PWA-12`, `BUG-H43-PWA-01`, `BUG-H43-PWA-03`, `BUG-H43-PWA-04` | **No Cumplido** | El encolamiento y envío en `useConnectivity` operan, pero tras completar `sgrai:outbox-synced` la vista elimina el ítem recién sincronizado (o con error) (`BUG-H43-PWA-01`), falta manejo de `401` (`BUG-H43-PWA-04`) y falla el cierre offline en H39 (`BUG-H43-PWA-03`). |
| **CA-6:** Los adjuntos deben visualizarse inmediatamente en la galería de evidencia del Centro de Mando. | Responsabilidad compartida (`sgrai-api` evento `adjunto:creado` + endpoints de detalle y `sgrai-web` `IncidenteDetalleDrawer` / `MisionDetalleModal`). | `BUG-H43-PWA-01` | **No Cumplido en Flujo de Cuadrilla** | Aunque `sgrai-api` emite `adjunto:creado`, `GET /api/misiones/{id}` y `GET /api/incidentes/{id}` solo retornan adjuntos ligados a `reporte_terreno_id`, excluyendo los adjuntos de cuadrilla asociados únicamente a `incidente_id`. |
| **CA-7:** El endpoint de subida debe requerir el permiso RBAC `reportes:crear`. | Validado en `CuadrillaMisionDetailPage`, `TerrenoModulosGrid` y endpoint `POST /api/evidencia/adjuntos`. | `CP-H43-PWA-01`, `CP-H43-PWA-11`, `BUG-H43-PWA-06` | **Cumplido con Observación Menor** | Verificado `401`/`403` en vivo y bloqueo en UI de cuadrilla; pendiente retirar fallback implícito en `AuthContext.tsx:259` para patrulla (`BUG-H43-PWA-06`). |


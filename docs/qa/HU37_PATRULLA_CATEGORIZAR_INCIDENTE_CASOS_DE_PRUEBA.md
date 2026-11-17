# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-37 — Categorizar o Corregir la Tipología del Incidente tras Evaluación en Terreno (PWA)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Cliente de Terreno PWA**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Operaciones de Terreno / Patrulla Verificadora (`sgrai-pwa` — `/terreno/patrulla/misiones/[id]`).  
> **Historia de Usuario:** HU-37 — *"Como Patrulla verificadora Quiero categorizar o corregir la tipología del incidente tras la evaluación presencial en terreno Para asegurar un registro técnico fidedigno de la naturaleza real de la emergencia, corrigiendo clasificaciones inexactas hechas por informantes ciudadanos."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Aplicación Auditada:** `sgrai-pwa` (Next.js 16.3.4 App Router + React 19.2.8 + TypeScript + IndexedDB `idb` + Zod + `openapi-fetch` + Vitest 3.2.7 + Testing Library).  
> **Rama Git Evaluada:** `feature/h37-patrulla-categorizar-incidente`  
> **Commits Evaluados (Conventional Commits):**  
> * `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)`  
> * `test(patrulla): agregar pruebas unitarias y de integracion para categorizacion de tipologia (H37)`  
> * `docs(patrulla): agregar manual de terreno H37 para categorizacion de incidentes`  
> * `style(tipologia): asegurar saltos de linea finales en componentes, esquemas, tests y manual H37`  
> * `feat(misiones): ordenar listados de patrulla y cuadrilla por ultima actualizacion y sanitizar titulos`  
> * `feat(ui): implementar SeccionDesplegable y redisenar pantalla de detalle a ancho completo con campos tactiles de 48px`  
> * `test(ui): agregar pruebas de SeccionDesplegable y actualizar tests de categorizacion y ordenamiento`  
> * `docs(patrulla): actualizar manual H37 con cabecera y secciones desplegables`  
> * `style(patrulla): aplicar fondo #14505a a barra superior y raya de acento a encabezados inferiores`  
> * `style(patrulla): unificar estilo de cabeceras en recuadros de detalle de incidente`  
> * `merge: integrar cambios de develop resolviendo conflictos de importaciones en bandejas de misiones`  
>  
> **Fecha de Auditoría Inicial QA:** 17/11/2026 00:22.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW / CHANGES REQUESTED (6 Defectos Detectados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la inspección forense de código fuente, verificación de compilación TypeScript y empaquetado de producción (`next build`), análisis estático ESLint, contraste de contratos OpenAPI y base de datos PostgreSQL respecto a `sgrai-api`, validación de reglas de negocio del Sistema de Comando de Incidentes (ICS), pruebas de integración HTTP reales mediante cURL y ejecución de la suite automatizada Vitest sobre la rama `feature/h37-patrulla-categorizar-incidente`, se dictamina el estado **RECHAZADO EN CODE REVIEW (`Changes Requested`)** al detectarse **6 defectos reales** (**2 Críticos**, **2 Altos** y **2 Medios**) que impiden la compilación del proyecto en CI/Docker, comprometen la integridad de datos en modo offline ante discrepancias del catálogo predeterminado, introducen pérdida silenciosa de mutaciones en cola `outbox` ante respuestas `409 Conflict`, omiten el control RBAC `misiones:terreno:verificar` en el renderizado del formulario técnico e incumplen el contrato OpenAPI generado (`api-generated.d.ts` y `openapi-fetch`).

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **22** | 6 Defectos Detectados (`BUG-H37-PWA-01` a `06`) + 16 Casos Funcionales, Offline, RBAC, UI y Contrato (`CP-H37-PWA-01` a `16`) |
| **Casos Aprobados (Passed)** | **16** | Validación Zod de justificación (`>= 5` chars), carga del catálogo oficial, UI táctil plana (`0px`, `>= 48px`), pruebas unitarias con mocks y verificación real de endpoint en `sgrai-api` |
| **Defectos Abiertos / Fallidos (Failed)** | **6** | **2 Críticos, 2 Altos, 2 Medios** |
| **Casos Bloqueados (Blocked)** | **0** | Sin bloqueos de infraestructura externa |
| **Tasa de Aprobación Actual (% Pass)** | **72.7%** | Se requiere el 100.0% (0 defectos abiertos) en Re-Test para aprobar la integración a `develop` |
| **Suite Automatizada Global (Vitest)** | 🟢 **32/32 archivos (123 tests pass)** | Ejecución con mocks de API y `fake-indexeddb`; 7 archivos directamente vinculados a HU-37 (43 tests pass) |
| **Análisis Estático ESLint (`npm run lint`)** | 🟢 **0 errores** | 0 errores y 4 advertencias previas (`@next/next/no-location-assign-relative-destination`) en archivos de autenticación/redirección |
| **Chequeo de Tipos (`npx tsc --noEmit`)** | 🔴 **2 errores (`exit code 2`)** | Errores `TS2345` en `PatrullaDetailPage.test.tsx:37` y `PatrullaTipologia.test.tsx:52` tras merge con `develop` |
| **Compilación de Producción (`npm run build`)** | 🔴 **Fallido (`Failed to type check.`)** | El build de Next.js 16.3.4 aborta en fase de verificación de tipos impidiendo generar artefacto Docker |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H37-PWA-01`: Fallo de Compilación TypeScript (`tsc --noEmit`) y Ruptura del Build de Producción (`npm run build`) por Mocks Incompletos de `AuthContextValue` tras Merge con `develop`
* **Severidad:** **CRÍTICA** (Bloqueo Total de CI/CD y Construcción de Imagen Docker).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaTipologia.test.tsx` (Líneas 52-80)
  * `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx` (Líneas 37-67)
* **Descripción Técnica del Defecto:**  
  Tras el commit de integración `merge: integrar cambios de develop resolviendo conflictos de importaciones en bandejas de misiones`, la interfaz `AuthContextValue` (`src/context/AuthContext.tsx`, líneas 63-78) exige las propiedades obligatorias `tieneUnidadAsignada: boolean` y `estadoAsignacion: EstadoAsignacionUnidad`. Sin embargo, las funciones auxiliares `configurarAuth` (`PatrullaTipologia.test.tsx`) y `configurarAuthMock` (`PatrullaDetailPage.test.tsx`) retornan un objeto parcial para `vi.mocked(AuthContextModule.useAuth).mockReturnValue(...)` omitiendo ambos campos.
* **Pasos para Reproducir:**
  1. Ubicarse en la raíz del repositorio `web-app` en la rama `feature/h37-patrulla-categorizar-incidente`.
  2. Ejecutar `npx tsc --noEmit` o `npm run build`.
* **Comportamiento Actual:**  
  `npx tsc --noEmit` termina con código `2` reportando `error TS2345` en ambos archivos, y `npm run build` aborta con `Failed to type check.`, bloqueando el pipeline de integración y el despliegue en contenedor.
* **Comportamiento Esperado:**  
  `npx tsc --noEmit` y `npm run build` deben finalizar limpiamente con código de salida `0`.
* **Sugerencia Técnica de Solución:**  
  Incorporar `tieneUnidadAsignada: true` y `estadoAsignacion: unidadActiva ? 'ACTIVA' : 'DESACTIVADA'` dentro del objeto retornado en `configurarAuth` (`PatrullaTipologia.test.tsx`) y `configurarAuthMock` (`PatrullaDetailPage.test.tsx`).

---

### `BUG-H37-PWA-02`: Corrupción Cruzada de UUIDs e Ítem Inexistente en `CATALOGO_TIPOS_PREDETERMINADO` Frente a la Tabla `tipo_incidente` de `sgrai-api`
* **Severidad:** **CRÍTICA** (Integridad de Datos Operativos en Terreno y Fallo `404` Irreversible en Sincronización Offline).
* **Estado:** `ABIERTO`.
* **Archivo Afectado:** `src/services/tipologiaService.ts` (Líneas 17-60).
* **Descripción Técnica del Defecto:**  
  En escenarios de arranque en frío sin red (antes de que IndexedDB haya almacenado la respuesta de `GET /api/incidentes/tipos?catalogo=true`), `obtenerCatalogoTiposIncidente()` retorna la constante `CATALOGO_TIPOS_PREDETERMINADO`. Al contrastar los UUIDs de dicha constante contra la tabla `tipo_incidente` sembrada por la migración `003_catalogos_informante_avisos.ts` y expuesta por `GET /api/incidentes/tipos?catalogo=true` en `sgrai-api`, existen discrepancias severas:
  1. `40000000-0000-4000-8000-000000000002`: En `sgrai-pwa` figura como `"Anegamiento de calzada"`, pero en PostgreSQL ese UUID corresponde a **`"Deslizamiento de tierra"`**.
  2. `40000000-0000-4000-8000-000000000004`: En `sgrai-pwa` figura como `"Derrumbe / Remoción en masa"`, pero en PostgreSQL corresponde a **`"Anegamiento de calzada"`**.
  3. `40000000-0000-4000-8000-000000000005`: En `sgrai-pwa` figura como `"Incendio estructural"`, mientras que en PostgreSQL es **`"Incendio estructural / forestal"`**.
  4. `40000000-0000-4000-8000-000000000006`: En `sgrai-pwa` figura como `"Desborde de cauce"`, pero en PostgreSQL corresponde a **`"Otro"`**.
  5. `40000000-0000-4000-8000-000000000007`: En `sgrai-pwa` figura como `"Corte de suministros críticos"`, **UUID que no existe en la tabla `tipo_incidente`**.
  6. Adicionalmente, `CATALOGO_TIPOS_PREDETERMINADO` omite 5 categorías activas reales del catálogo municipal (`Anegamiento`, `Corte de agua potable`, `Corte de energía`, `Daño estructural` y `Deslizamiento`).
* **Pasos para Reproducir:**
  1. Abrir la PWA sin caché previo en `IndexedDB` (`catalogos`) y sin conectividad de red (`navigator.onLine = false`).
  2. Seleccionar `"Derrumbe / Remoción en masa"` (`40000000-0000-4000-8000-000000000004`) o `"Corte de suministros críticos"` (`40000000-0000-4000-8000-000000000007`), ingresar justificación válida y guardar.
  3. Recuperar conectividad y sincronizar la cola `outbox` contra `PATCH /api/incidentes/{id}/tipologia`.
* **Comportamiento Actual:**  
  Con `...0004`, el servidor persiste `"Anegamiento de calzada"` en lugar de remoción en masa y propaga ese dato erróneo al Centro de Mando; con `...0007`, `sgrai-api` rechaza la petición con `HTTP 404 Not Found` (`"El tipo de incidente seleccionado no existe en el catálogo oficial."`), dejando la mutación atrapada en `outbox`.
* **Comportamiento Esperado:**  
  `CATALOGO_TIPOS_PREDETERMINADO` debe reflejar con exactitud los 11 UUIDs y nombres canónicos oficiales de la tabla `tipo_incidente` expuestos por `GET /api/incidentes/tipos?catalogo=true`.
* **Sugerencia Técnica de Solución:**  
  Alinear `CATALOGO_TIPOS_PREDETERMINADO` con los 11 registros canónicos de `tipo_incidente` (`40000000-...-0001` a `0006` y `a0000000-...-0001, 0003..0006`) y precargar `obtenerCatalogoTiposIncidente()` al sincronizar la bandeja de misiones o autenticar sesión en terreno.

---

### `BUG-H37-PWA-03`: Pérdida Silenciosa de Reclasificación en Cola Offline ante `409 Conflict`, Desincronización Causal en `outbox` y Sobreescritura en Bandeja de Misiones
* **Severidad:** **ALTA** (Pérdida Silenciosa de Datos Offline y Retroalimentación Engañosa en Terreno).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/hooks/useConnectivity.ts` (Líneas 46-85)
  * `src/services/offlineQueue.ts` (Líneas 148-173)
  * `src/services/misionesService.ts` (Líneas 165, 180-182)
  * `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (Líneas 308-316)
* **Descripción Técnica del Defecto:**  
  1. **Descarte destructivo de `ACTUALIZAR_TIPOLOGIA` ante `409 Conflict` (`useConnectivity.ts:63`) y ausencia de corte causal (`offlineQueue.ts:155-170`):** En `useConnectivity.ts`, la línea `const procesada = res.ok || res.status === 409 || res.status === 422;` aplica la regla de idempotencia de `ACEPTAR_MISION` a todas las acciones del `outbox`. Si una patrulla acepta y luego reclasifica en modo offline, y al volver la señal falla transitoriamente el envío de `ACEPTAR_MISION`, `sincronizarColaOutbox` continúa el bucle con `ACTUALIZAR_TIPOLOGIA`; el backend responde `409 Conflict` (*"La patrulla debe aceptar la misión asignada antes de poder reclasificar..."*), `useConnectivity.ts` lo interpreta como `procesada = true`, elimina definitivamente la reclasificación de IndexedDB y borra `sincronizacionPendiente: false`, ocasionando pérdida silenciosa de la categorización.
  2. **Manejo incompleto de `400`/`404`/`401` y falta de `x-user-id` en sincronización:** Ante errores definitivos (`400` o `404`), `procesada` resulta `false` y la tarea queda en bucle infinito en el `outbox` sin mecanismo de descarte/notificación; ante `401 Unauthorized` no se invoca `handleUnauthorizedSession()`, y las cabeceras de `useConnectivity.ts:46-51` no extraen `x-user-id` del JWT como sí hace `src/lib/api/client.ts`.
  3. **Sobreescritura de tipología local en `sincronizarMisiones` (`misionesService.ts:165, 181`):** Al regresar a `/patrulla/misiones`, `sincronizarMisiones` asigna `tipologia: limpiarTituloMision(item.titulo)` (título estático de la misión que no cambia al reclasificar el incidente) y ejecuta `guardarMisionesLocales(remotas)` (`db.put`), pisando la tipología optimista y el indicador `sincronizacionPendiente: true` antes de vaciar el `outbox`.
  4. **Banner erróneo de sincronización pendiente (`page.tsx:308-316`):** Cuando la misión fue aceptada online y únicamente la reclasificación está pendiente offline (`mision.sincronizacionPendiente === true`), el panel `En Trayecto / Evaluación` muestra el texto *"Pendiente de sincronizar: La aceptación fue guardada en la cola local..."*, atribuyendo incorrectamente el estado pendiente a la aceptación.
* **Pasos para Reproducir:**
  1. En modo offline, aceptar una misión (`ACEPTAR_MISION`) y reclasificar su tipología (`ACTUALIZAR_TIPOLOGIA`).
  2. Recuperar red con fallo transitorio en el primer `POST /aceptar` (ej. `503`) y respuesta `409` en el `PATCH /tipologia` consecutivo; verificar que `ACTUALIZAR_TIPOLOGIA` es eliminada del `outbox` pese a no haber persistido en el servidor.
* **Comportamiento Actual:**  
  La mutación `ACTUALIZAR_TIPOLOGIA` se descarta silenciosamente ante `409 Conflict`, la bandeja sobreescribe la tipología local al consultar `GET /api/misiones` y el banner offline indica erróneamente que está pendiente la aceptación.
* **Comportamiento Esperado:**  
  `409 Conflict` solo debe considerarse idempotente en acciones donde aplique (`ACEPTAR_MISION`), `sincronizarColaOutbox` debe respetar dependencias causales por misión (deteniendo mutaciones dependientes si falla `ACEPTAR_MISION`), `sincronizarMisiones` debe preservar cambios locales con acciones pendientes en `outbox`, y el mensaje de estado pendiente debe diferenciar entre aceptación y reportes técnicos pendientes.
* **Sugerencia Técnica de Solución:**  
  Restringir la tolerancia a `409` en `useConnectivity.ts` exclusivamente a `ACEPTAR_MISION` (notificando conflicto en `ACTUALIZAR_TIPOLOGIA`), pausar o diferir acciones posteriores de una misma misión cuando falle una acción previa en `sincronizarColaOutbox`, delegar la ejecución HTTP en `apiClient` para compartir manejo de `401`/headers, y evitar sobreescribir en `guardarMisionesLocales` registros con `sincronizacionPendiente` activo en el `outbox`.

---

### `BUG-H37-PWA-04`: Omisión de Validación RBAC (`misiones:terreno:verificar`) y de `incidenteId` Válido en `PatrullaMisionDetailPage`, más Falta de Validación UUID de `incidenteId` en `tipologiaService.ts`
* **Severidad:** **ALTA** (Brecha de Control de Acceso RBAC en UI e Integridad de Parámetros de Ruta).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (Líneas 58-69, 138-145, 287-380)
  * `src/services/tipologiaService.ts` (Líneas 142-179)
  * `src/context/AuthContext.tsx` (Líneas 240-246)
* **Descripción Técnica del Defecto:**  
  1. En `PatrullaMisionDetailPage` (`page.tsx:143-144`), el bloque `"Confirmación de salida a terreno"` condiciona su visibilidad a `unidadActiva && esDespachada && tienePermisoVerificar`. Sin embargo, la sección `"Formularios de Reporte Técnico"` que monta `<EvaluacionTipologiaCard />` (`page.tsx:287-380`) únicamente verifica `unidadActiva && esEnCurso`, **omitiendo comprobar `tienePermisoVerificar`** (`misiones:terreno:verificar`) y sin enviar la prop `deshabilitado={!tienePermisoVerificar}` que el propio componente `EvaluacionTipologiaCard` expone.
  2. Tampoco se verifica que `mision.incidenteId` sea un UUID válido no vacío antes de montar `EvaluacionTipologiaCard` (por ejemplo, ante una misión de prevención sin incidente o usando el respaldo sintético `incidenteId: 'inc-${misionId}'` en `page.tsx:60`).
  3. En `tipologiaService.ts:147`, `reclasificarTipologiaEnTerreno` no valida que `incidenteId` sea un UUID antes de encolar offline o enviar el `PATCH`, mientras que si `EvaluacionTipologiaCard` pasa `misionId: misionActual.id` con un ID no UUID, `reclasificarTipologiaSchema.parse(input)` falla antes de llegar a la sanitización `misionUuidValido` (`tipologiaService.ts:160-164`).
  4. En `AuthContext.tsx:243`, cuando un usuario con rol `PATRULLA_VERIFICADORA` posee `permisos: []` (por ejemplo, tras revocación administrativa del permiso), `tienePermiso('misiones:terreno:verificar')` retorna `true` por política *Fail-Open*.
* **Pasos para Reproducir:**
  1. Renderizar `PatrullaMisionDetailPage` con una misión `EN_CURSO`, `unidadActiva = true` y `tienePermiso('misiones:terreno:verificar') = false` (o con `mision.incidenteId = ''`).
  2. Observar que `<EvaluacionTipologiaCard />` se muestra habilitado y permite enviar el formulario.
* **Comportamiento Actual:**  
  Un operador autenticado sin el permiso `misiones:terreno:verificar` o sobre una misión sin `incidenteId` UUID válido visualiza los controles habilitados y puede encolar o disparar peticiones fallidas (`403` / `400` / `404`).
* **Comportamiento Esperado:**  
  Si `!tienePermisoVerificar` o `!mision.incidenteId`, el formulario de categorización debe ocultarse o deshabilitarse explícitamente con aviso informativo, `tienePermiso` debe aplicar política *Fail-Closed* cuando `permisos` viene definido vacío, y `tipologiaService.ts` debe validar el UUID de `incidenteId` antes de persistir en IndexedDB.
* **Sugerencia Técnica de Solución:**  
  Condicionar el renderizado de `<EvaluacionTipologiaCard />` en `page.tsx` a `Boolean(mision.incidenteId)` y pasar `deshabilitado={!tienePermisoVerificar}` (o restringir la sección con aviso RBAC), validar `z.string().uuid().parse(incidenteId)` en `tipologiaService.ts` sanitizando `misionId` antes de `reclasificarTipologiaSchema.parse`, y remover el fallback *Fail-Open* en `AuthContext.tsx:243`.

---

### `BUG-H37-PWA-05`: Desactualización de Contratos OpenAPI (`src/types/api-generated.d.ts`), Tipos Manuales en `offline.ts` y Bypass de `openapi-fetch` en `tipologiaService.ts`
* **Severidad:** **MEDIA** (Incumplimiento de Arquitectura de Contratos Tipados y Desfase con `sgrai-api`).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/types/api-generated.d.ts` (Líneas 1557-1598 y ausencia de `/api/incidentes/{id}/tipologia`)
  * `src/types/offline.ts` (Líneas 61-72)
  * `src/services/tipologiaService.ts` (Líneas 62-114, 208-269)
* **Descripción Técnica del Defecto:**  
  1. El archivo `src/types/api-generated.d.ts` no fue regenerado mediante `npm run api:generate` contra `sgrai-api`: carece por completo de la ruta `PATCH /api/incidentes/{id}/tipologia` y sus esquemas (`ReclasificarTipologiaInput`, `ReclasificarTipologiaResponse`, `TipoIncidenteCatalogoItem`), y en `/api/incidentes/tipos` solo declara `data: string[]` sin contemplar el parámetro `catalogo=true`.
  2. Para suplir esa omisión, se declararon manualmente las interfaces `TipoIncidenteCatalogoItem` y `ReclasificarTipologiaPayload` en `src/types/offline.ts:61-72`, y `tipologiaService.ts` realiza llamadas directas mediante `fetch` con funciones locales `resolveApiUrl()` y `buildAuthHeaders()`, omitiendo `apiClient` (`openapi-fetch` configurado en `src/lib/api/client.ts`) junto con su inyección automática de `x-user-id` desde JWT y su interceptor global de respuestas `401`.
* **Pasos para Reproducir:**
  1. Buscar `/api/incidentes/{id}/tipologia` en `src/types/api-generated.d.ts`.
  2. Inspeccionar las importaciones de `src/services/tipologiaService.ts` y las definiciones manuales en `src/types/offline.ts`.
* **Comportamiento Actual:**  
  La capa de tipología opera desacoplada del cliente OpenAPI tipado (`apiClient`) y no recibe validación en tiempo de compilación ante cambios de contrato en `sgrai-api`.
* **Comportamiento Esperado:**  
  `src/types/api-generated.d.ts` debe incluir los contratos actualizados de `GET /api/incidentes/tipos` y `PATCH /api/incidentes/{id}/tipologia` mediante `npm run api:generate`, derivar los tipos en `offline.ts` desde `paths` / `components['schemas']` y ejecutar todas las peticiones a través de `apiClient`.
* **Sugerencia Técnica de Solución:**  
  Documentar el query param `catalogo` en el OpenAPI de `GET /api/incidentes/tipos` en `sgrai-api`, ejecutar `npm run api:generate` en `sgrai-pwa`, derivar los tipos desde `api-generated.d.ts` en `src/types/offline.ts`, y reemplazar `fetch` en `tipologiaService.ts` por `apiClient.GET` y `apiClient.PATCH`.

---

### `BUG-H37-PWA-06`: Recarga Redundante del Catálogo Tras Cada Reclasificación y Preselección Silenciosa de Primera Categoría Sin Coincidencia en `EvaluacionTipologiaCard.tsx`
* **Severidad:** **MEDIA** (Degradación UX en Terreno, Peticiones Redundantes y Riesgo de Selección Accidental).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/components/misiones/EvaluacionTipologiaCard.tsx` (Líneas 53-89, 64-76)
  * `src/services/tipologiaService.ts` (Líneas 151-158)
* **Descripción Técnica del Defecto:**  
  1. El `useEffect` de carga del catálogo en `EvaluacionTipologiaCard.tsx:53-89` declara `[misionActual?.tipologia]` como dependencia. En consecuencia, inmediatamente después de confirmar una reclasificación (`onTipologiaActualizada` actualiza `mision.tipologia`), el componente vuelve a activar `setCargandoCatalogo(true)`, bloquea momentáneamente los campos y dispara una petición HTTP adicional `GET /api/incidentes/tipos?catalogo=true`. A ello se suma que `reclasificarTipologiaEnTerreno` (`tipologiaService.ts:153`) invoca una segunda consulta a `obtenerCatalogoTiposIncidente()` justo antes del `PATCH`.
  2. Cuando `misionActual.tipologia` no coincide exactamente por nombre con ninguna opción activa del catálogo (por ejemplo, categorías históricas o valores abreviados como `"Incendio estructural"` vs `"Incendio estructural / forestal"`), el bloque `else if (listaTipos[0]?.id)` (`EvaluacionTipologiaCard.tsx:73-75`) preselecciona silenciosamente el primer ítem alfabético del catálogo (`"Anegamiento"` / `"Inundación"`), sin ofrecer una opción neutra `"Seleccione una tipología..."`, aumentando el riesgo de reclasificación errónea por toque accidental en terreno.
  3. Asimismo, el selector nativo `<Select>` carece del filtro o búsqueda rápida especificado en las subtareas técnicas del componente cuando el catálogo crece.
* **Pasos para Reproducir:**
  1. Montar `EvaluacionTipologiaCard` con `misionActual.tipologia = "Tipología Histórica"` (sin coincidencia exacta) y observar que el selector adopta el primer elemento del catálogo (`listaTipos[0]`).
  2. Confirmar una reclasificación exitosa y verificar en el registro de red que se ejecuta nuevamente `GET /api/incidentes/tipos?catalogo=true`.
* **Comportamiento Actual:**  
  Disparo duplicado de consultas al catálogo al guardar y preselección forzada del primer ítem si no hay coincidencia textual exacta.
* **Comportamiento Esperado:**  
  El catálogo debe cargarse una sola vez al montar (sincronizando la selección en un efecto separado sin re-consultar la red), incluir una opción placeholder explícita cuando no exista coincidencia exacta en el catálogo y evitar consultas redundantes dentro de `reclasificarTipologiaEnTerreno`.
* **Sugerencia Técnica de Solución:**  
  Separar el `useEffect` de carga del catálogo (`[]`) del `useEffect` que sincroniza `tipoSeleccionadoId` con `misionActual?.tipologia` y `catalogo`, agregar opción inicial vacía `"Seleccione un tipo de incidente..."` cuando no exista coincidencia exacta, y leer desde `obtenerCatalogoLocal` (o recibir `nombreTipo` opcional) dentro de `reclasificarTipologiaEnTerreno`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H37-PWA-01` | Verificación de tipado estático TypeScript y compilación de producción Next.js tras merge con `develop` | Compilación / CI | Estático / Build | Crítica | Rama `feature/h37-patrulla-categorizar-incidente` con dependencias instaladas | `npx tsc --noEmit` y `npm run build` | Ambos comandos finalizan con código de salida `0` sin errores de tipos | Falla con código `2` (`TS2345`) en `PatrullaDetailPage.test.tsx:37` y `PatrullaTipologia.test.tsx:52` por omisión de `tieneUnidadAsignada` y `estadoAsignacion` en mocks de `useAuth` | **ABIERTO** | 17/11/2026 00:14 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H37-PWA-02` | Integridad de UUIDs y cobertura del catálogo predeterminado offline frente a tabla `tipo_incidente` de `sgrai-api` | Integridad / Offline | Servicio / Contrato BD | Crítica | Caché IndexedDB vacío y dispositivo offline en frío | `CATALOGO_TIPOS_PREDETERMINADO` (`...0002`, `...0004`, `...0006`, `...0007`) contra `PATCH /api/incidentes/{id}/tipologia` | Cada UUID y nombre del respaldo local coincide 1:1 con los 11 registros activos de `tipo_incidente` | `...0002`, `...0004`, `...0005` y `...0006` apuntan a nombres distintos en BD y `...0007` produce `404 Not Found` (`"El tipo de incidente seleccionado no existe..."`) | **ABIERTO** | 17/11/2026 00:19 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H37-PWA-03` | Resiliencia de sincronización `outbox` para `ACTUALIZAR_TIPOLOGIA` ante `409 Conflict`, orden causal y preservación local | Offline / Concurrencia | Hook / Cola IndexedDB | Alta | Mutaciones `ACEPTAR_MISION` y `ACTUALIZAR_TIPOLOGIA` encoladas offline; fallo en aceptación seguido de `409` | `useConnectivity.ts` (`res.status === 409`), `offlineQueue.ts`, `sincronizarMisiones` | Ante `409` en `ACTUALIZAR_TIPOLOGIA` no se descarta silenciosamente la mutación, se detienen dependientes y `sincronizarMisiones` no pisa cambios pendientes | `useConnectivity.ts:63` marca `409` como `procesada = true` y elimina la tarea; `sincronizarMisiones` pisa `tipologia` con `limpiarTituloMision(titulo)`; banner offline menciona aceptación | **ABIERTO** | 17/11/2026 00:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H37-PWA-04` | Restricción RBAC `misiones:terreno:verificar` y validación de `incidenteId` UUID en pantalla de detalle y servicio | Seguridad / RBAC | UI / Servicio / Contexto | Alta | Misión `EN_CURSO` con `unidadActiva = true` y usuario sin `misiones:terreno:verificar` o sin `incidenteId` | `tienePermiso('misiones:terreno:verificar') = false` o `mision.incidenteId = ''` / `'inc-123'` | Se bloquea/oculta `EvaluacionTipologiaCard` si falta permiso o `incidenteId` UUID, y `tipologiaService` valida UUID de `incidenteId` | `page.tsx:287` renderiza el formulario habilitado sin verificar `tienePermisoVerificar` ni `incidenteId` UUID; `AuthContext:243` aplica *Fail-Open* con `permisos: []` | **ABIERTO** | 17/11/2026 00:15 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H37-PWA-05` | Sincronización de `src/types/api-generated.d.ts` con OpenAPI y consumo vía `openapi-fetch` (`apiClient`) | Contrato API / Arquitectura | Tipos / Servicio DAL | Media | Especificación OpenAPI activa en `sgrai-api` con `/api/incidentes/{id}/tipologia` | Inspección de `src/types/api-generated.d.ts`, `src/types/offline.ts` y `src/services/tipologiaService.ts` | Tipos generados con `npm run api:generate` sin tipos manuales y llamadas ejecutadas vía `apiClient` | `/api/incidentes/{id}/tipologia` y `?catalogo=true` ausentes en `api-generated.d.ts`; tipos manuales en `offline.ts` y uso de `fetch` directo en `tipologiaService.ts` | **ABIERTO** | 17/11/2026 00:14 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H37-PWA-06` | Evitar recarga redundante de catálogo al reclasificar y preselección segura cuando no hay coincidencia | Usabilidad / Rendimiento | UI / Componente | Media | `EvaluacionTipologiaCard` montado con catálogo cargado o tipología histórica sin coincidencia | Cambio de `misionActual.tipologia` tras guardar; `misionActual.tipologia = "Histórica"` | Carga única del catálogo al montar y opción placeholder neutra si no existe coincidencia exacta | `useEffect` con dependencia `[misionActual?.tipologia]` recarga el catálogo tras cada guardado y preselecciona `listaTipos[0].id` sin placeholder | **ABIERTO** | 17/11/2026 00:13 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H37-PWA-01` | Ocultamiento de la sección de categorización mientras la misión se encuentra en estado `DESPACHADA` | Regla de Negocio ICS | Integración UI | Crítica | Patrulla activa con misión en estado `DESPACHADA` | `misionDespachadaMock` (`estado: 'DESPACHADA'`) en `PatrullaTipologia.test.tsx` | Se exhibe botón `"Aceptar Misión"` y permanece oculto `"Categorización del incidente"` | Botón `"Aceptar Misión"` visible y texto `"Categorización del incidente"` ausente en DOM | **APROBADO** | 17/11/2026 00:20 | - | `test(patrulla): agregar pruebas unitarias y de integracion para categorizacion de tipologia (H37)` |
| `CP-H37-PWA-02` | Despliegue de `SeccionDesplegable` y `EvaluacionTipologiaCard` al encontrarse la misión en estado `EN_CURSO` | Funcional / UI | Integración UI | Crítica | Misión aceptada en estado `EN_CURSO` y patrulla activa | `misionEnCursoMock` (`estado: 'EN_CURSO'`) en `PatrullaTipologia.test.tsx` | Sección `"Categorización del incidente"` desplegada por defecto dentro de `"Formularios de Reporte Técnico"` | Encabezado `"Misión activa"` y sección desplegable `"Categorización del incidente"` renderizados abiertos | **APROBADO** | 17/11/2026 00:20 | - | `feat(ui): implementar SeccionDesplegable y redisenar pantalla de detalle a ancho completo con campos tactiles de 48px` |
| `CP-H37-PWA-03` | Carga online del catálogo oficial filtrando inactivos y persistencia automática en IndexedDB (`tipos_incidente`) | Funcional / Caché | Unitaria / Servicio | Alta | Navegador online (`navigator.onLine = true`) y respuesta API con 1 activo y 1 inactivo | `GET /api/incidentes/tipos?catalogo=true` con `{ activo: true }` y `{ activo: false }` | Retorna solo categorías con `activo !== false` e invoca `guardarCatalogoLocal('tipos_incidente', ...)` | Retorna 1 elemento activo (`"Inundación"`) e invoca `guardarCatalogoLocal` correctamente | **APROBADO** | 17/11/2026 00:20 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-04` | Recuperación del catálogo desde IndexedDB (`catalogos`) cuando el dispositivo opera sin conexión | Offline-First | Unitaria / Servicio | Alta | Navegador offline (`navigator.onLine = false`) y catálogo previamente cacheado en IndexedDB | `obtenerCatalogoLocal('tipos_incidente')` con arreglo local de tipos | Retorna la copia almacenada en IndexedDB sin intentar petición HTTP | Retorna exactamente la lista cacheada desde IndexedDB | **APROBADO** | 17/11/2026 00:20 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-05` | Selección interactiva de tipología y despliegue dinámico del alcance técnico (`helperText`) | Funcional / UX | Unitaria / Componente | Alta | `EvaluacionTipologiaCard` renderizado con catálogo oficial cargado | `fireEvent.change(select, { target: { value: '40000000-...-0001' } })` | El selector actualiza su valor y exhibe la descripción técnica correspondiente al ítem elegido | Cambia el texto auxiliar a `"Acumulación desmedida de agua"` inmediatamente tras la selección | **APROBADO** | 17/11/2026 00:20 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-06` | Validación de justificación obligatoria (`>= 5`, sin solo espacios, `<= 1000` chars) y contador dinámico | Validación / Borde | Unitaria / Zod y UI | Crítica | Formulario `EvaluacionTipologiaCard` y esquema `reclasificarTipologiaSchema` | Entradas `"abc"`, `"Test"`, `"      "`, `"a".repeat(1001)` y `"Evaluación técnica en terreno"` (29 chars) | Rechaza longitudes `< 5`, solo espacios y `> 1000`; muestra alerta en UI y contador `29 / 1000` | 6/6 pruebas Zod en `tipologia.test.ts` y pruebas de validación/contador en `EvaluacionTipologiaCard.test.tsx` aprobadas | **APROBADO** | 17/11/2026 00:20 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-07` | Reclasificación online exitosa (`200 OK`), actualización inmediata del encabezado de misión y mensaje de confirmación | Integración / Flujo | UI / Servicio | Crítica | Misión `EN_CURSO`, catálogo cargado y conectividad activa | `PATCH /api/incidentes/50000000-...-0001/tipologia` con `tipoIncidenteId: '40000000-...-0001'` y justificación válida | Emite feedback de éxito, actualiza `mision.tipologia` en la ficha superior y limpia el campo de justificación | Alerta `"Tipología del incidente reclasificada exitosamente en terreno."` desplegada y callback ejecutado | **APROBADO** | 17/11/2026 00:20 | - | `test(ui): agregar pruebas de SeccionDesplegable y actualizar tests de categorizacion y ordenamiento` |
| `CP-H37-PWA-08` | Encolamiento automático en `outbox` (`ACTUALIZAR_TIPOLOGIA`) ante modo offline o `TypeError: Failed to fetch` | Offline-First / Tolerancia | Unitaria / Servicio y UI | Crítica | `navigator.onLine = false` o rechazo de red `TypeError('Failed to fetch')` | `reclasificarTipologiaEnTerreno('inc-001', { tipoIncidenteId, justificacion }, misionMock)` | Encola `ACTUALIZAR_TIPOLOGIA` (`PATCH`), marca `sincronizacionPendiente: true`, actualiza `MisionLocal` y muestra alerta ámbar | Outbox invocado con `tipo: 'ACTUALIZAR_TIPOLOGIA'`, `offline: true` y alerta `"Tipología guardada localmente..."` | **APROBADO** | 17/11/2026 00:20 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-09` | Bloqueo completo de controles del formulario cuando la prop `deshabilitado` es `true` | Usabilidad / Seguridad | Unitaria / Componente | Media | `EvaluacionTipologiaCard` montado con `deshabilitado={true}` | `<EvaluacionTipologiaCard ... deshabilitado={true} />` | Selector `<select>`, campo `<textarea>` y botón `"Confirmar tipología"` en estado `disabled` | Los tres controles interactivos quedan deshabilitados en el DOM | **APROBADO** | 17/11/2026 00:20 | - | `test(patrulla): agregar pruebas unitarias y de integracion para categorizacion de tipologia (H37)` |
| `CP-H37-PWA-10` | Contrato HTTP real en `sgrai-api`: `GET /api/incidentes/tipos?catalogo=true` retorna catálogo oficial activo | Contrato API | Integración HTTP | Crítica | Servicio `sgrai-api` activo sobre PostgreSQL 16 con tabla `tipo_incidente` sembrada | `GET http://localhost:3001/api/incidentes/tipos?catalogo=true` | `HTTP 200 OK` con arreglo `data` de ítems `{ id, nombre, descripcion, activo: true }` | `HTTP 200 OK` retornando los 11 tipos oficiales activos (`Anegamiento` a `Otro`) | **APROBADO** | 17/11/2026 00:19 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-11` | Contrato HTTP real RBAC en `sgrai-api`: rechazo `401` sin sesión y `403` sin permiso `misiones:terreno:verificar` o patrulla ajena | Seguridad / RBAC | Integración HTTP | Crítica | Incidente `a1000000-...-0003` con misión `MIS-2026-0001` en `EN_CURSO` | `PATCH /api/incidentes/a1000000-...-0003/tipologia` sin headers, con `CALL_CENTER` (`...0002`) y con patrullero ajeno (`d1000000-...-0001`) | `401 Unauthorized` sin credenciales; `403 Forbidden` para `CALL_CENTER` y patrullero de otra unidad | `401` (`"Se requiere cabecera de autenticación..."`) y `403` (`"No cuenta con el permiso requerido: misiones:terreno:verificar"` / patrulla ajena) | **APROBADO** | 17/11/2026 00:19 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-12` | Contrato HTTP real en `sgrai-api`: rechazo `400` por justificación `< 5` chars y `409` en misión `DESPACHADA` | Validación / Negocio ICS | Integración HTTP | Alta | `INC-2026-0003` (`EN_CURSO`) e `INC-2026-0001` (`DESPACHADA`) | `justificacion: "abc"` sobre `INC-2026-0003`; payload válido sobre `INC-2026-0001` | `400 Bad Request` para justificación corta; `409 Conflict` exigiendo aceptar la misión previamente | `400 Bad Request` con error en `campo: "justificacion"` y `409 Conflict` indicando aceptar misión previamente | **APROBADO** | 17/11/2026 00:19 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-13` | Contrato HTTP real en `sgrai-api`: actualización de `incidente.tipo_incidente_id`, `tipo_afectacion` y registro en `mision_hito` | Persistencia / Transacción | Integración HTTP / BD | Crítica | `INC-2026-0003` asociado a `MIS-2026-0001` (`EN_CURSO`) | `PATCH /api/incidentes/a1000000-...-0003/tipologia` con `tipoIncidenteId: '40000000-...-0004'` | `200 OK` actualizando `incidente` y creando hito `"Tipología reclasificada en terreno a: ..."` en `mision_hito` | `200 OK` retornando `incidente.tipoAfectacion: "Anegamiento de calzada"` e `hito.hito: "TIPOLOGIA_RECLASIFICADA"` | **APROBADO** | 17/11/2026 00:19 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-14` | Emisión y suscripción en tiempo real del evento WebSocket `incidente:actualizado` hacia el Kanban en `sgrai-web` | Tiempo Real / Integración | Servicio / Socket.io | Alta | Inspección de `tipologia.service.ts` (`sgrai-api`) y `useEncargadoKanbanSocket.ts` (`sgrai-web`) | `notificarIncidenteActualizado({ id, codigo, tipoIncidenteId, tipoAfectacion, justificacion, ... })` | `sgrai-api` emite `incidente:actualizado` a `sala:encargados` y `sgrai-web` actualiza la tarjeta del Kanban reactivamente | Flujo emisor-receptor verificado en ambas aplicaciones con campos `tipoIncidenteId`, `tipoAfectacion` y `justificacion` | **APROBADO** | 17/11/2026 00:15 | - | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-15` | Cumplimiento de directrices UI de terreno (Flat UI `0px`, objetivo táctil `>= 48px`, `lucide-react` sin emojis) y manual H37 | Estándar UI / Docs | Estático / CSS y Docs | Media | Inspección de módulos CSS, componentes TSX y `docs/manuals/H37-patrulla-categorizar-incidente.md` | Verificación de `EvaluacionTipologiaCard.module.css`, `SeccionDesplegable.module.css`, `Select.module.css`, `Textarea.module.css` | `border-radius: 0px`, `min-height >= 48px` (`52px` botón, `56px` resumen), cero emojis, manual con sección offline y permisos | Cumplimiento visual verificado y manual H37 actualizado presente en `docs/manuals/` | **APROBADO** | 17/11/2026 00:15 | - | `docs(patrulla): actualizar manual H37 con cabecera y secciones desplegables` |
| `CP-H37-PWA-16` | Ejecución completa de suites Vitest del módulo HU-37 y análisis estático ESLint | Automatización / Calidad | Unit / Integración | Alta | Entorno Vitest y ESLint configurados en `sgrai-pwa` | `npx vitest run ...` (7 archivos HU-37) y `npm run lint` | 100% de pruebas unitarias/integración aprobadas y `0` errores en ESLint | 7/7 archivos (43/43 tests) y suite global 32/32 archivos (123/123 tests) aprobados; `npm run lint` con 0 errores | **APROBADO** | 17/11/2026 00:20 | - | `test(ui): agregar pruebas de SeccionDesplegable y actualizar tests de categorizacion y ordenamiento` |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H37-PWA-01	Verificación de tipado estático TypeScript y compilación de producción Next.js tras merge con develop	Compilación / CI	Estático / Build	Crítica	Rama feature/h37-patrulla-categorizar-incidente con dependencias instaladas	npx tsc --noEmit y npm run build	Ambos comandos finalizan con código de salida 0 sin errores de tipos	Falla con código 2 (TS2345) en PatrullaDetailPage.test.tsx:37 y PatrullaTipologia.test.tsx:52 por omisión de tieneUnidadAsignada y estadoAsignacion en mocks de useAuth	ABIERTO	17/11/2026 00:14	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H37-PWA-02	Integridad de UUIDs y cobertura del catálogo predeterminado offline frente a tabla tipo_incidente de sgrai-api	Integridad / Offline	Servicio / Contrato BD	Crítica	Caché IndexedDB vacío y dispositivo offline en frío	CATALOGO_TIPOS_PREDETERMINADO (...0002, ...0004, ...0006, ...0007) contra PATCH /api/incidentes/{id}/tipologia	Cada UUID y nombre del respaldo local coincide 1:1 con los 11 registros activos de tipo_incidente	...0002, ...0004, ...0005 y ...0006 apuntan a nombres distintos en BD y ...0007 produce 404 Not Found ("El tipo de incidente seleccionado no existe...")	ABIERTO	17/11/2026 00:19	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H37-PWA-03	Resiliencia de sincronización outbox para ACTUALIZAR_TIPOLOGIA ante 409 Conflict, orden causal y preservación local	Offline / Concurrencia	Hook / Cola IndexedDB	Alta	Mutaciones ACEPTAR_MISION y ACTUALIZAR_TIPOLOGIA encoladas offline; fallo en aceptación seguido de 409	useConnectivity.ts (res.status === 409), offlineQueue.ts, sincronizarMisiones	Ante 409 en ACTUALIZAR_TIPOLOGIA no se descarta silenciosamente la mutación, se detienen dependientes y sincronizarMisiones no pisa cambios pendientes	useConnectivity.ts:63 marca 409 como procesada = true y elimina la tarea; sincronizarMisiones pisa tipologia con limpiarTituloMision(titulo); banner offline menciona aceptación	ABIERTO	17/11/2026 00:15	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H37-PWA-04	Restricción RBAC misiones:terreno:verificar y validación de incidenteId UUID en pantalla de detalle y servicio	Seguridad / RBAC	UI / Servicio / Contexto	Alta	Misión EN_CURSO con unidadActiva = true y usuario sin misiones:terreno:verificar o sin incidenteId	tienePermiso('misiones:terreno:verificar') = false o mision.incidenteId = '' / 'inc-123'	Se bloquea/oculta EvaluacionTipologiaCard si falta permiso o incidenteId UUID, y tipologiaService valida UUID de incidenteId	page.tsx:287 renderiza el formulario habilitado sin verificar tienePermisoVerificar ni incidenteId UUID; AuthContext:243 aplica Fail-Open con permisos: []	ABIERTO	17/11/2026 00:15	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H37-PWA-05	Sincronización de src/types/api-generated.d.ts con OpenAPI y consumo vía openapi-fetch (apiClient)	Contrato API / Arquitectura	Tipos / Servicio DAL	Media	Especificación OpenAPI activa en sgrai-api con /api/incidentes/{id}/tipologia	Inspección de src/types/api-generated.d.ts, src/types/offline.ts y src/services/tipologiaService.ts	Tipos generados con npm run api:generate sin tipos manuales y llamadas ejecutadas vía apiClient	/api/incidentes/{id}/tipologia y ?catalogo=true ausentes en api-generated.d.ts; tipos manuales en offline.ts y uso de fetch directo en tipologiaService.ts	ABIERTO	17/11/2026 00:14	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H37-PWA-06	Evitar recarga redundante de catálogo al reclasificar y preselección segura cuando no hay coincidencia	Usabilidad / Rendimiento	UI / Componente	Media	EvaluacionTipologiaCard montado con catálogo cargado o tipología histórica sin coincidencia	Cambio de misionActual.tipologia tras guardar; misionActual.tipologia = "Histórica"	Carga única del catálogo al montar y opción placeholder neutra si no existe coincidencia exacta	useEffect con dependencia [misionActual?.tipologia] recarga el catálogo tras cada guardado y preselecciona listaTipos[0].id sin placeholder	ABIERTO	17/11/2026 00:13	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H37-PWA-01	Ocultamiento de la sección de categorización mientras la misión se encuentra en estado DESPACHADA	Regla de Negocio ICS	Integración UI	Crítica	Patrulla activa con misión en estado DESPACHADA	misionDespachadaMock (estado: 'DESPACHADA') en PatrullaTipologia.test.tsx	Se exhibe botón "Aceptar Misión" y permanece oculto "Categorización del incidente"	Botón "Aceptar Misión" visible y texto "Categorización del incidente" ausente en DOM	APROBADO	17/11/2026 00:20	-	test(patrulla): agregar pruebas unitarias y de integracion para categorizacion de tipologia (H37)
CP-H37-PWA-02	Despliegue de SeccionDesplegable y EvaluacionTipologiaCard al encontrarse la misión en estado EN_CURSO	Funcional / UI	Integración UI	Crítica	Misión aceptada en estado EN_CURSO y patrulla activa	misionEnCursoMock (estado: 'EN_CURSO') en PatrullaTipologia.test.tsx	Sección "Categorización del incidente" desplegada por defecto dentro de "Formularios de Reporte Técnico"	Encabezado "Misión activa" y sección desplegable "Categorización del incidente" renderizados abiertos	APROBADO	17/11/2026 00:20	-	feat(ui): implementar SeccionDesplegable y redisenar pantalla de detalle a ancho completo con campos tactiles de 48px
CP-H37-PWA-03	Carga online del catálogo oficial filtrando inactivos y persistencia automática en IndexedDB (tipos_incidente)	Funcional / Caché	Unitaria / Servicio	Alta	Navegador online (navigator.onLine = true) y respuesta API con 1 activo y 1 inactivo	GET /api/incidentes/tipos?catalogo=true con { activo: true } y { activo: false }	Retorna solo categorías con activo !== false e invoca guardarCatalogoLocal('tipos_incidente', ...)	Retorna 1 elemento activo ("Inundación") e invoca guardarCatalogoLocal correctamente	APROBADO	17/11/2026 00:20	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-04	Recuperación del catálogo desde IndexedDB (catalogos) cuando el dispositivo opera sin conexión	Offline-First	Unitaria / Servicio	Alta	Navegador offline (navigator.onLine = false) y catálogo previamente cacheado en IndexedDB	obtenerCatalogoLocal('tipos_incidente') con arreglo local de tipos	Retorna la copia almacenada en IndexedDB sin intentar petición HTTP	Retorna exactamente la lista cacheada desde IndexedDB	APROBADO	17/11/2026 00:20	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-05	Selección interactiva de tipología y despliegue dinámico del alcance técnico (helperText)	Funcional / UX	Unitaria / Componente	Alta	EvaluacionTipologiaCard renderizado con catálogo oficial cargado	fireEvent.change(select, { target: { value: '40000000-...-0001' } })	El selector actualiza su valor y exhibe la descripción técnica correspondiente al ítem elegido	Cambia el texto auxiliar a "Acumulación desmedida de agua" inmediatamente tras la selección	APROBADO	17/11/2026 00:20	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-06	Validación de justificación obligatoria (>= 5, sin solo espacios, <= 1000 chars) y contador dinámico	Validación / Borde	Unitaria / Zod y UI	Crítica	Formulario EvaluacionTipologiaCard y esquema reclasificarTipologiaSchema	Entradas "abc", "Test", "      ", "a".repeat(1001) y "Evaluación técnica en terreno" (29 chars)	Rechaza longitudes < 5, solo espacios y > 1000; muestra alerta en UI y contador 29 / 1000	6/6 pruebas Zod en tipologia.test.ts y pruebas de validación/contador en EvaluacionTipologiaCard.test.tsx aprobadas	APROBADO	17/11/2026 00:20	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-07	Reclasificación online exitosa (200 OK), actualización inmediata del encabezado de misión y mensaje de confirmación	Integración / Flujo	UI / Servicio	Crítica	Misión EN_CURSO, catálogo cargado y conectividad activa	PATCH /api/incidentes/50000000-...-0001/tipologia con tipoIncidenteId: '40000000-...-0001' y justificación válida	Emite feedback de éxito, actualiza mision.tipologia en la ficha superior y limpia el campo de justificación	Alerta "Tipología del incidente reclasificada exitosamente en terreno." desplegada y callback ejecutado	APROBADO	17/11/2026 00:20	-	test(ui): agregar pruebas de SeccionDesplegable y actualizar tests de categorizacion y ordenamiento
CP-H37-PWA-08	Encolamiento automático en outbox (ACTUALIZAR_TIPOLOGIA) ante modo offline o TypeError: Failed to fetch	Offline-First / Tolerancia	Unitaria / Servicio y UI	Crítica	navigator.onLine = false o rechazo de red TypeError('Failed to fetch')	reclasificarTipologiaEnTerreno('inc-001', { tipoIncidenteId, justificacion }, misionMock)	Encola ACTUALIZAR_TIPOLOGIA (PATCH), marca sincronizacionPendiente: true, actualiza MisionLocal y muestra alerta ámbar	Outbox invocado con tipo: 'ACTUALIZAR_TIPOLOGIA', offline: true y alerta "Tipología guardada localmente..."	APROBADO	17/11/2026 00:20	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-09	Bloqueo completo de controles del formulario cuando la prop deshabilitado es true	Usabilidad / Seguridad	Unitaria / Componente	Media	EvaluacionTipologiaCard montado con deshabilitado={true}	<EvaluacionTipologiaCard ... deshabilitado={true} />	Selector select, campo textarea y botón "Confirmar tipología" en estado disabled	Los tres controles interactivos quedan deshabilitados en el DOM	APROBADO	17/11/2026 00:20	-	test(patrulla): agregar pruebas unitarias y de integracion para categorizacion de tipologia (H37)
CP-H37-PWA-10	Contrato HTTP real en sgrai-api: GET /api/incidentes/tipos?catalogo=true retorna catálogo oficial activo	Contrato API	Integración HTTP	Crítica	Servicio sgrai-api activo sobre PostgreSQL 16 con tabla tipo_incidente sembrada	GET http://localhost:3001/api/incidentes/tipos?catalogo=true	HTTP 200 OK con arreglo data de ítems { id, nombre, descripcion, activo: true }	HTTP 200 OK retornando los 11 tipos oficiales activos (Anegamiento a Otro)	APROBADO	17/11/2026 00:19	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-11	Contrato HTTP real RBAC en sgrai-api: rechazo 401 sin sesión y 403 sin permiso misiones:terreno:verificar o patrulla ajena	Seguridad / RBAC	Integración HTTP	Crítica	Incidente a1000000-...-0003 con misión MIS-2026-0001 en EN_CURSO	PATCH /api/incidentes/a1000000-...-0003/tipologia sin headers, con CALL_CENTER (...0002) y con patrullero ajeno (d1000000-...-0001)	401 Unauthorized sin credenciales; 403 Forbidden para CALL_CENTER y patrullero de otra unidad	401 ("Se requiere cabecera de autenticación...") y 403 ("No cuenta con el permiso requerido: misiones:terreno:verificar" / patrulla ajena)	APROBADO	17/11/2026 00:19	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-12	Contrato HTTP real en sgrai-api: rechazo 400 por justificación < 5 chars y 409 en misión DESPACHADA	Validación / Negocio ICS	Integración HTTP	Alta	INC-2026-0003 (EN_CURSO) e INC-2026-0001 (DESPACHADA)	justificacion: "abc" sobre INC-2026-0003; payload válido sobre INC-2026-0001	400 Bad Request para justificación corta; 409 Conflict exigiendo aceptar la misión previamente	400 Bad Request con error en campo: "justificacion" y 409 Conflict indicando aceptar misión previamente	APROBADO	17/11/2026 00:19	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-13	Contrato HTTP real en sgrai-api: actualización de incidente.tipo_incidente_id, tipo_afectacion y registro en mision_hito	Persistencia / Transacción	Integración HTTP / BD	Crítica	INC-2026-0003 asociado a MIS-2026-0001 (EN_CURSO)	PATCH /api/incidentes/a1000000-...-0003/tipologia con tipoIncidenteId: '40000000-...-0004'	200 OK actualizando incidente y creando hito "Tipología reclasificada en terreno a: ..." en mision_hito	200 OK retornando incidente.tipoAfectacion: "Anegamiento de calzada" e hito.hito: "TIPOLOGIA_RECLASIFICADA"	APROBADO	17/11/2026 00:19	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-14	Emisión y suscripción en tiempo real del evento WebSocket incidente:actualizado hacia el Kanban en sgrai-web	Tiempo Real / Integración	Servicio / Socket.io	Alta	Inspección de tipologia.service.ts (sgrai-api) y useEncargadoKanbanSocket.ts (sgrai-web)	notificarIncidenteActualizado({ id, codigo, tipoIncidenteId, tipoAfectacion, justificacion, ... })	sgrai-api emite incidente:actualizado a sala:encargados y sgrai-web actualiza la tarjeta del Kanban reactivamente	Flujo emisor-receptor verificado en ambas aplicaciones con campos tipoIncidenteId, tipoAfectacion y justificacion	APROBADO	17/11/2026 00:15	-	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-15	Cumplimiento de directrices UI de terreno (Flat UI 0px, objetivo táctil >= 48px, lucide-react sin emojis) y manual H37	Estándar UI / Docs	Estático / CSS y Docs	Media	Inspección de módulos CSS, componentes TSX y docs/manuals/H37-patrulla-categorizar-incidente.md	Verificación de EvaluacionTipologiaCard.module.css, SeccionDesplegable.module.css, Select.module.css, Textarea.module.css	border-radius: 0px, min-height >= 48px (52px botón, 56px resumen), cero emojis, manual con sección offline y permisos	Cumplimiento visual verificado y manual H37 actualizado presente en docs/manuals/	APROBADO	17/11/2026 00:15	-	docs(patrulla): actualizar manual H37 con cabecera y secciones desplegables
CP-H37-PWA-16	Ejecución completa de suites Vitest del módulo HU-37 y análisis estático ESLint	Automatización / Calidad	Unit / Integración	Alta	Entorno Vitest y ESLint configurados en sgrai-pwa	npx vitest run ... (7 archivos HU-37) y npm run lint	100% de pruebas unitarias/integración aprobadas y 0 errores en ESLint	7/7 archivos (43/43 tests) y suite global 32/32 archivos (123/123 tests) aprobados; npm run lint con 0 errores	APROBADO	17/11/2026 00:20	-	test(ui): agregar pruebas de SeccionDesplegable y actualizar tests de categorizacion y ordenamiento
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Verificación de Tipado Estático, Build de Producción y Análisis ESLint (`BUG-H37-PWA-01`)

**Comandos ejecutados:**
```bash
npm run lint
npx tsc --noEmit
npm run build
```

**Evidencia real obtenida en consola:**
```text
✖ 4 problems (0 errors, 4 warnings)
```
```text
src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx:37:56 - error TS2345: Argument of type '...' is not assignable to parameter of type 'AuthContextValue'.
  Type '...' is missing the following properties from type 'AuthContextValue': tieneUnidadAsignada, estadoAsignacion

src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaTipologia.test.tsx:52:56 - error TS2345: Argument of type '...' is not assignable to parameter of type 'AuthContextValue'.
  Type '...' is missing the following properties from type 'AuthContextValue': tieneUnidadAsignada, estadoAsignacion

Found 2 errors in 2 files.
```
```text
▲ Next.js 16.3.4 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 94ms

  Creating an optimized production build ...
✓ Compiled successfully in 2.3s
Failed to type check.
```

---

### 5.2 Ejecución de Pruebas Automatizadas en Vitest (`CP-H37-PWA-01` a `CP-H37-PWA-09`, `CP-H37-PWA-16`)

#### 5.2.1 Suite Completa del Repositorio y Suites Específicas de HU-37
```bash
npm test
```
```text
 Test Files  32 passed (32)
      Tests  123 passed (123)
   Start at  00:13:48
   Duration  7.09s (transform 3.91s, setup 9.65s, collect 13.32s, tests 10.25s, environment 42.34s, prepare 4.48s)
```

```bash
npx vitest run \
  src/lib/validations/__tests__/tipologia.test.ts \
  src/services/__tests__/tipologiaService.test.ts \
  src/components/misiones/__tests__/EvaluacionTipologiaCard.test.tsx \
  src/app/\(terreno\)/patrulla/misiones/\[id\]/__tests__/PatrullaTipologia.test.tsx \
  src/components/ui/__tests__/SeccionDesplegable.test.tsx \
  src/lib/utils/__tests__/formatters.test.ts \
  src/lib/utils/__tests__/labels.test.ts
```
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app

 ✓ src/lib/utils/__tests__/labels.test.ts (5 tests) 4ms
 ✓ src/lib/utils/__tests__/formatters.test.ts (10 tests) 6ms
 ✓ src/lib/validations/__tests__/tipologia.test.ts (6 tests) 6ms
 ✓ src/services/__tests__/tipologiaService.test.ts (8 tests) 27ms
 ✓ src/components/ui/__tests__/SeccionDesplegable.test.tsx (4 tests) 143ms
 ✓ src/components/misiones/__tests__/EvaluacionTipologiaCard.test.tsx (7 tests) 328ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaTipologia.test.tsx (3 tests) 305ms

 Test Files  7 passed (7)
      Tests  43 passed (43)
   Start at  00:20:43
   Duration  1.98s
```

#### 5.2.2 Comandos Individuales por Suite con Filtro `-t`
```bash
# Validación Zod de reclasificación (6 tests)
npm test -- -t "reclasificarTipologiaSchema \(H37\)"

# Servicio de catálogo y reclasificación online/offline (8 tests)
npm test -- -t "tipologiaService \(H37\)"

# Componente de formulario EvaluacionTipologiaCard (7 tests)
npm test -- -t "EvaluacionTipologiaCard \(H37\)"

# Integración en página de detalle de misión de patrulla (3 tests)
npm test -- -t "PatrullaMisionDetailPage — Categorización de Tipología en Terreno \(H37\)"

# Componente SeccionDesplegable (4 tests)
npm test -- -t "SeccionDesplegable"
```

**Salidas observadas:**
```text
 ✓ src/lib/validations/__tests__/tipologia.test.ts (6 tests) 6ms
 Test Files  1 passed | 31 skipped (32) — Tests  6 passed | 117 skipped (123) — Duration  5.34s

 ✓ src/services/__tests__/tipologiaService.test.ts (8 tests) 50ms
 Test Files  1 passed | 31 skipped (32) — Tests  8 passed | 115 skipped (123) — Duration  5.44s

 ✓ src/components/misiones/__tests__/EvaluacionTipologiaCard.test.tsx (7 tests) 429ms
 Test Files  1 passed | 31 skipped (32) — Tests  7 passed | 116 skipped (123) — Duration  5.49s

 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaTipologia.test.tsx (3 tests) 292ms
 Test Files  1 passed | 31 skipped (32) — Tests  3 passed | 120 skipped (123) — Duration  5.71s

 ✓ src/components/ui/__tests__/SeccionDesplegable.test.tsx (4 tests) 248ms
 Test Files  1 passed | 31 skipped (32) — Tests  4 passed | 119 skipped (123) — Duration  5.39s
```

---

### 5.3 Pruebas de Contrato Real con cURL sobre `sgrai-api` (`CP-H37-PWA-10` a `CP-H37-PWA-13` y `BUG-H37-PWA-02`)

#### Caso 1: Consulta del Catálogo Oficial de Tipos de Incidente (`200 OK` — `CP-H37-PWA-10`)
```bash
curl -s -i "http://localhost:3001/api/incidentes/tipos?catalogo=true"
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Catálogo oficial de tipos de incidente obtenido exitosamente.","data":[{"id":"a0000000-0000-4000-8000-000000000001","nombre":"Anegamiento","descripcion":"Acumulación de aguas lluvias en vías o propiedades","activo":true},{"id":"40000000-0000-4000-8000-000000000004","nombre":"Anegamiento de calzada","descripcion":"Saturación de sumideros y acumulación de aguas lluvias en vías públicas","activo":true},{"id":"40000000-0000-4000-8000-000000000003","nombre":"Caída de árbol","descripcion":"Obstrucción de vías o afectación a viviendas y tendido eléctrico por caída de árboles","activo":true},{"id":"a0000000-0000-4000-8000-000000000006","nombre":"Corte de agua potable","descripcion":"Corte o rotura matriz en la red de agua potable","activo":true},{"id":"a0000000-0000-4000-8000-000000000003","nombre":"Corte de energía","descripcion":"Interrupción del suministro eléctrico o peligro por cables caídos","activo":true},{"id":"a0000000-0000-4000-8000-000000000005","nombre":"Daño estructural","descripcion":"Colapso parcial o daño grave en techumbre, muros o edificaciones","activo":true},{"id":"a0000000-0000-4000-8000-000000000004","nombre":"Deslizamiento","descripcion":"Movimiento de laderas, socavón o remoción de terreno","activo":true},{"id":"40000000-0000-4000-8000-000000000002","nombre":"Deslizamiento de tierra","descripcion":"Movimiento de masa de suelo o laderas en zonas de riesgo","activo":true},{"id":"40000000-0000-4000-8000-000000000005","nombre":"Incendio estructural / forestal","descripcion":"Focos de fuego en estructuras o vegetación urbana/rural","activo":true},{"id":"40000000-0000-4000-8000-000000000001","nombre":"Inundación","descripcion":"Acumulación desmedida de agua por crecida de ríos o lluvias torrenciales","activo":true},{"id":"40000000-0000-4000-8000-000000000006","nombre":"Otro","descripcion":"Cualquier otro incidente que requiera atención de emergencia municipal","activo":true}]}
```

#### Caso 2: Rechazo por Falta de Credenciales (`401 Unauthorized` — `CP-H37-PWA-11`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Inundacion constatada en terreno"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

#### Caso 3: Rechazo RBAC sin Permiso `misiones:terreno:verificar` (`403 Forbidden` — `CP-H37-PWA-11`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000002" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Inundacion constatada en terreno"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}
```

#### Caso 4: Rechazo de Autorización Horizontal por Patrulla Ajena (`403 Forbidden` — `CP-H37-PWA-11`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -H "x-user-id: d1000000-0000-4000-8000-000000000001" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Prueba acceso horizontal otra patrulla"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No está autorizado para reclasificar la tipología de un incidente asignado a otra patrulla verificadora."}
```

#### Caso 5: Rechazo por Justificación Menor a 5 Caracteres (`400 Bad Request` — `CP-H37-PWA-12`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"abc"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"message":"Datos de entrada inválidos para la reclasificación de tipología.","errors":[{"campo":"justificacion","mensaje":"La justificación debe contener al menos 5 caracteres."}]}
```

#### Caso 6: Evidencia de Defecto `BUG-H37-PWA-02` — UUID Inexistente `...0007` de `CATALOGO_TIPOS_PREDETERMINADO` (`404 Not Found`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000007","justificacion":"Corte de suministros criticos desde catalogo predeterminado"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 404 Not Found
content-type: application/json

{"message":"El tipo de incidente seleccionado no existe en el catálogo oficial."}
```

#### Caso 7: Rechazo por Misión Aún en Estado `DESPACHADA` (`409 Conflict` — `CP-H37-PWA-12`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000001/tipologia" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Intento sin aceptar mision previamente"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
content-type: application/json

{"message":"La patrulla debe aceptar la misión asignada antes de poder reclasificar la tipología del incidente."}
```

#### Caso 8: Reclasificación Exitosa y Evidencia de Mapeo Cruzado de `...0004` (`200 OK` — `CP-H37-PWA-13` / `BUG-H37-PWA-02`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000004","justificacion":"Evaluacion presencial constata deslizamiento y anegamiento en ruta T-350","misionId":"d1000000-0000-4000-8000-000000000001"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Tipología del incidente reclasificada exitosamente en terreno.","data":{"incidente":{"id":"a1000000-0000-4000-8000-000000000003","codigo":"INC-2026-0003","tipoIncidenteId":"40000000-0000-4000-8000-000000000004","tipoAfectacion":"Anegamiento de calzada","estado":"VERIFICANDO","prioridad":"CRITICA","actualizadoEn":"2026-11-17T03:19:54.437Z"},"hito":{"id":"06ec3a34-43bf-4394-a519-7c4e4dee8016","misionId":"d1000000-0000-4000-8000-000000000001","hito":"TIPOLOGIA_RECLASIFICADA","descripcion":"Tipología reclasificada en terreno a: Anegamiento de calzada. Justificación: Evaluacion presencial constata deslizamiento y anegamiento en ruta T-350","registradoPorId":"00000000-0000-4000-8000-000000000001","creadoEn":"2026-11-17T03:19:54.437Z"}}}
```
*(Nota técnica: en `sgrai-pwa`, `CATALOGO_TIPOS_PREDETERMINADO` etiqueta el UUID `...0004` como `"Derrumbe / Remoción en masa"`, evidenciando la corrupción cruzada respecto a `"Anegamiento de calzada"` en la base de datos).*

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (CA)

| Criterio de Aceptación (CA) | Casos Asociados | Estado QA (`sgrai-pwa`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La pantalla de evaluación en la PWA debe proveer un selector desplegable con las categorías oficiales de incidentes. | `CP-H37-PWA-01`, `CP-H37-PWA-02`, `CP-H37-PWA-15`, `BUG-H37-PWA-01`, `BUG-H37-PWA-06` | 🟡 **PARCIAL (`BUG-H37-PWA-01`, `BUG-H37-PWA-06`)** | `EvaluacionTipologiaCard` renderiza el selector `<Select>` dentro de `SeccionDesplegable` únicamente cuando la misión está `EN_CURSO`, pero el proyecto falla en `tsc`/`next build` (`BUG-H37-PWA-01`), carece de búsqueda rápida y preselecciona silenciosamente el primer ítem sin coincidencia (`BUG-H37-PWA-06`). |
| **CA-2:** El selector debe alimentarse del catálogo oficial `GET /api/incidentes/tipos` (ej. Inundación, Caída de árbol, Derrumbe, Incendio estructural, etc.). | `CP-H37-PWA-03`, `CP-H37-PWA-04`, `CP-H37-PWA-10`, `BUG-H37-PWA-02`, `BUG-H37-PWA-05`, `BUG-H37-PWA-06` | 🔴 **CON DEFECTO (`BUG-H37-PWA-02`, `BUG-H37-PWA-05`)** | En modo online consulta `GET /api/incidentes/tipos?catalogo=true` con caché en IndexedDB, pero el respaldo offline `CATALOGO_TIPOS_PREDETERMINADO` tiene UUIDs cruzados y un UUID inexistente (`BUG-H37-PWA-02`), además de omitir el parámetro/esquema en `api-generated.d.ts` (`BUG-H37-PWA-05`). |
| **CA-3:** La patrulla debe poder seleccionar el tipo que mejor describe la situación real constatada en terreno. | `CP-H37-PWA-05`, `CP-H37-PWA-06`, `CP-H37-PWA-07`, `CP-H37-PWA-08`, `BUG-H37-PWA-03`, `BUG-H37-PWA-06` | 🟡 **PARCIAL (`BUG-H37-PWA-03`, `BUG-H37-PWA-06`)** | Permite seleccionar tipo, validar justificación `>= 5` caracteres y guardar online/offline; sin embargo, ante fallo causal y `409 Conflict` al sincronizar `outbox`, la mutación `ACTUALIZAR_TIPOLOGIA` se pierde silenciosamente y `sincronizarMisiones` pisa la tipología local (`BUG-H37-PWA-03`). |
| **CA-4:** Al guardar, el sistema debe actualizar el campo `incidente.tipo_incidente_id` en la base de datos. | `CP-H37-PWA-07`, `CP-H37-PWA-13`, `BUG-H37-PWA-02`, `BUG-H37-PWA-05` | 🟡 **PARCIAL (`BUG-H37-PWA-02`, `BUG-H37-PWA-05`)** | Verificado en `sgrai-api` (`200 OK` sobre `incidente.tipo_incidente_id` y `tipo_afectacion`), pero la PWA no usa `apiClient` (`openapi-fetch`) ni el contrato generado (`BUG-H37-PWA-05`), y el fallback offline puede enviar UUIDs cruzados o inexistentes (`BUG-H37-PWA-02`). |
| **CA-5:** Se debe registrar automáticamente un hito en `mision_hito` indicando: `'Tipología reclasificada en terreno a: [Nombre del Tipo]'`. | `CP-H37-PWA-13` | 🟢 **CUMPLIDO** | Verificado vía integración real contra `sgrai-api`: persiste `TIPOLOGIA_RECLASIFICADA` con la glosa `'Tipología reclasificada en terreno a: [Nombre del Tipo]. Justificación: [Texto]'` en `mision_hito` y `tipologiaService.ts` guarda la referencia en `datosAdicionales.hitoReclasificacion`. |
| **CA-6:** El sistema debe emitir la notificación WebSocket `incidente:actualizado` al Centro de Mando para actualizar la tarjeta en el tablero Kanban. | `CP-H37-PWA-14` | 🟢 **CUMPLIDO** | `sgrai-api` (`tipologia.service.ts`) invoca `notificarIncidenteActualizado` tras la transacción ACID y `sgrai-web` (`useEncargadoKanbanSocket.ts`) escucha `incidente:actualizado` actualizando la tarjeta Kanban reactivamente. |
| **CA-7:** El endpoint de actualización debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H37-PWA-11`, `BUG-H37-PWA-04` | 🔴 **CON DEFECTO (`BUG-H37-PWA-04`)** | El backend `sgrai-api` exige estrictamente `misiones:terreno:verificar` (`401`/`403`), pero en la PWA `PatrullaMisionDetailPage` renderiza `EvaluacionTipologiaCard` sin comprobar `tienePermisoVerificar`, no valida `incidenteId` UUID y `AuthContext.tienePermiso` aplica política *Fail-Open* ante `permisos: []`. |


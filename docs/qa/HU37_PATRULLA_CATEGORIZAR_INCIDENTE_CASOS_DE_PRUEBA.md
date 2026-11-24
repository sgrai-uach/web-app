# Informe de Auditoría Técnica, Re-Test y Matriz de Casos de Prueba (QA): HU-37 — Categorizar o Corregir la Tipología del Incidente tras Evaluación en Terreno (PWA)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Cliente Móvil de Terreno (PWA)**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Operaciones de Terreno / Patrulla Verificadora (`sgrai-pwa` — `/terreno/patrulla/misiones/[id]`).  
> **Historia de Usuario:** HU-37 — *"Como Patrulla verificadora Quiero categorizar o corregir la tipología del incidente tras la evaluación presencial en terreno Para asegurar un registro técnico fidedigno de la naturaleza real de la emergencia, corrigiendo clasificaciones inexactas hechas por informantes ciudadanos."*  
> **Desarrollador Asignado:** zetastormy  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Aplicación Auditada:** `sgrai-pwa` (`web-app` — Next.js 16.3.4 App Router + React 19.2.8 + TypeScript 5 + IndexedDB `idb` 8.0.2 + Zod + `openapi-fetch` 0.17.0 + Vitest 3.2.7 + React Testing Library).  
> **Rama Git Evaluada:** `feature/h37-patrulla-categorizar-incidente`  
> **Commits Evaluados en el Ciclo de Re-Test (Conventional Commits):**  
> * `chore(api): regenerar tipos OpenAPI y derivar contratos de tipología`  
> * `fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs`  
> * `fix(offline): respetar orden causal por misión y preservar cambios pendientes en outbox`  
> * `fix(terreno): aplicar RBAC fail-closed y desacoplar carga de catálogo con placeholder neutro`  
> * `test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA`  
> * `merge: rama 'feature/h37-patrulla-categorizar-incidente' de github.com:sgrai-uach/web-app hacia feature/h37-patrulla-categorizar-incidente`  
> * `Merge branch 'develop' into feature/h37-patrulla-categorizar-incidente`  
> * `docs(qa): actualizar casos de prueba con re-test esperando a corregir problemas`  
> * `fix(offline): preservar tipología offline en misiones EN_CURSO y revertir ante errores irrecuperables (BUG-H37-PWA-03)`  
> * `test(offline): agregar pruebas de preservación EN_CURSO y reversión de ACTUALIZAR_TIPOLOGIA (BUG-H37-PWA-03)`  
>  
> **Fecha de Auditoría Inicial:** 17/11/2026 00:22.  
> **Fecha de Ciclo Re-Test 1:** 18/11/2026 14:46.  
> **Fecha de Ciclo Re-Test 2 (Cierre Final):** 18/11/2026 21:47.  
> **Estado de Certificación:** 🟢 **APROBADO EN RE-TEST (`6` de `6` Defectos Corregidos; `24/24` Casos Aprobados — `100.0%`)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica y Re-Test

Tras ejecutar el segundo ciclo formal de **Re-Test** sobre la rama `feature/h37-patrulla-categorizar-incidente` en el repositorio `sgrai-pwa` (`web-app`) luego de incorporarse los commits de remediación para `BUG-H37-PWA-03`, incluyendo verificación de compilación TypeScript (`tsc --noEmit`), build de producción Next.js (`npm run build`), análisis estático ESLint (`npm run lint`) y ejecución completa y focalizada de la suite en Vitest (`182/182` pruebas), se certifica la resolución íntegra de los **6 defectos detectados** (`BUG-H37-PWA-01` a `BUG-H37-PWA-06`), el cumplimiento total de los **7 Criterios de Aceptación** y la aprobación del **100.0%** de los casos de prueba.

En particular, para cerrar **`BUG-H37-PWA-03`** se verificó la eliminación del vaciado previo de IndexedDB (`limpiarMisionesLocales()`) antes de `guardarMisionesLocales(remotas)`, la depuración selectiva de misiones obsoletas sin pendientes en la cola `outbox`, la extensión de `mantenerOptimista` en `sincronizarMisiones` y `obtenerDetalleMision` a misiones en estado `EN_CURSO` con acciones `ACTUALIZAR_TIPOLOGIA` o `ACEPTAR_MISION` pendientes en `outbox`, y la reversión controlada del estado local junto al refresco desde el servidor en `useConnectivity.ts` frente a errores HTTP irrecuperables (`400`, `403`, `404`, `422`).

| Métrica de Calidad | Auditoría Inicial (17/11) | Re-Test 1 (18/11 14:46) | Re-Test 2 Final (18/11 21:47) | Observaciones Técnicas |
|---|:---:|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **22** | **24** | **24** | 6 Defectos Auditados (`BUG-H37-PWA-01` a `06`) + 18 Casos Funcionales, Offline, RBAC, UI y Contrato (`CP-H37-PWA-01` a `18`) |
| **Casos Aprobados / Corregidos (Passed)** | **16** | **23** | 🟢 **24** | 6 defectos cerrados (`CORREGIDO`) + 18 casos funcionales, offline, RBAC y API aprobados (`APROBADO`) |
| **Defectos Abiertos / Fallidos (Failed)** | **6** (2 críticos, 2 altos, 2 medios) | **1** (1 alto) | 🟢 **0** | Sin defectos abiertos ni bloqueantes en la rama |
| **Casos Bloqueados (Blocked)** | **0** | **0** | **0** | Sin bloqueos de infraestructura externa |
| **Tasa de Aprobación (% Pass)** | **72.7%** | **95.8%** | 🟢 **100.0%** | Criterio de salida cumplido para integración mediante Merge/PR a `develop` |
| **Suite Automatizada Global (Vitest)** | 32/32 archivos (123 tests) | 38/38 archivos (178 tests) | 🟢 **38/38 archivos (182 tests)** | Ejecución con mocks de API y `fake-indexeddb`; `+4` pruebas nuevas dedicadas a `BUG-H37-PWA-03` |
| **Análisis Estático ESLint (`npm run lint`)** | 0 errores (4 warnings) | 0 errores (1 warning) | 🟢 **0 errores (1 warning)** | 1 advertencia preexistente en `TerrenoResumenOperativo.tsx` |
| **Chequeo de Tipos (`npx tsc --noEmit`)** | 🔴 2 errores (`exit code 2`) | 0 errores (`exit code 0`) | 🟢 **0 errores (`exit code 0`)** | Compilación estricta TypeScript sin errores |
| **Compilación de Producción (`npm run build`)** | 🔴 Fallido (`Failed to type check.`) | Exitoso (`exit code 0`) | 🟢 **Exitoso (`exit code 0`)** | Compilación Webpack (`4.0s`), TypeScript (`4.4s`) y generación de rutas estáticas (`8/8`) sin errores |

---

## 2. Registro Técnico de Defectos y Verificación de Soluciones en Re-Test

### `BUG-H37-PWA-01`: Fallo de Compilación TypeScript (`tsc --noEmit`) y Ruptura del Build de Producción (`npm run build`) por Mocks Incompletos de `AuthContextValue` tras Merge con `develop`
* **Severidad:** **CRÍTICA** (Bloqueo Total de CI/CD y Construcción de Imagen Docker).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaTipologia.test.tsx` (Líneas 51-84)
  * `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx`
* **Commit de Solución:** `test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA`
* **Verificación Técnica en Re-Test:**  
  1. Se incorporaron `tieneUnidadAsignada`, `estadoAsignacion` y `actualizarUnidadAsignada` en el objeto mock retornado por `configurarAuth` (`PatrullaTipologia.test.tsx:73-75`) y `configurarAuthMock` (`PatrullaDetailPage.test.tsx`).
  2. La ejecución de `npx tsc --noEmit` y `npm run build` (`next build --webpack`) finalizó con código de salida `0` y sin errores de tipado.

---

### `BUG-H37-PWA-02`: Corrupción Cruzada de UUIDs e Ítem Inexistente en `CATALOGO_TIPOS_PREDETERMINADO` Frente a la Tabla `tipo_incidente` de `sgrai-api`
* **Severidad:** **CRÍTICA** (Integridad de Datos Operativos en Terreno y Fallo `404` Irreversible en Sincronización Offline).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/services/tipologiaService.ts` (Líneas 32-99)
  * `src/services/misionesService.ts` (Líneas 204-206)
  * `src/services/__tests__/tipologiaService.test.ts` (Líneas 54-67)
* **Commit de Solución:** `fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs`
* **Verificación Técnica en Re-Test:**  
  1. `CATALOGO_TIPOS_PREDETERMINADO` en `src/services/tipologiaService.ts:32-99` fue sincronizado 1:1 con los 11 registros activos reales de la tabla `tipo_incidente` devueltos por `GET /api/incidentes/tipos?catalogo=true` (`40000000-...-0001` a `0006` y `a0000000-...-0001, 0003..0006`), eliminando el UUID inexistente `...0007`.
  2. `sincronizarMisiones` (`misionesService.ts:204`) precarga silenciosamente el catálogo oficial en IndexedDB al sincronizar la bandeja.
  3. Verificado mediante prueba unitaria dedicada en `tipologiaService.test.ts` y contraste directo contra la respuesta real `200 OK` de `GET http://localhost:3001/api/incidentes/tipos?catalogo=true`.

---

### `BUG-H37-PWA-03`: Pérdida Silenciosa de Reclasificación en Cola Offline ante `409 Conflict`, Desincronización Causal en `outbox` y Sobreescritura en Bandeja de Misiones
* **Severidad:** **ALTA** (Pérdida de Consistencia Offline-First en IndexedDB).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/services/misionesService.ts` (Líneas 144-185, 210-275, 300-358)
  * `src/services/offlineQueue.ts` (Líneas 68-134, 244-299)
  * `src/hooks/useConnectivity.ts` (Líneas 80-173)
  * `src/services/__tests__/misionesService.test.ts` (Líneas 117-197, 278-357)
  * `src/services/__tests__/offlineQueue.test.ts` (Líneas 179-229)
  * `src/hooks/__tests__/useConnectivity.test.ts` (Líneas 82-148)
  * `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (Líneas 342-345)
* **Commits de Solución:**
  * `fix(offline): respetar orden causal por misión y preservar cambios pendientes en outbox`
  * `fix(offline): preservar tipología offline en misiones EN_CURSO y revertir ante errores irrecuperables (BUG-H37-PWA-03)`
  * `test(offline): agregar pruebas de preservación EN_CURSO y reversión de ACTUALIZAR_TIPOLOGIA (BUG-H37-PWA-03)`
* **Verificación Técnica en Re-Test:**  
  1. **Preservación atómica en `sincronizarMisiones` y `guardarMisionesLocales`:** Se eliminó la invocación previa a `limpiarMisionesLocales()` antes de `guardarMisionesLocales(remotas)` en `src/services/misionesService.ts`, y `guardarMisionesLocales` (`src/services/offlineQueue.ts:96-107`) depura misiones ausentes en la respuesta remota dentro de la misma transacción IndexedDB únicamente cuando `!tienePendienteExistente`.
  2. **Conservación optimista en misiones `EN_CURSO`:** Tanto `sincronizarMisiones` (`misionesService.ts:210-230`) como `obtenerDetalleMision` (`misionesService.ts:300-315`) consultan `obtenerReferenciasOutboxPendientes()` en la cola `outbox` y amplían `mantenerOptimista` a los estados `DESPACHADA` y `EN_CURSO`, conservando `tipologia`, `datosAdicionales` y `sincronizacionPendiente: true` mientras exista una acción `ACTUALIZAR_TIPOLOGIA` o `ACEPTAR_MISION` pendiente.
  3. **Reversión ante error irrecuperable y bloqueo causal:** En `useConnectivity.ts:140-172`, si `ACTUALIZAR_TIPOLOGIA` recibe `esConflictoTerminal || esErrorIrrecuperable` (`400`, `403`, `404`, `422`), limpia las propiedades locales de evaluación (`tipologiaEvaluada`, `tipoIncidenteId`, `justificacionTipologia`, `fechaEvaluacionTipologia`, `esReclasificacion`), fija `sincronizacionPendiente: false`, elimina la acción en `outbox` y refresca la ficha real mediante `obtenerDetalleMision`. Se mantiene además `clavesBloqueadas` en `sincronizarColaOutbox` para frenar mutaciones dependientes cuando una acción previa de la misma misión falla.
  4. **Cobertura automatizada:** Verificado con 4 pruebas unitarias dedicadas (`npm test -- -t "BUG-H37-PWA-03"`, `4 passed`) en `useConnectivity.test.ts`, `offlineQueue.test.ts` y `misionesService.test.ts`. *(Observación no bloqueante: siguiendo la regla validada en `useConnectivity.test.ts:54`, `res.status === 409` en `ACTUALIZAR_TIPOLOGIA` retiene la acción en `outbox` para no descartar reintentos si la aceptación previa aún no se consolida).*

---

### `BUG-H37-PWA-04`: Omisión de Validación RBAC (`misiones:terreno:verificar`) y de `incidenteId` Válido en `PatrullaMisionDetailPage`, más Falta de Validación UUID de `incidenteId` en `tipologiaService.ts`
* **Severidad:** **ALTA** (Brecha de Control de Acceso RBAC en UI e Integridad de Parámetros de Ruta).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (Líneas 119-151, 405-423)
  * `src/services/tipologiaService.ts` (Líneas 21-26, 206-217)
  * `src/context/AuthContext.tsx` (Líneas 249-266)
* **Commits de Solución:**
  * `fix(terreno): aplicar RBAC fail-closed y desacoplar carga de catálogo con placeholder neutro`
  * `fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs`
* **Verificación Técnica en Re-Test:**  
  1. `PatrullaMisionDetailPage` valida `tienePermisoVerificar` y formato UUID en `mision.incidenteId`, desplegando un aviso informativo (`styles.permissionWarning`) y pasando `deshabilitado={true}` a `EvaluacionTipologiaCard` si alguno falla; además eliminó el respaldo sintético `inc-${misionId}` mostrando `"Misión no encontrada"`.
  2. `tipologiaService.ts:206-217` valida `incidenteId` con `uuidSchema.parse(incidenteId)` y limpia `misionId` mediante `UUID_REGEX` antes de `reclasificarTipologiaSchema.parse(...)`.
  3. `AuthContext.tsx:249-266` removió el fallback permisivo `listaPermisos.length === 0 && permiso === 'misiones:terreno:verificar'`, aplicando política *Fail-Closed*.
  4. Verificado con pruebas de regresión en `PatrullaTipologia.test.tsx:257-278` y `tipologiaService.test.ts:118-155`.

---

### `BUG-H37-PWA-05`: Desactualización de Contratos OpenAPI (`src/types/api-generated.d.ts`), Tipos Manuales en `offline.ts` y Bypass de `openapi-fetch` en `tipologiaService.ts`
* **Severidad:** **MEDIA** (Incumplimiento de Arquitectura de Contratos Tipados y Desfase con `sgrai-api`).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/types/api-generated.d.ts` (Líneas 1557-1609, 2007-2055, 11752-11879)
  * `src/types/offline.ts` (Líneas 62-66)
  * `src/services/tipologiaService.ts` (Líneas 2, 141, 270)
* **Commits de Solución:**
  * `chore(api): regenerar tipos OpenAPI y derivar contratos de tipología`
  * `fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs`
* **Verificación Técnica en Re-Test:**  
  1. `src/types/api-generated.d.ts` incorpora el parámetro `catalogo?: "true" | "false"` y `ListarTiposIncidenteResponse` en `/api/incidentes/tipos`, así como la operación `PATCH /api/incidentes/{id}/tipologia` con `ReclasificarTipologiaInput` y `ReclasificarTipologiaResponse`.
  2. `src/types/offline.ts:62-66` deriva `TipoIncidenteCatalogoItem` y `ReclasificarTipologiaPayload` directamente desde `components['schemas']` y `paths`.
  3. `tipologiaService.ts` ejecuta `apiClient.GET` y `apiClient.PATCH` a través de `openapi-fetch`.

---

### `BUG-H37-PWA-06`: Recarga Redundante del Catálogo Tras Cada Reclasificación y Preselección Silenciosa de Primera Categoría Sin Coincidencia en `EvaluacionTipologiaCard.tsx`
* **Severidad:** **MEDIA** (Degradación UX en Terreno, Peticiones Redundantes y Riesgo de Selección Accidental).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/components/misiones/EvaluacionTipologiaCard.tsx` (Líneas 74-120, 317-325)
  * `src/services/tipologiaService.ts` (Líneas 116-129, 220)
* **Commits de Solución:**
  * `fix(terreno): aplicar RBAC fail-closed y desacoplar carga de catálogo con placeholder neutro`
  * `fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs`
* **Verificación Técnica en Re-Test:**  
  1. La carga inicial del catálogo (`useEffect(..., [])`) se ejecuta una sola vez al montar el componente; la sincronización posterior ante cambios de `tipologiaOriginal` ocurre localmente sin disparar peticiones HTTP adicionales.
  2. `reclasificarTipologiaEnTerreno` resuelve el nombre localmente mediante `resolverNombreTipologiaLocal` (IndexedDB / catálogo predeterminado) sin consultar de nuevo la red.
  3. Cuando no existe coincidencia textual exacta, `tipoSeleccionadoId` se inicializa en `''` mostrando la opción placeholder `"Seleccione un tipo de incidente..."` y manteniendo deshabilitado el botón `"Confirmar tipología"`, verificado en `EvaluacionTipologiaCard.test.tsx:374-404`.
  4. *(Observación menor de usabilidad)*: el selector `<Select>` permanece como lista desplegable nativa sin campo de búsqueda textual, lo cual satisface el Criterio de Aceptación CA-1 para el catálogo actual de 11 categorías oficiales.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H37-PWA-01` | Verificación de tipado estático TypeScript y compilación de producción Next.js tras merge con `develop` | Compilación / CI | Estático / Build | Crítica | Rama `feature/h37-patrulla-categorizar-incidente` con dependencias instaladas | `npx tsc --noEmit` y `npm run build` | Ambos comandos finalizan con código de salida `0` sin errores de tipos | `npx tsc --noEmit` y `npm run build` (`next build --webpack`) finalizan con código `0` y `0` errores | **CORREGIDO** | 17/11/2026 00:14 | 18/11/2026 21:47 | `test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA` |
| `BUG-H37-PWA-02` | Integridad de UUIDs y cobertura del catálogo predeterminado offline frente a tabla `tipo_incidente` de `sgrai-api` | Integridad / Offline | Servicio / Contrato BD | Crítica | Caché IndexedDB vacío y dispositivo offline en frío | `CATALOGO_TIPOS_PREDETERMINADO` (11 ítems) contrastado contra `GET /api/incidentes/tipos?catalogo=true` | Cada UUID y nombre del respaldo local coincide 1:1 con los 11 registros activos de `tipo_incidente` | Los 11 UUIDs y nombres coinciden 1:1 con `tipo_incidente`; eliminado UUID inexistente `...0007`; precarga en `sincronizarMisiones` | **CORREGIDO** | 17/11/2026 00:19 | 18/11/2026 14:45 | `fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs` |
| `BUG-H37-PWA-03` | Resiliencia de sincronización `outbox` para `ACTUALIZAR_TIPOLOGIA` ante `409 Conflict`, orden causal y preservación local | Offline / Concurrencia | Hook / Cola IndexedDB / Servicio | Alta | Misión `EN_CURSO` con `ACTUALIZAR_TIPOLOGIA` en `outbox` al invocar `sincronizarMisiones` / `obtenerDetalleMision` o error irrecuperable HTTP | `misionesService.ts` (`sincronizarMisiones` / `obtenerDetalleMision`), `offlineQueue.ts`, `useConnectivity.ts` (`400/403/404/422`) y `npm test -- -t "BUG-H37-PWA-03"` | No se sobreescriben mutaciones `ACTUALIZAR_TIPOLOGIA` pendientes en `EN_CURSO` al refrescar listado/detalle y se revierte estado ante error irrecuperable | Eliminado `limpiarMisionesLocales()` previo; `mantenerOptimista` ampliado a `EN_CURSO` con lectura de `outbox`; limpieza/reversión ante `400/403/404/422` verificada con `4/4` tests | **CORREGIDO** | 17/11/2026 00:15 | 18/11/2026 21:47 | `fix(offline): preservar tipología offline en misiones EN_CURSO y revertir ante errores irrecuperables (BUG-H37-PWA-03)` |
| `BUG-H37-PWA-04` | Restricción RBAC `misiones:terreno:verificar` y validación de `incidenteId` UUID en pantalla de detalle y servicio | Seguridad / RBAC | UI / Servicio / Contexto | Alta | Misión `EN_CURSO` con `unidadActiva = true` y usuario sin `misiones:terreno:verificar` o sin `incidenteId` UUID | `tienePermiso('misiones:terreno:verificar') = false`, `permisos: []`, `incidenteId = 'inc-001'` y `misionId = 'mision-no-uuid'` | Se deshabilita `EvaluacionTipologiaCard` con aviso si falta permiso o `incidenteId` UUID; `AuthContext` aplica *Fail-Closed* y servicio valida UUID | Aviso y controles deshabilitados verificados en `PatrullaTipologia.test.tsx`; rechazo UUID inválido y saneamiento `misionId` en `tipologiaService.test.ts`; *Fail-Closed* en `AuthContext` | **CORREGIDO** | 17/11/2026 00:15 | 18/11/2026 21:47 | `fix(terreno): aplicar RBAC fail-closed y desacoplar carga de catálogo con placeholder neutro` |
| `BUG-H37-PWA-05` | Sincronización de `src/types/api-generated.d.ts` con OpenAPI y consumo vía `openapi-fetch` (`apiClient`) | Contrato API / Arquitectura | Tipos / Servicio DAL | Media | Especificación OpenAPI activa en `sgrai-api` con `/api/incidentes/{id}/tipologia` y `?catalogo=true` | Inspección de `src/types/api-generated.d.ts`, `src/types/offline.ts` y `src/services/tipologiaService.ts` | Tipos generados con `npm run api:generate` sin tipos manuales y llamadas ejecutadas vía `apiClient` | `api-generated.d.ts` regenerado con ambos endpoints y esquemas; `offline.ts` deriva tipos de `components`/`paths` y `tipologiaService.ts` usa `apiClient.GET` y `apiClient.PATCH` | **CORREGIDO** | 17/11/2026 00:14 | 18/11/2026 14:42 | `chore(api): regenerar tipos OpenAPI y derivar contratos de tipología` |
| `BUG-H37-PWA-06` | Evitar recarga redundante de catálogo al reclasificar y preselección segura cuando no hay coincidencia | Usabilidad / Rendimiento | UI / Componente | Media | `EvaluacionTipologiaCard` montado con catálogo cargado o tipología histórica sin coincidencia | Rerender con cambio de `misionActual.tipologia`; `misionActual.tipologia = "Tipología Desconocida"` | Carga única del catálogo al montar, sin petición extra al guardar y placeholder neutro si no existe coincidencia exacta | `obtenerCatalogoTiposIncidente` llamado 1 vez al montar; placeholder `"Seleccione un tipo de incidente..."` y botón bloqueado verificados en Vitest | **CORREGIDO** | 17/11/2026 00:13 | 18/11/2026 21:47 | `fix(terreno): aplicar RBAC fail-closed y desacoplar carga de catálogo con placeholder neutro` |
| `CP-H37-PWA-01` | Ocultamiento de la sección de categorización mientras la misión se encuentra en estado `DESPACHADA` | Regla de Negocio ICS | Integración UI | Crítica | Patrulla activa con misión en estado `DESPACHADA` | `misionDespachadaMock` (`estado: 'DESPACHADA'`) en `PatrullaTipologia.test.tsx` | Se exhibe botón `"Aceptar Misión"` y permanece oculto `"Categorización del incidente"` | Botón `"Aceptar Misión"` visible y texto `"Categorización del incidente"` ausente en DOM | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `test(patrulla): agregar pruebas unitarias y de integracion para categorizacion de tipologia (H37)` |
| `CP-H37-PWA-02` | Despliegue de `SeccionDesplegable` y `EvaluacionTipologiaCard` al encontrarse la misión en estado `EN_CURSO` | Funcional / UI | Integración UI | Crítica | Misión aceptada en estado `EN_CURSO` y patrulla activa | `misionEnCursoMock` (`estado: 'EN_CURSO'`) en `PatrullaTipologia.test.tsx` | Sección `"Categorización del incidente"` desplegada por defecto dentro de `"Formularios de Reporte Técnico"` | Encabezado `"Misión activa"` y sección desplegable `"Categorización del incidente"` renderizados abiertos | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `feat(ui): implementar SeccionDesplegable y redisenar pantalla de detalle a ancho completo con campos tactiles de 48px` |
| `CP-H37-PWA-03` | Carga online del catálogo oficial filtrando inactivos y persistencia automática en IndexedDB (`tipos_incidente`) | Funcional / Caché | Unitaria / Servicio | Alta | Navegador online (`navigator.onLine = true`) y respuesta API con 1 activo y 1 inactivo | `apiClient.GET('/api/incidentes/tipos', { params: { query: { catalogo: 'true' } } })` | Retorna solo categorías con `activo !== false` e invoca `guardarCatalogoLocal('tipos_incidente', ...)` | Retorna 1 elemento activo (`"Inundación"`) e invoca `guardarCatalogoLocal` correctamente | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs` |
| `CP-H37-PWA-04` | Recuperación del catálogo desde IndexedDB (`catalogos`) cuando el dispositivo opera sin conexión | Offline-First | Unitaria / Servicio | Alta | Navegador offline (`navigator.onLine = false`) y catálogo previamente cacheado en IndexedDB | `obtenerCatalogoLocal('tipos_incidente')` con arreglo local de tipos | Retorna la copia almacenada en IndexedDB sin intentar petición HTTP | Retorna exactamente la lista cacheada desde IndexedDB | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-05` | Selección interactiva de tipología y despliegue dinámico del alcance técnico (`helperText`) | Funcional / UX | Unitaria / Componente | Alta | `EvaluacionTipologiaCard` renderizado con catálogo oficial cargado | `fireEvent.change(select, { target: { value: '40000000-...-0001' } })` | El selector actualiza su valor y exhibe la descripción técnica correspondiente al ítem elegido | Cambia el texto auxiliar a `"Acumulación desmedida de agua"` y activa campo de justificación | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-06` | Validación de justificación obligatoria (`>= 5`, sin solo espacios, `<= 1000` chars) y contador dinámico | Validación / Borde | Unitaria / Zod y UI | Crítica | Formulario `EvaluacionTipologiaCard` en modo cambio y esquema `reclasificarTipologiaSchema` | Entradas `"abc"`, `"Test"`, `"      "`, `"a".repeat(1001)` y `"Evaluación técnica en terreno"` (29 chars) | Rechaza longitudes `< 5`, solo espacios y `> 1000`; muestra alerta en UI y contador `29 / 1000` | 7/7 pruebas Zod en `tipologia.test.ts` y pruebas de validación/contador en `EvaluacionTipologiaCard.test.tsx` aprobadas | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA` |
| `CP-H37-PWA-07` | Reclasificación online exitosa (`200 OK`), actualización inmediata del encabezado de misión y mensaje de confirmación | Integración / Flujo | UI / Servicio | Crítica | Misión `EN_CURSO`, catálogo cargado y conectividad activa | `PATCH /api/incidentes/50000000-...-0001/tipologia` tras confirmar en `ModalConfirmacionTipologia` | Emite feedback de éxito, actualiza `mision.tipologia` en la ficha superior y limpia el campo de justificación | Alerta `"Tipología del incidente reclasificada exitosamente en terreno."` desplegada y callback ejecutado | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA` |
| `CP-H37-PWA-08` | Encolamiento automático en `outbox` (`ACTUALIZAR_TIPOLOGIA`) ante modo offline o `TypeError: Failed to fetch` | Offline-First / Tolerancia | Unitaria / Servicio y UI | Crítica | `navigator.onLine = false` o rechazo de red `TypeError('Failed to fetch')` | `reclasificarTipologiaEnTerreno('50000000-...-0001', { tipoIncidenteId, justificacion }, misionMock)` | Encola `ACTUALIZAR_TIPOLOGIA` (`PATCH`), marca `sincronizacionPendiente: true`, actualiza `MisionLocal` y muestra alerta ámbar | Outbox invocado con `tipo: 'ACTUALIZAR_TIPOLOGIA'`, `offline: true` y alerta `"Tipología guardada localmente..."` | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs` |
| `CP-H37-PWA-09` | Bloqueo completo de controles del formulario cuando la prop `deshabilitado` es `true` | Usabilidad / Seguridad | Unitaria / Componente | Media | `EvaluacionTipologiaCard` montado con `deshabilitado={true}` | `<EvaluacionTipologiaCard ... deshabilitado={true} />` | Selector `<select>` y botón `"Confirmar tipología"` en estado `disabled` | Los controles interactivos quedan deshabilitados en el DOM | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA` |
| `CP-H37-PWA-10` | Contrato HTTP real en `sgrai-api`: `GET /api/incidentes/tipos?catalogo=true` retorna catálogo oficial activo | Contrato API | Integración HTTP | Crítica | Servicio `sgrai-api` activo sobre PostgreSQL 16 con tabla `tipo_incidente` sembrada | `GET http://localhost:3001/api/incidentes/tipos?catalogo=true` y `GET /openapi.json` | `HTTP 200 OK` con arreglo `data` de 11 ítems `{ id, nombre, descripcion, activo: true }` y query `catalogo` en OpenAPI | `HTTP 200 OK` retornando los 11 tipos oficiales activos y query params `["catalogo","detallado"]` presentes en `/openapi.json` | **APROBADO** | 17/11/2026 00:19 | 18/11/2026 14:45 | `chore(api): regenerar tipos OpenAPI y derivar contratos de tipología` |
| `CP-H37-PWA-11` | Contrato HTTP real RBAC en `sgrai-api`: rechazo `401` sin sesión y `403` sin permiso `misiones:terreno:verificar` o patrulla ajena | Seguridad / RBAC | Integración HTTP | Crítica | Incidente `a1000000-...-0003` con misión `MIS-2026-0001` en `EN_CURSO` | `PATCH /api/incidentes/a1000000-...-0003/tipologia` sin credenciales, con JWT `CALL_CENTER` y con patrullero ajeno (`d1000000-...-0001`) | `401 Unauthorized` sin credenciales; `403 Forbidden` para `CALL_CENTER` y patrullero de otra unidad | `401` y `403` (`"No cuenta con el permiso requerido: misiones:terreno:verificar"` / patrulla ajena) verificados con JWT real | **APROBADO** | 17/11/2026 00:19 | 18/11/2026 14:45 | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-12` | Contrato HTTP real en `sgrai-api`: rechazo `400` por justificación `< 5` chars y `409` en misión `DESPACHADA` | Validación / Negocio ICS | Integración HTTP | Alta | `INC-2026-0003` (`EN_CURSO`) e `INC-2026-0001` (`DESPACHADA`) | `justificacion: "abc"` sobre `INC-2026-0003`; payload válido sobre `INC-2026-0001` | `400 Bad Request` para justificación corta; `409 Conflict` exigiendo aceptar la misión previamente | `400 Bad Request` con error en `campo: "justificacion"` y `409 Conflict` indicando aceptar misión previamente | **APROBADO** | 17/11/2026 00:19 | 17/11/2026 (Sin cambios API) | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-13` | Contrato HTTP real en `sgrai-api`: actualización de `incidente.tipo_incidente_id`, `tipo_afectacion` y registro en `mision_hito` | Persistencia / Transacción | Integración HTTP / BD | Crítica | `INC-2026-0003` asociado a `MIS-2026-0001` (`EN_CURSO`) | `PATCH /api/incidentes/a1000000-...-0003/tipologia` con JWT válido y `tipoIncidenteId: '40000000-...-0004'` | `200 OK` actualizando `incidente` a `"Anegamiento de calzada"` y creando hito `TIPOLOGIA_RECLASIFICADA` en `mision_hito` | `200 OK` retornando `incidente.tipoAfectacion: "Anegamiento de calzada"` e `hito.hito: "TIPOLOGIA_RECLASIFICADA"` | **APROBADO** | 17/11/2026 00:19 | 18/11/2026 14:45 | `fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs` |
| `CP-H37-PWA-14` | Emisión y suscripción en tiempo real del evento WebSocket `incidente:actualizado` hacia el Kanban en `sgrai-web` | Tiempo Real / Integración | Servicio / Socket.io | Alta | Inspección de `tipologia.service.ts` (`sgrai-api`) y `useEncargadoKanbanSocket.ts` (`sgrai-web`) | `notificarIncidenteActualizado({ id, codigo, tipoIncidenteId, tipoAfectacion, justificacion, ... })` | `sgrai-api` emite `incidente:actualizado` a `sala:encargados` y `sgrai-web` actualiza la tarjeta del Kanban reactivamente | Flujo emisor-receptor verificado en ambas aplicaciones con campos `tipoIncidenteId`, `tipoAfectacion` y `justificacion` | **APROBADO** | 17/11/2026 00:15 | 17/11/2026 (Sin cambios WebSocket) | `feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)` |
| `CP-H37-PWA-15` | Cumplimiento de directrices UI de terreno (Flat UI `0px`, objetivo táctil `>= 48px`, `lucide-react` sin emojis) y manual H37 | Estándar UI / Docs | Estático / CSS y Docs | Media | Inspección de módulos CSS, `ModalConfirmacionTipologia.module.css` y manual H37 | Verificación de `EvaluacionTipologiaCard.module.css`, `ModalConfirmacionTipologia.module.css`, `SeccionDesplegable.module.css` | `border-radius: 0px`, `min-height >= 48px` (`48px` botones modal/modificar, `52px` submit, `56px` resumen), cero emojis | Cumplimiento visual plano y manual H37 verificados sin desviaciones | **APROBADO** | 17/11/2026 00:15 | 18/11/2026 14:45 | `docs(patrulla): actualizar manual H37 con cabecera y secciones desplegables` |
| `CP-H37-PWA-16` | Ejecución completa de suites Vitest del módulo HU-37 y análisis estático ESLint | Automatización / Calidad | Unit / Integración | Alta | Entorno Vitest y ESLint configurados en `sgrai-pwa` | `npx vitest run ...` (10 archivos vinculados HU-37/offline/RBAC) y `npm run lint` | 100% de pruebas aprobadas y `0` errores en ESLint | 10/10 archivos vinculados (80/80 tests) y suite global 38/38 archivos (182/182 tests) aprobados; `npm run lint` con `0` errores | **APROBADO** | 17/11/2026 00:20 | 18/11/2026 21:47 | `test(offline): agregar pruebas de preservación EN_CURSO y reversión de ACTUALIZAR_TIPOLOGIA (BUG-H37-PWA-03)` |
| `CP-H37-PWA-17` | Modal accesible de confirmación previa (`ModalConfirmacionTipologia`) con resumen comparativo, cancelación con `Escape` y bloqueo en envío | Funcional / UX / A11y | Unitaria / Componente | Alta | `EvaluacionTipologiaCard` con formulario válido y clic en `"Confirmar tipología"` | `ModalConfirmacionTipologia.test.tsx` (6 tests): apertura, chips comparativos, `Escape`, `cargando={true}` | Muestra diálogo con acción y chips de cambio, cancela con botón/`Escape` salvo con `cargando=true`, dispara envío al confirmar | 6/6 pruebas de `ModalConfirmacionTipologia.test.tsx` aprobadas | **APROBADO** | 18/11/2026 14:44 | 18/11/2026 21:47 | `fix(terreno): aplicar RBAC fail-closed y desacoplar carga de catálogo con placeholder neutro` |
| `CP-H37-PWA-18` | Ratificación presencial sin justificación (`esCambio: false`), tarjeta resumen `"Resumen de Evaluación en Terreno"` e indicador `"Completado"` | Funcional / Flujo ICS | UI / Servicio / API | Alta | Misión `EN_CURSO` manteniendo tipología original del catálogo | `esCambio: false` en `EvaluacionTipologiaCard.test.tsx`, `PatrullaTipologia.test.tsx` y `PATCH` real con glosa de ratificación | No exige textarea al ratificar, despliega resumen con opción `"Modificar categorización"`, colapsa sección con chip `"Completado"` y persiste `200 OK` en API | Verificado en `EvaluacionTipologiaCard.test.tsx`, `PatrullaTipologia.test.tsx` (`Completado`) y `PATCH /api/incidentes/{id}/tipologia` (`200 OK`) | **APROBADO** | 18/11/2026 14:44 | 18/11/2026 21:47 | `test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA` |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H37-PWA-01	Verificación de tipado estático TypeScript y compilación de producción Next.js tras merge con develop	Compilación / CI	Estático / Build	Crítica	Rama feature/h37-patrulla-categorizar-incidente con dependencias instaladas	npx tsc --noEmit y npm run build	Ambos comandos finalizan con código de salida 0 sin errores de tipos	npx tsc --noEmit y npm run build (next build --webpack) finalizan con código 0 y 0 errores	CORREGIDO	17/11/2026 00:14	18/11/2026 21:47	test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA
BUG-H37-PWA-02	Integridad de UUIDs y cobertura del catálogo predeterminado offline frente a tabla tipo_incidente de sgrai-api	Integridad / Offline	Servicio / Contrato BD	Crítica	Caché IndexedDB vacío y dispositivo offline en frío	CATALOGO_TIPOS_PREDETERMINADO (11 ítems) contrastado contra GET /api/incidentes/tipos?catalogo=true	Cada UUID y nombre del respaldo local coincide 1:1 con los 11 registros activos de tipo_incidente	Los 11 UUIDs y nombres coinciden 1:1 con tipo_incidente; eliminado UUID inexistente ...0007; precarga en sincronizarMisiones	CORREGIDO	17/11/2026 00:19	18/11/2026 14:45	fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs
BUG-H37-PWA-03	Resiliencia de sincronización outbox para ACTUALIZAR_TIPOLOGIA ante 409 Conflict, orden causal y preservación local	Offline / Concurrencia	Hook / Cola IndexedDB / Servicio	Alta	Misión EN_CURSO con ACTUALIZAR_TIPOLOGIA en outbox al invocar sincronizarMisiones / obtenerDetalleMision o error irrecuperable HTTP	misionesService.ts (sincronizarMisiones / obtenerDetalleMision), offlineQueue.ts, useConnectivity.ts (400/403/404/422) y npm test -- -t "BUG-H37-PWA-03"	No se sobreescriben mutaciones ACTUALIZAR_TIPOLOGIA pendientes en EN_CURSO al refrescar listado/detalle y se revierte estado ante error irrecuperable	Eliminado limpiarMisionesLocales() previo; mantenerOptimista ampliado a EN_CURSO con lectura de outbox; limpieza/reversión ante 400/403/404/422 verificada con 4/4 tests	CORREGIDO	17/11/2026 00:15	18/11/2026 21:47	fix(offline): preservar tipología offline en misiones EN_CURSO y revertir ante errores irrecuperables (BUG-H37-PWA-03)
BUG-H37-PWA-04	Restricción RBAC misiones:terreno:verificar y validación de incidenteId UUID en pantalla de detalle y servicio	Seguridad / RBAC	UI / Servicio / Contexto	Alta	Misión EN_CURSO con unidadActiva = true y usuario sin misiones:terreno:verificar o sin incidenteId UUID	tienePermiso('misiones:terreno:verificar') = false, permisos: [], incidenteId = 'inc-001' y misionId = 'mision-no-uuid'	Se deshabilita EvaluacionTipologiaCard con aviso si falta permiso o incidenteId UUID; AuthContext aplica Fail-Closed y servicio valida UUID	Aviso y controles deshabilitados verificados en PatrullaTipologia.test.tsx; rechazo UUID inválido y saneamiento misionId en tipologiaService.test.ts; Fail-Closed en AuthContext	CORREGIDO	17/11/2026 00:15	18/11/2026 21:47	fix(terreno): aplicar RBAC fail-closed y desacoplar carga de catálogo con placeholder neutro
BUG-H37-PWA-05	Sincronización de src/types/api-generated.d.ts con OpenAPI y consumo vía openapi-fetch (apiClient)	Contrato API / Arquitectura	Tipos / Servicio DAL	Media	Especificación OpenAPI activa en sgrai-api con /api/incidentes/{id}/tipologia y ?catalogo=true	Inspección de src/types/api-generated.d.ts, src/types/offline.ts y src/services/tipologiaService.ts	Tipos generados con npm run api:generate sin tipos manuales y llamadas ejecutadas vía apiClient	api-generated.d.ts regenerado con ambos endpoints y esquemas; offline.ts deriva tipos de components/paths y tipologiaService.ts usa apiClient.GET y apiClient.PATCH	CORREGIDO	17/11/2026 00:14	18/11/2026 14:42	chore(api): regenerar tipos OpenAPI y derivar contratos de tipología
BUG-H37-PWA-06	Evitar recarga redundante de catálogo al reclasificar y preselección segura cuando no hay coincidencia	Usabilidad / Rendimiento	UI / Componente	Media	EvaluacionTipologiaCard montado con catálogo cargado o tipología histórica sin coincidencia	Rerender con cambio de misionActual.tipologia; misionActual.tipologia = "Tipología Desconocida"	Carga única del catálogo al montar, sin petición extra al guardar y placeholder neutro si no existe coincidencia exacta	obtenerCatalogoTiposIncidente llamado 1 vez al montar; placeholder "Seleccione un tipo de incidente..." y botón bloqueado verificados en Vitest	CORREGIDO	17/11/2026 00:13	18/11/2026 21:47	fix(terreno): aplicar RBAC fail-closed y desacoplar carga de catálogo con placeholder neutro
CP-H37-PWA-01	Ocultamiento de la sección de categorización mientras la misión se encuentra en estado DESPACHADA	Regla de Negocio ICS	Integración UI	Crítica	Patrulla activa con misión en estado DESPACHADA	misionDespachadaMock (estado: 'DESPACHADA') en PatrullaTipologia.test.tsx	Se exhibe botón "Aceptar Misión" y permanece oculto "Categorización del incidente"	Botón "Aceptar Misión" visible y texto "Categorización del incidente" ausente en DOM	APROBADO	17/11/2026 00:20	18/11/2026 21:47	test(patrulla): agregar pruebas unitarias y de integracion para categorizacion de tipologia (H37)
CP-H37-PWA-02	Despliegue de SeccionDesplegable y EvaluacionTipologiaCard al encontrarse la misión en estado EN_CURSO	Funcional / UI	Integración UI	Crítica	Misión aceptada en estado EN_CURSO y patrulla activa	misionEnCursoMock (estado: 'EN_CURSO') en PatrullaTipologia.test.tsx	Sección "Categorización del incidente" desplegada por defecto dentro de "Formularios de Reporte Técnico"	Encabezado "Misión activa" y sección desplegable "Categorización del incidente" renderizados abiertos	APROBADO	17/11/2026 00:20	18/11/2026 21:47	feat(ui): implementar SeccionDesplegable y redisenar pantalla de detalle a ancho completo con campos tactiles de 48px
CP-H37-PWA-03	Carga online del catálogo oficial filtrando inactivos y persistencia automática en IndexedDB (tipos_incidente)	Funcional / Caché	Unitaria / Servicio	Alta	Navegador online (navigator.onLine = true) y respuesta API con 1 activo y 1 inactivo	apiClient.GET('/api/incidentes/tipos', { params: { query: { catalogo: 'true' } } })	Retorna solo categorías con activo !== false e invoca guardarCatalogoLocal('tipos_incidente', ...)	Retorna 1 elemento activo ("Inundación") e invoca guardarCatalogoLocal correctamente	APROBADO	17/11/2026 00:20	18/11/2026 21:47	fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs
CP-H37-PWA-04	Recuperación del catálogo desde IndexedDB (catalogos) cuando el dispositivo opera sin conexión	Offline-First	Unitaria / Servicio	Alta	Navegador offline (navigator.onLine = false) y catálogo previamente cacheado en IndexedDB	obtenerCatalogoLocal('tipos_incidente') con arreglo local de tipos	Retorna la copia almacenada en IndexedDB sin intentar petición HTTP	Retorna exactamente la lista cacheada desde IndexedDB	APROBADO	17/11/2026 00:20	18/11/2026 21:47	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-05	Selección interactiva de tipología y despliegue dinámico del alcance técnico (helperText)	Funcional / UX	Unitaria / Componente	Alta	EvaluacionTipologiaCard renderizado con catálogo oficial cargado	fireEvent.change(select, { target: { value: '40000000-...-0001' } })	El selector actualiza su valor y exhibe la descripción técnica correspondiente al ítem elegido	Cambia el texto auxiliar a "Acumulación desmedida de agua" y activa campo de justificación	APROBADO	17/11/2026 00:20	18/11/2026 21:47	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-06	Validación de justificación obligatoria (>= 5, sin solo espacios, <= 1000 chars) y contador dinámico	Validación / Borde	Unitaria / Zod y UI	Crítica	Formulario EvaluacionTipologiaCard en modo cambio y esquema reclasificarTipologiaSchema	Entradas "abc", "Test", "      ", "a".repeat(1001) y "Evaluación técnica en terreno" (29 chars)	Rechaza longitudes < 5, solo espacios y > 1000; muestra alerta en UI y contador 29 / 1000	7/7 pruebas Zod en tipologia.test.ts y pruebas de validación/contador en EvaluacionTipologiaCard.test.tsx aprobadas	APROBADO	17/11/2026 00:20	18/11/2026 21:47	test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA
CP-H37-PWA-07	Reclasificación online exitosa (200 OK), actualización inmediata del encabezado de misión y mensaje de confirmación	Integración / Flujo	UI / Servicio	Crítica	Misión EN_CURSO, catálogo cargado y conectividad activa	PATCH /api/incidentes/50000000-...-0001/tipologia tras confirmar en ModalConfirmacionTipologia	Emite feedback de éxito, actualiza mision.tipologia en la ficha superior y limpia el campo de justificación	Alerta "Tipología del incidente reclasificada exitosamente en terreno." desplegada y callback ejecutado	APROBADO	17/11/2026 00:20	18/11/2026 21:47	test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA
CP-H37-PWA-08	Encolamiento automático en outbox (ACTUALIZAR_TIPOLOGIA) ante modo offline o TypeError: Failed to fetch	Offline-First / Tolerancia	Unitaria / Servicio y UI	Crítica	navigator.onLine = false o rechazo de red TypeError('Failed to fetch')	reclasificarTipologiaEnTerreno('50000000-...-0001', { tipoIncidenteId, justificacion }, misionMock)	Encola ACTUALIZAR_TIPOLOGIA (PATCH), marca sincronizacionPendiente: true, actualiza MisionLocal y muestra alerta ámbar	Outbox invocado con tipo: 'ACTUALIZAR_TIPOLOGIA', offline: true y alerta "Tipología guardada localmente..."	APROBADO	17/11/2026 00:20	18/11/2026 21:47	fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs
CP-H37-PWA-09	Bloqueo completo de controles del formulario cuando la prop deshabilitado es true	Usabilidad / Seguridad	Unitaria / Componente	Media	EvaluacionTipologiaCard montado con deshabilitado={true}	<EvaluacionTipologiaCard ... deshabilitado={true} />	Selector select y botón "Confirmar tipología" en estado disabled	Los controles interactivos quedan deshabilitados en el DOM	APROBADO	17/11/2026 00:20	18/11/2026 21:47	test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA
CP-H37-PWA-10	Contrato HTTP real en sgrai-api: GET /api/incidentes/tipos?catalogo=true retorna catálogo oficial activo	Contrato API	Integración HTTP	Crítica	Servicio sgrai-api activo sobre PostgreSQL 16 con tabla tipo_incidente sembrada	GET http://localhost:3001/api/incidentes/tipos?catalogo=true y GET /openapi.json	HTTP 200 OK con arreglo data de 11 ítems { id, nombre, descripcion, activo: true } y query catalogo en OpenAPI	HTTP 200 OK retornando los 11 tipos oficiales activos y query params ["catalogo","detallado"] presentes en /openapi.json	APROBADO	17/11/2026 00:19	18/11/2026 14:45	chore(api): regenerar tipos OpenAPI y derivar contratos de tipología
CP-H37-PWA-11	Contrato HTTP real RBAC en sgrai-api: rechazo 401 sin sesión y 403 sin permiso misiones:terreno:verificar o patrulla ajena	Seguridad / RBAC	Integración HTTP	Crítica	Incidente a1000000-...-0003 con misión MIS-2026-0001 en EN_CURSO	PATCH /api/incidentes/a1000000-...-0003/tipologia sin credenciales, con JWT CALL_CENTER y con patrullero ajeno (d1000000-...-0001)	401 Unauthorized sin credenciales; 403 Forbidden para CALL_CENTER y patrullero de otra unidad	401 y 403 ("No cuenta con el permiso requerido: misiones:terreno:verificar" / patrulla ajena) verificados con JWT real	APROBADO	17/11/2026 00:19	18/11/2026 14:45	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-12	Contrato HTTP real en sgrai-api: rechazo 400 por justificación < 5 chars y 409 en misión DESPACHADA	Validación / Negocio ICS	Integración HTTP	Alta	INC-2026-0003 (EN_CURSO) e INC-2026-0001 (DESPACHADA)	justificacion: "abc" sobre INC-2026-0003; payload válido sobre INC-2026-0001	400 Bad Request para justificación corta; 409 Conflict exigiendo aceptar la misión previamente	400 Bad Request con error en campo: "justificacion" y 409 Conflict indicando aceptar misión previamente	APROBADO	17/11/2026 00:19	17/11/2026 (Sin cambios API)	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-13	Contrato HTTP real en sgrai-api: actualización de incidente.tipo_incidente_id, tipo_afectacion y registro en mision_hito	Persistencia / Transacción	Integración HTTP / BD	Crítica	INC-2026-0003 asociado a MIS-2026-0001 (EN_CURSO)	PATCH /api/incidentes/a1000000-...-0003/tipologia con JWT válido y tipoIncidenteId: '40000000-...-0004'	200 OK actualizando incidente a "Anegamiento de calzada" y creando hito TIPOLOGIA_RECLASIFICADA en mision_hito	200 OK retornando incidente.tipoAfectacion: "Anegamiento de calzada" e hito.hito: "TIPOLOGIA_RECLASIFICADA"	APROBADO	17/11/2026 00:19	18/11/2026 14:45	fix(tipologia): alinear catálogo oficial, migrar a apiClient y validar UUIDs
CP-H37-PWA-14	Emisión y suscripción en tiempo real del evento WebSocket incidente:actualizado hacia el Kanban en sgrai-web	Tiempo Real / Integración	Servicio / Socket.io	Alta	Inspección de tipologia.service.ts (sgrai-api) y useEncargadoKanbanSocket.ts (sgrai-web)	notificarIncidenteActualizado({ id, codigo, tipoIncidenteId, tipoAfectacion, justificacion, ... })	sgrai-api emite incidente:actualizado a sala:encargados y sgrai-web actualiza la tarjeta del Kanban reactivamente	Flujo emisor-receptor verificado en ambas aplicaciones con campos tipoIncidenteId, tipoAfectacion y justificacion	APROBADO	17/11/2026 00:15	17/11/2026 (Sin cambios WebSocket)	feat(patrulla): implementar categorizacion de tipologia en terreno con justificacion obligatoria (H37)
CP-H37-PWA-15	Cumplimiento de directrices UI de terreno (Flat UI 0px, objetivo táctil >= 48px, lucide-react sin emojis) y manual H37	Estándar UI / Docs	Estático / CSS y Docs	Media	Inspección de módulos CSS, ModalConfirmacionTipologia.module.css y manual H37	Verificación de EvaluacionTipologiaCard.module.css, ModalConfirmacionTipologia.module.css, SeccionDesplegable.module.css	border-radius: 0px, min-height >= 48px (48px botones modal/modificar, 52px submit, 56px resumen), cero emojis	Cumplimiento visual plano y manual H37 verificados sin desviaciones	APROBADO	17/11/2026 00:15	18/11/2026 14:45	docs(patrulla): actualizar manual H37 con cabecera y secciones desplegables
CP-H37-PWA-16	Ejecución completa de suites Vitest del módulo HU-37 y análisis estático ESLint	Automatización / Calidad	Unit / Integración	Alta	Entorno Vitest y ESLint configurados en sgrai-pwa	npx vitest run ... (10 archivos vinculados HU-37/offline/RBAC) y npm run lint	100% de pruebas aprobadas y 0 errores en ESLint	10/10 archivos vinculados (80/80 tests) y suite global 38/38 archivos (182/182 tests) aprobados; npm run lint con 0 errores	APROBADO	17/11/2026 00:20	18/11/2026 21:47	test(offline): agregar pruebas de preservación EN_CURSO y reversión de ACTUALIZAR_TIPOLOGIA (BUG-H37-PWA-03)
CP-H37-PWA-17	Modal accesible de confirmación previa (ModalConfirmacionTipologia) con resumen comparativo, cancelación con Escape y bloqueo en envío	Funcional / UX / A11y	Unitaria / Componente	Alta	EvaluacionTipologiaCard con formulario válido y clic en "Confirmar tipología"	ModalConfirmacionTipologia.test.tsx (6 tests): apertura, chips comparativos, Escape, cargando={true}	Muestra diálogo con acción y chips de cambio, cancela con botón/Escape salvo con cargando=true, dispara envío al confirmar	6/6 pruebas de ModalConfirmacionTipologia.test.tsx aprobadas	APROBADO	18/11/2026 14:44	18/11/2026 21:47	fix(terreno): aplicar RBAC fail-closed y desacoplar carga de catálogo con placeholder neutro
CP-H37-PWA-18	Ratificación presencial sin justificación (esCambio: false), tarjeta resumen "Resumen de Evaluación en Terreno" e indicador "Completado"	Funcional / Flujo ICS	UI / Servicio / API	Alta	Misión EN_CURSO manteniendo tipología original del catálogo	esCambio: false en EvaluacionTipologiaCard.test.tsx, PatrullaTipologia.test.tsx y PATCH real con glosa de ratificación	No exige textarea al ratificar, despliega resumen con opción "Modificar categorización", colapsa sección con chip "Completado" y persiste 200 OK en API	Verificado en EvaluacionTipologiaCard.test.tsx, PatrullaTipologia.test.tsx (Completado) y PATCH /api/incidentes/{id}/tipologia (200 OK)	APROBADO	18/11/2026 14:44	18/11/2026 21:47	test(h37): actualizar y ampliar pruebas unitarias tras correcciones de QA
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test)

### 5.1 Verificación de Análisis Estático, Tipado TypeScript y Build de Producción (`BUG-H37-PWA-01`)

**Comandos ejecutados:**
```bash
npm run lint && npx tsc --noEmit && npm run build
```

**Evidencia real obtenida en consola (Re-Test Final 18/11/2026 21:46):**
```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/components/terreno/TerrenoResumenOperativo.tsx
  100:6  warning  React Hook useEffect has a missing dependency: 'actualizarUnidadAsignada'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

✖ 1 problem (0 errors, 1 warning)

▲ Next.js 16.3.4 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 38ms

  Creating an optimized production build ...
✓ Compiled successfully in 4.0s
✓ Finished TypeScript in 4.4s
✓ Collecting page data using 11 workers in 705ms
✓ Generating static pages using 11 workers (8/8) in 843ms
✓ Collecting build traces in 14.6s
✓ Finalizing page optimization in 14.9s
```

---

### 5.2 Ejecución de Pruebas Automatizadas en Vitest (`BUG-H37-PWA-03`, `CP-H37-PWA-01` a `CP-H37-PWA-09`, `CP-H37-PWA-16` a `CP-H37-PWA-18`)

#### 5.2.1 Suite Completa del Repositorio y Suites Vinculadas a HU-37
```bash
npm test
```
```text
 Test Files  38 passed (38)
      Tests  182 passed (182)
   Start at  21:46:16
   Duration  11.18s (transform 5.35s, setup 14.12s, collect 20.93s, tests 14.23s, environment 64.75s, prepare 8.40s)
```

```bash
npx vitest run \
  src/lib/validations/__tests__/tipologia.test.ts \
  src/services/__tests__/tipologiaService.test.ts \
  src/components/misiones/__tests__/EvaluacionTipologiaCard.test.tsx \
  src/components/misiones/__tests__/ModalConfirmacionTipologia.test.tsx \
  src/app/\(terreno\)/patrulla/misiones/\[id\]/__tests__/PatrullaTipologia.test.tsx \
  src/components/ui/__tests__/SeccionDesplegable.test.tsx \
  src/hooks/__tests__/useConnectivity.test.ts \
  src/services/__tests__/offlineQueue.test.ts \
  src/services/__tests__/misionesService.test.ts \
  src/context/__tests__/AuthContext.test.tsx
```
```text
 ✓ src/services/__tests__/offlineQueue.test.ts (8 tests) 48ms
 ✓ src/lib/validations/__tests__/tipologia.test.ts (7 tests) 12ms
 ✓ src/services/__tests__/tipologiaService.test.ts (11 tests) 31ms
 ✓ src/services/__tests__/misionesService.test.ts (13 tests) 30ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (6 tests) 128ms
 ✓ src/context/__tests__/AuthContext.test.tsx (8 tests) 82ms
 ✓ src/components/ui/__tests__/SeccionDesplegable.test.tsx (5 tests) 257ms
 ✓ src/components/misiones/__tests__/ModalConfirmacionTipologia.test.tsx (6 tests) 270ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaTipologia.test.tsx (5 tests) 539ms
 ✓ src/components/misiones/__tests__/EvaluacionTipologiaCard.test.tsx (11 tests) 619ms

 Test Files  10 passed (10)
      Tests  80 passed (80)
   Start at  21:47:31
   Duration  3.48s (transform 1.98s, setup 4.39s, collect 5.12s, tests 2.02s, environment 11.51s, prepare 1.27s)
```

#### 5.2.2 Comandos Individuales por Suite con Filtro `-t`
```bash
# Resiliencia offline EN_CURSO, outbox y reversión ante error irrecuperable (4 tests)
npm test -- -t "BUG-H37-PWA-03"

# Validación Zod de reclasificación y ratificación (7 tests)
npm test -- -t "reclasificarTipologiaSchema \(H37\)"

# Servicio de catálogo oficial 1:1, UUIDs y apiClient (11 tests)
npm test -- -t "tipologiaService \(H37\)"

# Formulario EvaluacionTipologiaCard y placeholder neutro (11 tests)
npm test -- -t "EvaluacionTipologiaCard \(H37\)"

# Modal de confirmación previa (6 tests)
npm test -- -t "ModalConfirmacionTipologia"

# Integración de detalle de patrulla, ratificación y control RBAC (5 tests)
npm test -- -t "PatrullaMisionDetailPage — Categorización de Tipología en Terreno \(H37\)"
```

**Salidas observadas en Re-Test Final:**
```text
 ✓ src/hooks/__tests__/useConnectivity.test.ts (6 tests | 5 skipped) 58ms
 ✓ src/services/__tests__/offlineQueue.test.ts (8 tests | 7 skipped) 29ms
 ✓ src/services/__tests__/misionesService.test.ts (13 tests | 11 skipped) 17ms
 Test Files  3 passed | 35 skipped (38) — Tests  4 passed | 178 skipped (182) — Duration  7.44s

 ✓ src/lib/validations/__tests__/tipologia.test.ts (7 tests) 11ms
 Test Files  1 passed | 37 skipped (38) — Tests  7 passed | 175 skipped (182) — Duration  7.77s

 ✓ src/services/__tests__/tipologiaService.test.ts (11 tests) 34ms
 Test Files  1 passed | 37 skipped (38) — Tests  11 passed | 171 skipped (182) — Duration  7.65s

 ✓ src/components/misiones/__tests__/EvaluacionTipologiaCard.test.tsx (11 tests) 997ms
 Test Files  1 passed | 37 skipped (38) — Tests  11 passed | 171 skipped (182) — Duration  6.77s

 ✓ src/components/misiones/__tests__/ModalConfirmacionTipologia.test.tsx (6 tests) 485ms
 Test Files  1 passed | 37 skipped (38) — Tests  6 passed | 176 skipped (182) — Duration  6.42s

 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaTipologia.test.tsx (5 tests) 448ms
 Test Files  1 passed | 37 skipped (38) — Tests  5 passed | 177 skipped (182) — Duration  7.29s
```

---

### 5.3 Pruebas de Contrato Real con cURL sobre `sgrai-api` (`CP-H37-PWA-10` a `CP-H37-PWA-13`, `CP-H37-PWA-18` y `BUG-H37-PWA-02`)

#### Caso 1: Consulta del Catálogo Oficial y Validación OpenAPI (`200 OK` — `CP-H37-PWA-10` / `BUG-H37-PWA-02`)
```bash
curl -s -i "http://localhost:3001/api/incidentes/tipos?catalogo=true"
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Catálogo oficial de tipos de incidente obtenido exitosamente.","data":[{"id":"a0000000-0000-4000-8000-000000000001","nombre":"Anegamiento","descripcion":"Acumulación de aguas lluvias en vías o propiedades","activo":true},{"id":"40000000-0000-4000-8000-000000000004","nombre":"Anegamiento de calzada","descripcion":"Saturación de sumideros y acumulación de aguas lluvias en vías públicas","activo":true},{"id":"40000000-0000-4000-8000-000000000003","nombre":"Caída de árbol","descripcion":"Obstrucción de vías o afectación a viviendas y tendido eléctrico por caída de árboles","activo":true},{"id":"a0000000-0000-4000-8000-000000000006","nombre":"Corte de agua potable","descripcion":"Corte o rotura matriz en la red de agua potable","activo":true},{"id":"a0000000-0000-4000-8000-000000000003","nombre":"Corte de energía","descripcion":"Interrupción del suministro eléctrico o peligro por cables caídos","activo":true},{"id":"a0000000-0000-4000-8000-000000000005","nombre":"Daño estructural","descripcion":"Colapso parcial o daño grave en techumbre, muros o edificaciones","activo":true},{"id":"a0000000-0000-4000-8000-000000000004","nombre":"Deslizamiento","descripcion":"Movimiento de laderas, socavón o remoción de terreno","activo":true},{"id":"40000000-0000-4000-8000-000000000002","nombre":"Deslizamiento de tierra","descripcion":"Movimiento de masa de suelo o laderas en zonas de riesgo","activo":true},{"id":"40000000-0000-4000-8000-000000000005","nombre":"Incendio estructural / forestal","descripcion":"Focos de fuego en estructuras o vegetación urbana/rural","activo":true},{"id":"40000000-0000-4000-8000-000000000001","nombre":"Inundación","descripcion":"Acumulación desmedida de agua por crecida de ríos o lluvias torrenciales","activo":true},{"id":"40000000-0000-4000-8000-000000000006","nombre":"Otro","descripcion":"Cualquier otro incidente que requiera atención de emergencia municipal","activo":true}]}
```

**Verificación de parámetros OpenAPI en `sgrai-api`:**
```bash
curl -s "http://localhost:3001/openapi.json" | node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('tipos query params:', JSON.stringify(d.paths['/api/incidentes/tipos']?.get?.parameters?.map(p => p.name))); console.log('tipologia patch:', Boolean(d.paths['/api/incidentes/{id}/tipologia']?.patch));"
```
```text
tipos query params: ["catalogo","detallado"]
tipologia patch: true
```

#### Caso 2: Reclasificación Exitosa con JWT Real (`200 OK` — `CP-H37-PWA-13`)
```bash
TOKEN=$(curl -s -X POST "http://localhost:3001/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"admin@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(d.data?.token || '');")

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000004","justificacion":"Anegamiento severo en calzada constatado en ruta T-350","misionId":"d1000000-0000-4000-8000-000000000001"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Tipología del incidente reclasificada exitosamente en terreno.","data":{"incidente":{"id":"a1000000-0000-4000-8000-000000000003","codigo":"INC-2026-0003","tipoIncidenteId":"40000000-0000-4000-8000-000000000004","tipoAfectacion":"Anegamiento de calzada","estado":"VERIFICANDO","prioridad":"CRITICA","actualizadoEn":"2026-11-18T17:45:20.329Z"},"hito":{"id":"ea9b5d5c-f5a5-4fa3-88b0-f8cb1fb675d5","misionId":"d1000000-0000-4000-8000-000000000001","hito":"TIPOLOGIA_RECLASIFICADA","descripcion":"Tipología reclasificada en terreno a: Anegamiento de calzada. Justificación: Anegamiento severo en calzada constatado en ruta T-350","registradoPorId":"00000000-0000-4000-8000-000000000001","creadoEn":"2026-11-18T17:45:20.329Z"}}}
```

#### Caso 3: Ratificación Presencial sin Variaciones (`200 OK` — `CP-H37-PWA-18`)
```bash
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000004","justificacion":"Tipología constatada y ratificada en terreno sin variaciones.","misionId":"d1000000-0000-4000-8000-000000000001"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
content-type: application/json

{"message":"Tipología del incidente reclasificada exitosamente en terreno.","data":{"incidente":{"id":"a1000000-0000-4000-8000-000000000003","codigo":"INC-2026-0003","tipoIncidenteId":"40000000-0000-4000-8000-000000000004","tipoAfectacion":"Anegamiento de calzada","estado":"VERIFICANDO","prioridad":"CRITICA","actualizadoEn":"2026-11-18T17:45:20.403Z"},"hito":{"id":"57670274-256c-42a6-b666-899ae30f2b95","misionId":"d1000000-0000-4000-8000-000000000001","hito":"TIPOLOGIA_RECLASIFICADA","descripcion":"Tipología reclasificada en terreno a: Anegamiento de calzada. Justificación: Tipología constatada y ratificada en terreno sin variaciones.","registradoPorId":"00000000-0000-4000-8000-000000000001","creadoEn":"2026-11-18T17:45:20.403Z"}}}
```

#### Caso 4: Rechazo RBAC con JWT de Rol sin Permiso `misiones:terreno:verificar` (`403 Forbidden` — `CP-H37-PWA-11`)
```bash
CC_TOKEN=$(curl -s -X POST "http://localhost:3001/api/seguridad/login" \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}' \
  | node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(d.data?.token || '');")

curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CC_TOKEN" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Intento sin permiso verificar"}'
```
**Respuesta HTTP/JSON:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json

{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}
```

#### Caso 5: Rechazo por Falta de Credenciales, Justificación `< 5` Caracteres y Misión en `DESPACHADA` (`401`, `400`, `409` — Línea Base `sgrai-api`, Ejecución 17/11/2026)
```bash
# 401 Unauthorized sin cabecera de autenticación
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Inundacion constatada en terreno"}'

# 400 Bad Request por justificación menor a 5 caracteres
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/tipologia" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"abc"}'

# 409 Conflict por misión aún en estado DESPACHADA (INC-2026-0001)
curl -s -i -X PATCH "http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000001/tipologia" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tipoIncidenteId":"40000000-0000-4000-8000-000000000001","justificacion":"Intento sin aceptar mision previamente"}'
```
**Respuestas HTTP/JSON observadas:**
```http
HTTP/1.1 401 Unauthorized
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}

HTTP/1.1 400 Bad Request
{"message":"Datos de entrada inválidos para la reclasificación de tipología.","errors":[{"campo":"justificacion","mensaje":"La justificación debe contener al menos 5 caracteres."}]}

HTTP/1.1 409 Conflict
{"message":"La patrulla debe aceptar la misión asignada antes de poder reclasificar la tipología del incidente."}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación (CA)

| Criterio de Aceptación (CA) | Casos Asociados | Estado QA (`sgrai-pwa`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La pantalla de evaluación en la PWA debe proveer un selector desplegable con las categorías oficiales de incidentes. | `CP-H37-PWA-01`, `CP-H37-PWA-02`, `CP-H37-PWA-15`, `CP-H37-PWA-17`, `BUG-H37-PWA-01`, `BUG-H37-PWA-06` | 🟢 **CUMPLIDO** | `EvaluacionTipologiaCard` renderiza `<Select>` dentro de `SeccionDesplegable` únicamente en `EN_CURSO`, con placeholder neutro cuando no hay coincidencia, modal `ModalConfirmacionTipologia` y compilación `tsc`/`next build` limpia. |
| **CA-2:** El selector debe alimentarse del catálogo oficial `GET /api/incidentes/tipos` (ej. Inundación, Caída de árbol, Derrumbe, Incendio estructural, etc.). | `CP-H37-PWA-03`, `CP-H37-PWA-04`, `CP-H37-PWA-10`, `BUG-H37-PWA-02`, `BUG-H37-PWA-05`, `BUG-H37-PWA-06` | 🟢 **CUMPLIDO** | Consume `GET /api/incidentes/tipos?catalogo=true` mediante `apiClient` y contrato generado en `api-generated.d.ts`, caché en IndexedDB, precarga en `sincronizarMisiones` y catálogo predeterminado alineado 1:1 con los 11 registros activos de `tipo_incidente`. |
| **CA-3:** La patrulla debe poder seleccionar el tipo que mejor describe la situación real constatada en terreno. | `CP-H37-PWA-05`, `CP-H37-PWA-06`, `CP-H37-PWA-07`, `CP-H37-PWA-08`, `CP-H37-PWA-17`, `CP-H37-PWA-18`, `BUG-H37-PWA-03`, `BUG-H37-PWA-06` | 🟢 **CUMPLIDO** | Permite ratificar o reclasificar con confirmación previa, justificación obligatoria (`>= 5` chars), encolamiento offline en `outbox`, preservación optimista en `sincronizarMisiones` / `obtenerDetalleMision` incluso en misiones `EN_CURSO`, y reversión limpia ante errores irrecuperables. |
| **CA-4:** Al guardar, el sistema debe actualizar el campo `incidente.tipo_incidente_id` en la base de datos. | `CP-H37-PWA-07`, `CP-H37-PWA-13`, `CP-H37-PWA-18`, `BUG-H37-PWA-02`, `BUG-H37-PWA-05` | 🟢 **CUMPLIDO** | Invoca `PATCH /api/incidentes/{id}/tipologia` mediante `apiClient` con tipos OpenAPI generados y catálogo predeterminado alineado 1:1 con PostgreSQL (`200 OK` verificado en `sgrai-api`). |
| **CA-5:** Se debe registrar automáticamente un hito en `mision_hito` indicando: `'Tipología reclasificada en terreno a: [Nombre del Tipo]'`. | `CP-H37-PWA-13`, `CP-H37-PWA-18` | 🟢 **CUMPLIDO** | Verificado vía integración real contra `sgrai-api` tanto para reclasificación como para ratificación presencial, registrando `TIPOLOGIA_RECLASIFICADA` en `mision_hito` y persistiendo la referencia en `datosAdicionales.hitoReclasificacion`. |
| **CA-6:** El sistema debe emitir la notificación WebSocket `incidente:actualizado` al Centro de Mando para actualizar la tarjeta en el tablero Kanban. | `CP-H37-PWA-14` | 🟢 **CUMPLIDO** | `sgrai-api` (`tipologia.service.ts`) invoca `notificarIncidenteActualizado` tras la transacción ACID y `sgrai-web` (`useEncargadoKanbanSocket.ts`) escucha `incidente:actualizado` actualizando la tarjeta Kanban reactivamente. |
| **CA-7:** El endpoint de actualización debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H37-PWA-11`, `BUG-H37-PWA-04` | 🟢 **CUMPLIDO** | Verificado en `sgrai-api` (`401`/`403` con JWT real) y en `sgrai-pwa` (`AuthContext` *Fail-Closed*, aviso y bloqueo de `EvaluacionTipologiaCard` sin permiso `misiones:terreno:verificar` ni `incidenteId` UUID válido). |

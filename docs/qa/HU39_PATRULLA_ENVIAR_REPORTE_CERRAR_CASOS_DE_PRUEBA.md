# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-39 — Enviar Informe Técnico de Verificación en Terreno y Cerrar Misión de Patrullaje (Frontend PWA)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Cliente Móvil de Terreno (PWA)**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia.  
> **Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
> **Módulo:** Operaciones de Terreno / Patrulla Verificadora (`/terreno/patrulla/misiones/[id]`)  
> **Historia de Usuario:** HU-39 (fusión H39 / H86) — *"Como Patrulla verificadora Quiero enviar el informe técnico de verificación en terreno y cerrar la misión inicial de patrullaje. Para proveer a la central el diagnóstico consolidado de la emergencia para fundamentar el despacho de cuadrillas y finalizar la intervención de la patrulla."*  
> **Desarrollador Asignado:** `zetastormy`  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Stack Evaluado:** Next.js 16.3.4 (Webpack, App Router), React 19.2.8, TypeScript 5, Zod 4.5.4, IndexedDB (`idb` 8.0.2), `openapi-fetch` 0.17.0, `socket.io-client` 4.8.3, `lucide-react`, Vitest 3.2.7 y React Testing Library 16.3.3.  
> **Rama Git Evaluada:** `feature/h39-patrulla-enviar-reporte-cerrar`  
> **Fecha y Hora de Auditoría Inicial:** `24/11/2026 01:05 -03:00`  
> **Fecha y Hora de Re-Test Final:** `(Pendiente)`  
> **Estado de Certificación:** **NO APROBADO PARA INTEGRACIÓN EN `develop` — PENDIENTE DE CORRECCIÓN Y RE-TEST (`5` Defectos Abiertos: `2` Críticos, `2` Altos, `1` Medio)**

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Durante el ciclo inicial de auditoría forense de código, análisis de contratos OpenAPI, validación de reglas del Sistema de Comando de Incidentes (ICS) y ejecución de pruebas automatizadas e inspección HTTP sobre la rama `feature/h39-patrulla-enviar-reporte-cerrar` del repositorio `sgrai-pwa` (`web-app`), se validaron `20` escenarios en matriz (`5` defectos reales detectados en estado `ABIERTO` y `15` casos base aprobados).

Si bien el repositorio compila sin errores estáticos (`npx tsc --noEmit`, `npm run lint` y `npm run build` exitosos) y las `50` suites automatizadas (`233` pruebas unitarias y de componentes en Vitest, incluyendo `9` suites y `46` pruebas focalizadas en HU-39 y sus dependencias) finalizan en verde en un entorno con mocks, la inspección forense reveló **5 defectos reales** que impiden aprobar el Pull Request hacia `develop`:

1. **Regresión de seguridad y bypass RBAC (`BUG-H39-PWA-01` — Crítica):** El merge hacia `develop` reintrodujo las constantes `DEV_PATRULLA_TOKEN` y `DEV_PATRULLA_USER_ID` en `src/lib/api/client.ts`; además, `reporteVerificacionService.ts` enmascara respuestas HTTP `401`, `403` y `404` como éxito simulado bajo `esModoDemoLocal`, y tanto `AuthContext.tsx` como `PatrullaMisionDetailPage` omiten exigir estrictamente el permiso `reportes:crear` al conceder acceso equivalente mediante `misiones:terreno:verificar` o `misiones:terreno:reportar`.
2. **Incumplimiento de Criterio de Aceptación CA-4 (`BUG-H39-PWA-02` — Alta):** El commit de refactorización final eliminó de la interfaz y del modal de confirmación el selector obligatorio de **Estado del terreno (`estado_terreno`)**, contradiciendo el CA-4, el esquema OpenAPI y el manual de usuario `H39-patrulla-enviar-reporte-cerrar.md`.
3. **Pérdida de consistencia Offline-First y falsos cierres en `outbox` (`BUG-H39-PWA-03` — Crítica):** `misionesService.ts` solo protege mutaciones pendientes cuando el servidor responde `DESPACHADA`, sobrescribiendo el cierre optimista offline (`COMPLETADA` a `EN_CURSO`) al volver a listar o consultar detalle antes de vaciar `outbox`; adicionalmente, `useConnectivity.ts` no envía `x-user-id`, no gestiona respuestas `401` (atascando la cola) y ante rechazos `400`/`403`/`404`/`409`/`422` elimina la mutación del `outbox` sin revertir el estado local optimista `COMPLETADA` ni consultar `obtenerDetalleMision`.
4. **Incumplimiento del estándar OpenAPI/`openapi-fetch` (`BUG-H39-PWA-04` — Alta):** `reporteVerificacionService.ts` prescinde de `apiClient` (`openapi-fetch`) y del tipo generado `CrearReporteVerificacionPayload`, invocando `fetch` directo con tipos inline manuales y payload duplicado camelCase/snake_case.
5. **Desincronización de bandeja/resumen y condición de carrera en modal (`BUG-H39-PWA-05` — Media):** Las vistas de listado y resumen (`/patrulla/misiones`, `TerrenoResumenOperativo`, `TerrenoSiguienteMision`) no se suscriben a los eventos `sgrai:mision-sincronizada` ni `sgrai:outbox-synced`, y `EvaluacionReporteCierreCard.tsx` no cierra automáticamente el modal de confirmación si otro integrante de la patrulla cierra la misión concurrentemente.

| Indicador / Verificación | Resultado Auditoría Inicial (24/11/2026) | Observación Técnica |
|---|---|---|
| **Total de Casos en Matriz (HU-39)** | **20** | `5` Defectos (`BUG-H39-PWA-01` a `05`) + `15` Casos Base (`CP-H39-PWA-01` a `15`) |
| **Casos Aprobados (Passed)** | **15** | `75.0%` de casos base aprobados sobre controles existentes |
| **Defectos Abiertos (Open)** | **5** (`2` Críticos, `2` Altos, `1` Medio) | Bloqueantes para integración en `develop` hasta completar correcciones y Re-Test |
| **Casos Bloqueados (Blocked)** | **0** | Sin bloqueos de entorno |
| **Suite Focalizada HU-39 (Vitest)** | `9` archivos / `46` tests (`4.76s`) | `reporteVerificacion`, `reporteVerificacionService`, `EvaluacionReporteCierreCard`, `ModalConfirmacionReporteCierre`, `ReporteTerrenoBase`, `PatrullaReporteCierre`, `useTerrenoSocket`, `offlineQueue`, `misionesService` |
| **Suite Global PWA (`npm test`)** | `50` archivos / `233` tests (`10.35s`) | Ejecución con mocks de red y almacenamiento (`fake-indexeddb`) |
| **Análisis Estático ESLint (`npm run lint`)** | `0` errores / `0` advertencias | Salida limpia (`exit code 0`) |
| **Verificación de Tipos (`npx tsc --noEmit`)** | `0` errores | Salida limpia (`exit code 0`) |
| **Build de Producción (`npm run build`)** | Aprobado (`exit code 0`) | Next.js 16.3.4 (Webpack); compilación en `7.1s`, TS en `4.2s`, `8/8` páginas estáticas |
| **Verificación Estática de Emojis y `any`** | `0` coincidencias | Búsqueda en `src/` sin emojis ni anotaciones `: any` / `as any` |

---

## 2. Registro Técnico de Defectos

### `BUG-H39-PWA-01`: Re-introducción de Bypass de Autenticación (`DEV_PATRULLA_TOKEN`), Enmascaramiento de Errores HTTP `401`/`403`/`404` y Evaluación Permisiva del Permiso RBAC `reportes:crear`
* **Severidad:** **CRÍTICA** (Vulnerabilidad de Seguridad / Regresión de Autenticación y RBAC).
* **Estado:** **ABIERTO** (Pendiente de corrección).
* **Archivos Afectados:**
  * `src/lib/api/client.ts` (líneas 5–6)
  * `src/services/reporteVerificacionService.ts` (líneas 2–6, 34–43, 419–438)
  * `src/services/prioridadService.ts` (líneas 2–6, 36–45, 700–717)
  * `src/services/tipologiaService.ts` (líneas 2, 98–107)
  * `src/context/AuthContext.tsx` (líneas 256–264)
  * `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 217–220)
* **Descripción y Causa Raíz:**
  1. Durante la integración con `develop` (commit `9423c59`), se reintrodujeron `DEV_PATRULLA_TOKEN = 'dev-patrulla-token'` y `DEV_PATRULLA_USER_ID = '00000000-0000-4000-8000-000000000004'` en `src/lib/api/client.ts`, revirtiendo la remediación aplicada en HU-36 (`BUG-H36-PWA-01`).
  2. En `src/services/reporteVerificacionService.ts`, `buildAuthHeaders()` sustituye la autenticación JWT por la cabecera estática `x-user-id` cuando la cookie coincide con `DEV_PATRULLA_TOKEN`, y el bloque `esModoDemoLocal` (líneas 419–438) intercepta respuestas `401`, `403` y `404` del backend retornando `{ ok: true, offline: false }` como si la misión hubiera sido cerrada exitosamente. El mismo patrón persiste en `prioridadService.ts` y `tipologiaService.ts`.
  3. En `src/context/AuthContext.tsx` (líneas 259–261), `tienePermiso('reportes:crear')` retorna `true` de forma permisiva si el usuario de patrulla posee `misiones:terreno:reportar` o `misiones:terreno:verificar`. Adicionalmente, `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 217–220) evalúa `tienePermiso('reportes:crear') || tienePermiso('misiones:terreno:verificar')`, anulando la exigencia estricta del permiso `reportes:crear` requerida por el CA-9 y por `POST /api/misiones/{id}/reporte`.
* **Pasos para Reproducir:**
  1. Configurar la cookie `sgrai_auth_token=dev-patrulla-token` o iniciar sesión con un usuario `PATRULLA_VERIFICADORA` cuyo arreglo de permisos contenga únicamente `['misiones:terreno:verificar']` (sin `'reportes:crear'`).
  2. Ingresar a `/terreno/patrulla/misiones/{id}` en una misión `EN_CURSO` y completar el formulario de informe técnico.
  3. Presionar `"Enviar Reporte y Cerrar Tarea"` y confirmar el envío.
* **Comportamiento Actual vs. Esperado:**
  * *Actual:* Con `dev-patrulla-token`, los rechazos `401`/`403`/`404` de la API se reportan como cierre exitoso (`ok: true`). Con JWT real sin `reportes:crear`, `tienePermisoCrearReporte` evalúa `true`, habilita el formulario y permite enviar o encolar una mutación que será rechazada con `403 Forbidden` en el servidor.
  * *Esperado:* Eliminar `DEV_PATRULLA_TOKEN`, `DEV_PATRULLA_USER_ID` y todo bloque `esModoDemoLocal`, propagando estrictamente errores `401`/`403`/`404`; validar exclusivamente `tienePermiso('reportes:crear')` sin equivalencias hacia otros permisos en `AuthContext.tsx` y `page.tsx`, deshabilitando el formulario con aviso explícito de falta de permiso cuando `reportes:crear` no esté presente.

---

### `BUG-H39-PWA-02`: Eliminación del Campo Obligatorio `Estado del terreno` (`estado_terreno`) en UI, Modal y Resumen, Incumpliendo CA-4 y Manual H39
* **Severidad:** **ALTA** (Incumplimiento de Criterio de Aceptación CA-4 y Desfase Documental).
* **Estado:** **ABIERTO** (Pendiente de corrección).
* **Archivos Afectados:**
  * `src/components/misiones/EvaluacionReporteCierreCard.tsx`
  * `src/components/misiones/ModalConfirmacionReporteCierre.tsx`
  * `src/lib/validations/reporteVerificacion.ts` (líneas 17–27, 58–62)
  * `src/services/reporteVerificacionService.ts` (líneas 143, 227–232, 262, 296)
  * `docs/manuals/H39-patrulla-enviar-reporte-cerrar.md` (línea 44)
  * `docs/api/contratos-terreno.md` (línea 201)
* **Descripción y Causa Raíz:**
  El Criterio de Aceptación CA-4 establece explícitamente que el formulario debe capturar el campo **Estado del terreno (`estado_terreno`)**. Aunque la especificación OpenAPI (`src/types/api-generated.d.ts`, líneas 3904 y 13064–13068), `docs/api/contratos-terreno.md` y el manual `docs/manuals/H39-patrulla-enviar-reporte-cerrar.md` (§4, paso 4: *"Seleccione el Estado del terreno (Crítico, Estable, Inaccesible, Controlado o Finalizado)"*) documentan este campo, el commit `refactor(terreno): quitar campo estado del terreno en reporte de cierre` eliminó el control `<Select>` de `EvaluacionReporteCierreCard.tsx`, el campo resumen `"Estado del Terreno"` de `<ResumenReporteTerreno>`, la fila correspondiente en `ModalConfirmacionReporteCierre.tsx` y el valor por defecto en `VALORES_INICIALES_REPORTE_VERIFICACION`.
  Como resultado, `reporteVerificacionService.ts` omite `estado_terreno`/`estadoTerreno` en el payload enviado a `POST /api/misiones/{id}/reporte`, provocando que el backend registre por defecto `'FINALIZADO'` en lugar de la condición operativa real constatada en sitio.
* **Pasos para Reproducir:**
  1. Abrir `/terreno/patrulla/misiones/{id}` en estado `EN_CURSO` y desplegar `"Informe técnico de verificación y cierre"`.
  2. Revisar el bloque `"2. Diagnóstico Técnico y Terreno"`.
  3. Confirmar el envío del formulario e inspeccionar el cuerpo JSON enviado y la ficha resumen posterior.
* **Comportamiento Actual vs. Esperado:**
  * *Actual:* Solo se muestra `"Resumen técnico del siniestro"`; no existe selector ni visualización del `"Estado del terreno"` en el formulario, modal de confirmación ni resumen de cierre.
  * *Esperado:* Restaurar el selector obligatorio de `"Estado del terreno"` (`CRITICO`, `ESTABLE`, `INACCESIBLE`, `CONTROLADO`, `FINALIZADO`) en `EvaluacionReporteCierreCard.tsx`, hacerlo requerido en `crearReporteVerificacionSchema` y `VALORES_INICIALES_REPORTE_VERIFICACION`, enviarlo en `payloadMutacion` y mostrarlo en `ModalConfirmacionReporteCierre.tsx` y `<ResumenReporteTerreno>`.

---

### `BUG-H39-PWA-03`: Pérdida de Estado Optimista Offline (`COMPLETADA` a `EN_CURSO`) en `misionesService.ts` y Manejo Defectuoso de Respuestas `401`/`403`/`409`/`422` en `useConnectivity.ts`
* **Severidad:** **CRÍTICA** (Corrupción de Consistencia Offline-First en IndexedDB y Falsa Confirmación de Cierre).
* **Estado:** **ABIERTO** (Pendiente de corrección).
* **Archivos Afectados:**
  * `src/services/misionesService.ts` (líneas 223–225, 322–324, 423)
  * `src/hooks/useConnectivity.ts` (líneas 53–92, 184–202)
* **Descripción y Causa Raíz:**
  1. **Regresión del estado optimista de cierre (`COMPLETADA` &rarr; `EN_CURSO`):** Al cerrar una misión sin conexión, `enviarReporteVerificacionTerreno` guarda la misión localmente en estado `'COMPLETADA'` con `sincronizacionPendiente: true` y encola `ENVIAR_REPORTE` en `outbox`. Sin embargo, en `misionesService.ts`, tanto `sincronizarMisiones` (líneas 223–225) como `obtenerDetalleMision` (líneas 322–324) solo activan `mantenerOptimista` cuando el estado remoto es `'DESPACHADA'`. Como la misión en el servidor está en `'EN_CURSO'` hasta que el `outbox` complete el `POST`, cualquier consulta remota previa al vaciado de `outbox` evalúa `mantenerOptimista = false`, revirtiendo el estado local a `'EN_CURSO'`, poniendo `sincronizacionPendiente = false` y sobrescribiendo `reportesTerreno` sin el registro local `VERIFICACION_CIERRE`.
  2. **Ocultamiento de rechazos al sincronizar `ENVIAR_REPORTE`:** En `useConnectivity.ts` (líneas 184–202), cuando `sincronizarColaOutbox` procesa `ENVIAR_REPORTE` y el servidor responde `400`, `403`, `404`, `409` o `422` (`procesada === true` y `res.ok === false`), el hook elimina la acción de `outbox`, limpia `sincronizacionPendiente: false`, **no invoca `obtenerDetalleMision(misionId)`**, **no revierte `estado: 'COMPLETADA'` ni `reporteVerificacionEnviado` en IndexedDB ni en el caché `localStorage` (`sgrai_evaluaciones_mision_v1`)**, y **no notifica al operador**. El dispositivo queda exhibiendo la misión como cerrada cuando el servidor rechazó el reporte. Incluso ante `201 Created`, tampoco sincroniza el objeto `reporteVerificacion` ni el autor remoto desde el servidor.
  3. **Cabeceras incompletas y atasco en `401`:** `useConnectivity.ts` ejecuta `fetch` directo omitiendo `x-user-id` y sin incluir `res.status === 401` en el flujo de invalidación de sesión (`handleUnauthorizedSession`), dejando la acción atascada en `outbox` en bucle cada `15s`.
* **Pasos para Reproducir:**
  1. Desconectar la red (`navigator.onLine = false`), cerrar una misión `EN_CURSO` desde `EvaluacionReporteCierreCard` (guardando `estado: 'COMPLETADA'`, `sincronizacionPendiente: true` en IndexedDB).
  2. Consultar `obtenerDetalleMision(id)` o `sincronizarMisiones()` mientras la API sigue retornando `estado: 'EN_CURSO'` antes de drenar `outbox`.
  3. En un segundo escenario, recuperar red y hacer que `POST /api/misiones/{id}/reporte` devuelva `403` o `409` (misión cerrada por otro compañero o sin permiso `reportes:crear`) o `401` (token vencido).
* **Comportamiento Actual vs. Esperado:**
  * *Actual:* El paso 2 degrada la misión local de `COMPLETADA` a `EN_CURSO` con `sincronizacionPendiente: false` mostrando en pantalla `"En Trayecto / Evaluación — Misión activa"` junto al cierre `"Completado"`. En el paso 3, errores `403`/`409` dejan la misión falsamente en `COMPLETADA`, y `401` deja la cola en bucle infinito con badge `"Sincronizando"`.
  * *Esperado:* Proteger cualquier estado optimista en `misionesService.ts` mientras exista `sincronizacionPendiente` o una acción pendiente en `outbox` para ese `misionId` (incluyendo `COMPLETADA` sobre `EN_CURSO`). En `useConnectivity.ts`, ejecutar peticiones con `apiClient` (o con `Authorization` + `x-user-id` y manejo `401`), refrescar `obtenerDetalleMision(misionId)` tras `201` o `409`/`403`/`400`/`422`, limpiar el cierre optimista en IndexedDB y `localStorage` ante rechazo definitivo y notificar al operador el motivo del rechazo.

---

### `BUG-H39-PWA-04`: Incumplimiento de `AGENTS.md §3` por Llamada HTTP Manual (`fetch`) sin `openapi-fetch` (`apiClient`) ni Tipado Generado en `reporteVerificacionService.ts`
* **Severidad:** **ALTA** (Violación de Arquitectura de Contratos OpenAPI y Pérdida de Interceptores).
* **Estado:** **ABIERTO** (Pendiente de corrección).
* **Archivos Afectados:**
  * `src/services/reporteVerificacionService.ts` (líneas 27–43, 221–244, 354–388, 440–463)
  * `src/types/offline.ts` (líneas 181–183)
* **Descripción y Causa Raíz:**
  Las directrices obligatorias del repositorio (`AGENTS.md §3`) prohíben escribir a mano tipos de request/response y exigen realizar todas las llamadas HTTP mediante `openapi-fetch` (`apiClient` en `src/lib/api/client.ts`). Aunque `src/types/offline.ts` define `CrearReporteVerificacionPayload` a partir de `paths['/api/misiones/{id}/reporte']['post']['requestBody']`, `reporteVerificacionService.ts` no utiliza `apiClient` ni dicho tipo: construye un diccionario `Record<string, unknown>` con claves duplicadas (`motivo_no_abordable`/`motivoNoAbordable`, `resumen_tecnico`/`resumenTecnico`, etc.), declara manualmente la interfaz de respuesta en las líneas 364–387 y ejecuta `fetch()` directo.
  Esto omite automáticamente los interceptores `onRequest` (extracción de `x-user-id` desde el payload JWT) y `onResponse` (gestión unificada de `401`), impide validar en tiempo de compilación el cuerpo enviado contra `api-generated.d.ts` y omite detallar el arreglo `errors[]` devuelto en respuestas `400 Bad Request`.
* **Pasos para Reproducir:**
  1. Inspeccionar `src/services/reporteVerificacionService.ts` (líneas 354–388) y `src/types/offline.ts` (líneas 181–183).
  2. Ejecutar una llamada online con un token JWT estándar y verificar que la petición hacia `/api/misiones/{id}/reporte` no pasa por `apiClient.POST` ni incluye la cabecera `x-user-id` generada por el interceptor.
* **Comportamiento Actual vs. Esperado:**
  * *Actual:* `enviarReporteVerificacionTerreno` usa `fetch` directo con tipos manuales y no valida `payloadMutacion` contra el tipo OpenAPI generado antes de persistirlo en `outbox`.
  * *Esperado:* Invocar `apiClient.POST('/api/misiones/{id}/reporte', { params: { path: { id: misionId } }, body })` tipado con `CrearReporteVerificacionPayload` y la respuesta `201` de `src/types/api-generated.d.ts`, validando la estructura canónica antes de encolar en IndexedDB y exponiendo los mensajes de validación `errors[]` ante códigos `400`.

---

### `BUG-H39-PWA-05`: Falta de Refresco en Bandeja/Inicio ante Eventos de Cierre (`sgrai:mision-sincronizada` / `sgrai:outbox-synced`) y Condición de Carrera en Modal de Confirmación
* **Severidad:** **MEDIA** (Desincronización de Interfaz Multi-Operador y Concurrencia UI).
* **Estado:** **ABIERTO** (Pendiente de corrección).
* **Archivos Afectados:**
  * `src/app/(terreno)/patrulla/misiones/page.tsx` (líneas 59–61)
  * `src/components/terreno/TerrenoResumenOperativo.tsx` (líneas 26–100)
  * `src/components/terreno/TerrenoSiguienteMision.tsx` (líneas 22–72)
  * `src/components/misiones/EvaluacionReporteCierreCard.tsx` (líneas 78–81, 236–308, 611–621)
* **Descripción y Causa Raíz:**
  1. Aunque `useTerrenoSocket.ts` (activo globalmente en `TerrenoLayout`) emite `window.dispatchEvent(new CustomEvent('sgrai:mision-sincronizada'))` ante `patrulla:actualizada`, `patrulla:liberada`, `mision:actualizada` e `incidente:actualizado`, y `useConnectivity.ts` emite `sgrai:outbox-synced` al vaciar la cola offline, únicamente `PatrullaMisionDetailPage` escucha ambos eventos. `PatrullaMisionesPage` (`/patrulla/misiones`), `TerrenoResumenOperativo` y `TerrenoSiguienteMision` (`/terreno`) solo cargan datos en el montaje inicial, quedando obsoletos cuando otro miembro de la patrulla cierra la misión o cuando la cola offline finaliza su sincronización tras volver de detalle.
  2. En `EvaluacionReporteCierreCard.tsx`, `<ModalConfirmacionReporteCierre abierto={modalConfirmacionAbierto} ... />` (líneas 611–621) se renderiza fuera de la bifurcación `{yaEnviado ? ... : ...}` sin un efecto que cierre el modal si `yaEnviado` o `deshabilitado` cambian a `true`. Si un segundo operador mantiene abierto el modal mientras un compañero cierra la misión en vivo, el modal sigue activo permitiendo confirmar sobre una misión ya cerrada (provocando `409 Conflict`). Adicionalmente, la vista resumen `<ResumenReporteTerreno>` (líneas 254–306) no renderiza `reporteExistente.adjuntos` cuando existen evidencias vinculadas desde servidor.
* **Pasos para Reproducir:**
  1. Mantener abierta la bandeja `/terreno/patrulla/misiones` o la vista `/terreno` en el dispositivo B mientras el dispositivo A cierra la misión (evento `sgrai:mision-sincronizada`) o mientras el `outbox` local termina de sincronizar (`sgrai:outbox-synced`).
  2. En `/terreno/patrulla/misiones/{id}`, pulsar `"Enviar Reporte y Cerrar Tarea"` para abrir el modal de confirmación y despachar `sgrai:mision-sincronizada` con la misión ya cerrada por otro integrante.
* **Comportamiento Actual vs. Esperado:**
  * *Actual:* La bandeja y tarjetas del hub permanecen mostrando la misión en estado `En curso` sin refrescar; el modal de confirmación permanece abierto superpuesto sobre el resumen de cierre ya registrado.
  * *Esperado:* Suscribir `PatrullaMisionesPage`, `TerrenoResumenOperativo` y `TerrenoSiguienteMision` a `sgrai:mision-sincronizada` y `sgrai:outbox-synced` con limpieza al desmontar; cerrar `modalConfirmacionAbierto` automáticamente cuando `yaEnviado || deshabilitado` pase a `true` e incluir la visualización de `reporteExistente.adjuntos` en el resumen cuando existan archivos adjuntos.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H39-PWA-01` | Re-introducción de DEV_PATRULLA_TOKEN, enmascaramiento 401/403/404 y bypass RBAC de reportes:crear | Seguridad / RBAC | Auth / Servicio / UI | Crítica | Sesión con cookie `dev-patrulla-token` o rol `PATRULLA_VERIFICADORA` con `permisos: ['misiones:terreno:verificar']` sin `'reportes:crear'` | `Cookie: sgrai_auth_token=dev-patrulla-token` o `tienePermiso('reportes:crear')` con `permisos: ['misiones:terreno:verificar']` | Sin credenciales demo ni enmascaramiento de `401`/`403`/`404`; `tienePermiso('reportes:crear')` retorna `false` y deshabilita el formulario si falta `reportes:crear` | `DEV_PATRULLA_TOKEN` presente en `client.ts`; `esModoDemoLocal` retorna `ok: true` ante `401`/`403`/`404`; `AuthContext` y `page.tsx` conceden acceso sin `reportes:crear` | ABIERTO | 24/11/2026 01:05 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H39-PWA-02` | Ausencia del campo obligatorio Estado del terreno (estado_terreno) en formulario, modal y resumen (CA-4) | Funcional / Contrato (CA-4) | Componente / Validación / Docs | Alta | Misión `EN_CURSO` abierta en `/terreno/patrulla/misiones/{id}` con sección de cierre expandida | Inspección de `EvaluacionReporteCierreCard.tsx`, `ModalConfirmacionReporteCierre.tsx`, `reporteVerificacion.ts` y `H39-patrulla-enviar-reporte-cerrar.md` | Formulario captura `estado_terreno` (`CRITICO`, `ESTABLE`, `INACCESIBLE`, `CONTROLADO`, `FINALIZADO`), lo muestra en modal/resumen y lo envía a la API | El selector `estado_terreno` fue eliminado de la UI, modal y resumen; se omite del payload enviando por defecto `FINALIZADO` en backend | ABIERTO | 24/11/2026 01:05 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H39-PWA-03` | Pérdida de estado optimista COMPLETADA en misionesService y manejo defectuoso de 401/403/409/422 en useConnectivity | Offline-First / Integridad | Servicio / Hook / IndexedDB | Crítica | Misión `EN_CURSO` cerrada offline (`estado: 'COMPLETADA'`, `sincronizacionPendiente: true`, `ENVIAR_REPORTE` en `outbox`) | Respuesta remota `EN_CURSO` en `obtenerDetalleMision`/`sincronizarMisiones` antes de vaciar `outbox`, o rechazo `401`/`403`/`409` al sincronizar `ENVIAR_REPORTE` | Preservar `COMPLETADA` + `sincronizacionPendiente: true` hasta drenar `outbox`; ante rechazo `403`/`409`/`422` revertir estado local y refrescar detalle; ante `401` invalidar sesión | `mantenerOptimista` solo verifica `DESPACHADA` y revierte `COMPLETADA` a `EN_CURSO`; `useConnectivity` elimina de `outbox` sin revertir `COMPLETADA` ni caché, y atasca `401` | ABIERTO | 24/11/2026 01:05 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H39-PWA-04` | Uso de fetch directo con tipos manuales en lugar de openapi-fetch (apiClient) y tipos generados OpenAPI | Contrato OpenAPI / Arquitectura | Servicio / Tipos | Alta | Revisión de `src/services/reporteVerificacionService.ts` y `src/types/offline.ts` frente a `AGENTS.md §3` | `enviarReporteVerificacionTerreno` y `CrearReporteVerificacionPayload` | Invocar `apiClient.POST('/api/misiones/{id}/reporte', ...)` con tipos derivados de `api-generated.d.ts`, interceptor `x-user-id` y validación previa al `outbox` | Usa `fetch()` directo sin `apiClient`, omite `x-user-id` para JWT reales, define interfaz de respuesta manual y envía claves duplicadas camelCase/snake_case | ABIERTO | 24/11/2026 01:05 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H39-PWA-05` | Falta de refresco en bandeja/hub ante sgrai:mision-sincronizada / outbox-synced y modal abierto en cierre concurrente | Tiempo Real / Concurrencia UI | Página / Componente | Media | Patrullero B en `/patrulla/misiones`, `/terreno` o con modal de confirmación abierto cuando patrullero A cierra la misión | Eventos `sgrai:mision-sincronizada`, `sgrai:outbox-synced` y cierre concurrente de misión en `EvaluacionReporteCierreCard` | Bandeja y tarjetas de inicio refrescan automáticamente; modal de confirmación se cierra si `yaEnviado` cambia a `true`; resumen muestra `adjuntos` | `PatrullaMisionesPage`, `TerrenoResumenOperativo` y `TerrenoSiguienteMision` no escuchan eventos; modal permanece abierto sobre resumen de cierre; omite `adjuntos` | ABIERTO | 24/11/2026 01:05 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H39-PWA-01` | Renderizado de sección de cierre y apertura automática del Paso 3 cuando Tipología (H37) y Prioridad (H38) están completadas | Funcional / UI (CA-1) | Componente / Integración | Crítica | Misión `60000000-0000-4000-8000-000000000001` en `EN_CURSO` con `tipologiaEvaluada: true` y `prioridadEvaluada: true` | Renderizado de `PatrullaMisionDetailPage` con mock de `obtenerDetalleMision` | Acordeón `"Informe técnico de verificación y cierre"` se abre automáticamente y muestra formulario táctil de cierre | Acordeón desplegado automáticamente con campo de personas precargado (`4`) y botón `"Enviar Reporte y Cerrar Tarea"` visible | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-02` | Selector de dictamen operativo ['REQUIERE_CUADRILLA', 'NO_ABORDABLE'] y despliegue condicional de motivo_no_abordable | Funcional / UI (CA-2, CA-3) | Componente | Crítica | Componente `EvaluacionReporteCierreCard` montado en misión activa | Clic en opción `role="radio"` `"No abordable"` vs `"Requiere cuadrilla"` | `motivo_no_abordable` permanece oculto en `REQUIERE_CUADRILLA` y se despliega con aviso de liberación y descarte al elegir `NO_ABORDABLE` | Campo `"Motivo de No Abordabilidad"` ausente inicialmente y visible tras seleccionar `"No abordable"` (`EvaluacionReporteCierreCard.test.tsx`) | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-03` | Validación Zod de longitud mínima en resumen_tecnico (>= 10 caracteres) y motivo_no_abordable (>= 15 caracteres para NO_ABORDABLE) | Validación / Regla de Negocio (CA-3, CA-4) | Unitaria | Crítica | Esquema `crearReporteVerificacionSchema` importado | `{ dictamen: 'REQUIERE_CUADRILLA', resumen_tecnico: 'Muy corto' }` y `{ dictamen: 'NO_ABORDABLE', motivo_no_abordable: 'Predio privado', resumen_tecnico: '...' }` | Rechaza resumen `< 10` chars y motivo `< 15` chars en `NO_ABORDABLE`; aprueba longitudes válidas | `reporteVerificacion.test.ts` valida rechazo con mensajes explícitos y aprobación cuando cumple umbrales mínimos | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39) |
| `CP-H39-PWA-04` | Validación Zod de personas_afectadas como entero no negativo (>= 0 y <= 5000) | Validación / Datos (CA-4) | Unitaria | Alta | Esquema `crearReporteVerificacionSchema` | `{ personas_afectadas: -1 }` y `{ personas_afectadas: 2.5 }` | Rechaza valores negativos y decimales; aprueba enteros en rango `[0, 5000]` | `reporteVerificacion.test.ts` verifica `safeParse(...).success === false` para `-1` y `2.5` | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39) |
| `CP-H39-PWA-05` | Precarga de personas_afectadas desde reporte previo de prioridad (HU-38), nota de autoría y edición táctil | Funcional / Integración (CA-4) | Componente | Alta | Misión con `EVALUACION_PRIORIDAD` previo (`personasAfectadas: 6`, evaluador `Personal 1`) | Renderizado de `EvaluacionReporteCierreCard` y clic en `"Aumentar personas damnificadas"` | Inicializa input numérico en `6`, muestra nota informativa con nombre `Personal 1` y permite incrementar a `7` | Input inicia en `6`, `nota-personas-previas` muestra texto canónico y autor `Personal 1`, e incrementa a `7` al pulsar `+` | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-06` | Captura de daños estimados, observaciones, interruptor Ficha FIBE (requiere_asistencia_social) y contenedor de evidencia HU-43 | Funcional / UI (CA-4, CA-6) | Componente | Alta | Componente `EvaluacionReporteCierreCard` montado | Clic en `role="switch"` `"Requiere Asistencia Social (Levantamiento Ficha FIBE)"` e inspección de `seccion-evidencia-h43` | Switch alterna `aria-checked` (`false` a `true`) y despliega el contenedor preparado para integración multimedia HU-43 | Switch alterna correctamente y `data-testid="seccion-evidencia-h43"` renderiza chip `"Próximamente (HU-43)"` | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-07` | Modal de confirmación previa diferenciado por dictamen REQUIERE_CUADRILLA (teal) y NO_ABORDABLE (danger) | Funcional / UI (CA-3, CA-5) | Componente | Alta | `ModalConfirmacionReporteCierre` con `abierto={true}` | Props para `REQUIERE_CUADRILLA` (`personasAfectadas: 4`, `requiereAsistenciaSocial: true`) y `NO_ABORDABLE` con `motivoNoAbordable` | Muestra título, chip de dictamen, personas, estado FIBE, resumen técnico, motivo y advertencia destructiva en `NO_ABORDABLE` | `ModalConfirmacionReporteCierre.test.tsx` (`2/2` pass) verifica ambos dictámenes y disparo de `alConfirmar` | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-08` | Envío online exitoso (201 Created), actualización local a COMPLETADA, patrulla DISPONIBLE y redirección a /patrulla/misiones | Funcional / Integración (CA-5, CA-8) | Servicio / Página | Crítica | `navigator.onLine = true`, misión `EN_CURSO`, mock `fetch` retornando `201 Created` | `POST /api/misiones/{id}/reporte` con `dictamen: 'REQUIERE_CUADRILLA'`, `resumen_tecnico`, `personas_afectadas: 5`, `requiere_asistencia_social: true` | Persiste `estado: 'COMPLETADA'`, `estadoPatrulla: 'DISPONIBLE'`, `evaluador`, notifica éxito y ejecuta `router.push('/patrulla/misiones')` | `reporteVerificacionService.test.ts` y `PatrullaReporteCierre.test.tsx` verifican `ok: true`, estado local y redirección | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39) |
| `CP-H39-PWA-09` | Encolamiento offline en IndexedDB outbox (ENVIAR_REPORTE) y actualización optimista cuando navigator.onLine es false | Offline-First / Resiliencia | Servicio / IndexedDB | Crítica | `navigator.onLine = false` y misión `EN_CURSO` | `enviarReporteVerificacionTerreno` con `dictamen: 'NO_ABORDABLE'`, motivo `>= 15` chars y resumen `>= 10` chars | Encola `ENVIAR_REPORTE` hacia `/api/misiones/{id}/reporte` en `outbox` y guarda `estado: 'COMPLETADA'`, `sincronizacionPendiente: true` y `estadoIncidente: 'NO_ABORDABLE'` | `reporteVerificacionService.test.ts` verifica llamada a `encolarAccionOutbox` y flags optimistas locales | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39) |
| `CP-H39-PWA-10` | Rechazo controlado en servicio online ante HTTP 403 Forbidden y 409 Conflict sin encolar en outbox (sesión con JWT no demo) | Seguridad / Manejo de Errores (CA-9) | Servicio | Alta | `navigator.onLine = true` sin cookie demo; respuestas mock `403` y `409` | Respuestas `403` (`"No posee el permiso requerido: reportes:crear."`) y `409` (`"La misión ya fue cerrada previamente."`) | Lanza excepción descriptiva propagando el error del servidor sin guardar ni encolar en `outbox` | `reporteVerificacionService.test.ts` (`2` pruebas) verifica rechazo con mensaje del servidor | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39) |
| `CP-H39-PWA-11` | Sincronización en vivo vía sgrai:mision-sincronizada y vista resumen de solo lectura con autoría de otro integrante de patrulla | Tiempo Real / Multi-Operador | Hook / Página / Componente | Alta | Patrullero 2 visualizando misión activa mientras Patrullero 1 cierra la verificación | Evento `mision:actualizada`/`incidente:actualizado` en `useTerrenoSocket` y `window.dispatchEvent(new CustomEvent('sgrai:mision-sincronizada'))` | Recarga detalle, reemplaza formulario por `ResumenReporteTerreno`, muestra `"Registrado por Personal 1 (p1@valdivia.cl) · ..."` y oculta botón de envío | `useTerrenoSocket.test.ts` (`4/4`) y `PatrullaReporteCierre.test.tsx` verifican actualización en vivo y autoría única | APROBADO | 24/11/2026 01:05 | N/A | fix(offline): preservar evaluaciones entre sesiones de patrulla y sincronizar estado multi-operador |
| `CP-H39-PWA-12` | Preservación de evaluaciones cacheadas entre cierre de sesión y cambio de usuario en IndexedDB y localStorage | Offline-First / Persistencia | Servicio / IndexedDB | Alta | Misión evaluada almacenada localmente antes de `limpiarAlmacenamientoOffline()` | Secuencia `guardarMisionLocal` -> `limpiarAlmacenamientoOffline` -> `guardarMisionesLocales` con lista resumida | Caché ligero `sgrai_evaluaciones_mision_v1` sobrevive al `logout` y refusiona evaluaciones sobre la misión entrante | `offlineQueue.test.ts` (`6/6`) y `misionesService.test.ts` (`13/13`) verifican persistencia y fusión tras cambio de sesión | APROBADO | 24/11/2026 01:05 | N/A | fix(offline): preservar evaluaciones entre sesiones de patrulla y sincronizar estado multi-operador |
| `CP-H39-PWA-13` | Cumplimiento de diseño Flat UI, esquinas rectas (--radius-none: 0px), objetivos táctiles >= 48px, Noto Sans y cero emojis | Usabilidad / Diseño Terreno | UI / CSS / Estática | Media | Inspección de `EvaluacionReporteCierreCard.module.css`, `ReporteTerrenoBase.module.css`, `Button.module.css` y búsqueda Unicode en `src/` | `rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/` e inspección CSS | `0` emojis; uso exclusivo de `lucide-react`; botones/contadores/switches `>= 48px` (`48px`–`60px`) y `border-radius: 0px` | Cero coincidencias de emojis (`NO_EMOJIS_IN_SRC`); estilos verificados en cumplimiento con Flat UI y ergonomía móvil | APROBADO | 24/11/2026 01:05 | N/A | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-14` | Protección perimetral en middleware proxy (307 sin cookie) y disponibilidad SSR en /terreno/login y /terreno/patrulla/misiones/[id] | Seguridad / Perímetro | Sistema / HTTP | Alta | Servidor Next.js activo en `http://127.0.0.1:3002` | `GET /terreno/patrulla/misiones/60000000-...` sin cookie vs con cookie `sgrai_auth_token`, y `GET /terreno/login` | Sin cookie retorna `307 Temporary Redirect` hacia `/terreno/login?returnUrl=...`; `/terreno/login` y ruta autenticada retornan `200 OK` | `curl` confirma `HTTP/1.1 307 Temporary Redirect` con `location` exacta y `HTTP/1.1 200 OK` con preload `Noto_Sans` | APROBADO | 24/11/2026 01:05 | N/A | merge: integrar develop (H35 notificaciones y mejoras H36) en feature/h39-patrulla-enviar-reporte-cerrar |
| `CP-H39-PWA-15` | Ejecución integral de Vitest, TypeScript (tsc --noEmit), ESLint y build productivo Next.js | Automatización / Build | Sistema / CI | Alta | Repositorio `web-app` en rama `feature/h39-patrulla-enviar-reporte-cerrar` | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` | `100%` de suites en verde, `0` errores de tipos, `0` errores/warnings ESLint y build productivo limpio | `50/50` archivos (`233/233` tests pass); `tsc` exit `0`; `lint` exit `0`; `build` exit `0` (`8/8` páginas) | APROBADO | 24/11/2026 01:05 | N/A | docs(patrulla): agregar manual de cierre H39 y actualizar manual H38 y contratos |

---

## 4. Bloque TSV para Google Sheets

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H39-PWA-01	Re-introducción de DEV_PATRULLA_TOKEN, enmascaramiento 401/403/404 y bypass RBAC de reportes:crear	Seguridad / RBAC	Auth / Servicio / UI	Crítica	Sesión con cookie dev-patrulla-token o rol PATRULLA_VERIFICADORA con permisos: ['misiones:terreno:verificar'] sin 'reportes:crear'	Cookie: sgrai_auth_token=dev-patrulla-token o tienePermiso('reportes:crear') con permisos: ['misiones:terreno:verificar']	Sin credenciales demo ni enmascaramiento de 401/403/404; tienePermiso('reportes:crear') retorna false y deshabilita el formulario si falta reportes:crear	DEV_PATRULLA_TOKEN presente en client.ts; esModoDemoLocal retorna ok: true ante 401/403/404; AuthContext y page.tsx conceden acceso sin reportes:crear	ABIERTO	24/11/2026 01:05	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H39-PWA-02	Ausencia del campo obligatorio Estado del terreno (estado_terreno) en formulario, modal y resumen (CA-4)	Funcional / Contrato (CA-4)	Componente / Validación / Docs	Alta	Misión EN_CURSO abierta en /terreno/patrulla/misiones/{id} con sección de cierre expandida	Inspección de EvaluacionReporteCierreCard.tsx, ModalConfirmacionReporteCierre.tsx, reporteVerificacion.ts y H39-patrulla-enviar-reporte-cerrar.md	Formulario captura estado_terreno (CRITICO, ESTABLE, INACCESIBLE, CONTROLADO, FINALIZADO), lo muestra en modal/resumen y lo envía a la API	El selector estado_terreno fue eliminado de la UI, modal y resumen; se omite del payload enviando por defecto FINALIZADO en backend	ABIERTO	24/11/2026 01:05	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H39-PWA-03	Pérdida de estado optimista COMPLETADA en misionesService y manejo defectuoso de 401/403/409/422 en useConnectivity	Offline-First / Integridad	Servicio / Hook / IndexedDB	Crítica	Misión EN_CURSO cerrada offline (estado: 'COMPLETADA', sincronizacionPendiente: true, ENVIAR_REPORTE en outbox)	Respuesta remota EN_CURSO en obtenerDetalleMision/sincronizarMisiones antes de vaciar outbox, o rechazo 401/403/409 al sincronizar ENVIAR_REPORTE	Preservar COMPLETADA + sincronizacionPendiente: true hasta drenar outbox; ante rechazo 403/409/422 revertir estado local y refrescar detalle; ante 401 invalidar sesión	mantenerOptimista solo verifica DESPACHADA y revierte COMPLETADA a EN_CURSO; useConnectivity elimina de outbox sin revertir COMPLETADA ni caché, y atasca 401	ABIERTO	24/11/2026 01:05	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H39-PWA-04	Uso de fetch directo con tipos manuales en lugar de openapi-fetch (apiClient) y tipos generados OpenAPI	Contrato OpenAPI / Arquitectura	Servicio / Tipos	Alta	Revisión de src/services/reporteVerificacionService.ts y src/types/offline.ts frente a AGENTS.md §3	enviarReporteVerificacionTerreno y CrearReporteVerificacionPayload	Invocar apiClient.POST('/api/misiones/{id}/reporte', ...) con tipos derivados de api-generated.d.ts, interceptor x-user-id y validación previa al outbox	Usa fetch() directo sin apiClient, omite x-user-id para JWT reales, define interfaz de respuesta manual y envía claves duplicadas camelCase/snake_case	ABIERTO	24/11/2026 01:05	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H39-PWA-05	Falta de refresco en bandeja/hub ante sgrai:mision-sincronizada / outbox-synced y modal abierto en cierre concurrente	Tiempo Real / Concurrencia UI	Página / Componente	Media	Patrullero B en /patrulla/misiones, /terreno o con modal de confirmación abierto cuando patrullero A cierra la misión	Eventos sgrai:mision-sincronizada, sgrai:outbox-synced y cierre concurrente de misión en EvaluacionReporteCierreCard	Bandeja y tarjetas de inicio refrescan automáticamente; modal de confirmación se cierra si yaEnviado cambia a true; resumen muestra adjuntos	PatrullaMisionesPage, TerrenoResumenOperativo y TerrenoSiguienteMision no escuchan eventos; modal permanece abierto sobre resumen de cierre; omite adjuntos	ABIERTO	24/11/2026 01:05	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H39-PWA-01	Renderizado de sección de cierre y apertura automática del Paso 3 cuando Tipología (H37) y Prioridad (H38) están completadas	Funcional / UI (CA-1)	Componente / Integración	Crítica	Misión 60000000-0000-4000-8000-000000000001 en EN_CURSO con tipologiaEvaluada: true y prioridadEvaluada: true	Renderizado de PatrullaMisionDetailPage con mock de obtenerDetalleMision	Acordeón "Informe técnico de verificación y cierre" se abre automáticamente y muestra formulario táctil de cierre	Acordeón desplegado automáticamente con campo de personas precargado (4) y botón "Enviar Reporte y Cerrar Tarea" visible	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-02	Selector de dictamen operativo ['REQUIERE_CUADRILLA', 'NO_ABORDABLE'] y despliegue condicional de motivo_no_abordable	Funcional / UI (CA-2, CA-3)	Componente	Crítica	Componente EvaluacionReporteCierreCard montado en misión activa	Clic en opción role="radio" "No abordable" vs "Requiere cuadrilla"	motivo_no_abordable permanece oculto en REQUIERE_CUADRILLA y se despliega con aviso de liberación y descarte al elegir NO_ABORDABLE	Campo "Motivo de No Abordabilidad" ausente inicialmente y visible tras seleccionar "No abordable" (EvaluacionReporteCierreCard.test.tsx)	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-03	Validación Zod de longitud mínima en resumen_tecnico (>= 10 caracteres) y motivo_no_abordable (>= 15 caracteres para NO_ABORDABLE)	Validación / Regla de Negocio (CA-3, CA-4)	Unitaria	Crítica	Esquema crearReporteVerificacionSchema importado	{ dictamen: 'REQUIERE_CUADRILLA', resumen_tecnico: 'Muy corto' } y { dictamen: 'NO_ABORDABLE', motivo_no_abordable: 'Predio privado', resumen_tecnico: '...' }	Rechaza resumen < 10 chars y motivo < 15 chars en NO_ABORDABLE; aprueba longitudes válidas	reporteVerificacion.test.ts valida rechazo con mensajes explícitos y aprobación cuando cumple umbrales mínimos	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39)
CP-H39-PWA-04	Validación Zod de personas_afectadas como entero no negativo (>= 0 y <= 5000)	Validación / Datos (CA-4)	Unitaria	Alta	Esquema crearReporteVerificacionSchema	{ personas_afectadas: -1 } y { personas_afectadas: 2.5 }	Rechaza valores negativos y decimales; aprueba enteros en rango [0, 5000]	reporteVerificacion.test.ts verifica safeParse(...).success === false para -1 y 2.5	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39)
CP-H39-PWA-05	Precarga de personas_afectadas desde reporte previo de prioridad (HU-38), nota de autoría y edición táctil	Funcional / Integración (CA-4)	Componente	Alta	Misión con EVALUACION_PRIORIDAD previo (personasAfectadas: 6, evaluador Personal 1)	Renderizado de EvaluacionReporteCierreCard y clic en "Aumentar personas damnificadas"	Inicializa input numérico en 6, muestra nota informativa con nombre Personal 1 y permite incrementar a 7	Input inicia en 6, nota-personas-previas muestra texto canónico y autor Personal 1, e incrementa a 7 al pulsar +	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-06	Captura de daños estimados, observaciones, interruptor Ficha FIBE (requiere_asistencia_social) y contenedor de evidencia HU-43	Funcional / UI (CA-4, CA-6)	Componente	Alta	Componente EvaluacionReporteCierreCard montado	Clic en role="switch" "Requiere Asistencia Social (Levantamiento Ficha FIBE)" e inspección de seccion-evidencia-h43	Switch alterna aria-checked (false a true) y despliega el contenedor preparado para integración multimedia HU-43	Switch alterna correctamente y data-testid="seccion-evidencia-h43" renderiza chip "Próximamente (HU-43)"	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-07	Modal de confirmación previa diferenciado por dictamen REQUIERE_CUADRILLA (teal) y NO_ABORDABLE (danger)	Funcional / UI (CA-3, CA-5)	Componente	Alta	ModalConfirmacionReporteCierre con abierto={true}	Props para REQUIERE_CUADRILLA (personasAfectadas: 4, requiereAsistenciaSocial: true) y NO_ABORDABLE con motivoNoAbordable	Muestra título, chip de dictamen, personas, estado FIBE, resumen técnico, motivo y advertencia destructiva en NO_ABORDABLE	ModalConfirmacionReporteCierre.test.tsx (2/2 pass) verifica ambos dictámenes y disparo de alConfirmar	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-08	Envío online exitoso (201 Created), actualización local a COMPLETADA, patrulla DISPONIBLE y redirección a /patrulla/misiones	Funcional / Integración (CA-5, CA-8)	Servicio / Página	Crítica	navigator.onLine = true, misión EN_CURSO, mock fetch retornando 201 Created	POST /api/misiones/{id}/reporte con dictamen: 'REQUIERE_CUADRILLA', resumen_tecnico, personas_afectadas: 5, requiere_asistencia_social: true	Persiste estado: 'COMPLETADA', estadoPatrulla: 'DISPONIBLE', evaluador, notifica éxito y ejecuta router.push('/patrulla/misiones')	reporteVerificacionService.test.ts y PatrullaReporteCierre.test.tsx verifican ok: true, estado local y redirección	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39)
CP-H39-PWA-09	Encolamiento offline en IndexedDB outbox (ENVIAR_REPORTE) y actualización optimista cuando navigator.onLine es false	Offline-First / Resiliencia	Servicio / IndexedDB	Crítica	navigator.onLine = false y misión EN_CURSO	enviarReporteVerificacionTerreno con dictamen: 'NO_ABORDABLE', motivo >= 15 chars y resumen >= 10 chars	Encola ENVIAR_REPORTE hacia /api/misiones/{id}/reporte en outbox y guarda estado: 'COMPLETADA', sincronizacionPendiente: true y estadoIncidente: 'NO_ABORDABLE'	reporteVerificacionService.test.ts verifica llamada a encolarAccionOutbox y flags optimistas locales	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39)
CP-H39-PWA-10	Rechazo controlado en servicio online ante HTTP 403 Forbidden y 409 Conflict sin encolar en outbox (sesión con JWT no demo)	Seguridad / Manejo de Errores (CA-9)	Servicio	Alta	navigator.onLine = true sin cookie demo; respuestas mock 403 y 409	Respuestas 403 ("No posee el permiso requerido: reportes:crear.") y 409 ("La misión ya fue cerrada previamente.")	Lanza excepción descriptiva propagando el error del servidor sin guardar ni encolar en outbox	reporteVerificacionService.test.ts (2 pruebas) verifica rechazo con mensaje del servidor	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39)
CP-H39-PWA-11	Sincronización en vivo vía sgrai:mision-sincronizada y vista resumen de solo lectura con autoría de otro integrante de patrulla	Tiempo Real / Multi-Operador	Hook / Página / Componente	Alta	Patrullero 2 visualizando misión activa mientras Patrullero 1 cierra la verificación	Evento mision:actualizada/incidente:actualizado en useTerrenoSocket y window.dispatchEvent(new CustomEvent('sgrai:mision-sincronizada'))	Recarga detalle, reemplaza formulario por ResumenReporteTerreno, muestra "Registrado por Personal 1 (p1@valdivia.cl) · ..." y oculta botón de envío	useTerrenoSocket.test.ts (4/4) y PatrullaReporteCierre.test.tsx verifican actualización en vivo y autoría única	APROBADO	24/11/2026 01:05	N/A	fix(offline): preservar evaluaciones entre sesiones de patrulla y sincronizar estado multi-operador
CP-H39-PWA-12	Preservación de evaluaciones cacheadas entre cierre de sesión y cambio de usuario en IndexedDB y localStorage	Offline-First / Persistencia	Servicio / IndexedDB	Alta	Misión evaluada almacenada localmente antes de limpiarAlmacenamientoOffline()	Secuencia guardarMisionLocal -> limpiarAlmacenamientoOffline -> guardarMisionesLocales con lista resumida	Caché ligero sgrai_evaluaciones_mision_v1 sobrevive al logout y refusiona evaluaciones sobre la misión entrante	offlineQueue.test.ts (6/6) y misionesService.test.ts (13/13) verifican persistencia y fusión tras cambio de sesión	APROBADO	24/11/2026 01:05	N/A	fix(offline): preservar evaluaciones entre sesiones de patrulla y sincronizar estado multi-operador
CP-H39-PWA-13	Cumplimiento de diseño Flat UI, esquinas rectas (--radius-none: 0px), objetivos táctiles >= 48px, Noto Sans y cero emojis	Usabilidad / Diseño Terreno	UI / CSS / Estática	Media	Inspección de EvaluacionReporteCierreCard.module.css, ReporteTerrenoBase.module.css, Button.module.css y búsqueda Unicode en src/	rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ e inspección CSS	0 emojis; uso exclusivo de lucide-react; botones/contadores/switches >= 48px (48px–60px) y border-radius: 0px	Cero coincidencias de emojis (NO_EMOJIS_IN_SRC); estilos verificados en cumplimiento con Flat UI y ergonomía móvil	APROBADO	24/11/2026 01:05	N/A	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-14	Protección perimetral en middleware proxy (307 sin cookie) y disponibilidad SSR en /terreno/login y /terreno/patrulla/misiones/[id]	Seguridad / Perímetro	Sistema / HTTP	Alta	Servidor Next.js activo en http://127.0.0.1:3002	GET /terreno/patrulla/misiones/60000000-... sin cookie vs con cookie sgrai_auth_token, y GET /terreno/login	Sin cookie retorna 307 Temporary Redirect hacia /terreno/login?returnUrl=...; /terreno/login y ruta autenticada retornan 200 OK	curl confirma HTTP/1.1 307 Temporary Redirect con location exacta y HTTP/1.1 200 OK con preload Noto_Sans	APROBADO	24/11/2026 01:05	N/A	merge: integrar develop (H35 notificaciones y mejoras H36) en feature/h39-patrulla-enviar-reporte-cerrar
CP-H39-PWA-15	Ejecución integral de Vitest, TypeScript (tsc --noEmit), ESLint y build productivo Next.js	Automatización / Build	Sistema / CI	Alta	Repositorio web-app en rama feature/h39-patrulla-enviar-reporte-cerrar	npm test, npx tsc --noEmit, npm run lint, npm run build	100% de suites en verde, 0 errores de tipos, 0 errores/warnings ESLint y build productivo limpio	50/50 archivos (233/233 tests pass); tsc exit 0; lint exit 0; build exit 0 (8/8 páginas)	APROBADO	24/11/2026 01:05	N/A	docs(patrulla): agregar manual de cierre H39 y actualizar manual H38 y contratos
````

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Suite Focalizada HU-39 y Dependencias Offline / Tiempo Real (Vitest)
```bash
npx vitest run \
  src/lib/validations/__tests__/reporteVerificacion.test.ts \
  src/services/__tests__/reporteVerificacionService.test.ts \
  src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx \
  src/components/misiones/__tests__/ModalConfirmacionReporteCierre.test.tsx \
  src/components/misiones/__tests__/ReporteTerrenoBase.test.tsx \
  "src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaReporteCierre.test.tsx" \
  src/hooks/__tests__/useTerrenoSocket.test.ts \
  src/services/__tests__/offlineQueue.test.ts \
  src/services/__tests__/misionesService.test.ts
```

**Evidencia Obtenida:**
```text
 ✓ src/services/__tests__/offlineQueue.test.ts (6 tests) 41ms
 ✓ src/services/__tests__/misionesService.test.ts (13 tests) 39ms
 ✓ src/lib/validations/__tests__/reporteVerificacion.test.ts (5 tests) 22ms
 ✓ src/services/__tests__/reporteVerificacionService.test.ts (5 tests) 55ms
 ✓ src/hooks/__tests__/useTerrenoSocket.test.ts (4 tests) 72ms
 ✓ src/components/misiones/__tests__/ReporteTerrenoBase.test.tsx (4 tests) 377ms
 ✓ src/components/misiones/__tests__/ModalConfirmacionReporteCierre.test.tsx (2 tests) 392ms
 ✓ src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx (5 tests) 810ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaReporteCierre.test.tsx (2 tests) 849ms

 Test Files  9 passed (9)
      Tests  46 passed (46)
   Start at  01:04:06
   Duration  4.76s (transform 2.19s, setup 3.22s, collect 6.24s, tests 2.66s, environment 12.99s, prepare 1.64s)
```

### 5.2 Ejecución Individual Filtrada con `-t` en Vitest
```bash
npm test -- -t "reporteVerificacionService"
npm test -- -t "EvaluacionReporteCierreCard"
npm test -- -t "ModalConfirmacionReporteCierre"
npm test -- -t "Informe Técnico de Verificación y Cierre"
npm test -- -t "Validaciones de informe técnico de verificación y cierre"
```

**Evidencia Obtenida:**
```text
# -t "reporteVerificacionService"
 ✓ src/services/__tests__/reporteVerificacionService.test.ts (5 tests) 46ms
 Test Files  1 passed | 49 skipped (50)
      Tests  5 passed | 228 skipped (233)
   Duration  7.97s

# -t "EvaluacionReporteCierreCard"
 ✓ src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx (5 tests) 1016ms
 Test Files  1 passed | 49 skipped (50)
      Tests  5 passed | 228 skipped (233)
   Duration  7.91s

# -t "ModalConfirmacionReporteCierre"
 ✓ src/components/misiones/__tests__/ModalConfirmacionReporteCierre.test.tsx (2 tests) 342ms
 Test Files  1 passed | 49 skipped (50)
      Tests  2 passed | 231 skipped (233)
   Duration  8.33s

# -t "Informe Técnico de Verificación y Cierre"
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaReporteCierre.test.tsx (2 tests) 367ms
 Test Files  1 passed | 49 skipped (50)
      Tests  2 passed | 231 skipped (233)
   Duration  8.17s

# -t "Validaciones de informe técnico de verificación y cierre"
 ✓ src/lib/validations/__tests__/reporteVerificacion.test.ts (5 tests) 20ms
 Test Files  1 passed | 49 skipped (50)
      Tests  5 passed | 228 skipped (233)
   Duration  7.96s
```

### 5.3 Suite Global, Compilación TypeScript, ESLint y Build Productivo
```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

**Evidencia Obtenida:**
```text
# npm test
 Test Files  50 passed (50)
      Tests  233 passed (233)
   Start at  00:58:39
   Duration  10.35s (transform 5.06s, setup 12.99s, collect 20.74s, tests 19.95s, environment 62.92s, prepare 7.34s)

# npx tsc --noEmit -> exit code 0 (0 errores)
# npm run lint     -> exit code 0 (0 errores, 0 advertencias)

# npm run build
▲ Next.js 16.3.4 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 139ms
✓ Compiled successfully in 7.1s
✓ Finished TypeScript in 4.2s
✓ Collecting page data using 11 workers in 485ms
✓ Generating static pages using 11 workers (8/8) in 633ms
✓ Collecting build traces in 12.8s
✓ Finalizing page optimization in 12.9s
```

### 5.4 Auditoría Estática de Emojis, Tipado Estricto y Regresión de Seguridad
```bash
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS_IN_SRC"
rg -n ":\s*any\b|\bas\s+any\b" src/ || echo "NO_ANY_IN_SRC"
rg -n "DEV_PATRULLA_TOKEN|esModoDemoLocal" src/
```

**Evidencia Obtenida:**
```text
NO_EMOJIS_IN_SRC
NO_ANY_IN_SRC

src/lib/api/client.ts:5:export const DEV_PATRULLA_TOKEN = 'dev-patrulla-token';
src/services/tipologiaService.ts:2:import { DEV_PATRULLA_TOKEN, DEV_PATRULLA_USER_ID, handleUnauthorizedSession } from '@/lib/api/client';
src/services/tipologiaService.ts:100:  if (token === DEV_PATRULLA_TOKEN) {
src/services/prioridadService.ts:3:  DEV_PATRULLA_TOKEN,
src/services/prioridadService.ts:38:  if (token === DEV_PATRULLA_TOKEN) {
src/services/prioridadService.ts:701:    const esModoDemoLocal =
src/services/prioridadService.ts:702:      Boolean(tokenActual) && tokenActual === (DEV_PATRULLA_TOKEN || 'dev-patrulla-token');
src/services/prioridadService.ts:703:    if (esModoDemoLocal && (res.status === 401 || res.status === 403 || res.status === 404)) {
src/services/reporteVerificacionService.ts:3:  DEV_PATRULLA_TOKEN,
src/services/reporteVerificacionService.ts:36:  if (token === DEV_PATRULLA_TOKEN) {
src/services/reporteVerificacionService.ts:420:    const esModoDemoLocal =
src/services/reporteVerificacionService.ts:421:      Boolean(tokenActual) && tokenActual === (DEV_PATRULLA_TOKEN || 'dev-patrulla-token');
src/services/reporteVerificacionService.ts:423:      esModoDemoLocal &&
```

### 5.5 Verificación HTTP Perimetral sobre Servidor PWA (`127.0.0.1:3002`)
```bash
curl -s -i "http://127.0.0.1:3002/terreno/patrulla/misiones/60000000-0000-4000-8000-000000000001" | head -n 10
curl -s -i "http://127.0.0.1:3002/terreno/login" | head -n 10
curl -s -i -H "Cookie: sgrai_auth_token=jwt-qa-probe" \
  "http://127.0.0.1:3002/terreno/patrulla/misiones/60000000-0000-4000-8000-000000000001" | head -n 10
```

**Respuestas HTTP Obtenidas:**
```http
# Caso 1: Acceso sin cookie de sesión -> 307 Temporary Redirect
HTTP/1.1 307 Temporary Redirect
location: /terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones%2F60000000-0000-4000-8000-000000000001
Date: Tue, 24 Nov 2026 04:04:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

# Caso 2: Vista de acceso /terreno/login -> 200 OK
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Link: </terreno/_next/static/media/1755441e3a2fa970-s.p.woff2?v=1795493080417>; rel=preload; as="font"; crossorigin=""; type="font/woff2"
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8

# Caso 3: Ruta de detalle con cookie de sesión -> 200 OK
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Link: </terreno/_next/static/media/1755441e3a2fa970-s.p.woff2?v=1795493084349>; rel=preload; as="font"; crossorigin=""; type="font/woff2"
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos / Defectos Asociados | Estado Actual (`sgrai-pwa`) | Dictamen |
|---|---|---|---|
| **CA-1:** La PWA debe proveer un formulario de reporte técnico de verificación accesible para la patrulla. | `CP-H39-PWA-01`, `CP-H39-PWA-13` | Implementado dentro de `SeccionDesplegable` en `/patrulla/misiones/[id]` con ergonomía táctil (`>= 48px`) y Flat UI. | **Cumplido** |
| **CA-2:** El formulario en la PWA debe incorporar el selector de dictamen operativo: `Dictamen de Atención: ['REQUIERE_CUADRILLA', 'NO_ABORDABLE']`. | `CP-H39-PWA-02`, `CP-H39-PWA-03` | Selector táctil tipo radio implementado con ambas opciones canónicas y contraste semántico. | **Cumplido** |
| **CA-3:** Si selecciona `NO_ABORDABLE`, exigir `motivo_no_abordable` ($\ge 15$ caracteres); transacción atómica y liberación de patrulla a `DISPONIBLE`. | `CP-H39-PWA-02`, `CP-H39-PWA-03`, `CP-H39-PWA-07`, `CP-H39-PWA-09`, `BUG-H39-PWA-03` | Validación Zod y UI implementadas; falla la preservación del cierre offline `NO_ABORDABLE` al refrescar detalle/lista antes de sincronizar `outbox`. | **Parcial (Con Defecto)** |
| **CA-4:** Capturar `resumen_tecnico` ($\ge 10$ chars), `estado_terreno`, `personas_afectadas`, `danos_estimados`, `observaciones` y `requiere_asistencia_social`. | `CP-H39-PWA-03`, `CP-H39-PWA-04`, `CP-H39-PWA-05`, `CP-H39-PWA-06`, `BUG-H39-PWA-02` | El campo `estado_terreno` (`Estado del terreno`) fue removido de formulario, modal y resumen en el último refactor; el resto de campos opera según lo especificado. | **Incumplido (`BUG-H39-PWA-02`)** |
| **CA-5:** Al presionar 'Enviar Reporte y Cerrar Tarea', ejecutar transacción en API (`reporte_terreno`, `mision = COMPLETADA`, `requiere_asistencia_social`, `mision_hito`). | `CP-H39-PWA-07`, `CP-H39-PWA-08`, `CP-H39-PWA-09`, `BUG-H39-PWA-03`, `BUG-H39-PWA-04` | Flujo online base funcional en mocks, pero el servicio no usa `apiClient` (`openapi-fetch`) y `useConnectivity` corrompe o deja falsos cierres ante rechazos al sincronizar `outbox`. | **Parcial (Con Defectos)** |
| **CA-6:** Permitir adjuntar fotografías como evidencia técnica (integrándose con H43). | `CP-H39-PWA-06`, `BUG-H39-PWA-05` | Contenedor UI preparado (`seccion-evidencia-h43`) y contrato `adjuntoIds`/`adjuntos` soportado en Zod/servicio; endpoint `POST /api/evidencia/adjuntos` aún pendiente de H43 en `develop`. El resumen no renderiza `adjuntos`. | **Preparado / Pendiente H43** |
| **CA-7:** Emitir notificaciones WebSocket `mision:actualizada` e `incidente:actualizado` al Centro de Mando y sincronizar en terreno. | `CP-H39-PWA-11`, `BUG-H39-PWA-05` | `useTerrenoSocket` refresca el detalle de misión, pero la bandeja `/patrulla/misiones` y el hub `/terreno` no se suscriben a `sgrai:mision-sincronizada` ni `sgrai:outbox-synced`. | **Parcial (Con Defecto)** |
| **CA-8:** La PWA debe notificar el éxito del envío y regresar a la pantalla de espera de nuevas asignaciones. | `CP-H39-PWA-08`, `BUG-H39-PWA-03` | Emite `Toast` de éxito/offline y redirige a `/patrulla/misiones`, pero la sincronización inmediata en `/patrulla/misiones` puede revertir el cierre offline si el servidor aún responde `EN_CURSO`. | **Parcial (Con Defecto)** |
| **CA-9:** El endpoint debe requerir el permiso RBAC `reportes:crear`. | `CP-H39-PWA-10`, `BUG-H39-PWA-01` | Re-introducción de `DEV_PATRULLA_TOKEN`, enmascaramiento `401`/`403`/`404` y validación permisiva en `AuthContext.tsx` y `page.tsx` que concede acceso con `misiones:terreno:verificar` sin tener `reportes:crear`. | **Incumplido (`BUG-H39-PWA-01`)** |

---

## 7. Dictamen Final de QA

Al haberse detectado **5 defectos reales** (`2` Críticos, `2` Altos y `1` Medio) con impacto directo sobre la seguridad RBAC (`BUG-H39-PWA-01`), cumplimiento funcional de Criterios de Aceptación (`BUG-H39-PWA-02`), consistencia Offline-First en IndexedDB (`BUG-H39-PWA-03`), adherencia al contrato `openapi-fetch` (`BUG-H39-PWA-04`) y sincronización UI/concurrencia (`BUG-H39-PWA-05`), la rama `feature/h39-patrulla-enviar-reporte-cerrar` **NO cumple con los criterios mínimos de salida para integración en `develop`**.

**Dictamen:** **NO APROBADO — PENDIENTE DE CORRECCIÓN Y RE-TEST**

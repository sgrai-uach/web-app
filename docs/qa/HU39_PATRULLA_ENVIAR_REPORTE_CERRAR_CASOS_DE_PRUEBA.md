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
> **Fecha y Hora de Re-Test Final:** `25/11/2026 01:01 -03:00`  
> **Estado de Certificación:** **APROBADO PARA INTEGRACIÓN EN `develop` — RE-TEST EXITOSO (`20/20` Casos Aprobados, `0` Defectos Abiertos)**

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras la auditoría inicial realizada el `24/11/2026 01:05 -03:00` sobre la rama `feature/h39-patrulla-enviar-reporte-cerrar`, en la cual se levantaron **5 defectos reales** (`BUG-H39-PWA-01` a `BUG-H39-PWA-05`: `2` Críticos, `2` Altos y `1` Medio), el equipo de desarrollo integró `develop` (incluyendo la tipografía local auto-alojada Noto Sans y la limpieza de servicios paralelos) y aplicó las remediaciones estructurales solicitadas mediante el commit `fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad)`.

En el presente ciclo de **Re-Test Final (`25/11/2026 01:01 -03:00`)**, se ejecutó la inspección forense completa del código corregido, las pruebas de regresión focalizadas, la suite global de Vitest, la verificación de tipos TypeScript, ESLint, el build productivo con Next.js (Webpack), análisis estáticos de seguridad/accesibilidad y validación HTTP perimetral en vivo sobre el servidor PWA. Los **5 defectos bloqueantes quedaron verificados como corregidos (`APROBADO`)** y los **15 casos base** pasaron satisfactoriamente sin regresiones (`20/20` en verde).

| Indicador / Verificación | Auditoría Inicial (`24/11/2026`) | Re-Test Final (`25/11/2026`) | Observación Técnica de Cierre |
|---|---|---|---|
| **Total de Casos en Matriz (HU-39)** | **20** | **20** | `5` Defectos remediados (`BUG-H39-PWA-01` a `05`) + `15` Casos Base (`CP-H39-PWA-01` a `15`) |
| **Casos Aprobados (Passed)** | **15** (`75.0%`) | **20** (`100.0%`) | `100%` de escenarios funcionales, seguridad, offline-first y contratos aprobados |
| **Defectos Abiertos (Open)** | **5** (`2` Críticos, `2` Altos, `1` Medio) | **0** | Sin defectos abiertos ni regresiones introducidas tras los fixes |
| **Casos Bloqueados (Blocked)** | **0** | **0** | Sin bloqueos de entorno |
| **Suite Focalizada HU-39 y Regresión (Vitest)** | `9` archivos / `46` tests (`4.76s`) | `11` archivos / `82` tests (`3.29s`) | Incluye cobertura explícita de `useConnectivity`, `AuthContext`, `misionesService`, `reporteVerificacionService`, validaciones Zod y UI |
| **Suite Global PWA (`npm test`)** | `50` archivos / `233` tests (`10.35s`) | `56` archivos / `302` tests (`13.30s`) | `56/56` archivos y `302/302` tests en verde tras integrar `develop` y fixes QA |
| **Análisis Estático ESLint (`npm run lint`)** | `0` errores / `0` advertencias | `0` errores / `0` advertencias | Salida limpia (`exit code 0`), incluyendo restricción `next/font/google` |
| **Verificación de Tipos (`npx tsc --noEmit`)** | `0` errores | `0` errores | Salida limpia (`exit code 0`) con contratos tipados desde `api-generated.d.ts` |
| **Build de Producción (`npm run build`)** | Aprobado (`exit code 0`) | Aprobado (`exit code 0`) | Next.js 16.3.4 (Webpack); compilación en `4.9s`, TS en `13.0s`, `8/8` páginas estáticas |
| **Auditoría Estática (Demo / Emojis / `any` / Fuentes)** | `DEV_PATRULLA_TOKEN` presente | **Limpio (`0` hallazgos)** | `CLEAN_DEMO_BYPASS`, `NO_EMOJIS_IN_SRC`, `NO_ANY_IN_SRC`, `OK: sin Google Fonts` |

---

## 2. Registro Técnico de Defectos y Verificación en Re-Test

### `BUG-H39-PWA-01`: Re-introducción de Bypass de Autenticación (`DEV_PATRULLA_TOKEN`), Enmascaramiento de Errores HTTP `401`/`403`/`404` y Evaluación Permisiva del Permiso RBAC `reportes:crear`
* **Severidad:** **CRÍTICA** (Vulnerabilidad de Seguridad / Regresión de Autenticación y RBAC).
* **Estado:** **CORREGIDO** (Verificado en Re-Test el `25/11/2026 01:01`).
* **Archivos Auditados:**
  * `src/lib/api/client.ts`
  * `src/services/reporteVerificacionService.ts`
  * `src/services/prioridadService.ts`
  * `src/services/tipologiaService.ts`
  * `src/context/AuthContext.tsx` (líneas 249–266)
  * `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 252–255, 728–744)
  * `src/context/__tests__/AuthContext.test.tsx` y `src/services/__tests__/reporteVerificacionService.test.ts`
* **Causa Raíz Original:** Presencia residual de `DEV_PATRULLA_TOKEN` y `DEV_PATRULLA_USER_ID` en `client.ts`, bloques `esModoDemoLocal` en servicios que transformaban rechazos `401`/`403`/`404` en éxito simulado, y validación RBAC laxa en `AuthContext.tsx` y `PatrullaMisionDetailPage` que otorgaba `reportes:crear` al tener `misiones:terreno:verificar` o `misiones:terreno:reportar`.
* **Evidencia de Remediación en Re-Test:**
  1. Se eliminaron por completo `DEV_PATRULLA_TOKEN`, `DEV_PATRULLA_USER_ID`, `buildAuthHeaders` y `esModoDemoLocal` en `client.ts` y `reporteVerificacionService.ts` (así como en `prioridadService.ts` y `tipologiaService.ts` tras la integración con `develop`). La búsqueda `rg -n "DEV_PATRULLA_TOKEN|DEV_PATRULLA_USER_ID|esModoDemoLocal|buildAuthHeaders" src/` arrojó `0` coincidencias (`CLEAN_DEMO_BYPASS`).
  2. `enviarReporteVerificacionTerreno` propaga estrictamente errores `401`, `403` y `404` hacia la UI invocando `handleUnauthorizedSession()` ante `401`, verificado en el caso de regresión de `reporteVerificacionService.test.ts`.
  3. `AuthContext.tsx` eliminó el respaldo hacia `misiones:terreno:*` para `reportes:crear` (validado en `AuthContext.test.tsx`, `9/9` pass) y `PatrullaMisionDetailPage` evalúa exclusivamente `tienePermiso('reportes:crear')`, deshabilitando el formulario y mostrando una alerta explícita con `role="alert"` cuando el funcionario carece de dicho permiso.

---

### `BUG-H39-PWA-02`: Eliminación del Campo Obligatorio `Estado del terreno` (`estado_terreno`) en UI, Modal y Resumen, Incumpliendo CA-4 y Manual H39
* **Severidad:** **ALTA** (Incumplimiento de Criterio de Aceptación CA-4 y Desfase Documental).
* **Estado:** **CORREGIDO** (Verificado en Re-Test el `25/11/2026 01:01`).
* **Archivos Auditados:**
  * `src/lib/validations/reporteVerificacion.ts` (líneas 6–28, 59–61)
  * `src/components/misiones/EvaluacionReporteCierreCard.tsx` (líneas 290–295, 476–495, 667)
  * `src/components/misiones/ModalConfirmacionReporteCierre.tsx` (líneas 26, 81–85)
  * `src/services/reporteVerificacionService.ts` (líneas 121, 203, 231, 265)
  * `src/types/offline.ts` (línea 156) y `src/types/api-generated.d.ts` (líneas 13183–13187)
  * `src/lib/validations/__tests__/reporteVerificacion.test.ts`, `src/components/misiones/__tests__/ModalConfirmacionReporteCierre.test.tsx` y `PatrullaReporteCierre.test.tsx`
* **Causa Raíz Original:** Se había retirado el selector `<Select>` y la visualización del campo `estado_terreno` en formulario, modal y resumen, omitiéndolo del payload enviado a `POST /api/misiones/{id}/reporte`.
* **Evidencia de Remediación en Re-Test:**
  1. `crearReporteVerificacionSchema` exige obligatoriamente `estado_terreno` (`ESTADOS_TERRENO_VERIFICACION`: `CRITICO`, `ESTABLE`, `INACCESIBLE`, `CONTROLADO`, `FINALIZADO`), con valor inicial `'ESTABLE'` en `VALORES_INICIALES_REPORTE_VERIFICACION` y validación unitaria explícita en `reporteVerificacion.test.ts` (`6/6` pass).
  2. `EvaluacionReporteCierreCard.tsx` restaura el `<Select label="Estado del terreno" requiredIndicator ... />` en la sección `"2. Diagnóstico Técnico y Terreno"`, incluye `"Estado del Terreno"` en `<ResumenReporteTerreno>` y pasa `estadoTerreno` al modal de confirmación `ModalConfirmacionReporteCierre.tsx`, donde se visualiza antes de confirmar el cierre.
  3. `reporteVerificacionService.ts` envía `estado_terreno` en el cuerpo canónico tipado hacia `POST /api/misiones/{id}/reporte` y en la cola `outbox`, manteniendo alineación total con `docs/manuals/H39-patrulla-enviar-reporte-cerrar.md` y `docs/api/contratos-terreno.md`.

---

### `BUG-H39-PWA-03`: Pérdida de Estado Optimista Offline (`COMPLETADA` a `EN_CURSO`) en `misionesService.ts` y Manejo Defectuoso de Respuestas `401`/`403`/`409`/`422` en `useConnectivity.ts`
* **Severidad:** **CRÍTICA** (Corrupción de Consistencia Offline-First en IndexedDB y Falsa Confirmación de Cierre).
* **Estado:** **CORREGIDO** (Verificado en Re-Test el `25/11/2026 01:01`).
* **Archivos Auditados:**
  * `src/services/misionesService.ts` (líneas 200–520)
  * `src/hooks/useConnectivity.ts` (líneas 59–80, 296–442)
  * `src/services/__tests__/misionesService.test.ts` y `src/hooks/__tests__/useConnectivity.test.ts`
* **Causa Raíz Original:** `misionesService.ts` solo protegía mutaciones pendientes sobre misiones `DESPACHADA` (revirtiendo cierres optimistas `COMPLETADA` cuando el servidor aún informaba `EN_CURSO`); por su parte, `useConnectivity.ts` omitía `x-user-id`, atascaba la cola en `401` y eliminaba acciones `ENVIAR_REPORTE` fallidas (`400`/`403`/`404`/`409`/`422`) sin revertir IndexedDB ni el caché `localStorage`.
* **Evidencia de Remediación en Re-Test:**
  1. `misionesService.ts` consulta `obtenerReferenciasOutboxPendientes()` y amplía la protección optimista a `DESPACHADA` y `EN_CURSO` tanto en `sincronizarMisiones` como en `obtenerDetalleMision`, preservando el estado local `'COMPLETADA'`, `sincronizacionPendiente: true` y los reportes locales `VERIFICACION_CIERRE` hasta drenar `outbox` (validado en `misionesService.test.ts`, `21/21` pass).
  2. `useConnectivity.ts` incorpora `Authorization: Bearer` + `x-user-id` (`extractUserIdFromJwt`), invoca `handleUnauthorizedSession()` ante `401` para detener reintentos en bucle, y al sincronizar `ENVIAR_REPORTE`:
     - Ante `201 Created`: limpia `sincronizacionPendiente`, marca `reporteVerificacion.sincronizado = true`, elimina el ítem de `outbox`, refresca el detalle vía `obtenerDetalleMision(misionId)` y despacha `sgrai:mision-sincronizada`.
     - Ante rechazo terminal (`400`/`403`/`404`/`409`/`422`): revierte el cierre optimista en IndexedDB restaurando `estado: 'EN_CURSO'` sin banderas ni reporte de cierre, limpia `sgrai_evaluaciones_mision_v1` en `localStorage`, elimina la acción de `outbox`, consulta `obtenerDetalleMision(misionId)` y emite `sgrai:sync-error` para notificar al operador (validado en `useConnectivity.test.ts`, `13/13` pass).

---

### `BUG-H39-PWA-04`: Incumplimiento de `AGENTS.md §3` por Llamada HTTP Manual (`fetch`) sin `openapi-fetch` (`apiClient`) ni Tipado Generado en `reporteVerificacionService.ts`
* **Severidad:** **ALTA** (Violación de Arquitectura de Contratos OpenAPI y Pérdida de Interceptores).
* **Estado:** **CORREGIDO** (Verificado en Re-Test el `25/11/2026 01:01`).
* **Archivos Auditados:**
  * `src/services/reporteVerificacionService.ts` (líneas 1, 199–213, 323–361)
  * `src/types/offline.ts` y `src/types/api-generated.d.ts`
  * `src/services/__tests__/reporteVerificacionService.test.ts`
* **Causa Raíz Original:** `enviarReporteVerificacionTerreno` realizaba `fetch()` directo con interfaces de respuesta escritas manualmente y payload duplicado camelCase/snake_case, eludiendo `apiClient` y sus interceptores OpenAPI.
* **Evidencia de Remediación en Re-Test:**
  1. `reporteVerificacionService.ts` importa `apiClient` desde `@/lib/api/client` y construye el payload canónico tipado con `CrearReporteVerificacionPayload` (derivado de `paths['/api/misiones/{id}/reporte']['post']['requestBody']` en `api-generated.d.ts`), eliminando duplicación camelCase/snake_case e interfaces manuales.
  2. La invocación online utiliza `apiClient.POST('/api/misiones/{id}/reporte', { params: { path: { id: misionId } }, body: payloadApi })`, heredando los interceptores globales (`Authorization`, `x-user-id`, `401`) y extrayendo el detalle de validación `errors[]` ante respuestas `400 Bad Request` (validado en `reporteVerificacionService.test.ts`, `5/5` pass).

---

### `BUG-H39-PWA-05`: Falta de Refresco en Bandeja/Inicio ante Eventos de Cierre (`sgrai:mision-sincronizada` / `sgrai:outbox-synced`) y Condición de Carrera en Modal de Confirmación
* **Severidad:** **MEDIA** (Desincronización de Interfaz Multi-Operador y Concurrencia UI).
* **Estado:** **CORREGIDO** (Verificado en Re-Test el `25/11/2026 01:01`).
* **Archivos Auditados:**
  * `src/app/(terreno)/patrulla/misiones/page.tsx` (líneas 66–76)
  * `src/components/terreno/TerrenoResumenOperativo.tsx` (líneas 100–113)
  * `src/components/terreno/TerrenoSiguienteMision.tsx` (líneas 60–73)
  * `src/components/misiones/EvaluacionReporteCierreCard.tsx` (líneas 114–118, 327–335)
  * `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaReporteCierre.test.tsx`
* **Causa Raíz Original:** Las vistas de bandeja (`/patrulla/misiones`) y tarjetas de inicio (`/terreno`) no se suscribían a `sgrai:mision-sincronizada` ni `sgrai:outbox-synced`; además, `EvaluacionReporteCierreCard.tsx` dejaba abierto el modal de confirmación si otro operador cerraba la misión concurrentemente y omitía renderizar `reporteExistente.adjuntos`.
* **Evidencia de Remediación en Re-Test:**
  1. `PatrullaMisionesPage`, `TerrenoResumenOperativo` y `TerrenoSiguienteMision` incorporan listeners para `'sgrai:mision-sincronizada'` y `'sgrai:outbox-synced'` con limpieza completa en el retorno del `useEffect`.
  2. `EvaluacionReporteCierreCard.tsx` cierra automáticamente `modalConfirmacionAbierto` en un `useEffect` cuando `yaEnviado || deshabilitado` pasa a `true` y renderiza los archivos vinculados (`reporteExistente.adjuntos`) dentro de `<ResumenReporteTerreno>`, comprobado en el test de concurrencia `PatrullaReporteCierre.test.tsx` (`3/3` pass).

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H39-PWA-01` | Re-introducción de DEV_PATRULLA_TOKEN, enmascaramiento 401/403/404 y bypass RBAC de reportes:crear | Seguridad / RBAC | Auth / Servicio / UI | Crítica | Sesión con cookie o rol `PATRULLA_VERIFICADORA` con `permisos: ['misiones:terreno:verificar']` sin `'reportes:crear'` | `rg -n` de `DEV_PATRULLA_TOKEN` y `esModoDemoLocal` en `src/`; mock `apiClient.POST` (`401`/`403`/`404`) y `tienePermiso('reportes:crear')` | Sin credenciales demo ni enmascaramiento de `401`/`403`/`404`; `tienePermiso('reportes:crear')` retorna `false` y deshabilita el formulario si falta `reportes:crear` | `CLEAN_DEMO_BYPASS` (`0` hallazgos); `reporteVerificacionService.test.ts` propaga `401`/`403`/`404`; `AuthContext.test.tsx` (`9/9`) valida RBAC estricto y `page.tsx` bloquea formulario con alerta | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad) |
| `BUG-H39-PWA-02` | Ausencia del campo obligatorio Estado del terreno (estado_terreno) en formulario, modal y resumen (CA-4) | Funcional / Contrato (CA-4) | Componente / Validación / Docs | Alta | Misión `EN_CURSO` abierta en `/terreno/patrulla/misiones/{id}` con sección de cierre expandida | `estado_terreno` (`CRITICO`, `ESTABLE`, `INACCESIBLE`, `CONTROLADO`, `FINALIZADO`) en Zod, UI, modal y payload | Formulario captura `estado_terreno`, lo valida como obligatorio en Zod, lo muestra en modal/resumen y lo envía a la API | `<Select>` `"Estado del terreno"` restaurado en UI/resumen/modal; `reporteVerificacion.test.ts` (`6/6`), `ModalConfirmacionReporteCierre.test.tsx` (`2/2`) y `PatrullaReporteCierre.test.tsx` (`3/3`) aprueban | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad) |
| `BUG-H39-PWA-03` | Pérdida de estado optimista COMPLETADA en misionesService y manejo defectuoso de 401/403/409/422 en useConnectivity | Offline-First / Integridad | Servicio / Hook / IndexedDB | Crítica | Misión `EN_CURSO` cerrada offline (`estado: 'COMPLETADA'`, `sincronizacionPendiente: true`, `ENVIAR_REPORTE` en `outbox`) | Respuesta remota `EN_CURSO` antes de vaciar `outbox`; rechazo `401`/`403`/`409` y éxito `201` al sincronizar `ENVIAR_REPORTE` | Preservar `COMPLETADA` + `sincronizacionPendiente: true` hasta drenar `outbox`; ante `403`/`409`/`422` revertir a `EN_CURSO`, limpiar caché y refrescar; ante `401` invalidar sesión | `misionesService.test.ts` (`21/21`) preserva `COMPLETADA`; `useConnectivity.test.ts` (`13/13`) envía `x-user-id`, maneja `401`, reconcilia `201` y revierte `COMPLETADA` + caché ante `403`/`409` | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad) |
| `BUG-H39-PWA-04` | Uso de fetch directo con tipos manuales en lugar de openapi-fetch (apiClient) y tipos generados OpenAPI | Contrato OpenAPI / Arquitectura | Servicio / Tipos | Alta | Revisión de `src/services/reporteVerificacionService.ts`, `src/types/offline.ts` y `src/types/api-generated.d.ts` frente a `AGENTS.md §3` | Llamada `apiClient.POST('/api/misiones/{id}/reporte', { params, body })` con `CrearReporteVerificacionPayload` | Invocar `apiClient.POST('/api/misiones/{id}/reporte', ...)` con tipos generados OpenAPI, interceptores `x-user-id`/`401` y validación Zod previa al `outbox` | `reporteVerificacionService.ts` migrado 100% a `apiClient.POST` con `CrearReporteVerificacionPayload` canónico; verificado con `vi.spyOn(apiClient, 'POST')` en `reporteVerificacionService.test.ts` (`5/5`) | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad) |
| `BUG-H39-PWA-05` | Falta de refresco en bandeja/hub ante sgrai:mision-sincronizada / outbox-synced y modal abierto en cierre concurrente | Tiempo Real / Concurrencia UI | Página / Componente | Media | Patrullero B en `/patrulla/misiones`, `/terreno` o con modal de confirmación abierto cuando patrullero A cierra la misión | Eventos `sgrai:mision-sincronizada`, `sgrai:outbox-synced` y cierre concurrente con `adjuntos` en `EvaluacionReporteCierreCard` | Bandeja y tarjetas de inicio refrescan automáticamente; modal se cierra si `yaEnviado` cambia a `true`; resumen muestra `adjuntos` | `PatrullaMisionesPage`, `TerrenoResumenOperativo` y `TerrenoSiguienteMision` suscritos a ambos eventos; `PatrullaReporteCierre.test.tsx` (`3/3`) verifica cierre automático de modal y renderizado de `porton_cerrado.jpg` | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad) |
| `CP-H39-PWA-01` | Renderizado de sección de cierre y apertura automática del Paso 3 cuando Tipología (H37) y Prioridad (H38) están completadas | Funcional / UI (CA-1) | Componente / Integración | Crítica | Misión `60000000-0000-4000-8000-000000000001` en `EN_CURSO` con `tipologiaEvaluada: true` y `prioridadEvaluada: true` | Renderizado de `PatrullaMisionDetailPage` con mock de `obtenerDetalleMision` | Acordeón `"Informe técnico de verificación y cierre"` se abre automáticamente y muestra formulario táctil de cierre | Acordeón desplegado automáticamente con campo de personas precargado (`4`) y botón `"Enviar Reporte y Cerrar Tarea"` visible | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-02` | Selector de dictamen operativo ['REQUIERE_CUADRILLA', 'NO_ABORDABLE'] y despliegue condicional de motivo_no_abordable | Funcional / UI (CA-2, CA-3) | Componente | Crítica | Componente `EvaluacionReporteCierreCard` montado en misión activa | Clic en opción `role="radio"` `"No abordable"` vs `"Requiere cuadrilla"` | `motivo_no_abordable` permanece oculto en `REQUIERE_CUADRILLA` y se despliega con aviso de liberación y descarte al elegir `NO_ABORDABLE` | Campo `"Motivo de No Abordabilidad"` ausente inicialmente y visible tras seleccionar `"No abordable"` (`EvaluacionReporteCierreCard.test.tsx`, `5/5`) | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-03` | Validación Zod de longitud mínima en resumen_tecnico (>= 10 caracteres) y motivo_no_abordable (>= 15 caracteres para NO_ABORDABLE) | Validación / Regla de Negocio (CA-3, CA-4) | Unitaria | Crítica | Esquema `crearReporteVerificacionSchema` importado | `{ dictamen: 'REQUIERE_CUADRILLA', resumen_tecnico: 'Muy corto' }` y `{ dictamen: 'NO_ABORDABLE', motivo_no_abordable: 'Predio privado', resumen_tecnico: '...' }` | Rechaza resumen `< 10` chars y motivo `< 15` chars en `NO_ABORDABLE`; aprueba longitudes válidas | `reporteVerificacion.test.ts` (`6/6`) valida rechazo con mensajes explícitos y aprobación cuando cumple umbrales mínimos | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39) |
| `CP-H39-PWA-04` | Validación Zod de personas_afectadas como entero no negativo (>= 0 y <= 5000) | Validación / Datos (CA-4) | Unitaria | Alta | Esquema `crearReporteVerificacionSchema` | `{ personas_afectadas: -1 }` y `{ personas_afectadas: 2.5 }` | Rechaza valores negativos y decimales; aprueba enteros en rango `[0, 5000]` | `reporteVerificacion.test.ts` (`6/6`) verifica `safeParse(...).success === false` para `-1` y `2.5` | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39) |
| `CP-H39-PWA-05` | Precarga de personas_afectadas desde reporte previo de prioridad (HU-38), nota de autoría y edición táctil | Funcional / Integración (CA-4) | Componente | Alta | Misión con `EVALUACION_PRIORIDAD` previo (`personasAfectadas: 6`, evaluador `Personal 1`) | Renderizado de `EvaluacionReporteCierreCard` y clic en `"Aumentar personas damnificadas"` | Inicializa input numérico en `6`, muestra nota informativa con nombre `Personal 1` y permite incrementar a `7` | Input inicia en `6`, `nota-personas-previas` muestra texto canónico y autor `Personal 1`, e incrementa a `7` al pulsar `+` | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-06` | Captura de daños estimados, observaciones, interruptor Ficha FIBE (requiere_asistencia_social) y contenedor de evidencia HU-43 | Funcional / UI (CA-4, CA-6) | Componente | Alta | Componente `EvaluacionReporteCierreCard` montado | Clic en `role="switch"` `"Requiere Asistencia Social (Levantamiento Ficha FIBE)"` e inspección de `seccion-evidencia-h43` | Switch alterna `aria-checked` (`false` a `true`) y despliega el contenedor preparado para integración multimedia HU-43 | Switch alterna correctamente y `data-testid="seccion-evidencia-h43"` renderiza chip `"Próximamente (HU-43)"` | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-07` | Modal de confirmación previa diferenciado por dictamen REQUIERE_CUADRILLA (teal) y NO_ABORDABLE (danger) | Funcional / UI (CA-3, CA-5) | Componente | Alta | `ModalConfirmacionReporteCierre` con `abierto={true}` | Props para `REQUIERE_CUADRILLA` (`personasAfectadas: 4`, `estadoTerreno: 'CRITICO'`, `requiereAsistenciaSocial: true`) y `NO_ABORDABLE` con `motivoNoAbordable` | Muestra título, chip de dictamen, estado del terreno, personas, FIBE, resumen, motivo y alerta en `NO_ABORDABLE` | `ModalConfirmacionReporteCierre.test.tsx` (`2/2` pass) verifica ambos dictámenes, estado del terreno y disparo de `alConfirmar` | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39) |
| `CP-H39-PWA-08` | Envío online exitoso (201 Created), actualización local a COMPLETADA, patrulla DISPONIBLE y redirección a /patrulla/misiones | Funcional / Integración (CA-5, CA-8) | Servicio / Página | Crítica | `navigator.onLine = true`, misión `EN_CURSO`, mock `apiClient.POST` retornando `201 Created` | `POST /api/misiones/{id}/reporte` con `dictamen: 'REQUIERE_CUADRILLA'`, `estado_terreno: 'CRITICO'`, `resumen_tecnico`, `personas_afectadas: 5`, `requiere_asistencia_social: true` | Persiste `estado: 'COMPLETADA'`, `estadoPatrulla: 'DISPONIBLE'`, `evaluador`, notifica éxito y ejecuta `router.push('/patrulla/misiones')` | `reporteVerificacionService.test.ts` (`5/5`) y `PatrullaReporteCierre.test.tsx` (`3/3`) verifican `ok: true`, estado local y redirección | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39) |
| `CP-H39-PWA-09` | Encolamiento offline en IndexedDB outbox (ENVIAR_REPORTE) y actualización optimista cuando navigator.onLine es false | Offline-First / Resiliencia | Servicio / IndexedDB | Crítica | `navigator.onLine = false` y misión `EN_CURSO` | `enviarReporteVerificacionTerreno` con `dictamen: 'NO_ABORDABLE'`, `estado_terreno: 'INACCESIBLE'`, motivo `>= 15` chars y resumen `>= 10` chars | Encola `ENVIAR_REPORTE` hacia `/api/misiones/{id}/reporte` en `outbox` y guarda `estado: 'COMPLETADA'`, `sincronizacionPendiente: true` y `estadoIncidente: 'NO_ABORDABLE'` | `reporteVerificacionService.test.ts` (`5/5`) verifica llamada a `encolarAccionOutbox` y flags optimistas locales | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39) |
| `CP-H39-PWA-10` | Rechazo controlado en servicio online ante HTTP 401/403/404/409 sin encolar en outbox | Seguridad / Manejo de Errores (CA-9) | Servicio | Alta | `navigator.onLine = true`; respuestas mock `401`, `403`, `404` y `409` en `apiClient.POST` | Respuestas `401` (`"Sesión expirada"`), `403` (`"reportes:crear"`), `404` (`"Misión no encontrada"`) y `409` (`"ya fue cerrada previamente"`) | Lanza excepción descriptiva propagando el error del servidor sin guardar ni encolar en `outbox` | `reporteVerificacionService.test.ts` (`5/5`) verifica rechazo estricto ante `401`, `403`, `404` y `409` | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad) |
| `CP-H39-PWA-11` | Sincronización en vivo vía sgrai:mision-sincronizada y vista resumen de solo lectura con autoría de otro integrante de patrulla | Tiempo Real / Multi-Operador | Hook / Página / Componente | Alta | Patrullero 2 visualizando misión activa mientras Patrullero 1 cierra la verificación | Evento `mision:actualizada`/`incidente:actualizado` en `useTerrenoSocket` y `window.dispatchEvent(new CustomEvent('sgrai:mision-sincronizada'))` | Recarga detalle, reemplaza formulario por `ResumenReporteTerreno`, muestra `"Registrado por Personal 1 (p1@valdivia.cl) · ..."` y oculta botón de envío | `useTerrenoSocket.test.ts` (`4/4`) y `PatrullaReporteCierre.test.tsx` (`3/3`) verifican actualización en vivo y autoría única | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(offline): preservar evaluaciones entre sesiones de patrulla y sincronizar estado multi-operador |
| `CP-H39-PWA-12` | Preservación de evaluaciones cacheadas entre cierre de sesión y cambio de usuario en IndexedDB y localStorage | Offline-First / Persistencia | Servicio / IndexedDB | Alta | Misión evaluada almacenada localmente antes de `limpiarAlmacenamientoOffline()` | Secuencia `guardarMisionLocal` -> `limpiarAlmacenamientoOffline` -> `guardarMisionesLocales` con lista resumida | Caché ligero `sgrai_evaluaciones_mision_v1` sobrevive al `logout` y refusiona evaluaciones sobre la misión entrante | `offlineQueue.test.ts` (`10/10`) y `misionesService.test.ts` (`21/21`) verifican persistencia y fusión tras cambio de sesión | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(offline): preservar evaluaciones entre sesiones de patrulla y sincronizar estado multi-operador |
| `CP-H39-PWA-13` | Cumplimiento de diseño Flat UI, esquinas rectas (--radius-none: 0px), objetivos táctiles >= 48px, Noto Sans local y cero emojis | Usabilidad / Diseño Terreno | UI / CSS / Estática | Media | Inspección CSS y análisis estático en `src/` de emojis, tipado `any` e importaciones `next/font/google` | `rg` de emojis y `any` en `src/` + `grep -rn "next/font/google" src` | `0` emojis; `0` anotaciones `any`; tipografía Noto Sans auto-alojada; botones `>= 48px` y `border-radius: 0px` | `NO_EMOJIS_IN_SRC`, `NO_ANY_IN_SRC`, `OK: sin Google Fonts` y preload de 5 fuentes locales Noto Sans `.woff2` | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(build): auto-alojar Noto Sans y documentar incidente de Google Fonts |
| `CP-H39-PWA-14` | Protección perimetral en middleware proxy (307 sin cookie) y disponibilidad SSR en /terreno/login, /terreno/patrulla/misiones y /terreno/patrulla/misiones/[id] | Seguridad / Perímetro | Sistema / HTTP | Alta | Servidor Next.js activo en `http://127.0.0.1:3002` | `GET /terreno/patrulla/misiones/60000000-...` sin cookie vs con cookie `sgrai_auth_token`, `GET /terreno/patrulla/misiones` con cookie y `GET /terreno/login` | Sin cookie retorna `307 Temporary Redirect` hacia `/terreno/login?returnUrl=...`; `/terreno/login`, bandeja y detalle autenticados retornan `200 OK` | `curl` confirma `HTTP/1.1 307 Temporary Redirect` con `location` exacta y `HTTP/1.1 200 OK` en login, bandeja y detalle con 5 `.woff2` preloaded | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | merge: integrar develop en feature/h39-patrulla-enviar-reporte-cerrar |
| `CP-H39-PWA-15` | Ejecución integral de Vitest, TypeScript (tsc --noEmit), ESLint y build productivo Next.js | Automatización / Build | Sistema / CI | Alta | Repositorio `web-app` en rama `feature/h39-patrulla-enviar-reporte-cerrar` con fixes aplicados | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` | `100%` de suites en verde, `0` errores de tipos, `0` errores/warnings ESLint y build productivo limpio | `56/56` archivos (`302/302` tests pass en `13.30s`); `tsc` exit `0`; `lint` exit `0`; `build` exit `0` (`8/8` páginas estáticas) | APROBADO | 24/11/2026 01:05 | 25/11/2026 01:01 | fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad) |

---

## 4. Bloque TSV para Google Sheets

````tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H39-PWA-01	Re-introducción de DEV_PATRULLA_TOKEN, enmascaramiento 401/403/404 y bypass RBAC de reportes:crear	Seguridad / RBAC	Auth / Servicio / UI	Crítica	Sesión con cookie o rol PATRULLA_VERIFICADORA con permisos: ['misiones:terreno:verificar'] sin 'reportes:crear'	rg -n "DEV_PATRULLA_TOKEN|esModoDemoLocal" src/; mock apiClient.POST (401/403/404) y tienePermiso('reportes:crear')	Sin credenciales demo ni enmascaramiento de 401/403/404; tienePermiso('reportes:crear') retorna false y deshabilita el formulario si falta reportes:crear	CLEAN_DEMO_BYPASS (0 hallazgos); reporteVerificacionService.test.ts propaga 401/403/404; AuthContext.test.tsx (9/9) valida RBAC estricto y page.tsx bloquea formulario con alerta	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad)
BUG-H39-PWA-02	Ausencia del campo obligatorio Estado del terreno (estado_terreno) en formulario, modal y resumen (CA-4)	Funcional / Contrato (CA-4)	Componente / Validación / Docs	Alta	Misión EN_CURSO abierta en /terreno/patrulla/misiones/{id} con sección de cierre expandida	estado_terreno: 'CRITICO' | 'ESTABLE' | 'INACCESIBLE' | 'CONTROLADO' | 'FINALIZADO' en Zod, UI, modal y payload	Formulario captura estado_terreno, lo valida como obligatorio en Zod, lo muestra en modal/resumen y lo envía a la API	Select "Estado del terreno" restaurado en UI/resumen/modal; reporteVerificacion.test.ts (6/6), ModalConfirmacionReporteCierre.test.tsx (2/2) y PatrullaReporteCierre.test.tsx (3/3) aprueban	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad)
BUG-H39-PWA-03	Pérdida de estado optimista COMPLETADA en misionesService y manejo defectuoso de 401/403/409/422 en useConnectivity	Offline-First / Integridad	Servicio / Hook / IndexedDB	Crítica	Misión EN_CURSO cerrada offline (estado: 'COMPLETADA', sincronizacionPendiente: true, ENVIAR_REPORTE en outbox)	Respuesta remota EN_CURSO antes de vaciar outbox; rechazo 401/403/409 y éxito 201 al sincronizar ENVIAR_REPORTE	Preservar COMPLETADA + sincronizacionPendiente: true hasta drenar outbox; ante 403/409/422 revertir a EN_CURSO, limpiar caché y refrescar; ante 401 invalidar sesión	misionesService.test.ts (21/21) preserva COMPLETADA; useConnectivity.test.ts (13/13) envía x-user-id, maneja 401, reconcilia 201 y revierte COMPLETADA + caché ante 403/409	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad)
BUG-H39-PWA-04	Uso de fetch directo con tipos manuales en lugar de openapi-fetch (apiClient) y tipos generados OpenAPI	Contrato OpenAPI / Arquitectura	Servicio / Tipos	Alta	Revisión de src/services/reporteVerificacionService.ts, src/types/offline.ts y src/types/api-generated.d.ts frente a AGENTS.md §3	Llamada apiClient.POST('/api/misiones/{id}/reporte', { params, body }) con CrearReporteVerificacionPayload	Invocar apiClient.POST('/api/misiones/{id}/reporte', ...) con tipos generados OpenAPI, interceptores x-user-id/401 y validación Zod previa al outbox	reporteVerificacionService.ts migrado 100% a apiClient.POST con CrearReporteVerificacionPayload canónico; verificado con vi.spyOn(apiClient, 'POST') en reporteVerificacionService.test.ts (5/5)	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad)
BUG-H39-PWA-05	Falta de refresco en bandeja/hub ante sgrai:mision-sincronizada / outbox-synced y modal abierto en cierre concurrente	Tiempo Real / Concurrencia UI	Página / Componente	Media	Patrullero B en /patrulla/misiones, /terreno o con modal de confirmación abierto cuando patrullero A cierra la misión	Eventos sgrai:mision-sincronizada, sgrai:outbox-synced y cierre concurrente con adjuntos en EvaluacionReporteCierreCard	Bandeja y tarjetas de inicio refrescan automáticamente; modal se cierra si yaEnviado cambia a true; resumen muestra adjuntos	PatrullaMisionesPage, TerrenoResumenOperativo y TerrenoSiguienteMision suscritos a ambos eventos; PatrullaReporteCierre.test.tsx (3/3) verifica cierre automático de modal y renderizado de porton_cerrado.jpg	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad)
CP-H39-PWA-01	Renderizado de sección de cierre y apertura automática del Paso 3 cuando Tipología (H37) y Prioridad (H38) están completadas	Funcional / UI (CA-1)	Componente / Integración	Crítica	Misión 60000000-0000-4000-8000-000000000001 en EN_CURSO con tipologiaEvaluada: true y prioridadEvaluada: true	Renderizado de PatrullaMisionDetailPage con mock de obtenerDetalleMision	Acordeón "Informe técnico de verificación y cierre" se abre automáticamente y muestra formulario táctil de cierre	Acordeón desplegado automáticamente con campo de personas precargado (4) y botón "Enviar Reporte y Cerrar Tarea" visible	APROBADO	24/11/2026 01:05	25/11/2026 01:01	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-02	Selector de dictamen operativo ['REQUIERE_CUADRILLA', 'NO_ABORDABLE'] y despliegue condicional de motivo_no_abordable	Funcional / UI (CA-2, CA-3)	Componente	Crítica	Componente EvaluacionReporteCierreCard montado en misión activa	Clic en opción role="radio" "No abordable" vs "Requiere cuadrilla"	motivo_no_abordable permanece oculto en REQUIERE_CUADRILLA y se despliega con aviso de liberación y descarte al elegir NO_ABORDABLE	Campo "Motivo de No Abordabilidad" ausente inicialmente y visible tras seleccionar "No abordable" (EvaluacionReporteCierreCard.test.tsx, 5/5)	APROBADO	24/11/2026 01:05	25/11/2026 01:01	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-03	Validación Zod de longitud mínima en resumen_tecnico (>= 10 caracteres) y motivo_no_abordable (>= 15 caracteres para NO_ABORDABLE)	Validación / Regla de Negocio (CA-3, CA-4)	Unitaria	Crítica	Esquema crearReporteVerificacionSchema importado	{ dictamen: 'REQUIERE_CUADRILLA', resumen_tecnico: 'Muy corto' } y { dictamen: 'NO_ABORDABLE', motivo_no_abordable: 'Predio privado', resumen_tecnico: '...' }	Rechaza resumen < 10 chars y motivo < 15 chars en NO_ABORDABLE; aprueba longitudes válidas	reporteVerificacion.test.ts (6/6) valida rechazo con mensajes explícitos y aprobación cuando cumple umbrales mínimos	APROBADO	24/11/2026 01:05	25/11/2026 01:01	feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39)
CP-H39-PWA-04	Validación Zod de personas_afectadas como entero no negativo (>= 0 y <= 5000)	Validación / Datos (CA-4)	Unitaria	Alta	Esquema crearReporteVerificacionSchema	{ personas_afectadas: -1 } y { personas_afectadas: 2.5 }	Rechaza valores negativos y decimales; aprueba enteros en rango [0, 5000]	reporteVerificacion.test.ts (6/6) verifica safeParse(...).success === false para -1 y 2.5	APROBADO	24/11/2026 01:05	25/11/2026 01:01	feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39)
CP-H39-PWA-05	Precarga de personas_afectadas desde reporte previo de prioridad (HU-38), nota de autoría y edición táctil	Funcional / Integración (CA-4)	Componente	Alta	Misión con EVALUACION_PRIORIDAD previo (personasAfectadas: 6, evaluador Personal 1)	Renderizado de EvaluacionReporteCierreCard y clic en "Aumentar personas damnificadas"	Inicializa input numérico en 6, muestra nota informativa con nombre Personal 1 y permite incrementar a 7	Input inicia en 6, nota-personas-previas muestra texto canónico y autor Personal 1, e incrementa a 7 al pulsar +	APROBADO	24/11/2026 01:05	25/11/2026 01:01	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-06	Captura de daños estimados, observaciones, interruptor Ficha FIBE (requiere_asistencia_social) y contenedor de evidencia HU-43	Funcional / UI (CA-4, CA-6)	Componente	Alta	Componente EvaluacionReporteCierreCard montado	Clic en role="switch" "Requiere Asistencia Social (Levantamiento Ficha FIBE)" e inspección de seccion-evidencia-h43	Switch alterna aria-checked (false a true) y despliega el contenedor preparado para integración multimedia HU-43	Switch alterna correctamente y data-testid="seccion-evidencia-h43" renderiza chip "Próximamente (HU-43)"	APROBADO	24/11/2026 01:05	25/11/2026 01:01	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-07	Modal de confirmación previa diferenciado por dictamen REQUIERE_CUADRILLA (teal) y NO_ABORDABLE (danger)	Funcional / UI (CA-3, CA-5)	Componente	Alta	ModalConfirmacionReporteCierre con abierto={true}	Props para REQUIERE_CUADRILLA (personasAfectadas: 4, estadoTerreno: 'CRITICO', requiereAsistenciaSocial: true) y NO_ABORDABLE con motivoNoAbordable	Muestra título, chip de dictamen, estado del terreno, personas, FIBE, resumen, motivo y alerta en NO_ABORDABLE	ModalConfirmacionReporteCierre.test.tsx (2/2 pass) verifica ambos dictámenes, estado del terreno y disparo de alConfirmar	APROBADO	24/11/2026 01:05	25/11/2026 01:01	feat(patrulla): estandarizar componentes de reporte e integrar informe tecnico de cierre (H39)
CP-H39-PWA-08	Envío online exitoso (201 Created), actualización local a COMPLETADA, patrulla DISPONIBLE y redirección a /patrulla/misiones	Funcional / Integración (CA-5, CA-8)	Servicio / Página	Crítica	navigator.onLine = true, misión EN_CURSO, mock apiClient.POST retornando 201 Created	POST /api/misiones/{id}/reporte con dictamen: 'REQUIERE_CUADRILLA', estado_terreno: 'CRITICO', resumen_tecnico, personas_afectadas: 5, requiere_asistencia_social: true	Persiste estado: 'COMPLETADA', estadoPatrulla: 'DISPONIBLE', evaluador, notifica éxito y ejecuta router.push('/patrulla/misiones')	reporteVerificacionService.test.ts (5/5) y PatrullaReporteCierre.test.tsx (3/3) verifican ok: true, estado local y redirección	APROBADO	24/11/2026 01:05	25/11/2026 01:01	feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39)
CP-H39-PWA-09	Encolamiento offline en IndexedDB outbox (ENVIAR_REPORTE) y actualización optimista cuando navigator.onLine es false	Offline-First / Resiliencia	Servicio / IndexedDB	Crítica	navigator.onLine = false y misión EN_CURSO	enviarReporteVerificacionTerreno con dictamen: 'NO_ABORDABLE', estado_terreno: 'INACCESIBLE', motivo >= 15 chars y resumen >= 10 chars	Encola ENVIAR_REPORTE hacia /api/misiones/{id}/reporte en outbox y guarda estado: 'COMPLETADA', sincronizacionPendiente: true y estadoIncidente: 'NO_ABORDABLE'	reporteVerificacionService.test.ts (5/5) verifica llamada a encolarAccionOutbox y flags optimistas locales	APROBADO	24/11/2026 01:05	25/11/2026 01:01	feat(patrulla): actualizar contratos, validaciones y servicios para informe de verificacion y cierre (H39)
CP-H39-PWA-10	Rechazo controlado en servicio online ante HTTP 401/403/404/409 sin encolar en outbox	Seguridad / Manejo de Errores (CA-9)	Servicio	Alta	navigator.onLine = true; respuestas mock 401, 403, 404 y 409 en apiClient.POST	Respuestas 401 ("Sesión expirada"), 403 ("reportes:crear"), 404 ("Misión no encontrada") y 409 ("ya fue cerrada previamente")	Lanza excepción descriptiva propagando el error del servidor sin guardar ni encolar en outbox	reporteVerificacionService.test.ts (5/5) verifica rechazo estricto ante 401, 403, 404 y 409	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad)
CP-H39-PWA-11	Sincronización en vivo vía sgrai:mision-sincronizada y vista resumen de solo lectura con autoría de otro integrante de patrulla	Tiempo Real / Multi-Operador	Hook / Página / Componente	Alta	Patrullero 2 visualizando misión activa mientras Patrullero 1 cierra la verificación	Evento mision:actualizada/incidente:actualizado en useTerrenoSocket y window.dispatchEvent(new CustomEvent('sgrai:mision-sincronizada'))	Recarga detalle, reemplaza formulario por ResumenReporteTerreno, muestra "Registrado por Personal 1 (p1@valdivia.cl) · ..." y oculta botón de envío	useTerrenoSocket.test.ts (4/4) y PatrullaReporteCierre.test.tsx (3/3) verifican actualización en vivo y autoría única	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(offline): preservar evaluaciones entre sesiones de patrulla y sincronizar estado multi-operador
CP-H39-PWA-12	Preservación de evaluaciones cacheadas entre cierre de sesión y cambio de usuario en IndexedDB y localStorage	Offline-First / Persistencia	Servicio / IndexedDB	Alta	Misión evaluada almacenada localmente antes de limpiarAlmacenamientoOffline()	Secuencia guardarMisionLocal -> limpiarAlmacenamientoOffline -> guardarMisionesLocales con lista resumida	Caché ligero sgrai_evaluaciones_mision_v1 sobrevive al logout y refusiona evaluaciones sobre la misión entrante	offlineQueue.test.ts (10/10) y misionesService.test.ts (21/21) verifican persistencia y fusión tras cambio de sesión	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(offline): preservar evaluaciones entre sesiones de patrulla y sincronizar estado multi-operador
CP-H39-PWA-13	Cumplimiento de diseño Flat UI, esquinas rectas (--radius-none: 0px), objetivos táctiles >= 48px, Noto Sans local y cero emojis	Usabilidad / Diseño Terreno	UI / CSS / Estática	Media	Inspección CSS y análisis estático en src/ de emojis, tipado any e importaciones next/font/google	rg de emojis y any en src/ + grep -rn "next/font/google" src	0 emojis; 0 anotaciones any; tipografía Noto Sans auto-alojada; botones >= 48px y border-radius: 0px	NO_EMOJIS_IN_SRC, NO_ANY_IN_SRC, OK: sin Google Fonts y preload de 5 fuentes locales Noto Sans .woff2	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(build): auto-alojar Noto Sans y documentar incidente de Google Fonts
CP-H39-PWA-14	Protección perimetral en middleware proxy (307 sin cookie) y disponibilidad SSR en /terreno/login, /terreno/patrulla/misiones y /terreno/patrulla/misiones/[id]	Seguridad / Perímetro	Sistema / HTTP	Alta	Servidor Next.js activo en http://127.0.0.1:3002	GET /terreno/patrulla/misiones/60000000-... sin cookie vs con cookie sgrai_auth_token, GET /terreno/patrulla/misiones con cookie y GET /terreno/login	Sin cookie retorna 307 Temporary Redirect hacia /terreno/login?returnUrl=...; /terreno/login, bandeja y detalle autenticados retornan 200 OK	curl confirma HTTP/1.1 307 Temporary Redirect con location exacta y HTTP/1.1 200 OK en login, bandeja y detalle con 5 .woff2 preloaded	APROBADO	24/11/2026 01:05	25/11/2026 01:01	merge: integrar develop en feature/h39-patrulla-enviar-reporte-cerrar
CP-H39-PWA-15	Ejecución integral de Vitest, TypeScript (tsc --noEmit), ESLint y build productivo Next.js	Automatización / Build	Sistema / CI	Alta	Repositorio web-app en rama feature/h39-patrulla-enviar-reporte-cerrar con fixes aplicados	npm test, npx tsc --noEmit, npm run lint, npm run build	100% de suites en verde, 0 errores de tipos, 0 errores/warnings ESLint y build productivo limpio	56/56 archivos (302/302 tests pass en 13.30s); tsc exit 0; lint exit 0; build exit 0 (8/8 páginas estáticas)	APROBADO	24/11/2026 01:05	25/11/2026 01:01	fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad)
````

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables (Re-Test Final)

### 5.1 Suite Focalizada HU-39, Regresión de Fixes y Dependencias Offline / Auth (Vitest)
```bash
npx vitest run \
  src/lib/validations/__tests__/reporteVerificacion.test.ts \
  src/services/__tests__/reporteVerificacionService.test.ts \
  src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx \
  src/components/misiones/__tests__/ModalConfirmacionReporteCierre.test.tsx \
  src/components/misiones/__tests__/ReporteTerrenoBase.test.tsx \
  "src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaReporteCierre.test.tsx" \
  src/hooks/__tests__/useTerrenoSocket.test.ts \
  src/hooks/__tests__/useConnectivity.test.ts \
  src/services/__tests__/offlineQueue.test.ts \
  src/services/__tests__/misionesService.test.ts \
  src/context/__tests__/AuthContext.test.tsx
```

**Evidencia Obtenida (Re-Test `25/11/2026`):**
```text
 ✓ src/services/__tests__/offlineQueue.test.ts (10 tests) 38ms
 ✓ src/lib/validations/__tests__/reporteVerificacion.test.ts (6 tests) 10ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (13 tests) 162ms
 ✓ src/services/__tests__/reporteVerificacionService.test.ts (5 tests) 41ms
 ✓ src/hooks/__tests__/useTerrenoSocket.test.ts (4 tests) 49ms
 ✓ src/services/__tests__/misionesService.test.ts (21 tests) 60ms
 ✓ src/context/__tests__/AuthContext.test.tsx (9 tests) 92ms
 ✓ src/components/misiones/__tests__/ReporteTerrenoBase.test.tsx (4 tests) 244ms
 ✓ src/components/misiones/__tests__/ModalConfirmacionReporteCierre.test.tsx (2 tests) 233ms
 ✓ src/components/misiones/__tests__/EvaluacionReporteCierreCard.test.tsx (5 tests) 492ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaReporteCierre.test.tsx (3 tests) 663ms

 Test Files  11 passed (11)
      Tests  82 passed (82)
   Start at  00:59:36
   Duration  3.29s (transform 3.55s, setup 2.64s, collect 6.85s, tests 2.08s, environment 10.44s, prepare 1.25s)
```

### 5.2 Ejecución Individual Filtrada con `-t` en Vitest
```bash
npm test -- -t "reporteVerificacionService"
npm test -- -t "EvaluacionReporteCierreCard"
npm test -- -t "ModalConfirmacionReporteCierre"
npm test -- -t "Informe Técnico de Verificación y Cierre"
npm test -- -t "Validaciones de informe técnico de verificación y cierre"
npm test -- -t "BUG-H39"
```

**Evidencia Obtenida (Re-Test `25/11/2026`):**
```text
# -t "reporteVerificacionService"
 Test Files  1 passed | 55 skipped (56)
      Tests  5 passed | 297 skipped (302)
   Start at  00:59:42
   Duration  9.41s

# -t "EvaluacionReporteCierreCard"
 Test Files  1 passed | 55 skipped (56)
      Tests  5 passed | 297 skipped (302)
   Start at  00:59:52
   Duration  8.92s

# -t "ModalConfirmacionReporteCierre"
 Test Files  1 passed | 55 skipped (56)
      Tests  2 passed | 300 skipped (302)
   Start at  01:00:02
   Duration  9.52s

# -t "Informe Técnico de Verificación y Cierre"
 Test Files  1 passed | 55 skipped (56)
      Tests  3 passed | 299 skipped (302)
   Start at  01:00:12
   Duration  10.20s

# -t "Validaciones de informe técnico de verificación y cierre"
 Test Files  1 passed | 55 skipped (56)
      Tests  6 passed | 296 skipped (302)
   Start at  01:00:23
   Duration  11.86s

# -t "BUG-H39"
 Test Files  6 passed | 50 skipped (56)
      Tests  7 passed | 295 skipped (302)
   Start at  01:00:35
   Duration  13.67s
```

### 5.3 Suite Global, Compilación TypeScript, ESLint y Build Productivo
```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

**Evidencia Obtenida (Re-Test `25/11/2026`):**
```text
# npm test
 Test Files  56 passed (56)
      Tests  302 passed (302)
   Start at  00:58:02
   Duration  13.30s (transform 5.77s, setup 16.21s, collect 29.29s, tests 21.82s, environment 80.41s, prepare 9.89s)

# npx tsc --noEmit -> exit code 0 (0 errores)
# npm run lint     -> exit code 0 (0 errores, 0 advertencias)

# npm run build
▲ Next.js 16.3.4 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 34ms

  Creating an optimized production build ...
✓ Compiled successfully in 4.9s
  Finished TypeScript in 13.0s
  Collecting page data using 11 workers in 1732ms
  Generating static pages using 11 workers (8/8) in 2.7s
  Collecting build traces in 23.8s
  Finalizing page optimization in 23.9s
```

### 5.4 Auditoría Estática de Seguridad, Emojis, Tipado Estricto y Fuentes Locales
```bash
rg -n "DEV_PATRULLA_TOKEN|DEV_PATRULLA_USER_ID|esModoDemoLocal|buildAuthHeaders" src/ || echo "CLEAN_DEMO_BYPASS"
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS_IN_SRC"
rg -n ":\s*any\b|\bas\s+any\b" src/ || echo "NO_ANY_IN_SRC"
grep -rn "next/font/google" src || echo "OK: sin Google Fonts"
```

**Evidencia Obtenida (Re-Test `25/11/2026`):**
```text
CLEAN_DEMO_BYPASS
NO_EMOJIS_IN_SRC
NO_ANY_IN_SRC
OK: sin Google Fonts
```

### 5.5 Verificación HTTP Perimetral sobre Servidor PWA (`127.0.0.1:3002`)
```bash
curl -s -i "http://127.0.0.1:3002/terreno/patrulla/misiones/60000000-0000-4000-8000-000000000001" | head -n 12
curl -s -i "http://127.0.0.1:3002/terreno/login" | head -n 12
curl -s -i -H "Cookie: sgrai_auth_token=jwt-qa-probe" \
  "http://127.0.0.1:3002/terreno/patrulla/misiones/60000000-0000-4000-8000-000000000001" | head -n 12
curl -s -i -H "Cookie: sgrai_auth_token=jwt-qa-probe" \
  "http://127.0.0.1:3002/terreno/patrulla/misiones" | head -n 12
```

**Respuestas HTTP Obtenidas (Re-Test `25/11/2026`):**
```http
# Caso 1: Acceso a detalle sin cookie de sesión -> 307 Temporary Redirect
HTTP/1.1 307 Temporary Redirect
location: /terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones%2F60000000-0000-4000-8000-000000000001
Date: Wed, 25 Nov 2026 04:00:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

# Caso 2: Vista de acceso /terreno/login -> 200 OK (con Noto Sans local en Link preload)
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Link: </terreno/_next/static/media/10feed5d5dd084de-s.p.woff2?v=1795579222922>; rel=preload; as="font"; crossorigin=""; type="font/woff2", </terreno/_next/static/media/1d02f490f5cc37ac-s.p.woff2?v=1795579222922>; rel=preload; as="font"; crossorigin=""; type="font/woff2", </terreno/_next/static/media/cb57c6a98d46fca0-s.p.woff2?v=1795579222922>; rel=preload; as="font"; crossorigin=""; type="font/woff2", </terreno/_next/static/media/e19986ff22578d0b-s.p.woff2?v=1795579222922>; rel=preload; as="font"; crossorigin=""; type="font/woff2", </terreno/_next/static/media/fd476b27505e146e-s.p.woff2?v=1795579222922>; rel=preload; as="font"; crossorigin=""; type="font/woff2"
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8

# Caso 3: Ruta de detalle con cookie de sesión -> 200 OK
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8

# Caso 4: Bandeja de patrulla /terreno/patrulla/misiones con cookie -> 200 OK
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos / Defectos Asociados | Estado Actual (`sgrai-pwa`) | Dictamen |
|---|---|---|---|
| **CA-1:** La PWA debe proveer un formulario de reporte técnico de verificación accesible para la patrulla. | `CP-H39-PWA-01`, `CP-H39-PWA-13` | Implementado dentro de `SeccionDesplegable` en `/patrulla/misiones/[id]` con ergonomía táctil (`>= 48px`), Flat UI y tipografía local Noto Sans. | **Cumplido** |
| **CA-2:** El formulario en la PWA debe incorporar el selector de dictamen operativo: `Dictamen de Atención: ['REQUIERE_CUADRILLA', 'NO_ABORDABLE']`. | `CP-H39-PWA-02`, `CP-H39-PWA-03` | Selector táctil tipo radio implementado con ambas opciones canónicas y contraste semántico. | **Cumplido** |
| **CA-3:** Si selecciona `NO_ABORDABLE`, exigir `motivo_no_abordable` ($\ge 15$ caracteres); transacción atómica y liberación de patrulla a `DISPONIBLE`. | `CP-H39-PWA-02`, `CP-H39-PWA-03`, `CP-H39-PWA-07`, `CP-H39-PWA-09`, `BUG-H39-PWA-03` | Validación Zod (`>= 15` chars), modal `danger`, flujo offline con preservación optimista en `misionesService.ts` y liberación local a `DISPONIBLE`. | **Cumplido** |
| **CA-4:** Capturar `resumen_tecnico` ($\ge 10$ chars), `estado_terreno`, `personas_afectadas`, `danos_estimados`, `observaciones` y `requiere_asistencia_social`. | `CP-H39-PWA-03`, `CP-H39-PWA-04`, `CP-H39-PWA-05`, `CP-H39-PWA-06`, `BUG-H39-PWA-02` | Restaurado selector obligatorio `"Estado del terreno"` (`estado_terreno`) en formulario, modal, resumen, Zod y payload API junto al resto de campos del formulario. | **Cumplido** |
| **CA-5:** Al presionar 'Enviar Reporte y Cerrar Tarea', ejecutar transacción en API (`reporte_terreno`, `mision = COMPLETADA`, `requiere_asistencia_social`, `mision_hito`). | `CP-H39-PWA-07`, `CP-H39-PWA-08`, `CP-H39-PWA-09`, `BUG-H39-PWA-03`, `BUG-H39-PWA-04` | Invocación vía `apiClient.POST('/api/misiones/{id}/reporte', ...)` con `CrearReporteVerificacionPayload` y reconciliación/rollback en `useConnectivity.ts` ante `201` o rechazo terminal. | **Cumplido** |
| **CA-6:** Permitir adjuntar fotografías como evidencia técnica (integrándose con H43). | `CP-H39-PWA-06`, `BUG-H39-PWA-05` | Contenedor UI preparado (`seccion-evidencia-h43`), soporte de `adjuntoIds`/`adjuntos` en esquema/servicio y visualización de `adjuntos` en `<ResumenReporteTerreno>` (carga multipart sujeta a entrega de HU-43). | **Cumplido (Alcance H39 / Integrado a H43)** |
| **CA-7:** Emitir notificaciones WebSocket `mision:actualizada` e `incidente:actualizado` al Centro de Mando y sincronizar en terreno. | `CP-H39-PWA-11`, `BUG-H39-PWA-05` | `useTerrenoSocket`, `PatrullaMisionDetailPage`, `PatrullaMisionesPage`, `TerrenoResumenOperativo` y `TerrenoSiguienteMision` sincronizan en vivo y cierran el modal ante cierre concurrente. | **Cumplido** |
| **CA-8:** La PWA debe notificar el éxito del envío y regresar a la pantalla de espera de nuevas asignaciones. | `CP-H39-PWA-08`, `BUG-H39-PWA-03` | Emite `Toast` de confirmación online/offline, preserva cierre optimista en bandeja si `outbox` sigue pendiente y redirige a `/patrulla/misiones`. | **Cumplido** |
| **CA-9:** El endpoint debe requerir el permiso RBAC `reportes:crear`. | `CP-H39-PWA-10`, `BUG-H39-PWA-01` | Sin credenciales demo ni enmascaramiento `401`/`403`/`404`; `AuthContext.tsx` y `PatrullaMisionDetailPage` validan estrictamente `tienePermiso('reportes:crear')`. | **Cumplido** |

---

## 7. Dictamen Final de QA (Re-Test)

En el Re-Test ejecutado el `25/11/2026 01:01 -03:00` sobre el commit `fix(patrulla): resolver observaciones QA H39 (RBAC estricto, estado_terreno, outbox/rollback, apiClient y reactividad)`, se verificó la resolución íntegra de los **5 defectos** reportados inicialmente (`BUG-H39-PWA-01` a `BUG-H39-PWA-05`), sin hallazgos adicionales de seguridad, tipado estricto, accesibilidad Flat UI ni regresiones en la suite automatizada (`56/56` archivos, `302/302` pruebas en verde, `tsc`, `lint` y `build` exitosos).

**Dictamen:** **APROBADO — LISTO PARA MERGE A `develop`**

# Auditoría Técnica y Matriz de Casos de Prueba — HU-41: Rechazo Motivado de Misión por Delegado de Cuadrilla (`sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Estándar Aplicado:** IEEE 829 / ISO/IEC/IEEE 29119  
**Repositorio Auditado:** `sgrai-pwa` (`web-app` — Cliente Móvil de Terreno PWA)  
**Rama Evaluada:** `feature/h41-cuadrilla-rechazar-asignacion`  
**Historia de Usuario:** HU-41 — *"Como Delegado de cuadrilla Quiero rechazar la solicitud de asignación a un incidente ingresando una justificación técnica obligatoria. Para informar oportunamente al Centro de Mando los motivos de fuerza mayor que impiden la atención para que la emergencia sea reasignada de inmediato a otra unidad."*  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
**Commits Evaluados en la Rama:**
* `feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41)`
* `feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41)`
* `feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)`
* `test(cuadrilla): agregar pruebas unitarias y de integracion para rechazo motivado (H41)`
* `docs(manuals): agregar manual de usuario para rechazo motivado de cuadrilla (H41)`

**Fecha y Hora de Auditoría Inicial:** `24/11/2026 01:36 -03:00`  
**Entorno de Ejecución:** Linux, Node.js, Next.js 16.3.4 (Webpack), React 19.2.8, TypeScript 5, Zod 4.5.4, IndexedDB `idb` 8.0.2 (`fake-indexeddb` 6.2.6), `openapi-fetch` 0.17.0, `socket.io-client` 4.8.3, `lucide-react` 1.48.0, Vitest 3.2.7, React Testing Library 16.3.3, ESLint 9.  
**Dictamen de Auditoría:** **RECHAZADO — CAMBIOS SOLICITADOS (`5` Defectos Abiertos: `1` Crítico, `3` Altos, `1` Medio; `14` de `19` Casos Aprobados — `73.7%` Pass)**

---

## 1. Resumen Ejecutivo

Durante la auditoría técnica inicial sobre la rama `feature/h41-cuadrilla-rechazar-asignacion` del repositorio `sgrai-pwa` (`web-app`), se evaluaron la implementación del flujo de rechazo motivado para el rol `DELEGADO_CUADRILLA`, la validación de la regla de negocio §3.3 (justificación obligatoria con mínimo 5 caracteres útiles), el soporte Offline-First en IndexedDB (`outbox`), los controles RBAC y de estado en la vista `/cuadrilla/misiones/[id]`, la suscripción WebSocket a `mision:rechazada`, la conformidad con la guía de diseño plano municipal y las pruebas automatizadas.

Si bien los `35` archivos y `143` pruebas unitarias existentes en Vitest (`36` pruebas distribuidas en `7` suites directamente relacionadas) aprueban en JSDOM y el análisis estático ESLint finaliza sin errores ni advertencias (`0` errores, `0` advertencias), **la rama no se encuentra apta para integración en `develop`** debido a `5` defectos reales identificados en el análisis forense y la verificación de compilación:

1. **Bloqueo de compilación TypeScript y build productivo (`BUG-H41-PWA-01`, Crítico):** `npx tsc --noEmit` (`exit 2`) y `npm run build` (`exit 1`) fallan porque `CuadrillaMisionDetailPage` modificó la firma estándar de Next.js 16 `PageProps.params` a una unión `Promise<{ id: string }> | { id: string }` para acomodar pruebas síncronas, rompiendo la generación de tipos `.next/types`, sumado a la referencia huérfana a `DEV_PATRULLA_TOKEN` en `src/lib/socket/socketClient.ts` por falta de integración con `origin/develop`.
2. **Desactualización severa y conflictos directos con `origin/develop` (`BUG-H41-PWA-02`, Alta):** La rama está `55` commits por detrás de `origin/develop` y presenta conflictos directos de fusión en `10` archivos compartidos con HU-69 y HU-37 (`api-generated.d.ts`, `RechazoMisionModal.*`, `useConnectivity.ts`, `misiones.ts`, `misionesService.ts`, `offline.ts` y sus pruebas), omitiendo mejoras ya consolidadas como el ordenamiento causal de `outbox` y eliminando definiciones OpenAPI de HU-37/HU-69.
3. **Inconsistencias de trazabilidad, feedback visual y sincronización offline (`BUG-H41-PWA-03`, Alta):** `obtenerDetalleMision` no mapea `justificacionRechazo` desde `GET /api/misiones/{id}` dejando inoperativo el bloque `rejectedInfoBox` en consultas en línea; `handleConfirmarRechazo` ejecuta `router.push('/cuadrilla/misiones')` inmediatamente después de asignar `mensajeConfirmacion`, impidiendo que el operador visualice la confirmación online u offline; y la sincronización de `RECHAZAR_MISION` en `useConnectivity` y `persistirRechazoLocal` presenta brechas ante registros no cacheados o fallos consecutivos tras conflicto `409`/`403`/`400`.
4. **Brechas de cobertura de pruebas automatizadas y filtrado WebSocket (`BUG-H41-PWA-04`, Alta):** `useTerrenoSocket.ts` no filtra `mision:rechazada` por `cuadrillaId` ni posee pruebas unitarias para dicho evento en `useTerrenoSocket.test.ts`; `useConnectivity.test.ts` carece de pruebas para la rama `RECHAZAR_MISION`; `CuadrillaMisionesPage.test.tsx` no cubre el refresco por `sgrai:mision-rechazada`/`sgrai:outbox-synced`; y `CuadrillaDetailPage.test.tsx` omite escenarios críticos de estado, unidad inactiva, rol ajeno, errores HTTP y captura GPS.
5. **Variable CSS inexistente, limpieza GPS en modal y desfase documental (`BUG-H41-PWA-05`, Media):** `CuadrillaDetailPage.module.css` usa `var(--color-border)` sin fallback (token inexistente en `src/styles/tokens.css`, cuyo estándar es `--border-color-neutral`), `RechazoMisionModal.tsx` no cancela callbacks asíncronos ni reinicia `obteniendoGps` al cerrarse, y la documentación presenta desajuste textual respecto al badge `"Trabajando offline"` y omisión de `POST /api/misiones/{id}/rechazar` en `docs/api/contratos-terreno.md`.

| Métrica de Calidad | Resultado Auditoría Inicial (`24/11/2026`) | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos en Matriz (HU-41 PWA)** | **19** | `5` Defectos Abiertos (`BUG-H41-PWA-01` a `05`) + `14` Casos Base (`CP-H41-PWA-01` a `14`) |
| **Casos Aprobados (`APROBADO`)** | **14** | `73.7%` de aprobación en auditoría inicial |
| **Defectos Abiertos (`ABIERTO`)** | **5** | `1` Crítico, `3` Altos, `1` Medio |
| **Suite Global PWA (`npm test`)** | **35 archivos / 143 tests pass** | Duración `7.33s` (entorno JSDOM con mocks de servicio en vistas) |
| **Subconjunto Focalizado HU-41 (Vitest)** | **7 archivos / 36 tests pass** | Cobertura insuficiente en `useConnectivity`, `useTerrenoSocket`, `CuadrillaMisionesPage` y bordes de `CuadrillaDetailPage` |
| **Verificación de Tipos (`npx tsc --noEmit`)** | **FALLIDO** (`exit 2`, `2` errores) | `TS2344` en `cuadrilla/misiones/[id]/page.tsx` y `TS2614` en `socketClient.ts` |
| **Build de Producción (`npm run build`)** | **FALLIDO** (`exit 1`) | Fallo en fase de chequeo de tipos Next.js 16.3.4 (`Failed to type check`) |
| **Análisis Estático ESLint (`npm run lint`)** | **APROBADO** (`0` errores / `0` advertencias) | Sin incidencias de linter |
| **Verificación de Emojis y Uso de `any` en `src/`** | **APROBADO** (`0` coincidencias) | Uso exclusivo de `lucide-react` y tipado estricto en archivos HU-41 |

---

## 2. Registro Técnico de Defectos

### `BUG-H41-PWA-01` — Fallo de compilación TypeScript (`TS2344`, `TS2614`) y build de producción Next.js 16 en `CuadrillaMisionDetailPage` y `socketClient.ts`
* **Severidad:** Crítica (Bloqueante de build, CI/CD y despliegue Docker)
* **Estado:** **ABIERTO**
* **Archivos afectados:**
  * `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (líneas 34–43)
  * `src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx` (líneas 80, 101, 118)
  * `src/lib/socket/socketClient.ts` (línea 4, desactualizado respecto a `origin/develop`)
* **Descripción y Causa Raíz:**  
  En Next.js 16 App Router, el contrato generado en `.next/types/` exige que `params` en una ruta dinámica sea estrictamente `Promise<{ id: string }>`. El desarrollador cambió la interfaz `PageProps` en `CuadrillaMisionDetailPage` a `params: Promise<{ id: string }> | { id: string }` para invocar `<CuadrillaMisionDetailPage params={{ id: misionDespachada.id }} />` de forma síncrona en `CuadrillaDetailPage.test.tsx`. Adicionalmente, la rama conserva la importación huérfana `import { DEV_PATRULLA_TOKEN } from '@/lib/api/client'` en `socketClient.ts`, ya corregida en `origin/develop`.
* **Evidencia:**  
  - `npx tsc --noEmit` retorna `exit code 2` con `.next/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts(39,29): error TS2344` y `src/lib/socket/socketClient.ts(4,10): error TS2614`.
  - `npm run build` falla con `exit code 1` (`Failed to type check.`).
* **Impacto:** Impide generar el artefacto `output: "standalone"` de Next.js 16 y bloquea el pipeline de CI/CD y construcción de la imagen Docker.
* **Solución Requerida:** Mantener `params: Promise<{ id: string }>` y `const { id: misionId } = use(params);` en `CuadrillaMisionDetailPage`, adaptar `CuadrillaDetailPage.test.tsx` usando `<Suspense>` y `params={Promise.resolve({ id: ... })}`, e integrar `origin/develop`.

---

### `BUG-H41-PWA-02` — Desactualización severa (`55` commits detrás) y conflictos directos en `10` archivos compartidos con `origin/develop`
* **Severidad:** Alta (Riesgo de regresión funcional en HU-37 / HU-69 e inconsistencia de contratos OpenAPI)
* **Estado:** **ABIERTO**
* **Archivos afectados:**
  * `src/types/api-generated.d.ts`
  * `src/components/misiones/RechazoMisionModal.tsx`, `src/components/misiones/RechazoMisionModal.module.css`, `src/components/misiones/__tests__/RechazoMisionModal.test.tsx`
  * `src/hooks/useConnectivity.ts`
  * `src/lib/validations/misiones.ts`, `src/lib/validations/misiones.test.ts`
  * `src/services/misionesService.ts`, `src/services/__tests__/misionesService.test.ts`
  * `src/types/offline.ts`, `src/app/(terreno)/cuadrilla/misiones/page.tsx`
* **Descripción y Causa Raíz:**  
  La rama `feature/h41-cuadrilla-rechazar-asignacion` parte de una base anterior a la integración de HU-69 y HU-37 en `origin/develop`. El análisis de fusión mediante `git merge-tree` detecta colisiones directas en `10` archivos compartidos. En particular, `src/types/api-generated.d.ts` omite rutas y esquemas integrados en `develop` (como `/api/incidentes/{id}/tipologia`, `/api/eventos-atp` y `MisionHitoTipologia`), `offlineQueue.ts` y `useConnectivity.ts` carecen del ordenamiento causal por misión (`obtenerClaveCausalAccion`) y limpieza de ítems fallidos en `outbox`, y `cuadrilla/misiones/page.tsx` no incorpora `useMisionesSocket` ni `NuevaMisionBanner`.
* **Evidencia:** `git rev-list --left-right --count origin/develop...HEAD` reporta `55` commits en `origin/develop` ausentes en la rama, y `git merge-tree` evidencia marcadores `<<<<<<<` en `10` archivos.
* **Impacto:** Bloquea la fusión hacia `develop` y expone a pérdida de funcionalidades certificadas en HU-37 y HU-69 si se resuelven conflictos de forma incompleta.
* **Solución Requerida:** Integrar `origin/develop` en la rama preservando la parametrización reusable de `RechazoMisionModal` (`titulo`, `unidadEtiqueta`) y la validación de coordenadas acopladas de `rechazoMisionSchema`, manteniendo el orden causal en `offlineQueue.ts` y regenerando `api-generated.d.ts` desde la rama unificada de `sgrai-api`.

---

### `BUG-H41-PWA-03` — Omisión de `justificacionRechazo` en `obtenerDetalleMision`, pérdida de feedback visual por `router.push` inmediato y consistencia parcial en `outbox`
* **Severidad:** Alta (Integridad Offline-First y pérdida de trazabilidad / retroalimentación operativa)
* **Estado:** **ABIERTO**
* **Archivos afectados:**
  * `src/services/misionesService.ts` (líneas 224–265 y 493–535)
  * `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (líneas 164–167, 176–204 y 232–246)
  * `src/hooks/useConnectivity.ts` (líneas 84–89 y 140–172)
* **Descripción y Causa Raíz:**
  1. **Omisión de mapeo en `obtenerDetalleMision`:** El endpoint `GET /api/misiones/{id}` retorna `justificacionRechazo`, pero `misionesService.ts` (líneas 231–240) no lo asigna en `datosRemotos` (y además asigna `estadoPatrulla: d.patrulla?.estado || 'EN_VERIFICACION'` incluso en misiones de cuadrilla). Al consultar una misión `RECHAZADA` con red activa, `mision.datosAdicionales?.justificacionRechazo` queda indefinido y `CuadrillaMisionDetailPage` nunca renderiza `rejectedInfoBox`.
  2. **Navegación inmediata que oculta alertas:** En `handleConfirmarRechazo` (`cuadrilla/misiones/[id]/page.tsx:200-203`), tras invocar `setMensajeConfirmacion(res.mensaje)` se ejecuta de inmediato `router.push('/cuadrilla/misiones')`, desmontando el componente antes de que `successAlertBanner` o `offlineAlertBanner` sean visibles y sin trasladar una notificación o parámetro visual hacia `/cuadrilla/misiones`.
  3. **Persistencia local y rollback incompleto:** En `rechazarMision` (`persistirRechazoLocal`, líneas 493–511), si `obtenerMisionLocalPorId(id)` retorna `undefined`, no se crea el registro local optimista en IndexedDB. Adicionalmente, en `useConnectivity.ts` (líneas 158–167), cuando `POST /api/misiones/{id}/rechazar` retorna un conflicto terminal o error irrecuperable (`409`/`403`/`400`), el bloque guarda primero `estado: local.estado` (`'RECHAZADA'`) con `sincronizacionPendiente: false` sin limpiar `justificacionRechazo`; si `obtenerDetalleMision(misionId)` falla a continuación por corte de red, el dispositivo queda con estado falso `RECHAZADA`. Tampoco se contempla el tratamiento de `401 Unauthorized` en `esErrorIrrecuperable` ni la propagación de refresco hacia `TerrenoResumenOperativo` / `TerrenoSiguienteMision`.
* **Impacto:** El delegado de cuadrilla pierde confirmación visual al rechazar en terreno, no visualiza la justificación histórica desde el servidor y puede conservar estados inconsistentes en IndexedDB tras errores de sincronización diferida.
* **Solución Requerida:** Mapear `justificacionRechazo` en `obtenerDetalleMision`; mostrar feedback persistente (toast o parámetro en la bandeja `/cuadrilla/misiones` tras redirección, o confirmación previa al retorno); crear/actualizar el registro local de respaldo en `persistirRechazoLocal` si no existe; y en `useConnectivity` restaurar/limpiar la marca optimista al producirse errores terminales antes o después de refrescar el estado real.

---

### `BUG-H41-PWA-04` — Cobertura insuficiente de pruebas automatizadas (`AGENTS.md §4`) y ausencia de filtro por `cuadrillaId` en `useTerrenoSocket.ts`
* **Severidad:** Alta (Incumplimiento de estándar de pruebas `AGENTS.md §4` y riesgo de eventos cruzados)
* **Estado:** **ABIERTO**
* **Archivos afectados:**
  * `src/hooks/useTerrenoSocket.ts` (líneas 61–77) y `src/hooks/__tests__/useTerrenoSocket.test.ts`
  * `src/hooks/__tests__/useConnectivity.test.ts`
  * `src/app/(terreno)/cuadrilla/misiones/__tests__/CuadrillaMisionesPage.test.tsx`
  * `src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx` (líneas 90–110)
  * `src/components/misiones/__tests__/RechazoMisionModal.test.tsx`
* **Descripción y Causa Raíz:**
  1. `useTerrenoSocket.ts` escucha `mision:rechazada` y dispara `sgrai:mision-rechazada` sin verificar si `data?.cuadrillaId` corresponde a `usuario.unidadId` (contrario al filtrado aplicado en `manejarDesactivacion`). `useTerrenoSocket.test.ts` no contiene ninguna prueba para `mision:rechazada` ni para `socket.off('mision:rechazada', ...)`.
  2. `useConnectivity.test.ts` no posee ninguna prueba para el nuevo bloque `accion.tipo === 'RECHAZAR_MISION'` (`200 OK`, `409 Conflict`, errores `400`/`403`/`422`).
  3. `CuadrillaMisionesPage.test.tsx` no verifica que los eventos `sgrai:mision-rechazada` y `sgrai:outbox-synced` disparen la recarga de faenas ni que las misiones rechazadas abandonen el contador de pendientes.
  4. En `CuadrillaDetailPage.test.tsx` (línea 90), la prueba afirma validar estado distinto de `DESPACHADA` o falta de permiso RBAC, pero únicamente prueba ausencia de permiso sobre una misión `DESPACHADA`. Quedan sin pruebas los casos de misión en `EN_CURSO` / `RECHAZADA`, cuadrilla desactivada (`unidadActiva: false`) o sin asignación (`SIN_ASIGNACION`), rol no cuadrilla (`esCuadrilla: false`), error HTTP `409`/`403` manteniendo el modal abierto sin redirigir, y envío de coordenadas GPS.
* **Impacto:** Cambios críticos en sincronización offline, WebSockets y guardas de UI/RBAC carecen de protección contra regresiones.
* **Solución Requerida:** Filtrar `mision:rechazada` por `cuadrillaId` en `useTerrenoSocket.ts` y agregar pruebas unitarias/integración completas en las `5` suites señaladas.

---

### `BUG-H41-PWA-05` — Variable CSS inexistente `--color-border` en `CuadrillaDetailPage.module.css`, limpieza incompleta de efecto GPS en modal y desfase en manual/contratos
* **Severidad:** Media (Deuda de diseño visual, ciclo de vida React y precisión documental)
* **Estado:** **ABIERTO**
* **Archivos afectados:**
  * `src/app/(terreno)/cuadrilla/misiones/[id]/CuadrillaDetailPage.module.css` (líneas 19, 48, 106, 157, 175)
  * `src/components/misiones/RechazoMisionModal.tsx` (líneas 38–65)
  * `docs/manuals/H41-rechazo-mision-cuadrilla.md` (línea 47)
  * `docs/api/contratos-terreno.md`
* **Descripción y Causa Raíz:**
  1. `CuadrillaDetailPage.module.css` utiliza `var(--color-border)` sin respaldo en cinco selectores (`.backLink`, `.missionHeader`, `.priorityNeutro`, `.readOnlyNotice`, `.dispatchCard`). Dicho token no existe en `src/styles/tokens.css`, donde el borde neutro institucional corresponde a `var(--border-color-neutral, #DFE3E8)`.
  2. En `RechazoMisionModal.tsx` (líneas 38–65), al cerrarse el modal (`!abierto`) no se restablece `setObteniendoGps(false)` ni existe una bandera de cancelación en el cleanup del `useEffect` para descartar respuestas tardías de `navigator.geolocation.getCurrentPosition`.
  3. En `docs/manuals/H41-rechazo-mision-cuadrilla.md` (línea 47), se indica que `ConnectionStatusBadge` exhibe `"Sin conexión"`, cuando el texto real implementado en `ConnectionStatusBadge.tsx` (línea 25) es `"Trabajando offline"`. Además, `docs/api/contratos-terreno.md` en esta rama no incluye el contrato de `POST /api/misiones/{id}/rechazar` ni el evento `mision:rechazada` con el permiso `misiones:terreno:ejecutar`.
* **Impacto:** Bordes inconsistentes en tarjetas y controles de detalle de cuadrilla, posible actualización de estado sobre modal cerrado y divergencia textual entre manual operativo e interfaz real.
* **Solución Requerida:** Sustituir `var(--color-border)` por `var(--border-color-neutral, #DFE3E8)`, incorporar `cancelado = true` y `setObteniendoGps(false)` en el efecto GPS de `RechazoMisionModal.tsx`, homologar `"Trabajando offline"` en el manual H41 y documentar el contrato con `misiones:terreno:ejecutar` en `docs/api/contratos-terreno.md`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H41-PWA-01` | Compilación estricta TypeScript y empaquetado de producción Next.js 16 en vista de detalle de cuadrilla y cliente Socket.io | Compilación / Estática | Integración / Sistema | Crítica | Rama `feature/h41-cuadrilla-rechazar-asignacion` con `CuadrillaMisionDetailPage` y `socketClient.ts` | Comandos `npx tsc --noEmit` y `npm run build` | Compilación TypeScript y build Next.js exitosos (`exit 0`) con `params: Promise<{ id: string }>` | `npx tsc --noEmit` falla (`exit 2`, `TS2344` en `cuadrilla/misiones/[id]/page.tsx` y `TS2614` en `socketClient.ts`); `npm run build` falla (`exit 1`) | ABIERTO | 24/11/2026 01:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H41-PWA-02` | Sincronización de rama con `origin/develop`, ausencia de conflictos de merge y preservación de contratos HU-37 / HU-69 | Integración / Control de Cambios | Sistema / Contrato | Alta | Comparativa entre `origin/develop` y `feature/h41-cuadrilla-rechazar-asignacion` | `git rev-list --left-right --count origin/develop...HEAD` y `git merge-tree` | Rama actualizada sin conflictos y `api-generated.d.ts` / `offlineQueue.ts` compatibles con HU-37 y HU-69 | `55` commits por detrás de `origin/develop`; conflictos directos en `10` archivos y pérdida de esquemas HU-37/HU-69 en `api-generated.d.ts` | ABIERTO | 24/11/2026 01:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H41-PWA-03` | Persistencia y lectura de `justificacionRechazo` remota en `obtenerDetalleMision`, visibilidad de feedback tras rechazar y consistencia de error en `outbox` | Funcional / Offline-First | Servicio / UI / Hook | Alta | Consulta de misión `RECHAZADA` online, flujo `handleConfirmarRechazo` y sincronización `RECHAZAR_MISION` en `useConnectivity` | `obtenerDetalleMision(id)` con `justificacionRechazo`, clic en confirmar rechazo y respuesta `409`/`403` en `outbox` | Mostrar `justificacionRechazo` remota, entregar feedback visible tras redirigir y revertir estado local ante fallos en `outbox` | `obtenerDetalleMision` omite `justificacionRechazo`; `router.push` inmediato oculta `mensajeConfirmacion`; `useConnectivity` conserva `RECHAZADA` si falla el refresco | ABIERTO | 24/11/2026 01:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H41-PWA-04` | Cobertura automatizada de `RECHAZAR_MISION` en `useConnectivity`, filtrado/pruebas de `mision:rechazada` en `useTerrenoSocket` y casos límite en vistas de cuadrilla | Automatización / Tiempo Real | Unitaria / Componentes | Alta | Suites de prueba en `hooks/__tests__`, `cuadrilla/misiones/__tests__` y `RechazoMisionModal.test.tsx` | Revisión de `useTerrenoSocket.ts`, `useTerrenoSocket.test.ts`, `useConnectivity.test.ts`, `CuadrillaMisionesPage.test.tsx` y `CuadrillaDetailPage.test.tsx` | Filtrado por `cuadrillaId` en socket y cobertura completa de estados, errores HTTP, GPS, eventos socket y `outbox` | `0` pruebas para `RECHAZAR_MISION` en `useConnectivity.test.ts` y `mision:rechazada` en `useTerrenoSocket.test.ts`; sin filtro `cuadrillaId` ni cobertura de estados no `DESPACHADA` en `CuadrillaDetailPage.test.tsx` | ABIERTO | 24/11/2026 01:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H41-PWA-05` | Uso de token CSS `--border-color-neutral`, cancelación del efecto GPS al cerrar `RechazoMisionModal` y alineación documental | UI / Ciclo de Vida / Documentación | CSS / Componente / Docs | Media | Hojas de estilo de detalle, `RechazoMisionModal.tsx`, manual H41 y `docs/api/contratos-terreno.md` | Inspección de `CuadrillaDetailPage.module.css`, `useEffect` GPS en modal y texto de `ConnectionStatusBadge` | Uso de `var(--border-color-neutral, #DFE3E8)`, cancelación limpia de GPS y manual/contratos homologados | `CuadrillaDetailPage.module.css` usa `--color-border` inexistente en `tokens.css`; `RechazoMisionModal` no cancela efecto GPS; manual cita `"Sin conexión"` en vez de `"Trabajando offline"` | ABIERTO | 24/11/2026 01:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H41-PWA-01` | Visualización del botón táctil 'Rechazar Misión' cuando la misión está en estado `DESPACHADA`, cuadrilla activa y permiso `misiones:terreno:ejecutar` | Funcional / UI (CA-1, CA-7) | Componente / Integración | Crítica | Misión `70000000-0000-4000-8000-000000000001` en `DESPACHADA`, `unidadActiva: true`, `esCuadrilla: true`, permiso `misiones:terreno:ejecutar` | Renderizado de `CuadrillaMisionDetailPage` con mock autenticado de `DELEGADO_CUADRILLA` | Sección `'Acciones de Despacho'` visible con botón `'Rechazar Misión'` (`variant="destructive"`, `size="md"`, `min-height: 48px`) | Botón `'Rechazar Misión'` renderizado y accesible en `CuadrillaDetailPage.test.tsx` | APROBADO | 24/11/2026 01:36 | N/A | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-02` | Ocultamiento del botón 'Rechazar Misión' cuando el usuario no posee el permiso RBAC `misiones:terreno:ejecutar` | Seguridad / RBAC (CA-7) | Componente / UI | Crítica | Misión en `DESPACHADA` y `tienePermiso('misiones:terreno:ejecutar') === false` | Renderizado de `CuadrillaMisionDetailPage` con `tienePermiso: () => false` | El botón `'Rechazar Misión'` no se renderiza en el DOM | `queryByRole('button', { name: /Rechazar Misión/i })` retorna `null` | APROBADO | 24/11/2026 01:36 | N/A | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-03` | Despliegue del modal 'Rechazar Asignación de Cuadrilla' con campo obligatorio y contador al presionar 'Rechazar Misión' | Funcional / UI (CA-2) | Componente | Crítica | Vista de detalle en estado `DESPACHADA` y botón `'Rechazar Misión'` visible | Clic sobre `'Rechazar Misión'` en `CuadrillaMisionDetailPage` | Se abre diálogo modal (`role="dialog"`, `aria-modal="true"`) con textarea obligatorio, contador `0 / 5 caracteres mín.` y botón `'Confirmar Rechazo'` deshabilitado | Modal desplegado con título `'Rechazar Asignación de Cuadrilla'`, campo `'Motivo del Rechazo'` y botón confirmar inicialmente deshabilitado | APROBADO | 24/11/2026 01:36 | N/A | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-04` | Bloqueo de confirmación y feedback de error en cliente cuando la justificación posee menos de 5 caracteres útiles | Validación UI (CA-2, CA-3, §3.3) | Componente | Crítica | `RechazoMisionModal` abierto (`abierto={true}`) | Ingreso de `'  abc  '` en `'Motivo del Rechazo'` y evento `blur` | Contador marca `3 / 5 caracteres mín.`, botón `'Confirmar Rechazo'` permanece `disabled` y tras `blur` muestra `'La justificación debe contener al menos 5 caracteres.'` | Botón deshabilitado, contador `3 / 5 caracteres mín.` y alerta `role="alert"` renderizada tras `blur` | APROBADO | 24/11/2026 01:36 | N/A | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-05` | Validación estricta de `rechazoMisionSchema` (Zod) ante cadena vacía, solo espacios, `< 5` caracteres y recorte `trim()` | Validación / Contrato (CA-3, §3.3) | Unitaria | Crítica | Esquema `rechazoMisionSchema` en `src/lib/validations/misiones.ts` | Entradas `{ justificacion_rechazo: '' }`, `'     '`, `'  abc  '` y `'  Falla hidráulica en camión tolva  '` | Rechaza entradas con `< 5` caracteres útiles y acepta `>= 5` recortando espacios circundantes | `misiones.test.ts` valida rechazo de entradas inválidas y transformación `trim()` en entrada válida | APROBADO | 24/11/2026 01:36 | N/A | feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41) |
| `CP-H41-PWA-06` | Validación Zod de coordenadas GPS opcionales en `rechazoMisionSchema` (par `latitud`/`longitud` y rangos WGS84) | Validación / Contrato | Unitaria | Media | Esquema `rechazoMisionSchema` | `{ latitud: -39.81422, longitud: -73.24589 }`, solo `latitud: -39.81` y fuera de rango `latitud: -95` | Acepta par completo dentro de `[-90, 90]` / `[-180, 180]` y rechaza coordenada huérfana o fuera de rango | `misiones.test.ts` verifica rechazo de latitud aislada y valores fuera de rango WGS84 | APROBADO | 24/11/2026 01:36 | N/A | feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41) |
| `CP-H41-PWA-07` | Ejecución online de `rechazarMision` hacia `POST /api/misiones/{id}/rechazar` (`200 OK`), actualización de IndexedDB y retorno a bandeja | Funcional / Integración (CA-4) | Servicio / Componente | Crítica | `navigator.onLine = true`, misión `70000000-0000-4000-8000-000000000001` en IndexedDB en estado `DESPACHADA` | `rechazarMision(id, { justificacion_rechazo: 'Camión tolva presenta falla hidráulica.', latitud: -39.81422, longitud: -73.24589 })` | Invoca `POST /api/misiones/{id}/rechazar`, actualiza misión en IndexedDB a `RECHAZADA` (`sincronizacionPendiente: false`) sin encolar en `outbox` y navega a `/cuadrilla/misiones` | `misionesService.test.ts` y `CuadrillaDetailPage.test.tsx` aprueban invocación tipada, persistencia local y redirección a `/cuadrilla/misiones` | APROBADO | 24/11/2026 01:36 | N/A | feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41) |
| `CP-H41-PWA-08` | Manejo de rechazo HTTP (`400`/`403`/`409`) lanzando `MisionServiceError` sin encolar en `outbox` y despliegue de alerta en modal | Manejo de Errores / RBAC (CA-3, CA-7) | Servicio / Componente | Alta | Respuesta HTTP `409 Conflict` o `403 Forbidden` simulada desde API | `rechazarMision` con `status: 409` y rechazo de promesa en `RechazoMisionModal` | Lanza `MisionServiceError` sin llamar a `encolarAccionOutbox`, y `RechazoMisionModal` exhibe el error en `.apiErrorBox` (`role="alert"`) | `misionesService.test.ts` y `RechazoMisionModal.test.tsx` verifican excepción controlada, ausencia de encolamiento y renderizado del error | APROBADO | 24/11/2026 01:36 | N/A | feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41) |
| `CP-H41-PWA-09` | Resiliencia Offline-First ante falla de transporte en `rechazarMision`: encolamiento `RECHAZAR_MISION` en `outbox` y actualización optimista local | Offline-First / Persistencia | Servicio / IndexedDB | Crítica | Falla de red (`TypeError: Failed to fetch`) tras validar con `rechazoMisionSchema` | `rechazarMision(id, { justificacion_rechazo: 'Desperfecto eléctrico en camión' })` | Encola `RECHAZAR_MISION` hacia `/api/misiones/{id}/rechazar` en `outbox` y guarda `estado: 'RECHAZADA'` con `sincronizacionPendiente: true` | `misionesService.test.ts` valida encolamiento exacto en `outbox`, `modoOffline: true` y persistencia optimista en IndexedDB | APROBADO | 24/11/2026 01:36 | N/A | feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41) |
| `CP-H41-PWA-10` | Tipado estricto derivado de OpenAPI generado (`api-generated.d.ts`) para `POST /api/misiones/{id}/rechazar` sin uso de `any` | Contrato OpenAPI / Tipado | Estática / Tipos | Alta | Contrato `src/types/api-generated.d.ts` y `src/types/offline.ts` | Revisión de `paths['/api/misiones/{id}/rechazar']['post']`, `RechazarMisionPayload` y búsqueda `\bany\b` en archivos H41 | Tipos derivados de `api-generated.d.ts` sin DTOs manuales y `0` usos de `any` en módulos HU-41 | `RechazarMisionPayload` y `RechazarMisionApiData` derivan de `api-generated.d.ts`; búsqueda `\bany\b` devuelve `NO_ANY` | APROBADO | 24/11/2026 01:36 | N/A | feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41) |
| `CP-H41-PWA-11` | Protección perimetral en `src/proxy.ts` para rutas de cuadrilla (`/terreno/cuadrilla/misiones` y `[id]`) sin y con cookie `sgrai_auth_token` | Seguridad / Perímetro | Sistema / HTTP | Alta | Servidor local `sgrai-pwa` escuchando en `http://127.0.0.1:3002` | `GET /terreno/cuadrilla/misiones/70000000-0000-4000-8000-000000000001` sin cookie y con `Cookie: sgrai_auth_token=jwt-mock-token` | `307 Temporary Redirect` hacia `/terreno/login?returnUrl=...` sin cookie y `200 OK` con cookie | `curl` sin cookie responde `HTTP/1.1 307 Temporary Redirect` con `location` esperado; con cookie responde `HTTP/1.1 200 OK` | APROBADO | 24/11/2026 01:36 | N/A | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-12` | Conformidad de diseño plano municipal (`border-radius: 0`, mínimo `48px` táctil, Noto Sans, `lucide-react`, cero emojis) y ESLint limpio | UI / Accesibilidad / Linter | Estática / CSS | Media | Código fuente completo en `src/` | Inspección de `Button.module.css`, `RechazoMisionModal.module.css`, `npm run lint` y búsqueda regex Unicode de emojis | `0` emojis en `src/`, esquinas rectas, botones `md` con `min-height: 48px` y `npm run lint` con `0` errores | `NO_EMOJIS` en `src/`, `npm run lint` retorna `exit 0` (`0` errores / `0` advertencias), esquinas rectas y altura `48px` verificadas | APROBADO | 24/11/2026 01:36 | N/A | feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41) |
| `CP-H41-PWA-13` | Ejecución completa de la suite Vitest del repositorio y subconjunto focalizado HU-41 | Automatización | Unitaria / Integración | Alta | Dependencias instaladas y configuración JSDOM / `fake-indexeddb` | `npm test` y ejecución focalizada de `7` archivos de prueba relacionados con HU-41 | `100%` de suites existentes aprobadas sin errores de ejecución | `35` de `35` archivos (`143/143` tests) globales aprobados y `7` de `7` archivos (`36/36` tests) focalizados aprobados | APROBADO | 24/11/2026 01:36 | N/A | test(cuadrilla): agregar pruebas unitarias y de integracion para rechazo motivado (H41) |
| `CP-H41-PWA-14` | Disponibilidad de manual de usuario `docs/manuals/H41-rechazo-mision-cuadrilla.md` con secciones obligatorias offline y permisos GPS | Documentación | Documentación | Media | Archivo `docs/manuals/H41-rechazo-mision-cuadrilla.md` | Revisión estructural frente a `AGENTS.md §5` y `GEMINI.md §7` | Presencia de alcance H41, permisos GPS/RBAC, flujo paso a paso y comportamiento sin conexión | Manual presente en `docs/manuals/H41-rechazo-mision-cuadrilla.md` con secciones de permisos y comportamiento sin conexión | APROBADO | 24/11/2026 01:36 | N/A | docs(manuals): agregar manual de usuario para rechazo motivado de cuadrilla (H41) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H41-PWA-01	Compilación estricta TypeScript y empaquetado de producción Next.js 16 en vista de detalle de cuadrilla y cliente Socket.io	Compilación / Estática	Integración / Sistema	Crítica	Rama feature/h41-cuadrilla-rechazar-asignacion con CuadrillaMisionDetailPage y socketClient.ts	Comandos npx tsc --noEmit y npm run build	Compilación TypeScript y build Next.js exitosos (exit 0) con params: Promise<{ id: string }>	npx tsc --noEmit falla (exit 2, TS2344 en cuadrilla/misiones/[id]/page.tsx y TS2614 en socketClient.ts); npm run build falla (exit 1)	ABIERTO	24/11/2026 01:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H41-PWA-02	Sincronización de rama con origin/develop, ausencia de conflictos de merge y preservación de contratos HU-37 / HU-69	Integración / Control de Cambios	Sistema / Contrato	Alta	Comparativa entre origin/develop y feature/h41-cuadrilla-rechazar-asignacion	git rev-list --left-right --count origin/develop...HEAD y git merge-tree	Rama actualizada sin conflictos y api-generated.d.ts / offlineQueue.ts compatibles con HU-37 y HU-69	55 commits por detrás de origin/develop; conflictos directos en 10 archivos y pérdida de esquemas HU-37/HU-69 en api-generated.d.ts	ABIERTO	24/11/2026 01:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H41-PWA-03	Persistencia y lectura de justificacionRechazo remota en obtenerDetalleMision, visibilidad de feedback tras rechazar y consistencia de error en outbox	Funcional / Offline-First	Servicio / UI / Hook	Alta	Consulta de misión RECHAZADA online, flujo handleConfirmarRechazo y sincronización RECHAZAR_MISION en useConnectivity	obtenerDetalleMision(id) con justificacionRechazo, clic en confirmar rechazo y respuesta 409/403 en outbox	Mostrar justificacionRechazo remota, entregar feedback visible tras redirigir y revertir estado local ante fallos en outbox	obtenerDetalleMision omite justificacionRechazo; router.push inmediato oculta mensajeConfirmacion; useConnectivity conserva RECHAZADA si falla el refresco	ABIERTO	24/11/2026 01:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H41-PWA-04	Cobertura automatizada de RECHAZAR_MISION en useConnectivity, filtrado/pruebas de mision:rechazada en useTerrenoSocket y casos límite en vistas de cuadrilla	Automatización / Tiempo Real	Unitaria / Componentes	Alta	Suites de prueba en hooks/__tests__, cuadrilla/misiones/__tests__ y RechazoMisionModal.test.tsx	Revisión de useTerrenoSocket.ts, useTerrenoSocket.test.ts, useConnectivity.test.ts, CuadrillaMisionesPage.test.tsx y CuadrillaDetailPage.test.tsx	Filtrado por cuadrillaId en socket y cobertura completa de estados, errores HTTP, GPS, eventos socket y outbox	0 pruebas para RECHAZAR_MISION en useConnectivity.test.ts y mision:rechazada en useTerrenoSocket.test.ts; sin filtro cuadrillaId ni cobertura de estados no DESPACHADA en CuadrillaDetailPage.test.tsx	ABIERTO	24/11/2026 01:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H41-PWA-05	Uso de token CSS --border-color-neutral, cancelación del efecto GPS al cerrar RechazoMisionModal y alineación documental	UI / Ciclo de Vida / Documentación	CSS / Componente / Docs	Media	Hojas de estilo de detalle, RechazoMisionModal.tsx, manual H41 y docs/api/contratos-terreno.md	Inspección de CuadrillaDetailPage.module.css, useEffect GPS en modal y texto de ConnectionStatusBadge	Uso de var(--border-color-neutral, #DFE3E8), cancelación limpia de GPS y manual/contratos homologados	CuadrillaDetailPage.module.css usa --color-border inexistente en tokens.css; RechazoMisionModal no cancela efecto GPS; manual cita "Sin conexión" en vez de "Trabajando offline"	ABIERTO	24/11/2026 01:36	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H41-PWA-01	Visualización del botón táctil 'Rechazar Misión' cuando la misión está en estado DESPACHADA, cuadrilla activa y permiso misiones:terreno:ejecutar	Funcional / UI (CA-1, CA-7)	Componente / Integración	Crítica	Misión 70000000-0000-4000-8000-000000000001 en DESPACHADA, unidadActiva: true, esCuadrilla: true, permiso misiones:terreno:ejecutar	Renderizado de CuadrillaMisionDetailPage con mock autenticado de DELEGADO_CUADRILLA	Sección 'Acciones de Despacho' visible con botón 'Rechazar Misión' (variant="destructive", size="md", min-height: 48px)	Botón 'Rechazar Misión' renderizado y accesible en CuadrillaDetailPage.test.tsx	APROBADO	24/11/2026 01:36	N/A	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-02	Ocultamiento del botón 'Rechazar Misión' cuando el usuario no posee el permiso RBAC misiones:terreno:ejecutar	Seguridad / RBAC (CA-7)	Componente / UI	Crítica	Misión en DESPACHADA y tienePermiso('misiones:terreno:ejecutar') === false	Renderizado de CuadrillaMisionDetailPage con tienePermiso: () => false	El botón 'Rechazar Misión' no se renderiza en el DOM	queryByRole('button', { name: /Rechazar Misión/i }) retorna null	APROBADO	24/11/2026 01:36	N/A	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-03	Despliegue del modal 'Rechazar Asignación de Cuadrilla' con campo obligatorio y contador al presionar 'Rechazar Misión'	Funcional / UI (CA-2)	Componente	Crítica	Vista de detalle en estado DESPACHADA y botón 'Rechazar Misión' visible	Clic sobre 'Rechazar Misión' en CuadrillaMisionDetailPage	Se abre diálogo modal (role="dialog", aria-modal="true") con textarea obligatorio, contador 0 / 5 caracteres mín. y botón 'Confirmar Rechazo' deshabilitado	Modal desplegado con título 'Rechazar Asignación de Cuadrilla', campo 'Motivo del Rechazo' y botón confirmar inicialmente deshabilitado	APROBADO	24/11/2026 01:36	N/A	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-04	Bloqueo de confirmación y feedback de error en cliente cuando la justificación posee menos de 5 caracteres útiles	Validación UI (CA-2, CA-3, §3.3)	Componente	Crítica	RechazoMisionModal abierto (abierto={true})	Ingreso de '  abc  ' en 'Motivo del Rechazo' y evento blur	Contador marca 3 / 5 caracteres mín., botón 'Confirmar Rechazo' permanece disabled y tras blur muestra 'La justificación debe contener al menos 5 caracteres.'	Botón deshabilitado, contador 3 / 5 caracteres mín. y alerta role="alert" renderizada tras blur	APROBADO	24/11/2026 01:36	N/A	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-05	Validación estricta de rechazoMisionSchema (Zod) ante cadena vacía, solo espacios, < 5 caracteres y recorte trim()	Validación / Contrato (CA-3, §3.3)	Unitaria	Crítica	Esquema rechazoMisionSchema en src/lib/validations/misiones.ts	Entradas { justificacion_rechazo: '' }, '     ', '  abc  ' y '  Falla hidráulica en camión tolva  '	Rechaza entradas con < 5 caracteres útiles y acepta >= 5 recortando espacios circundantes	misiones.test.ts valida rechazo de entradas inválidas y transformación trim() en entrada válida	APROBADO	24/11/2026 01:36	N/A	feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41)
CP-H41-PWA-06	Validación Zod de coordenadas GPS opcionales en rechazoMisionSchema (par latitud/longitud y rangos WGS84)	Validación / Contrato	Unitaria	Media	Esquema rechazoMisionSchema	{ latitud: -39.81422, longitud: -73.24589 }, solo latitud: -39.81 y fuera de rango latitud: -95	Acepta par completo dentro de [-90, 90] / [-180, 180] y rechaza coordenada huérfana o fuera de rango	misiones.test.ts verifica rechazo de latitud aislada y valores fuera de rango WGS84	APROBADO	24/11/2026 01:36	N/A	feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41)
CP-H41-PWA-07	Ejecución online de rechazarMision hacia POST /api/misiones/{id}/rechazar (200 OK), actualización de IndexedDB y retorno a bandeja	Funcional / Integración (CA-4)	Servicio / Componente	Crítica	navigator.onLine = true, misión 70000000-0000-4000-8000-000000000001 en IndexedDB en estado DESPACHADA	rechazarMision(id, { justificacion_rechazo: 'Camión tolva presenta falla hidráulica.', latitud: -39.81422, longitud: -73.24589 })	Invoca POST /api/misiones/{id}/rechazar, actualiza misión en IndexedDB a RECHAZADA (sincronizacionPendiente: false) sin encolar en outbox y navega a /cuadrilla/misiones	misionesService.test.ts y CuadrillaDetailPage.test.tsx aprueban invocación tipada, persistencia local y redirección a /cuadrilla/misiones	APROBADO	24/11/2026 01:36	N/A	feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41)
CP-H41-PWA-08	Manejo de rechazo HTTP (400/403/409) lanzando MisionServiceError sin encolar en outbox y despliegue de alerta en modal	Manejo de Errores / RBAC (CA-3, CA-7)	Servicio / Componente	Alta	Respuesta HTTP 409 Conflict o 403 Forbidden simulada desde API	rechazarMision con status: 409 y rechazo de promesa en RechazoMisionModal	Lanza MisionServiceError sin llamar a encolarAccionOutbox, y RechazoMisionModal exhibe el error en .apiErrorBox (role="alert")	misionesService.test.ts y RechazoMisionModal.test.tsx verifican excepción controlada, ausencia de encolamiento y renderizado del error	APROBADO	24/11/2026 01:36	N/A	feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41)
CP-H41-PWA-09	Resiliencia Offline-First ante falla de transporte en rechazarMision: encolamiento RECHAZAR_MISION en outbox y actualización optimista local	Offline-First / Persistencia	Servicio / IndexedDB	Crítica	Falla de red (TypeError: Failed to fetch) tras validar con rechazoMisionSchema	rechazarMision(id, { justificacion_rechazo: 'Desperfecto eléctrico en camión' })	Encola RECHAZAR_MISION hacia /api/misiones/{id}/rechazar en outbox y guarda estado: 'RECHAZADA' con sincronizacionPendiente: true	misionesService.test.ts valida encolamiento exacto en outbox, modoOffline: true y persistencia optimista en IndexedDB	APROBADO	24/11/2026 01:36	N/A	feat(misiones): implementar rechazarMision con soporte offline y evento mision:rechazada (H41)
CP-H41-PWA-10	Tipado estricto derivado de OpenAPI generado (api-generated.d.ts) para POST /api/misiones/{id}/rechazar sin uso de any	Contrato OpenAPI / Tipado	Estática / Tipos	Alta	Contrato src/types/api-generated.d.ts y src/types/offline.ts	Revisión de paths['/api/misiones/{id}/rechazar']['post'], RechazarMisionPayload y búsqueda \bany\b en archivos H41	Tipos derivados de api-generated.d.ts sin DTOs manuales y 0 usos de any en módulos HU-41	RechazarMisionPayload y RechazarMisionApiData derivan de api-generated.d.ts; búsqueda \bany\b devuelve NO_ANY	APROBADO	24/11/2026 01:36	N/A	feat(api): actualizar tipos OpenAPI y validacion Zod para rechazo de mision (H41)
CP-H41-PWA-11	Protección perimetral en src/proxy.ts para rutas de cuadrilla (/terreno/cuadrilla/misiones y [id]) sin y con cookie sgrai_auth_token	Seguridad / Perímetro	Sistema / HTTP	Alta	Servidor local sgrai-pwa escuchando en http://127.0.0.1:3002	GET /terreno/cuadrilla/misiones/70000000-0000-4000-8000-000000000001 sin cookie y con Cookie: sgrai_auth_token=jwt-mock-token	307 Temporary Redirect hacia /terreno/login?returnUrl=... sin cookie y 200 OK con cookie	curl sin cookie responde HTTP/1.1 307 Temporary Redirect con location esperado; con cookie responde HTTP/1.1 200 OK	APROBADO	24/11/2026 01:36	N/A	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-12	Conformidad de diseño plano municipal (border-radius: 0, mínimo 48px táctil, Noto Sans, lucide-react, cero emojis) y ESLint limpio	UI / Accesibilidad / Linter	Estática / CSS	Media	Código fuente completo en src/	Inspección de Button.module.css, RechazoMisionModal.module.css, npm run lint y búsqueda regex Unicode de emojis	0 emojis en src/, esquinas rectas, botones md con min-height: 48px y npm run lint con 0 errores	NO_EMOJIS en src/, npm run lint retorna exit 0 (0 errores / 0 advertencias), esquinas rectas y altura 48px verificadas	APROBADO	24/11/2026 01:36	N/A	feat(cuadrilla): agregar modal de rechazo motivado e integrar en detalle de mision (H41)
CP-H41-PWA-13	Ejecución completa de la suite Vitest del repositorio y subconjunto focalizado HU-41	Automatización	Unitaria / Integración	Alta	Dependencias instaladas y configuración JSDOM / fake-indexeddb	npm test y ejecución focalizada de 7 archivos de prueba relacionados con HU-41	100% de suites existentes aprobadas sin errores de ejecución	35 de 35 archivos (143/143 tests) globales aprobados y 7 de 7 archivos (36/36 tests) focalizados aprobados	APROBADO	24/11/2026 01:36	N/A	test(cuadrilla): agregar pruebas unitarias y de integracion para rechazo motivado (H41)
CP-H41-PWA-14	Disponibilidad de manual de usuario docs/manuals/H41-rechazo-mision-cuadrilla.md con secciones obligatorias offline y permisos GPS	Documentación	Documentación	Media	Archivo docs/manuals/H41-rechazo-mision-cuadrilla.md	Revisión estructural frente a AGENTS.md §5 y GEMINI.md §7	Presencia de alcance H41, permisos GPS/RBAC, flujo paso a paso y comportamiento sin conexión	Manual presente en docs/manuals/H41-rechazo-mision-cuadrilla.md con secciones de permisos y comportamiento sin conexión	APROBADO	24/11/2026 01:36	N/A	docs(manuals): agregar manual de usuario para rechazo motivado de cuadrilla (H41)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

Todos los comandos fueron ejecutados desde la raíz del repositorio `web-app` en la rama `feature/h41-cuadrilla-rechazar-asignacion`.

### 5.1 Suite Automatizada Global y Pruebas Focalizadas (Vitest)

#### 5.1.1 Suite completa del repositorio
```bash
npm test
```
**Salida observada:**
```text
 Test Files  35 passed (35)
      Tests  143 passed (143)
   Start at  01:28:32
   Duration  7.33s (transform 3.00s, setup 9.03s, collect 12.37s, tests 7.77s, environment 43.68s, prepare 5.41s)
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
**Salida observada:**
```text
 ✓ src/lib/validations/misiones.test.ts (5 tests) 12ms
 ✓ src/services/__tests__/misionesService.test.ts (15 tests) 42ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (4 tests) 133ms
 ✓ src/hooks/__tests__/useTerrenoSocket.test.ts (3 tests) 51ms
 ✓ src/components/misiones/__tests__/RechazoMisionModal.test.tsx (4 tests) 544ms
 ✓ src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx (3 tests) 594ms
 ✓ src/app/(terreno)/cuadrilla/misiones/__tests__/CuadrillaMisionesPage.test.tsx (2 tests) 502ms

 Test Files  7 passed (7)
      Tests  36 passed (36)
   Start at  01:32:56
   Duration  3.66s (transform 1.62s, setup 2.00s, collect 3.99s, tests 1.88s, environment 9.14s, prepare 1.12s)
```

#### 5.1.3 Ejecuciones filtradas por historia / componente (`npm test -- -t "..."`)
```bash
npm test -- -t "RechazoMisionModal"
```
**Salida observada:**
```text
 ✓ src/components/misiones/__tests__/RechazoMisionModal.test.tsx (4 tests) 933ms
 Test Files  1 passed | 34 skipped (35)
      Tests  4 passed | 139 skipped (143)
   Duration  8.98s
```

```bash
npm test -- -t "CuadrillaMisionDetailPage"
```
**Salida observada:**
```text
 ✓ src/app/(terreno)/cuadrilla/misiones/[id]/__tests__/CuadrillaDetailPage.test.tsx (3 tests) 260ms
 Test Files  1 passed | 34 skipped (35)
      Tests  3 passed | 140 skipped (143)
   Duration  5.86s
```

```bash
npm test -- -t "rechazarMision"
```
**Salida observada:**
```text
 ✓ src/services/__tests__/misionesService.test.ts (15 tests | 11 skipped) 24ms
 Test Files  1 passed | 34 skipped (35)
      Tests  4 passed | 139 skipped (143)
   Duration  5.78s
```

```bash
npm test -- -t "rechazoMisionSchema"
```
**Salida observada:**
```text
 ✓ src/lib/validations/misiones.test.ts (5 tests) 11ms
 Test Files  1 passed | 34 skipped (35)
      Tests  5 passed | 138 skipped (143)
   Duration  6.49s
```

---

### 5.2 Verificación Estática: TypeScript, Build, ESLint, Emojis, `any` y Divergencia Git

#### 5.2.1 Chequeo estático TypeScript (`BUG-H41-PWA-01`)
```bash
npx tsc --noEmit
```
**Salida observada (`exit code 2`):**
```text
.next/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts:39:29 - error TS2344: Type 'PageProps' does not satisfy the constraint 'import("/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/.next/types/app/(terreno)/cuadrilla/misiones/[id]/page").PageProps'.
  Types of property 'params' are incompatible.
    Type 'Promise<{ id: string; }> | { id: string; }' is not assignable to type 'Promise<any> | undefined'.
      Type '{ id: string; }' is missing the following properties from type 'Promise<any>': then, catch, finally, [Symbol.toStringTag]

39 checkFields<Diff<PageProps, FirstArg<TEntry['default']>, 'default'>>()
                               ~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/lib/socket/socketClient.ts:4:10 - error TS2614: Module '"@/lib/api/client"' has no exported member 'DEV_PATRULLA_TOKEN'. Did you mean to use 'import DEV_PATRULLA_TOKEN from "@/lib/api/client"' instead?

4 import { DEV_PATRULLA_TOKEN } from '@/lib/api/client';
           ~~~~~~~~~~~~~~~~~~

Found 2 errors in 2 files.
```

#### 5.2.2 Build de producción Next.js (`BUG-H41-PWA-01`)
```bash
npm run build
```
**Salida observada (`exit code 1`):**
```text
▲ Next.js 16.3.4 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 34ms

  Creating an optimized production build ...
⚠ Compiled with warnings in 2.4s
./src/lib/socket/socketClient.ts
Attempted import error: 'DEV_PATRULLA_TOKEN' is not exported from '@/lib/api/client' (imported as 'DEV_PATRULLA_TOKEN').

✓ Compiled successfully in 9.5s
.next/types/app/(terreno)/cuadrilla/misiones/[id]/page.ts(39,29): error TS2344: Type 'PageProps' does not satisfy the constraint ...
src/lib/socket/socketClient.ts(4,10): error TS2614: Module '"@/lib/api/client"' has no exported member 'DEV_PATRULLA_TOKEN'.
Failed to type check.
```

#### 5.2.3 Linter, Emojis, `any`, Variables CSS y Divergencia Git
```bash
npm run lint
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS"
rg -n '\bany\b' src/app/\(terreno\)/cuadrilla/ src/components/misiones/Rechazo* src/lib/validations/misiones* src/services/misionesService.ts src/hooks/useConnectivity.ts src/hooks/useTerrenoSocket.ts || echo "NO_ANY"
rg -n -- "--color-border" src/app/\(terreno\)/cuadrilla/misiones/\[id\]/CuadrillaDetailPage.module.css
git rev-list --left-right --count origin/develop...HEAD
```
**Salidas observadas:**
- `npm run lint`: `exit code 0` (`0` errores, `0` advertencias).
- `rg` emojis: `NO_EMOJIS`.
- `rg` `\bany\b`: `NO_ANY`.
- `rg` `--color-border` en `CuadrillaDetailPage.module.css`: líneas `19`, `48`, `106`, `157`, `175` (`BUG-H41-PWA-05`).
- `git rev-list --left-right --count origin/develop...HEAD`: `55	5` (`55` commits por detrás de `origin/develop`, `BUG-H41-PWA-02`).

---

### 5.3 Verificación HTTP Perimetral con `curl` en Servidor Local `sgrai-pwa`

*(Nota de entorno: Durante la ejecución en vivo de la PWA en `http://127.0.0.1:3002`, no existe una instancia activa de `sgrai-api` escuchando en los puertos `3001`/`4001`, y la base local no posee la migración `057_permiso_misiones_terreno_ejecutar`; las verificaciones de contrato HTTP de `POST /api/misiones/{id}/rechazar` en `sgrai-pwa` se sustentan en el tipado generado `api-generated.d.ts` y en los mocks HTTP de `misionesService.test.ts`.)*

#### 5.3.1 Acceso sin cookie de sesión a detalle de misión de cuadrilla (`307 Temporary Redirect` — `CP-H41-PWA-11`)
```bash
curl -s -i "http://127.0.0.1:3002/terreno/cuadrilla/misiones/70000000-0000-4000-8000-000000000001" | head -n 10
```
**Respuesta HTTP obtenida:**
```http
HTTP/1.1 307 Temporary Redirect
location: /terreno/login?returnUrl=%2Fterreno%2Fcuadrilla%2Fmisiones%2F70000000-0000-4000-8000-000000000001
Date: Tue, 24 Nov 2026 04:36:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked
```

#### 5.3.2 Acceso con cookie `sgrai_auth_token` a detalle de misión y bandeja de cuadrilla (`200 OK` — `CP-H41-PWA-11`)
```bash
curl -s -i -H "Cookie: sgrai_auth_token=jwt-mock-token" \
  "http://127.0.0.1:3002/terreno/cuadrilla/misiones/70000000-0000-4000-8000-000000000001" | head -n 10
```
**Respuesta HTTP obtenida:**
```http
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Link: </terreno/_next/static/media/1755441e3a2fa970-s.p.woff2?v=1795494992373>; rel=preload; as="font"; crossorigin=""; type="font/woff2"
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
Date: Tue, 24 Nov 2026 04:36:32 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked
```

```bash
curl -s -i -H "Cookie: sgrai_auth_token=jwt-mock-token" \
  "http://127.0.0.1:3002/terreno/cuadrilla/misiones" | head -n 10
```
**Respuesta HTTP obtenida:**
```http
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Link: </terreno/_next/static/media/1755441e3a2fa970-s.p.woff2?v=1795494993056>; rel=preload; as="font"; crossorigin=""; type="font/woff2"
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
Date: Tue, 24 Nov 2026 04:36:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked
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

| Criterio de Aceptación (CA) | Responsabilidad Arquitectónica | Cobertura / Casos en `sgrai-pwa` | Estado Actual | Observaciones Técnicas |
|---|---|---|---|---|
| **CA-1:** La pantalla de solicitud de misión en la PWA debe proveer una opción visible `'Rechazar Misión'`. | `sgrai-pwa` | `CP-H41-PWA-01`, `CP-H41-PWA-12`, `BUG-H41-PWA-01`, `BUG-H41-PWA-04`, `BUG-H41-PWA-05` | **CON OBSERVACIONES** | El botón existe y es accesible con `DESPACHADA` y permiso, pero `CuadrillaMisionDetailPage` falla en `tsc`/`build` (`BUG-H41-PWA-01`), omite pruebas para otros estados/unidades (`BUG-H41-PWA-04`) y usa `--color-border` (`BUG-H41-PWA-05`). |
| **CA-2:** Al presionar `'Rechazar Misión'`, el sistema debe desplegar un modal o campo de texto obligatorio para ingresar la justificación del rechazo. | `sgrai-pwa` | `CP-H41-PWA-03`, `CP-H41-PWA-04`, `BUG-H41-PWA-03`, `BUG-H41-PWA-05` | **CON OBSERVACIONES** | `RechazoMisionModal` despliega el modal obligatorio con contador, pero la navegación inmediata oculta la confirmación (`BUG-H41-PWA-03`) y el efecto GPS carece de cancelación al cerrar (`BUG-H41-PWA-05`). |
| **CA-3:** Regla de negocio §3.3: validar `justificacion_rechazo` $\ge 5$ caracteres o rechazar con `400 Bad Request`. | `sgrai-api` + validación UX/Zod en `sgrai-pwa` | `CP-H41-PWA-04`, `CP-H41-PWA-05`, `CP-H41-PWA-06`, `CP-H41-PWA-08` | **CUMPLIDO EN PWA** | `RechazoMisionModal` bloquea envíos $< 5$ caracteres tras `trim()`, `rechazoMisionSchema` valida previo al envío/encolamiento y `rechazarMision` propaga `MisionServiceError(400)`. |
| **CA-4:** Al confirmar el rechazo motivado, actualizar `mision.estado = 'RECHAZADA'`, almacenar `justificacion_rechazo`, devolver cuadrilla a `DISPONIBLE` y registrar hito en `mision_hito`. | `sgrai-api` (transacción) + reflejo local en `sgrai-pwa` | `CP-H41-PWA-07`, `CP-H41-PWA-09`, `BUG-H41-PWA-03` | **CON OBSERVACIONES** | `rechazarMision` persiste localmente `RECHAZADA`, pero `obtenerDetalleMision` omite mapear `justificacionRechazo` remota y el manejo de errores en `useConnectivity` requiere endurecimiento (`BUG-H41-PWA-03`). |
| **CA-5:** El incidente debe retornar a estado `REPORTADO` o `VERIFICANDO` para permitir su reasignación en el Centro de Mando. | `sgrai-api` + `sgrai-web` | *(Fuera de alcance visual en `sgrai-pwa`)* | **N/A EN PWA** | Transición de incidente y tablero Kanban residen en `sgrai-api` y `sgrai-web` (`AGENTS.md §1`). |
| **CA-6:** Emisión de alerta prioritaria vía WebSocket (`mision:rechazada`) hacia la sala `encargado` del Centro de Mando. | `sgrai-api` (emisión) + escucha en `sgrai-web` / refresco de unidad en `sgrai-pwa` | `BUG-H41-PWA-02`, `BUG-H41-PWA-04` | **CON OBSERVACIONES** | La emisión a `encargado` es responsabilidad de `sgrai-api`; en `sgrai-pwa`, `useTerrenoSocket` escucha `mision:rechazada` sin filtrar por `cuadrillaId` ni pruebas unitarias (`BUG-H41-PWA-04`), y diverge de `useMisionesSocket` en `develop` (`BUG-H41-PWA-02`). |
| **CA-7:** El endpoint `POST /api/misiones/{id}/rechazar` debe requerir el permiso RBAC `misiones:terreno:ejecutar`. | `sgrai-api` + guarda UI en `sgrai-pwa` | `CP-H41-PWA-02`, `CP-H41-PWA-08`, `CP-H41-PWA-10`, `CP-H41-PWA-11` | **CUMPLIDO EN PWA** | `CuadrillaMisionDetailPage` exige `tienePermiso('misiones:terreno:ejecutar')`, `rechazarMision` no encola respuestas `403` y el contrato OpenAPI refleja el permiso requerido. |


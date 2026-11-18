# Auditoría Técnica y Matriz de Casos de Prueba — HU-[38]: Asignar o Modificar Prioridad del Incidente (Cliente Terreno `sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `feature/h38-patrulla-asignar-prioridad` (solicitud de integración hacia `develop`)  
**Historia de Usuario:** HU-[38] — Asignar o modificar la prioridad del incidente en terreno (Patrulla Verificadora)  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `17/11/2026 14:26 -03:00`  
**Fecha y Hora de Re-Test:** `18/11/2026 02:38 -03:00`  
**Entorno de Ejecución:** Linux, Node.js `v26.13.1`, Vitest `v3.2.7`, Next.js `16.3.4` (Webpack), TypeScript (`tsc --noEmit`), ESLint, `sgrai-api` (`http://localhost:3001`), PostgreSQL/PostGIS (`5001`), Redis (`6001`)  
**Dictamen de Auditoría (Re-Test):** **RECHAZADO / PENDIENTE DE CORRECCIÓN EN RE-TEST (`6` defectos iniciales corregidos y verificados; `1` defecto abierto en Re-Test [`BUG-H38-PWA-07`, Severidad Media] por falla en prueba aislada/filtrada de Vitest y desfase en manual H38; `18` casos aprobados)**

---

## Alcance Arquitectónico en `sgrai-pwa`

De acuerdo con la separación de responsabilidades de SGRAI, este repositorio cubre exclusivamente la interfaz móvil de terreno para **Patrulla Verificadora** y **Delegado de Cuadrilla**:

- **Alcance en `sgrai-pwa`:** Cálculo preliminar y despliegue de `prioridadSugerida` con factores gatillantes (homologado al sistema de puntaje acumulativo de `sgrai-api`), captura estructurada multi-familia de afectación y peligros activos, selector táctil de cuatro niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`), exigencia condicional de `justificacionPrioridad` (`>= 5` caracteres) ante discrepancia, modal de confirmación previa, versionado de reportes (`Reporte #N`) y cola offline en IndexedDB (`AJUSTAR_PRIORIDAD` con reconciliación automática en `useConnectivity`).
- **Alcance externo (`sgrai-api` / `sgrai-web`):** La transacción Kysely/PostgreSQL sobre `incidente`, `reporte_terreno` y `mision_hito` reside en `sgrai-api` (`PATCH /api/incidentes/[id]/prioridad` y `POST /api/incidentes/[id]/prioridad/calcular`), y la emisión/renderizado del evento `incidente:actualizado` en el tablero Kanban del Centro de Mando reside en `sgrai-api` y `sgrai-web`.

---

## 1. Resumen Ejecutivo

En el ciclo de **Re-Test (`18/11/2026`)** sobre la rama `feature/h38-patrulla-asignar-prioridad` tras los seis commits correctivos aplicados por el equipo de desarrollo y el merge con `develop`, se verificó la resolución íntegra de los **6 defectos reportados en la auditoría inicial** (`BUG-H38-PWA-01` a `BUG-H38-PWA-06`). El cliente ya no mantiene código *fail-open* de autenticación demo, integra los contratos regenerados en `src/types/api-generated.d.ts` mediante `apiClient`, homologa el cálculo determinista con `sgrai-api`, corrige la consolidación multi-familia y el decremento en familia única, reconcilia `AJUSTAR_PRIORIDAD` en IndexedDB y cumple la ergonomía mínima de `48px`.

No obstante, el Re-Test detectó **1 defecto nuevo (`BUG-H38-PWA-07`, Severidad Media)** que bloquea el visto bueno final: la nueva prueba agregada en `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx` (líneas `238–286`) depende del estado de mock heredado de los tests anteriores y **falla con código de salida `1` al ejecutarse de forma filtrada o aislada** (`npm test -- -t "EvaluacionPrioridadCard"` y `npm test -- -t "deshabilita EvaluacionPrioridadCard"`), además de no verificar la preservación de borrador al colapsar el acordeón. Adicionalmente, la tabla de criterios en `docs/manuals/H38-patrulla-asignar-prioridad.md` (§3) conserva las reglas previas a la homologación por puntaje, `useConnectivity.ts` no clasifica conflictos HTTP `409` en `AJUSTAR_PRIORIDAD`, y ESLint reporta `2` advertencias nuevas de variables sin usar en HU-38.

| Indicador / Verificación | Auditoría Inicial (17/11/2026) | Re-Test (18/11/2026) | Observación Técnica |
|---|---|---|---|
| Total de casos en matriz (HU-38 PWA) | `18` casos (`6` `ABIERTO`, `12` `APROBADO`) | `19` casos (`1` `ABIERTO`, `18` `APROBADO`) | `BUG-H38-PWA-01`..`06` pasan a `APROBADO`; ingresa `BUG-H38-PWA-07` en `ABIERTO` |
| Defectos abiertos por severidad | `1` Crítica, `3` Alta, `2` Media | `0` Crítica, `0` Alta, `1` Media | Bloquea aprobación hasta estabilizar test filtrado y actualizar manual H38 §3 |
| Suite completa Vitest (`npm test`) | `40` archivos / `175` tests (`14.45s`) | `44` archivos / `209` tests (`8.33s`) | Aprueba en corrida secuencial; enmascara acoplamiento de mocks en `PatrullaPrioridad.test.tsx` |
| Subconjunto específico HU-38 y regresión (`npx vitest run`) | `5` archivos / `29` tests (`4.74s`) | `8` archivos / `58` tests (`4.54s`) | Cubre validaciones (`10`), servicio (`8`), tarjeta (`9`), modal (`4`), detalle (`3` + `7`), conectividad (`5`), misiones (`12`) |
| Ejecución filtrada (`npm test -- -t "EvaluacionPrioridadCard"`) | `1` file / `7` passed (`8.16s`) | **FALLIDO** (`exit 1`: `1 failed \| 9 passed \| 199 skipped`) | Test `PatrullaPrioridad.test.tsx:281` falla con `"Misión no encontrada"` por falta de mock en `beforeEach` |
| Ejecución aislada (`npm test -- -t "deshabilita EvaluacionPrioridadCard"`) | N/A (caso agregado en Re-Test) | **FALLIDO** (`exit 1`: `1 failed \| 208 skipped`) | Confirma reproducción determinista de `BUG-H38-PWA-07` |
| Verificación de tipos (`npx tsc --noEmit`) | `exit 0` (con riesgo `TS2305` ante `develop`) | `exit 0` (post-merge con `develop`) | Contratos derivados desde `src/types/api-generated.d.ts` regenerado |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `4` advertencias | `0` errores, `2` advertencias | Nuevas advertencias en `page.tsx:175` (`prioridadClase`) y `EvaluacionPrioridadCard.tsx:274` (`_ref`) |
| Build de producción (`npm run build`) | `exit 0` (Turbopack, `8/8` rutas) | `exit 0` (Next.js `16.3.4` Webpack, `8/8` rutas) | Alineado con `--webpack` de `develop` |
| Verificación estática UI / tokens (`rg` en `src/`) | `NO_EMOJIS_IN_SRC` | `NO_EMOJIS_IN_SRC`, `NO_DEMO_BYPASS_IN_SRC`, `NO_COLOR_BORDER_IN_H38_CSS` | `0` emojis, `0` tokens demo y `0` variables `--color-border` en CSS de H38 |
| Verificación lógica (`tsx`) y contrato vivo (`:3001`/`:3002`) | `401`, `403`, `400`, `200`, `307`; fallas `BUG-02/03/05` | `tsx` (`3/3` verificados); `:3001` `401`/`403`/`400`; `:3002` `307`/`200` | En DB local sin migración `053`, `POST /prioridad/calcular` arrojó `500` (`prioridad_sugerida` inexistente); paridad verificada por `tsx` e inspección de backend |

---

## 2. Registro Técnico de Defectos

### BUG-H38-PWA-07 — Falla en ejecución filtrada/aislada de `PatrullaPrioridad.test.tsx`, prueba incompleta de preservación al colapsar, desfase de matriz en manual H38 y observaciones de `409`/ESLint
- **Severidad:** Media (Confiabilidad de suite de pruebas / Documentación operativa / Calidad estática)
- **Estado:** **ABIERTO** *(Detectado en Re-Test — 18/11/2026)*
- **Archivos afectados:**
  - `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx` (líneas `64–119`, `238–286`)
  - `docs/manuals/H38-patrulla-asignar-prioridad.md` (líneas `29–34`)
  - `src/hooks/useConnectivity.ts` (líneas `71–95`)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas `171–176`) y `src/components/misiones/EvaluacionPrioridadCard.tsx` (línea `274`)
- **Descripción:**
  1. **Acoplamiento de mocks y aserción faltante en `PatrullaPrioridad.test.tsx` (`238–286`):** El tercer caso `'deshabilita EvaluacionPrioridadCard cuando falta el permiso misiones:terreno:verificar y preserva el borrador al colapsar'` falla de manera reproducible al ejecutarse vía filtro (`npm test -- -t "EvaluacionPrioridadCard"` o `npm test -- -t "deshabilita EvaluacionPrioridadCard"`). El bloque `beforeEach` (líneas `64–119`) ejecuta `vi.clearAllMocks()`, pero no configura un retorno por defecto para `vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(...)`. Los casos 1 y 2 lo configuran dentro de sus propios cuerpos, filtrando el estado hacia el caso 3 en ejecuciones secuenciales; cuando los casos 1 y 2 se omiten, `obtenerDetalleMision` resuelve `undefined` y la página renderiza `"Misión no encontrada"`. Además, la línea `240` esparce `...vi.mocked(useAuth).mock.results[0]?.value` (siempre `undefined` tras `vi.clearAllMocks()`), omite `actualizarUnidadAsignada` en el objeto retornado y el cuerpo del test no ejerce ni verifica el colapso/reapertura del `<details>` ni la preservación del borrador indicada en su nombre.
  2. **Desfase documental en `docs/manuals/H38-patrulla-asignar-prioridad.md` (§3, líneas `29–34`):** Tras homologar `calcularPrioridadSugerida` con la tabla acumulativa de `sgrai-api` (`>= 60 CRITICA`, `>= 35 ALTA`, `>= 15 MEDIA`, `< 15 BAJA`), el manual de usuario H38 continúa detallando las reglas antiguas por factor único (por ejemplo, indicando que riesgo estructural, eléctrico o químico por separado producen `CRITICA`, cuando actualmente equivalen a `25 pts` / `MEDIA`).
  3. **Manejo de conflicto HTTP `409` para `AJUSTAR_PRIORIDAD` y advertencias ESLint:** En `src/hooks/useConnectivity.ts` (líneas `71–85`), solo `ACEPTAR_MISION` trata HTTP `409` como terminal; si un cambio de prioridad devuelve `409` al reconectar, la acción queda atascada en reintentos. Adicionalmente, `npm run lint` reporta `2` advertencias nuevas de variables no utilizadas (`prioridadClase` en `page.tsx:175:5` y `_ref` en `EvaluacionPrioridadCard.tsx:274:26`).
- **Pasos para reproducir:**
  1. Ejecutar `npm test -- -t "EvaluacionPrioridadCard"` o `npm test -- -t "deshabilita EvaluacionPrioridadCard"`.
  2. Revisar la tabla de criterios de prioridad en `docs/manuals/H38-patrulla-asignar-prioridad.md` (líneas `29–34`) y compararla con `calcularPrioridadSugerida` (`src/lib/validations/prioridad.ts`).
  3. Ejecutar `npm run lint`.
- **Comportamiento actual:** La ejecución filtrada/aislada termina con código de salida `1` (`Misión no encontrada` en `PatrullaPrioridad.test.tsx:281:11`); el test no comprueba preservación de borrador al colapsar; el manual H38 §3 describe reglas obsoletas; ESLint arroja `2` advertencias en archivos de HU-38; `useConnectivity.ts` no descarta `409` en `AJUSTAR_PRIORIDAD`.
- **Comportamiento esperado:** `PatrullaPrioridad.test.tsx` debe ser completamente independiente por caso (inicializando `obtenerDetalleMision` en `beforeEach`, eliminando el spread sobre `mock.results[0]` e implementando una aserción real de preservación de borrador al colapsar/reabrir el acordeón); el manual H38 §3 debe documentar los puntajes/umbrales reales de cálculo; `useConnectivity.ts` debe manejar `409` como conflicto terminal para `AJUSTAR_PRIORIDAD`; y `npm run lint` debe finalizar con `0` errores y `0` advertencias en archivos de HU-38.

---

### BUG-H38-PWA-01 — Bypass de autenticación/RBAC con `DEV_PATRULLA_TOKEN`, ausencia de control por permiso en detalle de misión y colisión de integración con `develop`
- **Severidad:** Crítica (Seguridad / RBAC / Bloqueante de integración)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — 18/11/2026)*
- **Resolución verificada en Re-Test:** Se confirmó la eliminación íntegra de `DEV_PATRULLA_TOKEN`, `DEV_PATRULLA_USER_ID`, `PERFIL_DEMO_PATRULLA`, `handleAccesoRapidoPatrulla` y del fallback implícito en `AuthContext.tsx` (`NO_DEMO_BYPASS_IN_SRC`). Se integró `develop` preservando `next dev --webpack` y `next build --webpack` en `package.json`. En `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (línea `494`), `<EvaluacionPrioridadCard />` recibe `deshabilitado={!tienePermisoVerificar}` para bloquear edición cuando el operador carece del permiso `misiones:terreno:verificar`.

---

### BUG-H38-PWA-02 — Desincronización con OpenAPI (`api-generated.d.ts`), incumplimiento de `openapi-fetch`, pérdida de ID/versión del backend y ruptura al hidratar `reportesTerreno`
- **Severidad:** Alta (Contrato API / Integridad de datos)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — 18/11/2026)*
- **Resolución verificada en Re-Test:** Se regeneró `src/types/api-generated.d.ts` incorporando `/api/incidentes/{id}/prioridad/calcular`, `/api/incidentes/{id}/prioridad`, `detallesEvaluacion` y `ReporteEvaluacionTerrenoItem`; `src/types/offline.ts` deriva `CalcularPrioridadPayload` y `AsignarPrioridadPayload` desde `paths`. En `src/services/prioridadService.ts`, las peticiones migraron a `apiClient.POST` y `apiClient.PATCH`, se lee `data.data?.reporteTerreno?.id` y `versionReporte`, se incluye `familias: validado.familias` en el payload de mutación, y `mapearReportesRemotos` hidrata correctamente todos los indicadores desde `r.detallesEvaluacion` y `detalle.riesgosActivos` (verificado empíricamente con `npx tsx`).

---

### BUG-H38-PWA-03 — Corrupción de contadores al decrementar en familia única, desincronización de compromiso habitacional multi-familia y pérdida de estado al colapsar sección
- **Severidad:** Alta (Lógica funcional / Integridad de formulario)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — 18/11/2026)*
- **Resolución verificada en Re-Test:** `consolidarEvaluacionFamilias` (`src/lib/validations/prioridad.ts`) retiró la sobrescritura condicionada en familia única, tomando siempre las sumas desde `familias` (verificado con `tsx`: decrementar `personasElectrodependientes` de `1` a `0` actualiza `personasElectrodependientes = 0` y `prioridadSugerida = 'BAJA'`). En `EvaluacionPrioridadCard.tsx`, `cambiarCompromisoFamilia` invoca `consolidarEvaluacionFamilias` calculando la severidad máxima multi-familia, y `page.tsx` mantiene montado `<EvaluacionPrioridadCard />` dentro de `<SeccionDesplegable>`. *(Nota: la validación de UI para preservación al colapsar en prueba automatizada permanece pendiente dentro de `BUG-H38-PWA-07`).*

---

### BUG-H38-PWA-04 — Reconciliación offline faltante para `AJUSTAR_PRIORIDAD` en `useConnectivity`, sombreado de caché en `misionesService` y mensaje erróneo de aceptación pendiente
- **Severidad:** Alta (Resiliencia Offline-First / Consistencia de UI)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — 18/11/2026)*
- **Resolución verificada en Re-Test:** `src/hooks/useConnectivity.ts` procesa `accion.tipo === 'AJUSTAR_PRIORIDAD'` tras sincronización exitosa actualizando `sincronizacionPendiente: false`, `prioridad` y `reportesPrioridad[].sincronizado = true`. `src/services/misionesService.ts` descarta `reportesPrioridad` local cuando existen `reportesTerreno` del servidor, `obtenerReportesPrioridadMision` prioriza los reportes sincronizados remotos cuando `!mision.sincronizacionPendiente`, y `page.tsx` generaliza el texto del banner de sincronización pendiente. Verificado en `useConnectivity.test.ts` (`5/5`) y `misionesService.test.ts` (`12/12`).

---

### BUG-H38-PWA-05 — Divergencia entre el algoritmo de cálculo local vs `sgrai-api` y disparo sin *debounce* de `POST /prioridad/calcular`
- **Severidad:** Media (Consistencia de negocio / Rendimiento)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — 18/11/2026)*
- **Resolución verificada en Re-Test:** `calcularPrioridadSugerida` (`src/lib/validations/prioridad.ts`) fue homologado 1:1 con el motor acumulativo de `sgrai-api` (`>= 60 CRITICA`, `>= 35 ALTA`, `>= 15 MEDIA`, `< 15 BAJA`), verificado en `tsx` (`riesgoEstructural: true` arroja `MEDIA` y `+25 pts`). `EvaluacionPrioridadCard.tsx` incorpora un *debounce* de `350 ms` sobre la firma técnica del formulario excluyendo `detallesAdicionales` y `referencia`, cubierto en `EvaluacionPrioridadCard.test.tsx` (`9/9`).

---

### BUG-H38-PWA-06 — Ergonomía táctil `< 48px` en controles de familia, falta de `maxLength` en referencia, token `--color-border` inexistente, desfase en manual H38 y brechas de cobertura
- **Severidad:** Media (UI/UX Terreno / Documentación / Cobertura QA)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — 18/11/2026)*
- **Resolución verificada en Re-Test:** `EvaluacionPrioridadCard.module.css` establece `min-height: 48px` en `.familiaRefInput`, `.btnEliminarFamilia` y `.btnAgregarFamilia` y reemplaza todas las referencias a `--color-border` por `var(--border-color-neutral, #DFE3E8)` (`NO_COLOR_BORDER_IN_H38_CSS`). `EvaluacionPrioridadCard.tsx` aplica `maxLength={100}` al campo `referencia`. Se retiró `"Requiere apoyo táctico adicional"` de `docs/manuals/H38-patrulla-asignar-prioridad.md` y la ruta local absoluta de `docs/api/contratos-terreno.md` (línea `5`). Se añadieron nuevas pruebas en `prioridad.test.ts` (`10`), `prioridadService.test.ts` (`8`), `EvaluacionPrioridadCard.test.tsx` (`9`), `useConnectivity.test.ts` (`5`) y `misionesService.test.ts` (`12`). *(La actualización pendiente de la tabla §3 del manual y la independencia de `PatrullaPrioridad.test.tsx` se canalizan en `BUG-H38-PWA-07`).*

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-H38-PWA-07 | Aislamiento de mocks y aserción de colapsar en `PatrullaPrioridad.test.tsx`, matriz §3 de manual H38, `409` en `AJUSTAR_PRIORIDAD` y advertencias lint | Regresión / Documentación / Estática | Componentes / Estática | Media | Rama `feature/h38-patrulla-asignar-prioridad` con último commit de pruebas y manual actualizado | `npm test -- -t "EvaluacionPrioridadCard"`, `npm test -- -t "deshabilita EvaluacionPrioridadCard"`, `npm run lint`, `docs/manuals/H38-patrulla-asignar-prioridad.md` §3 | Pruebas filtradas/aisladas aprueban con verificación de colapso; `0` advertencias ESLint en HU-38; manual H38 alineado a tabla por puntos; `409` terminal para `AJUSTAR_PRIORIDAD` | `npm test -- -t` falla (`exit 1`, `"Misión no encontrada"` en `PatrullaPrioridad.test.tsx:281`); manual §3 describe reglas antiguas; `2` warnings lint (`prioridadClase`, `_ref`); `409` omitido para `AJUSTAR_PRIORIDAD` | ABIERTO | 18/11/2026 02:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H38-PWA-01 | Bypass de auth/RBAC con `DEV_PATRULLA_TOKEN`, ausencia de control `misiones:terreno:verificar` en formulario y colisión con `develop` | Seguridad / Integración | Sistema / Componentes | Crítica | Rama actualizada con `develop` (`merge`) y revisión de `prioridadService.ts`, `AuthContext.tsx` y `page.tsx` | `rg` sobre símbolos demo en `src/`, `package.json`, `EvaluacionPrioridadCard` con `deshabilitado={!tienePermisoVerificar}` | Sin bypass demo ni fallback implícito; rechazo estricto de `401`/`403`; formulario bloqueado sin permiso; `--webpack` preservado | Verificado en Re-Test: `NO_DEMO_BYPASS_IN_SRC`, `package.json` con `--webpack`, `page.tsx:494` pasa `deshabilitado={!tienePermisoVerificar}`, `build` limpio | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | fix(prioridad): eliminar bypass demo, migrar a apiClient y corregir hidratación |
| BUG-H38-PWA-02 | Contrato OpenAPI `api-generated.d.ts`, uso de `apiClient`, lectura de `data.reporteTerreno` y extracción de `detallesEvaluacion` | Contrato / Integración | Integración | Alta | `src/types/api-generated.d.ts` regenerado y `src/services/prioridadService.ts` migrado a `openapi-fetch` | Inspección de `paths` en `api-generated.d.ts` y ejecución `tsx` de `obtenerReportesPrioridadMision` con `detallesEvaluacion` y `riesgosActivos` | Endpoints H38 tipados desde OpenAPI; uso de `apiClient`; lectura de `reporteTerreno`; envío de `familias`; hidratación fiel de `detallesEvaluacion` | Verificado en Re-Test: tipos derivados en `offline.ts`, `apiClient.POST/PATCH` activos y `tsx` hidrata íntegramente `familias`, contadores, riesgos y `GRAVE_INHABITABLE` | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | chore(api): regenerar tipos OpenAPI con endpoints de prioridad y derivar contratos |
| BUG-H38-PWA-03 | Decremento de contadores en familia única, consolidación habitacional multi-familia y preservación de estado al colapsar acordeón | Funcional / Lógica | Unitaria / Componentes | Alta | `consolidarEvaluacionFamilias` (`prioridad.ts`) y `EvaluacionPrioridadCard.tsx` con `1` o más familias | `tsx` con decremento `personasElectrodependientes` `1 -> 0` en familia única; `EvaluacionPrioridadCard.test.tsx` con `2` familias (`GRAVE_INHABITABLE`); `<EvaluacionPrioridadCard />` montado en `<SeccionDesplegable>` | Contadores y `prioridadSugerida` retornan a `0`/`BAJA` al decrementar; compromiso máximo consolida en `2+` familias; formulario permanece montado en acordeón | Verificado en Re-Test: `tsx` devuelve `personasElectrodependientes: 0` y `BAJA`; `EvaluacionPrioridadCard.test.tsx` (`9/9`) aprueba consolidación multi-familia; acordeón no desmonta | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | fix(terreno): homologar cálculo de prioridad, consolidación multi-familia, RBAC y ergonomía |
| BUG-H38-PWA-04 | Sincronización outbox de `AJUSTAR_PRIORIDAD` en `useConnectivity`, sombreado por `reportesPrioridad` y banner de estado pendiente | Resiliencia / Offline | Integración / Componentes | Alta | Misión `EN_CURSO` con mutación `AJUSTAR_PRIORIDAD` en `outbox` de IndexedDB y refresco desde API | `useConnectivity.test.ts` (`AJUSTAR_PRIORIDAD`), `misionesService.test.ts` (limpieza de `reportesPrioridad`) y `page.tsx:359-362` | `useConnectivity` reconcilia `MisionLocal` y `reportesPrioridad`; `obtenerDetalleMision` evita sombreado; banner generalizado por mutación | Verificado en Re-Test: `useConnectivity.test.ts` (`5/5`) y `misionesService.test.ts` (`12/12`) aprueban reconciliación de outbox y limpieza de caché local; banner actualizado | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados |
| BUG-H38-PWA-05 | Consistencia algorítmica online/offline de `prioridadSugerida` y *debounce* en llamadas a `POST /prioridad/calcular` | Funcional / Rendimiento | Integración / Componentes | Media | `calcularPrioridadSugerida` homologado con `sgrai-api` y `EvaluacionPrioridadCard.tsx` con *debounce* `350 ms` | `tsx` con `riesgoEstructural: true` (`25 pts`) y prueba de escritura en `detallesAdicionales` en `EvaluacionPrioridadCard.test.tsx` | Cliente offline y backend online calculan `MEDIA` (`+25 pts`); sin llamadas HTTP ante cambios de texto libre; *debounce* activo (`350 ms`) | Verificado en Re-Test: `tsx` devuelve `MEDIA` (`+25 pts`) con paridad frente a `sgrai-api`; `EvaluacionPrioridadCard.test.tsx` valida debounce y exclusión de texto | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | fix(terreno): homologar cálculo de prioridad, consolidación multi-familia, RBAC y ergonomía |
| BUG-H38-PWA-06 | Ergonomía táctil `>= 48px`, `maxLength` en referencia, token CSS `--border-color-neutral`, limpieza de rutas en docs y cobertura | UI / UX / Documentación | Componentes / Estática | Media | Revisión CSS/TSX de `EvaluacionPrioridadCard`, `docs/api/contratos-terreno.md`, manual H38 y suites nuevas | `rg -- '--color-border'`, `min-height: 48px` en controles de familia, `maxLength={100}`, `contratos-terreno.md:5`, retiro de opción eliminada | Controles `>= 48px`, `maxLength={100}`, token `--border-color-neutral`, sin rutas absolutas ni `"Requiere apoyo táctico adicional"`, nuevas pruebas unitarias | Verificado en Re-Test: `NO_COLOR_BORDER_IN_H38_CSS`, ergonomía `48px` y `maxLength={100}` aplicados, ruta limpia en `contratos-terreno.md:5`, suites ampliadas | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | docs(h38): actualizar manual H38 y limpiar ruta absoluta en contratos-terreno |
| CP-H38-PWA-01 | Despliegue visible de `prioridadSugerida` y actualización reactiva ante factores críticos | Funcional / UI | Componentes | Alta | `EvaluacionPrioridadCard` montado en jsdom con misión `EN_CURSO` | Carga inicial sin factores (`BAJA`) e incremento de `nucleoFamiliarTotal=1` + `personasElectrodependientes=1` | Muestra `badge-prioridad-sugerida` inicialmente en `Baja` y recalcula inmediatamente a `Crítica` | `EvaluacionPrioridadCard.test.tsx` aprueba transición reactiva en Re-Test (`9/9` en `1190ms`) | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | feat(patrulla): integrar formulario de evaluacion en terreno y prioridad en reportes tecnicos (H38) |
| CP-H38-PWA-02 | Selector de cuatro niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) y campo obligatorio de justificación ante discrepancia | Funcional / Validación | Unitaria / Componentes | Alta | Formulario en `EvaluacionPrioridadCard` y esquema `asignarPrioridadSchema` | Selección manual `ALTA` sobre sugerencia `BAJA`, entrada de `abc` (`< 5` chars) vs justificación válida (`>= 5` chars) | Oculta justificación al coincidir; despliega textarea obligatorio al discrepar; bloquea envío si `< 5` chars y habilita con `>= 5` chars | `prioridad.test.ts` (`10/10` en `33ms`) y `EvaluacionPrioridadCard.test.tsx` (`9/9`) aprueban bloqueo y validación en Re-Test | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38) |
| CP-H38-PWA-03 | Reglas locales acumulativas de cálculo de prioridad (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) y exclusión de `requiereApoyoAdicional` | Funcional / Unitaria | Unitaria | Media | Función pura `calcularPrioridadSugerida` homologada en `src/lib/validations/prioridad.ts` | Escenarios `< 15 pts` (`BAJA`), `>= 15` (`MEDIA`), `>= 35` (`ALTA`), `>= 60` (`CRITICA`) con suma de factores vulnerables y habitacionales | Retorna prioridad y `factoresGatillantes` con puntajes homogéneos a `sgrai-api` sin considerar `requiereApoyoAdicional` | `prioridad.test.ts` aprueba `10/10` pruebas del motor acumulativo homologado en `33ms` | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA |
| CP-H38-PWA-04 | Prevención de registro de integrantes sobre el tamaño del núcleo familiar y libertad en conteo de mascotas | Funcional / Validación | Unitaria / Componentes | Media | `familiaAfectadaSchema` y contadores táctiles de `EvaluacionPrioridadCard` | `nucleoFamiliarTotal=0` y `2`, luego `1 niño + 1 adulto mayor` (`2/2`) e incremento de `mascotasAfectadas` a `3` y `maxLength=100` en `referencia` | Deshabilita botones `+` de integrantes al alcanzar cupo del núcleo familiar y `-` del núcleo si existen integrantes; permite mascotas y limita referencia | `prioridad.test.ts` (`10/10`) y `EvaluacionPrioridadCard.test.tsx` (`9/9`) validan bloqueos de cupo, mascotas y límite de caracteres | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | feat(patrulla): prevenir registro de integrantes sobre el tamano del nucleo familiar (H38) |
| CP-H38-PWA-05 | Registro, consolidación de daño máximo y eliminación dinámica de múltiples familias afectadas | Funcional / UI | Componentes | Media | `EvaluacionPrioridadCard` montado con `1 Hogar / Vivienda` inicial | Clic en `Añadir otra familia afectada`, selección de `GRAVE_INHABITABLE` en Familia #2 y eliminación de `Familia #2` | Agrega `Familia #2` (`2 Hogares / Viviendas`), recalcula compromiso máximo y restaura `1 Hogar / Vivienda` al eliminar | `EvaluacionPrioridadCard.test.tsx` (`9/9`) valida flujo multi-familia y consolidación en Re-Test | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | fix(patrulla): definir actuales al agregar familia y reconsolidar al eliminar (H38) |
| CP-H38-PWA-06 | Modal `ModalConfirmacionPrioridad` con comparativa Sugerida vs Final, justificación técnica, versión de reporte y cierre accesible | UI / Accesibilidad | Componentes | Media | `ModalConfirmacionPrioridad` montado en jsdom | Props `versionReporte=1` (ratificación), `versionReporte=2` (`MEDIA` -> `CRITICA` con justificación), clic en `Cancelar`, tecla `Escape` y `Confirmar y Enviar` | Muestra `Reporte #1` / `Reporte #2`, chips comparativos, justificación y dispara callbacks en botón, `Escape` y confirmación | `ModalConfirmacionPrioridad.test.tsx` aprueba `4/4` casos en `359ms` en Re-Test | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | refactor(ui): estandarizar modales de confirmacion con ConfirmModal, ConfirmacionResumen y Chip |
| CP-H38-PWA-07 | Envío online de prioridad vía `apiClient`, inclusión de `familias`, versionado correlativo (`Reporte #2`) y propagación de `403` | Funcional / Servicio | Unitaria | Alta | `prioridadService.ts` con `navigator.onLine=true` y `apiClient` mockeado en Vitest | Respuestas mock `200 OK` con `reporteTerreno`, inclusión de `familias`, incremento `Reporte #2`, rechazo `403 Forbidden` sin token demo | Retorna `ok:true`, captura `reporteTerreno.id` y `versionReporte`, incluye `familias` y propaga error `403` | `prioridadService.test.ts` aprueba `8/8` pruebas en `44ms` en Re-Test | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA |
| CP-H38-PWA-08 | Encolado en IndexedDB (`AJUSTAR_PRIORIDAD`), actualización optimista offline y reconciliación al reconectar | Funcional / Offline | Unitaria | Alta | `prioridadService.ts` (`offline`) y `useConnectivity.ts` al recuperar red (`online`) | `prioridadSugerida='BAJA'`, `prioridad='ALTA'`, justificación `>= 5` chars; disparo de sincronización `AJUSTAR_PRIORIDAD` | Encola acción `AJUSTAR_PRIORIDAD` en outbox y reconcilia `sincronizacionPendiente=false` / `reportesPrioridad[].sincronizado=true` al reconectar | `prioridadService.test.ts` (`8/8`) y `useConnectivity.test.ts` (`5/5` en `153ms`) aprueban en Re-Test | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados |
| CP-H38-PWA-09 | Integración en `PatrullaMisionDetailPage`: despliegue de sección, confirmación modal y estado colapsado `Completado (#2)` | Funcional / Integración | Componentes | Alta | `PatrullaMisionDetailPage` con misión `EN_CURSO`, tipología evaluada y mocks en secuencia | Activación de riesgo, confirmación en modal y carga inicial con `versionReportePrioridad=2` (ver `BUG-H38-PWA-07` para caso 3 aislado) | Actualiza chip a `Completado (#1)` tras envío y colapsa ambos acordeones `<details>` si ya fueron evaluados (`Completado (#2)`) | `PatrullaPrioridad.test.tsx` aprueba en ejecución conjunta (`3/3` en `755ms`) y `PatrullaDetailPage.test.tsx` aprueba (`7/7` en `744ms`); caso 3 requiere fix en `BUG-H38-PWA-07` | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | feat(patrulla): actualizar integracion de evaluaciones tecnicas y pruebas en detalle de mision |
| CP-H38-PWA-10 | Sincronización de `evaluaciones`, `reportesTerreno` y limpieza de `reportesPrioridad` en `obtenerDetalleMision` | Integración / Servicio | Unitaria | Media | `misionesService.ts` con `apiClient.GET` y `offlineQueue` mockeados | Respuesta mock `GET /api/misiones/mis-7700` con `reportesTerreno` remotos y `reportesPrioridad` previos en IndexedDB | Persiste `prioridadEvaluada: true`, `versionReportePrioridad: 1` y limpia `reportesPrioridad` obsoleto ante datos del servidor | `misionesService.test.ts` aprueba `12/12` pruebas en `35ms` en Re-Test | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados |
| CP-H38-PWA-11 | Validación en vivo de contrato HTTP (`401`, `403`, `400`) en `sgrai-api` (`:3001`) y protección de ruta `307` en `sgrai-pwa` (`:3002`) | Integración / Seguridad | Sistema | Alta | Servicios locales en `http://localhost:3001` y `http://localhost:3002` con PostgreSQL (`5001`) y Redis (`6001`) | `POST /api/seguridad/login`, `PATCH /api/incidentes/{id}/prioridad` sin token / con `CALL_CENTER` / sin justificación `>= 5` chars, `GET :3002/terreno/patrulla/misiones` | API responde `401` sin Bearer, `403` sin `misiones:terreno:verificar`, `400` ante discrepancia con `abc`; PWA redirige `307` | Verificado en Re-Test (`18/11/2026 02:35`): `401`, `403`, `400` (`justificacion_prioridad`) y `307` -> `/terreno/login` (`200`) | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | docs(patrulla): agregar manual de usuario H38 y documentar contrato de prioridad en terreno |
| CP-H38-PWA-12 | Ejecución secuencial completa Vitest, `tsc --noEmit`, ESLint, `npm run build` (`--webpack`) y estática en `src/` | Regresión / Calidad Estática | Sistema / Estática | Alta | Repositorio `web-app` limpio en rama `feature/h38-patrulla-asignar-prioridad` | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `rg` sobre `src/` | `44/44` suites en verde, `0` errores TS, `0` errores ESLint, build `--webpack` exitoso y `0` emojis/tokens demo | `44/44` suites (`209/209` tests en `8.33s`), `tsc` exit `0`, ESLint `0` errores (`2` warnings tracked en `BUG-07`), `next build --webpack` (`8/8`), `NO_EMOJIS_IN_SRC` | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:38 | test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H38-PWA-07	Aislamiento de mocks y aserción de colapsar en PatrullaPrioridad.test.tsx, matriz §3 de manual H38, 409 en AJUSTAR_PRIORIDAD y advertencias lint	Regresión / Documentación / Estática	Componentes / Estática	Media	Rama feature/h38-patrulla-asignar-prioridad con último commit de pruebas y manual actualizado	npm test -- -t "EvaluacionPrioridadCard", npm test -- -t "deshabilita EvaluacionPrioridadCard", npm run lint, docs/manuals/H38-patrulla-asignar-prioridad.md §3	Pruebas filtradas/aisladas aprueban con verificación de colapso; 0 advertencias ESLint en HU-38; manual H38 alineado a tabla por puntos; 409 terminal para AJUSTAR_PRIORIDAD	npm test -- -t falla (exit 1, "Misión no encontrada" en PatrullaPrioridad.test.tsx:281); manual §3 describe reglas antiguas; 2 warnings lint (prioridadClase, _ref); 409 omitido para AJUSTAR_PRIORIDAD	ABIERTO	18/11/2026 02:38	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-PWA-01	Bypass de auth/RBAC con DEV_PATRULLA_TOKEN, ausencia de control misiones:terreno:verificar en formulario y colisión con develop	Seguridad / Integración	Sistema / Componentes	Crítica	Rama actualizada con develop (merge) y revisión de prioridadService.ts, AuthContext.tsx y page.tsx	rg sobre símbolos demo en src/, package.json, EvaluacionPrioridadCard con deshabilitado={!tienePermisoVerificar}	Sin bypass demo ni fallback implícito; rechazo estricto de 401/403; formulario bloqueado sin permiso; --webpack preservado	Verificado en Re-Test: NO_DEMO_BYPASS_IN_SRC, package.json con --webpack, page.tsx:494 pasa deshabilitado={!tienePermisoVerificar}, build limpio	APROBADO	17/11/2026 14:26	18/11/2026 02:38	fix(prioridad): eliminar bypass demo, migrar a apiClient y corregir hidratación
BUG-H38-PWA-02	Contrato OpenAPI api-generated.d.ts, uso de apiClient, lectura de data.reporteTerreno y extracción de detallesEvaluacion	Contrato / Integración	Integración	Alta	src/types/api-generated.d.ts regenerado y src/services/prioridadService.ts migrado a openapi-fetch	Inspección de paths en api-generated.d.ts y ejecución tsx de obtenerReportesPrioridadMision con detallesEvaluacion y riesgosActivos	Endpoints H38 tipados desde OpenAPI; uso de apiClient; lectura de reporteTerreno; envío de familias; hidratación fiel de detallesEvaluacion	Verificado en Re-Test: tipos derivados en offline.ts, apiClient.POST/PATCH activos y tsx hidrata íntegramente familias, contadores, riesgos y GRAVE_INHABITABLE	APROBADO	17/11/2026 14:26	18/11/2026 02:38	chore(api): regenerar tipos OpenAPI con endpoints de prioridad y derivar contratos
BUG-H38-PWA-03	Decremento de contadores en familia única, consolidación habitacional multi-familia y preservación de estado al colapsar acordeón	Funcional / Lógica	Unitaria / Componentes	Alta	consolidarEvaluacionFamilias (prioridad.ts) y EvaluacionPrioridadCard.tsx con 1 o más familias	tsx con decremento personasElectrodependientes 1 -> 0 en familia única; EvaluacionPrioridadCard.test.tsx con 2 familias (GRAVE_INHABITABLE); EvaluacionPrioridadCard montado en SeccionDesplegable	Contadores y prioridadSugerida retornan a 0/BAJA al decrementar; compromiso máximo consolida en 2+ familias; formulario permanece montado en acordeón	Verificado en Re-Test: tsx devuelve personasElectrodependientes: 0 y BAJA; EvaluacionPrioridadCard.test.tsx (9/9) aprueba consolidación multi-familia; acordeón no desmonta	APROBADO	17/11/2026 14:26	18/11/2026 02:38	fix(terreno): homologar cálculo de prioridad, consolidación multi-familia, RBAC y ergonomía
BUG-H38-PWA-04	Sincronización outbox de AJUSTAR_PRIORIDAD en useConnectivity, sombreado por reportesPrioridad y banner de estado pendiente	Resiliencia / Offline	Integración / Componentes	Alta	Misión EN_CURSO con mutación AJUSTAR_PRIORIDAD en outbox de IndexedDB y refresco desde API	useConnectivity.test.ts (AJUSTAR_PRIORIDAD), misionesService.test.ts (limpieza de reportesPrioridad) y page.tsx:359-362	useConnectivity reconcilia MisionLocal y reportesPrioridad; obtenerDetalleMision evita sombreado; banner generalizado por mutación	Verificado en Re-Test: useConnectivity.test.ts (5/5) y misionesService.test.ts (12/12) aprueban reconciliación de outbox y limpieza de caché local; banner actualizado	APROBADO	17/11/2026 14:26	18/11/2026 02:38	fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados
BUG-H38-PWA-05	Consistencia algorítmica online/offline de prioridadSugerida y debounce en llamadas a POST /prioridad/calcular	Funcional / Rendimiento	Integración / Componentes	Media	calcularPrioridadSugerida homologado con sgrai-api y EvaluacionPrioridadCard.tsx con debounce 350 ms	tsx con riesgoEstructural: true (25 pts) y prueba de escritura en detallesAdicionales en EvaluacionPrioridadCard.test.tsx	Cliente offline y backend online calculan MEDIA (+25 pts); sin llamadas HTTP ante cambios de texto libre; debounce activo (350 ms)	Verificado en Re-Test: tsx devuelve MEDIA (+25 pts) con paridad frente a sgrai-api; EvaluacionPrioridadCard.test.tsx valida debounce y exclusión de texto	APROBADO	17/11/2026 14:26	18/11/2026 02:38	fix(terreno): homologar cálculo de prioridad, consolidación multi-familia, RBAC y ergonomía
BUG-H38-PWA-06	Ergonomía táctil >= 48px, maxLength en referencia, token CSS --border-color-neutral, limpieza de rutas en docs y cobertura	UI / UX / Documentación	Componentes / Estática	Media	Revisión CSS/TSX de EvaluacionPrioridadCard, docs/api/contratos-terreno.md, manual H38 y suites nuevas	rg -- '--color-border', min-height: 48px en controles de familia, maxLength={100}, contratos-terreno.md:5, retiro de opción eliminada	Controles >= 48px, maxLength={100}, token --border-color-neutral, sin rutas absolutas ni "Requiere apoyo táctico adicional", nuevas pruebas unitarias	Verificado en Re-Test: NO_COLOR_BORDER_IN_H38_CSS, ergonomía 48px y maxLength={100} aplicados, ruta limpia en contratos-terreno.md:5, suites ampliadas	APROBADO	17/11/2026 14:26	18/11/2026 02:38	docs(h38): actualizar manual H38 y limpiar ruta absoluta en contratos-terreno
CP-H38-PWA-01	Despliegue visible de prioridadSugerida y actualización reactiva ante factores críticos	Funcional / UI	Componentes	Alta	EvaluacionPrioridadCard montado en jsdom con misión EN_CURSO	Carga inicial sin factores (BAJA) e incremento de nucleoFamiliarTotal=1 + personasElectrodependientes=1	Muestra badge-prioridad-sugerida inicialmente en Baja y recalcula inmediatamente a Crítica	EvaluacionPrioridadCard.test.tsx aprueba transición reactiva en Re-Test (9/9 en 1190ms)	APROBADO	17/11/2026 14:26	18/11/2026 02:38	feat(patrulla): integrar formulario de evaluacion en terreno y prioridad en reportes tecnicos (H38)
CP-H38-PWA-02	Selector de cuatro niveles canónicos (BAJA, MEDIA, ALTA, CRITICA) y campo obligatorio de justificación ante discrepancia	Funcional / Validación	Unitaria / Componentes	Alta	Formulario en EvaluacionPrioridadCard y esquema asignarPrioridadSchema	Selección manual ALTA sobre sugerencia BAJA, entrada de abc (< 5 chars) vs justificación válida (>= 5 chars)	Oculta justificación al coincidir; despliega textarea obligatorio al discrepar; bloquea envío si < 5 chars y habilita con >= 5 chars	prioridad.test.ts (10/10 en 33ms) y EvaluacionPrioridadCard.test.tsx (9/9) aprueban bloqueo y validación en Re-Test	APROBADO	17/11/2026 14:26	18/11/2026 02:38	feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38)
CP-H38-PWA-03	Reglas locales acumulativas de cálculo de prioridad (BAJA, MEDIA, ALTA, CRITICA) y exclusión de requiereApoyoAdicional	Funcional / Unitaria	Unitaria	Media	Función pura calcularPrioridadSugerida homologada en src/lib/validations/prioridad.ts	Escenarios < 15 pts (BAJA), >= 15 (MEDIA), >= 35 (ALTA), >= 60 (CRITICA) con suma de factores vulnerables y habitacionales	Retorna prioridad y factoresGatillantes con puntajes homogéneos a sgrai-api sin considerar requiereApoyoAdicional	prioridad.test.ts aprueba 10/10 pruebas del motor acumulativo homologado en 33ms	APROBADO	17/11/2026 14:26	18/11/2026 02:38	test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA
CP-H38-PWA-04	Prevención de registro de integrantes sobre el tamaño del núcleo familiar y libertad en conteo de mascotas	Funcional / Validación	Unitaria / Componentes	Media	familiaAfectadaSchema y contadores táctiles de EvaluacionPrioridadCard	nucleoFamiliarTotal=0 y 2, luego 1 niño + 1 adulto mayor (2/2) e incremento de mascotasAfectadas a 3 y maxLength=100 en referencia	Deshabilita botones + de integrantes al alcanzar cupo del núcleo familiar y - del núcleo si existen integrantes; permite mascotas y limita referencia	prioridad.test.ts (10/10) y EvaluacionPrioridadCard.test.tsx (9/9) validan bloqueos de cupo, mascotas y límite de caracteres	APROBADO	17/11/2026 14:26	18/11/2026 02:38	feat(patrulla): prevenir registro de integrantes sobre el tamano del nucleo familiar (H38)
CP-H38-PWA-05	Registro, consolidación de daño máximo y eliminación dinámica de múltiples familias afectadas	Funcional / UI	Componentes	Media	EvaluacionPrioridadCard montado con 1 Hogar / Vivienda inicial	Clic en Añadir otra familia afectada, selección de GRAVE_INHABITABLE en Familia #2 y eliminación de Familia #2	Agrega Familia #2 (2 Hogares / Viviendas), recalcula compromiso máximo y restaura 1 Hogar / Vivienda al eliminar	EvaluacionPrioridadCard.test.tsx (9/9) valida flujo multi-familia y consolidación en Re-Test	APROBADO	17/11/2026 14:26	18/11/2026 02:38	fix(patrulla): definir actuales al agregar familia y reconsolidar al eliminar (H38)
CP-H38-PWA-06	Modal ModalConfirmacionPrioridad con comparativa Sugerida vs Final, justificación técnica, versión de reporte y cierre accesible	UI / Accesibilidad	Componentes	Media	ModalConfirmacionPrioridad montado en jsdom	Props versionReporte=1 (ratificación), versionReporte=2 (MEDIA -> CRITICA con justificación), clic en Cancelar, tecla Escape y Confirmar y Enviar	Muestra Reporte #1 / Reporte #2, chips comparativos, justificación y dispara callbacks en botón, Escape y confirmación	ModalConfirmacionPrioridad.test.tsx aprueba 4/4 casos en 359ms en Re-Test	APROBADO	17/11/2026 14:26	18/11/2026 02:38	refactor(ui): estandarizar modales de confirmacion con ConfirmModal, ConfirmacionResumen y Chip
CP-H38-PWA-07	Envío online de prioridad vía apiClient, inclusión de familias, versionado correlativo (Reporte #2) y propagación de 403	Funcional / Servicio	Unitaria	Alta	prioridadService.ts con navigator.onLine=true y apiClient mockeado en Vitest	Respuestas mock 200 OK con reporteTerreno, inclusión de familias, incremento Reporte #2, rechazo 403 Forbidden sin token demo	Retorna ok:true, captura reporteTerreno.id y versionReporte, incluye familias y propaga error 403	prioridadService.test.ts aprueba 8/8 pruebas en 44ms en Re-Test	APROBADO	17/11/2026 14:26	18/11/2026 02:38	test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA
CP-H38-PWA-08	Encolado en IndexedDB (AJUSTAR_PRIORIDAD), actualización optimista offline y reconciliación al reconectar	Funcional / Offline	Unitaria	Alta	prioridadService.ts (offline) y useConnectivity.ts al recuperar red (online)	prioridadSugerida='BAJA', prioridad='ALTA', justificación >= 5 chars; disparo de sincronización AJUSTAR_PRIORIDAD	Encola acción AJUSTAR_PRIORIDAD en outbox y reconcilia sincronizacionPendiente=false / reportesPrioridad[].sincronizado=true al reconectar	prioridadService.test.ts (8/8) y useConnectivity.test.ts (5/5 en 153ms) aprueban en Re-Test	APROBADO	17/11/2026 14:26	18/11/2026 02:38	fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados
CP-H38-PWA-09	Integración en PatrullaMisionDetailPage: despliegue de sección, confirmación modal y estado colapsado Completado (#2)	Funcional / Integración	Componentes	Alta	PatrullaMisionDetailPage con misión EN_CURSO, tipología evaluada y mocks en secuencia	Activación de riesgo, confirmación en modal y carga inicial con versionReportePrioridad=2 (ver BUG-H38-PWA-07 para caso 3 aislado)	Actualiza chip a Completado (#1) tras envío y colapsa ambos acordeones details si ya fueron evaluados (Completado (#2))	PatrullaPrioridad.test.tsx aprueba en ejecución conjunta (3/3 en 755ms) y PatrullaDetailPage.test.tsx aprueba (7/7 en 744ms); caso 3 requiere fix en BUG-H38-PWA-07	APROBADO	17/11/2026 14:26	18/11/2026 02:38	feat(patrulla): actualizar integracion de evaluaciones tecnicas y pruebas en detalle de mision
CP-H38-PWA-10	Sincronización de evaluaciones, reportesTerreno y limpieza de reportesPrioridad en obtenerDetalleMision	Integración / Servicio	Unitaria	Media	misionesService.ts con apiClient.GET y offlineQueue mockeados	Respuesta mock GET /api/misiones/mis-7700 con reportesTerreno remotos y reportesPrioridad previos en IndexedDB	Persiste prioridadEvaluada: true, versionReportePrioridad: 1 y limpia reportesPrioridad obsoleto ante datos del servidor	misionesService.test.ts aprueba 12/12 pruebas en 35ms en Re-Test	APROBADO	17/11/2026 14:26	18/11/2026 02:38	fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados
CP-H38-PWA-11	Validación en vivo de contrato HTTP (401, 403, 400) en sgrai-api (:3001) y protección de ruta 307 en sgrai-pwa (:3002)	Integración / Seguridad	Sistema	Alta	Servicios locales en http://localhost:3001 y http://localhost:3002 con PostgreSQL (5001) y Redis (6001)	POST /api/seguridad/login, PATCH /api/incidentes/{id}/prioridad sin token / con CALL_CENTER / sin justificación >= 5 chars, GET :3002/terreno/patrulla/misiones	API responde 401 sin Bearer, 403 sin misiones:terreno:verificar, 400 ante discrepancia con abc; PWA redirige 307	Verificado en Re-Test (18/11/2026 02:35): 401, 403, 400 (justificacion_prioridad) y 307 -> /terreno/login (200)	APROBADO	17/11/2026 14:26	18/11/2026 02:38	docs(patrulla): agregar manual de usuario H38 y documentar contrato de prioridad en terreno
CP-H38-PWA-12	Ejecución secuencial completa Vitest, tsc --noEmit, ESLint, npm run build (--webpack) y estática en src/	Regresión / Calidad Estática	Sistema / Estática	Alta	Repositorio web-app limpio en rama feature/h38-patrulla-asignar-prioridad	npm test, npx tsc --noEmit, npm run lint, npm run build, rg sobre src/	44/44 suites en verde, 0 errores TS, 0 errores ESLint, build --webpack exitoso y 0 emojis/tokens demo	44/44 suites (209/209 tests en 8.33s), tsc exit 0, ESLint 0 errores (2 warnings tracked en BUG-07), next build --webpack (8/8), NO_EMOJIS_IN_SRC	APROBADO	17/11/2026 14:26	18/11/2026 02:38	test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA
```

---

## 5. Guía de Ejecución y Replicabilidad Paso a Paso

Todos los comandos siguientes se ejecutaron desde la raíz del repositorio `web-app` (`sgrai-pwa`) sobre la rama `feature/h38-patrulla-asignar-prioridad` en el ciclo de Re-Test (`18/11/2026`).

### 5.1 Suite Vitest, subconjunto HU-38 y reproducción de `BUG-H38-PWA-07`

1. **Suite completa (`npm test`):**

```bash
npm test
```

Salida observada:

```text
 Test Files  44 passed (44)
      Tests  209 passed (209)
   Start at  02:37:32
   Duration  8.33s (transform 3.13s, setup 9.87s, collect 14.03s, tests 12.87s, environment 48.82s, prepare 6.18s)
```

2. **Subconjunto de `8` suites dedicadas a HU-38 y regresión de detalle/offline:**

```bash
npx vitest run \
  src/lib/validations/__tests__/prioridad.test.ts \
  src/services/__tests__/prioridadService.test.ts \
  src/components/misiones/__tests__/EvaluacionPrioridadCard.test.tsx \
  src/components/misiones/__tests__/ModalConfirmacionPrioridad.test.tsx \
  'src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx' \
  src/hooks/__tests__/useConnectivity.test.ts \
  src/services/__tests__/misionesService.test.ts \
  'src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx'
```

Salida observada:

```text
 ✓ src/lib/validations/__tests__/prioridad.test.ts (10 tests) 33ms
 ✓ src/services/__tests__/misionesService.test.ts (12 tests) 35ms
 ✓ src/services/__tests__/prioridadService.test.ts (8 tests) 44ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (5 tests) 153ms
 ✓ src/components/misiones/__tests__/ModalConfirmacionPrioridad.test.tsx (4 tests) 359ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx (3 tests) 755ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx (7 tests) 744ms
 ✓ src/components/misiones/__tests__/EvaluacionPrioridadCard.test.tsx (9 tests) 1190ms

 Test Files  8 passed (8)
      Tests  58 passed (58)
   Start at  02:37:43
   Duration  4.54s (transform 2.67s, setup 2.47s, collect 6.34s, tests 3.31s, environment 10.72s, prepare 1.37s)
```

3. **Reproducción determinista de `BUG-H38-PWA-07` con filtro `-t`:**

```bash
npm test -- -t "EvaluacionPrioridadCard"
npm test -- -t "deshabilita EvaluacionPrioridadCard"
```

Salidas observadas (ambas finalizan con `Command exited with code 1`):

```text
# npm test -- -t "EvaluacionPrioridadCard"
 ❯ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx:281:11
    Unable to find an accessible element with the role "button" and name `/Confirmar prioridad y enviar reporte/i`
    (DOM renderiza: "Misión no encontrada")
 Test Files  1 failed | 1 passed | 42 skipped (44)
      Tests  1 failed | 9 passed | 199 skipped (209)
   Duration  10.44s

# npm test -- -t "deshabilita EvaluacionPrioridadCard"
 ❯ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx:281:11
 Test Files  1 failed | 43 skipped (44)
      Tests  1 failed | 208 skipped (209)
   Duration  8.51s
```

### 5.2 Verificación estática, ESLint, TypeScript y Build (`--webpack`)

```bash
npx tsc --noEmit
npm run lint
npm run build
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS_IN_SRC"
rg -n 'DEV_PATRULLA_TOKEN|DEV_PATRULLA_USER_ID|PERFIL_DEMO_PATRULLA|handleAccesoRapidoPatrulla' src/ || echo "NO_DEMO_BYPASS_IN_SRC"
rg -n -- '--color-border' src/components/misiones/EvaluacionPrioridadCard.module.css || echo "NO_COLOR_BORDER_IN_H38_CSS"
```

Salidas observadas:
- `npx tsc --noEmit`: `exit code 0`.
- `npm run lint`: `exit code 0`, `✖ 2 problems (0 errors, 2 warnings)`:
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx:175:5`: `'prioridadClase' is assigned a value but never used` (`@typescript-eslint/no-unused-vars`).
  - `src/components/misiones/EvaluacionPrioridadCard.tsx:274:26`: `'_ref' is defined but never used` (`@typescript-eslint/no-unused-vars`).
- `npm run build` (`next build --webpack`, Next.js `16.3.4`): `✓ Compiled successfully in 2.5s`, `✓ Finished TypeScript in 1886ms`, `✓ Generating static pages using 11 workers (8/8) in 623ms`.
- Búsquedas estáticas: `NO_EMOJIS_IN_SRC`, `NO_DEMO_BYPASS_IN_SRC` y `NO_COLOR_BORDER_IN_H38_CSS`.

### 5.3 Verificación empírica en `tsx` (`BUG-H38-PWA-02`, `BUG-H38-PWA-03` y `BUG-H38-PWA-05`)

```bash
npx tsx -e "
import { calcularPrioridadSugerida, consolidarEvaluacionFamilias, VALORES_INICIALES_EVALUACION_PRIORIDAD } from './src/lib/validations/prioridad';
import { obtenerReportesPrioridadMision } from './src/services/prioridadService';

console.log('1) Local riesgoEstructural=true:', calcularPrioridadSugerida({ ...VALORES_INICIALES_EVALUACION_PRIORIDAD, riesgoEstructural: true }));
const prev = { ...VALORES_INICIALES_EVALUACION_PRIORIDAD, nucleoFamiliarTotal: 1, personasElectrodependientes: 1, familias: [{ ...VALORES_INICIALES_EVALUACION_PRIORIDAD.familias[0], nucleoFamiliarTotal: 1, personasElectrodependientes: 1 }] };
const familiasActualizadas = [{ ...prev.familias[0], personasElectrodependientes: 0 }];
const consolidado = consolidarEvaluacionFamilias({ ...prev, familias: familiasActualizadas });
console.log('2) Tras decrementar electrodependiente de 1 a 0:', { personasElectrodependientes: consolidado.personasElectrodependientes, prioridadSugerida: calcularPrioridadSugerida({ ...prev, ...consolidado, familias: familiasActualizadas }).prioridadSugerida });

const misionConReporteApi = {
  id: '60000000-0000-4000-8000-000000000001',
  incidenteId: '50000000-0000-4000-8000-000000000001',
  codigoIncidente: 'INC-2026-0001',
  tipologia: 'Inundación',
  direccion: 'Av. Alemania 600',
  prioridad: 'CRITICA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-17T10:00:00Z',
  actualizadoEn: '2026-11-17T10:05:00Z',
  datosAdicionales: {
    reportesTerreno: [{
      id: 'e0000000-0000-4000-8000-000000000001',
      versionReporte: 1,
      prioridadSugerida: 'ALTA',
      prioridadAsignada: 'CRITICA',
      justificacionPrioridad: 'Riesgo electrico activo sobre acceso',
      personasAfectadas: 4,
      observaciones: 'Adulto mayor en segundo piso',
      detallesEvaluacion: {
        familias: [{
          id: 'fam-1',
          referencia: 'Casa 1',
          nucleoFamiliarTotal: 4,
          cantidadNinos: 1,
          cantidadAdultosMayores: 2,
          personasDiscapacitadas: 1,
          personasElectrodependientes: 1,
          mascotasAfectadas: 2,
          nivelCompromisoVivienda: 'GRAVE_INHABITABLE',
          requiereAsistenciaSocial: true
        }],
        nucleoFamiliarTotal: 4,
        cantidadNinos: 1,
        cantidadAdultosMayores: 2,
        personasDiscapacitadas: 1,
        personasElectrodependientes: 1,
        mascotasAfectadas: 2,
        viviendasAfectadas: 2,
        nivelCompromisoVivienda: 'GRAVE_INHABITABLE',
        riesgosActivos: { riesgoElectrico: true, riesgoEstructural: true, riesgoQuimicoSanitario: false, aislamientoVial: true },
        requiereEvacuacion: true,
        requiereAsistenciaSocial: true
      }
    }]
  }
};
console.log('3) Hidratado desde reportesTerreno API:', JSON.stringify(obtenerReportesPrioridadMision(misionConReporteApi as never)[0]?.evaluacion, null, 2));
"
```

Salida observada en Re-Test (`18/11/2026`):

```text
1) Local riesgoEstructural=true: {
  prioridadSugerida: 'MEDIA',
  factoresGatillantes: [ 'Riesgo estructural / peligro de colapso activo (+25 pts)' ]
}
2) Tras decrementar electrodependiente de 1 a 0: { personasElectrodependientes: 0, prioridadSugerida: 'BAJA' }
3) Hidratado desde reportesTerreno API: {
  "familias": [
    {
      "id": "fam-1",
      "referencia": "Casa 1",
      "nucleoFamiliarTotal": 4,
      "cantidadNinos": 1,
      "cantidadAdultosMayores": 2,
      "personasDiscapacitadas": 1,
      "personasElectrodependientes": 1,
      "mascotasAfectadas": 2,
      "nivelCompromisoVivienda": "GRAVE_INHABITABLE",
      "requiereAsistenciaSocial": true
    }
  ],
  "nucleoFamiliarTotal": 4,
  "cantidadNinos": 1,
  "cantidadAdultosMayores": 2,
  "personasDiscapacitadas": 1,
  "personasElectrodependientes": 1,
  "mascotasAfectadas": 2,
  "viviendasAfectadas": 2,
  "nivelCompromisoVivienda": "GRAVE_INHABITABLE",
  "riesgoElectrico": true,
  "riesgoEstructural": true,
  "riesgoQuimicoSanitario": false,
  "aislamientoVial": true,
  "requiereEvacuacion": true,
  "requiereAsistenciaSocial": true,
  "requiereApoyoAdicional": false,
  "detallesAdicionales": "Adulto mayor en segundo piso"
}
```

### 5.4 Evidencia cURL en vivo (`sgrai-api` en `:3001` y `sgrai-pwa` en `:3002`)

```bash
LOGIN_PAT=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"pedro.patrulla@valdivia.cl","password":"Valdivia2026!"}')
TOKEN_PAT=$(echo "$LOGIN_PAT" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data?.token || '')")

LOGIN_CC=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}')
TOKEN_CC=$(echo "$LOGIN_CC" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data?.token || '')")

# 1. Sin Bearer -> 401
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH \
  http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"ALTA"}'

# 2. CALL_CENTER sin permiso misiones:terreno:verificar -> 403
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH \
  http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_CC" \
  -d '{"prioridad":"ALTA","prioridadSugerida":"ALTA"}'

# 3. Discrepancia con justificación < 5 chars ("abc") -> 400
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH \
  http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_PAT" \
  -d '{"prioridad":"CRITICA","prioridadSugerida":"MEDIA","justificacionPrioridad":"abc"}'

# 4. Perímetro PWA (:3002)
curl -s -i http://localhost:3002/terreno/patrulla/misiones | head -n 6
curl -s -o /dev/null -w "LOGIN_HTTP_STATUS:%{http_code}\n" http://localhost:3002/terreno/login
```

Salidas observadas en Re-Test (`18/11/2026 02:35`):
- `PATCH` sin token: `{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}` (`HTTP_STATUS:401`).
- `PATCH` con `callcenter@valdivia.cl`: `{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}` (`HTTP_STATUS:403`).
- `PATCH` con `pedro.patrulla@valdivia.cl` y `justificacionPrioridad: "abc"`: `HTTP_STATUS:400` con error de validación sobre `justificacion_prioridad`.
- `GET http://localhost:3002/terreno/patrulla/misiones`: `HTTP/1.1 307 Temporary Redirect` (`location: /terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones`) y `/terreno/login` devuelve `LOGIN_HTTP_STATUS:200`.
- En el contenedor local `grupo1_postgres` sin migración `053` aplicada, `POST /api/incidentes/.../prioridad/calcular` retornó `HTTP_STATUS:500` (`column "prioridad_sugerida" does not exist`); la paridad exacta `MEDIA` / `+25 pts` fue verificada tanto en la ejecución de `17/11/2026` como mediante `tsx` e inspección del módulo homologado en `sgrai-api`.

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación / Regla (HU-38) | Responsabilidad Arquitectónica | Cobertura / Hallazgo en `sgrai-pwa` | Estado en Re-Test | Referencia |
|---|---|---|---|---|
| **CA-1:** Mostrar de forma visible `prioridad_sugerida` preliminar | `sgrai-pwa` + `sgrai-api` | Desplegada en `EvaluacionPrioridadCard`; algoritmo local homologado 1:1 con `sgrai-api`, decremento corregido y llamadas remotas con *debounce* de `350 ms`. Resta actualizar tabla §3 del manual H38 | **Aprobado con observación (Manual §3)** | `CP-H38-PWA-01`, `CP-H38-PWA-03`, `BUG-H38-PWA-03`, `BUG-H38-PWA-05`, `BUG-H38-PWA-07` |
| **CA-2:** Selector con los 4 niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) | `sgrai-pwa` | Selector táctil `radiogroup` implementado con los 4 niveles canónicos, esquinas rectas `0px`, alto contraste y ergonomía `>= 48px` en todos los controles | **Aprobado** | `CP-H38-PWA-02`, `CP-H38-PWA-06`, `BUG-H38-PWA-06` |
| **CA-3:** Campo obligatorio `justificacion_prioridad` (`>= 5` chars) al modificar sugerida | `sgrai-pwa` + `sgrai-api` | Despliegue condicional operativo; formulario montado de forma continua en `<SeccionDesplegable>`; `maxLength={100}` aplicado en `referencia`. Pendiente aserción automática real de preservación al colapsar | **Aprobado con observación (Test)** | `CP-H38-PWA-02`, `CP-H38-PWA-04`, `CP-H38-PWA-11`, `BUG-H38-PWA-07` |
| **CA-4:** Actualización transaccional de `incidente.prioridad`, `justificacion_prioridad` y `mision_hito` | `sgrai-api` (transacción) + `sgrai-pwa` (contrato/offline) | Cliente migrado a `apiClient` desde OpenAPI, incluye `familias`, lee `reporteTerreno`, hidrata `detallesEvaluacion` y reconcilia `AJUSTAR_PRIORIDAD` en `useConnectivity` | **Aprobado** *(pendiente manejo de `409` en `BUG-H38-PWA-07`)* | `CP-H38-PWA-07`, `CP-H38-PWA-08`, `CP-H38-PWA-10`, `BUG-H38-PWA-02`, `BUG-H38-PWA-04` |
| **CA-5:** Emisión WebSocket `incidente:actualizado` al Centro de Mando (badge Kanban) | `sgrai-api` + `sgrai-web` | Implementado en `sgrai-api` (`prioridad.service.ts`) y consumido en `sgrai-web` (`useEncargadoKanbanSocket.ts`). Fuera del cliente `sgrai-pwa` | **Verificado (externo a PWA)** | `CP-H38-PWA-09` |
| **CA-6:** Requerir permiso RBAC `misiones:terreno:verificar` | `sgrai-api` + `sgrai-pwa` | `DEV_PATRULLA_TOKEN` y fallback implícito eliminados; `<EvaluacionPrioridadCard />` deshabilitado sin `misiones:terreno:verificar`; falla ejecución aislada del test RBAC por falta de mock en `beforeEach` | **Aprobado con observación (Test aislado)** | `BUG-H38-PWA-01`, `BUG-H38-PWA-07`, `CP-H38-PWA-11` |
| **Estándares `AGENTS.md` / `GEMINI.md` (OpenAPI, Ergonomía, Tokens, Manual, Pruebas)** | `sgrai-pwa` | Cumple OpenAPI, `apiClient`, `--webpack`, `min-height: 48px`, `--border-color-neutral`, `0` emojis; falla `npm test -- -t "EvaluacionPrioridadCard"`, desfase en manual §3 y `2` warnings lint | **Rechazado (Re-Test)** | `BUG-H38-PWA-07`, `CP-H38-PWA-12` |

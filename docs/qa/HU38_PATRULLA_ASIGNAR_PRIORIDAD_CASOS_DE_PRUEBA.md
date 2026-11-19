# Auditoría Técnica y Matriz de Casos de Prueba — HU-[38]: Asignar o Modificar Prioridad del Incidente (Cliente Terreno `sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `feature/h38-patrulla-asignar-prioridad` (solicitud de integración hacia `develop`)  
**Historia de Usuario:** HU-[38] — Asignar o modificar la prioridad del incidente en terreno (Patrulla Verificadora)  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `17/11/2026 14:26 -03:00`  
**Fecha y Hora de Re-Test:** `18/11/2026 18:16 -03:00` *(Primer Re-Test ejecutado el `18/11/2026 02:38 -03:00`; segundo Re-Test de cierre ejecutado el `18/11/2026 18:16 -03:00`)*  
**Entorno de Ejecución:** Linux, Node.js `v26.13.1`, Vitest `v3.2.7`, Next.js `16.3.4` (Webpack), TypeScript (`tsc --noEmit`), ESLint, `sgrai-api` (`http://localhost:3001`), PostgreSQL/PostGIS (`5001`), Redis (`6001`)  
**Dictamen de Auditoría (Re-Test Final):** **APROBADO (`7` de `7` defectos corregidos y verificados; `0` defectos abiertos; `19/19` casos de la matriz en estado `APROBADO`)**

---

## Alcance Arquitectónico en `sgrai-pwa`

De acuerdo con la separación de responsabilidades de SGRAI, este repositorio cubre exclusivamente la interfaz móvil de terreno para **Patrulla Verificadora** y **Delegado de Cuadrilla**:

- **Alcance en `sgrai-pwa`:** Cálculo preliminar y despliegue de `prioridadSugerida` con factores gatillantes (homologado al sistema de puntaje acumulativo de `sgrai-api`), captura estructurada multi-familia de afectación y peligros activos, selector táctil de cuatro niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`), exigencia condicional de `justificacionPrioridad` (`>= 5` caracteres) ante discrepancia, modal de confirmación previa, versionado de reportes (`Reporte #N`) y cola offline en IndexedDB (`AJUSTAR_PRIORIDAD` con reconciliación automática ante éxito o conflicto HTTP `409` en `useConnectivity`).
- **Alcance externo (`sgrai-api` / `sgrai-web`):** La transacción Kysely/PostgreSQL sobre `incidente`, `reporte_terreno` y `mision_hito` reside en `sgrai-api` (`PATCH /api/incidentes/[id]/prioridad` y `POST /api/incidentes/[id]/prioridad/calcular`), y la emisión/renderizado del evento `incidente:actualizado` en el tablero Kanban del Centro de Mando reside en `sgrai-api` y `sgrai-web`.

---

## 1. Resumen Ejecutivo

En el segundo ciclo de **Re-Test (`18/11/2026 18:16 -03:00`)** sobre la rama `feature/h38-patrulla-asignar-prioridad` tras los commits correctivos adicionales aplicados por el equipo de desarrollo (`fix(offline): descartar AJUSTAR_PRIORIDAD ante 409 y limpiar advertencias ESLint`, `test(h38): aislar pruebas de PatrullaPrioridad y cubrir preservación de borrador` y `docs(h38): actualizar matriz de puntaje en manual §3`), se verificó la resolución íntegra de **`BUG-H38-PWA-07`** junto con la continuidad de los **`6` defectos previos (`BUG-H38-PWA-01` a `BUG-H38-PWA-06`)**.

La suite automatizada completa (`44/44` archivos, `211/211` pruebas), las ejecuciones filtradas y aisladas (`-t "EvaluacionPrioridadCard"`, `-t "deshabilita EvaluacionPrioridadCard"`, `-t "preserva el borrador"`), la verificación estricta de tipos (`tsc --noEmit`), el análisis estático (`npm run lint` con `0` errores y `0` advertencias) y el empaquetado de producción (`next build --webpack`) finalizaron con código de salida `0`. No quedan defectos abiertos ni bloqueos técnicos para la integración hacia `develop`.

| Indicador / Verificación | Auditoría Inicial (17/11/2026) | Re-Test 1 (18/11/2026 02:38) | Re-Test Final (18/11/2026 18:16) | Observación Técnica |
|---|---|---|---|---|
| Total de casos en matriz (HU-38 PWA) | `18` (`6` `ABIERTO`, `12` `APROBADO`) | `19` (`1` `ABIERTO`, `18` `APROBADO`) | `19` (`0` `ABIERTO`, `19` `APROBADO`) | `BUG-H38-PWA-01`..`07` y `CP-H38-PWA-01`..`12` verificados en `APROBADO` |
| Defectos abiertos por severidad | `1` Crítica, `3` Alta, `2` Media | `0` Crítica, `0` Alta, `1` Media | `0` Crítica, `0` Alta, `0` Media | `100%` de hallazgos cerrados |
| Suite completa Vitest (`npm test`) | `40` archivos / `175` tests (`14.45s`) | `44` archivos / `209` tests (`8.33s`) | `44` archivos / `211` tests (`12.09s`) | Incorpora aislamiento de mocks, prueba de preservación de borrador y manejo `409` |
| Subconjunto HU-38 y regresión (`npx vitest run`) | `5` archivos / `29` tests (`4.74s`) | `8` archivos / `58` tests (`4.54s`) | `8` archivos / `60` tests (`3.45s`) | Validaciones (`10`), servicio (`8`), tarjeta (`9`), modal (`4`), detalle (`4` + `7`), conectividad (`6`), misiones (`12`) |
| Ejecución filtrada (`npm test -- -t "EvaluacionPrioridadCard"`) | `1` file / `7` passed (`8.16s`) | **FALLIDO** (`exit 1`, `1 failed`) | **APROBADO** (`exit 0`, `2` files / `10 passed`, `9.51s`) | Cubre `EvaluacionPrioridadCard.test.tsx` (`9`) y `PatrullaPrioridad.test.tsx` (`1`) |
| Ejecuciones aisladas `-t "deshabilita EvaluacionPrioridadCard"` y `-t "preserva el borrador"` | N/A | **FALLIDO** (`exit 1`) | **APROBADO** (`exit 0`: `1/211` en `7.89s` y `1/211` en `7.73s`) | Confirmado aislamiento completo por caso en `PatrullaPrioridad.test.tsx` |
| Verificación de tipos (`npx tsc --noEmit`) | `exit 0` (riesgo `TS2305`) | `exit 0` | `exit 0` | Contratos derivados desde `src/types/api-generated.d.ts` regenerado |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `4` warnings | `0` errores, `2` warnings | `0` errores, `0` warnings | Limpieza total de variables no utilizadas en `page.tsx` y `EvaluacionPrioridadCard.tsx` |
| Build de producción (`npm run build`) | `exit 0` (Turbopack, `8/8`) | `exit 0` (Webpack, `8/8`) | `exit 0` (Webpack, `8/8`) | Next.js `16.3.4` (`--webpack`) alineado con `develop` |
| Verificación estática (`rg` en `src/`) y lógica (`tsx`) | `NO_EMOJIS_IN_SRC`; fallas `BUG-02/03/05` | Checks estáticos y `tsx` (`3/3`) aprobados | `NO_EMOJIS_IN_SRC`, `NO_DEMO_BYPASS_IN_SRC`, `NO_COLOR_BORDER_IN_H38_CSS`, `tsx` (`3/3`) | Paridad de cálculo `+25 pts`/`MEDIA`, decremento `BAJA` e hidratación `detallesEvaluacion` |
| Verificación de contrato HTTP en vivo (`:3001`/`:3002`) | `401`, `403`, `400`, `200`, `307` | `:3001` `401`/`403`/`400`; `:3002` `307`/`200` (`18/11 02:35`) | Verificado sin cambios de API/rutas desde `18/11 02:35` | Paridad con algoritmo remoto confirmada mediante `tsx` y contratos OpenAPI |

---

## 2. Registro Técnico de Defectos

### BUG-H38-PWA-07 — Falla en ejecución filtrada/aislada de `PatrullaPrioridad.test.tsx`, prueba incompleta de preservación al colapsar, desfase de matriz en manual H38 y observaciones de `409`/ESLint
- **Severidad:** Media (Confiabilidad de suite de pruebas / Documentación operativa / Calidad estática)
- **Estado:** **CORREGIDO** *(Detectado en Re-Test `18/11/2026 02:38`; verificado resuelto en Re-Test `18/11/2026 18:16`)*
- **Archivos verificados:**
  - `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx` (líneas `107–109`, `242–352`)
  - `docs/manuals/H38-patrulla-asignar-prioridad.md` (líneas `25–50`)
  - `src/hooks/useConnectivity.ts` (líneas `71–87`, `120–169`) y `src/hooks/__tests__/useConnectivity.test.ts` (líneas `130–190`)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` y `src/components/misiones/EvaluacionPrioridadCard.tsx` (líneas `273–283`)
- **Resolución verificada en Re-Test:**
  1. **Independencia de `PatrullaPrioridad.test.tsx` y cobertura de colapsado:** `beforeEach` (líneas `107–109`) inicializa el retorno por defecto de `vi.mocked(misionesService.obtenerDetalleMision)`. El tercer test (`242–297`) retira la referencia a `mock.results[0]` e incluye el mock completo de `useAuth` (con `actualizarUnidadAsignada`), verificando deshabilitación de botón, textbox y switch sin `misiones:terreno:verificar`. Se agregó el cuarto caso (`299–352`), que modifica referencia e interruptor de peligro, colapsa y reabre `<details>` y comprueba preservación exacta del borrador. Aprobado tanto en suite completa como en ejecuciones filtradas (`-t "EvaluacionPrioridadCard"`, `-t "deshabilita EvaluacionPrioridadCard"`, `-t "preserva el borrador"`).
  2. **Alineación del manual H38 §3:** `docs/manuals/H38-patrulla-asignar-prioridad.md` (líneas `25–50`) fue actualizado con la tabla exacta de puntajes por factor (`+50` disparo directo, `+35` disparo condicional, `+45/+22/+8`, peligros `+25/+20/+15/+15`) y umbrales (`>= 60 CRITICA`, `35–59 ALTA`, `15–34 MEDIA`, `< 15 BAJA`), coincidiendo 1:1 con `calcularPrioridadSugerida` (`src/lib/validations/prioridad.ts`).
  3. **Manejo de conflicto `409` y limpieza ESLint:** `src/hooks/useConnectivity.ts` (`84–86`) marca `esConflictoTerminal = true` para mutaciones distintas de `ACEPTAR_MISION` ante HTTP `409`, descartando `AJUSTAR_PRIORIDAD` del `outbox` y limpiando `sincronizacionPendiente: false` (cubierto en `useConnectivity.test.ts`, `6/6`). Se eliminaron `prioridadClase` (`page.tsx`) y `_ref` (`EvaluacionPrioridadCard.tsx`), logrando `0` errores y `0` advertencias en `npm run lint`.

---

### BUG-H38-PWA-01 — Bypass de autenticación/RBAC con `DEV_PATRULLA_TOKEN`, ausencia de control por permiso en detalle de misión y colisión de integración con `develop`
- **Severidad:** Crítica (Seguridad / RBAC / Bloqueante de integración)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — `18/11/2026`)*
- **Resolución verificada en Re-Test:** Eliminación completa de `DEV_PATRULLA_TOKEN`, `DEV_PATRULLA_USER_ID`, `PERFIL_DEMO_PATRULLA`, `handleAccesoRapidoPatrulla` y fallback implícito en `AuthContext.tsx` (`NO_DEMO_BYPASS_IN_SRC`). Merge limpio con `develop` manteniendo `--webpack` en `package.json`, y paso de `deshabilitado={!tienePermisoVerificar}` en `page.tsx` hacia `<EvaluacionPrioridadCard />`, verificado con prueba unitaria aislada.

---

### BUG-H38-PWA-02 — Desincronización con OpenAPI (`api-generated.d.ts`), incumplimiento de `openapi-fetch`, pérdida de ID/versión del backend y ruptura al hidratar `reportesTerreno`
- **Severidad:** Alta (Contrato API / Integridad de datos)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — `18/11/2026`)*
- **Resolución verificada en Re-Test:** `src/types/api-generated.d.ts` regenerado con `/api/incidentes/{id}/prioridad/calcular`, `/api/incidentes/{id}/prioridad`, `detallesEvaluacion` y `ReporteEvaluacionTerrenoItem`; `src/types/offline.ts` deriva `CalcularPrioridadPayload` y `AsignarPrioridadPayload` desde `paths`. `src/services/prioridadService.ts` consume `apiClient.POST` / `apiClient.PATCH`, captura `data.data?.reporteTerreno?.id` y `versionReporte`, incluye `familias: validado.familias`, e hidrata todos los campos desde `r.detallesEvaluacion` y `detalle.riesgosActivos` (verificado en `npx tsx`).

---

### BUG-H38-PWA-03 — Corrupción de contadores al decrementar en familia única, desincronización de compromiso habitacional multi-familia y pérdida de estado al colapsar sección
- **Severidad:** Alta (Lógica funcional / Integridad de formulario)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — `18/11/2026`)*
- **Resolución verificada en Re-Test:** `consolidarEvaluacionFamilias` (`src/lib/validations/prioridad.ts`) toma `familias` como fuente de verdad sin sobrescritura heredada (confirmado en `tsx`: decremento `1 -> 0` de electrodependientes actualiza a `BAJA`). `EvaluacionPrioridadCard.tsx` consolida el compromiso máximo multi-familia en `cambiarCompromisoFamilia`, y `PatrullaPrioridad.test.tsx` (`299–352`) comprueba preservación de borrador al colapsar y reabrir el acordeón `<details>`.

---

### BUG-H38-PWA-04 — Reconciliación offline faltante para `AJUSTAR_PRIORIDAD` en `useConnectivity`, sombreado de caché en `misionesService` y mensaje erróneo de aceptación pendiente
- **Severidad:** Alta (Resiliencia Offline-First / Consistencia de UI)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — `18/11/2026`)*
- **Resolución verificada en Re-Test:** `src/hooks/useConnectivity.ts` reconcilia `AJUSTAR_PRIORIDAD` ante éxito, error irrecuperable y conflicto `409`; `src/services/misionesService.ts` limpia `reportesPrioridad` cuando el backend entrega `reportesTerreno`; y `page.tsx` generaliza el mensaje del banner de sincronización pendiente (`useConnectivity.test.ts` `6/6` y `misionesService.test.ts` `12/12`).

---

### BUG-H38-PWA-05 — Divergencia entre el algoritmo de cálculo local vs `sgrai-api` y disparo sin *debounce* de `POST /prioridad/calcular`
- **Severidad:** Media (Consistencia de negocio / Rendimiento)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — `18/11/2026`)*
- **Resolución verificada en Re-Test:** `calcularPrioridadSugerida` (`src/lib/validations/prioridad.ts`) homologado 1:1 con el motor acumulativo de `sgrai-api` (confirmado en `tsx`: `riesgoEstructural: true` = `MEDIA` `+25 pts`); `EvaluacionPrioridadCard.tsx` aplica *debounce* de `350 ms` sobre `claveCalculo` excluyendo `detallesAdicionales` y `referencia`.

---

### BUG-H38-PWA-06 — Ergonomía táctil `< 48px` en controles de familia, falta de `maxLength` en referencia, token `--color-border` inexistente, desfase en manual H38 y brechas de cobertura
- **Severidad:** Media (UI/UX Terreno / Documentación / Cobertura QA)
- **Estado:** **CORREGIDO** *(Verificado en Re-Test — `18/11/2026`)*
- **Resolución verificada en Re-Test:** `EvaluacionPrioridadCard.module.css` aplica `min-height: 48px` en controles de familia y `var(--border-color-neutral, #DFE3E8)` (`NO_COLOR_BORDER_IN_H38_CSS`); `EvaluacionPrioridadCard.tsx` establece `maxLength={100}`; `docs/api/contratos-terreno.md` y `docs/manuals/H38-patrulla-asignar-prioridad.md` están corregidos; suites de regresión completas y aprobadas.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-H38-PWA-01 | Bypass de auth/RBAC con `DEV_PATRULLA_TOKEN`, ausencia de control `misiones:terreno:verificar` en formulario y colisión con `develop` | Seguridad / Integración | Sistema / Componentes | Crítica | Rama actualizada con `develop` (`merge`) y revisión de `prioridadService.ts`, `AuthContext.tsx` y `page.tsx` | `rg` sobre símbolos demo en `src/`, `package.json`, `npm test -- -t "deshabilita EvaluacionPrioridadCard"` | Sin bypass demo ni fallback implícito; rechazo estricto de `401`/`403`; formulario bloqueado sin permiso; `--webpack` preservado | Verificado en Re-Test Final: `NO_DEMO_BYPASS_IN_SRC`, `package.json` con `--webpack`, prueba aislada RBAC aprobada (`exit 0`, `7.89s`), `build` limpio | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | fix(prioridad): eliminar bypass demo, migrar a apiClient y corregir hidratación |
| BUG-H38-PWA-02 | Contrato OpenAPI `api-generated.d.ts`, uso de `apiClient`, lectura de `data.reporteTerreno` y extracción de `detallesEvaluacion` | Contrato / Integración | Integración | Alta | `src/types/api-generated.d.ts` regenerado y `src/services/prioridadService.ts` migrado a `openapi-fetch` | Inspección de `paths` en `api-generated.d.ts` y ejecución `tsx` de `obtenerReportesPrioridadMision` con `detallesEvaluacion` y `riesgosActivos` | Endpoints H38 tipados desde OpenAPI; uso de `apiClient`; lectura de `reporteTerreno`; envío de `familias`; hidratación fiel de `detallesEvaluacion` | Verificado en Re-Test Final: tipos derivados en `offline.ts`, `apiClient.POST/PATCH` activos y `tsx` hidrata íntegramente `familias`, contadores, riesgos y `GRAVE_INHABITABLE` | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | chore(api): regenerar tipos OpenAPI con endpoints de prioridad y derivar contratos |
| BUG-H38-PWA-03 | Decremento de contadores en familia única, consolidación habitacional multi-familia y preservación de estado al colapsar acordeón | Funcional / Lógica | Unitaria / Componentes | Alta | `consolidarEvaluacionFamilias` (`prioridad.ts`), `EvaluacionPrioridadCard.tsx` y `PatrullaPrioridad.test.tsx` | `tsx` con decremento `1 -> 0` en familia única; `EvaluacionPrioridadCard.test.tsx` (`2` familias); `npm test -- -t "preserva el borrador"` | Contadores y `prioridadSugerida` retornan a `0`/`BAJA`; compromiso consolida en `2+` familias; borrador preservado al colapsar/reabrir | Verificado en Re-Test Final: `tsx` devuelve `0`/`BAJA`, `EvaluacionPrioridadCard.test.tsx` (`9/9`) aprueba consolidación y `preserva el borrador` aprueba aislado (`exit 0`, `7.73s`) | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | fix(terreno): homologar cálculo de prioridad, consolidación multi-familia, RBAC y ergonomía; test(h38): aislar pruebas de PatrullaPrioridad y cubrir preservación de borrador |
| BUG-H38-PWA-04 | Sincronización outbox de `AJUSTAR_PRIORIDAD` en `useConnectivity`, sombreado por `reportesPrioridad` y banner de estado pendiente | Resiliencia / Offline | Integración / Componentes | Alta | Misión `EN_CURSO` con mutación `AJUSTAR_PRIORIDAD` en `outbox` ante `200` y `409`, más refresco desde API | `useConnectivity.test.ts` (`6` tests incluyendo `409`), `misionesService.test.ts` (`12` tests) y banner en `page.tsx` | `useConnectivity` reconcilia `MisionLocal` ante `200`/`409`; `obtenerDetalleMision` evita sombreado; banner generalizado por mutación | Verificado en Re-Test Final: `useConnectivity.test.ts` (`6/6` en `132ms`) y `misionesService.test.ts` (`12/12` en `20ms`) aprueban reconciliación completa | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados; fix(offline): descartar AJUSTAR_PRIORIDAD ante 409 y limpiar advertencias ESLint |
| BUG-H38-PWA-05 | Consistencia algorítmica online/offline de `prioridadSugerida` y *debounce* en llamadas a `POST /prioridad/calcular` | Funcional / Rendimiento | Integración / Componentes | Media | `calcularPrioridadSugerida` homologado con `sgrai-api` y `EvaluacionPrioridadCard.tsx` con *debounce* `350 ms` | `tsx` con `riesgoEstructural: true` (`25 pts`) y prueba de escritura en `detallesAdicionales` en `EvaluacionPrioridadCard.test.tsx` | Cliente offline y backend online calculan `MEDIA` (`+25 pts`); sin llamadas HTTP ante cambios de texto libre; *debounce* activo (`350 ms`) | Verificado en Re-Test Final: `tsx` devuelve `MEDIA` (`+25 pts`) y `EvaluacionPrioridadCard.test.tsx` (`9/9`) valida debounce sin disparo por texto libre | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | fix(terreno): homologar cálculo de prioridad, consolidación multi-familia, RBAC y ergonomía |
| BUG-H38-PWA-06 | Ergonomía táctil `>= 48px`, `maxLength` en referencia, token CSS `--border-color-neutral`, limpieza de rutas en docs y cobertura | UI / UX / Documentación | Componentes / Estática | Media | Revisión CSS/TSX de `EvaluacionPrioridadCard`, `docs/api/contratos-terreno.md`, manual H38 y suites | `rg -- '--color-border'`, `min-height: 48px` en controles de familia, `maxLength={100}`, `contratos-terreno.md:5`, retiro de opción eliminada | Controles `>= 48px`, `maxLength={100}`, token `--border-color-neutral`, sin rutas absolutas ni opciones eliminadas, suites ampliadas | Verificado en Re-Test Final: `NO_COLOR_BORDER_IN_H38_CSS`, `48px` y `maxLength={100}` activos, `contratos-terreno.md:5` limpio y `60/60` pruebas específicas en verde | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | docs(h38): actualizar manual H38 y limpiar ruta absoluta en contratos-terreno |
| BUG-H38-PWA-07 | Aislamiento de mocks y cobertura de colapsar en `PatrullaPrioridad.test.tsx`, matriz §3 de manual H38, `409` en `AJUSTAR_PRIORIDAD` y advertencias lint | Regresión / Documentación / Estática | Componentes / Estática | Media | Rama `feature/h38-patrulla-asignar-prioridad` con últimos commits correctivos (`761fe0b`, `85bd37c`, `fb7b25c`) | `npm test -- -t "EvaluacionPrioridadCard"`, `-t "deshabilita EvaluacionPrioridadCard"`, `-t "preserva el borrador"`, `npm run lint`, `docs/manuals/H38-patrulla-asignar-prioridad.md` §3 | Pruebas filtradas/aisladas aprueban (`exit 0`) con verificación de colapso; `0` advertencias ESLint; manual H38 §3 alineado a puntaje acumulativo; `409` terminal en `AJUSTAR_PRIORIDAD` | Verificado en Re-Test Final: pruebas filtradas `-t` aprueban (`exit 0`: `10/10`, `1/1`, `1/1`), `useConnectivity.test.ts` cubre `409`, `H38 §3` coincide 1:1 con `prioridad.ts` y `npm run lint` arroja `0` errores / `0` advertencias | APROBADO | 18/11/2026 02:38 | 18/11/2026 18:16 | test(h38): aislar pruebas de PatrullaPrioridad y cubrir preservación de borrador; docs(h38): actualizar matriz de puntaje en manual §3; fix(offline): descartar AJUSTAR_PRIORIDAD ante 409 y limpiar advertencias ESLint |
| CP-H38-PWA-01 | Despliegue visible de `prioridadSugerida` y actualización reactiva ante factores críticos | Funcional / UI | Componentes | Alta | `EvaluacionPrioridadCard` montado en jsdom con misión `EN_CURSO` | Carga inicial sin factores (`BAJA`) e incremento de `nucleoFamiliarTotal=1` + `personasElectrodependientes=1` | Muestra `badge-prioridad-sugerida` inicialmente en `Baja` y recalcula inmediatamente a `Crítica` | `EvaluacionPrioridadCard.test.tsx` aprueba transición reactiva en Re-Test Final (`9/9` en `1179ms`) | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | feat(patrulla): integrar formulario de evaluacion en terreno y prioridad en reportes tecnicos (H38) |
| CP-H38-PWA-02 | Selector de cuatro niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) y campo obligatorio de justificación ante discrepancia | Funcional / Validación | Unitaria / Componentes | Alta | Formulario en `EvaluacionPrioridadCard` y esquema `asignarPrioridadSchema` | Selección manual `ALTA` sobre sugerencia `BAJA`, entrada de `abc` (`< 5` chars) vs justificación válida (`>= 5` chars) | Oculta justificación al coincidir; despliega textarea obligatorio al discrepar; bloquea envío si `< 5` chars y habilita con `>= 5` chars | `prioridad.test.ts` (`10/10` en `26ms`) y `EvaluacionPrioridadCard.test.tsx` (`9/9`) aprueban bloqueo y validación | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38) |
| CP-H38-PWA-03 | Reglas locales acumulativas de cálculo de prioridad (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) y exclusión de `requiereApoyoAdicional` | Funcional / Unitaria | Unitaria | Media | Función pura `calcularPrioridadSugerida` homologada en `src/lib/validations/prioridad.ts` | Escenarios `< 15 pts` (`BAJA`), `>= 15` (`MEDIA`), `>= 35` (`ALTA`), `>= 60` (`CRITICA`) con suma de factores vulnerables y habitacionales | Retorna prioridad y `factoresGatillantes` con puntajes homogéneos a `sgrai-api` sin considerar `requiereApoyoAdicional` | `prioridad.test.ts` aprueba `10/10` pruebas del motor acumulativo homologado en `26ms` | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA |
| CP-H38-PWA-04 | Prevención de registro de integrantes sobre el tamaño del núcleo familiar y libertad en conteo de mascotas | Funcional / Validación | Unitaria / Componentes | Media | `familiaAfectadaSchema` y contadores táctiles de `EvaluacionPrioridadCard` | `nucleoFamiliarTotal=0` y `2`, luego `1 niño + 1 adulto mayor` (`2/2`) e incremento de `mascotasAfectadas` a `3` y `maxLength=100` en `referencia` | Deshabilita botones `+` de integrantes al alcanzar cupo del núcleo familiar y `-` del núcleo si existen integrantes; permite mascotas y limita referencia | `prioridad.test.ts` (`10/10`) y `EvaluacionPrioridadCard.test.tsx` (`9/9`) validan bloqueos de cupo, mascotas y límite | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | feat(patrulla): prevenir registro de integrantes sobre el tamano del nucleo familiar (H38) |
| CP-H38-PWA-05 | Registro, consolidación de daño máximo y eliminación dinámica de múltiples familias afectadas | Funcional / UI | Componentes | Media | `EvaluacionPrioridadCard` montado con `1 Hogar / Vivienda` inicial | Clic en `Añadir otra familia afectada`, selección de `GRAVE_INHABITABLE` en Familia #2 y eliminación de `Familia #2` | Agrega `Familia #2` (`2 Hogares / Viviendas`), recalcula compromiso máximo y restaura `1 Hogar / Vivienda` al eliminar | `EvaluacionPrioridadCard.test.tsx` (`9/9` en `1179ms`) valida flujo multi-familia y consolidación | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | fix(patrulla): definir actuales al agregar familia y reconsolidar al eliminar (H38) |
| CP-H38-PWA-06 | Modal `ModalConfirmacionPrioridad` con comparativa Sugerida vs Final, justificación técnica, versión de reporte y cierre accesible | UI / Accesibilidad | Componentes | Media | `ModalConfirmacionPrioridad` montado en jsdom | Props `versionReporte=1` (ratificación), `versionReporte=2` (`MEDIA` -> `CRITICA` con justificación), clic en `Cancelar`, tecla `Escape` y `Confirmar y Enviar` | Muestra `Reporte #1` / `Reporte #2`, chips comparativos, justificación y dispara callbacks en botón, `Escape` y confirmación | `ModalConfirmacionPrioridad.test.tsx` aprueba `4/4` casos en `227ms` | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | refactor(ui): estandarizar modales de confirmacion con ConfirmModal, ConfirmacionResumen y Chip |
| CP-H38-PWA-07 | Envío online de prioridad vía `apiClient`, inclusión de `familias`, versionado correlativo (`Reporte #2`) y propagación de `403` | Funcional / Servicio | Unitaria | Alta | `prioridadService.ts` con `navigator.onLine=true` y `apiClient` mockeado en Vitest | Respuestas mock `200 OK` con `reporteTerreno`, inclusión de `familias`, incremento `Reporte #2`, rechazo `403 Forbidden` sin token demo | Retorna `ok:true`, captura `reporteTerreno.id` y `versionReporte`, incluye `familias` y propaga error `403` | `prioridadService.test.ts` aprueba `8/8` pruebas en `31ms` | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA |
| CP-H38-PWA-08 | Encolado en IndexedDB (`AJUSTAR_PRIORIDAD`), actualización optimista offline y reconciliación al reconectar (`200` y `409`) | Funcional / Offline | Unitaria | Alta | `prioridadService.ts` (`offline`) y `useConnectivity.ts` al recuperar red (`online`) | `prioridadSugerida='BAJA'`, `prioridad='ALTA'`, justificación `>= 5` chars; disparo de sincronización `AJUSTAR_PRIORIDAD` con `200` y `409` | Encola acción `AJUSTAR_PRIORIDAD` en outbox y reconcilia `sincronizacionPendiente=false` ante `200` (`sincronizado=true`) o `409` | `prioridadService.test.ts` (`8/8`) y `useConnectivity.test.ts` (`6/6` en `132ms`) aprueban en Re-Test Final | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | fix(offline): descartar AJUSTAR_PRIORIDAD ante 409 y limpiar advertencias ESLint |
| CP-H38-PWA-09 | Integración en `PatrullaMisionDetailPage`: despliegue, confirmación modal, colapsado `Completado (#2)`, RBAC y preservación de borrador | Funcional / Integración | Componentes | Alta | `PatrullaMisionDetailPage` con misión `EN_CURSO` y mocks autónomos por caso en `beforeEach` | Activación de riesgo + `GRAVE_INHABITABLE`, `versionReportePrioridad=2`, usuario sin `misiones:terreno:verificar` y colapsar/reabrir `<details>` | Actualiza a `Completado (#1)`, colapsa acordeones evaluados (`Completado (#2)`), deshabilita sin permiso y preserva borrador | `PatrullaPrioridad.test.tsx` (`4/4` en `929ms`) y `PatrullaDetailPage.test.tsx` (`7/7` en `719ms`) aprueban en conjunto y aislados | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | test(h38): aislar pruebas de PatrullaPrioridad y cubrir preservación de borrador |
| CP-H38-PWA-10 | Sincronización de `evaluaciones`, `reportesTerreno` y limpieza de `reportesPrioridad` en `obtenerDetalleMision` | Integración / Servicio | Unitaria | Media | `misionesService.ts` con `apiClient.GET` y `offlineQueue` mockeados | Respuesta mock `GET /api/misiones/mis-7700` con `reportesTerreno` remotos y `reportesPrioridad` previos en IndexedDB | Persiste `prioridadEvaluada: true`, `versionReportePrioridad: 1` y limpia `reportesPrioridad` obsoleto ante datos del servidor | `misionesService.test.ts` aprueba `12/12` pruebas en `20ms` | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados |
| CP-H38-PWA-11 | Validación en vivo de contrato HTTP (`401`, `403`, `400`) en `sgrai-api` (`:3001`) y protección de ruta `307` en `sgrai-pwa` (`:3002`) | Integración / Seguridad | Sistema | Alta | Servicios locales en `http://localhost:3001` y `http://localhost:3002` con PostgreSQL (`5001`) y Redis (`6001`) | `POST /api/seguridad/login`, `PATCH /api/incidentes/{id}/prioridad` sin token / con `CALL_CENTER` / sin justificación `>= 5` chars, `GET :3002/terreno/patrulla/misiones` | API responde `401` sin Bearer, `403` sin `misiones:terreno:verificar`, `400` ante discrepancia con `abc`; PWA redirige `307` | Verificado sin cambios de API/rutas posteriores: `401`, `403`, `400` (`justificacion_prioridad`) y `307` -> `/terreno/login` (`200`) | APROBADO | 17/11/2026 14:26 | 18/11/2026 02:35 | docs(patrulla): agregar manual de usuario H38 y documentar contrato de prioridad en terreno |
| CP-H38-PWA-12 | Ejecución integral Vitest (completa y filtrada `-t`), `tsc --noEmit`, ESLint, `npm run build` (`--webpack`) y estática en `src/` | Regresión / Calidad Estática | Sistema / Estática | Alta | Repositorio `web-app` limpio en rama `feature/h38-patrulla-asignar-prioridad` | `npm test`, `npm test -- -t`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `rg` sobre `src/` | `44/44` suites en verde, `-t` exit `0`, `0` errores TS, `0` errores y `0` warnings ESLint, build `--webpack` exitoso y `0` emojis/tokens demo | `44/44` suites (`211/211` tests en `12.09s`), `-t` en verde, `tsc` exit `0`, ESLint `0` errores (`0` warnings), `next build --webpack` (`8/8`), `NO_EMOJIS_IN_SRC` | APROBADO | 17/11/2026 14:26 | 18/11/2026 18:16 | fix(offline): descartar AJUSTAR_PRIORIDAD ante 409 y limpiar advertencias ESLint |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H38-PWA-01	Bypass de auth/RBAC con DEV_PATRULLA_TOKEN, ausencia de control misiones:terreno:verificar en formulario y colisión con develop	Seguridad / Integración	Sistema / Componentes	Crítica	Rama actualizada con develop (merge) y revisión de prioridadService.ts, AuthContext.tsx y page.tsx	rg sobre símbolos demo en src/, package.json, npm test -- -t "deshabilita EvaluacionPrioridadCard"	Sin bypass demo ni fallback implícito; rechazo estricto de 401/403; formulario bloqueado sin permiso; --webpack preservado	Verificado en Re-Test Final: NO_DEMO_BYPASS_IN_SRC, package.json con --webpack, prueba aislada RBAC aprobada (exit 0, 7.89s), build limpio	APROBADO	17/11/2026 14:26	18/11/2026 18:16	fix(prioridad): eliminar bypass demo, migrar a apiClient y corregir hidratación
BUG-H38-PWA-02	Contrato OpenAPI api-generated.d.ts, uso de apiClient, lectura de data.reporteTerreno y extracción de detallesEvaluacion	Contrato / Integración	Integración	Alta	src/types/api-generated.d.ts regenerado y src/services/prioridadService.ts migrado a openapi-fetch	Inspección de paths en api-generated.d.ts y ejecución tsx de obtenerReportesPrioridadMision con detallesEvaluacion y riesgosActivos	Endpoints H38 tipados desde OpenAPI; uso de apiClient; lectura de reporteTerreno; envío de familias; hidratación fiel de detallesEvaluacion	Verificado en Re-Test Final: tipos derivados en offline.ts, apiClient.POST/PATCH activos y tsx hidrata íntegramente familias, contadores, riesgos y GRAVE_INHABITABLE	APROBADO	17/11/2026 14:26	18/11/2026 18:16	chore(api): regenerar tipos OpenAPI con endpoints de prioridad y derivar contratos
BUG-H38-PWA-03	Decremento de contadores en familia única, consolidación habitacional multi-familia y preservación de estado al colapsar acordeón	Funcional / Lógica	Unitaria / Componentes	Alta	consolidarEvaluacionFamilias (prioridad.ts), EvaluacionPrioridadCard.tsx y PatrullaPrioridad.test.tsx	tsx con decremento 1 -> 0 en familia única; EvaluacionPrioridadCard.test.tsx (2 familias); npm test -- -t "preserva el borrador"	Contadores y prioridadSugerida retornan a 0/BAJA; compromiso consolida en 2+ familias; borrador preservado al colapsar/reabrir	Verificado en Re-Test Final: tsx devuelve 0/BAJA, EvaluacionPrioridadCard.test.tsx (9/9) aprueba consolidación y preserva el borrador aprueba aislado (exit 0, 7.73s)	APROBADO	17/11/2026 14:26	18/11/2026 18:16	fix(terreno): homologar cálculo de prioridad, consolidación multi-familia, RBAC y ergonomía; test(h38): aislar pruebas de PatrullaPrioridad y cubrir preservación de borrador
BUG-H38-PWA-04	Sincronización outbox de AJUSTAR_PRIORIDAD en useConnectivity, sombreado por reportesPrioridad y banner de estado pendiente	Resiliencia / Offline	Integración / Componentes	Alta	Misión EN_CURSO con mutación AJUSTAR_PRIORIDAD en outbox ante 200 y 409, más refresco desde API	useConnectivity.test.ts (6 tests incluyendo 409), misionesService.test.ts (12 tests) y banner en page.tsx	useConnectivity reconcilia MisionLocal ante 200/409; obtenerDetalleMision evita sombreado; banner generalizado por mutación	Verificado en Re-Test Final: useConnectivity.test.ts (6/6 en 132ms) y misionesService.test.ts (12/12 en 20ms) aprueban reconciliación completa	APROBADO	17/11/2026 14:26	18/11/2026 18:16	fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados; fix(offline): descartar AJUSTAR_PRIORIDAD ante 409 y limpiar advertencias ESLint
BUG-H38-PWA-05	Consistencia algorítmica online/offline de prioridadSugerida y debounce en llamadas a POST /prioridad/calcular	Funcional / Rendimiento	Integración / Componentes	Media	calcularPrioridadSugerida homologado con sgrai-api y EvaluacionPrioridadCard.tsx con debounce 350 ms	tsx con riesgoEstructural: true (25 pts) y prueba de escritura en detallesAdicionales en EvaluacionPrioridadCard.test.tsx	Cliente offline y backend online calculan MEDIA (+25 pts); sin llamadas HTTP ante cambios de texto libre; debounce activo (350 ms)	Verificado en Re-Test Final: tsx devuelve MEDIA (+25 pts) y EvaluacionPrioridadCard.test.tsx (9/9) valida debounce sin disparo por texto libre	APROBADO	17/11/2026 14:26	18/11/2026 18:16	fix(terreno): homologar cálculo de prioridad, consolidación multi-familia, RBAC y ergonomía
BUG-H38-PWA-06	Ergonomía táctil >= 48px, maxLength en referencia, token CSS --border-color-neutral, limpieza de rutas en docs y cobertura	UI / UX / Documentación	Componentes / Estática	Media	Revisión CSS/TSX de EvaluacionPrioridadCard, docs/api/contratos-terreno.md, manual H38 y suites	rg -- '--color-border', min-height: 48px en controles de familia, maxLength={100}, contratos-terreno.md:5, retiro de opción eliminada	Controles >= 48px, maxLength={100}, token --border-color-neutral, sin rutas absolutas ni opciones eliminadas, suites ampliadas	Verificado en Re-Test Final: NO_COLOR_BORDER_IN_H38_CSS, 48px y maxLength={100} activos, contratos-terreno.md:5 limpio y 60/60 pruebas específicas en verde	APROBADO	17/11/2026 14:26	18/11/2026 18:16	docs(h38): actualizar manual H38 y limpiar ruta absoluta en contratos-terreno
BUG-H38-PWA-07	Aislamiento de mocks y cobertura de colapsar en PatrullaPrioridad.test.tsx, matriz §3 de manual H38, 409 en AJUSTAR_PRIORIDAD y advertencias lint	Regresión / Documentación / Estática	Componentes / Estática	Media	Rama feature/h38-patrulla-asignar-prioridad con últimos commits correctivos (761fe0b, 85bd37c, fb7b25c)	npm test -- -t "EvaluacionPrioridadCard", -t "deshabilita EvaluacionPrioridadCard", -t "preserva el borrador", npm run lint, docs/manuals/H38-patrulla-asignar-prioridad.md §3	Pruebas filtradas/aisladas aprueban (exit 0) con verificación de colapso; 0 advertencias ESLint; manual H38 §3 alineado a puntaje acumulativo; 409 terminal en AJUSTAR_PRIORIDAD	Verificado en Re-Test Final: pruebas filtradas -t aprueban (exit 0: 10/10, 1/1, 1/1), useConnectivity.test.ts cubre 409, H38 §3 coincide 1:1 con prioridad.ts y npm run lint arroja 0 errores / 0 advertencias	APROBADO	18/11/2026 02:38	18/11/2026 18:16	test(h38): aislar pruebas de PatrullaPrioridad y cubrir preservación de borrador; docs(h38): actualizar matriz de puntaje en manual §3; fix(offline): descartar AJUSTAR_PRIORIDAD ante 409 y limpiar advertencias ESLint
CP-H38-PWA-01	Despliegue visible de prioridadSugerida y actualización reactiva ante factores críticos	Funcional / UI	Componentes	Alta	EvaluacionPrioridadCard montado en jsdom con misión EN_CURSO	Carga inicial sin factores (BAJA) e incremento de nucleoFamiliarTotal=1 + personasElectrodependientes=1	Muestra badge-prioridad-sugerida inicialmente en Baja y recalcula inmediatamente a Crítica	EvaluacionPrioridadCard.test.tsx aprueba transición reactiva en Re-Test Final (9/9 en 1179ms)	APROBADO	17/11/2026 14:26	18/11/2026 18:16	feat(patrulla): integrar formulario de evaluacion en terreno y prioridad en reportes tecnicos (H38)
CP-H38-PWA-02	Selector de cuatro niveles canónicos (BAJA, MEDIA, ALTA, CRITICA) y campo obligatorio de justificación ante discrepancia	Funcional / Validación	Unitaria / Componentes	Alta	Formulario en EvaluacionPrioridadCard y esquema asignarPrioridadSchema	Selección manual ALTA sobre sugerencia BAJA, entrada de abc (< 5 chars) vs justificación válida (>= 5 chars)	Oculta justificación al coincidir; despliega textarea obligatorio al discrepar; bloquea envío si < 5 chars y habilita con >= 5 chars	prioridad.test.ts (10/10 en 26ms) y EvaluacionPrioridadCard.test.tsx (9/9) aprueban bloqueo y validación	APROBADO	17/11/2026 14:26	18/11/2026 18:16	feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38)
CP-H38-PWA-03	Reglas locales acumulativas de cálculo de prioridad (BAJA, MEDIA, ALTA, CRITICA) y exclusión de requiereApoyoAdicional	Funcional / Unitaria	Unitaria	Media	Función pura calcularPrioridadSugerida homologada en src/lib/validations/prioridad.ts	Escenarios < 15 pts (BAJA), >= 15 (MEDIA), >= 35 (ALTA), >= 60 (CRITICA) con suma de factores vulnerables y habitacionales	Retorna prioridad y factoresGatillantes con puntajes homogéneos a sgrai-api sin considerar requiereApoyoAdicional	prioridad.test.ts aprueba 10/10 pruebas del motor acumulativo homologado en 26ms	APROBADO	17/11/2026 14:26	18/11/2026 18:16	test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA
CP-H38-PWA-04	Prevención de registro de integrantes sobre el tamaño del núcleo familiar y libertad en conteo de mascotas	Funcional / Validación	Unitaria / Componentes	Media	familiaAfectadaSchema y contadores táctiles de EvaluacionPrioridadCard	nucleoFamiliarTotal=0 y 2, luego 1 niño + 1 adulto mayor (2/2) e incremento de mascotasAfectadas a 3 y maxLength=100 en referencia	Deshabilita botones + de integrantes al alcanzar cupo del núcleo familiar y - del núcleo si existen integrantes; permite mascotas y limita referencia	prioridad.test.ts (10/10) y EvaluacionPrioridadCard.test.tsx (9/9) validan bloqueos de cupo, mascotas y límite	APROBADO	17/11/2026 14:26	18/11/2026 18:16	feat(patrulla): prevenir registro de integrantes sobre el tamano del nucleo familiar (H38)
CP-H38-PWA-05	Registro, consolidación de daño máximo y eliminación dinámica de múltiples familias afectadas	Funcional / UI	Componentes	Media	EvaluacionPrioridadCard montado con 1 Hogar / Vivienda inicial	Clic en Añadir otra familia afectada, selección de GRAVE_INHABITABLE en Familia #2 y eliminación de Familia #2	Agrega Familia #2 (2 Hogares / Viviendas), recalcula compromiso máximo y restaura 1 Hogar / Vivienda al eliminar	EvaluacionPrioridadCard.test.tsx (9/9 en 1179ms) valida flujo multi-familia y consolidación	APROBADO	17/11/2026 14:26	18/11/2026 18:16	fix(patrulla): definir actuales al agregar familia y reconsolidar al eliminar (H38)
CP-H38-PWA-06	Modal ModalConfirmacionPrioridad con comparativa Sugerida vs Final, justificación técnica, versión de reporte y cierre accesible	UI / Accesibilidad	Componentes	Media	ModalConfirmacionPrioridad montado en jsdom	Props versionReporte=1 (ratificación), versionReporte=2 (MEDIA -> CRITICA con justificación), clic en Cancelar, tecla Escape y Confirmar y Enviar	Muestra Reporte #1 / Reporte #2, chips comparativos, justificación y dispara callbacks en botón, Escape y confirmación	ModalConfirmacionPrioridad.test.tsx aprueba 4/4 casos en 227ms	APROBADO	17/11/2026 14:26	18/11/2026 18:16	refactor(ui): estandarizar modales de confirmacion con ConfirmModal, ConfirmacionResumen y Chip
CP-H38-PWA-07	Envío online de prioridad vía apiClient, inclusión de familias, versionado correlativo (Reporte #2) y propagación de 403	Funcional / Servicio	Unitaria	Alta	prioridadService.ts con navigator.onLine=true y apiClient mockeado en Vitest	Respuestas mock 200 OK con reporteTerreno, inclusión de familias, incremento Reporte #2, rechazo 403 Forbidden sin token demo	Retorna ok:true, captura reporteTerreno.id y versionReporte, incluye familias y propaga error 403	prioridadService.test.ts aprueba 8/8 pruebas en 31ms	APROBADO	17/11/2026 14:26	18/11/2026 18:16	test(h38): actualizar y ampliar pruebas unitarias tras correcciones de QA
CP-H38-PWA-08	Encolado en IndexedDB (AJUSTAR_PRIORIDAD), actualización optimista offline y reconciliación al reconectar (200 y 409)	Funcional / Offline	Unitaria	Alta	prioridadService.ts (offline) y useConnectivity.ts al recuperar red (online)	prioridadSugerida='BAJA', prioridad='ALTA', justificación >= 5 chars; disparo de sincronización AJUSTAR_PRIORIDAD con 200 y 409	Encola acción AJUSTAR_PRIORIDAD en outbox y reconcilia sincronizacionPendiente=false ante 200 (sincronizado=true) o 409	prioridadService.test.ts (8/8) y useConnectivity.test.ts (6/6 en 132ms) aprueban en Re-Test Final	APROBADO	17/11/2026 14:26	18/11/2026 18:16	fix(offline): descartar AJUSTAR_PRIORIDAD ante 409 y limpiar advertencias ESLint
CP-H38-PWA-09	Integración en PatrullaMisionDetailPage: despliegue, confirmación modal, colapsado Completado (#2), RBAC y preservación de borrador	Funcional / Integración	Componentes	Alta	PatrullaMisionDetailPage con misión EN_CURSO y mocks autónomos por caso en beforeEach	Activación de riesgo + GRAVE_INHABITABLE, versionReportePrioridad=2, usuario sin misiones:terreno:verificar y colapsar/reabrir details	Actualiza a Completado (#1), colapsa acordeones evaluados (Completado (#2)), deshabilita sin permiso y preserva borrador	PatrullaPrioridad.test.tsx (4/4 en 929ms) y PatrullaDetailPage.test.tsx (7/7 en 719ms) aprueban en conjunto y aislados	APROBADO	17/11/2026 14:26	18/11/2026 18:16	test(h38): aislar pruebas de PatrullaPrioridad y cubrir preservación de borrador
CP-H38-PWA-10	Sincronización de evaluaciones, reportesTerreno y limpieza de reportesPrioridad en obtenerDetalleMision	Integración / Servicio	Unitaria	Media	misionesService.ts con apiClient.GET y offlineQueue mockeados	Respuesta mock GET /api/misiones/mis-7700 con reportesTerreno remotos y reportesPrioridad previos en IndexedDB	Persiste prioridadEvaluada: true, versionReportePrioridad: 1 y limpia reportesPrioridad obsoleto ante datos del servidor	misionesService.test.ts aprueba 12/12 pruebas en 20ms	APROBADO	17/11/2026 14:26	18/11/2026 18:16	fix(offline): reconciliar AJUSTAR_PRIORIDAD en outbox y priorizar reportes sincronizados
CP-H38-PWA-11	Validación en vivo de contrato HTTP (401, 403, 400) en sgrai-api (:3001) y protección de ruta 307 en sgrai-pwa (:3002)	Integración / Seguridad	Sistema	Alta	Servicios locales en http://localhost:3001 y http://localhost:3002 con PostgreSQL (5001) y Redis (6001)	POST /api/seguridad/login, PATCH /api/incidentes/{id}/prioridad sin token / con CALL_CENTER / sin justificación >= 5 chars, GET :3002/terreno/patrulla/misiones	API responde 401 sin Bearer, 403 sin misiones:terreno:verificar, 400 ante discrepancia con abc; PWA redirige 307	Verificado sin cambios de API/rutas posteriores: 401, 403, 400 (justificacion_prioridad) y 307 -> /terreno/login (200)	APROBADO	17/11/2026 14:26	18/11/2026 02:35	docs(patrulla): agregar manual de usuario H38 y documentar contrato de prioridad en terreno
CP-H38-PWA-12	Ejecución integral Vitest (completa y filtrada -t), tsc --noEmit, ESLint, npm run build (--webpack) y estática en src/	Regresión / Calidad Estática	Sistema / Estática	Alta	Repositorio web-app limpio en rama feature/h38-patrulla-asignar-prioridad	npm test, npm test -- -t, npx tsc --noEmit, npm run lint, npm run build, rg sobre src/	44/44 suites en verde, -t exit 0, 0 errores TS, 0 errores y 0 warnings ESLint, build --webpack exitoso y 0 emojis/tokens demo	44/44 suites (211/211 tests en 12.09s), -t en verde, tsc exit 0, ESLint 0 errores (0 warnings), next build --webpack (8/8), NO_EMOJIS_IN_SRC	APROBADO	17/11/2026 14:26	18/11/2026 18:16	fix(offline): descartar AJUSTAR_PRIORIDAD ante 409 y limpiar advertencias ESLint
```

---

## 5. Guía de Ejecución y Replicabilidad Paso a Paso

Todos los comandos siguientes se ejecutaron desde la raíz del repositorio `web-app` (`sgrai-pwa`) sobre el commit `7e7b2ae` (`feature/h38-patrulla-asignar-prioridad`) durante el **Re-Test Final (`18/11/2026 18:16`)**.

### 5.1 Suite Vitest completa, subconjunto HU-38 y pruebas filtradas `-t`

1. **Suite completa (`npm test`):**

```bash
npm test
```

Salida observada:

```text
 Test Files  44 passed (44)
      Tests  211 passed (211)
   Start at  18:15:35
   Duration  12.09s (transform 5.57s, setup 14.10s, collect 20.70s, tests 19.83s, environment 70.94s, prepare 9.04s)
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
 ✓ src/lib/validations/__tests__/prioridad.test.ts (10 tests) 26ms
 ✓ src/services/__tests__/misionesService.test.ts (12 tests) 20ms
 ✓ src/services/__tests__/prioridadService.test.ts (8 tests) 31ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (6 tests) 132ms
 ✓ src/components/misiones/__tests__/ModalConfirmacionPrioridad.test.tsx (4 tests) 227ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx (7 tests) 719ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx (4 tests) 929ms
 ✓ src/components/misiones/__tests__/EvaluacionPrioridadCard.test.tsx (9 tests) 1179ms

 Test Files  8 passed (8)
      Tests  60 passed (60)
   Start at  18:15:48
   Duration  3.45s (transform 1.32s, setup 1.59s, collect 3.77s, tests 3.26s, environment 7.75s, prepare 914ms)
```

3. **Ejecuciones filtradas y aisladas de verificación para `BUG-H38-PWA-07`:**

```bash
npm test -- -t "EvaluacionPrioridadCard"
npm test -- -t "deshabilita EvaluacionPrioridadCard"
npm test -- -t "preserva el borrador"
```

Salidas observadas (todas finalizan con `Command exited with code 0`):

```text
# npm test -- -t "EvaluacionPrioridadCard"
 Test Files  2 passed | 42 skipped (44)
      Tests  10 passed | 201 skipped (211)
   Duration  9.51s

# npm test -- -t "deshabilita EvaluacionPrioridadCard"
 Test Files  1 passed | 43 skipped (44)
      Tests  1 passed | 210 skipped (211)
   Duration  7.89s

# npm test -- -t "preserva el borrador"
 Test Files  1 passed | 43 skipped (44)
      Tests  1 passed | 210 skipped (211)
   Duration  7.73s
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

Salidas observadas en Re-Test Final (`18/11/2026 18:16`):
- `npx tsc --noEmit`: `exit code 0`.
- `npm run lint`: `exit code 0` (`0` errores y `0` advertencias).
- `npm run build` (`next build --webpack`, Next.js `16.3.4`): `✓ Compiled successfully in 4.3s`, `✓ Finished TypeScript in 7.5s`, `✓ Collecting page data using 11 workers in 1696ms`, `✓ Generating static pages using 11 workers (8/8) in 2.6s`.
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

Salida observada en Re-Test Final (`18/11/2026 18:16`):

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

*(Validado sin cambios posteriores en rutas ni contratos HTTP desde el `18/11/2026 02:35`.)*

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

Salidas observadas:
- `PATCH` sin token: `{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}` (`HTTP_STATUS:401`).
- `PATCH` con `callcenter@valdivia.cl`: `{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}` (`HTTP_STATUS:403`).
- `PATCH` con `pedro.patrulla@valdivia.cl` y `justificacionPrioridad: "abc"`: `HTTP_STATUS:400` con error de validación sobre `justificacion_prioridad`.
- `GET http://localhost:3002/terreno/patrulla/misiones`: `HTTP/1.1 307 Temporary Redirect` (`location: /terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones`) y `/terreno/login` devuelve `LOGIN_HTTP_STATUS:200`.

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación / Regla (HU-38) | Responsabilidad Arquitectónica | Cobertura / Hallazgo en `sgrai-pwa` | Estado en Re-Test Final | Referencia |
|---|---|---|---|---|
| **CA-1:** Mostrar de forma visible `prioridad_sugerida` preliminar | `sgrai-pwa` + `sgrai-api` | Desplegada en `EvaluacionPrioridadCard`; algoritmo local homologado 1:1 con `sgrai-api`, decremento corregido, *debounce* de `350 ms` y matriz §3 del manual H38 actualizada | **Aprobado** | `CP-H38-PWA-01`, `CP-H38-PWA-03`, `BUG-H38-PWA-03`, `BUG-H38-PWA-05`, `BUG-H38-PWA-07` |
| **CA-2:** Selector con los 4 niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) | `sgrai-pwa` | Selector táctil `radiogroup` implementado con los 4 niveles canónicos, esquinas rectas `0px`, alto contraste y ergonomía `>= 48px` | **Aprobado** | `CP-H38-PWA-02`, `CP-H38-PWA-06`, `BUG-H38-PWA-06` |
| **CA-3:** Campo obligatorio `justificacion_prioridad` (`>= 5` chars) al modificar sugerida | `sgrai-pwa` + `sgrai-api` | Despliegue condicional operativo, `maxLength={100}` en `referencia`, formulario continuo en `<SeccionDesplegable>` y preservación de borrador verificada en Vitest | **Aprobado** | `CP-H38-PWA-02`, `CP-H38-PWA-04`, `CP-H38-PWA-09`, `CP-H38-PWA-11`, `BUG-H38-PWA-07` |
| **CA-4:** Actualización transaccional de `incidente.prioridad`, `justificacion_prioridad` y `mision_hito` | `sgrai-api` (transacción) + `sgrai-pwa` (contrato/offline) | Cliente migrado a `apiClient` desde OpenAPI, incluye `familias`, lee `reporteTerreno`, hidrata `detallesEvaluacion` y reconcilia `AJUSTAR_PRIORIDAD` ante éxito y `409` en `useConnectivity` | **Aprobado** | `CP-H38-PWA-07`, `CP-H38-PWA-08`, `CP-H38-PWA-10`, `BUG-H38-PWA-02`, `BUG-H38-PWA-04`, `BUG-H38-PWA-07` |
| **CA-5:** Emisión WebSocket `incidente:actualizado` al Centro de Mando (badge Kanban) | `sgrai-api` + `sgrai-web` | Implementado en `sgrai-api` (`prioridad.service.ts`) y consumido en `sgrai-web` (`useEncargadoKanbanSocket.ts`). Fuera del cliente `sgrai-pwa` | **Verificado (externo a PWA)** | `CP-H38-PWA-09` |
| **CA-6:** Requerir permiso RBAC `misiones:terreno:verificar` | `sgrai-api` + `sgrai-pwa` | `DEV_PATRULLA_TOKEN` y fallback implícito eliminados; `<EvaluacionPrioridadCard />` deshabilitado sin permiso y validado con prueba aislada `-t "deshabilita EvaluacionPrioridadCard"` | **Aprobado** | `BUG-H38-PWA-01`, `BUG-H38-PWA-07`, `CP-H38-PWA-11` |
| **Estándares `AGENTS.md` / `GEMINI.md` (OpenAPI, Ergonomía, Tokens, Manual, Pruebas)** | `sgrai-pwa` | Cumple OpenAPI, `apiClient`, `--webpack`, `min-height: 48px`, `--border-color-neutral`, `0` emojis, manual H38 §3 actualizado, pruebas filtradas `-t` en verde y `0` warnings ESLint | **Aprobado** | `BUG-H38-PWA-06`, `BUG-H38-PWA-07`, `CP-H38-PWA-12` |

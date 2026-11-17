# Auditoría Técnica y Matriz de Casos de Prueba — HU-[38]: Asignar o Modificar Prioridad del Incidente (Cliente Terreno `sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `feature/h38-patrulla-asignar-prioridad` (solicitud de integración hacia `develop`)  
**Historia de Usuario:** HU-[38] — Asignar o modificar la prioridad del incidente en terreno (Patrulla Verificadora)  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `17/11/2026 14:26 -03:00`  
**Fecha y Hora de Re-Test:** `(Pendiente)`  
**Entorno de Ejecución:** Linux, Node.js v26.13.1, Vitest v3.2.7, Next.js 16.3.4 (Turbopack), ESLint, TypeScript (`tsc --noEmit`), `sgrai-api` (`http://localhost:3001`), PostgreSQL/PostGIS (`5001`), Redis (`6001`)  
**Dictamen de Auditoría:** **RECHAZADO / PENDIENTE DE CORRECCIONES (`6` defectos abiertos bloquean integración en `develop`: `1` Crítico, `3` Altos, `2` Medios; `12` casos funcionales/regresión `APROBADO`)**

---

## Alcance Arquitectónico en `sgrai-pwa`

De acuerdo con la separación de responsabilidades de SGRAI, este repositorio cubre exclusivamente la interfaz móvil de terreno para **Patrulla Verificadora** y **Delegado de Cuadrilla**:

- **Alcance en `sgrai-pwa`:** Cálculo preliminar y despliegue de `prioridadSugerida` con factores gatillantes, captura estructurada de afectación familiar/habitacional y peligros activos, selector táctil de cuatro niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`), exigencia condicional de `justificacionPrioridad` (`>= 5` caracteres) ante discrepancia, modal de confirmación previa, versionado local de reportes (`Reporte #N`) y encolado offline en IndexedDB (`AJUSTAR_PRIORIDAD`).
- **Alcance externo (`sgrai-api` / `sgrai-web`):** La transacción Kysely/PostgreSQL sobre `incidente`, `reporte_terreno` y `mision_hito` reside en `sgrai-api` (`PATCH /api/incidentes/[id]/prioridad` y `POST /api/incidentes/[id]/prioridad/calcular`), y la emisión/renderizado del evento `incidente:actualizado` en el tablero Kanban del Centro de Mando reside en `sgrai-api` y `sgrai-web`. En la auditoría de `sgrai-pwa` se verificó la compatibilidad contractual y de tiempo real contra dichos servicios.

---

## 1. Resumen Ejecutivo

La auditoría técnica sobre la rama `feature/h38-patrulla-asignar-prioridad` verificó el cumplimiento funcional de la suite automatizada actual (`40` archivos / `175` pruebas aprobadas en `npm test`, `5` suites / `29` pruebas específicas de HU-38), compilación TypeScript (`npx tsc --noEmit` sin errores), ESLint (`0` errores y `4` advertencias preexistentes) y build productiva (`npm run build` con salida `0`).

Sin embargo, la inspección forense del código fuente, la comparación contra la rama base `develop` y la validación cruzada contra el contrato OpenAPI y las respuestas reales de `sgrai-api` identificaron **6 defectos reales** (`1` Crítico, `3` Altos y `2` Medios) que impiden aprobar la integración en su estado actual:

| Indicador / Verificación | Resultado Auditoría Inicial (17/11/2026) | Observación Técnica |
|---|---|---|
| Total de casos en matriz (HU-38 PWA) | `18` casos (`6` defectos + `12` pruebas) | `6` en estado `ABIERTO`, `12` en estado `APROBADO` |
| Defectos abiertos por severidad | `1` Crítica, `3` Alta, `2` Media | Bloqueantes de seguridad RBAC, contrato OpenAPI, offline sync y estado de formulario |
| Suite automatizada completa (`npm test`) | `40` archivos / `175` tests (`14.45s`) | Todas las pruebas existentes aprueban bajo mocks, sin cubrir las brechas detectadas |
| Subconjunto específico HU-38 (`npx vitest run`) | `5` archivos / `29` tests (`4.74s`) | `prioridad.test.ts` (`9`), `prioridadService.test.ts` (`7`), `EvaluacionPrioridadCard.test.tsx` (`7`), `ModalConfirmacionPrioridad.test.tsx` (`4`), `PatrullaPrioridad.test.tsx` (`2`) |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `4` advertencias | Advertencias preexistentes `@next/next/no-location-assign-relative-destination` |
| Verificación de tipos (`npx tsc --noEmit`) | Aprobado en rama aislada (`0` errores) | Riesgo de colisión `TS2305` al integrar con `develop` por importación de `DEV_PATRULLA_TOKEN` |
| Build de producción (`npm run build`) | Aprobado (`exit 0`, Next.js 16.3.4 Turbopack) | En `develop` se requiere `--webpack` (`BUG-INT-PWA-02`) |
| Prohibición de emojis en UI (`src/`) | Aprobado (`0` coincidencias) | Verificado con `rg` sobre rangos Unicode en `src/` |
| Verificación en vivo `sgrai-api` / `sgrai-pwa` | Ejecutada (`http://localhost:3001` y `:3002`) | Validados `401`, `403`, `400`, `200` en `/prioridad/calcular`, `/openapi.json` y `307` en PWA |

---

## 2. Registro Técnico de Defectos

### BUG-H38-PWA-01 — Bypass de autenticación/RBAC con `DEV_PATRULLA_TOKEN`, ausencia de control por permiso en detalle de misión y colisión de integración con `develop`
- **Severidad:** Crítica (Seguridad / RBAC / Bloqueante de integración)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/services/prioridadService.ts` (líneas 2–6, 35–44, 506–524)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 143–149, 449–461)
  - `src/lib/api/client.ts` (líneas 5–6, 27–31, 68–75)
  - `src/context/AuthContext.tsx` (líneas 26–40, 136–142, 277–283)
  - `src/app/(auth)/login/page.tsx` (líneas 115–146, 228–238)
  - `package.json` (líneas 6–8)
- **Descripción:**
  1. `src/services/prioridadService.ts` importa `DEV_PATRULLA_TOKEN` y `DEV_PATRULLA_USER_ID` desde `@/lib/api/client`, autentica vía `x-user-id` sin token JWT Bearer (líneas 37–39) y ejecuta un comportamiento *fail-open* en las líneas 508–524: cuando `tokenActual === DEV_PATRULLA_TOKEN` y el servidor responde HTTP `401`, `403` o `404`, el servicio retorna `{ ok: true, offline: false }` y persiste localmente un reporte marcado como `sincronizado: true`.
  2. El mecanismo `DEV_PATRULLA_TOKEN` / `PERFIL_DEMO_PATRULLA` / `"Acceso Rápido Patrulla (Prueba Local)"` ya fue eliminado en `develop` (`BUG-H36-PWA-01` y `BUG-INT-PWA-01`), por lo que la importación en `prioridadService.ts` provocará fallo de compilación TypeScript (`TS2305`) y de build al hacer merge hacia `develop`. Adicionalmente, `package.json` revierte el uso de `--webpack` establecido en `develop` (`BUG-INT-PWA-02`).
  3. En `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (línea 450), `<EvaluacionPrioridadCard />` se renderiza para toda misión `EN_CURSO` sin pasar `deshabilitado={!tienePermisoVerificar}` ni validar `misiones:terreno:verificar` en UI (CA-6), mientras `AuthContext.tsx` (líneas 277–283) concede implícitamente `misiones:terreno:verificar` cuando `permisos` está vacío.
- **Pasos para reproducir:**
  1. Iniciar sesión en `/terreno/login` mediante `"Acceso Rápido Patrulla (Prueba Local)"` o inyectar la cookie `sgrai_auth_token=dev-patrulla-token`.
  2. Enviar una evaluación de prioridad contra `sgrai-api` cuando el backend responda `401` o `403`.
  3. Comparar `git diff develop..HEAD -- src/lib/api/client.ts src/services/prioridadService.ts package.json`.
  4. Inspeccionar el renderizado de `<EvaluacionPrioridadCard />` en `page.tsx` con un usuario `PATRULLA_VERIFICADORA` sin permiso `misiones:terreno:verificar`.
- **Comportamiento actual:** `prioridadService.ts` oculta errores `401`/`403`/`404` bajo token demo devolviendo éxito falso; el formulario de prioridad queda habilitado sin `misiones:terreno:verificar`; persiste código de bypass eliminado en `develop`.
- **Comportamiento esperado:** Eliminación total de `DEV_PATRULLA_TOKEN`, `DEV_PATRULLA_USER_ID`, `PERFIL_DEMO_PATRULLA` y `handleAccesoRapidoPatrulla`; propagación estricta de errores `401`/`403`; bloqueo/deshabilitación de `<EvaluacionPrioridadCard />` cuando `!tienePermiso('misiones:terreno:verificar')`; alineación de `package.json` (`--webpack`) con `develop`.
- **Sugerencia técnica:** Actualizar la rama integrando `develop`, retirar `DEV_PATRULLA_TOKEN`/`DEV_PATRULLA_USER_ID` de `prioridadService.ts`, `tipologiaService.ts`, `misionesService.ts`, `useConnectivity.ts`, `AuthContext.tsx`, `client.ts` y `login/page.tsx`, y pasar `deshabilitado={!tienePermisoVerificar}` a `<EvaluacionPrioridadCard />` y `<EvaluacionTipologiaCard />` (o mostrar aviso RBAC explícito).

---

### BUG-H38-PWA-02 — Desincronización con OpenAPI (`api-generated.d.ts`), incumplimiento de `openapi-fetch`, pérdida de ID/versión del backend y ruptura al hidratar `reportesTerreno`
- **Severidad:** Alta (Contrato API / Integridad de datos)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/types/api-generated.d.ts` (líneas 3637–3665, 3771–3847, ausencia de rutas `/api/incidentes/{id}/prioridad*`)
  - `src/services/prioridadService.ts` (líneas 64–220, 250–292, 346–369, 457–504)
  - `src/types/offline.ts` (líneas 74–134)
- **Descripción:**
  1. `src/types/api-generated.d.ts` no fue regenerado con `npm run api:generate` desde `sgrai-api`: aunque `http://localhost:3001/openapi.json` ya expone `/api/incidentes/{id}/prioridad` (`PATCH`), `/api/incidentes/{id}/prioridad/calcular` (`POST`) y los campos `versionReporte`, `esRectificacion`, `etiquetaReporte`, `prioridadSugerida`, `prioridadAsignada`, `justificacionPrioridad` y `detallesEvaluacion` en `GET /api/misiones/{id}`, ninguno de ellos existe en `api-generated.d.ts`.
  2. `src/services/prioridadService.ts` ejecuta `fetch()` nativo en lugar de `apiClient` (`openapi-fetch`) y utiliza tipos escritos a mano (`AsignarPrioridadPayload`, `PrioridadIncidente`, y el tipo de respuesta inline en líneas 467–481), contraviniendo `AGENTS.md §3`.
  3. En la respuesta de `PATCH /api/incidentes/{id}/prioridad`, `prioridadService.ts` lee `body?.data?.reporte?.id` (línea 484), mientras `sgrai-api` retorna `data.reporteTerreno` (`ActualizarPrioridadIncidenteResponse`), por lo que el UUID real del reporte nunca se captura y se asigna un ID temporal sintético.
  4. `payloadMutacion` (líneas 346–369) omite `familias: validado.familias`, descartando el desglose multi-familia capturado en la UI al enviar la mutación al servidor o encolarla en `outbox`.
  5. `obtenerReportesPrioridadMision` (líneas 76–217) lee los campos de evaluación (`familias`, `cantidadNinos`, `cantidadAdultosMayores`, `personasDiscapacitadas`, `personasElectrodependientes`, `mascotasAfectadas`, `nivelCompromisoVivienda`, `riesgoElectrico`, `riesgoEstructural`, `riesgoQuimicoSanitario`, `aislamientoVial`, `requiereEvacuacion`, `requiereAsistenciaSocial`) directamente desde la raíz de cada elemento `reportesTerreno[i]`. Sin embargo, `sgrai-api` entrega esos campos anidados dentro de `reportesTerreno[i].detallesEvaluacion` (y los riesgos dentro de `detallesEvaluacion.riesgosActivos`). Al recargar el detalle desde la API, toda la evaluación previa se hidrata en `0`, `false` y `SIN_DANO`.
- **Pasos para reproducir:**
  1. Consultar `GET http://localhost:3001/openapi.json` y buscar rutas `/api/incidentes/{id}/prioridad` y `ActualizarPrioridadIncidenteResponse`.
  2. Buscar en `src/types/api-generated.d.ts` `/api/incidentes/{id}/prioridad` (0 coincidencias).
  3. Invocar `obtenerReportesPrioridadMision` con un objeto `reportesTerreno` en formato real de `GET /api/misiones/{id}` (campos dentro de `detallesEvaluacion` y `detallesEvaluacion.riesgosActivos`).
- **Comportamiento actual:** `body?.data?.reporte?.id` resulta `undefined`; `familias` no se transmite en `PATCH`; y la hidratación desde `reportesTerreno` reinicia a `0`/`false`/`SIN_DANO` todos los indicadores técnicos previamente reportados.
- **Comportamiento esperado:** Regenerar `src/types/api-generated.d.ts` contra `sgrai-api`; consumir ambos endpoints vía `apiClient` (`openapi-fetch`); leer `data.reporteTerreno.id` y `data.reporteTerreno.versionReporte`; incluir `familias` en el payload; y normalizar `obtenerReportesPrioridadMision` extrayendo los campos desde `r.detallesEvaluacion` y `r.detallesEvaluacion.riesgosActivos` con respaldo en raíz.

---

### BUG-H38-PWA-03 — Corrupción de contadores al decrementar en familia única, desincronización de compromiso habitacional multi-familia y pérdida de estado al colapsar sección
- **Severidad:** Alta (Lógica funcional / Integridad de formulario)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/lib/validations/prioridad.ts` (líneas 208–252)
  - `src/components/misiones/EvaluacionPrioridadCard.tsx` (líneas 315–364)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (línea 449)
- **Descripción:**
  1. En `consolidarEvaluacionFamilias` (`src/lib/validations/prioridad.ts`, líneas 217–251), la condición `if (soloUnaFamilia && sumaGlobal > sumaFamilias)` sobrescribe los valores de la única familia con los valores globales previos. Al presionar el botón `-` (`ajustarContadorFamilia`, líneas 315–345 de `EvaluacionPrioridadCard.tsx`) sobre cualquier contador de `Familia #1` (cuando hay solo 1 familia), `prev` conserva todavía la suma global anterior (`sumaGlobal > sumaFamilias`), haciendo que `consolidarEvaluacionFamilias` devuelva los contadores antiguos sin decrementar. Así, la tarjeta de `Familia #1` muestra `0`, mientras `Total personas afectadas`, el cálculo de `prioridadSugerida` y el payload enviado mantienen el valor previo sin decrementar (por ejemplo, tras subir y luego bajar `personasElectrodependientes` de `1` a `0`, la prioridad sugerida queda bloqueada en `CRITICA`).
  2. En `EvaluacionPrioridadCard.tsx` (`cambiarCompromisoFamilia`, líneas 347–364), cuando existen 2 o más familias (`familiasActualizadas.length > 1`), no se ejecuta `consolidarEvaluacionFamilias`, dejando desactualizado `evaluacion.nivelCompromisoVivienda` tanto en `"Compromiso máximo"` (línea 864) como en el envío al backend.
  3. En `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (línea 449), `<EvaluacionPrioridadCard />` se monta condicionalmente con `{seccionPrioridadAbierta && (...)}`. Al cerrar y volver a abrir el acordeón, el componente se desmonta y pierde todos los cambios no enviados del formulario.
- **Pasos para reproducir:**
  1. En una misión nueva (1 familia), presionar `+` en `Tamaño núcleo familiar` (`1`) y `+` en `Personas electrodependientes` (`1`) -> prioridad sugerida cambia a `Crítica`.
  2. Presionar `-` en `Personas electrodependientes` -> el contador de `Familia #1` cambia a `0`, pero `prioridadSugerida` permanece en `Crítica`.
  3. Añadir una segunda familia (`Añadir otra familia afectada`) y seleccionar `Grave / Inhabitable` en Familia #2 manteniendo Familia #1 en `Sin daño` -> el resumen consolidado sigue indicando `Compromiso máximo: Sin daño`.
- **Comportamiento actual:** No es posible reducir de forma efectiva el conteo consolidado ni la prioridad sugerida tras decrementar en familia única; el compromiso máximo de vivienda no se consolida en `2+` familias; colapsar el acordeón borra el borrador en memoria.
- **Comportamiento esperado:** `consolidarEvaluacionFamilias` debe tomar siempre las sumas desde `evaluacion.familias` como fuente de verdad durante ediciones del formulario (reservando el respaldo de raíz únicamente para entradas sin arreglo `familias` o inicialización explícita sin lista); `cambiarCompromisoFamilia` debe recalcular `consolidarEvaluacionFamilias`; y `<EvaluacionPrioridadCard />` debe permanecer montado dentro de `<SeccionDesplegable>` (análogo a `<EvaluacionTipologiaCard />`).

---

### BUG-H38-PWA-04 — Reconciliación offline faltante para `AJUSTAR_PRIORIDAD` en `useConnectivity`, sombreado de caché en `misionesService` y mensaje erróneo de aceptación pendiente
- **Severidad:** Alta (Resiliencia Offline-First / Consistencia de UI)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/hooks/useConnectivity.ts` (líneas 65–127)
  - `src/services/misionesService.ts` (líneas 307–326)
  - `src/services/prioridadService.ts` (líneas 69–75)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 315–323)
- **Descripción:**
  1. `src/hooks/useConnectivity.ts` limpia `sincronizacionPendiente` en `MisionLocal` para `ACTUALIZAR_TIPOLOGIA` y `ACEPTAR_MISION`, pero **no contempla `accion.tipo === 'AJUSTAR_PRIORIDAD'`**. Al reconectar la red, la cola envía el `PATCH` y borra la entrada del `outbox`, pero si el operador no está en el detalle de la misión (o si ocurre rechazo `409`/`422`), `mision.sincronizacionPendiente` queda en `true` y `sincronizado` en `false` indefinidamente.
  2. En `src/services/misionesService.ts` (línea 308), `obtenerDetalleMision` esparce `...(previaLocal?.datosAdicionales || {})` manteniendo intacto `datosAdicionales.reportesPrioridad` (con `sincronizado: false`). Dado que `obtenerReportesPrioridadMision` (`prioridadService.ts` líneas 69–74) retorna `reportesPrioridad` local con precedencia absoluta sobre `reportesTerreno` del servidor, los reportes confirmados en el backend quedan sombreados por la copia local marcada como no sincronizada.
  3. En `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 315–323), la bandera genérica `mision.sincronizacionPendiente` muestra el mensaje fijo: *"Pendiente de sincronizar: La aceptación fue guardada en la cola local del dispositivo..."*, aunque la aceptación ya estuviera confirmada online y lo encolado fuera el reporte de prioridad (HU-38) o tipología (HU-37).
- **Pasos para reproducir:**
  1. Aceptar una misión online (`EN_CURSO`).
  2. Desactivar conectividad (`navigator.onLine = false`), enviar evaluación de prioridad y observar el banner en la tarjeta superior.
  3. Restaurar la conexión para disparar `useConnectivity.sincronizar()` fuera de la ruta de detalle o inspeccionar `MisionLocal` en IndexedDB tras la respuesta.
- **Comportamiento actual:** El banner indica falsamente que la aceptación está pendiente de sincronizar; `useConnectivity` no reconcilia `MisionLocal` ni `reportesPrioridad` para `AJUSTAR_PRIORIDAD`; `reportesPrioridad` antiguo sombra `reportesTerreno` remoto tras `obtenerDetalleMision`.
- **Comportamiento esperado:** `useConnectivity` debe actualizar `MisionLocal` (`sincronizacionPendiente: false` y `reportesPrioridad[].sincronizado = true` ante `res.ok`, o revertir estado local ante `409`/`422`); `obtenerDetalleMision` debe limpiar/reconciliar `reportesPrioridad` cuando ya no existan pendientes o existan reportes sincronizados del servidor; y el banner de sincronización debe distinguir qué mutación está pendiente.

---

### BUG-H38-PWA-05 — Divergencia entre el algoritmo de cálculo local vs `sgrai-api` y disparo sin *debounce* de `POST /prioridad/calcular`
- **Severidad:** Media (Consistencia de negocio / Rendimiento)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/lib/validations/prioridad.ts` (líneas 302–428)
  - `src/components/misiones/EvaluacionPrioridadCard.tsx` (líneas 170–186, 250–271)
- **Descripción:**
  1. El motor local (`calcularPrioridadSugerida` en `src/lib/validations/prioridad.ts`) evalúa reglas directas por umbral de presencia (`riesgoEstructural`, `riesgoElectrico`, `riesgoQuimicoSanitario`, `requiereEvacuacion` o `GRAVE_INHABITABLE` -> `CRITICA`; `cantidadAdultosMayores > 0` o `aislamientoVial` -> `ALTA`). Por el contrario, `POST /api/incidentes/{id}/prioridad/calcular` en `sgrai-api` (`prioridad.utils.ts`) usa una tabla de puntuación acumulativa (`>= 60 CRITICA`, `>= 35 ALTA`, `>= 15 MEDIA`, `< 15 BAJA`), retornando en vivo `MEDIA` (`25 pts`) para `riesgoEstructural: true`, `ALTA` (`45 pts`) para `GRAVE_INHABITABLE` y `BAJA` (`12 pts`) para 1 adulto mayor. Al sobrescribir `EvaluacionPrioridadCard.tsx` el cálculo local con el remoto solo cuando hay red, la PWA sugiere prioridades distintas para los mismos datos según esté online u offline (CA-1).
  2. El `useEffect` de `EvaluacionPrioridadCard.tsx` (líneas 251–271) depende del objeto completo `evaluacion` sin *debounce*, ejecutando una petición HTTP `POST /api/incidentes/{id}/prioridad/calcular` (con escritura `UPDATE incidente` en PostgreSQL) por cada tecla presionada en `detallesAdicionales` o en la referencia de familia.
- **Pasos para reproducir:**
  1. Ejecutar localmente `calcularPrioridadSugerida({ ...VALORES_INICIALES_EVALUACION_PRIORIDAD, riesgoEstructural: true })` -> retorna `CRITICA`.
  2. Ejecutar `POST http://localhost:3001/api/incidentes/{id}/prioridad/calcular` con `riesgoEstructural: true` y demás valores iniciales -> retorna `"prioridadSugerida": "MEDIA"`, `"puntajeTotal": 25`.
  3. Escribir texto en `Detalles adicionales del reporte` con el formulario abierto online -> se emite una petición HTTP por carácter.
- **Comportamiento actual:** Discrepancia sistemática de `prioridadSugerida` entre cliente offline y API online, más ráfaga de peticiones HTTP por cada pulsación de tecla en campos textuales.
- **Comportamiento esperado:** Alinear el algoritmo determinista local en `src/lib/validations/prioridad.ts` con la lógica canónica acordada con `sgrai-api` (y reflejarla en el manual), aplicar *debounce* (`300–500 ms`) al llamado remoto y excluir `detallesAdicionales` / `referencia` de la lista de dependencias del cálculo.

---

### BUG-H38-PWA-06 — Ergonomía táctil `< 48px` en controles de familia, falta de `maxLength` en referencia, token `--color-border` inexistente, desfase en manual H38 y brechas de cobertura
- **Severidad:** Media (UI/UX Terreno / Documentación / Cobertura QA)
- **Estado:** **ABIERTO**
- **Archivos afectados:**
  - `src/components/misiones/EvaluacionPrioridadCard.module.css` (líneas 64, 92, 142, 182, 220, 255, 305, 434, 444, 513, 548–588)
  - `src/components/misiones/EvaluacionPrioridadCard.tsx` (líneas 705–713)
  - `docs/manuals/H38-patrulla-asignar-prioridad.md` (líneas 33 y 53)
  - `docs/api/contratos-terreno.md` (línea 5)
  - `src/components/misiones/__tests__/EvaluacionPrioridadCard.test.tsx`, `src/hooks/__tests__/useConnectivity.test.ts`
- **Descripción:**
  1. **Ergonomía móvil (`AGENTS.md §2`):** En `EvaluacionPrioridadCard.module.css`, `.familiaRefInput` (`padding: 4px 8px`), `.btnEliminarFamilia` (`padding: 4px 8px`) y `.btnAgregarFamilia` (`padding: 10px 16px`) carecen de `min-height: 48px`. Adicionalmente, el input `referencia` en `EvaluacionPrioridadCard.tsx` (línea 705) no incluye `maxLength={100}` mientras `familiaAfectadaSchema` (`prioridad.ts` línea 121) impone `.max(100)`, provocando un rechazo Zod no manejado en `handlePreConfirmar` si se superan 100 caracteres.
  2. **Tokens CSS:** `EvaluacionPrioridadCard.module.css` utiliza 11 veces `var(--color-border, #d1d5db)`, variable no definida en `src/styles/tokens.css` (que estandariza `--border-color-neutral: #DFE3E8`).
  3. **Documentación:** `docs/manuals/H38-patrulla-asignar-prioridad.md` (líneas 33 y 53) aún documenta la opción `"Requiere apoyo táctico adicional"` pese a haber sido eliminada de la UI y del cálculo (verificado por prueba unitaria en `EvaluacionPrioridadCard.test.tsx` línea 268). Asimismo, `docs/api/contratos-terreno.md` (línea 5) contiene una ruta absoluta de entorno local (`file:///home/zetastormy/Development/SGRAI/web-app/...`).
  4. **Cobertura de pruebas:** No existen pruebas unitarias/integración para decremento en familia única, consolidación de compromiso habitacional multi-familia, hidratación desde `detallesEvaluacion` de `sgrai-api`, reconciliación de `AJUSTAR_PRIORIDAD` en `useConnectivity` ni bloqueo de interfaz sin `misiones:terreno:verificar`.
- **Comportamiento esperado:** Todos los controles interactivos de familia con `min-height: 48px`, `maxLength={100}` en `referencia`, reemplazo de `--color-border` por `var(--border-color-neutral, #DFE3E8)`, actualización del manual H38 y `contratos-terreno.md`, y adición de pruebas de regresión en Vitest para cada escenario corregido.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-H38-PWA-01 | Bypass de auth/RBAC con `DEV_PATRULLA_TOKEN`, ausencia de control `misiones:terreno:verificar` en formulario y colisión con `develop` | Seguridad / Integración | Sistema / Componentes | Crítica | Rama `feature/h38-patrulla-asignar-prioridad` comparada con `develop` y revisión de `prioridadService.ts` + `page.tsx` | Cookie `sgrai_auth_token=dev-patrulla-token` ante HTTP `401`/`403`/`404`, usuario sin `misiones:terreno:verificar` en `EN_CURSO`, `git diff develop..HEAD` | Sin bypass demo; rechazo estricto ante `401`/`403`; `<EvaluacionPrioridadCard />` deshabilitado sin permiso; `package.json` con `--webpack` | `prioridadService.ts:508-524` retorna `ok: true` ante `401`/`403`/`404`; `page.tsx:450` no pasa `deshabilitado`; `DEV_PATRULLA_TOKEN` causará error `TS2305` al integrar con `develop` | ABIERTO | 17/11/2026 14:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H38-PWA-02 | Contrato OpenAPI `api-generated.d.ts`, uso de `apiClient`, lectura de `data.reporteTerreno` y extracción de `detallesEvaluacion` | Contrato / Integración | Integración | Alta | Esquema OpenAPI vivo en `http://localhost:3001/openapi.json` y servicio `src/services/prioridadService.ts` | Inspección de `api-generated.d.ts`, respuesta `PATCH /prioridad` con `data.reporteTerreno` y payload real `GET /api/misiones/{id}` con `detallesEvaluacion` | Endpoints H38 en `api-generated.d.ts`; uso de `apiClient`; lectura de `reporteTerreno.id`; envío de `familias`; hidratación desde `detallesEvaluacion` | Endpoints ausentes en `api-generated.d.ts`; `fetch` crudo; lee `data.reporte?.id`; omite `familias` en `PATCH`; hidratación API reinicia campos a `0`/`false`/`SIN_DANO` | ABIERTO | 17/11/2026 14:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H38-PWA-03 | Decremento de contadores en familia única, consolidación habitacional multi-familia y preservación de estado al colapsar acordeón | Funcional / Lógica | Unitaria / Componentes | Alta | `consolidarEvaluacionFamilias` (`prioridad.ts`) y `EvaluacionPrioridadCard.tsx` con 1 o más familias | Incrementar `personasElectrodependientes` a `1` y decrementar a `0` en familia única; 2 familias con compromiso `GRAVE_INHABITABLE` en Familia #2 | Contadores y `prioridadSugerida` retornan a `0`/`BAJA` al decrementar; `nivelCompromisoVivienda` consolida `GRAVE_INHABITABLE`; estado preservado al colapsar | Decremento en familia única mantiene `personasElectrodependientes=1` (`CRITICA`); compromiso multi-familia permanece en `SIN_DANO`; colapsar desmonta componente | ABIERTO | 17/11/2026 14:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H38-PWA-04 | Sincronización outbox de `AJUSTAR_PRIORIDAD` en `useConnectivity`, sombreado por `reportesPrioridad` y banner de estado pendiente | Resiliencia / Offline | Integración / Componentes | Alta | Misión `EN_CURSO` con aceptación ya sincronizada y evaluación de prioridad encolada offline (`AJUSTAR_PRIORIDAD`) | `accion.tipo='AJUSTAR_PRIORIDAD'` en `useConnectivity.ts`, `obtenerDetalleMision` en `misionesService.ts` y `page.tsx:315-323` | `useConnectivity` limpia `sincronizacionPendiente` y actualiza `reportesPrioridad`; `obtenerDetalleMision` reconcilia con `reportesTerreno`; banner describe acción real | `useConnectivity.ts` omite `AJUSTAR_PRIORIDAD`; `reportesPrioridad` con `sincronizado:false` sombra `reportesTerreno`; banner muestra texto de aceptación pendiente | ABIERTO | 17/11/2026 14:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H38-PWA-05 | Consistencia algorítmica online/offline de `prioridadSugerida` y *debounce* en llamadas a `POST /prioridad/calcular` | Funcional / Rendimiento | Integración | Media | Comparativa entre `calcularPrioridadSugerida` local y `POST http://localhost:3001/api/incidentes/{id}/prioridad/calcular` | Payload con `riesgoEstructural: true` y valores base en `0`; escritura continua en `detallesAdicionales` | Cliente y servidor sugieren el mismo nivel de prioridad para idéntica evaluación; peticiones de cálculo con *debounce* y sin disparo por texto libre | Local devuelve `CRITICA` y `sgrai-api` retorna `MEDIA` (`25 pts`); `useEffect` dispara `POST` en cada cambio de carácter sin *debounce* | ABIERTO | 17/11/2026 14:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H38-PWA-06 | Ergonomía táctil `>= 48px`, `maxLength` en referencia, token CSS `--border-color-neutral`, manual H38 y cobertura de pruebas | UI / UX / Documentación | Componentes / Estática | Media | Revisión de `EvaluacionPrioridadCard.module.css`, `EvaluacionPrioridadCard.tsx`, manual H38 y suites Vitest | Controles `.familiaRefInput`, `.btnEliminarFamilia`, `.btnAgregarFamilia`, uso de `--color-border` y `docs/manuals/H38-patrulla-asignar-prioridad.md` | Altura mínima `48px`; `maxLength={100}`; uso de `--border-color-neutral`; manual sin opciones eliminadas; cobertura de regresiones | Controles de familia `< 48px`; sin `maxLength` en input; `11` usos de `--color-border`; manual menciona `"Requiere apoyo táctico adicional"`; faltan tests de borde | ABIERTO | 17/11/2026 14:26 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| CP-H38-PWA-01 | Despliegue visible de `prioridadSugerida` y actualización reactiva ante factores críticos | Funcional / UI | Componentes | Alta | `EvaluacionPrioridadCard` montado en jsdom con misión `EN_CURSO` | Carga inicial sin factores (`BAJA`) e incremento de `nucleoFamiliarTotal=1` + `personasElectrodependientes=1` | Muestra `badge-prioridad-sugerida` inicialmente en `Baja` y recalcula inmediatamente a `Crítica` | `EvaluacionPrioridadCard.test.tsx` aprueba validación de `Baja` inicial y transición reactiva a `Crítica` (`7/7` en `1603ms`) | APROBADO | 17/11/2026 14:26 | N/A | feat(patrulla): integrar formulario de evaluacion en terreno y prioridad en reportes tecnicos (H38) |
| CP-H38-PWA-02 | Selector de cuatro niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) y campo obligatorio de justificación ante discrepancia | Funcional / Validación | Unitaria / Componentes | Alta | Formulario en `EvaluacionPrioridadCard` y esquema `asignarPrioridadSchema` | Selección manual `ALTA` sobre sugerencia `BAJA`, entrada de `abc` (`< 5` chars) vs justificación válida (`>= 5` chars) | Oculta justificación al coincidir; despliega textarea obligatorio al discrepar; bloquea envío si `< 5` chars y habilita con `>= 5` chars | `prioridad.test.ts` (`9/9` en `27ms`) y `EvaluacionPrioridadCard.test.tsx` aprueban bloqueo con `3` chars y habilitación con texto válido | APROBADO | 17/11/2026 14:26 | N/A | feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38) |
| CP-H38-PWA-03 | Reglas locales de cálculo de prioridad (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) y exclusión de `requiereApoyoAdicional` | Funcional / Unitaria | Unitaria | Media | Función pura `calcularPrioridadSugerida` en `src/lib/validations/prioridad.ts` | Casos base sin daños (`BAJA`), `1` niño + daño leve (`MEDIA`), discapacidad + adulto mayor + aislamiento (`ALTA`), electrodependiente + riesgo eléctrico (`CRITICA`) | Retorna la prioridad y `factoresGatillantes` locales correspondientes sin considerar `requiereApoyoAdicional` | `prioridad.test.ts` aprueba `5/5` casos de cálculo local de `calcularPrioridadSugerida` en `27ms` | APROBADO | 17/11/2026 14:26 | N/A | feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38) |
| CP-H38-PWA-04 | Prevención de registro de integrantes sobre el tamaño del núcleo familiar y libertad en conteo de mascotas | Funcional / Validación | Unitaria / Componentes | Media | `familiaAfectadaSchema` y contadores táctiles de `EvaluacionPrioridadCard` | `nucleoFamiliarTotal=0` y `2`, luego `1 niño + 1 adulto mayor` (`2/2`) e incremento de `mascotasAfectadas` a `3` | Deshabilita botones `+` de integrantes al alcanzar cupo del núcleo familiar y `-` del núcleo si existen integrantes; permite aumentar mascotas | `prioridad.test.ts` (`familiaAfectadaSchema`) y `EvaluacionPrioridadCard.test.tsx` validan bloqueos de cupo y mascotas independientes | APROBADO | 17/11/2026 14:26 | N/A | feat(patrulla): prevenir registro de integrantes sobre el tamano del nucleo familiar (H38) |
| CP-H38-PWA-05 | Registro y eliminación dinámica de múltiples familias afectadas actualizando conteo de hogares | Funcional / UI | Componentes | Media | `EvaluacionPrioridadCard` montado con `1 Hogar / Vivienda` inicial | Clic en `Añadir otra familia afectada` y luego clic en `Eliminar Familia #2` | Agrega `Familia #2` mostrando `2 Hogares / Viviendas` y al quitarla restaura `1 Hogar / Vivienda` | `EvaluacionPrioridadCard.test.tsx` valida transición `1 -> 2 -> 1` hogares sin errores | APROBADO | 17/11/2026 14:26 | N/A | fix(patrulla): definir actuales al agregar familia y reconsolidar al eliminar (H38) |
| CP-H38-PWA-06 | Modal `ModalConfirmacionPrioridad` con comparativa Sugerida vs Final, justificación técnica, versión de reporte y cierre accesible | UI / Accesibilidad | Componentes | Media | `ModalConfirmacionPrioridad` montado en jsdom | Props `versionReporte=1` (ratificación), `versionReporte=2` (`MEDIA` -> `CRITICA` con justificación), clic en `Cancelar`, tecla `Escape` y `Confirmar y Enviar` | Muestra `Reporte #1` / `Reporte #2`, chips comparativos, justificación y dispara callbacks en botón, `Escape` y confirmación | `ModalConfirmacionPrioridad.test.tsx` aprueba `4/4` casos en `399ms` | APROBADO | 17/11/2026 14:26 | N/A | refactor(ui): estandarizar modales de confirmacion con ConfirmModal, ConfirmacionResumen y Chip |
| CP-H38-PWA-07 | Envío online de prioridad, versionado correlativo (`Reporte #2`) y propagación de `403 Forbidden` bajo mocks | Funcional / Servicio | Unitaria | Alta | `prioridadService.ts` con `navigator.onLine=true` y `fetch` mockeado en Vitest | Respuestas mock `200 OK` para `Reporte #1` y `Reporte #2`, y rechazo `403 Forbidden` sin `misiones:terreno:verificar` | Retorna `ok:true`, incrementa `versionReporte` a `2` cuando existe reporte previo y lanza error con `misiones:terreno:verificar` ante `403` | `prioridadService.test.ts` aprueba `7/7` pruebas en `57ms` | APROBADO | 17/11/2026 14:26 | N/A | test(prioridad): agregar pruebas unitarias y de componentes para evaluacion y prioridad (H38) |
| CP-H38-PWA-08 | Encolado en IndexedDB (`AJUSTAR_PRIORIDAD`) y actualización local optimista cuando `navigator.onLine=false` | Funcional / Offline | Unitaria | Alta | `prioridadService.ts` con `navigator.onLine=false` y mocks de `offlineQueue` | `prioridadSugerida='BAJA'`, `prioridad='ALTA'`, justificación `>= 5` chars | Encola acción `AJUSTAR_PRIORIDAD` (`PATCH /api/incidentes/{id}/prioridad`), actualiza prioridad local y marca `sincronizacionPendiente=true` | `prioridadService.test.ts` verifica llamada a `encolarAccionOutbox` con `AJUSTAR_PRIORIDAD` y `sincronizacionPendiente: true` | APROBADO | 17/11/2026 14:26 | N/A | feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38) |
| CP-H38-PWA-09 | Integración en `PatrullaMisionDetailPage`: despliegue de sección, confirmación modal y estado colapsado `Completado (#2)` | Funcional / Integración | Componentes | Alta | `PatrullaMisionDetailPage` con misión `EN_CURSO`, tipología evaluada y mocks de servicios | Activación de `Riesgo estructural / derrumbe`, confirmación en modal, y carga inicial con `versionReportePrioridad=2` | Actualiza chip a `Completado (#1)` tras envío y colapsa ambos acordeones `<details>` si ya fueron evaluados (`Completado (#2)`) | `PatrullaPrioridad.test.tsx` aprueba `2/2` casos en `927ms` | APROBADO | 17/11/2026 14:26 | N/A | feat(patrulla): actualizar integracion de evaluaciones tecnicas y pruebas en detalle de mision |
| CP-H38-PWA-10 | Sincronización de `evaluaciones` y `reportesTerreno` en `obtenerDetalleMision` | Integración / Servicio | Unitaria | Media | `misionesService.ts` con `apiClient.GET` y `offlineQueue` mockeados | Respuesta mock `GET /api/misiones/mis-7700` con `reportesTerreno` y `evaluaciones.prioridadEvaluada=true`, `versionReportePrioridad=1` | Persiste en `MisionLocal.datosAdicionales` los flags `prioridadEvaluada: true` y `versionReportePrioridad: 1` | `misionesService.test.ts` aprueba `10/10` pruebas en `21ms` | APROBADO | 17/11/2026 14:26 | N/A | feat(misiones): sincronizar evaluacion de terreno e hitos en detalle de mision y tipos OpenAPI |
| CP-H38-PWA-11 | Validación en vivo de contrato HTTP (`401`, `403`, `400`) en `sgrai-api` (`:3001`) y protección de ruta `307` en `sgrai-pwa` (`:3002`) | Integración / Seguridad | Sistema | Alta | Servicios en ejecución en `http://localhost:3001` y `http://localhost:3002` con PostgreSQL (`5001`) y Redis (`6001`) | `POST /api/seguridad/login`, `PATCH /api/incidentes/{id}/prioridad` sin token / con `CALL_CENTER` / sin justificación / con UUID inválido, `GET :3002/terreno/patrulla/misiones` | API responde `401` sin Bearer, `403` sin `misiones:terreno:verificar`, `400` ante discrepancia sin justificación `>= 5` chars o UUID inválido; PWA redirige `307` | Respuestas reales observadas: `401`, `403` (`misiones:terreno:verificar`), `400` (`justificacion_prioridad` / `id`), y `307` hacia `/terreno/login` | APROBADO | 17/11/2026 14:26 | N/A | docs(patrulla): agregar manual de usuario H38 y documentar contrato de prioridad en terreno |
| CP-H38-PWA-12 | Ejecución integral Vitest, verificación `tsc --noEmit`, ESLint, `npm run build` y ausencia de emojis en `src/` | Regresión / Calidad Estática | Sistema / Estática | Alta | Repositorio `web-app` limpio en rama `feature/h38-patrulla-asignar-prioridad` | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `rg` Unicode sobre `src/` | `100%` suites en verde, `0` errores TS, `0` errores ESLint, build exitoso y `0` emojis en `src/` | `40/40` suites (`175/175` tests en `14.45s`), `tsc` exit `0`, ESLint `0` errores (`4` warnings), `next build` (`8/8` páginas), `NO_EMOJIS_IN_SRC` | APROBADO | 17/11/2026 14:26 | N/A | test(prioridad): agregar pruebas unitarias y de componentes para evaluacion y prioridad (H38) |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H38-PWA-01	Bypass de auth/RBAC con DEV_PATRULLA_TOKEN, ausencia de control misiones:terreno:verificar en formulario y colisión con develop	Seguridad / Integración	Sistema / Componentes	Crítica	Rama feature/h38-patrulla-asignar-prioridad comparada con develop y revisión de prioridadService.ts + page.tsx	Cookie sgrai_auth_token=dev-patrulla-token ante HTTP 401/403/404, usuario sin misiones:terreno:verificar en EN_CURSO, git diff develop..HEAD	Sin bypass demo; rechazo estricto ante 401/403; EvaluacionPrioridadCard deshabilitado sin permiso; package.json con --webpack	prioridadService.ts:508-524 retorna ok: true ante 401/403/404; page.tsx:450 no pasa deshabilitado; DEV_PATRULLA_TOKEN causará error TS2305 al integrar con develop	ABIERTO	17/11/2026 14:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-PWA-02	Contrato OpenAPI api-generated.d.ts, uso de apiClient, lectura de data.reporteTerreno y extracción de detallesEvaluacion	Contrato / Integración	Integración	Alta	Esquema OpenAPI vivo en http://localhost:3001/openapi.json y servicio src/services/prioridadService.ts	Inspección de api-generated.d.ts, respuesta PATCH /prioridad con data.reporteTerreno y payload real GET /api/misiones/{id} con detallesEvaluacion	Endpoints H38 en api-generated.d.ts; uso de apiClient; lectura de reporteTerreno.id; envío de familias; hidratación desde detallesEvaluacion	Endpoints ausentes en api-generated.d.ts; fetch crudo; lee data.reporte?.id; omite familias en PATCH; hidratación API reinicia campos a 0/false/SIN_DANO	ABIERTO	17/11/2026 14:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-PWA-03	Decremento de contadores en familia única, consolidación habitacional multi-familia y preservación de estado al colapsar acordeón	Funcional / Lógica	Unitaria / Componentes	Alta	consolidarEvaluacionFamilias (prioridad.ts) y EvaluacionPrioridadCard.tsx con 1 o más familias	Incrementar personasElectrodependientes a 1 y decrementar a 0 en familia única; 2 familias con compromiso GRAVE_INHABITABLE en Familia #2	Contadores y prioridadSugerida retornan a 0/BAJA al decrementar; nivelCompromisoVivienda consolida GRAVE_INHABITABLE; estado preservado al colapsar	Decremento en familia única mantiene personasElectrodependientes=1 (CRITICA); compromiso multi-familia permanece en SIN_DANO; colapsar desmonta componente	ABIERTO	17/11/2026 14:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-PWA-04	Sincronización outbox de AJUSTAR_PRIORIDAD en useConnectivity, sombreado por reportesPrioridad y banner de estado pendiente	Resiliencia / Offline	Integración / Componentes	Alta	Misión EN_CURSO con aceptación ya sincronizada y evaluación de prioridad encolada offline (AJUSTAR_PRIORIDAD)	accion.tipo='AJUSTAR_PRIORIDAD' en useConnectivity.ts, obtenerDetalleMision en misionesService.ts y page.tsx:315-323	useConnectivity limpia sincronizacionPendiente y actualiza reportesPrioridad; obtenerDetalleMision reconcilia con reportesTerreno; banner describe acción real	useConnectivity.ts omite AJUSTAR_PRIORIDAD; reportesPrioridad con sincronizado:false sombra reportesTerreno; banner muestra texto de aceptación pendiente	ABIERTO	17/11/2026 14:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-PWA-05	Consistencia algorítmica online/offline de prioridadSugerida y debounce en llamadas a POST /prioridad/calcular	Funcional / Rendimiento	Integración	Media	Comparativa entre calcularPrioridadSugerida local y POST http://localhost:3001/api/incidentes/{id}/prioridad/calcular	Payload con riesgoEstructural: true y valores base en 0; escritura continua en detallesAdicionales	Cliente y servidor sugieren el mismo nivel de prioridad para idéntica evaluación; peticiones de cálculo con debounce y sin disparo por texto libre	Local devuelve CRITICA y sgrai-api retorna MEDIA (25 pts); useEffect dispara POST en cada cambio de carácter sin debounce	ABIERTO	17/11/2026 14:26	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H38-PWA-06	Ergonomía táctil >= 48px, maxLength en referencia, token CSS --border-color-neutral, manual H38 y cobertura de pruebas	UI / UX / Documentación	Componentes / Estática	Media	Revisión de EvaluacionPrioridadCard.module.css, EvaluacionPrioridadCard.tsx, manual H38 y suites Vitest	Controles .familiaRefInput, .btnEliminarFamilia, .btnAgregarFamilia, uso de --color-border y docs/manuals/H38-patrulla-asignar-prioridad.md	Altura mínima 48px; maxLength={100}; uso de --border-color-neutral; manual sin opciones eliminadas; cobertura de regresiones	Controles de familia < 48px; sin maxLength en input; 11 usos de --color-border; manual menciona "Requiere apoyo táctico adicional"; faltan tests de borde	ABIERTO	17/11/2026 14:26	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H38-PWA-01	Despliegue visible de prioridadSugerida y actualización reactiva ante factores críticos	Funcional / UI	Componentes	Alta	EvaluacionPrioridadCard montado en jsdom con misión EN_CURSO	Carga inicial sin factores (BAJA) e incremento de nucleoFamiliarTotal=1 + personasElectrodependientes=1	Muestra badge-prioridad-sugerida inicialmente en Baja y recalcula inmediatamente a Crítica	EvaluacionPrioridadCard.test.tsx aprueba validación de Baja inicial y transición reactiva a Crítica (7/7 en 1603ms)	APROBADO	17/11/2026 14:26	N/A	feat(patrulla): integrar formulario de evaluacion en terreno y prioridad en reportes tecnicos (H38)
CP-H38-PWA-02	Selector de cuatro niveles canónicos (BAJA, MEDIA, ALTA, CRITICA) y campo obligatorio de justificación ante discrepancia	Funcional / Validación	Unitaria / Componentes	Alta	Formulario en EvaluacionPrioridadCard y esquema asignarPrioridadSchema	Selección manual ALTA sobre sugerencia BAJA, entrada de abc (< 5 chars) vs justificación válida (>= 5 chars)	Oculta justificación al coincidir; despliega textarea obligatorio al discrepar; bloquea envío si < 5 chars y habilita con >= 5 chars	prioridad.test.ts (9/9 en 27ms) y EvaluacionPrioridadCard.test.tsx aprueban bloqueo con 3 chars y habilitación con texto válido	APROBADO	17/11/2026 14:26	N/A	feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38)
CP-H38-PWA-03	Reglas locales de cálculo de prioridad (BAJA, MEDIA, ALTA, CRITICA) y exclusión de requiereApoyoAdicional	Funcional / Unitaria	Unitaria	Media	Función pura calcularPrioridadSugerida en src/lib/validations/prioridad.ts	Casos base sin daños (BAJA), 1 niño + daño leve (MEDIA), discapacidad + adulto mayor + aislamiento (ALTA), electrodependiente + riesgo eléctrico (CRITICA)	Retorna la prioridad y factoresGatillantes locales correspondientes sin considerar requiereApoyoAdicional	prioridad.test.ts aprueba 5/5 casos de cálculo local de calcularPrioridadSugerida en 27ms	APROBADO	17/11/2026 14:26	N/A	feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38)
CP-H38-PWA-04	Prevención de registro de integrantes sobre el tamaño del núcleo familiar y libertad en conteo de mascotas	Funcional / Validación	Unitaria / Componentes	Media	familiaAfectadaSchema y contadores táctiles de EvaluacionPrioridadCard	nucleoFamiliarTotal=0 y 2, luego 1 niño + 1 adulto mayor (2/2) e incremento de mascotasAfectadas a 3	Deshabilita botones + de integrantes al alcanzar cupo del núcleo familiar y - del núcleo si existen integrantes; permite aumentar mascotas	prioridad.test.ts (familiaAfectadaSchema) y EvaluacionPrioridadCard.test.tsx validan bloqueos de cupo y mascotas independientes	APROBADO	17/11/2026 14:26	N/A	feat(patrulla): prevenir registro de integrantes sobre el tamano del nucleo familiar (H38)
CP-H38-PWA-05	Registro y eliminación dinámica de múltiples familias afectadas actualizando conteo de hogares	Funcional / UI	Componentes	Media	EvaluacionPrioridadCard montado con 1 Hogar / Vivienda inicial	Clic en Añadir otra familia afectada y luego clic en Eliminar Familia #2	Agrega Familia #2 mostrando 2 Hogares / Viviendas y al quitarla restaura 1 Hogar / Vivienda	EvaluacionPrioridadCard.test.tsx valida transición 1 -> 2 -> 1 hogares sin errores	APROBADO	17/11/2026 14:26	N/A	fix(patrulla): definir actuales al agregar familia y reconsolidar al eliminar (H38)
CP-H38-PWA-06	Modal ModalConfirmacionPrioridad con comparativa Sugerida vs Final, justificación técnica, versión de reporte y cierre accesible	UI / Accesibilidad	Componentes	Media	ModalConfirmacionPrioridad montado en jsdom	Props versionReporte=1 (ratificación), versionReporte=2 (MEDIA -> CRITICA con justificación), clic en Cancelar, tecla Escape y Confirmar y Enviar	Muestra Reporte #1 / Reporte #2, chips comparativos, justificación y dispara callbacks en botón, Escape y confirmación	ModalConfirmacionPrioridad.test.tsx aprueba 4/4 casos en 399ms	APROBADO	17/11/2026 14:26	N/A	refactor(ui): estandarizar modales de confirmacion con ConfirmModal, ConfirmacionResumen y Chip
CP-H38-PWA-07	Envío online de prioridad, versionado correlativo (Reporte #2) y propagación de 403 Forbidden bajo mocks	Funcional / Servicio	Unitaria	Alta	prioridadService.ts con navigator.onLine=true y fetch mockeado en Vitest	Respuestas mock 200 OK para Reporte #1 y Reporte #2, y rechazo 403 Forbidden sin misiones:terreno:verificar	Retorna ok:true, incrementa versionReporte a 2 cuando existe reporte previo y lanza error con misiones:terreno:verificar ante 403	prioridadService.test.ts aprueba 7/7 pruebas en 57ms	APROBADO	17/11/2026 14:26	N/A	test(prioridad): agregar pruebas unitarias y de componentes para evaluacion y prioridad (H38)
CP-H38-PWA-08	Encolado en IndexedDB (AJUSTAR_PRIORIDAD) y actualización local optimista cuando navigator.onLine=false	Funcional / Offline	Unitaria	Alta	prioridadService.ts con navigator.onLine=false y mocks de offlineQueue	prioridadSugerida='BAJA', prioridad='ALTA', justificación >= 5 chars	Encola acción AJUSTAR_PRIORIDAD (PATCH /api/incidentes/{id}/prioridad), actualiza prioridad local y marca sincronizacionPendiente=true	prioridadService.test.ts verifica llamada a encolarAccionOutbox con AJUSTAR_PRIORIDAD y sincronizacionPendiente: true	APROBADO	17/11/2026 14:26	N/A	feat(prioridad): implementar calculo de prioridad sugerida, esquema Zod y servicio offline-first (H38)
CP-H38-PWA-09	Integración en PatrullaMisionDetailPage: despliegue de sección, confirmación modal y estado colapsado Completado (#2)	Funcional / Integración	Componentes	Alta	PatrullaMisionDetailPage con misión EN_CURSO, tipología evaluada y mocks de servicios	Activación de Riesgo estructural / derrumbe, confirmación en modal, y carga inicial con versionReportePrioridad=2	Actualiza chip a Completado (#1) tras envío y colapsa ambos acordeones details si ya fueron evaluados (Completado (#2))	PatrullaPrioridad.test.tsx aprueba 2/2 casos en 927ms	APROBADO	17/11/2026 14:26	N/A	feat(patrulla): actualizar integracion de evaluaciones tecnicas y pruebas en detalle de mision
CP-H38-PWA-10	Sincronización de evaluaciones y reportesTerreno en obtenerDetalleMision	Integración / Servicio	Unitaria	Media	misionesService.ts con apiClient.GET y offlineQueue mockeados	Respuesta mock GET /api/misiones/mis-7700 con reportesTerreno y evaluaciones.prioridadEvaluada=true, versionReportePrioridad=1	Persiste en MisionLocal.datosAdicionales los flags prioridadEvaluada: true y versionReportePrioridad: 1	misionesService.test.ts aprueba 10/10 pruebas en 21ms	APROBADO	17/11/2026 14:26	N/A	feat(misiones): sincronizar evaluacion de terreno e hitos en detalle de mision y tipos OpenAPI
CP-H38-PWA-11	Validación en vivo de contrato HTTP (401, 403, 400) en sgrai-api (:3001) y protección de ruta 307 en sgrai-pwa (:3002)	Integración / Seguridad	Sistema	Alta	Servicios en ejecución en http://localhost:3001 y http://localhost:3002 con PostgreSQL (5001) y Redis (6001)	POST /api/seguridad/login, PATCH /api/incidentes/{id}/prioridad sin token / con CALL_CENTER / sin justificación / con UUID inválido, GET :3002/terreno/patrulla/misiones	API responde 401 sin Bearer, 403 sin misiones:terreno:verificar, 400 ante discrepancia sin justificación >= 5 chars o UUID inválido; PWA redirige 307	Respuestas reales observadas: 401, 403 (misiones:terreno:verificar), 400 (justificacion_prioridad / id), y 307 hacia /terreno/login	APROBADO	17/11/2026 14:26	N/A	docs(patrulla): agregar manual de usuario H38 y documentar contrato de prioridad en terreno
CP-H38-PWA-12	Ejecución integral Vitest, verificación tsc --noEmit, ESLint, npm run build y ausencia de emojis en src/	Regresión / Calidad Estática	Sistema / Estática	Alta	Repositorio web-app limpio en rama feature/h38-patrulla-asignar-prioridad	npm test, npx tsc --noEmit, npm run lint, npm run build, rg Unicode sobre src/	100% suites en verde, 0 errores TS, 0 errores ESLint, build exitoso y 0 emojis en src/	40/40 suites (175/175 tests en 14.45s), tsc exit 0, ESLint 0 errores (4 warnings), next build (8/8 páginas), NO_EMOJIS_IN_SRC	APROBADO	17/11/2026 14:26	N/A	test(prioridad): agregar pruebas unitarias y de componentes para evaluacion y prioridad (H38)
```

---

## 5. Guía de Ejecución y Replicabilidad Paso a Paso

Todos los comandos siguientes fueron ejecutados desde la raíz del repositorio `web-app` (`sgrai-pwa`) sobre el commit `9205ebe` (`feature/h38-patrulla-asignar-prioridad`).

### 5.1 Suite completa Vitest y pruebas específicas de HU-38

```bash
npm test
```

Salida observada:

```text
 Test Files  40 passed (40)
      Tests  175 passed (175)
   Start at  14:17:20
   Duration  14.45s (transform 10.66s, setup 19.13s, collect 37.22s, tests 20.91s, environment 87.66s, prepare 10.75s)
```

Ejecución específica de las `5` suites dedicadas a HU-38:

```bash
npx vitest run \
  src/lib/validations/__tests__/prioridad.test.ts \
  src/services/__tests__/prioridadService.test.ts \
  src/components/misiones/__tests__/EvaluacionPrioridadCard.test.tsx \
  src/components/misiones/__tests__/ModalConfirmacionPrioridad.test.tsx \
  'src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx'
```

Salida observada:

```text
 ✓ src/lib/validations/__tests__/prioridad.test.ts (9 tests) 27ms
 ✓ src/services/__tests__/prioridadService.test.ts (7 tests) 57ms
 ✓ src/components/misiones/__tests__/ModalConfirmacionPrioridad.test.tsx (4 tests) 399ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaPrioridad.test.tsx (2 tests) 927ms
 ✓ src/components/misiones/__tests__/EvaluacionPrioridadCard.test.tsx (7 tests) 1603ms

 Test Files  5 passed (5)
      Tests  29 passed (29)
   Start at  14:26:22
   Duration  4.74s (transform 1.03s, setup 1.95s, collect 3.24s, tests 3.01s, environment 6.05s, prepare 740ms)
```

Ejecución filtrada por nombre de componente con `npm test -- -t`:

```bash
npm test -- -t "EvaluacionPrioridadCard"
```

Salida observada:

```text
 Test Files  1 passed | 39 skipped (40)
      Tests  7 passed | 168 skipped (175)
   Start at  14:26:29
   Duration  8.16s (transform 4.77s, setup 12.78s, collect 19.95s, tests 2.00s, environment 57.48s, prepare 7.06s)
```

### 5.2 Verificación de tipos, ESLint, Build y búsqueda estática

```bash
npx tsc --noEmit
npm run lint
npm run build
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "NO_EMOJIS_IN_SRC"
rg -n "/api/incidentes/\{id\}/prioridad" src/types/api-generated.d.ts || echo "NOT_FOUND_IN_API_GENERATED"
```

Salidas observadas:
- `npx tsc --noEmit`: `exit code 0`.
- `npm run lint`: `exit code 0`, `0 errors` y `4 warnings` (`@next/next/no-location-assign-relative-destination` en `src/app/(auth)/login/page.tsx:51`, `src/app/(terreno)/page.tsx:26`, `src/context/AuthContext.tsx:164` y `src/lib/api/client.ts:47`).
- `npm run build` (Next.js 16.3.4 Turbopack): `✓ Compiled successfully in 4.2s`, `✓ Finished TypeScript in 6.7s`, `✓ Generating static pages using 11 workers (8/8)`.
- Búsqueda de emojis: `NO_EMOJIS_IN_SRC`.
- Búsqueda OpenAPI local: `NOT_FOUND_IN_API_GENERATED`.

### 5.3 Reproducción técnica de `BUG-H38-PWA-02` y `BUG-H38-PWA-03`

Reproducción de falla al decrementar en familia única (`BUG-H38-PWA-03`) y divergencia contra API (`BUG-H38-PWA-05`):

```bash
npx tsx -e "
import { calcularPrioridadSugerida, consolidarEvaluacionFamilias, VALORES_INICIALES_EVALUACION_PRIORIDAD } from './src/lib/validations/prioridad';
console.log('1) Local riesgoEstructural=true:', calcularPrioridadSugerida({ ...VALORES_INICIALES_EVALUACION_PRIORIDAD, riesgoEstructural: true }));
const prev = { ...VALORES_INICIALES_EVALUACION_PRIORIDAD, nucleoFamiliarTotal: 1, personasElectrodependientes: 1, familias: [{ ...VALORES_INICIALES_EVALUACION_PRIORIDAD.familias[0], nucleoFamiliarTotal: 1, personasElectrodependientes: 1 }] };
const familiasActualizadas = [{ ...prev.familias[0], personasElectrodependientes: 0 }];
const consolidado = consolidarEvaluacionFamilias({ ...prev, familias: familiasActualizadas });
console.log('2) Tras decrementar electrodependiente de 1 a 0 en unica familia:');
console.log('   consolidado.personasElectrodependientes =', consolidado.personasElectrodependientes);
console.log('   prioridadSugerida resultante =', calcularPrioridadSugerida({ ...prev, ...consolidado, familias: familiasActualizadas }).prioridadSugerida);
"
```

Salida observada:

```text
1) Local riesgoEstructural=true: {
  prioridadSugerida: 'CRITICA',
  factoresGatillantes: [ 'Riesgo de colapso estructural o remoción' ]
}
2) Tras decrementar electrodependiente de 1 a 0 en unica familia:
   consolidado.personasElectrodependientes = 1
   prioridadSugerida resultante = CRITICA
```

Reproducción de amnesia al hidratar desde `reportesTerreno` en formato real de `sgrai-api` (`BUG-H38-PWA-02`):

```bash
npx tsx -e "
import { obtenerReportesPrioridadMision } from './src/services/prioridadService';
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
console.log(JSON.stringify(obtenerReportesPrioridadMision(misionConReporteApi as never)[0]?.evaluacion, null, 2));
"
```

Salida observada (contadores, riesgos y nivel de compromiso perdidos):

```json
{
  "familias": [
    {
      "id": "fam-1",
      "referencia": "",
      "nucleoFamiliarTotal": 4,
      "cantidadNinos": 0,
      "cantidadAdultosMayores": 0,
      "personasDiscapacitadas": 0,
      "personasElectrodependientes": 0,
      "mascotasAfectadas": 0,
      "nivelCompromisoVivienda": "SIN_DANO",
      "requiereAsistenciaSocial": false
    }
  ],
  "nucleoFamiliarTotal": 4,
  "cantidadNinos": 0,
  "cantidadAdultosMayores": 0,
  "personasDiscapacitadas": 0,
  "personasElectrodependientes": 0,
  "mascotasAfectadas": 0,
  "viviendasAfectadas": 1,
  "nivelCompromisoVivienda": "SIN_DANO",
  "riesgoElectrico": false,
  "riesgoEstructural": false,
  "riesgoQuimicoSanitario": false,
  "aislamientoVial": false,
  "requiereEvacuacion": false,
  "requiereAsistenciaSocial": false,
  "requiereApoyoAdicional": false,
  "detallesAdicionales": "Adulto mayor en segundo piso"
}
```

### 5.4 Evidencia cURL en vivo (`sgrai-api` en `:3001` y `sgrai-pwa` en `:3002`)

1. **Verificación del esquema OpenAPI en `sgrai-api`:**

```bash
curl -s http://localhost:3001/openapi.json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('OpenAPI paths:', Object.keys(d.paths).filter(k=>k.includes('prioridad'))); console.log('Response keys:', Object.keys(d.components.schemas.ActualizarPrioridadIncidenteResponse.properties.data.properties));"
```

Respuesta observada:

```text
OpenAPI paths: [
  '/api/incidentes/{id}/prioridad/calcular',
  '/api/incidentes/{id}/prioridad'
]
Response keys: [ 'incidente', 'reporteTerreno', 'hito' ]
```

2. **Autenticación de Patrulla Verificadora y usuario Call Center:**

```bash
LOGIN_PAT=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"pedro.patrulla@valdivia.cl","password":"Valdivia2026!"}')
TOKEN_PAT=$(echo "$LOGIN_PAT" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data?.token || '')")

LOGIN_CC=$(curl -s -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"callcenter@valdivia.cl","password":"Valdivia2026!"}')
TOKEN_CC=$(echo "$LOGIN_CC" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data?.token || '')")
```

Consulta de perfil activo (`GET /api/seguridad/usuario-activo`):

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3001/api/seguridad/usuario-activo \
  -H "Authorization: Bearer $TOKEN_PAT"
```

Respuesta observada:

```json
{"data":{"id":"d1000000-0000-4000-8000-000000000001","rut":"17888999-1","nombre":"Pedro Valenzuela","email":"pedro.patrulla@valdivia.cl","activo":true,"delegacionId":"30000000-0000-4000-8000-000000000001","delegacionNombre":"Delegación Municipal Norte","rol":{"id":"20000000-0000-4000-8000-000000000004","nombre":"Patrulla Verificadora","codigo":"PATRULLA_VERIFICADORA","esAdmin":false},"permisos":["misiones:terreno:verificar"],"unidadId":"f1000000-0000-4000-8000-000000000010","unidadNombre":"Patrulla Rápida Las Ánimas","unidadActiva":true}}
HTTP_STATUS:200
```

3. **Petición sin token (`401 Unauthorized`):**

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH \
  http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad \
  -H "Content-Type: application/json" \
  -d '{"prioridad":"ALTA"}'
```

Respuesta observada:

```json
{"message":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
HTTP_STATUS:401
```

4. **Petición con rol `CALL_CENTER` sin permiso `misiones:terreno:verificar` (`403 Forbidden`):**

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH \
  http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_CC" \
  -d '{"prioridad":"ALTA","prioridadSugerida":"ALTA"}'
```

Respuesta observada:

```json
{"message":"No cuenta con el permiso requerido: misiones:terreno:verificar"}
HTTP_STATUS:403
```

5. **Discrepancia respecto a `prioridadSugerida` con justificación `< 5` caracteres y sin justificación (`400 Bad Request`):**

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH \
  http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_PAT" \
  -d '{"prioridad":"CRITICA","prioridadSugerida":"MEDIA","justificacionPrioridad":"abc"}'
```

Respuesta observada:

```json
{"message":"Datos de entrada inválidos para la evaluación y asignación de prioridad del incidente.","errors":[{"campo":"justificacion_prioridad","mensaje":"Debe ingresar una justificación técnica de al menos 5 caracteres cuando modifica la prioridad sugerida por el sistema."}]}
HTTP_STATUS:400
```

6. **Validación de UUID inválido (`400 Bad Request`):**

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH \
  http://localhost:3001/api/incidentes/no-es-uuid/prioridad \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_PAT" \
  -d '{"prioridad":"ALTA"}'
```

Respuesta observada:

```json
{"message":"El identificador del incidente proporcionado no es un UUID válido.","errors":[{"campo":"id","mensaje":"El identificador del incidente debe ser un UUID válido."}]}
HTTP_STATUS:400
```

7. **Cálculo preliminar de prioridad sugerida en `sgrai-api` (`200 OK`) evidenciando divergencia (`BUG-H38-PWA-05`):**

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST \
  http://localhost:3001/api/incidentes/a1000000-0000-4000-8000-000000000003/prioridad/calcular \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_PAT" \
  -d '{"nucleoFamiliarTotal":0,"cantidadNinos":0,"cantidadAdultosMayores":0,"personasDiscapacitadas":0,"personasElectrodependientes":0,"mascotasAfectadas":0,"viviendasAfectadas":1,"nivelCompromisoVivienda":"SIN_DANO","riesgoElectrico":false,"riesgoEstructural":true,"riesgoQuimicoSanitario":false,"aislamientoVial":false,"requiereEvacuacion":false,"requiereAsistenciaSocial":false}'
```

Respuesta observada:

```json
{"message":"Prioridad sugerida calculada exitosamente según evaluación de terreno.","data":{"incidenteId":"a1000000-0000-4000-8000-000000000003","prioridadActual":"ALTA","prioridadSugerida":"MEDIA","puntajeTotal":25,"factoresGatillantes":["Riesgo estructural / peligro de colapso activo (+25 pts)"],"requiereAsistenciaSocialSugerido":false,"evaluacionNormalizada":{"nucleoFamiliarTotal":0,"familiasAfectadas":0,"cantidadNinos":0,"cantidadAdultosMayores":0,"personasDiscapacitadas":0,"personasElectrodependientes":0,"mascotasAfectadas":0,"viviendasAfectadas":1,"nivelCompromisoVivienda":"SIN_DANO","requiereEvacuacion":false,"requiereAsistenciaSocial":false,"requiereApoyoAdicional":false,"riesgosActivos":{"riesgoElectrico":false,"riesgoEstructural":true,"riesgoQuimicoSanitario":false,"aislamientoVial":false},"detallesAdicionales":null,"accionesRealizadas":null,"danosEstimados":null}}}
HTTP_STATUS:200
```

8. **Redirección perimetral de ruta protegida en `sgrai-pwa` (`:3002`):**

```bash
curl -s -i http://localhost:3002/terreno/patrulla/misiones | head -n 6
curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" http://localhost:3002/terreno/login
```

Salida observada:

```text
HTTP/1.1 307 Temporary Redirect
location: /terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones
...
HTTP_STATUS:200
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación / Regla (HU-38) | Responsabilidad Arquitectónica | Cobertura / Hallazgo en `sgrai-pwa` | Estado | Referencia |
|---|---|---|---|---|
| **CA-1:** Mostrar de forma visible `prioridad_sugerida` preliminar | `sgrai-pwa` + `sgrai-api` | Desplegada en `EvaluacionPrioridadCard`, pero diverge entre algoritmo offline (`prioridad.ts`) y endpoint `POST /prioridad/calcular` online (`sgrai-api`), además de fallar al decrementar en familia única | **Observado** | `CP-H38-PWA-01`, `CP-H38-PWA-03`, `BUG-H38-PWA-03`, `BUG-H38-PWA-05` |
| **CA-2:** Selector con los 4 niveles canónicos (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) | `sgrai-pwa` | Selector táctil `radiogroup` implementado con los 4 niveles canónicos (`min-height: 52px`), bordes rectos y alto contraste | **Aprobado** | `CP-H38-PWA-02`, `CP-H38-PWA-06` |
| **CA-3:** Campo obligatorio `justificacion_prioridad` (`>= 5` chars) al modificar sugerida | `sgrai-pwa` + `sgrai-api` | Despliegue condicional y validación Zod operativos (`>= 5` chars); resta corregir estado al decrementar/colapsar y `maxLength` en referencia | **Aprobado con observaciones** | `CP-H38-PWA-02`, `CP-H38-PWA-11`, `BUG-H38-PWA-03`, `BUG-H38-PWA-06` |
| **CA-4:** Actualización transaccional de `incidente.prioridad`, `justificacion_prioridad` y `mision_hito` | `sgrai-api` (transacción) + `sgrai-pwa` (contrato/offline) | Falla en cliente al omitir `familias` en `PATCH`, leer `data.reporte` en vez de `data.reporteTerreno`, no extraer `detallesEvaluacion` y omitir `AJUSTAR_PRIORIDAD` en `useConnectivity` | **Observado** | `CP-H38-PWA-07`, `CP-H38-PWA-08`, `CP-H38-PWA-10`, `BUG-H38-PWA-02`, `BUG-H38-PWA-04` |
| **CA-5:** Emisión WebSocket `incidente:actualizado` al Centro de Mando (badge Kanban) | `sgrai-api` + `sgrai-web` | Implementado en `sgrai-api` (`prioridad.service.ts`) y consumido en `sgrai-web` (`useEncargadoKanbanSocket.ts`). Fuera del cliente `sgrai-pwa` | **Verificado (externo a PWA)** | `CP-H38-PWA-09` |
| **CA-6:** Requerir permiso RBAC `misiones:terreno:verificar` | `sgrai-api` + `sgrai-pwa` | `sgrai-api` valida `401`/`403` correctamente, pero `sgrai-pwa` mantiene bypass fail-open `DEV_PATRULLA_TOKEN` en `prioridadService.ts` y no deshabilita `<EvaluacionPrioridadCard />` sin permiso | **Rechazado** | `BUG-H38-PWA-01`, `CP-H38-PWA-11` |
| **Estándares `AGENTS.md` / `GEMINI.md` (OpenAPI, Ergonomía, Tokens, Manual, Pruebas)** | `sgrai-pwa` | `api-generated.d.ts` sin regenerar, uso de `fetch()` crudo, controles `< 48px`, token `--color-border`, manual H38 desactualizado y sin pruebas de regresión de borde | **Rechazado** | `BUG-H38-PWA-02`, `BUG-H38-PWA-06`, `CP-H38-PWA-12` |

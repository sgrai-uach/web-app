# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-36 — Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (Frontend PWA)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Cliente Móvil de Terreno (PWA)**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Operaciones de Terreno / Patrulla Verificadora (`sgrai-pwa` — `/terreno/patrulla/misiones/[id]`).  
> **Historia de Usuario:** HU-36 — *"Como Patrulla verificadora Quiero confirmar y aceptar la misión asignada desde el dispositivo móvil para informar que el equipo se dirige al lugar. Para notificar a la central que la patrulla ha tomado conocimiento de la emergencia y va en trayecto para iniciar la evaluación."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Aplicación Auditada:** `sgrai-pwa` (`web-app` — Next.js 16.3.4 App Router + React 19.2.8 + TypeScript 5 + IndexedDB `idb` 8.0.2 + `openapi-fetch` 0.17.0 + `lucide-react` + Vitest 3.2.7 + React Testing Library).  
> **Rama Git Evaluada:** `feature/h36-patrulla-aceptar-mision`  
> **Commits Evaluados en el Ciclo de Re-Test:**  
> * `fix(auth): remover bypass dev-patrulla-token, validar RBAC estricto y mapear unidad activa (BUG-H36-PWA-01)`  
> * `fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05)`  
> * `fix(sync): disparar sincronización con pendientes online, reflejar estado syncing y deduplicar outbox (BUG-H36-PWA-04)`  
> * `test(h36): añadir pruebas de regresión para QA Code Review HU-36`  
> * `merge: actualizar rama con origin/develop resolviendo conflictos`  
>  
> **Fecha de Auditoría Inicial:** 09/11/2026 12:38.  
> **Fecha de Ciclo Re-Test Final:** 12/11/2026 15:13.  
> **Estado de Certificación:** 🟢 **APROBADO PARA INTEGRACIÓN EN DEVELOP (`5` de `5` Defectos Corregidos; `25` de `25` Casos Aprobados — 100% Pass)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras la ejecución del ciclo formal de **Re-Test** sobre la rama `feature/h36-patrulla-aceptar-mision` en el repositorio `sgrai-pwa` (`web-app`), se constató la resolución satisfactoria de la totalidad de los 5 defectos detectados en la auditoría inicial (`BUG-H36-PWA-01` a `BUG-H36-PWA-05`).

Las correcciones implementadas eliminaron por completo las brechas de seguridad y autenticación (remoción de credenciales de bypass y modo demo en cliente, verificación estricta del permiso `misiones:terreno:verificar` sin fallback permisivo y mapeo fidedigno de la unidad operativa en sesión), blindaron la consistencia de datos Offline-First en IndexedDB (`idb`) asegurando que `obtenerDetalleMision` y `sincronizarMisiones` preserven las mutaciones optimistas pendientes en `outbox` sin regresar destructivamente a `DESPACHADA`, eliminaron toda inyección de datos ficticios hardcodeados en los componentes de detalle y listado, restringieron la idempotencia ante respuestas `409 Conflict` únicamente cuando el conflicto confirme que la misión ya se encuentra en `EN_CURSO` (rechazando misiones canceladas o completadas), automatizaron el vaciado de la cola `outbox` cuando existe conectividad activa (`navigator.onLine === true`) con reflejo exacto del estado en `ConnectionStatusBadge` y deduplicación por `(tipo, url)`, incorporaron el filtro `patrullaId` en las consultas de misiones de terreno y subsanaron la totalidad de advertencias del linter ESLint.

| Métrica de Calidad | Resultado de Auditoría Inicial (09/11) | Resultado Ciclo Re-Test (12/11) | Observaciones Técnicas |
|---|:---:|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | **25** | 5 Defectos Verificados (`BUG-H36-PWA-01` a `05`) + 20 Casos Base (`CP-H36-PWA-01` a `20`) |
| **Casos Aprobados (Passed)** | 20 | **25** | **100.0% de efectividad de pruebas en Re-Test** |
| **Defectos Abiertos / Fallidos (Failed)** | 5 (2 críticos, 2 altos, 1 medio) | **0** | **5 de 5 defectos corregidos y verificados** |
| **Casos Bloqueados (Blocked)** | 0 | **0** | Sin bloqueos en entorno de ejecución |
| **Tasa de Aprobación (% Pass)** | 80.0% | **100.0%** | **Criterio de salida de calidad alcanzado para integración en `develop`** |
| **Suite Automatizada HU-36 (Vitest)** | 20 tests pass (4 suites) | **30 tests pass (5 suites)** | Incremento de 10 tests de regresión cubriendo los 5 defectos (`PatrullaDetailPage`, `misionesService`, `offlineQueue`, `useConnectivity`, `PatrullaMisionesPage`) |
| **Suite Global de la PWA (Vitest)** | 81 tests pass (26 suites) | **106 tests pass (28 suites)** | 100% de suites en verde sin regresiones funcionales ni colisiones con HU-85 |
| **Análisis Estático ESLint (`npm run lint`)** | 4 advertencias | **0 errores / 0 advertencias** | Limpieza total de advertencias `@next/next/no-location-assign-relative-destination` |
| **Comprobación de Tipos TypeScript (`tsc --noEmit`)** | Aprobado | **0 errores de compilación** | Contratos tipados contra OpenAPI generado en `api-generated.d.ts` |

---

## 2. Registro Técnico de Defectos y Verificación de Soluciones en Re-Test

### `BUG-H36-PWA-01`: Bypass de Autenticación y RBAC en Producción Mediante `'dev-patrulla-token'`, Enmascaramiento de Errores HTTP `401`/`403`/`404` como Éxito en `aceptarMisionPatrulla` y Evaluación Permisiva de `misiones:terreno:verificar` y `unidadActiva`
* **Severidad:** **CRÍTICA** (Vulnerabilidad de Seguridad / Bypass de Autenticación, RBAC e Integridad Operativa).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/app/(auth)/login/page.tsx`
  * `src/context/AuthContext.tsx`
  * `src/lib/api/client.ts`
  * `src/services/misionesService.ts`
  * `src/types/seguridad.ts`
* **Commit de Solución:** `fix(auth): remover bypass dev-patrulla-token, validar RBAC estricto y mapear unidad activa (BUG-H36-PWA-01)`
* **Verificación Técnica en Re-Test:**  
  1. Se eliminó por completo el botón `"Acceso Rápido Patrulla (Prueba Local)"`, la función `handleAccesoRapidoPatrulla` y la referencia al token `'dev-patrulla-token'` en `src/app/(auth)/login/page.tsx`.
  2. En `src/context/AuthContext.tsx`, se removieron `PERFIL_DEMO_PATRULLA` y el bypass en `recargarSesion`. Se eliminó la cláusula permisiva `(listaPermisos.length === 0 && permiso === 'misiones:terreno:verificar')`, exigiendo la inclusión explícita del permiso en la lista (`listaPermisos.includes('misiones:terreno:verificar')` o `*`).
  3. En `src/types/seguridad.ts` y `AuthContext.tsx`, se añadieron `unidadId`, `unidadNombre` y `unidadActiva` en `UsuarioActivoDetalle`, mapeándolos fidedignamente en `mapDetalleAUsuarioPerfil`. La variable `unidadActiva` se fijó como `Boolean(usuario && usuario.unidadActiva !== false)`.
  4. En `src/lib/api/client.ts`, se eliminaron `DEV_PATRULLA_TOKEN`, `DEV_PATRULLA_USER_ID` y las excepciones en `handleUnauthorizedSession` y `onRequest`.
  5. En `src/services/misionesService.ts`, se eliminó el bloque `esModoDemoLocal`, lanzando estrictamente `MisionServiceError` ante códigos HTTP `400`, `401`, `403`, `404` y `422`.

---

### `BUG-H36-PWA-02`: Sobrescritura Destructiva del Estado Optimista Offline (`EN_CURSO` a `DESPACHADA`) en `obtenerDetalleMision` / `sincronizarMisiones` e Inyección de Misiones Ficticias Hardcodeadas en Producción
* **Severidad:** **CRÍTICA** (Pérdida de Consistencia Offline-First en IndexedDB y Corrupción de Datos en Interfaz).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/services/misionesService.ts`
  * `src/app/(terreno)/patrulla/misiones/[id]/page.tsx`
  * `src/app/(terreno)/patrulla/misiones/page.tsx`
* **Commit de Solución:** `fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05)`
* **Verificación Técnica en Re-Test:**  
  1. En `src/services/misionesService.ts`, dentro de `obtenerDetalleMision` y `sincronizarMisiones`, se implementó la comprobación previa en IndexedDB mediante `obtenerMisionLocalPorId(id)`: si el registro local posee `sincronizacionPendiente === true` y la API remota aún devuelve `estado === 'DESPACHADA'`, se define `mantenerOptimista = true`, preservando `estado: previa.estado` (`EN_CURSO`), `fechaInicio: previa.fechaInicio` y `sincronizacionPendiente: true`.
  2. En `src/app/(terreno)/patrulla/misiones/[id]/page.tsx`, se removió la construcción de misiones sintéticas en `'Av. Alemania 600'` cuando `obtenerDetalleMision` retorna `null`, desplegando en su lugar la vista formal de `"Misión no encontrada"` (`role="alert"`).
  3. En `src/app/(terreno)/patrulla/misiones/page.tsx`, se suprimió la inyección de misiones ficticias `60000000-0000-4000-8000-000000000001` cuando `locales.length === 0`, habilitando el renderizado del estado vacío oficial `"Sin registros disponibles — La patrulla se encuentra disponible para despacho."`.

---

### `BUG-H36-PWA-03`: Transición Inválida a `'EN_CURSO'` ante Cualquier Respuesta `409 Conflict` (o `422`) en `aceptarMisionPatrulla` y `useConnectivity` Cuando la Misión Fue Cancelada, Rechazada o Completada
* **Severidad:** **ALTA** (Violación de Reglas de Negocio del Sistema de Comando de Incidentes — ICS).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/services/misionesService.ts`
  * `src/hooks/useConnectivity.ts`
* **Commit de Solución:** `fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05)`
* **Verificación Técnica en Re-Test:**  
  1. En `src/services/misionesService.ts` (`aceptarMisionPatrulla`), ante un código `409 Conflict`, se verifica el mensaje del servidor: si no contiene la cadena `/EN_CURSO/i`, se invoca `obtenerDetalleMision(misionId)` para actualizar el estado real del servidor y se lanza `MisionServiceError(409, msgConflict)`, impidiendo que una misión cancelada, cerrada o completada mute a `EN_CURSO`.
  2. En `src/hooks/useConnectivity.ts` (`sincronizarColaOutbox`), se discriminaron las respuestas `409`: solo se actualiza a `EN_CURSO` si `esIdempotenteEnCurso` es verdadero (`/EN_CURSO/i.test(msg)`). Si es un conflicto terminal (`esConflictoTerminal`), se elimina la bandera `sincronizacionPendiente` y se invoca `obtenerDetalleMision(misionId)` para refrescar el estado fidedigno desde el servidor. Los códigos `422` se tratan como errores irrecuperables sin forzar `EN_CURSO`.

---

### `BUG-H36-PWA-04`: Falta de Disparo de `sincronizar()` con Conexión Activa, Falso Indicador `'Sincronizado'` en `ConnectionStatusBadge` con Cola Pendiente, y Ausencia de Deduplicación en `outbox`
* **Severidad:** **ALTA** (Fallo de Sincronización Diferida Offline-First e Inconsistencia de Estado Visual).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/hooks/useConnectivity.ts`
  * `src/services/offlineQueue.ts`
* **Commit de Solución:** `fix(sync): disparar sincronización con pendientes online, reflejar estado syncing y deduplicar outbox (BUG-H36-PWA-04)`
* **Verificación Técnica en Re-Test:**  
  1. En `src/hooks/useConnectivity.ts`, se implementó la función `verificarYSincronizar` apoyada en `sincronizandoRef` (bloqueo contra concurrencia), la cual se ejecuta al montar el hook y en cada ciclo del temporizador de 15 segundos: si `navigator.onLine && total > 0 && !sincronizandoRef.current`, se invoca `sincronizar()` de forma inmediata.
  2. En el cálculo de `status` dentro de `useConnectivity.ts`, se agregó la condición `else if (pendientes > 0) { status = 'syncing'; }`, garantizando que `ConnectionStatusBadge` muestre `"Sincronizando (X pendientes)..."` en lugar de `"Sincronizado"` mientras existan tareas en cola.
  3. En `src/services/offlineQueue.ts` (`encolarAccionOutbox`), se incorporó la deduplicación buscando acciones existentes con igual `tipo` y `url`: si ya existe una acción coincidente, se actualiza su payload y timestamp preservando su identificador sin generar duplicados.

---

### `BUG-H36-PWA-05`: Omisión del Filtro `patrullaId` en `PatrullaMisionesPage` y `TerrenoSiguienteMision` y Advertencias de Análisis Estático ESLint (`@next/next/no-location-assign-relative-destination`)
* **Severidad:** **MEDIA** (Filtrado Operativo Incompleto de Misiones por Unidad y Deuda de Calidad en Linter).
* **Estado en Re-Test:** 🟢 **CORREGIDO / APROBADO**.
* **Archivos Modificados:**
  * `src/app/(terreno)/patrulla/misiones/page.tsx`
  * `src/components/terreno/TerrenoSiguienteMision.tsx`
  * `src/app/(auth)/login/page.tsx`
  * `src/app/(terreno)/page.tsx`
  * `src/context/AuthContext.tsx`
  * `src/lib/api/client.ts`
* **Commit de Solución:** `fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05)`
* **Verificación Técnica en Re-Test:**  
  1. En `PatrullaMisionesPage` y `TerrenoSiguienteMision`, se agregó el parámetro `patrullaId: usuario?.unidadId || undefined` en las llamadas a `sincronizarMisiones`, asegurando que las patrullas únicamente listen y sincronicen las misiones que les han sido asignadas.
  2. Se sustituyó la navegación imperativa con strings relativos en `window.location.assign(...)` por URLs absolutas construidas con `new URL(destino, window.location.origin).toString()`, eliminando las 4 advertencias reportadas por ESLint. La ejecución de `npm run lint` finaliza con código `0` sin observaciones.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H36-PWA-01` | Bypass de autenticación y RBAC mediante dev-patrulla-token, enmascaramiento de errores 401/403/404 como éxito y fallback permisivo de misiones:terreno:verificar | Seguridad / RBAC | Integración / Auth / Servicio | Crítica | Acceso a `/terreno/login` o sesión de patrulla con `permisos: []` | Intento de login sin credenciales e invocación a `aceptarMisionPatrulla` con respuesta `403` o `404` | Puerta trasera eliminada; `401`/`403`/`404` lanzan `MisionServiceError` y `tienePermiso('misiones:terreno:verificar')` retorna `false` si `permisos` no lo incluye | Bypass eliminado; errores HTTP lanzan excepción controlada y validación RBAC estricta verificada | APROBADO | 09/11/2026 12:34 | 12/11/2026 15:13 | fix(auth): remover bypass dev-patrulla-token, validar RBAC estricto y mapear unidad activa (BUG-H36-PWA-01) |
| `BUG-H36-PWA-02` | Sobrescritura destructiva del estado optimista EN_CURSO en obtenerDetalleMision / sincronizarMisiones e inyección de misiones ficticias en producción | Funcional / Offline-First | Servicio / UI / IndexedDB | Crítica | Misión aceptada offline (`estado: 'EN_CURSO'`, `sincronizacionPendiente: true`) o patrulla sin misiones asignadas (`data: []`) | `obtenerDetalleMision(id)` / `sincronizarMisiones()` antes de vaciar `outbox`, o carga de `/terreno/patrulla/misiones` con `[]` | Preservar estado optimista `EN_CURSO` con `sincronizacionPendiente: true` hasta vaciar `outbox`, y mostrar estado vacío cuando la API retorna `[]` | Estado optimista local preservado ante respuestas desactualizadas del servidor; datos ficticios removidos y estados vacíos reales validados | APROBADO | 09/11/2026 12:35 | 12/11/2026 15:13 | fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05) |
| `BUG-H36-PWA-03` | Transición inválida a EN_CURSO ante cualquier respuesta 409 Conflict o 422 en aceptarMisionPatrulla y useConnectivity cuando la misión fue cancelada o cerrada | Regla de Negocio ICS | Servicio / Hook Offline | Alta | Misión en estado `CANCELADA`, `COMPLETADA` o `RECHAZADA` en el servidor que responde `409 Conflict` | `POST /api/misiones/{id}/aceptar` retornando `409 Conflict` (`"La misión no puede ser aceptada porque su estado actual es 'CANCELADA'"`) | Rechazar la transición lanzando `MisionServiceError(409)` y actualizar al estado real de la misión sin habilitar formularios técnicos | Lanza excepción `409` ante misiones canceladas o cerradas; sincroniza estado real del servidor y no habilita formularios técnicos | APROBADO | 09/11/2026 12:36 | 12/11/2026 15:13 | fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05) |
| `BUG-H36-PWA-04` | Falta de ejecución automática de sincronizar() cuando navigator.onLine es true, falso badge Sincronizado con pendientes > 0 y duplicados en outbox | Offline-First / Sincronización | Hook / IndexedDB / UI | Alta | Fallo de red transitorio con `navigator.onLine === true` y `pendientes === 1` en `outbox` | `useConnectivity()` montado con `online: true` y acción `ACEPTAR_MISION` en `outbox` | Disparar `sincronizar()` automáticamente cuando `online && pendientes > 0`, mostrar estado syncing en `ConnectionStatusBadge` y deduplicar `outbox` | Sincronización automática periódica y al montar verificada; badge refleja `syncing` y mutaciones en `outbox` se deduplican limpiamente | APROBADO | 09/11/2026 12:37 | 12/11/2026 15:13 | fix(sync): disparar sincronización con pendientes online, reflejar estado syncing y deduplicar outbox (BUG-H36-PWA-04) |
| `BUG-H36-PWA-05` | Omisión del filtro patrullaId en PatrullaMisionesPage y TerrenoSiguienteMision y 4 advertencias ESLint por uso de window.location.assign | Funcional / Calidad de Código | UI / Servicio / Linter | Media | Usuario patrulla autenticado y ejecución de `npm run lint` | `sincronizarMisiones({ tipoMision: 'VERIFICACION', patrullaId })` y comando `npm run lint` | Filtrar petición por `patrullaId` de la unidad activa y obtener `0 warnings` en ESLint | Parámetro `patrullaId` enviado a la API y 0 advertencias de ESLint en todo el repositorio | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05) |
| `CP-H36-PWA-01` | Renderizado prominente del botón 'Aceptar Misión' cuando la misión está en estado DESPACHADA, unidadActiva es true y posee el permiso misiones:terreno:verificar | Funcional / UI (CA-1, CA-7) | Componente / Integración | Crítica | Misión `60000000-0000-4000-8000-000000000001` en `DESPACHADA`, `unidadActiva: true` y permiso `misiones:terreno:verificar` | Renderizado de `PatrullaMisionDetailPage` con misión `DESPACHADA` | Se muestra la tarjeta `"Confirmación de salida a terreno"` con el botón táctil `"Aceptar Misión"` (`min-height: 56px`) y los formularios técnicos permanecen ocultos | Botón `"Aceptar Misión"` visible y accesible; sección `formularios-reporte-tecnico` no renderizada antes de aceptar | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-02` | Ocultamiento del botón 'Aceptar Misión' cuando el usuario no posee el permiso RBAC misiones:terreno:verificar | Seguridad / RBAC (CA-7) | Componente / UI | Crítica | Misión en `DESPACHADA` y `tienePermiso('misiones:terreno:verificar') === false` | Renderizado de `PatrullaMisionDetailPage` con `permisoVerificar: false` | El botón `"Aceptar Misión"` no se renderiza en el DOM | `queryByRole('button', { name: /aceptar misión/i })` retorna `null` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-03` | Ocultamiento del botón 'Aceptar Misión' y activación de modo solo lectura cuando la patrulla está inactiva (unidadActiva: false) | Regla de Negocio / UI | Componente / UI | Alta | Patrulla desactivada (`unidadActiva: false`) | Renderizado de `PatrullaMisionDetailPage` con `unidadActiva: false` | Muestra `UnidadInactivaBanner`, aviso `"Solo lectura"` y oculta el botón `"Aceptar Misión"` | Banner de unidad inactiva y aviso de solo lectura presentes; botón de aceptación oculto | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-04` | Invocación del endpoint POST /api/misiones/{id}/aceptar con coordenadas GPS válidas al presionar 'Aceptar Misión' en modo online (200 OK) | Funcional / Integración (CA-2) | Servicio / API Client | Crítica | `navigator.onLine = true`, misión `60000000-0000-4000-8000-000000000001` en `DESPACHADA` | `aceptarMisionPatrulla(id, { coordenadas: { latitud: -39.819588, longitud: -73.245209 } })` | `apiClient.POST` invocado hacia `/api/misiones/{id}/aceptar` con `params.path.id` y `body: { latitud: -39.819588, longitud: -73.245209 }` | Petición enviada con la ruta y payload tipados, retornando `enColaOffline: false` y `estado: 'EN_CURSO'` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-05` | Transición de la vista a 'En Trayecto / Evaluación' y habilitación de 'Formularios de Reporte Técnico' tras aceptar la misión | Funcional / UI (CA-6) | Componente / Integración | Crítica | Misión en estado `DESPACHADA` aceptada por el operador | Clic en botón `"Aceptar Misión"` en `PatrullaMisionDetailPage` | Desaparece el botón `"Aceptar Misión"`, se despliega el encabezado `"En Trayecto / Evaluación"` con chip `"Misión activa"` y se habilita `data-testid="formularios-reporte-tecnico"` | Transición de pantalla completada mostrando `"En Trayecto / Evaluación"` y `"Formularios de Reporte Técnico"` con chip `"Habilitado"` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-06` | Visualización de los estados canónicos ICS en terreno: Misión 'En curso', Patrulla 'En verificación' e Incidente 'Verificando' (sin estado ambiguo 'En camino') | Regla de Negocio ICS (CA-4) | Componente / Servicio | Crítica | Misión aceptada en estado `EN_CURSO` | Inspección de grilla `.canonicalStatesGrid` y `datosAdicionales` tras aceptar misión | Muestra `Misión: En curso`, `Patrulla: En verificación` (`EN_VERIFICACION`) e `Incidente: Verificando` (`VERIFICANDO`) | Se renderizan exactamente los tres estados canónicos ICS sin utilizar el texto no canónico `'En camino'` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-07` | Actualización de la etiqueta y marca temporal a 'Inicio de trayecto' con fechaInicio retornada por el servidor | Funcional / UI (CA-3) | Componente / Servicio | Alta | Respuesta `200 OK` de `POST /api/misiones/{id}/aceptar` con `fechaInicio: "2026-11-01T21:00:00.000Z"` | `aceptarMisionPatrulla` y renderizado de ficha superior en `PatrullaMisionDetailPage` | `mision.fechaInicio` toma el timestamp del servidor y la etiqueta cambia de `"Despachada"` a `"Inicio de trayecto"` en formato 24h | `resultado.mision.fechaInicio` actualizado a `"2026-11-01T21:00:00.000Z"` y persistido en IndexedDB | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-08` | Obtención no bloqueante de coordenadas GPS con timeout de 5 segundos (obtenerCoordenadasOpcionales) enviando {} si el GPS no responde | Robustez / Terreno | Servicio | Alta | Dispositivo sin API `navigator.geolocation` o con demora superior a `timeoutMs` | `obtenerCoordenadasOpcionales(10)` sin respuesta del hardware GPS | Resuelve `{}` al cumplirse el timeout sin bloquear ni rechazar la promesa de aceptación de misión | Retorna `{}` de forma segura tras el timeout configurado | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-09` | Validación de rangos geográficos WGS84 del payload de coordenadas antes de enviar o encolar en IndexedDB (validarPayloadAceptarMision) | Validación / Contrato | Servicio | Media | Coordenadas válidas `{ latitud: -39.81, longitud: -73.24 }` vs fuera de rango `{ latitud: 999, longitud: -73.24 }` | `validarPayloadAceptarMision(coords)` | Conserva coordenadas dentro de `[-90, 90]` / `[-180, 180]` y descarta valores fuera de rango o no numéricos | Retorna `{ latitud: -39.81, longitud: -73.24 }` para datos válidos y `{}` para `latitud: 999` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-10` | Aceptación optimista en modo offline guardando estado EN_CURSO en IndexedDB y encolando acción ACEPTAR_MISION en outbox | Offline-First / Persistencia | Servicio / IndexedDB | Crítica | Sin conexión (`navigator.onLine = false` o `TypeError: Failed to fetch`) | `aceptarMisionPatrulla(misionId, { coordenadas: { latitud: -39.814, longitud: -73.245 } })` | Guarda misión en IndexedDB con `estado: 'EN_CURSO'` y `sincronizacionPendiente: true`, y encola en `outbox` `{ tipo: 'ACEPTAR_MISION', url: '/api/misiones/{id}/aceptar', metodo: 'POST', payload }` | Misión persistida localmente como `EN_CURSO` con `sincronizacionPendiente: true` y acción `ACEPTAR_MISION` registrada en `outbox` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-11` | Visualización del banner de cola local 'Pendiente de sincronizar' en modo offline y su limpieza al recibir el evento sgrai:outbox-synced | Offline-First / UI | Componente / Integración | Alta | Misión aceptada en modo offline (`sincronizacionPendiente: true`) | Disparo de clic en `"Aceptar Misión"` offline seguido de `window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'))` | Muestra el banner `"Pendiente de sincronizar: La aceptación fue guardada en la cola local..."` y lo oculta automáticamente tras sincronizar la cola | Banner renderizado en modo offline y removido del DOM al completarse el evento `sgrai:outbox-synced` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36) |
| `CP-H36-PWA-12` | Sincronización diferida de la cola outbox en IndexedDB al recuperar conectividad (sincronizarColaOutbox) | Offline-First / Cola Outbox | Servicio / Hook | Crítica | Acción `ACEPTAR_MISION` almacenada en el objectStore `outbox` de `sgrai_terreno_offline_db` | `sincronizarColaOutbox(ejecutorHttp)` y evento `window` `'online'` en `useConnectivity` | Ejecuta el `POST` diferido, elimina la acción del store `outbox` cuando retorna `true` y actualiza `sincronizacionPendiente: false` con la `fechaInicio` del servidor | Acción procesada y eliminada de `outbox`, dejando `contarAccionesPendientes() === 0` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-13` | Rechazo explícito sin encolar en outbox cuando el backend retorna 403 Forbidden por falta de permiso o pertenencia a otra patrulla | Seguridad / Manejo de Errores | Servicio / UI | Alta | Usuario con sesión JWT válida al que la API responde `403 Forbidden` | `aceptarMisionPatrulla(misionId)` con respuesta `403` (`"No cuenta con el permiso misiones:terreno:verificar"`) | Lanza `MisionServiceError` con `statusCode: 403`, muestra alerta `.errorAlert` (`role="alert"`) en la vista y NO encola la acción en `outbox` | Lanza `MisionServiceError` y `encolarAccionOutbox` no es invocado | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36) |
| `CP-H36-PWA-14` | Manejo idempotente cuando la misión ya había sido aceptada previamente en el servidor (409 Conflict por estado EN_CURSO) | Concurrencia / Idempotencia | Servicio | Alta | Misión ya en estado `EN_CURSO` en el backend por doble clic o reintento de red | `aceptarMisionPatrulla(misionId)` con respuesta `409` confirmando que la misión ya está `EN_CURSO` | Retorna `yaAceptadaPreviamente: true`, `enColaOffline: false` y `mision.estado: 'EN_CURSO'` sin encolar en `outbox` | Transiciona limpiamente a `EN_CURSO` con `yaAceptadaPreviamente: true` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-15` | Protección de rutas de terreno en middleware proxy redirigiendo a /terreno/login cuando no existe cookie sgrai_auth_token | Seguridad / Perímetro | Middleware Proxy | Alta | Petición HTTP sin cookie `sgrai_auth_token` hacia `/terreno/patrulla/misiones/{id}` | `GET http://localhost:3002/terreno/patrulla/misiones/68abde99-780d-41a9-aee6-f68371d226aa` sin cookies | HTTP `307 Temporary Redirect` hacia `/terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones%2F...` | Responde `HTTP/1.1 307 Temporary Redirect` con la cabecera `location` esperada | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-16` | Inyección de cabecera Authorization Bearer y extracción de x-user-id desde el payload JWT en el interceptor de apiClient | Seguridad / Cliente HTTP | API Client | Alta | Cookie `sgrai_auth_token` con un JWT válido | Petición mediante `apiClient.POST('/api/misiones/{id}/aceptar', ...)` | El interceptor `onRequest` adjunta `Authorization: Bearer <token>` y extrae `sub`/`usuarioId` en `x-user-id` | Cabeceras de autenticación inyectadas en la petición saliente | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-17` | Tipado estricto del contrato OpenAPI generado para POST /api/misiones/{id}/aceptar en src/types/api-generated.d.ts y src/types/offline.ts | Contrato OpenAPI | Tipos TypeScript | Alta | Esquema generado en `src/types/api-generated.d.ts` | Revisión de `paths['/api/misiones/{id}/aceptar']['post']` y `AceptarMisionPayload` | Tipos de entrada (`latitud`, `longitud`), parámetros (`id`) y respuestas (`200`, `400`, `401`, `403`, `404`, `409`, `500`) derivados de `api-generated.d.ts` sin interfaces manuales | `AceptarMisionPayload` y `AceptarMisionApiData` referencian directamente `paths['/api/misiones/{id}/aceptar']` | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-18` | Cumplimiento de estándares de diseño táctil para terreno: área mínima de 56px en botón 'Aceptar Misión', esquinas rectas (border-radius: 0) e íconos lucide-react | Usabilidad / Diseño Terreno | UI / CSS | Media | Hoja de estilos `PatrullaDetailPage.module.css` y componente `PatrullaMisionDetailPage` | Inspección de `.acceptButton`, `.acceptCard`, `.enTrayectoCard` e íconos `CheckCircle`, `Navigation`, `ClipboardCheck`, `WifiOff` | `.acceptButton` con `min-height: 56px`, `border-radius: 0`, paleta institucional (`--color-primary-teal`, `--color-accent-mint`, `--color-sage`, `--color-charcoal`) y 0 emojis | Estilos e íconos cumplen con la guía de diseño táctil de terreno | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-19` | Documentación del contrato de terreno en docs/api/contratos-terreno.md y manual de usuario en docs/manuals/H36-aceptar-mision-patrulla.md | Documentación | Documentación Técnica / Manual | Media | Archivos en `docs/api/contratos-terreno.md` y `docs/manuals/H36-aceptar-mision-patrulla.md` | Revisión de sección `2.1 Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (H36)` y manual paso a paso | Contrato HTTP, timeout GPS de 5s, comportamiento offline e idempotencia `409` documentados | Documentación técnica y manual de terreno incorporados en el repositorio | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | docs(patrulla): documentar contrato OpenAPI y manual de terreno para aceptar mision (H36) |
| `CP-H36-PWA-20` | Ejecución completa de la suite de pruebas unitarias y de integración de HU-36 en Vitest y React Testing Library | Automatización | Unit / Component / Service | Alta | Suite de pruebas en `sgrai-pwa` | `npm test -- src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx src/services/__tests__/misionesService.test.ts src/hooks/__tests__/useConnectivity.test.ts src/services/__tests__/offlineQueue.test.ts src/app/(terreno)/patrulla/misiones/__tests__/PatrullaMisionesPage.test.tsx` | 30/30 tests focalizados (y 106/106 tests globales en 28 archivos) aprobados sin errores | 30/30 tests focalizados y 106/106 tests totales aprobados | APROBADO | 09/11/2026 12:38 | 12/11/2026 15:13 | test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H36-PWA-01	Bypass de autenticación y RBAC mediante dev-patrulla-token, enmascaramiento de errores 401/403/404 como éxito y fallback permisivo de misiones:terreno:verificar	Seguridad / RBAC	Integración / Auth / Servicio	Crítica	Acceso a /terreno/login o sesión de patrulla con permisos: []	Intento de login sin credenciales e invocación a aceptarMisionPatrulla con respuesta 403 o 404	Puerta trasera eliminada; 401/403/404 lanzan MisionServiceError y tienePermiso('misiones:terreno:verificar') retorna false si permisos no lo incluye	Bypass eliminado; errores HTTP lanzan excepción controlada y validación RBAC estricta verificada	APROBADO	09/11/2026 12:34	12/11/2026 15:13	fix(auth): remover bypass dev-patrulla-token, validar RBAC estricto y mapear unidad activa (BUG-H36-PWA-01)
BUG-H36-PWA-02	Sobrescritura destructiva del estado optimista EN_CURSO en obtenerDetalleMision / sincronizarMisiones e inyección de misiones ficticias en producción	Funcional / Offline-First	Servicio / UI / IndexedDB	Crítica	Misión aceptada offline (estado: 'EN_CURSO', sincronizacionPendiente: true) o patrulla sin misiones asignadas (data: [])	obtenerDetalleMision(id) / sincronizarMisiones() antes de vaciar outbox, o carga de /terreno/patrulla/misiones con []	Preservar estado optimista EN_CURSO con sincronizacionPendiente: true hasta vaciar outbox, y mostrar estado vacío cuando la API retorna []	Estado optimista local preservado ante respuestas desactualizadas del servidor; datos ficticios removidos y estados vacíos reales validados	APROBADO	09/11/2026 12:35	12/11/2026 15:13	fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05)
BUG-H36-PWA-03	Transición inválida a EN_CURSO ante cualquier respuesta 409 Conflict o 422 en aceptarMisionPatrulla y useConnectivity cuando la misión fue cancelada o cerrada	Regla de Negocio ICS	Servicio / Hook Offline	Alta	Misión en estado CANCELADA, COMPLETADA o RECHAZADA en el servidor que responde 409 Conflict	POST /api/misiones/{id}/aceptar retornando 409 Conflict ("La misión no puede ser aceptada porque su estado actual es 'CANCELADA'")	Rechazar la transición lanzando MisionServiceError(409) y actualizar al estado real de la misión sin habilitar formularios técnicos	Lanza excepción 409 ante misiones canceladas o cerradas; sincroniza estado real del servidor y no habilita formularios técnicos	APROBADO	09/11/2026 12:36	12/11/2026 15:13	fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05)
BUG-H36-PWA-04	Falta de ejecución automática de sincronizar() cuando navigator.onLine es true, falso badge Sincronizado con pendientes > 0 y duplicados en outbox	Offline-First / Sincronización	Hook / IndexedDB / UI	Alta	Fallo de red transitorio con navigator.onLine === true y pendientes === 1 en outbox	useConnectivity() montado con online: true y acción ACEPTAR_MISION en outbox	Disparar sincronizar() automáticamente cuando online && pendientes > 0, mostrar estado syncing en ConnectionStatusBadge y deduplicar outbox	Sincronización automática periódica y al montar verificada; badge refleja syncing y mutaciones en outbox se deduplican limpiamente	APROBADO	09/11/2026 12:37	12/11/2026 15:13	fix(sync): disparar sincronización con pendientes online, reflejar estado syncing y deduplicar outbox (BUG-H36-PWA-04)
BUG-H36-PWA-05	Omisión del filtro patrullaId en PatrullaMisionesPage y TerrenoSiguienteMision y 4 advertencias ESLint por uso de window.location.assign	Funcional / Calidad de Código	UI / Servicio / Linter	Media	Usuario patrulla autenticado y ejecución de npm run lint	sincronizarMisiones({ tipoMision: 'VERIFICACION', patrullaId }) y comando npm run lint	Filtrar petición por patrullaId de la unidad activa y obtener 0 warnings en ESLint	Parámetro patrullaId enviado a la API y 0 advertencias de ESLint en todo el repositorio	APROBADO	09/11/2026 12:38	12/11/2026 15:13	fix(offline): preservar estado optimista, eliminar datos ficticios y validar conflicto 409 (BUG-H36-PWA-02, BUG-H36-PWA-03, BUG-H36-PWA-05)
CP-H36-PWA-01	Renderizado prominente del botón 'Aceptar Misión' cuando la misión está en estado DESPACHADA, unidadActiva es true y posee el permiso misiones:terreno:verificar	Funcional / UI (CA-1, CA-7)	Componente / Integración	Crítica	Misión 60000000-0000-4000-8000-000000000001 en DESPACHADA, unidadActiva: true y permiso misiones:terreno:verificar	Renderizado de PatrullaMisionDetailPage con misión DESPACHADA	Se muestra la tarjeta "Confirmación de salida a terreno" con el botón táctil "Aceptar Misión" (min-height: 56px) y los formularios técnicos permanecen ocultos	Botón "Aceptar Misión" visible y accesible; sección formularios-reporte-tecnico no renderizada antes de aceptar	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-02	Ocultamiento del botón 'Aceptar Misión' cuando el usuario no posee el permiso RBAC misiones:terreno:verificar	Seguridad / RBAC (CA-7)	Componente / UI	Crítica	Misión en DESPACHADA y tienePermiso('misiones:terreno:verificar') === false	Renderizado de PatrullaMisionDetailPage con permisoVerificar: false	El botón "Aceptar Misión" no se renderiza en el DOM	queryByRole('button', { name: /aceptar misión/i }) retorna null	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-03	Ocultamiento del botón 'Aceptar Misión' y activación de modo solo lectura cuando la patrulla está inactiva (unidadActiva: false)	Regla de Negocio / UI	Componente / UI	Alta	Patrulla desactivada (unidadActiva: false)	Renderizado de PatrullaMisionDetailPage con unidadActiva: false	Muestra UnidadInactivaBanner, aviso "Solo lectura" y oculta el botón "Aceptar Misión"	Banner de unidad inactiva y aviso de solo lectura presentes; botón de aceptación oculto	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-04	Invocación del endpoint POST /api/misiones/{id}/aceptar con coordenadas GPS válidas al presionar 'Aceptar Misión' en modo online (200 OK)	Funcional / Integración (CA-2)	Servicio / API Client	Crítica	navigator.onLine = true, misión 60000000-0000-4000-8000-000000000001 en DESPACHADA	aceptarMisionPatrulla(id, { coordenadas: { latitud: -39.819588, longitud: -73.245209 } })	apiClient.POST invocado hacia /api/misiones/{id}/aceptar con params.path.id y body: { latitud: -39.819588, longitud: -73.245209 }	Petición enviada con la ruta y payload tipados, retornando enColaOffline: false y estado: 'EN_CURSO'	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-05	Transición de la vista a 'En Trayecto / Evaluación' y habilitación de 'Formularios de Reporte Técnico' tras aceptar la misión	Funcional / UI (CA-6)	Componente / Integración	Crítica	Misión en estado DESPACHADA aceptada por el operador	Clic en botón "Aceptar Misión" en PatrullaMisionDetailPage	Desaparece el botón "Aceptar Misión", se despliega el encabezado "En Trayecto / Evaluación" con chip "Misión activa" y se habilita data-testid="formularios-reporte-tecnico"	Transición de pantalla completada mostrando "En Trayecto / Evaluación" y "Formularios de Reporte Técnico" con chip "Habilitado"	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-06	Visualización de los estados canónicos ICS en terreno: Misión 'En curso', Patrulla 'En verificación' e Incidente 'Verificando' (sin estado ambiguo 'En camino')	Regla de Negocio ICS (CA-4)	Componente / Servicio	Crítica	Misión aceptada en estado EN_CURSO	Inspección de grilla .canonicalStatesGrid y datosAdicionales tras aceptar misión	Muestra Misión: En curso, Patrulla: En verificación (EN_VERIFICACION) e Incidente: Verificando (VERIFICANDO)	Se renderizan exactamente los tres estados canónicos ICS sin utilizar el texto no canónico 'En camino'	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-07	Actualización de la etiqueta y marca temporal a 'Inicio de trayecto' con fechaInicio retornada por el servidor	Funcional / UI (CA-3)	Componente / Servicio	Alta	Respuesta 200 OK de POST /api/misiones/{id}/aceptar con fechaInicio: "2026-11-01T21:00:00.000Z"	aceptarMisionPatrulla y renderizado de ficha superior en PatrullaMisionDetailPage	mision.fechaInicio toma el timestamp del servidor y la etiqueta cambia de "Despachada" a "Inicio de trayecto" en formato 24h	resultado.mision.fechaInicio actualizado a "2026-11-01T21:00:00.000Z" y persistido en IndexedDB	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-08	Obtención no bloqueante de coordenadas GPS con timeout de 5 segundos (obtenerCoordenadasOpcionales) enviando {} si el GPS no responde	Robustez / Terreno	Servicio	Alta	Dispositivo sin API navigator.geolocation o con demora superior a timeoutMs	obtenerCoordenadasOpcionales(10) sin respuesta del hardware GPS	Resuelve {} al cumplirse el timeout sin bloquear ni rechazar la promesa de aceptación de misión	Retorna {} de forma segura tras el timeout configurado	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-09	Validación de rangos geográficos WGS84 del payload de coordenadas antes de enviar o encolar en IndexedDB (validarPayloadAceptarMision)	Validación / Contrato	Servicio	Media	Coordenadas válidas { latitud: -39.81, longitud: -73.24 } vs fuera de rango { latitud: 999, longitud: -73.24 }	validarPayloadAceptarMision(coords)	Conserva coordenadas dentro de [-90, 90] / [-180, 180] y descarta valores fuera de rango o no numéricos	Retorna { latitud: -39.81, longitud: -73.24 } para datos válidos y {} para latitud: 999	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-10	Aceptación optimista en modo offline guardando estado EN_CURSO en IndexedDB y encolando acción ACEPTAR_MISION en outbox	Offline-First / Persistencia	Servicio / IndexedDB	Crítica	Sin conexión (navigator.onLine = false o TypeError: Failed to fetch)	aceptarMisionPatrulla(misionId, { coordenadas: { latitud: -39.814, longitud: -73.245 } })	Guarda misión en IndexedDB con estado: 'EN_CURSO' y sincronizacionPendiente: true, y encola en outbox { tipo: 'ACEPTAR_MISION', url: '/api/misiones/{id}/aceptar', metodo: 'POST', payload }	Misión persistida localmente como EN_CURSO con sincronizacionPendiente: true y acción ACEPTAR_MISION registrada en outbox	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-11	Visualización del banner de cola local 'Pendiente de sincronizar' en modo offline y su limpieza al recibir el evento sgrai:outbox-synced	Offline-First / UI	Componente / Integración	Alta	Misión aceptada en modo offline (sincronizacionPendiente: true)	Disparo de clic en "Aceptar Misión" offline seguido de window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'))	Muestra el banner "Pendiente de sincronizar: La aceptación fue guardada en la cola local..." y lo oculta automáticamente tras sincronizar la cola	Banner renderizado en modo offline y removido del DOM al completarse el evento sgrai:outbox-synced	APROBADO	09/11/2026 12:38	12/11/2026 15:13	test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36)
CP-H36-PWA-12	Sincronización diferida de la cola outbox en IndexedDB al recuperar conectividad (sincronizarColaOutbox)	Offline-First / Cola Outbox	Servicio / Hook	Crítica	Acción ACEPTAR_MISION almacenada en el objectStore outbox de sgrai_terreno_offline_db	sincronizarColaOutbox(ejecutorHttp) y evento window 'online' en useConnectivity	Ejecuta el POST diferido, elimina la acción del store outbox cuando retorna true y actualiza sincronizacionPendiente: false con la fechaInicio del servidor	Acción procesada y eliminada de outbox, dejando contarAccionesPendientes() === 0	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-13	Rechazo explícito sin encolar en outbox cuando el backend retorna 403 Forbidden por falta de permiso o pertenencia a otra patrulla	Seguridad / Manejo de Errores	Servicio / UI	Alta	Usuario con sesión JWT válida al que la API responde 403 Forbidden	aceptarMisionPatrulla(misionId) con respuesta 403 ("No cuenta con el permiso misiones:terreno:verificar")	Lanza MisionServiceError con statusCode: 403, muestra alerta .errorAlert (role="alert") en la vista y NO encola la acción en outbox	Lanza MisionServiceError y encolarAccionOutbox no es invocado	APROBADO	09/11/2026 12:38	12/11/2026 15:13	test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36)
CP-H36-PWA-14	Manejo idempotente cuando la misión ya había sido aceptada previamente en el servidor (409 Conflict por estado EN_CURSO)	Concurrencia / Idempotencia	Servicio	Alta	Misión ya en estado EN_CURSO en el backend por doble clic o reintento de red	aceptarMisionPatrulla(misionId) con respuesta 409 confirmando que la misión ya está EN_CURSO	Retorna yaAceptadaPreviamente: true, enColaOffline: false y mision.estado: 'EN_CURSO' sin encolar en outbox	Transiciona limpiamente a EN_CURSO con yaAceptadaPreviamente: true	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-15	Protección de rutas de terreno en middleware proxy redirigiendo a /terreno/login cuando no existe cookie sgrai_auth_token	Seguridad / Perímetro	Middleware Proxy	Alta	Petición HTTP sin cookie sgrai_auth_token hacia /terreno/patrulla/misiones/{id}	GET http://localhost:3002/terreno/patrulla/misiones/68abde99-780d-41a9-aee6-f68371d226aa sin cookies	HTTP 307 Temporary Redirect hacia /terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones%2F...	Responde HTTP/1.1 307 Temporary Redirect con la cabecera location esperada	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-16	Inyección de cabecera Authorization Bearer y extracción de x-user-id desde el payload JWT en el interceptor de apiClient	Seguridad / Cliente HTTP	API Client	Alta	Cookie sgrai_auth_token con un JWT válido	Petición mediante apiClient.POST('/api/misiones/{id}/aceptar', ...)	El interceptor onRequest adjunta Authorization: Bearer <token> y extrae sub/usuarioId en x-user-id	Cabeceras de autenticación inyectadas en la petición saliente	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-17	Tipado estricto del contrato OpenAPI generado para POST /api/misiones/{id}/aceptar en src/types/api-generated.d.ts y src/types/offline.ts	Contrato OpenAPI	Tipos TypeScript	Alta	Esquema generado en src/types/api-generated.d.ts	Revisión de paths['/api/misiones/{id}/aceptar']['post'] y AceptarMisionPayload	Tipos de entrada (latitud, longitud), parámetros (id) y respuestas (200, 400, 401, 403, 404, 409, 500) derivados de api-generated.d.ts sin interfaces manuales	AceptarMisionPayload y AceptarMisionApiData referencian directamente paths['/api/misiones/{id}/aceptar']	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-18	Cumplimiento de estándares de diseño táctil para terreno: área mínima de 56px en botón 'Aceptar Misión', esquinas rectas (border-radius: 0) e íconos lucide-react	Usabilidad / Diseño Terreno	UI / CSS	Media	Hoja de estilos PatrullaDetailPage.module.css y componente PatrullaMisionDetailPage	Inspección de .acceptButton, .acceptCard, .enTrayectoCard e íconos CheckCircle, Navigation, ClipboardCheck, WifiOff	.acceptButton con min-height: 56px, border-radius: 0, paleta institucional (--color-primary-teal, --color-accent-mint, --color-sage, --color-charcoal) y 0 emojis	Estilos e íconos cumplen con la guía de diseño táctil de terreno	APROBADO	09/11/2026 12:38	12/11/2026 15:13	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-19	Documentación del contrato de terreno en docs/api/contratos-terreno.md y manual de usuario en docs/manuals/H36-aceptar-mision-patrulla.md	Documentación	Documentación Técnica / Manual	Media	Archivos en docs/api/contratos-terreno.md y docs/manuals/H36-aceptar-mision-patrulla.md	Revisión de sección 2.1 Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (H36) y manual paso a paso	Contrato HTTP, timeout GPS de 5s, comportamiento offline e idempotencia 409 documentados	Documentación técnica y manual de terreno incorporados en el repositorio	APROBADO	09/11/2026 12:38	12/11/2026 15:13	docs(patrulla): documentar contrato OpenAPI y manual de terreno para aceptar mision (H36)
CP-H36-PWA-20	Ejecución completa de la suite de pruebas unitarias y de integración de HU-36 en Vitest y React Testing Library	Automatización	Unit / Component / Service	Alta	Suite de pruebas en sgrai-pwa	npm test -- src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx src/services/__tests__/misionesService.test.ts src/hooks/__tests__/useConnectivity.test.ts src/services/__tests__/offlineQueue.test.ts src/app/(terreno)/patrulla/misiones/__tests__/PatrullaMisionesPage.test.tsx	30/30 tests focalizados (y 106/106 tests globales en 28 archivos) aprobados sin errores	30/30 tests focalizados y 106/106 tests totales aprobados	APROBADO	09/11/2026 12:38	12/11/2026 15:13	test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables en Re-Test

### 5.1 Ejecución de Pruebas Automatizadas en Vitest y React Testing Library

#### 5.1.1 Suite Focalizada de HU-36 con Pruebas de Regresión
```bash
npm test -- "src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx" "src/services/__tests__/misionesService.test.ts" "src/hooks/__tests__/useConnectivity.test.ts" "src/services/__tests__/offlineQueue.test.ts" "src/app/(terreno)/patrulla/misiones/__tests__/PatrullaMisionesPage.test.tsx"
```

**Salida de Consola (Re-Test):**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app

 ✓ src/services/__tests__/offlineQueue.test.ts (5 tests) 33ms
 ✓ src/services/__tests__/misionesService.test.ts (11 tests) 26ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (4 tests) 104ms
 ✓ src/app/(terreno)/patrulla/misiones/__tests__/PatrullaMisionesPage.test.tsx (3 tests) 318ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx (7 tests) 658ms

 Test Files  5 passed (5)
      Tests  30 passed (30)
   Start at  15:12:49
   Duration  3.47s (transform 1.15s, setup 1.51s, collect 2.12s, tests 1.14s, environment 6.11s, prepare 647ms)
```

#### 5.1.2 Suite Global del Repositorio PWA
```bash
npm test
```

**Salida de Consola (Re-Test):**
```text
 Test Files  28 passed (28)
      Tests  106 passed (106)
   Start at  15:11:51
   Duration  6.94s (transform 4.23s, setup 13.60s, collect 11.58s, tests 6.25s, environment 47.42s, prepare 4.30s)
```

#### 5.1.3 Análisis Estático ESLint (`BUG-H36-PWA-05`)
```bash
npm run lint
```

**Salida de Consola (Re-Test):**
```text
npm notice run sgrai-pwa@0.1.0 lint
npm notice run eslint
```
*(Código de salida: 0. Cero errores, cero advertencias).*

#### 5.1.4 Verificación Estática de Tipos TypeScript
```bash
npx tsc --noEmit
```

**Salida de Consola (Re-Test):**
```text
npm notice run sgrai-pwa@0.1.0 npx
npm notice run 'tsc' --noEmit
```
*(Código de salida: 0. Cero errores).*

---

### 5.2 Pruebas Replicables de Perímetro y Contrato HTTP

#### Caso 1: Protección Perimetral de Rutas Privadas (`307 Temporary Redirect` — `CP-H36-PWA-15`)
```bash
curl -s -i "http://localhost:3002/terreno/patrulla/misiones/68abde99-780d-41a9-aee6-f68371d226aa"
```

**Respuesta HTTP:**
```http
HTTP/1.1 307 Temporary Redirect
location: /terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones%2F68abde99-780d-41a9-aee6-f68371d226aa
Date: Mon, 09 Nov 2026 15:38:43 GMT
Connection: keep-alive
```

#### Caso 2: Carga de Vista de Detalle con Cookie Autenticada (`200 OK` — `CP-H36-PWA-01`)
```bash
curl -s -i -H "Cookie: sgrai_auth_token=jwt-mock-token" \
  "http://localhost:3002/terreno/patrulla/misiones/60000000-0000-4000-8000-000000000001" | head -n 10
```

**Respuesta HTTP:**
```http
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
```

#### Caso 3: Integridad de Contrato en `POST /api/misiones/{id}/aceptar` (`200 OK` — `CP-H36-PWA-04`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/68abde99-780d-41a9-aee6-f68371d226aa/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-39.819588,"longitud":-73.245209}'
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.",
  "data": {
    "mision": {
      "id": "68abde99-780d-41a9-aee6-f68371d226aa",
      "codigo": "MIS-2026-0007",
      "titulo": "Verificación: Caída de árbol - INC-2026-8510",
      "descripcion": null,
      "tipoMision": "VERIFICACION",
      "estado": "EN_CURSO",
      "prioridad": "MEDIA",
      "incidenteId": "0958e9c9-0374-4f26-91b0-fba8f361010f",
      "patrullaId": "f1000000-0000-4000-8000-000000000002",
      "fechaInicio": "2026-11-09T15:16:23.569Z",
      "actualizadoEn": "2026-11-09T15:16:23.569Z"
    },
    "patrulla": {
      "id": "f1000000-0000-4000-8000-000000000002",
      "nombre": "Patrulla Rápida Centro-Sur",
      "estado": "EN_VERIFICACION"
    },
    "incidente": {
      "id": "0958e9c9-0374-4f26-91b0-fba8f361010f",
      "codigo": "INC-2026-8510",
      "estado": "VERIFICANDO"
    },
    "hito": {
      "id": "15dbc97d-eb99-43ea-b37c-4bb3276cff1e",
      "misionId": "68abde99-780d-41a9-aee6-f68371d226aa",
      "hito": "MISION_ACEPTADA",
      "descripcion": "Misión Aceptada por Patrulla",
      "registradoPorId": "00000000-0000-4000-8000-000000000001",
      "latitud": -39.819588,
      "longitud": -73.245209,
      "creadoEn": "2026-11-09T15:16:23.569Z"
    }
  }
}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Re-Test (`sgrai-pwa`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La vista de detalle de la misión asignada en la PWA debe presentar un botón prominente 'Aceptar Misión'. | `CP-H36-PWA-01`, `CP-H36-PWA-03`, `CP-H36-PWA-18`, `BUG-H36-PWA-02`, `BUG-H36-PWA-05` | 🟢 **CUMPLIDO** | Botón táctil de 56px de altura (`--radius-none`) visible para misiones `DESPACHADA` asignadas a la patrulla en sesión activa. Se eliminó la inyección de misiones ficticias y se filtra por `patrullaId`. |
| **CA-2:** Al presionar 'Aceptar Misión', la PWA debe invocar el endpoint `POST /api/misiones/{id}/aceptar`. | `CP-H36-PWA-04`, `CP-H36-PWA-08`, `CP-H36-PWA-09`, `CP-H36-PWA-10`, `CP-H36-PWA-12`, `CP-H36-PWA-17`, `BUG-H36-PWA-01`, `BUG-H36-PWA-04` | 🟢 **CUMPLIDO** | Invocación contra el endpoint tipado en OpenAPI. Timeout GPS no bloqueante de 5s, soporte offline con cola `outbox` en IndexedDB, deduplicación de mutaciones y sincronización automática. |
| **CA-3:** La API debe ejecutar una transición atómica: (1) Actualizar `mision.estado` de `DESPACHADA` a `EN_CURSO`, (2) Fijar `mision.fecha_inicio = CURRENT_TIMESTAMP`, y (3) Registrar el hito 'Misión Aceptada por Patrulla' en la tabla `mision_hito`. | `CP-H36-PWA-07`, `CP-H36-PWA-14`, `BUG-H36-PWA-02` | 🟢 **CUMPLIDO** | La PWA actualiza localmente a `EN_CURSO`, persiste `fechaInicio` e `hitoAceptacion`, y preserva el estado optimista en IndexedDB sin regresiones destructivas. |
| **CA-4:** El estado de la patrulla verificadora debe mantenerse en `EN_VERIFICACION` y el incidente permanece en `VERIFICANDO` (corrigiendo la ambigüedad de 'En camino', que no es un estado canónico de incidente). | `CP-H36-PWA-06`, `BUG-H36-PWA-03` | 🟢 **CUMPLIDO** | La interfaz renderiza los tres estados canónicos ICS (`Misión: En curso`, `Patrulla: En verificación`, `Incidente: Verificando`), descartando el texto `'En camino'`. Respuestas `409 Conflict` por cancelación o cierre ya no fuerzan indebidamente el estado activo. |
| **CA-5:** El sistema debe emitir en tiempo real el evento WebSocket `mision:actualizada` hacia la sala `encargado` del Centro de Mando. | *(Alcance Backend `sgrai-api` / Frontend Web `sgrai-web`)* | ⚪ **N/A EN PWA** | Responsabilidad del backend `sgrai-api` y su consumo en el tablero central de `sgrai-web`. |
| **CA-6:** La PWA debe cambiar el estado de la vista a 'En Trayecto / Evaluación' habilitando los formularios de reporte técnico. | `CP-H36-PWA-05`, `CP-H36-PWA-11`, `BUG-H36-PWA-02`, `BUG-H36-PWA-03` | 🟢 **CUMPLIDO** | Transición de pantalla a `'En Trayecto / Evaluación'` con activación de la sección `formularios-reporte-tecnico`, validada tanto en modo online como offline. |
| **CA-7:** El endpoint debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H36-PWA-02`, `CP-H36-PWA-13`, `CP-H36-PWA-15`, `CP-H36-PWA-16`, `BUG-H36-PWA-01` | 🟢 **CUMPLIDO** | `AuthContext` valida estrictamente la presencia del permiso en la lista del usuario; puerta trasera eliminada y rechazos `403` gestionados formalmente sin encolar en `outbox`. |

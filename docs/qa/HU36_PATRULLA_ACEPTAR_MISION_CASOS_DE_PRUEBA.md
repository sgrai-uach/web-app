# Informe de Auditoría Técnica y Matriz de Casos de Prueba (QA): HU-36 — Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (Frontend PWA)

> **Documento Oficial de Aseguramiento de Calidad (QA) — Cliente Móvil de Terreno (PWA)**  
> **Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres, Municipalidad de Valdivia.  
> **Módulo:** Operaciones de Terreno / Patrulla Verificadora (`sgrai-pwa` — `/terreno/patrulla/misiones/[id]`).  
> **Historia de Usuario:** HU-36 — *"Como Patrulla verificadora Quiero confirmar y aceptar la misión asignada desde el dispositivo móvil para informar que el equipo se dirige al lugar. Para notificar a la central que la patrulla ha tomado conocimiento de la emergencia y va en trayecto para iniciar la evaluación."*  
> **Desarrollador Asignado:** MayraCarrillo  
> **Responsable de Auditoría:** Liderazgo de Aseguramiento de Calidad (QA Lead) — Proyecto SGRAI  
> **Aplicación Auditada:** `sgrai-pwa` (`web-app` — Next.js 16.3.4 App Router + React 19.2.8 + TypeScript 5 + IndexedDB `idb` 8.0.2 + `openapi-fetch` 0.17.0 + `lucide-react` + Vitest 3.2.7 + React Testing Library).  
> **Rama Git Evaluada:** `feature/h36-patrulla-aceptar-mision`  
> **Commits Evaluados en la Rama:**  
> * `feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)`  
> * `test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36)`  
> * `docs(patrulla): documentar contrato OpenAPI y manual de terreno para aceptar mision (H36)`  
>  
> **Fecha de Auditoría:** 09/11/2026 12:38.  
> **Estado de Certificación:** 🔴 **RECHAZADO EN CODE REVIEW / CHANGES REQUESTED (5 Defectos Detectados)**.

---

## 1. Resumen Ejecutivo de Auditoría Técnica

Tras ejecutar la auditoría forense de código fuente, inspección de flujos de autenticación y autorización RBAC en cliente, evaluación del motor de persistencia local Offline-First sobre IndexedDB (`idb`), validación de la máquina de estados del Sistema de Comando de Incidentes (ICS), verificación de contratos tipados OpenAPI (`openapi-typescript` / `openapi-fetch`), análisis estático ESLint y pruebas automatizadas en Vitest + React Testing Library sobre la rama `feature/h36-patrulla-aceptar-mision` del repositorio `sgrai-pwa`, se dictamina el estado **RECHAZADO EN CODE REVIEW (`Changes Requested`)** debido a la detección de **5 defectos reales** (2 críticos, 2 altos y 1 medio).

Los hallazgos identificados comprometen la seguridad de autenticación y control de acceso en producción (exposición de un botón y token de bypass `'dev-patrulla-token'`, enmascaramiento de respuestas `401`/`403`/`404` como aceptaciones exitosas y evaluación permisiva de `misiones:terreno:verificar` y `unidadActiva`), la integridad de los datos en IndexedDB (sobrescritura destructiva del estado optimista `EN_CURSO` antes de vaciar la cola `outbox` e inyección de misiones ficticias hardcodeadas cuando la API retorna vacío o `404`), el cumplimiento de las invariantes ICS ante respuestas `409 Conflict` por misiones canceladas o cerradas, y la sincronización automática de la cola diferida cuando ocurren fallos de red con `navigator.onLine === true`.

| Métrica de Calidad | Resultado de Auditoría | Observaciones Técnicas |
|---|:---:|---|
| **Total de Casos de Prueba en Matriz** | **25** | 5 Defectos Detectados (`BUG-H36-PWA-01` a `05`) + 20 Casos de UI, RBAC, ICS, Offline-First y Contratos (`CP-H36-PWA-01` a `20`) |
| **Casos Aprobados (Passed)** | **20** | Renderizado del botón `'Aceptar Misión'`, invocación de `POST /api/misiones/{id}/aceptar`, timeout GPS no bloqueante de 5s, transición a `'En Trayecto / Evaluación'`, estados canónicos ICS en pantalla, encolado en IndexedDB `outbox` y contratos OpenAPI |
| **Defectos Abiertos / Fallidos (Failed)** | **5** | **2 Críticos, 2 Altos, 1 Medio** |
| **Casos Bloqueados (Blocked)** | **0** | Sin bloqueos de entorno local |
| **Tasa de Aprobación Actual (% Pass)** | **80.0%** | Se requiere el 100.0% (0 defectos abiertos) en Re-Test para autorizar el merge a `develop` |
| **Suite Automatizada de la PWA (Vitest)** | **81/81 tests pass (26 suites)** | Focalizados en HU-36: `PatrullaDetailPage.test.tsx` (4), `misionesService.test.ts` (9), `offlineQueue.test.ts` (4) y `useConnectivity.test.ts` (3) |
| **Análisis Estático ESLint (`npm run lint`)** | 🟡 **0 errores / 4 advertencias** | 4 warnings `@next/next/no-location-assign-relative-destination` en archivos modificados en la rama (`login/page.tsx`, `(terreno)/page.tsx`, `AuthContext.tsx` y `client.ts`) |

---

## 2. Registro Técnico de Defectos Detectados

### `BUG-H36-PWA-01`: Bypass de Autenticación y RBAC en Producción Mediante `'dev-patrulla-token'`, Enmascaramiento de Errores HTTP `401`/`403`/`404` como Éxito en `aceptarMisionPatrulla` y Evaluación Permisiva de `misiones:terreno:verificar` y `unidadActiva`
* **Severidad:** **CRÍTICA** (Vulnerabilidad de Seguridad / Bypass de Autenticación, RBAC e Integridad Operativa).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/app/(auth)/login/page.tsx` (Líneas 115-146 y 228-238)
  * `src/context/AuthContext.tsx` (Líneas 23-36, 92-108, 122-128 y 217-240)
  * `src/lib/api/client.ts` (Líneas 5-6, 30-31 y 70-75)
  * `src/services/misionesService.ts` (Líneas 354-383)
* **Descripción Técnica del Defecto:**  
  La implementación introduce mecanismos de prueba local directamente en el código de producción sin ninguna guarda de entorno, junto con brechas en la validación de permisos y estado de la unidad:
  1. **Botón y token de acceso directo sin autenticación (`dev-patrulla-token`):** En `src/app/(auth)/login/page.tsx` (líneas 115-146 y 228-238) se renderiza de forma permanente el botón `"Acceso Rápido Patrulla (Prueba Local)"`, el cual fija la cookie `sgrai_auth_token=dev-patrulla-token` e inyecta una misión ficticia en IndexedDB. En `src/context/AuthContext.tsx` (líneas 122-128) y `src/lib/api/client.ts` (líneas 70-75), dicho valor omite la validación contra `GET /api/seguridad/usuario-activo`, carga el perfil `PERFIL_DEMO_PATRULLA` con el permiso `misiones:terreno:verificar`, suprime la cabecera `Authorization` e inyecta `x-user-id: 00000000-0000-4000-8000-000000000004`.
  2. **Falsificación de aceptación exitosa cuando el backend retorna `401`, `403` o `404`:** En `src/services/misionesService.ts` (líneas 354-383):
     ```typescript
     const tokenActual = typeof window !== 'undefined' ? getAuthCookie() : null;
     const esModoDemoLocal =
       Boolean(tokenActual) && tokenActual === (DEV_PATRULLA_TOKEN || 'dev-patrulla-token');
     if (esModoDemoLocal && (status === 401 || status === 403 || status === 404)) {
       ...
       return {
         mision: misionDemo,
         enColaOffline: false,
         mensaje:
           'Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.',
       };
     }
     ```
     Si el servidor rechaza la operación con `401 Unauthorized`, `403 Forbidden` o `404 Not Found`, el cliente oculta el fallo, marca la misión como `EN_CURSO` (`sincronizacionPendiente: false`) y muestra al operador que el Centro de Mando fue notificado, cuando en realidad la transacción jamás ocurrió en el servidor.
  3. **Bypass de RBAC cuando `permisos` está vacío y evaluación Fail-Open de `unidadActiva`:** En `src/context/AuthContext.tsx` (líneas 228-234), la función `tienePermiso` evalúa:
     ```typescript
     if (
       esPatrulla &&
       (permiso.startsWith('patrulla:') ||
         (listaPermisos.length === 0 && permiso === 'misiones:terreno:verificar'))
     ) {
       return true;
     }
     ```
     Si un Administrador revoca el permiso `misiones:terreno:verificar` al rol `PATRULLA_VERIFICADORA` (`permisos: []`), `tienePermiso('misiones:terreno:verificar')` retorna `true` igualmente, violando el Criterio de Aceptación 7. Adicionalmente, `mapDetalleAUsuarioPerfil` (líneas 92-108) no mapea `unidadId`, `unidadNombre` ni `unidadActiva` desde `GET /api/seguridad/usuario-activo`, y la línea 217 define `const unidadActiva = usuario?.unidadActiva !== false;` (Fail-Open), asumiendo que la unidad está activa cuando el campo es `undefined`.
* **Pasos para Reproducir:**
  1. Abrir `/terreno/login` y presionar `"Acceso Rápido Patrulla (Prueba Local)"`: se accede sin credenciales a `/terreno/patrulla/misiones` con el permiso `misiones:terreno:verificar`.
  2. Presionar `"Aceptar Misión"` cuando el backend responde `401`, `403` o `404`: `aceptarMisionPatrulla` ignora el error HTTP y muestra `"Misión aceptada exitosamente..."`.
  3. Iniciar sesión con un usuario de rol `PATRULLA_VERIFICADORA` cuyo arreglo `permisos` sea `[]`: `tienePermiso('misiones:terreno:verificar')` devuelve `true` y renderiza el botón `"Aceptar Misión"`.
* **Comportamiento Actual:** Se permite evadir el login institucional, se enmascaran errores `401`/`403`/`404` como transiciones exitosas y se concede `misiones:terreno:verificar` cuando `permisos` es vacío.
* **Comportamiento Esperado:**
  1. Eliminar el botón de acceso rápido sin credenciales, el token `'dev-patrulla-token'` y el bloque `esModoDemoLocal` en `misionesService.ts`, `AuthContext.tsx`, `client.ts`, `useConnectivity.ts` y `login/page.tsx`.
  2. En `tienePermiso`, exigir estrictamente `listaPermisos.includes('*') || listaPermisos.includes(permiso)` para `'misiones:terreno:verificar'` sin otorgarlo por fallback cuando `listaPermisos.length === 0`.
  3. Mapear `unidadId`, `unidadNombre` y `unidadActiva` en `mapDetalleAUsuarioPerfil`.
* **Sugerencia Técnica de Solución:**  
  Remover `DEV_PATRULLA_TOKEN`, `PERFIL_DEMO_PATRULLA` y `handleAccesoRapidoPatrulla`; en `misionesService.ts` lanzar siempre `MisionServiceError` ante estados `400`, `401`, `403` y `404`; y en `AuthContext.tsx` validar `listaPermisos.includes('misiones:terreno:verificar')` de forma estricta.

---

### `BUG-H36-PWA-02`: Sobrescritura Destructiva del Estado Optimista Offline (`EN_CURSO` a `DESPACHADA`) en `obtenerDetalleMision` / `sincronizarMisiones` e Inyección de Misiones Ficticias Hardcodeadas en Producción
* **Severidad:** **CRÍTICA** (Pérdida de Consistencia Offline-First en IndexedDB y Corrupción de Datos en Interfaz).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/services/misionesService.ts` (Líneas 160-184 y 205-238)
  * `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (Líneas 50-66)
  * `src/app/(terreno)/patrulla/misiones/page.tsx` (Líneas 47-95)
* **Descripción Técnica del Defecto:**  
  1. **Regresión de estado `EN_CURSO` a `DESPACHADA` antes de vaciar la cola `outbox`:** Cuando el patrullero acepta una misión sin conexión, `aceptarMisionPatrulla` persiste en el store `misiones` de IndexedDB la misión con `estado: 'EN_CURSO'` y `sincronizacionPendiente: true`, y encola `ACEPTAR_MISION` en `outbox`. Sin embargo, si el operador vuelve al listado o recarga el detalle en el instante en que regresa la red (antes de que `sincronizarColaOutbox` termine de ejecutar el `POST`), `obtenerDetalleMision` (`src/services/misionesService.ts:205-238`) y `sincronizarMisiones` (`líneas 160-184`) consultan `GET /api/misiones/{id}` o `GET /api/misiones` (donde el estado en el servidor aún es `'DESPACHADA'`) y ejecutan `guardarMisionLocal` / `guardarMisionesLocales` **sobrescribiendo incondicionalmente el registro local** con `estado: 'DESPACHADA'` y `sincronizacionPendiente: false`, sin verificar si en IndexedDB la misión tenía `sincronizacionPendiente === true` o una mutación pendiente en `outbox`.
  2. **Inyección de misiones ficticias en producción y bloqueo del estado vacío:**
     - En `src/app/(terreno)/patrulla/misiones/page.tsx` (líneas 74-95), cuando `sincronizarMisiones` retorna un arreglo vacío `[]` (la patrulla no tiene misiones asignadas), el componente fabrica una misión hardcodeada (`id: '60000000-0000-4000-8000-000000000001'`, `codigoIncidente: 'INC-2026-0001'`, `'Av. Ramón Picarte 1200, Valdivia'`, `estado: 'DESPACHADA'`) y la guarda en IndexedDB. Esto hace que el bloque de interfaz `"Sin registros disponibles — La patrulla se encuentra disponible para despacho."` (líneas 193-213) sea **código muerto inalcanzable**.
     - En `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (líneas 53-66), si `obtenerDetalleMision(misionId)` retorna `null` (UUID inexistente en API e IndexedDB), el componente construye una misión ficticia en `'Av. Alemania 600, Valdivia'` con `estado: 'DESPACHADA'` y presenta el botón `'Aceptar Misión'`, el cual al presionarse invoca a la API con un UUID inexistente (`404 Not Found`).
* **Pasos para Reproducir:**
  1. Aceptar una misión en modo offline (`estado = 'EN_CURSO'`, `sincronizacionPendiente = true` en IndexedDB).
  2. Ejecutar `obtenerDetalleMision(misionId)` o `sincronizarMisiones()` cuando la API aún retorna `estado: 'DESPACHADA'` antes de que el `outbox` haya sincronizado.
  3. Navegar a `/terreno/patrulla/misiones` con una patrulla sin misiones asignadas (`GET /api/misiones` retorna `data: []`) o navegar a `/terreno/patrulla/misiones/00000000-0000-4000-8000-000000000999`.
* **Comportamiento Actual:** `obtenerDetalleMision` y `sincronizarMisiones` pisan el estado optimista local regresándolo a `'DESPACHADA'`; y las páginas de listado y detalle inventan misiones inexistentes en lugar de mostrar el estado vacío o de misión no encontrada.
* **Comportamiento Esperado:**
  1. En `obtenerDetalleMision` y `sincronizarMisiones`, consultar previamente el registro local en IndexedDB (`obtenerMisionLocalPorId` / `obtenerMisionesLocales`): si la misión local tiene `sincronizacionPendiente === true` y `estado === 'EN_CURSO'` mientras el servidor aún reporta `'DESPACHADA'`, preservar el estado optimista local y `sincronizacionPendiente: true` hasta que `outbox` confirme la sincronización.
  2. Eliminar la creación de misiones ficticias en `PatrullaMisionesPage` y `PatrullaMisionDetailPage`, permitiendo renderizar el estado vacío real cuando `misiones.length === 0` y un estado de error/no encontrado cuando `obtenerDetalleMision` retorna `null`.
* **Sugerencia Técnica de Solución:**  
  En `src/services/misionesService.ts`, antes de sobrescribir con datos de `GET /api/misiones` o `GET /api/misiones/{id}`, verificar `const previa = await obtenerMisionLocalPorId(d.id)`: si `previa?.sincronizacionPendiente && d.estado === 'DESPACHADA'`, conservar `estado: previa.estado`, `fechaInicio: previa.fechaInicio` y `sincronizacionPendiente: true`. En `PatrullaMisionesPage` y `PatrullaMisionDetailPage`, remover los bloques fallback con datos hardcodeados.

---

### `BUG-H36-PWA-03`: Transición Inválida a `'EN_CURSO'` ante Cualquier Respuesta `409 Conflict` (o `422`) en `aceptarMisionPatrulla` y `useConnectivity` Cuando la Misión Fue Cancelada, Rechazada o Completada
* **Severidad:** **ALTA** (Violación de Reglas de Negocio del Sistema de Comando de Incidentes — ICS).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/services/misionesService.ts` (Líneas 327-352)
  * `src/hooks/useConnectivity.ts` (Líneas 61-94)
* **Descripción Técnica del Defecto:**  
  En el backend `sgrai-api`, el endpoint `POST /api/misiones/{id}/aceptar` devuelve `HTTP 409 Conflict` tanto cuando la misión ya estaba en `'EN_CURSO'` como cuando la misión se encuentra en un estado terminal o incompatible (`'CANCELADA'`, `'COMPLETADA'`, `'RECHAZADA'`, `'FINALIZADA'`), cuando no tiene patrulla asignada, o cuando el incidente asociado ya fue cerrado (`{"message": "La misión no puede ser aceptada porque su estado actual es 'CANCELADA'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}`).
  Sin embargo:
  1. En `src/services/misionesService.ts` (líneas 328-352), cualquier `status === 409` es tratado incondicionalmente como idempotencia exitosa, forzando `estado: 'EN_CURSO'`, `estadoPatrulla: 'EN_VERIFICACION'` y `estadoIncidente: 'VERIFICANDO'` en IndexedDB y cambiando la pantalla a **"En Trayecto / Evaluación"** con los **Formularios de Reporte Técnico habilitados**.
  2. En `src/hooks/useConnectivity.ts` (líneas 62-88), la condición `const procesada = res.ok || res.status === 409 || res.status === 422;` incluye incluso errores de validación `422` y cualquier `409 Conflict`, forzando `estado: 'EN_CURSO'` y `sincronizacionPendiente: false` en IndexedDB aunque la misión haya sido cancelada por el Centro de Mando mientras el dispositivo estaba sin señal.
* **Pasos para Reproducir:**
  1. Abrir en la PWA el detalle de una misión que acaba de ser cancelada o cerrada en el Centro de Mando (`estado = 'CANCELADA'` o `'COMPLETADA'` en el backend).
  2. Presionar `"Aceptar Misión"` (el backend responde `409 Conflict` indicando que el estado actual es `'CANCELADA'` o `'COMPLETADA'`).
* **Comportamiento Actual:** La PWA ignora el motivo del `409 Conflict`, marca la misión cancelada/completada como `EN_CURSO` y habilita los formularios de reporte técnico de terreno.
* **Comportamiento Esperado:**
  1. En `aceptarMisionPatrulla`, al recibir `409 Conflict`, verificar en el mensaje de error (o consultando `obtenerDetalleMision(misionId)`) si el estado real en el servidor es efectivamente `'EN_CURSO'`. Si la misión está en `'CANCELADA'`, `'COMPLETADA'`, `'RECHAZADA'` u otro conflicto no idempotente, actualizar el estado local con el estado real del servidor y lanzar `MisionServiceError(409, msgError)` para informar al operador.
  2. En `useConnectivity.ts`, no tratar `422` como éxito; y ante `409`, refrescar el estado real de la misión desde el servidor antes de fijar `estado: 'EN_CURSO'`.
* **Sugerencia Técnica de Solución:**  
  En `src/services/misionesService.ts`:
  ```typescript
  if (status === 409) {
    const msgConflict = (error as { message?: string } | undefined)?.message || '';
    const yaEnCurso = /'EN_CURSO'/i.test(msgConflict);
    if (!yaEnCurso) {
      throw new MisionServiceError(
        409,
        msgConflict || 'La misión no puede ser aceptada en su estado actual.'
      );
    }
    // Solo aplicar idempotencia cuando el conflicto es porque ya se encuentra EN_CURSO
    ...
  }
  ```

---

### `BUG-H36-PWA-04`: Falta de Disparo de `sincronizar()` con Conexión Activa, Falso Indicador `'Sincronizado'` en `ConnectionStatusBadge` con Cola Pendiente, y Ausencia de Deduplicación en `outbox`
* **Severidad:** **ALTA** (Fallo de Sincronización Diferida Offline-First e Inconsistencia de Estado Visual).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/hooks/useConnectivity.ts` (Líneas 34-144)
  * `src/services/offlineQueue.ts` (Líneas 101-172)
  * `src/services/misionesService.ts` (Líneas 385-426)
* **Descripción Técnica del Defecto:**  
  1. **Cola `outbox` estancada cuando `navigator.onLine === true`:** En `src/hooks/useConnectivity.ts` (líneas 110-136), `sincronizar()` **solo** se invoca dentro del listener `window.addEventListener('online', handleOnline)`. Ni el efecto inicial al montar el hook ni el intervalo periódico de 15 segundos llaman a `sincronizar()` cuando `online === true && pendientes > 0`. En consecuencia, si `aceptarMisionPatrulla` cae al flujo offline por un timeout o microcorte hacia la API mientras la interfaz de red del teléfono sigue reportando `navigator.onLine === true` (o si el usuario recarga la aplicación ya estando online con acciones pendientes en `outbox`), el evento `'online'` nunca se emite y la acción `ACEPTAR_MISION` jamás se sincroniza automáticamente.
  2. **Contradicción visual entre `ConnectionStatusBadge` (`"Sincronizado"`) y el banner `"Pendiente de sincronizar"`:** En `src/hooks/useConnectivity.ts` (líneas 138-144):
     ```typescript
     let status: ConnectionStatus = 'connected';
     if (sincronizando) {
       status = 'syncing';
     } else if (!online) {
       status = 'offline';
     }
     ```
     Cuando `online === true`, `sincronizando === false` y `pendientes > 0`, `useConnectivity` retorna `status = 'connected'`. Como `PatrullaMisionDetailPage` pasa `status={status}` a `<ConnectionStatusBadge status={status} pendingCount={pendientes} />`, la expresión `status || (pendingCount > 0 && connected ? 'syncing' : ...)` en `ConnectionStatusBadge.tsx:34` toma siempre `'connected'`. El usuario ve en la esquina superior derecha **"Sincronizado"** en color verde mientras en el cuerpo de la misión ve **"Pendiente de sincronizar: La aceptación fue guardada en la cola local..."**.
  3. **Falta de deduplicación en `encolarAccionOutbox`:** En `src/services/offlineQueue.ts` (líneas 101-114), `encolarAccionOutbox` inserta un nuevo registro con UUID aleatorio sin verificar si ya existe en `outbox` una acción `ACEPTAR_MISION` para la misma URL (`/api/misiones/${misionId}/aceptar`), permitiendo encolar múltiples peticiones idénticas.
* **Pasos para Reproducir:**
  1. Con `navigator.onLine === true`, simular un fallo de red (`TypeError: Failed to fetch`) al presionar `"Aceptar Misión"` en `PatrullaMisionDetailPage`.
  2. Observar el badge superior (`ConnectionStatusBadge`) y el estado de la cola `outbox` tras 15 segundos.
* **Comportamiento Actual:** El badge superior muestra `"Sincronizado"` a pesar de que `pendientes === 1` y la tarjeta muestra `"Pendiente de sincronizar"`, y el intervalo de 15 segundos nunca ejecuta `sincronizar()`.
* **Comportamiento Esperado:**
  1. En `useConnectivity.ts`, si `online && pendientes > 0 && !sincronizando`, disparar `sincronizar()` tanto al montar como en el ciclo periódico, y reflejar el estado adecuado en `ConnectionStatusBadge` mientras existan elementos pendientes por transmitir.
  2. En `encolarAccionOutbox`, evitar duplicar acciones del mismo `tipo` y `url` que ya estén pendientes en `outbox`.
* **Sugerencia Técnica de Solución:**  
  En `src/hooks/useConnectivity.ts`, dentro de `actualizarPendientes` (o en un `useEffect` dependiente de `online` y `pendientes`), invocar `sincronizar()` cuando `navigator.onLine && total > 0 && !sincronizando`, y en `encolarAccionOutbox` verificar `obtenerAccionesOutbox()` para actualizar o reutilizar la acción existente si coincide `accion.tipo === nueva.tipo && accion.url === nueva.url`.

---

### `BUG-H36-PWA-05`: Omisión del Filtro `patrullaId` en `PatrullaMisionesPage` y `TerrenoSiguienteMision` y Advertencias de Análisis Estático ESLint (`@next/next/no-location-assign-relative-destination`)
* **Severidad:** **MEDIA** (Filtrado Operativo Incompleto de Misiones por Unidad y Deuda de Calidad en Linter).
* **Estado:** `ABIERTO`.
* **Archivos Afectados:**
  * `src/app/(terreno)/patrulla/misiones/page.tsx` (Líneas 43-45)
  * `src/components/terreno/TerrenoSiguienteMision.tsx` (Líneas 27-29)
  * `src/app/(auth)/login/page.tsx` (Línea 51)
  * `src/app/(terreno)/page.tsx` (Línea 26)
  * `src/context/AuthContext.tsx` (Línea 140)
  * `src/lib/api/client.ts` (Línea 47)
* **Descripción Técnica del Defecto:**  
  1. **Consulta de misiones sin filtrar por `patrullaId` de la patrulla en sesión:** Aunque `sincronizarMisiones(filtros?: FiltrosMisiones)` (`src/services/misionesService.ts:21-25 y 149`) soporta el parámetro `patrullaId`, tanto `PatrullaMisionesPage` (`src/app/(terreno)/patrulla/misiones/page.tsx:43-45`) como `TerrenoSiguienteMision` (`src/components/terreno/TerrenoSiguienteMision.tsx:27-29`) invocan únicamente `sincronizarMisiones({ tipoMision: 'VERIFICACION' })` sin pasar `patrullaId: usuario?.unidadId || undefined`. Esto ocasiona que se listen y almacenen en IndexedDB misiones de verificación despachadas a **otras patrullas verificadoras**, presentando el botón `"Aceptar Misión"` sobre misiones ajenas que al presionarse son rechazadas con `403 Forbidden` por el backend.
  2. **Advertencias ESLint en archivos modificados por la rama:** La ejecución de `npm run lint` arroja 4 advertencias `@next/next/no-location-assign-relative-destination` en `src/app/(auth)/login/page.tsx:51`, `src/app/(terreno)/page.tsx:26`, `src/context/AuthContext.tsx:140` y `src/lib/api/client.ts:47` debido al uso de `window.location.assign()` hacia rutas relativas.
* **Pasos para Reproducir:**
  1. Iniciar sesión con una patrulla verificadora cuando existen en el backend misiones de tipo `VERIFICACION` asignadas a distintas patrullas y abrir `/terreno/patrulla/misiones`.
  2. Ejecutar `npm run lint` en la raíz del repositorio `sgrai-pwa`.
* **Comportamiento Actual:** La petición `GET /api/misiones?tipoMision=VERIFICACION` no incluye `patrullaId`, listando misiones de otras patrullas; y `npm run lint` reporta `4 problems (0 errors, 4 warnings)`.
* **Comportamiento Esperado:** Pasar `patrullaId: usuario?.unidadId ?? undefined` en `sincronizarMisiones` cuando el usuario tenga unidad asignada, y resolver las 4 advertencias de ESLint para obtener una ejecución limpia (`0 warnings`).
* **Sugerencia Técnica de Solución:**  
  En `PatrullaMisionesPage` y `TerrenoSiguienteMision`, incluir `patrullaId: usuario?.unidadId || undefined` al invocar `sincronizarMisiones`, y sustituir la navegación imperativa relativa en componentes React por `router.replace(...)`.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|---|
| `BUG-H36-PWA-01` | Bypass de autenticación y RBAC mediante dev-patrulla-token, enmascaramiento de errores 401/403/404 como éxito y fallback permisivo de misiones:terreno:verificar | Seguridad / RBAC | Integración / Auth / Servicio | Crítica | Acceso a `/terreno/login` o sesión de patrulla con `permisos: []` | Clic en `"Acceso Rápido Patrulla (Prueba Local)"` (`sgrai_auth_token=dev-patrulla-token`) e invocación a `aceptarMisionPatrulla` con respuesta `403` o `404` | Sin puertas traseras en producción; `401`/`403`/`404` deben lanzar `MisionServiceError` y `tienePermiso('misiones:terreno:verificar')` debe ser `false` si `permisos` es `[]` | El botón en login inyecta `dev-patrulla-token`, `aceptarMisionPatrulla` simula `200 OK` ante errores `401/403/404` y `tienePermiso` retorna `true` cuando `permisos` está vacío | ABIERTO | 09/11/2026 12:34 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H36-PWA-02` | Sobrescritura destructiva del estado optimista EN_CURSO en obtenerDetalleMision / sincronizarMisiones e inyección de misiones ficticias en producción | Funcional / Offline-First | Servicio / UI / IndexedDB | Crítica | Misión aceptada offline (`estado: 'EN_CURSO'`, `sincronizacionPendiente: true`) o patrulla sin misiones asignadas (`data: []`) | `obtenerDetalleMision(id)` / `sincronizarMisiones()` antes de vaciar `outbox`, o carga de `/terreno/patrulla/misiones` con `[]` | Preservar estado optimista `EN_CURSO` con `sincronizacionPendiente: true` hasta vaciar `outbox`, y mostrar estado vacío cuando la API retorna `[]` | `obtenerDetalleMision` y `sincronizarMisiones` sobrescriben IndexedDB regresando la misión a `DESPACHADA`, y las vistas inyectan misiones hardcodeadas (`INC-2026-0001` / `Av. Alemania 600`) | ABIERTO | 09/11/2026 12:35 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H36-PWA-03` | Transición inválida a EN_CURSO ante cualquier respuesta 409 Conflict o 422 en aceptarMisionPatrulla y useConnectivity cuando la misión fue cancelada o cerrada | Regla de Negocio ICS | Servicio / Hook Offline | Alta | Misión en estado `CANCELADA`, `COMPLETADA` o `RECHAZADA` en el servidor que responde `409 Conflict` | `POST /api/misiones/{id}/aceptar` retornando `409 Conflict` (`"La misión no puede ser aceptada porque su estado actual es 'CANCELADA'"`) | Rechazar la transición mostrando alerta de error y actualizar al estado real de la misión sin habilitar formularios técnicos | `aceptarMisionPatrulla` y `useConnectivity` asumen que todo `409` (y `422`) es `EN_CURSO`, habilitando `"En Trayecto / Evaluación"` y formularios sobre misiones canceladas | ABIERTO | 09/11/2026 12:36 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H36-PWA-04` | Falta de ejecución automática de sincronizar() cuando navigator.onLine es true, falso badge Sincronizado con pendientes > 0 y duplicados en outbox | Offline-First / Sincronización | Hook / IndexedDB / UI | Alta | Fallo de red transitorio con `navigator.onLine === true` y `pendientes === 1` en `outbox` | `useConnectivity()` montado con `online: true` y 1 acción `ACEPTAR_MISION` en `outbox` | Disparar `sincronizar()` automáticamente cuando `online && pendientes > 0`, mostrar estado pendiente en `ConnectionStatusBadge` y deduplicar `outbox` | `sincronizar()` nunca se invoca si no ocurre evento `'online'`, `ConnectionStatusBadge` muestra `"Sincronizado"` junto al banner `"Pendiente de sincronizar"` y `outbox` permite duplicados | ABIERTO | 09/11/2026 12:37 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `BUG-H36-PWA-05` | Omisión del filtro patrullaId en PatrullaMisionesPage y TerrenoSiguienteMision y 4 advertencias ESLint por uso de window.location.assign | Funcional / Calidad de Código | UI / Servicio / Linter | Media | Usuario patrulla autenticado y ejecución de `npm run lint` | `sincronizarMisiones({ tipoMision: 'VERIFICACION' })` y comando `npm run lint` | Filtrar petición por `patrullaId` de la unidad activa y obtener `0 warnings` en ESLint | No envía `patrullaId` a `GET /api/misiones` y `npm run lint` reporta 4 advertencias `@next/next/no-location-assign-relative-destination` | ABIERTO | 09/11/2026 12:38 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| `CP-H36-PWA-01` | Renderizado prominente del botón 'Aceptar Misión' cuando la misión está en estado DESPACHADA, unidadActiva es true y posee el permiso misiones:terreno:verificar | Funcional / UI (CA-1, CA-7) | Componente / Integración | Crítica | Misión `60000000-0000-4000-8000-000000000001` en `DESPACHADA`, `unidadActiva: true` y permiso `misiones:terreno:verificar` | Renderizado de `PatrullaMisionDetailPage` con misión `DESPACHADA` | Se muestra la tarjeta `"Confirmación de salida a terreno"` con el botón táctil `"Aceptar Misión"` (`min-height: 56px`) y los formularios técnicos permanecen ocultos | Botón `"Aceptar Misión"` visible y accesible; sección `formularios-reporte-tecnico` no renderizada antes de aceptar | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-02` | Ocultamiento del botón 'Aceptar Misión' cuando el usuario no posee el permiso RBAC misiones:terreno:verificar | Seguridad / RBAC (CA-7) | Componente / UI | Crítica | Misión en `DESPACHADA` y `tienePermiso('misiones:terreno:verificar') === false` | Renderizado de `PatrullaMisionDetailPage` con `permisoVerificar: false` | El botón `"Aceptar Misión"` no se renderiza en el DOM | `queryByRole('button', { name: /aceptar misión/i })` retorna `null` | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-03` | Ocultamiento del botón 'Aceptar Misión' y activación de modo solo lectura cuando la patrulla está inactiva (unidadActiva: false) | Regla de Negocio / UI | Componente / UI | Alta | Patrulla desactivada (`unidadActiva: false`) | Renderizado de `PatrullaMisionDetailPage` con `unidadActiva: false` | Muestra `UnidadInactivaBanner`, aviso `"Solo lectura"` y oculta el botón `"Aceptar Misión"` | Banner de unidad inactiva y aviso de solo lectura presentes; botón de aceptación oculto | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-04` | Invocación del endpoint POST /api/misiones/{id}/aceptar con coordenadas GPS válidas al presionar 'Aceptar Misión' en modo online (200 OK) | Funcional / Integración (CA-2) | Servicio / API Client | Crítica | `navigator.onLine = true`, misión `60000000-0000-4000-8000-000000000001` en `DESPACHADA` | `aceptarMisionPatrulla(id, { coordenadas: { latitud: -39.819588, longitud: -73.245209 } })` | `apiClient.POST` invocado hacia `/api/misiones/{id}/aceptar` con `params.path.id` y `body: { latitud: -39.819588, longitud: -73.245209 }` | Petición enviada con la ruta y payload tipados, retornando `enColaOffline: false` y `estado: 'EN_CURSO'` | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-05` | Transición de la vista a 'En Trayecto / Evaluación' y habilitación de 'Formularios de Reporte Técnico' tras aceptar la misión | Funcional / UI (CA-6) | Componente / Integración | Crítica | Misión en estado `DESPACHADA` aceptada por el operador | Clic en botón `"Aceptar Misión"` en `PatrullaMisionDetailPage` | Desaparece el botón `"Aceptar Misión"`, se despliega el encabezado `"En Trayecto / Evaluación"` con chip `"Misión activa"` y se habilita `data-testid="formularios-reporte-tecnico"` | Transición de pantalla completada mostrando `"En Trayecto / Evaluación"` y `"Formularios de Reporte Técnico"` con chip `"Habilitado"` | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-06` | Visualización de los estados canónicos ICS en terreno: Misión 'En curso', Patrulla 'En verificación' e Incidente 'Verificando' (sin estado ambiguo 'En camino') | Regla de Negocio ICS (CA-4) | Componente / Servicio | Crítica | Misión aceptada en estado `EN_CURSO` | Inspección de grilla `.canonicalStatesGrid` y `datosAdicionales` tras aceptar misión | Muestra `Misión: En curso`, `Patrulla: En verificación` (`EN_VERIFICACION`) e `Incidente: Verificando` (`VERIFICANDO`) | Se renderizan exactamente los tres estados canónicos ICS sin utilizar el texto no canónico `'En camino'` | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-07` | Actualización de la etiqueta y marca temporal a 'Inicio de trayecto' con fechaInicio retornada por el servidor | Funcional / UI (CA-3) | Componente / Servicio | Alta | Respuesta `200 OK` de `POST /api/misiones/{id}/aceptar` con `fechaInicio: "2026-11-01T21:00:00.000Z"` | `aceptarMisionPatrulla` y renderizado de ficha superior en `PatrullaMisionDetailPage` | `mision.fechaInicio` toma el timestamp del servidor y la etiqueta cambia de `"Despachada"` a `"Inicio de trayecto"` en formato 24h | `resultado.mision.fechaInicio` actualizado a `"2026-11-01T21:00:00.000Z"` y persistido en IndexedDB | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-08` | Obtención no bloqueante de coordenadas GPS con timeout de 5 segundos (obtenerCoordenadasOpcionales) enviando {} si el GPS no responde | Robustez / Terreno | Servicio | Alta | Dispositivo sin API `navigator.geolocation` o con demora superior a `timeoutMs` | `obtenerCoordenadasOpcionales(10)` sin respuesta del hardware GPS | Resuelve `{}` al cumplirse el timeout sin bloquear ni rechazar la promesa de aceptación de misión | Retorna `{}` de forma segura tras el timeout configurado | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-09` | Validación de rangos geográficos WGS84 del payload de coordenadas antes de enviar o encolar en IndexedDB (validarPayloadAceptarMision) | Validación / Contrato | Servicio | Media | Coordenadas válidas `{ latitud: -39.81, longitud: -73.24 }` vs fuera de rango `{ latitud: 999, longitud: -73.24 }` | `validarPayloadAceptarMision(coords)` | Conserva coordenadas dentro de `[-90, 90]` / `[-180, 180]` y descarta valores fuera de rango o no numéricos | Retorna `{ latitud: -39.81, longitud: -73.24 }` para datos válidos y `{}` para `latitud: 999` | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-10` | Aceptación optimista en modo offline guardando estado EN_CURSO en IndexedDB y encolando acción ACEPTAR_MISION en outbox | Offline-First / Persistencia | Servicio / IndexedDB | Crítica | Sin conexión (`navigator.onLine = false` o `TypeError: Failed to fetch`) | `aceptarMisionPatrulla(misionId, { coordenadas: { latitud: -39.814, longitud: -73.245 } })` | Guarda misión en IndexedDB con `estado: 'EN_CURSO'` y `sincronizacionPendiente: true`, y encola en `outbox` `{ tipo: 'ACEPTAR_MISION', url: '/api/misiones/{id}/aceptar', metodo: 'POST', payload }` | Misión persistida localmente como `EN_CURSO` con `sincronizacionPendiente: true` y acción `ACEPTAR_MISION` registrada en `outbox` | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-11` | Visualización del banner de cola local 'Pendiente de sincronizar' en modo offline y su limpieza al recibir el evento sgrai:outbox-synced | Offline-First / UI | Componente / Integración | Alta | Misión aceptada en modo offline (`sincronizacionPendiente: true`) | Disparo de clic en `"Aceptar Misión"` offline seguido de `window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'))` | Muestra el banner `"Pendiente de sincronizar: La aceptación fue guardada en la cola local..."` y lo oculta automáticamente tras sincronizar la cola | Banner renderizado en modo offline y removido del DOM al completarse el evento `sgrai:outbox-synced` | APROBADO | 09/11/2026 12:38 | - | test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36) |
| `CP-H36-PWA-12` | Sincronización diferida de la cola outbox en IndexedDB al recuperar conectividad (sincronizarColaOutbox) | Offline-First / Cola Outbox | Servicio / Hook | Crítica | Acción `ACEPTAR_MISION` almacenada en el objectStore `outbox` de `sgrai_terreno_offline_db` | `sincronizarColaOutbox(ejecutorHttp)` y evento `window` `'online'` en `useConnectivity` | Ejecuta el `POST` diferido, elimina la acción del store `outbox` cuando retorna `true` y actualiza `sincronizacionPendiente: false` con la `fechaInicio` del servidor | Acción procesada y eliminada de `outbox`, dejando `contarAccionesPendientes() === 0` | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-13` | Rechazo explícito sin encolar en outbox cuando el backend retorna 403 Forbidden por falta de permiso o pertenencia a otra patrulla | Seguridad / Manejo de Errores | Servicio / UI | Alta | Usuario con sesión JWT válida al que la API responde `403 Forbidden` | `aceptarMisionPatrulla(misionId)` con respuesta `403` (`"No cuenta con el permiso misiones:terreno:verificar"`) | Lanza `MisionServiceError` con `statusCode: 403`, muestra alerta `.errorAlert` (`role="alert"`) en la vista y NO encola la acción en `outbox` | Lanza `MisionServiceError` y `encolarAccionOutbox` no es invocado | APROBADO | 09/11/2026 12:38 | - | test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36) |
| `CP-H36-PWA-14` | Manejo idempotente cuando la misión ya había sido aceptada previamente en el servidor (409 Conflict por estado EN_CURSO) | Concurrencia / Idempotencia | Servicio | Alta | Misión ya en estado `EN_CURSO` en el backend por doble clic o reintento de red | `aceptarMisionPatrulla(misionId)` con respuesta `409` (`"La misión ya se encuentra EN_CURSO"`) | Retorna `yaAceptadaPreviamente: true`, `enColaOffline: false` y `mision.estado: 'EN_CURSO'` sin encolar en `outbox` | Transiciona limpiamente a `EN_CURSO` con `yaAceptadaPreviamente: true` | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-15` | Protección de rutas de terreno en middleware proxy redirigiendo a /terreno/login cuando no existe cookie sgrai_auth_token | Seguridad / Perímetro | Middleware Proxy | Alta | Petición HTTP sin cookie `sgrai_auth_token` hacia `/terreno/patrulla/misiones/{id}` | `GET http://localhost:3002/terreno/patrulla/misiones/68abde99-780d-41a9-aee6-f68371d226aa` sin cookies | HTTP `307 Temporary Redirect` hacia `/terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones%2F...` | Responde `HTTP/1.1 307 Temporary Redirect` con la cabecera `location` esperada | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-16` | Inyección de cabecera Authorization Bearer y extracción de x-user-id desde el payload JWT en el interceptor de apiClient | Seguridad / Cliente HTTP | API Client | Alta | Cookie `sgrai_auth_token` con un JWT válido | Petición mediante `apiClient.POST('/api/misiones/{id}/aceptar', ...)` | El interceptor `onRequest` adjunta `Authorization: Bearer <token>` y extrae `sub`/`usuarioId` en `x-user-id` | Cabeceras de autenticación inyectadas en la petición saliente | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-17` | Tipado estricto del contrato OpenAPI generado para POST /api/misiones/{id}/aceptar en src/types/api-generated.d.ts y src/types/offline.ts | Contrato OpenAPI | Tipos TypeScript | Alta | Esquema generado en `src/types/api-generated.d.ts` | Revisión de `paths['/api/misiones/{id}/aceptar']['post']` y `AceptarMisionPayload` | Tipos de entrada (`latitud`, `longitud`), parámetros (`id`) y respuestas (`200`, `400`, `401`, `403`, `404`, `409`, `500`) derivados de `api-generated.d.ts` sin interfaces manuales | `AceptarMisionPayload` y `AceptarMisionApiData` referencian directamente `paths['/api/misiones/{id}/aceptar']` | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-18` | Cumplimiento de estándares de diseño táctil para terreno: área mínima de 56px en botón 'Aceptar Misión', esquinas rectas (border-radius: 0) e íconos lucide-react | Usabilidad / Diseño Terreno | UI / CSS | Media | Hoja de estilos `PatrullaDetailPage.module.css` y componente `PatrullaMisionDetailPage` | Inspección de `.acceptButton`, `.acceptCard`, `.enTrayectoCard` e íconos `CheckCircle`, `Navigation`, `ClipboardCheck`, `WifiOff` | `.acceptButton` con `min-height: 56px`, `border-radius: 0`, paleta institucional (`--color-primary-teal`, `--color-accent-mint`, `--color-sage`, `--color-charcoal`) y 0 emojis | Estilos e íconos cumplen con la guía de diseño táctil de terreno | APROBADO | 09/11/2026 12:38 | - | feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36) |
| `CP-H36-PWA-19` | Documentación del contrato de terreno en docs/api/contratos-terreno.md y manual de usuario en docs/manuals/H36-aceptar-mision-patrulla.md | Documentación | Documentación Técnica / Manual | Media | Archivos en `docs/api/contratos-terreno.md` y `docs/manuals/H36-aceptar-mision-patrulla.md` | Revisión de sección `2.1 Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (H36)` y manual paso a paso | Contrato HTTP, timeout GPS de 5s, comportamiento offline e idempotencia `409` documentados | Documentación técnica y manual de terreno incorporados en el repositorio | APROBADO | 09/11/2026 12:38 | - | docs(patrulla): documentar contrato OpenAPI y manual de terreno para aceptar mision (H36) |
| `CP-H36-PWA-20` | Ejecución completa de la suite de pruebas unitarias y de integración de HU-36 en Vitest y React Testing Library | Automatización | Unit / Component / Service | Alta | Suite de pruebas en `sgrai-pwa` | `npm test -- src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx src/services/__tests__/misionesService.test.ts src/hooks/__tests__/useConnectivity.test.ts src/services/__tests__/offlineQueue.test.ts` | 20/20 tests focalizados (y 81/81 tests globales en 26 archivos) aprobados sin errores | 20/20 tests focalizados y 81/81 tests totales aprobados | APROBADO | 09/11/2026 12:38 | - | test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36) |

---

## 4. Bloque TSV para Hoja de Cálculo

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H36-PWA-01	Bypass de autenticación y RBAC mediante dev-patrulla-token, enmascaramiento de errores 401/403/404 como éxito y fallback permisivo de misiones:terreno:verificar	Seguridad / RBAC	Integración / Auth / Servicio	Crítica	Acceso a /terreno/login o sesión de patrulla con permisos: []	Clic en "Acceso Rápido Patrulla (Prueba Local)" (sgrai_auth_token=dev-patrulla-token) e invocación a aceptarMisionPatrulla con respuesta 403 o 404	Sin puertas traseras en producción; 401/403/404 deben lanzar MisionServiceError y tienePermiso('misiones:terreno:verificar') debe ser false si permisos es []	El botón en login inyecta dev-patrulla-token, aceptarMisionPatrulla simula 200 OK ante errores 401/403/404 y tienePermiso retorna true cuando permisos está vacío	ABIERTO	09/11/2026 12:34	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H36-PWA-02	Sobrescritura destructiva del estado optimista EN_CURSO en obtenerDetalleMision / sincronizarMisiones e inyección de misiones ficticias en producción	Funcional / Offline-First	Servicio / UI / IndexedDB	Crítica	Misión aceptada offline (estado: 'EN_CURSO', sincronizacionPendiente: true) o patrulla sin misiones asignadas (data: [])	obtenerDetalleMision(id) / sincronizarMisiones() antes de vaciar outbox, o carga de /terreno/patrulla/misiones con []	Preservar estado optimista EN_CURSO con sincronizacionPendiente: true hasta vaciar outbox, y mostrar estado vacío cuando la API retorna []	obtenerDetalleMision y sincronizarMisiones sobrescriben IndexedDB regresando la misión a DESPACHADA, y las vistas inyectan misiones hardcodeadas (INC-2026-0001 / Av. Alemania 600)	ABIERTO	09/11/2026 12:35	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H36-PWA-03	Transición inválida a EN_CURSO ante cualquier respuesta 409 Conflict o 422 en aceptarMisionPatrulla y useConnectivity cuando la misión fue cancelada o cerrada	Regla de Negocio ICS	Servicio / Hook Offline	Alta	Misión en estado CANCELADA, COMPLETADA o RECHAZADA en el servidor que responde 409 Conflict	POST /api/misiones/{id}/aceptar retornando 409 Conflict ("La misión no puede ser aceptada porque su estado actual es 'CANCELADA'")	Rechazar la transición mostrando alerta de error y actualizar al estado real de la misión sin habilitar formularios técnicos	aceptarMisionPatrulla y useConnectivity asumen que todo 409 (y 422) es EN_CURSO, habilitando "En Trayecto / Evaluación" y formularios sobre misiones canceladas	ABIERTO	09/11/2026 12:36	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H36-PWA-04	Falta de ejecución automática de sincronizar() cuando navigator.onLine es true, falso badge Sincronizado con pendientes > 0 y duplicados en outbox	Offline-First / Sincronización	Hook / IndexedDB / UI	Alta	Fallo de red transitorio con navigator.onLine === true y pendientes === 1 en outbox	useConnectivity() montado con online: true y 1 acción ACEPTAR_MISION en outbox	Disparar sincronizar() automáticamente cuando online && pendientes > 0, mostrar estado pendiente en ConnectionStatusBadge y deduplicar outbox	sincronizar() nunca se invoca si no ocurre evento 'online', ConnectionStatusBadge muestra "Sincronizado" junto al banner "Pendiente de sincronizar" y outbox permite duplicados	ABIERTO	09/11/2026 12:37	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H36-PWA-05	Omisión del filtro patrullaId en PatrullaMisionesPage y TerrenoSiguienteMision y 4 advertencias ESLint por uso de window.location.assign	Funcional / Calidad de Código	UI / Servicio / Linter	Media	Usuario patrulla autenticado y ejecución de npm run lint	sincronizarMisiones({ tipoMision: 'VERIFICACION' }) y comando npm run lint	Filtrar petición por patrullaId de la unidad activa y obtener 0 warnings en ESLint	No envía patrullaId a GET /api/misiones y npm run lint reporta 4 advertencias @next/next/no-location-assign-relative-destination	ABIERTO	09/11/2026 12:38	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H36-PWA-01	Renderizado prominente del botón 'Aceptar Misión' cuando la misión está en estado DESPACHADA, unidadActiva es true y posee el permiso misiones:terreno:verificar	Funcional / UI (CA-1, CA-7)	Componente / Integración	Crítica	Misión 60000000-0000-4000-8000-000000000001 en DESPACHADA, unidadActiva: true y permiso misiones:terreno:verificar	Renderizado de PatrullaMisionDetailPage con misión DESPACHADA	Se muestra la tarjeta "Confirmación de salida a terreno" con el botón táctil "Aceptar Misión" (min-height: 56px) y los formularios técnicos permanecen ocultos	Botón "Aceptar Misión" visible y accesible; sección formularios-reporte-tecnico no renderizada antes de aceptar	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-02	Ocultamiento del botón 'Aceptar Misión' cuando el usuario no posee el permiso RBAC misiones:terreno:verificar	Seguridad / RBAC (CA-7)	Componente / UI	Crítica	Misión en DESPACHADA y tienePermiso('misiones:terreno:verificar') === false	Renderizado de PatrullaMisionDetailPage con permisoVerificar: false	El botón "Aceptar Misión" no se renderiza en el DOM	queryByRole('button', { name: /aceptar misión/i }) retorna null	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-03	Ocultamiento del botón 'Aceptar Misión' y activación de modo solo lectura cuando la patrulla está inactiva (unidadActiva: false)	Regla de Negocio / UI	Componente / UI	Alta	Patrulla desactivada (unidadActiva: false)	Renderizado de PatrullaMisionDetailPage con unidadActiva: false	Muestra UnidadInactivaBanner, aviso "Solo lectura" y oculta el botón "Aceptar Misión"	Banner de unidad inactiva y aviso de solo lectura presentes; botón de aceptación oculto	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-04	Invocación del endpoint POST /api/misiones/{id}/aceptar con coordenadas GPS válidas al presionar 'Aceptar Misión' en modo online (200 OK)	Funcional / Integración (CA-2)	Servicio / API Client	Crítica	navigator.onLine = true, misión 60000000-0000-4000-8000-000000000001 en DESPACHADA	aceptarMisionPatrulla(id, { coordenadas: { latitud: -39.819588, longitud: -73.245209 } })	apiClient.POST invocado hacia /api/misiones/{id}/aceptar con params.path.id y body: { latitud: -39.819588, longitud: -73.245209 }	Petición enviada con la ruta y payload tipados, retornando enColaOffline: false y estado: 'EN_CURSO'	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-05	Transición de la vista a 'En Trayecto / Evaluación' y habilitación de 'Formularios de Reporte Técnico' tras aceptar la misión	Funcional / UI (CA-6)	Componente / Integración	Crítica	Misión en estado DESPACHADA aceptada por el operador	Clic en botón "Aceptar Misión" en PatrullaMisionDetailPage	Desaparece el botón "Aceptar Misión", se despliega el encabezado "En Trayecto / Evaluación" con chip "Misión activa" y se habilita data-testid="formularios-reporte-tecnico"	Transición de pantalla completada mostrando "En Trayecto / Evaluación" y "Formularios de Reporte Técnico" con chip "Habilitado"	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-06	Visualización de los estados canónicos ICS en terreno: Misión 'En curso', Patrulla 'En verificación' e Incidente 'Verificando' (sin estado ambiguo 'En camino')	Regla de Negocio ICS (CA-4)	Componente / Servicio	Crítica	Misión aceptada en estado EN_CURSO	Inspección de grilla .canonicalStatesGrid y datosAdicionales tras aceptar misión	Muestra Misión: En curso, Patrulla: En verificación (EN_VERIFICACION) e Incidente: Verificando (VERIFICANDO)	Se renderizan exactamente los tres estados canónicos ICS sin utilizar el texto no canónico 'En camino'	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-07	Actualización de la etiqueta y marca temporal a 'Inicio de trayecto' con fechaInicio retornada por el servidor	Funcional / UI (CA-3)	Componente / Servicio	Alta	Respuesta 200 OK de POST /api/misiones/{id}/aceptar con fechaInicio: "2026-11-01T21:00:00.000Z"	aceptarMisionPatrulla y renderizado de ficha superior en PatrullaMisionDetailPage	mision.fechaInicio toma el timestamp del servidor y la etiqueta cambia de "Despachada" a "Inicio de trayecto" en formato 24h	resultado.mision.fechaInicio actualizado a "2026-11-01T21:00:00.000Z" y persistido en IndexedDB	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-08	Obtención no bloqueante de coordenadas GPS con timeout de 5 segundos (obtenerCoordenadasOpcionales) enviando {} si el GPS no responde	Robustez / Terreno	Servicio	Alta	Dispositivo sin API navigator.geolocation o con demora superior a timeoutMs	obtenerCoordenadasOpcionales(10) sin respuesta del hardware GPS	Resuelve {} al cumplirse el timeout sin bloquear ni rechazar la promesa de aceptación de misión	Retorna {} de forma segura tras el timeout configurado	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-09	Validación de rangos geográficos WGS84 del payload de coordenadas antes de enviar o encolar en IndexedDB (validarPayloadAceptarMision)	Validación / Contrato	Servicio	Media	Coordenadas válidas { latitud: -39.81, longitud: -73.24 } vs fuera de rango { latitud: 999, longitud: -73.24 }	validarPayloadAceptarMision(coords)	Conserva coordenadas dentro de [-90, 90] / [-180, 180] y descarta valores fuera de rango o no numéricos	Retorna { latitud: -39.81, longitud: -73.24 } para datos válidos y {} para latitud: 999	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-10	Aceptación optimista en modo offline guardando estado EN_CURSO en IndexedDB y encolando acción ACEPTAR_MISION en outbox	Offline-First / Persistencia	Servicio / IndexedDB	Crítica	Sin conexión (navigator.onLine = false o TypeError: Failed to fetch)	aceptarMisionPatrulla(misionId, { coordenadas: { latitud: -39.814, longitud: -73.245 } })	Guarda misión en IndexedDB con estado: 'EN_CURSO' y sincronizacionPendiente: true, y encola en outbox { tipo: 'ACEPTAR_MISION', url: '/api/misiones/{id}/aceptar', metodo: 'POST', payload }	Misión persistida localmente como EN_CURSO con sincronizacionPendiente: true y acción ACEPTAR_MISION registrada en outbox	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-11	Visualización del banner de cola local 'Pendiente de sincronizar' en modo offline y su limpieza al recibir el evento sgrai:outbox-synced	Offline-First / UI	Componente / Integración	Alta	Misión aceptada en modo offline (sincronizacionPendiente: true)	Disparo de clic en "Aceptar Misión" offline seguido de window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'))	Muestra el banner "Pendiente de sincronizar: La aceptación fue guardada en la cola local..." y lo oculta automáticamente tras sincronizar la cola	Banner renderizado en modo offline y removido del DOM al completarse el evento sgrai:outbox-synced	APROBADO	09/11/2026 12:38	-	test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36)
CP-H36-PWA-12	Sincronización diferida de la cola outbox en IndexedDB al recuperar conectividad (sincronizarColaOutbox)	Offline-First / Cola Outbox	Servicio / Hook	Crítica	Acción ACEPTAR_MISION almacenada en el objectStore outbox de sgrai_terreno_offline_db	sincronizarColaOutbox(ejecutorHttp) y evento window 'online' en useConnectivity	Ejecuta el POST diferido, elimina la acción del store outbox cuando retorna true y actualiza sincronizacionPendiente: false con la fechaInicio del servidor	Acción procesada y eliminada de outbox, dejando contarAccionesPendientes() === 0	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-13	Rechazo explícito sin encolar en outbox cuando el backend retorna 403 Forbidden por falta de permiso o pertenencia a otra patrulla	Seguridad / Manejo de Errores	Servicio / UI	Alta	Usuario con sesión JWT válida al que la API responde 403 Forbidden	aceptarMisionPatrulla(misionId) con respuesta 403 ("No cuenta con el permiso misiones:terreno:verificar")	Lanza MisionServiceError con statusCode: 403, muestra alerta .errorAlert (role="alert") en la vista y NO encola la acción en outbox	Lanza MisionServiceError y encolarAccionOutbox no es invocado	APROBADO	09/11/2026 12:38	-	test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36)
CP-H36-PWA-14	Manejo idempotente cuando la misión ya había sido aceptada previamente en el servidor (409 Conflict por estado EN_CURSO)	Concurrencia / Idempotencia	Servicio	Alta	Misión ya en estado EN_CURSO en el backend por doble clic o reintento de red	aceptarMisionPatrulla(misionId) con respuesta 409 ("La misión ya se encuentra EN_CURSO")	Retorna yaAceptadaPreviamente: true, enColaOffline: false y mision.estado: 'EN_CURSO' sin encolar en outbox	Transiciona limpiamente a EN_CURSO con yaAceptadaPreviamente: true	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-15	Protección de rutas de terreno en middleware proxy redirigiendo a /terreno/login cuando no existe cookie sgrai_auth_token	Seguridad / Perímetro	Middleware Proxy	Alta	Petición HTTP sin cookie sgrai_auth_token hacia /terreno/patrulla/misiones/{id}	GET http://localhost:3002/terreno/patrulla/misiones/68abde99-780d-41a9-aee6-f68371d226aa sin cookies	HTTP 307 Temporary Redirect hacia /terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones%2F...	Responde HTTP/1.1 307 Temporary Redirect con la cabecera location esperada	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-16	Inyección de cabecera Authorization Bearer y extracción de x-user-id desde el payload JWT en el interceptor de apiClient	Seguridad / Cliente HTTP	API Client	Alta	Cookie sgrai_auth_token con un JWT válido	Petición mediante apiClient.POST('/api/misiones/{id}/aceptar', ...)	El interceptor onRequest adjunta Authorization: Bearer <token> y extrae sub/usuarioId en x-user-id	Cabeceras de autenticación inyectadas en la petición saliente	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-17	Tipado estricto del contrato OpenAPI generado para POST /api/misiones/{id}/aceptar en src/types/api-generated.d.ts y src/types/offline.ts	Contrato OpenAPI	Tipos TypeScript	Alta	Esquema generado en src/types/api-generated.d.ts	Revisión de paths['/api/misiones/{id}/aceptar']['post'] y AceptarMisionPayload	Tipos de entrada (latitud, longitud), parámetros (id) y respuestas (200, 400, 401, 403, 404, 409, 500) derivados de api-generated.d.ts sin interfaces manuales	AceptarMisionPayload y AceptarMisionApiData referencian directamente paths['/api/misiones/{id}/aceptar']	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-18	Cumplimiento de estándares de diseño táctil para terreno: área mínima de 56px en botón 'Aceptar Misión', esquinas rectas (border-radius: 0) e íconos lucide-react	Usabilidad / Diseño Terreno	UI / CSS	Media	Hoja de estilos PatrullaDetailPage.module.css y componente PatrullaMisionDetailPage	Inspección de .acceptButton, .acceptCard, .enTrayectoCard e íconos CheckCircle, Navigation, ClipboardCheck, WifiOff	.acceptButton con min-height: 56px, border-radius: 0, paleta institucional (--color-primary-teal, --color-accent-mint, --color-sage, --color-charcoal) y 0 emojis	Estilos e íconos cumplen con la guía de diseño táctil de terreno	APROBADO	09/11/2026 12:38	-	feat(patrulla): implementar aceptacion de mision con soporte offline e idempotencia (H36)
CP-H36-PWA-19	Documentación del contrato de terreno en docs/api/contratos-terreno.md y manual de usuario en docs/manuals/H36-aceptar-mision-patrulla.md	Documentación	Documentación Técnica / Manual	Media	Archivos en docs/api/contratos-terreno.md y docs/manuals/H36-aceptar-mision-patrulla.md	Revisión de sección 2.1 Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (H36) y manual paso a paso	Contrato HTTP, timeout GPS de 5s, comportamiento offline e idempotencia 409 documentados	Documentación técnica y manual de terreno incorporados en el repositorio	APROBADO	09/11/2026 12:38	-	docs(patrulla): documentar contrato OpenAPI y manual de terreno para aceptar mision (H36)
CP-H36-PWA-20	Ejecución completa de la suite de pruebas unitarias y de integración de HU-36 en Vitest y React Testing Library	Automatización	Unit / Component / Service	Alta	Suite de pruebas en sgrai-pwa	npm test -- src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx src/services/__tests__/misionesService.test.ts src/hooks/__tests__/useConnectivity.test.ts src/services/__tests__/offlineQueue.test.ts	20/20 tests focalizados (y 81/81 tests globales en 26 archivos) aprobados sin errores	20/20 tests focalizados y 81/81 tests totales aprobados	APROBADO	09/11/2026 12:38	-	test(patrulla): agregar pruebas unitarias y de interfaz para aceptacion de mision (H36)
```

---

## 5. Guía de Ejecución Paso a Paso y Evidencias Replicables

### 5.1 Ejecución de Pruebas Automatizadas en Vitest y React Testing Library

#### 5.1.1 Suite Focalizada en Aceptación de Misión por Patrulla Verificadora (HU-36)
```bash
npm test -- "src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx" "src/services/__tests__/misionesService.test.ts" "src/hooks/__tests__/useConnectivity.test.ts" "src/services/__tests__/offlineQueue.test.ts"
```

**Salida de Consola:**
```text
 RUN  v3.2.7 /home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app

 ✓ src/services/__tests__/offlineQueue.test.ts (4 tests) 28ms
 ✓ src/services/__tests__/misionesService.test.ts (9 tests) 39ms
 ✓ src/hooks/__tests__/useConnectivity.test.ts (3 tests) 77ms
 ✓ src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx (4 tests) 546ms

 Test Files  4 passed (4)
      Tests  20 passed (20)
   Start at  12:38:16
   Duration  3.33s (transform 596ms, setup 1.07s, collect 1.27s, tests 689ms, environment 4.59s, prepare 610ms)
```

#### 5.1.2 Ejecución Focalizada por Casos Específicos (`-t`)
```bash
npm test -- -t "PatrullaMisionDetailPage — Confirmar y aceptar misión asignada \(HU-36\)"
npm test -- -t "aceptarMisionPatrulla — Confirmación de salida de Patrulla Verificadora \(HU-36\)"
npm test -- -t "useConnectivity hook"
```

#### 5.1.3 Evidencia de Análisis Estático ESLint (`BUG-H36-PWA-05`)
```bash
npm run lint
```

**Salida de Consola:**
```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/app/(auth)/login/page.tsx
  51:11  warning  Do not use `window.location.assign()` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead.  @next/next/no-location-assign-relative-destination

/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/app/(terreno)/page.tsx
  26:11  warning  Do not use `window.location.assign()` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead.  @next/next/no-location-assign-relative-destination

/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/context/AuthContext.tsx
  140:13  warning  Do not use `window.location.assign()` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead.  @next/next/no-location-assign-relative-destination

/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/lib/api/client.ts
  47:9  warning  Do not use `window.location.assign()` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead.  @next/next/no-location-assign-relative-destination

✖ 4 problems (0 errors, 4 warnings)
```

---

### 5.2 Pruebas Replicables de Rutas PWA, Perímetro e Integración HTTP mediante cURL

#### Caso 1: Protección de Ruta de Detalle de Misión sin Sesión Activa (`307 Temporary Redirect` — `CP-H36-PWA-15`)
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

#### Caso 2: Acceso a la Vista de Detalle de Misión de Patrulla con Cookie de Sesión (`200 OK` — `CP-H36-PWA-01`)
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

#### Caso 3: Verificación de Cabeceras del Service Worker para Soporte Offline-First (`200 OK` — `CP-H36-PWA-10`)
```bash
curl -s -i "http://localhost:3002/terreno/sw.js" | head -n 12
```

**Respuesta HTTP:**
```http
HTTP/1.1 200 OK
Content-Type: application/javascript; charset=utf-8
Service-Worker-Allowed: /terreno
Cache-Control: no-cache, no-store, must-revalidate
X-Content-Type-Options: nosniff
```

#### Caso 4: Invocación del Contrato `POST /api/misiones/{id}/aceptar` con Coordenadas GPS desde la PWA (`200 OK` — `CP-H36-PWA-04`)
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

#### Caso 5: Respuesta `409 Conflict` cuando la Misión se Encuentra en Estado `COMPLETADA` (`BUG-H36-PWA-03`)
```bash
curl -s -i -X POST "http://localhost:3001/api/misiones/d1000000-0000-4000-8000-000000000004/aceptar" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

**Respuesta HTTP/JSON:**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{"message":"La misión no puede ser aceptada porque su estado actual es 'COMPLETADA'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."}
```

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación (CA) | Casos de Prueba Asociados | Estado en Frontend (`sgrai-pwa`) | Observaciones Técnicas |
|---|---|:---:|---|
| **CA-1:** La vista de detalle de la misión asignada en la PWA debe presentar un botón prominente 'Aceptar Misión'. | `CP-H36-PWA-01`, `CP-H36-PWA-03`, `CP-H36-PWA-18`, `BUG-H36-PWA-02`, `BUG-H36-PWA-05` | 🟡 **PARCIAL (`BUG-H36-PWA-02`, `BUG-H36-PWA-05`)** | El botón `'Aceptar Misión'` (`min-height: 56px`) se renderiza prominentemente cuando la misión está `DESPACHADA`, pero `PatrullaMisionDetailPage` y `PatrullaMisionesPage` fabrican misiones ficticias cuando la API retorna vacío o `404` (`BUG-H36-PWA-02`) y no filtran por `patrullaId` (`BUG-H36-PWA-05`). |
| **CA-2:** Al presionar 'Aceptar Misión', la PWA debe invocar el endpoint `POST /api/misiones/{id}/aceptar`. | `CP-H36-PWA-04`, `CP-H36-PWA-08`, `CP-H36-PWA-09`, `CP-H36-PWA-10`, `CP-H36-PWA-12`, `CP-H36-PWA-17`, `BUG-H36-PWA-01`, `BUG-H36-PWA-04` | 🔴 **CON DEFECTO (`BUG-H36-PWA-01`, `BUG-H36-PWA-04`)** | Invoca `POST /api/misiones/{id}/aceptar` con soporte offline, pero en modo `dev-patrulla-token` enmascara respuestas `401/403/404` como aceptaciones exitosas (`BUG-H36-PWA-01`), y cuando una acción cae a `outbox` con `navigator.onLine === true`, `useConnectivity` nunca dispara `sincronizar()` automáticamente (`BUG-H36-PWA-04`). |
| **CA-3:** La API debe ejecutar una transición atómica: (1) Actualizar `mision.estado` de `DESPACHADA` a `EN_CURSO`, (2) Fijar `mision.fecha_inicio = CURRENT_TIMESTAMP`, y (3) Registrar el hito 'Misión Aceptada por Patrulla' en la tabla `mision_hito`. | `CP-H36-PWA-07`, `CP-H36-PWA-14`, `BUG-H36-PWA-02` | 🔴 **CON DEFECTO (`BUG-H36-PWA-02`)** | La PWA almacena `estado: 'EN_CURSO'`, `fechaInicio` e `hitoAceptacion` al aceptar, pero `obtenerDetalleMision` y `sincronizarMisiones` sobrescriben el estado optimista local de vuelta a `'DESPACHADA'` si se ejecutan antes de que la cola `outbox` termine de sincronizar (`BUG-H36-PWA-02`). |
| **CA-4:** El estado de la patrulla verificadora debe mantenerse en `EN_VERIFICACION` y el incidente permanece en `VERIFICANDO` (corrigiendo la ambigüedad de 'En camino', que no es un estado canónico de incidente). | `CP-H36-PWA-06`, `BUG-H36-PWA-03` | 🔴 **CON DEFECTO (`BUG-H36-PWA-03`)** | En aceptaciones válidas muestra `Misión: En curso`, `Patrulla: En verificación` e `Incidente: Verificando`, pero ante un `409 Conflict` por misión `CANCELADA` o `COMPLETADA` fuerza igualmente `EN_CURSO` / `EN_VERIFICACION` / `VERIFICANDO` (`BUG-H36-PWA-03`). |
| **CA-5:** El sistema debe emitir en tiempo real el evento WebSocket `mision:actualizada` hacia la sala `encargado` del Centro de Mando. | *(Alcance Backend `sgrai-api` / Frontend Web `sgrai-web`)* | ⚪ **N/A EN PWA** | La emisión del evento WebSocket `mision:actualizada` hacia la sala `encargado` se ejecuta en `sgrai-api` al procesar `POST /api/misiones/{id}/aceptar`. |
| **CA-6:** La PWA debe cambiar el estado de la vista a 'En Trayecto / Evaluación' habilitando los formularios de reporte técnico. | `CP-H36-PWA-05`, `CP-H36-PWA-11`, `BUG-H36-PWA-02`, `BUG-H36-PWA-03` | 🔴 **CON DEFECTO (`BUG-H36-PWA-02`, `BUG-H36-PWA-03`)** | Cambia la vista a `'En Trayecto / Evaluación'` y habilita `formularios-reporte-tecnico`, pero también los habilita indebidamente cuando la API retorna `409 Conflict` por misión cancelada o completada (`BUG-H36-PWA-03`). |
| **CA-7:** El endpoint debe requerir el permiso RBAC `misiones:terreno:verificar`. | `CP-H36-PWA-02`, `CP-H36-PWA-13`, `CP-H36-PWA-15`, `CP-H36-PWA-16`, `BUG-H36-PWA-01` | 🔴 **CON DEFECTO (`BUG-H36-PWA-01`)** | `PatrullaMisionDetailPage` verifica `tienePermiso('misiones:terreno:verificar')`, pero `AuthContext.tsx` retorna `true` por fallback cuando `esPatrulla && listaPermisos.length === 0` y expone el bypass `'dev-patrulla-token'` en `/terreno/login` (`BUG-H36-PWA-01`). |


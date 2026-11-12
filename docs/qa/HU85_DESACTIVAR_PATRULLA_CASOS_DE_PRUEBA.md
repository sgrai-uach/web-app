# Auditoría Técnica y Matriz de Casos de Prueba — HU-[85]: Desactivar Patrulla (Cliente Terreno `sgrai-pwa`)

**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia  
**Repositorio Auditado:** `sgrai-pwa` (`web-app`)  
**Rama Evaluada:** `feature/H85-desactivar-patrulla` (base `develop` / Merge PR #1)  
**Historia de Usuario:** HU-[85] — Desactivar Patrulla Verificadora (baja lógica §3.7 y comportamiento en terreno)  
**Desarrollador Asignado:** `zetastormy`  
**Rol Responsable de Auditoría:** QA Lead  
**Fecha y Hora de Auditoría Inicial:** `11/11/2026 11:41 -03:00`  
**Entorno de Ejecución:** Linux, Node.js, Vitest v3.2.7, Next.js 16.3.4 (Turbopack), ESLint, TypeScript (`tsc --noEmit`), API local `http://localhost:3001`, PWA local `http://localhost:3002`  
**Dictamen de Auditoría QA:** **RECHAZADO PARA INTEGRACIÓN (6 Defectos Abiertos: 1 Crítico Bloqueante, 3 Altos, 2 Medios)**

---

## Alcance Arquitectónico en `sgrai-pwa`

De acuerdo con la separación de responsabilidades de SGRAI, la acción administrativa **'Desactivar Patrulla'**, su modal de confirmación y la mutación `DELETE /api/patrullas/[id]` (soft delete `activo = false`, `eliminado_en = CURRENT_TIMESTAMP`, liberación de vehículo/personal y rechazo `409 Conflict` ante misiones activas o estado `EN_VERIFICACION`) pertenecen a `sgrai-web` y `sgrai-api`.

En el cliente de terreno `sgrai-pwa` (cuyo alcance se restringe a los roles `PATRULLA_VERIFICADORA` y `DELEGADO_CUADRILLA`), la rama `feature/H85-desactivar-patrulla` implementa la contraparte operativa en campo ante la baja lógica o ausencia de asignación de la unidad:

- Mapeo de `unidadId`, `unidadNombre` y `unidadActiva` en `AuthContext` con discriminación de estado `ACTIVA`, `DESACTIVADA` y `SIN_ASIGNACION` bajo principio Fail-Closed (solo lectura cuando la unidad está inactiva).
- Visualización de banners diferenciados (`UnidadInactivaBanner` y `SinUnidadBanner`) en el hub `/terreno`, listados de misiones de patrulla/cuadrilla y detalle de misión.
- Registro y consulta local del historial de patrullas asignadas (`historial_unidades_<usuarioId>`) en `/terreno/perfil`.
- Actualización del manual de usuario `docs/manuals/H85-patrulla-desactivada-terreno.md`.

---

## 1. Resumen Ejecutivo

La suite unitaria y de componentes con mocks en Vitest finalizó con resultados en verde (`27` archivos / `92` pruebas ejecutadas); sin embargo, **la verificación estática de TypeScript (`npx tsc --noEmit`) y la compilación productiva (`npm run build`) fallan con código de salida distinto de cero** debido a un mock desactualizado en `PatrullaDetailPage.test.tsx`. Adicionalmente, la inspección forense de código y las pruebas integradas frente a `sgrai-api` (`http://localhost:3001`) y `sgrai-pwa` (`http://localhost:3002`) evidenciaron defectos de severidad alta y media en aislamiento de misiones por unidad, sincronización de contratos OpenAPI, manejo de sesión/outbox ante baja remota e inconsistencias visuales y documentales.

| Indicador / Verificación | Resultado Obtenido | Observación Técnica |
|---|---|---|
| Total de casos auditados (HU-85 PWA) | `21` casos | `6` defectos `ABIERTO` + `15` casos `APROBADO` |
| Defectos abiertos por severidad | `1` Crítica, `3` Alta, `2` Media | Impiden el paso a integración hasta su corrección y re-test |
| Suite automatizada completa (`npm test`) | `27` archivos / `92` pruebas aprobadas (`4.58s`) | Ejecutada con mocks de IndexedDB/servicios; Vitest no valida tipos TS |
| Subconjunto específico H85 (`npx vitest run ...`) | `9` archivos / `29` pruebas aprobadas (`2.07s`) | No incluye casos para `PatrullaDetailPage` con unidad inactiva o sin asignación |
| Análisis estático ESLint (`npm run lint`) | `0` errores, `4` advertencias | Regla `@next/next/no-location-assign-relative-destination` en 4 archivos |
| Verificación de tipos (`npx tsc --noEmit`) | **FALLIDO** (exit code `2`, `1` error `TS2345`) | Faltan propiedades `tieneUnidadAsignada` y `estadoAsignacion` en mock de `useAuth` |
| Build de producción (`npm run build`) | **FALLIDO** (exit code `1`) | Compila en `2.3s`, pero aborta en `Failed to type check.` por el mismo `TS2345` |
| Prohibición de emojis en UI (`src/`) | Aprobado (`0` coincidencias) | Verificado mediante búsqueda de rangos Unicode en `src/` |

---

## 2. Registro Técnico de Defectos

### BUG-H85-PWA-01 — Fallo de compilación TypeScript y build de producción por mock incompleto de `AuthContextValue`
- **Severidad:** Crítica (Bloqueante de build y despliegue)
- **Estado:** `ABIERTO`
- **Archivos afectados:**
  - `src/context/AuthContext.tsx` (líneas 63–78)
  - `src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx` (líneas 37–67)
- **Pasos para reproducir:**
  1. Posicionarse en la rama `feature/H85-desactivar-patrulla`.
  2. Ejecutar `npx tsc --noEmit` o `npm run build`.
- **Comportamiento actual:** El compilador TypeScript falla con error `TS2345` en `PatrullaDetailPage.test.tsx:37:56` indicando que el objeto retornado por `vi.mocked(AuthContextModule.useAuth).mockReturnValue({...})` carece de las propiedades obligatorias `tieneUnidadAsignada` y `estadoAsignacion` agregadas en `AuthContextValue`. `npm run build` aborta en la fase `Failed to type check.` con código de salida `1`. Asimismo, `PatrullaDetailPage.test.tsx` solo prueba el escenario `unidadActiva: true`, sin verificar el bloqueo de acciones cuando `unidadActiva: false` o `tieneUnidadAsignada: false`.
- **Comportamiento esperado:** Todo archivo fuente y de pruebas debe compilar sin errores bajo `npx tsc --noEmit` y `npm run build`, y la suite de detalle de misión debe cubrir `unidadActiva: false` y `SIN_ASIGNACION` verificando la ocultación de controles de aceptación y operación.
- **Recomendación técnica:** Incorporar `tieneUnidadAsignada: true` y `estadoAsignacion: 'ACTIVA'` en el mock base de `PatrullaDetailPage.test.tsx` y añadir casos de prueba específicos para los estados `DESACTIVADA` y `SIN_ASIGNACION`.

### BUG-H85-PWA-02 — Fuga multi-patrulla, inyección de misiones ficticias y persistencia residual en IndexedDB
- **Severidad:** Alta
- **Estado:** `ABIERTO`
- **Archivos afectados:**
  - `src/app/(terreno)/patrulla/misiones/page.tsx` (líneas 44–96, 207–211)
  - `src/app/(terreno)/cuadrilla/misiones/page.tsx` (líneas 44–75, 185–189)
  - `src/components/terreno/TerrenoResumenOperativo.tsx` (líneas 31, 68)
  - `src/components/terreno/TerrenoSiguienteMision.tsx` (líneas 27–29, 63)
  - `src/services/perfilTerrenoService.ts` (líneas 145–147)
  - `src/services/misionesService.ts` (línea 180)
  - `src/context/AuthContext.tsx` (líneas 203–207)
- **Pasos para reproducir:**
  1. Autenticarse como funcionario de patrulla (por ejemplo, `francisca.patrulla@valdivia.cl` asociada a `unidadId: f1000000-0000-4000-8000-000000000050`).
  2. Consultar misiones en `/terreno/patrulla/misiones`, hub `/terreno` o estadísticas en `/terreno/perfil`.
  3. Contrastar la solicitud enviada contra `GET /api/misiones?tipoMision=VERIFICACION` con y sin parámetro `patrullaId`.
  4. Observar el comportamiento cuando el almacenamiento local queda vacío o cuando un operador ejecuta cierre de sesión (`logout`) tras una baja lógica.
- **Comportamiento actual:**
  - Las pantallas y servicios invocan `sincronizarMisiones` sin enviar `patrullaId` ni `cuadrillaId`. En pruebas reales sobre `http://localhost:3001`, la consulta sin `patrullaId` retorna `8` misiones de `8` patrullas distintas de toda la comuna, frente a `1` única misión (`MIS-2026-0009`) al filtrar por `patrullaId=f1000000-0000-4000-8000-000000000050`. `TerrenoResumenOperativo.tsx` tampoco envía filtros ni depende del usuario en `useEffect`.
  - Cuando `locales.length === 0`, `patrulla/misiones/page.tsx` (líneas 48–96) inyecta misiones ficticias (`patrulla-hist-01`, `INC-2026-00102`, `INC-2026-0001`), volviendo inalcanzables los mensajes de lista vacía (líneas 207–211) e induciendo datos falsos en modo histórico o sin asignación. Lo mismo ocurre en `cuadrilla/misiones/page.tsx` (`mision-hist-01`) y en `patrulla/misiones/[id]/page.tsx` / `cuadrilla/misiones/[id]/page.tsx`.
  - `guardarMisionesLocales` solo actualiza si `remotas.length > 0` y `logout` en `AuthContext.tsx` no purga los almacenes locales de IndexedDB (`misiones`, `outbox`).
- **Comportamiento esperado:** Todas las consultas de misiones, resumen, siguiente misión y métricas deben aislarse estrictamente por `unidadId` (`patrullaId`/`cuadrillaId`) cuando exista unidad asignada, omitir sincronización operativa en estado `SIN_ASIGNACION`, eliminar datos ficticios hardcodeados en producción y limpiar IndexedDB de sesión al cerrar sesión o reasignar usuario.
- **Recomendación técnica:** Propagar `patrullaId: usuario.unidadId` o `cuadrillaId: usuario.unidadId` según el rol, retirar semillas de misiones falsas desde componentes de página (restringiéndolas únicamente a entornos de demostración controlados si aplica) y depurar almacenes locales al cambiar de usuario/unidad o al ejecutar `logout`.

### BUG-H85-PWA-03 — Desincronización con OpenAPI (`api-generated.d.ts`), casts forzados y pérdida de `delegacionNombre`
- **Severidad:** Alta
- **Estado:** `ABIERTO`
- **Archivos afectados:**
  - `src/types/api-generated.d.ts` (líneas 6045–6140, 7645–7815)
  - `src/types/seguridad.ts` (líneas 22–70)
  - `src/services/seguridadService.ts` (líneas 65, 93)
  - `src/context/AuthContext.tsx` (líneas 105–106)
  - `src/app/(terreno)/perfil/page.tsx` (línea 74)
- **Pasos para reproducir:**
  1. Inspeccionar `openapi.json` servido por `sgrai-api` (`http://localhost:3001/openapi.json`) y ejecutar `POST /api/seguridad/login` y `GET /api/seguridad/usuario-activo`.
  2. Comparar contra `src/types/api-generated.d.ts` y `src/types/seguridad.ts`.
  3. Navegar a `/terreno/perfil` autenticado con un usuario perteneciente a una delegación específica.
- **Comportamiento actual:** `src/types/api-generated.d.ts` está desactualizado respecto de `sgrai-api`: `UsuarioActivoItem`, `UsuarioPerfilSesion` y la operación `DELETE /api/patrullas/{id}` no existen o carecen de `unidadId`, `unidadNombre` y `unidadActiva`. Para sortear el desfase, el desarrollador definió DTOs manuales en `seguridad.ts` y empleó dobles casts `as unknown as LoginResponseData` y `as unknown as UsuarioActivoDetalle` en `seguridadService.ts`. Además, `sgrai-api` retorna únicamente `delegacionId` (sin objeto `delegacion.nombre`), por lo que `AuthContext.tsx` asigna `delegacionNombre: null` y `perfil/page.tsx:74` siempre muestra `'Central Valdivia'`.
- **Comportamiento esperado:** Los tipos de API deben regenerarse desde el contrato OpenAPI oficial (`npm run api:generate`) eliminando interfaces manuales y casts `as unknown as`; la delegación del funcionario debe resolverse desde catálogo o desde un campo `delegacionNombre` expuesto por el backend.
- **Recomendación técnica:** Ejecutar `npm run api:generate` apuntando a `sgrai-api` actualizado, consumir directamente los esquemas de `api-generated.d.ts` en `seguridadService.ts` y resolver `delegacionNombre` mediante catálogo de delegaciones o extensión del endpoint `/api/seguridad/usuario-activo`.

### BUG-H85-PWA-04 — Sesión obsoleta tras baja remota, bypass de estado ante HTTP 401/403 y confirmación optimista indebida en outbox HTTP 409/422
- **Severidad:** Alta
- **Estado:** `ABIERTO`
- **Archivos afectados:**
  - `src/context/AuthContext.tsx` (líneas 157–167)
  - `src/hooks/useConnectivity.ts` (líneas 61–94)
  - `src/services/misionesService.ts` (aceptación de misión sin guardia de `unidadActiva`)
- **Pasos para reproducir:**
  1. Mantener una sesión abierta en `sgrai-pwa` mientras el Administrador desactiva la patrulla desde `sgrai-web`.
  2. Observar la suscripción en tiempo real del cliente (búsqueda de `socket` / `patrulla:desactivada` en `src/`).
  3. Simular expiración o revocación de token (HTTP `401` o `403` en `obtenerUsuarioActivo`) existiendo perfil previo en `sessionStorage`.
  4. Encolar offline `aceptar_mision` y sincronizar al reconectar cuando la API responde `409 Conflict` o `422 Unprocessable Entity` por baja o reasignación.
- **Comportamiento actual:**
  - `src/` no contiene ninguna suscripción `socket.io-client` ni escucha del evento `patrulla:desactivada` (pese a estar declarada la dependencia en `package.json`). La sesión activa desconoce la baja hasta que ocurra una recarga manual de página o nuevo login.
  - En `AuthContext.tsx:157-167`, el bloque `catch` de `recargarSesion` restaura el perfil guardado en `sessionStorage` sin distinguir errores de red de errores HTTP `401`/`403` (`SeguridadServiceError`), permitiendo que una sesión revocada o expirada siga operando desde caché.
  - En `useConnectivity.ts:61-94`, la condición `const procesada = res.ok || res.status === 409 || res.status === 422;` promueve localmente la misión al estado `EN_CURSO` incluso cuando el backend rechazó la operación con `409`/`422`.
- **Comportamiento esperado:** La PWA debe suscribirse a la sala de la unidad vía Socket.io para reaccionar a `patrulla:desactivada` ejecutando `recargarSesion()`, invalidar la sesión si `obtenerUsuarioActivo` devuelve `401`/`403` y no marcar una misión como `EN_CURSO` cuando la sincronización de outbox reciba rechazo `409`/`422`, notificando al operador del motivo de rechazo.
- **Recomendación técnica:** Implementar listener Socket.io para `patrulla:desactivada` con actualización inmediata del contexto, filtrar por código HTTP en el `catch` de `recargarSesion` y diferenciar `res.ok` de `409`/`422` en `useConnectivity.ts` revirtiendo el estado optimista local ante conflictos de negocio.

### BUG-H85-PWA-05 — Colisión por nombre en historial de patrullas, registro tardío en `/perfil` y omisión de delegación en tarjetas
- **Severidad:** Media
- **Estado:** `ABIERTO`
- **Archivos afectados:**
  - `src/services/perfilTerrenoService.ts` (líneas 25, 52–54)
  - `src/app/(terreno)/perfil/page.tsx` (líneas 48–50, 203–215)
  - `src/context/AuthContext.tsx` (líneas 24–37)
  - `docs/manuals/H85-patrulla-desactivada-terreno.md` (línea 52)
- **Pasos para reproducir:**
  1. Desactivar la patrulla `"Patrulla Delta"` (`unidadId: uuid-1`) y asignar al mismo operador una nueva unidad llamada `"Patrulla Delta"` (`unidadId: uuid-2`).
  2. Iniciar sesión sin visitar la ruta `/terreno/perfil`.
  3. Posteriormente visitar `/terreno/perfil` e inspeccionar las tarjetas del historial.
- **Comportamiento actual:**
  - `registrarPatrullaEnHistorial` busca coincidencias usando `item.unidadId === usuario.unidadId || item.nombre === usuario.unidadNombre`. Si una nueva patrulla reutiliza el nombre de una patrulla dada de baja, el nuevo registro sobrescribe el historial de la unidad anterior perdiendo su trazabilidad por ID.
  - El registro del historial solo se invoca dentro de `useEffect` al montar `/terreno/perfil` (`perfil/page.tsx:48-50`), por lo que si el operador nunca ingresa a su perfil mientras estuvo asignado a la unidad, dicha patrulla no queda registrada antes de ser desactivada o reasignada.
  - `PERFIL_DEMO_PATRULLA` carece de `unidadId`, haciendo que `registrarPatrullaEnHistorial` salga tempranamente (`!usuario.unidadId`).
  - Las tarjetas del historial en `perfil/page.tsx:203-215` omiten la delegación del registro, contradiciendo el manual `H85-patrulla-desactivada-terreno.md:52`.
- **Comportamiento esperado:** El historial debe identificarse unívocamente por `unidadId`, registrarse automáticamente durante `login` y `recargarSesion` en `AuthContext`, e incluir la delegación correspondiente en las tarjetas de `/terreno/perfil` en coherencia con el manual H85.
- **Recomendación técnica:** Indexar exclusivamente por `item.unidadId === usuario.unidadId`, invocar `registrarPatrullaEnHistorial` en la hidratación de sesión de `AuthContext` y agregar la delegación al modelo y renderizado de tarjetas del historial.

### BUG-H85-PWA-06 — Contaminación de etiquetas `DESACTIVADA` sobre `SIN_ASIGNACION`/SSR, variable CSS inexistente y desfase de copy con manual
- **Severidad:** Media
- **Estado:** `ABIERTO`
- **Archivos afectados:**
  - `src/components/terreno/TerrenoBottomNav.tsx` (línea 20)
  - `src/components/terreno/TerrenoSiguienteMision.tsx` (línea 89)
  - `src/components/terreno/TerrenoResumenOperativo.tsx` (línea 93)
  - `src/app/(terreno)/patrulla/misiones/[id]/page.tsx` (línea 155)
  - `src/app/(terreno)/cuadrilla/misiones/[id]/page.tsx` (línea 81)
  - `src/components/common/SinUnidadBanner.module.css` (línea 3)
  - `src/app/(terreno)/perfil/PerfilPage.module.css` (línea 43)
  - `src/components/common/SinUnidadBanner.tsx` (líneas 26–33) y `UnidadInactivaBanner.tsx` (líneas 24–33)
  - `docs/manuals/H85-patrulla-desactivada-terreno.md` (líneas 38–39)
- **Pasos para reproducir:**
  1. Consultar `http://localhost:3002/terreno` sin sesión iniciada (`curl -s http://localhost:3002/terreno`).
  2. Iniciar sesión con un operador en estado `SIN_ASIGNACION` (`tieneUnidadAsignada === false`) o en detalle de cuadrilla activa.
  3. Revisar los tokens CSS referenciados y los textos mostrados respecto del manual H85.
- **Comportamiento actual:**
  - `TerrenoBottomNav.tsx:20` evalúa `!unidadActiva ? 'Historial' : ...`; en la salida SSR sin sesión de `/terreno` (`HTTP 200`) y en estado `SIN_ASIGNACION` muestra el ítem de navegación como `Historial`.
  - `TerrenoSiguienteMision.tsx:89` renderiza el texto `'Unidad inactiva en modo de solo lectura.'` incluso cuando el estado es `SIN_ASIGNACION`.
  - `TerrenoResumenOperativo.tsx:93` aplica estilo de advertencia `kpiCardWarning` también cuando `!tieneUnidadAsignada`.
  - En detalle de misión, `patrulla/misiones/[id]/page.tsx:155` muestra `'Historial'` ante `SIN_ASIGNACION` y `cuadrilla/misiones/[id]/page.tsx:81` mantiene hardcodeado `<span>Historial</span>` aun con cuadrilla activa.
  - `SinUnidadBanner.module.css:3` y `PerfilPage.module.css:43` utilizan `var(--color-border, #CBD5E1)` inexistente en `src/styles/tokens.css` (el token institucional definido es `--border-color-neutral`), y el copy de ambos banners difiere del texto citado en `docs/manuals/H85-patrulla-desactivada-terreno.md`.
- **Comportamiento esperado:** Discriminar explícitamente las tres variantes (`ACTIVA`, `DESACTIVADA`, `SIN_ASIGNACION`) en navegación inferior, tarjetas de hub y breadcrumbs de detalle, estandarizar el token `--border-color-neutral` y alinear exactamente el copy de banners con la documentación de usuario.
- **Recomendación técnica:** Reemplazar condiciones booleanas simples `!unidadActiva` por evaluación explícita sobre `estadoAsignacion === 'DESACTIVADA'`, corregir el enlace de retorno en detalle de cuadrilla y unificar tokens CSS y redacción de manual/componentes.

---

## 3. Matriz Consolidada de Casos de Prueba (13 Columnas)

| ID Caso | Título del Caso de Prueba | Tipo de Prueba | Nivel | Prioridad | Precondición | Datos de Prueba (Payload / Headers / Query) | Resultado Esperado | Resultado Obtenido | Estado | Fecha / Hora Ejecución | Fecha / Hora Re-Test | Solución / Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-H85-PWA-01 | Compilación TypeScript y build productiva Next.js ante nuevos campos en `AuthContextValue` | Estática / Compilación | Integración / Sistema | Crítica | Rama `feature/H85-desactivar-patrulla` con dependencias instaladas | Comandos `npx tsc --noEmit` y `npm run build` | Compilación de tipos TS y generación de bundle productivo Next.js con exit code `0`, más cobertura de detalle en estados `DESACTIVADA` y `SIN_ASIGNACION` | Fallo `TS2345` en `PatrullaDetailPage.test.tsx:37:56` por ausencia de `tieneUnidadAsignada` y `estadoAsignacion` en mock de `useAuth`; `npm run build` aborta con `Failed to type check.` (exit `1`) | ABIERTO | 11/11/2026 11:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H85-PWA-02 | Aislamiento de misiones por `unidadId`, ausencia de datos ficticios y limpieza local IndexedDB | Integración / Seguridad | Integración | Alta | Usuario patrulla autenticado (`f1000000-0000-4000-8000-000000000050`) y API activa en `:3001` | `GET /api/misiones?tipoMision=VERIFICACION&ordenarPor=creadoEn&orden=desc` vs filtro `&patrullaId=f1000000-0000-4000-8000-000000000050`; `logout()` en PWA | Listado, hub y métricas filtrados exclusivamente por `patrullaId`/`cuadrillaId`; vistas vacías reales sin inyectar misiones ficticias; limpieza de IndexedDB al salir | PWA omite `patrullaId`/`cuadrillaId` retornando `8` misiones de `8` patrullas en `:3001` (`1` filtrada); páginas inyectan `patrulla-hist-01`/`mision-hist-01` ocultando estados vacíos; `logout` no limpia IndexedDB | ABIERTO | 11/11/2026 11:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H85-PWA-03 | Sincronización de tipos `api-generated.d.ts` con OpenAPI de `sgrai-api` y resolución de `delegacionNombre` | Contrato / Tipado | Sistema | Alta | Contrato OpenAPI vigente en `http://localhost:3001/openapi.json` | `GET /api/seguridad/usuario-activo` con Bearer JWT de `francisca.patrulla@valdivia.cl` (`delegacionId: 30000000-...-000000000002`) | Tipos autogenerados en `api-generated.d.ts` con `unidadId`, `unidadNombre`, `unidadActiva` sin DTOs manuales ni `as unknown as`; delegación real visible en `/terreno/perfil` | `api-generated.d.ts` carece de `unidadId`, `unidadNombre`, `unidadActiva` y `DELETE /api/patrullas/{id}`; `seguridadService.ts` fuerza casts; `delegacionNombre` resulta `null` mostrando siempre `'Central Valdivia'` | ABIERTO | 11/11/2026 11:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H85-PWA-04 | Invalidación de sesión por baja remota en tiempo real, respuestas 401/403 y conflictos outbox 409/422 | Seguridad / Resiliencia | Sistema | Alta | Operador con sesión abierta en PWA mientras patrulla pasa a inactiva o token expira | Búsqueda `rg -n -e socket -e "patrulla:desactivada" src/`; `recargarSesion()` ante `401`/`403`; `useConnectivity.ts` ante respuesta `409`/`422` en outbox | Escucha Socket.io de `patrulla:desactivada`; cierre/limpieza de sesión ante `401`/`403`; rechazo explícito sin promover misión a `EN_CURSO` ante `409`/`422` | Sin suscripción Socket.io en `src/`; `recargarSesion` restaura `sessionStorage` incluso tras `401`/`403`; `useConnectivity.ts` marca `EN_CURSO` aunque outbox responda `409` o `422` | ABIERTO | 11/11/2026 11:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H85-PWA-05 | Trazabilidad por `unidadId` en historial de patrullas, registro en hidratación de sesión y muestra de delegación | Funcional / Regresión | Unitaria / Integración | Media | Operador con unidad asignada en sesión sin visitar `/terreno/perfil` previamente y reutilización de nombre | `registrarPatrullaEnHistorial()` con dos `unidadId` distintos e igual `unidadNombre`; montaje de `/terreno/perfil` | Historial indexado únicamente por `unidadId`, actualizado al autenticar/recargar sesión y con delegación visible en cada tarjeta del perfil | Colisión por `item.nombre === usuario.unidadNombre` sobrescribe registro previo; registro ocurre solo al entrar a `/terreno/perfil`; tarjetas de historial omiten la delegación descrita en manual | ABIERTO | 11/11/2026 11:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| BUG-H85-PWA-06 | Discriminación visual `ACTIVA` vs `DESACTIVADA` vs `SIN_ASIGNACION`, tokens CSS y alineación con manual H85 | UI / UX / Documentación | Componentes / SSR | Media | Acceso SSR sin sesión a `GET /terreno` y renderizado en estados `SIN_ASIGNACION` y `ACTIVA` | `curl -s http://localhost:3002/terreno`; componentes `TerrenoBottomNav`, `TerrenoSiguienteMision`, `TerrenoResumenOperativo` y CSS modules | Etiqueta `'Historial'` y alertas de unidad inactiva restringidas a `estadoAsignacion === 'DESACTIVADA'`; uso de `--border-color-neutral`; texto idéntico al manual H85 | `TerrenoBottomNav` renderiza `Historial` en SSR sin sesión y `SIN_ASIGNACION`; `TerrenoSiguienteMision` muestra texto de unidad inactiva en `SIN_ASIGNACION`; `cuadrilla/misiones/[id]` fija `Historial`; CSS usa `--color-border` inexistente | ABIERTO | 11/11/2026 11:41 | (Pendiente) | Pendiente (Rechazado en Code Review) |
| CP-H85-PWA-01 | Mapeo Fail-Closed `unidadActiva=false` cuando la patrulla verificadora figura desactivada | Funcional / Unitaria | Unitaria | Alta | Sesión simulada con cookie válida y servicio `obtenerUsuarioActivo` mockeado | `rolCodigo: PATRULLA_VERIFICADORA`, `unidadId` asignado, `unidadActiva: false` | `useAuth()` expone `unidadActiva=false`, `tieneUnidadAsignada=true` y `estadoAsignacion='DESACTIVADA'` | Prueba `mapea correctamente unidadActiva=false cuando la patrulla verificadora fue desactivada (H85)` aprobada en `2ms` (`AuthContext.test.tsx`) | APROBADO | 11/11/2026 11:41 | N/A | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-02 | Mapeo operativo `unidadActiva=true` cuando la patrulla verificadora se encuentra activa | Funcional / Unitaria | Unitaria | Alta | Sesión simulada con cookie válida y servicio `obtenerUsuarioActivo` mockeado | `rolCodigo: PATRULLA_VERIFICADORA`, `unidadId` asignado, `unidadActiva: true` | `useAuth()` expone `unidadActiva=true`, `tieneUnidadAsignada=true` y `estadoAsignacion='ACTIVA'` | Prueba `mapea correctamente unidadActiva=true cuando la patrulla verificadora está activa (H85)` aprobada en `2ms` (`AuthContext.test.tsx`) | APROBADO | 11/11/2026 11:41 | N/A | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-03 | Detección de estado `SIN_ASIGNACION` cuando el funcionario no tiene patrulla asignada | Funcional / Unitaria | Unitaria | Alta | Sesión simulada de funcionario de terreno sin `unidadId` asignado | `rolCodigo: PATRULLA_VERIFICADORA`, `unidadId: null`, `unidadNombre: null`, `unidadActiva: false` | `useAuth()` expone `tieneUnidadAsignada=false`, `unidadActiva=false` y `estadoAsignacion='SIN_ASIGNACION'` | Prueba `detecta estado SIN_ASIGNACION cuando el funcionario no tiene patrulla asignada` aprobada en `1ms` (`1 passed, 91 skipped` con filtro `-t`) | APROBADO | 11/11/2026 11:41 | N/A | feat(ui): alertar a operadores sin patrulla asignada mediante SinUnidadBanner y discriminación de estado |
| CP-H85-PWA-04 | Control RBAC en `AuthContext` ante roles de oficina (`CALL_CENTER` / `ADMIN`) sin destruir sesión web | Seguridad / RBAC | Unitaria | Alta | Formulario de login o ingreso a `/terreno` con rol no autorizado | Usuarios mock con `rolCodigo: CALL_CENTER` o `ADMIN` y cookie `sgrai_auth_token` previa | Rechaza acceso a terreno con error 403 en login y preserva la cookie `sgrai_auth_token` al redirigir desde `/terreno` | Pruebas de rechazo 403 (`3ms`) y preservación de cookie (`13ms`) aprobadas en `AuthContext.test.tsx` | APROBADO | 11/11/2026 11:41 | N/A | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-05 | Renderizado de `UnidadInactivaBanner` para patrulla y cuadrilla desactivadas | UI / Componentes | Componentes | Media | Componente `UnidadInactivaBanner` montado en jsdom | Props `tipoUnidad="CUADRILLA"` y `tipoUnidad="PATRULLA"` con `nombreUnidad` y rol ARIA `alert` | Muestra banner compacto de advertencia diferenciando patrulla verificadora de cuadrilla en modo solo lectura | `UnidadInactivaBanner.test.tsx` aprueba `2/2` casos en `162ms` (`154ms` cuadrilla, `7ms` patrulla) | APROBADO | 11/11/2026 11:41 | N/A | style(ui): hacer mas discreto y compacto el banner de unidad desactivada (H85) |
| CP-H85-PWA-06 | Renderizado de `SinUnidadBanner` para operador sin patrulla o cuadrilla asignada | UI / Componentes | Componentes | Media | Componente `SinUnidadBanner` montado en jsdom | Props `tipoUnidad="PATRULLA"` y `tipoUnidad="CUADRILLA"` con rol ARIA `status` | Muestra aviso informativo indicando falta de unidad asignada y canal de contacto con Centro de Mando | `SinUnidadBanner.test.tsx` aprueba `2/2` casos en `173ms` (`159ms` patrulla, `12ms` cuadrilla) | APROBADO | 11/11/2026 11:41 | N/A | style(ui): asegurar salto de linea final en componentes de SinUnidadBanner |
| CP-H85-PWA-07 | Activación de banner de advertencia y encabezado histórico en `PatrullaMisionesPage` con `unidadActiva=false` | Funcional / UI | Componentes | Alta | `useAuth` mockeado con `PATRULLA_VERIFICADORA`, `unidadActiva=false`, `tieneUnidadAsignada=true` | Renderizado de `PatrullaMisionesPage` con servicio `sincronizarMisiones` mockeado | Renderiza `UnidadInactivaBanner` y cambia título principal a modo historial de verificaciones | Prueba en `PatrullaMisionesPage.test.tsx` aprobada en `211ms` (`1/1`) | APROBADO | 11/11/2026 11:41 | N/A | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-08 | Activación de banner de advertencia y encabezado histórico en `CuadrillaMisionesPage` con `unidadActiva=false` | Funcional / UI | Componentes | Media | `useAuth` mockeado con `DELEGADO_CUADRILLA`, `unidadActiva=false`, `tieneUnidadAsignada=true` | Renderizado de `CuadrillaMisionesPage` con servicio `sincronizarMisiones` mockeado | Renderiza `UnidadInactivaBanner` y muestra cabecera histórica de faenas en solo lectura | Prueba en `CuadrillaMisionesPage.test.tsx` aprobada en `213ms` (`1/1`) | APROBADO | 11/11/2026 11:41 | N/A | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-09 | Exposición de alerta de unidad inactiva y enlaces adaptados en Hub `/terreno` (`TerrenoHomePage`) | Funcional / UI | Integración | Media | `useAuth` mockeado en estados de patrulla, cuadrilla y unidad inactiva | Renderizado de `TerrenoHomePage` y `TerrenoBottomNav` bajo entorno Vitest | Muestra bienvenida, resumen operativo y despliega alerta cuando `unidadActiva=false` | `TerrenoHomePage.test.tsx` aprueba `3/3` casos en `331ms` (`285ms`, `24ms`, `21ms`; con warnings `act(...)` en stderr) | APROBADO | 11/11/2026 11:41 | N/A | style(ui): hacer mas discreto y compacto el banner de unidad desactivada (H85) |
| CP-H85-PWA-10 | Gestión de historial local de patrullas (`perfilTerrenoService`): registro, actualización a desactivada y ordenamiento | Funcional / Unitaria | Unitaria | Alta | `localStorage` limpio en entorno de pruebas Vitest | Secuencia de llamadas a `registrarPatrullaEnHistorial` y `obtenerHistorialUnidades` con `unidadId` y `unidadActiva` | Ignora usuarios sin `unidadId`, inserta unidad nueva, actualiza estado a desactivada manteniendo historial y ordena descendentemente por última vista | `perfilTerrenoService.test.ts` aprueba `6/6` pruebas en `10ms` (`4` específicas de H85) | APROBADO | 11/11/2026 11:41 | N/A | feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85) |
| CP-H85-PWA-11 | Renderizado de `/terreno/perfil` con estadísticas limpias, estado sin asignación e historial previo | Funcional / UI | Componentes | Media | `useAuth` y `perfilTerrenoService` mockeados para usuario sin asignación e historial previo | Renderizado de `TerrenoPerfilPage` en jsdom | Muestra perfil sin enums crudos, indica ausencia de asignación operativa y lista patrullas asignadas previamente | `PerfilPage.test.tsx` aprueba `3/3` casos en `169ms` (`115ms`, `20ms`, `31ms`) | APROBADO | 11/11/2026 11:41 | N/A | feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85) |
| CP-H85-PWA-12 | Flujo de aceptación de misión en `PatrullaDetailPage` (unidad activa, RBAC y cola offline) | Funcional / Offline | Componentes | Media | `useAuth` mockeado en modo activo (`unidadActiva: true`), con y sin permiso `misiones:terreno:verificar` | Renderizado de `PatrullaDetailPage` y evento clic en `Aceptar Misión` online y offline | Botón visible solo con permiso, transición a `En Trayecto / Evaluación` y sincronización offline diferida | `PatrullaDetailPage.test.tsx` aprueba `4/4` casos en `318ms` (bajo mocks y sujeto a corrección TS de BUG-H85-PWA-01) | APROBADO | 11/11/2026 11:41 | N/A | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-13 | Verificación de ausencia de emojis en `src/` y conformidad ESLint de la rama | Estática / Calidad UI | Estática | Baja | Repositorio `web-app` con dependencias instaladas | Comandos `rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/` y `npm run lint` | Cero emojis en código fuente y `0` errores ESLint | Cero emojis detectados en `src/`; `npm run lint` finaliza con exit code `0`, `0 errors` y `4 warnings` | APROBADO | 11/11/2026 11:41 | N/A | style(ui): asegurar salto de linea final en componentes de SinUnidadBanner |
| CP-H85-PWA-14 | Integración en vivo `sgrai-api` (`login`, `usuario-activo`, rechazo `403` en baja de patrulla) y redirección protegida PWA `307` | Integración / Seguridad | Sistema | Alta | Servicios en ejecución en `http://localhost:3001` y `http://localhost:3002` | `POST /api/seguridad/login` (`francisca.patrulla@valdivia.cl`), `GET /api/seguridad/usuario-activo`, `DELETE /api/patrullas/f1000000-...-0050`, `GET :3002/terreno/patrulla/misiones` | Login retorna JWT y `unidadActiva=true`; `/usuario-activo` exige Bearer (`401` sin token); rol patrulla recibe `403` en `DELETE`; ruta `/terreno/patrulla/misiones` sin cookie redirige `307` a `/terreno/login` | Comportamiento HTTP real verificado: `200` en login y perfil autenticado, `401` sin token o clave inválida, `403` (`recursos:eliminar`), `307` en PWA | APROBADO | 11/11/2026 11:41 | N/A | feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85) |
| CP-H85-PWA-15 | Documentación de usuario en terreno (`H85-patrulla-desactivada-terreno.md`) con secciones offline y permisos | Documentación | Documentación | Baja | Archivo presente en `docs/manuals/H85-patrulla-desactivada-terreno.md` | Revisión estructural de secciones obligatorias del manual | Presencia de alcance H85, comportamiento sin conexión y requisitos de permisos GPS/Cámara | Archivo presente con secciones obligatorias completas (desfases de redacción/delegación tratados en BUG-H85-PWA-05/06) | APROBADO | 11/11/2026 11:41 | N/A | docs(manuals): documentar alerta sin unidad asignada e historial de patrullas en terreno (H85) |

---

## 4. Matriz en Formato TSV

```tsv
ID Caso	Título del Caso de Prueba	Tipo de Prueba	Nivel	Prioridad	Precondición	Datos de Prueba (Payload / Headers / Query)	Resultado Esperado	Resultado Obtenido	Estado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-H85-PWA-01	Compilación TypeScript y build productiva Next.js ante nuevos campos en AuthContextValue	Estática / Compilación	Integración / Sistema	Crítica	Rama feature/H85-desactivar-patrulla con dependencias instaladas	Comandos npx tsc --noEmit y npm run build	Compilación de tipos TS y generación de bundle productivo Next.js con exit code 0, más cobertura de detalle en estados DESACTIVADA y SIN_ASIGNACION	Fallo TS2345 en PatrullaDetailPage.test.tsx:37:56 por ausencia de tieneUnidadAsignada y estadoAsignacion en mock de useAuth; npm run build aborta con Failed to type check. (exit 1)	ABIERTO	11/11/2026 11:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-PWA-02	Aislamiento de misiones por unidadId, ausencia de datos ficticios y limpieza local IndexedDB	Integración / Seguridad	Integración	Alta	Usuario patrulla autenticado (f1000000-0000-4000-8000-000000000050) y API activa en :3001	GET /api/misiones?tipoMision=VERIFICACION&ordenarPor=creadoEn&orden=desc vs filtro &patrullaId=f1000000-0000-4000-8000-000000000050; logout() en PWA	Listado, hub y métricas filtrados exclusivamente por patrullaId/cuadrillaId; vistas vacías reales sin inyectar misiones ficticias; limpieza de IndexedDB al salir	PWA omite patrullaId/cuadrillaId retornando 8 misiones de 8 patrullas en :3001 (1 filtrada); páginas inyectan patrulla-hist-01/mision-hist-01 ocultando estados vacíos; logout no limpia IndexedDB	ABIERTO	11/11/2026 11:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-PWA-03	Sincronización de tipos api-generated.d.ts con OpenAPI de sgrai-api y resolución de delegacionNombre	Contrato / Tipado	Sistema	Alta	Contrato OpenAPI vigente en http://localhost:3001/openapi.json	GET /api/seguridad/usuario-activo con Bearer JWT de francisca.patrulla@valdivia.cl (delegacionId: 30000000-...-000000000002)	Tipos autogenerados en api-generated.d.ts con unidadId, unidadNombre, unidadActiva sin DTOs manuales ni as unknown as; delegación real visible en /terreno/perfil	api-generated.d.ts carece de unidadId, unidadNombre, unidadActiva y DELETE /api/patrullas/{id}; seguridadService.ts fuerza casts; delegacionNombre resulta null mostrando siempre 'Central Valdivia'	ABIERTO	11/11/2026 11:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-PWA-04	Invalidación de sesión por baja remota en tiempo real, respuestas 401/403 y conflictos outbox 409/422	Seguridad / Resiliencia	Sistema	Alta	Operador con sesión abierta en PWA mientras patrulla pasa a inactiva o token expira	Búsqueda rg -n -e socket -e "patrulla:desactivada" src/; recargarSesion() ante 401/403; useConnectivity.ts ante respuesta 409/422 en outbox	Escucha Socket.io de patrulla:desactivada; cierre/limpieza de sesión ante 401/403; rechazo explícito sin promover misión a EN_CURSO ante 409/422	Sin suscripción Socket.io en src/; recargarSesion restaura sessionStorage incluso tras 401/403; useConnectivity.ts marca EN_CURSO aunque outbox responda 409 o 422	ABIERTO	11/11/2026 11:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-PWA-05	Trazabilidad por unidadId en historial de patrullas, registro en hidratación de sesión y muestra de delegación	Funcional / Regresión	Unitaria / Integración	Media	Operador con unidad asignada en sesión sin visitar /terreno/perfil previamente y reutilización de nombre	registrarPatrullaEnHistorial() con dos unidadId distintos e igual unidadNombre; montaje de /terreno/perfil	Historial indexado únicamente por unidadId, actualizado al autenticar/recargar sesión y con delegación visible en cada tarjeta del perfil	Colisión por item.nombre === usuario.unidadNombre sobrescribe registro previo; registro ocurre solo al entrar a /terreno/perfil; tarjetas de historial omiten la delegación descrita en manual	ABIERTO	11/11/2026 11:41	(Pendiente)	Pendiente (Rechazado en Code Review)
BUG-H85-PWA-06	Discriminación visual ACTIVA vs DESACTIVADA vs SIN_ASIGNACION, tokens CSS y alineación con manual H85	UI / UX / Documentación	Componentes / SSR	Media	Acceso SSR sin sesión a GET /terreno y renderizado en estados SIN_ASIGNACION y ACTIVA	curl -s http://localhost:3002/terreno; componentes TerrenoBottomNav, TerrenoSiguienteMision, TerrenoResumenOperativo y CSS modules	Etiqueta 'Historial' y alertas de unidad inactiva restringidas a estadoAsignacion === 'DESACTIVADA'; uso de --border-color-neutral; texto idéntico al manual H85	TerrenoBottomNav renderiza Historial en SSR sin sesión y SIN_ASIGNACION; TerrenoSiguienteMision muestra texto de unidad inactiva en SIN_ASIGNACION; cuadrilla/misiones/[id] fija Historial; CSS usa --color-border inexistente	ABIERTO	11/11/2026 11:41	(Pendiente)	Pendiente (Rechazado en Code Review)
CP-H85-PWA-01	Mapeo Fail-Closed unidadActiva=false cuando la patrulla verificadora figura desactivada	Funcional / Unitaria	Unitaria	Alta	Sesión simulada con cookie válida y servicio obtenerUsuarioActivo mockeado	rolCodigo: PATRULLA_VERIFICADORA, unidadId asignado, unidadActiva: false	useAuth() expone unidadActiva=false, tieneUnidadAsignada=true y estadoAsignacion='DESACTIVADA'	Prueba mapea correctamente unidadActiva=false cuando la patrulla verificadora fue desactivada (H85) aprobada en 2ms (AuthContext.test.tsx)	APROBADO	11/11/2026 11:41	N/A	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-02	Mapeo operativo unidadActiva=true cuando la patrulla verificadora se encuentra activa	Funcional / Unitaria	Unitaria	Alta	Sesión simulada con cookie válida y servicio obtenerUsuarioActivo mockeado	rolCodigo: PATRULLA_VERIFICADORA, unidadId asignado, unidadActiva: true	useAuth() expone unidadActiva=true, tieneUnidadAsignada=true y estadoAsignacion='ACTIVA'	Prueba mapea correctamente unidadActiva=true cuando la patrulla verificadora está activa (H85) aprobada en 2ms (AuthContext.test.tsx)	APROBADO	11/11/2026 11:41	N/A	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-03	Detección de estado SIN_ASIGNACION cuando el funcionario no tiene patrulla asignada	Funcional / Unitaria	Unitaria	Alta	Sesión simulada de funcionario de terreno sin unidadId asignado	rolCodigo: PATRULLA_VERIFICADORA, unidadId: null, unidadNombre: null, unidadActiva: false	useAuth() expone tieneUnidadAsignada=false, unidadActiva=false y estadoAsignacion='SIN_ASIGNACION'	Prueba detecta estado SIN_ASIGNACION cuando el funcionario no tiene patrulla asignada aprobada en 1ms (1 passed, 91 skipped con filtro -t)	APROBADO	11/11/2026 11:41	N/A	feat(ui): alertar a operadores sin patrulla asignada mediante SinUnidadBanner y discriminación de estado
CP-H85-PWA-04	Control RBAC en AuthContext ante roles de oficina (CALL_CENTER / ADMIN) sin destruir sesión web	Seguridad / RBAC	Unitaria	Alta	Formulario de login o ingreso a /terreno con rol no autorizado	Usuarios mock con rolCodigo: CALL_CENTER o ADMIN y cookie sgrai_auth_token previa	Rechaza acceso a terreno con error 403 en login y preserva la cookie sgrai_auth_token al redirigir desde /terreno	Pruebas de rechazo 403 (3ms) y preservación de cookie (13ms) aprobadas en AuthContext.test.tsx	APROBADO	11/11/2026 11:41	N/A	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-05	Renderizado de UnidadInactivaBanner para patrulla y cuadrilla desactivadas	UI / Componentes	Componentes	Media	Componente UnidadInactivaBanner montado en jsdom	Props tipoUnidad="CUADRILLA" y tipoUnidad="PATRULLA" con nombreUnidad y rol ARIA alert	Muestra banner compacto de advertencia diferenciando patrulla verificadora de cuadrilla en modo solo lectura	UnidadInactivaBanner.test.tsx aprueba 2/2 casos en 162ms (154ms cuadrilla, 7ms patrulla)	APROBADO	11/11/2026 11:41	N/A	style(ui): hacer mas discreto y compacto el banner de unidad desactivada (H85)
CP-H85-PWA-06	Renderizado de SinUnidadBanner para operador sin patrulla o cuadrilla asignada	UI / Componentes	Componentes	Media	Componente SinUnidadBanner montado en jsdom	Props tipoUnidad="PATRULLA" y tipoUnidad="CUADRILLA" con rol ARIA status	Muestra aviso informativo indicando falta de unidad asignada y canal de contacto con Centro de Mando	SinUnidadBanner.test.tsx aprueba 2/2 casos en 173ms (159ms patrulla, 12ms cuadrilla)	APROBADO	11/11/2026 11:41	N/A	style(ui): asegurar salto de linea final en componentes de SinUnidadBanner
CP-H85-PWA-07	Activación de banner de advertencia y encabezado histórico en PatrullaMisionesPage con unidadActiva=false	Funcional / UI	Componentes	Alta	useAuth mockeado con PATRULLA_VERIFICADORA, unidadActiva=false, tieneUnidadAsignada=true	Renderizado de PatrullaMisionesPage con servicio sincronizarMisiones mockeado	Renderiza UnidadInactivaBanner y cambia título principal a modo historial de verificaciones	Prueba en PatrullaMisionesPage.test.tsx aprobada en 211ms (1/1)	APROBADO	11/11/2026 11:41	N/A	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-08	Activación de banner de advertencia y encabezado histórico en CuadrillaMisionesPage con unidadActiva=false	Funcional / UI	Componentes	Media	useAuth mockeado con DELEGADO_CUADRILLA, unidadActiva=false, tieneUnidadAsignada=true	Renderizado de CuadrillaMisionesPage con servicio sincronizarMisiones mockeado	Renderiza UnidadInactivaBanner y muestra cabecera histórica de faenas en solo lectura	Prueba en CuadrillaMisionesPage.test.tsx aprobada en 213ms (1/1)	APROBADO	11/11/2026 11:41	N/A	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-09	Exposición de alerta de unidad inactiva y enlaces adaptados en Hub /terreno (TerrenoHomePage)	Funcional / UI	Integración	Media	useAuth mockeado en estados de patrulla, cuadrilla y unidad inactiva	Renderizado de TerrenoHomePage y TerrenoBottomNav bajo entorno Vitest	Muestra bienvenida, resumen operativo y despliega alerta cuando unidadActiva=false	TerrenoHomePage.test.tsx aprueba 3/3 casos en 331ms (285ms, 24ms, 21ms; con warnings act(...) en stderr)	APROBADO	11/11/2026 11:41	N/A	style(ui): hacer mas discreto y compacto el banner de unidad desactivada (H85)
CP-H85-PWA-10	Gestión de historial local de patrullas (perfilTerrenoService): registro, actualización a desactivada y ordenamiento	Funcional / Unitaria	Unitaria	Alta	localStorage limpio en entorno de pruebas Vitest	Secuencia de llamadas a registrarPatrullaEnHistorial y obtenerHistorialUnidades con unidadId y unidadActiva	Ignora usuarios sin unidadId, inserta unidad nueva, actualiza estado a desactivada manteniendo historial y ordena descendentemente por última vista	perfilTerrenoService.test.ts aprueba 6/6 pruebas en 10ms (4 específicas de H85)	APROBADO	11/11/2026 11:41	N/A	feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85)
CP-H85-PWA-11	Renderizado de /terreno/perfil con estadísticas limpias, estado sin asignación e historial previo	Funcional / UI	Componentes	Media	useAuth y perfilTerrenoService mockeados para usuario sin asignación e historial previo	Renderizado de TerrenoPerfilPage en jsdom	Muestra perfil sin enums crudos, indica ausencia de asignación operativa y lista patrullas asignadas previamente	PerfilPage.test.tsx aprueba 3/3 casos en 169ms (115ms, 20ms, 31ms)	APROBADO	11/11/2026 11:41	N/A	feat(perfil): implementar registro e historial de patrullas asignadas en perfil (H85)
CP-H85-PWA-12	Flujo de aceptación de misión en PatrullaDetailPage (unidad activa, RBAC y cola offline)	Funcional / Offline	Componentes	Media	useAuth mockeado en modo activo (unidadActiva: true), con y sin permiso misiones:terreno:verificar	Renderizado de PatrullaDetailPage y evento clic en Aceptar Misión online y offline	Botón visible solo con permiso, transición a En Trayecto / Evaluación y sincronización offline diferida	PatrullaDetailPage.test.tsx aprueba 4/4 casos en 318ms (bajo mocks y sujeto a corrección TS de BUG-H85-PWA-01)	APROBADO	11/11/2026 11:41	N/A	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-13	Verificación de ausencia de emojis en src/ y conformidad ESLint de la rama	Estática / Calidad UI	Estática	Baja	Repositorio web-app con dependencias instaladas	Comandos rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ y npm run lint	Cero emojis en código fuente y 0 errores ESLint	Cero emojis detectados en src/; npm run lint finaliza con exit code 0, 0 errors y 4 warnings	APROBADO	11/11/2026 11:41	N/A	style(ui): asegurar salto de linea final en componentes de SinUnidadBanner
CP-H85-PWA-14	Integración en vivo sgrai-api (login, usuario-activo, rechazo 403 en baja de patrulla) y redirección protegida PWA 307	Integración / Seguridad	Sistema	Alta	Servicios en ejecución en http://localhost:3001 y http://localhost:3002	POST /api/seguridad/login (francisca.patrulla@valdivia.cl), GET /api/seguridad/usuario-activo, DELETE /api/patrullas/f1000000-...-0050, GET :3002/terreno/patrulla/misiones	Login retorna JWT y unidadActiva=true; /usuario-activo exige Bearer (401 sin token); rol patrulla recibe 403 en DELETE; ruta /terreno/patrulla/misiones sin cookie redirige 307 a /terreno/login	Comportamiento HTTP real verificado: 200 en login y perfil autenticado, 401 sin token o clave inválida, 403 (recursos:eliminar), 307 en PWA	APROBADO	11/11/2026 11:41	N/A	feat(auth): mapear unidadActiva en AuthContext y aplicar verificacion Fail-Closed para modo historico de terreno (H85)
CP-H85-PWA-15	Documentación de usuario en terreno (H85-patrulla-desactivada-terreno.md) con secciones offline y permisos	Documentación	Documentación	Baja	Archivo presente en docs/manuals/H85-patrulla-desactivada-terreno.md	Revisión estructural de secciones obligatorias del manual	Presencia de alcance H85, comportamiento sin conexión y requisitos de permisos GPS/Cámara	Archivo presente con secciones obligatorias completas (desfases de redacción/delegación tratados en BUG-H85-PWA-05/06)	APROBADO	11/11/2026 11:41	N/A	docs(manuals): documentar alerta sin unidad asignada e historial de patrullas en terreno (H85)
```

---

## 5. Guía de Ejecución y Replicabilidad Paso a Paso

Todos los comandos listados a continuación fueron ejecutados desde la raíz del repositorio `web-app`.

### 5.1 Suite completa Vitest y subconjunto H85

```bash
npm test
```

Salida observada:

```text
 Test Files  27 passed (27)
      Tests  92 passed (92)
   Start at  11:41:28
   Duration  4.58s (transform 2.01s, setup 5.98s, collect 6.81s, tests 4.61s, environment 28.76s, prepare 3.50s)
```

Ejecución específica de las 9 suites vinculadas a HU-85:

```bash
npx vitest run --reporter=verbose \
  src/context/__tests__/AuthContext.test.tsx \
  src/services/__tests__/perfilTerrenoService.test.ts \
  'src/app/(terreno)/perfil/__tests__/PerfilPage.test.tsx' \
  'src/app/(terreno)/patrulla/misiones/__tests__/PatrullaMisionesPage.test.tsx' \
  'src/app/(terreno)/cuadrilla/misiones/__tests__/CuadrillaMisionesPage.test.tsx' \
  src/components/common/__tests__/SinUnidadBanner.test.tsx \
  src/components/common/__tests__/UnidadInactivaBanner.test.tsx \
  'src/app/(terreno)/__tests__/TerrenoHomePage.test.tsx' \
  'src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx'
```

Salida observada:

```text
 Test Files  9 passed (9)
      Tests  29 passed (29)
   Start at  11:41:01
   Duration  2.07s (transform 950ms, setup 1.80s, collect 3.06s, tests 1.64s, environment 6.59s, prepare 782ms)
```

Ejecución individual de casos por filtro `-t`:

```bash
npm test -- -t "detecta estado SIN_ASIGNACION"
npm test -- -t "actualiza el estado de una patrulla existente en el historial"
```

Salidas observadas:

```text
# Filtro 1: "detecta estado SIN_ASIGNACION"
 Test Files  1 passed | 26 skipped (27)
      Tests  1 passed | 91 skipped (92)
   Start at  11:41:05
   Duration  4.00s (transform 3.03s, setup 6.02s, collect 8.60s, tests 34ms, environment 28.33s, prepare 3.18s)

# Filtro 2: "actualiza el estado de una patrulla existente en el historial"
 Test Files  1 passed | 26 skipped (27)
      Tests  1 passed | 91 skipped (92)
   Start at  11:41:10
   Duration  4.00s (transform 2.22s, setup 5.59s, collect 7.13s, tests 8ms, environment 28.29s, prepare 3.46s)
```

### 5.2 Verificación de tipos TypeScript, Build de producción y ESLint (Evidencia de `BUG-H85-PWA-01`)

```bash
npx tsc --noEmit
npm run build
npm run lint
```

Salida observada en `npx tsc --noEmit` (exit code `2`):

```text
src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx:37:56 - error TS2345: Argument of type '{ usuario: { id: string; rut: string; nombre: string; email: string; rolId: string; rolNombre: string; rolCodigo: string; delegacionId: string; delegacionNombre: string; permisos: string[]; unidadNombre: string; unidadActiva: boolean; }; ... 10 more ...; recargarSesion: Mock<...>; }' is not assignable to parameter of type 'AuthContextValue'.
  Type '{ usuario: { id: string; rut: string; nombre: string; email: string; rolId: string; rolNombre: string; rolCodigo: string; delegacionId: string; delegacionNombre: string; permisos: string[]; unidadNombre: string; unidadActiva: boolean; }; ... 10 more ...; recargarSesion: Mock<...>; }' is missing the following properties from type 'AuthContextValue': tieneUnidadAsignada, estadoAsignacion

Found 1 error in src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx:37
```

Salida observada en `npm run build` (exit code `1`):

```text
▲ Next.js 16.3.4 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 30ms

  Creating an optimized production build ...
✓ Compiled successfully in 2.3s
src/app/(terreno)/patrulla/misiones/[id]/__tests__/PatrullaDetailPage.test.tsx(37,56): error TS2345: ...
Failed to type check.
```

Salida observada en `npm run lint` (exit code `0`):

```text
/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/app/(auth)/login/page.tsx
  51:11  warning  Do not use `window.location.assign()` to navigate to internal Next.js pages...  @next/next/no-location-assign-relative-destination
/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/app/(terreno)/page.tsx
  26:11  warning  Do not use `window.location.assign()` to navigate to internal Next.js pages...  @next/next/no-location-assign-relative-destination
/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/context/AuthContext.tsx
  146:13  warning  Do not use `window.location.assign()` to navigate to internal Next.js pages...  @next/next/no-location-assign-relative-destination
/home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/lib/api/client.ts
  47:9  warning  Do not use `window.location.assign()` to navigate to internal Next.js pages...  @next/next/no-location-assign-relative-destination

✖ 4 problems (0 errors, 4 warnings)
```

### 5.3 Verificación de reglas de diseño e integración Socket.io

```bash
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/ || echo "Sin emojis en src"
rg -n "socket|patrulla:desactivada" src/ || echo "NO_SOCKET_MATCHES"
```

### 5.4 Pruebas cURL reales sobre `sgrai-api` (`:3001`) y `sgrai-pwa` (`:3002`)

```bash
# 1. Login exitoso de patrulla verificadora
LOGIN_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"francisca.patrulla@valdivia.cl","password":"Valdivia2026!"}')
echo "$LOGIN_RES"
```

Respuesta HTTP `200`:

```json
{
  "data": {
    "tipoToken": "Bearer",
    "expiraEn": "2026-11-11T22:41:26.000Z",
    "usuario": {
      "id": "d1000000-0000-4000-8000-000000000005",
      "rut": "15444555-6",
      "nombre": "Francisca Morales",
      "email": "francisca.patrulla@valdivia.cl",
      "rolId": "20000000-0000-4000-8000-000000000004",
      "rolNombre": "Patrulla Verificadora",
      "rolCodigo": "PATRULLA_VERIFICADORA",
      "delegacionId": "30000000-0000-4000-8000-000000000002",
      "permisos": ["misiones:terreno:verificar"],
      "unidadId": "f1000000-0000-4000-8000-000000000050",
      "unidadNombre": "Patrulla Central Urbana - Isla Teja",
      "unidadActiva": true
    }
  }
}
```

```bash
# 2. Intento de login con contraseña errónea
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:3001/api/seguridad/login \
  -H "Content-Type: application/json" \
  -d '{"identificador":"francisca.patrulla@valdivia.cl","password":"ClaveIncorrecta123"}'
```

Respuesta HTTP `401`:

```json
{"error":"Credenciales inválidas. Verifique su identificador o contraseña."}
```

```bash
# 3. Consulta /api/seguridad/usuario-activo sin token y con Bearer token
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3001/api/seguridad/usuario-activo
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3001/api/seguridad/usuario-activo \
  -H "Authorization: Bearer $TOKEN"
```

Respuestas HTTP `401` y `200`:

```json
{"error":"Se requiere cabecera de autenticación Authorization: Bearer <token>."}
```

```json
{
  "data": {
    "id": "d1000000-0000-4000-8000-000000000005",
    "rut": "15444555-6",
    "nombre": "Francisca Morales",
    "email": "francisca.patrulla@valdivia.cl",
    "activo": true,
    "delegacionId": "30000000-0000-4000-8000-000000000002",
    "rol": {
      "id": "20000000-0000-4000-8000-000000000004",
      "nombre": "Patrulla Verificadora",
      "codigo": "PATRULLA_VERIFICADORA",
      "esAdmin": false
    },
    "permisos": ["misiones:terreno:verificar"],
    "unidadId": "f1000000-0000-4000-8000-000000000050",
    "unidadNombre": "Patrulla Central Urbana - Isla Teja",
    "unidadActiva": true
  }
}
```

```bash
# 4. Evidencia RBAC: rol de terreno no autorizado a ejecutar baja de patrulla
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X DELETE \
  http://localhost:3001/api/patrullas/f1000000-0000-4000-8000-000000000050 \
  -H "Authorization: Bearer $TOKEN"
```

Respuesta HTTP `403`:

```json
{"message":"No cuenta con el permiso requerido: recursos:eliminar"}
```

```bash
# 5. Evidencia BUG-H85-PWA-02: fuga multi-patrulla sin filtro patrullaId vs consulta filtrada
curl -s "http://localhost:3001/api/misiones?tipoMision=VERIFICACION&ordenarPor=creadoEn&orden=desc" \
  -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3001/api/misiones?tipoMision=VERIFICACION&patrullaId=f1000000-0000-4000-8000-000000000050&ordenarPor=creadoEn&orden=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Resultados observados:
- Sin `patrullaId` (patrón actual de `sgrai-pwa`): `HTTP 200`, `meta.total: 8` retornando misiones de `8` patrullas diferentes (`MIS-2026-0013`..`MIS-2026-0001`).
- Con `patrullaId=f1000000-0000-4000-8000-000000000050`: `HTTP 200`, `meta.total: 1`, retornando exclusivamente `MIS-2026-0009` (`INC-2026-0001`, `"Patrulla Central Urbana - Isla Teja"`).

```bash
# 6. Verificación de protección de rutas y SSR en PWA (http://localhost:3002)
curl -s -i http://localhost:3002/terreno/patrulla/misiones | head -n 6
curl -s -o /dev/null -w "GET /terreno HTTP_STATUS:%{http_code}\n" http://localhost:3002/terreno
curl -s http://localhost:3002/terreno | grep -o '<span class="TerrenoBottomNav_label[^"]*">[^<]*</span>' | head -n 5
curl -s -i http://localhost:3002/api/seguridad/usuario-activo | head -n 5
```

Resultados observados:
- `/terreno/patrulla/misiones` sin cookie responde `HTTP/1.1 307 Temporary Redirect` hacia `/terreno/login?returnUrl=%2Fterreno%2Fpatrulla%2Fmisiones`.
- `GET /terreno` sin cookie responde `HTTP/1.1 200 OK` renderizando `<span class="TerrenoBottomNav_label__TdPBY">Historial</span>` (evidencia de `BUG-H85-PWA-06`).
- `GET http://localhost:3002/api/seguridad/usuario-activo` responde `HTTP/1.1 500 Internal Server Error` cuando no se define `INTERNAL_API_URL` / `NEXT_PUBLIC_API_URL` en el proceso Next.js (`next.config.ts` apunta por defecto a `localhost:4001`).

---

## 6. Matriz de Trazabilidad de Criterios de Aceptación

| Criterio de Aceptación / Regla (HU-85) | Responsabilidad Arquitectónica | Cobertura en `sgrai-pwa` | Estado Actual | Referencia / Brechas |
|---|---|---|---|---|
| **CA-1:** Acción 'Desactivar Patrulla' en panel de administración | `sgrai-web` (Administración) | Fuera de alcance en PWA (`AGENTS.md §1`). RBAC bloquea rol patrulla (`403`) y redirige roles de oficina sin destruir cookie | Aprobado en límite de alcance | `CP-H85-PWA-04`, `CP-H85-PWA-14` |
| **CA-2:** Modal de confirmación advirtiendo impacto de la acción | `sgrai-web` (Administración) | Fuera de alcance en PWA. En terreno se implementan banners diferenciados `UnidadInactivaBanner` y `SinUnidadBanner` | Con observaciones | `CP-H85-PWA-05`, `CP-H85-PWA-06`, `BUG-H85-PWA-06` |
| **CA-3:** API rechaza baja con `409 Conflict` si está `EN_VERIFICACION` o con misiones activas | `sgrai-api` (Backend) | La PWA debe reflejar rechazo `409`/`422` en outbox sin confirmar falsamente `EN_CURSO` y ocultar mutaciones al estar `unidadActiva=false` | Con defectos abiertos | `BUG-H85-PWA-01`, `BUG-H85-PWA-04`, `CP-H85-PWA-07` |
| **CA-4:** Baja lógica (`activo = false`, `eliminado_en`) sin borrar historial | `sgrai-api` (Backend / BD) | La PWA conmuta a modo histórico solo lectura (`DESACTIVADA`) y conserva historial de unidades en `/terreno/perfil` | Con defectos abiertos | `CP-H85-PWA-01`, `CP-H85-PWA-10`, `BUG-H85-PWA-02`, `BUG-H85-PWA-05` |
| **CA-5:** Liberación de vehículo y personal a disponibilidad comunal | `sgrai-api` / `sgrai-web` | Al quedar sin unidad asignada, la PWA debe detectar `SIN_ASIGNACION`, alertar con `SinUnidadBanner` y aislar misiones previas | Con defectos abiertos | `CP-H85-PWA-03`, `BUG-H85-PWA-02`, `BUG-H85-PWA-04`, `BUG-H85-PWA-06` |
| **Regla Crítica §3.7 y Contratos OpenAPI / Build** | Transversal (`sgrai-api` + `sgrai-pwa`) | Historial local inmutable por `unidadId`, tipado estricto OpenAPI en `api-generated.d.ts` y build productiva verde | **Rechazado (Bloqueante)** | `BUG-H85-PWA-01`, `BUG-H85-PWA-03`, `BUG-H85-PWA-05` |

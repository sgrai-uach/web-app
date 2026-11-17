# Registro y Gestión de Defectos de Integración y Regresión (Post-Merge en Rama Develop) — SGRAI (sgrai-pwa)

Este documento formaliza el registro, seguimiento y certificación del ciclo de vida de los defectos detectados durante la **integración continua y pruebas de regresión** en la rama principal `develop`, tras la aprobación y merge de los Pull Requests (PRs) de las distintas historias de usuario del proyecto SGRAI (Dirección de Gestión de Riesgos de Desastres - Municipalidad de Valdivia) en el repositorio cliente de terreno `sgrai-pwa` (`web-app`).

El estándar aplicado se fundamenta en las directrices de aseguramiento de calidad de software **IEEE 829 / ISO/IEC/IEEE 29119**.

---

## 1. Ficha Técnica de Integración y Regresión

| Parámetro | Detalle |
|---|---|
| **Proyecto** | Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI) |
| **Repositorio Auditado** | `sgrai-pwa` (`web-app` — Cliente Móvil de Terreno PWA) |
| **Rama Integrada** | `develop` |
| **Estrategia de Flujo Git** | Gitflow (Integración continua mediante Pull Requests con Pair Review, Code Review QA y Merge Final) |
| **Fase del Ciclo de Vida** | Post-Merge / Pruebas de Integración de Sistema (SIT), Verificación Estática y Regresión Automatizada |
| **Entorno de Pruebas** | Local & CI (Linux, Node.js v20+, Next.js 16.3.4 Webpack, React 19.2.8, TypeScript 5, IndexedDB `idb` 8.0.2, Socket.io Client 4.8.3, Vitest 3.2.7) |
| **Fecha de Monitoreo** | 09/11/2026 – 16/11/2026 |
| **Estado Global de Integración** | 🟢 **100% RESUELTO Y CERTIFICADO EN DEVELOP** |

---

## 2. Resumen Ejecutivo de Métricas de Integración

| Métrica | Valor | Observación |
|---|:---:|---|
| **Total Defectos Detectados Post-Merge** | **5** | Hallados en rama `develop` tras merges concurrentes de PRs (#1, #2, #3, #7, #9) |
| **Defectos Críticos / Bloqueantes** | **3** | Referencia huérfana en TypeScript, falla de empaquetado Turbopack y filtrado Socket.io |
| **Defectos Mayores** | **2** | Bloqueo de Git por rama de reversión huérfana e inconsistencias de saltos de línea POSIX |
| **Defectos de Severidad Media** | **0** | No se registraron defectos menores persistentes en rama base |
| **Defectos Resueltos y Verificados (Re-Test)** | **5** | 100% de los defectos cuentan con fix implementado y validado en `develop` |
| **Tasa de Éxito de Cierre (Resolution Rate)** | **100%** | Rama `develop` compila limpiamente, pasa 127/127 pruebas en 32 suites y 0 fallos de linter |

### Distribución por Dominio Afectado:
* **Compilación TypeScript / Next.js Build:** 2 defectos (`BUG-INT-PWA-01`, `BUG-INT-PWA-02`)
* **Tiempo Real / WebSockets / Gestión de Estado:** 1 defecto (`BUG-INT-PWA-04`)
* **Estandarización de Código / Formato / Git:** 1 defecto (`BUG-INT-PWA-03`)
* **Flujo de Integración Git / Reversión:** 1 defecto (`BUG-INT-PWA-05`)

---

## 3. Casos de Prueba de Integración Vinculados (CP-INT)

Los defectos fueron detectados durante la ejecución de los siguientes procedimientos estándar de verificación en `develop`:

* **`CP-INT-01 (Build PWA / Next.js)`:** Compilación completa y generación de bundle de producción del cliente web móvil (`npm run build`).
* **`CP-INT-02 (TypeCheck TypeScript)`:** Verificación estricta de análisis estático de tipos sin emisión de código (`npx tsc --noEmit`).
* **`CP-INT-03 (Linter Frontend)`:** Verificación de análisis estático de reglas de estilo y buenas prácticas con ESLint (`npm run lint`).
* **`CP-INT-04 (Suites de Pruebas Vitest)`:** Ejecución completa de suites de pruebas unitarias y de integración de componentes y hooks (`npm test`).
* **`CP-INT-05 (Flujo de Integración Git & Resolución de Conflictos)`:** Verificación de árbol lineal, ausencia de ramas huérfanas de reversión y consistencia de merges en GitHub.

---

## 4. Matriz Consolidada de Defectos de Integración (12 Columnas)

| ID Defecto | Caso Asociado | Severidad | Módulo Afectado | Descripción del Defecto | Pasos para Reproducir | Resultado Obtenido | Estado | Responsable Asignado | Fecha / Hora Detección | Fecha / Hora Re-Test | Solución / Commit |
|:---|:---|:---|:---|:---|:---|:---|:---:|:---|:---:|:---:|:---|
| **BUG-INT-PWA-01** | `CP-INT-02 (TypeCheck TypeScript)` | Bloqueante | WebSockets / Autenticación / socketClient | Colisión de importación de `DEV_PATRULLA_TOKEN` tras merge cruzado de PR #7 (HU-35) y PR #9 (HU-36): `socketClient.ts` importaba constante de bypass que fue removida en `client.ts` para mitigar vulnerabilidad. | 1. Situarse en develop tras merge de PR #9.<br>2. Ejecutar `npx tsc --noEmit` o `npm run build`. | Falla con código 1: *"Module '@/lib/api/client' has no exported member 'DEV_PATRULLA_TOKEN'"*. Build abortado. | **RESUELTO** | QA Lead / Equipo Frontend | 16/11/2026 22:17 | 16/11/2026 22:23 | `fix(socket): remover referencia huerfana a DEV_PATRULLA_TOKEN tras integracion de HU-36` |
| **BUG-INT-PWA-02** | `CP-INT-01 (Build PWA / Next.js)` | Bloqueante | Build / Turbopack / Next.js | Incompatibilidad de Turbopack con `@next/font` en scripts `dev` y `build` tras incorporación de fuentes offline en PR #7: Compilador abortaba procesamiento de fuentes locales. | 1. Situarse en develop tras merge de PR #7.<br>2. Ejecutar `npm run build` con Turbopack por defecto. | Error fatal al compilar fuentes locales offline en `layout.tsx`, abortando empaquetado de producción. | **RESUELTO** | Dev HU-35 / DevOps | 10/11/2026 15:45 | 10/11/2026 16:10 | `fix(build): configurar dev y build con webpack para evitar error de turbopack con next/font (#35)` [Commit `d548f9d`] |
| **BUG-INT-PWA-03** | `CP-INT-03 (Linter Frontend)` | Mayor | Componentes / Servicios / Docs | Mezcla de finales de línea CRLF y LF introducida en PR #7 por desarrollo multiplataforma, causando advertencias en diffs de Git y verificadores automáticos de formato. | 1. Realizar git checkout o diff en archivos integrados de HU-35.<br>2. Ejecutar linter o scripts de formato. | Archivos reportaban diferencias de whitespace y terminación de línea no estándar en 5 archivos nucleares. | **RESUELTO** | Dev HU-35 | 10/11/2026 16:15 | 10/11/2026 16:30 | `style(notificaciones): normalizar fin de linea posix en componentes y servicios (#35)` [Commits `5e593f2`, `30a94c3`, `51592f4`] |
| **BUG-INT-PWA-04** | `CP-INT-04 (Suites de Pruebas Vitest)` | Bloqueante | Tiempo Real / Socket.io / Terreno | Colisión de eventos en tiempo real tras integración anticipada de HU-85 (PR #2): `useTerrenoSocket` no filtraba eventos `patrulla:desactivada` por `patrullaId`, desactivando todas las patrullas en campo. | 1. Iniciar sesión con patrulla operativa.<br>2. Emitir evento Socket.io de desactivación para una patrulla distinta. | La interfaz desactivaba erróneamente la patrulla activa sin validar coincidencia de identificador. | **RESUELTO** | Dev HU-85 / QA Lead | 11/11/2026 14:10 | 12/11/2026 11:45 | `fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85)` [Commit `cb97408` / Merge `a0b7c0b`] |
| **BUG-INT-PWA-05** | `CP-INT-05 (Flujo de Integración Git)` | Mayor | Flujo Git / GitHub / Revert | Bloqueo de integración por rama de reversión huérfana `revert-pr-1`: Intento de merge de HU-36 sobre rama de reversión inconclusa generó 10 colisiones destructivas (modificado vs borrado). | 1. Ejecutar `git merge feature/h36-patrulla-aceptar-mision` sobre `revert-pr-1`. | Git aborta con 10 conflictos sin resolver. Código de HU-36 entraba en colisión con commits de borrado. | **RESUELTO** | QA Lead / DevOps | 13/11/2026 11:13 | 14/11/2026 00:33 | `merge: integrar resolucion definitiva de HU-36 en develop via PR #9 resolviendo bloqueo de reversión` [Commit `908a42d`] |

---

## 5. Detalle Técnico de Resolución y Ciclo de Re-Test

### `BUG-INT-PWA-01`: Referencia huérfana de `DEV_PATRULLA_TOKEN` en `socketClient.ts`
* **Causa Raíz:** Integración secuencial sin conflicto textual de Git: el PR #7 introdujo el cliente Socket.io haciendo fallback a `DEV_PATRULLA_TOKEN` de `@/lib/api/client`, mientras que el PR #9 eliminó dicha constante por motivos de seguridad institucional (cierre de `BUG-H36-PWA-01`).
* **Acción de Solución:** Remoción del import huérfano en [socketClient.ts](file:///home/ds2fery/Documentos/Proyecto/sgrai-uach/web-app/src/lib/socket/socketClient.ts#L4) y ajuste de `getSocket()` para utilizar `tokenOverride || getAuthCookie() || undefined`.
* **Resultado del Re-Test:** `npx tsc --noEmit` y `npm run build` finalizan con código 0 y compilación limpia de 8 rutas estáticas y dinámicas.

### `BUG-INT-PWA-02`: Incompatibilidad de compilador Turbopack con `@next/font`
* **Causa Raíz:** El motor de empaquetado Turbopack de Next.js presentó fallos en entornos Linux/CI al resolver las fuentes tipográficas Noto Sans empaquetadas localmente para operación offline.
* **Acción de Solución:** Parametrización explícita de `next build --webpack` y `next dev` en `package.json`, estabilizando el pipeline de empaquetado sin degradar tiempos de carga.
* **Resultado del Re-Test:** Compilación de producción se completa de manera determinística en 2.4s.

### `BUG-INT-PWA-03`: Inconsistencia de terminación de línea CRLF/LF
* **Causa Raíz:** Desarrollos concurrentes en estaciones de trabajo Windows sin normalización de `core.autocrlf` generaron archivos con terminación CRLF en módulos de notificaciones.
* **Acción de Solución:** Normalización estricta a formato POSIX LF en todos los archivos de componentes, servicios, pruebas y manuales de usuario.
* **Resultado del Re-Test:** Linter ejecuta con 0 errores y el historial de Git mantiene diffs limpios y atómicos.

### `BUG-INT-PWA-04`: Filtrado defectuoso de eventos en tiempo real y bucle `SIN_ASIGNACION`
* **Causa Raíz:** PR #2 implementó escuchas globales de Socket.io sin asociar el filtro por identificador de patrulla en sesión, afectando a patrullas que no eran sujeto del evento.
* **Acción de Solución:** Incorporación de filtro estricto por `patrullaId`/`cuadrillaId`, validación fail-closed de sesión, creación de banners dedicados (`UnidadInactivaBanner` y `SinUnidadBanner`) y adición de pruebas de regresión en `useTerrenoSocket.test.ts`.
* **Resultado del Re-Test:** 12 suites y 48 pruebas vinculadas a HU-85 pasando al 100% en Vitest.

### `BUG-INT-PWA-05`: Colisión de rama de reversión huérfana en flujo Git
* **Causa Raíz:** Se generó una rama `revert-pr-1` por una reversión prematura en GitHub que nunca fue completada ni mergeada en `develop`. Al intentar fusionar los cambios finales de HU-36 en dicha rama de reversión, se produjeron 10 conflictos destructivos.
* **Acción de Solución:** Aborto inmediato de la fusión errónea, cierre definitivo del PR de reversión en GitHub y apertura del PR #9 directo hacia `develop`, el cual se integró con 0 conflictos.
* **Resultado del Re-Test:** Árbol de commits de `develop` alineado con `origin/develop`, sin ramas bloqueadas ni divergencias históricas.

---

## 6. Bloque TSV (Exportable a Hojas de Cálculo / Google Sheets)

```tsv
ID Defecto	Caso Asociado	Severidad	Módulo Afectado	Descripción del Defecto	Pasos para Reproducir	Resultado Obtenido	Estado	Responsable Asignado	Fecha / Hora Ejecución	Fecha / Hora Re-Test	Solución / Commit
BUG-INT-PWA-01	CP-INT-02 (TypeCheck TypeScript)	Bloqueante	WebSockets / Autenticación / socketClient	Colisión de importación de DEV_PATRULLA_TOKEN tras merge cruzado de PR #7 (HU-35) y PR #9 (HU-36): socketClient.ts importaba constante de bypass que fue removida en client.ts para mitigar vulnerabilidad.	1. Situarse en develop tras merge de PR #9. 2. Ejecutar npx tsc --noEmit o npm run build.	Falla con código 1: "Module '@/lib/api/client' has no exported member 'DEV_PATRULLA_TOKEN'". Build abortado.	RESUELTO	QA Lead / Equipo Frontend	16/11/2026 22:17	16/11/2026 22:23	fix(socket): remover referencia huerfana a DEV_PATRULLA_TOKEN tras integracion de HU-36
BUG-INT-PWA-02	CP-INT-01 (Build PWA / Next.js)	Bloqueante	Build / Turbopack / Next.js	Incompatibilidad de Turbopack con @next/font en scripts dev y build tras incorporación de fuentes offline en PR #7: Compilador abortaba procesamiento de fuentes locales.	1. Situarse en develop tras merge de PR #7. 2. Ejecutar npm run build con Turbopack por defecto.	Error fatal al compilar fuentes locales offline en layout.tsx, abortando empaquetado de producción.	RESUELTO	Dev HU-35 / DevOps	10/11/2026 15:45	10/11/2026 16:10	fix(build): configurar dev y build con webpack para evitar error de turbopack con next/font (#35) [Commit d548f9d]
BUG-INT-PWA-03	CP-INT-03 (Linter Frontend)	Mayor	Componentes / Servicios / Docs	Mezcla de finales de línea CRLF y LF introducida en PR #7 por desarrollo multiplataforma, causando advertencias en diffs de Git y verificadores automáticos de formato.	1. Realizar git checkout o diff en archivos integrados de HU-35. 2. Ejecutar linter o scripts de formato.	Archivos reportaban diferencias de whitespace y terminación de línea no estándar en 5 archivos nucleares.	RESUELTO	Dev HU-35	10/11/2026 16:15	10/11/2026 16:30	style(notificaciones): normalizar fin de linea posix en componentes y servicios (#35) [Commits 5e593f2, 30a94c3, 51592f4]
BUG-INT-PWA-04	CP-INT-04 (Suites de Pruebas Vitest)	Bloqueante	Tiempo Real / Socket.io / Terreno	Colisión de eventos en tiempo real tras integración anticipada de HU-85 (PR #2): useTerrenoSocket no filtraba eventos patrulla:desactivada por patrullaId, desactivando todas las patrullas en campo.	1. Iniciar sesión con patrulla operativa. 2. Emitir evento Socket.io de desactivación para una patrulla distinta.	La interfaz desactivaba erróneamente la patrulla activa sin validar coincidencia de identificador.	RESUELTO	Dev HU-85 / QA Lead	11/11/2026 14:10	12/11/2026 11:45	fix(terreno): corregir filtrado Socket.io, enlaces SIN_ASIGNACION, tokens CSS y cobertura de pruebas (H85) [Commit cb97408 / Merge a0b7c0b]
BUG-INT-PWA-05	CP-INT-05 (Flujo de Integración Git)	Mayor	Flujo Git / GitHub / Revert	Bloqueo de integración por rama de reversión huérfana revert-pr-1: Intento de merge de HU-36 sobre rama de reversión inconclusa generó 10 colisiones destructivas (modificado vs borrado).	1. Ejecutar git merge feature/h36-patrulla-aceptar-mision sobre revert-pr-1.	Git aborta con 10 conflictos sin resolver. Código de HU-36 entraba en colisión con commits de borrado.	RESUELTO	QA Lead / DevOps	13/11/2026 11:13	14/11/2026 00:33	merge: integrar resolucion definitiva de HU-36 en develop via PR #9 resolviendo bloqueo de reversión [Commit 908a42d]
```

---

## 7. Dictamen Final de QA de Integración (QA Sign-Off)

Tras la detección, aislamiento, corrección y re-test formal de los 5 defectos de integración post-merge en la rama `develop` de `sgrai-pwa`:

1. **Estabilidad de Compilación y Empaquetado:** El cliente web Next.js 16.3.4 compila al 100% de forma estricta (`npm run build`) bajo Webpack, finalizando la optimización de páginas en 2.4 segundos y superando `tsc --noEmit` sin errores de tipos.
2. **Robustez de Pruebas Automatizadas:** Se validó la ejecución íntegra de la suite Vitest, alcanzando **127 pruebas aprobadas en 32 suites** sin fallas de regresión en flujos offline, autenticación, misiones de patrulla y cuadrilla ni notificaciones en tiempo real.
3. **Calidad de Código y Estilo:** ESLint certifica cumplimiento de reglas con 0 advertencias y 0 errores.
4. **Trazabilidad de Control de Versiones:** La rama `develop` se encuentra alineada de forma lineal con `origin/develop`, sin ramas huérfanas de reversión ni conflictos pendientes.

**Dictamen QA:** 🟢 **RAMA DEVELOP INTEGRADA, ESTABILIZADA Y CERTIFICADA (100% APROBADA).**


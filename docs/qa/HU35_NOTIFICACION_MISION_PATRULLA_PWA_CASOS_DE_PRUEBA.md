# Plan y Matriz de Casos de Prueba — HU-35: Notificación de Misión Asignada a Patrulla en Terreno y Trazabilidad de ACK

**Estándar:** IEEE 829 (Test Plan and Test Results Report)  
**Proyecto:** Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI)  
**Aplicación:** `sgrai-pwa` (Cliente de Terreno PWA)  
**Módulo:** Notificaciones en Terreno y Trazabilidad de Despacho  
**Historia de Usuario:** HU-35  
**Fecha de Ejecución:** 2026-11-10  
**Herramientas de Evaluación:** Vitest v3.2.7, React Testing Library v16.3.3, JSDOM, Fake IndexedDB, TypeScript v5  
**Resultado Global:** 100% Aprobado (9/9 Casos de Prueba Aprobados)

---

## 1. Alcance y Objetivos de la Certificación

Validar la correcta recepción, despliegue visual, señalética sensorial (audio y vibración háptica), emisión inmediata del acuse técnico (`RECIBIDA`), confirmación operativa de lectura (`LEIDA`), resiliencia y deduplicación local, reconciliación desconectada (Offline-First) y accesibilidad táctil para uso con guantes bajo condiciones de terreno municipal de la Dirección de Gestión de Riesgos de Desastres de la Municipalidad de Valdivia.

---

## 2. Matriz de Casos de Prueba (IEEE 829)

### CP-H35-PWA-01: Suscripción a Sala Operativa de Patrulla

- **Identificador:** CP-H35-PWA-01
- **Objetivo:** Validar que al iniciar sesión el líder de patrulla, el socket cliente se suscribe automáticamente a la sala `patrulla:{patrullaId}`.
- **Precondiciones:**
  1. Usuario autenticado con rol `PATRULLA_VERIFICADORA`.
  2. Unidad patrulla asignada con identificador UUID válido.
- **Datos de Prueba:**
  - `patrullaId`: `"patrulla-uuid-999"`
  - `rolCodigo`: `"PATRULLA_VERIFICADORA"`
- **Pasos:**
  1. Renderizar `NotificacionesTerrenoProvider` con sesión de patrullero activa.
  2. Verificar la invocación de `conectarSocket(token)`.
  3. Verificar la emisión del evento de unión a sala `join`/`unirse`.
- **Resultado Esperado:** Socket conectado e invocación de `unirseASalaPatrulla('patrulla-uuid-999')` emitiendo a la sala `patrulla:patrulla-uuid-999`.
- **Resultado Obtenido:** APROBADO (Verificado en `NotificacionesTerrenoContext.test.tsx`).
- **Estado:** APROBADO.

---

### CP-H35-PWA-02: Recepción y Despliegue Visual del Banner de Misión

- **Identificador:** CP-H35-PWA-02
- **Objetivo:** Al emitir el evento WebSocket `mision:asignada`, comprobar que se despliega el banner flotante con código de misión, folio de incidente, dirección, tipología de afectación y badge de prioridad.
- **Precondiciones:**
  1. Cliente de patrulla en terreno suscrito a su sala.
  2. Banner inicialmente oculto.
- **Datos de Prueba:**
  - `codigo`: `"MIS-2026-0042"`
  - `incidenteFolio`: `"FOL-1042"`
  - `tipoAfectacion`: `"Inundación por colapso de sumidero"`
  - `direccion`: `"Calle Bueras 450, Valdivia"`
  - `prioridad`: `"ALTA"`
- **Pasos:**
  1. Disparar el evento WebSocket `mision:asignada` con el payload de prueba.
  2. Inspeccionar el árbol de componentes renderizado.
- **Resultado Esperado:** Se despliega en el DOM el componente `MisionAsignadaBanner` con `role="alert"` y todos los metadatos institucionales legibles.
- **Resultado Obtenido:** APROBADO (Verificado en `MisionAsignadaBanner.test.tsx` y `NotificacionesTerrenoContext.test.tsx`).
- **Estado:** APROBADO.

---

### CP-H35-PWA-03: Alerta Sonora y Vibración Háptica

- **Identificador:** CP-H35-PWA-03
- **Objetivo:** Validar la invocación de la Web Audio API y el disparo del patrón de vibración háptica en `navigator.vibrate` ante una asignación.
- **Precondiciones:**
  1. Navegador o dispositivo con APIs Web Audio y Vibration disponibles.
- **Datos de Prueba:**
  - Frecuencias de oscilador: 880 Hz ascendiendo a 1174.66 Hz.
  - Patrón de vibración: `[300, 150, 300, 150, 450]`.
- **Pasos:**
  1. Invocar `activarAlertaSensorialMision()`.
  2. Verificar creación de oscilador, configuración de frecuencias y tiempos de ejecución.
  3. Verificar llamada a `navigator.vibrate` con el array del patrón.
- **Resultado Esperado:** AudioContext crea oscilador de bitono de emergencia y `navigator.vibrate` es invocado con `[300, 150, 300, 150, 450]`. Si no hay soporte, no lanza excepción no controlada.
- **Resultado Obtenido:** APROBADO (Verificado en `alertaSonora.test.ts`).
- **Estado:** APROBADO.

---

### CP-H35-PWA-04: Emisión Automática de ACK Técnico `RECIBIDA`

- **Identificador:** CP-H35-PWA-04
- **Objetivo:** Comprobar que en cuanto ingresa el payload se emite automáticamente la confirmación técnica `RECIBIDA` sin esperar interacción del operador.
- **Precondiciones:**
  1. Notificación con `notificacionId` UUID no procesada previamente.
- **Datos de Prueba:**
  - `notificacionId`: `"notif-uuid-1234"`
  - `misionId`: `"mision-uuid-5678"`
- **Pasos:**
  1. Invocar `procesarMisionAsignada(alerta)`.
  2. Verificar persistencia local en `notificaciones` e `misiones` de IndexedDB.
  3. Verificar emisión de ACK mediante `emitirAckNotificacionSocket` o fallback HTTP.
- **Resultado Esperado:** `guardarNotificacionLocal` registra estado `RECIBIDA` y se emite de forma inmediata `notificacion:ack` con `{ notificacionId, estado: "RECIBIDA" }`.
- **Resultado Obtenido:** APROBADO (Verificado en `notificacionesService.test.ts`).
- **Estado:** APROBADO.

---

### CP-H35-PWA-05: Acuse de Lectura Operativo `LEIDA` y Navegación

- **Identificador:** CP-H35-PWA-05
- **Objetivo:** Comprobar que al tocar el banner o botón "Ver Misión" se emite el ACK `LEIDA`, se cierra el banner y se redirige a la vista de detalle de la misión.
- **Precondiciones:**
  1. Banner de asignación visible en pantalla.
- **Datos de Prueba:**
  - `misionId`: `"mis-100"`
  - `notificacionId`: `"notif-100"`
- **Pasos:**
  1. Pulsar el botón interactivo "Ver Misión".
  2. Verificar llamada a `emitirAckLectura('notif-100', 'mis-100')`.
  3. Verificar que el banner se remueve del DOM.
  4. Verificar que el enrutador ejecuta `router.push('/patrulla/misiones/mis-100')`.
- **Resultado Esperado:** ACK `LEIDA` emitido hacia el backend, banner cerrado y redirección fluida a la ruta de detalle de la misión.
- **Resultado Obtenido:** APROBADO (Verificado en `NotificacionesTerrenoContext.test.tsx` y `notificacionesService.test.ts`).
- **Estado:** APROBADO.

---

### CP-H35-PWA-06: Deduplicación Local de Asignaciones

- **Identificador:** CP-H35-PWA-06
- **Objetivo:** Simular la llegada repetida de la misma alerta y verificar que no se reproduzcan sonidos dobles ni banners duplicados ni reenvíos innecesarios de ACK.
- **Precondiciones:**
  1. Notificación previamente procesada en memoria o IndexedDB.
- **Datos de Prueba:**
  - `notificacionId`: `"notif-uuid-1234"`
- **Pasos:**
  1. Procesar la alerta por primera vez.
  2. Volver a invocar `procesarMisionAsignada` con el mismo `notificacionId`.
- **Resultado Esperado:** La segunda invocación retorna `esDuplicado: true`, no invoca reproducción sonora ni persiste registros duplicados en IndexedDB.
- **Resultado Obtenido:** APROBADO (Verificado en `notificacionesService.test.ts`).
- **Estado:** APROBADO.

---

### CP-H35-PWA-07: Reconciliación Offline / Modo Avión

- **Identificador:** CP-H35-PWA-07
- **Objetivo:** En caso de corte de señal y asignación durante desconexión, verificar que al recuperar cobertura se consulte `GET /api/terreno/misiones/pendientes`, se despliegue la alerta y se emita el ACK `RECIBIDA`.
- **Precondiciones:**
  1. Dispositivo sin conexión celular o fuera de cobertura.
  2. Misión despachada por el Centro de Mando en el servidor en estado `PENDIENTE_ENVIO` o `ENVIADA`.
- **Datos de Prueba:**
  - Misión pendiente con `notificacionId: "notif-offline-99"`, `codigoMision: "MIS-2026-0077"`.
- **Pasos:**
  1. Disparar evento de reconexión `window.dispatchEvent(new Event('online'))` o evento `connect` de socket.
  2. Verificar llamada al endpoint `GET /api/terreno/misiones/pendientes`.
  3. Validar procesamiento de la misión pendiente obtenida.
- **Resultado Esperado:** Se recuperan las órdenes pendientes, se despliega el banner en pantalla y se envía inmediatamente el acuse técnico `RECIBIDA`.
- **Resultado Obtenido:** APROBADO (Verificado en `NotificacionesTerrenoContext.test.tsx`).
- **Estado:** APROBADO.

---

### CP-H35-PWA-08: Accesibilidad Táctil para Uso con Guantes

- **Identificador:** CP-H35-PWA-08
- **Objetivo:** Verificar mediante pruebas de renderizado que los botones interactivos poseen dimensiones táctiles mínimas de 48x48px con alto contraste.
- **Precondiciones:**
  1. Componente `MisionAsignadaBanner` montado en el DOM.
- **Datos de Prueba:**
  - Botón principal "Ver Misión".
  - Botón secundario "Cerrar".
- **Pasos:**
  1. Renderizar el banner.
  2. Inspeccionar clases CSS aplicadas a los botones (`btnVerMision` y `btnCerrar`).
  3. Verificar reglas de hoja de estilo: `min-height: 48px; min-width: 48px; border-radius: 0;`.
- **Resultado Esperado:** Cumplimiento estricto del estándar de accesibilidad táctil para guantes en terreno (dimensiones $\ge 48$px, esquinas rectas).
- **Resultado Obtenido:** APROBADO (Verificado en `MisionAsignadaBanner.test.tsx` y `MisionAsignadaBanner.module.css`).
- **Estado:** APROBADO.

---

### CP-H35-PWA-09: Cumplimiento de Diseño Institucional sin Emojis

- **Identificador:** CP-H35-PWA-09
- **Objetivo:** Verificar la ausencia total de caracteres Unicode emoji en el árbol DOM del banner y componentes de notificación.
- **Precondiciones:**
  1. Componente `MisionAsignadaBanner` renderizado con datos completos.
- **Datos de Prueba:**
  - Árbol DOM completo del banner.
- **Pasos:**
  1. Extraer el texto completo del contenedor (`container.textContent`).
  2. Evaluar mediante expresión regular Unicode para emojis (`[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]`).
- **Resultado Esperado:** 0 caracteres emoji encontrados. Toda la iconografía técnica se implementa con SVG vectoriales de `lucide-react`.
- **Resultado Obtenido:** APROBADO (Verificado en `MisionAsignadaBanner.test.tsx`).
- **Estado:** APROBADO.

---

## 3. Registro de Defectos y Protocolo de Re-Test (Ciclo de Defectos)

Durante la fase de construcción y ejecución de pruebas automatizadas, se detectaron y subsanaron los siguientes defectos bajo el estándar IEEE 829:

### Defecto 1: `BUG-H35-PWA-01`
- **Severidad:** Alta
- **Componente:** `src/services/notificacionesService.ts`
- **Descripción:** La función `procesarMisionAsignada` invocaba a `emitirAckRecibida` con `void emitirAckRecibida(...)` sin esperar la resolución de la promesa. Esto causaba una condición de carrera asíncrona donde la prueba y el ciclo de vida de la notificación se resolvían antes de encolar en la base de datos IndexedDB si el dispositivo operaba desconectado.
- **Causa Raíz:** Falta de `await` en la invocación de la estrategia híbrida de emisión de ACK.
- **Corrección Aplicada:** Se modificó la invocación a `await emitirAckRecibida(alerta.notificacionId)`.
- **Resultado en Re-Test:** APROBADO (100% de aserciones pasando en `notificacionesService.test.ts`).

### Defecto 2: `BUG-H35-PWA-02`
- **Severidad:** Media
- **Componente:** `src/components/misiones/MisionAsignadaBanner.tsx`
- **Descripción:** Error de compilación TypeScript TS2724 al importar `formatearFechaHora` inexistente en `@/lib/utils/formatters` en lugar del método institucional `formatearFechaHora24h`.
- **Causa Raíz:** Discrepancia de nomenclatura de utilitarios de formateo.
- **Corrección Aplicada:** Se actualizó la importación y llamada a `formatearFechaHora24h`.
- **Resultado en Re-Test:** APROBADO (Compilación limpia de TypeScript sin errores).

---

## 4. Verificación de Criterio de Salida

- Total de casos de prueba definidos: 9
- Total de casos de prueba ejecutados: 9
- Casos Aprobados (PASS): 9 (100%)
- Casos Fallidos (FAIL): 0 (0%)
- Casos Bloqueados: 0 (0%)
- Suites de pruebas totales del repositorio: 31 pasando sin errores (113 tests unitarios e integración).
- **Dictamen Final:** APROBADO para integración hacia la rama `develop`.

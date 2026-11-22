# Manual de Usuario: Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (H36)

**Historia de Usuario:** H36 — Confirmar y aceptar misión asignada desde el dispositivo móvil  
**Rol:** Patrulla Verificadora  
**Aplicación:** SGRAI — PWA Terreno (`/terreno/patrulla/misiones/[id]`)

---

## 1. Propósito

Este manual describe el procedimiento operativo mediante el cual el personal de una **Patrulla Verificadora** confirma y acepta desde su dispositivo móvil una misión de verificación despachada por el Centro de Mando, notificando que la unidad ha tomado conocimiento de la emergencia, va en trayecto hacia el lugar del incidente y habilitando la interfaz de evaluación técnica en terreno.

---

## 2. Requisitos Previos y Permisos de Hardware

1. **Cuenta y Permiso RBAC Habilitado:**
   - El operador debe contar con sesión activa bajo el rol **`PATRULLA_VERIFICADORA`** y poseer el permiso **`misiones:terreno:verificar`**.
   - La patrulla asignada debe encontrarse en servicio activo (`unidadActiva: true`).
2. **Permiso de Ubicación (GPS) en el Dispositivo Móvil:**
   - Al presionar **"Aceptar Misión"** por primera vez, el navegador móvil (Chrome, Edge o Safari) solicitará permiso para acceder a la ubicación del dispositivo.
   - Se recomienda seleccionar **"Permitir mientras la app está en uso"** para adjuntar las coordenadas GPS de salida en el hito **`MISION_ACEPTADA`**.
   - **Comportamiento no bloqueante (Timeout de 5 segundos):** Si en terreno la señal satelital demora más de **5 segundos** o el permiso de ubicación no fue concedido, la aplicación envía automáticamente la confirmación de salida sin coordenadas para **nunca retrasar el despliegue operativo**.

---

## 3. Instrucciones Paso a Paso

1. Ingrese a la aplicación **SGRAI Terreno** (`/terreno`) con su cuenta de **Patrulla Verificadora**.
2. Diríjase a la pestaña **Misiones** (`/terreno/patrulla/misiones`) o seleccione la tarjeta de misión prioritaria desde la pantalla de **Inicio**.
3. Toque la misión asignada que se encuentre con etiqueta de estado **Despachada** para abrir la vista de detalle (`/terreno/patrulla/misiones/[id]`).
4. Verifique en la ficha superior los antecedentes del despacho:
   - **Código del incidente** (ej. `INC-2026-0001`) y chip de **Prioridad** (`Crítica`, `Alta`, `Media` o `Baja`).
   - **Tipo** de incidente reportado inicialmente.
   - **Ubicación** (con botón **Ver mapa** para consultar el punto exacto en el visor cartográfico).
   - **Trabajo** o instrucciones tácticas de verificación.
5. En el recuadro operativo **Acciones de Despacho**, presione el botón táctil principal de alto contraste **"Aceptar Misión"**.
6. Al completarse la confirmación:
   - El estado de la misión cambia automáticamente de **Despachada** a **En curso** y se registra la hora de **Inicio de trayecto**.
   - La patrulla mantiene su estado canónico **En verificación** (`EN_VERIFICACION`) y el incidente permanece en **Verificando** (`VERIFICANDO`).
   - Se despliega el panel activo **En Trayecto / Evaluación** y se habilita la sección **Formularios de Reporte Técnico** para proceder con la evaluación al arribar al lugar.

---

## 4. Comportamiento sin Conexión (Modo Offline)

- **Aceptación sin señal celular:**
  - Si el operador presiona **"Aceptar Misión"** en una zona sin cobertura de red, la aplicación **no bloquea la operación**: cambia de inmediato la pantalla al estado **En Trayecto / Evaluación** y guarda la acción en la cola local del dispositivo (`IndexedDB` $\rightarrow$ `outbox` con tipo `ACEPTAR_MISION`).
- **Indicador visual de cola local:**
  - En la parte superior de la pantalla el distintivo **`ConnectionStatusBadge`** mostrará **"Trabajando offline (1 pendientes)"** y dentro de la tarjeta de estado aparecerá una franja de alto contraste (`--color-charcoal`):
    > *"Pendiente de sincronizar: La aceptación fue guardada en la cola local del dispositivo y se enviará automáticamente al recuperar conexión."*
- **Sincronización automática e idempotencia al recuperar conexión:**
  - Apenas el dispositivo recupere señal 4G/5G o WiFi, el sistema transmite automáticamente `POST /api/misiones/{id}/aceptar` al servidor central, registra el hito oficial **`Misión Aceptada por Patrulla`** con la marca de tiempo del servidor y actualiza el indicador a **"Sincronizado"** (`--color-sage`).
  - Si la misión ya había sido marcada como **`EN_CURSO`** previamente (respuesta `409 Conflict`), la cola local da la tarea por sincronizada de manera transparente sin mostrar errores al operador.

---

## 5. Relación con Otros Repositorios

- **`sgrai-api`:** Procesa la transición atómica en `POST /api/misiones/{id}/aceptar`, registra el hito `MISION_ACEPTADA` en la tabla `mision_hito` y emite el evento WebSocket `mision:actualizada`.
- **`sgrai-web`:** Recibe en tiempo real el evento `mision:actualizada` en la sala del Encargado del Centro de Mando, reflejando el inicio del traslado en la bitácora operativa.


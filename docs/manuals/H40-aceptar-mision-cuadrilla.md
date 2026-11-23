# Manual de Usuario: Aceptar Asignación de Incidente por Delegado de Cuadrilla (H40)

**Historia de Usuario:** H40 — Como Delegado de Cuadrilla, quiero aceptar la solicitud de asignación a un incidente desde el dispositivo móvil  
**Rol:** Delegado de Cuadrilla (`DELEGADO_CUADRILLA`)  
**Aplicación:** SGRAI — PWA Terreno (`/terreno/cuadrilla/misiones/[id]`)

---

## 1. Propósito

Este manual describe el procedimiento operativo mediante el cual el **Delegado de Cuadrilla** confirma y acepta desde su dispositivo móvil la asignación a un incidente despachada por el Centro de Mando, notificando a la central de operaciones que la cuadrilla inicia el desplazamiento y asume formalmente la atención de la emergencia.

---

## 2. Requisitos Previos y Permisos de Hardware

1. **Cuenta y Permiso RBAC Habilitado:**
   - El operador debe contar con sesión activa bajo el rol **`DELEGADO_CUADRILLA`** y poseer el permiso **`misiones:terreno:ejecutar`**.
   - La cuadrilla asignada debe encontrarse en servicio activo (`unidadActiva: true`).
2. **Permiso de Ubicación (GPS) en el Dispositivo Móvil:**
   - Al presionar **"Aceptar Asignación"** por primera vez, el navegador móvil (Chrome, Edge o Safari) solicitará permiso para acceder a la ubicación del dispositivo.
   - Se recomienda seleccionar **"Permitir mientras la app está en uso"** para adjuntar las coordenadas GPS de salida en el hito **`MISION_ACEPTADA`**.
   - **Comportamiento no bloqueante (Timeout de 5 segundos):** Si la señal satelital demora más de **5 segundos** o el permiso de ubicación no fue concedido, la aplicación envía automáticamente la confirmación sin coordenadas para **nunca retrasar el inicio del desplazamiento**.

---

## 3. Instrucciones Paso a Paso

1. Ingrese a la aplicación **SGRAI Terreno** (`/terreno`) con su cuenta de **Delegado de Cuadrilla**.
2. Al recibir una alerta en tiempo real (**"Misión Asignada en Terreno"**), presione **"Ver Misión"**; o bien diríjase a la pestaña **Faenas** (`/terreno/cuadrilla/misiones`) y seleccione la misión con estado **Despachada**.
3. Verifique en la ficha superior los antecedentes del incidente a atender:
   - **Código del incidente** (ej. `INC-2026-0001`) y nivel de **Prioridad** (`Crítica`, `Alta`, `Media` o `Baja`).
   - **Tipo** de emergencia constatada.
   - **Ubicación** (con botón **Ver mapa** para visualizar el punto exacto en el mapa).
   - **Trabajo** o instrucciones tácticas asignadas a la cuadrilla.
4. En la tarjeta **Acciones de Despacho**, presione el botón táctil principal **"Aceptar Asignación"**.
5. Al confirmarse la aceptación:
   - El estado de la misión cambia automáticamente de **Despachada** a **En curso** y la etiqueta de fecha pasa a mostrar **Inicio de trayecto**.
   - La cuadrilla actualiza su estado canónico a **En misión** (`EN_MISION`) y el incidente transiciona a **En atención** (`EN_ATENCION`).
   - Se despliega la tarjeta activa **Faena en Curso** y queda habilitada la tarjeta **Confirmación de arribo ("Llegada a Terreno" — H42)** para certificar la llegada física al sitio.

---

## 4. Comportamiento sin Conexión (Modo Offline)

- **Aceptación en zonas de baja o nula señal:**
  - Si el Delegado de Cuadrilla presiona **"Aceptar Asignación"** sin cobertura celular o Wi-Fi, la aplicación **no bloquea la operación**: cambia de inmediato la pantalla al estado **Faena en Curso** (habilitando el paso siguiente de llegada a terreno) y guarda la mutación en la cola local del dispositivo (`IndexedDB` $\rightarrow$ `outbox` con tipo `ACEPTAR_MISION`).
- **Indicadores visuales de cola local:**
  - El sistema muestra un aviso de advertencia **"Guardado sin conexión"** y el distintivo superior **`ConnectionStatusBadge`** indicará las acciones pendientes de envío.
  - Dentro de la tarjeta **Faena en Curso** se desplegará una franja de alto contraste (`--color-charcoal`):
    > *"Pendiente de sincronizar: La acción fue guardada en la cola local del dispositivo y se enviará automáticamente al recuperar conexión."*
- **Sincronización automática e idempotencia al recuperar conexión:**
  - Apenas el dispositivo recupere conectividad, la PWA transmite `POST /api/misiones/{id}/aceptar` automáticamente, registra el hito oficial **`Asignación Aceptada por Cuadrilla`** y limpia el aviso de sincronización pendiente.
  - Si la asignación ya figuraba en estado **`EN_CURSO`** en el servidor (respuesta idempotente `409 Conflict`), la cola local marca la operación como completada de forma transparente y notifica **"Misión ya en curso"** sin errores bloqueantes.

---

## 5. Relación con Otros Repositorios

- **`sgrai-api`:** Ejecuta la transacción atómica en `POST /api/misiones/{id}/aceptar` (misión `DESPACHADA -> EN_CURSO`, `cuadrilla.estado = EN_MISION`, `incidente.estado = EN_ATENCION`, hito `Asignación Aceptada por Cuadrilla`) y emite los eventos WebSocket `incidente:actualizado`, `mision:actualizada` y `cuadrilla:actualizada`.
- **`sgrai-web`:** Recibe en tiempo real las actualizaciones de estado en el tablero Kanban del Encargado del Centro de Mando, reflejando el paso del incidente a **En Atención**.

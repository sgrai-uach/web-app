# Manual de Usuario: Enviar Informe Técnico de Verificación y Cerrar Misión (H39)

**Historia de Usuario:** H39 (fusión H39 / H86) — Enviar el informe técnico de verificación en terreno y cerrar la misión inicial de patrullaje  
**Rol:** Patrulla Verificadora  
**Aplicación:** SGRAI — PWA Terreno (`/patrulla/misiones/[id]`)

---

## 1. Propósito

Este manual describe el procedimiento operativo para que la **Patrulla Verificadora** emita el informe técnico consolidado tras inspeccionar la emergencia en terreno y cierre su misión inicial de patrullaje. Desde este formulario, la patrulla define si la emergencia requiere despacho de una cuadrilla operativa (`REQUIERE_CUADRILLA`) o si debe descartarse de forma fundada como `NO_ABORDABLE`, registra el detalle de personas damnificadas (precargado desde H38 y editable), daños estimados y la necesidad de levantamiento de Ficha FIBE, liberando la unidad a estado **Disponible**.

---

## 2. Requisitos Previos y Precondiciones

1. **Sesión Autenticada y Permiso RBAC:**
   - El funcionario debe pertenecer al rol **`PATRULLA_VERIFICADORA`** y contar con el permiso **`reportes:crear`**.
   - La unidad de patrulla debe encontrarse activa en servicio.
2. **Misión Aceptada (`EN_CURSO`):**
   - La misión de verificación debe encontrarse en estado `EN_CURSO` (aceptada previamente según H36).
   - Se recomienda haber completado previamente la categorización de tipología (H37) y la evaluación de prioridad (H38) para precargar automáticamente el conteo de personas damnificadas.

---

## 3. Sincronización entre Integrantes de la Patrulla

- Cuando cualquier funcionario asignado a la patrulla envía el informe técnico de verificación y cierre, el sistema registra su identidad (`evaluador`) y emite eventos en tiempo real (`mision:actualizada`, `incidente:actualizado`, `patrulla:actualizada`).
- El resto de los integrantes de la misma patrulla visualizan de inmediato el cierre de la misión, el resumen completo del informe y el aviso **"Registrado por [Nombre del Funcionario]"** junto con la fecha y hora del envío, evitando envíos duplicados.

---

## 4. Instrucciones Paso a Paso

1. Ingrese al detalle de la misión activa (`/patrulla/misiones/[id]`).
2. Abra la sección desplegable **Informe técnico de verificación y cierre** dentro de **Formularios de Reporte Técnico**.
3. **Paso 1 — Dictamen de Atención:**
   - Seleccione una de las dos opciones táctiles:
     - **Requiere cuadrilla (`REQUIERE_CUADRILLA`):** Emergencia validada que requiere el despacho de cuadrilla pesada desde el Centro de Mando.
     - **No abordable (`NO_ABORDABLE`):** Emergencia dentro de predio privado inaccesible, faja fiscal externa o falsa alarma.
   - Si selecciona **No abordable**, se desplegará obligatoriamente el campo **Motivo de No Abordabilidad**, donde debe ingresar una justificación técnica de al menos **15 caracteres**.
4. **Paso 2 — Diagnóstico Técnico y Terreno:**
   - Complete el campo obligatorio **Resumen técnico del siniestro** (mínimo **10 caracteres**) describiendo lo constatado en el sitio.
   - Seleccione el **Estado del terreno** (`Crítico`, `Estable`, `Inaccesible`, `Controlado` o `Finalizado`).
5. **Paso 3 — Personas Damnificadas y Daños:**
   - El campo **Personas damnificadas / afectadas** se inicializará automáticamente con la cantidad registrada en la evaluación de prioridad previa (H38), mostrando la nota informativa:
     > *"Rescatado de la evaluación de prioridad previa; puede modificarlo si constató un número distinto."*
   - Puede ajustar el número entero (`>= 0`) utilizando los botones táctiles `-` y `+` o escribiendo directamente en el campo numérico.
   - Opcionalmente, ingrese los **Daños materiales estimados** y **Observaciones generales**.
6. **Paso 4 — Asistencia Social (Ficha FIBE) y Evidencia Fotográfica:**
   - Active el interruptor **"Requiere Asistencia Social (Levantamiento Ficha FIBE)"** si constató familias que requieren derivación a Asistente Social.
   - La sección **Evidencia Fotográfica** muestra el contenedor preparado para la carga de fotografías en terreno (integración con H43).
7. **Envío y Cierre de Tarea:**
   - Presione **"Enviar Reporte y Cerrar Tarea"**.
   - Revise el resumen en el modal de confirmación y pulse **"Confirmar y Cerrar Misión"**.
   - Al confirmarse el registro (`201 Created`), la aplicación mostrará la notificación de éxito y regresará automáticamente a la pantalla principal de misiones (`/patrulla/misiones`) en espera de nuevas asignaciones.

---

## 5. Comportamiento sin Conexión (Modo Offline-First)

1. **Validación Local Previa:**
   - Antes de persistir localmente, el formulario valida mediante Zod la longitud mínima del resumen técnico (`>= 10` caracteres), la obligatoriedad del motivo de no abordabilidad (`>= 15` caracteres) cuando el dictamen es `NO_ABORDABLE` y el conteo entero no negativo de personas afectadas.
2. **Encolado en `Outbox` (`IndexedDB`):**
   - Si no hay cobertura celular al presionar **"Confirmar y Cerrar Misión"**, la PWA guarda el payload en la cola local `outbox` bajo la acción `ENVIAR_REPORTE` (`POST /api/misiones/{id}/reporte`) y actualiza optimísticamente la misión a estado `COMPLETADA` con `sincronizacionPendiente: true`.
3. **Notificación y Retorno Seguro:**
   - La aplicación informa al operador que el informe fue guardado localmente y regresa a la bandeja de misiones; el indicador superior `ConnectionStatusBadge` reflejará la acción pendiente.
4. **Sincronización Automática al Recuperar Red:**
   - Al restablecerse la conexión, la cola `outbox` envía automáticamente el informe hacia `sgrai-api`, ejecutando la transacción de cierre, liberando la patrulla a `DISPONIBLE` y notificando al Centro de Mando y al resto de la patrulla.

---

## 6. Permisos de Hardware Requeridos

- **Almacenamiento Local (`IndexedDB`):** Requerido para almacenar el informe técnico en la cola de sincronización offline (`outbox`) y preservar la trazabilidad local hasta confirmar su recepción en el servidor.
- **Geolocalización (GPS):** Opcional (captura no bloqueante con tiempo máximo de espera de 3 segundos) para asociar coordenadas al hito de cierre en `mision_hito`. Si el usuario deniega el permiso de ubicación en el navegador móvil, el informe técnico se envía igualmente sin bloquear el cierre.
- **Cámara / Archivos:** Reservado para el adjunto de evidencia fotográfica (integración H43). Para habilitar ubicación o cámara en navegadores móviles (Chrome/Safari), revise la configuración de permisos del sitio en el icono de candado de la barra de direcciones.

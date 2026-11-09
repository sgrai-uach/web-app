# Manual de Usuario: Rechazo Motivado de Misión en Terreno (H69)

**Historia de Usuario:** H69 — Rechazo motivado de asignación de misión de verificación  
**Rol Operativo:** Patrulla Verificadora  
**Aplicación:** SGRAI — Cliente Móvil de Terreno (PWA) — Municipalidad de Valdivia  
**Normativa Operativa Asociada:** *Toda cuadrilla o patrulla que rechace una misión táctica debe ingresar una justificación obligatoria (mínimo 5 caracteres).*

---

## 1. Propósito

Este manual describe el procedimiento para que la **Patrulla Verificadora**, al recibir un despacho o asignación de misión táctica en terreno, pueda rechazarla de forma motivada cuando se presenten impedimentos insalvables (desperfecto mecánico en el vehículo institucional, corte total de ruta por anegamiento/derrumbe o concurrencia a una emergencia prioritaria de riesgo vital).

El rechazo documentado garantiza:
1. Liberación inmediata de la patrulla verificadora, quedando en estado **`DISPONIBLE`**.
2. Retorno automático del incidente al estado **`REPORTADO`** para que el Centro de Mando pueda reasignarlo a otra unidad disponible sin pérdida de tiempo de respuesta.
3. Registro de auditoría con la justificación técnica y coordenadas GPS capturadas al momento del rechazo.

---

## 2. Permisos de Hardware y Requisitos Previos

Para operar el módulo de rechazo en la PWA se requieren las siguientes condiciones:

1. **Sesión Activa:** El funcionario debe haber iniciado sesión con el rol `PATRULLA_VERIFICADORA` y su unidad debe estar operativa (`unidadActiva: true`).
2. **Permiso de Ubicación (GPS):**
   - El navegador móvil solicitará autorización para acceder a la ubicación.
   - Si se otorga el permiso, la PWA adjuntará automáticamente la latitud y longitud GPS del vehículo al momento de fundamentar el rechazo.
   - Si el GPS está desactivado o sin señal en cañones urbanos, el sistema permitirá registrar el rechazo sin bloquear al operador.
3. **Misión en Estado Despachada o Asignada:**
   - La opción de rechazo está disponible mientras la misión se encuentre en estado `DESPACHADA`, `ASIGNADA` o `PENDIENTE`, antes de iniciar el desplazamiento o faena.

---

## 3. Instrucciones Paso a Paso

1. Ingrese a la bandeja de misiones de terreno (`/patrulla/misiones`) o pulse sobre la tarjeta de despacho en la pantalla principal.
2. Seleccione la misión táctica asignada para abrir el detalle operativo (`/patrulla/misiones/[id]`).
3. Revise la dirección, tipo de incidente e instrucciones de trabajo.
4. Si la patrulla no puede acudir al lugar:
   - Desplácese hasta la sección inferior **"Acciones Operativas de Despacho"**.
   - Presione el botón rojo de altura táctil adaptada: **"Rechazar Misión"** (diseñado con esquinas rectas y altura mínima de 48px para manipulación con una mano o guantes).
5. Se desplegará el modal obligatorio **"Rechazar Misión de Verificación"**:
   - Lea la advertencia sobre la obligatoriedad de fundamentar técnicamente el rechazo.
   - En el campo **"Motivo del Rechazo"**, redacte la causa fundada (ejemplo: *Desperfecto mecánico en radiador de camioneta institucional*).
   - Observe el contador de caracteres en tiempo real:
     - Si ingresa menos de 5 caracteres útiles (después de remover espacios en blanco), el contador se mostrará en color de alerta y el botón de confirmación permanecerá **deshabilitado**.
     - Al alcanzar o superar los **5 caracteres mínimos**, el indicador se tornará verde y el botón principal **"Confirmar Rechazo"** quedará activo.
6. Presione el botón **"Confirmar Rechazo"**.
7. La aplicación procesará la transacción:
   - Si está conectado a la red, la misión transicionará de inmediato a `RECHAZADA` y se emitirá la alerta en tiempo real al Centro de Mando.
   - La pantalla mostrará una confirmación en verde y desplegará el distintivo permanente de **"Misión Rechazada por Patrulla Verificadora"** con el motivo registrado.

---

## 4. Comportamiento sin Conexión (Modo Offline-First)

Debido a la geografía y topografía de la comuna de Valdivia (sectores rurales, borde costero, islas o túneles de sombra celular), la aplicación de terreno está construida bajo la arquitectura **Offline-First**:

1. **Rechazo en Zona Sin Cobertura Celular:**
   - Si la patrulla intenta rechazar una misión mientras el dispositivo carece de conexión (o la red 4G/5G es inestable):
     1. La aplicación valida localmente la justificación contra el esquema Zod (exigiendo estrictamente $\ge 5$ caracteres).
     2. El rechazo se almacena en la cola local segura de **IndexedDB** (`outbox`) bajo la mutación `RECHAZAR_MISION`.
     3. La base de datos local actualiza de inmediato el estado de la misión a **`RECHAZADA`**, liberando a la patrulla en la interfaz para no bloquear su operación.
     4. Se despliega un banner informativo: *"Sin conexión estable. Rechazo guardado localmente para envío diferido"*.
2. **Indicador de Sincronización:**
   - La barra superior persistente (`ConnectionStatusBadge`) cambiará a:
     > **Sincronizando (1 pendiente)...** (o color carbón *Trabajando offline*).
3. **Restablecimiento de Cobertura Celular:**
   - Tan pronto el dispositivo móvil detecte conectividad a Internet:
     - El servicio de fondo (`useConnectivity` / `sincronizarColaOutbox`) enviará automáticamente la petición `POST /api/misiones/{id}/rechazar` con el token JWT activo.
     - Tras recibir confirmación exitosa (`200 OK`), la acción se purga del outbox local y el distintivo de cabecera vuelve a **"Sincronizado"**.

---

## 5. Eventos y Coordinación con el Centro de Mando

Al registrarse el rechazo (de forma inmediata online o al sincronizarse la cola offline), la API ejecuta en una sola transacción atómica:

- **Misión:** Actualizada a `RECHAZADA` con la justificación persistida en bitácora.
- **Patrulla:** Mantenida o transicionada a `DISPONIBLE` para recibir nuevas asignaciones.
- **Incidente:** Revertido a `REPORTADO` en el tablero Kanban del Centro de Mando.
- **WebSockets emitidos a salas de monitoreo:**
  - `mision:rechazada` hacia la sala de encargados y supervisores.
  - `incidente:actualizado` para mover la tarjeta en vivo de vuelta a triage de despacho.
  - `patrulla:actualizada` para refrescar el mapa operativo de telemetría.


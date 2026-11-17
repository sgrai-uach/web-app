# Manual de Usuario: Notificación de Misión Asignada a Patrulla en Terreno y Trazabilidad de ACK (H35)

**Historia de Usuario:** HU-35 — Notificación de misión asignada a patrulla en terreno y trazabilidad de ACK  
**Rol:** Patrulla Verificadora  
**Aplicación:** SGRAI — PWA Terreno (`/terreno`)  

---

## 1. Propósito

Este manual documenta el procedimiento operativo para la recepción, notificación en tiempo real y confirmación de acuse de recibo de misiones despachadas a patrullas verificadoras de la Dirección de Gestión de Riesgos de Desastres de la Municipalidad de Valdivia.

El módulo provee una alerta flotante de alto contraste con señalética sensorial (bitono sonoro y vibración háptica) optimizada para la operación a una mano y con guantes en condiciones climáticas adversas de terreno. Garantiza la trazabilidad inmediata del ciclo de vida de la orden hacia la Central de Operaciones mediante acuses técnicos automáticos (`RECIBIDA`) y operativos (`LEIDA`), incluso en escenarios de conectividad celular intermitente o modo avión.

---

## 2. Requisitos Previos y Permisos de Hardware

### 2.1. Credenciales y Rol Institucional

- El usuario debe haber iniciado sesión con una cuenta activa que posea el rol **Patrulla Verificadora** (`PATRULLA_VERIFICADORA`) y el permiso **`misiones:terreno:verificar`**.
- La patrulla asignada al operador debe encontrarse activa en el sistema.

### 2.2. Permisos de Sonido y Reproducción en el Navegador Móvil

Para que el bitono de emergencia suene en el dispositivo móvil al recibir una misión:

1. **Google Chrome / Microsoft Edge (Android):**
   - Al ingresar por primera vez a la aplicación, pulse el icono de candado o configuración del sitio en la barra de direcciones.
   - En **Permisos del sitio**, verifique que el permiso de **Sonido** se encuentre en **Permitir**.
   - Se requiere haber interactuado al menos una vez con la pantalla (un toque o pulsación al iniciar sesión) para que las políticas de reproducción automática (Autoplay Policy) de los navegadores permitan la síntesis de audio de alta prioridad.
2. **Safari (iOS / iPadOS):**
   - Asegúrese de que el interruptor lateral de silencio del dispositivo no esté activado.
   - Al instalar la aplicación en la pantalla de inicio mediante **"Compartir" > "Agregar al inicio"**, los permisos de audio quedan habilitados de forma nativa para la sesión de trabajo.

### 2.3. Soporte de Vibración Háptica

- La vibración no requiere permisos especiales en el navegador, pero depende de que el dispositivo móvil no tenga desactivada la vibración del sistema o el modo "No Molestar".
- La aplicación emitirá automáticamente el patrón táctil estandarizado: 300 ms de vibración, 150 ms de pausa, 300 ms de vibración, 150 ms de pausa y 450 ms de vibración final.

---

## 3. Instrucciones de Operación Paso a Paso

### 3.1. Recepción en Tiempo Real de la Orden Táctica

1. Mantenga abierta la aplicación PWA en el dispositivo de terreno mientras su unidad esté en estado disponible o de guardia.
2. En el momento en que el Encargado del Centro de Mando despacha una orden de verificación a su patrulla, el cliente conectado a la sala operativa `patrulla:{patrullaId}` procesa el evento en segundo plano.
3. De forma inmediata y sin requerir ninguna acción del usuario:
   - El sistema emite automáticamente el **Acuse Técnico (`RECIBIDA`)** hacia el servidor central. En la Central de Operaciones, el estado de despacho de la patrulla cambia instantáneamente de `ENVIADA` a `RECIBIDA` (confirmando que el móvil tiene señal y recibió la orden).
   - La orden de trabajo se almacena en la base de datos local del teléfono (`IndexedDB`) para asegurar su disponibilidad offline.
   - Se dispara la secuencia de alerta sonora (bitono sintetizado de 880 Hz a 1174 Hz) y el patrón de vibración háptica en el dispositivo.
   - Aparece un **Banner Flotante de Misión** en la parte superior de la pantalla.

### 3.2. Visualización de Antecedentes en el Banner de Alerta

El banner flotante presenta un diseño plano de alto contraste con esquinas rectas y contiene los siguientes datos clave:

- **Indicador de Prioridad:** Chip rectangular destacado en color sólido (`CRÍTICA` en rojo oscuro, `ALTA` en rojo carmesí, `MEDIA` en naranja ámbar o `BAJA` en azul petróleo).
- **Código Oficial de Misión:** Identificador táctico institucional (ej. `MIS-2026-0042`).
- **Folio de Incidente Asociado:** Número de folio visible (ej. `Folio: FOL-1042`).
- **Tipología de Afectación:** Título descriptivo de la emergencia (ej. `Inundación por desborde de estero` o `Caída de árbol sobre calzada`).
- **Dirección o Sector:** Punto geográfico o calle de concurrencia en la comuna de Valdivia.
- **Hora de Despacho:** Marca temporal en formato chileno de 24 horas (ej. `Despachado: 10/11/2026 14:30 hrs`).

### 3.3. Acciones del Operador

Los botones interactivos del banner cuentan con un tamaño táctil mínimo de 48x48 píxeles (`min-height: 48px`, `min-width: 48px`), permitiendo su accionamiento seguro con guantes de rescate o en movimiento:

- **Botón "Ver Misión":**
  1. Presione el botón verde menta con borde oscuro institucional.
  2. La aplicación emite inmediatamente el **Acuse de Lectura Operativa (`LEIDA`)** hacia el servidor, informando a la Central que el patrullero leyó la orden.
  3. El banner se cierra automáticamente y la pantalla redirige a la vista de detalle de la misión (`/patrulla/misiones/[id]`), donde el líder puede aceptar la salida y revisar el mapa de acceso.
- **Botón "Cerrar":**
  1. Presione el botón secundario para ocultar temporalmente la alerta emergente sin navegar.
  2. La orden permanecerá registrada y accesible en la pestaña **Misiones** de la barra inferior de navegación.

---

## 4. Comportamiento sin Conexión (Modo Offline)

### 4.1. Recepción en Zonas de Sombra Celular o Modo Avión

Si el Centro de Mando emite una orden de verificación mientras la patrulla transita por zonas rurales, cuencas o sectores sin señal celular:

1. El servidor central registra la notificación en estado **`PENDIENTE_ENVIO`**. En el monitor de la Central, los operadores visualizan que el equipo móvil se encuentra temporalmente fuera de línea.
2. El dispositivo móvil no recibe el evento WebSocket en tiempo real debido a la falta de conectividad.

### 4.2. Reconciliación Automática al Recuperar Cobertura

En cuanto el dispositivo móvil recupera señal celular (4G, 5G o enlace WiFi):

1. El sistema detecta el retorno de la red mediante el evento de conectividad del navegador y la reconexión del WebSocket.
2. La aplicación invoca de forma automática en segundo plano la consulta de reconciliación `GET /api/terreno/misiones/pendientes`.
3. Para cada asignación que haya ocurrido durante el periodo de desconexión y que aún no haya sido visualizada en el teléfono:
   - Se almacena la orden completa en la base de datos local `IndexedDB`.
   - Se emite de inmediato el acuse técnico `RECIBIDA` al servidor central, actualizando el tablero de monitoreo de la Central para indicar que la patrulla ha vuelto a estar en línea y ha tomado conocimiento técnico de la orden.
   - Se activa la alerta sonora y vibración en el móvil.
   - Se despliega el banner flotante con todos los antecedentes para que el operador no pierda ninguna misión asignada durante el corte de señal.

### 4.3. Resiliencia de la Cola de Salida (Outbox)

Si durante la emisión del acuse de recibo técnico o de lectura la señal celular experimenta un microcorte transitorio:

- El sistema no descarta la confirmación: encola la mutación en la tabla `outbox` de IndexedDB con tipo `ACK_NOTIFICACION`.
- El componente `ConnectionStatusBadge` en la cabecera indicará el estado de sincronización pendiente.
- Al restablecerse el enlace, la cola local reintenta automáticamente el envío del acuse mediante el endpoint REST idempotente `PATCH /api/terreno/notificaciones/[id]/estado`.
- Dado que el endpoint es estrictamente idempotente, si la Central ya había registrado el estado, responderá exitosamente sin generar duplicados ni alterar marcas temporales previas.

---

## 5. Relación con Otros Repositorios

- **`sgrai-api`:** Administra el ciclo de vida de la notificación en base de datos (`PENDIENTE_ENVIO` $\to$ `ENVIADA` $\to$ `RECIBIDA` $\to$ `LEIDA`), emite los eventos `mision:asignada` a la sala `patrulla:{patrullaId}` y procesa los acuses mediante el handler de WebSocket `notificacion:ack` o el endpoint REST `PATCH /api/terreno/notificaciones/[id]/estado`.
- **`sgrai-web`:** En el Centro de Mando del Encargado y en el tablero Kanban operativo, escucha el evento en tiempo real `notificacion:trazabilidad_actualizada` para desplegar el badge de trazabilidad del despacho correspondiente (`PENDIENTE_ENVIO`, `ENVIADA`, `RECIBIDA`, `LEIDA`), asegurando que la Central sepa en todo momento si la patrulla cuenta con señal y si leyó la orden de servicio.


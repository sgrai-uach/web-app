# Manual de Usuario — Solicitar Apoyo Adicional en Terreno (HU-44)

## 1. Propósito

Este manual describe el protocolo operativo mediante el cual el **Delegado de Cuadrilla** (`DELEGADO_CUADRILLA`) solicita apoyo adicional de recursos materiales, maquinaria o personal humano desde la aplicación móvil de terreno (`sgrai-pwa`) mientras ejecuta una faena activa (`EN_CURSO`), alertando de inmediato al Centro de Mando (sala `encargado`) sin interrumpir ni finalizar la misión en curso.

---

## 2. Requisitos Previos y Permisos RBAC

- **Rol:** `DELEGADO_CUADRILLA`.
- **Permiso requerido:** `reportes:crear` (habilitado para el perfil Delegado de Cuadrilla).
- **Estado de la misión:** La misión debe encontrarse en curso (`En curso`) y asignada a la cuadrilla operativa del funcionario autenticado.

---

## 3. Paso a Paso en Terreno

1. **Abrir el detalle de la faena en curso:**
   - Desde la bandeja **Faenas** (`/cuadrilla/misiones`), seleccione la misión activa en estado **En curso**.
   - Desplácese hasta la sección **Gestión Técnica de Faena** y abra el bloque desplegable **Solicitar Apoyo Adicional**.
2. **Marcar el requerimiento de apoyo adicional:**
   - Active la casilla de verificación destacada **Requiere apoyo adicional**.
   - Automáticamente se desplegará el formulario condicional para especificar las necesidades de refuerzo.
3. **Detallar las necesidades de apoyo:**
   - **Detalle de apoyo requerido (obligatorio, mínimo 5 caracteres):** Especifique con claridad los recursos materiales o humanos requeridos (por ejemplo: *"Se solicita motoniveladora y cuadrilla adicional de despeje"*).
   - **Contexto breve de la faena (opcional):** Agregue antecedentes operativos breves si ayudan a priorizar el despacho.
   - **Observaciones adicionales (opcional):** Indique rutas de acceso, restricciones viales o consideraciones de seguridad para los refuerzos.
4. **Enviar la solicitud:**
   - Pulse **Enviar Solicitud de Apoyo**.
   - El sistema mostrará la confirmación de que la central logística y de operaciones fue alertada, desplegará el indicador **Apoyo Solicitado** en el historial de la misión y emitirá una alerta prioritaria en tiempo real hacia el Centro de Mando.
   - La misión permanecerá en estado **En curso** para que la cuadrilla continúe trabajando sin interrupciones mientras llegan los refuerzos.

---

## 4. Comportamiento sin Conexión

- Si el dispositivo pierde cobertura celular o Wi-Fi en terreno:
  1. El formulario valida localmente que la casilla **Requiere apoyo adicional** esté marcada y que **Detalle de apoyo requerido** tenga al menos **5 caracteres**.
  2. Al pulsar **Enviar Solicitud de Apoyo**, la solicitud no se pierde ni bloquea la faena: se almacena localmente en `IndexedDB` (`solicitudesApoyoLocales`) y se encola en `outbox` bajo el tipo `SOLICITAR_APOYO`.
  3. El historial mostrará la etiqueta **Pendiente de sincronizar** y el badge superior (`ConnectionStatusBadge`) indicará el contador de acciones pendientes.
  4. Al restablecerse la señal, `useConnectivity` enviará automáticamente la solicitud a `POST /api/misiones/{id}/apoyo`, actualizará el estado a **Apoyo Solicitado** y notificará al Centro de Mando sin intervención manual.

---

## 5. Permisos del Dispositivo

- **Almacenamiento local (`IndexedDB` / `SessionStorage`):** Requerido para almacenar el historial local de solicitudes y encolar peticiones `SOLICITAR_APOYO` en ausencia de red.
- **Ubicación GPS (Geolocalización):** Utilizado de forma continua por la telemetría de misión activa (HU-70) y para el reporte de llegada (HU-42); no bloquea el envío de solicitudes de apoyo adicional.
- **Cámara y Archivos:** Requerido únicamente si la cuadrilla complementa la solicitud adjuntando fotografías o videos en el módulo **Evidencia Multimedia** (HU-43).

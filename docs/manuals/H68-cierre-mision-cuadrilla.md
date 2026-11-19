# Manual de Usuario — Cierre de Misión e Informe Técnico Final de Cuadrilla (HU-68)

## 1. Propósito

Este manual describe cómo el **Delegado de Cuadrilla** (`DELEGADO_CUADRILLA`) completa y envía desde la aplicación móvil de terreno (`sgrai-pwa`) el **Informe Técnico Final de Cuadrilla** al concluir una faena operativa en curso (`EN_CURSO`), liberando automáticamente a la cuadrilla a estado **Disponible** y descontando del inventario municipal los materiales e insumos consumidos.

---

## 2. Requisitos Previos y Permisos RBAC

- **Rol:** `DELEGADO_CUADRILLA`.
- **Permisos requeridos:**
  - `misiones:terreno:ejecutar`: habilita la sección **"Gestión Técnica de Faena"** y el envío a `POST /api/misiones/{id}/cerrar`.
  - `recursos:leer`: permite consultar el catálogo de insumos consumibles (`GET /api/recursos`).
  - `reportes:crear`: permite adjuntar fotografías, videos y documentos PDF en la sección **"Evidencia Multimedia"** (HU-43).
- **Estado de la misión:** La misión debe encontrarse activa (`En curso`) y la cuadrilla debe estar operativa.

---

## 3. Paso a Paso en Terreno

1. **Ingresar al detalle de la faena activa:**
   - Desde la bandeja **Misiones** (`/cuadrilla/misiones`), seleccione la misión en estado **En curso** (por ejemplo, `INC-2026-0004`).
2. **Adjuntar evidencia multimedia (opcional, HU-43):**
   - En la tarjeta **Evidencia Multimedia**, utilice **Tomar Foto**, **Grabar Video** o **Subir Archivo** para respaldar visualmente los trabajos realizados.
   - Las fotografías cargadas durante la misión se reflejan de inmediato en el Centro de Mando y quedan vinculadas automáticamente al informe técnico final al cerrar la misión.
3. **Completar el formulario "Finalizar Misión e Informe Técnico":**
   - **1. Resumen de Faenas Ejecutadas (obligatorio):** Describa las labores técnicas ejecutadas por la cuadrilla con un mínimo de **15 caracteres**.
   - **2. Horas Hombre y Estado del Terreno (obligatorios):**
     - Ingrese las **Horas Hombre Invertidas** (`> 0` y `<= 1000`) usando los botones `-` / `+` (pasos de `0.5 h`), el campo numérico o los atajos rápidos (`1 h`, `2 h`, `4 h`, `8 h`).
     - Seleccione el **Estado Final del Terreno** (`Finalizado`, `Controlado`, `Estable`, `Requiere seguimiento`, `Crítico` o `Inaccesible`).
   - **3. Materiales e Insumos Consumidos (opcional):**
     - Pulse **Agregar material consumido** para declarar insumos gastados en la faena (ej. *Sacos de Arena de Contención Fluvial*).
     - Los vehículos y equipos individuales retornables (ej. camionetas o motobombas) se liberan automáticamente y no requieren declararse como consumo.
   - **4. Observaciones, Daños y Escalamientos (opcional):**
     - Registre daños materiales estimados u observaciones generales.
     - Active los interruptores si la emergencia **Requiere apoyo adicional o seguimiento operativo** o **Requiere Asistencia Social (Levantamiento Ficha FIBE)**.
   - **5. Evidencia Multimedia Vinculada:**
     - Verifique el resumen de archivos sincronizados y en cola offline que se asociarán al informe.
4. **Confirmar y finalizar la misión:**
   - Pulse **Finalizar Misión e Informe Técnico**.
   - Revise el resumen en el modal **Confirmar Cierre de Misión e Informe Técnico** y pulse **Confirmar y Finalizar Misión**.
   - La misión pasará a **Finalizada**, la cuadrilla quedará **Disponible** para un nuevo despacho y el incidente permanecerá en evaluación del Encargado en el Centro de Mando para su cierre formal (HU-86).

---

## 4. Comportamiento sin Conexión (Offline-First)

- Si el dispositivo pierde señal de datos móviles o Wi-Fi durante la faena:
  1. El formulario valida localmente todos los campos con el mismo esquema técnico.
  2. Al confirmar el cierre, la misión cambia de inmediato a estado **Finalizada** en el dispositivo con el indicador **Pendiente de sincronizar** y la acción `CERRAR_FAENA` queda almacenada en la cola local IndexedDB (`outbox`).
  3. Al recuperar conectividad, el sincronizador automático drena primero cualquier fotografía o video pendiente (`SUBIR_EVIDENCIA`), resuelve sus identificadores definitivos (`UUID`) y envía a continuación el cierre de misión (`POST /api/misiones/{id}/cerrar`) sin intervención manual del operador.

---

## 5. Permisos del Dispositivo

- **Almacenamiento local (IndexedDB y LocalStorage):** Requerido para resguardar el borrador, el catálogo de insumos (`recursos_inventario`) y la cola de sincronización offline (`outbox`).
- **Ubicación GPS (Geolocalización):** Opcional y no bloqueante (tiempo máximo de espera de 3 segundos). Si el operador concede permiso, las coordenadas se adjuntan al hito de cierre `MISION_COMPLETADA`; si se deniega o no hay señal satelital, el cierre se procesa sin bloqueo.
- **Cámara y Archivos (HU-43):** Opcional, utilizado únicamente al capturar fotografías, videos o adjuntar documentos PDF de respaldo.

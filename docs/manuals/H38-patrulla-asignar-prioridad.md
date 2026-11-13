# Manual de Usuario: Evaluar Terreno y Asignar o Modificar Prioridad de Incidente (H38)

**Historia de Usuario:** H38 — Asignar o modificar la prioridad del incidente basándose en la sugerencia del sistema y la evaluación técnica en terreno  
**Rol:** Patrulla Verificadora  
**Aplicación:** SGRAI — PWA Terreno (`/patrulla/misiones/[id]`)

---

## 1. Propósito

Este manual describe el procedimiento operativo mediante el cual la **Patrulla Verificadora** releva las condiciones de afectación familiar, habitacional y de peligro activo en el sitio de la emergencia, obtiene en tiempo real la **Prioridad Sugerida por el Sistema** y confirma o modifica fundadamente la prioridad oficial del incidente (`BAJA`, `MEDIA`, `ALTA` o `CRITICA`), enviando el reporte técnico versionado al Centro de Mando.

---

## 2. Requisitos Previos y Precondiciones

1. **Sesión Autenticada y Permiso RBAC:**
   - El funcionario debe encontrarse autenticado con el rol **`PATRULLA_VERIFICADORA`** y contar con el permiso **`misiones:terreno:verificar`**.
   - La unidad de patrulla debe encontrarse activa en servicio.
2. **Misión Aceptada (`EN_CURSO`):**
   - La patrulla debe haber aceptado previamente la misión de verificación (H36). El panel **Formularios de Reporte Técnico** se habilita únicamente cuando la misión está en curso.

---

## 3. Matriz de Evaluación de Prioridades en Terreno

El formulario de evaluación calcula de forma reactiva la `prioridadSugerida` y detalla los `factoresGatillantes` según la siguiente matriz técnica:

| Nivel de Prioridad | Criterios y Factores Gatillantes Constatados en Terreno |
|---|---|
| **Crítica (`CRITICA`)** | • Personas electrodependientes afectadas (`> 0`).<br>• Necesidad de evacuación inmediata del sector.<br>• Vivienda con compromiso **Grave / Inhabitable**.<br>• Peligro activo eléctrico, riesgo de colapso estructural/derrumbe o riesgo químico/sanitario. |
| **Alta (`ALTA`)** | • Personas con discapacidad (`> 0`) o adultos mayores (`> 0`) afectados.<br>• Presencia de 2 o más niños en el grupo afectado.<br>• Aislamiento vial o corte de ruta de acceso.<br>• Vivienda con daño **Moderado**, 3 o más viviendas afectadas, o núcleo familiar de 6 o más integrantes. |
| **Media (`MEDIA`)** | • Núcleo familiar afectado (`1 a 5` integrantes) o presencia de 1 niño.<br>• Vivienda afectada con daño **Leve** o mascotas afectadas (`> 0`).<br>• Solicitud de asistencia social (levantamiento FIBE) o apoyo táctico adicional. |
| **Baja (`BAJA`)** | • Sin personas vulnerables, sin daños habitacionales (`Sin daño`) ni peligros activos constatados en el lugar. |

---

## 4. Instrucciones Paso a Paso

1. Ingrese al detalle de la misión activa (`/patrulla/misiones/[id]`).
2. Diríjase a la tarjeta **Formularios de Reporte Técnico** y abra la sección desplegable **Evaluación en terreno y prioridad** (ubicada junto a **Categorización del incidente**).
3. **Paso 1 — Grupo Familiar y Viviendas Afectadas:**
   - Utilice los botones táctiles `-` y `+` (48px × 48px) para registrar:
     - Tamaño del núcleo familiar afectado
     - Cantidad de niños
     - Adultos mayores
     - Personas con discapacidad
     - Personas electrodependientes
     - Mascotas afectadas
     - Viviendas afectadas
   - Seleccione el **Nivel de compromiso de vivienda** (`Sin daño habitacional`, `Daño leve`, `Daño moderado` o `Grave / Inhabitable`).
4. **Paso 2 — Peligros Activos y Requerimientos:**
   - Active los interruptores táctiles (`Sí` / `No`) correspondientes a las amenazas presentes en el punto (`Riesgo eléctrico activo`, `Riesgo estructural / derrumbe`, `Riesgo químico o sanitario`, `Requiere evacuación inmediata`, `Aislamiento vial`, `Requiere asistencia social (FIBE)`, `Requiere apoyo táctico adicional`).
5. **Paso 3 — Revisión de Prioridad Sugerida y Selección Canónica:**
   - Observe el recuadro **Prioridad Sugerida por el Sistema**, que exhibe el nivel calculado (`Baja`, `Media`, `Alta` o `Crítica`) junto con el listado de **factores gatillantes**.
   - En el selector táctil de cuatro niveles, la prioridad sugerida se encuentra pre-seleccionada por defecto.
   - **Si ratifica la prioridad sugerida:** No es necesario ingresar justificación adicional.
   - **Si decide modificar la prioridad sugerida:** Seleccione el nivel deseado (`Baja`, `Media`, `Alta` o `Crítica`). Se desplegará obligatoriamente el campo **Justificación técnica del cambio de prioridad**, donde debe ingresar al menos **5 caracteres** explicando el fundamento técnico en terreno.
6. **Paso 4 — Detalles Adicionales y Confirmación:**
   - Opcionalmente, complete el campo **Detalles adicionales del reporte** con referencias operativas para el Encargado del Centro de Mando.
   - Presione **"Confirmar prioridad y enviar reporte"** y verifique el resumen en el modal de confirmación antes de pulsar **"Confirmar y Enviar"**.
7. **Edición y Reenvío Versionado (`Reporte #N+1`):**
   - Una vez enviado el reporte, la sección muestra el **Resumen de Evaluación y Prioridad** con el distintivo `Reporte #1`.
   - Si las condiciones en terreno evolucionan, pulse **"Modificar y reenviar reporte"**. El formulario precargará los datos del último reporte y mostrará el aviso:
     > *"Enviando actualización (Reporte #2) — Los cambios quedarán registrados como un reporte distinto en el Centro de Mando y actualizarán la prioridad del incidente."*

---

## 5. Comportamiento sin Conexión (Modo Offline-First)

1. **Cálculo Reactivo Local Autónomo:**
   - El motor de sugerencia de prioridad y detección de factores gatillantes opera íntegramente en el dispositivo móvil, por lo que el patrullero obtiene la prioridad sugerida en tiempo real incluso sin señal celular.
2. **Encolado en `Outbox` (`IndexedDB`):**
   - Si el operador confirma el reporte sin conexión a internet, el payload se valida con Zod y se almacena en la cola local `outbox` bajo la acción `AJUSTAR_PRIORIDAD` (`PATCH /api/incidentes/{id}/prioridad`).
3. **Actualización Optimista en Pantalla:**
   - El chip de prioridad en la cabecera de la misión y el resumen del reporte (`Reporte #N`) se actualizan de inmediato en el dispositivo, marcando la misión con `sincronizacionPendiente: true`.
   - Se presenta una alerta preventiva indicando que la evaluación fue guardada localmente y el indicador superior `ConnectionStatusBadge` incrementa el contador de envíos pendientes.
4. **Sincronización Automática al Recuperar Red:**
   - Al restablecerse la cobertura de datos, la PWA despacha automáticamente las mutaciones encoladas hacia `sgrai-api`, registrando el hito en `mision_hito` y emitiendo el evento `incidente:actualizado` al Centro de Mando.

---

## 6. Permisos de Hardware Requeridos

- **Almacenamiento Local (`IndexedDB`):** Requerido para persistir los reportes versionados de terreno y la cola de sincronización offline (`outbox`).
- **GPS / Cámara:** No son obligatorios para enviar el cambio de prioridad, aunque complementan la operación general de la misión en terreno (H36, H43, H70).


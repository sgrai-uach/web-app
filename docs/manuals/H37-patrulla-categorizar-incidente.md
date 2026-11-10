# Manual de Usuario: Categorizar o Corregir Tipología de Incidente en Terreno (H37)

**Historia de Usuario:** H37 — Categorizar o corregir la tipología del incidente tras la evaluación presencial en terreno  
**Rol:** Patrulla Verificadora  
**Aplicación:** SGRAI — PWA Terreno (`/terreno/patrulla/misiones/[id]`)

---

## 1. Propósito

Este manual documenta el procedimiento técnico mediante el cual la **Patrulla Verificadora** categoriza, ratifica o reclasifica formalmente la tipología de un incidente tras arribar al lugar y constatar presencialmente la naturaleza real de la emergencia. Este procedimiento permite corregir clasificaciones preliminares imprecisas realizadas por informantes ciudadanos (por ejemplo, reclasificando un aviso ingresado como un anegamiento menor a un desborde de cauce con ingreso de agua a viviendas).

---

## 2. Requisitos Previos y Precondición Operativa

1. **Sesión Autenticada y Permiso RBAC:**
   - El operador debe haber iniciado sesión con credenciales institucionales bajo el rol **`PATRULLA_VERIFICADORA`** y disponer del permiso **`misiones:terreno:verificar`**.
   - La patrulla asignada debe encontrarse activa en el turno de servicio.
2. **Precondición Crítica — Misión Aceptada (H36):**
   - La patrulla **debe haber confirmado previamente su salida a terreno** pulsando **"Aceptar Misión"** (estado de misión `EN_CURSO` y estado de patrulla `EN_VERIFICACION`).
   - Si la misión se encuentra aún en estado **Despachada** (`DESPACHADA`) o la unidad está inactiva, la sección de evaluación técnica permanece bloqueada y no es posible reclasificar tipologías hasta aceptar el despacho.

---

## 3. Criterios Taxonómicos de Clasificación Municipal

El selector de tipología se alimenta directamente del catálogo oficial activo de la Municipalidad de Valdivia (`GET /api/incidentes/tipos?catalogo=true`). Entre las categorías contempladas destacan:

| Categoría Oficial | Alcance Técnico Operativo |
|---|---|
| **Inundación** | Acumulación desmedida de agua por crecida de ríos, esteros o lluvias torrenciales que afecta predios o inmuebles. |
| **Anegamiento de calzada** | Acumulación de aguas lluvia que obstaculiza temporalmente el tránsito vehicular o peatonal sin daño estructural. |
| **Caída de árbol** | Caída o desprendimiento de ramas mayores que obstruyen vías públicas o amenazan tendido eléctrico y techumbres. |
| **Derrumbe / Remoción en masa** | Desprendimiento de ladera, deslizamiento de tierra, fango o socavón que compromete la estabilidad del terreno. |
| **Incendio estructural** | Fuego descontrolado en viviendas, bodegas o recintos comunitarios que requiere apoyo bomberil coordinado. |
| **Desborde de cauce** | Aumento de caudal en esteros, humedales o canales que rebasa el lecho habitual y amenaza infraestructura crítica. |
| **Corte de suministros críticos** | Interrupción masiva de suministro de agua potable, electricidad o vías de conectividad esenciales. |

---

## 4. Instrucciones Paso a Paso

1. Ingrese al detalle de la misión asignada activa (`/terreno/patrulla/misiones/[id]`).
2. Verifique que la misión se encuentre en estado **En curso** (`EN_CURSO`) bajo el panel **En Trayecto / Evaluación**.
3. Desplácese a la cabecera **Formularios de Reporte Técnico** y despliegue la sección **Categorización del incidente**.
4. Revise el campo **Tipo registrado**, que exhibe la categoría asignada actualmente al incidente.
5. En el menú desplegable **Tipo de incidente**:
   - Seleccione la categoría oficial que mejor describe la situación real evaluada en terreno.
   - Debajo del selector se mostrará automáticamente el alcance técnico de la opción elegida para respaldar su decisión.
6. En el campo **Justificación**:
   - Ingrese una descripción fundada explicando las razones operativas y evidencias observadas en terreno para el dictamen o reclasificación.
   - **Regla de validación estricta:** La justificación es de carácter **obligatorio** y debe contener un mínimo de **5 caracteres** (hasta un máximo de 1000 caracteres).
   - El contador dinámico (`X / 1000`) indicará en color verde cuando el texto cumpla la longitud reglamentaria.
7. Presione el botón **"Confirmar tipología"** (área táctil ergonómica $\ge$ 48px).
8. Tras procesarse la acción:
   - La pantalla mostrará una alerta de confirmación: *"Tipología del incidente reclasificada exitosamente en terreno."*
   - La ficha superior de la misión actualizará de inmediato el campo **Tipo** con la nueva categoría técnica.

---

## 5. Comportamiento sin Conexión (Modo Offline-First)

En situaciones de emergencia en sectores rurales o quebradas sin cobertura de red móvil (3G/4G/5G):

1. **Caché Local del Catálogo Oficial:**
   - La PWA descarga y almacena automáticamente el catálogo oficial en el repositorio local seguro del navegador (`IndexedDB` $\rightarrow$ almacén `catalogos`).
   - Al abrir la pantalla sin internet, el selector se puebla fluidamente desde el almacenamiento local sin requerir conexión.
2. **Persistencia en Cola Local (Outbox):**
   - Al pulsar **"Confirmar Tipología"** sin conectividad celular, la aplicación no produce bloqueos ni errores.
   - La mutación se valida mediante esquemas locales Zod y se encola de inmediato en el almacén `outbox` de `IndexedDB` con el tipo `ACTUALIZAR_TIPOLOGIA`, registrando el payload `{ tipoIncidenteId, justificacion, misionId }`.
3. **Actualización Optimista y Alerta Visual:**
   - La tarjeta actualiza optimistamente la tipología local en pantalla y marca la misión con `sincronizacionPendiente: true`.
   - Se despliega una alerta ámbar de estado:
     > *"Tipología guardada localmente. Se sincronizará automáticamente al recuperar la conexión."*
   - El distintivo de cabecera (`ConnectionStatusBadge`) reflejará el incremento de acciones pendientes (ej. *"Trabajando offline (1 pendientes)"*).
4. **Sincronización Automática Diferida:**
   - Al restablecerse la conectividad a internet, el sincronizador en segundo plano despacha automáticamente la petición `PATCH /api/incidentes/{id}/tipologia` hacia el servidor.
   - El servidor registra el hito oficial en `mision_hito`, emite la alerta en tiempo real al puesto de mando y la PWA limpia la tarea de la cola outbox, cambiando el distintivo a **"Sincronizado"**.

---

## 6. Permisos de Hardware Requeridos

- **Acceso a Red / Almacenamiento Local:** Requiere almacenamiento en navegador habilitado para `IndexedDB` (utilizado para el catálogo y la cola diferida outbox).
- **GPS / Cámara:** No requeridos directamente para la selección de tipología, pero disponibles en la misma vista de evaluación para georreferenciación y adjuntos de evidencia fotográfica (H43).

---

## 7. Integración con el Sistema Central

- **`sgrai-api`:** Valida la existencia y vigencia del tipo en base de datos, corrobora que la misión esté `EN_CURSO`, actualiza `incidente.tipo_incidente_id` y registra en `mision_hito` el evento:  
  *`"Tipología reclasificada en terreno a: [Nombre del Tipo]. Justificación: [Texto]"`*.
- **`sgrai-web` (Centro de Mando / Encargado):** Al ejecutarse la reclasificación, el backend emite a la sala `sala:encargados` el evento WebSocket `incidente:actualizado`. La tarjeta del incidente en el tablero Kanban del Encargado actualiza de inmediato su etiqueta de tipología sin necesidad de refrescar la página.


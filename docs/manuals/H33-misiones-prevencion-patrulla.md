# Manual de Usuario: Recepción y Ejecución de Misiones Preventivas en Terreno (H33)

**Historia de Usuario:** H33 — Asignación de patrullas y recursos logísticos a eventos programados de prevención comunal  
**Rol:** Patrulla Verificadora  
**Aplicación:** SGRAI — PWA Terreno (`/patrulla/misiones`, `/patrulla/misiones/[id]`)

---

## 1. Propósito

Este manual describe el procedimiento operativo mediante el cual el personal de una **Patrulla Verificadora** recibe, inspecciona y acepta una misión de **Prevención Territorial** (`tipo_mision = 'PREVENCION'`) despachada directamente sobre un punto crítico comunal o evento preventivo programado, **sin existencia de incidente previo** (regla de negocio §3.4), visualizando además los insumos a granel y activos individuales asignados a su despliegue.

---

## 2. Requisitos Previos y Permisos de Hardware

1. **Cuenta y Permiso RBAC Habilitado:**
   - Sesión activa bajo el rol **`PATRULLA_VERIFICADORA`** y permiso **`misiones:terreno:verificar`** para aceptar la misión preventiva.
   - Patrulla asignada activa (`unidadActiva: true`). Al recibir una asignación vía H33, el estado operativo de la patrulla pasa en el Centro de Mando a **`EN_PREVENCION`**.
2. **Permisos del Dispositivo (GPS / Cámara / Notificaciones):**
   - **Ubicación (GPS) en navegador móvil:** Al presionar **"Aceptar Misión"**, o mientras la operación se encuentra en curso para telemetría en vivo (H70) y centrado en mapa, Chrome/Safari/Edge solicitarán acceso a la ubicación del dispositivo. Se debe seleccionar **"Permitir mientras la app está en uso"**. Si el GPS demora más de 5 segundos o no se otorga permiso, la aceptación no se bloquea y continúa sin coordenadas.
   - **Cámara del dispositivo:** Las misiones preventivas operadas por Patrulla Verificadora no exigen captura fotográfica obligatoria desde el detalle preventivo de la patrulla; si una operación derivada de atención pesada requiere adjuntos multimedia (Delegado de Cuadrilla, H43), se solicitará acceso puntual a la cámara mediante la API de captura del navegador.
   - **Notificaciones y Vibración:** Mantener el navegador habilitado en primer plano o como PWA instalada para recibir la alerta visual (`Misión Preventiva Asignada`) y señal vibratoria en tiempo real al dispararse el evento `prevencion:actualizada`.

---

## 3. Instrucciones Paso a Paso

1. **Recepción de Alerta en Tiempo Real:**
   - Cuando el Centro de Mando asigna la patrulla y recursos logísticos a un evento preventivo (`POST /api/eventos-atp/prevencion/{id}/recursos`), el dispositivo muestra el banner **`Misión Preventiva Asignada`** con el código de misión, código del evento (`Evento: EVP-...`) y resumen de recursos asignados.
   - Presione **"Ver Misión"** para abrir directamente el detalle, o consulte la bandeja **Misiones** (`/patrulla/misiones`) y el bloque **Misiones en atención** en Inicio.
2. **Revisión de Antecedentes Preventivos y Punto Crítico:**
   - En la pantalla `/patrulla/misiones/[id]`, verifique la insignia **`Prevención territorial`**, la prioridad y la dirección o sector asignado.
   - En la tarjeta **`Evento Preventivo y Punto Crítico`**, revise:
     - Código y nombre del evento programado y delegación municipal responsable.
     - Código y nombre del **punto crítico monitoreado**, amenaza recurrente y descripción de vulnerabilidad.
     - Botón **"Ver punto crítico en mapa"** (si hay coordenadas PostGIS disponibles) para consultar la ubicación exacta.
3. **Revisión de Recursos Logísticos Trazados a la Misión:**
   - En la tarjeta **`Recursos Logísticos Asignados`**, revise únicamente los recursos vinculados a su misión (`evento_prevencion_recurso.mision_id`):
     - **Activo individual** (ej. motobombas, generadores): muestra etiqueta técnica y estado operativo (`Asignado`, `Disponible`, etc.).
     - **Insumo a granel** (ej. sacos de arena, rollos de polietileno): muestra cantidad comprometida y unidad de medida, además de alertas como **`Bajo stock`** cuando aplique.
   - Si otras unidades también participan en el mismo evento, un aviso informativo indicará la existencia de recursos asignados a otras misiones del evento sin mezclarlos con la carga propia de su patrulla.
4. **Confirmación de Despliegue Preventivo:**
   - En el bloque **`Confirmación de despliegue preventivo`**, toque el botón de alto contraste **"Aceptar Misión"**.
   - El panel de estado cambiará a **`Operación Preventiva en Curso`** mostrando **`Patrulla: En prevención`**.
   - Conforme a la regla **§3.4** (misión originada directamente sobre evento preventivo sin incidente asociado), **no se desplegarán** formularios de categorización de incidente (H37), ajuste de prioridad (H38) ni dictamen de no abordabilidad (H39). En su lugar se mostrará una nota explicativa.
5. **Perfil Operativo:**
   - En `/perfil`, mientras la patrulla tenga una misión preventiva activa o despachada, junto al estado **`En servicio activo`** se mostrará la etiqueta **`En prevención`**.

---

## 4. Comportamiento sin Conexión

- **Caché Local Automático (`IndexedDB`):**
  - Tanto las misiones sincronizadas como los eventos recibidos en tiempo real mediante Socket.io (`prevencion:actualizada`) se almacenan automáticamente en `IndexedDB` (`misiones` y catálogo local `evento_prevencion_{id}`), permitiendo consultar el evento preventivo, punto crítico y recursos asignados sin cobertura celular.
- **Resiliencia ante Restricciones RBAC o Pérdida de Red:**
  - Si al abrir el detalle no existe conexión a internet o el endpoint extendido `GET /api/eventos-atp/prevencion/{id}` no se encuentra disponible, la aplicación degrada silenciosamente a los datos cacheados desde la notificación en tiempo real y el listado local, sin bloquear la visualización ni expulsar la sesión.
- **Confirmación de Aceptación Offline (`outbox`):**
  - Al presionar **"Aceptar Misión"** sin red, la transición a **`Operación Preventiva en Curso`** se guarda localmente en la cola `outbox` de `IndexedDB`.
  - El indicador persistente **`ConnectionStatusBadge`** en la cabecera mostrará **`Sin conexión / Trabajando offline`** o **`Sincronizando (N pendientes)...`** junto a la barra de aviso pendiente en la tarjeta de estado.
  - Al recuperarse la cobertura de red, el sincronizador enviará automáticamente `POST /api/misiones/{id}/aceptar` en segundo plano y actualizará la cabecera a **`Sincronizado`**. Si el evento había sido pre-cargado solo desde notificación sintética y aún falta sincronización con el catálogo del servidor, la cola resolverá el identificador real al reconectar.

---

## 5. Relación con Otros Repositorios

- **`sgrai-api`:** Expone `POST /api/eventos-atp/prevencion/{id}/recursos` y `GET /api/eventos-atp/prevencion/{id}`, crea la misión `tipo_mision = 'PREVENCION'`, actualiza `evento_prevencion_recurso.mision_id`, transiciona la patrulla a `EN_PREVENCION` y emite `prevencion:actualizada` y `patrulla:actualizada` hacia `patrulla:<id>`.
- **`sgrai-web`:** Permite al Encargado del Centro de Mando programar eventos preventivos, asignar patrullas e insumos con bloqueo transaccional de inventario y monitorear la ejecución en tiempo real.

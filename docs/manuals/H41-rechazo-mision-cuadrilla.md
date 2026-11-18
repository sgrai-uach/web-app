# Manual de Usuario: Rechazo Motivado de Asignación de Misión (H41)

**Historia de Usuario:** H41 — Rechazar asignación de misión con justificación técnica obligatoria  
**Rol Operativo:** Delegado de Cuadrilla  
**Aplicación:** SGRAI — Cliente Móvil de Terreno (PWA) — Municipalidad de Valdivia  
**Normativa Operativa Asociada:** *Todo rechazo de misión asignada exige una justificación técnica obligatoria (mínimo 5 caracteres).*

---

## 1. Propósito

Este manual describe el procedimiento para que el **Delegado de Cuadrilla**, al recibir una solicitud de asignación de misión en terreno, pueda rechazarla de forma motivada ante motivos de fuerza mayor o impedimentos técnicos (falla mecánica o hidráulica de maquinaria/camión, corte de ruta o insuficiencia crítica de dotación).

El rechazo documentado garantiza:
1. Liberación inmediata de la cuadrilla y de toda su dotación activa, retornando a estado **`DISPONIBLE`**.
2. Retorno automático del incidente a estado **`VERIFICANDO`** (si ya fue verificado por patrulla) o **`REPORTADO`** para su reasignación inmediata desde el Centro de Mando.
3. Emisión de alerta prioritaria en tiempo real al Encargado del Centro de Mando y registro del hito **`RECHAZADA`** en bitácora.

---

## 2. Permisos del dispositivo y Requisitos Previos

1. **Sesión Activa y Permiso RBAC:** El funcionario debe haber iniciado sesión con el rol `DELEGADO_CUADRILLA` (permiso `misiones:terreno:ejecutar`) y su cuadrilla debe encontrarse operativa (`unidadActiva: true`).
2. **Estado de la Misión:** La opción **"Rechazar Misión"** únicamente está disponible mientras la misión se encuentre en estado **`DESPACHADA`**.
3. **Permiso de Ubicación (GPS):**
   - Al abrir el modal de rechazo, el navegador móvil solicitará autorización para acceder a la ubicación (Geolocation API).
   - En Android/iOS, seleccione **"Permitir al usar la aplicación"** para adjuntar automáticamente las coordenadas WGS84 (`latitud`, `longitud`) al rechazo.
   - Si el GPS está desactivado o sin cobertura, la aplicación permitirá igualmente registrar el rechazo sin coordenadas para no bloquear la operación en emergencia.

---

## 3. Instrucciones Paso a Paso

1. Ingrese a la bandeja de misiones de cuadrilla (`/cuadrilla/misiones`).
2. Seleccione la misión despachada para abrir su detalle operativo (`/cuadrilla/misiones/[id]`).
3. En la sección **"Acciones de Despacho"**, presione el botón rojo **"Rechazar Misión"** (altura mínima táctil de 48px).
4. En el modal **"Rechazar Asignación de Cuadrilla"**:
   - Ingrese en **"Motivo del Rechazo"** la justificación técnica detallada (mínimo **5 caracteres útiles**). El botón **"Confirmar Rechazo"** permanecerá bloqueado hasta cumplir este mínimo.
   - Verifique el indicador de captura GPS en la parte inferior del formulario.
5. Presione **"Confirmar Rechazo"**. El sistema registrará el rechazo y lo retornará de forma segura a la bandeja de misiones de cuadrilla.

---

## 4. Comportamiento sin conexión

- Si el dispositivo pierde cobertura celular al momento de confirmar el rechazo, el cliente valida localmente la justificación contra el esquema de negocio, marca la misión como **`RECHAZADA`** en el almacenamiento local (`IndexedDB`) y encola la mutación `RECHAZAR_MISION` en la cola de salida (`outbox`).
- El indicador superior (`ConnectionStatusBadge`) mostrará el estado **"Sin conexión"** o **"Sincronizando (N pendientes)"**.
- Al restablecer la conexión de red, la PWA reintentará automáticamente el envío hacia `POST /api/misiones/{id}/rechazar` y actualizará la bandeja local sin intervención del usuario.

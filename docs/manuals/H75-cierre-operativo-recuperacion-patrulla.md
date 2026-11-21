# Manual de Usuario — H75: Seguimiento y Conclusión de Misión de Recuperación (Patrulla Verificadora)

## 1. Propósito

Este manual describe cómo el personal de **Patrulla Verificadora** visualiza en `sgrai-pwa` las misiones de tipo **Recuperación operativa** (`RECUPERACION`) y cómo se refleja automáticamente su conclusión formal cuando el **Encargado** decreta el cierre del operativo desde el Centro de Mando (`sgrai-web`).

> **Nota de rol:** El decreto de conclusión formal del operativo de recuperación y la devolución de insumos al inventario pertenecen exclusivamente al Centro de Mando (`sgrai-web`). La patrulla visualiza el estado operativo en terreno y queda disponible automáticamente al cerrarse el evento.

---

## 2. Flujo Operativo en Terreno

1. **Bandeja de Misiones (`/patrulla/misiones`):**
   - Las misiones de recuperación asignadas a la patrulla aparecen identificadas con el chip **Recuperación operativa** junto al código del evento y su prioridad.
2. **Aceptación de Misión (si se encuentra `Despachada`):**
   - Al ingresar al detalle (`/patrulla/misiones/[id]`), presione **Aceptar Misión** para confirmar salida a terreno.
3. **Ejecución en Terreno (`En curso`):**
   - El detalle muestra la tarjeta **Operativo de recuperación en ejecución**, indicando que la patrulla se encuentra en estado **En recuperación** y que el cierre formal se decreta desde el Centro de Mando.
   - No se despliegan formularios de triage de incidentes (`tipología`, `prioridad` o `reporte de verificación`).
4. **Conclusión Formal (`Finalizada` / `COMPLETADA`):**
   - Cuando el Encargado declara concluido el operativo en `sgrai-web`, `sgrai-api` emite los eventos en tiempo real `mision:actualizada` (`COMPLETADA`) y `patrulla:actualizada` (`DISPONIBLE`) a la sala `patrulla:<id>`.
   - La PWA actualiza automáticamente:
     - El estado de la misión a **Finalizada** (`COMPLETADA`).
     - La tarjeta de resumen **Operativo de recuperación concluido**, confirmando que la patrulla quedó **Disponible para nueva asignación**.
     - Una notificación tipo *toast* informando la conclusión del operativo.
     - Los contadores y la tarjeta **Misiones en atención** en la pantalla de inicio.

---

## 3. Comportamiento sin conexión

- **Visualización en caché local (IndexedDB):** Si la patrulla pierde cobertura celular mientras consulta una misión de recuperación, `sgrai-pwa` mantiene visibles la ficha de misión, su ubicación y el estado operativo guardado localmente.
- **Indicador persistente de red:** La barra superior (`ConnectionStatusBadge`) muestra **Sin conexión / Trabajando offline** (`#3B3F45`).
- **Reconciliación automática al reconectar:** Si el Encargado concluye el operativo mientras la patrulla está desconectada, al restablecerse la conexión celular o regresar a primer plano la aplicación, `sgrai-pwa` sincroniza `GET /api/misiones` / `GET /api/misiones/{id}`, actualiza la misión a **Finalizada** y refleja la disponibilidad de la patrulla.
- **Cola local en aceptación:** Si la patrulla acepta una misión `DESPACHADA` sin conexión, la acción se encola en IndexedDB (`ACEPTAR_MISION`) y se sincroniza automáticamente en orden al recuperar señal.

---

## 4. Permisos del dispositivo

- **Ubicación / GPS (Geolocation API):**
  - Se utiliza de forma no bloqueante al aceptar la misión (`Aceptar Misión`) y para telemetría operativa mientras la misión está `EN_CURSO`.
  - Para autorizarlo en dispositivos móviles (Android / iOS):
    1. Al aparecer el diálogo del navegador *"¿Permitir que el sitio acceda a tu ubicación?"*, seleccione **Permitir mientras se usa la app**.
    2. Si fue denegado previamente, toque el icono de candado/ajustes junto a la barra de direcciones, ingrese a **Permisos > Ubicación** y cámbielo a **Permitir**.
- **Cámara:** No requerida para el seguimiento pasivo de misiones de recuperación en `sgrai-pwa`.

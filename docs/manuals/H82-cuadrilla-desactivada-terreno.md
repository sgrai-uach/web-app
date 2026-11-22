# Manual de Usuario: Consulta Histórica de Cuadrilla Desactivada (H82)

**Historia de Usuario:** H82 — Desactivar cuadrilla operativa y consulta de historial en terreno  
**Rol:** Delegado de Cuadrilla  
**Aplicación:** SGRAI - PWA Terreno (Municipalidad de Valdivia)

---

## 1. Propósito

Describir el comportamiento y la experiencia de usuario en la aplicación móvil de terreno (PWA) cuando una cuadrilla operativa ha sido retirada del servicio activo mediante baja lógica por la Administración Central, permitiendo a sus delegados acceder a la aplicación en **modo histórico de solo lectura** para consultar auditorías y detalles de faenas pasadas, impidiendo nuevas asignaciones o mutaciones operativas.

---

## 2. Permisos del Dispositivo

- **Ubicación GPS:** Desactivada automáticamente al entrar en modo histórico para resguardar la privacidad del personal.
- **Cámara:** Desactivada para nuevas capturas (no se admiten nuevas cargas de evidencia en unidades dadas de baja).

---

## 3. Comportamiento en la Aplicación

1. **Inicio de Sesión:**
   - El delegado de la cuadrilla desactivada puede iniciar sesión normalmente en `/terreno/login` con su RUT o correo institucional.
2. **Banner Persistente de Advertencia:**
   - En la parte superior de la pantalla se despliega de forma permanente el banner institucional de advertencia:
     > **"Cuadrilla Desactivada — [Nombre Unidad]:** Esta unidad ha sido retirada del servicio activo. Se encuentra en modo histórico de solo lectura para consulta de faenas anteriores. No es posible recibir nuevos despachos ni ejecutar acciones operativas."
3. **Restricciones Operativas:**
   - No se reciben despachos de emergencias en tiempo real ni alertas de sonido/vibración.
   - Los botones de acción operativa ("Aceptar Misión", "Llegada con GPS", "Solicitar Apoyo", "Cerrar Faena") se encuentran deshabilitados o no disponibles.
   - Cada faena en el historial muestra la etiqueta informativa de solo lectura.

---

## 4. Comportamiento sin Conexión (Modo Offline)

- **Acceso a Caché Local:** La cuadrilla desactivada puede consultar las faenas e informes guardados previamente en la base de datos local IndexedDB del dispositivo, incluso sin señal celular.
- **Auditoría Local Intacta:** Los registros locales reflejan el estado finalizado de las faenas ejecutadas antes de la disolución de la unidad.

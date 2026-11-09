# Manual de Usuario: Consulta Histórica de Patrulla Desactivada (H85)

**Historia de Usuario:** H85 — Desactivar patrulla verificadora y consulta de historial en terreno  
**Rol:** Patrulla Verificadora  
**Aplicación:** SGRAI - PWA Terreno (Municipalidad de Valdivia)

---

## 1. Propósito

Describir el comportamiento y la experiencia de usuario en la aplicación móvil de terreno (PWA) cuando una patrulla verificadora ha sido retirada del servicio activo mediante baja lógica por la Administración Central, permitiendo a los operadores acceder a la aplicación en **modo histórico de solo lectura** para consultar auditorías de evaluaciones previas, impidiendo la recepción de nuevos despachos o el ajuste de prioridades.

---

## 2. Permisos del Dispositivo

- **Ubicación GPS:** Detenida automáticamente para preservar la privacidad del personal municipal.
- **Cámara:** Desactivada para nuevas capturas.

---

## 3. Comportamiento en la Aplicación

1. **Inicio de Sesión:**
   - El funcionario de la patrulla desactivada puede iniciar sesión en `/terreno/login` utilizando sus credenciales institucionales.
2. **Banner Persistente de Advertencia:**
   - En la parte superior de la pantalla se despliega el banner de advertencia:
     > **"Patrulla Desactivada — [Nombre Unidad]:** Esta unidad ha sido retirada del servicio activo (§3.7 de baja lógica). Se encuentra en modo histórico de solo lectura para consulta de faenas anteriores. No es posible recibir nuevos despachos ni ejecutar acciones operativas."
3. **Restricciones Operativas:**
   - No se reciben alertas de emergencias despachadas (`mision:asignada`).
   - No es posible modificar tipologías ni reclasificar prioridades.
   - Cada misión previa muestra el distintivo de modo solo lectura.

---

## 4. Comportamiento sin Conexión (Modo Offline)

- **Persistencia en IndexedDB:** La información histórica de triage se mantiene disponible localmente en el dispositivo sin necesidad de conexión a Internet.
- **Auditoría Inmutable:** Las evaluaciones e informes emitidos con anterioridad a la baja permanecen inalterables en conformidad a la normativa municipal.

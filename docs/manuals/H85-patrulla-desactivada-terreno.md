# Manual de Usuario: Gestión de Estados Operativos e Historial de Patrullas (H85)

**Historia de Usuario:** H85 — Desactivar patrulla verificadora, alerta de asignación y consulta de historial en terreno  
**Rol:** Patrulla Verificadora / Delegado de Cuadrilla  
**Aplicación:** SGRAI - PWA Terreno (Municipalidad de Valdivia)

---

## 1. Propósito

Describir el comportamiento y la experiencia de usuario en la aplicación móvil de terreno (PWA) ante dos escenarios operacionales clave vinculados al estado de las unidades:

1. **Patrulla Desactivada (Baja Lógica):** La unidad vehicular o patrulla ha sido dada de baja del servicio activo por la Administración Central, permitiendo a los operadores acceder a la aplicación en **modo histórico de solo lectura** para consultar auditorías de evaluaciones previas, impidiendo la recepción de nuevos despachos o el ajuste de prioridades.
2. **Operador Sin Unidad Asignada:** El funcionario cuenta con sesión iniciada pero no tiene una patrulla o cuadrilla asignada en el turno actual, alertándole de manera discreta e informativa sin confundirlo con una baja lógica de unidad.
3. **Historial de Patrullas Asignadas:** Registro persistente en el perfil del operador (`/terreno/perfil`) que preserva la trazabilidad de todas las patrullas en las que ha prestado servicio.

---

## 2. Permisos del Dispositivo

- **Ubicación GPS:** 
  - En patrullas activas: Transmisión periódica durante misiones en curso.
  - En patrullas desactivadas o sin asignación: Detenida automáticamente para preservar la batería y la privacidad del personal municipal.
- **Cámara:** 
  - En patrullas activas: Captura de evidencia multimedia con compresión automática en cliente.
  - En patrullas desactivadas o sin asignación: Inhabilitada para nuevas capturas operativas.

---

## 3. Comportamiento en la Aplicación

### 3.1. Diferenciación de Banners de Estado Operativo

Para evitar confusiones entre personal no asignado y unidades retiradas del servicio, la PWA implementa dos componentes visuales independientes:

| Situación | Componente / Banner | Mensaje Desplegado | Comportamiento |
|---|---|---|---|
| **Sin Patrulla Asignada** | `<SinUnidadBanner />` | *"Sin patrulla asignada: No tienes una patrulla verificadora asignada actualmente. Comunícate con el Centro de Mando o tu supervisor para que te asignen a un móvil operativo."* | Modo neutral informativo, no bloquea navegación, orienta al operador. |
| **Patrulla Desactivada** | `<UnidadInactivaBanner />` | *"Patrulla Desactivada — [Nombre Unidad]: Esta unidad ha sido retirada del servicio activo (baja lógica). Se encuentra en modo histórico de solo lectura para consulta de faenas anteriores. No es posible recibir nuevos despachos ni ejecutar acciones operativas."* | Modo histórico de solo lectura, desactiva recepción de nuevas alertas y formularios de acción. |

### 3.2. Historial de Unidades en el Perfil (`/terreno/perfil`)

En la sección de perfil del operador de terreno se dispone de dos áreas dedicadas:

1. **Asignación Operativa Actual:**
   - Muestra el nombre de la patrulla asignada y su estado actual (`Activa` o `Desactivada`).
   - Si el operador no cuenta con unidad asignada, exhibe el estado *"Sin patrulla asignada"* con el subtexto *"Sin asignación operativa activa"*.
2. **Historial de Patrullas Asignadas:**
   - Tarjetas individuales de cada patrulla o cuadrilla a la que el operador ha estado vinculado.
   - Cada tarjeta indica:
     - Nombre de la unidad (ej. *"Patrulla Móvil Alfa 01"*).
     - Delegación asociada (ej. *"Delegación Costera"*).
     - Estado de asignación:
       - **Activa:** Insignia verde destacando la unidad en turno vigente.
       - **Desactivada:** Insignia gris con aviso de baja lógica.
       - **Turno Anterior:** Unidades de turnos previos registradas en el dispositivo.
     - Fecha y hora del primer registro y última asignación en el dispositivo.

---

## 4. Comportamiento sin Conexión (Modo Offline)

- **Persistencia en IndexedDB:** 
  - Las evaluaciones históricas y el registro de patrullas se almacenan localmente en el almacén `catalogos` bajo la clave `historial_unidades_<usuarioId>` (con respaldo en `localStorage`).
  - El operador puede consultar su historial de asignaciones y el archivo de misiones pasadas en cualquier momento, incluso en zonas rurales o costeras de la comuna sin cobertura celular.
- **Auditoría Inmutable:** Las evaluaciones e informes emitidos con anterioridad a la baja permanecen inalterables en conformidad a la normativa municipal.

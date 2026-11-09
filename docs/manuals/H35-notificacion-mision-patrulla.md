# Manual de Usuario: Notificación y Refresco Automático de Misión en Terreno (H35)

**Historia de Usuario:** H35 — Notificación y recepción de nueva misión asignada  
**Rol Operativo:** Patrulla Verificadora / Delegado de Cuadrilla  
**Aplicación:** SGRAI — Cliente Móvil de Terreno (PWA) — Municipalidad de Valdivia  

---

## 1. Propósito

Describir el funcionamiento del sistema de recepción en tiempo real y refresco automático de misiones despachadas por el Centro de Mando hacia los equipos operativos de terreno (Patrullas Verificadoras y Delegados de Cuadrilla), asegurando que las nuevas asignaciones se reflejen de inmediato en la pantalla sin necesidad de que el personal deba recargar la aplicación manualmente.

---

## 2. Permisos y Capacidades del Dispositivo

1. **Vibración Táctil (Haptic Feedback):**
   - Al despacharse una nueva misión dirigida a la unidad, la PWA activa automáticamente un patrón de vibración distintivo en el dispositivo móvil (`[200ms, 100ms, 200ms]`) para alertar al operador incluso cuando el teléfono se encuentra en el bolsillo o en el soporte vehicular.
2. **Conexión de Red:**
   - La aplicación mantiene un canal de eventos en tiempo real mediante WebSockets (Socket.io) con reconexión continua.

---

## 3. Comportamiento en la Aplicación

1. **Recepción Automática Sin Recargar la Página:**
   - Cuando el Centro de Mando asigna una misión táctica, la PWA recibe el evento `mision:asignada` a través de la sala privada de la unidad (`patrulla:{id}` o `cuadrilla:{id}`).
   - La lista de misiones pendientes, los contadores numéricos y la tarjeta de "Siguiente Misión" se actualizan de forma instantánea.
2. **Banner Emergente de Nueva Asignación (`NuevaMisionBanner`):**
   - En la parte superior de la pantalla se despliega una tarjeta destacada con el código del incidente asignado (ej. `INC-2026-0042`).
   - El banner cuenta con un botón táctil de alta ergonomía (`min-height: 48px`, esquinas rectas): **"Ver Misión Asignada"**, el cual redirige directamente al detalle operativo de la misión.
   - Si el operador prefiere continuar en la pantalla actual, puede cerrar la notificación mediante el botón de cierre lateral.

---

## 4. Comportamiento sin Conexión (Modo Offline-First)

Debido a la geografía de la comuna de Valdivia y la posibilidad de sombras de cobertura celular:

1. **Pérdida Momentánea de Cobertura:**
   - Si el dispositivo pierde la señal de red mientras se emite un despacho, el socket se reconectará automáticamente en cuanto se restablezca la conectividad.
2. **Sincronización por Reanudación de Pantalla:**
   - Al desbloquear el dispositivo o volver a enfocar la aplicación en primer plano (`visibilitychange`), la PWA verifica si han transcurrido más de 15 segundos y realiza una sincronización en segundo plano con la base de datos local (IndexedDB) y la API central.
3. **Polling de Respaldo Silencioso:**
   - Como mecanismo de contingencia ante bloqueos de puertos WebSocket en redes celulares restrictivas, la aplicación ejecuta una comprobación periódica en segundo plano cada 30 segundos mientras la pantalla permanezca activa.

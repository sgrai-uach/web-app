# Manual de Usuario: Transmisión Automática de Telemetría GPS en Terreno (H70)

**Historia de Usuario:** H70 — Transmisión automática de telemetría GPS en segundo plano  
**Roles:** Patrulla Verificadora / Delegado de Cuadrilla  
**Aplicación:** SGRAI — PWA Terreno (`/terreno/patrulla/misiones/[id]`, `/terreno/cuadrilla/misiones/[id]`)

---

## 1. Propósito

Este manual describe el funcionamiento del subsistema de **telemetría GPS automática en segundo plano** de la aplicación móvil de terreno (`sgrai-pwa`). Permite que los dispositivos móviles de las patrullas verificadoras y cuadrillas operativas transmitan en tiempo real sus coordenadas geográficas hacia la plataforma central del SGRAI mientras se encuentren en misión activa (`EN_CURSO`), facilitando la visualización en vivo de las unidades en el mapa táctico del Centro de Mando (`sgrai-web`).

---

## 2. Permisos de Hardware y Configuración del Dispositivo

Para que la telemetría opere adecuadamente, el dispositivo móvil debe contar con el sensor de geolocalización satelital encendido y otorgar permiso al navegador:

### 2.1. Permiso de Ubicación (GPS)
1. **Solicitud de Permiso:**
   - Al aceptar una misión o ingresar a una misión en curso, el navegador web móvil (Google Chrome, Microsoft Edge, Mozilla Firefox o Apple Safari) desplegará una ventana emergente solicitando acceso a la ubicación del dispositivo.
   - Seleccione la opción **"Permitir mientras la app está en uso"** o **"Permitir siempre"**.
2. **Activación de Precisión Alta:**
   - La aplicación configura automáticamente la Geolocation API con alta precisión (`enableHighAccuracy: true`, `timeout: 10000 ms`, `maximumAge: 30000 ms`).
   - Se recomienda tener activa la opción "Ubicación precisa" en los ajustes del sistema operativo móvil (Android o iOS).
3. **Cómo desbloquear si fue denegado previamente:**
   - **Google Chrome / Edge (Android):** Toque el ícono de candado o configuración al lado izquierdo de la barra de direcciones URL $\rightarrow$ *Permisos* $\rightarrow$ *Ubicación* $\rightarrow$ Cambiar a *Permitir*.
   - **Safari (iOS):** Abra *Ajustes* del iPhone $\rightarrow$ *Privacidad y seguridad* $\rightarrow$ *Localización* $\rightarrow$ *Sitios web de Safari* $\rightarrow$ Seleccionar *Al usar la app* y verificar que *Ubicación precisa* esté activada.

---

## 3. Funcionamiento de la Telemetría en Terreno

### 3.1. Activación Automática
- La captura e inicio de transmisión se activan de manera **100% automática** apenas la misión pasa al estado **`EN_CURSO`** (por ejemplo, tras presionar **"Aceptar Misión"** en la patrulla o cuadrilla).
- No requiere que el funcionario presione ningún botón adicional para iniciar la telemetría.

### 3.2. Emisión Periódica y Eficiencia Energética
- La aplicación toma una muestra controlada de las coordenadas satelitales cada **30 segundos**.
- Este intervalo optimizado previene el sobrecalentamiento del equipo y reduce sustancialmente el consumo de batería durante turnos de emergencia prolongados de 8 a 12 horas.
- Las coordenadas son emitidas en tiempo real hacia `sgrai-api` a través del WebSocket de Socket.io mediante el evento:
  ```json
  {
    "unidadId": "f1000000-0000-4000-8000-000000000050",
    "tipoUnidad": "PATRULLA",
    "lat": -39.81422,
    "lng": -73.24589,
    "timestamp": "2026-11-12T15:45:00.000Z",
    "rumbo": 180,
    "precision": 6.5,
    "velocidad": 11.2
  }
  ```

### 3.3. Indicadores Visuales en Pantalla
En la cabecera de la misión activa se despliega un distintivo visual de estado:
1. **GPS activo (Normal):**
   - Distintivo verde sólido con esquinas rectas (`--color-success-bg` / `--color-success`) y un pulso animado.
   - Indica que las coordenadas se están transmitiendo fluidamente al Centro de Mando.
2. **GPS sin permiso (Advertencia no bloqueante):**
   - Distintivo ámbar (`--color-warning`) que advierte que el navegador denegó la geolocalización.
   - En la tarjeta principal se despliega un aviso informativo que no interrumpe el llenado de reportes ni la operativa de terreno:
     > *"Ubicación GPS no autorizada: Para que el Centro de Mando visualice la unidad en el mapa en tiempo real, habilite el permiso de ubicación en los ajustes del navegador."*
   - Cuenta con el botón **"Reintentar"** para solicitar el permiso nuevamente sin recargar la pantalla.
3. **Sin señal GPS (Falla satelital):**
   - Distintivo ámbar que indica búsqueda de cobertura satelital en zonas de cañones urbanos o bosques densos.

### 3.4. Detención y Pausa Automática
- La captura satelital y transmisión se detienen **inmediatamente** cuando:
  - La misión finaliza (`FINALIZADA`, `COMPLETADA`, `CERRADA`).
  - La misión es cancelada o rechazada.
  - La unidad pasa a estado `DISPONIBLE` o es dada de baja lógica.
  - El usuario cierra la sesión activa.

---

## 4. Comportamiento sin Conexión (Modo Offline)

- **Zonas de sombra o pérdida de señal celular (3G/4G/5G):**
  - Si el vehículo o cuadrilla ingresa a un sector sin cobertura de red móvil (ej. zonas costeras o precordilleranas de la comuna de Valdivia), la aplicación **no interrumpe la operativa ni despliega alertas modales bloqueantes**.
  - El funcionario puede continuar ingresando reportes técnicos, tipologías y fotografías sin ningún tipo de traba.
  - El sensor GPS sigue registrando la posición satelital en el dispositivo.
- **Reconexión silenciosa e inmediata:**
  - En cuanto el dispositivo recupera cobertura móvil, la conexión WebSocket se restablece silenciosamente en segundo plano.
  - La PWA retransmite de forma inmediata la última posición geográfica capturada hacia la sala del mapa del Centro de Mando, reanudando el ciclo regular de 30 segundos.

---

## 5. Integración con el Ecosistema SGRAI

- **`sgrai-pwa`:** Captura coordenadas WGS84, rumbo, velocidad y precisión, emitiendo el evento `telemetria:posicion`.
- **`sgrai-api`:** Valida el payload con esquemas Zod en la versión `0.11.0`, almacena la posición volátil en Redis (`unidad:{id}:posicion`) y retransmite el evento a la sala `mapa`.
- **`sgrai-web`:** Consume en tiempo real la sala `mapa` y posiciona el marcador de la patrulla o cuadrilla en la cartografía comunal de despacho.

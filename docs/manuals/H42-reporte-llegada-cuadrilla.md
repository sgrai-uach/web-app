# Manual de Usuario: Reporte de Llegada a Terreno por Delegado de Cuadrilla (H42)

**Historia de Usuario:** H42 — Reporte de llegada a terreno del equipo capturando coordenadas geográficas  
**Rol:** Delegado de Cuadrilla (`DELEGADO_CUADRILLA`)  
**Aplicación:** SGRAI — PWA Terreno (`/terreno/cuadrilla/misiones/[id]`)

---

## 1. Propósito

Este manual describe el procedimiento operativo mediante el cual el **Delegado de Cuadrilla** notifica y certifica desde su dispositivo móvil la llegada física de la brigada al lugar del incidente asignado, capturando de forma instantánea la hora oficial de arribo y las coordenadas geográficas mediante la Geolocation API. Esta acción permite a la central del Centro de Mando calcular con exactitud los tiempos de respuesta del servicio público y habilitar la bitácora operativa de faena.

---

## 2. Requisitos Previos y Permisos de Hardware

1. **Cuenta y Perfil RBAC:**
   * El usuario debe haber iniciado sesión con el rol **Delegado de Cuadrilla** (`DELEGADO_CUADRILLA`) y contar con el permiso **`misiones:terreno:ejecutar`**.
   * La cuadrilla debe encontrarse en estado activo (`unidadActiva: true`).
2. **Permisos de Ubicación (GPS) en el Dispositivo Móvil:**
   * Al tocar por primera vez el botón **"Llegada a Terreno"**, el navegador móvil (Chrome, Safari o Edge) desplegará el cuadro de diálogo del sistema operativo solicitando acceso a la ubicación.
   * Seleccione **"Permitir mientras la app está en uso"** para permitir la captura de coordenadas de alta precisión satelital (`enableHighAccuracy: true`).
   * **Mecanismo de Contingencia:** En caso de que el GPS del dispositivo se encuentre temporalmente fuera de cobertura satelital o presente fallas de señal en terreno, la aplicación habilita de inmediato la opción de contingencia: **"Registrar llegada con ubicación de la misión"**, la cual emplea las coordenadas georreferenciadas asignadas originalmente por la central en el despacho, permitiendo continuar las labores sin interrumpir el despliegue de la brigada.

---

## 3. Instrucciones Paso a Paso

1. Ingrese a la PWA de terreno (**SGRAI Terreno**) con su cuenta de Delegado de Cuadrilla.
2. En la pantalla principal de **Inicio** o en el módulo de **Misiones / Faenas** (`/cuadrilla/misiones`), seleccione la misión asignada que se encuentre en estado **Despachada**.
3. En la pantalla de detalle de la misión (`/cuadrilla/misiones/[id]`), revise la dirección del incidente y las instrucciones tácticas de trabajo.
4. Una vez que el vehículo y el equipo se encuentren detenidos frente al lugar de los hechos, ubique la tarjeta destacada **Confirmación de arribo**.
5. Presione el botón destacado **"Llegada a Terreno"** (botón de color verde menta institucional con altura táctil ergonómica de 48px).
6. El sistema capturará automáticamente las coordenadas GPS en segundo plano y enviará la confirmación al Centro de Mando.
7. Al completarse el registro:
   * La misión cambia automáticamente de estado a **En curso** (`EN_CURSO`) con la etiqueta visual verde **"En Trabajos de Terreno"**.
   * Se registra y visualiza la hora exacta de arribo (ej. *19:30 hrs*).
   * Se oculta el botón de llegada y quedan habilitadas las siguientes acciones de faena (adjuntar evidencias, solicitar apoyos e informe de cierre de faena).

---

## 4. Comportamiento sin Conexión (Modo Offline)

* **Arribo en zonas sin cobertura celular (Offline-First):**
  * Si la brigada llega a un sector de Valdivia o sus alrededores sin conectividad 4G/5G ni WiFi, la aplicación **no se bloquea ni impide el registro**.
  * La llegada se almacena de inmediato en la base de datos local del dispositivo móvil (`IndexedDB` $\rightarrow$ almacén `outbox` con la acción `REPORTAR_LLEGADA`).
* **Indicación visual de sincronización pendiente:**
  * La pantalla de la misión transiciona inmediatamente a **"En Trabajos de Terreno"** para permitir al delegado continuar operando.
  * Se despliega un distintivo persistente en la cabecera: **`Trabajando offline (1 pendientes)`** y un banner de aviso indicando que la llegada fue guardada localmente y se transmitirá al recuperar cobertura.
* **Sincronización automática e Idempotencia:**
  * Al restablecerse la señal de internet, el servicio en segundo plano transmite automáticamente la petición `POST /api/misiones/{id}/llegada` al servidor central.
  * Si por razones de doble pulsación o reintentos la llegada ya había sido procesada por la central (código `409 Conflict`), la aplicación resuelve el evento como exitoso y actualiza el estado a sincronizado sin generar alertas ni interrumpir la labor del usuario.

---

## 5. Relación con Otros Repositorios del Ecosistema SGRAI

* **`sgrai-api` (Backend):**
  * Procesa la solicitud en `POST /api/misiones/{id}/llegada`.
  * Registra el hito `LLEGADA_TERRENO` en la tabla `mision_hito` con fecha/hora actual, usuario en sesión y coordenadas PostGIS.
  * Actualiza la última ubicación conocida del personal en la tabla `personal`.
  * Emite el evento WebSocket `"mision:hito_registrado"` hacia las salas de monitoreo en tiempo real.
* **`sgrai-web` (Centro de Mando / H23):**
  * Al recibir la notificación en tiempo real, agrega de inmediato el hito de arribo en la línea de tiempo vertical de la misión y actualiza el indicador general a **"EN_CURSO"**, permitiendo al Encargado auditar los tiempos de desplazamiento.


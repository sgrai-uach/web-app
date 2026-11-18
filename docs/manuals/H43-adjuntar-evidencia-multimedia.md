# Manual de Usuario — H43: Adjuntar Evidencia Multimedia en Terreno

**Rol:** Delegado de Cuadrilla  
**Módulo:** Detalle de Faena Activa (`/terreno/cuadrilla/misiones/[id]`)  
**Permiso requerido:** `reportes:crear`

---

## 1. Propósito

Permite al Delegado de Cuadrilla capturar fotografías, grabar videos breves o adjuntar documentos técnicos (PDF) directamente desde el dispositivo móvil mientras atiende una faena activa (`EN_CURSO` o `EN_TERRENO`), respaldando las condiciones del lugar y los trabajos ejecutados para su visualización inmediata en el Centro de Mando.

---

## 2. Formatos y Límites Permitidos

| Tipo de Evidencia | Formatos Soportados | Peso Máximo | Optimización |
|---|---|---|---|
| **Fotografías** | `image/jpeg`, `image/png`, `image/webp` | 10 MB | Compresión automática en cliente ($\le 1280\text{px}$) y optimización en servidor (WebP). |
| **Videos** | `video/mp4`, `video/webm`, `video/quicktime` (`.mov`) | 10 MB | Subida directa y transcodificación a MP4 (720p) en servidor cuando corresponde. |
| **Documentos Técnicos** | `application/pdf` | 10 MB | Transferencia íntegra con verificación de firma binaria. |

---

## 3. Paso a Paso en Terreno

1. Ingrese a la faena asignada desde **Bandeja de Faenas de Cuadrilla** (`/terreno/cuadrilla/misiones`).
2. Asegúrese de que la misión se encuentre en estado activo (`EN_CURSO`, `EN_TERRENO` o `ACEPTADA`).
3. En la tarjeta **Evidencia Multimedia**, seleccione una de las tres acciones:
   - **Tomar Foto:** Abre directamente la cámara trasera del teléfono para capturar una fotografía.
   - **Grabar Video:** Abre la cámara en modo video para registrar condiciones del terreno o faena.
   - **Galería / PDF:** Permite seleccionar una o varias fotografías, videos o documentos PDF desde el almacenamiento del dispositivo.
4. La aplicación validará el formato y peso ($\le 10\text{ MB}$), mostrará la barra de progreso de carga y agregará la previsualización (miniatura de imagen, reproductor de video o tarjeta PDF) en la lista **Archivos adjuntos**.

---

## 4. Comportamiento sin conexión

- Si el dispositivo pierde cobertura celular o Wi-Fi en terreno:
  1. Las fotografías se comprimen igualmente en el dispositivo para ahorrar espacio local.
  2. El archivo y sus metadatos (`incidente_id` / `reporte_terreno_id`) se almacenan de forma segura en **IndexedDB** (`outbox` tipo `SUBIR_EVIDENCIA`).
  3. El adjunto aparece en la galería local con la etiqueta **Pendiente offline** y la cabecera muestra el estado `Sin conexión / Trabajando offline` junto al contador de acciones pendientes.
  4. Al recuperar conectividad a Internet (o mediante *Background Sync* del Service Worker), la PWA sincroniza automáticamente la cola en segundo plano y actualiza el estado del archivo a **Sincronizado** con la URL definitiva del servidor.
  5. Si el servidor rechaza un archivo de forma definitiva (por ejemplo, HTTP `413` o `415`), el adjunto se marca con el mensaje de error correspondiente y se retira de la cola para no bloquear otras sincronizaciones.

---

## 5. Permisos del dispositivo

Para utilizar todas las capacidades de captura multimedia en navegadores móviles (Chrome en Android / Safari en iOS), autorice los siguientes permisos cuando el sistema operativo los solicite:

- **Cámara:** Requerido para los botones **Tomar Foto** y **Grabar Video**.
  - *Android (Chrome):* Configuración del sitio $\rightarrow$ Cámara $\rightarrow$ **Permitir**.
  - *iOS (Safari):* Ajustes $\rightarrow$ Safari $\rightarrow$ Cámara $\rightarrow$ **Preguntar** o **Permitir**.
- **Micrófono:** Requerido durante la grabación de videos con audio mediante **Grabar Video**.
  - *Android / iOS:* Otorgar permiso de Micrófono al navegador al iniciar la grabación.
- **Almacenamiento / Fotos y Archivos:** Requerido para adjuntar imágenes, videos o documentos PDF existentes desde **Galería / PDF**.

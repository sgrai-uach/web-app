# Contratos de API para Módulos de Terreno (PWA)

Este documento detalla los contratos HTTP y WebSocket consumidos por la aplicación de terreno (`sgrai-pwa`) desde el backend `sgrai-api`.

Todos los tipos TypeScript de estos endpoints se derivan estrictamente de [src/types/api-generated.d.ts](file:///home/zetastormy/Development/SGRAI/web-app/src/types/api-generated.d.ts).

---

## 1. Módulo de Autenticación y Perfil de Usuario

### 1.1 Inicio de Sesión de Funcionario de Terreno
- **Historia:** H59
- **Método:** `POST`
- **Ruta:** `/api/seguridad/login`
- **Autenticación requerida:** No (Ruta pública perimetral)
- **Headers:** `Content-Type: application/json`

#### Request Body
```json
{
  "identificador": "11.111.111-1", // RUT formateado o email institucional
  "password": "Password123!"
}
```

#### Response Exitosa (200 OK)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiraEn": "2026-10-28T00:00:00Z",
  "usuario": {
    "id": "c1f7a8b9-4d2e-4f3a-9e1b-2c3d4e5f6a7b",
    "rut": "11.111.111-1",
    "nombre": "Juan Silva",
    "email": "jsilva@valdivia.cl",
    "rolId": "rol-patrulla-01",
    "rolNombre": "Patrulla Verificadora",
    "rolCodigo": "PATRULLA_VERIFICADORA", // Restricción PWA: PATRULLA_VERIFICADORA o DELEGADO_CUADRILLA
    "delegacionId": "del-01",
    "delegacionNombre": "Valdivia Norte",
    "permisos": [
      "misiones:terreno:verificar",
      "misiones:terreno:reportar"
    ]
  }
}
```

#### Regla RBAC en Cliente:
Si `usuario.rolCodigo` no es `PATRULLA_VERIFICADORA` ni `DELEGADO_CUADRILLA`, el cliente PWA rechaza la sesión con código de error `403 FORBIDDEN` y mensaje explícito:
> *"Acceso restringido: Esta aplicación móvil está reservada exclusivamente para Patrulla Verificadora y Delegado de Cuadrilla."*

---

### 1.2 Consulta de Usuario Activo en Sesión
- **Historia:** H66
- **Método:** `GET`
- **Ruta:** `/api/seguridad/usuario-activo`
- **Autenticación requerida:** Sí (`Authorization: Bearer <token>`)

#### Response Exitosa (200 OK)
Retorna la entidad `UsuarioSesion` descrita en el login.

---

## 2. Endpoints Operativos de Terreno

| Método | Endpoint | Historia | Rol Permitido | Propósito |
|---|---|---|---|---|
| `POST` | `/api/misiones/{id}/aceptar` | H36, H40 | `PATRULLA_VERIFICADORA`, `DELEGADO_CUADRILLA` | Pasa misión a estado `EN_CURSO`. |
| `POST` | `/api/misiones/{id}/rechazar` | H41, H69 | `PATRULLA_VERIFICADORA`, `DELEGADO_CUADRILLA` | Rechazo motivado con justificación obligatoria ($\ge 5$ caracteres). |
| `POST` | `/api/misiones/{id}/llegada` | H42 | `DELEGADO_CUADRILLA` | Registro de arribo con coordenadas GPS (`lat`, `lng`, `precision`). |
| `PATCH` | `/api/incidentes/{id}/tipologia` | H37 | `PATRULLA_VERIFICADORA` | Reclasificación de tipología en terreno desde catálogo oficial. |
| `PATCH` | `/api/incidentes/{id}/prioridad` | H38 | `PATRULLA_VERIFICADORA` | Ajuste fundado de prioridad con justificación ante discrepancia ($\ge 5$ caracteres). |
| `POST` | `/api/misiones/{id}/reporte` | H39 | `PATRULLA_VERIFICADORA` | Informe técnico o dictamen `NO_ABORDABLE` ($\ge 15$ caracteres). |
| `POST` | `/api/evidencia/adjuntos` | H43 | `DELEGADO_CUADRILLA` | Carga multipart de fotografías y archivos comprimidos. |
| `POST` | `/api/misiones/{id}/apoyo` | H44 | `DELEGADO_CUADRILLA` | Solicitud estructurada de recursos o personal adicional. |
| `POST` | `/api/misiones/{id}/cerrar` | H68 | `DELEGADO_CUADRILLA` | Cierre de faena con detalle de materiales consumidos. |

---

### 2.1 Confirmar y Aceptar Misión Asignada por Patrulla Verificadora (H36)
- **Historia:** H36
- **Método:** `POST`
- **Ruta:** `/api/misiones/{id}/aceptar`
- **Permiso RBAC requerido:** `misiones:terreno:verificar`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

#### Request Body (Opcional — timeout GPS no bloqueante de 5 segundos)
```json
{
  "latitud": -39.819588,
  "longitud": -73.245209
}
```
> Si el navegador móvil no cuenta con permisos de GPS o demora más de `5000 ms`, la PWA envía `{}` sin retrasar la confirmación de salida.

#### Response Exitosa (200 OK)
```json
{
  "message": "Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.",
  "data": {
    "mision": {
      "id": "60000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0001",
      "titulo": "Verificación de Incidente INC-2026-0001",
      "descripcion": "Evaluar caída de árbol",
      "tipoMision": "VERIFICACION",
      "estado": "EN_CURSO",
      "prioridad": "ALTA",
      "incidenteId": "a0000000-0000-4000-8000-000000000001",
      "patrullaId": "f1000000-0000-4000-8000-000000000001",
      "fechaInicio": "2026-11-01T21:00:00.000Z",
      "actualizadoEn": "2026-11-01T21:00:00.000Z"
    },
    "patrulla": {
      "id": "f1000000-0000-4000-8000-000000000001",
      "nombre": "Patrulla Rápida Costa-1",
      "estado": "EN_VERIFICACION"
    },
    "incidente": {
      "id": "a0000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-0001",
      "estado": "VERIFICANDO"
    },
    "hito": {
      "id": "70000000-0000-4000-8000-000000000001",
      "misionId": "60000000-0000-4000-8000-000000000001",
      "hito": "MISION_ACEPTADA",
      "descripcion": "Misión Aceptada por Patrulla",
      "registradoPorId": "00000000-0000-4000-8000-000000000004",
      "latitud": -39.819588,
      "longitud": -73.245209,
      "creadoEn": "2026-11-01T21:00:00.000Z"
    }
  }
}
```

#### Idempotencia y Cola Offline (`409 Conflict`)
- Si el dispositivo acepta la misión sin señal, la PWA actualiza localmente el estado a `EN_CURSO` y encola `ACEPTAR_MISION` en IndexedDB (`outbox`).
- Si al sincronizar la cola el servidor responde `409 Conflict` porque la misión ya estaba en `EN_CURSO`, el cliente descarta la tarea de la cola y mantiene la vista en **"En Trayecto / Evaluación"** sin error bloqueante.

---

### 2.1.b Confirmar y Aceptar Asignación de Incidente por Delegado de Cuadrilla (H40)
- **Historia:** H40
- **Método:** `POST`
- **Ruta:** `/api/misiones/{id}/aceptar`
- **Permiso RBAC requerido:** `misiones:terreno:ejecutar`
- **Tipo de misión:** `ATENCION_CUADRILLA`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

#### Request Body (Opcional — timeout GPS no bloqueante de 5 segundos)
```json
{
  "latitud": -39.819588,
  "longitud": -73.245209
}
```
> Si el dispositivo no cuenta con coordenadas GPS o supera los `5000 ms`, la PWA envía `{}` para no retrasar el despliegue.

#### Response Exitosa (200 OK)
```json
{
  "message": "Asignación de misión aceptada exitosamente. La cuadrilla inicia el desplazamiento y asume la atención del incidente.",
  "data": {
    "mision": {
      "id": "70000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0005",
      "titulo": "Atención táctica - Incidente INC-2026-0001",
      "descripcion": "Despeje de árbol caído sobre calzada",
      "tipoMision": "ATENCION_CUADRILLA",
      "estado": "EN_CURSO",
      "prioridad": "ALTA",
      "incidenteId": "30000000-0000-4000-8000-000000000001",
      "patrullaId": null,
      "cuadrillaId": "50000000-0000-4000-8000-000000000001",
      "fechaInicio": "2026-11-22T14:00:00.000Z",
      "actualizadoEn": "2026-11-22T14:00:00.000Z"
    },
    "cuadrilla": {
      "id": "50000000-0000-4000-8000-000000000001",
      "nombre": "Cuadrilla Vías y Canales 1",
      "estado": "EN_MISION",
      "delegacionId": "30000000-0000-4000-8000-000000000002"
    },
    "patrulla": null,
    "incidente": {
      "id": "30000000-0000-4000-8000-000000000001",
      "codigo": "INC-2026-0001",
      "estado": "EN_ATENCION",
      "prioridad": "ALTA"
    },
    "hito": {
      "id": "80000000-0000-4000-8000-000000000010",
      "misionId": "70000000-0000-4000-8000-000000000001",
      "hito": "MISION_ACEPTADA",
      "descripcion": "Asignación Aceptada por Cuadrilla",
      "registradoPorId": "d0000000-0000-4000-8000-000000000001",
      "latitud": -39.819588,
      "longitud": -73.245209,
      "creadoEn": "2026-11-22T14:00:00.000Z"
    }
  }
}
```

#### Eventos WebSocket Emitidos y Cola Offline
- Al ejecutarse la transacción atómica en `sgrai-api`, se emiten `mision:actualizada`, `incidente:actualizado` (incidente en `EN_ATENCION`) y `cuadrilla:actualizada` hacia el Centro de Mando (`sgrai-web`) y la sala operativa de la unidad.
- En ausencia de señal, la PWA persiste la misión optimista (`EN_CURSO`, `EN_MISION`, `EN_ATENCION`) en IndexedDB y encola `ACEPTAR_MISION` en `outbox` manejando de forma idempotente respuestas `409 Conflict` con estado `EN_CURSO`.

---

### 2.2 Rechazo Motivado de Misión por Patrulla Verificadora o Cuadrilla (H41, H69)
- **Historia:** H41, H69
- **Método:** `POST`
- **Ruta:** `/api/misiones/{id}/rechazar`
- **Permiso RBAC requerido:** `misiones:terreno:verificar` (Patrulla Verificadora) / `misiones:terreno:ejecutar` (Delegado de Cuadrilla)
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

#### Request Body
```json
{
  "justificacion_rechazo": "Desperfecto mecánico severo en vehículo de traslado.",
  "latitud": -39.819588,
  "longitud": -73.245209
}
```

> **Regla de Negocio Crítica §3.3:** La justificación es obligatoria y debe contar con un mínimo de **5 caracteres** útiles (tras remover espacios en blanco circundantes). Las coordenadas GPS son opcionales y no bloqueantes.

#### Response Exitosa (200 OK)
```json
{
  "message": "Misión rechazada exitosamente.",
  "data": {
    "mision": {
      "id": "60000000-0000-4000-8000-000000000001",
      "codigo": "MIS-2026-0001",
      "estado": "RECHAZADA",
      "justificacionRechazo": "Desperfecto mecánico severo en vehículo de traslado.",
      "actualizadoEn": "2026-11-01T21:05:00.000Z"
    }
  }
}
```

#### Códigos de Error HTTP
- `400 Bad Request`: Formato de carga inválido o justificación menor a 5 caracteres (`VALIDATION_ERROR`).
- `401 Unauthorized`: Token de sesión ausente, inválido o expirado.
- `403 Forbidden`: Operador sin rol o sin permiso `misiones:terreno:verificar` / `misiones:terreno:ejecutar`, o unidad operativa en estado desactivada.
- `404 Not Found`: Identificador de misión no registrado en el sistema.
- `409 Conflict`: La misión ya no se encuentra en estado `DESPACHADA` o `ASIGNADA` (ej. ya aceptada previamente o cancelada por despacho).

#### Efectos Colaterales en Tiempo Real (Socket.io)
Al procesar exitosamente el rechazo, el backend emite el evento `mision:rechazada` hacia la sala `encargado`:
```json
{
  "misionId": "60000000-0000-4000-8000-000000000001",
  "codigo": "MIS-2026-0001",
  "unidadId": "f1000000-0000-4000-8000-000000000001",
  "motivo": "Desperfecto mecánico severo en vehículo de traslado.",
  "timestamp": "2026-11-01T21:05:00.000Z"
}
```
Esto notifica de inmediato al Encargado del Centro de Mando en `sgrai-web` para reasignar la misión a otra unidad disponible.

#### Comportamiento Offline-First
- En caso de pérdida de señal o error de red, la PWA valida localmente con Zod (`rechazoMisionSchema`), persiste el estado `RECHAZADA` con `sincronizacionPendiente: true` en IndexedDB y almacena la mutación `RECHAZAR_MISION` en `outbox`.
- El badge de conectividad refleja de inmediato `1 pendiente` y el worker/hook `useConnectivity` reintenta la mutación al recuperar la conexión.

---

### 2.3 Adjuntar Evidencia Multimedia en Terreno (H43)
- **Historia:** H43
- **Método:** `POST`
- **Ruta:** `/api/evidencia/adjuntos`
- **Permiso RBAC requerido:** `reportes:crear`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

#### Request Body (`multipart/form-data`)
- `file` *(binary, obligatorio)*: Archivo de imagen (`image/jpeg`, `image/png`, `image/webp`), video (`video/mp4`, `video/webm`, `video/quicktime`) o documento (`application/pdf`), con peso máximo de `10 MB`.
- `incidente_id` *(string UUID, opcional)*: Identificador del incidente asociado.
- `reporte_terreno_id` *(string UUID, opcional)*: Identificador del reporte de terreno asociado.
> Al menos uno de `incidente_id` o `reporte_terreno_id` debe enviarse.

#### Response Exitosa (`201 Created`)
```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "nombreArchivo": "foto_terreno.webp",
  "url": "/uploads/evidencia/9f86d081884c7d659a2feaa0c55ad015.webp",
  "tipoMime": "image/webp",
  "tamanoBytes": 148200,
  "incidenteId": "22222222-2222-4222-8222-222222222222",
  "reporteTerrenoId": null,
  "creadoEn": "2026-11-17T19:00:00.000Z"
}
```
> El servidor optimiza imágenes a WebP y transcodifica videos a MP4 (720p, `faststart`), devolviendo `url`, `tipoMime` y `tamanoBytes` definitivos. El cliente actualiza el adjunto local con estos valores y consume `/uploads/evidencia/[filename]` con soporte `Accept-Ranges: bytes` (`206 Partial Content`).

#### Códigos de Error y Manejo Offline
- `400`: Faltan `incidente_id` / `reporte_terreno_id` o formato UUID inválido.
- `403`: Usuario sin permiso `reportes:crear`.
- `404`: Incidente o reporte de terreno no encontrado.
- `413`: Archivo supera los `10 MB`.
- `415`: Tipo MIME o firma binaria (*magic bytes*) no autorizada.
- Sin conexión o falla de red (`5xx`): La PWA valida con Zod, comprime imágenes en cliente ($\le 1280\text{px}$), encola `SUBIR_EVIDENCIA` en IndexedDB y sincroniza automáticamente vía `FormData` al recuperar conectividad.

---

### 2.4 Evaluar Terreno y Asignar/Modificar Prioridad del Incidente (H38)
- **Historia:** H38
- **Método:** `PATCH`
- **Ruta:** `/api/incidentes/{id}/prioridad` (y cálculo auxiliar en `POST /api/incidentes/{id}/prioridad/calcular`)
- **Permiso RBAC requerido:** `misiones:terreno:verificar`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

#### Request Body (`PATCH /api/incidentes/{id}/prioridad`)
```json
{
  "prioridad": "CRITICA",
  "prioridadSugerida": "ALTA",
  "justificacionPrioridad": "Se constata riesgo eléctrico activo sobre acceso único de vivienda con adultos mayores.",
  "nucleoFamiliarTotal": 4,
  "cantidadNinos": 1,
  "cantidadAdultosMayores": 2,
  "personasDiscapacitadas": 0,
  "personasElectrodependientes": 0,
  "mascotasAfectadas": 1,
  "viviendasAfectadas": 1,
  "nivelCompromisoVivienda": "MODERADO",
  "riesgoElectrico": true,
  "riesgoEstructural": false,
  "riesgoQuimicoSanitario": false,
  "aislamientoVial": false,
  "requiereEvacuacion": false,
  "detallesAdicionales": "Se requiere coordinación con empresa eléctrica y cuadrilla de despeje.",
  "factoresGatillantes": [
    "Peligro eléctrico activo en terreno",
    "Adultos mayores afectados (2)"
  ],
  "versionReporte": 1,
  "misionId": "60000000-0000-4000-8000-000000000001"
}
```

#### Reglas de Validación y Versionado
- Si `prioridad !== prioridadSugerida`, el campo `justificacionPrioridad` es obligatorio y debe tener al menos **5 caracteres**.
- Cada envío o rectificación incrementa `versionReporte` (`1`, `2`, `...`), registrando un reporte distinguible en el Centro de Mando (con datos de `evaluador` visibles para toda la patrulla) y emitiendo los eventos WebSocket `incidente:actualizado` y `mision:actualizada`.

---

### 2.5 Enviar Informe Técnico de Verificación y Cerrar Misión (H39 / H86)
- **Historia:** H39 (fusión H39 / H86)
- **Método:** `POST`
- **Ruta:** `/api/misiones/{id}/reporte`
- **Permiso RBAC requerido:** `reportes:crear`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

#### Request Body (`POST /api/misiones/{id}/reporte`)
```json
{
  "dictamen": "REQUIERE_CUADRILLA",
  "motivo_no_abordable": null,
  "resumen_tecnico": "Se constata obstrucción completa de sumidero y socavón en berma norte; requiere cuadrilla vial con motobomba.",
  "estado_terreno": "CRITICO",
  "personas_afectadas": 4,
  "danos_estimados": "Anegamiento de primer nivel en 2 viviendas y daño en cerco perimetral.",
  "observaciones": "Acceso despejado para camión aljibe por calle paralela.",
  "requiere_asistencia_social": true,
  "adjuntoIds": [],
  "adjuntos": []
}
```

#### Reglas de Validación y Transacción Atómica
- `dictamen`: obligatorio (`'REQUIERE_CUADRILLA'` o `'NO_ABORDABLE'`).
- `resumen_tecnico`: obligatorio, mínimo **10 caracteres**.
- `motivo_no_abordable`: obligatorio cuando `dictamen === 'NO_ABORDABLE'`, mínimo **15 caracteres**. Transiciona `incidente.estado = 'NO_ABORDABLE'` registrando `fecha_cierre` y motivo.
- `personas_afectadas`: entero `>= 0`, precargado automáticamente desde el último reporte de prioridad (HU-38) mediante `evaluaciones.personasAfectadasPrevias` / `reportesTerreno` y editable por la patrulla.
- `requiere_asistencia_social`: casilla Ficha FIBE (trasladada desde HU-38); si es `true`, marca `incidente.requiere_asistencia_social = true`.
- `adjuntoIds` / `adjuntos`: sección preparada para integración con evidencia fotográfica (HU-43).
- Al recibir `201 Created`, la misión pasa a `COMPLETADA` (`fecha_cierre`), la patrulla pasa a `DISPONIBLE` y se emiten los eventos WebSocket `mision:actualizada`, `incidente:actualizado` y `patrulla:actualizada` / `patrulla:liberada`, sincronizando el estado y autoría (`evaluador`) para todo el personal de la patrulla.

---

## 3. Protocolo WebSocket en Tiempo Real

- **Librería cliente:** `socket.io-client`
- **Namespace:** `/`
- **Autenticación en handshake:** `{ auth: { token: "<jwt_token>" } }`

### Canales y Eventos

1. **Suscripción a Unidad:**
   - La patrulla escucha en `patrulla:{patrullaId}`.
   - La cuadrilla escucha en `cuadrilla:{cuadrillaId}`.
   - **Evento recibido `mision:asignada`:**
     ```json
     {
       "misionId": "mis-102",
       "incidenteId": "inc-450",
       "codigoIncidente": "INC-2026-00450",
       "tipologia": "CAIDA_ARBOL",
       "direccion": "Av. Ramón Picarte 1230, Valdivia",
       "coordenadas": { "lat": -39.8142, "lng": -73.2459 },
       "prioridad": "ALTA",
       "fechaDespacho": "2026-10-27T16:00:00Z"
     }
     ```

2. **Emisión de Telemetría GPS:**
   - **Evento emitido `telemetria:posicion` (H70):**
     ```json
     {
       "unidadId": "unidad-01",
       "tipoUnidad": "PATRULLA", // o "CUADRILLA"
       "lat": -39.81422,
       "lng": -73.24589,
       "precisionMetros": 8.5,
       "velocidad": 12.3,
       "timestamp": "2026-10-27T16:05:00Z"
     }
     ```

---

### 2.6 Solicitud de Apoyo Adicional en Terreno (H44)
- **Historia:** H44
- **Método:** `POST`
- **Ruta:** `/api/misiones/{id}/apoyo`
- **Permiso RBAC requerido:** `reportes:crear`
- **Precondición operativa:** Misión en estado `EN_CURSO` asignada a la cuadrilla del delegado autenticado (`403`/`409` en caso contrario).
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

#### Request Body
```json
{
  "requiereApoyoAdicional": true,
  "requiereCuadrillaAdicional": true,
  "detalleApoyoRequerido": "Se solicita motoniveladora y cuadrilla adicional de despeje",
  "resumenTecnico": "Árbol de gran envergadura bloqueando ambas pistas",
  "observaciones": "Acceso habilitado por calle lateral sur"
}
```
> El backend tolera además los alias `requiere_apoyo_adicional`, `requiere_cuadrilla_adicional` y `detalle_apoyo_requerido`. Si `requiereApoyoAdicional` es verdadero, exige `detalleApoyoRequerido` entre 5 y 1000 caracteres (de lo contrario responde `400 Bad Request`). Si `requiereApoyoAdicional` es `false`, `requiereCuadrillaAdicional` se normaliza automáticamente a `false`.

#### Respuesta Exitosa (`200 OK` / `201 Created`)
- Persiste en `reporte_terreno` los campos `requiere_apoyo_adicional = true`, `requiere_cuadrilla_adicional` y `detalle_apoyo_requerido`, devolviendo `data.reporteId` y `data.requiereCuadrillaAdicional`.
- Emite alerta visual prioritaria en tiempo real hacia la sala `encargado` del Centro de Mando y habilita el indicador **Apoyo Solicitado** en la tarjeta Kanban del incidente sin cerrar la misión (`EN_CURSO`).

#### Comportamiento Offline
- Si el dispositivo no posee cobertura o ocurre un error de red / `5xx`, la solicitud validada con `solicitudApoyoSchema` se almacena en `IndexedDB` (`outbox`, tipo `SOLICITAR_APOYO`) y se sincroniza automáticamente al recuperar conexión.

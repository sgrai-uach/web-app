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

### 2.2 Evaluar Terreno y Asignar/Modificar Prioridad del Incidente (H38)
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

### 2.3 Enviar Informe Técnico de Verificación y Cerrar Misión (H39 / H86)
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
  "adjuntos": [],
  "latitud": -39.819588,
  "longitud": -73.245209
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

3. **Conclusión de Operativo de Recuperación (H75):**
   - Cuando el Encargado decreta el cierre (`POST /api/eventos-atp/recuperacion/{id}/cerrar` desde `sgrai-web`), `sgrai-api` emite hacia la sala `patrulla:{patrullaId}`:
     - `mision:actualizada` con estado `COMPLETADA`.
     - `patrulla:actualizada` con estado `DISPONIBLE`.
   - `useTerrenoSocket` propaga ambos eventos mediante `CustomEvent('sgrai:mision-sincronizada')`, refrescando automáticamente la bandeja `/patrulla/misiones`, los componentes de inicio (`TerrenoResumenOperativo`, `TerrenoSiguienteMision`) y el detalle `/patrulla/misiones/[id]`.

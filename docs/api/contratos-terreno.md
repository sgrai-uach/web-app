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

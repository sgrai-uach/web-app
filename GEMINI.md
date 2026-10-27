@AGENTS.md

# GEMINI.md — sgrai-pwa

> [!NOTE]
> **Estado del Repositorio:** Este repositorio (`sgrai-pwa` / `web-app`) se encuentra actualmente en fase de construcción activa de los módulos de terreno para **Patrulla Verificadora** y **Delegado de Cuadrilla** (H35 a H44, H68 a H70).

Este archivo da contexto arquitectónico a cualquier asistente de IA que trabaje sobre este repositorio, que es la **aplicación de terreno (PWA)** del Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI), de la Dirección de Gestión de Riesgos de Desastres de la Municipalidad de Valdivia.

---

## 1. Rol de este repositorio en el sistema

`sgrai-pwa` es el cliente de **presentación para personal en terreno**, agrupado en el diagrama de componentes bajo "App terreno". Cubre exclusivamente estos dos roles:

- **Patrulla Verificadora:** Recibe notificación de incidente (H35), confirma o rechaza misión motivadamente (H36, H69), categoriza el incidente en terreno desde catálogo oficial (H37), sugiere/ajusta prioridad con justificación (H38), envía reporte de situación o dictamen de no abordabilidad (H39) y transmite telemetría GPS (H70).
- **Delegado de Cuadrilla:** Acepta o rechaza misiones pesadas con justificación obligatoria (H40, H41), reporta llegada a terreno capturando coordenadas GPS (H42), adjunta evidencia multimedia fotográfica/documental (H43), solicita apoyos adicionales estructurados (H44), emite informe final de cierre con materiales consumidos (H68) y transmite telemetría GPS (H70).

> [!IMPORTANT]
> **Exclusiones de rol:**
> - El rol **Informante** vive en `sgrai-web` (Portal Ciudadano).
> - Las vistas de Call Center, Centro de Mando (Encargado), Supervisor y Administrador residen en `sgrai-web`.
> - Este repositorio **no contiene lógica de negocio propia**. Toda regla de negocio vive en `sgrai-api`, consumida vía HTTPS/REST con tokens JWT y WebSockets de Socket.io.

---

## 2. Stack tecnológico de este repositorio

- **Framework:** Next.js 16 (React 19) con TypeScript, configurado como **PWA (Progressive Web App)** con App Router y salida `output: "standalone"`.
- **Iconografía:** **`lucide-react`** exclusivamente. **Queda estrictamente prohibido el uso de emojis** en componentes de interfaz, títulos o botones.
- **Tipografía:** **Noto Sans** cargada institucionalmente vía `next/font/google` (`--font-noto-sans`).
- **Almacenamiento Offline:** IndexedDB gestionado tipadamente mediante `idb` para persistir misiones, catálogos y la cola local de mutaciones pendientes (`outbox`).
- **Capacidades nativas vía navegador:** Geolocation API (GPS de alta precisión) y Media Capture API (cámara fotográfica del dispositivo).
- **Tiempo real:** Cliente `socket.io-client` para suscripción a salas de unidad (`patrulla:{id}`, `cuadrilla:{id}`) y emisión de telemetría a la sala `mapa`.
- **Testing:** **Vitest** con `@testing-library/react` y mocks de almacenamiento en `src/test/setup.ts`.
- **Infraestructura:** Docker (multi-stage build), servido bajo HTTPS detrás de Caddy en despliegue On-Premise.

---

## 3. Consideraciones de diseño móvil y ergonomía en terreno

A diferencia de `sgrai-web`, este cliente debe diseñarse asumiendo las condiciones del trabajo de emergencia en terreno:

- **Conectividad no confiable (Offline-First):** Las acciones críticas (aceptar, rechazar, reportar llegada, adjuntar fotos, cerrar faena) deben almacenarse en la cola local de IndexedDB si se pierde la red y sincronizarse automáticamente en orden al restablecer conexión.
- **Uso a una mano / con guantes:** Los botones de acción deben tener una altura mínima de **48px** (`min-height: 48px`), espaciado holgado y áreas táctiles generosas.
- **Legibilidad bajo luz solar directa:** Alto contraste entre texto y fondo. Colores sólidos sin degradados ni sombras tenues.
- **Barra de estado de conexión persistente:** Componente `<ConnectionStatusBadge />` siempre visible en la cabecera, indicando claramente:
  - `Sincronizado` (`--color-sage` `#A9CBA4`)
  - `Sin conexión / Trabajando offline` (`--color-charcoal` `#3B3F45`)
  - `Sincronizando (N pendientes)...` (`--color-accent-mint` `#4FAE9B`)
- **Compresión de medios:** Todo adjunto fotográfico capturado por la cámara debe comprimirse en cliente antes de persistirse en la cola local para no saturar el almacenamiento ni el ancho de banda al sincronizar.

---

## 4. Guía visual: paleta de colores y tokens de diseño

Usa la misma paleta e identidad institucional que `sgrai-web` (derivada de la Municipalidad de Valdivia, www.valdivia.cl):

### Paleta de colores (`src/styles/tokens.css`)

| Token | Uso | Hex |
|---|---|---|
| `--color-primary-teal` | Encabezados de pantalla, enlaces, acentos | `#1B6F7D` |
| `--color-primary-teal-dark` | Barra superior institucional de cabecera | `#14505A` |
| `--color-accent-mint` | Botón de acción principal ("Aceptar Misión", "Llegada a Terreno", "Enviar Reporte") | `#4FAE9B` |
| `--color-sage` | Franjas utilitarias y badge de sincronización exitosa | `#A9CBA4` |
| `--color-charcoal` | Botones secundarios, tarjetas de detalle de misión | `#3B3F45` |
| `--color-charcoal-dark` | Fondos oscuros de pie de página | `#24272B` |
| `--color-bg-light` | Fondo general de pantallas | `#ECEFF3` |
| `--color-white` | Fondo de tarjetas y formularios | `#FFFFFF` |
| `--color-text-dark` | Texto principal sobre fondo claro | `#2B2B2B` |
| `--color-text-light` | Texto sobre fondos oscuros | `#FFFFFF` |
| `--color-text-muted` | Textos secundarios y metadatos | `#5F676E` |

### Estados semánticos de alerta

| Token | Uso | Valor |
|---|---|---|
| `--color-danger` / `--color-danger-bg` | Error, rechazo motivado, dictamen no abordable | `#D32F2F` / `#FFEBEE` |
| `--color-success` / `--color-success-bg` | Éxito, llegada reportada, misión aceptada | `#2E7D32` / `#E8F5E9` |
| `--color-warning` / `--color-warning-bg` | Precaución, desconexión de red, batería baja | `#E65100` / `#FFF3E0` |
| `--color-info` / `--color-info-bg` | Información técnica, instrucciones de despacho | `#1B6F7D` / `#E0F2F1` |

### Reglas de componentes visuales

- **Botones con esquinas rectas obligatorias:** `--radius-none: 0px` (sin excepción para ninguna acción interactiva). Prohibido el uso de `border-radius` curvo o estilo "pill".
- **Diseño plano (Flat UI):** Sin sombras de elevación (`--shadow-none: none`).
- **Tipografía:** Noto Sans en toda la aplicación mediante la variable `--font-noto-sans`.

---

## 5. Comunicación con el backend (`sgrai-api`)

- **Autenticación:** Toda solicitud autenticada inyecta la cabecera `Authorization: Bearer <token>` mediante `src/lib/api/client.ts`. El token se obtiene de `POST /api/seguridad/login`.
- **Generación de Tipos OpenAPI:** Los tipos de datos de request/response se generan automáticamente con `npm run api:generate` hacia `src/types/api-generated.d.ts`. Nunca se escriben tipos de API a mano.
- **Validación en cola offline:** Antes de almacenar una mutación en IndexedDB, el payload se valida contra los esquemas Zod correspondientes para garantizar que ningún dato corrupto quede atrapado en la cola.

### Endpoints y Contratos Principales Consumidos

| Método | Endpoint | Historia | Propósito |
|---|---|---|---|
| `POST` | `/api/seguridad/login` | H59 | Inicio de sesión de funcionario (RUT/Email + Contraseña). |
| `GET` | `/api/seguridad/usuario-activo` | H66 | Consulta de perfil, rol y permisos del usuario en sesión. |
| `POST` | `/api/misiones/{id}/aceptar` | H36, H40 | Aceptación de misión (patrulla o cuadrilla), transición a `EN_CURSO`. |
| `POST` | `/api/misiones/{id}/rechazar` | H41, H69 | Rechazo motivado de misión con justificación obligatoria (>= 5 chars). |
| `POST` | `/api/misiones/{id}/llegada` | H42 | Reporte de arribo a terreno con coordenadas GPS (`mision_hito`). |
| `PATCH` | `/api/incidentes/{id}/tipologia` | H37 | Reclasificación de tipología en terreno desde catálogo oficial. |
| `PATCH` | `/api/incidentes/{id}/prioridad` | H38 | Asignación de prioridad con justificación ante discrepancia. |
| `POST` | `/api/misiones/{id}/reporte` | H39 | Informe técnico o dictamen `NO_ABORDABLE` (justificación >= 15 chars). |
| `POST` | `/api/evidencia/adjuntos` | H43 | Subida multipart de evidencias fotográficas o documentales. |
| `POST` | `/api/misiones/{id}/apoyo` | H44 | Solicitud estructurada de recursos o personal adicional. |
| `POST` | `/api/misiones/{id}/cerrar` | H68 | Cierre técnico final de cuadrilla con materiales e insumos consumidos. |

### Eventos en Tiempo Real (Socket.io)

- **Salas de escucha:** Al autenticarse, el cliente se une a `patrulla:{patrullaId}` o `cuadrilla:{cuadrillaId}` según su perfil.
- **Evento `mision:asignada`:** Despliega banner emergente visual y vibración de alta prioridad (H35).
- **Evento `telemetria:posicion`:** Emitido periódicamente por la PWA hacia el servidor con `{ unidadId, tipoUnidad, lat, lng, timestamp }` mientras la misión esté `EN_CURSO` (H70).

---

## 6. Reglas de negocio críticas para terreno

1. **Liberación de Patrulla al Despachar Cuadrilla (§3.2):** Cuando el Centro de Mando despacha una cuadrilla pesada tras la evaluación, la patrulla verificadora queda **liberada automáticamente** en estado `DISPONIBLE`.
2. **Rechazo Motivado Estricto (§3.3):** Ninguna patrulla ni cuadrilla puede rechazar una misión sin justificación técnica obligatoria (mínimo 5 caracteres).
3. **Dictamen de No Abordabilidad (H39):** La patrulla verificadora puede dictaminar que el incidente es `NO_ABORDABLE` (predio privado inaccesible, faja fiscal externa o falsa alarma) ingresando una justificación de al menos 15 caracteres, cerrando la misión y liberando la patrulla a `DISPONIBLE`.
4. **Prioridad Fundada (H38):** Si la patrulla ajusta la prioridad calculada preliminarmente por el sistema, debe ingresar obligatoriamente una justificación de al menos 5 caracteres.
5. **Exclusión de DIDECO:** La gestión social corresponde exclusivamente al levantamiento de la Ficha Básica de Emergencia (FIBE) por la Asistente Social de la DGRD. DIDECO está completamente fuera de alcance.

---

## 7. Estructura y Manuales de Usuario

- **Ubicación estándar:** `/docs/manuals/` en la raíz de este repositorio.
- **Convención:** `H<numero>-<slug-corto>.md` (ej. `H36-aceptar-mision-patrulla.md`, `H41-rechazar-mision-cuadrilla.md`).
- **Sección obligatoria en cada manual:**
  - **Comportamiento sin conexión:** Cómo responde la pantalla si el usuario ejecuta la acción sin cobertura celular, indicación visual de cola local pendiente y reintento automático.
  - **Permisos del dispositivo:** Pasos para autorizar el uso de GPS y cámara en navegadores móviles.

---

## 8. Flujo de trabajo de desarrollo

- **Ramas:** Gitflow (`main`, `develop`, ramas `feature/H<numero>-<slug>`).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- **Integración:** PR hacia `develop` &rarr; Pair Review &rarr; PO Review &rarr; Merge.

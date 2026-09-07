@AGENTS.md

# GEMINI.md — sgrai-pwa

Este archivo da contexto arquitectónico a cualquier asistente de IA que trabaje sobre este repositorio, que es la **aplicación de terreno (PWA)** del Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI), de la Dirección de Gestión de Riesgos de Desastres de la Municipalidad de Valdivia.

## 1. Rol de este repositorio en el sistema

`sgrai-pwa` es el cliente de **presentación para personal en terreno**, agrupado en el diagrama de componentes bajo "App terreno". Cubre exclusivamente estos dos roles:

- **Patrulla Verificadora** — recibe notificación de incidente, confirma asistencia, categoriza el incidente en terreno, sugiere/ajusta prioridad, envía reportes de situación.
- **Delegado de Cuadrilla** — acepta o rechaza misiones (con justificación), reporta llegada y estado inicial, adjunta fotos/videos/documentos, indica faltantes de recursos.

> Importante: **este repositorio no incluye el rol Informante**. Según el diagrama de componentes, el Portal Informante vive en `sgrai-web`. Este repositorio se reserva para personal operativo desplazado en terreno, que sí necesita capacidades nativas (GPS, cámara) y tolerancia a conectividad intermitente.

Este repositorio **no contiene lógica de negocio propia**. Toda regla de negocio vive en `sgrai-api`, consumida vía HTTPS/REST y Socket.io (para notificaciones push de nuevos incidentes/misiones en tiempo real).

## 2. Stack tecnológico de este repositorio

- **Framework:** Next.js (React) con TypeScript, configurado como **PWA (Progressive Web App)**.
- **Capacidades nativas vía navegador:** acceso a GPS y cámara del dispositivo (necesario para geolocalización de reportes y adjuntar evidencia fotográfica/video desde terreno).
- **Soporte offline:** es un requisito de diseño explícito del proyecto — service workers y estrategia de caché/sincronización para que la app funcione con conectividad intermitente típica de zonas de emergencia, sincronizando al recuperar señal.
- **Tiempo real:** cliente de Socket.io para recibir notificaciones push inmediatas de nuevas asignaciones.
- **Infraestructura:** Docker, servido detrás de Caddy junto con `sgrai-api` y `sgrai-web` en el mismo despliegue On-Premise.

## 3. Consideraciones específicas de diseño para este repositorio

A diferencia de `sgrai-web`, este cliente debe diseñarse asumiendo:

- **Conectividad no confiable:** las acciones críticas (confirmar asistencia, reportar llegada, adjuntar evidencia) deben poder quedar en cola local y sincronizarse cuando vuelva la conexión, en vez de fallar silenciosamente sin señal.
- **Uso a una mano / en movimiento:** prioriza UI simple y de alto contraste sobre densidad de información (a diferencia del Centro de Mando en `sgrai-web`, que sí puede ser denso en datos).
- **Adjuntos multimedia:** el flujo de subida de fotos/videos debe considerar compresión o subida progresiva, dado que el ancho de banda en terreno puede ser limitado.

## 4. Guía visual: paleta de colores y estilo de UI

Usa la misma paleta e identidad visual que `sgrai-web`, derivada del sitio institucional de la Municipalidad de Valdivia (www.valdivia.cl), para que ambos clientes se perciban como un mismo sistema. **No** tomes como referencia colores de banners de noticias/campañas puntuales del sitio — son contenido editorial variable, no parte de la paleta de marca.

### Paleta de colores (misma que `sgrai-web`)

| Token | Uso | Aproximación |
|---|---|---|
| `--color-primary-teal` | Encabezados, texto de enlaces | `#1B6F7D` |
| `--color-primary-teal-dark` | Barra superior/navegación | `#14505A` |
| `--color-accent-mint` | Botón de acción principal (ej. "Confirmar asistencia", "Enviar reporte") | `#4FAE9B` |
| `--color-sage` | Franjas utilitarias (ej. barra de estado de conexión) | `#A9CBA4` |
| `--color-charcoal` | Bloques secundarios, tarjetas de misión/incidente | `#3B3F45` |
| `--color-charcoal-dark` | Fondos oscuros de alto contraste | `#24272B` |
| `--color-bg-light` | Fondo general de pantallas | `#ECEFF3` |
| `--color-white` | Tarjetas, formularios | `#FFFFFF` |
| `--color-text-dark` / `--color-text-light` | Texto sobre fondo claro / oscuro | `#2B2B2B` / `#FFFFFF` |

### Estilo de componentes, con ajustes propios de este repositorio

- **Botones: esquinas rectas, no redondeadas** (igual que `sgrai-web`) — sin excepción para las acciones críticas de este repositorio (confirmar, rechazar, reportar).
- **Diseño plano**, sin sombras ni degradados, igual que el sitio de referencia.
- **Ajuste por contexto de uso en terreno (no presente en `sgrai-web`):**
  - Botones de acción más grandes de lo habitual (objetivo táctil amplio, pensado para uso con una mano o con guantes).
  - Mayor contraste entre texto y fondo que en `sgrai-web`, priorizando legibilidad bajo luz solar directa por sobre densidad de información.
  - Estado de conexión (online/offline/sincronizando) siempre visible en la interfaz, usando `--color-sage` para "sincronizado" y `--color-charcoal` o un tono de alerta para "pendiente de sincronizar" — no un ícono discreto que pueda pasar desapercibido.
- **Tarjetas de misión/incidente:** mismo estilo plano de tarjeta blanca de `sgrai-web`, pero con menos elementos por tarjeta (evitar la densidad de carrusel de noticias del sitio de referencia; aquí prima una acción clara por pantalla).

## 5. Comunicación con el backend

- Nunca dupliques reglas de negocio aquí (ej. validación de campos obligatorios de un reporte de terreno) — deben vivir en `sgrai-api`; en el cliente solo se reflejan como validación de UX, no como fuente de verdad.
- Cambios de UI que impliquen un endpoint nuevo o modificado en `sgrai-api` requieren coordinación previa con ese repositorio.
- **Nunca escribas a mano los tipos de request/response de la API.** Se generan automáticamente desde el spec OpenAPI que expone `sgrai-api`, igual que en `sgrai-web`, para que este repositorio tampoco pueda divergir silenciosamente del contrato real.

### Cómo consumir la API en este repositorio

1. Se generan los tipos desde el spec de `sgrai-api` como parte del build (idealmente automatizado en CI):

   ```bash
   npx openapi-typescript https://api.sgrai.cl/openapi.json -o src/types/api-generated.d.ts
   ```

2. Las llamadas usan un cliente tipado (ej. `openapi-fetch`) basado en esos tipos generados, igual que en `sgrai-web`:

   ```typescript
   import createClient from 'openapi-fetch';
   import type { paths } from '@/types/api-generated';

   const client = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_URL });

   const { data, error } = await client.POST('/misiones/{id}/reporte', {
     params: { path: { id: misionId } },
     body: { estado: 'En terreno', faltantes: ['agua potable'] },
   });
   ```

3. **Particularidad de este repositorio por el soporte offline:** cuando una acción se encola localmente por falta de conexión, valida el payload contra el tipo generado **antes** de guardarlo en la cola local, no solo al momento de reintentar el envío. Así, si el contrato de la API cambió mientras el dispositivo estaba offline, el error de tipos aparece al construir la app (o al abrir la cola pendiente), no como un fallo silencioso de sincronización días después.

## 6. Reglas de negocio relevantes para este repositorio

- Al confirmar asistencia, la Patrulla Verificadora debe poder **categorizar el tipo de incidente** y **ajustar la prioridad sugerida por el sistema** según lo que observa en terreno — la UI no debe forzar la categorización inicial del Call Center como definitiva.
- Cuando se despacha una cuadrilla u otro recurso tras la verificación, la patrulla verificadora queda **liberada** — el cliente debe reflejar ese cambio de estado (vuelve a estar disponible para nueva asignación).
- El Delegado de Cuadrilla puede **rechazar** una misión, pero el formulario debe **exigir una justificación** — no permitir rechazo sin motivo.
- El reporte de terreno debe permitir indicar **faltantes de recursos materiales o humanos**, para que la central gestione apoyo adicional — no es solo un campo de texto libre, considerar un mecanismo estructurado (checklist o selección de tipo de recurso faltante) que facilite la gestión desde `sgrai-web`.

## 7. Roles y flujos de este repositorio

| Rol | Flujo principal |
|---|---|
| Patrulla Verificadora | Recibir notificación → confirmar asistencia → categorizar incidente → ajustar prioridad → enviar reporte de situación |
| Delegado de Cuadrilla | Recibir asignación → aceptar o rechazar (con justificación) → reportar llegada/estado inicial → adjuntar evidencia → reportar faltantes de recursos |

## 8. Manuales de usuario

Cada funcionalidad de cara a Patrulla Verificadora o Delegado de Cuadrilla debe entregarse junto con su manual de usuario, no como una tarea aparte para después.

- **Ubicación estándar:** `/docs/manuales-usuario/` en la raíz de este repositorio (misma convención que `sgrai-web`, pero cada repositorio mantiene los suyos porque documentan pantallas distintas).
- **Convención de nombre:** `H<numero>-<slug-corto>.md`, siguiendo el ID de la historia de usuario correspondiente (ej. `H36-confirmar-asistencia.md`, `H41-rechazar-mision.md`).
- **Cuándo se crea:** como parte del mismo PR que implementa la funcionalidad — no se documenta después, en un PR aparte.
- **Contenido mínimo de cada manual**, además de lo que aplica en `sgrai-web` (rol, objetivo, pasos con capturas en `/docs/manuales-usuario/assets/<mismo-slug>/`, casos especiales):
  - **Comportamiento sin conexión:** qué le aparece al usuario si realiza la acción sin señal, cómo sabe que quedó en cola local, y qué pasa si la sincronización falla al recuperar conexión (esto es específico de este repositorio y no debe omitirse).
  - Requisitos de permisos del dispositivo (GPS, cámara) que el manual debe explicar cómo conceder la primera vez.

## 9. Flujo de trabajo de desarrollo (aplica a los 3 repositorios)

- **Ramas:** Gitflow.
- **Versionado:** SemVer.
- **Commits:** Conventional Commits.
- **Integración:** toda funcionalidad nace en una rama nueva → PR → **Pair Review** obligatoria (otro desarrollador) → **PO Review** obligatoria → merge solo con ambas aprobaciones.

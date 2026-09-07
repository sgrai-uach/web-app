# SGRAI — App Terreno (PWA)

Aplicacion de terreno (Progressive Web App) del **Sistema de Gestion de Recursos para Atencion de Incidentes (SGRAI)**, desarrollado para la Direccion de Gestion de Riesgos de Desastres de la Municipalidad de Valdivia.

## Descripcion

Este repositorio contiene el cliente de presentacion para **personal operativo desplegado en terreno**. A diferencia del portal web (`sgrai-web`), esta aplicacion esta disenada para funcionar en condiciones de conectividad intermitente, con acceso a capacidades nativas del dispositivo (GPS, camara) y una interfaz optimizada para uso en movimiento.

### Roles cubiertos

- **Patrulla Verificadora**: recibe notificacion de incidente, confirma asistencia, categoriza el incidente en terreno, ajusta prioridad y envia reportes de situacion.
- **Delegado de Cuadrilla**: acepta o rechaza misiones (con justificacion obligatoria), reporta llegada y estado inicial, adjunta evidencia fotografica/video e indica faltantes de recursos.

> Nota: el rol de Informante no esta incluido en este repositorio. El Portal Informante se encuentra en `sgrai-web`.

## Stack tecnologico

| Tecnologia | Proposito |
|---|---|
| Next.js (React) | Framework principal, configurado como PWA |
| TypeScript | Tipado estatico |
| Vanilla CSS | Estilos, sin frameworks CSS externos |
| Socket.io (cliente) | Notificaciones push en tiempo real |
| Service Workers | Soporte offline y sincronizacion |
| Docker | Contenedorizacion para despliegue On-Premise |

## Estructura del proyecto

```
src/
  app/            # Rutas y layouts (App Router de Next.js)
  components/     # Componentes React reutilizables
  hooks/          # Custom hooks (conectividad, geolocalizacion, etc.)
  lib/            # Cliente API tipado y utilidades compartidas
  services/       # Sincronizacion offline, cola local, Socket.io
  types/          # Tipos generados desde OpenAPI (no editar manualmente)
docs/
  manuales-usuario/   # Manuales por historia de usuario (H<n>-<slug>.md)
    assets/            # Capturas de pantalla para manuales
```

## Desarrollo local

### Requisitos previos

- Node.js >= 24
- npm >= 12

### Instalacion

```bash
npm install
```

### Variables de entorno

Copiar el archivo de ejemplo y completar los valores:

```bash
cp .env.example .env.local
```

| Variable | Descripcion |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL base de la API REST (`sgrai-api`) |
| `NEXT_PUBLIC_SOCKET_URL` | URL del servidor Socket.io |

### Ejecucion

```bash
npm run dev
```

### Generacion de tipos de API

Los tipos de request/response se generan automaticamente desde el spec OpenAPI de `sgrai-api`. No se deben escribir manualmente.

```bash
npm run api:generate
```

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

## Comunicacion con el backend

Este repositorio no contiene logica de negocio propia. Toda regla de negocio reside en `sgrai-api` y se consume via HTTPS/REST y Socket.io.

Los tipos de la API se generan desde el spec OpenAPI y las llamadas se realizan mediante un cliente tipado (`openapi-fetch`). Nunca se deben escribir tipos de request/response a mano.

## Convenciones de desarrollo

| Aspecto | Convencion |
|---|---|
| Ramas | Gitflow (`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`) |
| Versionado | SemVer |
| Commits | Conventional Commits |
| Integracion | PR con Pair Review + PO Review obligatorias |

## Licencia

Uso interno — Municipalidad de Valdivia.

# SGRAI — App Terreno (PWA)

Cliente de presentación para **personal operativo en terreno** del **Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI)** de la Dirección de Gestión de Riesgos de Desastres de la Municipalidad de Valdivia.

Este cliente atiende exclusivamente a los roles de **Patrulla Verificadora** y **Delegado de Cuadrilla**, proporcionando capacidades nativas de geolocalización (GPS), captura de evidencia fotográfica (Cámara), alertas en tiempo real y soporte **offline-first** para operar en zonas de catástrofe sin cobertura de red.

---

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Framework | Next.js 16 (React 19) con TypeScript y App Router |
| Arquitectura | Progressive Web App (PWA) con Service Worker y Web App Manifest |
| Persistencia Offline | IndexedDB (`idb`) para colas locales de mutación |
| Estilos | Vanilla CSS con CSS Modules y tokens de diseño municipales planos |
| Iconografía | Lucide Icons (`lucide-react`) — Prohibido el uso de emojis |
| Tiempo Real | Socket.io Client (`socket.io-client`) |
| Cliente API | `openapi-fetch` con tipos autogenerados |
| Pruebas Unitarias | Vitest con React Testing Library y JSDOM |
| Contenedores | Docker (multi-stage) servido tras Caddy On-Premise |

---

## Estructura del Proyecto

```
web-app/
├── src/
│   ├── app/                 # Rutas y layouts (App Router de Next.js)
│   │   ├── manifest.ts      # Manifiesto oficial PWA
│   │   ├── layout.tsx       # Envoltorio con Noto Sans y ToastProvider
│   │   └── globals.css      # Reset y estilos globales
│   ├── components/          # Componentes React reutilizables
│   │   ├── ui/              # Componentes base planos (Button, Heading, Input, etc.)
│   │   └── terreno/         # Componentes específicos de patrulla y cuadrilla
│   ├── context/             # Proveedores globales de sesión (AuthContext)
│   ├── hooks/               # Custom hooks (conectividad, telemetría, GPS)
│   ├── lib/                 # Cliente API tipado y utilidades seguras
│   ├── services/            # Cola local IndexedDB (Outbox) y sincronización
│   ├── styles/              # Tokens de diseño institucionales (tokens.css)
│   ├── test/                # Configuración y mocks para Vitest (setup.ts)
│   └── types/               # Tipos generados desde OpenAPI (api-generated.d.ts)
├── public/
│   ├── sw.js                # Service Worker para caché y sincronización diferida
│   └── favicon.*, *.png     # Iconos institucionales PWA
├── docs/
│   ├── architecture/        # Guía técnica de arquitectura offline-first
│   ├── design/              # Tokens de diseño y catálogo de componentes
│   ├── api/                 # Contratos de endpoints y eventos WebSocket
│   ├── qa/                  # Matrices de pruebas IEEE 829
│   └── manuals/             # Manuales de usuario por historia (H<n>-<slug>.md)
├── AGENTS.md                # Directrices estrictas para agentes de IA
├── CLAUDE.md                # Referencias de contexto para asistentes
├── GEMINI.md                # Guía maestra arquitectónica de la PWA
└── package.json             # Dependencias y scripts del proyecto
```

---

## Desarrollo Local

### Requisitos Previos

- Node.js >= 24
- npm >= 12
- Instancia activa de `sgrai-api` (por defecto en puerto 3001)

### Instalación

```bash
npm install
```

### Variables de Entorno

Copiar el archivo de ejemplo y configurar las URLs correspondientes:

```bash
cp .env.example .env.local
```

| Variable | Descripción | Valor por Defecto Local |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base de la API REST (`sgrai-api`) | `http://localhost:3001` |
| `NEXT_PUBLIC_SOCKET_URL` | URL del servidor Socket.io | `http://localhost:3001` |

> [!IMPORTANT]
> **Requisito de HTTPS para Geolocation y Cámara:**
> Los navegadores modernos exigen un contexto seguro (`HTTPS` o `localhost`) para permitir el acceso al GPS y la cámara del dispositivo móvil. En entorno de desarrollo para pruebas móviles en red local, se recomienda acceder a través del reverse proxy Caddy configurado con certificados locales.

### Scripts Disponibles

```bash
# Iniciar servidor de desarrollo en http://localhost:3000
npm run dev

# Ejecutar la suite de pruebas unitarias y de componentes con Vitest
npm test

# Ejecutar pruebas en modo observador (watch)
npm run test:watch

# Validar reglas de linter
npm run lint

# Regenerar tipos TypeScript desde el spec OpenAPI de sgrai-api
npm run api:generate

# Compilar para producción
npm run build

# Iniciar servidor de producción
npm start
```

---

## Documentación del Proyecto

- **Directrices para Agentes de IA:** [`AGENTS.md`](./AGENTS.md)
- **Guía Arquitectónica Maestra:** [`GEMINI.md`](./GEMINI.md)
- **Manuales de Usuario de Terreno:** [`docs/manuals/`](./docs/manuals/)

---

## Licencia

Uso interno — Dirección de Gestión de Riesgos de Desastres (DGRD), Ilustre Municipalidad de Valdivia.

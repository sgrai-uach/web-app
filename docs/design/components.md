# Catálogo de Componentes UI — `sgrai-pwa`

Este documento describe los componentes visuales reutilizables construidos en `src/components/ui/`, `src/components/common/` y `src/components/terreno/` bajo TypeScript, React y CSS Modules *Mobile-First*.

---

## 1. `<Button />`

Componente principal para acciones táctiles de terreno con esquinas rectas (`--radius-none`), soporte para estados de carga (*spinners* sin solapamiento), iconos vectoriales y enlace tipo botón con Next.js `<Link>`.

### Props
| Prop | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'teal' \| 'destructive' \| 'outline' \| 'ghost'` | `'primary'` | Jerarquía cromática institucional. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Altura táctil (`sm: 38px`, `md: 48px`, `lg: 54px`). |
| `href` | `string` | `undefined` | Si está presente, renderiza un `<Link>`. |
| `fullWidth` | `boolean` | `false` | Ocupa el 100% del ancho del contenedor. |
| `loading` | `boolean` | `false` | Muestra spinner y bloquea eventos de clic. |
| `disabled` | `boolean` | `false` | Deshabilita el botón. |
| `icon` | `React.ReactNode` | `undefined` | Icono vectorial de `lucide-react`. |
| `iconPosition` | `'left' \| 'right'` | `'left'` | Posición del icono. |

---

## 2. `<Heading />`

Desacopla la etiqueta semántica HTML (`as`) de la escala tipográfica visual (`variant`), garantizando la jerarquía de accesibilidad sin comprometer el diseño.

### Props
| Prop | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `as` | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'h5' \| 'h6' \| 'p' \| 'span'` | Infiere de `variant` | Etiqueta semántica en el DOM. |
| `variant` | `'display' \| 'h1' \| 'h2' \| 'h3' \| 'h4' \| 'h5' \| 'subtitle'` | Infiere de `as` o `'h2'` | Estilo visual del encabezado. |
| `color` | `'teal-dark' \| 'teal' \| 'charcoal-dark' \| 'charcoal' \| 'white' \| 'inherit'` | `'teal-dark'` | Token de color institucional. |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | Alineación del texto. |
| `noMargin` | `boolean` | `false` | Remueve márgenes superior e inferior. |

---

## 3. `<Input />`, `<Select />` y `<Textarea />`

Controles de entrada planos con foco accesible teal de 2px, fuente de `16px` (`1rem`) para evitar auto-zoom en navegadores móviles, etiquetas asociadas por `id` y mensajes de error con soporte de `aria-invalid` y `role="alert"`.

---

## 4. `<ConnectionStatusBadge />`

Barra de conectividad persistente que informa al funcionario en terreno si su dispositivo se encuentra sincronizado con el servidor central, operando en modo offline o transmitiendo datos pendientes. Soporta exportación nombrada (`{ ConnectionStatusBadge }`) y por defecto.

### Props
| Prop | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `connected` | `boolean` | `true` | Estado de conectividad de red. |
| `pendingCount` | `number` | `0` | Cantidad de mutaciones en cola local de IndexedDB. |
| `status` | `'connected' \| 'offline' \| 'syncing'` | Infiere | Estado forzado opcional. |
| `onRetry` | `() => void` | `undefined` | Callback al pulsar el badge para reintentar sincronización manual. |

---

## 5. Componentes del Hub y Navegación de Terreno (`src/components/terreno/`)

### 5.1 `<TerrenoBottomNav />`
Barra de navegación inferior fija (`min-height: 56px`, ubicada en la *Thumb Zone* móvil) que adapta el patrón `AppSidebar` de `sgrai-web` para teléfonos en terreno.
- **Pestañas incluidas:**
  1. `Inicio` (`/`) — Hub Operativo de Terreno.
  2. `Misiones` / `Faenas` (`/patrulla/misiones` o `/cuadrilla/misiones` según el rol activo).
  3. `Sincronizar` — Botón de sincronización manual con indicador de pendientes (`pendingCount`).
  4. `Portal` (`http(s)://<host>/`) — Retorno a la portada general de SGRAI.

### 5.2 `<TerrenoWelcomeBanner />`
Banner institucional de bienvenida en `/terreno` homologado con `GestionWelcomeBanner` de `sgrai-web`, adaptado en CSS Modules *Mobile-First* (apilado vertical en `< 640px`, fila horizontal en `>= 640px`).

### 5.3 `<TerrenoResumenOperativo />`
Panel de resumen con tarjetas de estado de la unidad (incluyendo `<UnidadInactivaBanner />` cuando `unidadActiva === false` para H82/H85) y estado de la cola de sincronización offline (`IndexedDB`).

### 5.4 `<TerrenoModulosGrid />`
Catálogo dinámico de módulos y funcionalidades habilitadas en terreno filtrado por el rol (`PATRULLA_VERIFICADORA` o `DELEGADO_CUADRILLA`) y permisos RBAC del usuario activo. En móvil renderiza tarjetas en 1 columna con botones de acción de `48px` a ancho completo (`100%`).

---

## 6. `<ToastProvider />` y `useToast`

Sistema universal de alertas flotantes montado en la raíz (`layout.tsx`).

# Sistema de Diseño Institucional — `sgrai-pwa` (App Terreno)

Este documento define la filosofía, principios rectores, tokens de diseño, matriz de adaptación *Mobile-First* respecto a `sgrai-web` y arquitectura de navegación para la aplicación progresiva de terreno (PWA) del **Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI)** de la Ilustre Municipalidad de Valdivia.

---

## 1. Filosofía y Principios Rectores en Terreno

1. **Identidad Municipal Compartida con `sgrai-web`:**
   - La interfaz mantiene la identidad institucional de la Municipalidad de Valdivia (`www.valdivia.cl`) definida en `sgrai-web`, compartiendo paleta de colores, tipografía y semántica de alertas.

2. **Diseño Plano Estricto (Flat UI) y Esquinas Rectas:**
   - Todos los elementos interactivos (botones, inputs, selectores, modales, tarjetas, barras de navegación) poseen esquinas rectas obligatorias (`borderRadius: 0` / `--radius-none: 0px`).
   - El contraste y la jerarquía se logran a través de bloques de color sólido, sin degradados ni sombras pronunciadas de elevación (`--shadow-none`).
   - La única excepción permitida para bordes redondeados son los indicadores circulares de estado (`--radius-round: 9999px`).

3. **Prioridad Absoluta de Responsividad *Mobile-First* y Ergonomía Táctil:**
   - **Objetivos táctiles mínimos de 48px (`min-height: 48px`):** Todo botón de acción principal, secundario o ítem de navegación inferior tiene una altura mínima de `48px` (`56px` en la barra inferior `TerrenoBottomNav`) para garantizar su pulsación certera a una mano o con guantes de faena.
   - **Zona del Pulgar (*Thumb Zone*):** La navegación principal se ubica en la barra inferior fija (`TerrenoBottomNav`) al alcance directo del pulgar.
   - **Cero desbordamiento horizontal:** Toda vista se diseña en CSS Modules partiendo desde `320px` de ancho (`1 columna` al `100%`), escalando progresivamente en `@media (min-width: 640px)` y `@media (min-width: 1024px)`.

4. **Legibilidad bajo Luz Solar Directa:**
   - Alto contraste verificado (cumplimiento WCAG AAA/AA) entre texto y fondo.
   - Tipografía corporativa **Noto Sans** cargada institucionalmente vía `next/font/google` (`--font-noto-sans`).
   - Indicador de foco visible estandarizado (`:focus-visible`) con anillo teal de `2px` y `outline-offset: 2px`.

5. **Prohibición Absoluta de Emojis:**
   - Queda estrictamente prohibido utilizar emojis en componentes visuales, botones, alertas o títulos.
   - Toda la iconografía técnica se construye exclusivamente con **`lucide-react`** (SVG vectoriales sobrios y estandarizados).

6. **Visibilidad Persistente de Conectividad:**
   - En la cabecera superior se incluye permanentemente el indicador `<ConnectionStatusBadge />` informando el estado: *Sincronizado*, *Trabajando offline* o *Sincronizando (N pendientes)...*, con capacidad de reintento manual (`onRetry`).

---

## 2. Matriz de Adaptación *Mobile-First* (`sgrai-web` $\rightarrow$ `sgrai-pwa`)

Cuando una decisión de diseño de `sgrai-web` (pensada para monitores de oficina) no resulta ergonómica en teléfonos móviles en terreno, se aplica obligatoriamente la siguiente adaptación:

| Aspecto de Diseño | En `sgrai-web` (Escritorio / Oficina) | Adaptación Obligatoria en `sgrai-pwa` (*Mobile-First* / Terreno) |
|---|---|---|
| **Navegación Principal (`AppSidebar` $\rightarrow$ `TerrenoBottomNav`)** | Barra lateral vertical izquierda de `240px` con grupos colapsables. | **Barra de navegación inferior fija (`TerrenoBottomNav`, `min-height: 56px`)** en la zona del pulgar con acceso en 1 toque a: *Inicio*, *Misiones / Faenas*, *Sincronizar* y *Portal SGRAI*. |
| **Estilos y Media Queries** | Uso de estilos inline con paddings de `28px`–`32px` y grids `minmax(320px, 1fr)`. | **CSS Modules *Mobile-First* (`*.module.css`):** Base desde `320px` (`padding: 16px`, `grid-template-columns: 1fr`), escalando en `@media (min-width: 640px)` y `@media (min-width: 1024px)`. |
| **Botones en Tarjetas de Módulos** | Botones compactos `size="sm"` (`36px` de alto) alineados en fila. | **Botones táctiles $\ge 48\text{px}$ (`size="md"`):** En móvil (`< 640px`), ocupan el **100% del ancho de la tarjeta** para pulsación segura con una mano o guantes. |
| **Banner de Bienvenida (`WelcomeBanner`)** | Distribución horizontal con badge de rol alineado a la derecha. | **Apilado vertical en móvil (`< 640px`):** Saludo con tipografía fluida (`clamp(1.15rem, 4.5vw, 1.5rem)`), badge de rol y unidad alineados a la izquierda; fila horizontal en `>= 640px`. |
| **Alertas Operativas Críticas** | Notificaciones exclusivamente vía toasts flotantes. | **Banners persistentes de alto contraste para estados críticos en terreno:** `<UnidadInactivaBanner />` (H82/H85) y `<ConnectionStatusBadge />` visibles permanentemente bajo luz solar. |
| **Tamaño de Fuente en Inputs** | `14px` (`--font-size-base`) en formularios de escritorio. | **`16px` (`1rem`) mínimo en inputs y botones** en móvil para evitar el auto-zoom forzado en iOS Safari y Chrome Android. |

---

## 3. Catálogo de Tokens CSS (`src/styles/tokens.css`)

### 3.1 Paleta Institucional
```css
--color-primary-teal: #1B6F7D;        /* Encabezados, enlaces y acentos principales */
--color-primary-teal-dark: #14505A;   /* Barra superior de cabecera, banner y títulos destacados */
--color-accent-mint: #4FAE9B;         /* Botones de acción principal e indicador activo en navegación */
--color-sage: #A9CBA4;                /* Badge de sincronización exitosa y subtítulos sobre fondo oscuro */
--color-charcoal: #3B3F45;            /* Botones secundarios, tarjetas de misión */
--color-charcoal-dark: #24272B;       /* Fondos oscuros y barra de navegación inferior */
--color-bg-light: #ECEFF3;            /* Fondo general de la app */
--color-white: #FFFFFF;               /* Fondo de tarjetas, formularios y texto en botones */
--color-text-dark: #2B2B2B;           /* Texto principal sobre fondo claro */
--color-text-light: #FFFFFF;          /* Texto sobre fondos oscuros */
--color-text-muted: #5F676E;          /* Metadatos y textos secundarios */
```

### 3.2 Estados Semánticos
```css
--color-danger: #D32F2F;              /* Error, rechazo motivado, no abordabilidad */
--color-danger-bg: #FFEBEE;
--color-danger-border: #FFCDD2;

--color-success: #2E7D32;             /* Éxito, llegada reportada, misión aceptada */
--color-success-bg: #E8F5E9;
--color-success-border: #A5D6A7;

--color-warning: #E65100;             /* Modo offline, unidad inactiva (H82/H85), precaución */
--color-warning-bg: #FFF3E0;
--color-warning-border: #FFE0B2;

--color-info: var(--color-primary-teal);
--color-info-bg: #E0F2F1;
--color-info-border: #B2DFDB;
```

### 3.3 Escala Tipográfica (Noto Sans)
| Token | Valor | Uso en Terreno |
|---|---|---|
| `--font-size-3xl` | `1.75rem` (28px) | Folios de emergencia destacados |
| `--font-size-2xl` | `1.5rem` (24px) | Título de pantalla principal (`h1`) |
| `--font-size-xl` | `1.25rem` (20px) | Título de misión o tarjeta (`h2`) |
| `--font-size-lg` | `1.125rem` (18px) | Encabezados de sección (`h3`), botones `lg` |
| `--font-size-md` | `1rem` (16px) | Inputs, selectores, botones `md` |
| `--font-size-base` | `0.875rem` (14px) | Textos de reporte, descripciones |
| `--font-size-sm` | `0.8125rem` (13px) | Etiquetas de campo, botones `sm` |
| `--font-size-xs` | `0.75rem` (12px) | Badges de estado, etiquetas de barra inferior |

### 3.4 Escala de Espaciado y Z-Index
- **Espaciado (Base 4px/8px):** `--space-1: 4px;` &bull; `--space-2: 8px;` &bull; `--space-3: 12px;` &bull; `--space-4: 16px;` &bull; `--space-5: 20px;` &bull; `--space-6: 24px;` &bull; `--space-8: 32px;` &bull; `--space-10: 40px;` &bull; `--space-12: 48px;`.
- **Capas Z-Index:** `--z-base: 1;` &bull; `--z-sticky: 100;` &bull; `--z-dropdown: 500;` &bull; `--z-drawer: 1000;` &bull; `--z-modal-backdrop: 2000;` &bull; `--z-modal: 2010;` &bull; `--z-toast: 9999;`.

---

## 4. Arquitectura de Layout y Hub Operativo de Terreno (`/terreno`)

Toda vista autenticada de terreno se envuelve en `<TerrenoLayout />` (sin cabecera superior redundante para maximizar el área útil en pantallas móviles) y se organiza alrededor del **Hub Operativo de Terreno (`/terreno`)**:

1. **Estructura del Hub Principal (`/terreno`):**
   - **`TerrenoWelcomeBanner`:** Muestra únicamente el saludo (`Bienvenido/a, {nombre}`) y el badge del rol asignado (`Rol: {rolNombre}`).
   - **`TerrenoResumenOperativo`:** Incluye el bloque de **Resumen Operativo** con contadores de misiones (*Pendientes*, *En Curso*, *Finalizadas*) y el bloque **Sincronización fuera de línea** con el texto *"Conexión estable con el servidor."* y el botón **"Sincronizar"**.
   - **`TerrenoModulosGrid`:** Cuadrícula limpia de módulos y operaciones habilitadas filtradas por rol (`PATRULLA_VERIFICADORA` o `DELEGADO_CUADRILLA`) y permisos RBAC, sin anotaciones ni badges internos.
2. **Barra de Navegación Inferior (`TerrenoBottomNav`):**
   - Fija en el borde inferior (`min-height: 56px` + `safe-area-inset-bottom`), con 3 pestañas de alto contraste en la zona del pulgar: *Inicio*, *Misiones / Faenas* y *Salir*.

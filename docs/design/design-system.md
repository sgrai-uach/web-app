# Sistema de Diseño Institucional — `sgrai-pwa` (App Terreno)

Este documento define la filosofía, principios rectores, tokens de diseño y directrices de ergonomía móvil para la aplicación progresiva de terreno (PWA) del **Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI)** de la Ilustre Municipalidad de Valdivia.

---

## 1. Filosofía y Principios Rectores en Terreno

1. **Diseño Plano Estricto (Flat UI) y Esquinas Rectas:**
   - Todos los elementos interactivos (botones, inputs, selectores, modales, tarjetas) poseen esquinas rectas obligatorias (`borderRadius: 0` / `--radius-none: 0px`).
   - El contraste se logra a través de bloques de color sólido, sin degradados ni sombras pronunciadas de elevación (`--shadow-none`).
   - La única excepción permitida para bordes redondeados son los indicadores circulares de estado (`--radius-round: 9999px`).

2. **Ergonomía de Emergencia y Uso Táctil:**
   - **Objetivos táctiles mínimos de 48px:** Todo botón de acción principal o secundario tiene una altura mínima de 48px (`min-height: 48px`) para garantizar su pulsación certera a una mano o con guantes de faena.
   - **Espaciado holgado:** Espacio suficiente entre acciones destructivas y de confirmación para evitar pulsaciones accidentales.

3. **Legibilidad bajo Luz Solar Directa:**
   - Alto contraste verificado (cumplimiento WCAG AAA/AA) entre texto y fondo.
   - Tipografía corporativa **Noto Sans** cargada institucionalmente vía `next/font/google` (`--font-noto-sans`).
   - Fondo general neutro `--color-bg-light` (`#ECEFF3`) y tarjetas blancas puras (`#FFFFFF`) con bordes sólidos definidos (`#3B3F45` y `#DFE3E8`).

4. **Prohibición Absoluta de Emojis:**
   - Queda estrictamente prohibido utilizar emojis (📞, 🚨, 📍, 📷, etc.) en componentes visuales, botones, alertas o títulos.
   - Toda la iconografía técnica se construye exclusivamente con **`lucide-react`** (SVG vectoriales sobrios y estandarizados).

5. **Visibilidad Persistente de Conectividad:**
   - En la cabecera superior se incluye permanentemente el indicador `<ConnectionStatusBadge />` informando el estado: *Sincronizado*, *Trabajando offline* o *Sincronizando (N pendientes)...*.

---

## 2. Catálogo de Tokens CSS (`src/styles/tokens.css`)

### 2.1 Paleta Institucional
```css
--color-primary-teal: #1B6F7D;        /* Encabezados, enlaces y acentos principales */
--color-primary-teal-dark: #14505A;   /* Barra superior de cabecera y títulos destacados */
--color-accent-mint: #4FAE9B;         /* Botones de acción principal (Aceptar, Llegada, Enviar) */
--color-sage: #A9CBA4;                /* Badge de sincronización exitosa y franjas utilitarias */
--color-charcoal: #3B3F45;            /* Botones secundarios, tarjetas de misión */
--color-charcoal-dark: #24272B;       /* Fondos oscuros */
--color-bg-light: #ECEFF3;            /* Fondo general de la app */
--color-white: #FFFFFF;               /* Fondo de tarjetas, formularios y texto en botones */
--color-text-dark: #2B2B2B;           /* Texto principal sobre fondo claro */
--color-text-light: #FFFFFF;          /* Texto sobre fondos oscuros */
--color-text-muted: #5F676E;          /* Metadatos y textos secundarios */
```

### 2.2 Estados Semánticos
```css
--color-danger: #D32F2F;              /* Error, rechazo motivado, no abordabilidad */
--color-danger-bg: #FFEBEE;
--color-danger-border: #FFCDD2;

--color-success: #2E7D32;             /* Éxito, llegada reportada, misión aceptada */
--color-success-bg: #E8F5E9;
--color-success-border: #A5D6A7;

--color-warning: #E65100;             /* Modo offline, desconexión, batería baja */
--color-warning-bg: #FFF3E0;
--color-warning-border: #FFE0B2;

--color-info: var(--color-primary-teal);
--color-info-bg: #E0F2F1;
--color-info-border: #B2DFDB;
```

### 2.3 Escala Tipográfica (Noto Sans)
| Token | Valor | Uso en Terreno |
|---|---|---|
| `--font-size-3xl` | `1.75rem` (28px) | Folios de emergencia destacados |
| `--font-size-2xl` | `1.5rem` (24px) | Título de pantalla principal (`h1`) |
| `--font-size-xl` | `1.25rem` (20px) | Título de misión o tarjeta (`h2`) |
| `--font-size-lg` | `1.125rem` (18px) | Encabezados de sección (`h3`), botones `lg` |
| `--font-size-md` | `1rem` (16px) | Inputs, selectores, botones `md` |
| `--font-size-base` | `0.875rem` (14px) | Textos de reporte, descripciones |
| `--font-size-sm` | `0.8125rem` (13px) | Etiquetas de campo, botones `sm` |
| `--font-size-xs` | `0.75rem` (12px) | Badges de estado, coordenadas GPS |

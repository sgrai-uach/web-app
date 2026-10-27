# Catálogo de Componentes UI — `sgrai-pwa`

Este documento describe los componentes visuales reutilizables construidos en `src/components/ui/` y `src/components/common/` bajo TypeScript, React y CSS Modules puros.

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

### Ejemplos
```tsx
import { Button } from '@/components/ui';
import { Check, X, MapPin } from 'lucide-react';

// Acción principal de terreno
<Button variant="primary" size="md" icon={<Check size={20} />}>
  Aceptar Misión
</Button>

// Rechazo motivado
<Button variant="destructive" size="md" icon={<X size={20} />}>
  Rechazar Misión
</Button>

// Reporte de llegada con GPS
<Button variant="teal" size="lg" fullWidth icon={<MapPin size={22} />}>
  Reportar Llegada a Terreno
</Button>
```

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

Controles de entrada planos con foco accesible teal de 2px, etiquetas asociadas por `id` y mensajes de error con soporte de `aria-invalid` y `role="alert"`.

### Props Comunes
- `label?: string`: Texto superior del campo.
- `error?: string`: Mensaje de error visual y accesible.
- `helperText?: string`: Texto aclaratorio o de ayuda.
- `requiredIndicator?: boolean`: Añade asterisco rojo municipal.

---

## 4. `<ConnectionStatusBadge />`

Barra de conectividad persistente que informa al funcionario en terreno si su dispositivo se encuentra sincronizado con el servidor central, operando en modo offline o transmitiendo datos pendientes.

### Props
| Prop | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `connected` | `boolean` | `true` | Estado de conectividad de red. |
| `pendingCount` | `number` | `0` | Cantidad de mutaciones en cola local de IndexedDB. |
| `status` | `'connected' \| 'offline' \| 'syncing'` | Infiere | Estado forzado opcional. |

### Ejemplos
```tsx
import ConnectionStatusBadge from '@/components/common/ConnectionStatusBadge';

// Conectado y al día
<ConnectionStatusBadge connected={true} />

// Sin señal con 2 operaciones en cola
<ConnectionStatusBadge connected={false} pendingCount={2} />

// Sincronizando datos pendientes
<ConnectionStatusBadge connected={true} pendingCount={2} />
```

---

## 5. `<ToastProvider />` y `useToast`

Sistema universal de alertas flotantes montado en la raíz (`layout.tsx`).

```tsx
import { useToast } from '@/components/ui';

export function MiFormulario() {
  const { showSuccess, showError, showWarning } = useToast();

  const handleGuardar = async () => {
    try {
      await enviarReporte();
      showSuccess('Reporte guardado exitosamente');
    } catch {
      showError('Error al sincronizar con central');
    }
  };
}
```

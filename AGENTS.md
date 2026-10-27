<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas Operativas para Agentes de IA — `sgrai-pwa`

Este archivo contiene las directrices obligatorias que cualquier asistente o agente de IA debe cumplir estrictamente al generar o modificar código en este repositorio (`sgrai-pwa` / `web-app`).

---

## 1. Alcance y Roles del Repositorio

- Este repositorio corresponde exclusivamente al **cliente de terreno (PWA)** del SGRAI para la Municipalidad de Valdivia.
- Los únicos dos roles que operan esta aplicación son:
  1. **Patrulla Verificadora:** Triage primario, evaluación de tipología, ajuste fundado de prioridad, dictamen de no abordabilidad e informes de situación.
  2. **Delegado de Cuadrilla:** Aceptación/rechazo de misiones, reporte de llegada con GPS, carga de evidencia multimedia, solicitud de apoyos e informes de faena con insumos consumidos.
- **Prohibido incluir vistas de otros roles:** El Informante ciudadano, Call Center, Centro de Mando (Encargado), Supervisor y Administrador pertenecen a `sgrai-web`.
- **Sin lógica de negocio local:** Toda regla y validación canónica reside en `sgrai-api`. El cliente solo implementa validaciones de UX y cola offline.

---

## 2. Directrices de Diseño e Interfaz (UI/UX)

- **Prohibición absoluta de emojis:** Queda estrictamente prohibido utilizar emojis (📞, 🚨, 📍, 📷, etc.) en componentes visuales, botones, alertas o títulos. Toda la iconografía técnica debe implementarse con **`lucide-react`**.
- **Diseño plano estricto (Flat UI) y esquinas rectas:**
  - Todos los botones, tarjetas, inputs, selects y modales deben tener esquinas rectas (`borderRadius: 0` / `--radius-none: 0px`).
  - Sin degradados ni sombras pronunciadas; el contraste se genera mediante bloques de color sólido.
- **Tipografía Institucional:** Uso obligatorio de **Noto Sans** cargada mediante `next/font/google` (`--font-noto-sans`).
- **Ergonomía de Terreno:**
  - Objetivos táctiles mínimos de **48px** de altura para facilitar el uso a una mano o con guantes.
  - Alto contraste para asegurar legibilidad bajo luz solar directa.
  - Barra de conectividad (`ConnectionStatusBadge`) siempre visible en la cabecera.

---

## 3. Tipado Estricto y Comunicación con Backend

- **Prohibido el uso de `any`:** Todo tipo de datos debe inferirse de TypeScript o derivarse de interfaces tipadas.
- **Contratos OpenAPI:**
  - Nunca escribir a mano tipos de request/response. Consumir siempre `src/types/api-generated.d.ts` generado automáticamente desde `sgrai-api`.
  - Todas las llamadas HTTP deben efectuarse mediante `openapi-fetch` configurado en `src/lib/api/client.ts`.
- **Validación previa en cola offline:** Todo payload guardado en IndexedDB para envío diferido debe validarse contra los esquemas Zod y tipos generados antes de persistirse localmente.

---

## 4. Pruebas y Aseguramiento de Calidad

- Todo nuevo componente, hook reactivo o servicio debe acompañarse de su correspondiente archivo de pruebas (`__tests__/*.test.tsx` o `*.test.ts`).
- Las pruebas se ejecutan con **Vitest** y **React Testing Library** (`npm test`).
- Todo commit debe mantener la suite de pruebas en verde y sin errores de ESLint (`npm run lint`).

---

## 5. Manuales de Usuario y Documentación

- Cada funcionalidad implementada debe entregarse con su manual de usuario en `/docs/manuals/` bajo el nombre `H<numero>-<slug>.md`.
- El manual debe incluir de forma obligatoria la sección **Comportamiento sin conexión** y los permisos de hardware requeridos (GPS / Cámara).
- La documentación técnica y arquitectura debe mantenerse actualizada en `/docs/architecture/` y `/docs/design/`.

---

## 6. Convenciones de Versionado y Git

- Flujo de trabajo: **Gitflow** (`main`, `develop`, ramas `feature/H<numero>-<slug>`).
- Commits atómicos siguiendo **Conventional Commits** (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

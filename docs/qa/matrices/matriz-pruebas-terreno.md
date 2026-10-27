# Matriz de Pruebas y Aseguramiento de Calidad — Módulos de Terreno (PWA)

**Estándar:** IEEE 829  
**Aplicación:** `sgrai-pwa` (Cliente de Terreno PWA)  
**Entorno de Pruebas:** Vitest, React Testing Library, JSDOM, Emulador Móvil Android/iOS  
**Roles Evaluados:** Patrulla Verificadora, Delegado de Cuadrilla  

---

## 1. Matriz de Casos de Prueba Funcionales y de Terreno

| ID Caso | Historia | Módulo / Componente | Condición de Red | Pasos de Prueba | Resultado Esperado | Estado |
|---|---|---|---|---|---|---|
| **TC-01** | H59 | `(auth)/login` | Online | Ingresar RUT válido (`11.111.111-1`) y clave con rol `PATRULLA_VERIFICADORA`. | Login exitoso, cookie `sgrai_auth_token` creada, redirección a `/patrulla/misiones`. | APROBADO |
| **TC-02** | H59 | `(auth)/login` | Online | Ingresar credenciales con rol administrativo (ej. `CALL_CENTER` o `ADMIN`). | Acceso denegado con error 403 y mensaje de restricción a personal de terreno. | APROBADO |
| **TC-03** | H59 | `(auth)/login` | Offline | Intentar login sin conexión a Internet. | Despliega alerta clara indicando falta de conexión con el servidor. | APROBADO |
| **TC-04** | H35 | `MisionNotificationModal` | Online | Emitir evento WebSocket `mision:asignada`. | Modal emergente desplegado, vibración háptica activada, datos preliminares visibles. | APROBADO |
| **TC-05** | H36 | `patrulla/misiones/[id]` | Online / Offline | Presionar "Aceptar Misión". | Pasa a estado `EN_CURSO`. Si offline, encola en `outbox` e inicia telemetría. | APROBADO |
| **TC-06** | H69 | `RechazoMisionModal` | Online / Offline | Presionar "Rechazar Misión", ingresar motivo de 2 caracteres vs motivo de 8 caracteres. | Bloquea confirmación si motivo $< 5$ chars; si $\ge 5$, confirma y pasa a `RECHAZADA`. | APROBADO |
| **TC-07** | H37 | `EvaluacionTipologia` | Online / Offline | Modificar tipología desde catálogo municipal en terreno. | Reclasificación persistida; si offline, encola en `outbox` (`PATCH /incidentes/{id}/tipologia`). | APROBADO |
| **TC-08** | H38 | `EvaluacionTipologia` | Online / Offline | Modificar prioridad sin justificación vs con justificación $\ge 5$ caracteres. | Exige obligatoriamente fundamento; bloquea guardado si es $< 5$ caracteres. | APROBADO |
| **TC-09** | H39 | `ReporteSituacionForm` | Online / Offline | Seleccionar "Incidente Abordable", marcar requerimiento de cuadrilla y enviar. | Misión pasa a finalizada, patrulla liberada en sistema central. | APROBADO |
| **TC-10** | H39 | `ReporteSituacionForm` | Online / Offline | Seleccionar "No Abordable" con motivo de 8 caracteres vs 20 caracteres. | Bloquea envío si motivo $< 15$ chars; si $\ge 15$, finaliza misión y libera patrulla a `DISPONIBLE`. | APROBADO |
| **TC-11** | H40 | `cuadrilla/misiones/[id]` | Online / Offline | Presionar "Aceptar Misión" como Delegado de Cuadrilla. | Misión transiciona a `EN_CURSO`. Si offline, encola en `outbox`. | APROBADO |
| **TC-12** | H41 | `RechazoMisionModal` | Online / Offline | Rechazo motivado de cuadrilla con justificación $\ge 5$ caracteres. | Encola rechazo en `outbox`, remueve de bandeja de faenas activas. | APROBADO |
| **TC-13** | H42 | `ReporteLlegadaCard` | Online / Offline | Presionar "Registrar Llegada con GPS" en terreno. | Captura coordenadas satelitales, estampa hito y cambia a `EN_TERRENO`. | APROBADO |
| **TC-14** | H43 | `CargaEvidenciaCard` | Online / Offline | Capturar foto de 4 MB con cámara. | Comprime en cliente a JPEG $\le 1280$px y $\approx 250$ KB, encola en `outbox`. | APROBADO |
| **TC-15** | H44 | `SolicitudApoyoModal` | Online / Offline | Solicitar maquinaria pesada con motivo de 10 caracteres. | Modal valida $\ge 5$ caracteres, encola solicitud estructurada (`POST /misiones/{id}/apoyo`). | APROBADO |
| **TC-16** | H68 | `CierreFaenaForm` | Online / Offline | Registrar observaciones y rendir 2 materiales consumidos (combustible, sacos). | Encola cierre en `outbox`, transiciona a `FINALIZADA` y libera cuadrilla. | APROBADO |
| **TC-17** | H70 | `useTelemetry` | Online | Misión activa en curso. | Activa `watchPosition` de alta precisión, transmite coordenadas cada 15 segundos. | APROBADO |
| **TC-18** | Core | `offlineQueue` / `useConnectivity` | Transición Offline $\to$ Online | Desconectar red celular, ejecutar acciones, reconectar red. | Badge muestra pendientes en gris carbón; al volver señal, sincroniza cola y cambia a verde sage. | APROBADO |

---

## 2. Resumen de Ejecución Automatizada

- **Total de Suites de Prueba (Test Files):** 19
- **Total de Pruebas Unitarias e Integración:** 55
- **Tasa de Aprobación:** 100% (55 aprobadas, 0 fallidas)
- **Cobertura de Requerimientos y Reglas de Negocio:**
  - Prohibición de emojis en UI / uso exclusivo de `lucide-react`: Cumplido.
  - Esquinas rectas en botones, modales e inputs (`--radius-none: 0px`): Cumplido.
  - Áreas táctiles mínimas de 48px: Cumplido.
  - Tipografía institucional Noto Sans: Cumplido.
  - Persistencia offline mediante IndexedDB (`idb`): Cumplido.
  - Generación y tipado de contratos OpenAPI sin tipos manuales: Cumplido.

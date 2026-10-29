# Manual de Usuario: Inicio de Sesión Unificado de Personal en Terreno (H59)

**Historia de Usuario:** H59 — Inicio de sesión de personal municipal en terreno (Login Unificado)  
**Roles involucrados:** Patrulla Verificadora, Delegado de Cuadrilla  
**Aplicación:** SGRAI — Portal de Autenticación Unificado (`/login`) y PWA Terreno (`/terreno`)

---

## 1. Propósito

Este manual describe el procedimiento para que los operadores en terreno (**Patrulla Verificadora** y **Delegado de Cuadrilla**) inicien sesión en el ecosistema SGRAI a través del **Portal de Autenticación Institucional Unificado (`/login`)**, el cual adapta su interfaz de forma responsiva para dispositivos móviles y redirige automáticamente hacia la aplicación de terreno (`/terreno`) según el rol del funcionario.

---

## 2. Requisitos Previos y Permisos de Hardware

Para operar la aplicación de terreno de forma óptima, el dispositivo móvil debe contar con los siguientes permisos y configuraciones:

1. **Permiso de Ubicación (GPS):**
   - El navegador solicitará acceso a la ubicación al operar misiones en terreno.
   - Es mandatorio seleccionar **"Permitir siempre"** o **"Mientras la app esté en uso"** para la transmisión de telemetría hacia el Centro de Mando (H70) y registro de llegada (H42).
2. **Permiso de Cámara (Opcional en login, obligatorio en faena):**
   - Requerido para la captura de evidencia fotográfica por parte del Delegado de Cuadrilla (H43).
3. **Cuenta Activa con Rol Habilitado:**
   - La cuenta debe contar con el rol asignado de `PATRULLA_VERIFICADORA` o `DELEGADO_CUADRILLA`.
   - Si el funcionario tiene un rol de oficina (`ADMIN`, `ENCARGADO`, `CALL_CENTER`, `ASISTENTE_SOCIAL`, `SUPERVISOR`), el login unificado lo dirigirá automáticamente al Portal de Gestión (`/gestion`) sin afectar su sesión.

---

## 3. Instrucciones Paso a Paso

1. Abra la aplicación instalada **SGRAI Terreno** (`/terreno`) o ingrese directamente a `/login` desde el navegador móvil (Chrome, Edge o Safari).
   - Si abre `/terreno` sin haber iniciado sesión previamente, el sistema lo redirigirá automáticamente al portal de autenticación unificado (`/login?returnUrl=/terreno`).
2. Se desplegará la tarjeta institucional con la cabecera **SGRAI | DGRD VALDIVIA**, titulada **"Inicio de Sesión"** y optimizada con controles táctiles de **48px** para uso en terreno.
3. En el campo **"Identificador"** (placeholder: *Correo o RUT con dígito verificador*), ingrese su RUT chileno (con o sin puntos, ej. `11.111.111-1` o `11111111-1`) o su correo institucional (`nombre@valdivia.cl`).
4. En el campo **"Contraseña"**, ingrese su clave secreta. Puede pulsar el botón del icono de ojo a la derecha para mostrar u ocultar los caracteres ingresados, o pulsar el enlace **"¿Olvidaste tu contraseña?"** si requiere recuperarla (H65).
5. Presione el botón principal **"Ingresar al Sistema"**.
6. Una vez autenticado, el sistema emitirá la credencial segura (`sgrai_auth_token`) compartida en todo el dominio y lo redirigirá automáticamente a su bandeja operativa en la PWA:
   - **Patrulla Verificadora** $\rightarrow$ `/terreno/patrulla/misiones`
   - **Delegado de Cuadrilla** $\rightarrow$ `/terreno/cuadrilla/misiones`
7. Si su unidad se encuentra temporalmente desactivada (baja lógica H82 / H85), ingresará en **Modo Histórico de Solo Lectura**, visualizando el banner de advertencia y el historial de misiones previas sin recibir nuevos despachos.

---

## 4. Comportamiento sin Conexión (Modo Offline)

- **Primer Inicio de Sesión:**
  - Requiere conexión a Internet activa (datos móviles 4G/5G o WiFi) para validar credenciales en `/login` contra el servidor central (`sgrai-api`).
- **Sesión Previa Iniciada (Persistencia en Terreno):**
  - Una vez autenticado, si el operador pierde cobertura celular durante el traslado o en el sitio del incidente, la cookie `sgrai_auth_token` y los datos almacenados localmente en IndexedDB permiten continuar operando en `/terreno`.
  - La barra superior de la PWA mostrará el estado en el componente **`ConnectionStatusBadge`** (*"Sin conexión / Trabajando offline"*).
- **Restablecimiento de Conectividad:**
  - Al recuperar señal de red, el distintivo cambiará automáticamente a **"Sincronizado"** y se procesará la cola local de envíos pendientes.

---

## 5. Relación con Otros Repositorios

- **`sgrai-web`:** Provee la pantalla única y responsiva de inicio de sesión (`/login`) y el flujo de recuperación de contraseña (`/recuperar-contrasena`). Ver manual relacionado en `sgrai-web`: `docs/manuals/H59-inicio-sesion-usuarios.md`.
- **`sgrai-api`:** Valida las credenciales mediante `POST /api/seguridad/login` y entrega el perfil activo en `GET /api/seguridad/usuario-activo`.

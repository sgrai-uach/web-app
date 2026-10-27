# Manual de Usuario: Inicio de Sesión de Personal en Terreno (H59)

**Historia de Usuario:** H59 — Inicio de sesión de personal municipal en terreno  
**Roles involucrados:** Patrulla Verificadora, Delegado de Cuadrilla  
**Aplicación:** SGRAI - PWA Terreno (Municipalidad de Valdivia)

---

## 1. Propósito

Este manual describe el procedimiento para que los operadores en terreno (**Patrulla Verificadora** y **Delegado de Cuadrilla**) inicien sesión en la aplicación móvil PWA institucional utilizando sus credenciales corporativas (RUT o correo institucional y contraseña).

---

## 2. Requisitos Previos y Permisos de Hardware

Para operar la aplicación de terreno de forma óptima, el dispositivo móvil debe contar con los siguientes permisos y configuraciones:

1. **Permiso de Ubicación (GPS):**
   - El navegador solicitará acceso a la ubicación al iniciar la aplicación.
   - Es mandatorio seleccionar **"Permitir siempre"** o **"Mientras la app esté en uso"** para la transmisión de telemetría hacia el Centro de Mando (H70) y registro de llegada (H42).
2. **Permiso de Cámara (Opcional en login, obligatorio en faena):**
   - Requerido para la captura de evidencia fotográfica por parte del Delegado de Cuadrilla (H43).
3. **Cuenta Activa con Rol Habilitado:**
   - La cuenta debe contar con el rol asignado de `PATRULLA_VERIFICADORA` o `DELEGADO_CUADRILLA`. Si un usuario con rol de Administrador, Call Center o Encargado intenta iniciar sesión aquí, el sistema bloqueará el acceso indicando que debe utilizar el portal web administrativo.

---

## 3. Instrucciones Paso a Paso

1. Ingrese a la URL institucional de la PWA desde el navegador móvil (Chrome, Edge o Safari).
2. En la pantalla de bienvenida verá el logotipo y colores institucionales de la Municipalidad de Valdivia.
3. En el campo **"RUT o Correo Institucional"**, ingrese su RUT (ej. `11.111.111-1` o `11111111-1`) o su correo institucional (`nombre@valdivia.cl`).
4. En el campo **"Contraseña"**, ingrese su clave secreta. Puede utilizar el botón del ojo para mostrar/ocultar los caracteres ingresados.
5. Presione el botón principal **"Iniciar Sesión"** (área táctil optimizada de al menos 48px).
6. Una vez autenticado, será redirigido automáticamente a la bandeja de misiones correspondiente a su rol:
   - Patrulla Verificadora $\rightarrow$ `/patrulla/misiones`
   - Delegado de Cuadrilla $\rightarrow$ `/cuadrilla/misiones`

---

## 4. Comportamiento sin Conexión (Modo Offline)

- **Primer Inicio de Sesión:**
  - Requiere conexión a Internet activa (datos móviles o WiFi) para validar credenciales contra el servidor de identidad central (`sgrai-api`).
  - Si intenta iniciar sesión por primera vez sin conectividad, la aplicación desplegará una alerta indicando: *"No se pudo contactar al servidor. Compruebe su conexión a Internet."*
- **Sesión Previa Iniciada (Persistencia en Terreno):**
  - Si el operador ya había iniciado sesión previamente y pierde cobertura de red celular en la ruta o en terreno, el token de sesión y el perfil del usuario permanecen almacenados de manera segura en el navegador.
  - La aplicación continuará operando normalmente en modo sin conexión, indicándolo en la barra superior con el distintivo **"Sin conexión"** en color gris carbón.
- **Restablecimiento de Conectividad:**
  - Al recuperar señal de red, el distintivo cambiará automáticamente a **"Sincronizado"** y se restablecerá el canal de comunicación en tiempo real vía WebSockets.

# Sistema Web de Gestión de Matrículas Escolares

Proyecto académico de la **Tarea N.º 05 de FULLSTACK DEVELOPER SOFTWARE, SENATI**. Demuestra operaciones CRUD con Node.js, Express y MariaDB de XAMPP, continuando el proyecto existente hasta el paso 5.5.

Basado en la I.E. Emblemática **«COLEGIO DE LA LIBERTAD» – HUARAZ**, Áncash, Perú. Referencia institucional: **Rumbo al Bicentenario 1828–2028**. Lema: **«Ser Libertano es Compromiso de Honor»**.

Es una demostración académica local; no representa una plataforma oficial. Utilizar exclusivamente información ficticia. La capacidad inicial de 30 estudiantes y las secciones de demostración no son datos oficiales confirmados.

## Puesta en marcha en este equipo

1. Inicia **MySQL/MariaDB** en XAMPP, puerto **3306**. Apache (puerto **8012**) solo se necesita para phpMyAdmin.
2. Abre una terminal en la carpeta actual del proyecto. No necesitas moverla a `htdocs`.
3. Las credenciales locales ya están en `.env`: **consérvalas**. No copies `.env.example` encima de ese archivo.
4. Instala las dependencias si no están disponibles:

```powershell
npm.cmd ci
```

5. Comprueba la conexión y la estructura:

```powershell
npm.cmd run db:inspect
```

6. Genera tu primer administrador en una terminal interactiva:

```powershell
npm.cmd run create-admin
```

El script solicita usuario, nombre para mostrar y contraseña dos veces. La contraseña no se muestra al escribirla, debe tener de 12 a 128 caracteres y se almacena con **Argon2id**. No la incluyas en argumentos de comandos, código o documentación. Si existe un administrador activo, el script se detiene: las cuentas siguientes se gestionan desde **Usuarios**. No hay cuentas ni contraseñas predeterminadas.

7. Inicia la aplicación:

```powershell
npm.cmd start
```

Abre **http://localhost:3000/** e inicia sesión. Para desarrollo:

```powershell
npm.cmd run dev
```

Se utiliza `node --watch`; no requiere nodemon. En PowerShell, `npm.cmd` evita el bloqueo de `npm.ps1` por la política de ejecución sin modificar la seguridad del equipo. Si el puerto 3000 ya está ocupado, detén la instancia anterior con Ctrl+C en su terminal.

## Configuración en otro equipo

### Recuperar el acceso local

Si olvidaste la contraseña, ejecuta en una terminal del proyecto:

```powershell
npm.cmd run recover-access -- STIVEN
```

Reemplaza `STIVEN` por tu usuario cuando corresponda. Ingresa y confirma tu nueva contraseña de 12 a 128 caracteres; no se muestra ni se guarda en texto plano. El comando conserva el rol de una cuenta existente e invalida sus sesiones anteriores. Si no hay ninguna cuenta en la base, crea el primer administrador con ese nombre. Si ya existen cuentas y el usuario indicado no existe, se detiene sin crear otro administrador. Las cuentas inactivas deben ser activadas por un administrador.

Si el login muestra «Demasiados intentos», detén el servidor con Ctrl+C y vuelve a ejecutar `npm.cmd start`; el contador temporal se reinicia sin deshabilitar la protección de intentos. Este comando solo está disponible localmente para quien tiene acceso al proyecto y a sus credenciales de MariaDB; no añade una ruta pública de recuperación.

Requisitos: Node.js 24, npm, MariaDB 10.4 o compatible y XAMPP. El código conserva CommonJS. Se probaron Node.js 24.18.0 y la conexión a MariaDB local.

1. Ejecuta `npm.cmd ci`.
2. Crea `.env` a partir de `.env.example` **solo si no existe**. Introduce las credenciales privadas locales.
3. En phpMyAdmin, con una cuenta administradora de la base de datos, crea una base **vacía** llamada `bd_matriculas_libertad` con cotejamiento `utf8mb4_unicode_ci`.
4. Selecciona esa base e importa `database/01-estructura.sql` desde la pestaña **Importar**, formato SQL y codificación UTF-8.
5. Importa `database/02-academico.sql` para el año 2026, los 11 grados y las secciones A–I: **54 de primaria, 45 de secundaria y 99 en total**. Es idempotente: no duplica ni modifica capacidades, estados o identificadores existentes.
6. Opcionalmente importa `database/03-demo-opcional.sql`. Crea un estudiante, un tutor y su vínculo, claramente ficticios. No crea cuentas ni matrículas.
7. El administrador de MariaDB debe proporcionar al usuario local de la aplicación únicamente **SELECT, INSERT, UPDATE, DELETE** sobre esta base. La aplicación no crea usuarios de MariaDB ni concede privilegios. No uses root para ejecutar el sistema.
8. Ejecuta `npm.cmd run db:inspect`, `npm.cmd run create-admin` y `npm.cmd start`.

**La base local ya tiene aplicada la migración A–I; no es necesario volver a importar nada.** No se han recreado las ocho tablas. El esquema exportado usa `CREATE TABLE IF NOT EXISTS`, sin `DROP`, y no actualiza la estructura de tablas existentes. La ampliación de secciones utiliza una migración incremental de datos, sin DDL.

Para volver a exportar únicamente la estructura real, sin datos personales, hashes ni contraseñas:

```powershell
npm.cmd run db:export-schema
```

Este comando escribe `database/01-estructura.sql` y solo ejecuta consultas de lectura en MariaDB.

### Actualización incremental de secciones 2026

La configuración académica de demostración es **A, B, C, D, E, F, G, H e I por cada grado**: seis grados de primaria (54 secciones) y cinco de secundaria (45). No es una distribución oficial verificada del colegio.

En una instalación anterior que solo tenga A, ejecuta:

```powershell
npm.cmd run db:migrate-sections-2026
```

El comando primero guarda y verifica una copia SQL privada de las ocho tablas en **`.local/backups/`**. La copia contiene los datos y hashes de las cuentas: permanece excluida de Git y no debe compartirse. Su restauración corresponde al propietario, seleccionando una base vacía; no se restaura automáticamente sobre las tablas existentes.

Después verifica el año 2026 y los 11 grados, bloquea el periodo e inserta únicamente las secciones faltantes con capacidad provisional 30 y estado ACTIVA. Conserva los IDs, capacidades y estados anteriores, las matrículas y todos los demás registros y años. Comprueba la distribución antes del commit y revierte si detecta inconsistencias. Al reejecutarlo sobre la distribución completa inserta 0 registros. Si encuentra letras fuera de A–I, se detiene sin eliminarlas para que el propietario revise sus relaciones.

La migración SQL está en **`database/migracion_secciones_2026.sql`**. Como alternativa puede importarse en phpMyAdmin después de una copia de seguridad y de comprobar sus requisitos. Usa solo consultas SELECT/INSERT, sin modificar estructuras ni elevar los permisos de `matriculas_app`. Sus consultas finales muestran los totales por nivel y las letras por grado. No requiere intervención manual en phpMyAdmin en este equipo: la actualización ya fue aplicada desde Node.js.

`database/02-academico.sql` es el inicializador actualizado para instalaciones nuevas; la ampliación de instalaciones anteriores queda documentada por la migración separada. Los selectores obtienen las secciones desde la API en orden año/nivel/grado/letra, recorriendo todas las páginas necesarias. El formulario actualiza las opciones al cambiar año, nivel o grado, conserva la sección al editar e ignora respuestas atrasadas de selecciones anteriores.

## Funciones y uso

- **Inicio:** estadísticas reales, últimos registros vigentes, distribución por nivel, matrículas por grado y accesos rápidos. Los filtros de periodo/nivel se aplican a las matrículas; las tarjetas de estudiantes, apoderados y secciones son totales activos del sistema.
- **Estudiantes:** registrar, buscar por código/documento/nombres/apellidos, filtrar estado, consultar detalle, editar, desactivar y eliminar si no tiene vínculos protegidos. El código y el documento respetan sus índices únicos. Documento, nacimiento y sexo pueden quedar vacíos según el esquema existente; un DNI proporcionado debe tener 8 dígitos.
- **Apoderados:** registrar, consultar, buscar, editar, cambiar estado y eliminar cuando no tenga relaciones protegidas.
- **Vínculos familiares:** seleccionar estudiante y apoderado, indicar parentesco y contacto principal, editar el vínculo o desvincular con confirmación. Un tutor puede estar relacionado con varios estudiantes. Al marcar un principal, se desmarcan los otros contactos del mismo estudiante dentro de una transacción.
- **Matrículas:** seleccionar estudiante, año, nivel, grado y sección; registrar fecha y observaciones, consultar, filtrar, editar, anular y reactivar. Las búsquedas en los selectores de personas consultan al servidor; si hay más de 100 coincidencias, precisa el texto. Las listas principales tienen paginación.
- **Años y secciones:** los administradores pueden crear periodos, cerrarlos, crear secciones, modificar capacidad y estado. Las cuentas de matrículas solo pueden consultarlos. Los 11 grados se consultan sin recrearlos.
- **Usuarios:** solo administradores; crear cuentas, asignar roles, editar, activar/desactivar y restablecer contraseña. Al editar, una contraseña vacía conserva la actual. Se impide desactivar o degradar la propia cuenta y se conserva al menos un administrador activo.
- **Reportes:** agrupación por año, nivel, grado y sección; filtros, total de matrículas del filtro, total global de estudiantes, impresión y CSV. Incluyen todas las secciones configuradas, con cero donde no hay matrículas vigentes. Solo contabilizan matrículas `REGISTRADA`; las anuladas se consultan en Matrículas. El número de secciones se muestra separado del total de matrículas, sin confundir 99 secciones con 99 estudiantes matriculados.

Los formularios se abren en modales Bootstrap. Los botones de detalle, edición y acciones delicadas tienen etiquetas accesibles; las eliminaciones, anulaciones y reactivaciones piden confirmación. El menú se despliega con el botón hamburguesa en pantallas pequeñas.

### Reglas de matrícula e integridad

Cada estudiante tiene un único registro por año, incluso si se anula. Para corregir o reactivar se utiliza ese registro. No se permite cambiar su estudiante ni año; la sección, fecha, observaciones y estado se pueden editar.

Para registrar o reactivar, el estudiante debe estar activo, el año abierto y la sección activa y perteneciente al año seleccionado. El conteo de cupos se ejecuta en una transacción `READ COMMITTED` con bloqueos de filas sobre periodo, estudiante y sección. Las ediciones de capacidad utilizan los mismos bloqueos; no se reduce por debajo de las matrículas registradas. Una sección con historial no puede cambiar de año o grado. No se eliminan matrículas físicamente desde la aplicación. Se puede anular una matrícula de un periodo cerrado para conservar su historial.

El bloqueo del periodo serializa escrituras de matrículas del mismo año; es una decisión conservadora para este prototipo. Los bloqueos o conflictos concurrentes devuelven HTTP 409 para reintentar. Las claves foráneas existentes protegen las eliminaciones de estudiantes, apoderados y secciones.

## Identidad visual

Login y panel usan celeste, blanco y azul oscuro, el nombre institucional, el lema y la referencia al bicentenario. Los recursos Bootstrap e iconos se sirven desde las dependencias locales, sin CDN.

El login, el panel y el icono de la pestaña utilizan **`public/img/escudo-colegio.webp`**, coincidente con el escudo facilitado por el propietario y descargado sin alteraciones de la [web del colegio](https://cll.edu.pe/wp-content/uploads/2024/08/insignia.webp). El archivo se sirve localmente y conserva sus proporciones. El marcador provisional fue retirado.

## Organización

```text
server.js                       Inicio del servidor y cierre ordenado
src/app.js                      Express, cabeceras, recursos, sesiones y errores
src/config/database.js          Pool MariaDB existente, fechas SQL como texto
src/config/session-secret.js    Secreto privado generado localmente
src/routes/api.js               Rutas REST y autorización
src/controllers/auth.js         Autenticación real y cierre de sesión
src/controllers/reports.js      Dashboard, agregaciones y CSV
src/middleware/auth.js          Sesiones, roles y CSRF
src/services/resources.js       CRUD, relaciones y reglas académicas
src/services/enrollments.js     Matrículas transaccionales
src/services/transaction.js     Commit, rollback y liberación de conexión
src/services/file-session-store.js  Sesiones persistentes en disco local
src/utils/                      Validación y errores de aplicación
public/login.html               Acceso institucional
public/panel.html               Panel y modales
public/css/app.css              Diseño institucional y responsive
public/js/                      Interfaz fetch, filtros y formularios
public/img/                     Escudo institucional y referencia de su procedencia
database/                       Estructura y datos académicos/ficticios
scripts/                        Administrador, inspección, exportación y sintaxis
tests/                          Validaciones, sesiones e integración MariaDB
.local/                         Secreto y sesiones privados; excluidos de Git
```

Las dependencias añadidas son `argon2` (hashes), `express-session` (cookies/sesiones), `express-rate-limit` (límite de intentos), `helmet` (cabeceras), `bootstrap` y `bootstrap-icons` (componentes locales). No se ha sustituido el backend por PHP.

## API

Los listados devuelven `{ data, total, page, limit }`. Admiten `q`, `estado`, `page` y `limit` (máximo 100), y filtros académicos donde corresponda. Los errores usan `{ mensaje, fields? }`, sin SQL ni credenciales.

- `GET /api/health`, `GET /api/estado-db`: diagnósticos públicos sin detalles privados de conexión.
- `GET /api/auth/csrf`: prepara la cookie y entrega el token del formulario.
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- `GET, POST /api/estudiantes`, `/api/apoderados`, `/api/relaciones`, `/api/matriculas`, `/api/anios`, `/api/secciones`, `/api/usuarios`.
- `GET, PUT /api/{recurso}/:id` en esos recursos.
- `DELETE /api/estudiantes/:id`, `/api/apoderados/:id`, `/api/relaciones/:id`, `/api/secciones/:id`.
- `GET /api/grados`, `GET /api/grados/:id`.
- `PATCH /api/matriculas/:id/anular`, `PATCH /api/matriculas/:id/reactivar`.
- `GET /api/dashboard/resumen`, `GET /api/reportes`, `GET /api/reportes/csv`.

Las operaciones de escritura, incluido login, requieren la cookie de sesión y la cabecera `X-CSRF-Token`; después del login se entrega un token nuevo. Los filtros de matrículas/reportes son `id_anio`, `nivel`, `id_grado` e `id_seccion`. Los vínculos también aceptan `id_estudiante` e `id_apoderado`.

## Seguridad y alcance local

Se usan consultas parametrizadas, listas explícitas de campos, validación en servidor, escape contextual en la interfaz, CSP y cabeceras de Helmet. La API no devuelve hashes. El CSV protege celdas que podrían interpretarse como fórmulas.

Las sesiones usan cookies **HttpOnly**, **SameSite=Strict**, duración máxima de dos horas y regeneración tras autenticarse. El servidor vuelve a consultar el estado, rol y versión del hash en cada solicitud privada: una desactivación o cambio de contraseña revoca el acceso. El límite de autenticación es de 10 intentos fallidos por dirección en 15 minutos. Se comprueba CSRF y el origen de las operaciones de escritura.

El almacén de sesiones es local a un proceso Node, con archivos en `.local/sessions`, escrituras atómicas y limpieza periódica de sesiones vencidas. No requiere una novena tabla ni permisos DDL. El secreto se genera aleatoriamente en `.local/session-secret` si no se configura en desarrollo. Estos archivos deben permanecer privados dentro del perfil de Windows del propietario; los modos POSIX de archivo no reemplazan los permisos ACL de Windows. No compartas ni subas `.local`.

El servidor escucha en `127.0.0.1` y está preparado para demostración local con HTTP. Un despliegue futuro necesita HTTPS, secreto `SESSION_SECRET` de al menos 32 caracteres, revisión del proxy y un almacén/límite de intentos compartidos si se utilizan varios procesos. `NODE_ENV=production` exige secreto explícito y cookies Secure. No se ha publicado ni creado ningún repositorio remoto.

## Pruebas y comprobaciones

Con MariaDB iniciado y `.env` configurado:

```powershell
npm.cmd run check
npm.cmd test
```

`check` revisa la sintaxis de los JavaScript. Las pruebas de integración levantan una instancia temporal en un puerto libre y usan las ocho tablas reales con las credenciales CRUD existentes. Generan cuentas, personas y registros **ficticios y temporales**, con contraseñas aleatorias que no se imprimen. Solo eliminan sus propios identificadores al finalizar; no vacían tablas ni alteran el esquema. Los contadores AUTO_INCREMENT pueden avanzar como consecuencia normal de estas inserciones. Ejecuta las pruebas sin otras personas editando el sistema al mismo tiempo, ya que se comprueban los conteos iniciales y finales.

Se verificaron conexión, diagnósticos, protección de rutas, login, cookie, CSRF, roles, validaciones, CRUD, vínculos, claves foráneas, duplicados incluso tras anulación, dos solicitudes concurrentes con un único cupo, edición de capacidades, periodos cerrados, estudiantes inactivos, reactivación, reportes, CSV, cambio de contraseña, revocación y cierre de sesión. Se verifican también persistencia y caducidad del almacén local de sesiones.

La actualización A–I se verificó con 5 pruebas automatizadas aprobadas en total y revisión de sintaxis de 27 archivos JavaScript. La prueba específica `tests/sections-2026.test.js` comprueba 54/45/99, las nueve letras por cada grado, reejecución idempotente del SQL, conservación de capacidades/estados, filtros e IDs reales, lógica del selector de matrícula con respuestas de la API para los 11 grados y edición de una selección I. Ejecuta matrículas ficticias en H e I de quinto de secundaria, consulta sus detalles, filtros, reportes, dashboard y CSV, y retira sus propios registros al finalizar. Compara el contenido completo de las ocho tablas antes y después de las pruebas, sin imprimir datos privados. La prueba del selector ejecuta JavaScript en Node con elementos mínimos de formulario: no sustituye la revisión visual con un navegador.

La comprobación visual interactiva en Chrome y en un teléfono **queda pendiente**: esta sesión de desarrollo no tiene un navegador conectado. El diseño incluye media queries, menú offcanvas, tablas desplazables y modales de pantalla completa en móvil, pero no se presenta como una verificación visual ejecutada. Después de crear tu administrador, comprueba login, panel y modales con las herramientas de dispositivo de Chrome y con tu pantalla habitual.

## Archivos conservados y cambios

Se conservaron `.env`, el pool MariaDB, las ocho tablas y la configuración académica existente. Se actualizó `server.js` para iniciar la aplicación modular; el antiguo diagnóstico raíz está en `/api/health`. Se completaron `package.json`, `package-lock.json`, `.gitignore` y las opciones de fechas del pool. Los demás archivos de aplicación, SQL, scripts, pruebas y esta documentación fueron añadidos al proyecto existente.

Antes de una publicación futura revisa que no haya datos personales ni credenciales en los archivos a incluir. `.env`, `.local`, `node_modules` y logs están excluidos. No se inicializó Git ni se realizó publicación automática.

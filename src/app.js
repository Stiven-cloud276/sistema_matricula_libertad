const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('node:path');
const pool = require('./config/database');
const { loadUser } = require('./middleware/auth');
const FileStore = require('./services/file-session-store');
const app = express();
app.disable('x-powered-by');
app.set('json replacer', (key, value) => typeof value === 'bigint' ? Number(value) : value);
app.use(helmet({ contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null, 'script-src': ["'self'"], 'style-src': ["'self'"], 'img-src': ["'self'", 'data:'], 'font-src': ["'self'"], 'form-action': ["'self'"] } }, strictTransportSecurity: process.env.NODE_ENV === 'production' }));
app.use(express.json({ limit: '32kb' }));
app.use('/vendor/bootstrap', express.static(path.join(__dirname, '../node_modules/bootstrap/dist')));
app.use('/vendor/icons', express.static(path.join(__dirname, '../node_modules/bootstrap-icons/font')));
for (const dir of ['css', 'js', 'img']) app.use('/' + dir, express.static(path.join(__dirname, '../public', dir)));
app.use(session({ name: 'libertad.sid', secret: require('./config/session-secret')(), store: new FileStore(path.join(__dirname, '../.local/sessions')), resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 2 * 60 * 60 * 1000 } }));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.get('/api/health', (req, res) => res.json({ estado: 'Correcto', sistema: 'Sistema Web de Matrículas Escolares', institucion: 'Colegio de la Libertad · Huaraz', demostracion: true }));
app.get('/api/estado-db', async (req, res) => {
  await pool.query('SELECT 1 AS prueba'); res.json({ estado: 'Correcto', conexion: 'Exitosa', mensaje: 'Node.js conectado correctamente con MariaDB' });
});
app.use(loadUser);
app.get('/', (req, res) => req.user ? res.redirect('/panel') : res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/panel', (req, res) => req.user ? res.sendFile(path.join(__dirname, '../public/panel.html')) : res.redirect('/'));
app.use('/api', require('./routes/api'));
app.use((req, res) => res.status(404).json({ mensaje: 'Recurso no encontrado.' }));
app.use((error, req, res, next) => {
  let status = error.status || 500, message = error.status ? error.message : 'No se pudo completar la operación. Intenta nuevamente.';
  if (error.code === 'ER_DUP_ENTRY') { status = 409; message = 'El código, documento o registro ya existe. Revisa los datos ingresados.'; }
  if (['ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) { status = 409; message = 'El registro tiene relaciones protegidas o una referencia no válida. Gestiona sus relaciones o cambia su estado.'; }
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) { status = 409; message = 'Otro usuario está modificando estos registros. Intenta nuevamente.'; }
  if (error.type === 'entity.parse.failed') { status = 400; message = 'El cuerpo JSON no es válido.'; }
  if (status >= 500) console.error('Operación fallida:', error.code || error.name);
  res.status(status).json({ mensaje: message, ...(error.fields ? { fields: error.fields } : {}) });
});
module.exports = app;

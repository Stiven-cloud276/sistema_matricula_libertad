const crypto = require('node:crypto');
const pool = require('../config/database');
const { AppError } = require('../utils/errors');
async function loadUser(req, res, next) {
  if (req.session.userId) {
    const [user] = await pool.query('SELECT id_usuario,usuario,nombre_completo,rol,estado,password_hash FROM usuarios WHERE id_usuario=?', [req.session.userId]);
    const version = user && crypto.createHash('sha256').update(user.password_hash).digest('hex');
    if (user?.estado === 'ACTIVO' && version === req.session.authVersion) {
      delete user.password_hash; req.user = user;
    } else { await new Promise((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve())); }
  }
  next();
}
function authenticated(req, res, next) { if (!req.user) throw new AppError(401, 'Inicia sesión para continuar.'); next(); }
function admin(req, res, next) { if (req.user?.rol !== 'ADMINISTRADOR') throw new AppError(403, 'Esta operación requiere un administrador.'); next(); }
function csrf(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const token = req.get('X-CSRF-Token'), expected = req.session?.csrf;
    if (!token || !expected || Buffer.byteLength(token) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) throw new AppError(403, 'La sesión del formulario venció. Actualiza la página.');
    const origin = req.get('Origin');
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) throw new AppError(403, 'Origen de solicitud no permitido.');
  }
  next();
}
module.exports = { loadUser, authenticated, admin, csrf };

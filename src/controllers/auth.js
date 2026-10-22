const crypto = require('node:crypto');
const argon2 = require('argon2');
const pool = require('../config/database');
const { AppError } = require('../utils/errors');
const dummy = argon2.hash(crypto.randomBytes(32), { type: argon2.argon2id });
exports.token = (req, res) => { req.session.csrf ||= crypto.randomBytes(32).toString('hex'); res.json({ csrfToken: req.session.csrf }); };
exports.login = async (req, res) => {
  const { usuario, password } = req.body || {};
  if (typeof usuario !== 'string' || usuario.length > 50 || typeof password !== 'string' || password.length > 128) throw new AppError(401, 'Usuario o contraseña incorrectos.');
  const [user] = await pool.query('SELECT * FROM usuarios WHERE usuario=?', [usuario.trim()]);
  let valid = false;
  try { valid = await argon2.verify(user?.password_hash || await dummy, password); } catch { /* Invalid hash. */ }
  if (!valid || user?.estado !== 'ACTIVO') throw new AppError(401, 'Usuario o contraseña incorrectos.');
  await new Promise((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
  req.session.userId = user.id_usuario;
  req.session.authVersion = crypto.createHash('sha256').update(user.password_hash).digest('hex');
  req.session.csrf = crypto.randomBytes(32).toString('hex');
  await new Promise((resolve, reject) => req.session.save(e => e ? reject(e) : resolve()));
  res.json({ mensaje: 'Sesión iniciada.', csrfToken: req.session.csrf });
};
exports.logout = async (req, res) => {
  await new Promise((resolve, reject) => req.session.destroy(e => e ? reject(e) : resolve()));
  res.clearCookie('libertad.sid'); res.json({ mensaje: 'Sesión cerrada.' });
};

const pool = require('../config/database');
const tx = require('./transaction');
const argon2 = require('argon2');
const { ensure, AppError } = require('../utils/errors');
const { schemas, validate, password, positiveId } = require('../utils/validation');
const definitions = {
  estudiantes: { table: 'estudiantes', id: 'id_estudiante', search: ['codigo_estudiante', 'nombres', 'apellidos', 'numero_documento'] },
  apoderados: { table: 'apoderados', id: 'id_apoderado', search: ['nombres', 'apellidos', 'numero_documento'] },
  anios: { table: 'anios_escolares', id: 'id_anio', search: ['anio'] },
  grados: { table: 'grados', id: 'id_grado', search: ['nivel', 'numero_grado'] },
  secciones: { table: 'secciones', id: 'id_seccion', search: ['s.nombre', 'g.nivel', 'g.numero_grado'],
    from: 'secciones s JOIN grados g ON g.id_grado=s.id_grado JOIN anios_escolares a ON a.id_anio=s.id_anio',
    select: 's.*,g.nivel,g.numero_grado,a.anio,(SELECT COUNT(*) FROM matriculas m WHERE m.id_seccion=s.id_seccion AND m.estado=\'REGISTRADA\') AS ocupados', alias: 's.', order: 'a.anio DESC,g.nivel,g.numero_grado,s.nombre,s.id_seccion' },
  relaciones: { table: 'estudiante_apoderado', id: 'id_relacion', search: ['e.nombres', 'e.apellidos', 'p.nombres', 'p.apellidos'],
    from: 'estudiante_apoderado r JOIN estudiantes e ON e.id_estudiante=r.id_estudiante JOIN apoderados p ON p.id_apoderado=r.id_apoderado',
    select: "r.*,CONCAT(e.apellidos,', ',e.nombres) AS estudiante,CONCAT(p.apellidos,', ',p.nombres) AS apoderado", alias: 'r.' },
  usuarios: { table: 'usuarios', id: 'id_usuario', search: ['usuario', 'nombre_completo'], select: 'id_usuario,usuario,nombre_completo,rol,estado,creado_en' },
  matriculas: { table: 'matriculas', id: 'id_matricula', search: ['e.nombres', 'e.apellidos', 'e.codigo_estudiante'],
    from: 'matriculas m JOIN estudiantes e ON e.id_estudiante=m.id_estudiante JOIN anios_escolares a ON a.id_anio=m.id_anio JOIN secciones s ON s.id_seccion=m.id_seccion JOIN grados g ON g.id_grado=s.id_grado',
    select: "m.*,CONCAT(e.apellidos,', ',e.nombres) AS estudiante,e.codigo_estudiante,a.anio,g.nivel,g.numero_grado,s.nombre AS seccion", alias: 'm.' }
};
function filter(resource, query) {
  const d = definitions[resource], where = [], params = [], alias = d.alias || '';
  if (query.q) {
    ensure(typeof query.q === 'string' && query.q.length <= 150, 'Búsqueda demasiado larga.');
    where.push(`(${d.search.map(c => `${c} LIKE ?`).join(' OR ')})`);
    params.push(...d.search.map(() => `%${query.q}%`));
  }
  const columns = { estado: alias + 'estado' };
  if (['secciones', 'matriculas'].includes(resource)) { columns.id_anio = alias + 'id_anio'; columns.nivel = 'g.nivel'; columns.id_grado = resource === 'secciones' ? 's.id_grado' : 'g.id_grado'; }
  if (resource === 'matriculas') columns.id_seccion = 'm.id_seccion';
  if (resource === 'relaciones') { columns.id_estudiante = 'r.id_estudiante'; columns.id_apoderado = 'r.id_apoderado'; delete columns.estado; }
  if (resource === 'grados') { columns.nivel = 'nivel'; delete columns.estado; }
  for (const [key, col] of Object.entries(columns)) if (query[key]) { where.push(`${col}=?`); params.push(key.startsWith('id_') ? positiveId(query[key]) : String(query[key]).slice(0, 30)); }
  return { sql: where.length ? ' WHERE ' + where.join(' AND ') : '', params };
}
async function list(resource, query = {}) {
  const d = definitions[resource], f = filter(resource, query);
  const page = Math.max(1, Math.min(1000000, Number(query.page) || 1)) | 0;
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 15)) | 0;
  const from = d.from || d.table;
  const [count] = await pool.query(`SELECT COUNT(*) AS total FROM ${from}${f.sql}`, f.params);
  const order = d.order || (resource === 'grados' ? 'nivel,numero_grado,id_grado' : resource === 'anios' ? 'anio DESC,id_anio DESC' : `${d.alias || ''}${d.id} DESC`);
  const rows = await pool.query(`SELECT ${d.select || '*'} FROM ${from}${f.sql} ORDER BY ${order} LIMIT ? OFFSET ?`, [...f.params, limit, (page - 1) * limit]);
  return { data: rows, total: Number(count.total), page, limit };
}
async function detail(resource, id) {
  const d = definitions[resource];
  const [row] = await pool.query(`SELECT ${d.select || '*'} FROM ${d.from || d.table} WHERE ${d.alias || ''}${d.id}=?`, [id]);
  ensure(row, 'Registro no encontrado.', 404); return row;
}
async function persist(conn, d, values, id) {
  if (id) {
    const result = await conn.query(`UPDATE ${d.table} SET ${Object.keys(values).map(k => `${k}=?`).join(',')} WHERE ${d.id}=?`, [...Object.values(values), id]);
    // Existence was checked under a row lock before updating.
    return id;
  }
  const result = await conn.query(`INSERT INTO ${d.table} (${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map(() => '?').join(',')})`, Object.values(values));
  return Number(result.insertId);
}
async function save(resource, body, id, actor) {
  const d = definitions[resource], values = validate(schemas[resource], body);
  if (resource === 'usuarios' && (!id || body.password)) values.password_hash = await argon2.hash(password(body.password), { type: argon2.argon2id });
  return tx(async conn => {
    let current;
    // Serializes administrator demotions, including concurrent edits.
    if (resource === 'usuarios') {
      const users = await conn.query('SELECT id_usuario,rol,estado FROM usuarios ORDER BY id_usuario FOR UPDATE');
      current = users.find(u => u.id_usuario === id);
      if (id) ensure(current, 'Usuario no encontrado.', 404);
      if (id === actor.id_usuario) ensure(values.estado === 'ACTIVO' && values.rol === 'ADMINISTRADOR', 'No puedes desactivar tu cuenta ni quitarte el rol de administrador.');
      if (current?.rol === 'ADMINISTRADOR' && current.estado === 'ACTIVO' && (values.rol !== 'ADMINISTRADOR' || values.estado !== 'ACTIVO')) ensure(users.some(u => u.id_usuario !== id && u.rol === 'ADMINISTRADOR' && u.estado === 'ACTIVO'), 'Debe permanecer al menos un administrador activo.');
    } else if (resource === 'secciones') {
      // Same lock order used by enrollment creation and school-year editing.
      const [year] = await conn.query('SELECT * FROM anios_escolares WHERE id_anio=? FOR UPDATE', [values.id_anio]);
      ensure(year, 'Año escolar inexistente.');
      if (id) {
        [current] = await conn.query('SELECT * FROM secciones WHERE id_seccion=? FOR UPDATE', [id]);
        ensure(current, 'Sección no encontrada.', 404);
        const [count] = await conn.query("SELECT COUNT(*) AS total, SUM(estado='REGISTRADA') AS activos FROM matriculas WHERE id_seccion=?", [id]);
        ensure(Number(count.activos || 0) <= values.capacidad, 'La capacidad no puede ser menor al número de matrículas registradas.');
        if (Number(count.total)) ensure(current.id_anio === values.id_anio && current.id_grado === values.id_grado, 'Una sección con historial de matrículas no puede cambiar de año ni grado.');
      }
      const [grade] = await conn.query('SELECT id_grado FROM grados WHERE id_grado=?', [values.id_grado]); ensure(grade, 'Grado inexistente.');
    } else if (resource === 'relaciones') {
      if (id) {
        [current] = await conn.query('SELECT * FROM estudiante_apoderado WHERE id_relacion=?', [id]);
        ensure(current, 'Relación no encontrada.', 404);
        ensure(current.id_estudiante === values.id_estudiante && current.id_apoderado === values.id_apoderado, 'Para cambiar las personas, desvincula y registra una nueva relación.');
      }
      const [student] = await conn.query('SELECT estado FROM estudiantes WHERE id_estudiante=? FOR UPDATE', [values.id_estudiante]);
      const [guardian] = await conn.query('SELECT estado FROM apoderados WHERE id_apoderado=? FOR UPDATE', [values.id_apoderado]);
      ensure(student && guardian, 'Estudiante o apoderado inexistente.');
      ensure(student.estado === 'ACTIVO' && guardian.estado === 'ACTIVO', 'Solo puedes vincular personas activas.');
      if (values.es_principal) await conn.query('UPDATE estudiante_apoderado SET es_principal=0 WHERE id_estudiante=?', [values.id_estudiante]);
    } else if (id) {
      [current] = await conn.query(`SELECT ${d.id} FROM ${d.table} WHERE ${d.id}=? FOR UPDATE`, [id]);
      ensure(current, 'Registro no encontrado.', 404);
    }
    return persist(conn, d, values, id);
  });
}
async function remove(resource, id) {
  ensure(['estudiantes', 'apoderados', 'relaciones', 'secciones'].includes(resource), 'Esta entidad se conserva mediante su estado.', 405);
  const d = definitions[resource];
  const result = await pool.query(`DELETE FROM ${d.table} WHERE ${d.id}=?`, [id]);
  ensure(result.affectedRows, 'Registro no encontrado.', 404);
}
module.exports = { definitions, list, detail, save, remove, persist, filter };

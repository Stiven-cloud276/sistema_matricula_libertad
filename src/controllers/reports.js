const pool = require('../config/database');
const { positiveId } = require('../utils/validation');
function conditions(query) {
  const where = ["m.estado='REGISTRADA'"], params = [];
  for (const [k, col] of Object.entries({ id_anio: 'm.id_anio', id_grado: 'g.id_grado', id_seccion: 's.id_seccion', nivel: 'g.nivel' })) if (query[k]) { where.push(`${col}=?`); params.push(k === 'nivel' ? String(query[k]).slice(0, 20) : positiveId(query[k])); }
  return { sql: where.join(' AND '), params };
}
const joins = 'matriculas m JOIN secciones s ON s.id_seccion=m.id_seccion JOIN grados g ON g.id_grado=s.id_grado JOIN anios_escolares a ON a.id_anio=m.id_anio';
async function rows(query) {
  const where = [], params = [];
  for (const [key, column] of Object.entries({ id_anio: 's.id_anio', nivel: 'g.nivel', id_grado: 'g.id_grado', id_seccion: 's.id_seccion' })) if (query[key]) {
    where.push(`${column}=?`); params.push(key === 'nivel' ? String(query[key]).slice(0, 20) : positiveId(query[key]));
  }
  return pool.query(`SELECT a.anio,g.nivel,g.numero_grado,s.nombre AS seccion,COUNT(m.id_matricula) AS matriculas
    FROM secciones s JOIN grados g ON g.id_grado=s.id_grado JOIN anios_escolares a ON a.id_anio=s.id_anio
    LEFT JOIN matriculas m ON m.id_seccion=s.id_seccion AND m.estado='REGISTRADA'
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY a.anio,g.nivel,g.numero_grado,s.id_seccion,s.nombre ORDER BY a.anio DESC,g.nivel,g.numero_grado,s.nombre`, params);
}
exports.report = async (req, res) => {
  const data = await rows(req.query);
  const [students] = await pool.query('SELECT COUNT(*) AS total FROM estudiantes');
  res.json({ data, totalEstudiantes: Number(students.total) });
};
exports.dashboard = async (req, res) => {
  const f = conditions(req.query);
  const [counts] = await pool.query(`SELECT (SELECT COUNT(*) FROM estudiantes WHERE estado='ACTIVO') AS estudiantes,(SELECT COUNT(*) FROM apoderados WHERE estado='ACTIVO') AS apoderados,(SELECT COUNT(*) FROM secciones WHERE estado='ACTIVA') AS secciones`);
  const [enrolled] = await pool.query(`SELECT COUNT(*) AS matriculas FROM ${joins} WHERE ${f.sql}`, f.params);
  const levels = await pool.query(`SELECT g.nivel,COUNT(*) AS total FROM ${joins} WHERE ${f.sql} GROUP BY g.nivel`, f.params);
  const recent = await pool.query(`SELECT m.id_matricula,CONCAT(e.apellidos,', ',e.nombres) AS estudiante,a.anio,g.nivel,g.numero_grado,s.nombre AS seccion,m.fecha_matricula,m.estado FROM ${joins} JOIN estudiantes e ON e.id_estudiante=m.id_estudiante WHERE ${f.sql} ORDER BY m.id_matricula DESC LIMIT 6`, f.params);
  res.json({ counts: { ...counts, ...enrolled }, levels, recent, grades: (await rows(req.query)).filter(row => Number(row.matriculas) > 0) });
};
function csv(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
exports.csv = async (req, res) => {
  const data = await rows(req.query);
  const keys = ['anio', 'nivel', 'numero_grado', 'seccion', 'matriculas'];
  res.set('Content-Disposition', 'attachment; filename="reporte-matriculas.csv"');
  res.type('text/csv; charset=utf-8').send('\uFEFF' + [keys, ...data.map(r => keys.map(k => r[k]))].map(r => r.map(csv).join(',')).join('\r\n'));
};

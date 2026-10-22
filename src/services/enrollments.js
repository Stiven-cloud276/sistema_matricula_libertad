const tx = require('./transaction');
const { ensure } = require('../utils/errors');
const { schemas, validate } = require('../utils/validation');
const { persist, definitions } = require('./resources');
async function save(body, id, action) {
  return tx(async conn => {
    let current;
    if (id) {
      [current] = await conn.query('SELECT * FROM matriculas WHERE id_matricula=? FOR UPDATE', [id]);
      ensure(current, 'Matrícula no encontrada.', 404);
    }
    const values = action ? { ...current, estado: action === 'anular' ? 'ANULADA' : 'REGISTRADA' } : validate(schemas.matriculas, body);
    if (id) ensure(current.id_estudiante === values.id_estudiante && current.id_anio === values.id_anio, 'El estudiante y el año forman el historial de la matrícula. Anula el registro y utiliza el periodo correspondiente.');
    const [year] = await conn.query('SELECT * FROM anios_escolares WHERE id_anio=? FOR UPDATE', [values.id_anio]);
    const [student] = await conn.query('SELECT estado FROM estudiantes WHERE id_estudiante=? FOR UPDATE', [values.id_estudiante]);
    const [section] = await conn.query('SELECT * FROM secciones WHERE id_seccion=? FOR UPDATE', [values.id_seccion]);
    ensure(year && student && section, 'El estudiante, año y sección deben existir.');
    ensure(section.id_anio === values.id_anio, 'La sección no pertenece al año seleccionado.');
    if (values.estado === 'REGISTRADA') {
      ensure(year.estado === 'ACTIVO', 'El año escolar está cerrado.');
      ensure(student.estado === 'ACTIVO', 'El estudiante está inactivo.');
      ensure(section.estado === 'ACTIVA', 'La sección está inactiva.');
      const [count] = await conn.query("SELECT COUNT(*) AS total FROM matriculas WHERE id_seccion=? AND estado='REGISTRADA' AND id_matricula<>?", [values.id_seccion, id || 0]);
      ensure(Number(count.total) < section.capacidad, 'La sección no tiene vacantes disponibles.', 409);
    }
    const [duplicate] = await conn.query('SELECT id_matricula FROM matriculas WHERE id_estudiante=? AND id_anio=? AND id_matricula<>?', [values.id_estudiante, values.id_anio, id || 0]);
    ensure(!duplicate, 'Ya existe una matrícula para este estudiante y año. Edita o reactiva el registro existente.', 409);
    const fields = Object.fromEntries(Object.keys(schemas.matriculas).map(k => [k, values[k]]));
    return persist(conn, definitions.matriculas, fields, id);
  });
}
module.exports = { save };

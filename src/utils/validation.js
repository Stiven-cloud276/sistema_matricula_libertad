const { AppError } = require('./errors');
const f = (label, max, extra = {}) => ({ label, max, ...extra });
const enums = (label, values) => ({ label, values });
const id = label => ({ label, integer: true, min: 1, maxNumber: 4294967295 });
const estado = enums('Estado', ['ACTIVO', 'INACTIVO']);
const persona = {
  tipo_documento: enums('Tipo de documento', ['DNI', 'CE', 'OTRO']),
  numero_documento: f('Documento', 20, { optional: true }),
  nombres: f('Nombres', 100), apellidos: f('Apellidos', 120), estado
};
const schemas = {
  estudiantes: { codigo_estudiante: f('Código', 20), ...persona,
    fecha_nacimiento: { label: 'Nacimiento', date: true, optional: true, past: true },
    sexo: { ...enums('Sexo', ['M', 'F']), optional: true } },
  apoderados: { ...persona, telefono: f('Teléfono', 20, { optional: true, phone: true }),
    correo: f('Correo', 120, { optional: true, email: true }) },
  anios: { anio: { label: 'Año escolar', integer: true, min: 2000, maxNumber: 2200 }, estado: enums('Estado', ['ACTIVO', 'CERRADO']) },
  secciones: { id_anio: id('Año'), id_grado: id('Grado'), nombre: f('Sección', 5),
    capacidad: { label: 'Capacidad', integer: true, min: 1, maxNumber: 1000 }, estado: enums('Estado', ['ACTIVA', 'INACTIVA']) },
  relaciones: { id_estudiante: id('Estudiante'), id_apoderado: id('Apoderado'),
    parentesco: enums('Parentesco', ['PADRE', 'MADRE', 'TUTOR', 'OTRO']),
    es_principal: { label: 'Principal', integer: true, min: 0, maxNumber: 1 } },
  matriculas: { id_estudiante: id('Estudiante'), id_anio: id('Año'), id_seccion: id('Sección'),
    fecha_matricula: { label: 'Fecha de matrícula', date: true }, estado: enums('Estado', ['REGISTRADA', 'ANULADA']),
    observaciones: f('Observaciones', 4000, { optional: true }) },
  usuarios: { usuario: f('Usuario', 50, { username: true }), nombre_completo: f('Nombre completo', 150),
    rol: enums('Rol', ['ADMINISTRADOR', 'MATRICULAS']), estado }
};
function validate(schema, body) {
  const values = {}, errors = {};
  for (const [key, rule] of Object.entries(schema)) {
    let v = body?.[key];
    if (typeof v === 'string') v = v.trim();
    if (v === undefined || v === null || v === '') {
      if (rule.optional) { values[key] = null; continue; }
      errors[key] = `${rule.label}: campo obligatorio.`; continue;
    }
    let invalid = typeof v !== 'string' && typeof v !== 'number';
    if (rule.integer) {
      invalid ||= !/^\d+$/.test(String(v)) || !Number.isSafeInteger(Number(v)) || Number(v) < rule.min || Number(v) > rule.maxNumber;
      v = Number(v);
    } else {
      invalid ||= typeof v !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
      if (rule.max) invalid ||= String(v).length > rule.max;
      if (rule.values) invalid ||= !rule.values.includes(v);
      if (rule.email) invalid ||= !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      if (rule.phone) invalid ||= !/^[+\d ()-]{6,20}$/.test(v);
      if (rule.username) invalid ||= !/^[a-zA-Z0-9._-]{3,50}$/.test(v);
      if (rule.date) {
        const d = new Date(`${v}T00:00:00Z`);
        invalid ||= !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v || v < '1900-01-01';
        if (rule.past) invalid ||= v > new Date().toISOString().slice(0, 10);
      }
    }
    if (invalid) errors[key] = `${rule.label}: valor o formato no válido.`;
    values[key] = v;
  }
  if (values.tipo_documento === 'DNI' && values.numero_documento && !/^\d{8}$/.test(values.numero_documento)) errors.numero_documento = 'El DNI debe contener exactamente 8 dígitos.';
  if (Object.keys(errors).length) throw new AppError(422, 'Revisa los campos del formulario.', errors);
  return values;
}
function positiveId(v) { return validate({ id: id('Identificador') }, { id: v }).id; }
function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new AppError(422, 'La contraseña debe tener entre 12 y 128 caracteres.', { password: 'Usa entre 12 y 128 caracteres.' });
  return value;
}
module.exports = { schemas, validate, positiveId, password };

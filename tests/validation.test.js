const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, schemas, positiveId, password } = require('../src/utils/validation');
const student = { codigo_estudiante: 'TEST', tipo_documento: 'DNI', numero_documento: '12345678', nombres: 'Ficticio', apellidos: 'Prueba', fecha_nacimiento: '2015-02-28', sexo: 'M', estado: 'ACTIVO' };
test('Valida DNI, fechas reales, identificadores y longitud de contraseñas', () => {
  assert.equal(validate(schemas.estudiantes, student).numero_documento, '12345678');
  for (const change of [{ numero_documento: '123' }, { fecha_nacimiento: '2015-02-30' }, { fecha_nacimiento: '2200-01-01' }, { nombres: 'x'.repeat(101) }, { sexo: 'NO' }]) assert.throws(() => validate(schemas.estudiantes, { ...student, ...change }), { status: 422 });
  for (const id of [0, '-1', '1 OR 1=1', 1.5, {}, '999999999999999']) assert.throws(() => positiveId(id), { status: 422 });
  assert.throws(() => password('corta'), { status: 422 });
  assert.throws(() => password('a'.repeat(129)), { status: 422 });
});
test('Campos opcionales vacíos se guardan como NULL y se descartan campos no permitidos', () => {
  const result = validate(schemas.estudiantes, { ...student, numero_documento: '', fecha_nacimiento: '', rol: 'ADMINISTRADOR' });
  assert.equal(result.numero_documento, null); assert.equal(result.fecha_nacimiento, null); assert.equal(result.rol, undefined);
});

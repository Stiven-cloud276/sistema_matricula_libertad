require('dotenv').config({ quiet: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const argon2 = require('argon2');
const pool = require('../src/config/database');
const app = require('../src/app');
const tables = { relaciones: ['estudiante_apoderado', 'id_relacion'], matriculas: ['matriculas', 'id_matricula'], secciones: ['secciones', 'id_seccion'], estudiantes: ['estudiantes', 'id_estudiante'], apoderados: ['apoderados', 'id_apoderado'], anios: ['anios_escolares', 'id_anio'], usuarios: ['usuarios', 'id_usuario'] };
test('Integración real MariaDB: autenticación, CRUD, roles, relaciones, cupos simultáneos y reportes', { timeout: 90000 }, async t => {
  const created = Object.fromEntries(Object.keys(tables).map(k => [k, []]));
  const baseline = {};
  for (const [key, [table]] of Object.entries(tables)) baseline[key] = Number((await pool.query('SELECT COUNT(*) AS total FROM ' + table))[0].total);
  const tag = 'test_' + crypto.randomBytes(5).toString('hex');
  const secret = crypto.randomBytes(24).toString('base64url');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  function client() {
    return { cookie: '', token: '', async request(path, method = 'GET', body, expected = 200, withCsrf = true) {
      const response = await fetch(base + path, { method, redirect: 'manual', headers: { Cookie: this.cookie, ...(withCsrf ? { 'X-CSRF-Token': this.token } : {}), 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
      const cookies = response.headers.getSetCookie(); if (cookies.length) this.cookie = cookies.map(c => c.split(';')[0]).join('; ');
      const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
      if (response.status === 201 && data.id) { const key = path.split('/')[2]; if (created[key]) created[key].push(data.id); }
      assert.equal(response.status, expected, `${method} ${path}: ${typeof data === 'object' ? data.mensaje || '' : 'HTML'}`);
      if (data.csrfToken) this.token = data.csrfToken;
      return { data, response, text };
    } };
  }
  const admin = client(), staff = client(), anon = client();
  let checks = 0;
  async function check(label, work) { await work(); checks++; t.diagnostic('OK: ' + label); }
  try {
    const hash = await argon2.hash(secret, { type: argon2.argon2id });
    const inserted = await pool.query("INSERT INTO usuarios(usuario,password_hash,nombre_completo,rol,estado) VALUES (?,?,?,'ADMINISTRADOR','ACTIVO')", [tag, hash, 'Administrador ficticio de prueba']);
    created.usuarios.push(Number(inserted.insertId));
    await check('Diagnósticos y rutas privadas', async () => {
      await anon.request('/api/health'); await anon.request('/api/estado-db'); await anon.request('/api/estudiantes', 'GET', undefined, 401); await anon.request('/panel', 'GET', undefined, 302);
      const login = await anon.request('/'); assert.match(login.text, /login-form/);
      const headers = login.response.headers; assert.ok(headers.get('content-security-policy')); assert.ok(!headers.get('x-powered-by'));
      for (const asset of ['/css/app.css', '/js/panel.js', '/vendor/bootstrap/css/bootstrap.min.css', '/vendor/bootstrap/js/bootstrap.bundle.min.js', '/vendor/icons/bootstrap-icons.min.css', '/img/escudo-colegio.webp']) await anon.request(asset);
    });
    await check('Login real, cookie HttpOnly y CSRF', async () => {
      await admin.request('/api/auth/csrf');
      await admin.request('/api/auth/login', 'POST', { usuario: tag, password: secret }, 403, false);
      await admin.request('/api/auth/login', 'POST', { usuario: tag, password: 'incorrecta' }, 401);
      const login = await admin.request('/api/auth/login', 'POST', { usuario: tag, password: secret });
      assert.match(login.response.headers.get('set-cookie'), /HttpOnly/i); assert.match(login.response.headers.get('set-cookie'), /SameSite=Strict/i);
      const me = await admin.request('/api/auth/me'); assert.equal(me.data.user.rol, 'ADMINISTRADOR'); assert.ok(!me.text.includes('password_hash'));
      await admin.request('/panel');
      await admin.request('/api/estudiantes', 'POST', {}, 403, false);
    });
    const staffBody = { usuario: tag + '_m', nombre_completo: 'Operador ficticio', rol: 'MATRICULAS', estado: 'ACTIVO', password: secret };
    const staffId = (await admin.request('/api/usuarios', 'POST', staffBody, 201)).data.id;
    await staff.request('/api/auth/csrf'); await staff.request('/api/auth/login', 'POST', { usuario: staffBody.usuario, password: secret });
    await check('Permisos del rol MATRICULAS', async () => {
      await staff.request('/api/usuarios', 'GET', undefined, 403); await staff.request('/api/anios', 'POST', { anio: 2111, estado: 'ACTIVO' }, 403); await staff.request('/api/secciones', 'POST', {}, 403); await staff.request('/api/grados');
      const users = await admin.request('/api/usuarios'); assert.ok(!users.text.includes('password_hash')); assert.ok(!users.text.includes('$argon2'));
    });
    const years = await pool.query('SELECT anio FROM anios_escolares');
    const yearNumber = Array.from({ length: 100 }, (_, i) => 2100 + i).find(y => !years.some(a => a.anio === y));
    assert.ok(yearNumber, 'Se necesita un año de prueba libre entre 2100 y 2199.');
    const yearId = (await admin.request('/api/anios', 'POST', { anio: yearNumber, estado: 'ACTIVO' }, 201)).data.id;
    const grades = (await admin.request('/api/grados')).data.data; const grade = grades[0].id_grado;
    const sectionBody = { id_anio: yearId, id_grado: grade, nombre: 'TEST', capacidad: 1, estado: 'ACTIVA' };
    const sectionId = (await admin.request('/api/secciones', 'POST', sectionBody, 201)).data.id;
    const studentBody = { codigo_estudiante: tag, tipo_documento: 'OTRO', numero_documento: '', nombres: 'Estudiante ficticio', apellidos: 'Integración Uno', fecha_nacimiento: '2015-05-05', sexo: 'F', estado: 'ACTIVO' };
    let studentId, student2Id, guardianId, relationId;
    await check('CRUD estudiantes, duplicados, búsqueda, fechas y SQL parametrizado', async () => {
      studentId = (await staff.request('/api/estudiantes', 'POST', studentBody, 201)).data.id;
      student2Id = (await staff.request('/api/estudiantes', 'POST', { ...studentBody, codigo_estudiante: tag + '_2' }, 201)).data.id;
      await staff.request('/api/estudiantes', 'POST', studentBody, 409);
      await staff.request('/api/estudiantes', 'POST', { ...studentBody, codigo_estudiante: tag + '_bad', tipo_documento: 'DNI', numero_documento: '123' }, 422);
      await staff.request('/api/estudiantes', 'PUT', { ...studentBody }, 404); // Invalid route cannot update a record.
      await staff.request('/api/estudiantes/' + studentId, 'PUT', { ...studentBody, fecha_nacimiento: '2015-02-30' }, 422);
      await staff.request('/api/estudiantes/' + studentId, 'PUT', { ...studentBody, nombres: 'Estudiante ficticio editado' });
      const found = await staff.request('/api/estudiantes?q=' + tag); assert.equal(found.data.total, 2);
      const attack = await staff.request('/api/estudiantes?q=' + encodeURIComponent("' OR 1=1 --")); assert.equal(attack.data.total, 0);
      await staff.request('/api/estudiantes/' + studentId); await staff.request('/api/estudiantes/0', 'GET', undefined, 422);
    });
    const guardian = { tipo_documento: 'OTRO', nombres: 'Tutor ficticio', apellidos: tag, telefono: '', correo: '', estado: 'ACTIVO' };
    await check('CRUD apoderados, vínculo compartido y protección de relaciones', async () => {
      guardianId = (await staff.request('/api/apoderados', 'POST', guardian, 201)).data.id;
      await staff.request('/api/apoderados/' + guardianId, 'PUT', { ...guardian, correo: 'invalido' }, 422);
      await staff.request('/api/apoderados/' + guardianId, 'PUT', { ...guardian, nombres: 'Tutor ficticio editado' });
      const relation = { id_estudiante: studentId, id_apoderado: guardianId, parentesco: 'TUTOR', es_principal: 1 };
      relationId = (await staff.request('/api/relaciones', 'POST', relation, 201)).data.id;
      await staff.request('/api/relaciones', 'POST', { ...relation, id_estudiante: student2Id }, 201);
      await staff.request('/api/relaciones', 'POST', relation, 409);
      await staff.request('/api/apoderados/' + guardianId, 'DELETE', undefined, 409);
      await staff.request('/api/estudiantes/' + studentId, 'DELETE', undefined, 409);
      await staff.request('/api/relaciones/' + relationId, 'PUT', { ...relation, parentesco: 'OTRO' });
      await staff.request('/api/relaciones?id_apoderado=' + guardianId);
    });
    const enrollment = id => ({ id_estudiante: id, id_anio: yearId, id_seccion: sectionId, fecha_matricula: '2026-10-21', estado: 'REGISTRADA', observaciones: 'Solo datos ficticios de integración' });
    let enrollmentId, winner, loser;
    await check('Dos solicitudes simultáneas no exceden un cupo', async () => {
      const responses = await Promise.all([studentId, student2Id].map(async id => {
        const response = await fetch(base + '/api/matriculas', { method: 'POST', headers: { Cookie: staff.cookie, 'X-CSRF-Token': staff.token, 'Content-Type': 'application/json' }, body: JSON.stringify(enrollment(id)) });
        const data = await response.json(); if (response.status === 201) { created.matriculas.push(data.id); enrollmentId = data.id; winner = id; } else loser = id;
        return response.status;
      }));
      assert.deepEqual(responses.sort(), [201, 409]);
      const count = (await pool.query("SELECT COUNT(*) AS n FROM matriculas WHERE id_seccion=? AND estado='REGISTRADA'", [sectionId]))[0]; assert.equal(Number(count.n), 1);
    });
    await check('Duplicados, anulación, reactivación, edición y capacidad', async () => {
      await staff.request('/api/matriculas', 'POST', enrollment(winner), 409);
      await staff.request('/api/matriculas/' + enrollmentId + '/anular', 'PATCH');
      await staff.request('/api/matriculas', 'POST', enrollment(winner), 409);
      await staff.request('/api/matriculas/' + enrollmentId + '/reactivar', 'PATCH');
      await staff.request('/api/matriculas/' + enrollmentId, 'PUT', { ...enrollment(winner), observaciones: 'Editado en prueba' });
      await staff.request('/api/matriculas/' + enrollmentId, 'PUT', { ...enrollment(loser) }, 422);
      await admin.request('/api/secciones/' + sectionId, 'PUT', { ...sectionBody, capacidad: 2 });
      await staff.request('/api/matriculas', 'POST', enrollment(loser), 201);
      await admin.request('/api/secciones/' + sectionId, 'PUT', sectionBody, 422);
      await admin.request('/api/secciones/' + sectionId, 'DELETE', undefined, 409);
    });
    await check('Año cerrado, sección de otro periodo y estudiante inactivo', async () => {
      await admin.request('/api/anios/' + yearId, 'PUT', { anio: yearNumber, estado: 'CERRADO' });
      await staff.request('/api/matriculas/' + enrollmentId + '/anular', 'PATCH');
      await staff.request('/api/matriculas/' + enrollmentId + '/reactivar', 'PATCH', undefined, 422);
      await admin.request('/api/anios/' + yearId, 'PUT', { anio: yearNumber, estado: 'ACTIVO' });
      await staff.request('/api/estudiantes/' + winner, 'PUT', { ...studentBody, codigo_estudiante: winner === studentId ? tag : tag + '_2', estado: 'INACTIVO' });
      await staff.request('/api/matriculas/' + enrollmentId + '/reactivar', 'PATCH', undefined, 422);
      await staff.request('/api/estudiantes/' + winner, 'PUT', { ...studentBody, codigo_estudiante: winner === studentId ? tag : tag + '_2' });
      await staff.request('/api/matriculas/' + enrollmentId + '/reactivar', 'PATCH');
      const [other] = await pool.query('SELECT id_seccion FROM secciones WHERE id_anio<>? LIMIT 1', [yearId]);
      if (other) await staff.request('/api/matriculas/' + enrollmentId, 'PUT', { ...enrollment(winner), id_seccion: other.id_seccion }, 422);
    });
    await check('Dashboard, reportes filtrados y exportación CSV reales', async () => {
      const dashboard = await staff.request('/api/dashboard/resumen?id_anio=' + yearId); assert.equal(Number(dashboard.data.counts.matriculas), 2);
      const report = await staff.request('/api/reportes?id_anio=' + yearId); assert.equal(Number(report.data.data[0].matriculas), 2);
      const csv = await staff.request('/api/reportes/csv?id_anio=' + yearId); assert.match(csv.response.headers.get('content-type'), /text\/csv/); assert.match(csv.text, new RegExp(String(yearNumber)));
    });
    await check('Usuarios: no desactivar cuenta propia, contraseña con hash y revocación de sesión', async () => {
      const { recover } = require('../scripts/recover-access');
      const recoverySecret = crypto.randomBytes(24).toString('base64url');
      await recover(staffBody.usuario, recoverySecret);
      const [recovered] = await pool.query('SELECT rol,estado,password_hash FROM usuarios WHERE id_usuario=?', [staffId]);
      assert.equal(recovered.rol, 'MATRICULAS');
      assert.equal(recovered.estado, 'ACTIVO');
      assert.ok(await argon2.verify(recovered.password_hash, recoverySecret));
      await staff.request('/api/auth/me', 'GET', undefined, 401);
      await staff.request('/api/auth/csrf');
      await staff.request('/api/auth/login', 'POST', { usuario: staffBody.usuario, password: recoverySecret });
      await assert.rejects(recover(tag + '_ausente', recoverySecret), /no existe/);
      await admin.request('/api/usuarios/' + created.usuarios[0], 'PUT', { usuario: tag, nombre_completo: 'Admin ficticio', rol: 'MATRICULAS', estado: 'ACTIVO' }, 422);
      const newSecret = crypto.randomBytes(24).toString('base64url');
      await admin.request('/api/usuarios/' + staffId, 'PUT', { ...staffBody, password: newSecret });
      await staff.request('/api/auth/me', 'GET', undefined, 401);
      await staff.request('/api/auth/csrf'); await staff.request('/api/auth/login', 'POST', { usuario: staffBody.usuario, password: newSecret });
      await admin.request('/api/usuarios/' + staffId, 'PUT', { ...staffBody, password: '', estado: 'INACTIVO' });
      await staff.request('/api/estudiantes', 'GET', undefined, 401);
    });
    await check('Eliminación de datos sin relaciones y cierre de sesión', async () => {
      await admin.request('/api/relaciones/' + relationId, 'DELETE');
      const disposable = (await admin.request('/api/estudiantes', 'POST', { ...studentBody, codigo_estudiante: tag + '_del' }, 201)).data.id;
      await admin.request('/api/estudiantes/' + disposable, 'DELETE');
      await admin.request('/api/estudiantes/' + disposable, 'GET', undefined, 404);
      await admin.request('/api/auth/logout', 'POST'); await admin.request('/api/auth/me', 'GET', undefined, 401);
    });
    t.diagnostic(`${checks} grupos de comprobaciones completados.`);
  } finally {
    for (const [key, [table, column]] of Object.entries(tables)) if (created[key].length) await pool.query(`DELETE FROM ${table} WHERE ${column} IN (${created[key].map(() => '?').join(',')})`, created[key]);
    for (const [key, [table]] of Object.entries(tables)) assert.equal(Number((await pool.query('SELECT COUNT(*) AS total FROM ' + table))[0].total), baseline[key], 'Se conserva el número original de registros en ' + table);
    await new Promise(resolve => server.close(resolve)); await pool.end();
  }
});

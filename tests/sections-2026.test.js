require('dotenv').config({ quiet: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const argon2 = require('argon2');
const pool = require('../src/config/database');
const app = require('../src/app');
const { snapshot } = require('../scripts/lib/database-backup');
const digest = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

test('Secciones 2026: distribución, migración idempotente, selectores, H/I, reportes e integridad', { timeout: 90000 }, async t => {
  const baseline = await snapshot(pool);
  const [year] = await pool.query('SELECT * FROM anios_escolares WHERE anio=2026');
  const grades = await pool.query('SELECT * FROM grados ORDER BY nivel,numero_grado');
  const sectionRows = baseline.secciones.filter(s => s.id_anio === year.id_anio);
  const studentIds = [], enrollmentIds = [];
  let userId, cookie = '', csrf = '';
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(url, method = 'GET', body, expected = 200) {
    const response = await fetch(base + url, { method, headers: { Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    if (response.status === 201 && url === '/api/estudiantes') studentIds.push(data.id);
    if (response.status === 201 && url === '/api/matriculas') enrollmentIds.push(data.id);
    assert.equal(response.status, expected, `${method} ${url}`);
    if (data.csrfToken) csrf = data.csrfToken;
    return data;
  }
  try {
    assert.equal(sectionRows.length, 99);
    assert.equal(sectionRows.filter(s => grades.find(g => g.id_grado === s.id_grado).nivel === 'PRIMARIA').length, 54);
    assert.equal(sectionRows.filter(s => grades.find(g => g.id_grado === s.id_grado).nivel === 'SECUNDARIA').length, 45);
    for (const grade of grades) assert.equal(sectionRows.filter(s => s.id_grado === grade.id_grado).map(s => s.nombre).sort().join(''), 'ABCDEFGHI');
    t.diagnostic('54 primaria, 45 secundaria; nueve letras por cada uno de los once grados.');

    const sql = await fs.readFile(path.join(__dirname, '../database/migracion_secciones_2026.sql'), 'utf8');
    const insert = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).find(s => s.startsWith('INSERT INTO secciones'));
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // A changed capacity/state must survive reapplying the data migration.
      const existing = sectionRows.find(s => s.nombre === 'A');
      await conn.query("UPDATE secciones SET capacidad=37,estado='INACTIVA' WHERE id_seccion=?", [existing.id_seccion]);
      assert.equal(Number((await conn.query(insert)).affectedRows), 0);
      assert.equal(Number((await conn.query(insert)).affectedRows), 0);
      const [preserved] = await conn.query('SELECT capacidad,estado FROM secciones WHERE id_seccion=?', [existing.id_seccion]);
      assert.equal(preserved.capacidad, 37); assert.equal(preserved.estado, 'INACTIVA');
    } finally { await conn.rollback(); conn.release(); }
    t.diagnostic('Reejecución del SQL sin duplicados; capacidades y estados personalizados conservados (prueba revertida).');

    const tag = 'sec_' + crypto.randomBytes(5).toString('hex'), password = crypto.randomBytes(24).toString('hex');
    userId = Number((await pool.query("INSERT INTO usuarios (usuario,password_hash,nombre_completo,rol,estado) VALUES (?,?,?,'ADMINISTRADOR','ACTIVO')", [tag, await argon2.hash(password), 'Prueba ficticia secciones'])).insertId);
    await request('/api/auth/csrf'); await request('/api/auth/login', 'POST', { usuario: tag, password });
    for (const grade of grades) {
      const listed = await request('/api/secciones?' + new URLSearchParams({ id_anio: year.id_anio, nivel: grade.nivel, id_grado: grade.id_grado, limit: 100 }));
      assert.equal(listed.total, 9);
      assert.equal(listed.data.map(s => s.nombre).join(''), 'ABCDEFGHI');
      for (const section of listed.data) assert.equal(section.id_seccion, sectionRows.find(s => s.id_grado === grade.id_grado && s.nombre === section.nombre).id_seccion);
    }
    const all = await request('/api/secciones?' + new URLSearchParams({ id_anio: year.id_anio, limit: 100 }));
    assert.equal(all.total, 99); assert.equal(all.data.length, 99);
    t.diagnostic('API: filtros año/nivel/grado y IDs reales correctos para los once grados.');

    // Execute the production selector logic in Node, without claiming visual browser QA.
    const elements = new Map();
    class Select {
      constructor(value = '') { this.value = value; this.disabled = false; this.html = ''; }
      set innerHTML(html) {
        this.html = html;
        const selected = html.match(/<option value="([^"]*)" selected/);
        this.value = selected ? selected[1] : (html.match(/<option value="([^"]*)"/)?.[1] || '');
      }
      get innerHTML() { return this.html; }
    }
    for (const key of ['id_anio', 'nivel', 'id_grado', 'id_seccion']) elements.set('#f-' + key, new Select());
    const context = vm.createContext({ URLSearchParams, Intl, Date, Image: class {}, location: { assign() { throw new Error('Sesión de prueba inválida.'); } },
      document: { querySelector: selector => elements.get(selector) || {} }, bootstrap: { Modal: class {} },
      fetch: (url, options) => fetch(base + url, { ...options, headers: { ...options.headers, Cookie: cookie } }) });
    const source = await fs.readFile(path.join(__dirname, '../public/js/panel.js'), 'utf8');
    vm.runInContext(source.slice(0, source.indexOf("$('#record-form').addEventListener")) + '\nformResource="matriculas"; lookups.grados=' + JSON.stringify(grades) + ';', context);
    for (const grade of grades) {
      elements.get('#f-id_anio').value = String(year.id_anio);
      elements.get('#f-nivel').value = grade.nivel;
      elements.get('#f-id_grado').value = String(grade.id_grado);
      await vm.runInContext('cascade()', context);
      const section = elements.get('#f-id_seccion');
      assert.equal(section.disabled, false);
      assert.equal((section.innerHTML.match(/<option /g) || []).length, 10);
      const expected = sectionRows.filter(s => s.id_grado === grade.id_grado).sort((a, b) => a.nombre.localeCompare(b.nombre));
      for (const item of expected) assert.ok(section.innerHTML.includes(`value="${item.id_seccion}"`));
      const selected = expected.find(s => s.nombre === 'I');
      await vm.runInContext('cascade(' + JSON.stringify({ id_grado: grade.id_grado, id_seccion: selected.id_seccion }) + ')', context);
      assert.equal(elements.get('#f-id_seccion').value, String(selected.id_seccion));
    }
    elements.get('#f-id_grado').value = '';
    await vm.runInContext('cascade()', context); assert.equal(elements.get('#f-id_seccion').disabled, true);
    assert.equal((await vm.runInContext('allOptions("secciones")', context)).length, 99);
    t.diagnostic('Lógica real del selector: A-I para los once grados, selección conservada al editar y limpieza al cambiar grado. No es una prueba visual.');

    const targetGrade = grades.find(g => g.nivel === 'SECUNDARIA' && g.numero_grado === 5);
    for (const letter of ['H', 'I']) {
      const section = sectionRows.find(s => s.id_grado === targetGrade.id_grado && s.nombre === letter);
      const student = await request('/api/estudiantes', 'POST', { codigo_estudiante: tag + letter, tipo_documento: 'OTRO', nombres: 'Prueba ficticia ' + letter, apellidos: 'Secciones', estado: 'ACTIVO' }, 201);
      const enrolled = await request('/api/matriculas', 'POST', { id_estudiante: student.id, id_anio: year.id_anio, id_seccion: section.id_seccion, fecha_matricula: '2026-10-21', estado: 'REGISTRADA', observaciones: 'Prueba ficticia temporal H/I' }, 201);
      const detail = await request('/api/matriculas/' + enrolled.id); assert.equal(detail.data.id_seccion, section.id_seccion); assert.equal(detail.data.seccion, letter);
      const list = await request('/api/matriculas?' + new URLSearchParams({ id_anio: year.id_anio, id_grado: targetGrade.id_grado, id_seccion: section.id_seccion, q: tag }));
      assert.equal(list.total, 1);
      const report = await request('/api/reportes?' + new URLSearchParams({ id_seccion: section.id_seccion }));
      assert.equal(report.data.length, 1); assert.equal(report.data[0].seccion, letter); assert.ok(Number(report.data[0].matriculas) >= 1);
      const csv = await request('/api/reportes/csv?' + new URLSearchParams({ id_seccion: section.id_seccion })); assert.ok(csv.includes('"' + letter + '"'));
    }
    const report = await request('/api/reportes?id_anio=' + year.id_anio); assert.equal(report.data.length, 99);
    const expectedEnrollments = baseline.matriculas.filter(m => m.id_anio === year.id_anio && m.estado === 'REGISTRADA').length + 2;
    assert.equal(report.data.reduce((sum, r) => sum + Number(r.matriculas), 0), expectedEnrollments);
    const dash = await request('/api/dashboard/resumen?id_anio=' + year.id_anio);
    assert.equal(Number(dash.counts.matriculas), expectedEnrollments);
    assert.equal(Number(dash.counts.secciones), baseline.secciones.filter(s => s.estado === 'ACTIVA').length);
    await request('/api/auth/logout', 'POST');
    t.diagnostic('Matrículas reales en H/I, filtros, dashboard, reportes de 99 secciones y CSV verificados.');
  } finally {
    try {
      for (const id of enrollmentIds) await pool.query('DELETE FROM matriculas WHERE id_matricula=?', [id]);
      for (const id of studentIds) await pool.query('DELETE FROM estudiantes WHERE id_estudiante=?', [id]);
      if (userId) await pool.query('DELETE FROM usuarios WHERE id_usuario=?', [userId]);
      const after = await snapshot(pool);
      for (const table of Object.keys(baseline)) assert.equal(digest(after[table]), digest(baseline[table]), 'Registros originales conservados en ' + table);
      t.diagnostic('Datos ficticios retirados; comparación completa de las ocho tablas sin cambios en registros preexistentes.');
    } finally { await new Promise(resolve => server.close(resolve)); await pool.end(); }
  }
});

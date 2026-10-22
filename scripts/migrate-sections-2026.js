require('dotenv').config({ quiet: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { backup, snapshot, tables } = require('./lib/database-backup');

async function migrate(connectionPool = pool) {
  const saved = await backup(connectionPool);
  console.log('Copia privada verificada:', path.relative(path.resolve(__dirname, '..'), saved.filename));
  const conn = await connectionPool.getConnection();
  try {
    await conn.beginTransaction();
    const [year] = await conn.query('SELECT * FROM anios_escolares WHERE anio=2026 FOR UPDATE');
    assert.ok(year, 'No existe el año escolar 2026. No se insertaron secciones.');
    const grades = await conn.query('SELECT nivel,numero_grado FROM grados ORDER BY nivel,numero_grado');
    assert.deepEqual(grades.map(g => `${g.nivel}:${g.numero_grado}`), [...Array.from({ length: 6 }, (_, i) => `PRIMARIA:${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `SECUNDARIA:${i + 1}`)], 'La estructura de grados no coincide con los 11 esperados.');
    const before = await snapshot(conn);
    const unexpected = before.secciones.filter(s => s.id_anio === year.id_anio && !/^[A-I]$/.test(s.nombre));
    assert.equal(unexpected.length, 0, 'Existen secciones fuera de A-I en 2026. Se conservaron sin cambios. Revisa sus relaciones antes de decidir qué hacer.');
    // Execute only the INSERT from the reviewed SQL file, inside this transaction.
    const sql = await fs.readFile(path.join(__dirname, '../database/migracion_secciones_2026.sql'), 'utf8');
    const insert = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).find(s => s.startsWith('INSERT INTO secciones'));
    assert.ok(insert, 'No se encontró la inserción de la migración.');
    const result = await conn.query(insert);
    const after = await snapshot(conn);
    for (const table of tables.filter(t => t !== 'secciones')) assert.ok(JSON.stringify(after[table]) === JSON.stringify(before[table]), `Se detectó un cambio inesperado en ${table}.`);
    for (const original of before.secciones) assert.deepEqual(after.secciones.find(s => s.id_seccion === original.id_seccion), original, 'Una sección anterior cambió.');
    const sections = after.secciones.filter(s => s.id_anio === year.id_anio);
    assert.equal(sections.length, 99);
    const gradeIds = [...new Set(sections.map(s => s.id_grado))];
    assert.equal(gradeIds.length, 11);
    for (const id of gradeIds) assert.equal(sections.filter(s => s.id_grado === id).map(s => s.nombre).sort().join(''), 'ABCDEFGHI');
    await conn.commit();
    return { inserted: Number(result.affectedRows), total: sections.length, backup: saved.filename };
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
if (require.main === module) migrate().then(result => {
  console.log(`Migración verificada: ${result.inserted} secciones insertadas; ${result.total} secciones en 2026 (54 primaria, 45 secundaria). Registros anteriores conservados.`);
}).catch(error => {
  console.error(error.code ? `No se completó la migración (${error.code}). No se elevaron privilegios.` : error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
module.exports = { migrate };

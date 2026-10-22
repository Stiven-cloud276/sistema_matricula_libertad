const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const tables = ['usuarios', 'estudiantes', 'apoderados', 'anios_escolares', 'grados', 'estudiante_apoderado', 'secciones', 'matriculas'];

async function snapshot(conn) {
  const data = {};
  for (const table of tables) data[table] = await conn.query(`SELECT * FROM ${table} ORDER BY 1`);
  return data;
}
function literal(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value === '') return "''";
  return `CONVERT(0x${Buffer.from(String(value), 'utf8').toString('hex')} USING utf8mb4)`;
}
async function backup(pool) {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const data = await snapshot(conn);
    let sql = '-- COPIA PRIVADA: contiene datos y hashes de cuentas. No publicar ni incluir en Git.\n-- Restaurar solo en una base VACIA seleccionada por el propietario.\nSET NAMES utf8mb4;\n';
    for (const table of tables) {
      const [schema] = await conn.query(`SHOW CREATE TABLE ${table}`);
      sql += '\n' + schema['Create Table'] + ';\n';
    }
    sql += '\nSTART TRANSACTION;\n';
    for (const table of tables) for (const row of data[table]) {
      sql += `INSERT INTO ${table} (${Object.keys(row).map(key => '`' + key + '`').join(',')}) VALUES (${Object.values(row).map(literal).join(',')});\n`;
    }
    sql += 'COMMIT;\n';
    const directory = path.resolve(__dirname, '../../.local/backups');
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const filename = path.join(directory, `antes-secciones-2026-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}.sql`);
    await fs.writeFile(filename, sql, { flag: 'wx', mode: 0o600 });
    const restored = await fs.readFile(filename);
    const sha256 = crypto.createHash('sha256').update(restored).digest('hex');
    if (!restored.equals(Buffer.from(sql))) throw new Error('No se pudo verificar la copia de seguridad.');
    await conn.commit();
    return { filename, sha256 };
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
module.exports = { tables, snapshot, backup };

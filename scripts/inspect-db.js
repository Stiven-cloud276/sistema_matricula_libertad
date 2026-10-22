require('dotenv').config({ quiet: true });
const pool = require('../src/config/database');
const tables = ['usuarios', 'estudiantes', 'apoderados', 'estudiante_apoderado', 'anios_escolares', 'grados', 'secciones', 'matriculas'];
(async () => {
  try {
    await pool.query('SELECT 1'); console.log('Conexión MariaDB: correcta.');
    for (const table of tables) {
      const [row] = await pool.query('SHOW CREATE TABLE ' + table);
      const [count] = await pool.query('SELECT COUNT(*) AS total FROM ' + table);
      console.log('\n' + table + ' (' + count.total + ' registros)\n' + row['Create Table']);
    }
  } catch (error) { console.error('No se pudo inspeccionar MariaDB:', error.code || error.name); process.exitCode = 1; }
  finally { await pool.end(); }
})();

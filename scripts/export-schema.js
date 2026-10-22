require('dotenv').config({ quiet: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/database');
const tables = ['usuarios', 'estudiantes', 'apoderados', 'anios_escolares', 'grados', 'estudiante_apoderado', 'secciones', 'matriculas'];
(async () => {
  try {
    let sql = '-- Esquema real de MariaDB. Solo estructura; sin cuentas, contraseñas ni datos personales.\n-- Selecciona una base vacía en phpMyAdmin antes de importar. No actualiza tablas existentes.\nSET NAMES utf8mb4;\n\n';
    for (const table of tables) {
      const [row] = await pool.query('SHOW CREATE TABLE ' + table);
      sql += row['Create Table'].replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ').replace(/ AUTO_INCREMENT=\d+/, '') + ';\n\n';
    }
    await fs.writeFile(path.join(__dirname, '../database/01-estructura.sql'), sql);
    console.log('Esquema exportado sin datos a database/01-estructura.sql. No se modificó MariaDB.');
  } catch (error) { console.error('No se pudo exportar el esquema:', error.code || error.name); process.exitCode = 1; }
  finally { await pool.end(); }
})();

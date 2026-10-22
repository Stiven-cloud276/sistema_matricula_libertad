require('dotenv').config({ quiet: true });
const readline = require('node:readline/promises');
const argon2 = require('argon2');
const pool = require('../src/config/database');
const { validate, schemas, password } = require('../src/utils/validation');

function hidden(question) {
  if (!process.stdin.isTTY) throw new Error('Ejecuta este comando directamente en una terminal de tu equipo.');
  process.stdout.write(question);
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    function done() {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write('\n');
    }
    function onData(chunk) {
      for (const character of chunk) {
        if (character === '\u0003') { done(); reject(new Error('Operación cancelada.')); return; }
        if (character === '\r' || character === '\n') { done(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ' && value.length < 129) value += character;
      }
    }
    process.stdin.on('data', onData);
  });
}

async function recover(usuario, secret) {
  const values = validate(schemas.usuarios, { usuario, nombre_completo: usuario, rol: 'ADMINISTRADOR', estado: 'ACTIVO' });
  password(secret);
  const hash = await argon2.hash(secret, { type: argon2.argon2id });
  const transaction = require('../src/services/transaction');
  return transaction(async conn => {
    const users = await conn.query('SELECT id_usuario,usuario,estado FROM usuarios ORDER BY id_usuario FOR UPDATE');
    // Let the database collation perform the same username match as the login.
    const [account] = await conn.query('SELECT id_usuario,estado FROM usuarios WHERE usuario=?', [values.usuario]);
    if (account) {
      if (account.estado !== 'ACTIVO') throw new Error('Esta cuenta está inactiva. Solicita su activación a un administrador.');
      await conn.query('UPDATE usuarios SET password_hash=? WHERE id_usuario=?', [hash, account.id_usuario]);
      return 'Contraseña actualizada. Las sesiones anteriores quedan invalidadas.';
    }
    if (users.length) throw new Error('Ese usuario no existe. Revisa el nombre; no se modificaron otras cuentas.');
    await conn.query("INSERT INTO usuarios (usuario,password_hash,nombre_completo,rol,estado) VALUES (?,?,?,'ADMINISTRADOR','ACTIVO')", [values.usuario, hash, values.nombre_completo]);
    return 'Primera cuenta administradora creada correctamente.';
  });
}

async function main() {
  try {
    if (!process.stdin.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva.');
    let usuario = process.argv[2];
    if (!usuario) {
      const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
      try { usuario = (await terminal.question('Usuario que deseas recuperar: ')).trim(); }
      finally { terminal.close(); }
    }
    console.log('Elige una contraseña de 12 a 128 caracteres. No se mostrará mientras escribes.');
    const secret = password(await hidden('Nueva contraseña: '));
    const confirmation = await hidden('Repite la nueva contraseña: ');
    if (secret !== confirmation) throw new Error('Las contraseñas no coinciden. No se realizó ningún cambio.');
    console.log(await recover(usuario, secret));
    console.log('Si aparece el bloqueo por intentos, reinicia el servidor con Ctrl+C y npm.cmd start.');
    console.log('Ingresa en http://localhost:3000/ con tu usuario y la nueva contraseña.');
  } catch (error) {
    console.error(error.code ? 'No se pudo recuperar el acceso. Revisa la conexión a MariaDB.' : error.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
}

if (require.main === module) main();
module.exports = { recover };

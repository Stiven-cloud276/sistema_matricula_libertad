require('dotenv').config({ quiet: true });
const readline = require('node:readline');
const argon2 = require('argon2');
const pool = require('../src/config/database');
const { validate, schemas, password } = require('../src/utils/validation');
// A hidden prompt avoids recording the password in terminal history or command arguments.
async function hidden(question) {
  if (!process.stdin.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva de tu equipo.');
  process.stdout.write(question);
  return new Promise((resolve, reject) => {
    let text = '';
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    function finish() { process.stdin.removeListener('data', onData); process.stdin.setRawMode(Boolean(wasRaw)); process.stdin.pause(); process.stdout.write('\n'); }
    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\u0003') { finish(); reject(new Error('Operación cancelada.')); return; }
        if (char === '\r' || char === '\n') { finish(); resolve(text); return; }
        if (char === '\u007f' || char === '\b') { text = text.slice(0, -1); continue; }
        if (char >= ' ' && text.length < 129) text += char;
      }
    }
    process.stdin.on('data', onData);
  });
}
async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return await new Promise(resolve => rl.question(question, resolve)); } finally { rl.close(); }
}
(async () => {
  try {
    const [count] = await pool.query("SELECT COUNT(*) AS total FROM usuarios WHERE rol='ADMINISTRADOR' AND estado='ACTIVO'");
    if (Number(count.total)) throw new Error('Ya hay un administrador activo. Gestiona las cuentas desde el módulo Usuarios.');
    const usuario = await ask('Usuario del primer administrador (3–50 letras, números, punto, guion): ');
    const nombre_completo = await ask('Nombre para mostrar: ');
    const values = validate(schemas.usuarios, { usuario, nombre_completo, rol: 'ADMINISTRADOR', estado: 'ACTIVO' });
    const secret = password(await hidden('Contraseña (12–128 caracteres; no se mostrará): '));
    const confirmation = await hidden('Confirma la contraseña: ');
    if (secret !== confirmation) throw new Error('Las contraseñas no coinciden.');
    const hash = await argon2.hash(secret, { type: argon2.argon2id });
    await pool.query('INSERT INTO usuarios (usuario,password_hash,nombre_completo,rol,estado) VALUES (?,?,?,?,?)', [values.usuario, hash, values.nombre_completo, values.rol, values.estado]);
    console.log('Administrador creado. Ya puedes iniciar sesión en http://localhost:3000.');
  } catch (error) { console.error(error.code ? 'No se pudo crear la cuenta. Revisa la conexión y que el usuario no exista.' : error.message); process.exitCode = 1; }
  finally { await pool.end(); }
})();

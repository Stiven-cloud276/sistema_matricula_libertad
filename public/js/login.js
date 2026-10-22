'use strict';
const form = document.querySelector('#login-form');
const errorBox = document.querySelector('#login-error');
document.querySelector('#toggle-password').addEventListener('click', event => {
  const input = document.querySelector('#password'), show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  event.currentTarget.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  event.currentTarget.setAttribute('aria-pressed', String(show));
  event.currentTarget.firstElementChild.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#login-submit');
  button.disabled = true; button.textContent = 'Verificando…'; errorBox.classList.add('d-none');
  try {
    const tokenResponse = await fetch('/api/auth/csrf');
    if (!tokenResponse.ok) throw new Error('No se pudo preparar el acceso. Intenta nuevamente.');
    const { csrfToken } = await tokenResponse.json();
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensaje);
    location.assign('/panel');
  } catch (error) { errorBox.textContent = error.message || 'No se pudo conectar con el servidor.'; errorBox.classList.remove('d-none'); }
  finally { button.disabled = false; button.textContent = 'Iniciar sesión →'; }
});

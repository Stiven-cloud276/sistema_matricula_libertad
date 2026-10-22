'use strict';
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const names = { estudiantes: 'Estudiantes', apoderados: 'Apoderados', relaciones: 'Vínculos familiares', matriculas: 'Matrículas', anios: 'Años escolares', grados: 'Grados', secciones: 'Secciones', usuarios: 'Usuarios', reportes: 'Reportes', dashboard: 'Inicio' };
const navigationOrder = ['dashboard', 'estudiantes', 'apoderados', 'relaciones', 'matriculas', 'anios', 'grados', 'secciones', 'usuarios', 'reportes'];
const icons = { dashboard: 'grid-1x2', estudiantes: 'people', apoderados: 'person-heart', relaciones: 'diagram-2', matriculas: 'journal-check', anios: 'calendar3', grados: 'layers', secciones: 'door-open', usuarios: 'person-gear', reportes: 'bar-chart' };
const ids = { estudiantes: 'id_estudiante', apoderados: 'id_apoderado', relaciones: 'id_relacion', matriculas: 'id_matricula', anios: 'id_anio', grados: 'id_grado', secciones: 'id_seccion', usuarios: 'id_usuario' };
const active = ['ACTIVO', 'INACTIVO'];
const field = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const select = (key, label, options, extra = {}) => field(key, label, 'select', { options, ...extra });
const remote = (key, label, resource) => field(key, label, 'remote', { resource });
const person = [select('tipo_documento', 'Tipo de documento', ['DNI', 'CE', 'OTRO']), field('numero_documento', 'Número de documento', 'text', { max: 20, optional: true }), field('nombres', 'Nombres', 'text', { max: 100 }), field('apellidos', 'Apellidos', 'text', { max: 120 })];
const schemas = {
  estudiantes: [field('codigo_estudiante', 'Código del estudiante', 'text', { max: 20 }), ...person, field('fecha_nacimiento', 'Fecha de nacimiento', 'date', { optional: true }), select('sexo', 'Sexo', ['M', 'F'], { optional: true }), select('estado', 'Estado', active)],
  apoderados: [...person, field('telefono', 'Teléfono', 'tel', { max: 20, optional: true }), field('correo', 'Correo electrónico', 'email', { max: 120, optional: true }), select('estado', 'Estado', active)],
  relaciones: [remote('id_estudiante', 'Estudiante', 'estudiantes'), remote('id_apoderado', 'Apoderado', 'apoderados'), select('parentesco', 'Parentesco', ['PADRE', 'MADRE', 'TUTOR', 'OTRO']), select('es_principal', 'Apoderado principal', [[0, 'No'], [1, 'Sí']])],
  matriculas: [remote('id_estudiante', 'Estudiante', 'estudiantes'), select('id_anio', 'Año escolar', 'anios'), select('nivel', 'Nivel educativo', ['PRIMARIA', 'SECUNDARIA']), select('id_grado', 'Grado', 'grados'), select('id_seccion', 'Sección', 'secciones'), field('fecha_matricula', 'Fecha de matrícula', 'date'), select('estado', 'Estado', ['REGISTRADA', 'ANULADA']), field('observaciones', 'Observaciones', 'textarea', { max: 4000, optional: true })],
  anios: [field('anio', 'Año escolar', 'number', { min: 2000, maxNumber: 2200 }), select('estado', 'Estado', ['ACTIVO', 'CERRADO'])],
  secciones: [select('id_anio', 'Año escolar', 'anios'), select('id_grado', 'Grado', 'grados'), field('nombre', 'Nombre de sección', 'text', { max: 5 }), field('capacidad', 'Capacidad', 'number', { min: 1, maxNumber: 1000 }), select('estado', 'Estado', ['ACTIVA', 'INACTIVA'])],
  usuarios: [field('usuario', 'Nombre de usuario', 'text', { max: 50 }), field('nombre_completo', 'Nombre completo', 'text', { max: 150 }), select('rol', 'Rol', ['MATRICULAS', 'ADMINISTRADOR']), select('estado', 'Estado', active), field('password', 'Contraseña (12 a 128 caracteres)', 'password', { max: 128, minLength: 12 })]
};
const columns = {
  estudiantes: [['codigo_estudiante', 'Código'], ['apellidos', 'Apellidos'], ['nombres', 'Nombres'], ['numero_documento', 'Documento'], ['estado', 'Estado']],
  apoderados: [['apellidos', 'Apellidos'], ['nombres', 'Nombres'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['estado', 'Estado']],
  relaciones: [['estudiante', 'Estudiante'], ['apoderado', 'Apoderado'], ['parentesco', 'Parentesco'], ['es_principal', 'Principal']],
  matriculas: [['estudiante', 'Estudiante'], ['anio', 'Año'], ['nivel', 'Nivel'], ['numero_grado', 'Grado'], ['seccion', 'Sección'], ['fecha_matricula', 'Fecha'], ['estado', 'Estado']],
  anios: [['anio', 'Año escolar'], ['estado', 'Estado']], grados: [['nivel', 'Nivel'], ['numero_grado', 'Grado']],
  secciones: [['anio', 'Año'], ['nivel', 'Nivel'], ['numero_grado', 'Grado'], ['nombre', 'Sección'], ['capacidad', 'Capacidad'], ['ocupados', 'Ocupados'], ['estado', 'Estado']],
  usuarios: [['usuario', 'Usuario'], ['nombre_completo', 'Nombre completo'], ['rol', 'Rol'], ['estado', 'Estado']],
  reportes: [['anio', 'Año'], ['nivel', 'Nivel'], ['numero_grado', 'Grado'], ['seccion', 'Sección'], ['matriculas', 'Matrículas registradas']]
};
const descriptions = { dashboard: 'Una mirada a la información de tu comunidad educativa.', estudiantes: 'Registra, consulta y actualiza la información de los estudiantes.', apoderados: 'Administra los datos de padres, madres y tutores.', relaciones: 'Vincula estudiantes con sus apoderados y define el contacto principal.', matriculas: 'Gestiona el ingreso escolar, las secciones y las vacantes disponibles.', anios: 'Configura los periodos académicos y su disponibilidad.', grados: 'Estructura de primaria y secundaria registrada en MariaDB.', secciones: 'Organiza las aulas, su capacidad y disponibilidad.', usuarios: 'Administra las cuentas y los permisos de acceso.', reportes: 'Consulta las matrículas registradas por periodo, nivel, grado y sección.' };
let user, csrfToken, current = 'dashboard', page = 1, records = [], editingId = null, formResource, lookups = {}, filters = {}, renderVersion = 0, cascadeVersion = 0;
const modal = new bootstrap.Modal($('#record-modal'));
const confirmation = new bootstrap.Modal($('#confirm-modal'));
async function api(path, options = {}) {
  const response = await fetch('/api' + path, { ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken || '', ...options.headers } });
  const data = await response.json();
  if (response.status === 401) { location.assign('/'); throw new Error('Tu sesión finalizó.'); }
  if (!response.ok) { const error = new Error(data.mensaje || 'No se pudo completar la operación.'); error.fields = data.fields; throw error; }
  return data;
}
function notification(message, error = false) {
  $('#notice').innerHTML = `<div class="alert alert-${error ? 'danger' : 'success'} alert-dismissible fade show">${escapeHTML(message)}<button class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar mensaje"></button></div>`;
}
function canWrite(resource) { return resource !== 'grados' && (!['usuarios', 'anios', 'secciones'].includes(resource) || user.rol === 'ADMINISTRADOR'); }
function optionsHTML(items, selected, blank = true) {
  return (blank ? '<option value="">Seleccionar…</option>' : '') + items.map(item => {
    const [value, label] = Array.isArray(item) ? item : [item, item];
    return `<option value="${escapeHTML(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHTML(label)}</option>`;
  }).join('');
}
function lookupOptions(resource, rows) {
  return rows.map(row => [row[ids[resource]], resource === 'anios' ? `${row.anio} · ${row.estado}` : resource === 'grados' ? `${row.nivel} · ${row.numero_grado}.º` : resource === 'secciones' ? `${row.nombre} · ${row.ocupados}/${row.capacidad} ocupados · ${row.estado}` : `${row.apellidos}, ${row.nombres}${row.codigo_estudiante ? ' · ' + row.codigo_estudiante : ''} · ${row.estado}`]);
}
async function refreshLookups() {
  const results = await Promise.all(['anios', 'grados'].map(async resource => [resource, await allOptions(resource)]));
  lookups = Object.fromEntries(results);
}
async function allOptions(resource, params = {}) {
  const rows = [];
  for (let optionPage = 1; ; optionPage++) {
    const result = await api('/' + resource + '?' + new URLSearchParams({ ...params, page: optionPage, limit: 100 }));
    rows.push(...result.data);
    if (!result.data.length || rows.length >= result.total) return rows;
  }
}
function dateToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function tableHTML(cols, rows, actions = false) {
  if (!rows.length) return '<div class="empty-state"><i class="bi bi-inbox" aria-hidden="true"></i><strong>No hay registros para mostrar</strong><p>Los registros guardados aparecerán aquí. Puedes ajustar los filtros.</p></div>';
  return `<div class="table-responsive"><table class="table"><thead><tr>${cols.map(([, label]) => `<th scope="col">${escapeHTML(label)}</th>`).join('')}${actions ? '<th scope="col" class="table-actions">Acciones</th>' : ''}</tr></thead><tbody>${rows.map(row => `<tr>${cols.map(([key]) => `<td>${key === 'estado' ? `<span class="status-badge ${['INACTIVO', 'INACTIVA', 'CERRADO', 'ANULADA'].includes(row[key]) ? 'off' : ''}">${escapeHTML(row[key])}</span>` : escapeHTML(key === 'es_principal' ? (row[key] ? 'Sí' : 'No') : row[key] ?? '—')}</td>`).join('')}${actions ? `<td class="table-actions">${rowActions(row)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
function actionButton(action, id, icon, label) { return `<button class="btn btn-light me-1" data-action="${action}" data-id="${id}" title="${label}" aria-label="${label}"><i class="bi bi-${icon}" aria-hidden="true"></i></button>`; }
function rowActions(row) {
  const id = row[ids[current]];
  let result = actionButton('detail', id, 'eye', 'Ver detalle');
  if (canWrite(current)) result += actionButton('edit', id, 'pencil', 'Editar');
  if (current === 'matriculas') result += actionButton(row.estado === 'REGISTRADA' ? 'anular' : 'reactivar', id, row.estado === 'REGISTRADA' ? 'slash-circle' : 'arrow-counterclockwise', row.estado === 'REGISTRADA' ? 'Anular matrícula' : 'Reactivar matrícula');
  if (canWrite(current) && ['estudiantes', 'apoderados', 'relaciones', 'secciones'].includes(current)) result += actionButton('delete', id, 'trash3', current === 'relaciones' ? 'Desvincular' : 'Eliminar');
  return result;
}
async function navigate() {
  const hash = location.hash.slice(1) || 'dashboard';
  current = Object.hasOwn(names, hash) ? hash : 'dashboard';
  if (current === 'usuarios' && user.rol !== 'ADMINISTRADOR') current = 'dashboard';
  page = 1; filters = {}; $('#notice').innerHTML = '';
  $('#page-title').textContent = current === 'dashboard' ? 'Resumen general' : names[current];
  $('#page-subtitle').textContent = descriptions[current]; $('#breadcrumb').textContent = names[current];
  document.querySelectorAll('.nav-item-link').forEach(link => link.classList.toggle('active', link.dataset.view === current));
  $('#new-record').classList.toggle('d-none', !schemas[current] || !canWrite(current));
  $('#new-record').innerHTML = `<i class="bi bi-plus-lg me-2"></i>${current === 'matriculas' ? 'Nueva matrícula' : current === 'relaciones' ? 'Vincular apoderado' : 'Nuevo registro'}`;
  bootstrap.Offcanvas.getInstance($('#sidebar'))?.hide();
  await render();
}
function filtersHTML() {
  const academic = ['dashboard', 'matriculas', 'secciones', 'reportes'].includes(current);
  let html = '';
  if (!['dashboard', 'reportes'].includes(current)) html += `<input type="search" class="form-control search" name="q" aria-label="Buscar registros" placeholder="Buscar ${names[current].toLowerCase()}…" value="${escapeHTML(filters.q || '')}" maxlength="150">`;
  if (academic) html += `<select class="form-select" name="id_anio" aria-label="Filtrar año"><option value="">Todos los años</option>${optionsHTML(lookupOptions('anios', lookups.anios), filters.id_anio, false)}</select><select class="form-select" name="nivel" aria-label="Filtrar nivel"><option value="">Todos los niveles</option>${optionsHTML(['PRIMARIA', 'SECUNDARIA'], filters.nivel, false)}</select>`;
  if (['matriculas', 'secciones', 'reportes'].includes(current)) html += `<select class="form-select" name="id_grado" aria-label="Filtrar grado"><option value="">Todos los grados</option>${optionsHTML(lookupOptions('grados', lookups.grados.filter(g => !filters.nivel || g.nivel === filters.nivel)), filters.id_grado, false)}</select>`;
  if (['matriculas', 'reportes'].includes(current)) html += `<select class="form-select" name="id_seccion" aria-label="Filtrar sección"><option value="">Todas las secciones</option>${optionsHTML((lookups.filterSections || []).map(s => [s.id_seccion, `${s.anio} · ${s.nivel} ${s.numero_grado}.º ${s.nombre}`]), filters.id_seccion, false)}</select>`;
  const stateField = schemas[current]?.find(f => f.key === 'estado');
  if (stateField) html += `<select class="form-select" name="estado" aria-label="Filtrar estado"><option value="">Todos los estados</option>${optionsHTML(stateField.options, filters.estado, false)}</select>`;
  return `<form id="filters" class="filters">${html}<button class="btn btn-light" type="submit"><i class="bi bi-search me-1"></i>Filtrar</button><button class="btn btn-light" type="button" id="clear-filters" aria-label="Limpiar filtros"><i class="bi bi-x-lg"></i></button></form>`;
}
async function render() {
  const version = ++renderVersion, resource = current;
  $('#content').setAttribute('aria-busy', 'true'); $('#content').innerHTML = '<div class="loading"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Consultando MariaDB…</div>';
  try {
    const query = new URLSearchParams({ ...filters, page });
    if (['matriculas', 'reportes'].includes(resource)) {
      const sectionFilters = { ...(filters.id_anio ? { id_anio: filters.id_anio } : {}), ...(filters.id_grado ? { id_grado: filters.id_grado } : {}), ...(filters.nivel ? { nivel: filters.nivel } : {}) };
      const sections = await allOptions('secciones', sectionFilters);
      if (version !== renderVersion) return;
      lookups.filterSections = sections;
    }
    const data = await api(resource === 'dashboard' ? '/dashboard/resumen?' + query : '/' + resource + '?' + query);
    if (version !== renderVersion) return;
    if (resource === 'dashboard') { $('#content').innerHTML = filtersHTML() + dashboardHTML(data); return; }
    records = data.data;
    let html = filtersHTML();
    if (resource === 'reportes') html += `<div class="report-actions"><a class="btn btn-primary" href="/api/reportes/csv?${escapeHTML(new URLSearchParams(filters))}"><i class="bi bi-download me-2"></i>Exportar CSV</a><button class="btn btn-light" id="print-report"><i class="bi bi-printer me-2"></i>Imprimir</button></div>`;
    html += `<section class="section-card"><div class="section-card-header"><div><h2>${names[resource]}</h2><p>${resource === 'reportes' ? 'Secciones configuradas; solo se cuentan matrículas REGISTRADA' : 'Información guardada en la base de datos'}</p></div><span class="small text-secondary">${resource === 'reportes' ? data.data.length + ' secciones' : data.total + ' registros'}</span></div>${tableHTML(columns[resource], data.data, resource !== 'reportes')}`;
    if (resource === 'reportes') html += `<div class="report-total">Matrículas del filtro: <strong>${data.data.reduce((sum, r) => sum + Number(r.matriculas), 0)}</strong> · Total de estudiantes registrados en el sistema: <strong>${data.totalEstudiantes}</strong></div>`;
    else html += `<div class="pagination-bar"><span>${data.total ? (data.page - 1) * data.limit + 1 : 0}–${Math.min(data.page * data.limit, data.total)} de ${data.total}</span><div><button class="btn btn-light me-2" id="prev-page" ${page === 1 ? 'disabled' : ''} aria-label="Página anterior"><i class="bi bi-chevron-left"></i></button><span>Página ${page}</span><button class="btn btn-light ms-2" id="next-page" ${page * data.limit >= data.total ? 'disabled' : ''} aria-label="Página siguiente"><i class="bi bi-chevron-right"></i></button></div></div>`;
    $('#content').innerHTML = html + '</section>';
  } catch (error) { if (version === renderVersion) $('#content').innerHTML = `<div class="alert alert-danger" role="alert">${escapeHTML(error.message)} <button class="btn btn-light btn-sm" id="retry-load">Reintentar</button></div>`; }
  finally { if (version === renderVersion) $('#content').setAttribute('aria-busy', 'false'); }
}
function dashboardHTML(data) {
  const stats = [['estudiantes', 'Estudiantes activos', 'people', 'Registro de estudiantes'], ['matriculas', 'Matrículas registradas', 'journal-check', 'Según los filtros seleccionados'], ['apoderados', 'Apoderados activos', 'person-heart', 'Contactos familiares'], ['secciones', 'Secciones activas', 'door-open', 'En todos los periodos']];
  const total = Number(data.counts.matriculas);
  return `<div class="welcome-banner"><div><h2>Bienvenido, ${escapeHTML(user.nombre_completo.split(' ')[0])}</h2><p>Todo listo para organizar la gestión escolar.<br>La información de este panel se consulta directamente en MariaDB.</p></div><i class="bi bi-mortarboard" aria-hidden="true"></i></div><div class="stat-grid">${stats.map(([key, label, icon, sub]) => `<article class="stat-card"><div class="stat-icon"><i class="bi bi-${icon}" aria-hidden="true"></i></div><small>${label}</small><strong>${data.counts[key]}</strong><p>${sub}</p></article>`).join('')}</div><div class="dashboard-columns"><section class="section-card"><div class="section-card-header"><div><h2>Matrículas recientes</h2><p>Últimos registros vigentes del filtro seleccionado</p></div><a class="small text-decoration-none" href="#matriculas">Ver todas <i class="bi bi-arrow-right"></i></a></div>${tableHTML([['estudiante', 'Estudiante'], ['nivel', 'Nivel'], ['numero_grado', 'Grado'], ['seccion', 'Sección'], ['estado', 'Estado']], data.recent)}</section><section class="section-card"><div class="section-card-header"><div><h2>Distribución por nivel</h2><p>Matrículas registradas</p></div><i class="bi bi-pie-chart text-secondary"></i></div><div class="section-card-body">${['PRIMARIA', 'SECUNDARIA'].map(level => { const count = Number(data.levels.find(l => l.nivel === level)?.total || 0); return `<div class="level-row"><div class="d-flex justify-content-between align-items-center"><span>${level === 'PRIMARIA' ? 'Primaria' : 'Secundaria'}</span><strong>${count}</strong></div><progress max="${total || 1}" value="${count}" aria-label="Matrículas ${level}"></progress><small class="text-secondary">${total ? Math.round(count / total * 100) : 0}% del total</small></div>`; }).join('')}</div></section></div><section class="section-card"><div class="section-card-header"><h2>Accesos rápidos</h2><span class="small text-secondary">Gestión diaria</span></div><div class="section-card-body quick-links">${['estudiantes', 'apoderados', 'matriculas', 'reportes'].map(v => `<a href="#${v}"><i class="bi bi-${icons[v]}"></i>${names[v]} <i class="bi bi-arrow-up-right ms-2"></i></a>`).join('')}</div></section><section class="section-card"><div class="section-card-header"><h2>Matrículas por grado y sección</h2><a href="#reportes" class="small text-decoration-none">Abrir reportes</a></div>${tableHTML(columns.reportes, data.grades)}</section>`;
}
async function remoteOptions(resource, key, search = '', selected) {
  const result = await api('/' + resource + '?' + new URLSearchParams({ q: search, limit: 100 }));
  let rows = result.data;
  if (selected && !rows.some(row => String(row[ids[resource]]) === String(selected))) rows = [(await api('/' + resource + '/' + selected)).data, ...rows];
  const element = $('#f-' + key);
  if (element) element.innerHTML = optionsHTML(lookupOptions(resource, rows), selected);
  const hint = $('#hint-' + key); if (hint) hint.textContent = result.total > 100 ? `${result.total} coincidencias. Se muestran 100; precisa la búsqueda.` : `${result.total} coincidencias.`;
}
async function cascade(row = {}) {
  if (formResource !== 'matriculas') return;
  const version = ++cascadeVersion;
  const level = $('#f-nivel').value;
  const gradeSelect = $('#f-id_grado');
  const gradeId = row.id_grado || gradeSelect.value;
  gradeSelect.innerHTML = optionsHTML(lookupOptions('grados', lookups.grados.filter(g => g.nivel === level)), gradeId);
  const year = $('#f-id_anio').value, grade = gradeSelect.value;
  const sectionSelect = $('#f-id_seccion');
  const selected = row.id_seccion || sectionSelect.value;
  sectionSelect.disabled = true;
  sectionSelect.innerHTML = '<option value="">Elige año, nivel y grado</option>';
  if (!year || !grade) return;
  sectionSelect.innerHTML = '<option value="">Cargando secciones…</option>';
  try {
    const sections = await allOptions('secciones', { id_anio: year, nivel: level, id_grado: grade });
    if (version !== cascadeVersion || sectionSelect !== $('#f-id_seccion')) return;
    sectionSelect.innerHTML = sections.length ? optionsHTML(lookupOptions('secciones', sections), selected) : '<option value="">No hay secciones para este grado y año</option>';
    sectionSelect.disabled = !sections.length;
  } catch (error) {
    if (version !== cascadeVersion || sectionSelect !== $('#f-id_seccion')) return;
    sectionSelect.innerHTML = '<option value="">No se pudieron cargar las secciones</option>';
    throw error;
  }
}
async function openForm(row = null) {
  cascadeVersion++;
  formResource = current; editingId = row?.[ids[current]] || null;
  $('#record-form').reset(); $('#form-error').innerHTML = '';
  $('#save-record').classList.remove('d-none'); $('#save-record').disabled = true;
  $('#modal-title').textContent = `${row ? 'Editar' : 'Registrar'} · ${names[current]}`;
  const values = { estado: schemas[current]?.find(f => f.key === 'estado')?.options[0], fecha_matricula: dateToday(), capacidad: 30, anio: new Date().getFullYear() + 1, es_principal: 0, nivel: 'PRIMARIA', ...row };
  $('#form-fields').innerHTML = schemas[current].map(f => {
    const optional = f.optional || (f.key === 'password' && row);
    const value = f.key === 'password' ? '' : values[f.key] ?? '';
    const immutable = row && ((current === 'matriculas' && ['id_estudiante', 'id_anio'].includes(f.key)) || (current === 'relaciones' && ['id_estudiante', 'id_apoderado'].includes(f.key)));
    const attrs = `id="f-${f.key}" name="${f.key}" ${optional ? '' : 'required'} ${immutable ? 'disabled' : ''} ${f.max ? `maxlength="${f.max}"` : ''} ${f.minLength ? `minlength="${f.minLength}"` : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.maxNumber ? `max="${f.maxNumber}"` : ''} aria-describedby="err-${f.key}"`;
    let input;
    if (f.type === 'select' || f.type === 'remote') {
      const options = Array.isArray(f.options) ? f.options : f.options && lookups[f.options] ? lookupOptions(f.options, lookups[f.options]) : [];
      input = `${f.type === 'remote' && !immutable ? `<div class="input-group input-group-sm mb-2"><input type="search" class="form-control form-remote-search" data-resource="${f.resource}" data-target="${f.key}" aria-label="Buscar ${f.label.toLowerCase()}" placeholder="Buscar por nombre, documento o código"><button type="button" class="btn btn-light" data-remote="${f.key}">Buscar</button></div>` : ''}<select class="form-select" ${attrs}>${optionsHTML(options, value)}</select>${f.type === 'remote' ? `<small class="text-secondary" id="hint-${f.key}"></small>` : ''}`;
    } else if (f.type === 'textarea') input = `<textarea class="form-control" rows="3" ${attrs}>${escapeHTML(value)}</textarea>`;
    else input = `<input class="form-control" type="${f.type}" value="${escapeHTML(value)}" ${attrs} ${f.type === 'password' ? 'autocomplete="new-password"' : ''}>`;
    return `<div class="${f.type === 'textarea' ? 'col-12' : 'col-md-6'}"><label for="f-${f.key}" class="form-label">${f.label}${optional ? ' <span class="text-secondary fw-normal">(opcional)</span>' : ''}</label>${input}<div class="invalid-feedback" id="err-${f.key}"></div>${f.key === 'password' && row ? '<small class="text-secondary">Déjala vacía para conservar la contraseña actual. Al cambiarla se invalidan las sesiones abiertas.</small>' : ''}</div>`;
  }).join('') + (current === 'matriculas' ? '<div class="col-12"><p class="form-section-note mb-0">Una matrícula por estudiante y año. Si está anulada, reactiva el registro existente. La disponibilidad se comprueba al guardar.</p></div>' : '');
  modal.show();
  try {
    await Promise.all(schemas[current].filter(f => f.type === 'remote').map(f => remoteOptions(f.resource, f.key, '', values[f.key])));
    await cascade(values); $('#save-record').disabled = false;
  } catch (error) { $('#form-error').innerHTML = `<div class="alert alert-danger">${escapeHTML(error.message)}</div>`; }
}
async function showDetail(row) {
  $('#modal-title').textContent = `Detalle · ${names[current]}`;
  $('#form-error').innerHTML = ''; $('#save-record').classList.add('d-none');
  const allLabels = Object.fromEntries([...(schemas[current] || []), ...Object.entries(ids).map(([, key]) => ({ key, label: key }))].map(f => [f.key, f.label]));
  for (const [key, label] of columns[current]) allLabels[key] = label;
  $('#form-fields').innerHTML = `<div class="details-grid">${Object.entries(row).map(([key, value]) => `<div><span class="detail-label">${escapeHTML(allLabels[key] || key.replaceAll('_', ' '))}</span><span class="detail-value">${escapeHTML(value ?? '—')}</span></div>`).join('')}</div>`;
  modal.show();
}
$('#record-form').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('#save-record').classList.contains('d-none')) return;
  if (formResource === 'matriculas' && ($('#f-id_seccion').disabled || !$('#f-id_seccion').value)) {
    $('#form-error').innerHTML = '<div class="alert alert-warning">Selecciona un año, nivel, grado y sección disponibles antes de guardar.</div>';
    return;
  }
  const button = $('#save-record'); button.disabled = true; button.textContent = 'Guardando…'; $('#form-error').innerHTML = '';
  document.querySelectorAll('#record-form .is-invalid').forEach(el => el.classList.remove('is-invalid'));
  const body = Object.fromEntries(new FormData(event.currentTarget));
  for (const element of event.currentTarget.querySelectorAll('select:disabled')) body[element.name] = element.value;
  try {
    const data = await api('/' + formResource + (editingId ? '/' + editingId : ''), { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(body) });
    modal.hide(); notification(data.mensaje); await refreshLookups(); await render();
  } catch (error) {
    $('#form-error').innerHTML = `<div class="alert alert-danger">${escapeHTML(error.message)}</div>`;
    for (const [key, message] of Object.entries(error.fields || {})) { const input = $('#f-' + key); if (input) { input.classList.add('is-invalid'); $('#err-' + key).textContent = message; } }
    $('#record-modal .modal-body').scrollTop = 0;
  } finally { button.disabled = false; button.textContent = 'Guardar registro'; }
});
$('#form-fields').addEventListener('change', event => {
  if (['id_anio', 'nivel', 'id_grado'].includes(event.target.name)) cascade().catch(error => { $('#form-error').textContent = error.message; });
});
$('#form-fields').addEventListener('click', event => {
  const button = event.target.closest('[data-remote]'); if (!button) return;
  const input = document.querySelector(`[data-target="${button.dataset.remote}"]`);
  button.disabled = true;
  remoteOptions(input.dataset.resource, input.dataset.target, input.value).catch(error => { $('#form-error').textContent = error.message; }).finally(() => { button.disabled = false; });
});
$('#form-fields').addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.matches('.form-remote-search')) { event.preventDefault(); document.querySelector(`[data-remote="${event.target.dataset.target}"]`).click(); }
});
$('#content').addEventListener('submit', event => {
  if (event.target.id !== 'filters') return; event.preventDefault();
  filters = Object.fromEntries([...new FormData(event.target)].filter(([, value]) => value)); page = 1; render();
});
$('#content').addEventListener('change', event => {
  if (event.target.name === 'nivel') { const grade = $('#filters [name="id_grado"]'); if (grade) grade.value = ''; }
  if (['id_anio', 'nivel', 'id_grado'].includes(event.target.name)) { const section = $('#filters [name="id_seccion"]'); if (section) section.value = ''; }
  if (event.target.closest('#filters') && event.target.tagName === 'SELECT') $('#filters').requestSubmit();
});
$('#content').addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.id === 'retry-load') return render();
  if (button.id === 'clear-filters') { filters = {}; page = 1; return render(); }
  if (button.id === 'prev-page' || button.id === 'next-page') { page += button.id === 'prev-page' ? -1 : 1; return render(); }
  if (button.id === 'print-report') return window.print();
  const action = button.dataset.action; if (!action) return;
  const row = records.find(r => String(r[ids[current]]) === button.dataset.id);
  if (action === 'edit') return openForm(row);
  if (action === 'detail') return showDetail(row);
  const resource = current, id = button.dataset.id;
  $('#confirm-message').textContent = action === 'delete' ? (resource === 'relaciones' ? '¿Desvincular a este apoderado del estudiante? Esta acción elimina únicamente la relación.' : '¿Eliminar este registro de forma permanente? Si tiene relaciones protegidas no se eliminará. Puedes editarlo para cambiar su estado.') : `¿${action === 'anular' ? 'Anular' : 'Reactivar'} esta matrícula? ${action === 'reactivar' ? 'Se comprobarán nuevamente el periodo, el estudiante y la disponibilidad de cupos.' : 'El registro y su historial permanecerán guardados.'}`;
  $('#confirm-error').innerHTML = ''; const confirm = $('#confirm-action'); confirm.disabled = false;
  confirm.onclick = async () => {
    confirm.disabled = true;
    try { const result = await api('/' + resource + '/' + id + (action === 'delete' ? '' : '/' + action), { method: action === 'delete' ? 'DELETE' : 'PATCH' }); confirmation.hide(); notification(result.mensaje); await render(); }
    catch (error) { $('#confirm-error').innerHTML = `<div class="alert alert-danger">${escapeHTML(error.message)}</div>`; }
    finally { confirm.disabled = false; }
  };
  confirmation.show();
});
$('#new-record').addEventListener('click', () => openForm());
$('#logout').addEventListener('click', async event => {
  event.currentTarget.disabled = true;
  try { await api('/auth/logout', { method: 'POST' }); location.assign('/'); }
  catch (error) { notification(error.message, true); $('#logout').disabled = false; }
});
window.addEventListener('hashchange', navigate);
(async () => {
  try {
    const data = await api('/auth/me'); user = data.user; csrfToken = data.csrfToken;
    $('#user-name').textContent = user.nombre_completo; $('#user-role').textContent = user.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Personal de matrículas';
    $('#navigation').innerHTML = navigationOrder.filter(v => v !== 'usuarios' || user.rol === 'ADMINISTRADOR').map(v => `<a class="nav-item-link" href="#${v}" data-view="${v}"><i class="bi bi-${icons[v]}" aria-hidden="true"></i>${names[v]}</a>`).join('');
    await refreshLookups(); await navigate();
  } catch (error) { notification(error.message, true); }
})();

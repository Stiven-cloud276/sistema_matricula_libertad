const router = require('express').Router();
const rateLimit = require('express-rate-limit').rateLimit;
const auth = require('../controllers/auth');
const reports = require('../controllers/reports');
const { authenticated, admin, csrf } = require('../middleware/auth');
const resources = require('../services/resources');
const enrollments = require('../services/enrollments');
const { positiveId } = require('../utils/validation');
router.get('/auth/csrf', auth.token);
router.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, skipSuccessfulRequests: true, message: { mensaje: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' } }), csrf, auth.login);
router.use(authenticated);
router.get('/auth/me', (req, res) => res.json({ user: req.user, csrfToken: req.session.csrf }));
router.use(csrf);
router.post('/auth/logout', auth.logout);
router.get('/dashboard/resumen', reports.dashboard);
router.get('/reportes', reports.report);
router.get('/reportes/csv', reports.csv);
for (const name of Object.keys(resources.definitions)) {
  const permissions = name === 'usuarios' ? [admin] : [];
  router.get('/' + name, ...permissions, async (req, res) => res.json(await resources.list(name, req.query)));
  router.get('/' + name + '/:id', ...permissions, async (req, res) => res.json({ data: await resources.detail(name, positiveId(req.params.id)) }));
  if (name === 'grados') continue;
  const write = ['usuarios', 'anios', 'secciones'].includes(name) ? [admin] : [];
  router.post('/' + name, ...write, async (req, res) => {
    const id = name === 'matriculas' ? await enrollments.save(req.body) : await resources.save(name, req.body, null, req.user);
    res.status(201).json({ id, mensaje: 'Registro guardado.' });
  });
  router.put('/' + name + '/:id', ...write, async (req, res) => {
    const id = positiveId(req.params.id);
    if (name === 'matriculas') await enrollments.save(req.body, id); else await resources.save(name, req.body, id, req.user);
    res.json({ id, mensaje: 'Cambios guardados.' });
  });
  if (['estudiantes', 'apoderados', 'relaciones', 'secciones'].includes(name)) router.delete('/' + name + '/:id', ...write, async (req, res) => {
    await resources.remove(name, positiveId(req.params.id)); res.json({ mensaje: 'Registro eliminado.' });
  });
}
for (const action of ['anular', 'reactivar']) router.patch('/matriculas/:id/' + action, async (req, res) => {
  await enrollments.save(null, positiveId(req.params.id), action); res.json({ mensaje: action === 'anular' ? 'Matrícula anulada.' : 'Matrícula reactivada.' });
});
module.exports = router;

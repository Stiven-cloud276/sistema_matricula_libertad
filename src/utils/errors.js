class AppError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}
function ensure(condition, message, status = 422) {
  if (!condition) throw new AppError(status, message);
}
module.exports = { AppError, ensure };

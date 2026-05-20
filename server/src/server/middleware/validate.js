/**
 * Lightweight request-body validator — zero dependencies.
 *
 * Usage:
 *   const { validate, rules } = require('./middleware/validate');
 *
 *   router.post('/register', validate({
 *     email:    [rules.required, rules.email],
 *     password: [rules.required, rules.minLength(6)],
 *   }), handler);
 *
 * Each rule is a function (value, fieldName) => string|null.
 * Returns null if valid, or an error message string.
 */

const rules = {
  required: (v, f) => (v === undefined || v === null || v === '') ? `${f} is required` : null,

  string: (v, f) => (v != null && typeof v !== 'string') ? `${f} must be a string` : null,

  number: (v, f) => (v != null && (typeof v !== 'number' || isNaN(v))) ? `${f} must be a number` : null,

  email: (v, f) => {
    if (!v) return null; // use required to enforce presence
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) ? null : `${f} must be a valid email`;
  },

  minLength: (min) => (v, f) => {
    if (!v) return null;
    return String(v).length >= min ? null : `${f} must be at least ${min} characters`;
  },

  maxLength: (max) => (v, f) => {
    if (!v) return null;
    return String(v).length <= max ? null : `${f} must be at most ${max} characters`;
  },

  oneOf: (allowed) => (v, f) => {
    if (!v) return null;
    return allowed.includes(v) ? null : `${f} must be one of: ${allowed.join(', ')}`;
  },

  uuid: (v, f) => {
    if (!v) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
      ? null : `${f} must be a valid UUID`;
  },
};

/**
 * Express middleware factory.
 * @param {Object<string, Function[]>} schema — field → array of rule fns
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, fieldRules] of Object.entries(schema)) {
      const value = req.body[field];
      for (const rule of fieldRules) {
        const err = rule(value, field);
        if (err) { errors.push(err); break; } // first error per field
      }
    }
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    next();
  };
}

module.exports = { validate, rules };

const path = require('path');

// Sanitize folder/file names to prevent path traversal
function sanitizePath(input) {
  if (!input) return '';
  return input
    .replace(/\.\./g, '')       // Remove path traversal
    .replace(/[<>:"|?*]/g, '')  // Remove invalid path chars
    .replace(/^[/\\]+/, '')      // Remove leading slashes
    .trim();
}

// Validate that a resolved path stays within a base directory
function isPathSafe(basePath, userPath) {
  const resolved = path.resolve(basePath, userPath);
  return resolved.startsWith(path.resolve(basePath));
}

// Sanitize email input
function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().trim().slice(0, 254);
}

// Validate email format
function isValidEmail(email) {
  if (!email) return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email) && email.length <= 254;
}

// Sanitize general text input (prevent XSS in stored content)
function sanitizeText(input, maxLength = 5000) {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Strip angle brackets
    .slice(0, maxLength)
    .trim();
}

// Validate required fields in request body
function validateRequired(body, fields) {
  const missing = fields.filter(f => !body[f] || (typeof body[f] === 'string' && !body[f].trim()));
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

module.exports = { sanitizePath, isPathSafe, sanitizeEmail, isValidEmail, sanitizeText, validateRequired };

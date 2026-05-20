/**
 * Basic security headers — zero dependencies.
 * Adds headers that mitigate common web vulnerabilities.
 */
function securityHeaders() {
  return (_req, res, next) => {
    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // XSS filter (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Don't leak referrer on cross-origin requests
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Remove Express fingerprint
    res.removeHeader('X-Powered-By');
    next();
  };
}

module.exports = { securityHeaders };

/**
 * Basic security headers — zero dependencies.
 * Adds headers that mitigate common web vulnerabilities.
 */
function securityHeaders() {
  return (req, res, next) => {
    const isHttps = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Disable legacy XSS auditor quirks; modern browsers rely on CSP.
    res.setHeader('X-XSS-Protection', '0');
    // Don't leak referrer on cross-origin requests
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Limit powerful browser APIs by default.
    res.setHeader('Permissions-Policy', [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
    ].join(', '));
    // Keep this CSP compatible with the Vite SPA, OAuth redirects, sockets, media, and inline fallback pages.
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "connect-src 'self' https: wss:",
      "form-action 'self' https:",
    ].join('; '));
    if (isHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    // Remove Express fingerprint
    res.removeHeader('X-Powered-By');
    next();
  };
}

module.exports = { securityHeaders };

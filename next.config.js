/** @type {import('next').NextConfig} */

// En-têtes de sécurité appliqués à toutes les pages et routes.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },                                   // pas d'affichage dans une iframe (clickjacking)
  { key: 'X-Content-Type-Options', value: 'nosniff' },                         // le navigateur respecte le type de fichier annoncé
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig

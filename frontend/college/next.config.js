/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  env: {
    NEXT_PUBLIC_APP_NAME: 'Mail-Nexus Organization Security Portal',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  }
};

module.exports = nextConfig;

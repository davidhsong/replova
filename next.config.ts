import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/platform/replova-tap', destination: '/products/replova-tap' },
      { source: '/platform/how-tap-works', destination: '/products/replova-tap#how-it-works' },
      { source: '/industries/automotive', destination: '/industries/auto-repair-quick-lube' },
      ...['home-services', 'retail-hospitality', 'healthcare-wellness', 'local-services', 'professional-services', 'local-businesses'].map(slug => ({
        source: '/industries/' + slug, destination: '/industries',
      })),
    ].map(rule => ({ ...rule, permanent: true }))
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

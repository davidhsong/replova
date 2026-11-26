import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return ['automotive', 'home-services', 'professional-services', 'local-businesses'].map(slug => ({
      source: '/industries/' + slug,
      destination: '/industries/local-services',
      permanent: true,
    }))
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

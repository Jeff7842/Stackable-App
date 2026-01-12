import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options hee */
  reactCompiler: true,
  experimental:{
    turbopackFileSystemCacheForDev:true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ceuppatdypoutimqdglm.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;

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
      {
        protocol: 'https',
        hostname: 'ceuppatdypoutimqdglm.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'https',
        hostname: 'fra.cloud.appwrite.io',
        pathname: '/v1/storage/buckets/69ac40470009f698eaa6/files/**',
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "example.com",
      },
    ],
  },
};

export default nextConfig;

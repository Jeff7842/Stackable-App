import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options hee */
  reactCompiler: true,
  experimental:{
    turbopackFileSystemCacheForDev:true,
  }
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  transpilePackages: ["@tanstack/react-query"],
};

export default nextConfig;

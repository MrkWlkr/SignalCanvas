/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/scenario": ["./data/**/*"],
      "/api/advance": ["./data/**/*"],
      "/api/state": ["./data/**/*"],
      "/api/reset": ["./data/**/*"],
      "/api/intervene": ["./data/**/*"],
    },
  },
};

module.exports = nextConfig;

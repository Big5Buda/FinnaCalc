/** @type {import('next').NextConfig} */
const nextConfig = {
    // The shared package ships TypeScript source rather than a build step.
    transpilePackages: ["@finnacalc/shared"],
    eslint: { ignoreDuringBuilds: true },
    images: { unoptimized: true },
}

export default nextConfig

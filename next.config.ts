import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A stray lockfile in the user profile makes Next infer the wrong workspace
  // root, which breaks file tracing on deploy. Pin it to this repo.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  typescript: {
    // Never ship a build that does not typecheck.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    // ExcelJS is server-only and must never be traced into a client bundle.
    serverComponentsHmrCache: true,
  },
}

export default nextConfig

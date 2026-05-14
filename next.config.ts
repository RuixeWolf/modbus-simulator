import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  serverExternalPackages: ['modbus-serial', 'serialport']
}

export default nextConfig

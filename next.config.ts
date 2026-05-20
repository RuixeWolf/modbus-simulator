import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ['modbus-serial', 'serialport']
}

export default nextConfig

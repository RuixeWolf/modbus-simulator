import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTROL_ROUTE_CONTRACT, createControlOpenApiDocument } from './openapi'

describe('control OpenAPI document', () => {
  it('contains every implemented v1 method and bearer security', () => {
    const document = createControlOpenApiDocument()
    expect(document.openapi).toBe('3.1.0')
    expect(document.components?.securitySchemes).toHaveProperty('bearerAuth')
    for (const [path, methods] of Object.entries(CONTROL_ROUTE_CONTRACT)) {
      expect(document.paths).toHaveProperty(path)
      const routeFile = join(
        process.cwd(),
        'app',
        path.replace('/api/', 'api/').replace('{table}', '[table]').replace('{id}', '[id]'),
        'route.ts'
      )
      expect(existsSync(routeFile), routeFile).toBe(true)
      const source = readFileSync(routeFile, 'utf8')
      for (const method of methods) {
        expect(document.paths?.[path]).toHaveProperty(method)
        expect(source).toMatch(new RegExp(`export const ${method.toUpperCase()}\\b`))
      }
    }
  })
})

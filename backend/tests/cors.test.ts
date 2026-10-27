import { describe, expect, it } from 'vitest'
import { getCorsOptions, resolveCorsOrigin } from '../src/lib/cors.js'

describe('CORS configuration', () => {
  it('allows configured frontend origins with credentials', () => {
    const options = getCorsOptions('http://localhost:5173, https://app.example.com')

    expect(resolveCorsOrigin('https://app.example.com', 'http://localhost:5173, https://app.example.com'))
      .toBe('https://app.example.com')
    expect(options.credentials).toBe(true)
  })

  it('does not grant CORS access to unconfigured origins', () => {
    expect(resolveCorsOrigin('https://attacker.example', 'https://app.example.com')).toBe(false)
  })

  it('allows requests without an Origin header', () => {
    expect(resolveCorsOrigin(undefined, 'https://app.example.com')).toBe(false)
  })

  it('uses the local frontend origin by default', () => {
    expect(resolveCorsOrigin('http://localhost:5173', undefined)).toBe('http://localhost:5173')
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildCorsHeaders,
  isAllowedUsernameLoginOrigin,
  parseAllowedOrigins,
} from '../../../supabase/functions/_shared/username-login-origin-policy'

const configured = parseAllowedOrigins(
  'https://chunks-lms.vercel.app,http://localhost:5173,https://explicit.example.com',
)

describe('username-login origin policy', () => {
  it('accepts exact configured origins and the constrained Chunks project preview', () => {
    expect(isAllowedUsernameLoginOrigin('https://explicit.example.com', configured)).toBe(true)
    expect(
      isAllowedUsernameLoginOrigin(
        'https://chunks-9e0rpkczp-genshai-11s-projects.vercel.app',
        configured,
      ),
    ).toBe(true)
  })

  it('rejects unrelated Vercel apps, suffix attacks, insecure previews, and malformed origins', () => {
    expect(isAllowedUsernameLoginOrigin('https://evil.vercel.app', configured)).toBe(false)
    expect(
      isAllowedUsernameLoginOrigin(
        'https://chunks-x-genshai-11s-projects.vercel.app.attacker.example',
        configured,
      ),
    ).toBe(false)
    expect(
      isAllowedUsernameLoginOrigin(
        'http://chunks-x-genshai-11s-projects.vercel.app',
        configured,
      ),
    ).toBe(false)
    expect(isAllowedUsernameLoginOrigin('not a url', configured)).toBe(false)
  })

  it('never emits wildcard or rejected-origin ACAO', () => {
    const rejected = buildCorsHeaders('https://evil.vercel.app', configured)
    expect(rejected['Access-Control-Allow-Origin']).toBeUndefined()
    expect(Object.values(rejected)).not.toContain('*')

    const accepted = buildCorsHeaders(
      'https://chunks-9e0rpkczp-genshai-11s-projects.vercel.app',
      configured,
    )
    expect(accepted['Access-Control-Allow-Origin']).toBe(
      'https://chunks-9e0rpkczp-genshai-11s-projects.vercel.app',
    )
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  createDeterministicMockAdapter,
  createNineRouterAdapter,
  redactProviderMetadata,
  withAuditedRetries,
} from '../../../../supabase/functions/live-test-generation/adapters'

describe('live-test-generation Edge Function adapters', () => {
  it('calls 9Router chat completions for production-configured item generation', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'chatcmpl-1',
          model: 'openai/gpt-5',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  promptVi: 'Câu hỏi thật',
                  promptEn: 'Real prompt',
                  tc: 2,
                  lc: 3,
                  tl: 4,
                  measuredCvr: 24,
                }),
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const adapter = createNineRouterAdapter(
      { baseUrl: 'https://router.example', apiKey: 'secret-key', llmModel: 'openai/gpt-5' },
      fetchImpl as any,
    )

    const item = await adapter.generateTestItem({ promptDetails: 'Generate for Section 1' })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://router.example/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key',
          'Content-Type': 'application/json',
        }),
      }),
    )
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).messages[1].content).toBe(
      'Generate for Section 1',
    )
    expect(item.promptEn).toBe('Real prompt')
    expect(item.measuredCvr).toBe(24)
    expect(JSON.stringify(item.providerMetadata)).not.toContain('secret-key')
  })

  it('calls 9Router audio speech and returns actual TTS audio bytes for private Storage upload', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(bytes, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }),
      )
    const adapter = createNineRouterAdapter(
      { baseUrl: 'https://router.example', apiKey: 'secret-key', llmModel: 'openai/gpt-5' },
      fetchImpl as any,
    )

    const speech = await adapter.generateSpeech({
      text: 'Xin chào',
      language: 'vi',
      voiceId: 'edge-tts/vi-VN-HoaiMyNeural',
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://router.example/v1/audio/speech',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key',
          'Content-Type': 'application/json',
        }),
      }),
    )
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      model: 'edge-tts/vi-VN-HoaiMyNeural',
      input: 'Xin chào',
    })
    expect(Array.from(speech.bytes)).toEqual([1, 2, 3, 4, 5])
    expect(speech.mimeType).toBe('audio/mpeg')
    expect(JSON.stringify(speech.providerMetadata)).not.toContain('secret-key')
  })

  it('keeps deterministic mock generation behind an explicit adapter', async () => {
    const adapter = createDeterministicMockAdapter()
    const item = await adapter.generateTestItem({ promptDetails: 'local fixture' })
    const speech = await adapter.generateSpeech({
      text: 'Local text',
      language: 'en',
      voiceId: 'mock-voice',
    })

    expect(item.providerMetadata.provider).toBe('local-deterministic-mock')
    expect(item.promptEn).toContain('local fixture')
    expect(speech.providerMetadata.provider).toBe('local-deterministic-mock')
    expect(speech.bytes.byteLength).toBeGreaterThan(0)
  })

  it('redacts secrets from provider metadata and audited retry records', async () => {
    const redacted = redactProviderMetadata({
      model: 'openai/gpt-5',
      authorization: 'Bearer secret-key',
      nested: { apiKey: 'secret-key', safe: 'value' },
    })

    expect(JSON.stringify(redacted)).not.toContain('secret-key')
    expect(redacted).toEqual({
      model: 'openai/gpt-5',
      authorization: '[redacted]',
      nested: { apiKey: '[redacted]', safe: 'value' },
    })

    let calls = 0
    const result = await withAuditedRetries(async () => {
      calls += 1
      if (calls === 1) throw new Error('temporary 9Router failure')
      return { providerMetadata: { token: 'secret-key', requestId: 'ok' } }
    }, 2)

    expect('result' in result).toBe(true)
    expect(result.attempts).toHaveLength(2)
    expect(result.attempts[0]).toMatchObject({
      attempt: 1,
      status: 'failed',
      errorMessage: 'temporary 9Router failure',
    })
    expect(JSON.stringify(result.attempts)).not.toContain('secret-key')
  })
})

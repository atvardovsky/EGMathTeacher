import { BadGatewayException } from '@nestjs/common';
import { OpenAiClientService } from '../src/openai/openai-client.service';

describe('OpenAiClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('aborts a responses request when the caller abort signal fires', async () => {
    const service = new OpenAiClientService({
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'ai.openai.apiKey': 'test-key',
          'ai.openai.requestTimeoutMs': 30_000,
        };
        return values[key];
      }),
    } as any);
    const controller = new AbortController();
    let fetchSignal: AbortSignal | undefined;
    global.fetch = jest.fn((_url, init) => {
      fetchSignal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        fetchSignal?.addEventListener('abort', () => {
          reject(new Error('request aborted by caller'));
        });
      });
    }) as typeof fetch;

    const request = service.createResponse(
      { model: 'gpt-test', input: 'hello' },
      { signal: controller.signal },
    );
    await Promise.resolve();
    controller.abort(new Error('claim lost'));

    await expect(request).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchSignal?.aborted).toBe(true);
  });
});

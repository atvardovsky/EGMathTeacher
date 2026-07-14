import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
    const assertion = expect(request).rejects.toBeInstanceOf(ServiceUnavailableException);
    await Promise.resolve();
    controller.abort(new Error('claim lost'));

    await assertion;
    expect(fetchSignal?.aborted).toBe(true);
  });

  it('reports response request timeouts distinctly from provider failures', async () => {
    jest.useFakeTimers();
    try {
      const service = new OpenAiClientService({
        get: jest.fn((key: string) => {
          const values: Record<string, unknown> = {
            'ai.openai.apiKey': 'test-key',
            'ai.openai.requestTimeoutMs': 10,
          };
          return values[key];
        }),
      } as any);
      let fetchSignal: AbortSignal | undefined;
      global.fetch = jest.fn((_url, init) => {
        fetchSignal = init?.signal as AbortSignal;
        return new Promise((_resolve, reject) => {
          fetchSignal?.addEventListener('abort', () => {
            reject(new Error('request timed out'));
          });
        });
      }) as typeof fetch;

      const request = service.createResponse({ model: 'gpt-test', input: 'hello' });
      const assertion = expect(request).rejects.toBeInstanceOf(GatewayTimeoutException);
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(20);

      await assertion;
      expect(fetchSignal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps network/provider failures as bad gateway errors', async () => {
    const service = new OpenAiClientService({
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'ai.openai.apiKey': 'test-key',
          'ai.openai.requestTimeoutMs': 30_000,
        };
        return values[key];
      }),
    } as any);
    global.fetch = jest.fn(async () => {
      throw new Error('network unavailable');
    }) as typeof fetch;

    await expect(
      service.createResponse({ model: 'gpt-test', input: 'hello' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

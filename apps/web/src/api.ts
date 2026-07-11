const API_BASE = import.meta.env.VITE_API_URL ?? window.location.origin;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const hasFormData = init.body instanceof FormData;
  if (init.body && !hasFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[]; error?: string };
      const rawMessage = parsed.message ?? parsed.error;
      message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage || message;
    } catch {
      // Keep raw response text.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

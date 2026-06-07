// Minimal Cerebras Inference client (OpenAI-compatible chat completions + tool calling).
// Cerebras exposes an OpenAI-compatible API, so we speak the same wire format.

const CEREBRAS_ENDPOINT = 'https://api.cerebras.ai/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  // assistant messages may request tool calls
  tool_calls?: ToolCall[];
  // tool messages must reference the call they answer
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

export interface ChatCompletionResult {
  content: string | null;
  toolCalls: ToolCall[];
}

export function isCerebrasConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CEREBRAS_API_KEY);
}

export function getCerebrasModel(): string {
  return (import.meta.env.VITE_CEREBRAS_MODEL as string) || 'gpt-oss-120b';
}

export async function cerebrasChat(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  options: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<ChatCompletionResult> {
  const apiKey = import.meta.env.VITE_CEREBRAS_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error('Cerebras API key missing. Set VITE_CEREBRAS_API_KEY in .env.local');
  }

  const body: Record<string, unknown> = {
    model: getCerebrasModel(),
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 1024,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  // Retry on transient errors (429 rate-limit / 503 overloaded) with backoff.
  const MAX_ATTEMPTS = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(CEREBRAS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (response.ok) {
      const json = await response.json();
      const message = json?.choices?.[0]?.message ?? {};
      return {
        content: typeof message.content === 'string' ? message.content : null,
        toolCalls: Array.isArray(message.tool_calls) ? (message.tool_calls as ToolCall[]) : [],
      };
    }

    const text = await response.text().catch(() => '');

    if ((response.status === 429 || response.status === 503) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 800 * 2 ** (attempt - 1); // 800ms, 1.6s
      await new Promise((r) => setTimeout(r, waitMs));
      lastError = new Error('Cerebras is busy right now. Please try again in a moment.');
      continue;
    }

    if (response.status === 429 || response.status === 503) {
      throw new Error('Cerebras is busy right now (rate limited). Give it a few seconds and try again.');
    }
    throw new Error(`Cerebras request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  throw lastError ?? new Error('Cerebras request failed after retries.');
}

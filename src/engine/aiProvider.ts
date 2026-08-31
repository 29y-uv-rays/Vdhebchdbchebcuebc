export interface ProviderError {
  code: string;
  message: string;
  status?: number;
  diagnostic?: string;
}

interface ProviderSuccess<T> {
  ok: true;
  data: T;
  model: string;
  warnings: string[];
}

interface ProviderFailure {
  ok: false;
  error: ProviderError;
  model: string;
  warnings: string[];
}

export type ProviderResult<T> = ProviderSuccess<T> | ProviderFailure;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDiagnosticSnippet(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 320);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function extractBalancedJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          candidates.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  return candidates;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Model returned empty content');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue into fallback parsing strategies.
  }

  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedMatches) {
    const block = match[1]?.trim();
    if (!block) {
      continue;
    }
    try {
      return JSON.parse(block);
    } catch {
      // Continue scanning.
    }
  }

  for (const candidate of extractBalancedJsonCandidates(trimmed)) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue scanning for another candidate.
    }
  }

  throw new Error('Unable to parse JSON object from model response');
}

export async function callNvidiaJson<T>(options: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  validate: (value: unknown) => value is T;
  timeoutMs?: number;
  maxAttempts?: number;
  temperature?: number;
  maxTokens?: number;
}): Promise<ProviderResult<T>> {
  const {
    apiKey,
    model,
    systemInstruction,
    prompt,
    validate,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    temperature = 0.35,
    maxTokens = 650,
  } = options;

  const warnings: string[] = [];
  let lastError: ProviderError = {
    code: 'NIM_UNKNOWN_ERROR',
    message: 'NVIDIA NIM request failed.',
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(NIM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        lastError = {
          code: RETRYABLE_STATUSES.has(response.status)
            ? 'NIM_RETRYABLE_ERROR'
            : 'NIM_HTTP_ERROR',
          message: `NVIDIA NIM returned status ${response.status}.`,
          status: response.status,
          diagnostic: getDiagnosticSnippet(errorText),
        };
        if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
          warnings.push(`NVIDIA NIM retry ${attempt}/${maxAttempts} after HTTP ${response.status}.`);
          await sleep(DEFAULT_BACKOFF_MS * attempt);
          continue;
        }
        return { ok: false, error: lastError, model, warnings };
      }

      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        return {
          ok: false,
          model,
          warnings,
          error: {
            code: 'NIM_INVALID_RESPONSE',
            message: 'NVIDIA NIM response did not contain text content.',
          },
        };
      }

      let parsed: unknown;
      try {
        parsed = extractJsonObject(content);
      } catch (error) {
        return {
          ok: false,
          model,
          warnings,
          error: {
            code: 'NIM_INVALID_JSON',
            message: error instanceof Error ? error.message : 'Failed to parse model JSON response.',
            diagnostic: getDiagnosticSnippet(content),
          },
        };
      }

      if (!validate(parsed)) {
        return {
          ok: false,
          model,
          warnings,
          error: {
            code: 'NIM_SCHEMA_MISMATCH',
            message: 'NVIDIA NIM response JSON did not match expected schema.',
            diagnostic: getDiagnosticSnippet(content),
          },
        };
      }

      return { ok: true, data: parsed, model, warnings };
    } catch (error) {
      clearTimeout(timeoutId);
      const retryable = isAbortError(error) || error instanceof TypeError;
      lastError = {
        code: isAbortError(error) ? 'NIM_TIMEOUT' : 'NIM_NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'NVIDIA NIM network request failed.',
      };
      if (retryable && attempt < maxAttempts) {
        warnings.push(`NVIDIA NIM retry ${attempt}/${maxAttempts} after ${lastError.code}.`);
        await sleep(DEFAULT_BACKOFF_MS * attempt);
        continue;
      }
      return { ok: false, error: lastError, model, warnings };
    }
  }

  return { ok: false, error: lastError, model, warnings };
}

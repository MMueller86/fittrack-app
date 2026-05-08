// apiError.ts — formats Axios errors into human-readable diagnostics.
//
// Usage:
//   import { formatApiError } from '../shared/api/apiError';
//   catch (e) { setError(formatApiError(e)); }

import axios from 'axios';

/**
 * Converts any thrown value into a readable error string.
 *
 * Axios network error  → "Cannot reach server\nhttp://host/api/path\n(ERR_NETWORK)"
 * Axios timeout        → "Request timed out (15 s)\nGET /weights"
 * Axios HTTP error     → "HTTP 404 Not Found\nGET /weights"  + server message if present
 * Other Error          → error.message
 * Unknown              → fallback
 */
export function formatApiError(error: unknown, fallback = 'Unexpected error'): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const method = (error.config?.method ?? 'request').toUpperCase();
  const path = error.config?.url ?? '';
  const baseURL = error.config?.baseURL ?? '';

  // Build full URL for no-response errors (so the user can see what was targeted)
  const fullUrl = path.startsWith('http') ? path : `${baseURL}/${path}`.replace(/([^:])\/\/+/g, '$1/');

  // Timeout
  if (error.code === 'ECONNABORTED') {
    const timeout = error.config?.timeout != null ? `${Math.round(error.config.timeout / 1000)} s` : '';
    return [`Request timed out${timeout ? ` (${timeout})` : ''}`, `${method} ${path}`]
      .filter(Boolean)
      .join('\n');
  }

  // No response at all → network unreachable, DNS fail, connection refused, etc.
  if (!error.response) {
    const code = error.code ?? error.message;
    return [`Cannot reach server`, fullUrl, code ? `(${code})` : ''].filter(Boolean).join('\n');
  }

  // HTTP error (got a response, but non-2xx)
  const status = error.response.status;
  const statusText = HTTP_STATUS_TEXT[status] ?? '';
  const serverMessage = extractServerMessage(error.response.data);

  const lines: string[] = [
    `HTTP ${status}${statusText ? ` ${statusText}` : ''}`,
    `${method} ${path}`,
  ];
  if (serverMessage) lines.push(serverMessage);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------

function extractServerMessage(data: unknown): string | undefined {
  if (!data) return undefined;
  if (typeof data === 'string') return data.slice(0, 200);
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const msg = d['message'] ?? d['error'] ?? d['detail'];
    if (typeof msg === 'string') return msg.slice(0, 200);
  }
  return undefined;
}

const HTTP_STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

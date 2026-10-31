import type { Config, ConnectionSettings, QueuedOperation, SheetData } from './types';

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface Snapshot {
  ok: true;
  rows: SheetData['rows'];
  types: string[];
  accounts: string[];
  config: Partial<Config>;
}

const REQUEST_TIMEOUT_MS = 60000;

export async function callApi(
  settings: ConnectionSettings,
  action: QueuedOperation['action'] | 'bootstrap',
  payload: object = {}
): Promise<Snapshot> {
  if (!settings.url || !settings.token) {
    throw new ApiError('config', 'Falta configurar la conexión en Ajustes.');
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(settings.url, {
      method: 'POST',
      // text/plain avoids the CORS preflight request, which Apps Script cannot answer
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: settings.token, action, ...payload }),
      signal: abortController.signal,
      redirect: 'follow'
    });
  } catch {
    throw new ApiError('network', 'Sin conexión');
  } finally {
    clearTimeout(timeoutId);
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      'bad_response',
      'Respuesta inválida. Revisa que la URL termine en /exec y que el acceso sea "Cualquier persona".'
    );
  }
  if (!body.ok) throw new ApiError(body.error || 'internal', body.message || 'Error del servidor');
  return body;
}

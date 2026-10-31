/* Cliente del Apps Script publicado desde la planilla. */
import type { Config, Data, Op, Settings } from './types';

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Respuesta del servidor: siempre trae una copia fresca de la planilla. */
export interface Snapshot {
  ok: true;
  rows: Data['rows'];
  types: string[];
  accounts: string[];
  config: Partial<Config>;
}

const API_TIMEOUT_MS = 60000;

/** Llama al Apps Script. Devuelve el JSON de respuesta o lanza ApiError. */
export async function api(
  settings: Settings,
  action: Op['action'] | 'bootstrap',
  payload: object = {}
): Promise<Snapshot> {
  if (!settings.url || !settings.token) {
    throw new ApiError('config', 'Falta configurar la conexión en Ajustes.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(settings.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita el preflight CORS
      body: JSON.stringify({ token: settings.token, action, ...payload }),
      signal: controller.signal,
      redirect: 'follow'
    });
  } catch {
    throw new ApiError('network', 'Sin conexión');
  } finally {
    clearTimeout(timer);
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      'bad_response',
      'Respuesta inválida. Revisa que la URL termine en /exec y que el acceso sea "Cualquier persona".'
    );
  }
  if (!json.ok) throw new ApiError(json.error || 'internal', json.message || 'Error del servidor');
  return json;
}

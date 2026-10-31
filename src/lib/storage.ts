/* Almacenamiento local (prefijo "gt." para conservar los datos de la versión anterior). */

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem('gt.' + key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem('gt.' + key, JSON.stringify(value));
    } catch {
      /* cuota llena */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem('gt.' + key);
    } catch {
      /* sin acceso */
    }
  }
};

/** Keys keep the "gt." prefix so data saved by the previous version is still found. */
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
      // storage full: the copy in memory keeps working
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem('gt.' + key);
    } catch {
      // storage unavailable
    }
  }
};

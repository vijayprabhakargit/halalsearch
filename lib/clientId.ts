const KEY = "halalsearch.clientId";

/** Anonymous, stable-per-browser id for attributing community reports. */
export function getClientId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

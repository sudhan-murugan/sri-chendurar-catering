// Optional 4-digit PIN lock. Stored per phone (hashed), never sent anywhere.
const PIN_KEY = "scc_pin";
const LOCK_AFTER_MS = 2 * 60 * 1000; // lock again after 2 min in background

async function hash(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`scc-pin:${pin}`);
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(PIN_KEY);
  } catch {
    return false;
  }
}
export async function setPin(pin: string) {
  localStorage.setItem(PIN_KEY, await hash(pin));
}
export function clearPin() {
  localStorage.removeItem(PIN_KEY);
}
export async function checkPin(pin: string): Promise<boolean> {
  return (await hash(pin)) === localStorage.getItem(PIN_KEY);
}
export const PIN_LOCK_AFTER_MS = LOCK_AFTER_MS;

import type { Role } from "./queue/schema";

const SESSION_KEY = "arcedge-session-v1";

export interface SessionPayload {
  userId: string;
  username: string;
  fullName: string;
  roles: Role[];
}

export function readSession(): SessionPayload | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export function writeSession(s: SessionPayload | null): void {
  if (!s) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("arcedge-auth"));
}

export function onAuthChange(cb: () => void): () => void {
  window.addEventListener("arcedge-auth", cb);
  return () => window.removeEventListener("arcedge-auth", cb);
}

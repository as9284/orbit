const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

// ── Salt ──────────────────────────────────────────────────────────────
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return uint8ToBase64(salt);
}

// ── Key derivation (PBKDF2 → AES-256-GCM) ────────────────────────────
export async function deriveKey(
  password: string,
  saltB64: string,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToUint8(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable (for sessionStorage export)
    ["encrypt", "decrypt"],
  );
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────
export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  // Prepend IV to ciphertext
  const combined = new Uint8Array(IV_BYTES + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), IV_BYTES);
  return uint8ToBase64(combined);
}

export async function decrypt(
  ciphertextB64: string,
  key: CryptoKey,
): Promise<string> {
  const data = base64ToUint8(ciphertextB64);
  const iv = data.slice(0, IV_BYTES);
  const ciphertext = data.slice(IV_BYTES);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plainBuf);
}

// ── Key persistence (localStorage) ────────────────────────────────────
const STORAGE_KEY = "orbit_ek";

export async function saveKeyToSession(key: CryptoKey): Promise<void> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jwk));
}

export async function loadKeyFromSession(): Promise<CryptoKey | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const jwk = JSON.parse(raw) as JsonWebKey;
    return crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

export function clearKeyFromSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Base-64 helpers ───────────────────────────────────────────────────
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes as Uint8Array<ArrayBuffer>;
}

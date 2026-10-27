import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt via Node's crypto: memory-hard, no native add-ons to build.
// N=2^15, r=8 uses 32 MiB per hash — a sensible default for small servers.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N: n, r, p, maxmem: MAX_MEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True when a stored hash uses weaker parameters than the current defaults. */
export function needsRehash(stored: string): boolean {
  const [, n, r, p] = stored.split("$");
  return Number(n) !== N || Number(r) !== R || Number(p) !== P;
}

/** A valid hash of a random password, used to keep login timing uniform for unknown emails. */
export const dummyPasswordHash = hashPassword(randomBytes(16).toString("hex"));

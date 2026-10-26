/**
 * Whether a password is long enough and hasn't appeared in a known breach.
 * Uses Have I Been Pwned's range API: only the first five characters of the
 * SHA-1 leave the browser. If the check can't run it fails open, so nobody is
 * locked out because a third party is down.
 */
export async function checkPassword(password: string): Promise<{ ok: boolean; reason?: string }> {
  if (password.length < 12) return { ok: false, reason: "Use at least twelve characters." };
  if (/^(.)\1+$/.test(password)) return { ok: false, reason: "That's one character repeated." };
  try {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
    if (!res.ok) return { ok: true };
    const rest = hash.slice(5);
    for (const line of (await res.text()).split("\n")) {
      const [suffix, count] = line.trim().split(":");
      if (suffix === rest && Number(count) > 0) {
        return { ok: false, reason: "That password has appeared in a data breach. Choose a different one." };
      }
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

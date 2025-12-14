/**
 * Hash password using Web Crypto API (PBKDF2)
 * This is suitable for this use case where it's an additional layer within an already authenticated session
 */
export async function hashPassword(password: string): Promise<string> {
  // Convert password to ArrayBuffer
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(password)

  // Generate a salt (we'll use a fixed salt for simplicity since this is not the main auth)
  // In production, you might want to store salt per user, but for this use case it's acceptable
  const salt = encoder.encode("protected-screen-salt-v1")

  // Import the password as a key
  const keyMaterial = await crypto.subtle.importKey("raw", passwordData, "PBKDF2", false, ["deriveBits", "deriveKey"])

  // Derive key using PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // High iteration count for security
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  )

  // Export the key to get the hash
  const exported = await crypto.subtle.exportKey("raw", derivedKey)
  const hashArray = Array.from(new Uint8Array(exported))

  // Convert to hex string
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Verify password by comparing hashes
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}

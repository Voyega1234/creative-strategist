export const PASSWORD_ACCESS_COOKIE = "compass_password_access"
export const PASSWORD_ACCESS_MAX_AGE_SECONDS = 12 * 60 * 60

const TOKEN_MESSAGE = "creative-compass-password-access-v1"

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

export async function createPasswordAccessToken(secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(TOKEN_MESSAGE)
  )

  return toHex(new Uint8Array(signature))
}

export async function verifyPasswordAccessToken(
  token: string | null | undefined,
  secret: string | null | undefined
) {
  if (!token || !secret) return false

  const expectedToken = await createPasswordAccessToken(secret)
  return constantTimeEqual(token, expectedToken)
}

export function isCorrectAccessPassword(
  password: string,
  expectedPassword: string
) {
  return constantTimeEqual(password, expectedPassword)
}

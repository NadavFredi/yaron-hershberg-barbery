export function normalizePhone(rawPhone?: string | null): string | null {
  if (!rawPhone) {
    return null
  }

  const digits = rawPhone.replace(/\D/g, "")
  if (!digits) {
    return null
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `972${digits.slice(1)}`
  }

  return digits
}

export function extractDigits(rawPhone?: string | null): string {
  if (!rawPhone) {
    return ""
  }
  return rawPhone.replace(/\D/g, "")
}

export function toE164(rawPhone?: string | null): string | null {
  const digits = normalizePhone(rawPhone)

  if (!digits) {
    return null
  }

  if (digits.length < 9 || digits.length > 15) {
    return null
  }

  return `+${digits}`
}

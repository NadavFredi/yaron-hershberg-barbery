/**
 * Custom error class that preserves HTTP status codes
 */
export class HttpError extends Error {
  constructor(message: string, public status: number, public originalError?: unknown) {
    super(message)
    this.name = "HttpError"
    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError)
    }
  }
}

/**
 * Extracts HTTP status code from various error formats
 * Works with: HttpError, RTK Query errors, Supabase errors, and general error objects
 */
export function getErrorStatus(error: unknown): number | null {
  if (!error) return null

  // Check if it's our custom HttpError
  if (error instanceof HttpError) {
    return error.status
  }

  const errorObj = error as Record<string, unknown>

  // Check for status codes in various formats
  // RTK Query errors have status as number | string (we only care about numbers)
  if (typeof errorObj.status === "number") {
    return errorObj.status
  }

  if (typeof errorObj.statusCode === "number") {
    return errorObj.statusCode
  }

  // Check nested error objects (e.g., RTK Query error structure)
  if (errorObj.error && typeof errorObj.error === "object") {
    const nestedError = errorObj.error as Record<string, unknown>
    if (typeof nestedError.status === "number") {
      return nestedError.status
    }
    if (typeof nestedError.statusCode === "number") {
      return nestedError.statusCode as number
    }
  }

  return null
}

/**
 * Generates user-friendly error messages based on HTTP status codes
 * Handles RTK Query errors, HttpError, and general error objects
 */
export function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (!error) {
    return defaultMessage
  }

  const errorObj = error as Record<string, unknown>

  // RTK Query errors have structure: { status: number | string, data: unknown }
  // Extract message from data field first if available
  if ("status" in errorObj && "data" in errorObj) {
    const data = errorObj.data

    // If data is a string, use it directly
    if (typeof data === "string") {
      return data
    }

    // If data is an object, try to extract message from it
    if (data && typeof data === "object") {
      const dataObj = data as Record<string, unknown>
      const nestedMessage = (dataObj.error as string) || (dataObj.message as string) || (dataObj.errorMessage as string)

      if (
        nestedMessage &&
        typeof nestedMessage === "string" &&
        nestedMessage !== "null" &&
        nestedMessage !== "undefined"
      ) {
        // If we have a nested message and a status, prefer status-based message for 401/403
        const status = getErrorStatus(error)
        if (status === 401 || status === 403) {
          // Use status-specific message instead of nested message
        } else {
          return nestedMessage
        }
      }
    }
  }

  const status = getErrorStatus(error)

  // Status code specific messages (in Hebrew)
  if (status !== null) {
    switch (status) {
      case 401:
        return "ההתחברות שלך פגה או לא תקינה. אנא התחבר מחדש כדי להמשיך."

      case 403:
        return "אין לך הרשאות לבצע פעולה זו. אם אתה חושב שזו טעות, אנא פנה למנהל המערכת."

      case 404:
        return "המשאב המבוקש לא נמצא. ייתכן שהמידע הוסר או שהקישור שגוי."

      case 409:
        return "יש התנגשות עם מידע קיים. ייתכן שהנתונים כבר קיימים במערכת."

      case 422:
        return "הנתונים שהוזנו אינם תקינים. אנא בדוק את כל השדות ונסה שוב."

      case 429:
        return "יותר מדי בקשות. אנא המתן רגע ונסה שוב."

      case 500:
        return "שגיאה פנימית בשרת. אנא נסה שוב מאוחר יותר. אם הבעיה נמשכת, פנה לתמיכה."

      case 503:
        return "השרת זמנית לא זמין. אנא נסה שוב בעוד כמה רגעים."

      default: {
        // For other status codes, try to use error message from data or message field
        const errorMessage = (errorObj.message as string) || (errorObj.data as string) || (errorObj.error as string)

        if (
          errorMessage &&
          typeof errorMessage === "string" &&
          errorMessage !== "null" &&
          errorMessage !== "undefined"
        ) {
          return errorMessage
        }

        return defaultMessage
      }
    }
  }

  // No status code - try to extract message from error object
  const errorMessage =
    (errorObj.message as string) ||
    (errorObj.data as string) ||
    (errorObj.error as string) ||
    (error instanceof Error ? error.message : null) ||
    String(error)

  // If we have a meaningful error message, use it
  if (errorMessage && errorMessage !== "null" && errorMessage !== "undefined" && errorMessage !== "[object Object]") {
    return errorMessage
  }

  return defaultMessage
}

/**
 * Gets a detailed error description for display in UI (for status codes that need extra context)
 */
export function getErrorDescription(error: unknown): string | null {
  const status = getErrorStatus(error)

  if (status === 401) {
    return "אנא התחבר מחדש כדי לבצע פעולה זו."
  }

  if (status === 403) {
    return "רק מנהלים יכולים לבצע פעולה זו. אם אתה מנהל והבעיה נמשכת, אנא פנה לתמיכה."
  }

  // For other errors, return null to use default description
  return null
}

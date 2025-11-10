import type { FetchBaseQueryError, SerializedError } from "@reduxjs/toolkit/query"

export function extractErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
  fallback: string
): string | null {
  if (!error) {
    return null
  }

  if ("status" in error) {
    const data = error.data

    if (typeof data === "string") {
      return data
    }

    if (data && typeof data === "object") {
      const errorMessage = (data as { error?: string; message?: string }).error ||
        (data as { error?: string; message?: string }).message

      if (errorMessage) {
        return errorMessage
      }
    }

    return fallback
  }

  if (error.message) {
    return error.message
  }

  return fallback
}

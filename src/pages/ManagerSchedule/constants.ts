import { addMinutes, setMilliseconds, setSeconds } from "date-fns"
import type { ManagerAppointment, ManagerServiceFilter, WaitlistServiceScope } from "./types"

export const SERVICE_LABELS: Record<ManagerServiceFilter, string> = {
  grooming: "מספרה",
}

export const SERVICE_STYLES: Record<ManagerServiceFilter, { card: string; badge: string }> = {
  grooming: {
    card: "bg-blue-50 border-blue-200",
    badge: "border-blue-200 bg-blue-100 text-blue-800",
  },
}

// Utility function to snap time to the nearest interval
export const snapTimeToInterval = (date: Date, intervalMinutes: number): Date => {
  const minutes = date.getMinutes()
  const remainder = minutes % intervalMinutes
  let snappedDate = date

  if (remainder !== 0) {
    if (remainder < intervalMinutes / 2) {
      snappedDate = addMinutes(date, -remainder)
    } else {
      snappedDate = addMinutes(date, intervalMinutes - remainder)
    }
  }
  return setSeconds(setMilliseconds(snappedDate, 0), 0)
}

export const STATUS_STYLE_MAP = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-slate-200 bg-slate-50 text-slate-700",
}

export const getStatusStyle = (status: string, appointment?: ManagerAppointment): string => {
  const normalized = status.toLowerCase()

  if (
    normalized.includes("cancel") ||
    normalized.includes("בוטל") ||
    normalized.includes("מבוטל") ||
    normalized.includes("לא הגיע")
  ) {
    return STATUS_STYLE_MAP.danger
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("ממתין") ||
    normalized.includes("בהמתנה") ||
    normalized.includes("מחכה")
  ) {
    return STATUS_STYLE_MAP.warning
  }

  if (
    normalized.includes("confirm") ||
    normalized.includes("מאושר") ||
    normalized.includes("הושלם") ||
    normalized.includes("מאשר")
  ) {
    return STATUS_STYLE_MAP.success
  }

  return STATUS_STYLE_MAP.info
}

export const isAppointmentPaid = (paymentStatus?: string): boolean => {
  if (!paymentStatus) return false
  const normalized = paymentStatus.toLowerCase()
  return normalized.includes("שולם") || normalized.includes("paid")
}

export const isAppointmentCompleted = (status: string): boolean => {
  const normalized = status.toLowerCase()
  return normalized.includes("הושלם") || normalized.includes("completed")
}

export const DEFAULT_START_HOUR = 8
export const DEFAULT_END_HOUR = 20
export const WAITLIST_VISIBILITY_STORAGE_KEY = "manager-schedule-waitlist-visible"
export const STANDARD_COLUMN_WIDTH = 240
export const WAITLIST_COLUMN_WIDTH = STANDARD_COLUMN_WIDTH
export const PINNED_APPOINTMENTS_COLUMN_WIDTH = STANDARD_COLUMN_WIDTH
export const PINNED_APPOINTMENTS_VISIBILITY_STORAGE_KEY = "manager-schedule-pinned-visible"
export const EMPTY_STATIONS_OVERRIDE_PARAM = "__none__"
export const WAITLIST_DEFAULT_DURATION_MINUTES = 60
export const UNCLASSIFIED_CUSTOMER_TYPE_ID = "uncategorized-customer-type"

export const WAITLIST_SCOPE_META: Record<
  WaitlistServiceScope,
  { label: string; badgeClass: string }
> = {
  grooming: {
    label: "מספרה",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-100",
  },
}

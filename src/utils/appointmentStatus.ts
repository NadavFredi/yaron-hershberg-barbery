interface AppointmentStatusSource {
    status?: string | null
    date?: string | null
    time?: string | null
    startDateTime?: string | null
}

interface AppointmentStatusBadgeConfig {
    label: string
    className: string
}

const createBadge = (label: string, className: string): AppointmentStatusBadgeConfig => ({
    label,
    className,
})

const isPastAppointment = (appointment: AppointmentStatusSource): boolean => {
    const source = appointment.startDateTime || (appointment.date && appointment.time ? `${appointment.date}T${appointment.time}` : null)
    if (!source) {
        return false
    }

    const parsed = new Date(source)
    if (Number.isNaN(parsed.getTime())) {
        return false
    }

    return parsed <= new Date()
}

export const getAppointmentStatusBadgeConfig = (
    appointment: AppointmentStatusSource
): AppointmentStatusBadgeConfig | null => {
    const status = appointment.status?.trim()
    if (!status) {
        return null
    }

    const normalized = status.toLowerCase()
    const past = isPastAppointment(appointment)

    if (normalized.includes("cancel") || normalized === "בוטל") {
        return createBadge('בוטל', "bg-red-50 text-red-700 border-red-200")
    }

    if (normalized.includes("approve") || normalized === "מאושר") {
        if (past) {
            return createBadge('הושלם', "bg-blue-50 text-blue-700 border-blue-200")
        }
        return createBadge('מאושר', "bg-green-50 text-green-700 border-green-200")
    }

    if (normalized.includes("confirm") || normalized === "תואם") {
        return createBadge('תואם', "bg-emerald-50 text-emerald-700 border-emerald-200")
    }

    if (normalized.includes("pending") || normalized === "ממתין") {
        return createBadge('ממתין', "bg-amber-50 text-amber-700 border-amber-200")
    }

    if (normalized.includes("complete") || normalized === "הושלם" || past) {
        return createBadge('הושלם', "bg-blue-50 text-blue-700 border-blue-200")
    }

    return createBadge(status, "bg-gray-100 text-gray-800 border-gray-200")
}

export type { AppointmentStatusBadgeConfig, AppointmentStatusSource }


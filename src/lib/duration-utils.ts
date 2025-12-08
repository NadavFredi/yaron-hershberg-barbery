// Helper function to format minutes to duration (H:MM or just minutes if < 60)
export const formatDurationFromMinutes = (minutes: number): string => {
    if (isNaN(minutes) || minutes < 0) return "0 דקות"
    if (minutes < 60) {
        return `${Math.round(minutes)} דקות`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) {
        return `${hours} שעות`
    }
    return `${hours}:${mins.toString().padStart(2, "0")} שעות`
}

// Helper function to format minutes for charts (returns hours if >= 60, otherwise minutes)
export const formatDurationForChart = (minutes: number): number => {
    if (isNaN(minutes) || minutes < 0) return 0
    if (minutes >= 60) {
        return Math.round((minutes / 60) * 100) / 100 // Round to 2 decimal places
    }
    return minutes
}

// Helper function to get duration label for charts
export const getDurationLabel = (minutes: number): string => {
    if (isNaN(minutes) || minutes < 0) return "0"
    if (minutes >= 60) {
        const hours = Math.round((minutes / 60) * 100) / 100
        return `${hours} שעות`
    }
    return `${Math.round(minutes)} דקות`
}

// Helper function to parse duration (H:MM) to minutes
export const parseDurationToMinutes = (duration: string): number | null => {
    if (!duration || duration.trim() === "") return null
    
    const cleaned = duration.trim().replace(/[^\d:]/g, "")
    if (!cleaned) return null
    
    // Handle format like "1:30" or "1:30:00" or just "90" (minutes)
    const parts = cleaned.split(":")
    
    if (parts.length === 1) {
        // Just a number - treat as minutes
        const mins = parseInt(parts[0], 10)
        return isNaN(mins) ? null : mins
    } else if (parts.length === 2) {
        // H:MM format
        const hours = parseInt(parts[0], 10)
        const minutes = parseInt(parts[1], 10)
        if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes >= 60) return null
        return hours * 60 + minutes
    } else if (parts.length === 3) {
        // H:MM:SS format - ignore seconds
        const hours = parseInt(parts[0], 10)
        const minutes = parseInt(parts[1], 10)
        if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes >= 60) return null
        return hours * 60 + minutes
    }
    
    return null
}


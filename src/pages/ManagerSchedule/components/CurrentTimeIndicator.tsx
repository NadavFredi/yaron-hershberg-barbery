import { useEffect, useState, useMemo } from "react"
import { differenceInMinutes, isSameDay, isAfter, isBefore } from "date-fns"
import type { TimelineConfig } from "../managerSchedule.module"

interface CurrentTimeIndicatorProps {
    timeline: TimelineConfig
    selectedDate: Date
}

export function CurrentTimeIndicator({ timeline, selectedDate }: CurrentTimeIndicatorProps) {
    const [currentTime, setCurrentTime] = useState(new Date())

    // Update current time every 30 seconds for smoother updates
    useEffect(() => {
        // Set initial time immediately
        setCurrentTime(new Date())

        const interval = setInterval(() => {
            setCurrentTime(new Date())
        }, 30000) // Update every 30 seconds

        return () => clearInterval(interval)
    }, [])

    // Calculate position and visibility
    const { top, isVisible } = useMemo(() => {
        // Only show if current time is on the selected date
        if (!isSameDay(currentTime, selectedDate)) {
            return { top: 0, isVisible: false }
        }

        // Check if current time is within timeline range
        if (isBefore(currentTime, timeline.start) || isAfter(currentTime, timeline.end)) {
            return { top: 0, isVisible: false }
        }

        // Calculate position in pixels
        const minutesFromStart = differenceInMinutes(currentTime, timeline.start)
        const totalMinutes = differenceInMinutes(timeline.end, timeline.start)
        const pixelsPerMinute = timeline.height / totalMinutes
        const top = minutesFromStart * pixelsPerMinute

        return { top, isVisible: true }
    }, [currentTime, selectedDate, timeline])

    if (!isVisible) {
        return null
    }

    return (
        <div
            className="absolute pointer-events-none z-50"
            style={{
                top: `${top}px`,
                left: 0,
                right: 0,
                width: '100%',
                height: "2px",
                backgroundColor: "hsl(228, 36%, 65%)", // Lighter brand color
                opacity: 0.6, // Make it more subtle
            }}
        />
    )
}


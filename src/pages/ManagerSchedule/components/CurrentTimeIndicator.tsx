import { useEffect, useState, useMemo } from "react"
import { differenceInMinutes } from "date-fns"
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
        // Anchor "now" to the selected date so we always show the current hour/minute,
        // regardless of which day is selected in the calendar.
        const nowLocal = new Date(currentTime)
        const selectedDateLocal = new Date(selectedDate)
        const currentTimeOnSelectedDate = new Date(selectedDateLocal)
        currentTimeOnSelectedDate.setHours(
            nowLocal.getHours(),
            nowLocal.getMinutes(),
            nowLocal.getSeconds(),
            nowLocal.getMilliseconds()
        )

        // Calculate position in pixels and clamp to timeline bounds so we always show "now"
        const minutesFromStart = differenceInMinutes(currentTimeOnSelectedDate, timeline.start)
        const totalMinutes = differenceInMinutes(timeline.end, timeline.start)



        const pixelsPerMinute = timeline.height / totalMinutes
        const clampedMinutesFromStart = Math.min(Math.max(minutesFromStart, 0), totalMinutes)
        const top = clampedMinutesFromStart * pixelsPerMinute

        return { top, isVisible: true }
    }, [currentTime, selectedDate, timeline])

    if (!isVisible) {
        return null
    }

    return (
        <div
            className="absolute pointer-events-none"
            style={{
                top: `${top}px`,
                left: 0,
                right: 0,
                width: '100%',
                height: "2px",
                backgroundColor: "hsl(228, 36%, 65%)", // Lighter brand color
                opacity: 0.6,
                zIndex: 50,
                // Make it more subtle
            }}
        />
    )
}


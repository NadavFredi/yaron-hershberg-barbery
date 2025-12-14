// Standalone TimeAxis Component
// Replicates the time axis structure from commit e77eef1a8b9d78f608e26a09cef58f1ad6f56414

import { useMemo } from "react"
import { useAppSelector } from "@/store/hooks"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { buildTimeline } from "../managerSchedule.module"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export function TimeAxis() {
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
  const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
  const formattedDate = format(selectedDate, "yyyy-MM-dd")
  const intervalMinutes = useAppSelector((state) => state.managerSchedule.intervalMinutes)
  const pixelsPerMinuteScale = useAppSelector((state) => state.managerSchedule.pixelsPerMinuteScale)

  // Fetch schedule data
  const { data } = useGetManagerScheduleQuery({
    date: formattedDate,
    serviceType: "both",
  })

  // Build timeline (business hours are now included in data and will be used automatically)
  const timeline = useMemo(() => {
    if (!data) {
      return null
    }
    return buildTimeline(selectedDate, data, intervalMinutes, pixelsPerMinuteScale, [])
  }, [selectedDate, data, intervalMinutes, pixelsPerMinuteScale])

  if (!timeline) {
    return null
  }

  return (
    <div className="flex flex-col gap-2" dir="ltr">
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white" style={{ height: timeline.height }}>
        {/* Background slots with alternating colors */}
        <div className="absolute inset-0 pointer-events-none">
          {timeline.slots.map((slot, index) => (
            <div
              key={`timeline-slot-${slot.offset}`}
              className={cn("absolute left-0 right-0 border-b border-slate-100", {
                "bg-slate-50/70": index % 2 === 0,
              })}
              style={{ top: slot.offset, height: slot.height }}
            />
          ))}
        </div>

        {/* Hour markers (dashed lines) */}
        <div className="absolute inset-0 pointer-events-none">
          {timeline.hourMarkers.map((marker) => (
            <div key={`timeline-marker-${marker.label}-${marker.offset}`} className="absolute left-0 right-0" style={{ top: marker.offset }}>
              <div className="absolute left-0 right-0 border-t border-dashed border-slate-300" />
            </div>
          ))}
        </div>

        {/* Time labels */}
        <div className="absolute inset-0 pointer-events-none">
          {timeline.slots.map((slot) => {
            const estimatedLabelHeight = 18
            const labelCenter = slot.offset + slot.height / 2
            const minTop = 4
            const maxTop = Math.max(minTop, timeline.height - estimatedLabelHeight - 4)
            const baseTop = labelCenter - estimatedLabelHeight / 2
            const clampedTop = Math.min(Math.max(baseTop, minTop), maxTop)
            return (
              <div
                key={`timeline-label-${slot.label}-${slot.offset}`}
                className="absolute inset-x-1 flex items-center justify-center rounded bg-white/90 px-1 py-0.5 text-[11px] font-medium text-gray-600"
                style={{ top: clampedTop }}
              >
                {slot.label}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


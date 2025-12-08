import { parseISO, format } from "date-fns"
import { GripVertical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ManagerWaitlistEntry } from "./useWaitingList"

const WAITLIST_SCOPE_META: Record<
  "grooming" | "daycare" | "both",
  { label: string; badgeClass: string }
> = {
  grooming: {
    label: "מספרה",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-100",
  },
  daycare: {
    label: "גן",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  both: {
    label: "מספרה + גן",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-100",
  },
}

interface WaitlistCardProps {
  entry: ManagerWaitlistEntry
  isDragging?: boolean
  onClick?: () => void
}

export function WaitlistCard({ entry, isDragging = false, onClick }: WaitlistCardProps) {
  const scopeMeta = WAITLIST_SCOPE_META[entry.serviceScope] ?? WAITLIST_SCOPE_META.grooming
  const startDate = entry.startDate ? parseISO(entry.startDate) : null
  const endDate = entry.endDate ? parseISO(entry.endDate) : null
  const dateLabel =
    startDate && !Number.isNaN(startDate.getTime())
      ? `${format(startDate, "dd/MM")}${endDate && !Number.isNaN(endDate.getTime()) ? ` - ${format(endDate, "dd/MM")}` : ""}`
      : ""

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-3 text-right shadow-sm transition hover:border-blue-300",
        isDragging ? "ring-2 ring-blue-200" : "cursor-pointer"
      )}
      onClick={(event) => {
        event.stopPropagation()
        if (isDragging) return
        onClick?.()
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
          <GripVertical className="h-3.5 w-3.5 text-slate-300" />
          <span>{entry.dogName}</span>
        </div>
        <Badge className={cn("text-[11px] font-medium border", scopeMeta.badgeClass)}>
          {scopeMeta.label}
        </Badge>
      </div>
      <div className="mt-1 text-xs text-gray-600">{entry.customerName || "לקוח לא ידוע"}</div>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-gray-500">
        {dateLabel && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5">{dateLabel}</span>
        )}
        {entry.customerTypeName && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
            {entry.customerTypeName}
          </span>
        )}
        {entry.breedName && (
          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-600">
            {entry.breedName}
          </span>
        )}
      </div>
      {entry.dogCategories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.dogCategories.slice(0, 2).map((category) => (
            <span
              key={category.id}
              className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"
            >
              {category.name}
            </span>
          ))}
          {entry.dogCategories.length > 2 && (
            <span className="text-[11px] text-gray-400">+{entry.dogCategories.length - 2}</span>
          )}
        </div>
      )}
      {entry.notes && (
        <p className="mt-2 line-clamp-2 text-xs text-slate-500">{entry.notes}</p>
      )}
    </div>
  )
}


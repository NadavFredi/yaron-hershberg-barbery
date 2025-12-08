import { useMemo } from "react"
import { addDays, format } from "date-fns"
import { he } from "date-fns/locale"
import { CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setSelectedDate } from "@/store/slices/managerScheduleSlice"
import { useDateNavigation } from "./useDateNavigation"

export function DateNavigation() {
    const dispatch = useAppDispatch()
    const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
    // Use useMemo to create stable Date reference - only recreate when ISO string changes
    const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
    
    // Initialize URL sync
    useDateNavigation()

    const formattedCurrentDateLabel = useMemo(
        () => format(selectedDate, "EEEE, d MMMM yyyy", { locale: he }),
        [selectedDateStr]
    )

    return (
        <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                {formattedCurrentDateLabel}
            </div>
            <div className="flex items-center gap-1 rounded border border-slate-200 bg-white/95 px-1 py-0.5 shadow-sm">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100"
                    onClick={() => dispatch(setSelectedDate(addDays(selectedDate, -7)))}
                    title="שבוע קודם"
                    aria-label="שבוע קודם"
                >
                    <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100"
                    onClick={() => dispatch(setSelectedDate(addDays(selectedDate, -1)))}
                    title="יום קודם"
                    aria-label="יום קודם"
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 rounded border-blue-200 bg-blue-50/80 px-2 text-[12px] font-semibold text-blue-700 hover:bg-blue-100"
                    onClick={() => dispatch(setSelectedDate(new Date()))}
                    title="חזרה להיום"
                    aria-label="חזרה להיום"
                >
                    <CalendarIcon className="ml-1 h-3 w-3" />
                    היום
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100"
                    onClick={() => dispatch(setSelectedDate(addDays(selectedDate, 1)))}
                    title="יום הבא"
                    aria-label="יום הבא"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100"
                    onClick={() => dispatch(setSelectedDate(addDays(selectedDate, 7)))}
                    title="שבוע הבא"
                    aria-label="שבוע הבא"
                >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )
}


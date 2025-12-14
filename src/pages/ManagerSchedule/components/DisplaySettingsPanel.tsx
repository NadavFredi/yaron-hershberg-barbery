import { startOfMonth, format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SmallCalendar } from "@/components/ui/small-calendar"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setIntervalMinutes,
  setPixelsPerMinuteScale,
  setSelectedDate,
  setCalendarMonth,
} from "@/store/slices/managerScheduleSlice"

export function DisplaySettingsPanel() {
  const dispatch = useAppDispatch()
  const intervalMinutes = useAppSelector((state) => state.managerSchedule.intervalMinutes)
  const pixelsPerMinuteScale = useAppSelector((state) => state.managerSchedule.pixelsPerMinuteScale)
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
  const calendarMonthStr = useAppSelector((state) => state.managerSchedule.calendarMonth)

  const selectedDate = new Date(selectedDateStr)
  const calendarMonth = new Date(calendarMonthStr)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">הגדרות תצוגה</h3>
      <div className="space-y-4">

        <div className="rounded-lg border border-slate-200 bg-white py-4 px-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">תאריך</h3>
            <button
              type="button"
              onClick={() => dispatch(setSelectedDate(new Date()))}
              className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              היום
            </button>
          </div>
          <div className="flex w-full items-center justify-center">
            <SmallCalendar
              mode="single"
              month={calendarMonth}
              onMonthChange={(month) => dispatch(setCalendarMonth(startOfMonth(month)))}
              selected={selectedDate}
              onSelect={(date) => date && dispatch(setSelectedDate(date))}
              initialFocus
            />
          </div>
          <div className="mt-2 text-right text-[11px] text-gray-500">
            {format(selectedDate, "dd/MM/yyyy")}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm text-gray-600">מרווח זמן</label>
          <Select
            value={String(intervalMinutes)}
            onValueChange={(value) => dispatch(setIntervalMinutes(Number(value)))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="בחר מרווח" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">כל 15 דקות</SelectItem>
              <SelectItem value="30">כל 30 דקות</SelectItem>
              <SelectItem value="60">כל 60 דקות</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-600">גודל תורים</label>
          <Select
            value={String(pixelsPerMinuteScale)}
            onValueChange={(value) => dispatch(setPixelsPerMinuteScale(Number(value)))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="בחר גודל" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">קטן מאוד</SelectItem>
              <SelectItem value="2">קטן</SelectItem>
              <SelectItem value="3">בינוני</SelectItem>
              <SelectItem value="4">גדול</SelectItem>
              <SelectItem value="5">גדול מאוד</SelectItem>
              <SelectItem value="6">ענק</SelectItem>
              <SelectItem value="7">ענק מאוד</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>
    </div>
  )
}


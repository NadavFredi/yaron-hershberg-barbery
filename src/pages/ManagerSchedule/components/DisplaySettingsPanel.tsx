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
import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"
import { TimePickerInput } from "@/components/TimePickerInput"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabaseApi } from "@/store/services/supabaseApi"

export function DisplaySettingsPanel() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const intervalMinutes = useAppSelector((state) => state.managerSchedule.intervalMinutes)
  const pixelsPerMinuteScale = useAppSelector((state) => state.managerSchedule.pixelsPerMinuteScale)
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
  const calendarMonthStr = useAppSelector((state) => state.managerSchedule.calendarMonth)

  const selectedDate = new Date(selectedDateStr)
  const calendarMonth = new Date(calendarMonthStr)

  const [calendarStartTime, setCalendarStartTime] = useState<string>("08:00")
  const [calendarEndTime, setCalendarEndTime] = useState<string>("20:00")
  const [isLoadingCalendarHours, setIsLoadingCalendarHours] = useState(true)
  const [isSavingCalendarHours, setIsSavingCalendarHours] = useState(false)
  const [calendarSettingsId, setCalendarSettingsId] = useState<string | null>(null)

  const loadCalendarHours = useCallback(async () => {
    try {
      setIsLoadingCalendarHours(true)
      const { data, error } = await supabase
        .from("calendar_settings")
        .select("id, calendar_start_time, calendar_end_time")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      if (data) {
        setCalendarSettingsId(data.id)
        if (data.calendar_start_time) {
          const startTimeStr = typeof data.calendar_start_time === "string"
            ? data.calendar_start_time.substring(0, 5)
            : "08:00"
          setCalendarStartTime(startTimeStr)
        }
        if (data.calendar_end_time) {
          const endTimeStr = typeof data.calendar_end_time === "string"
            ? data.calendar_end_time.substring(0, 5)
            : "20:00"
          setCalendarEndTime(endTimeStr)
        }
      }
    } catch (error) {
      console.error("[DisplaySettingsPanel] Failed to load calendar hours:", error)
    } finally {
      setIsLoadingCalendarHours(false)
    }
  }, [])

  useEffect(() => {
    void loadCalendarHours()
  }, [loadCalendarHours])

  const handleSaveCalendarHours = async () => {
    const startTimeFormatted = `${calendarStartTime}:00`
    const endTimeFormatted = `${calendarEndTime}:00`

    setIsSavingCalendarHours(true)
    try {
      if (calendarSettingsId) {
        const { error } = await supabase
          .from("calendar_settings")
          .update({
            calendar_start_time: startTimeFormatted,
            calendar_end_time: endTimeFormatted,
          })
          .eq("id", calendarSettingsId)

        if (error) {
          throw error
        }
      } else {
        const { data, error } = await supabase
          .from("calendar_settings")
          .insert({
            calendar_start_time: startTimeFormatted,
            calendar_end_time: endTimeFormatted,
          })
          .select("id")
          .maybeSingle()

        if (error) {
          throw error
        }

        if (data?.id) {
          setCalendarSettingsId(data.id)
        }
      }

      toast({
        title: "הצלחה",
        description: "שעות התצוגה נשמרו בהצלחה.",
      })

      // Invalidate the manager schedule query to refresh the timeline
      // This will cause the schedule to refetch with the new calendar window hours
      dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule"]))
      
      // Reload the page to ensure the timeline is rebuilt with new hours
      // This is necessary because buildTimeline needs to recalculate with the new data
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error("[DisplaySettingsPanel] Failed to save calendar hours:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור את שעות התצוגה.",
        variant: "destructive",
      })
    } finally {
      setIsSavingCalendarHours(false)
    }
  }

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
              className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10/80 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
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

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1 h-auto py-2 flex-col justify-start items-start"
              onClick={() => {
                if (!isLoadingCalendarHours) {
                  void loadCalendarHours()
                }
              }}
            >
              <div className="flex gap-1 w-full">
                <Clock className="h-3 w-3 flex-shrink-0" />
                {isLoadingCalendarHours ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    טוען...
                  </>
                ) : (
                  <span className="leading-tight">הגדר שעות תצוגה</span>
                )}
              </div>
              {!isLoadingCalendarHours && calendarStartTime && calendarEndTime && (
                <span className="text-gray-500 text-[10px] leading-tight">
                  ({calendarStartTime} - {calendarEndTime})
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" dir="rtl" align="start">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">שעות תצוגה</h4>
                <p className="text-xs text-gray-500 mb-4">
                  הגדרה זו משפיעה רק על התצוגה של המנהלים ולא על הלקוחות.
                </p>
              </div>

              {isLoadingCalendarHours ? (
                <div className="flex items-center justify-center py-4 text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  <span className="text-xs">טוען...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700 text-right block">שעת התחלה</Label>
                    <TimePickerInput
                      value={calendarStartTime}
                      onChange={(value) => setCalendarStartTime(value)}
                      intervalMinutes={15}
                      className="w-full text-right"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700 text-right block">שעת סיום</Label>
                    <TimePickerInput
                      value={calendarEndTime}
                      onChange={(value) => setCalendarEndTime(value)}
                      intervalMinutes={15}
                      className="w-full text-right"
                    />
                  </div>
                  <Button
                    onClick={handleSaveCalendarHours}
                    disabled={isSavingCalendarHours}
                    size="sm"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {isSavingCalendarHours && <Loader2 className="h-3 w-3 animate-spin" />}
                    <Save className="h-3 w-3" />
                    שמור שינויים
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

      </div>
    </div>
  )
}


import { useCallback, useEffect, useMemo, useState } from "react"
import { differenceInCalendarDays, differenceInCalendarMonths, addDays, addMonths, startOfDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { AlertTriangle, Loader2, Save } from "lucide-react"
import { TimePickerInput } from "@/components/TimePickerInput"

interface CalendarSettingsRow {
    id: string
    open_days_ahead: number
    calendar_start_time?: string | null
    calendar_end_time?: string | null
}

const DEFAULT_DAYS_AHEAD = 30

function normalizeDaysAhead(value: number): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_DAYS_AHEAD
    }
    return Math.max(0, Math.round(value))
}

function formatHebrewWindow(value: number) {
    if (value <= 0) {
        return {
            description: "ללא פתיחת תורים (0 ימים קדימה)",
            targetDateLabel: "אין תאריך זמין להזמנה",
            isZero: true,
        }
    }

    const today = startOfDay(new Date())
    const target = addDays(today, Math.max(0, value))

    let months = differenceInCalendarMonths(target, today)
    if (months < 0) {
        months = 0
    }
    let anchor = addMonths(today, months)
    if (anchor > target) {
        months = Math.max(0, months - 1)
        anchor = addMonths(today, months)
    }
    let days = differenceInCalendarDays(target, anchor)
    if (days < 0) {
        days = 0
    }

    const parts: string[] = []
    if (months > 0) {
        parts.push(months === 1 ? "חודש אחד" : `${months} חודשים`)
    }
    if (days > 0) {
        parts.push(days === 1 ? "יום אחד" : `${days} ימים`)
    }

    const joined = parts.length > 0 ? parts.join(" ו-") : "יום אחד"
    const formattedDate = new Intl.DateTimeFormat("he-IL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(target)

    return {
        description: joined,
        isZero: false,
        targetDateLabel: formattedDate,
    }
}

export function SettingsCalendarWindowSection() {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [settingsRow, setSettingsRow] = useState<CalendarSettingsRow | null>(null)
    const [daysAhead, setDaysAhead] = useState<number>(DEFAULT_DAYS_AHEAD)
    const [calendarStartTime, setCalendarStartTime] = useState<string>("08:00")
    const [calendarEndTime, setCalendarEndTime] = useState<string>("20:00")

    const loadSettings = useCallback(async () => {
        console.log("[SettingsCalendarWindowSection] Loading calendar settings...")
        try {
            setIsLoading(true)
            const { data, error } = await supabase
                .from("calendar_settings")
                .select("id, open_days_ahead, calendar_start_time, calendar_end_time")
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle<CalendarSettingsRow>()

            if (error && error.code !== "PGRST116") {
                throw error
            }

            if (data) {
                const normalized = normalizeDaysAhead(data.open_days_ahead)
                setSettingsRow({ 
                    id: data.id, 
                    open_days_ahead: normalized,
                    calendar_start_time: data.calendar_start_time,
                    calendar_end_time: data.calendar_end_time,
                })
                setDaysAhead(normalized)
                
                // Extract HH:mm from TIME format (HH:mm:ss)
                if (data.calendar_start_time) {
                    const startTimeStr = typeof data.calendar_start_time === "string" 
                        ? data.calendar_start_time.substring(0, 5) 
                        : "08:00"
                    setCalendarStartTime(startTimeStr)
                } else {
                    setCalendarStartTime("08:00")
                }
                
                if (data.calendar_end_time) {
                    const endTimeStr = typeof data.calendar_end_time === "string" 
                        ? data.calendar_end_time.substring(0, 5) 
                        : "20:00"
                    setCalendarEndTime(endTimeStr)
                } else {
                    setCalendarEndTime("20:00")
                }
                
                console.log("[SettingsCalendarWindowSection] Loaded existing row:", data)
            } else {
                console.log("[SettingsCalendarWindowSection] No calendar_settings row found, creating default...")
                const { data: inserted, error: insertError } = await supabase
                    .from("calendar_settings")
                    .insert({ 
                        open_days_ahead: DEFAULT_DAYS_AHEAD,
                        calendar_start_time: "08:00:00",
                        calendar_end_time: "20:00:00",
                    })
                    .select("id, open_days_ahead, calendar_start_time, calendar_end_time")
                    .maybeSingle<CalendarSettingsRow>()

                if (insertError) {
                    throw insertError
                }

                if (inserted) {
                    const normalized = normalizeDaysAhead(inserted.open_days_ahead)
                    setSettingsRow({ 
                        id: inserted.id, 
                        open_days_ahead: normalized,
                        calendar_start_time: inserted.calendar_start_time,
                        calendar_end_time: inserted.calendar_end_time,
                    })
                    setDaysAhead(normalized)
                    
                    if (inserted.calendar_start_time) {
                        const startTimeStr = typeof inserted.calendar_start_time === "string" 
                            ? inserted.calendar_start_time.substring(0, 5) 
                            : "08:00"
                        setCalendarStartTime(startTimeStr)
                    }
                    
                    if (inserted.calendar_end_time) {
                        const endTimeStr = typeof inserted.calendar_end_time === "string" 
                            ? inserted.calendar_end_time.substring(0, 5) 
                            : "20:00"
                        setCalendarEndTime(endTimeStr)
                    }
                    
                    console.log("[SettingsCalendarWindowSection] Inserted default row:", inserted)
                } else {
                    setSettingsRow(null)
                    setDaysAhead(DEFAULT_DAYS_AHEAD)
                    setCalendarStartTime("08:00")
                    setCalendarEndTime("20:00")
                }
            }
        } catch (error) {
            console.error("[SettingsCalendarWindowSection] Failed to load calendar settings:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את טווח פתיחת היומן. נסה שוב מאוחר יותר.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }, [toast])

    useEffect(() => {
        void loadSettings()
    }, [loadSettings])

    const windowInfo = useMemo(() => formatHebrewWindow(daysAhead), [daysAhead])

    async function handleSave() {
        console.log(
            `[SettingsCalendarWindowSection] Saving calendar settings with open_days_ahead=${daysAhead}, calendar_start_time=${calendarStartTime}, calendar_end_time=${calendarEndTime}, rowId=${settingsRow?.id}`,
        )
        const normalized = normalizeDaysAhead(daysAhead)
        if (normalized !== daysAhead) {
            setDaysAhead(normalized)
        }

        // Convert HH:mm to HH:mm:ss format for TIME column
        const startTimeFormatted = `${calendarStartTime}:00`
        const endTimeFormatted = `${calendarEndTime}:00`

        setIsSaving(true)
        try {
            if (settingsRow?.id) {
                const { error } = await supabase
                    .from("calendar_settings")
                    .update({ 
                        open_days_ahead: normalized,
                        calendar_start_time: startTimeFormatted,
                        calendar_end_time: endTimeFormatted,
                    })
                    .eq("id", settingsRow.id)

                if (error) {
                    throw error
                }

                console.log("[SettingsCalendarWindowSection] Updated existing calendar_settings row")
            } else {
                const { data, error } = await supabase
                    .from("calendar_settings")
                    .insert({ 
                        open_days_ahead: normalized,
                        calendar_start_time: startTimeFormatted,
                        calendar_end_time: endTimeFormatted,
                    })
                    .select("id, open_days_ahead, calendar_start_time, calendar_end_time")
                    .maybeSingle<CalendarSettingsRow>()

                if (error) {
                    throw error
                }

                if (data) {
                    setSettingsRow({ 
                        id: data.id, 
                        open_days_ahead: normalizeDaysAhead(data.open_days_ahead),
                        calendar_start_time: data.calendar_start_time,
                        calendar_end_time: data.calendar_end_time,
                    })
                }

                console.log("[SettingsCalendarWindowSection] Inserted new calendar_settings row")
            }

            toast({
                title: "הצלחה",
                description: "הגדרות היומן נשמרו בהצלחה.",
            })

            await loadSettings()
        } catch (error) {
            console.error("[SettingsCalendarWindowSection] Failed to save calendar settings:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את טווח פתיחת היומן.",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const hasChanges = settingsRow 
        ? (settingsRow.open_days_ahead !== normalizeDaysAhead(daysAhead) ||
           (settingsRow.calendar_start_time && typeof settingsRow.calendar_start_time === "string" 
               ? settingsRow.calendar_start_time.substring(0, 5) !== calendarStartTime
               : calendarStartTime !== "08:00") ||
           (settingsRow.calendar_end_time && typeof settingsRow.calendar_end_time === "string"
               ? settingsRow.calendar_end_time.substring(0, 5) !== calendarEndTime
               : calendarEndTime !== "20:00"))
        : true

    return (
        <div className="space-y-4" dir="rtl">
            <Card className="border-primary/20 shadow-sm">
                <CardContent className="space-y-4 pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1 text-right">
                            <h3 className="text-xl font-bold text-gray-900">פתיחת יומן מראש</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                קבע כמה ימים מראש הלקוחות יוכלו לראות ולבחור תורים פתוחים. ברירת המחדל היא 30 ימים, וניתן להזין גם
                                0 כדי לחסום הזמנות חדשות.
                            </p>
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={isSaving || !hasChanges}
                            className="flex items-center gap-2 self-start"
                        >
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                            <Save className="h-4 w-4" />
                            שמור שינויים
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-6 text-gray-600">
                            <Loader2 className="h-5 w-5 animate-spin ml-2" />
                            <span>טוען את הגדרות היומן...</span>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                <div className="space-y-2">
                                    <Label htmlFor="daysAhead" className="text-right block text-sm font-semibold text-gray-700">
                                        מספר ימים קדימה
                                    </Label>
                                    <Input
                                        id="daysAhead"
                                        type="number"
                                        min={0}
                                        value={daysAhead}
                                        onChange={(event) => setDaysAhead(normalizeDaysAhead(Number(event.target.value)))}
                                        className="text-right"
                                    />
                                    <p className="text-xs text-muted-foreground text-right">
                                        אפשר לבחור כל מספר שלם החל מ־0. ערך 0 יחסום הזמנות חדשות לגמרי.
                                    </p>
                                </div>

                                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-sm text-right leading-relaxed">
                                    <p className="font-semibold text-primary">
                                        {windowInfo.isZero
                                            ? "הלקוחות אינם רואים תורים פתוחים (0 ימים קדימה)."
                                            : `הלקוחות יראו תורים עד ${windowInfo.description}.`}
                                    </p>
                                    <p className="text-gray-700 mt-2">
                                        התאריך האחרון שייפתח כרגע להזמנה:{" "}
                                        <span className="font-medium text-gray-900">
                                            {windowInfo.targetDateLabel}
                                        </span>
                                    </p>
                                    <p className="text-gray-600 mt-2 text-xs">
                                        ההגדרה משפיעה ומגבילה את התורים המוצגים
                                        בהתאם.
                                    </p>
                                </div>
                            </div>

                            {windowInfo.isZero && (
                                <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-right text-sm text-red-700">
                                    <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">שימו לב</p>
                                        <p>
                                            קביעת הערך ל־0 תחסום את הלקוחות מלהזמין תורים חדשים. ודאו שזה רצוי לפני שמירת ההגדרה.
                                        </p>
                                    </div>
                                </div>
                            )}


                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="border-primary/20 shadow-sm">
                <CardContent className="space-y-4 pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1 text-right">
                            <h3 className="text-xl font-bold text-gray-900">שעות תצוגה בלוח המנהל</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                קבע את השעות שיוצגו בלוח המנהל. הגדרה זו משפיעה רק על התצוגה של המנהלים ולא על הלקוחות.
                            </p>
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={isSaving || !hasChanges}
                            className="flex items-center gap-2 self-start"
                        >
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                            <Save className="h-4 w-4" />
                            שמור שינויים
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-6 text-gray-600">
                            <Loader2 className="h-5 w-5 animate-spin ml-2" />
                            <span>טוען את הגדרות היומן...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <div className="space-y-2">
                                <Label htmlFor="calendarStartTime" className="text-right block text-sm font-semibold text-gray-700">
                                    שעת התחלה
                                </Label>
                                <TimePickerInput
                                    id="calendarStartTime"
                                    value={calendarStartTime}
                                    onChange={(value) => setCalendarStartTime(value)}
                                    intervalMinutes={15}
                                    className="w-full text-right"
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    השעה שבה יתחיל לוח המנהל להציג את התורים.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="calendarEndTime" className="text-right block text-sm font-semibold text-gray-700">
                                    שעת סיום
                                </Label>
                                <TimePickerInput
                                    id="calendarEndTime"
                                    value={calendarEndTime}
                                    onChange={(value) => setCalendarEndTime(value)}
                                    intervalMinutes={15}
                                    className="w-full text-right"
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    השעה שבה יסתיים לוח המנהל להציג את התורים.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}


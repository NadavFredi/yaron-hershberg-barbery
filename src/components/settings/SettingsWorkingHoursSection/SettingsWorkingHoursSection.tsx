import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Save, Plus, Trash2 } from "lucide-react"
import { TimePickerInput } from "@/components/TimePickerInput"
import { useBusinessHours } from "./SettingsWorkingHoursSection.module"
import { SettingsCalendarWindowSection } from "@/components/settings/SettingsCalendarWindowSection/SettingsCalendarWindowSection"


export function SettingsWorkingHoursSection() {
    const { dayShifts, setDayShifts, isLoading, isSaving, saveHours, deleteShift, deleteDay, WEEKDAYS } = useBusinessHours()

    const handleTimeChange = (weekday: string, shiftIndex: number, field: "open_time" | "close_time", value: string) => {
        setDayShifts((prev) =>
            prev.map((dayShift) => {
                if (dayShift.weekday === weekday) {
                    const newShifts = [...dayShift.shifts]
                    if (newShifts[shiftIndex]) {
                        newShifts[shiftIndex] = { ...newShifts[shiftIndex], [field]: value }
                    }
                    return { ...dayShift, shifts: newShifts }
                }
                return dayShift
            })
        )
    }

    const handleAddShift = (weekday: string) => {
        setDayShifts((prev) =>
            prev.map((dayShift) => {
                if (dayShift.weekday === weekday) {
                    const maxShiftOrder =
                        dayShift.shifts.length > 0
                            ? Math.max(...dayShift.shifts.map((s) => s.shift_order || 0))
                            : -1

                    const newShift: BusinessHour = {
                        weekday,
                        open_time: "09:00",
                        close_time: "17:00",
                        shift_order: maxShiftOrder + 1,
                    }

                    return { ...dayShift, shifts: [...dayShift.shifts, newShift] }
                }
                return dayShift
            })
        )
    }

    const handleDeleteShift = (weekday: string, shiftIndex: number) => {
        deleteShift(weekday, shiftIndex)
    }

    const handleDeleteDay = async (weekday: string) => {
        await deleteDay(weekday)
    }

    const handleSave = async () => {
        try {
            await saveHours()
            // Reload to get IDs for newly created shifts
            // Note: The hook will handle reloading automatically via loadHours
        } catch (error) {
            // Error is already handled in the hook
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2">טוען שעות עבודה...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <SettingsCalendarWindowSection />
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">שעות עבודה גלובליות</h2>
                    <p className="text-gray-600 mt-1">הגדר את שעות העבודה הגלובליות לכל ימי השבוע</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Save className="h-4 w-4" />
                    שמור שינויים
                </Button>
            </div>

            <div className="border rounded-lg">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] [direction:ltr] custom-scrollbar">
                    <div className="[direction:rtl]">
                        <div className="relative w-full">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="sticky top-0 z-20 [&_tr]:border-b bg-background">
                                    <tr className="border-b transition-colors bg-[hsl(228_36%_95%)]">
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold w-32">יום בשבוע</th>
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold">משמרות</th>
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold w-24">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {dayShifts.map((dayShift) => {
                                        const dayLabel = WEEKDAYS.find((d) => d.value === dayShift.weekday)?.label || dayShift.weekday
                                        const hasShifts = dayShift.shifts.length > 0

                                        return (
                                            <tr key={dayShift.weekday} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                <td className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 font-medium">
                                                    <div className="text-center">{dayLabel}</div>
                                                </td>
                                                <td className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0">
                                        {hasShifts ? (
                                            <div className="space-y-3">
                                                {dayShift.shifts.map((shift, shiftIndex) => (
                                                    <div
                                                        key={shiftIndex}
                                                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Label className="text-sm text-gray-600 w-20 text-left">
                                                                פתיחה:
                                                            </Label>
                                                            <TimePickerInput
                                                                value={shift.open_time}
                                                                onChange={(value) =>
                                                                    handleTimeChange(
                                                                        dayShift.weekday,
                                                                        shiftIndex,
                                                                        "open_time",
                                                                        value
                                                                    )
                                                                }
                                                                intervalMinutes={15}
                                                                className="w-32"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Label className="text-sm text-gray-600 w-20 text-left">
                                                                סגירה:
                                                            </Label>
                                                            <TimePickerInput
                                                                value={shift.close_time}
                                                                onChange={(value) =>
                                                                    handleTimeChange(
                                                                        dayShift.weekday,
                                                                        shiftIndex,
                                                                        "close_time",
                                                                        value
                                                                    )
                                                                }
                                                                intervalMinutes={15}
                                                                className="w-32"
                                                            />
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleDeleteShift(dayShift.weekday, shiftIndex)
                                                            }
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            title="מחק משמרת"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-gray-400 text-sm py-2">
                                                אין שעות עבודה עבור יום זה
                                            </div>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleAddShift(dayShift.weekday)}
                                            className="mt-2 flex items-center gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            הוסף משמרת
                                        </Button>
                                                </td>
                                                <td className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0">
                                                    <div className="flex justify-center">
                                                        {hasShifts && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteDay(dayShift.weekday)}
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                title="מחק את כל המשמרות ליום זה"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


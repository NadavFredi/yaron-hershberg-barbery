import { useEffect, useState } from "react"
import { Loader2, Save, Bell, Plus, Trash2, Check, X, Copy, CopyCheck } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import AdminLayout from "@/components/layout/AdminLayout"
import { cn } from "@/lib/utils"

interface ReminderRow {
    id: string // "new-{timestamp}" for new rows, reminder.id for existing
    dayType: "regular" | "sunday"
    isActive: boolean
    reminderDays: number | null
    reminderHours: number | null
    flowId: string
    description: string
    unit: "days" | "hours"
    displayOrder: number
    originalReminder?: {
        id: string
        day_type: string
        is_active: boolean
        reminder_days: number | null
        reminder_hours: number | null
        flow_id: string
        description: string | null
        display_order: number
    }
}

interface ReminderSettings {
    id: string
    is_enabled: boolean
}

export default function AppointmentsReminders() {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [settings, setSettings] = useState<ReminderSettings | null>(null)
    const [isEnabled, setIsEnabled] = useState(false)
    const [regularRows, setRegularRows] = useState<ReminderRow[]>([])
    const [sundayRows, setSundayRows] = useState<ReminderRow[]>([])

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setIsLoading(true)
        try {
            // Load settings
            const { data: settingsData, error: settingsError } = await supabase
                .from("appointment_reminder_settings")
                .select("*")
                .maybeSingle<ReminderSettings>()

            if (settingsError) {
                console.error("[AppointmentsReminders] Error loading settings:", settingsError)
                throw settingsError
            }

            if (settingsData) {
                setSettings(settingsData)
                setIsEnabled(settingsData.is_enabled)
            } else {
                // Create default settings if none exist
                const { data: newSettings } = await supabase
                    .from("appointment_reminder_settings")
                    .insert({ is_enabled: false })
                    .select()
                    .single<ReminderSettings>()

                if (newSettings) {
                    setSettings(newSettings)
                    setIsEnabled(false)
                }
            }

            // Load reminders
            const { data: remindersData, error: remindersError } = await supabase
                .from("appointment_reminders")
                .select("*")

            if (remindersError) {
                console.error("[AppointmentsReminders] Error loading reminders:", remindersError)
                throw remindersError
            }

            const regular: ReminderRow[] = []
            const sunday: ReminderRow[] = []

            remindersData?.forEach((reminder) => {
                const isDays = reminder.reminder_days !== null
                const value = isDays ? reminder.reminder_days : reminder.reminder_hours
                const unit: "days" | "hours" = isDays ? "days" : "hours"

                const row: ReminderRow = {
                    id: reminder.id,
                    dayType: reminder.day_type as "regular" | "sunday",
                    isActive: reminder.is_active,
                    reminderDays: reminder.reminder_days,
                    reminderHours: reminder.reminder_hours,
                    flowId: reminder.flow_id || "",
                    description: reminder.description || "",
                    unit,
                    displayOrder: reminder.display_order,
                    originalReminder: {
                        id: reminder.id,
                        day_type: reminder.day_type,
                        is_active: reminder.is_active,
                        reminder_days: reminder.reminder_days,
                        reminder_hours: reminder.reminder_hours,
                        flow_id: reminder.flow_id,
                        description: reminder.description || null,
                        display_order: reminder.display_order,
                    },
                }

                if (reminder.day_type === "regular") {
                    regular.push(row)
                } else {
                    sunday.push(row)
                }
            })

            // Sort by hours before appointment (earliest reminders first)
            const sortByHours = (a: ReminderRow, b: ReminderRow) => {
                const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
                const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
                return hoursB - hoursA // Sort descending (most hours first = earliest reminders first)
            }

            setRegularRows(regular.sort(sortByHours))
            setSundayRows(sunday.sort(sortByHours))
        } catch (error) {
            console.error("[AppointmentsReminders] Failed to load data:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את הגדרות התזכורות",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const addRow = (dayType: "regular" | "sunday") => {
        const newRow: ReminderRow = {
            id: `new-${Date.now()}-${Math.random()}`,
            dayType,
            isActive: true,
            reminderDays: null,
            reminderHours: null,
            flowId: "",
            description: "",
            unit: "days",
            displayOrder: dayType === "regular" ? regularRows.length : sundayRows.length,
        }

        if (dayType === "regular") {
            const sorted = [...regularRows, newRow].sort((a, b) => {
                const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
                const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
                return hoursB - hoursA
            })
            setRegularRows(sorted)
        } else {
            const sorted = [...sundayRows, newRow].sort((a, b) => {
                const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
                const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
                return hoursB - hoursA
            })
            setSundayRows(sorted)
        }
    }

    const removeRow = (dayType: "regular" | "sunday", id: string) => {
        if (dayType === "regular") {
            setRegularRows(regularRows.filter((r) => r.id !== id))
        } else {
            setSundayRows(sundayRows.filter((r) => r.id !== id))
        }
    }

    const copyFromOtherTable = (fromDayType: "regular" | "sunday", toDayType: "regular" | "sunday") => {
        const sourceRows = fromDayType === "regular" ? regularRows : sundayRows
        const copiedRows: ReminderRow[] = sourceRows.map((row) => ({
            ...row,
            id: `new-${Date.now()}-${Math.random()}`,
            dayType: toDayType,
            originalReminder: undefined, // Mark as new row
        }))

        const sortByHours = (a: ReminderRow, b: ReminderRow) => {
            const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
            const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
            return hoursB - hoursA
        }

        // Replace completely (don't add)
        if (toDayType === "regular") {
            setRegularRows(copiedRows.sort(sortByHours))
        } else {
            setSundayRows(copiedRows.sort(sortByHours))
        }

        toast({
            title: "הצלחה",
            description: `הועתקו ${copiedRows.length} תזכורות`,
        })
    }

    const duplicateRow = (dayType: "regular" | "sunday", rowId: string) => {
        const sourceRows = dayType === "regular" ? regularRows : sundayRows
        const rowToDuplicate = sourceRows.find((r) => r.id === rowId)

        if (!rowToDuplicate) return

        const duplicatedRow: ReminderRow = {
            ...rowToDuplicate,
            id: `new-${Date.now()}-${Math.random()}`,
            originalReminder: undefined, // Mark as new row
        }

        const sortByHours = (a: ReminderRow, b: ReminderRow) => {
            const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
            const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
            return hoursB - hoursA
        }

        if (dayType === "regular") {
            const combined = [...regularRows, duplicatedRow]
            setRegularRows(combined.sort(sortByHours))
        } else {
            const combined = [...sundayRows, duplicatedRow]
            setSundayRows(combined.sort(sortByHours))
        }

        toast({
            title: "הצלחה",
            description: "השורה שוכפלה",
        })
    }

    const duplicateRowToOtherTable = (fromDayType: "regular" | "sunday", rowId: string) => {
        const sourceRows = fromDayType === "regular" ? regularRows : sundayRows
        const rowToDuplicate = sourceRows.find((r) => r.id === rowId)

        if (!rowToDuplicate) return

        const toDayType: "regular" | "sunday" = fromDayType === "regular" ? "sunday" : "regular"

        const duplicatedRow: ReminderRow = {
            ...rowToDuplicate,
            id: `new-${Date.now()}-${Math.random()}`,
            dayType: toDayType,
            originalReminder: undefined, // Mark as new row
        }

        const sortByHours = (a: ReminderRow, b: ReminderRow) => {
            const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
            const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
            return hoursB - hoursA
        }

        if (toDayType === "regular") {
            const combined = [...regularRows, duplicatedRow]
            setRegularRows(combined.sort(sortByHours))
        } else {
            const combined = [...sundayRows, duplicatedRow]
            setSundayRows(combined.sort(sortByHours))
        }

        toast({
            title: "הצלחה",
            description: "השורה שוכפלה לטבלה האחרת",
        })
    }

    const updateRow = (dayType: "regular" | "sunday", id: string, updates: Partial<ReminderRow>) => {
        const sortByHours = (a: ReminderRow, b: ReminderRow) => {
            const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
            const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
            return hoursB - hoursA // Sort descending (most hours first = earliest reminders first)
        }

        if (dayType === "regular") {
            const updated = regularRows.map((r) => (r.id === id ? { ...r, ...updates } : r))
            setRegularRows(updated.sort(sortByHours))
        } else {
            const updated = sundayRows.map((r) => (r.id === id ? { ...r, ...updates } : r))
            setSundayRows(updated.sort(sortByHours))
        }
    }

    const handleSave = async () => {
        // Validation
        const allRows = [...regularRows, ...sundayRows]
        const activeRows = allRows.filter((r) => r.isActive)

        if (isEnabled && activeRows.length === 0) {
            toast({
                title: "שגיאה",
                description: "יש להגדיר לפחות תזכורת פעילה אחת",
                variant: "destructive",
            })
            return
        }

        for (const row of activeRows) {
            const hasTime = (row.unit === "days" && row.reminderDays !== null && row.reminderDays > 0) ||
                           (row.unit === "hours" && row.reminderHours !== null && row.reminderHours > 0)

            if (!hasTime) {
                toast({
                    title: "שגיאה",
                    description: `יש להגדיר זמן תזכורת עבור כל תזכורת פעילה`,
                    variant: "destructive",
                })
                return
            }

            if (!row.flowId.trim()) {
                toast({
                    title: "שגיאה",
                    description: `יש להזין מזהה זרימה (Flow ID) עבור כל תזכורת פעילה`,
                    variant: "destructive",
                })
                return
            }
        }

        setIsSaving(true)
        try {
            // Update settings
            if (settings?.id) {
                await supabase
                    .from("appointment_reminder_settings")
                    .update({ is_enabled: isEnabled })
                    .eq("id", settings.id)
            } else {
                const { data } = await supabase
                    .from("appointment_reminder_settings")
                    .insert({ is_enabled: isEnabled })
                    .select()
                    .single<ReminderSettings>()

                if (data) {
                    setSettings(data)
                }
            }

            // Save all reminders (calculate display_order based on hours - earliest first)
            const remindersToSave = allRows.map((row, index) => {
                const hoursBefore = row.unit === "days" 
                    ? (row.reminderDays || 0) * 24 
                    : (row.reminderHours || 0)
                
                return {
                    id: row.originalReminder?.id,
                    day_type: row.dayType,
                    is_active: row.isActive,
                    reminder_days: row.unit === "days" && row.reminderDays !== null ? row.reminderDays : null,
                    reminder_hours: row.unit === "hours" && row.reminderHours !== null ? row.reminderHours : null,
                    flow_id: row.flowId.trim(),
                    description: row.description.trim() || null,
                    display_order: index, // Will be set based on sorted order
                }
            })

            // Delete all existing reminders first
            const { error: deleteError } = await supabase
                .from("appointment_reminders")
                .delete()
                .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all

            if (deleteError) {
                console.error("[AppointmentsReminders] Error deleting reminders:", deleteError)
                throw deleteError
            }

            // Insert all reminders
            if (remindersToSave.length > 0) {
                const { error: insertError } = await supabase
                    .from("appointment_reminders")
                    .insert(
                        remindersToSave.map((r) => ({
                            day_type: r.day_type,
                            is_active: r.is_active,
                            reminder_days: r.reminder_days,
                            reminder_hours: r.reminder_hours,
                            flow_id: r.flow_id,
                            description: r.description,
                            display_order: r.display_order,
                        }))
                    )

                if (insertError) {
                    console.error("[AppointmentsReminders] Error inserting reminders:", insertError)
                    throw insertError
                }
            }

            toast({
                title: "הצלחה",
                description: "הגדרות התזכורות נשמרו בהצלחה",
            })

            await loadData()
        } catch (error) {
            console.error("[AppointmentsReminders] Failed to save:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הגדרות התזכורות",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const renderTable = (dayType: "regular" | "sunday", rows: ReminderRow[]) => {
        const title = dayType === "regular" ? "תזכורות לימים רגילים (שני-שישי)" : "תזכורות ליום ראשון"
        const description =
            dayType === "regular"
                ? "הגדר תזכורות לפני תורים בימים רגילים"
                : "הגדר תזכורות לפני תורים ביום ראשון (הגדרות נפרדות)"
        const otherDayType: "regular" | "sunday" = dayType === "regular" ? "sunday" : "regular"
        const otherTitle = otherDayType === "regular" ? "ימים רגילים" : "יום ראשון"

        return (
            <AccordionItem value={dayType} className="border rounded-lg mb-4 px-0">
                <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center justify-between w-full mr-4">
                        <div className="text-right">
                            <div className={cn(
                                "text-lg font-semibold mb-1",
                                dayType === "regular" ? "text-blue-700" : "text-green-700"
                            )}>{title}</div>
                            <div className="text-sm text-muted-foreground">{description}</div>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="px-6 pb-4">
                        <div className="flex items-center justify-between mb-4">
                            <div></div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm(`האם אתה בטוח שברצונך להחליף את כל התזכורות ב${dayType === "regular" ? "ימים רגילים" : "יום ראשון"} בהעתקות מ${otherTitle}?`)) {
                                        copyFromOtherTable(otherDayType, dayType)
                                    }
                                }}
                                disabled={!isEnabled || (otherDayType === "regular" ? regularRows.length === 0 : sundayRows.length === 0)}
                                className="h-8 text-xs"
                            >
                                <Copy className="h-3 w-3 ml-1" />
                                החלף הכל מ{otherTitle}
                            </Button>
                        </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <Table>
                            <TableHeader>
                                <TableRow className={cn(
                                    dayType === "regular" ? "bg-blue-50" : "bg-green-50"
                                )}>
                                    <TableHead className={cn(
                                        "w-20 text-center",
                                        dayType === "regular" ? "text-blue-900" : "text-green-900"
                                    )}>פעיל</TableHead>
                                    <TableHead className={cn(
                                        "w-[140px]",
                                        dayType === "regular" ? "text-blue-900" : "text-green-900"
                                    )}>סוג יחידה</TableHead>
                                    <TableHead className={cn(
                                        "w-[140px]",
                                        dayType === "regular" ? "text-blue-900" : "text-green-900"
                                    )}>זמן לפני התור</TableHead>
                                    <TableHead className={cn(
                                        dayType === "regular" ? "text-blue-900" : "text-green-900"
                                    )}>מזהה זרימה (Flow ID)</TableHead>
                                    <TableHead className={cn(
                                        dayType === "regular" ? "text-blue-900" : "text-green-900"
                                    )}>תיאור (אופציונלי)</TableHead>
                                    <TableHead className={cn(
                                        "w-32 text-center",
                                        dayType === "regular" ? "text-blue-900" : "text-green-900"
                                    )}>פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                                            אין תזכורות. לחץ על "הוסף שורה" כדי להוסיף תזכורת חדשה.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row, index) => {
                                        const hoursBefore = row.unit === "days" 
                                            ? (row.reminderDays || 0) * 24 
                                            : (row.reminderHours || 0)
                                        const rowOtherDayType: "regular" | "sunday" = dayType === "regular" ? "sunday" : "regular"
                                        const rowOtherTitle = rowOtherDayType === "regular" ? "ימים רגילים" : "יום ראשון"
                                        
                                        return (
                                            <TableRow key={row.id} className={cn(!row.originalReminder && "bg-blue-50")}>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={row.isActive}
                                                        onCheckedChange={(checked) =>
                                                            updateRow(dayType, row.id, { isActive: Boolean(checked) })
                                                        }
                                                        disabled={!isEnabled}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={row.unit}
                                                        onValueChange={(value: "days" | "hours") => {
                                                            updateRow(dayType, row.id, {
                                                                unit: value,
                                                                reminderDays: value === "days" ? row.reminderDays || 1 : null,
                                                                reminderHours: value === "hours" ? row.reminderHours || 1 : null,
                                                            })
                                                        }}
                                                        disabled={!isEnabled}
                                                    >
                                                        <SelectTrigger className="h-9 text-right text-sm">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent align="end">
                                                            <SelectItem value="days">ימים</SelectItem>
                                                            <SelectItem value="hours">שעות</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={row.unit === "days" ? row.reminderDays ?? "" : row.reminderHours ?? ""}
                                                        onChange={(e) => {
                                                            const value = e.target.value ? parseInt(e.target.value, 10) : null
                                                            updateRow(dayType, row.id, {
                                                                reminderDays: row.unit === "days" ? value : null,
                                                                reminderHours: row.unit === "hours" ? value : null,
                                                            })
                                                        }}
                                                        placeholder="0"
                                                        dir="rtl"
                                                        disabled={!isEnabled}
                                                        className="h-9 text-sm text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="text"
                                                        value={row.flowId}
                                                        onChange={(e) => updateRow(dayType, row.id, { flowId: e.target.value })}
                                                        placeholder="הזן מזהה זרימה ManyChat"
                                                        dir="rtl"
                                                        disabled={!isEnabled}
                                                        className="h-9 text-sm text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="text"
                                                        value={row.description}
                                                        onChange={(e) => updateRow(dayType, row.id, { description: e.target.value })}
                                                        placeholder="תיאור קצר (אופציונלי)"
                                                        dir="rtl"
                                                        disabled={!isEnabled}
                                                        className="h-9 text-sm text-right"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => duplicateRow(dayType, row.id)}
                                                            disabled={!isEnabled}
                                                            className={cn(
                                                                "h-8 w-8 p-0",
                                                                dayType === "regular" 
                                                                    ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                                                                    : "text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            )}
                                                            title="שכפל שורה באותה טבלה"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => duplicateRowToOtherTable(dayType, row.id)}
                                                            disabled={!isEnabled}
                                                            className={cn(
                                                                "h-8 w-8 p-0",
                                                                dayType === "regular" 
                                                                    ? "text-green-600 hover:text-green-700 hover:bg-green-50" 
                                                                    : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            )}
                                                            title={`שכפל ל${rowOtherTitle}`}
                                                        >
                                                            <CopyCheck className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeRow(dayType, row.id)}
                                                            disabled={!isEnabled}
                                                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                            title="מחק שורה"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => addRow(dayType)}
                        disabled={!isEnabled}
                        className="mt-3 w-full border-dashed h-9 text-sm"
                    >
                        <Plus className="ml-2 h-4 w-4" />
                        הוסף שורה
                    </Button>
                    </div>
                </AccordionContent>
            </AccordionItem>
        )
    }

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-screen" dir="rtl">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="mr-4 text-gray-600">טוען...</span>
                </div>
            </AdminLayout>
        )
    }

    return (
        <AdminLayout>
            <div className="min-h-screen bg-background py-6" dir="rtl">
                <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    <Bell className="h-6 w-6" />
                                    תזכורות תורים
                                </h2>
                                <p className="text-gray-600 mt-1">הגדר תזכורות אוטומטיות ללקוחות לפני תורים</p>
                            </div>
                            <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
                                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                <Save className="h-4 w-4" />
                                שמור שינויים
                            </Button>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>הגדרות כלליות</CardTitle>
                                <CardDescription>הפעל או בטל את מערכת התזכורות</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        id="enable-reminders"
                                        checked={isEnabled}
                                        onCheckedChange={setIsEnabled}
                                    />
                                    <Label 
                                        htmlFor="enable-reminders" 
                                        className="text-base font-medium cursor-pointer"
                                    >
                                        הפעל תזכורות אוטומטיות
                                    </Label>
                                </div>
                            </CardContent>
                        </Card>

                        <Accordion type="multiple" defaultValue={["regular", "sunday"]} className="w-full">
                            {renderTable("regular", regularRows)}
                            {renderTable("sunday", sundayRows)}
                        </Accordion>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}

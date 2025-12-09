import { useEffect, useState } from "react"
import { Loader2, Save, Plus, Trash2, Copy, CopyCheck, X, Check, Star } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface ReminderRow {
    id: string // "new-{timestamp}" for new rows, reminder.id for existing
    dayType: "regular" | "sunday" | "manual"
    isActive: boolean
    reminderDays: number | null
    reminderHours: number | null
    flowId: string
    description: string
    unit: "days" | "hours"
    displayOrder: number
    isManual: boolean
    isDefault: boolean
    specificTime: string | null // Time in HH:mm format (e.g., "18:00")
    sendCondition: "send_only_if_not_approved" | "send_anyway" | null
    originalReminder?: {
        id: string
        day_type: string
        is_active: boolean
        reminder_days: number | null
        reminder_hours: number | null
        flow_id: string
        description: string | null
        display_order: number
        is_manual: boolean
        is_default: boolean
        specific_time: string | null
        send_condition: "send_only_if_not_approved" | "send_anyway" | null
    }
}

interface ReminderSettings {
    id: string
    is_enabled: boolean
}

export default function ReminderSettings() {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [settings, setSettings] = useState<ReminderSettings | null>(null)
    const [isEnabled, setIsEnabled] = useState(false)
    const [regularRows, setRegularRows] = useState<ReminderRow[]>([])
    const [sundayRows, setSundayRows] = useState<ReminderRow[]>([])
    const [manualRows, setManualRows] = useState<ReminderRow[]>([])


    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setIsLoading(true)
        try {
            console.log("[ReminderSettings] Loading reminder settings and reminders...")

            // Load settings
            const { data: settingsData, error: settingsError } = await supabase
                .from("appointment_reminder_settings")
                .select("*")
                .maybeSingle<ReminderSettings>()

            if (settingsError) {
                console.error("[ReminderSettings] Error loading settings:", settingsError)
                throw settingsError
            }

            if (settingsData) {
                console.log("[ReminderSettings] Loaded settings:", settingsData)
                setSettings(settingsData)
                setIsEnabled(settingsData.is_enabled)
            } else {
                console.log("[ReminderSettings] No settings found, creating default...")
                // Create default settings if none exist
                const { data: newSettings } = await supabase
                    .from("appointment_reminder_settings")
                    .insert({ is_enabled: false, dog_ready_default_minutes: 30 })
                    .select()
                    .single<ReminderSettings>()

                if (newSettings) {
                    console.log("[ReminderSettings] Created default settings:", newSettings)
                    setSettings(newSettings)
                    setIsEnabled(false)
                }
            }

            // Load reminders
            const { data: remindersData, error: remindersError } = await supabase
                .from("appointment_reminders")
                .select("*")
                .order("display_order", { ascending: true })

            if (remindersError) {
                console.error("[ReminderSettings] Error loading reminders:", remindersError)
                throw remindersError
            }

            console.log("[ReminderSettings] Loaded reminders:", remindersData?.length || 0)

            const regular: ReminderRow[] = []
            const sunday: ReminderRow[] = []
            const manual: ReminderRow[] = []

            remindersData?.forEach((reminder) => {
                const isManual = reminder.is_manual === true

                // For manual reminders, we don't need days/hours, but we'll set defaults for the UI
                const isDays = reminder.reminder_days !== null
                const value = isDays ? reminder.reminder_days : reminder.reminder_hours
                const unit: "days" | "hours" = isDays ? "days" : "hours"

                const row: ReminderRow = {
                    id: reminder.id,
                    dayType: isManual ? "manual" : (reminder.day_type as "regular" | "sunday"),
                    isActive: reminder.is_active,
                    reminderDays: reminder.reminder_days,
                    reminderHours: reminder.reminder_hours,
                    flowId: reminder.flow_id || "",
                    description: reminder.description || "",
                    unit,
                    displayOrder: reminder.display_order,
                    isManual: isManual,
                    isDefault: reminder.is_default === true,
                    specificTime: reminder.specific_time || null,
                    sendCondition: (reminder.send_condition as "send_only_if_not_approved" | "send_anyway" | null) || null,
                    originalReminder: {
                        id: reminder.id,
                        day_type: reminder.day_type,
                        is_active: reminder.is_active,
                        reminder_days: reminder.reminder_days,
                        reminder_hours: reminder.reminder_hours,
                        flow_id: reminder.flow_id,
                        description: reminder.description || null,
                        display_order: reminder.display_order,
                        is_manual: isManual,
                        is_default: reminder.is_default === true,
                        specific_time: reminder.specific_time || null,
                        send_condition: (reminder.send_condition as "send_only_if_not_approved" | "send_anyway" | null) || null,
                    },
                }

                if (isManual) {
                    manual.push(row)
                } else if (reminder.day_type === "regular") {
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
            // Manual reminders sorted by display_order (already sorted by query)
            setManualRows(manual)

            console.log("[ReminderSettings] Data loaded successfully")
        } catch (error) {
            console.error("[ReminderSettings] Failed to load data:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את הגדרות התזכורות",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const addRow = (dayType: "regular" | "sunday" | "manual") => {
        const isManual = dayType === "manual"
        const newRow: ReminderRow = {
            id: `new-${Date.now()}-${Math.random()}`,
            dayType,
            isActive: true,
            reminderDays: isManual ? null : (dayType === "regular" ? 1 : null),
            reminderHours: isManual ? null : (dayType === "sunday" ? 1 : null),
            flowId: "",
            description: "",
            unit: "days",
            displayOrder: dayType === "regular" ? regularRows.length : dayType === "sunday" ? sundayRows.length : manualRows.length,
            isManual: isManual,
            isDefault: false,
            specificTime: null,
            sendCondition: null,
        }

        if (dayType === "regular") {
            const sorted = [...regularRows, newRow].sort((a, b) => {
                const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
                const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
                return hoursB - hoursA
            })
            setRegularRows(sorted)
        } else if (dayType === "sunday") {
            const sorted = [...sundayRows, newRow].sort((a, b) => {
                const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
                const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
                return hoursB - hoursA
            })
            setSundayRows(sorted)
        } else {
            // Manual reminders - just add to the end
            setManualRows([...manualRows, newRow])
        }
    }

    const removeRow = (dayType: "regular" | "sunday" | "manual", id: string) => {
        if (dayType === "regular") {
            setRegularRows(regularRows.filter((r) => r.id !== id))
        } else if (dayType === "sunday") {
            setSundayRows(sundayRows.filter((r) => r.id !== id))
        } else {
            setManualRows(manualRows.filter((r) => r.id !== id))
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

    const updateRow = (dayType: "regular" | "sunday" | "manual", id: string, updates: Partial<ReminderRow>) => {
        const sortByHours = (a: ReminderRow, b: ReminderRow) => {
            const hoursA = a.unit === "days" ? (a.reminderDays || 0) * 24 : (a.reminderHours || 0)
            const hoursB = b.unit === "days" ? (b.reminderDays || 0) * 24 : (b.reminderHours || 0)
            return hoursB - hoursA // Sort descending (most hours first = earliest reminders first)
        }

        if (dayType === "regular") {
            const updated = regularRows.map((r) => (r.id === id ? { ...r, ...updates } : r))
            setRegularRows(updated.sort(sortByHours))
        } else if (dayType === "sunday") {
            const updated = sundayRows.map((r) => (r.id === id ? { ...r, ...updates } : r))
            setSundayRows(updated.sort(sortByHours))
        } else {
            // Manual reminders - no sorting needed, just update
            const updated = manualRows.map((r) => (r.id === id ? { ...r, ...updates } : r))
            setManualRows(updated)
        }
    }

    const handleSave = async () => {
        console.log("[ReminderSettings] Starting save operation...")

        // Validation
        const allRows = [...regularRows, ...sundayRows, ...manualRows]
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
            // Manual reminders don't need time, but they need flow_id
            // Check if this is a manual reminder (either explicitly set or by dayType)
            const isManualReminder = row.isManual === true || row.dayType === "manual"

            if (!isManualReminder) {
                const hasTime = (row.unit === "days" && row.reminderDays !== null && row.reminderDays > 0) ||
                    (row.unit === "hours" && row.reminderHours !== null && row.reminderHours > 0)

                if (!hasTime) {
                    toast({
                        title: "שגיאה",
                        description: `יש להגדיר זמן תזכורת עבור כל תזכורת פעילה (לא ידנית)`,
                        variant: "destructive",
                    })
                    return
                }
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
            console.log("[ReminderSettings] Updating settings...")

            // Update settings
            if (settings?.id) {
                const { error } = await supabase
                    .from("appointment_reminder_settings")
                    .update({
                        is_enabled: isEnabled
                    })
                    .eq("id", settings.id)

                if (error) {
                    console.error("[ReminderSettings] Error updating settings:", error)
                    throw error
                }
            } else {
                const { data, error } = await supabase
                    .from("appointment_reminder_settings")
                    .insert({
                        is_enabled: isEnabled
                    })
                    .select()
                    .single<ReminderSettings>()

                if (error) {
                    console.error("[ReminderSettings] Error creating settings:", error)
                    throw error
                }

                if (data) {
                    setSettings(data)
                }
            }

            console.log("[ReminderSettings] Saving reminders...", { count: allRows.length })
            // Save all reminders (calculate display_order based on hours - earliest first)
            const remindersToSave = allRows.map((row, index) => {
                const hoursBefore = row.isManual ? 0 : (row.unit === "days"
                    ? (row.reminderDays || 0) * 24
                    : (row.reminderHours || 0))

                return {
                    id: row.originalReminder?.id,
                    day_type: row.isManual ? "manual" : row.dayType,
                    is_active: row.isActive,
                    reminder_days: row.isManual ? null : (row.unit === "days" && row.reminderDays !== null ? row.reminderDays : null),
                    reminder_hours: row.isManual ? null : (row.unit === "hours" && row.reminderHours !== null ? row.reminderHours : null),
                    flow_id: row.flowId.trim(),
                    description: row.description.trim() || null,
                    display_order: row.isManual ? row.displayOrder : index, // Manual reminders keep their order
                    is_manual: row.isManual,
                    is_default: row.isManual ? row.isDefault : false, // Only manual reminders can be default
                    specific_time: row.specificTime && row.specificTime.trim() ? row.specificTime.trim() : null,
                    send_condition: row.sendCondition || null,
                }
            })

            // Ensure only one default reminder exists
            const defaultReminders = remindersToSave.filter(r => r.is_default === true)
            if (defaultReminders.length > 1) {
                toast({
                    title: "שגיאה",
                    description: "רק תזכורת אחת יכולה להיות ברירת מחדל",
                    variant: "destructive",
                })
                return
            }

            // Delete all existing reminders first
            const { error: deleteError } = await supabase
                .from("appointment_reminders")
                .delete()
                .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all

            if (deleteError) {
                console.error("[ReminderSettings] Error deleting reminders:", deleteError)
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
                            is_manual: r.is_manual,
                            is_default: r.is_default,
                            specific_time: r.specific_time,
                            send_condition: r.send_condition,
                        }))
                    )

                if (insertError) {
                    console.error("[ReminderSettings] Error inserting reminders:", insertError)
                    throw insertError
                }
            }

            console.log("[ReminderSettings] Save completed successfully")

            toast({
                title: "הצלחה",
                description: "הגדרות התזכורות נשמרו בהצלחה",
            })

            await loadData()
        } catch (error) {
            console.error("[ReminderSettings] Failed to save:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הגדרות התזכורות",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const renderManualTable = (rows: ReminderRow[]) => {
        const title = "תזכורות ידניות"
        const description = "תזכורות שניתן לשלוח ידנית על-פי דרישה. תזכורות אלה לא נשלחות אוטומטית."

        return (
            <AccordionItem value="manual" className="border rounded-lg mb-4 px-0">
                <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center justify-between w-full mr-4">
                        <div className="text-right">
                            <div className="text-lg font-semibold mb-1 text-purple-700">{title}</div>
                            <div className="text-sm text-muted-foreground">{description}</div>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="px-6 pb-4">
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-purple-50">
                                        <TableHead className="w-20 text-center text-purple-900">פעיל</TableHead>
                                        <TableHead className="w-24 text-center text-purple-900">ברירת מחדל</TableHead>
                                        <TableHead className="text-purple-900">מזהה זרימה (Flow ID)</TableHead>
                                        <TableHead className="text-purple-900">תיאור (אופציונלי)</TableHead>
                                        <TableHead className="w-[180px] text-purple-900">תנאי שליחה</TableHead>
                                        <TableHead className="w-32 text-center text-purple-900">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                                                אין תזכורות ידניות. לחץ על "הוסף שורה" כדי להוסיף תזכורת חדשה.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        rows.map((row) => (
                                            <TableRow key={row.id} className={cn(!row.originalReminder && "bg-purple-50")}>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={row.isActive}
                                                        onCheckedChange={(checked) =>
                                                            updateRow("manual", row.id, { isActive: Boolean(checked) })
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            // If setting this as default, unset all others
                                                            const updatedRows = manualRows.map(r => ({
                                                                ...r,
                                                                isDefault: r.id === row.id ? !row.isDefault : false
                                                            }))
                                                            setManualRows(updatedRows)
                                                        }}
                                                        className={cn(
                                                            "p-1 rounded transition-colors",
                                                            row.isDefault
                                                                ? "text-yellow-500 hover:text-yellow-600"
                                                                : "text-gray-400 hover:text-gray-600"
                                                        )}
                                                        title={row.isDefault ? "ברירת מחדל" : "הגדר כברירת מחדל"}
                                                    >
                                                        <Star className={cn("h-5 w-5", row.isDefault && "fill-current")} />
                                                    </button>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="text"
                                                        value={row.flowId}
                                                        onChange={(e) => updateRow("manual", row.id, { flowId: e.target.value })}
                                                        placeholder="הזן מזהה זרימה ManyChat"
                                                        dir="rtl"
                                                        className="h-9 text-sm text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={row.sendCondition || "send_anyway"}
                                                        onValueChange={(value: "send_only_if_not_approved" | "send_anyway") => {
                                                            updateRow("manual", row.id, { sendCondition: value })
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-9 text-right text-sm">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent align="end">
                                                            <SelectItem value="send_anyway">שלח בכל מקרה</SelectItem>
                                                            <SelectItem value="send_only_if_not_approved">שלח רק אם לא מאושר</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                const duplicatedRow: ReminderRow = {
                                                                    ...row,
                                                                    id: `new-${Date.now()}-${Math.random()}`,
                                                                    originalReminder: undefined,
                                                                }
                                                                setManualRows([...manualRows, duplicatedRow])
                                                                toast({
                                                                    title: "הצלחה",
                                                                    description: "השורה שוכפלה",
                                                                })
                                                            }}
                                                            className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                                            title="שכפל שורה"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeRow("manual", row.id)}
                                                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                            title="מחק שורה"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => addRow("manual")}
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
                                            "w-[140px]",
                                            dayType === "regular" ? "text-blue-900" : "text-green-900"
                                        )}>שעה ספציפית</TableHead>
                                        <TableHead className={cn(
                                            dayType === "regular" ? "text-blue-900" : "text-green-900"
                                        )}>מזהה זרימה (Flow ID)</TableHead>
                                        <TableHead className={cn(
                                            dayType === "regular" ? "text-blue-900" : "text-green-900"
                                        )}>תיאור (אופציונלי)</TableHead>
                                        <TableHead className={cn(
                                            "w-[180px]",
                                            dayType === "regular" ? "text-blue-900" : "text-green-900"
                                        )}>תנאי שליחה</TableHead>
                                        <TableHead className={cn(
                                            "w-32 text-center",
                                            dayType === "regular" ? "text-blue-900" : "text-green-900"
                                        )}>פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-slate-500 py-8">
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
                                                            type="time"
                                                            value={row.specificTime || ""}
                                                            onChange={(e) => updateRow(dayType, row.id, { specificTime: e.target.value || null })}
                                                            placeholder="HH:mm"
                                                            dir="ltr"
                                                            disabled={!isEnabled}
                                                            className="h-9 text-sm"
                                                            title="שעה ספציפית לשליחת התזכורת (למשל: 18:00). אם לא מוגדר, התזכורת תישלח יחסית לזמן התור."
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
                                                    <TableCell>
                                                        <Select
                                                            value={row.sendCondition || "send_anyway"}
                                                            onValueChange={(value: "send_only_if_not_approved" | "send_anyway") => {
                                                                updateRow(dayType, row.id, { sendCondition: value })
                                                            }}
                                                            disabled={!isEnabled}
                                                        >
                                                            <SelectTrigger className="h-9 text-right text-sm">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent align="end">
                                                                <SelectItem value="send_anyway">שלח בכל מקרה</SelectItem>
                                                                <SelectItem value="send_only_if_not_approved">שלח רק אם לא מאושר</SelectItem>
                                                            </SelectContent>
                                                        </Select>
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
            <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-4 text-gray-600">טוען...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-600">הגדר תזכורות אוטומטיות ללקוחות לפני תורים</p>
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
                    <div className="space-y-6">
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

                    </div>
                </CardContent>
            </Card>

            <Accordion type="multiple" defaultValue={["regular", "sunday", "manual"]} className="w-full">
                {renderTable("regular", regularRows)}
                {renderTable("sunday", sundayRows)}
                {renderManualTable(manualRows)}
            </Accordion>
        </div>
    )
}


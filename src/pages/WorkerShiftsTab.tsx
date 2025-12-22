import { useMemo, useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { TimePickerInput } from "@/components/TimePickerInput"
import {
    useGetAllWorkerShiftsQuery,
    useGetWorkersQuery,
    useManagerDeleteShiftMutation,
    useManagerCreateShiftMutation,
    useManagerUpdateShiftMutation,
} from "@/store/services/supabaseApi"
import type { WorkerShiftWithWorker, WorkerSummary } from "@/types/worker"
import { AlertTriangle, Clock, Loader2, RefreshCcw, Plus, Trash2, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const formatMinutesAsHours = (minutes: number): string => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return "0 דקות"
    }
    const hours = Math.floor(minutes / 60)
    const remaining = minutes % 60

    if (hours === 0) {
        return `${minutes} דקות`
    }

    if (remaining === 0) {
        return `${hours} שעות`
    }

    return `${hours} שעות ו-${remaining} דקות`
}

const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return "לא ידוע"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "תאריך לא תקין"
    return new Intl.DateTimeFormat("he-IL", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date)
}

interface EditableShiftRow {
    id: string // "new-{index}" for new rows, shift.id for existing
    workerId: string
    clockInDate: Date | null
    clockInTime: string
    clockOutDate: Date | null
    clockOutTime: string
    isOpenShift: boolean
    isEditing: boolean
    originalShift?: WorkerShiftWithWorker
}

export function WorkerShiftsTab() {
    const { toast } = useToast()
    const [dateFrom, setDateFrom] = useState<Date | null>(() => {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        return startOfMonth
    })
    const [dateTo, setDateTo] = useState<Date | null>(new Date())
    const [includeInactive, setIncludeInactive] = useState(false)
    const [workerStatusFilter, setWorkerStatusFilter] = useState<"all" | "active" | "inactive">("all")
    const [selectedWorkerName, setSelectedWorkerName] = useState("")
    const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
    const [page, setPage] = useState(0)
    const pageSize = 50
    const [editableRows, setEditableRows] = useState<EditableShiftRow[]>([])
    const [deleteShift, { isLoading: isDeleting }] = useManagerDeleteShiftMutation()
    const [createShift, { isLoading: isCreating }] = useManagerCreateShiftMutation()
    const [updateShift, { isLoading: isUpdating }] = useManagerUpdateShiftMutation()

    // Fetch workers for autocomplete
    const { data: workersData } = useGetWorkersQuery({
        includeInactive: true,
        rangeStart: new Date(0).toISOString(),
        recentLimit: 0,
    })

    // Search function for worker autocomplete
    const searchWorkers = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        const workers = workersData?.workers ?? []
        
        if (trimmedTerm.length >= 2) {
            return workers
                .filter((w) => w.fullName?.toLowerCase().includes(trimmedTerm.toLowerCase()))
                .slice(0, 10)
                .map((w) => w.fullName ?? "")
                .filter(Boolean)
        } else {
            return workers
                .slice(0, 5)
                .map((w) => w.fullName ?? "")
                .filter(Boolean)
        }
    }

    // Update selected worker ID when name changes
    useEffect(() => {
        if (selectedWorkerName && workersData?.workers) {
            const worker = workersData.workers.find((w) => w.fullName === selectedWorkerName)
            setSelectedWorkerId(worker?.id ?? null)
        } else {
            setSelectedWorkerId(null)
        }
    }, [selectedWorkerName, workersData])

    const rangeStart = dateFrom ? dateFrom.toISOString() : undefined
    const rangeEnd = dateTo
        ? new Date(dateTo.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
        : undefined

    const workerIds = selectedWorkerId ? [selectedWorkerId] : undefined

    const {
        data: shiftsData,
        isLoading,
        isFetching,
        refetch,
    } = useGetAllWorkerShiftsQuery({
        rangeStart,
        rangeEnd,
        workerIds,
        includeInactive: includeInactive ? undefined : false,
        workerStatus: workerStatusFilter === "all" ? undefined : workerStatusFilter,
        page,
        pageSize,
    })

    const filteredShifts = useMemo(() => {
        return shiftsData?.entries ?? []
    }, [shiftsData])

    // Initialize editable rows from fetched shifts
    useEffect(() => {
        const rows: EditableShiftRow[] = filteredShifts.map((shift) => {
            const clockIn = new Date(shift.clockIn)
            const clockInTime = clockIn.toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            })
            const isOpenShift = !shift.clockOut

            return {
                id: shift.id,
                workerId: shift.workerId,
                clockInDate: clockIn,
                clockInTime,
                clockOutDate: shift.clockOut ? new Date(shift.clockOut) : null,
                clockOutTime: shift.clockOut
                    ? new Date(shift.clockOut).toLocaleTimeString("he-IL", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                      })
                    : "",
                isOpenShift,
                isEditing: false,
                originalShift: shift,
            }
        })
        setEditableRows(rows)
    }, [filteredShifts])

    const handleRefresh = () => {
        console.log("🔄 [WorkerShiftsTab] Manual refresh triggered")
        refetch()
    }

    const handleAddRow = () => {
        const now = new Date()
        const nowTime = now.toLocaleTimeString("he-IL", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        })

        const newRow: EditableShiftRow = {
            id: `new-${Date.now()}`,
            workerId: "",
            clockInDate: now,
            clockInTime: nowTime,
            clockOutDate: null,
            clockOutTime: "",
            isOpenShift: false,
            isEditing: true,
        }

        setEditableRows([newRow, ...editableRows])
    }

    const handleEditRow = (id: string) => {
        setEditableRows((rows) =>
            rows.map((row) => (row.id === id ? { ...row, isEditing: true } : row)),
        )
    }

    const handleCancelEdit = (id: string) => {
        const row = editableRows.find((r) => r.id === id)
        if (row?.originalShift) {
            // Restore original values for existing shift
            const clockIn = new Date(row.originalShift.clockIn)
            const clockInTime = clockIn.toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            })
            const isOpenShift = !row.originalShift.clockOut

            setEditableRows((rows) =>
                rows.map((r) =>
                    r.id === id
                        ? {
                              ...r,
                              workerId: r.originalShift!.workerId,
                              clockInDate: clockIn,
                              clockInTime,
                              clockOutDate: r.originalShift!.clockOut ? new Date(r.originalShift!.clockOut) : null,
                              clockOutTime: r.originalShift!.clockOut
                                  ? new Date(r.originalShift!.clockOut).toLocaleTimeString("he-IL", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: false,
                                    })
                                  : "",
                              isOpenShift,
                              isEditing: false,
                          }
                        : r,
                ),
            )
        } else {
            // Remove new row
            setEditableRows((rows) => rows.filter((r) => r.id !== id))
        }
    }

    const handleUpdateRow = (id: string, updates: Partial<EditableShiftRow>) => {
        setEditableRows((rows) =>
            rows.map((row) => (row.id === id ? { ...row, ...updates } : row)),
        )
    }

    const buildDateTime = (date: Date | null, time: string): string | null => {
        if (!date || !time || !/^\d{2}:\d{2}$/.test(time)) return null
        const [hours, minutes] = time.split(":").map(Number)
        const dateTime = new Date(date)
        dateTime.setHours(hours, minutes, 0, 0)
        return dateTime.toISOString()
    }

    const validateRow = (row: EditableShiftRow): string | null => {
        if (!row.workerId) return "יש לבחור עובד"
        if (!row.clockInDate) return "יש לבחור תאריך התחלה"
        if (!row.clockInTime || !/^\d{2}:\d{2}$/.test(row.clockInTime)) {
            return "יש להזין שעת התחלה תקינה"
        }

        if (!row.isOpenShift) {
            if (!row.clockOutDate) return "יש לבחור תאריך סיום"
            if (!row.clockOutTime || !/^\d{2}:\d{2}$/.test(row.clockOutTime)) {
                return "יש להזין שעת סיום תקינה"
            }

            const clockIn = buildDateTime(row.clockInDate, row.clockInTime)
            const clockOut = buildDateTime(row.clockOutDate, row.clockOutTime)

            if (clockIn && clockOut && clockOut <= clockIn) {
                return "שעת סיום חייבת להיות מאוחרת משעת התחלה"
            }
        }

        return null
    }

    const handleSaveRow = async (row: EditableShiftRow) => {
        const error = validateRow(row)
        if (error) {
            toast({
                title: "שגיאה",
                description: error,
                variant: "destructive",
            })
            return
        }

        const clockIn = buildDateTime(row.clockInDate, row.clockInTime)
        const clockOut = row.isOpenShift
            ? null
            : buildDateTime(row.clockOutDate, row.clockOutTime)

        if (!clockIn) {
            toast({
                title: "שגיאה",
                description: "תאריך/שעת התחלה לא תקינים",
                variant: "destructive",
            })
            return
        }

        if (!row.isOpenShift && !clockOut) {
            toast({
                title: "שגיאה",
                description: "תאריך/שעת סיום לא תקינים",
                variant: "destructive",
            })
            return
        }

        try {
            if (row.originalShift) {
                // Update existing shift
                console.log("🔄 [WorkerShiftsTab] Updating shift", { shiftId: row.originalShift.id })
                await updateShift({
                    shiftId: row.originalShift.id,
                    clockIn,
                    clockOut,
                    clockInNote: null,
                    clockOutNote: null,
                }).unwrap()

                toast({
                    title: "הצלחה",
                    description: "המשמרת עודכנה בהצלחה",
                })
            } else {
                // Create new shift
                console.log("🔄 [WorkerShiftsTab] Creating shift", { workerId: row.workerId })
                await createShift({
                    workerId: row.workerId,
                    clockIn,
                    clockOut,
                    clockInNote: null,
                    clockOutNote: null,
                }).unwrap()

                toast({
                    title: "הצלחה",
                    description: "המשמרת נוצרה בהצלחה",
                })
            }

            setEditableRows((rows) =>
                rows.map((r) => (r.id === row.id ? { ...r, isEditing: false } : r)),
            )

            refetch()
        } catch (error: any) {
            console.error("❌ [WorkerShiftsTab] Failed to save shift", error)
            toast({
                title: "שגיאה",
                description: error?.data || error?.message || "לא ניתן לשמור את המשמרת",
                variant: "destructive",
            })
        }
    }

    const handleDeleteShift = async (row: EditableShiftRow) => {
        if (!row.originalShift) {
            // New row - just remove it
            setEditableRows((rows) => rows.filter((r) => r.id !== row.id))
            return
        }

        if (!confirm(`האם אתה בטוח שברצונך למחוק את המשמרת של ${row.originalShift.workerName || "העובד"}?`)) {
            return
        }

        try {
            await deleteShift({ shiftId: row.originalShift.id }).unwrap()
            toast({
                title: "הצלחה",
                description: "המשמרת נמחקה בהצלחה.",
            })
            refetch()
        } catch (error: any) {
            console.error("❌ [WorkerShiftsTab] Failed to delete shift", error)
            toast({
                title: "שגיאה",
                description: error?.data || "לא ניתן למחוק את המשמרת. נסה שוב.",
                variant: "destructive",
            })
        }
    }

    const hasNext = shiftsData ? (page + 1) * pageSize < shiftsData.totalCount : false
    const hasPrev = page > 0

    return (
        <div className="flex flex-col gap-6" dir="rtl">
            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-1">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="dateFrom" className="text-sm text-slate-600">
                                    מתאריך
                                </Label>
                                <DatePickerInput
                                    id="dateFrom"
                                    value={dateFrom}
                                    onChange={setDateFrom}
                                    className="w-full sm:w-48 text-right"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="dateTo" className="text-sm text-slate-600">
                                    עד תאריך
                                </Label>
                                <DatePickerInput
                                    id="dateTo"
                                    value={dateTo}
                                    onChange={setDateTo}
                                    className="w-full sm:w-48 text-right"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="workerFilter" className="text-sm text-slate-600">
                                    עובד
                                </Label>
                                <AutocompleteFilter
                                    value={selectedWorkerName}
                                    onChange={setSelectedWorkerName}
                                    onSelect={(value) => {
                                        setSelectedWorkerName(value)
                                        setPage(0)
                                    }}
                                    placeholder="חפש עובד..."
                                    className="w-full sm:w-64"
                                    searchFn={searchWorkers}
                                    minSearchLength={0}
                                    initialLoadOnMount={true}
                                    autoSearchOnFocus={true}
                                    initialResultsLimit={5}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isFetching}>
                                {isFetching ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="ml-2 h-4 w-4" />}
                                רענון
                            </Button>
                            <Button onClick={handleAddRow} size="sm">
                                <Plus className="ml-2 h-4 w-4" />
                                הוסף שורה
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="includeInactiveShifts"
                                checked={includeInactive}
                                onCheckedChange={(checked) => {
                                    setIncludeInactive(Boolean(checked))
                                    setPage(0)
                                }}
                            />
                            <Label htmlFor="includeInactiveShifts" className="cursor-pointer text-sm text-slate-700">
                                הצג גם משמרות של עובדים לא פעילים
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="workerStatusFilter" className="text-sm text-slate-600">
                                סטטוס עובד
                            </Label>
                            <Select
                                value={workerStatusFilter}
                                onValueChange={(value: "all" | "active" | "inactive") => {
                                    setWorkerStatusFilter(value)
                                    setPage(0)
                                }}
                            >
                                <SelectTrigger id="workerStatusFilter" className="w-40 text-right">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    <SelectItem value="all">הכל</SelectItem>
                                    <SelectItem value="active">פעיל</SelectItem>
                                    <SelectItem value="inactive">לא פעיל</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow className="bg-[hsl(228_36%_95%)] [&>th]:font-semibold [&>th]:text-primary [&>th]:text-right">
                                <TableHead className="w-[180px]">עובד</TableHead>
                                <TableHead className="w-[140px]">תאריך התחלה</TableHead>
                                <TableHead className="w-[120px]">שעת התחלה</TableHead>
                                <TableHead className="w-20 text-center">פתוחה</TableHead>
                                <TableHead className="w-[140px]">תאריך סיום</TableHead>
                                <TableHead className="w-[120px]">שעת סיום</TableHead>
                                <TableHead className="w-24 text-center">פעולות</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(5)].map((_, idx) => (
                                    <TableRow key={`shift-skeleton-${idx}`} className="border-b">
                                        <TableCell colSpan={7} className="text-center">
                                            <Skeleton className="h-12 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : editableRows.length > 0 ? (
                                editableRows.map((row) => {
                                    const worker = workersData?.workers.find((w) => w.id === row.workerId)
                                    const isNewRow = !row.originalShift
                                    const isLoading = isCreating || isUpdating || isDeleting

                                    return (
                                        <TableRow
                                            key={row.id}
                                            className={cn(
                                                "border-b text-right transition-colors",
                                                isNewRow
                                                    ? "bg-primary/10"
                                                    : row.originalShift?.workerIsActive
                                                      ? "bg-[hsl(228_36%_99%)] hover:bg-[hsl(228_36%_97%)]"
                                                      : "bg-white hover:bg-muted/40",
                                            )}
                                        >
                                            <TableCell className="px-3 py-3 align-middle">
                                                {row.isEditing ? (
                                                    <Select
                                                        value={row.workerId}
                                                        onValueChange={(value) =>
                                                            handleUpdateRow(row.id, { workerId: value })
                                                        }
                                                    >
                                                        <SelectTrigger className="h-9 text-right text-sm">
                                                            <SelectValue placeholder="בחר עובד" />
                                                        </SelectTrigger>
                                                        <SelectContent align="end">
                                                            {workersData?.workers
                                                                .filter((w) => w.isActive || row.originalShift?.workerId === w.id)
                                                                .map((w) => (
                                                                    <SelectItem key={w.id} value={w.id}>
                                                                        {w.fullName || "עובד ללא שם"}
                                                                    </SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <div className="text-sm font-semibold text-slate-900">
                                                        {worker?.fullName || "עובד ללא שם"}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-3 py-3 align-middle">
                                                {row.isEditing ? (
                                                    <DatePickerInput
                                                        value={row.clockInDate}
                                                        onChange={(date) =>
                                                            handleUpdateRow(row.id, { clockInDate: date })
                                                        }
                                                        className="h-9 text-sm text-right w-full"
                                                        wrapperClassName="w-full"
                                                        autoOpenOnFocus={false}
                                                        usePortal={true}
                                                    />
                                                ) : row.originalShift ? (
                                                    formatDateTime(row.originalShift.clockIn)
                                                ) : (
                                                    row.clockInDate ? formatDateTime(row.clockInDate.toISOString()) : "-"
                                                )}
                                            </TableCell>
                                            <TableCell className="px-3 py-3 align-middle">
                                                {row.isEditing ? (
                                                    <TimePickerInput
                                                        value={row.clockInTime}
                                                        onChange={(time) =>
                                                            handleUpdateRow(row.id, { clockInTime: time })
                                                        }
                                                        className="h-9 text-sm text-right w-full"
                                                        wrapperClassName="w-full"
                                                        usePortal={true}
                                                    />
                                                ) : (
                                                    row.clockInTime || "-"
                                                )}
                                            </TableCell>
                                            <TableCell className="px-3 py-3 align-middle text-center">
                                                {row.isEditing ? (
                                                    <Checkbox
                                                        checked={row.isOpenShift}
                                                        onCheckedChange={(checked) =>
                                                            handleUpdateRow(row.id, {
                                                                isOpenShift: Boolean(checked),
                                                                clockOutDate: checked ? null : row.clockOutDate || new Date(),
                                                                clockOutTime: checked ? "" : row.clockOutTime || "",
                                                            })
                                                        }
                                                    />
                                                ) : (
                                                    <Checkbox checked={row.isOpenShift} disabled />
                                                )}
                                            </TableCell>
                                            <TableCell className="px-3 py-3 align-middle">
                                                {row.isEditing ? (
                                                    !row.isOpenShift ? (
                                                        <DatePickerInput
                                                            value={row.clockOutDate}
                                                            onChange={(date) =>
                                                                handleUpdateRow(row.id, { clockOutDate: date })
                                                            }
                                                            className="h-9 text-sm text-right w-full"
                                                            wrapperClassName="w-full"
                                                            autoOpenOnFocus={false}
                                                            usePortal={true}
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-slate-400">-</span>
                                                    )
                                                ) : row.originalShift?.clockOut ? (
                                                    formatDateTime(row.originalShift.clockOut)
                                                ) : row.isOpenShift ? (
                                                    <span className="text-sm text-amber-600">משמרת פתוחה</span>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                            <TableCell className="px-3 py-3 align-middle">
                                                {row.isEditing ? (
                                                    !row.isOpenShift ? (
                                                        <TimePickerInput
                                                            value={row.clockOutTime}
                                                            onChange={(time) =>
                                                                handleUpdateRow(row.id, { clockOutTime: time })
                                                            }
                                                            className="h-9 text-sm text-right w-full"
                                                            wrapperClassName="w-full"
                                                            usePortal={true}
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-slate-400">-</span>
                                                    )
                                                ) : row.originalShift?.clockOut ? (
                                                    new Date(row.originalShift.clockOut).toLocaleTimeString("he-IL", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        hour12: false,
                                                    })
                                                ) : row.isOpenShift ? (
                                                    <span className="text-sm text-slate-400">-</span>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                            <TableCell className="px-3 py-3 align-middle">
                                                <div className="flex items-center justify-center gap-1">
                                                    {row.isEditing ? (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleSaveRow(row)}
                                                                disabled={isLoading}
                                                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            >
                                                                {isLoading ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Check className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleCancelEdit(row.id)}
                                                                disabled={isLoading}
                                                                className="h-8 w-8 p-0 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEditRow(row.id)}
                                                                disabled={isLoading}
                                                                className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                                                            >
                                                                <Plus className="h-4 w-4 rotate-45" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDeleteShift(row)}
                                                                disabled={isLoading}
                                                                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                            >
                                                                {isLoading ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500">
                                            <AlertTriangle className="h-6 w-6" />
                                            <p className="font-medium">לא נמצאו משמרות להצגה</p>
                                            <p className="text-sm">נסה לשנות את הסינון או להוסיף עובדים.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {shiftsData && shiftsData.totalCount > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!hasPrev || isFetching}
                                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                            >
                                הקודם
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!hasNext || isFetching}
                                onClick={() => setPage((prev) => prev + 1)}
                            >
                                הבא
                            </Button>
                        </div>
                        <div className="text-sm text-slate-500">
                            מציג {Math.min((page + 1) * pageSize, shiftsData.totalCount)} מתוך {shiftsData.totalCount} משמרות
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}


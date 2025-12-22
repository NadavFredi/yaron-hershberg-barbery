import { Fragment, useEffect, useMemo, useState } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { ResetPasswordDialog } from "@/components/dialogs/workers/ResetPasswordDialog"
import PresenceReportingTab from "./PresenceReportingTab"
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
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { WorkerShiftsTab } from "./WorkerShiftsTab"
import {
    useGetWorkerAttendanceQuery,
    useGetWorkersQuery,
    useRegisterWorkerMutation,
    useResetWorkerPasswordMutation,
    useUpdateWorkerStatusMutation,
} from "@/store/services/supabaseApi"
import type {
    RegisterWorkerPayload,
    WorkerAttendanceEntry,
    WorkerSummary,
    WorkerStatusAction,
} from "@/types/worker"
import {
    CalendarDays,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    Clock,
    Loader2,
    PauseCircle,
    Mail,
    MoreHorizontal,
    Phone,
    PlayCircle,
    Plus,
    RefreshCcw,
    Trash,
    ListChecks,
    Info,
    UserPlus,
    UserRoundCog,
    Eye,
    EyeOff,
    RefreshCw,
    Key,
} from "lucide-react"
import { cn } from "@/lib/utils"

type RangePreset = "week" | "month" | "quarter" | "year"

interface WorkerAttendanceDialogProps {
    worker: WorkerSummary
    open: boolean
    onOpenChange: (value: boolean) => void
}

interface WorkerCreationFormState {
    fullName: string
    phoneNumber: string
    email: string
    password: string
}

const rangePresetOptions: Array<{ id: RangePreset; label: string }> = [
    { id: "week", label: "שבוע נוכחי" },
    { id: "month", label: "30 הימים האחרונים" },
    { id: "quarter", label: "90 הימים האחרונים" },
    { id: "year", label: "שנה אחרונה" },
]

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

const buildRangeStartFromPreset = (preset: RangePreset): string => {
    const now = new Date()
    const rangeStart = new Date(now)

    switch (preset) {
        case "week": {
            const day = rangeStart.getDay()
            const diff = day === 0 ? 0 : day
            rangeStart.setDate(rangeStart.getDate() - diff)
            break
        }
        case "month": {
            rangeStart.setDate(rangeStart.getDate() - 30)
            break
        }
        case "quarter": {
            rangeStart.setDate(rangeStart.getDate() - 90)
            break
        }
        case "year": {
            rangeStart.setDate(rangeStart.getDate() - 365)
            break
        }
        default:
            break
    }

    rangeStart.setHours(0, 0, 0, 0)
    return rangeStart.toISOString()
}

const WorkerStatusBadge = ({ worker }: { worker: WorkerSummary }) => (
    <Badge
        variant="outline"
        className={cn(
            "px-3 text-sm font-semibold",
            worker.isActive
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-gray-200 bg-gray-50 text-gray-600",
        )}
    >
        {worker.isActive ? "פעיל" : "לא פעיל"}
    </Badge>
)

const WorkerShiftBadge = ({ worker }: { worker: WorkerSummary }) => (
    <Badge
        variant="outline"
        className={cn(
            "flex items-center gap-1 px-3 text-sm font-semibold",
            worker.currentShift
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-gray-200 bg-gray-50 text-gray-600",
        )}
    >
        <Clock className="h-3.5 w-3.5" />
        {worker.currentShift ? "משמרת פתוחה" : "לא במשמרת"}
    </Badge>
)

const WorkerAttendanceDialog = ({ worker, open, onOpenChange }: WorkerAttendanceDialogProps) => {
    const [page, setPage] = useState(0)
    const [rangePreset, setRangePreset] = useState<RangePreset>("month")

    useEffect(() => {
        if (!open) {
            setPage(0)
            setRangePreset("month")
        }
    }, [open])

    const rangeStart = useMemo(() => buildRangeStartFromPreset(rangePreset), [rangePreset])
    const { data, isFetching, isLoading } = useGetWorkerAttendanceQuery(
        { workerId: worker.id, page, pageSize: 20, rangeStart },
        { skip: !open },
    )

    const hasNext = data ? (page + 1) * data.pageSize < data.totalCount : false
    const hasPrev = page > 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] w-[90vw] max-w-4xl overflow-hidden p-0" dir="rtl">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle className="flex items-center justify-between gap-3 text-right">
                        <span>היסטוריית משמרות עבור {worker.fullName || "עובד ללא שם"}</span>
                        <Badge variant="secondary" className="text-sm">
                            סה״כ משמרות: {data?.totalCount ?? 0}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>
                <Separator />
                <div className="flex flex-col gap-4 px-6 py-4" dir="rtl">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="rangePreset" className="text-sm font-medium text-slate-600">
                                טווח תאריכים
                            </Label>
                            <Select value={rangePreset} onValueChange={(value: RangePreset) => setRangePreset(value)}>
                                <SelectTrigger id="rangePreset" className="w-44 text-right">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    {rangePresetOptions.map((preset) => (
                                        <SelectItem key={preset.id} value={preset.id}>
                                            {preset.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            <div>משמרות מוצגות בסדר יורד לפי שעת התחלה.</div>
                        </div>
                    </div>
                    <ScrollArea className="h-[50vh] rounded-xl border border-slate-200 bg-white p-0">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow className="text-right">
                                    <TableHead className="text-right">תאריך התחלה</TableHead>
                                    <TableHead className="text-right">סיום משמרת</TableHead>
                                    <TableHead className="text-right">משך</TableHead>
                                    <TableHead className="text-right">הערות התחלה</TableHead>
                                    <TableHead className="text-right">הערות סיום</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading || isFetching ? (
                                    [...Array(6)].map((_, idx) => (
                                        <TableRow key={`skeleton-${idx}`}>
                                            <TableCell colSpan={5}>
                                                <Skeleton className="h-10 w-full" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : data && data.entries.length > 0 ? (
                                    data.entries.map((entry: WorkerAttendanceEntry) => (
                                        <TableRow key={entry.id} className="text-right">
                                            <TableCell>{formatDateTime(entry.clockIn)}</TableCell>
                                            <TableCell>{entry.clockOut ? formatDateTime(entry.clockOut) : "עדיין פעילה"}</TableCell>
                                            <TableCell>{formatMinutesAsHours(entry.durationMinutes)}</TableCell>
                                            <TableCell className="max-w-xs truncate">{entry.clockInNote || "-"}</TableCell>
                                            <TableCell className="max-w-xs truncate">{entry.clockOutNote || "-"}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                                            לא נמצאו משמרות עבור הטווח שבחרת.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
                <Separator />
                <DialogFooter className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between" dir="rtl">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" disabled={!hasPrev || isFetching} onClick={() => setPage((prev) => Math.max(prev - 1, 0))}>
                            הקודם
                        </Button>
                        <Button variant="outline" size="sm" disabled={!hasNext || isFetching} onClick={() => setPage((prev) => prev + 1)}>
                            הבא
                        </Button>
                    </div>
                    <div className="text-sm text-slate-500">
                        מציג {data ? Math.min((page + 1) * data.pageSize, data.totalCount) : 0} מתוך {data?.totalCount ?? 0} משמרות
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const WorkerCreationDialog = ({
    open,
    onOpenChange,
    onCreate,
    isSubmitting,
}: {
    open: boolean
    onOpenChange: (value: boolean) => void
    onCreate: (payload: RegisterWorkerPayload) => Promise<void>
    isSubmitting: boolean
}) => {
    const initialState: WorkerCreationFormState = {
        fullName: "",
        phoneNumber: "",
        email: "",
        password: "",
    }
    const [formState, setFormState] = useState<WorkerCreationFormState>(initialState)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        if (!open) {
            setFormState(initialState)
            setErrors({})
            setShowPassword(false)
        }
    }, [open])

    const generatePassword = () => {
        // Generate a secure password with 12 characters: uppercase, lowercase, numbers, and symbols
        const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"
        const lowercase = "abcdefghijkmnopqrstuvwxyz"
        const numbers = "23456789"
        const symbols = "!@#$%&*"

        // Ensure at least one of each type
        let password = ""
        password += uppercase[Math.floor(Math.random() * uppercase.length)]
        password += lowercase[Math.floor(Math.random() * lowercase.length)]
        password += numbers[Math.floor(Math.random() * numbers.length)]
        password += symbols[Math.floor(Math.random() * symbols.length)]

        // Fill the rest randomly
        const allChars = uppercase + lowercase + numbers + symbols
        for (let i = password.length; i < 12; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)]
        }

        // Shuffle the password
        password = password.split("").sort(() => Math.random() - 0.5).join("")

        setFormState((prev) => ({ ...prev, password }))
        setShowPassword(true) // Show the generated password
    }

    const validate = (): boolean => {
        const nextErrors: Record<string, string> = {}

        if (!formState.fullName.trim()) {
            nextErrors.fullName = "יש להזין שם מלא"
        }

        if (!formState.phoneNumber.trim()) {
            nextErrors.phoneNumber = "יש להזין מספר טלפון"
        }

        if (!formState.password || formState.password.trim().length < 8) {
            nextErrors.password = "יש להזין סיסמה באורך של לפחות 8 תווים"
        }

        setErrors(nextErrors)
        return Object.keys(nextErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validate()) {
            return
        }

        // Extract digits from phone number (PhoneInput returns E.164 format like +972501234567)
        const phoneDigits = formState.phoneNumber.replace(/\D/g, "")

        const payload: RegisterWorkerPayload = {
            fullName: formState.fullName.trim(),
            phoneNumber: phoneDigits,
            email: formState.email?.trim() || null,
            password: formState.password?.trim() || null,
            profileId: null, // Will be looked up by phone automatically
            sendResetPasswordEmail: false,
        }

        await onCreate(payload)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">הוספת עובד חדש</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="fullName" className="text-right">
                            שם מלא
                        </Label>
                        <Input
                            id="fullName"
                            value={formState.fullName}
                            onChange={(event) => setFormState((prev) => ({ ...prev, fullName: event.target.value }))}
                            className="text-right"
                            placeholder="לדוגמה: דנה כהן"
                        />
                        {errors.fullName ? <p className="text-xs text-rose-600">{errors.fullName}</p> : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="phoneNumber" className="text-right">
                            מספר טלפון
                        </Label>
                        <PhoneInput
                            id="phoneNumber"
                            value={formState.phoneNumber}
                            onChange={(value) => setFormState((prev) => ({ ...prev, phoneNumber: value }))}
                            placeholder="050-1234567"
                            defaultCountry="il"
                        />
                        {errors.phoneNumber ? <p className="text-xs text-rose-600">{errors.phoneNumber}</p> : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email" className="text-right">
                            אימייל (אופציונלי)
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={formState.email ?? ""}
                            onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                            className="text-right"
                            placeholder="name@example.com"
                        />
                    </div>
                    <Separator />
                    <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-right">
                                סיסמה ראשונית
                            </Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={generatePassword}
                                className="h-8 text-xs"
                            >
                                <RefreshCw className="h-3 w-3 ml-1" />
                                צור סיסמה
                            </Button>
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={formState.password ?? ""}
                                onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                                className="text-right pr-10"
                                placeholder="לפחות 8 תווים"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        {errors.password ? <p className="text-xs text-rose-600">{errors.password}</p> : null}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-right">
                        <p className="text-xs text-slate-500">
                            אם העובד כבר קיים במערכת עם מספר הטלפון הזה, הוא יומר אוטומטית לעובד פעיל.
                        </p>
                    </div>
                </div>
                <DialogFooter className="mt-4 flex  sm:flex-row sm:items-center   gap-3" dir="rtl">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        ביטול
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        שמירה
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface WorkerRowProps {
    worker: WorkerSummary
    isExpanded: boolean
    onToggleExpand: () => void
    onShowAttendance: () => void
    onStatusChange: (action: WorkerStatusAction) => void
    onResetPassword: (worker: WorkerSummary) => void
    isBusy: boolean
}

const WorkerRow = ({
    worker,
    isExpanded,
    onToggleExpand,
    onShowAttendance,
    onStatusChange,
    onResetPassword,
    isBusy,
}: WorkerRowProps) => {
    const recentShifts = worker.recentShifts.slice(0, 4)
    const statusActionLabel = worker.isActive ? "השבת עובד" : "הפעל עובד"
    const statusAction = worker.isActive ? "deactivate" : "activate"

    const handleStatusSelect = (action: WorkerStatusAction) => {
        if (isBusy) {
            return
        }
        void onStatusChange(action)
    }

    return (
        <Fragment>
            <TableRow
                className={cn(
                    "border-b text-right transition-colors",
                    worker.isActive
                        ? "bg-white hover:bg-slate-50"
                        : "bg-white hover:bg-slate-50",
                )}
            >
                <TableCell className="w-12 text-center align-middle">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                        onClick={onToggleExpand}
                        title={isExpanded ? "סגירת פרטי העובד" : "הצגת פרטי העובד"}
                    >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </TableCell>
                <TableCell className="px-3 py-3 align-middle text-right">
                    <div className="space-y-1 text-right">
                        <div className="text-sm font-semibold text-slate-900">{worker.fullName || "עובד ללא שם"}</div>
                        <div className="text-xs text-slate-500">
                            נוצר: {formatDateTime(worker.createdAt)}
                        </div>
                    </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-middle text-right">
                    <div className="flex justify-end">
                        <WorkerStatusBadge worker={worker} />
                    </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-middle text-right">
                    <div className="flex justify-end">
                        <WorkerShiftBadge worker={worker} />
                    </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-middle text-right">
                    <div className="text-sm font-semibold text-slate-800">
                        {formatMinutesAsHours(worker.totals.rangeMinutes)}
                    </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-middle text-right">
                    <div className="text-sm font-semibold text-primary">
                        {formatMinutesAsHours(worker.totals.weekMinutes)}
                    </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-middle text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                                aria-label="פעולות נוספות"
                            >
                                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 text-right" dir="rtl">
                            <DropdownMenuItem
                                className="flex items-center justify-between gap-2"
                                onSelect={(event) => {
                                    event.preventDefault()
                                    onShowAttendance()
                                }}
                            >
                                <span>הצג היסטוריית משמרות</span>
                                <CalendarDays className="h-4 w-4 text-slate-500" />
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={isBusy}
                                className="flex items-center justify-between gap-2"
                                onSelect={(event) => {
                                    event.preventDefault()
                                    onResetPassword(worker)
                                }}
                            >
                                <span>איפוס סיסמה</span>
                                <Key className="h-4 w-4 text-primary" />
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={isBusy}
                                className="flex items-center justify-between gap-2"
                                onSelect={(event) => {
                                    event.preventDefault()
                                    handleStatusSelect(statusAction)
                                }}
                            >
                                <span>{statusActionLabel}</span>
                                {worker.isActive ? (
                                    <PauseCircle className="h-4 w-4 text-rose-600" />
                                ) : (
                                    <PlayCircle className="h-4 w-4 text-emerald-600" />
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={isBusy}
                                className="flex items-center justify-between gap-2 text-rose-600 focus:text-rose-600"
                                onSelect={(event) => {
                                    event.preventDefault()
                                    handleStatusSelect("remove")
                                }}
                            >
                                <span>הסר עובד</span>
                                <Trash className="h-4 w-4" />
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
            {isExpanded ? (
                <TableRow className="bg-white">
                    <TableCell className="border-b-0" />
                    <TableCell colSpan={6} className="border-b px-6 py-6" dir="rtl">
                        <div className="space-y-6">
                            <div className="grid gap-6 lg:grid-cols-3">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-2 text-right">
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Info className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-semibold">פרטי העובד</span>
                                        </div>
                                        <Badge
                                            variant={worker.isActive ? "default" : "destructive"}
                                            className={cn(
                                                "text-xs",
                                                worker.isActive ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700",
                                            )}
                                        >
                                            {worker.isActive ? "פעיל" : "לא פעיל"}
                                        </Badge>
                                    </div>
                                    <div className="mt-4 space-y-4 text-right">
                                        <div className="space-y-1 text-sm text-slate-600">
                                            <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                                                <Phone className="h-4 w-4 text-slate-400" />
                                                <span>מספר טלפון</span>
                                            </div>
                                            <div className="font-medium text-slate-900">{worker.phoneNumber || "לא עודכן"}</div>
                                        </div>
                                        <div className="space-y-1 text-sm text-slate-600">
                                            <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                                                <Mail className="h-4 w-4 text-slate-400" />
                                                <span>אימייל</span>
                                            </div>
                                            <div className="font-medium text-slate-900">{worker.email || "לא עודכן"}</div>
                                        </div>
                                        <div className="space-y-1 text-sm text-slate-600">
                                            <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                                                <CalendarDays className="h-4 w-4 text-slate-400" />
                                                <span>נוצר במערכת</span>
                                            </div>
                                            <div className="font-medium text-slate-900">{formatDateTime(worker.createdAt)}</div>
                                        </div>
                                    </div>
                                    {worker.currentShift ? (
                                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold">משמרת פעילה</span>
                                                <Clock className="h-4 w-4" />
                                            </div>
                                            <div className="mt-2 flex items-center justify-between text-xs text-amber-700">
                                                <span>התחלה</span>
                                                <span>{formatDateTime(worker.currentShift.clockIn)}</span>
                                            </div>
                                            <div className="mt-1 text-xs">
                                                משך נוכחי: {formatMinutesAsHours(worker.currentShift.durationMinutes)}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm">
                                    <div className="flex items-center justify-end gap-2 text-slate-700">
                                        <Clock className="h-4 w-4 text-primary" />
                                        <span className="text-sm font-semibold">סיכומי שעות</span>
                                    </div>
                                    <div className="mt-4 space-y-3 text-sm">
                                        <div className="flex items-center justify-between text-slate-600">
                                            <span>בטווח שנבחר</span>
                                            <span className="font-semibold text-slate-900">
                                                {formatMinutesAsHours(worker.totals.rangeMinutes)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-600">
                                            <span>שבוע נוכחי</span>
                                            <span className="font-semibold text-primary">
                                                {formatMinutesAsHours(worker.totals.weekMinutes)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-600">
                                            <span>היום</span>
                                            <span className="font-semibold text-emerald-700">
                                                {formatMinutesAsHours(worker.totals.todayMinutes)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                                        <span>
                                            הנתונים מתעדכנים אוטומטית בכל רענון. השתמש בלחצן הרענון למעלה כדי למשוך מידע עדכני מהשרת.
                                        </span>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center justify-end gap-2 text-slate-700">
                                            <ListChecks className="h-4 w-4 text-amber-600" />
                                            <span className="text-sm font-semibold">משמרות אחרונות</span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-primary hover:bg-primary/10 hover:text-primary"
                                            onClick={onShowAttendance}
                                        >
                                            היסטוריה מלאה
                                        </Button>
                                    </div>
                                    <div className="mt-4 space-y-3 text-sm">
                                        {recentShifts.length > 0 ? (
                                            recentShifts.map((shift) => (
                                                <div
                                                    key={shift.id}
                                                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right"
                                                >
                                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                                        <span>התחלה</span>
                                                        <span>{formatDateTime(shift.clockIn)}</span>
                                                    </div>
                                                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                                                        <span>סיום</span>
                                                        <span>{shift.clockOut ? formatDateTime(shift.clockOut) : "משמרת פתוחה"}</span>
                                                    </div>
                                                    <div className="mt-2 text-sm font-semibold text-slate-800">
                                                        משך: {formatMinutesAsHours(shift.durationMinutes)}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                                                אין משמרות אחרונות להצגה.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            ) : null}
        </Fragment>
    )
}

export default function WorkersSection() {
    const { toast } = useToast()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const currentMode = searchParams.get("mode") || "workers"
    const currentSection = searchParams.get("section")
    const [includeInactive, setIncludeInactive] = useState(false)
    const [rangePreset, setRangePreset] = useState<RangePreset>("week")
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [selectedWorker, setSelectedWorker] = useState<WorkerSummary | null>(null)
    const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null)

    // Set default mode if not present in URL
    // Only update if we're on the manager-screens page and the section is workers
    useEffect(() => {
        if (location.pathname !== "/manager-screens") {
            return
        }

        if (currentSection && currentSection !== "workers") {
            return
        }

        if (!searchParams.get("mode")) {
            setSearchParams({ section: "workers", mode: "workers" }, { replace: true })
        }
    }, [location.pathname, currentSection, searchParams, setSearchParams])

    const rangeStart = useMemo(() => buildRangeStartFromPreset(rangePreset), [rangePreset])
    const {
        data: workersData,
        isLoading: isLoadingWorkers,
        isFetching: isFetchingWorkers,
        refetch: refetchWorkers,
    } = useGetWorkersQuery({
        includeInactive,
        rangeStart,
        recentLimit: 5,
    })

    const [registerWorker, { isLoading: isRegistering }] = useRegisterWorkerMutation()
    const [updateWorkerStatus, { isLoading: isUpdatingStatus }] = useUpdateWorkerStatusMutation()
    const [resetWorkerPassword, { isLoading: isResettingPassword }] = useResetWorkerPasswordMutation()

    useEffect(() => {
        if (expandedWorkerId && workersData?.workers.every((worker) => worker.id !== expandedWorkerId)) {
            setExpandedWorkerId(null)
        }
    }, [expandedWorkerId, workersData])

    const handleRefresh = () => {
        console.log("🔄 [WorkersSection] Manual refresh triggered")
        refetchWorkers()
    }

    const handleRegisterWorker = async (payload: RegisterWorkerPayload) => {
        console.log("👷 [WorkersSection] Registering worker", payload)
        try {
            await registerWorker(payload).unwrap()
            toast({
                title: "העובד נשמר בהצלחה",
                description: "העובד נוצר או עודכן בהצלחה.",
            })
            setCreateDialogOpen(false)
            await refetchWorkers()
        } catch (error) {
            console.error("❌ [WorkersSection] Failed to register worker", error)
            toast({
                title: "שגיאה בשמירת העובד",
                description: "ניסיון ההוספה נכשל. בדוק את הנתונים ונסה שוב.",
                variant: "destructive",
            })
        }
    }

    const handleStatusChange = async (worker: WorkerSummary, action: WorkerStatusAction) => {
        console.log("⚙️ [WorkersSection] Updating status", { workerId: worker.id, action })
        try {
            await updateWorkerStatus({ workerId: worker.id, action }).unwrap()
            toast({
                title: "הסטטוס עודכן",
                description: `הפעולה "${action}" בוצעה בהצלחה.`,
            })
            await refetchWorkers()
        } catch (error) {
            console.error("❌ [WorkersSection] Failed to update status", error)
            toast({
                title: "לא ניתן לעדכן את הסטטוס",
                description: "נסה שוב או פנה לתמיכה.",
                variant: "destructive",
            })
        }
    }

    const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
    const [selectedWorkerForReset, setSelectedWorkerForReset] = useState<WorkerSummary | null>(null)

    const handleResetPasswordClick = (worker: WorkerSummary) => {
        setSelectedWorkerForReset(worker)
        setResetPasswordDialogOpen(true)
    }

    const handleSetPassword = async (worker: WorkerSummary, password: string) => {
        console.log("🔐 [WorkersSection] Setting password for worker", { workerId: worker.id })
        try {
            const result = await resetWorkerPassword({
                workerId: worker.id,
                action: "set_password",
                newPassword: password,
            }).unwrap()
            toast({
                title: "סיסמה עודכנה",
                description: result.message,
            })
            setResetPasswordDialogOpen(false)
            setSelectedWorkerForReset(null)
        } catch (error) {
            console.error("❌ [WorkersSection] Failed to set password", error)
            const errorMessage = error && typeof error === "object" && "data" in error && typeof error.data === "string"
                ? error.data
                : "נסה שוב או פנה לתמיכה."
            toast({
                title: "לא ניתן לעדכן את הסיסמה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleGenerateResetLink = async (worker: WorkerSummary) => {
        console.log("🔐 [WorkersSection] Generating reset link for worker", { workerId: worker.id })
        try {
            const result = await resetWorkerPassword({
                workerId: worker.id,
                action: "generate_link",
            }).unwrap()
            toast({
                title: "קישור איפוס סיסמה נוצר",
                description: result.message,
            })
            // If reset link is provided, copy it to clipboard
            if (result.resetLink) {
                try {
                    await navigator.clipboard.writeText(result.resetLink)
                    toast({
                        title: "קישור הועתק",
                        description: "קישור איפוס הסיסמה הועתק ללוח. העבר אותו לעובד.",
                    })
                } catch (clipboardError) {
                    console.warn("⚠️ [WorkersSection] Failed to copy to clipboard", clipboardError)
                }
            }
            setResetPasswordDialogOpen(false)
            setSelectedWorkerForReset(null)
        } catch (error) {
            console.error("❌ [WorkersSection] Failed to generate reset link", error)
            const errorMessage = error && typeof error === "object" && "data" in error && typeof error.data === "string"
                ? error.data
                : "נסה שוב או פנה לתמיכה."
            toast({
                title: "לא ניתן ליצור קישור איפוס סיסמה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const toggleWorkerDetails = (workerId: string) => {
        setExpandedWorkerId((prev) => {
            const next = prev === workerId ? null : workerId
            console.log("📂 [WorkersSection] Toggle worker details panel", { workerId, expanded: next === workerId })
            return next
        })
    }

    const handleShowAttendance = (worker: WorkerSummary) => {
        console.log("📘 [WorkersSection] Opening attendance dialog", { workerId: worker.id })
        setSelectedWorker(worker)
    }

    const totals = useMemo(() => {
        const workers = workersData?.workers ?? []
        const totalActive = workers.filter((worker) => worker.isActive).length
        const totalWorkingNow = workers.filter((worker) => Boolean(worker.currentShift)).length
        const totalWeekMinutes = workers.reduce((sum, worker) => sum + worker.totals.weekMinutes, 0)
        const totalRangeMinutes = workers.reduce((sum, worker) => sum + worker.totals.rangeMinutes, 0)

        return {
            totalWorkers: workers.length,
            totalActive,
            totalWorkingNow,
            totalWeekMinutes,
            totalRangeMinutes,
        }
    }, [workersData])

    return (
        <div className="flex flex-col gap-6 pt-12 px-1 sm:px-3 lg:px-6 bg-background" dir="rtl">
            {currentMode !== "presence" && (
                <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 text-right sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <UserRoundCog className="h-6 w-6 text-primary" />
                            ניהול עובדים ומשמרות
                        </h1>
                        <p className="text-sm text-slate-600">
                            ניהול מלא של צוות העובדים, כולל הוספה, הפעלה/השבתה ומעקב אחר שעות עבודה בפועל.
                        </p>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isFetchingWorkers}>
                            {isFetchingWorkers ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="ml-2 h-4 w-4" />}
                            רענון
                        </Button>
                        {currentMode === "workers" && (
                            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                                <Plus className="ml-2 h-4 w-4" />
                                הוספת עובד
                            </Button>
                        )}
                    </div>
                </header>
            )}

            {currentMode === "workers" && (
                <div className="flex flex-col gap-6">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2 text-right">
                                <CardDescription className="text-slate-500">סה״כ עובדים בתצוגה</CardDescription>
                                <CardTitle className="text-3xl font-bold text-slate-900">{totals.totalWorkers}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs text-slate-500">
                                הטבלה משקפת עובדים פעילים בלבד אלא אם סימנת הצגת עובדים לא פעילים.
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2 text-right">
                                <CardDescription className="text-slate-500">עובדים פעילים כעת</CardDescription>
                                <CardTitle className="text-3xl font-bold text-emerald-600">{totals.totalActive}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs text-slate-500">
                                עובדים שיכולים לבצע כניסה ויציאה משעון הנוכחות.
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2 text-right">
                                <CardDescription className="text-slate-500">משמרות פתוחות כרגע</CardDescription>
                                <CardTitle className="text-3xl font-bold text-amber-600">{totals.totalWorkingNow}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs text-slate-500">
                                עובדים שביצעו כניסה למשמרת ועדיין לא יצאו ממנה.
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2 text-right">
                                <CardDescription className="text-slate-500">סה״כ שעות בטווח שנבחר</CardDescription>
                                <CardTitle className="text-2xl font-bold text-primary">{formatMinutesAsHours(totals.totalRangeMinutes)}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs text-slate-500">
                                חיבור של כל המשמרות שנפתחו בתוך הטווח שנבחר.
                            </CardContent>
                        </Card>
                    </section>

                    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="includeInactive"
                                    checked={includeInactive}
                                    onCheckedChange={(checked) => setIncludeInactive(Boolean(checked))}
                                />
                                <Label htmlFor="includeInactive" className="cursor-pointer text-sm text-slate-700">
                                    הצג גם עובדים לא פעילים
                                </Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="rangePresetSelector" className="text-sm text-slate-600">
                                    טווח סיכום שעות
                                </Label>
                                <Select
                                    value={rangePreset}
                                    onValueChange={(value: RangePreset) => {
                                        console.log("🗓️ [WorkersSection] Range preset changed", value)
                                        setRangePreset(value)
                                    }}
                                >
                                    <SelectTrigger id="rangePresetSelector" className="w-44 text-right">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        {rangePresetOptions.map((option) => (
                                            <SelectItem key={option.id} value={option.id}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                            <Table
                                className="w-full table-fixed"
                                containerClassName="relative w-full overflow-auto"
                            >
                                <TableHeader>
                                    <TableRow className="bg-[hsl(228_36%_95%)] [&>th]:font-semibold [&>th]:text-primary [&>th]:text-right">
                                        <TableHead className="w-12" />
                                        <TableHead>שם העובד</TableHead>
                                        <TableHead>סטטוס עובד</TableHead>
                                        <TableHead>משמרת נוכחית</TableHead>
                                        <TableHead>שעות בטווח</TableHead>
                                        <TableHead>שבוע נוכחי</TableHead>
                                        <TableHead>פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingWorkers ? (
                                        [...Array(5)].map((_, idx) => (
                                            <TableRow key={`worker-skeleton-${idx}`} className="border-b">
                                                <TableCell colSpan={7} className="text-center">
                                                    <Skeleton className="h-12 w-full" />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : workersData && workersData.workers.length > 0 ? (
                                        workersData.workers.map((worker) => (
                                            <WorkerRow
                                                key={worker.id}
                                                worker={worker}
                                                isExpanded={expandedWorkerId === worker.id}
                                                onToggleExpand={() => toggleWorkerDetails(worker.id)}
                                                onShowAttendance={() => handleShowAttendance(worker)}
                                                onStatusChange={(action) => handleStatusChange(worker, action)}
                                                onResetPassword={handleResetPasswordClick}
                                                isBusy={isUpdatingStatus || isResettingPassword}
                                            />
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center">
                                                <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500">
                                                    <AlertTriangle className="h-6 w-6" />
                                                    <p className="font-medium">לא נמצאו עובדים להצגה</p>
                                                    <p className="text-sm">הוסף עובדים חדשים או הסר את הסינון של עובדים לא פעילים.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </section>
                </div>
            )}

            {currentMode === "shifts" && <WorkerShiftsTab />}

            {currentMode === "presence" && <PresenceReportingTab />}

            <WorkerCreationDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onCreate={handleRegisterWorker}
                isSubmitting={isRegistering}
            />

            {selectedWorker ? (
                <WorkerAttendanceDialog
                    worker={selectedWorker}
                    open={Boolean(selectedWorker)}
                    onOpenChange={(open) => {
                        if (!open) {
                            setSelectedWorker(null)
                        }
                    }}
                />
            ) : null}

            {selectedWorkerForReset ? (
                <ResetPasswordDialog
                    open={resetPasswordDialogOpen}
                    onOpenChange={setResetPasswordDialogOpen}
                    worker={selectedWorkerForReset}
                    onSetPassword={handleSetPassword}
                    onGenerateLink={handleGenerateResetLink}
                    isSubmitting={isResettingPassword}
                />
            ) : null}
        </div>
    )
}


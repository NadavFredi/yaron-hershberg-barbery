import React, { useEffect, useRef, useState } from "react"
import { skipToken } from "@reduxjs/toolkit/query"
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setIsNavbarPinned, setIsNavbarVisible, setIsOnManagerBoard, setIsSubnavHovered, setIsNavbarHovered } from "@/store/slices/navbarSlice"
import { setImpersonatedCustomer, clearImpersonation } from "@/store/slices/impersonationSlice"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
    User,
    LogOut,
    Settings,
    Menu,
    X,
    ChevronDown,
    Bell,
    Loader2,
    PlayCircle,
    PauseCircle,
    Sparkles,
    Calendar,
    ClipboardList,
    Ticket,
    Pin,
    PinOff,
    UserCog,
    XCircle,
    Lock
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import logoImage from "@/assets/logo.jpeg"
import { MANAGER_NAV_SECTIONS } from "./ManagerSubnav"
import { THIRD_LEVEL_SECTIONS } from "./ThirdLevelSubnav"
import {
    useGetPendingAppointmentRequestsQuery,
    type PendingAppointmentRequest,
    useGetWorkerStatusQuery,
    useWorkerClockInMutation,
    useWorkerClockOutMutation,
    useSearchCustomersQuery
} from "@/store/services/supabaseApi"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/useDebounce"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip"

const SERVICE_BADGE_STYLES: Record<PendingAppointmentRequest["serviceType"], string> = {
    grooming: "bg-primary/20 text-primary border border-primary/20"
}

const SERVICE_TYPE_LABELS: Record<PendingAppointmentRequest["serviceType"], string> = {
    grooming: "מספרה"
}

const formatDateTime = (value: string | null, options: Intl.DateTimeFormatOptions = {}) => {
    if (!value) {
        return "מועד טרם נקבע"
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return "תאריך לא תקין"
    }
    const formatter = new Intl.DateTimeFormat("he-IL", {
        dateStyle: "short",
        timeStyle: "short",
        ...options
    })
    return formatter.format(date)
}

interface ManagerNotificationBellProps {
    requests: PendingAppointmentRequest[]
    pendingCount: number
    isLoading: boolean
    isFetching: boolean
    isError: boolean
    onRefresh: () => void
    meta?: {
        totalFetched: number
        returned: number
        requestedLimit: number
    }
    triggerSize?: "icon" | "default" | "sm"
    triggerClassName?: string
    align?: "start" | "end"
}

const ManagerNotificationBell = ({
    requests,
    pendingCount,
    isLoading,
    isFetching,
    isError,
    onRefresh,
    meta,
    triggerSize = "icon",
    triggerClassName,
    align = "end"
}: ManagerNotificationBellProps) => {
    const showInitialLoading = isLoading && !requests.length
    const hasRequests = requests.length > 0

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size={triggerSize}
                    className={`relative rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-100 ${triggerClassName ?? ""}`}
                    aria-label="בקשות ממתינות לאישור"
                >
                    <Bell className="h-5 w-5" />
                    {pendingCount > 0 && (
                        <span className="absolute -top-1 -left-1 min-w-[20px] rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                            {pendingCount > 99 ? "99+" : pendingCount}
                        </span>
                    )}
                    {isFetching && (
                        <span className="absolute -bottom-1 -left-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align={align}
                sideOffset={12}
                className="w-80 rounded-2xl border border-slate-200 bg-white p-0 shadow-xl"
                dir="rtl"
            >
                <div className="flex flex-col gap-1 px-4 py-3 border-b border-slate-200/70">
                    <p className="text-sm font-semibold text-slate-900">בקשות ממתינות לאישור</p>
                    <p className="text-xs text-slate-500">הבקשות האחרונות מופיעות ראשונות</p>
                    {meta && (
                        <p className="text-[11px] text-slate-400">
                            מוצגות {meta.returned} בקשות מתוך {meta.totalFetched}
                        </p>
                    )}
                </div>

                {isError && (
                    <div className="flex flex-col items-center justify-center gap-3 px-4 py-6 text-center">
                        <p className="text-sm font-semibold text-rose-600">אירעה שגיאה בטעינת הבקשות</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRefresh}
                            className="text-rose-600 hover:text-rose-700"
                        >
                            נסה שוב
                        </Button>
                    </div>
                )}

                {!isError && (showInitialLoading ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm font-medium">טוען נתונים...</span>
                    </div>
                ) : hasRequests ? (
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="px-4 py-3 transition-colors duration-150 hover:bg-slate-50"
                            >
                                <div className="flex flex-col items-end gap-1 text-right">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-900">
                                            {request.customerName || "לקוח ללא שם"}
                                        </span>
                                        <Badge className={`text-xs ${SERVICE_BADGE_STYLES[request.serviceType]}`}>
                                            {request.serviceLabel || SERVICE_TYPE_LABELS[request.serviceType]}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-slate-600">
                                        {request.customerName || "לקוח ללא שם"}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {`תור מתוכנן: ${formatDateTime(request.startAt)}`}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {`התקבל: ${formatDateTime(request.createdAt)}`}
                                    </div>
                                    {request.stationName && (
                                        <div className="text-xs text-slate-500">
                                            {`עמדה: ${request.stationName}`}
                                        </div>
                                    )}
                                </div>
                                {request.notes && (
                                    <p className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 line-clamp-3">
                                        {request.notes}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-slate-500">
                        <span className="text-sm font-semibold">אין כרגע בקשות ממתינות</span>
                        <span className="text-xs text-slate-400">הבאנו לך שקט זמני 🙂</span>
                    </div>
                ))}

                <DropdownMenuSeparator />
                <div className="flex flex-col gap-2 px-4 py-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isFetching}
                        className="justify-center text-primary hover:text-primary"
                    >
                        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>רענון עכשיו</span>}
                    </Button>
                    <Link to="/manager-screens?section=appointments&mode=pending" className="block">
                        <Button variant="outline" size="sm" className="w-full justify-center">
                            הצגת כל הבקשות הממתינות
                        </Button>
                    </Link>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

interface ImpersonationSelectorProps {
    isManager: boolean
}

function ImpersonationSelector({ isManager }: ImpersonationSelectorProps) {
    const dispatch = useAppDispatch()
    const impersonationState = useAppSelector((state) => state.impersonation)
    const [searchTerm, setSearchTerm] = useState("")
    const [isOpen, setIsOpen] = useState(false)
    const debouncedSearchTerm = useDebounce(searchTerm.trim(), 300)

    const { data: searchData, isLoading: isSearching } = useSearchCustomersQuery(
        { searchTerm: debouncedSearchTerm },
        { skip: !isOpen || debouncedSearchTerm.length < 1 }
    )

    const customers = searchData?.customers || []

    const handleSelectCustomer = (customer: { id: string; fullName?: string }) => {
        dispatch(setImpersonatedCustomer({
            customerId: customer.id,
            customerName: customer.fullName || "לקוח ללא שם"
        }))
        setIsOpen(false)
        setSearchTerm("")
    }

    const handleClearImpersonation = () => {
        dispatch(clearImpersonation())
        setIsOpen(false)
        setSearchTerm("")
    }

    if (!isManager) {
        return null
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "flex items-center gap-2",
                        impersonationState.impersonatedCustomerId && "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    )}
                >
                    {impersonationState.impersonatedCustomerId ? (
                        <>
                            <UserCog className="h-4 w-4" />
                            <span className="text-xs">
                                {impersonationState.impersonatedCustomerName || "מתחזה"}
                            </span>
                        </>
                    ) : (
                        <>
                            <UserCog className="h-4 w-4" />
                            <span className="text-xs">התחזה ללקוח</span>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80" dir="rtl">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">התחזה ללקוח</h3>
                        {impersonationState.impersonatedCustomerId && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearImpersonation}
                                className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                            >
                                <XCircle className="h-3 w-3 ml-1" />
                                בטל התחזות
                            </Button>
                        )}
                    </div>
                    {impersonationState.impersonatedCustomerId && (
                        <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-xs text-amber-800">
                                <strong>מתחזה כרגע:</strong> {impersonationState.impersonatedCustomerName}
                            </p>
                        </div>
                    )}
                    <Input
                        placeholder="חפש לקוח לפי שם, טלפון או אימייל..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="text-right"
                        dir="rtl"
                    />
                    <ScrollArea className="h-64">
                        {isSearching ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                            </div>
                        ) : customers.length > 0 ? (
                            <div className="space-y-1">
                                {customers.map((customer) => (
                                    <button
                                        key={customer.id}
                                        onClick={() => handleSelectCustomer(customer)}
                                        className={cn(
                                            "w-full text-right px-3 py-2 rounded-lg text-sm transition-colors",
                                            "hover:bg-slate-100",
                                            impersonationState.impersonatedCustomerId === customer.id && "bg-amber-100"
                                        )}
                                    >
                                        <div className="font-medium">{customer.fullName || "לקוח ללא שם"}</div>
                                        {customer.phone && (
                                            <div className="text-xs text-slate-500">{customer.phone}</div>
                                        )}
                                        {customer.email && (
                                            <div className="text-xs text-slate-500">{customer.email}</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : debouncedSearchTerm.length >= 1 ? (
                            <div className="text-center py-8 text-sm text-slate-500">
                                לא נמצאו לקוחות
                            </div>
                        ) : (
                            <div className="text-center py-8 text-sm text-slate-500">
                                התחל להקליד כדי לחפש לקוח
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </PopoverContent>
        </Popover>
    )
}

interface NavbarProps {
    isManager: boolean
}

export function Navbar({ isManager }: NavbarProps) {
    const { user, isLoading: isAuthLoading } = useSupabaseAuth()
    const dispatch = useAppDispatch()
    const impersonationState = useAppSelector((state) => state.impersonation)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const navRef = useRef<HTMLElement | null>(null)
    const { toast } = useToast()
    const currentManagerSection = searchParams.get("section")
    const modeParam = searchParams.get("mode")
    const pinnedParam = searchParams.get("pinned")
    const currentSettingsMode = currentManagerSection === "settings" ? (modeParam || "working-hours") : null
    const currentSubscriptionsMode = currentManagerSection === "subscriptions" ? (modeParam || "list") : null
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ manager: false })
    const [expandedNestedSections, setExpandedNestedSections] = useState<Record<string, boolean>>({})
    const [isSecureModeActive, setIsSecureModeActive] = useState(false)
    const isNavbarPinned = useAppSelector((state) => state.navbar.isNavbarPinned)
    const isSubnavHovered = useAppSelector((state) => state.navbar.isSubnavHovered)
    const isNavbarHovered = useAppSelector((state) => state.navbar.isNavbarHovered)
    const hoverZoneRef = useRef<HTMLDivElement | null>(null)
    const hideTimeoutRef = useRef<number | null>(null)
    const hasInitializedFromUrlRef = useRef(false)
    const lastSyncedReduxStateRef = useRef<boolean | null>(null)

    // Check secure mode status
    useEffect(() => {
        const checkSecureMode = () => {
            const isVerified = sessionStorage.getItem("protected_screen_password_verified") === "true"
            setIsSecureModeActive(isVerified)
        }

        checkSecureMode()

        // Listen for storage changes (in case it's cleared from another tab)
        const handleStorageChange = () => checkSecureMode()
        window.addEventListener("storage", handleStorageChange)

        // Listen for custom event when secure mode changes (same tab)
        const handleSecureModeChanged = () => checkSecureMode()
        window.addEventListener("secureModeChanged", handleSecureModeChanged)

        return () => {
            window.removeEventListener("storage", handleStorageChange)
            window.removeEventListener("secureModeChanged", handleSecureModeChanged)
        }
    }, [])

    const handleEndSecureMode = () => {
        sessionStorage.removeItem("protected_screen_password_verified")
        setIsSecureModeActive(false)
        // Dispatch event to notify other components
        window.dispatchEvent(new Event("secureModeChanged"))
        toast({
            title: "מצב מאובטח הופסק",
            description: "תידרש סיסמה כדי לגשת למסכים מוגנים",
        })

        // If currently on any manager page, redirect to manager dashboard
        // The password check will handle showing the dialog if needed
        if (isOnManagerBoard) {
            navigate("/manager")
        }
    }

    // Check if we're on any manager page (all manager routes)
    const isOnManagerBoard = location.pathname.startsWith("/manager") || location.pathname.startsWith("/manager-screens")

    // Initialize Redux from URL only once (if not already initialized)
    // After initialization, Redux is the source of truth
    useEffect(() => {
        if (isOnManagerBoard && !hasInitializedFromUrlRef.current) {
            hasInitializedFromUrlRef.current = true

            if (pinnedParam !== null) {
                // URL has pinned param - initialize Redux from URL
                const urlPinned = pinnedParam === "true"
                dispatch(setIsNavbarPinned(urlPinned))
                lastSyncedReduxStateRef.current = urlPinned
            } else {
                // No pinned param in URL - ensure navbar is pinned by default
                dispatch(setIsNavbarPinned(true))
                lastSyncedReduxStateRef.current = true
            }
        }
    }, [isOnManagerBoard, pinnedParam, dispatch])

    // Reset initialization flag when leaving manager pages
    useEffect(() => {
        if (!isOnManagerBoard) {
            hasInitializedFromUrlRef.current = false
            lastSyncedReduxStateRef.current = null
        }
    }, [isOnManagerBoard])

    // Navbar is visible if hovered OR pinned OR subnav is hovered (on any manager page)
    const isNavbarVisible = isOnManagerBoard ? (isNavbarHovered || isNavbarPinned || isSubnavHovered) : true

    // Sync state to Redux
    useEffect(() => {
        dispatch(setIsNavbarVisible(isNavbarVisible))
        dispatch(setIsOnManagerBoard(isOnManagerBoard))
    }, [isNavbarVisible, isOnManagerBoard, dispatch, isNavbarHovered, isNavbarPinned, isSubnavHovered])

    // Sync Redux state to URL (Redux is source of truth)
    // Only update URL when Redux state actually changes
    useEffect(() => {
        if (isOnManagerBoard && hasInitializedFromUrlRef.current && isNavbarPinned !== lastSyncedReduxStateRef.current) {
            const currentPinnedParam = searchParams.get("pinned")
            const urlPinnedIsFalse = currentPinnedParam === "false"

            // Update URL to match Redux state
            if (isNavbarPinned && urlPinnedIsFalse) {
                // Pinned is true (default) - remove param if it exists
                const newSearchParams = new URLSearchParams(searchParams)
                newSearchParams.delete("pinned")
                setSearchParams(newSearchParams, { replace: true })
                lastSyncedReduxStateRef.current = isNavbarPinned
            } else if (!isNavbarPinned && !urlPinnedIsFalse) {
                // Pinned is false - add param
                const newSearchParams = new URLSearchParams(searchParams)
                newSearchParams.set("pinned", "false")
                setSearchParams(newSearchParams, { replace: true })
                lastSyncedReduxStateRef.current = isNavbarPinned
            } else {
                // URL already matches Redux state, just update the ref
                lastSyncedReduxStateRef.current = isNavbarPinned
            }
        }
    }, [isNavbarPinned, isOnManagerBoard, searchParams, setSearchParams])

    // Reset pin state when leaving manager pages (but don't clear URL param)
    useEffect(() => {
        if (!isOnManagerBoard && isNavbarPinned) {
            dispatch(setIsNavbarPinned(false))
        }
    }, [isOnManagerBoard, isNavbarPinned, dispatch])

    // Ensure hover state doesn't persist when leaving manager pages
    useEffect(() => {
        if (!isOnManagerBoard) {
            if (isNavbarHovered) {
                dispatch(setIsNavbarHovered(false))
            }
            if (isSubnavHovered) {
                dispatch(setIsSubnavHovered(false))
            }
        }
    }, [isOnManagerBoard, isNavbarHovered, isSubnavHovered, dispatch])


    // Cleanup timeout on unmount or pin change
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current)
            }
        }
    }, [])

    // Clear timeout when pinned/unpinned
    useEffect(() => {
        if (isNavbarPinned && hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current)
            hideTimeoutRef.current = null
        }
    }, [isNavbarPinned])

    const {
        data: pendingData,
        isLoading: isPendingLoading,
        isFetching: isPendingFetching,
        isError: isPendingError,
        refetch: refetchPending
    } = useGetPendingAppointmentRequestsQuery(
        isManager ? { limit: 5 } : skipToken,
        {
            pollingInterval: isManager ? 60000 : undefined,
            refetchOnMountOrArgChange: true
        }
    )
    const pendingRequests = isManager ? (pendingData?.requests ?? []) : []
    const pendingCount = isManager ? pendingRequests.length : 0
    const pendingMeta = pendingData?.meta

    const {
        data: workerStatus,
        isFetching: isFetchingWorkerStatus,
        isLoading: isLoadingWorkerStatus
    } = useGetWorkerStatusQuery(undefined, { skip: !user })
    const [workerClockIn, { isLoading: isClockingIn }] = useWorkerClockInMutation()
    const [workerClockOut, { isLoading: isClockingOut }] = useWorkerClockOutMutation()
    const workerIsBusy = isFetchingWorkerStatus || isLoadingWorkerStatus || isClockingIn || isClockingOut
    const isWorkerActive = Boolean(workerStatus?.success && workerStatus.isWorker && workerStatus.isActive)
    const hasOpenShift = Boolean(workerStatus?.hasOpenShift)

    const formatMinutesToLabel = (minutes?: number | null): string => {
        if (!minutes || !Number.isFinite(minutes) || minutes <= 0) {
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

    const currentShiftLabel = workerStatus?.currentShift?.clockIn
        ? new Intl.DateTimeFormat("he-IL", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(new Date(workerStatus.currentShift.clockIn))
        : null

    const handleWorkerClockToggle = async () => {
        if (!isWorkerActive || workerIsBusy) {
            return
        }

        try {
            if (hasOpenShift) {
                await workerClockOut({}).unwrap()
                toast({
                    title: "המשמרת נסגרה",
                    description: "תודה! המשמרת נסגרה בהצלחה."
                })
            } else {
                await workerClockIn({}).unwrap()
                toast({
                    title: "משמרת חדשה נפתחה",
                    description: "שמרנו את תחילת המשמרת. עבודה נעימה!"
                })
            }
        } catch (error) {
            console.error("❌ [Navbar] Worker clock toggle failed", error)
            toast({
                title: "שגיאה בפעולת הנוכחות",
                description: "לא הצלחנו לעדכן את המשמרת. נסה שוב בעוד רגע.",
                variant: "destructive"
            })
        }
    }

    const WorkerClockButton = () => {
        if (!workerStatus || !workerStatus.success || !workerStatus.isWorker) {
            return null
        }

        if (!isWorkerActive) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            className="relative rounded-full text-slate-400"
                            aria-label="המשתמש לא פעיל כעובד"
                        >
                            <PauseCircle className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent align="end">
                        חשבון העובד הושבת. פנה למנהל כדי להפעיל אותו מחדש.
                    </TooltipContent>
                </Tooltip>
            )
        }

        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleWorkerClockToggle}
                        disabled={workerIsBusy}
                        className={cn(
                            "relative rounded-full transition-colors",
                            hasOpenShift
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "text-primary hover:text-primary hover:bg-primary/10"
                        )}
                        aria-label={hasOpenShift ? "סיום משמרת" : "התחלת משמרת"}
                    >
                        {workerIsBusy ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : hasOpenShift ? (
                            <PauseCircle className="h-5 w-5" />
                        ) : (
                            <PlayCircle className="h-5 w-5" />
                        )}
                        {hasOpenShift ? (
                            <span className="absolute -top-1 -left-1 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                        ) : null}
                    </Button>
                </TooltipTrigger>
                <TooltipContent align="end" side="bottom" className="text-right">
                    {hasOpenShift ? (
                        <div className="space-y-1">
                            <div className="font-semibold text-emerald-700">משמרת פתוחה</div>
                            {currentShiftLabel ? (
                                <div className="text-xs text-slate-600">נפתחה ב-{currentShiftLabel}</div>
                            ) : null}
                            <div className="text-xs text-slate-500">
                                משך עד כה: {formatMinutesToLabel(workerStatus.currentShift?.durationMinutes ?? 0)}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <div className="font-semibold text-primary">לחיצה תתחיל משמרת חדשה</div>
                            <div className="text-xs text-slate-500">
                                עד כה היום עבדת {formatMinutesToLabel(workerStatus.totals.todayMinutes)}
                            </div>
                        </div>
                    )}
                </TooltipContent>
            </Tooltip>
        )
    }

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        const updateNavbarHeight = () => {
            if (!navRef.current) return
            const height = navRef.current.offsetHeight
            document.documentElement.style.setProperty("--navbar-height", `${height}px`)
        }

        updateNavbarHeight()

        const observer = new ResizeObserver(updateNavbarHeight)
        if (navRef.current) {
            observer.observe(navRef.current)
        }

        window.addEventListener("resize", updateNavbarHeight)

        return () => {
            observer.disconnect()
            window.removeEventListener("resize", updateNavbarHeight)
        }
    }, [])

    useEffect(() => {
        if (!isMobileMenuOpen) {
            setExpandedSections({ manager: false })
            setExpandedNestedSections({})
            return
        }

        const shouldExpandManager = location.pathname.startsWith("/manager")
            || location.pathname.startsWith("/manager-screens")
            || !!currentManagerSection

        setExpandedSections({ manager: shouldExpandManager })
        const normalizeSectionForNested = (sectionValue: string | null) => {
            if (!sectionValue) return null
            if (sectionValue === "waiting-list" || sectionValue === "appointments") {
                return "appointments"
            }
            return sectionValue
        }

        const normalizedSection = normalizeSectionForNested(currentManagerSection)

        const defaultNestedSection = normalizedSection
            ? normalizedSection
            : location.pathname.startsWith("/manager")
                ? "appointments"
                : undefined

        setExpandedNestedSections(
            defaultNestedSection ? { [defaultNestedSection]: true } : {}
        )
    }, [isMobileMenuOpen, location.pathname, currentManagerSection])

    const handleSignOut = async () => {
        // Clear impersonation when signing out
        dispatch(clearImpersonation())
        await supabase.auth.signOut()
        navigate("/")
        setIsMobileMenuOpen(false)
    }

    const isActive = (path: string) => {
        // For nested routes, check if pathname starts with the path
        if (path === "/manager") {
            return location.pathname.startsWith("/manager") || location.pathname.startsWith("/manager-screens")
        }
        return location.pathname === path || location.pathname.startsWith(path + "/")
    }

    const toggleAccordionSection = (sectionId: string) => {
        setExpandedSections((prev) => {
            const isOpen = !!prev[sectionId]
            if (isOpen) {
                const next = { ...prev }
                delete next[sectionId]
                return next
            }
            return { [sectionId]: true }
        })
    }

    const toggleNestedAccordion = (sectionId: string) => {
        setExpandedNestedSections((prev) => {
            const isOpen = !!prev[sectionId]
            if (isOpen) {
                const next = { ...prev }
                delete next[sectionId]
                return next
            }
            return { [sectionId]: true }
        })
    }

    const navItems = [
        { path: "/about", label: "אודות", icon: Sparkles, requiresAuth: false, requiresManager: false },
        { path: "/setup-appointment", label: "קבע תור", icon: Calendar, requiresAuth: true, requiresManager: false },
        { path: "/appointments", label: "התורים שלי", icon: ClipboardList, requiresAuth: true, requiresManager: false },
        { path: "/subscriptions", label: "הכרטיסיות שלי", icon: Ticket, requiresAuth: true, requiresManager: false },
        { path: "/manager", label: "מסכי מנהל", icon: User, requiresAuth: false, requiresManager: true },
    ]

    const appointmentSection = MANAGER_NAV_SECTIONS.find((section) => section.id === "appointments")
    const appointmentChildren = appointmentSection?.children ?? []
    const customersSection = MANAGER_NAV_SECTIONS.find((section) => section.id === "customers")
    const customersChildren = customersSection?.children ?? []

    const nestedSectionLinks: Record<string, Array<{ to: string; label: string; icon: React.ReactNode; isActive: boolean }>> = {
        appointments: appointmentChildren.map((child) => ({
            to: child.to,
            label: child.label,
            icon: child.icon,
            isActive: child.match(location.pathname, currentManagerSection, modeParam)
        })),
        customers: customersChildren.map((child) => ({
            to: child.to,
            label: child.label,
            icon: child.icon,
            isActive: child.match(location.pathname, currentManagerSection, modeParam)
        })),
        settings: THIRD_LEVEL_SECTIONS.settings.map((section) => ({
            to: `/manager-screens?section=settings&mode=${section.id}`,
            label: section.label,
            icon: section.icon,
            isActive: currentManagerSection === "settings" && currentSettingsMode === section.id
        })),
        subscriptions: THIRD_LEVEL_SECTIONS.subscriptions.map((section) => ({
            to: `/manager-screens?section=subscriptions&mode=${section.id}`,
            label: section.label,
            icon: section.icon,
            isActive: currentManagerSection === "subscriptions" && currentSubscriptionsMode === section.id
        }))
    }

    if (isAuthLoading) {
        return (
            <TooltipProvider>
                <nav className="sticky top-0 left-0 right-0 z-50" dir="rtl">
                    <div className="bg-white shadow-sm border-b">
                        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex justify-between items-center py-3">
                                <div className="w-32 h-8 bg-gray-200 animate-pulse rounded"></div>
                                <div className="w-24 h-8 bg-gray-200 animate-pulse rounded"></div>
                            </div>
                        </div>
                    </div>
                </nav>
            </TooltipProvider>
        )
    }

    return (
        <TooltipProvider>
            {/* Hover zone for collapsed navbar on manager board (desktop only) - very thin at top edge */}
            {isOnManagerBoard && !isNavbarPinned && (
                <div
                    ref={hoverZoneRef}
                    data-nav-hover-zone="true"
                    className={cn(
                        "hidden xl:block fixed top-0 left-0 right-0 h-2 cursor-default transition-opacity duration-300",
                        isNavbarVisible ? "z-[45] pointer-events-none" : "z-[60] pointer-events-auto"
                    )}
                    style={{ backgroundColor: 'transparent' }}
                    aria-hidden="true"
                    onMouseEnter={() => {
                        dispatch(setIsNavbarHovered(true))
                    }}
                    onMouseLeave={(e) => {
                        // Only hide if mouse is moving to content below, not to navbar, and not pinned
                        if (!isNavbarPinned) {
                            const relatedTarget = e.relatedTarget as HTMLElement | null
                            if (!relatedTarget || !navRef.current?.contains(relatedTarget)) {
                                dispatch(setIsNavbarHovered(false))
                                // Also clear subnav hover state when hiding from hover zone
                                dispatch(setIsSubnavHovered(false))
                            }
                        }
                    }}
                />
            )}
            <nav
                ref={navRef}
                data-nav-level="1"
                className={cn(
                    "sticky top-0 left-0 right-0 z-50 transition-all duration-300",
                    isOnManagerBoard && !isNavbarVisible && "xl:min-h-[8px]"
                )}
                dir="rtl"
                onMouseEnter={() => {
                    if (isOnManagerBoard) {
                        // Cancel any pending hide
                        if (hideTimeoutRef.current) {
                            clearTimeout(hideTimeoutRef.current)
                            hideTimeoutRef.current = null
                        }
                        dispatch(setIsNavbarHovered(true))
                        // Also show subnavs when navbar is hovered
                        dispatch(setIsSubnavHovered(true))
                    }
                }}
                onMouseLeave={(e) => {
                    if (isOnManagerBoard && !isNavbarPinned) {
                        const relatedTarget = e.relatedTarget as HTMLElement | null
                        const navLevelTarget = relatedTarget?.closest("[data-nav-level]")
                        const isMovingWithinNavLevels = Boolean(navLevelTarget)
                        const isMovingToDropdown = relatedTarget?.closest('[role="menu"], [role="menuitem"]')
                        const isMovingToHoverZone = relatedTarget
                            ? Boolean(hoverZoneRef.current?.contains(relatedTarget) || relatedTarget.closest('[data-nav-hover-zone="true"]'))
                            : false

                        if (!relatedTarget || (!isMovingToHoverZone && !isMovingToDropdown && !isMovingWithinNavLevels)) {
                            // Add a small delay before hiding to allow moving to dropdowns/subnavs
                            hideTimeoutRef.current = setTimeout(() => {
                                // Double-check we're still not hovering before hiding
                                if (!isNavbarPinned) {
                                    dispatch(setIsNavbarHovered(false))
                                    dispatch(setIsSubnavHovered(false))
                                }
                            }, 150)
                        } else {
                            // Cancel hide if moving to dropdown or nav levels
                            if (hideTimeoutRef.current) {
                                clearTimeout(hideTimeoutRef.current)
                                hideTimeoutRef.current = null
                            }
                        }
                    }
                }}
            >
                <div className={cn(
                    "bg-white shadow-sm border-b border-slate-200 transition-all duration-300",
                    isOnManagerBoard && !isNavbarVisible && "xl:opacity-0 xl:max-h-0 xl:overflow-hidden xl:pointer-events-none",
                    isOnManagerBoard && isNavbarVisible && "xl:opacity-100 xl:max-h-[200px] xl:pointer-events-auto"
                )}>
                    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Mobile Header */}
                        <div className="flex items-center justify-between gap-4 py-3 xl:hidden">
                            <Link to="/" className="flex items-center gap-3">
                                <div className="w-10 h-10 shrink-0">
                                    <img src={logoImage} alt="Yaron Hershberg Logo" className="w-full h-full object-contain" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-gray-900 leading-tight">Yaron Hershberg</h1>
                                    <p className="text-xs text-gray-600 leading-tight">מספרה מקצועית</p>
                                </div>
                            </Link>
                            <div className="flex items-center gap-2">
                                <WorkerClockButton />
                                {isManager && (
                                    <ManagerNotificationBell
                                        requests={pendingRequests}
                                        pendingCount={pendingCount}
                                        isLoading={isPendingLoading}
                                        isFetching={isPendingFetching}
                                        isError={isPendingError}
                                        onRefresh={refetchPending}
                                        meta={pendingMeta}
                                        triggerSize="icon"
                                    />
                                )}
                                {/* Secure Mode Indicator - Mobile - only show when active */}
                                {isManager && isSecureModeActive && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleEndSecureMode}
                                        className="rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                        aria-label="סיים מצב מאובטח"
                                    >
                                        <Lock className="h-5 w-5" />
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full border-slate-300 text-slate-700"
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                >
                                    {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden xl:grid xl:grid-cols-[auto,1fr,auto] xl:items-center xl:gap-6 py-4">
                            <Link to={user ? "/setup-appointment" : "/"} className="flex items-center gap-3">
                                <div className="w-12 h-12 shrink-0">
                                    <img src={logoImage} alt="Yaron Hershberg Logo" className="w-full h-full object-contain" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">Yaron Hershberg</h1>
                                    <p className="text-sm text-gray-600 leading-tight">מספרה מקצועית</p>
                                </div>
                            </Link>

                            <div className="flex items-center justify-center gap-2 overflow-x-auto whitespace-nowrap">
                                {navItems.map((item) => {
                                    if (item.requiresAuth && !user) return null
                                    if (item.requiresManager && !isManager) return null

                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(item.path)
                                                ? "bg-primary text-white shadow-sm"
                                                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50 hover:shadow-sm"
                                                }`}
                                        >
                                            <item.icon className={`h-4 w-4 ${isActive(item.path) ? "text-white" : "text-slate-500"}`} />
                                            <span>{item.label}</span>
                                        </Link>
                                    )
                                })}
                            </div>

                            <div className="flex items-center justify-end gap-4">
                                <WorkerClockButton />
                                {isManager && (
                                    <ManagerNotificationBell
                                        requests={pendingRequests}
                                        pendingCount={pendingCount}
                                        isLoading={isPendingLoading}
                                        isFetching={isPendingFetching}
                                        isError={isPendingError}
                                        onRefresh={refetchPending}
                                        meta={pendingMeta}
                                    />
                                )}
                                {isManager && <ImpersonationSelector isManager={isManager} />}
                                {/* Secure Mode Indicator - only show when active */}
                                {isManager && isSecureModeActive && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleEndSecureMode}
                                                className="rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                                aria-label="סיים מצב מאובטח"
                                            >
                                                <Lock className="h-5 w-5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">
                                            מצב מאובטח פעיל - לחץ לסיום
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                {/* Pin button for all manager pages */}
                                {isOnManagerBoard && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    dispatch(setIsNavbarPinned(!isNavbarPinned))
                                                }}
                                                className={cn(
                                                    "rounded-full transition-colors",
                                                    isNavbarPinned
                                                        ? "bg-primary/20 text-primary hover:bg-primary/30"
                                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                )}
                                                aria-label={isNavbarPinned ? "בטל נעיצה" : "נעץ"}
                                            >
                                                {isNavbarPinned ? (
                                                    <Pin className="h-5 w-5" />
                                                ) : (
                                                    <PinOff className="h-5 w-5" />
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">
                                            {isNavbarPinned ? "בטל נעיצה - הסתר את התפריט" : "נעץ - שמור את התפריט גלוי"}
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                {user ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="flex items-center gap-2 px-4 py-2.5">
                                                <User className="h-5 w-5" />
                                                <span className="text-base">{user.email}</span>
                                                <Badge variant="secondary" className="mr-2 text-sm py-1 px-2">
                                                    {user.user_metadata?.full_name || "משתמש"}
                                                </Badge>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56">
                                            <div className="px-3 py-2">
                                                <p className="text-sm font-medium">{user.email}</p>
                                                <p className="text-xs text-gray-500">
                                                    {user.user_metadata?.full_name || "לא הוגדר שם"}
                                                </p>
                                                {impersonationState.impersonatedCustomerId && (
                                                    <div className="mt-2 px-2 py-1.5 bg-amber-50 rounded border border-amber-200">
                                                        <p className="text-xs font-semibold text-amber-800">
                                                            מתחזה כ:
                                                        </p>
                                                        <p className="text-xs text-amber-700">
                                                            {impersonationState.impersonatedCustomerName || "לקוח ללא שם"}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem asChild>
                                                <Link to="/profile" className="flex items-center gap-2">
                                                    <Settings className="h-4 w-4" />
                                                    <span>הגדרות פרופיל</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                                                <LogOut className="h-4 w-4 mr-2" />
                                                התנתק
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Link to="/login">
                                            <Button variant="outline" className="flex items-center gap-2 px-3 py-2 text-sm">
                                                <User className="h-5 w-5" />
                                                <span>כניסה</span>
                                            </Button>
                                        </Link>
                                        <Link to="/signup">
                                            <Button className="bg-primary hover:bg-primary/90 px-4 py-2 text-sm">
                                                הרשמה
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mobile Navigation */}
                        {isMobileMenuOpen && (
                            <div className="xl:hidden border-t border-gray-200 py-4">
                                <div className="space-y-3">
                                    {navItems.map((item) => {
                                        if (item.requiresAuth && !user) return null
                                        if (item.requiresManager && !isManager) return null

                                        if (item.path === "/manager") {
                                            const isSectionExpanded = expandedSections.manager

                                            return (
                                                <div key={item.path} className="rounded-xl border border-slate-200 bg-white/80 py-2 shadow-sm">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAccordionSection("manager")}
                                                        className="flex w-full items-center justify-between px-4 py-2 text-base font-semibold text-gray-700"
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <item.icon className={`h-5 w-5 ${isActive(item.path) ? "text-primary" : "text-slate-500"}`} />
                                                            <span>{item.label}</span>
                                                        </span>
                                                        <ChevronDown
                                                            className={`h-4 w-4 transition-transform ${isSectionExpanded ? "rotate-180 text-primary" : "text-gray-500"}`}
                                                        />
                                                    </button>

                                                    {isSectionExpanded && (
                                                        <div className="mt-2 space-y-1">
                                                            {MANAGER_NAV_SECTIONS.map((section) => {
                                                                const nestedItems = nestedSectionLinks[section.id]
                                                                const isNestedExpanded = !!expandedNestedSections[section.id]
                                                                const nestedActive = nestedItems?.some((item) => item.isActive)
                                                                const isSectionActive = section.match(location.pathname, currentManagerSection, modeParam) || nestedActive
                                                                const baseClasses = `flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors`
                                                                const activeClasses = isSectionActive
                                                                    ? "bg-primary/20 text-primary"
                                                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"

                                                                return (
                                                                    <div key={section.id} className="px-2 py-1">
                                                                        {nestedItems ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const wasExpanded = isNestedExpanded
                                                                                    toggleNestedAccordion(section.id)
                                                                                    if (!wasExpanded && section.id === "appointments") {
                                                                                        navigate(section.to)
                                                                                    }
                                                                                }}
                                                                                className={`${baseClasses} ${activeClasses}`}
                                                                            >
                                                                                <span className="flex items-center gap-2">
                                                                                    <section.icon className={`h-4 w-4 ${isSectionActive ? "text-primary" : "text-slate-500"}`} />
                                                                                    <span>{section.label}</span>
                                                                                </span>
                                                                                <ChevronDown
                                                                                    className={`h-4 w-4 transition-transform ${isNestedExpanded ? "rotate-180 text-primary" : ""}`}
                                                                                />
                                                                            </button>
                                                                        ) : (
                                                                            <Link
                                                                                to={section.to}
                                                                                onClick={() => setIsMobileMenuOpen(false)}
                                                                                className={`${baseClasses} ${activeClasses}`}
                                                                            >
                                                                                <span className="flex items-center gap-2">
                                                                                    <section.icon className={`h-4 w-4 ${isSectionActive ? "text-primary" : "text-slate-500"}`} />
                                                                                    <span>{section.label}</span>
                                                                                </span>
                                                                            </Link>
                                                                        )}

                                                                        {nestedItems && isNestedExpanded && (
                                                                            <div className="mt-2 space-y-1 border-r border-dashed border-indigo-100 pr-8">
                                                                                {nestedItems.map((nestedLink) => (
                                                                                    <Link
                                                                                        key={nestedLink.to}
                                                                                        to={nestedLink.to}
                                                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                                                        className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm transition-colors ${nestedLink.isActive
                                                                                            ? "bg-indigo-100 text-indigo-700"
                                                                                            : "text-gray-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                                                            }`}
                                                                                    >
                                                                                        <nestedLink.icon className={`h-4 w-4 ${nestedLink.isActive ? "text-indigo-700" : "text-slate-500"}`} />
                                                                                        <span>{nestedLink.label}</span>
                                                                                    </Link>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        }

                                        return (
                                            <Link
                                                key={item.path}
                                                to={item.path}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${isActive(item.path)
                                                    ? "bg-primary text-white shadow-sm"
                                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:shadow-sm"
                                                    }`}
                                            >
                                                <item.icon className={`h-4 w-4 ${isActive(item.path) ? "text-white" : "text-slate-500"}`} />
                                                <span>{item.label}</span>
                                            </Link>
                                        )
                                    })}

                                    {user ? (
                                        <div className="border-t border-gray-200 pt-4 mt-4">
                                            <div className="px-3 py-2">
                                                <p className="text-sm font-medium text-gray-900">{user.email}</p>
                                                <p className="text-xs text-gray-500">
                                                    {user.user_metadata?.full_name || "לא הוגדר שם"}
                                                </p>
                                                {impersonationState.impersonatedCustomerId && (
                                                    <div className="mt-2 px-2 py-1.5 bg-amber-50 rounded border border-amber-200">
                                                        <p className="text-xs font-semibold text-amber-800">
                                                            מתחזה כ:
                                                        </p>
                                                        <p className="text-xs text-amber-700">
                                                            {impersonationState.impersonatedCustomerName || "לקוח ללא שם"}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            {isManager && (
                                                <div className="px-3 py-2">
                                                    <ImpersonationSelector isManager={isManager} />
                                                </div>
                                            )}
                                            <Link
                                                to="/profile"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                            >
                                                <Settings className="h-5 w-5" />
                                                <span>הגדרות פרופיל</span>
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={handleSignOut}
                                                className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <LogOut className="h-5 w-5" />
                                                <span>התנתק</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
                                            <Link
                                                to="/login"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                                            >
                                                <User className="h-5 w-5" />
                                                <span>כניסה</span>
                                            </Link>
                                            <Link
                                                to="/signup"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-base font-medium hover:bg-primary/90"
                                            >
                                                <span>הרשמה</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
        </TooltipProvider>
    )
}

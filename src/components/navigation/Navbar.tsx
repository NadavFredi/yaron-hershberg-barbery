import React, { useEffect, useRef, useState } from "react"
import { skipToken } from "@reduxjs/toolkit/query"
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom"
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
    PauseCircle
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import logoImage from "@/assets/logo.jpeg"
import { MANAGER_NAV_SECTIONS } from "./ManagerSubnav"
import { SETTINGS_SECTIONS } from "./SettingsSubnav"
import { CUSTOMERS_SECTIONS } from "./CustomersSubnav"
import { TREATMENTS_SECTIONS } from "./TreatmentsSubnav"
import {
    useGetPendingAppointmentRequestsQuery,
    type PendingAppointmentRequest,
    useGetWorkerStatusQuery,
    useWorkerClockInMutation,
    useWorkerClockOutMutation
} from "@/store/services/supabaseApi"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip"

const SERVICE_BADGE_STYLES: Record<PendingAppointmentRequest["serviceType"], string> = {
    grooming: "bg-blue-100 text-blue-700 border border-blue-200",
    garden: "bg-emerald-100 text-emerald-700 border border-emerald-200"
}

const SERVICE_TYPE_LABELS: Record<PendingAppointmentRequest["serviceType"], string> = {
    grooming: "מספרה",
    garden: "גן"
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
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
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
                                        {request.treatmentName ? `טיפול מבוקש: ${request.treatmentName}` : "ללא טיפול משויך"}
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
                        className="justify-center text-blue-600 hover:text-blue-700"
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

interface NavbarProps {
    isManager: boolean
}

export function Navbar({ isManager }: NavbarProps) {
    const { user, isLoading: isAuthLoading } = useSupabaseAuth()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const navRef = useRef<HTMLElement | null>(null)
    const { toast } = useToast()
    const currentManagerSection = searchParams.get("section")
    const modeParam = searchParams.get("mode")
    const currentCustomersMode = currentManagerSection === "customers" ? (modeParam || "list") : null
    const currentTreatmentsMode = currentManagerSection === "treatments" ? (modeParam || "list") : null
    const currentSettingsMode = currentManagerSection === "settings" ? (modeParam || "working-hours") : null
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ manager: false })
    const [expandedNestedSections, setExpandedNestedSections] = useState<Record<string, boolean>>({})

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
                console.log("⏹️ [Navbar] Worker clock-out initiated")
                await workerClockOut({}).unwrap()
                toast({
                    title: "המשמרת נסגרה",
                    description: "תודה! המשמרת נסגרה בהצלחה."
                })
            } else {
                console.log("▶️ [Navbar] Worker clock-in initiated")
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
                                : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
                            <div className="font-semibold text-blue-700">לחיצה תתחיל משמרת חדשה</div>
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
        { path: "/about", label: "אודות", icon: "✨", requiresAuth: false, requiresManager: false },
        { path: "/setup-appointment", label: "קבע תור", icon: "📅", requiresAuth: true, requiresManager: false },
        { path: "/appointments", label: "התורים שלי", icon: "📋", requiresAuth: true, requiresManager: false },
        { path: "/subscriptions", label: "הכרטיסיות שלי", icon: "🎫", requiresAuth: true, requiresManager: false },
        { path: "/manager", label: "מסכי מנהל", icon: "👤", requiresAuth: false, requiresManager: true },
    ]

    const appointmentSection = MANAGER_NAV_SECTIONS.find((section) => section.id === "appointments")
    const appointmentChildren = appointmentSection?.children ?? []

    const nestedSectionLinks: Record<string, Array<{ to: string; label: string; icon: React.ReactNode; isActive: boolean }>> = {
        appointments: appointmentChildren.map((child) => ({
            to: child.to,
            label: child.label,
            icon: child.icon,
            isActive: child.match(location.pathname, currentManagerSection, modeParam)
        })),
        customers: CUSTOMERS_SECTIONS.map((section) => ({
            to: `/manager-screens?section=customers&mode=${section.id}`,
            label: section.label,
            icon: section.icon,
            isActive: currentManagerSection === "customers" && currentCustomersMode === section.id
        })),
        treatments: TREATMENTS_SECTIONS.map((section) => ({
            to: `/manager-screens?section=treatments&mode=${section.id}`,
            label: section.label,
            icon: section.icon,
            isActive: currentManagerSection === "treatments" && currentTreatmentsMode === section.id
        })),
        settings: SETTINGS_SECTIONS.map((section) => ({
            to: `/manager-screens?section=settings&mode=${section.id}`,
            label: section.label,
            icon: section.icon,
            isActive: currentManagerSection === "settings" && currentSettingsMode === section.id
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
            <nav ref={navRef} className="sticky top-0 left-0 right-0 z-50" dir="rtl">
                <div className="bg-white shadow-sm border-b border-slate-200">
                    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Mobile Header */}
                        <div className="flex items-center justify-between gap-4 py-3 xl:hidden">
                            <Link to="/" className="flex items-center gap-3">
                                <div className="w-10 h-10 shrink-0">
                                    <img src={logoImage} alt="Yaron Hershberg Special Barbery Logo" className="w-full h-full object-contain" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-gray-900 leading-tight">Yaron Hershberg</h1>
                                    <p className="text-xs text-gray-600 leading-tight">מספרה יוצאת דופן</p>
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
                            <Link to="/" className="flex items-center gap-3">
                                <div className="w-12 h-12 shrink-0">
                                    <img src={logoImage} alt="Yaron Hershberg Special Barbery Logo" className="w-full h-full object-contain" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">Yaron Hershberg</h1>
                                    <p className="text-sm text-gray-600 leading-tight">מספרה יוצאת דופן</p>
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
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive(item.path)
                                                ? "bg-blue-100 text-blue-700"
                                                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                                }`}
                                        >
                                            <span className="text-lg">{item.icon}</span>
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
                                                            <span className="text-xl">{item.icon}</span>
                                                            <span>{item.label}</span>
                                                        </span>
                                                        <ChevronDown
                                                            className={`h-4 w-4 transition-transform ${isSectionExpanded ? "rotate-180 text-blue-600" : "text-gray-500"}`}
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
                                                                    ? "bg-blue-100 text-blue-700"
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
                                                                                    <span className="text-base">{section.icon}</span>
                                                                                    <span>{section.label}</span>
                                                                                </span>
                                                                                <ChevronDown
                                                                                    className={`h-4 w-4 transition-transform ${isNestedExpanded ? "rotate-180 text-blue-600" : ""}`}
                                                                                />
                                                                            </button>
                                                                        ) : (
                                                                            <Link
                                                                                to={section.to}
                                                                                onClick={() => setIsMobileMenuOpen(false)}
                                                                                className={`${baseClasses} ${activeClasses}`}
                                                                            >
                                                                                <span className="flex items-center gap-2">
                                                                                    <span className="text-base">{section.icon}</span>
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
                                                                                        <span>{nestedLink.icon}</span>
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
                                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${isActive(item.path)
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                                    }`}
                                            >
                                                <span className="text-xl">{item.icon}</span>
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
                                            </div>
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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react"
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { useDispatch } from "react-redux"
import { createPortal } from "react-dom"
import { addDays, addHours, addMinutes, differenceInMinutes, format, max, min, startOfDay, startOfMonth, setSeconds, setMilliseconds, parseISO } from "date-fns"
import { he } from "date-fns/locale"
import { CalendarIcon, CalendarCog, ChevronsLeft, ChevronsRight, Loader2, RefreshCcw, AlertCircle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, DollarSign, MessageSquare, Scissors, Bone, Wand2, Droplets, Clock, Pencil, Trash2, MoreHorizontal, Copy, Plus, X, SlidersHorizontal, GripVertical, Search, FileText, UserRound } from "lucide-react"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent, PointerSensor, useSensor, useSensors, useDraggable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useDroppable } from "@dnd-kit/core"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar } from "@/components/ui/calendar"
import { SmallCalendar } from "@/components/ui/small-calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/useDebounce"
import { useGetManagerScheduleQuery, useMoveAppointmentMutation, useCreateManagerAppointmentMutation, useDeleteWaitingListEntryMutation, useLazySearchManagerScheduleQuery, supabaseApi, useCreateProposedMeetingMutation, useUpdateProposedMeetingMutation, useDeleteProposedMeetingMutation, useSendProposedMeetingWebhookMutation } from "@/store/services/supabaseApi"
import { supabase } from "@/integrations/supabase/client"
import { managerCancelAppointment, managerDeleteAppointment, getSingleManagerAppointment } from "@/integrations/supabase/supabaseService"
import type {
  ManagerAppointment,
  ManagerScheduleData,
  ManagerServiceFilter,
  ManagerStation,
  ManagerTreatment,
  ManagerScheduleSearchResponse,
} from "@/types/managerSchedule"
import { cn } from "@/lib/utils"
import {
  MoveConfirmationDialog,
  DeleteConfirmationDialog,
  CancelConfirmationDialog,
  GardenEditModal,
  GroomingEditModal,
  AppointmentTypeSelectionModal,
  ServiceTypeSelectionModal,
  PrivateAppointmentModal,
  BusinessAppointmentModal,
  ProposedMeetingModal,
  DuplicateSeriesModal,
  DuplicateSuccessModal,
  NewGardenAppointmentModal,
  TreatmentAppointmentsModal,
  PaymentModal,
  StationConstraintsModal
} from "@/components/dialogs/manager-schedule/index"
import {
  AppointmentDetailsSheet,
  TreatmentDetailsSheet,
  ClientDetailsSheet,
  ConstraintDetailsSheet
} from "./ManagerSchedule/sheets/index"
import { ProposedMeetingSheet } from "./ManagerSchedule/sheets/ProposedMeetingSheet"
import type { Customer as ManagerCustomer } from "@/components/CustomerSearchInput"
import type { Treatment as ManagerTreatmentSelect } from "@/components/TreatmentSelectInput"
import { ConstraintEditDialog } from "@/components/dialogs/settings/constraints/ConstraintEditDialog"
import { StationEditDialog } from "@/components/dialogs/settings/stations/StationEditDialog"
import { DuplicateStationDialog } from "@/components/dialogs/settings/stations/DuplicateStationDialog"
import { StationFilterPopover } from "./ManagerSchedule/components/StationFilterPopover"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import type { ProposedMeetingModalSubmission, ProposedMeetingInitialData } from "@/components/dialogs/manager-schedule/ProposedMeetingModal"
import type { AppointmentTimes } from "./ManagerSchedule/components/AppointmentDetailsSection"
import type { ProposedMeetingInvite } from "@/types/managerSchedule"
import { ProposeRescheduleModal } from "@/components/dialogs/manager-schedule/ProposeRescheduleModal"

const SERVICE_LABELS: Record<Exclude<ManagerServiceFilter, "both">, string> = {
  grooming: "מספרה",
  garden: "גן",
}

const SERVICE_STYLES: Record<Exclude<ManagerServiceFilter, "both">, { card: string; badge: string }> = {
  grooming: {
    card: "bg-blue-50 border-blue-200",
    badge: "border-blue-200 bg-blue-100 text-blue-800",
  },
  garden: {
    card: "bg-emerald-50 border-emerald-200",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
  },
}

// Utility function to snap time to the nearest interval
const snapTimeToInterval = (date: Date, intervalMinutes: number): Date => {
  const minutes = date.getMinutes()
  const remainder = minutes % intervalMinutes
  let snappedDate = date

  if (remainder !== 0) {
    if (remainder < intervalMinutes / 2) {
      snappedDate = addMinutes(date, -remainder)
    } else {
      snappedDate = addMinutes(date, intervalMinutes - remainder)
    }
  }
  return setSeconds(setMilliseconds(snappedDate, 0), 0)
}

type DragToCreateState = {
  isDragging: boolean
  startTime: Date | null
  endTime: Date | null
  stationId: string | null
  startY: number | null
  cancelled: boolean
}

type ResizeState = {
  appointment: ManagerAppointment
  startY: number
  startDate: Date
  initialEnd: Date
  currentEnd: Date
  pointerId: number
}

type ConstraintResizeState = {
  constraint: {
    id: string
    station_id: string
    start_at: string
    end_at: string
    reason?: string | null
    notes?: string | null
  }
  startY: number
  startDate: Date
  initialEnd: Date
  currentEnd: Date
  pointerId: number
}

type WaitlistServiceScope = "grooming" | "daycare" | "both"

interface ManagerWaitlistEntry {
  id: string
  treatmentId: string
  treatmentName: string
  treatmentRecordId?: string | null
  treatmentRecordNumber?: string | null
  treatmentTypeName?: string | null
  customerId: string
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  customerTypeId?: string | null
  customerTypeName?: string | null
  treatmentTypes: Array<{ id: string; name: string }>
  treatmentCategories: Array<{ id: string; name: string }>
  serviceScope: WaitlistServiceScope
  startDate: string
  endDate: string | null
  notes?: string | null
}

type WaitlistBucketGroup = {
  id: string
  label: string
  entries: ManagerWaitlistEntry[]
}

type ScheduleSearchResultType = "treatment" | "client" | "personal" | "appointment"

type ScheduleSearchEntry = {
  id: string
  appointment?: ManagerAppointment
  treatment?: ManagerTreatment
  ownerName?: string
  stationName?: string
  serviceType: ManagerAppointment["serviceType"]
  serviceLabel: string
  appointmentDate?: Date | null
  dateLabel: string
  timeLabel?: string
  entityType: ScheduleSearchResultType
  clientName?: string
  clientDetails?: ClientDetails
  searchText: string
}

interface ClientDetails {
  name: string
  classification?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  preferences?: string
  recordId?: string
  recordNumber?: string
}

interface TreatmentDetails {
  id: string
  name: string
  treatmentType?: string
  clientClassification?: string
  owner?: ClientDetails
  age?: string
  weight?: string
  gender?: string
  notes?: string
  medicalNotes?: string
  importantNotes?: string
  internalNotes?: string
  vetName?: string
  vetPhone?: string
  healthIssues?: string
  birthDate?: string
  tendsToBite?: string
  aggressiveWithOtherTreatments?: string
  hasBeenToGarden?: boolean
  suitableForGardenFromQuestionnaire?: boolean
  notSuitableForGardenFromQuestionnaire?: boolean
  recordId?: string
  recordNumber?: string
}

const STATUS_STYLE_MAP = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-slate-200 bg-slate-50 text-slate-700",
}

const getStatusStyle = (status: string, appointment?: ManagerAppointment): string => {
  const normalized = status.toLowerCase()

  if (
    normalized.includes("cancel") ||
    normalized.includes("בוטל") ||
    normalized.includes("מבוטל") ||
    normalized.includes("לא הגיע")
  ) {
    return STATUS_STYLE_MAP.danger
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("ממתין") ||
    normalized.includes("בהמתנה") ||
    normalized.includes("מחכה")
  ) {
    return STATUS_STYLE_MAP.warning
  }

  if (
    normalized.includes("confirm") ||
    normalized.includes("מאושר") ||
    normalized.includes("הושלם") ||
    normalized.includes("מאשר")
  ) {
    // For trial garden appointments, use amber colors instead of emerald
    if (appointment?.serviceType === "garden" && appointment?.gardenIsTrial) {
      return "border-amber-200 bg-amber-50 text-amber-700"
    }
    return STATUS_STYLE_MAP.success
  }

  return STATUS_STYLE_MAP.info
}

const isAppointmentPaid = (paymentStatus?: string): boolean => {
  if (!paymentStatus) return false
  const normalized = paymentStatus.toLowerCase()
  return normalized.includes("שולם") || normalized.includes("paid")
}

const isAppointmentCompleted = (status: string): boolean => {
  const normalized = status.toLowerCase()
  return normalized.includes("הושלם") || normalized.includes("completed")
}

const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 20
const PIXELS_PER_MINUTE_SCALE = [0.8, 1.2, 1.6, 2.0, 2.4] // Scale 1-5 values
const DEFAULT_PIXELS_PER_MINUTE_SCALE = 3 // Default to middle (scale 3)
const DEFAULT_INTERVAL_MINUTES = 15
const MAX_VISIBLE_STATIONS = 5
const WAITLIST_VISIBILITY_STORAGE_KEY = "manager-schedule-waitlist-visible"
const WAITLIST_COLUMN_WIDTH = 180
const WAITLIST_DEFAULT_DURATION_MINUTES = 60
const UNCLASSIFIED_CUSTOMER_TYPE_ID = "uncategorized-customer-type"
const UNCLASSIFIED_CATEGORY_ID = "uncategorized-treatment-category"
const UNCLASSIFIED_TREATMENT_TYPE_ID = "uncategorized-treatment-type"
const WAITLIST_SCOPE_META: Record<
  WaitlistServiceScope,
  { label: string; badgeClass: string }
> = {
  grooming: {
    label: "מספרה",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-100",
  },
  daycare: {
    label: "גן",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  both: {
    label: "מספרה + גן",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-100",
  },
}

const INITIAL_LOADER_DELAY_MS = 200
const SNAPSHOT_STORAGE_KEY = "managerSchedule:snapshots:v1"
const MAX_SNAPSHOT_ENTRIES = 8

type ManagerScheduleSnapshotEntry = {
  data: ManagerScheduleData
  storedAt: number
}

type ManagerScheduleSnapshotIndex = Record<string, ManagerScheduleSnapshotEntry>

let managerScheduleSnapshotIndex: ManagerScheduleSnapshotIndex | null = null

function getSessionStorage(): Storage | null {
  try {
    const candidate = (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage
    return candidate ?? null
  } catch {
    return null
  }
}

function loadManagerScheduleSnapshotIndex(): ManagerScheduleSnapshotIndex {
  if (managerScheduleSnapshotIndex) {
    return managerScheduleSnapshotIndex
  }

  managerScheduleSnapshotIndex = {}

  const sessionStorage = getSessionStorage()
  if (!sessionStorage) {
    return managerScheduleSnapshotIndex
  }

  try {
    const raw = sessionStorage.getItem(SNAPSHOT_STORAGE_KEY)
    if (!raw) {
      return managerScheduleSnapshotIndex
    }

    const parsed = JSON.parse(raw) as ManagerScheduleSnapshotIndex
    if (parsed && typeof parsed === "object") {
      managerScheduleSnapshotIndex = parsed
    }
  } catch (error) {
    console.warn("[ManagerSchedule] Failed to load snapshot cache from sessionStorage", error)
    managerScheduleSnapshotIndex = {}
  }

  return managerScheduleSnapshotIndex
}

function getManagerScheduleSnapshot(key: string): ManagerScheduleData | null {
  const index = loadManagerScheduleSnapshotIndex()
  const snapshot = index[key]
  if (!snapshot) {
    return null
  }
  return snapshot.data
}

function setManagerScheduleSnapshot(key: string, data: ManagerScheduleData) {
  const index = loadManagerScheduleSnapshotIndex()
  index[key] = {
    data,
    storedAt: Date.now(),
  }

  const sessionStorage = getSessionStorage()
  if (sessionStorage) {
    try {
      const entries = Object.entries(index)
      if (entries.length > MAX_SNAPSHOT_ENTRIES) {
        const sorted = entries.sort((a, b) => a[1].storedAt - b[1].storedAt)
        const trimmed = sorted.slice(sorted.length - MAX_SNAPSHOT_ENTRIES)
        managerScheduleSnapshotIndex = Object.fromEntries(trimmed)
      }
      sessionStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(loadManagerScheduleSnapshotIndex()))
    } catch (error) {
      console.warn("[ManagerSchedule] Failed to persist snapshot cache to sessionStorage", error)
    }
  }
}

const parseISODate = (value?: string | null): Date | null => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getAppointmentDates = (
  appointment: Pick<ManagerAppointment, "id" | "startDateTime" | "endDateTime">
): { start: Date; end: Date } | null => {
  const start = parseISODate(appointment.startDateTime)
  const end = parseISODate(appointment.endDateTime)

  if (!start || !end) {
    console.warn("Skipping appointment with invalid dates", {
      appointmentId: appointment.id,
      start: appointment.startDateTime,
      end: appointment.endDateTime,
    })
    return null
  }

  return { start, end }
}

interface TimelineSlot {
  offset: number
  height: number
  label: string
}

interface TimelineConfig {
  start: Date
  end: Date
  totalMinutes: number
  height: number
  hourMarkers: { label: string; offset: number }[]
  slots: TimelineSlot[]
}

const getErrorMessage = (error: unknown): string => {
  if (!error) return ""

  if (typeof error === "string") return error

  if (typeof error === "object" && error !== null) {
    if ("data" in error && typeof (error as { data?: unknown }).data === "string") {
      return (error as { data: string }).data
    }
    if ("error" in error && typeof (error as { error?: unknown }).error === "string") {
      return (error as { error: string }).error
    }
    if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message
    }
  }

  return "אירעה שגיאה בטעינת הנתונים."
}

const buildTimeline = (
  selectedDate: Date,
  data: ManagerScheduleData | undefined,
  intervalMinutes: number,
  pixelsPerMinuteScale: number,
  optimisticAppointments: ManagerAppointment[] = [],
  globalEndHour?: number
): TimelineConfig => {
  const dayStart = startOfDay(selectedDate)
  let start = addHours(dayStart, DEFAULT_START_HOUR)
  // Use global end hour if provided, otherwise use default
  let end = addHours(dayStart, globalEndHour ?? DEFAULT_END_HOUR)

  const appointments = [...(data?.appointments ?? []), ...optimisticAppointments]
  const globalEnd = addHours(dayStart, globalEndHour ?? DEFAULT_END_HOUR)

  if (appointments.length > 0) {
    const validStarts = appointments
      .map((appointment) => parseISODate(appointment.startDateTime))
      .filter((date): date is Date => !!date)
    const validEnds = appointments
      .map((appointment) => parseISODate(appointment.endDateTime))
      .filter((date): date is Date => !!date)

    if (validStarts.length > 0) {
      start = min([start, ...validStarts])
    }
  }

  // Always cap timeline at global end hour - never extend beyond it, regardless of appointments
  end = globalEnd

  if (end <= start) {
    end = addHours(start, 1)
  }

  const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
  const totalMinutes = Math.max(60, differenceInMinutes(end, start))
  const height = totalMinutes * pixelsPerMinute

  const hourMarkers: { label: string; offset: number }[] = []
  let markerCursor = start
  while (markerCursor <= end) {
    const offset = differenceInMinutes(markerCursor, start) * pixelsPerMinute
    hourMarkers.push({ label: format(markerCursor, "HH:mm"), offset })
    markerCursor = addHours(markerCursor, 1)
  }

  const slots: TimelineSlot[] = []
  let slotCursor = start
  while (slotCursor < end) {
    const slotEnd = min([end, addMinutes(slotCursor, intervalMinutes)])
    const offset = differenceInMinutes(slotCursor, start) * pixelsPerMinute
    const heightPx = Math.max(1, differenceInMinutes(slotEnd, slotCursor) * pixelsPerMinute)
    slots.push({ offset, height: heightPx, label: format(slotCursor, "HH:mm") })
    slotCursor = slotEnd
  }

  return { start, end, totalMinutes, height, hourMarkers, slots }
}
const ManagerSchedule = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()

  const previousScrollRestorationRef = useRef<History["scrollRestoration"] | null>(null)

  useLayoutEffect(() => {
    const history = globalThis?.history
    if (!history || typeof history.scrollRestoration === "undefined") {
      return
    }

    previousScrollRestorationRef.current = history.scrollRestoration
    history.scrollRestoration = "manual"

    return () => {
      history.scrollRestoration = previousScrollRestorationRef.current ?? "auto"
    }
  }, [])

  useLayoutEffect(() => {
    const params = new URLSearchParams(location.search)
    const skipParamKeys = [
      "highlightAppointment",
      "focusAppointment",
      "previewWaitlist",
      "scrollTarget",
      "constraintFocus"
    ]

    const skipReason = skipParamKeys.find((key) => params.has(key)) ?? null
    const locationState = (location.state as { preserveManagerScroll?: boolean } | null) ?? null
    const shouldPreserveScroll = Boolean(skipReason) || Boolean(locationState?.preserveManagerScroll)

    if (shouldPreserveScroll) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[ManagerSchedule] Preserving scroll position", {
          pathname: location.pathname,
          search: location.search,
          reason: skipReason ? `query:${skipReason}` : "location-state",
          preserveManagerScroll: locationState?.preserveManagerScroll ?? false
        })
      }
      return
    }

    const scrollingElement =
      globalThis?.document?.scrollingElement ??
      globalThis?.document?.documentElement ??
      null

    if (scrollingElement) {
      scrollingElement.scrollTop = 0
      scrollingElement.scrollLeft = 0
    } else if (typeof window !== "undefined") {
      window.scrollTo(0, 0)
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[ManagerSchedule] Forced scroll to top", {
        pathname: location.pathname,
        search: location.search,
        timestamp: typeof performance !== "undefined" ? performance.now() : Date.now()
      })
    }
  }, [location.key, location.pathname, location.search])

  // Initialize state from URL parameters
  const getDateFromParams = () => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      const parsedDate = new Date(dateParam)
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate
      }
    }
    return new Date()
  }

  const getVisibleStationsFromParams = () => {
    const stationsParam = searchParams.get('stations')
    if (stationsParam) {
      try {
        return stationsParam.split(',').filter(Boolean)
      } catch {
        return []
      }
    }
    return []
  }

  const getZoomFromParams = () => {
    const zoomParam = searchParams.get('zoom')
    if (zoomParam) {
      const parsedZoom = parseInt(zoomParam)
      if (!isNaN(parsedZoom) && parsedZoom >= 1 && parsedZoom <= 5) {
        return parsedZoom
      }
    }
    return DEFAULT_PIXELS_PER_MINUTE_SCALE
  }

  const getServiceFilterFromParams = () => {
    const filterParam = searchParams.get('filter')
    if (filterParam && ['grooming', 'garden', 'both'].includes(filterParam)) {
      return filterParam as ManagerServiceFilter
    }
    return "both"
  }

  const [selectedDate, setSelectedDate] = useState<Date>(() => getDateFromParams())
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(getDateFromParams()))
  const [serviceFilter, setServiceFilter] = useState<ManagerServiceFilter>(getServiceFilterFromParams())
  const [visibleStationIds, setVisibleStationIds] = useState<string[]>(() => {
    const fromParams = getVisibleStationsFromParams()
    if (fromParams.length > 0) {
      return fromParams
    }
    const initialDate = getDateFromParams()
    const snapshot = getManagerScheduleSnapshot(`date:${format(initialDate, "yyyy-MM-dd")}`)
    if (snapshot?.stations?.length) {
      return snapshot.stations.map((station) => station.id)
    }
    return []
  })
  const [stationOrderIds, setStationOrderIds] = useState<string[]>(() => {
    const initialDate = getDateFromParams()
    const snapshot = getManagerScheduleSnapshot(`date:${format(initialDate, "yyyy-MM-dd")}`)
    if (snapshot?.stations?.length) {
      return snapshot.stations.map((station) => station.id)
    }
    return []
  })
  const [isStationOrderSaving, setIsStationOrderSaving] = useState(false)
  const [stationWindowStart, setStationWindowStart] = useState(0)
  const [intervalMinutes, setIntervalMinutes] = useState<number>(DEFAULT_INTERVAL_MINUTES)
  const [pixelsPerMinuteScale, setPixelsPerMinuteScale] = useState<number>(getZoomFromParams())
  const [selectedAppointment, setSelectedAppointment] = useState<ManagerAppointment | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const handleJumpToToday = useCallback(() => {
    const today = new Date()
    setSelectedDate(today)
    setCalendarMonth(startOfMonth(today))
  }, [])

  const handlePreviousDay = useCallback(() => {
    const targetDate = addDays(selectedDate, -1)
    setSelectedDate(targetDate)
  }, [selectedDate])

  const handleNextDay = useCallback(() => {
    const targetDate = addDays(selectedDate, 1)
    setSelectedDate(targetDate)
  }, [selectedDate])

  const handlePreviousWeek = useCallback(() => {
    const targetDate = addDays(selectedDate, -7)
    setSelectedDate(targetDate)
  }, [selectedDate])

  const handleNextWeek = useCallback(() => {
    const targetDate = addDays(selectedDate, 7)
    setSelectedDate(targetDate)
  }, [selectedDate])

  useEffect(() => {
    const selectedMonthStart = startOfMonth(selectedDate)
    setCalendarMonth(prevMonth => {
      if (
        prevMonth.getFullYear() !== selectedMonthStart.getFullYear() ||
        prevMonth.getMonth() !== selectedMonthStart.getMonth()
      ) {
        return selectedMonthStart
      }
      return prevMonth
    })
  }, [selectedDate])
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentDetails | null>(null)
  const [isTreatmentDetailsOpen, setIsTreatmentDetailsOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientDetails | null>(null)
  const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false)
  const [showAllPastAppointments, setShowAllPastAppointments] = useState(false)
  const [draggedAppointment, setDraggedAppointment] = useState<{
    appointment: ManagerAppointment | null
    cancelled: boolean
  }>({
    appointment: null,
    cancelled: false
  })
  const [draggedConstraint, setDraggedConstraint] = useState<{
    constraint: typeof constraints[0] | null
    cancelled: boolean
  }>({
    constraint: null,
    cancelled: false
  })
  const [selectedConstraint, setSelectedConstraint] = useState<typeof constraints[0] | null>(null)
  const [isConstraintDetailsOpen, setIsConstraintDetailsOpen] = useState(false)
  const [moveConfirmationOpen, setMoveConfirmationOpen] = useState(false)
  const [moveLoading, setMoveLoading] = useState(false)
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<ManagerAppointment | null>(null)
  const [updateCustomer, setUpdateCustomer] = useState(false)
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState<ManagerAppointment | null>(null)
  const [updateCustomerCancel, setUpdateCustomerCancel] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [duplicateSeriesOpen, setDuplicateSeriesOpen] = useState(false)
  const [appointmentToDuplicate, setAppointmentToDuplicate] = useState<ManagerAppointment | null>(null)
  const [duplicateLoading, setDuplicateLoading] = useState(false)
  const [duplicateSuccessOpen, setDuplicateSuccessOpen] = useState(false)
  const [isLoadingAppointment, setIsLoadingAppointment] = useState(false)

  // New garden appointment modal state
  const [newGardenAppointmentModalOpen, setNewGardenAppointmentModalOpen] = useState(false)
  const [newGardenAppointmentType, setNewGardenAppointmentType] = useState<'full-day' | 'hourly' | 'trial' | null>(null)

  // Service type selection modal state
  const [showServiceTypeSelectionModal, setShowServiceTypeSelectionModal] = useState(false)

  // Treatment appointments modal state
  const [showTreatmentAppointmentsModal, setShowTreatmentAppointmentsModal] = useState(false)
  const [selectedTreatmentForAppointments, setSelectedTreatmentForAppointments] = useState<{ id: string; name: string } | null>(null)

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedAppointmentForPayment, setSelectedAppointmentForPayment] = useState<ManagerAppointment | null>(null)
  const [showProposedMeetingModal, setShowProposedMeetingModal] = useState(false)
  const [proposedMeetingMode, setProposedMeetingMode] = useState<"create" | "edit">("create")
  const [proposedMeetingTimes, setProposedMeetingTimes] = useState<AppointmentTimes | null>(null)
  const [editingProposedMeeting, setEditingProposedMeeting] = useState<ManagerAppointment | null>(null)
  const [showRescheduleProposalModal, setShowRescheduleProposalModal] = useState(false)
  const [rescheduleTargetAppointment, setRescheduleTargetAppointment] = useState<ManagerAppointment | null>(null)
  const [rescheduleTimes, setRescheduleTimes] = useState<AppointmentTimes | null>(null)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null)
  const [sendingAllInvites, setSendingAllInvites] = useState(false)
  const [isDeletingProposed, setIsDeletingProposed] = useState(false)
  const [sendingCategoryId, setSendingCategoryId] = useState<string | null>(null)
  const [sendingCategoriesBatch, setSendingCategoriesBatch] = useState(false)

  interface CreatedAppointment {
    startTime: string
    endTime: string
    recordID: string
    serviceType: string
    appointmentId: string
    appointmentType: string
  }
  const [createdAppointments, setCreatedAppointments] = useState<CreatedAppointment[]>([])
  const [isCancelling, setIsCancelling] = useState(false)
  const [moveDetails, setMoveDetails] = useState<{
    appointment: ManagerAppointment
    oldStation: ManagerStation
    newStation: ManagerStation
    oldStartTime: Date
    oldEndTime: Date
    newStartTime: Date
    newEndTime: Date
    newGardenAppointmentType?: 'full-day' | 'hourly' | 'trial'
    newGardenIsTrial?: boolean
    selectedHours?: { start: string; end: string }
  } | null>(null)
  const [hourlyTimeSelection, setHourlyTimeSelection] = useState<{ start: string; end: string } | null>(null)
  const [highlightedSlots, setHighlightedSlots] = useState<{
    stationId: string
    startTimeSlot: number
    endTimeSlot: number
    allTimeSlots: number[]
  } | null>(null)
  const [scheduleSearchTerm, setScheduleSearchTerm] = useState("")
  const [isScheduleSearchOpen, setIsScheduleSearchOpen] = useState(false)
  const [isScheduleSearchExpanded, setIsScheduleSearchExpanded] = useState(false)
  const scheduleSearchContainerRef = useRef<HTMLDivElement | null>(null)
  const scheduleSearchDropdownRef = useRef<HTMLDivElement | null>(null)
  const scheduleSearchInputRef = useRef<HTMLInputElement | null>(null)
  const scheduleSearchResultsRefs = useRef<Array<HTMLDivElement | null>>([])
  const [scheduleDropdownStyle, setScheduleDropdownStyle] = useState<{ left: number; top: number; width: number } | null>(null)
  const trimmedScheduleSearchTerm = scheduleSearchTerm.trim()
  const normalizedScheduleSearchTerm = trimmedScheduleSearchTerm.toLowerCase()
  const hasScheduleSearchQuery = trimmedScheduleSearchTerm.length > 0
  const debouncedScheduleSearchTerm = useDebounce(trimmedScheduleSearchTerm, 300)
  const [triggerScheduleSearch, { isFetching: isScheduleSearchLoading }] = useLazySearchManagerScheduleQuery()
  const [remoteScheduleSearchResults, setRemoteScheduleSearchResults] = useState<ManagerScheduleSearchResponse>({
    appointments: [],
    treatments: [],
    clients: [],
  })
  const [scheduleSearchError, setScheduleSearchError] = useState<string | null>(null)
  const latestScheduleSearchTermRef = useRef<string>("")
  const [scheduleSearchActiveIndex, setScheduleSearchActiveIndex] = useState(-1)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const container = scheduleSearchContainerRef.current
      const dropdown = scheduleSearchDropdownRef.current
      if (!container && !dropdown) {
        return
      }
      const target = event.target as Node
      const clickedInsideInput = container?.contains(target)
      const clickedInsideDropdown = dropdown?.contains(target)
      if (!clickedInsideInput && !clickedInsideDropdown) {
        setIsScheduleSearchOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
    }
  }, [])

  useEffect(() => {
    if (!debouncedScheduleSearchTerm) {
      setRemoteScheduleSearchResults({
        appointments: [],
        treatments: [],
        clients: [],
      })
      setScheduleSearchError(null)
      latestScheduleSearchTermRef.current = ""
      return
    }

    latestScheduleSearchTermRef.current = debouncedScheduleSearchTerm
    setScheduleSearchError(null)

    const searchPromise = triggerScheduleSearch({ term: debouncedScheduleSearchTerm, limit: 20 })

    searchPromise
      .unwrap()
      .then((results) => {
        if (latestScheduleSearchTermRef.current === debouncedScheduleSearchTerm) {
          setRemoteScheduleSearchResults(results)
        }
      })
      .catch((error: unknown) => {
        if (latestScheduleSearchTermRef.current === debouncedScheduleSearchTerm) {
          console.error("Error searching schedule:", error)
          const fallbackMessage =
            typeof error === "object" &&
              error !== null &&
              "data" in error &&
              typeof (error as { data?: unknown }).data === "string"
              ? (error as { data: string }).data
              : "אירעה שגיאה במהלך החיפוש. נסו שוב."
          setScheduleSearchError(fallbackMessage)
          setRemoteScheduleSearchResults({
            appointments: [],
            treatments: [],
            clients: [],
          })
        }
      })

    return () => {
      if (typeof searchPromise.abort === "function") {
        searchPromise.abort()
      }
    }
  }, [debouncedScheduleSearchTerm, triggerScheduleSearch])

  // Garden edit modal state
  const [gardenEditOpen, setGardenEditOpen] = useState(false)
  const [gardenEditLoading, setGardenEditLoading] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<ManagerAppointment | null>(null)
  const [updateCustomerGarden, setUpdateCustomerGarden] = useState(false)

  // Grooming edit modal state
  const [groomingEditOpen, setGroomingEditOpen] = useState(false)
  const [groomingEditLoading, setGroomingEditLoading] = useState(false)
  const [editingGroomingAppointment, setEditingGroomingAppointment] = useState<ManagerAppointment | null>(null)
  const [updateCustomerGrooming, setUpdateCustomerGrooming] = useState(false)
  const [updateCustomerMove, setUpdateCustomerMove] = useState(false)
  const [groomingEditForm, setGroomingEditForm] = useState<{
    date: Date
    startTime: string
    stationId: string
    notes: string
    internalNotes: string
  }>({
    date: new Date(),
    startTime: '',
    stationId: '',
    notes: '',
    internalNotes: ''
  })

  // Pending resize state for modal confirmation
  const [pendingResizeState, setPendingResizeState] = useState<{
    appointment: ManagerAppointment
    originalEndTime: Date
    newEndTime: Date
    originalDuration: number
    newDuration: number
  } | null>(null)

  // Expanded cards state for showing full details
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [expandedConstraints, setExpandedConstraints] = useState<Set<string>>(new Set())

  // Drag-to-create appointment state
  const [dragToCreate, setDragToCreate] = useState<DragToCreateState>({
    isDragging: false,
    startTime: null,
    endTime: null,
    stationId: null,
    startY: null,
    cancelled: false
  })
  const dragToCreateRef = useRef<DragToCreateState>(dragToCreate)
  const resizeStateRef = useRef<ResizeState | null>(null)
  const constraintResizeStateRef = useRef<ConstraintResizeState | null>(null)
  const headerScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const contentScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const isSyncingHorizontalScrollRef = useRef(false)
  const customerTypeSuggestionsRef = useRef<Record<string, { id: string; name: string }>>({})
  const treatmentCategorySuggestionsRef = useRef<Record<string, { id: string; name: string }>>({})
  const treatmentTypeSuggestionsRef = useRef<Record<string, { id: string; name: string }>>({})
  const initialLoaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [resizingPreview, setResizingPreview] = useState<{ appointmentId: string; endDate: Date } | null>(null)
  const [constraintResizingPreview, setConstraintResizingPreview] = useState<{ constraintId: string; endDate: Date } | null>(null)
  const [showAppointmentTypeSelection, setShowAppointmentTypeSelection] = useState(false)
  const [finalizedDragTimes, setFinalizedDragTimes] = useState<{
    startTime: Date | null
    endTime: Date | null
    stationId: string | null
  } | null>(null)
  const [showPrivateAppointmentModal, setShowPrivateAppointmentModal] = useState(false)
  const [showBusinessAppointmentModal, setShowBusinessAppointmentModal] = useState(false)
  const [privateAppointmentForm, setPrivateAppointmentForm] = useState({
    name: '',
    selectedStations: [] as string[]
  })
  const [optimisticAppointments, setOptimisticAppointments] = useState<ManagerAppointment[]>([])
  const [gardenEditForm, setGardenEditForm] = useState({
    date: new Date(),
    startTime: '09:00',
    endTime: '10:00',
    appointmentType: 'hourly' as 'full-day' | 'hourly' | 'trial',
    notes: '',
    internalNotes: '',
    latePickupRequested: false,
    latePickupNotes: '',
    gardenTrimNails: false,
    gardenBrush: false,
    gardenBath: false,
  })
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [lastHighlightUpdate, setLastHighlightUpdate] = useState<number>(0)

  // Waiting list column state
  const [showWaitingListColumn, setShowWaitingListColumn] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true
    }
    const stored = window.localStorage.getItem(WAITLIST_VISIBILITY_STORAGE_KEY)
    return stored ? stored === "true" : true
  })
  const [waitingListEntries, setWaitingListEntries] = useState<ManagerWaitlistEntry[]>([])
  const [isLoadingWaitingList, setIsLoadingWaitingList] = useState(false)
  const [waitingListError, setWaitingListError] = useState<string | null>(null)
  const [waitingListSearchTerm, setWaitingListSearchTerm] = useState("")
  const [selectedCustomerTypes, setSelectedCustomerTypes] = useState<Array<{ id: string; name: string }>>([])
  const [selectedTreatmentCategories, setSelectedTreatmentCategories] = useState<Array<{ id: string; name: string }>>([])
  const [selectedTreatmentTypes, setSelectedTreatmentTypes] = useState<Array<{ id: string; name: string }>>([])
  const [customerTypeQuery, setCustomerTypeQuery] = useState("")
  const [treatmentCategoryQuery, setTreatmentCategoryQuery] = useState("")
  const [treatmentTypeQuery, setTreatmentTypeQuery] = useState("")
  const [waitingListLastUpdated, setWaitingListLastUpdated] = useState<Date | null>(null)
  const [waitlistSection, setWaitlistSection] = useState<string | null>("client-types")
  const [activeWaitlistBucket, setActiveWaitlistBucket] = useState<string | null>(null)
  const [draggedWaitlistEntry, setDraggedWaitlistEntry] = useState<{
    entry: ManagerWaitlistEntry | null
    cancelled: boolean
  }>({
    entry: null,
    cancelled: false
  })
  const [pendingWaitlistPlacement, setPendingWaitlistPlacement] = useState<{
    entry: ManagerWaitlistEntry
    stationId: string
    startTime: Date
    endTime: Date
  } | null>(null)
  const [showWaitlistDropDialog, setShowWaitlistDropDialog] = useState(false)
  const [shouldRemoveFromWaitlist, setShouldRemoveFromWaitlist] = useState(true)
  const [pendingWaitlistEntryId, setPendingWaitlistEntryId] = useState<string | null>(null)
  const [prefillBusinessCustomer, setPrefillBusinessCustomer] = useState<ManagerCustomer | null>(null)
  const [prefillBusinessTreatment, setPrefillBusinessTreatment] = useState<ManagerTreatmentSelect | null>(null)

  // Functions to update URL parameters
  const updateURLParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        newParams.delete(key)
      } else {
        newParams.set(key, value)
      }
    })

    setSearchParams(newParams, { replace: true })
  }

  useEffect(() => {
    dragToCreateRef.current = dragToCreate
  }, [dragToCreate])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    window.localStorage.setItem(WAITLIST_VISIBILITY_STORAGE_KEY, JSON.stringify(showWaitingListColumn))
  }, [showWaitingListColumn])

  // Update URL when selectedDate changes
  useEffect(() => {
    const dateString = format(selectedDate, 'yyyy-MM-dd')
    updateURLParams({ date: dateString })
  }, [selectedDate])

  // Update URL when visibleStationIds changes
  useEffect(() => {
    if (visibleStationIds.length > 0) {
      updateURLParams({ stations: visibleStationIds.join(',') })
    } else {
      updateURLParams({ stations: null })
    }
  }, [visibleStationIds])

  // Update URL when pixelsPerMinuteScale changes
  useEffect(() => {
    updateURLParams({ zoom: pixelsPerMinuteScale.toString() })
  }, [pixelsPerMinuteScale])

  // Update URL when serviceFilter changes
  useEffect(() => {
    if (serviceFilter !== "both") {
      updateURLParams({ filter: serviceFilter })
    } else {
      updateURLParams({ filter: null })
    }
  }, [serviceFilter])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const stationReorderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  )

  const formattedDate = format(selectedDate, "yyyy-MM-dd")
  const formattedCurrentDateLabel = useMemo(
    () => format(selectedDate, "EEEE, d MMMM yyyy", { locale: he }),
    [selectedDate]
  )
  const waitingListDateLabel = useMemo(
    () => format(selectedDate, "EEEE, d MMMM", { locale: he }),
    [selectedDate]
  )
  const waitingListLastUpdatedLabel = useMemo(
    () => (waitingListLastUpdated ? format(waitingListLastUpdated, "HH:mm") : "—"),
    [waitingListLastUpdated]
  )
  const waitingListActiveFiltersCount = useMemo(() => {
    return (
      (waitingListSearchTerm.trim() ? 1 : 0) +
      selectedCustomerTypes.length +
      selectedTreatmentCategories.length +
      selectedTreatmentTypes.length
    )
  }, [waitingListSearchTerm, selectedCustomerTypes.length, selectedTreatmentCategories.length, selectedTreatmentTypes.length])
  const waitlistHasFilters = waitingListActiveFiltersCount > 0
  const waitlistHasEntries = waitingListEntries.length > 0

  const proposedModalInitialData = useMemo<ProposedMeetingInitialData | null>(() => {
    if (!editingProposedMeeting?.proposedMeetingId) {
      return null
    }
    return {
      meetingId: editingProposedMeeting.proposedMeetingId,
      title: editingProposedMeeting.proposedTitle,
      summary: editingProposedMeeting.proposedSummary,
      notes: editingProposedMeeting.proposedNotes,
      stationId: editingProposedMeeting.stationId,
      serviceType: editingProposedMeeting.serviceType,
      startDateTime: editingProposedMeeting.startDateTime,
      endDateTime: editingProposedMeeting.endDateTime,
      manualInvites:
        editingProposedMeeting.proposedInvites
          ?.filter((invite) => invite.source === "manual" && invite.customerId)
          .map((invite) => ({
            id: invite.customerId!,
            fullName: invite.customerName,
            phone: invite.clientPhone,
            email: invite.clientEmail,
          })) ?? [],
      customerTypeIds:
        editingProposedMeeting.proposedCategories?.map((category) => category.customerTypeId).filter((id): id is string => Boolean(id)) ?? [],
      code: editingProposedMeeting.proposedMeetingCode,
    }
  }, [editingProposedMeeting])

  const snapshotKey = useMemo(() => `date:${formattedDate}`, [formattedDate])
  const initialSnapshot = useMemo(() => getManagerScheduleSnapshot(snapshotKey), [snapshotKey])
  const [displayData, setDisplayData] = useState<ManagerScheduleData | null>(initialSnapshot)
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(() => initialSnapshot !== null)
  const [showInitialLoader, setShowInitialLoader] = useState(false)
  const { data: apiData, error, isLoading, isFetching, refetch } = useGetManagerScheduleQuery({
    date: formattedDate,
    serviceType: "both", // Always fetch all data, filter on frontend
  })
  const scheduleErrorMessage = useMemo(() => getErrorMessage(error), [error])

  useEffect(() => {
    if (apiData) {
      setDisplayData(apiData)
      setManagerScheduleSnapshot(snapshotKey, apiData)
    }
  }, [apiData, snapshotKey])

  const data = displayData

  useEffect(() => {
    if (typeof setTimeout !== "function" || typeof clearTimeout !== "function") {
      return
    }

    if (!hasLoadedInitialData && isLoading) {
      if (initialLoaderTimerRef.current !== null) {
        clearTimeout(initialLoaderTimerRef.current)
      }

      initialLoaderTimerRef.current = setTimeout(() => {
        setShowInitialLoader(true)
        console.log("[ManagerSchedule] מציג מצב טעינה ראשוני לאחר השהייה", {
          delayMs: INITIAL_LOADER_DELAY_MS,
          selectedDate: formattedDate,
        })
      }, INITIAL_LOADER_DELAY_MS)

      return () => {
        if (initialLoaderTimerRef.current !== null) {
          clearTimeout(initialLoaderTimerRef.current)
          initialLoaderTimerRef.current = null
        }
      }
    }

    if (initialLoaderTimerRef.current !== null) {
      clearTimeout(initialLoaderTimerRef.current)
      initialLoaderTimerRef.current = null
    }

    if (showInitialLoader) {
      setShowInitialLoader(false)
      console.log("[ManagerSchedule] סיום הצגת מצב הטעינה הראשוני", {
        selectedDate: formattedDate,
      })
    }

    if (!isLoading && data && !hasLoadedInitialData) {
      console.log("[ManagerSchedule] הנתונים הראשוניים נטענו בהצלחה", {
        stations: data.stations?.length ?? 0,
        appointments: data.appointments?.length ?? 0,
      })
      setHasLoadedInitialData(true)
    }
  }, [isLoading, data, hasLoadedInitialData, showInitialLoader, formattedDate])

  useEffect(() => {
    if (!data?.stations) {
      setStationOrderIds([])
      return
    }

    setStationOrderIds((prev) => {
      const incoming = data.stations.map((station) => station.id)
      if (prev.length === 0) {
        return incoming
      }
      const preserved = prev.filter((id) => incoming.includes(id))
      const missing = incoming.filter((id) => !preserved.includes(id))
      if (missing.length === 0 && preserved.length === prev.length) {
        return prev
      }
      return [...preserved, ...missing]
    })
  }, [data?.stations])

  const stations = useMemo(() => {
    if (!data?.stations) {
      return []
    }

    if (!stationOrderIds.length) {
      return [...data.stations].sort((a, b) => {
        const orderCompare = (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        if (orderCompare !== 0) return orderCompare
        return a.name.localeCompare(b.name, "he")
      })
    }

    const positions = new Map(stationOrderIds.map((id, index) => [id, index]))
    const fallbackPosition = stationOrderIds.length

    return [...data.stations].sort((a, b) => {
      const posA = positions.has(a.id) ? positions.get(a.id)! : fallbackPosition
      const posB = positions.has(b.id) ? positions.get(b.id)! : fallbackPosition
      if (posA !== posB) return posA - posB
      const orderCompare = (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      if (orderCompare !== 0) return orderCompare
      return a.name.localeCompare(b.name, "he")
    })
  }, [data?.stations, stationOrderIds])
  const pendingPlacementStation = useMemo(() => {
    if (!pendingWaitlistPlacement) {
      return null
    }
    return stations.find((station) => station.id === pendingWaitlistPlacement.stationId) || null
  }, [pendingWaitlistPlacement, stations])

  const scheduleSearchTokens = useMemo(() => {
    if (!normalizedScheduleSearchTerm) {
      return []
    }
    return normalizedScheduleSearchTerm.split(/\s+/).filter(Boolean)
  }, [normalizedScheduleSearchTerm])

  const scheduleSearchEntries = useMemo<ScheduleSearchEntry[]>(() => {
    const entries: ScheduleSearchEntry[] = []
    const appointmentTreatmentIds = new Set<string>()

    remoteScheduleSearchResults.appointments.forEach((appointment) => {
      const appointmentDate = parseISODate(appointment.startDateTime)
      if (!appointmentDate) {
        return
      }

      const appointmentEndDate = parseISODate(appointment.endDateTime)
      const treatment = appointment.treatments?.[0]
      const ownerName = appointment.clientName || treatment?.clientName
      const serviceLabel = appointment.serviceType === "garden" ? "גן" : "מספרה"
      const isPersonal = appointment.isPersonalAppointment || (!treatment && appointment.appointmentType === "private")
      let entityType: ScheduleSearchResultType = "appointment"
      if (isPersonal) {
        entityType = "personal"
      } else if (treatment) {
        entityType = "treatment"
      } else if (ownerName) {
        entityType = "client"
      }

      appointment.treatments?.forEach((appointmentTreatment) => {
        if (appointmentTreatment?.id) {
          appointmentTreatmentIds.add(appointmentTreatment.id)
        }
      })

      const searchParts = [
        appointment.clientName,
        appointment.clientEmail,
        appointment.clientPhone,
        appointment.notes,
        appointment.internalNotes,
        appointment.personalAppointmentDescription,
        appointment.stationName,
        appointment.serviceType,
        appointment.serviceLabel,
        appointment.status,
        appointment.treatments?.map((d) => `${d.name} ${d.treatmentType} ${d.clientName}`).join(" "),
      ]

      entries.push({
        id: treatment ? `${appointment.id}-${treatment.id}` : appointment.id,
        appointment,
        treatment,
        ownerName: ownerName || undefined,
        stationName: appointment.stationName,
        serviceType: appointment.serviceType,
        serviceLabel,
        appointmentDate,
        dateLabel: format(appointmentDate, "EEEE, d MMMM yyyy", { locale: he }),
        timeLabel: appointmentEndDate
          ? `${format(appointmentDate, "HH:mm")} - ${format(appointmentEndDate, "HH:mm")}`
          : format(appointmentDate, "HH:mm"),
        entityType,
        clientName: appointment.clientName || undefined,
        searchText: searchParts
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })
    })

    remoteScheduleSearchResults.treatments.forEach(({ treatment, owner }) => {
      if (!treatment || appointmentTreatmentIds.has(treatment.id)) {
        return
      }
      const clientDetails = owner
        ? {
          name: owner.name,
          classification: owner.classification,
          customerTypeName: owner.customerTypeName,
          phone: owner.phone,
          email: owner.email,
          address: owner.address,
        }
        : undefined
      const searchParts = [
        treatment.name,
        treatment.treatmentType,
        clientDetails?.name,
        clientDetails?.phone,
        clientDetails?.email,
        clientDetails?.address,
        clientDetails?.classification,
      ]
      entries.push({
        id: `treatment-${treatment.id}`,
        treatment,
        ownerName: clientDetails?.name,
        serviceType: "grooming",
        serviceLabel: "כלב",
        appointmentDate: null,
        dateLabel: clientDetails?.phone ? `טלפון: ${clientDetails.phone}` : "כלב ללא תור ביומן",
        timeLabel: clientDetails?.email ? `דוא"ל: ${clientDetails.email}` : "",
        entityType: "treatment",
        clientName: clientDetails?.name,
        clientDetails,
        searchText: searchParts
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })
    })

    remoteScheduleSearchResults.clients.forEach((client) => {
      const clientDetails = {
        name: client.name,
        classification: client.classification,
        customerTypeName: client.customerTypeName,
        phone: client.phone,
        email: client.email,
        address: client.address,
      }
      const searchParts = [
        client.name,
        client.phone,
        client.email,
        client.address,
        client.classification,
        client.customerTypeName,
      ]
      entries.push({
        id: `client-${client.id}`,
        serviceType: "grooming",
        serviceLabel: "לקוח",
        appointmentDate: null,
        dateLabel: client.phone ? `טלפון: ${client.phone}` : "לקוח במערכת",
        timeLabel: client.email ? `דוא"ל: ${client.email}` : "",
        entityType: "client",
        ownerName: client.name,
        clientName: client.name,
        clientDetails,
        searchText: searchParts
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })
    })

    return entries
  }, [remoteScheduleSearchResults])

  const scheduleSearchResults = useMemo(() => {
    if (!scheduleSearchTokens.length) {
      return []
    }
    const filtered = scheduleSearchEntries.filter((entry) =>
      scheduleSearchTokens.every((token) => entry.searchText.includes(token))
    )
    return filtered.slice(0, 12)
  }, [scheduleSearchEntries, scheduleSearchTokens])

  const isScheduleSearchVisuallyExpanded = isScheduleSearchExpanded || hasScheduleSearchQuery || isScheduleSearchOpen
  const shouldShowScheduleSearchDropdown = isScheduleSearchOpen && isScheduleSearchVisuallyExpanded && hasScheduleSearchQuery

  useEffect(() => {
    scheduleSearchResultsRefs.current = scheduleSearchResultsRefs.current.slice(0, scheduleSearchResults.length)
  }, [scheduleSearchResults.length])

  useEffect(() => {
    setScheduleSearchActiveIndex(-1)
  }, [trimmedScheduleSearchTerm])

  useEffect(() => {
    if (!shouldShowScheduleSearchDropdown || scheduleSearchResults.length === 0) {
      if (scheduleSearchActiveIndex !== -1) {
        setScheduleSearchActiveIndex(-1)
      }
      return
    }

    if (scheduleSearchActiveIndex >= scheduleSearchResults.length) {
      setScheduleSearchActiveIndex(scheduleSearchResults.length - 1)
    }
  }, [shouldShowScheduleSearchDropdown, scheduleSearchResults.length, scheduleSearchActiveIndex])

  useEffect(() => {
    if (scheduleSearchActiveIndex < 0) {
      return
    }
    const target = scheduleSearchResultsRefs.current[scheduleSearchActiveIndex]
    if (target) {
      target.scrollIntoView({ block: "nearest" })
    }
  }, [scheduleSearchActiveIndex])

  const updateScheduleSearchDropdownPosition = useCallback(() => {
    if (!scheduleSearchContainerRef.current) {
      setScheduleDropdownStyle(null)
      return
    }
    const rect = scheduleSearchContainerRef.current.getBoundingClientRect()
    setScheduleDropdownStyle({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!shouldShowScheduleSearchDropdown) {
      setScheduleDropdownStyle(null)
      return
    }
    updateScheduleSearchDropdownPosition()
  }, [shouldShowScheduleSearchDropdown, updateScheduleSearchDropdownPosition])

  useEffect(() => {
    if (!shouldShowScheduleSearchDropdown) {
      return
    }
    window.addEventListener("resize", updateScheduleSearchDropdownPosition)
    window.addEventListener("scroll", updateScheduleSearchDropdownPosition, true)
    return () => {
      window.removeEventListener("resize", updateScheduleSearchDropdownPosition)
      window.removeEventListener("scroll", updateScheduleSearchDropdownPosition, true)
    }
  }, [shouldShowScheduleSearchDropdown, updateScheduleSearchDropdownPosition])

  const scheduleSearchActiveResultId =
    scheduleSearchActiveIndex >= 0 && scheduleSearchResults[scheduleSearchActiveIndex]
      ? `schedule-search-result-${scheduleSearchResults[scheduleSearchActiveIndex].id}`
      : undefined

  const scheduleSearchDropdown = shouldShowScheduleSearchDropdown && scheduleDropdownStyle
    ? createPortal(
      <div
        ref={scheduleSearchDropdownRef}
        className="fixed max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 ease-out"
        style={{
          top: scheduleDropdownStyle.top,
          left: scheduleDropdownStyle.left,
          width: scheduleDropdownStyle.width,
          zIndex: 120,
        }}
        dir="rtl"
      >
        {scheduleSearchError ? (
          <div className="px-4 py-6 text-center text-sm text-red-500">
            {scheduleSearchError}
          </div>
        ) : isScheduleSearchLoading ? (
          <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            מחפש תורים...
          </div>
        ) : scheduleSearchResults.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            לא נמצאו תוצאות עבור "{trimmedScheduleSearchTerm}"
          </div>
        ) : (
          <div
            className="divide-y divide-slate-100"
            role="listbox"
            aria-activedescendant={scheduleSearchActiveResultId}
          >
            {scheduleSearchResults.map((result, index) => {
              const badgeClass = (() => {
                if (!result.appointment) {
                  if (result.entityType === "client") {
                    return "border-purple-100 bg-purple-50 text-purple-700"
                  }
                  return "border-slate-200 bg-slate-100 text-slate-700"
                }
                return result.serviceType === "garden"
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : "border-blue-100 bg-blue-50 text-blue-700"
              })()
              const titleText =
                result.entityType === "personal"
                  ? result.appointment?.personalAppointmentDescription || "תור אישי"
                  : result.treatment?.name || result.ownerName || "תור ללא כלב"
              const secondaryText = (() => {
                if (result.entityType === "personal") {
                  return "תור אישי ביומן ההנהלה"
                }
                if (!result.appointment) {
                  if (result.entityType === "treatment") {
                    return result.ownerName ? `בעלים: ${result.ownerName}` : "כלב במערכת"
                  }
                  if (result.entityType === "client") {
                    return result.clientDetails?.classification
                      ? `סיווג: ${result.clientDetails.classification}`
                      : "לקוח במערכת"
                  }
                }
                return result.ownerName ? `לקוח: ${result.ownerName}` : "ללא פרטי לקוח"
              })()
              const stationLabel =
                result.appointment && result.stationName ? ` · עמדה ${result.stationName}` : ""
              const timeLabel =
                result.timeLabel && result.timeLabel.trim().length > 0 ? ` - ${result.timeLabel}` : ""
              const canOpenClientFromAppointment =
                Boolean(result.appointment && result.appointment.clientName)
              const hasClientDetails = Boolean(result.clientDetails)
              const showClientButton = canOpenClientFromAppointment || hasClientDetails

              return (
                <div
                  key={result.id}
                  id={`schedule-search-result-${result.id}`}
                  role="option"
                  tabIndex={0}
                  ref={(element) => {
                    scheduleSearchResultsRefs.current[index] = element
                  }}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 cursor-pointer transition focus:outline-none",
                    scheduleSearchActiveIndex === index ? "bg-slate-100" : "hover:bg-slate-50"
                  )}
                  aria-selected={scheduleSearchActiveIndex === index}
                  onClick={() => handleScheduleSearchEntryPrimaryAction(result)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleScheduleSearchEntryPrimaryAction(result)
                    }
                  }}
                  onMouseEnter={() => setScheduleSearchActiveIndex(index)}
                  onFocus={() => setScheduleSearchActiveIndex(index)}
                >
                  <div className="flex-1 space-y-1 text-right">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                      <span>{titleText}</span>
                      {result.entityType === "personal" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold border-purple-200 bg-purple-50 text-purple-700"
                        >
                          תור אישי
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-semibold", badgeClass)}
                      >
                        {result.serviceLabel}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {secondaryText}
                      {stationLabel}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {result.dateLabel}
                      {timeLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {showClientButton && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-500 hover:text-gray-900"
                        title="פתח כרטיס לקוח"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          if (canOpenClientFromAppointment && result.appointment) {
                            handleScheduleSearchOpenClientFromAppointment(result.appointment)
                          } else if (hasClientDetails && result.clientDetails) {
                            handleScheduleSearchOpenClientFromDetails(result.clientDetails)
                          }
                        }}
                      >
                        <UserRound className="h-4 w-4" />
                      </Button>
                    )}
                    {result.treatment && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-500 hover:text-gray-900"
                        title="פתח כרטיס כלב"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleScheduleSearchOpenTreatment(result.treatment!)
                        }}
                      >
                        <Bone className="h-4 w-4" />
                      </Button>
                    )}
                    {result.appointment && (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-500 hover:text-gray-900"
                          title="פתח פרטי תור"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            handleScheduleSearchOpenAppointment(result.appointment!)
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-500 hover:text-gray-900"
                          title="קפוץ לתאריך ביומן"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            handleScheduleSearchJumpToDate(result.appointment!)
                          }}
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>,
      document.body
    )
    : null

  const [moveAppointment] = useMoveAppointmentMutation()
  const [createManagerAppointment, { isLoading: createManagerAppointmentLoading }] = useCreateManagerAppointmentMutation()
  const [deleteWaitingListEntry] = useDeleteWaitingListEntryMutation()
  const [createProposedMeeting, { isLoading: creatingProposedMeeting }] = useCreateProposedMeetingMutation()
  const [updateProposedMeeting, { isLoading: updatingProposedMeeting }] = useUpdateProposedMeetingMutation()
  const [deleteProposedMeetingMutation] = useDeleteProposedMeetingMutation()
  const [sendProposedMeetingWebhook] = useSendProposedMeetingWebhookMutation()

  // Fetch constraints for the selected date
  const [constraints, setConstraints] = useState<Array<{
    id: string
    station_id: string
    reason: string | null
    notes: { text?: string } | null
    start_time: string
    end_time: string
    is_active: boolean
  }>>([])

  // Fetch station working hours
  const [stationWorkingHours, setStationWorkingHours] = useState<Record<string, Array<{
    weekday: string
    open_time: string
    close_time: string
    shift_order: number
  }>>>({})
  const [constraintToDelete, setConstraintToDelete] = useState<string | null>(null)
  const [constraintToDeleteDetails, setConstraintToDeleteDetails] = useState<{
    constraint: typeof constraints[0]
    relatedConstraints: typeof constraints
    stationIds: string[]
    stationNames: string[]
  } | null>(null)
  const [showDeleteConstraintDialog, setShowDeleteConstraintDialog] = useState(false)
  const [deleteFromAllStations, setDeleteFromAllStations] = useState(true)
  const [editingConstraint, setEditingConstraint] = useState<typeof constraints[0] | null>(null)
  const [editingConstraintStationIds, setEditingConstraintStationIds] = useState<string[]>([])
  const [editingStation, setEditingStation] = useState<ManagerStation | null>(null)
  const [isStationEditDialogOpen, setIsStationEditDialogOpen] = useState(false)
  const [stationToDuplicate, setStationToDuplicate] = useState<ManagerStation | null>(null)
  const [isDuplicateStationDialogOpen, setIsDuplicateStationDialogOpen] = useState(false)
  const [isDuplicatingStation, setIsDuplicatingStation] = useState(false)
  const [editingConstraintDefaultTimes, setEditingConstraintDefaultTimes] = useState<{
    startDate: Date
    endDate: Date
    startTime: string
    endTime: string
    isActive?: boolean
  } | null>(null)

  const loadWaitingListEntries = useCallback(async () => {
    setIsLoadingWaitingList(true)
    setWaitingListError(null)
    try {
      const dayStart = startOfDay(selectedDate)
      const dayEnd = addDays(dayStart, 1)

      const { data: waitlistData, error: waitlistError } = await supabase
        .from("daycare_waitlist")
        .select("id, customer_id, treatment_id, service_scope, status, start_date, end_date, notes, created_at, updated_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })

      if (waitlistError) {
        throw waitlistError
      }

      const relevantEntries = (waitlistData || []).filter((entry) => {
        if (!entry.start_date) {
          return false
        }
        const entryStart = new Date(entry.start_date)
        const entryEnd = entry.end_date ? new Date(entry.end_date) : null
        return entryStart <= dayEnd && (!entryEnd || entryEnd >= dayStart)
      })

      if (relevantEntries.length === 0) {
        setWaitingListEntries([])
        setWaitingListLastUpdated(new Date())
        return
      }

      const customerIds = [...new Set(relevantEntries.map((entry) => entry.customer_id).filter(Boolean))]
      const treatmentIds = [...new Set(relevantEntries.map((entry) => entry.treatment_id).filter(Boolean))]

      const customerQuery = customerIds.length
        ? supabase
          .from("customers")
          .select(`
              id,
              full_name,
              phone,
              email,
              customer_type_id,
              customer_type:customer_types (
                id,
                name
              )
            `)
          .in("id", customerIds)
        : Promise.resolve({ data: [], error: null })

      const treatmentQuery = treatmentIds.length
        ? supabase
          .from("treatments")
          .select(`
                id,
                name,
                treatment_type_id,
                customer_id,
                treatmentType:treatmentTypes (
                    id,
                    name
                )
            `)
          .in("id", treatmentIds)
        : Promise.resolve({ data: [], error: null })

      const [{ data: customersData, error: customersError }, { data: treatmentsData, error: treatmentsError }] = await Promise.all([
        customerQuery,
        treatmentQuery,
      ])

      if (customersError) {
        throw customersError
      }
      if (treatmentsError) {
        throw treatmentsError
      }

      const treatmentTypeIds = [...new Set((treatmentsData || []).map((treatment: any) => treatment?.treatment_type_id).filter(Boolean))]

      const typesQuery = treatmentTypeIds.length
        ? supabase
          .from("treatmentType_treatment_types")
          .select(`
              treatment_type_id,
              treatment_type_id,
              treatment_type:treatment_types (
                id,
                name
              )
            `)
          .in("treatment_type_id", treatmentTypeIds)
        : Promise.resolve({ data: [], error: null })

      const categoriesQuery = treatmentTypeIds.length
        ? supabase
          .from("treatmentType_treatment_categories")
          .select(`
              treatment_type_id,
              treatment_category_id,
              treatment_category:treatment_categories (
                id,
                name
              )
            `)
          .in("treatment_type_id", treatmentTypeIds)
        : Promise.resolve({ data: [], error: null })

      const [{ data: typesData, error: typesError }, { data: categoriesData, error: categoriesError }] = await Promise.all([
        typesQuery,
        categoriesQuery,
      ])

      if (typesError) {
        throw typesError
      }
      if (categoriesError) {
        throw categoriesError
      }

      const customersMap = new Map<string, any>((customersData || []).map((customer: any) => [customer.id, customer]))
      const treatmentsMap = new Map<string, any>((treatmentsData || []).map((treatment: any) => [treatment.id, treatment]))
      const typesByTreatmentType = new Map<string, Array<{ id: string; name: string }>>()
      const categoriesByTreatmentType = new Map<string, Array<{ id: string; name: string }>>()

        ; (typesData || []).forEach((row: any) => {
          if (!row?.treatment_type_id || !row?.treatment_type) return
          if (!typesByTreatmentType.has(row.treatment_type_id)) {
            typesByTreatmentType.set(row.treatment_type_id, [])
          }
          typesByTreatmentType.get(row.treatment_type_id)!.push({ id: row.treatment_type.id, name: row.treatment_type.name })
        })

        ; (categoriesData || []).forEach((row: any) => {
          if (!row?.treatment_type_id || !row?.treatment_category) return
          if (!categoriesByTreatmentType.has(row.treatment_type_id)) {
            categoriesByTreatmentType.set(row.treatment_type_id, [])
          }
          categoriesByTreatmentType.get(row.treatment_type_id)!.push({ id: row.treatment_category.id, name: row.treatment_category.name })
        })

      const transformed: ManagerWaitlistEntry[] = relevantEntries.map((entry) => {
        const customer = customersMap.get(entry.customer_id)
        const treatment = treatmentsMap.get(entry.treatment_id)
        const treatmentTypeId = treatment?.treatment_type_id

        return {
          id: entry.id,
          treatmentId: entry.treatment_id,
          treatmentName: treatment?.name || "ללא שם",
          treatmentRecordId: treatment?.record_id ?? null,
          treatmentRecordNumber: treatment?.record_number ?? null,
          treatmentTypeName: treatment?.treatmentType?.name ?? null,
          customerId: entry.customer_id,
          customerName: customer?.full_name ?? null,
          customerPhone: customer?.phone ?? null,
          customerEmail: customer?.email ?? null,
          customerTypeId: customer?.customer_type_id ?? null,
          customerTypeName: customer?.customer_type?.name ?? null,
          treatmentTypes: treatmentTypeId ? [...(typesByTreatmentType.get(treatmentTypeId) ?? [])] : [],
          treatmentCategories: treatmentTypeId ? [...(categoriesByTreatmentType.get(treatmentTypeId) ?? [])] : [],
          serviceScope: entry.service_scope as WaitlistServiceScope,
          startDate: entry.start_date,
          endDate: entry.end_date,
          notes: entry.notes,
        }
      })

      setWaitingListEntries(transformed)
      setWaitingListLastUpdated(new Date())
    } catch (error) {
      console.error("Error loading waiting list entries:", error)
      setWaitingListEntries([])
      setWaitingListError("לא ניתן לטעון את רשימת ההמתנה להיום")
      toast({
        title: "שגיאה בטעינת רשימת ההמתנה",
        description: "בדקו את החיבור ונסו שוב.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingWaitingList(false)
    }
  }, [selectedDate, toast])

  useEffect(() => {
    loadWaitingListEntries()
  }, [loadWaitingListEntries])

  const searchCustomerTypes = useCallback(async (searchTerm: string) => {
    try {
      const trimmed = searchTerm.trim()
      let query = supabase
        .from("customer_types")
        .select("id, name")
        .order("priority", { ascending: true })
        .limit(8)

      if (trimmed) {
        query = query.ilike("name", `%${trimmed}%`)
      }

      const { data, error } = await query
      if (error) {
        throw error
      }

      const lookup: Record<string, { id: string; name: string }> = {}
        ; (data || []).forEach((item) => {
          lookup[item.name] = { id: item.id, name: item.name }
        })
      customerTypeSuggestionsRef.current = lookup
      return (data || []).map((item) => item.name)
    } catch (error) {
      console.error("Error searching customer types:", error)
      return []
    }
  }, [])

  const searchTreatmentCategories = useCallback(async (searchTerm: string) => {
    try {
      const trimmed = searchTerm.trim()
      let query = supabase
        .from("treatment_categories")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(8)

      if (trimmed) {
        query = query.ilike("name", `%${trimmed}%`)
      }

      const { data, error } = await query
      if (error) {
        throw error
      }

      const lookup: Record<string, { id: string; name: string }> = {}
        ; (data || []).forEach((item) => {
          lookup[item.name] = { id: item.id, name: item.name }
        })
      treatmentCategorySuggestionsRef.current = lookup
      return (data || []).map((item) => item.name)
    } catch (error) {
      console.error("Error searching treatment categories:", error)
      return []
    }
  }, [])

  const searchTreatmentTypes = useCallback(async (searchTerm: string) => {
    try {
      const trimmed = searchTerm.trim()
      let query = supabase
        .from("treatment_types")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(8)

      if (trimmed) {
        query = query.ilike("name", `%${trimmed}%`)
      }

      const { data, error } = await query
      if (error) {
        throw error
      }

      const lookup: Record<string, { id: string; name: string }> = {}
        ; (data || []).forEach((item) => {
          lookup[item.name] = { id: item.id, name: item.name }
        })
      treatmentTypeSuggestionsRef.current = lookup
      return (data || []).map((item) => item.name)
    } catch (error) {
      console.error("Error searching treatment types:", error)
      return []
    }
  }, [])

  const handleSelectCustomerType = useCallback((label: string) => {
    const match = customerTypeSuggestionsRef.current[label]
    if (!match) {
      return
    }
    setSelectedCustomerTypes((prev) => {
      if (prev.some((item) => item.id === match.id)) {
        return prev
      }
      return [...prev, match]
    })
    setCustomerTypeQuery("")
  }, [])

  const handleSelectTreatmentCategory = useCallback((label: string) => {
    const match = treatmentCategorySuggestionsRef.current[label]
    if (!match) {
      return
    }
    setSelectedTreatmentCategories((prev) => {
      if (prev.some((item) => item.id === match.id)) {
        return prev
      }
      return [...prev, match]
    })
    setTreatmentCategoryQuery("")
  }, [])

  const handleSelectTreatmentType = useCallback((label: string) => {
    const match = treatmentTypeSuggestionsRef.current[label]
    if (!match) {
      return
    }
    setSelectedTreatmentTypes((prev) => {
      if (prev.some((item) => item.id === match.id)) {
        return prev
      }
      return [...prev, match]
    })
    setTreatmentTypeQuery("")
  }, [])

  const removeCustomerType = useCallback((id: string) => {
    setSelectedCustomerTypes((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const removeTreatmentCategory = useCallback((id: string) => {
    setSelectedTreatmentCategories((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const removeTreatmentType = useCallback((id: string) => {
    setSelectedTreatmentTypes((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearWaitingListFilters = useCallback(() => {
    setWaitingListSearchTerm("")
    setSelectedCustomerTypes([])
    setSelectedTreatmentCategories([])
    setSelectedTreatmentTypes([])
    setCustomerTypeQuery("")
    setTreatmentCategoryQuery("")
    setTreatmentTypeQuery("")
  }, [])

  const filteredWaitingListEntries = useMemo(() => {
    const search = waitingListSearchTerm.trim().toLowerCase()
    const customerTypeIds = new Set(selectedCustomerTypes.map((item) => item.id))
    const categoryIds = new Set(selectedTreatmentCategories.map((item) => item.id))
    const treatmentTypeIds = new Set(selectedTreatmentTypes.map((item) => item.id))

    return waitingListEntries.filter((entry) => {
      if (search) {
        const haystack = [
          entry.treatmentName,
          entry.customerName,
          entry.customerPhone,
          entry.customerEmail,
          entry.treatmentTypeName,
          entry.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        if (!haystack.includes(search)) {
          return false
        }
      }

      if (customerTypeIds.size > 0) {
        if (!entry.customerTypeId || !customerTypeIds.has(entry.customerTypeId)) {
          return false
        }
      }

      if (categoryIds.size > 0) {
        if (!entry.treatmentCategories.length || !entry.treatmentCategories.some((category) => categoryIds.has(category.id))) {
          return false
        }
      }

      if (treatmentTypeIds.size > 0) {
        if (!entry.treatmentTypes.length || !entry.treatmentTypes.some((type) => treatmentTypeIds.has(type.id))) {
          return false
        }
      }

      return true
    })
  }, [waitingListEntries, waitingListSearchTerm, selectedCustomerTypes, selectedTreatmentCategories, selectedTreatmentTypes])

  const handleWaitlistCardClick = useCallback((entry: ManagerWaitlistEntry) => {
    if (entry.treatmentId) {
      setSelectedTreatment({
        id: entry.treatmentId,
        name: entry.treatmentName,
        clientClassification: entry.customerTypeName ?? undefined,
        owner: entry.customerName
          ? {
            name: entry.customerName,
            classification: entry.customerTypeName ?? undefined,
            phone: entry.customerPhone ?? undefined,
            email: entry.customerEmail ?? undefined,
          }
          : undefined,
        treatmentType: entry.treatmentTypeName ?? undefined,
        notes: entry.notes ?? undefined,
      })
      setIsTreatmentDetailsOpen(true)
    }

    if (entry.customerId || entry.customerName) {
      setSelectedClient({
        name: entry.customerName || "לקוח",
        classification: entry.customerTypeName ?? undefined,
        phone: entry.customerPhone ?? undefined,
        email: entry.customerEmail ?? undefined,
      })
      setIsClientDetailsOpen(true)
    }
  }, [setIsClientDetailsOpen, setIsTreatmentDetailsOpen, setSelectedClient, setSelectedTreatment])

  useEffect(() => {
    setActiveWaitlistBucket(null)
  }, [filteredWaitingListEntries])

  const waitingListSummary = useMemo(() => {
    const scopeCounts: Record<WaitlistServiceScope, number> = {
      grooming: 0,
      daycare: 0,
      both: 0,
    }

    waitingListEntries.forEach((entry) => {
      scopeCounts[entry.serviceScope] = (scopeCounts[entry.serviceScope] || 0) + 1
    })

    return {
      total: waitingListEntries.length,
      filtered: filteredWaitingListEntries.length,
      scopeCounts,
    }
  }, [waitingListEntries, filteredWaitingListEntries])

  const handleWaitingListRefresh = useCallback(() => {
    loadWaitingListEntries()
  }, [loadWaitingListEntries])

  const handleCancelWaitlistPlacement = useCallback(() => {
    setShowWaitlistDropDialog(false)
    setPendingWaitlistPlacement(null)
    setShouldRemoveFromWaitlist(true)
  }, [])

  const handleConfirmWaitlistPlacement = useCallback(() => {
    if (!pendingWaitlistPlacement) {
      return
    }

    const { entry, stationId, startTime, endTime } = pendingWaitlistPlacement

    setPrefillBusinessCustomer({
      id: entry.customerId,
      fullName: entry.customerName ?? undefined,
      phone: entry.customerPhone ?? undefined,
      email: entry.customerEmail ?? undefined,
    })
    setPrefillBusinessTreatment({
      id: entry.treatmentId,
      name: entry.treatmentName,
      treatmentType: entry.treatmentTypeName ?? "",
      size: "medium",
      isSmall: false,
      ownerId: entry.customerId,
    })
    setPendingWaitlistEntryId(entry.id)
    setFinalizedDragTimes({
      startTime,
      endTime,
      stationId,
    })
    setShowWaitlistDropDialog(false)
    setPendingWaitlistPlacement(null)
    setShowBusinessAppointmentModal(true)
  }, [pendingWaitlistPlacement])

  const handleBusinessAppointmentSuccess = useCallback(async () => {
    setFinalizedDragTimes(null)
    if (pendingWaitlistEntryId && shouldRemoveFromWaitlist) {
      try {
        await deleteWaitingListEntry(pendingWaitlistEntryId).unwrap()
        toast({
          title: "הלקוח הוסר מרשימת ההמתנה",
          description: "הבקשה הושלמה בהצלחה.",
        })
      } catch (error) {
        console.error("Failed to remove waitlist entry:", error)
        toast({
          title: "לא ניתן להסיר מרשימת ההמתנה",
          description: "נסו שוב מאוחר יותר.",
          variant: "destructive",
        })
      }
    }
    setPendingWaitlistEntryId(null)
    setShouldRemoveFromWaitlist(true)
    setPrefillBusinessCustomer(null)
    setPrefillBusinessTreatment(null)
    loadWaitingListEntries()
    refetch()
  }, [deleteWaitingListEntry, loadWaitingListEntries, pendingWaitlistEntryId, refetch, shouldRemoveFromWaitlist, toast])
  const [isConstraintDialogOpen, setIsConstraintDialogOpen] = useState(false)
  const [stationConstraintsContext, setStationConstraintsContext] = useState<{ stationId: string; stationName: string; date: Date } | null>(null)
  const [isStationConstraintsModalOpen, setIsStationConstraintsModalOpen] = useState(false)

  useEffect(() => {
    const fetchConstraints = async () => {
      try {
        const dayStart = startOfDay(selectedDate)
        const dayEnd = addHours(dayStart, 24)

        // Fetch constraints that overlap with the selected day
        // A constraint overlaps if:
        // - It starts before dayEnd AND ends after dayStart
        // Fetch ALL constraints (both active and inactive) so blue slots logic can work
        // We'll filter inactive ones for display only
        const { data: constraintsData, error: constraintsError } = await supabase
          .from("station_unavailability")
          .select(`
            id,
            station_id,
            reason,
            notes,
            start_time,
            end_time,
            is_active
          `)
          .lt("start_time", dayEnd.toISOString())
          .gt("end_time", dayStart.toISOString())

        if (constraintsError) {
          console.error("Error fetching constraints:", constraintsError)
          return
        }

        setConstraints(constraintsData || [])
      } catch (error) {
        console.error("Error fetching constraints:", error)
      }
    }

    fetchConstraints()
  }, [selectedDate])

  // Fetch station working hours
  const fetchStationWorkingHours = useCallback(async () => {
    if (!data?.stations) {
      return
    }

    try {
      const stationIds = data.stations
        .filter(station => station.serviceType === 'grooming')
        .map(station => station.id)

      if (stationIds.length === 0) {
        setStationWorkingHours({})
        return
      }

      const { data: workingHoursData, error } = await supabase
        .from("station_working_hours")
        .select("station_id, weekday, open_time, close_time, shift_order")
        .in("station_id", stationIds)

      if (error) {
        console.error("Error fetching station working hours:", error)
        return
      }

      // Group by station_id
      const hoursMap: Record<string, Array<{
        weekday: string
        open_time: string
        close_time: string
        shift_order: number
      }>> = {}

      stationIds.forEach((stationId) => {
        hoursMap[stationId] = []
      })

      if (workingHoursData) {
        workingHoursData.forEach((hour) => {
          if (!hoursMap[hour.station_id]) {
            hoursMap[hour.station_id] = []
          }
          hoursMap[hour.station_id].push({
            weekday: hour.weekday,
            open_time: hour.open_time,
            close_time: hour.close_time,
            shift_order: hour.shift_order,
          })
        })
      }

      setStationWorkingHours(hoursMap)
    } catch (error) {
      console.error("Error fetching station working hours:", error)
    }
  }, [data?.stations])

  useEffect(() => {
    fetchStationWorkingHours()
  }, [fetchStationWorkingHours, selectedDate])

  useEffect(() => {
    if (!data?.stations) {
      return
    }
    setVisibleStationIds((prev) => {
      const incoming = data.stations.map((station) => station.id)
      // Only preserve existing selections that are still valid, don't add new ones
      const preserved = prev.filter((stationId) => incoming.includes(stationId))
      // If no stations are selected (empty array), select all stations by default
      return preserved.length > 0 ? preserved : incoming
    })
  }, [data?.stations])
  // Fetch global working hours to determine the latest end time
  const [globalEndHour, setGlobalEndHour] = useState<number | undefined>(DEFAULT_END_HOUR)

  useEffect(() => {
    const fetchGlobalEndHour = async () => {
      try {
        const { data: businessHours, error } = await supabase
          .from("business_hours")
          .select("close_time")

        if (error) {
          console.error("Error fetching global working hours:", error)
          return
        }

        if (businessHours && businessHours.length > 0) {
          // Find the latest close_time across all days/shifts
          let latestHour = 0
          businessHours.forEach((hour) => {
            if (hour.close_time) {
              const timeStr = hour.close_time.substring(0, 5) // Get HH:mm
              const [hours, minutes] = timeStr.split(':').map(Number)
              // For close_time like "17:00:00", use hour 17
              // For close_time like "17:30:00", use hour 18 (round up)
              const hourValue = minutes > 0 ? hours + 1 : hours
              if (hourValue > latestHour) {
                latestHour = hourValue
              }
            }
          })
          // Only set if we found at least one valid close_time
          if (latestHour > 0) {
            setGlobalEndHour(latestHour)
          }
        }
      } catch (error) {
        console.error("Error fetching global working hours:", error)
      }
    }

    fetchGlobalEndHour()
  }, [])

  const timeline = useMemo(
    () => buildTimeline(selectedDate, data, intervalMinutes, pixelsPerMinuteScale, optimisticAppointments, globalEndHour),
    [selectedDate, data, intervalMinutes, pixelsPerMinuteScale, optimisticAppointments, globalEndHour]
  )

  const filteredStations = useMemo(() => {
    if (!stations.length) {
      return []
    }

    // If no stations are selected, show all stations. If stations are selected, show only those.
    let stationsToShow = visibleStationIds.length > 0
      ? stations.filter((station) => visibleStationIds.includes(station.id))
      : stations

    if (serviceFilter === "grooming") {
      // Show only grooming stations
      stationsToShow = stationsToShow.filter(station => station.serviceType === "grooming")
    } else if (serviceFilter === "garden") {
      // Show only garden stations (but they'll be handled by garden columns)
      stationsToShow = stationsToShow.filter(station => station.serviceType === "garden")
    }
    // For "both", show all stations

    // Always filter out garden stations from regular station columns - they'll be handled by separate garden columns
    return stationsToShow.filter(station => station.serviceType !== "garden")
  }, [stations, visibleStationIds, serviceFilter])

  // Separate garden appointments into accordion sections
  const gardenAppointments = useMemo(() => {
    if (!data?.appointments) {
      return { fullDay: [] as ManagerAppointment[], hourly: [] as ManagerAppointment[], trial: [] as ManagerAppointment[] }
    }

    const fullDayAppointments: ManagerAppointment[] = []
    const hourlyAppointments: ManagerAppointment[] = []
    const trialAppointments: ManagerAppointment[] = []

    // If no stations are selected, show all garden stations. If stations are selected, show only those.
    const isGardenStationVisible = visibleStationIds.length === 0 || visibleStationIds.includes('garden-station')

    for (const appointment of data.appointments) {
      const isGardenAppointment = appointment.serviceType === "garden"
      const isVisibleGardenStation = visibleStationIds.length === 0 ||
        visibleStationIds.includes(appointment.stationId) ||
        (appointment.stationId.startsWith('garden-') && isGardenStationVisible)

      if (isGardenAppointment && isVisibleGardenStation) {
        if (serviceFilter === "grooming") {
          continue
        }

        // Validate appointment dates - ensure appointments are within the current calendar day
        const appointmentStartDate = parseISODate(appointment.startDateTime)
        const appointmentEndDate = parseISODate(appointment.endDateTime)

        if (!appointmentStartDate || !appointmentEndDate) {
          console.warn('Invalid garden appointment dates:', appointment.id, appointment.startDateTime, appointment.endDateTime)
          continue
        }

        // Check if appointment is within the current calendar day
        const currentDayStart = startOfDay(selectedDate)
        const currentDayEnd = addHours(currentDayStart, 24)

        // Only show appointments that start or end within the current calendar day
        const isWithinCurrentDay = (
          (appointmentStartDate >= currentDayStart && appointmentStartDate < currentDayEnd) ||
          (appointmentEndDate >= currentDayStart && appointmentEndDate < currentDayEnd) ||
          (appointmentStartDate < currentDayStart && appointmentEndDate >= currentDayEnd)
        )

        if (!isWithinCurrentDay) {
          continue
        }

        if (appointment.gardenIsTrial) {
          trialAppointments.push(appointment)
          continue
        }

        if (appointment.gardenAppointmentType === "full-day") {
          fullDayAppointments.push(appointment)
        } else {
          hourlyAppointments.push(appointment)
        }
      }
    }

    const sortByStart = (a: ManagerAppointment, b: ManagerAppointment) =>
      a.startDateTime.localeCompare(b.startDateTime)

    fullDayAppointments.sort(sortByStart)
    hourlyAppointments.sort(sortByStart)
    trialAppointments.sort(sortByStart)

    return { fullDay: fullDayAppointments, hourly: hourlyAppointments, trial: trialAppointments }
  }, [data?.appointments, visibleStationIds, serviceFilter])

  const gardenSections = useMemo(() => ([
    {
      id: 'garden-full-day',
      title: 'גן - יום מלא',
      badgeLabel: 'יום מלא',
      badgeClassName: 'border-green-200 bg-green-100 text-green-700',
      indicatorClassName: 'bg-emerald-500',
      titleBackgroundClassName: 'bg-green-50',
      dropZoneClassName: 'border-green-200 bg-green-50',
      dropZoneHoverClassName: 'border-emerald-400 bg-green-100',
      appointments: gardenAppointments.fullDay,
    },
    {
      id: 'garden-hourly',
      title: 'גן - שעתי',
      badgeLabel: 'שעתי',
      badgeClassName: 'border-blue-200 bg-blue-100 text-blue-700',
      indicatorClassName: 'bg-blue-500',
      titleBackgroundClassName: 'bg-blue-50',
      dropZoneClassName: 'border-blue-200 bg-blue-50',
      dropZoneHoverClassName: 'border-blue-400 bg-blue-100',
      appointments: gardenAppointments.hourly,
    },
    {
      id: 'garden-trial',
      title: 'גן - ניסיון',
      badgeLabel: 'ניסיון',
      badgeClassName: 'border-amber-200 bg-amber-100 text-amber-700',
      indicatorClassName: 'bg-amber-500',
      titleBackgroundClassName: 'bg-amber-50',
      dropZoneClassName: 'border-amber-200 bg-amber-50',
      dropZoneHoverClassName: 'border-amber-400 bg-amber-100',
      appointments: gardenAppointments.trial,
    },
  ]), [gardenAppointments])

  // Check if we should show garden columns
  const shouldShowGardenColumns = useMemo(() => {
    if (!stations.length) return false

    // Don't show garden columns when grooming only is selected
    if (serviceFilter === "grooming") return false

    return stations.some(station =>
      station.serviceType === "garden" && (visibleStationIds.length === 0 || visibleStationIds.includes(station.id))
    )
  }, [stations, visibleStationIds, serviceFilter])

  // Calculate garden columns first - now a single column with accordion sections
  const gardenColumnCount = shouldShowGardenColumns ? 1 : 0
  const specialColumnCount = gardenColumnCount + (showWaitingListColumn ? 1 : 0)
  const stationColumnSlots = Math.max(0, MAX_VISIBLE_STATIONS - specialColumnCount)

  const maxStationWindowStart = stationColumnSlots > 0
    ? Math.max(0, filteredStations.length - stationColumnSlots)
    : 0

  // Calculate if we can scroll based on available station slots
  const maxTotalScrollStart = maxStationWindowStart

  const canScrollBackward = stationColumnSlots > 0 && stationWindowStart > 0 && maxTotalScrollStart > 0
  const canScrollForward = stationColumnSlots > 0 && stationWindowStart < maxTotalScrollStart && maxTotalScrollStart > 0

  useEffect(() => {
    setStationWindowStart((prev) => {
      const nextSlots = stationColumnSlots > 0
        ? Math.max(0, filteredStations.length - stationColumnSlots)
        : 0
      const next = Math.min(prev, nextSlots)
      return next === prev ? prev : next
    })
  }, [filteredStations.length, stationColumnSlots])

  useEffect(() => {
    setStationWindowStart(0)
  }, [serviceFilter])

  useEffect(() => {
    if (draggedAppointment.appointment) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          // Cancel the drag operation
          setDraggedAppointment({
            appointment: null,
            cancelled: false
          })
          setHighlightedSlots(null)
        }
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('keydown', handleKeyDown)
      }
    } else if (draggedConstraint.constraint) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          // Cancel the drag operation
          setDraggedConstraint({
            constraint: null,
            cancelled: false
          })
          setHighlightedSlots(null)
        }
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('keydown', handleKeyDown)
      }
    } else if (draggedWaitlistEntry.entry) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setDraggedWaitlistEntry({
            entry: null,
            cancelled: false
          })
          setHighlightedSlots(null)
        }
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [draggedAppointment.appointment, draggedConstraint.constraint, draggedWaitlistEntry.entry])

  // Mouse and keyboard event listeners for drag-to-create
  useEffect(() => {
    if (!dragToCreate.isDragging) return

    const handleMouseMove = (event: MouseEvent) => {
      handleCreateDragMove(event)
    }

    const handleMouseUp = () => {
      handleCreateDragEnd()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Cancel the drag operation
        setDragToCreate(prev => ({
          ...prev,
          isDragging: false,
          cancelled: true
        }))
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dragToCreate.isDragging, dragToCreate.startTime, dragToCreate.stationId])

  const visibleStationsWindow = useMemo(() => {
    if (!filteredStations.length || stationColumnSlots === 0) {
      return []
    }
    return filteredStations.slice(stationWindowStart, stationWindowStart + stationColumnSlots)
  }, [filteredStations, stationWindowStart, stationColumnSlots])

  const timeAxisWidth = 70
  const scheduledColumnCount = gardenColumnCount + visibleStationsWindow.length
  const gridColumnParts: string[] = [`${timeAxisWidth}px`]
  if (showWaitingListColumn) {
    gridColumnParts.push(`minmax(${WAITLIST_COLUMN_WIDTH}px, ${WAITLIST_COLUMN_WIDTH + 80}px)`)
  }
  if (scheduledColumnCount > 0) {
    const scheduledTemplate =
      scheduledColumnCount === 1
        ? "minmax(240px, 1fr)"
        : `repeat(${scheduledColumnCount}, minmax(240px, 1fr))`
    gridColumnParts.push(scheduledTemplate)
  }
  const gridTemplateColumns = gridColumnParts.join(" ")
  const displayedRangeStart = filteredStations.length && stationColumnSlots > 0 ? stationWindowStart + 1 : 0
  const displayedRangeEnd = filteredStations.length && stationColumnSlots > 0
    ? stationWindowStart + visibleStationsWindow.length
    : 0

  const handleScrollBackward = () => {
    setStationWindowStart((prev) => (prev > 0 ? prev - 1 : prev))
  }

  const handleScrollForward = () => {
    setStationWindowStart((prev) => (prev < maxTotalScrollStart ? prev + 1 : prev))
  }

  const syncHorizontalScroll = useCallback(
    (source: "header" | "content", scrollLeft: number) => {
      const target =
        source === "header" ? contentScrollContainerRef.current : headerScrollContainerRef.current

      if (!target) return
      if (Math.abs(target.scrollLeft - scrollLeft) < 1) return

      isSyncingHorizontalScrollRef.current = true
      target.scrollLeft = scrollLeft

      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => {
          isSyncingHorizontalScrollRef.current = false
        })
      } else {
        setTimeout(() => {
          isSyncingHorizontalScrollRef.current = false
        }, 0)
      }
    },
    []
  )

  const handleHeaderScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (isSyncingHorizontalScrollRef.current) return
      syncHorizontalScroll("header", event.currentTarget.scrollLeft)
    },
    [syncHorizontalScroll]
  )

  const handleContentScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (isSyncingHorizontalScrollRef.current) return
      syncHorizontalScroll("content", event.currentTarget.scrollLeft)
    },
    [syncHorizontalScroll]
  )

  const selectedStationNames = useMemo(() => {
    if (!stations.length) {
      return []
    }
    // If no stations are selected, show all station names
    if (visibleStationIds.length === 0) {
      return stations.map((station) => station.name)
    }
    const selectedSet = new Set(visibleStationIds)
    return stations
      .filter((station) => selectedSet.has(station.id))
      .map((station) => station.name)
  }, [stations, visibleStationIds])

  const stationFilterSummary = useMemo(() => {
    if (!stations.length) {
      return "אין עמדות זמינות"
    }
    if (selectedStationNames.length === 0) {
      return "בחר עמדות"
    }
    if (selectedStationNames.length === stations.length) {
      return "כל העמדות"
    }
    if (selectedStationNames.length <= 2) {
      return selectedStationNames.join(" · ")
    }
    return `${selectedStationNames.length} עמדות נבחרו`
  }, [stations, selectedStationNames])

  const handleAppointmentClick = (appointment: ManagerAppointment) => {
    setSelectedAppointment(appointment)
    setIsDetailsOpen(true)
  }
  const handleDetailsOpenChange = (open: boolean) => {
    setIsDetailsOpen(open)
    if (!open) {
      setSelectedAppointment(null)
    }
  }

  const handleGroupAppointmentClick = (appointment: ManagerAppointment) => {
    // Close any open dialogs
    setDeleteConfirmationOpen(false)
    setCancelConfirmationOpen(false)

    // Open the appointment drawer
    setSelectedAppointment(appointment)
    setIsDetailsOpen(true)
  }

  const handleDeleteAppointment = (appointment: ManagerAppointment) => {
    if (appointment.isProposedMeeting) {
      handleDeleteProposedMeeting(appointment)
      return
    }
    setAppointmentToDelete(appointment)
    setUpdateCustomer(false) // Reset the checkbox
    setDeleteConfirmationOpen(true)

    // Close any open edit modals
    setGardenEditOpen(false)
    setGroomingEditOpen(false)
    setEditingAppointment(null)
    setEditingGroomingAppointment(null)
  }

  const handlePaymentClick = (appointment: ManagerAppointment) => {
    if (appointment.isProposedMeeting) {
      return
    }
    setSelectedAppointmentForPayment(appointment)
    setShowPaymentModal(true)
  }

  const handleDuplicateAppointment = (appointment: ManagerAppointment) => {
    if (appointment.isProposedMeeting) {
      handleOpenProposedMeetingEditor(appointment)
      return
    }
    setAppointmentToDuplicate(appointment)
    setDuplicateSeriesOpen(true)
  }
  const handleCreateGardenAppointment = (sectionId: string) => {
    // Determine the appointment type based on the section ID
    let appointmentType: 'full-day' | 'hourly' | 'trial' = 'hourly'

    if (sectionId === 'garden-full-day') {
      appointmentType = 'full-day'
    } else if (sectionId === 'garden-trial') {
      appointmentType = 'trial'
    } else {
      appointmentType = 'hourly'
    }

    setNewGardenAppointmentType(appointmentType)
    setNewGardenAppointmentModalOpen(true)
  }
  const handleConfirmDuplicate = async (data: {
    weeksInterval: number
    repeatType: 'count' | 'endDate'
    repeatCount?: number
    endDate?: string
    startDate?: string
  }) => {
    if (!appointmentToDuplicate) return

    setDuplicateLoading(true)
    try {
      // Call the backend function
      const response = await supabase.functions.invoke('duplicate-appointment', {
        body: {
          appointmentId: appointmentToDuplicate.id,
          weeksInterval: data.weeksInterval,
          repeatType: data.repeatType,
          repeatCount: data.repeatCount,
          endDate: data.endDate,
          startDate: data.startDate,
          seriesId: appointmentToDuplicate.appointmentGroupId || undefined, // Use existing series ID if available
          startTime: appointmentToDuplicate.startDateTime, // Send original start time
          endTime: appointmentToDuplicate.endDateTime // Send original end time
        }
      })

      if (response.error) {
        throw response.error
      }

      // Parse the response to get created appointments
      const createdAppts = response.data?.createdAppointments || []

      // Close duplicate series modal
      setDuplicateSeriesOpen(false)
      setAppointmentToDuplicate(null)
      setDuplicateLoading(false)

      // Show success modal with created appointments
      if (createdAppts.length > 0) {
        setCreatedAppointments(createdAppts)
        setDuplicateSuccessOpen(true)
      } else {
        // If no appointments returned, show a simple success message
        toast({
          title: "סדרת תורים נוצרה בהצלחה",
          description: "התורים נוצרו בהצלחה במערכת.",
        })
      }
    } catch (error) {
      console.error('Error creating duplicate series:', error)
      setDuplicateLoading(false)
      alert('שגיאה ביצירת סדרת התורים החוזרת')
    }
  }

  const handleCreatedAppointmentClick = async (createdAppointment: CreatedAppointment) => {
    // Open the drawer immediately with loading state
    setIsLoadingAppointment(true)
    setSelectedAppointment(null) // Clear previous appointment
    setIsDetailsOpen(true)

    try {
      // Invalidate cache to refresh the schedule after creating appointment
      dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment", "GardenAppointment"]))

      // If we have appointmentId, fetch directly from Supabase. Otherwise use recordID as fallback
      const appointmentId = createdAppointment.appointmentId || createdAppointment.recordID
      const serviceType = (createdAppointment.serviceType || "grooming") as "grooming" | "garden"

      if (!appointmentId) {
        throw new Error("Appointment ID not found")
      }

      // Fetch the specific appointment from Supabase
      const result = await getSingleManagerAppointment(appointmentId, serviceType)

      if (!result.success || !result.appointment) {
        throw new Error(result.error || 'Failed to fetch appointment')
      }

      setSelectedAppointment(result.appointment)
    } catch (error) {
      console.error('Error fetching appointment:', error)
      setIsDetailsOpen(false)
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את פרטי התור כרגע.",
        variant: "destructive"
      })
    } finally {
      setIsLoadingAppointment(false)
    }
  }

  const handleCancelAppointment = (appointment: ManagerAppointment) => {
    if (appointment.isProposedMeeting) {
      return
    }
    setAppointmentToCancel(appointment)
    setUpdateCustomerCancel(false) // Reset the checkbox
    setCancelConfirmationOpen(true)

    // Close any open edit modals
    setGardenEditOpen(false)
    setGroomingEditOpen(false)
    setEditingAppointment(null)
    setEditingGroomingAppointment(null)
  }
  const handleConfirmDelete = async (deleteGroup?: boolean, selectedAppointmentIds?: string[]) => {
    if (!appointmentToDelete) return

    setIsDeleting(true)
    try {
      // If deleting group and we have selected appointments, loop through them
      if (deleteGroup && selectedAppointmentIds && selectedAppointmentIds.length > 0) {
        // Cancel all selected appointments in Supabase
        for (const aptId of selectedAppointmentIds) {
          const result = await managerDeleteAppointment({
            appointmentId: aptId,
            appointmentTime: appointmentToDelete.startDateTime,
            serviceType: appointmentToDelete.serviceType,
            treatmentId: appointmentToDelete.treatments[0]?.id,
            stationId: appointmentToDelete.stationId,
            updateCustomer: updateCustomer,
            clientName: appointmentToDelete.clientName,
            treatmentName: appointmentToDelete.treatments[0]?.name,
            appointmentDate: new Date(appointmentToDelete.startDateTime).toLocaleDateString('he-IL'),
            groupId: deleteGroup ? appointmentToDelete.groupAppointmentId : undefined,
          })

          if (!result.success) {
            console.warn(`Failed to delete appointment ${aptId}:`, result.error)
          }
        }
      } else {
        // Single appointment deletion
        const result = await managerDeleteAppointment({
          appointmentId: appointmentToDelete.id,
          appointmentTime: appointmentToDelete.startDateTime,
          serviceType: appointmentToDelete.serviceType,
          treatmentId: appointmentToDelete.treatments[0]?.id,
          stationId: appointmentToDelete.stationId,
          updateCustomer: updateCustomer,
          clientName: appointmentToDelete.clientName,
          treatmentName: appointmentToDelete.treatments[0]?.name,
          appointmentDate: new Date(appointmentToDelete.startDateTime).toLocaleDateString('he-IL'),
          groupId: deleteGroup ? appointmentToDelete.groupAppointmentId : undefined,
        })

        if (!result.success) {
          throw new Error(result.error || "Failed to delete appointment")
        }
      }

      // Close the confirmation dialog first
      setDeleteConfirmationOpen(false)
      setAppointmentToDelete(null)

      // Show success toast
      const isGroupOperation = deleteGroup && selectedAppointmentIds && selectedAppointmentIds.length > 0
      toast({
        title: "התור נמחק בהצלחה",
        description: isGroupOperation
          ? `${selectedAppointmentIds.length} תורים נמחקו בהצלחה`
          : `התור של ${appointmentToDelete.treatments[0]?.name || 'הכלב'} נמחק בהצלחה`,
        variant: "default",
      })

      // Invalidate cache to refresh the schedule
      dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment", "GardenAppointment"]))

      // Refresh the data by invalidating the cache and refetching
      await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule']))
      await refetch()

    } catch (error) {
      console.error('Error deleting appointment:', error)

      // Show error toast
      toast({
        title: "שגיאה במחיקת התור",
        description: error.message || "אירעה שגיאה בעת מחיקת התור",
        variant: "destructive",
      })

      // Refresh the data even on error to ensure UI is up-to-date
      await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule']))
      await refetch()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConfirmCancel = async (cancelGroup?: boolean, selectedAppointmentIds?: string[]) => {
    if (!appointmentToCancel) return

    setIsCancelling(true)
    try {
      // If canceling group and we have selected appointments, loop through them
      if (cancelGroup && selectedAppointmentIds && selectedAppointmentIds.length > 0) {
        // Cancel all selected appointments in Supabase
        for (const aptId of selectedAppointmentIds) {
          const result = await managerCancelAppointment({
            appointmentId: aptId,
            appointmentTime: appointmentToCancel.startDateTime,
            serviceType: appointmentToCancel.serviceType,
            treatmentId: appointmentToCancel.treatments[0]?.id,
            stationId: appointmentToCancel.stationId,
            updateCustomer: updateCustomerCancel,
            clientName: appointmentToCancel.clientName,
            treatmentName: appointmentToCancel.treatments[0]?.name,
            appointmentDate: new Date(appointmentToCancel.startDateTime).toLocaleDateString('he-IL'),
            groupId: cancelGroup ? appointmentToCancel.groupAppointmentId : undefined,
          })

          if (!result.success) {
            console.warn(`Failed to cancel appointment ${aptId}:`, result.error)
          }
        }
      } else {
        // Single appointment cancellation
        const result = await managerCancelAppointment({
          appointmentId: appointmentToCancel.id,
          appointmentTime: appointmentToCancel.startDateTime,
          serviceType: appointmentToCancel.serviceType,
          treatmentId: appointmentToCancel.treatments[0]?.id,
          stationId: appointmentToCancel.stationId,
          updateCustomer: updateCustomerCancel,
          clientName: appointmentToCancel.clientName,
          treatmentName: appointmentToCancel.treatments[0]?.name,
          appointmentDate: new Date(appointmentToCancel.startDateTime).toLocaleDateString('he-IL'),
          groupId: cancelGroup ? appointmentToCancel.groupAppointmentId : undefined,
        })

        if (!result.success) {
          throw new Error(result.error || "Failed to cancel appointment")
        }
      }

      // Close the confirmation dialog
      setCancelConfirmationOpen(false)
      setAppointmentToCancel(null)

      // Show success toast
      const isGroupOperation = cancelGroup && selectedAppointmentIds && selectedAppointmentIds.length > 0
      toast({
        title: "התור בוטל בהצלחה",
        description: isGroupOperation
          ? `${selectedAppointmentIds.length} תורים בוטלו בהצלחה`
          : `התור של ${appointmentToCancel.treatments[0]?.name || 'הכלב'} בוטל בהצלחה`,
        variant: "default",
      })

      // Invalidate cache to refresh the schedule
      dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment", "GardenAppointment"]))

      // Refresh the data by invalidating the cache and refetching
      await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule']))
      await refetch()

    } catch (error) {
      console.error('Error cancelling appointment:', error)

      // Show error toast
      toast({
        title: "שגיאה בביטול התור",
        description: error.message || "אירעה שגיאה בעת ביטול התור",
        variant: "destructive",
      })

      // Refresh the data even on error to ensure UI is up-to-date
      await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule']))
      await refetch()
    } finally {
      setIsCancelling(false)
    }
  }

  const handleTreatmentClick = (treatment: ManagerTreatment) => {
    setSelectedTreatment({
      id: treatment.id,
      name: treatment.name,
      treatmentType: treatment.treatmentType,
      clientClassification: treatment.clientClassification,
      owner: treatment.clientName ? {
        name: treatment.clientName,
        classification: treatment.clientClassification,
      } : undefined,
      // Use the actual fields from the treatment data
      gender: treatment.gender,
      notes: treatment.notes,
      medicalNotes: treatment.medicalNotes,
      importantNotes: treatment.importantNotes,
      internalNotes: treatment.internalNotes,
      vetName: treatment.vetName,
      vetPhone: treatment.vetPhone,
      healthIssues: treatment.healthIssues,
      birthDate: treatment.birthDate,
      tendsToBite: treatment.tendsToBite,
      aggressiveWithOtherTreatments: treatment.aggressiveWithOtherTreatments,
      hasBeenToGarden: treatment.hasBeenToGarden,
      suitableForGardenFromQuestionnaire: treatment.suitableForGardenFromQuestionnaire,
      notSuitableForGardenFromQuestionnaire: treatment.notSuitableForGardenFromQuestionnaire,
      recordId: treatment.recordId,
      recordNumber: treatment.recordNumber,
    })
    setShowAllPastAppointments(false) // Reset to collapsed state
    // Close client details modal if it's open
    setIsClientDetailsOpen(false)
    setSelectedClient(null)
    // Open treatment details modal
    setIsTreatmentDetailsOpen(true)
  }

  const handleClientClick = (client: ClientDetails) => {
    setSelectedClient(client)
    // Close treatment details modal if it's open
    setIsTreatmentDetailsOpen(false)
    setSelectedTreatment(null)
    // Open client details modal
    setIsClientDetailsOpen(true)
  }

  const resetScheduleSearch = useCallback(() => {
    setScheduleSearchTerm("")
    setIsScheduleSearchOpen(false)
    setIsScheduleSearchExpanded(false)
    setRemoteScheduleSearchResults({
      appointments: [],
      treatments: [],
      clients: [],
    })
    setScheduleSearchError(null)
    latestScheduleSearchTermRef.current = ""
  }, [])

  useLayoutEffect(() => {
    if (hasScheduleSearchQuery) {
      setIsScheduleSearchExpanded(true)
    } else if (!isScheduleSearchOpen) {
      setIsScheduleSearchExpanded(false)
    }
  }, [hasScheduleSearchQuery, isScheduleSearchOpen])


  const handleScheduleSearchOpenAppointment = useCallback(
    (appointment: ManagerAppointment) => {
      handleAppointmentClick(appointment)
      resetScheduleSearch()
    },
    [handleAppointmentClick, resetScheduleSearch]
  )

  const handleScheduleSearchOpenTreatment = useCallback(
    (treatment: ManagerTreatment) => {
      handleTreatmentClick(treatment)
      resetScheduleSearch()
    },
    [handleTreatmentClick, resetScheduleSearch]
  )

  const handleScheduleSearchOpenClientFromDetails = useCallback(
    (clientDetails: ClientDetails) => {
      handleClientClick(clientDetails)
      resetScheduleSearch()
    },
    [handleClientClick, resetScheduleSearch]
  )

  const handleScheduleSearchOpenClientFromAppointment = useCallback(
    (appointment: ManagerAppointment) => {
      if (!appointment.clientName) {
        return
      }
      const primaryTreatment = Array.isArray(appointment.treatments) ? appointment.treatments[0] : undefined
      handleScheduleSearchOpenClientFromDetails({
        name: appointment.clientName,
        classification: appointment.clientClassification ?? primaryTreatment?.clientClassification,
        phone: appointment.clientPhone,
        email: appointment.clientEmail,
        recordId: appointment.recordId,
        recordNumber: appointment.recordNumber,
      })
    },
    [handleScheduleSearchOpenClientFromDetails]
  )

  const handleScheduleSearchJumpToDate = useCallback(
    (appointment: ManagerAppointment) => {
      const targetDate = parseISODate(appointment.startDateTime)
      if (targetDate) {
        setSelectedDate(targetDate)
      }
      resetScheduleSearch()
    },
    [resetScheduleSearch, setSelectedDate]
  )

  const handleScheduleSearchEntryPrimaryAction = useCallback(
    (entry: ScheduleSearchEntry) => {
      if (entry.appointment) {
        handleScheduleSearchOpenAppointment(entry.appointment)
        return
      }
      if (entry.entityType === "treatment" && entry.treatment) {
        handleScheduleSearchOpenTreatment(entry.treatment)
        return
      }
      if (entry.clientDetails) {
        handleScheduleSearchOpenClientFromDetails(entry.clientDetails)
      }
    },
    [handleScheduleSearchOpenAppointment, handleScheduleSearchOpenTreatment, handleScheduleSearchOpenClientFromDetails]
  )

  const handleScheduleSearchInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        resetScheduleSearch()
        return
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setIsScheduleSearchOpen(true)
        if (!scheduleSearchResults.length) {
          return
        }
        setScheduleSearchActiveIndex((prev) => {
          const nextIndex = prev + 1
          if (nextIndex >= scheduleSearchResults.length) {
            return 0
          }
          return nextIndex
        })
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setIsScheduleSearchOpen(true)
        if (!scheduleSearchResults.length) {
          return
        }
        setScheduleSearchActiveIndex((prev) => {
          if (prev <= 0) {
            return scheduleSearchResults.length - 1
          }
          return prev - 1
        })
        return
      }

      if (event.key === "Enter") {
        if (scheduleSearchActiveIndex >= 0 && scheduleSearchResults[scheduleSearchActiveIndex]) {
          event.preventDefault()
          handleScheduleSearchEntryPrimaryAction(scheduleSearchResults[scheduleSearchActiveIndex])
        }
      }
    },
    [
      handleScheduleSearchEntryPrimaryAction,
      resetScheduleSearch,
      scheduleSearchActiveIndex,
      scheduleSearchResults,
      setIsScheduleSearchOpen,
    ]
  )

  // Garden edit modal functions
  const openGardenEditModal = (appointment: ManagerAppointment, targetColumnId?: string) => {
    const dates = getAppointmentDates(appointment)
    if (!dates) {
      toast({
        title: "שגיאה בעריכת התור",
        description: "לא ניתן לפתוח את עריכת התור בגלל נתוני זמן חסרים או לא תקינים.",
        variant: "destructive",
      })
      return
    }
    const { start: startDate, end: endDate } = dates
    const treatments = Array.isArray(appointment.treatments) ? appointment.treatments : []

    setEditingAppointment(appointment)

    // Determine the appointment type based on gardenAppointmentType and gardenIsTrial
    let appointmentType: 'full-day' | 'hourly' | 'trial' = 'hourly'
    const baseType = appointment.gardenAppointmentType || 'hourly'
    const isTrial = !!appointment.gardenIsTrial

    // If this is a drag operation, use the target column to pre-select the type
    if (targetColumnId) {
      switch (targetColumnId) {
        case 'garden-full-day':
          appointmentType = 'full-day'
          break
        case 'garden-trial':
          appointmentType = 'trial'
          break
        case 'garden-hourly':
        default:
          appointmentType = 'hourly'
          break
      }
    } else {
      // For edit operations, determine from current appointment
      if (isTrial) {
        appointmentType = 'trial'
      } else if (baseType === 'full-day') {
        appointmentType = 'full-day'
      } else {
        appointmentType = 'hourly'
      }
    }

    setGardenEditForm({
      date: startDate,
      startTime: format(startDate, 'HH:mm'),
      endTime: format(endDate, 'HH:mm'),
      appointmentType,
      notes: appointment.notes || '',
      internalNotes: appointment.internalNotes || '',
      latePickupRequested: appointment.latePickupRequested || false,
      latePickupNotes: appointment.latePickupNotes || '',
      gardenTrimNails: appointment.gardenTrimNails || false,
      gardenBrush: appointment.gardenBrush || false,
      gardenBath: appointment.gardenBath || false,
    })
    setGardenEditOpen(true)
  }

  const openGroomingEditModal = (appointment: ManagerAppointment) => {
    const startDate = parseISODate(appointment.startDateTime)
    if (!startDate) {
      toast({
        title: "שגיאה בעריכת התור",
        description: "לא ניתן לפתוח את עריכת התור בגלל נתוני זמן חסרים או לא תקינים.",
        variant: "destructive",
      })
      return
    }

    setEditingGroomingAppointment(appointment)
    setGroomingEditForm({
      date: startDate,
      startTime: format(startDate, 'HH:mm'),
      stationId: appointment.stationId,
      notes: appointment.notes || '',
      internalNotes: appointment.internalNotes || ''
    })
    setGroomingEditOpen(true)
  }
  const handleGardenEditConfirm = async () => {
    if (!editingAppointment) return

    setGardenEditLoading(true)

    try {
      // Calculate new start and end times
      const [startHour, startMinute] = gardenEditForm.startTime.split(':').map(Number)
      const [endHour, endMinute] = gardenEditForm.endTime.split(':').map(Number)

      const newStartTime = new Date(
        gardenEditForm.date.getFullYear(),
        gardenEditForm.date.getMonth(),
        gardenEditForm.date.getDate(),
        startHour,
        startMinute
      )
      const newEndTime = new Date(
        gardenEditForm.date.getFullYear(),
        gardenEditForm.date.getMonth(),
        gardenEditForm.date.getDate(),
        endHour,
        endMinute
      )

      // Determine the target station and appointment type based on the selected type
      let targetStationId = 'garden-station'
      let targetStationName = 'גן הכלבים'
      let finalGardenAppointmentType: 'full-day' | 'hourly' = 'hourly'
      let finalGardenIsTrial = false

      switch (gardenEditForm.appointmentType) {
        case 'full-day':
          targetStationId = 'garden-full-day'
          targetStationName = 'גן - יום מלא'
          finalGardenAppointmentType = 'full-day'
          finalGardenIsTrial = false
          break
        case 'trial':
          targetStationId = 'garden-trial'
          targetStationName = 'גן - ניסיון'
          finalGardenAppointmentType = 'hourly' // Trial appointments are always hourly type in the backend
          finalGardenIsTrial = true
          break
        case 'hourly':
        default:
          targetStationId = 'garden-hourly'
          targetStationName = 'גן - שעתי'
          finalGardenAppointmentType = 'hourly'
          finalGardenIsTrial = false
          break
      }

      // Update the cache immediately
      if (data) {
        dispatch(
          supabaseApi.util.updateQueryData(
            'getManagerSchedule',
            {
              date: format(selectedDate, 'yyyy-MM-dd'),
              serviceType: serviceFilter
            },
            (draft) => {
              if (draft) {
                const appointmentIndex = draft.appointments.findIndex(
                  apt => apt.id === editingAppointment.id
                )

                if (appointmentIndex !== -1) {
                  draft.appointments[appointmentIndex] = {
                    ...draft.appointments[appointmentIndex],
                    startDateTime: newStartTime.toISOString(),
                    endDateTime: newEndTime.toISOString(),
                    stationId: targetStationId,
                    stationName: targetStationName,
                    gardenAppointmentType: finalGardenAppointmentType,
                    gardenIsTrial: finalGardenIsTrial,
                    notes: gardenEditForm.notes,
                    internalNotes: gardenEditForm.internalNotes,
                    latePickupRequested: gardenEditForm.latePickupRequested,
                    latePickupNotes: gardenEditForm.latePickupNotes,
                    gardenTrimNails: gardenEditForm.gardenTrimNails,
                    gardenBrush: gardenEditForm.gardenBrush,
                    gardenBath: gardenEditForm.gardenBath,
                  }
                }
              }
            }
          )
        )
      }

      await moveAppointment({
        appointmentId: editingAppointment.id,
        newStationId: targetStationId,
        newStartTime: newStartTime.toISOString(),
        newEndTime: newEndTime.toISOString(),
        oldStationId: editingAppointment.stationId,
        oldStartTime: editingAppointment.startDateTime,
        oldEndTime: editingAppointment.endDateTime,
        appointmentType: 'garden',
        newGardenAppointmentType: finalGardenAppointmentType,
        newGardenIsTrial: finalGardenIsTrial,
        selectedHours: {
          start: gardenEditForm.startTime,
          end: gardenEditForm.endTime
        },
        // Add garden services to the payload
        gardenTrimNails: gardenEditForm.gardenTrimNails,
        gardenBrush: gardenEditForm.gardenBrush,
        gardenBath: gardenEditForm.gardenBath,
        latePickupRequested: gardenEditForm.latePickupRequested,
        latePickupNotes: gardenEditForm.latePickupNotes,
        internalNotes: gardenEditForm.internalNotes
      }).unwrap()

      // Close the modal after successful update
      setGardenEditOpen(false)
      setEditingAppointment(null)

    } catch (error) {
      console.error('❌ Error updating garden appointment:', error)

      // Show user-friendly error message
      if (error && typeof error === 'object' && 'data' in error) {
        const apiError = error as { data?: { error?: string } }
        console.error('API Error details:', apiError.data)
        alert(`שגיאה בעדכון התור: ${apiError.data?.error || 'שגיאה לא ידועה'}`)
      } else {
        console.error('Unexpected error:', error)
        alert('שגיאה בעדכון התור. אנא נסה שוב.')
      }

      // Don't close the modal on error so user can try again
      // setGardenEditOpen(false)
      // setEditingAppointment(null)
    } finally {
      setGardenEditLoading(false)
    }
  }
  const handleGroomingEditConfirm = async () => {
    if (!editingGroomingAppointment) return

    setGroomingEditLoading(true)

    try {
      // Calculate new start and end times
      const [startHour, startMinute] = groomingEditForm.startTime.split(':').map(Number)

      // If this is a resize operation, use the new duration from pendingResizeState
      let durationToUse: number
      if (pendingResizeState && pendingResizeState.appointment.id === editingGroomingAppointment.id) {
        durationToUse = pendingResizeState.newDuration * 60 * 1000 // Convert minutes to milliseconds
      } else {
        durationToUse = new Date(editingGroomingAppointment.endDateTime).getTime() - new Date(editingGroomingAppointment.startDateTime).getTime()
      }

      const newStartTime = new Date(
        groomingEditForm.date.getFullYear(),
        groomingEditForm.date.getMonth(),
        groomingEditForm.date.getDate(),
        startHour,
        startMinute
      )
      const newEndTime = new Date(newStartTime.getTime() + durationToUse)

      // Call the move appointment API (which handles updates) - using direct Supabase
      const moveResult = await moveAppointment({
        appointmentId: editingGroomingAppointment.id,
        appointmentType: 'grooming',
        oldStationId: editingGroomingAppointment.stationId,
        oldStartTime: editingGroomingAppointment.startDateTime,
        oldEndTime: editingGroomingAppointment.endDateTime,
        newStationId: groomingEditForm.stationId,
        newStartTime: newStartTime.toISOString(),
        newEndTime: newEndTime.toISOString(),
        internalNotes: groomingEditForm.internalNotes
      }).unwrap()

      if (!moveResult.success) {
        throw new Error(moveResult.error || 'Failed to update appointment')
      }

      // Show success toast
      toast({
        title: "התור עודכן בהצלחה",
        description: `התור של ${editingGroomingAppointment.treatments[0]?.name || 'הכלב'} עודכן בהצלחה`,
        variant: "default",
      })

      // Close modal and clear pending state
      setGroomingEditOpen(false)
      setEditingGroomingAppointment(null)
      setPendingResizeState(null) // Clear pending resize state
      // Note: RTK Query cache will be automatically invalidated by the mutation's invalidatesTags

    } catch (error) {
      console.error('Error updating grooming appointment:', error)

      // If this was a resize operation, revert the optimistic update
      if (pendingResizeState) {
        dispatch(
          supabaseApi.util.updateQueryData(
            'getManagerSchedule',
            {
              date: format(selectedDate, 'yyyy-MM-dd'),
              serviceType: serviceFilter
            },
            (draft) => {
              if (!draft) return
              const appointmentIndex = draft.appointments.findIndex(
                (apt) => apt.id === pendingResizeState.appointment.id
              )
              if (appointmentIndex === -1) return

              draft.appointments[appointmentIndex] = {
                ...draft.appointments[appointmentIndex],
                endDateTime: pendingResizeState.originalEndTime.toISOString(),
                durationMinutes: pendingResizeState.originalDuration,
              }
            }
          )
        )
      }

      toast({
        title: "שגיאה בעדכון התור",
        description: error.message || "אירעה שגיאה בעת עדכון התור",
        variant: "destructive",
      })
    } finally {
      setGroomingEditLoading(false)
    }
  }

  const handleTreatmentDetailsOpenChange = (open: boolean) => {
    setIsTreatmentDetailsOpen(open)
    if (!open) {
      setSelectedTreatment(null)
    }
  }

  const handleClientDetailsOpenChange = (open: boolean) => {
    setIsClientDetailsOpen(open)
    if (!open) {
      setSelectedClient(null)
    }
  }

  // Helper function to format birth date and calculate age
  const formatBirthDateWithAge = (birthDateString?: string) => {
    if (!birthDateString) return null

    try {
      // Parse the date (assuming it comes in YYYY-MM-DD format from Supabase)
      const birthDate = new Date(birthDateString)
      if (isNaN(birthDate.getTime())) return null

      // Format as DD/MM/YYYY
      const day = birthDate.getDate().toString().padStart(2, '0')
      const month = (birthDate.getMonth() + 1).toString().padStart(2, '0')
      const year = birthDate.getFullYear()
      const formattedDate = `${day}/${month}/${year}`

      // Calculate age in years and months
      const today = new Date()
      let years = today.getFullYear() - birthDate.getFullYear()
      let months = today.getMonth() - birthDate.getMonth()

      if (today.getDate() < birthDate.getDate()) {
        months--
      }

      if (months < 0) {
        years--
        months += 12
      }

      // Format age string
      let ageString = ''
      if (years > 0) {
        ageString += `${years} שנים`
      }
      if (months > 0) {
        if (ageString) ageString += ' '
        ageString += `${months} חודשים`
      }

      // If less than a month old
      if (years === 0 && months === 0) {
        ageString = 'פחות מחודש'
      }

      return `${formattedDate} (${ageString})`
    } catch (error) {
      console.error('Error formatting birth date:', error)
      return null
    }
  }

  const groupedAppointments = useMemo(() => {
    const allAppointments = [...(data?.appointments ?? []), ...optimisticAppointments]
    if (allAppointments.length === 0) {
      return new Map<string, ManagerAppointment[]>()
    }

    const map = new Map<string, ManagerAppointment[]>()
    for (const appointment of allAppointments) {
      if (visibleStationIds.length > 0 && !visibleStationIds.includes(appointment.stationId)) {
        continue
      }
      // Exclude garden appointments from regular station grouping - they'll be handled separately
      if (appointment.serviceType === "garden") {
        continue
      }

      // Apply service filter for grooming appointments
      if (serviceFilter === "garden") {
        continue // Skip grooming appointments when garden only is selected
      }

      // Validate appointment dates - ensure appointments are within the current calendar day
      const appointmentStartDate = parseISODate(appointment.startDateTime)
      const appointmentEndDate = parseISODate(appointment.endDateTime)

      if (!appointmentStartDate || !appointmentEndDate) {
        console.warn('Invalid appointment dates:', appointment.id, appointment.startDateTime, appointment.endDateTime)
        continue
      }

      // Check if appointment is within the current calendar day
      const currentDayStart = startOfDay(selectedDate)
      const currentDayEnd = addHours(currentDayStart, 24)

      // Only show appointments that start or end within the current calendar day
      const isWithinCurrentDay = (
        (appointmentStartDate >= currentDayStart && appointmentStartDate < currentDayEnd) ||
        (appointmentEndDate >= currentDayStart && appointmentEndDate < currentDayEnd) ||
        (appointmentStartDate < currentDayStart && appointmentEndDate >= currentDayEnd)
      )

      if (!isWithinCurrentDay) {
        continue
      }

      if (!map.has(appointment.stationId)) {
        map.set(appointment.stationId, [])
      }
      map.get(appointment.stationId)!.push(appointment)
    }

    for (const appointments of map.values()) {
      appointments.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
    }

    return map
  }, [data?.appointments, optimisticAppointments, visibleStationIds, serviceFilter])

  const handleStationToggle = (stationId: string, next: boolean) => {
    setVisibleStationIds((prev) => {
      if (next) {
        return prev.includes(stationId) ? prev : [...prev, stationId]
      }
      return prev.filter((id) => id !== stationId)
    })
  }

  const handleSelectAllStations = () => {
    if (stations.length) {
      setVisibleStationIds(stations.map((station) => station.id))
    }
  }

  const handleClearStations = () => {
    setVisibleStationIds([])
  }

  const persistStationOrder = useCallback(async (orderedIds: string[]) => {
    const payload = orderedIds
      .filter((id) => !id.startsWith("garden-"))
      .map((id, index) => ({ id, display_order: index }))

    if (payload.length === 0) {
      return
    }

    const enrichedPayload = payload
      .map(({ id, display_order }) => {
        const station = stations.find((s) => s.id === id)
        if (!station) {
          return null
        }
        return {
          id,
          display_order,
          name: station.name,
          is_active: station.isActive ?? true,
        }
      })
      .filter((value): value is { id: string; display_order: number; name: string; is_active: boolean } => value !== null)

    if (enrichedPayload.length === 0) {
      return
    }

    setIsStationOrderSaving(true)
    try {
      const { error: orderError } = await supabase
        .from("stations")
        .upsert(enrichedPayload, { onConflict: "id" })

      if (orderError) throw orderError

      dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Station"]))
    } catch (error) {
      console.error("Error updating station order:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את סדר העמדות",
        variant: "destructive",
      })
    } finally {
      setIsStationOrderSaving(false)
    }
  }, [dispatch, toast, stations])

  const handleStationReorderEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    setStationOrderIds((prev) => {
      const oldIndex = prev.indexOf(String(active.id))
      const newIndex = prev.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) {
        return prev
      }
      const next = arrayMove(prev, oldIndex, newIndex)
      void persistStationOrder(next)
      return next
    })
  }, [persistStationOrder])

  const handleResizeMove = useCallback((event: PointerEvent) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const deltaY = event.clientY - resizeState.startY
    const deltaMinutes = deltaY / pixelsPerMinute
    const snappedRelativeMinutes = Math.round(deltaMinutes / intervalMinutes) * intervalMinutes

    const baseDurationMinutes = Math.max(
      intervalMinutes,
      differenceInMinutes(resizeState.initialEnd, resizeState.startDate)
    )

    const provisionalDuration = baseDurationMinutes + snappedRelativeMinutes
    const snappedDuration = Math.max(
      intervalMinutes,
      Math.round(provisionalDuration / intervalMinutes) * intervalMinutes
    )

    let candidateEnd = addMinutes(resizeState.startDate, snappedDuration)

    const minimumEnd = addMinutes(resizeState.startDate, intervalMinutes)
    const clampedToTimelineEnd = min([candidateEnd, timeline.end])
    candidateEnd = max([clampedToTimelineEnd, minimumEnd])

    if (candidateEnd.getTime() !== resizeState.currentEnd.getTime()) {
      resizeState.currentEnd = candidateEnd
      setResizingPreview({ appointmentId: resizeState.appointment.id, endDate: candidateEnd })
    }
  }, [intervalMinutes, pixelsPerMinuteScale, timeline.end])

  const finalizeResize = useCallback((resizeState: ResizeState, nextEnd: Date) => {
    const originalEndIso = resizeState.initialEnd.toISOString()
    const nextEndIso = nextEnd.toISOString()

    if (originalEndIso === nextEndIso) {
      return
    }

    const nextDuration = Math.max(
      intervalMinutes,
      differenceInMinutes(nextEnd, resizeState.startDate)
    )
    const originalDuration = Math.max(
      intervalMinutes,
      differenceInMinutes(resizeState.initialEnd, resizeState.startDate)
    )

    if (resizeState.appointment.isProposedMeeting) {
      handleOpenProposedMeetingEditor(resizeState.appointment, {
        startTime: resizeState.startDate,
        endTime: nextEnd,
        stationId: resizeState.appointment.stationId,
      })
      return
    }

    // Apply optimistic update to frontend state immediately
    // This provides instant visual feedback while the API call happens in background
    // The webhook will handle the final data refresh after the backend processes the change
    if (data) {
      dispatch(
        supabaseApi.util.updateQueryData(
          'getManagerSchedule',
          {
            date: format(selectedDate, 'yyyy-MM-dd'),
            serviceType: serviceFilter
          },
          (draft) => {
            if (!draft) return
            const appointmentIndex = draft.appointments.findIndex(
              (apt) => apt.id === resizeState.appointment.id
            )
            if (appointmentIndex === -1) return

            draft.appointments[appointmentIndex] = {
              ...draft.appointments[appointmentIndex],
              endDateTime: nextEndIso,
              durationMinutes: nextDuration,
            }
          }
        )
      )
    }

    // Store the resize state for potential reversion
    setPendingResizeState({
      appointment: resizeState.appointment,
      originalEndTime: resizeState.initialEnd,
      newEndTime: nextEnd,
      originalDuration,
      newDuration: nextDuration
    })

    // Open the grooming edit modal with the new end time
    const startDate = parseISODate(resizeState.appointment.startDateTime)
    if (!startDate) {
      toast({
        title: "שגיאה בעריכת התור",
        description: "לא ניתן לפתוח את עריכת התור בגלל נתוני זמן חסרים או לא תקינים.",
        variant: "destructive",
      })
      return
    }

    setEditingGroomingAppointment(resizeState.appointment)
    setGroomingEditForm({
      date: startDate,
      startTime: format(startDate, 'HH:mm'),
      stationId: resizeState.appointment.stationId,
      notes: resizeState.appointment.notes || '',
      internalNotes: resizeState.appointment.internalNotes || ''
    })
    setGroomingEditOpen(true)
  }, [intervalMinutes, toast, data, dispatch, selectedDate, serviceFilter])

  const handleResizeEnd = useCallback((event: PointerEvent) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    window.removeEventListener('pointermove', handleResizeMove)
    window.removeEventListener('pointerup', handleResizeEnd)
    window.removeEventListener('pointercancel', handleResizeEnd)

    resizeStateRef.current = null
    setResizingPreview(null)

    if (resizeState.currentEnd.getTime() === resizeState.initialEnd.getTime()) {
      return
    }

    void finalizeResize(resizeState, resizeState.currentEnd)
  }, [finalizeResize, handleResizeMove])

  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>, appointment: ManagerAppointment) => {
    if (appointment.serviceType !== "grooming") {
      return
    }

    if (resizeStateRef.current) {
      return
    }

    const dates = getAppointmentDates(appointment)
    if (!dates) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const { start, end } = dates
    resizeStateRef.current = {
      appointment,
      startY: event.clientY,
      startDate: start,
      initialEnd: end,
      currentEnd: end,
      pointerId: event.pointerId,
    }

    setResizingPreview({ appointmentId: appointment.id, endDate: end })
    window.addEventListener('pointermove', handleResizeMove)
    window.addEventListener('pointerup', handleResizeEnd)
    window.addEventListener('pointercancel', handleResizeEnd)
  }

  // Constraint resize handlers
  const handleConstraintResizeMove = useCallback((event: PointerEvent) => {
    const resizeState = constraintResizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const deltaY = event.clientY - resizeState.startY
    const deltaMinutes = deltaY / pixelsPerMinute
    const snappedMinutes = Math.round(deltaMinutes / intervalMinutes) * intervalMinutes

    let candidateEnd = addMinutes(resizeState.initialEnd, snappedMinutes)
    const minimumEnd = addMinutes(resizeState.startDate, intervalMinutes)
    const clampedToTimelineEnd = min([candidateEnd, timeline.end])
    candidateEnd = max([clampedToTimelineEnd, minimumEnd])

    if (candidateEnd.getTime() !== resizeState.currentEnd.getTime()) {
      resizeState.currentEnd = candidateEnd
      setConstraintResizingPreview({ constraintId: resizeState.constraint.id, endDate: candidateEnd })
    }
  }, [intervalMinutes, pixelsPerMinuteScale, timeline.end])

  const finalizeConstraintResize = useCallback(async (resizeState: ConstraintResizeState, nextEnd: Date) => {
    const originalEndIso = resizeState.initialEnd.toISOString()
    const nextEndIso = nextEnd.toISOString()

    if (originalEndIso === nextEndIso) {
      return
    }

    // Open the constraint edit modal with the new end time
    const startDate = parseISODate(resizeState.constraint.start_time)
    if (!startDate) {
      toast({
        title: "שגיאה בעריכת האילוץ",
        description: "לא ניתן לפתוח את עריכת האילוץ בגלל נתוני זמן חסרים או לא תקינים.",
        variant: "destructive",
      })
      return
    }

    // Fetch all related constraints to get all originally selected stations
    try {
      const { data: allConstraints } = await supabase
        .from("station_unavailability")
        .select("station_id, reason, notes")
        .eq("start_time", resizeState.constraint.start_time)
        .eq("end_time", resizeState.constraint.end_time)

      if (allConstraints) {
        // Filter client-side to find constraints with matching reason and notes
        const constraintReason = resizeState.constraint.reason
        const constraintNotesJson = resizeState.constraint.notes ? JSON.stringify(resizeState.constraint.notes) : null

        const relatedConstraints = allConstraints.filter(c => {
          const cReason = c.reason
          const cNotesJson = c.notes ? JSON.stringify(c.notes) : null
          const reasonMatch = constraintReason === cReason || (!constraintReason && !cReason)
          const notesMatch = constraintNotesJson === cNotesJson
          return reasonMatch && notesMatch
        })

        // Get all station IDs from related constraints
        const stationIds = Array.from(new Set(relatedConstraints.map(c => c.station_id)))

        setEditingConstraint(resizeState.constraint)
        setEditingConstraintStationIds(stationIds.length > 0 ? stationIds : [resizeState.constraint.station_id])
      } else {
        // Fallback if query fails - just use the current constraint's station
        setEditingConstraint(resizeState.constraint)
        setEditingConstraintStationIds([resizeState.constraint.station_id])
      }
    } catch (error) {
      console.error("Error fetching related constraints:", error)
      // Fallback if query fails - just use the current constraint's station
      setEditingConstraint(resizeState.constraint)
      setEditingConstraintStationIds([resizeState.constraint.station_id])
    }

    setEditingConstraintDefaultTimes({
      startDate: startDate,
      endDate: nextEnd,
      startTime: `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`,
      endTime: `${String(nextEnd.getHours()).padStart(2, "0")}:${String(nextEnd.getMinutes()).padStart(2, "0")}`
    })
    setIsConstraintDialogOpen(true)
  }, [toast, setIsConstraintDialogOpen, setEditingConstraint, setEditingConstraintStationIds, setEditingConstraintDefaultTimes])

  const handleConstraintResizeEnd = useCallback((event: PointerEvent) => {
    const resizeState = constraintResizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    window.removeEventListener('pointermove', handleConstraintResizeMove)
    window.removeEventListener('pointerup', handleConstraintResizeEnd)
    window.removeEventListener('pointercancel', handleConstraintResizeEnd)

    constraintResizeStateRef.current = null
    setConstraintResizingPreview(null)

    if (resizeState.currentEnd.getTime() === resizeState.initialEnd.getTime()) {
      return
    }

    void finalizeConstraintResize(resizeState, resizeState.currentEnd)
  }, [finalizeConstraintResize, handleConstraintResizeMove])

  const handleConstraintResizeStart = (event: React.PointerEvent<HTMLButtonElement>, constraint: typeof constraints[0]) => {
    if (constraintResizeStateRef.current || resizeStateRef.current) {
      return
    }

    const startDate = parseISODate(constraint.start_time)
    const endDate = parseISODate(constraint.end_time)
    if (!startDate || !endDate) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    constraintResizeStateRef.current = {
      constraint,
      startY: event.clientY,
      startDate: startDate,
      initialEnd: endDate,
      currentEnd: endDate,
      pointerId: event.pointerId,
    }

    setConstraintResizingPreview({ constraintId: constraint.id, endDate: endDate })
    window.addEventListener('pointermove', handleConstraintResizeMove)
    window.addEventListener('pointerup', handleConstraintResizeEnd)
    window.addEventListener('pointercancel', handleConstraintResizeEnd)
  }
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleResizeMove)
      window.removeEventListener('pointerup', handleResizeEnd)
      window.removeEventListener('pointercancel', handleResizeEnd)
      window.removeEventListener('pointermove', handleConstraintResizeMove)
      window.removeEventListener('pointerup', handleConstraintResizeEnd)
      window.removeEventListener('pointercancel', handleConstraintResizeEnd)
    }
  }, [handleResizeEnd, handleResizeMove, handleConstraintResizeEnd, handleConstraintResizeMove])

  const handleDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as
      | { type: 'appointment'; appointment: ManagerAppointment }
      | { type: 'constraint'; constraint: typeof constraints[0] }
      | { type: 'waitlist'; entry: ManagerWaitlistEntry }
      | undefined

    if (dragData?.type === 'appointment' && dragData.appointment) {
      setDraggedAppointment({
        appointment: dragData.appointment,
        cancelled: false
      })
      setHighlightedSlots(null)
      return
    }

    if (dragData?.type === 'constraint' && dragData.constraint) {
      setDraggedConstraint({
        constraint: dragData.constraint,
        cancelled: false
      })
      setHighlightedSlots(null)
      return
    }

    if (dragData?.type === 'waitlist' && dragData.entry) {
      setDraggedWaitlistEntry({
        entry: dragData.entry,
        cancelled: false
      })
      setHighlightedSlots(null)
      return
    }
  }

  const updateHighlightedSlotFromMousePosition = (mouseX: number, mouseY: number) => {
    const activeWaitlistEntry = draggedWaitlistEntry.entry
    const draggedItem = draggedAppointment.appointment || draggedConstraint.constraint || activeWaitlistEntry
    if (!draggedItem || !data) return

    // Find which station element the mouse is over
    const stationElements = document.querySelectorAll('[data-testid^="station-"]')
    let targetStation: ManagerStation | null = null
    let stationElement: Element | null = null

    for (const element of stationElements) {
      const rect = element.getBoundingClientRect()
      if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
        const stationId = element.getAttribute('data-testid')?.replace('station-', '')
        if (stationId) {
          targetStation = data.stations.find(s => s.id === stationId) || null
          stationElement = element
          break
        }
      }
    }

    if (!targetStation || !stationElement || !draggedItem) {
      setHighlightedSlots(null)
      return
    }

    // Check service type match for appointments (constraints can be on any station)
    if (draggedAppointment.appointment && draggedAppointment.appointment.serviceType !== targetStation.serviceType) {
      setHighlightedSlots(null)
      return
    }

    if (activeWaitlistEntry && targetStation.serviceType !== "grooming") {
      setHighlightedSlots(null)
      return
    }

    // Calculate time slot based on mouse Y position within the station
    const stationRect = stationElement.getBoundingClientRect()
    const relativeY = mouseY - stationRect.top

    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const minutesFromStart = relativeY / pixelsPerMinute
    const startTimeSlot = Math.max(0, Math.floor(minutesFromStart / intervalMinutes))
    const maxTimeSlot = Math.floor((differenceInMinutes(timeline.end, timeline.start) / intervalMinutes))

    if (startTimeSlot < 0 || startTimeSlot >= maxTimeSlot) {
      setHighlightedSlots(null)
      return
    }

    // Get duration based on what's being dragged
    let durationMinutes: number
    if (draggedAppointment.appointment) {
      const originalStart = new Date(draggedAppointment.appointment.startDateTime)
      const originalEnd = new Date(draggedAppointment.appointment.endDateTime)
      durationMinutes = differenceInMinutes(originalEnd, originalStart)
    } else if (draggedConstraint.constraint) {
      const originalStart = parseISODate(draggedConstraint.constraint.start_time)
      const originalEnd = parseISODate(draggedConstraint.constraint.end_time)
      if (!originalStart || !originalEnd) {
        setHighlightedSlots(null)
        return
      }
      durationMinutes = differenceInMinutes(originalEnd, originalStart)
    } else if (activeWaitlistEntry) {
      durationMinutes = WAITLIST_DEFAULT_DURATION_MINUTES
    } else {
      setHighlightedSlots(null)
      return
    }

    const durationTimeSlots = Math.ceil(durationMinutes / intervalMinutes)
    const endTimeSlot = startTimeSlot + durationTimeSlots - 1

    // Create array of all time slots the appointment will occupy
    const allTimeSlots = []
    for (let i = startTimeSlot; i <= endTimeSlot; i++) {
      allTimeSlots.push(i)
    }

    setHighlightedSlots({
      stationId: targetStation.id,
      startTimeSlot,
      endTimeSlot,
      allTimeSlots
    })

  }

  const handleMouseMove = (event: MouseEvent) => {
    if (draggedAppointment.appointment || draggedConstraint.constraint || draggedWaitlistEntry.entry) {
      setMousePosition({ x: event.clientX, y: event.clientY })

      // Throttle the highlighting updates for better performance
      if (!lastHighlightUpdate || Date.now() - lastHighlightUpdate > 50) {
        updateHighlightedSlotFromMousePosition(event.clientX, event.clientY)
        setLastHighlightUpdate(Date.now())
      }
    }
  }
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) {
      return
    }

    if (draggedAppointment.appointment) {
      const targetStationId = over.id as string
      const targetStation = stations.find(station => station.id === targetStationId)

      if (!targetStation || draggedAppointment.appointment.serviceType !== targetStation.serviceType) {
        return
      }

      return
    }

    if (draggedWaitlistEntry.entry) {
      // Highlighting handled by mouse move; nothing extra needed here yet
      return
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setHighlightedSlots(null)

    // Handle constraint drag
    if (draggedConstraint.constraint) {
      if (draggedConstraint.cancelled) {
        setDraggedConstraint({ constraint: null, cancelled: false })
        return
      }

      // Use the current highlighted slots if available, otherwise fall back to over.id
      const targetStationId = highlightedSlots?.stationId || (over?.id as string)
      const targetTimeSlot = highlightedSlots?.startTimeSlot

      if (!targetStationId || targetTimeSlot === undefined) {
        setDraggedConstraint({ constraint: null, cancelled: false })
        return
      }

      // Calculate new time based on the highlighted slots
      const newStartTime = addMinutes(timeline.start, targetTimeSlot * intervalMinutes)
      const constraintStart = parseISODate(draggedConstraint.constraint.start_time)
      const constraintEnd = parseISODate(draggedConstraint.constraint.end_time)
      if (!constraintStart || !constraintEnd) {
        setDraggedConstraint({ constraint: null, cancelled: false })
        return
      }
      const durationMinutes = differenceInMinutes(constraintEnd, constraintStart)
      const newEndTime = addMinutes(newStartTime, durationMinutes)

      // Fetch all related constraints to get all originally selected stations
      try {
        const { data: allConstraints } = await supabase
          .from("station_unavailability")
          .select("station_id, reason, notes")
          .eq("start_time", draggedConstraint.constraint.start_time)
          .eq("end_time", draggedConstraint.constraint.end_time)

        if (allConstraints) {
          // Filter client-side to find constraints with matching reason and notes
          const constraintReason = draggedConstraint.constraint.reason
          const constraintNotesJson = draggedConstraint.constraint.notes ? JSON.stringify(draggedConstraint.constraint.notes) : null

          const relatedConstraints = allConstraints.filter(c => {
            const cReason = c.reason
            const cNotesJson = c.notes ? JSON.stringify(c.notes) : null
            const reasonMatch = constraintReason === cReason || (!constraintReason && !cReason)
            const notesMatch = constraintNotesJson === cNotesJson
            return reasonMatch && notesMatch
          })

          // Get all station IDs from related constraints
          const stationIds = Array.from(new Set(relatedConstraints.map(c => c.station_id)))

          // Ensure target station is included (in case it's not already in the list)
          if (!stationIds.includes(targetStationId)) {
            stationIds.push(targetStationId)
          }

          setEditingConstraint(draggedConstraint.constraint)
          setEditingConstraintStationIds(stationIds.length > 0 ? stationIds : [targetStationId])
        } else {
          // Fallback if query fails - just use target station and original station
          const originalStationId = draggedConstraint.constraint.station_id
          const stationIds = originalStationId === targetStationId
            ? [targetStationId]
            : [originalStationId, targetStationId]
          setEditingConstraint(draggedConstraint.constraint)
          setEditingConstraintStationIds(stationIds)
        }
      } catch (error) {
        console.error("Error fetching related constraints:", error)
        // Fallback if query fails - just use target station and original station
        const originalStationId = draggedConstraint.constraint.station_id
        const stationIds = originalStationId === targetStationId
          ? [targetStationId]
          : [originalStationId, targetStationId]
        setEditingConstraint(draggedConstraint.constraint)
        setEditingConstraintStationIds(stationIds)
      }

      setEditingConstraintDefaultTimes({
        startDate: newStartTime,
        endDate: newEndTime,
        startTime: `${String(newStartTime.getHours()).padStart(2, "0")}:${String(newStartTime.getMinutes()).padStart(2, "0")}`,
        endTime: `${String(newEndTime.getHours()).padStart(2, "0")}:${String(newEndTime.getMinutes()).padStart(2, "0")}`
      })
      setIsConstraintDialogOpen(true)
      setDraggedConstraint({ constraint: null, cancelled: false })
      return
    }

    if (draggedWaitlistEntry.entry) {
      if (draggedWaitlistEntry.cancelled) {
        setDraggedWaitlistEntry({ entry: null, cancelled: false })
        setHighlightedSlots(null)
        return
      }

      if (over?.data?.current?.type === 'garden-column') {
        setDraggedWaitlistEntry({ entry: null, cancelled: false })
        setHighlightedSlots(null)
        toast({
          title: "יעד לא נתמך",
          description: "ניתן כרגע לגרור לרוחב עמדות המספרה בלבד.",
          variant: "destructive",
        })
        return
      }

      const targetStationId = highlightedSlots?.stationId || (over?.id as string)
      const targetTimeSlot = highlightedSlots?.startTimeSlot

      if (!targetStationId || targetTimeSlot === undefined) {
        setDraggedWaitlistEntry({ entry: null, cancelled: false })
        setHighlightedSlots(null)
        return
      }

      const targetStation = stations.find(station => station.id === targetStationId)
      if (!targetStation || targetStation.serviceType !== "grooming") {
        setDraggedWaitlistEntry({ entry: null, cancelled: false })
        setHighlightedSlots(null)
        toast({
          title: "עמדה לא זמינה",
          description: "בחר עמדת מספרה זמינה כדי לקבוע את התור.",
          variant: "destructive",
        })
        return
      }

      const startTime = addMinutes(timeline.start, targetTimeSlot * intervalMinutes)
      const endTime = addMinutes(startTime, WAITLIST_DEFAULT_DURATION_MINUTES)

      setPendingWaitlistPlacement({
        entry: draggedWaitlistEntry.entry,
        stationId: targetStationId,
        startTime,
        endTime,
      })
      setShouldRemoveFromWaitlist(true)
      setShowWaitlistDropDialog(true)
      setDraggedWaitlistEntry({ entry: null, cancelled: false })
      setHighlightedSlots(null)
      return
    }

    if (!draggedAppointment.appointment) {
      setDraggedAppointment({ appointment: null, cancelled: false })
      return
    }

    // If the drag was cancelled (e.g., by pressing Escape), don't proceed with the move
    if (draggedAppointment.cancelled) {
      setDraggedAppointment({ appointment: null, cancelled: false })
      return
    }

    // Check if dropping on a garden column
    if (over?.data?.current?.type === 'garden-column') {
      const targetColumnId = over.data.current.columnId as string

      // Only allow garden appointments to be dropped on garden columns
      if (draggedAppointment.appointment.serviceType !== 'garden') {
        setDraggedAppointment({ appointment: null, cancelled: false })
        return
      }

      const isTrialTarget = targetColumnId === 'garden-trial'
      const newGardenIsTrial = isTrialTarget
      const fallbackType = draggedAppointment.appointment.gardenAppointmentType ?? 'hourly'
      const newGardenAppointmentType = isTrialTarget
        ? fallbackType
        : targetColumnId === 'garden-full-day'
          ? 'full-day'
          : 'hourly'

      const currentType = draggedAppointment.appointment.gardenAppointmentType ?? fallbackType
      const currentTrial = !!draggedAppointment.appointment.gardenIsTrial

      if (currentType === newGardenAppointmentType && currentTrial === newGardenIsTrial) {
        setDraggedAppointment({ appointment: null, cancelled: false })
        return
      }

      const _newStationName = isTrialTarget
        ? 'גן - ניסיון'
        : targetColumnId === 'garden-full-day'
          ? 'גן - יום מלא'
          : 'גן - שעתי'

      // For garden appointments, open the unified garden edit modal instead of the simple move confirmation
      openGardenEditModal(draggedAppointment.appointment, targetColumnId)
      setDraggedAppointment({ appointment: null, cancelled: false })
      return
    }

    // Use the current highlighted slots if available, otherwise fall back to over.id
    const targetStationId = highlightedSlots?.stationId || (over?.id as string)
    const targetTimeSlot = highlightedSlots?.startTimeSlot

    if (!targetStationId || targetTimeSlot === undefined) {
      setDraggedAppointment({ appointment: null, cancelled: false })
      return
    }

    // Find the target station
    const targetStation = stations.find(station => station.id === targetStationId)
    if (!targetStation) {
      setDraggedAppointment({ appointment: null, cancelled: false })
      return
    }

    // Validate same service type
    if (draggedAppointment.appointment.serviceType !== targetStation.serviceType) {
      setDraggedAppointment({ appointment: null, cancelled: false })
      return
    }

    // Find current station
    const currentStation = stations.find(station => station.id === draggedAppointment.appointment.stationId)
    if (!currentStation) {
      setDraggedAppointment({ appointment: null, cancelled: false })
      return
    }

    // Calculate the new start time based on the target time slot
    const targetMinutes = targetTimeSlot * intervalMinutes
    const newStartTime = addMinutes(timeline.start, targetMinutes)

    // Calculate duration and new end time
    const originalStart = new Date(draggedAppointment.appointment.startDateTime)
    const originalEnd = new Date(draggedAppointment.appointment.endDateTime)
    const durationMinutes = differenceInMinutes(originalEnd, originalStart)
    const newEndTime = addMinutes(newStartTime, durationMinutes)

    if (draggedAppointment.appointment.isProposedMeeting) {
      handleOpenProposedMeetingEditor(draggedAppointment.appointment, {
        startTime: newStartTime,
        endTime: newEndTime,
        stationId: targetStationId,
      })
      setDraggedAppointment({ appointment: null, cancelled: false })
      return
    }

    // Show confirmation modal
    setMoveDetails({
      appointment: draggedAppointment.appointment,
      oldStation: currentStation,
      newStation: targetStation,
      oldStartTime: originalStart,
      oldEndTime: originalEnd,
      newStartTime,
      newEndTime
    })
    setMoveConfirmationOpen(true)
    setDraggedAppointment({ appointment: null, cancelled: false })
  }

  // Drag-to-create appointment handlers
  const handleCreateDragStart = (event: React.MouseEvent, stationId: string) => {
    // Prevent drag-to-create if we're already dragging an appointment or constraint
    if (draggedAppointment.appointment || draggedConstraint.constraint || draggedWaitlistEntry.entry) {
      return
    }

    // Only allow drag-to-create on grooming stations for now
    const station = stations.find(s => s.id === stationId)
    if (!station || station.serviceType !== 'grooming') {
      return
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const y = event.clientY - rect.top

    // Calculate start time based on Y position and snap to interval
    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const minutesFromStart = y / pixelsPerMinute
    const rawStartTime = addMinutes(timeline.start, minutesFromStart)
    const startTime = snapTimeToInterval(rawStartTime, intervalMinutes)

    setDragToCreate({
      isDragging: true,
      startTime,
      endTime: startTime,
      stationId,
      startY: y,
      cancelled: false
    })
  }

  const handleCreateDragMove = (event: React.MouseEvent | MouseEvent) => {
    const currentDrag = dragToCreateRef.current
    if (!currentDrag.isDragging || !currentDrag.startTime || !currentDrag.stationId) {
      return
    }

    const stationElement = document.getElementById(`station-${currentDrag.stationId}`)
    if (!stationElement) return

    const rect = stationElement.getBoundingClientRect()
    const y = event.clientY - rect.top

    // Calculate current time based on Y position and snap to interval
    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const minutesFromStart = y / pixelsPerMinute
    const rawCurrentTime = addMinutes(timeline.start, minutesFromStart)
    const snappedCurrentTime = snapTimeToInterval(rawCurrentTime, intervalMinutes)

    // Determine start and end times based on drag direction
    let startTime: Date
    let endTime: Date

    if (snappedCurrentTime >= currentDrag.startTime) {
      // Dragging down - start time stays the same, current time becomes end time
      startTime = currentDrag.startTime
      endTime = snappedCurrentTime
    } else {
      // Dragging up - current time becomes start time, original start time becomes end time
      startTime = snappedCurrentTime
      endTime = currentDrag.startTime
    }

    // Ensure both times are on the same date as the original start time
    const originalDate = new Date(currentDrag.startTime.getFullYear(), currentDrag.startTime.getMonth(), currentDrag.startTime.getDate())
    startTime.setFullYear(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate())
    endTime.setFullYear(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate())

    // Ensure minimum duration of at least 1 interval
    const minDuration = intervalMinutes
    const currentDuration = differenceInMinutes(endTime, startTime)

    // If the duration is less than minimum or if start and end are the same
    if (currentDuration < minDuration || startTime.getTime() === endTime.getTime()) {
      // If dragging down, extend the end time
      if (snappedCurrentTime >= currentDrag.startTime) {
        endTime = addMinutes(startTime, minDuration)
      } else {
        // If dragging up, extend the start time backwards
        startTime = addMinutes(endTime, -minDuration)
      }
    }

    setDragToCreate(prev => ({
      ...prev,
      startTime,
      endTime
    }))
  }

  const handleCreateDragEnd = () => {
    const currentDrag = dragToCreateRef.current

    if (!currentDrag.isDragging || !currentDrag.startTime || !currentDrag.endTime || !currentDrag.stationId) {
      setDragToCreate({
        isDragging: false,
        startTime: null,
        endTime: null,
        stationId: null,
        startY: null,
        cancelled: false
      })
      return
    }

    // If the drag was cancelled (e.g., by pressing Escape), don't show the modal
    if (currentDrag.cancelled) {
      setDragToCreate({
        isDragging: false,
        startTime: null,
        endTime: null,
        stationId: null,
        startY: null,
        cancelled: false
      })
      return
    }

    // Capture finalized times (snapped to intervals)
    setFinalizedDragTimes({
      startTime: currentDrag.startTime,
      endTime: currentDrag.endTime,
      stationId: currentDrag.stationId
    })

    // Reset drag state
    setDragToCreate({
      isDragging: false,
      startTime: null,
      endTime: null,
      stationId: null,
      startY: null,
      cancelled: false
    })

    // Show appointment type selection modal
    setShowAppointmentTypeSelection(true)
  }
  const handleCreatePrivateAppointment = async () => {
    if (!finalizedDragTimes || !privateAppointmentForm.name.trim()) {
      alert('אנא הכנס שם לתור')
      return
    }

    // Create optimistic appointment data
    const station = stations.find(s => s.id === finalizedDragTimes.stationId)
    const optimisticAppointment: ManagerAppointment = {
      id: `temp_private_${Date.now()}`,
      serviceType: 'grooming',
      stationId: finalizedDragTimes.stationId!,
      stationName: station?.name || `Station ${finalizedDragTimes.stationId}`,
      startDateTime: finalizedDragTimes.startTime!.toISOString(),
      endDateTime: finalizedDragTimes.endTime!.toISOString(),
      status: 'confirmed',
      notes: 'תור פרטי - ' + privateAppointmentForm.name,
      internalNotes: 'תור פרטי - ' + privateAppointmentForm.name,
      treatments: [{
        id: 'private_treatment',
        name: privateAppointmentForm.name,
        treatmentType: 'תור פרטי',
        age: null,
        weight: null,
        image: null,
        clientId: 'private_client',
        clientName: 'צוות פנימי',
        clientPhone: '',
        clientEmail: '',
        clientClassification: '',
        internalNotes: ''
      }],
      clientId: 'private_client',
      clientName: 'צוות פנימי',
      clientPhone: '',
      clientEmail: '',
      serviceName: 'תור פרטי',
      appointmentType: 'private'
    }

    try {
      // Add to local state immediately for optimistic UI
      setOptimisticAppointments(prev => [...prev, optimisticAppointment])

      // Generate group ID if multiple stations are selected
      const groupId = privateAppointmentForm.selectedStations.length > 1
        ? `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        : undefined

      // Make API call
      const result = await createManagerAppointment({
        name: privateAppointmentForm.name,
        stationId: finalizedDragTimes.stationId!,
        selectedStations: privateAppointmentForm.selectedStations,
        startTime: finalizedDragTimes.startTime!.toISOString(),
        endTime: finalizedDragTimes.endTime!.toISOString(),
        groupId,
        appointmentType: "private",
      }).unwrap()

      toast({
        title: "תור פרטי נוצר בהצלחה!",
        description: "התור הפרטי נוסף ללוח הזמנים",
      })

      // Remove from optimistic appointments and refetch data
      setOptimisticAppointments(prev => prev.filter(apt => apt.id !== optimisticAppointment.id))
      refetch()

      // Reset form and close modal
      setPrivateAppointmentForm({ name: '', selectedStations: [] })
      setShowPrivateAppointmentModal(false)
      setFinalizedDragTimes(null)
    } catch (error) {
      console.error('Error creating private appointment:', error)

      // Remove optimistic appointment on error
      setOptimisticAppointments(prev => prev.filter(apt => apt.id !== optimisticAppointment.id))

      // Extract user-friendly error message
      const { getErrorMessage, getErrorDescription } = await import("@/utils/errorMessages")
      const errorMessage = getErrorMessage(error, "אירעה שגיאה בעת יצירת התור הפרטי")
      const errorDescription = getErrorDescription(error)

      toast({
        title: "שגיאה ביצירת התור הפרטי",
        description: errorDescription || errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleOpenProposedMeetingCreate = () => {
    if (!finalizedDragTimes) {
      return
    }
    setProposedMeetingMode("create")
    setEditingProposedMeeting(null)
    setProposedMeetingTimes(finalizedDragTimes)
    setShowAppointmentTypeSelection(false)
    setShowProposedMeetingModal(true)
  }

  const handleOpenProposedMeetingEditor = (
    appointment: ManagerAppointment,
    overrides?: { startTime?: Date; endTime?: Date; stationId?: string }
  ) => {
    if (!appointment.proposedMeetingId) {
      return
    }

    const startTime = overrides?.startTime ?? new Date(appointment.startDateTime)
    const endTime = overrides?.endTime ?? new Date(appointment.endDateTime)
    const stationId = overrides?.stationId ?? appointment.stationId

    setProposedMeetingMode("edit")
    setEditingProposedMeeting({
      ...appointment,
      startDateTime: startTime.toISOString(),
      endDateTime: endTime.toISOString(),
      stationId,
    })
    setProposedMeetingTimes({
      startTime,
      endTime,
      stationId,
    })
    setShowProposedMeetingModal(true)
  }

  const handleSubmitProposedMeeting = async (payload: ProposedMeetingModalSubmission) => {
    try {
      ensureValidProposedMeetingRange(payload.startTime, payload.endTime)

      if (proposedMeetingMode === "create") {
        await createProposedMeeting(payload).unwrap()
        toast({
          title: "מפגש מוצע נוצר בהצלחה",
          description: "חלון הזמן נוסף ליומן ונשמר עבור הלקוחות שהוזמנו.",
        })
      } else if (payload.meetingId) {
        const rescheduleMetadata = editingProposedMeeting?.proposedLinkedAppointmentId
          ? {
            rescheduleAppointmentId: editingProposedMeeting.proposedLinkedAppointmentId,
            rescheduleCustomerId: editingProposedMeeting.proposedLinkedCustomerId ?? null,
            rescheduleTreatmentId: editingProposedMeeting.proposedLinkedTreatmentId ?? null,
            rescheduleOriginalStartAt: editingProposedMeeting.proposedOriginalStart ?? null,
            rescheduleOriginalEndAt: editingProposedMeeting.proposedOriginalEnd ?? null,
          }
          : {}
        await updateProposedMeeting({
          meetingId: payload.meetingId,
          title: payload.title,
          summary: payload.summary,
          notes: payload.notes,
          stationId: payload.stationId,
          startTime: payload.startTime,
          endTime: payload.endTime,
          serviceType: payload.serviceType,
          customerIds: payload.customerIds,
          customerTypeIds: payload.customerTypeIds,
          ...rescheduleMetadata,
        }).unwrap()
        toast({
          title: "המפגש עודכן בהצלחה",
          description: "ההזמנות והחלון נשמרו עם הערכים החדשים.",
        })
      } else {
        throw new Error("חסר מזהה מפגש לעריכה")
      }

      setShowProposedMeetingModal(false)
      setEditingProposedMeeting(null)
      setProposedMeetingTimes(null)
      setFinalizedDragTimes(null)
      await refetch()
    } catch (error) {
      console.error("❌ [ManagerSchedule] Failed to save proposed meeting:", error)
      toast({
        title: "שמירת המפגש נכשלה",
        description: error instanceof Error ? error.message : "אירעה שגיאה בשמירת המפגש המוצע",
        variant: "destructive",
      })
    }
  }

  const handleOpenRescheduleProposal = (appointment: ManagerAppointment) => {
    if (!appointment.clientId) {
      toast({
        title: "אין לקוח משויך",
        description: "לא ניתן להציע זמן חדש לתור שאינו משויך ללקוח.",
        variant: "destructive",
      })
      return
    }
    const start = appointment.startDateTime ? new Date(appointment.startDateTime) : null
    const end = appointment.endDateTime ? new Date(appointment.endDateTime) : null
    if (!start || !end) {
      toast({
        title: "תזמון לא תקין",
        description: "לא הצלחנו לקרוא את זמני התור המקורי.",
        variant: "destructive",
      })
      return
    }

    setRescheduleTargetAppointment(appointment)
    setRescheduleTimes({
      startTime: new Date(start.getTime()),
      endTime: new Date(end.getTime()),
      stationId: appointment.stationId,
    })
    setShowRescheduleProposalModal(true)
  }

  const handleCloseRescheduleProposal = () => {
    setShowRescheduleProposalModal(false)
    setRescheduleTargetAppointment(null)
    setRescheduleTimes(null)
  }

  const handleSubmitRescheduleProposal = async ({ times, summary }: { times: AppointmentTimes; summary: string }) => {
    if (!rescheduleTargetAppointment) {
      return
    }
    if (!times.startTime || !times.endTime || !times.stationId) {
      toast({
        title: "חסר מידע",
        description: "בחרו תאריך, שעת התחלה, שעת סיום ועמדה להצעה.",
        variant: "destructive",
      })
      return
    }

    const customerId = rescheduleTargetAppointment.clientId
    if (!customerId) {
      toast({
        title: "אין לקוח משויך",
        description: "לא ניתן לשלוח ההצעה ללא זיהוי הלקוח.",
        variant: "destructive",
      })
      return
    }

    const startIso = times.startTime.toISOString()
    const endIso = times.endTime.toISOString()

    try {
      ensureValidProposedMeetingRange(startIso, endIso)
      setRescheduleSubmitting(true)
      setRescheduleTimes(times)

      const sanitizedSummary = summary.trim() || "הצעת זמן חדש עבור התור הקיים"
      const payload = {
        stationId: times.stationId,
        startTime: startIso,
        endTime: endIso,
        serviceType: rescheduleTargetAppointment.serviceType,
        title: sanitizedSummary,
        summary: sanitizedSummary,
        notes: undefined,
        customerIds: [customerId],
        customerTypeIds: [],
        rescheduleAppointmentId: rescheduleTargetAppointment.id,
        rescheduleCustomerId: customerId,
        rescheduleTreatmentId: rescheduleTargetAppointment.treatments?.[0]?.id ?? null,
        rescheduleOriginalStartAt: rescheduleTargetAppointment.startDateTime,
        rescheduleOriginalEndAt: rescheduleTargetAppointment.endDateTime,
      }

      await createProposedMeeting(payload).unwrap()

      toast({
        title: "ההצעה נשמרה",
        description: "שלחו קוד או לינק ללקוח כדי לאשר את השעה החדשה.",
      })

      handleCloseRescheduleProposal()
      await refetch()
    } catch (error) {
      console.error("❌ [ManagerSchedule] Failed to create reschedule proposal:", error)
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "data" in error
            ? String((error as { data?: unknown }).data)
            : "לא ניתן ליצור את ההצעה"
      toast({
        title: "שמירת ההצעה נכשלה",
        description: message,
        variant: "destructive",
      })
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  const handleDeleteProposedMeeting = async (appointment: ManagerAppointment) => {
    if (!appointment.proposedMeetingId) {
      return
    }
    setIsDeletingProposed(true)
    try {
      await deleteProposedMeetingMutation(appointment.proposedMeetingId).unwrap()
      toast({
        title: "המפגש נמחק",
        description: "חלון הזמן שוחרר מהיומן וההזמנות בוטלו.",
      })
      setShowProposedMeetingModal(false)
      setEditingProposedMeeting(null)
      setProposedMeetingTimes(null)
      if (selectedAppointment?.id === appointment.id) {
        setSelectedAppointment(null)
        setIsDetailsOpen(false)
      }
      await refetch()
    } catch (error) {
      console.error("❌ [ManagerSchedule] Failed to delete proposed meeting:", error)
      toast({
        title: "לא ניתן למחוק את המפגש",
        description: error instanceof Error ? error.message : "בדקו את החיבור ונסו שוב.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingProposed(false)
    }
  }
  const handleSendSingleProposedInvite = async (
    invite: ProposedMeetingInvite,
    meeting: ManagerAppointment
  ) => {
    if (!invite.customerId || !meeting.proposedMeetingId) {
      return
    }
    setSendingInviteId(invite.id)
    try {
      await sendProposedMeetingWebhook({
        inviteId: invite.id,
        customerId: invite.customerId,
        proposedMeetingId: meeting.proposedMeetingId,
        notificationCount: invite.notificationCount ?? 0,
      }).unwrap()
      toast({
        title: "ההזמנה נשלחה",
        description: invite.customerName ? `נשלח קוד ל-${invite.customerName}` : "ההודעה נשלחה בהצלחה",
      })
      await refetch()
    } catch (error) {
      console.error("❌ [ManagerSchedule] Failed to send invite webhook:", error)
      toast({
        title: "השליחה נכשלה",
        description: error instanceof Error ? error.message : "נסו שוב בעוד מספר רגעים.",
        variant: "destructive",
      })
    } finally {
      setSendingInviteId(null)
    }
  }

  const handleSendAllProposedInvites = async (meeting: ManagerAppointment) => {
    if (!meeting.proposedMeetingId || !(meeting.proposedInvites?.length)) {
      return
    }
    setSendingAllInvites(true)
    try {
      for (const invite of meeting.proposedInvites) {
        if (!invite.customerId) continue
        await sendProposedMeetingWebhook({
          inviteId: invite.id,
          customerId: invite.customerId,
          proposedMeetingId: meeting.proposedMeetingId,
          notificationCount: invite.notificationCount ?? 0,
        }).unwrap()
      }
      toast({
        title: "ההודעות נשלחו",
        description: "כל הלקוחות קיבלו קישור עם קוד הגישה.",
      })
      await refetch()
    } catch (error) {
      console.error("❌ [ManagerSchedule] Failed to send invites batch:", error)
      toast({
        title: "שליחת ההודעות נכשלה",
        description: error instanceof Error ? error.message : "חלק מההזמנות לא נשלחו",
        variant: "destructive",
      })
    } finally {
      setSendingAllInvites(false)
      setSendingInviteId(null)
    }
  }

  const getCategoryInvites = (
    meeting: ManagerAppointment,
    categoryId?: string
  ): ProposedMeetingInvite[] => {
    return (
      meeting.proposedInvites?.filter(
        (invite) =>
          invite.source === "category" &&
          invite.customerId &&
          (categoryId ? invite.sourceCategoryId === categoryId : Boolean(invite.sourceCategoryId))
      ) ?? []
    )
  }

  const handleSendCategoryInvites = async (meeting: ManagerAppointment, categoryId: string) => {
    if (!meeting.proposedMeetingId) return
    const invites = getCategoryInvites(meeting, categoryId)
    if (!invites.length) return

    setSendingCategoryId(categoryId)
    try {
      for (const invite of invites) {
        await sendProposedMeetingWebhook({
          inviteId: invite.id,
          customerId: invite.customerId!,
          proposedMeetingId: meeting.proposedMeetingId,
          notificationCount: invite.notificationCount ?? 0,
        }).unwrap()
      }
      toast({
        title: "ההודעות נשלחו",
        description: `הקטגוריה נשלחה ל-${invites.length} לקוחות.`,
      })
      await refetch()
    } catch (error) {
      console.error("❌ [ManagerSchedule] Failed to send category invites:", error)
      toast({
        title: "השליחה נכשלה",
        description: error instanceof Error ? error.message : "בדקו את הנתונים ונסו שוב.",
        variant: "destructive",
      })
    } finally {
      setSendingCategoryId(null)
    }
  }

  const handleSendAllCategoryInvites = async (meeting: ManagerAppointment) => {
    if (!meeting.proposedMeetingId) return
    const invites = getCategoryInvites(meeting)
    if (!invites.length) return

    setSendingCategoriesBatch(true)
    try {
      for (const invite of invites) {
        await sendProposedMeetingWebhook({
          inviteId: invite.id,
          customerId: invite.customerId!,
          proposedMeetingId: meeting.proposedMeetingId,
          notificationCount: invite.notificationCount ?? 0,
        }).unwrap()
      }
      toast({
        title: "ההודעות נשלחו",
        description: `כל הקטגוריות נשלחו (${invites.length} לקוחות).`,
      })
      await refetch()
    } catch (error) {
      console.error("❌ [ManagerSchedule] Failed to send all category invites:", error)
      toast({
        title: "אי אפשר לשלוח כרגע",
        description: error instanceof Error ? error.message : "חלק מההודעות לא נשלחו.",
        variant: "destructive",
      })
    } finally {
      setSendingCategoriesBatch(false)
      setSendingCategoryId(null)
    }
  }

  const ensureValidProposedMeetingRange = (startIso: string, endIso: string) => {
    const start = new Date(startIso)
    const end = new Date(endIso)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("זמני מפגש לא תקינים")
    }
    const minutes = differenceInMinutes(end, start)
    if (minutes < intervalMinutes) {
      throw new Error(`משך מפגש חייב להיות לפחות ${intervalMinutes} דקות`)
    }
  }

  const handleConfirmMove = async () => {
    if (!moveDetails) return

    setMoveLoading(true)
    try {
      // Calculate final times based on selected hours if applicable
      let finalStartTime = moveDetails.newStartTime
      let finalEndTime = moveDetails.newEndTime

      // For garden appointments that are hourly (either in hourly section or trial section with hourly type)
      if (moveDetails.appointment.serviceType === 'garden' &&
        moveDetails.newGardenAppointmentType === 'hourly' &&
        hourlyTimeSelection) {
        // Parse the selected hours
        const [startHour, startMinute] = hourlyTimeSelection.start.split(':').map(Number)
        const [endHour, endMinute] = hourlyTimeSelection.end.split(':').map(Number)

        // Get the date from the original appointment
        const originalDate = new Date(moveDetails.newStartTime)

        // Create new start and end times with the selected hours
        finalStartTime = new Date(
          originalDate.getFullYear(),
          originalDate.getMonth(),
          originalDate.getDate(),
          startHour,
          startMinute
        )
        finalEndTime = new Date(
          originalDate.getFullYear(),
          originalDate.getMonth(),
          originalDate.getDate(),
          endHour,
          endMinute
        )

      }

      // First, update the cache immediately for instant UI feedback
      if (data) {
        // Manually update the cache to reflect the appointment's new position
        dispatch(
          supabaseApi.util.updateQueryData(
            'getManagerSchedule',
            {
              date: format(selectedDate, 'yyyy-MM-dd'),
              serviceType: serviceFilter
            },
            (draft) => {
              if (draft) {
                // Find and update the moved appointment
                const appointmentIndex = draft.appointments.findIndex(
                  apt => apt.id === moveDetails.appointment.id
                )

                if (appointmentIndex !== -1) {
                  draft.appointments[appointmentIndex] = {
                    ...draft.appointments[appointmentIndex],
                    stationId: moveDetails.newStation.id,
                    startDateTime: finalStartTime.toISOString(),
                    endDateTime: finalEndTime.toISOString(),
                    // Update garden appointment type if it's a garden type change
                    ...(moveDetails.newGardenAppointmentType && {
                      gardenAppointmentType: moveDetails.newGardenAppointmentType
                    }),
                    ...(moveDetails.newGardenIsTrial !== undefined && {
                      gardenIsTrial: moveDetails.newGardenIsTrial
                    })
                  }
                }
              }
            }
          )
        )
      }

      // Then make the API call to update the backend
      await moveAppointment({
        appointmentId: moveDetails.appointment.id,
        newStationId: moveDetails.newStation.id,
        newStartTime: moveDetails.newStartTime,
        newEndTime: moveDetails.newEndTime,
        oldStationId: moveDetails.oldStation.id,
        oldStartTime: moveDetails.appointment.startDateTime,
        oldEndTime: moveDetails.appointment.endDateTime,
        appointmentType: moveDetails.appointment.serviceType,
        ...(moveDetails.newGardenAppointmentType && { newGardenAppointmentType: moveDetails.newGardenAppointmentType }),
        ...(moveDetails.newGardenIsTrial !== undefined && { newGardenIsTrial: moveDetails.newGardenIsTrial }),
        ...(hourlyTimeSelection && { selectedHours: hourlyTimeSelection }),
      }).unwrap()

      // Close modal
      setMoveConfirmationOpen(false)
      setMoveDetails(null)
      setHourlyTimeSelection(null)
      setMoveLoading(false)
    } catch (error) {
      console.error('Error moving appointment:', error)

      // If the API call failed, we should revert the cache update
      if (data) {
        dispatch(
          supabaseApi.util.updateQueryData(
            'getManagerSchedule',
            {
              date: format(selectedDate, 'yyyy-MM-dd'),
              serviceType: serviceFilter
            },
            (draft) => {
              if (draft) {
                // Revert the appointment to its original position
                const appointmentIndex = draft.appointments.findIndex(
                  apt => apt.id === moveDetails.appointment.id
                )

                if (appointmentIndex !== -1) {
                  draft.appointments[appointmentIndex] = {
                    ...draft.appointments[appointmentIndex],
                    stationId: moveDetails.oldStation.id,
                    startDateTime: moveDetails.oldStartTime.toISOString(),
                    endDateTime: moveDetails.oldEndTime.toISOString(),
                    ...(moveDetails.newGardenAppointmentType && {
                      gardenAppointmentType: moveDetails.appointment.gardenAppointmentType
                    }),
                    ...(moveDetails.newGardenIsTrial !== undefined && {
                      gardenIsTrial: moveDetails.appointment.gardenIsTrial
                    })
                  }
                }
              }
            }
          )
        )
      }

      // TODO: Show error toast or alert
      setMoveLoading(false)
    }
  }

  const DraggableAppointmentCard = ({ appointment, isGardenColumn = false }: { appointment: ManagerAppointment; isGardenColumn?: boolean }) => {
    const isProposedMeeting = Boolean(appointment.isProposedMeeting)
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({
      id: appointment.id,
      data: {
        type: 'appointment',
        appointment,
      },
      disabled: resizingPreview?.appointmentId === appointment.id,
    })

    let style: React.CSSProperties

    if (isGardenColumn) {
      // For garden columns, no time-based positioning - just normal flow
      style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      } : {}
    } else {
      // For regular time-correlated columns, calculate positioning
      const startDate = parseISODate(appointment.startDateTime)
      if (!startDate) {
        return null
      }
      const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
      const startMinutes = Math.max(0, differenceInMinutes(startDate, timeline.start))
      const top = startMinutes * pixelsPerMinute

      style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        position: 'absolute' as const,
        top: `${top}px`,
        left: '8px',
        right: '8px',
      } : {
        position: 'absolute' as const,
        top: `${top}px`,
        left: '8px',
        right: '8px',
      }
    }

    return (
      <div
        ref={setNodeRef}
        style={{ ...style, zIndex: 2 }}
        {...listeners}
        {...attributes}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "cursor-grab active:cursor-grabbing",
          isDragging && "opacity-50"
        )}
      >
        {renderAppointmentCard(appointment, isDragging)}
      </div>
    )
  }
  const WaitlistCard = ({
    entry,
    isDragging = false,
    onClick,
  }: {
    entry: ManagerWaitlistEntry
    isDragging?: boolean
    onClick?: () => void
  }) => {
    const scopeMeta = WAITLIST_SCOPE_META[entry.serviceScope] ?? WAITLIST_SCOPE_META.grooming
    const startDate = entry.startDate ? parseISO(entry.startDate) : null
    const endDate = entry.endDate ? parseISO(entry.endDate) : null
    const dateLabel =
      startDate && !Number.isNaN(startDate.getTime())
        ? `${format(startDate, "dd/MM")}${endDate && !Number.isNaN(endDate.getTime()) ? ` - ${format(endDate, "dd/MM")}` : ""}`
        : ""

    return (
      <div
        className={cn(
          "rounded-lg border border-slate-200 bg-white p-3 text-right shadow-sm transition hover:border-blue-300",
          isDragging ? "ring-2 ring-blue-200" : "cursor-pointer"
        )}
        onClick={(event) => {
          event.stopPropagation()
          if (isDragging) return
          onClick?.()
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
            <GripVertical className="h-3.5 w-3.5 text-slate-300" />
            <span>{entry.treatmentName}</span>
          </div>
          <Badge className={cn("text-[11px] font-medium border", scopeMeta.badgeClass)}>
            {scopeMeta.label}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-gray-600">{entry.customerName || "לקוח לא ידוע"}</div>
        <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-gray-500">
          {dateLabel && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5">
              {dateLabel}
            </span>
          )}
          {entry.customerTypeName && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
              {entry.customerTypeName}
            </span>
          )}
          {entry.treatmentTypeName && (
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-600">
              {entry.treatmentTypeName}
            </span>
          )}
        </div>
        {entry.treatmentCategories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {entry.treatmentCategories.slice(0, 2).map((category) => (
              <span
                key={category.id}
                className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"
              >
                {category.name}
              </span>
            ))}
            {entry.treatmentCategories.length > 2 && (
              <span className="text-[11px] text-gray-400">
                +{entry.treatmentCategories.length - 2}
              </span>
            )}
          </div>
        )}
        {entry.notes && (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">
            {entry.notes}
          </p>
        )}
      </div>
    )
  }

  const DraggableWaitlistCard = ({ entry, onCardClick }: { entry: ManagerWaitlistEntry; onCardClick?: () => void }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({
      id: `waitlist-${entry.id}`,
      data: {
        type: 'waitlist',
        entry,
      },
    })

    const style = transform
      ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
      : undefined

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "cursor-grab active:cursor-grabbing",
          isDragging && "opacity-70"
        )}
      >
        <WaitlistCard entry={entry} isDragging={isDragging} onClick={onCardClick} />
      </div>
    )
  }

  const renderWaitlistBucketGroups = (
    groups: WaitlistBucketGroup[],
    prefix: string,
    onCardClick: (entry: ManagerWaitlistEntry) => void
  ) => {
    if (!groups.length) {
      return (
        <div
          key={`${prefix}-empty`}
          className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-3 text-center text-xs text-gray-500"
        >
          אין רשומות בקבוצה זו
        </div>
      )
    }

    return groups.map((group) => {
      const bucketId = `${prefix}-${group.id}`
      const isOpen = activeWaitlistBucket === bucketId
      return (
        <div
          key={bucketId}
          className="rounded-lg border border-slate-100 bg-slate-50/70 p-2"
        >
          <button
            type="button"
            className="flex w-full items-center justify-between text-right"
            dir="rtl"
            onClick={() => setActiveWaitlistBucket(isOpen ? null : bucketId)}
          >
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-sm font-semibold text-gray-900">{group.label}</span>
              <span className="text-xs text-gray-500">{group.entries.length}</span>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 text-gray-500 transition-transform", isOpen ? "rotate-180" : "")}
            />
          </button>
          {isOpen && (
            <div className="mt-3 space-y-2">
              {group.entries.map((entry) => (
                <DraggableWaitlistCard
                  key={`${bucketId}-${entry.id}`}
                  entry={entry}
                  onCardClick={() => onCardClick(entry)}
                />
              ))}
            </div>
          )}
        </div>
      )
    })
  }
  const renderAppointmentCard = (appointment: ManagerAppointment, isDragging: boolean = false) => {
    const dates = getAppointmentDates(appointment)
    if (!dates) {
      return null
    }
    const { start: startDate, end: endDate } = dates
    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const previewEndDate = resizingPreview?.appointmentId === appointment.id ? resizingPreview.endDate : null
    const effectiveEndDate = previewEndDate ?? endDate
    const actualDurationMinutes = differenceInMinutes(endDate, startDate)
    const displayedDurationMinutes = Math.max(
      intervalMinutes,
      differenceInMinutes(effectiveEndDate, startDate)
    )
    const isResizing = Boolean(previewEndDate)
    const isExpanded = expandedCards.has(appointment.id)

    // For garden appointments, use consistent height regardless of duration
    const originalHeight = appointment.serviceType === 'garden'
      ? 140
      : Math.max(1, displayedDurationMinutes * pixelsPerMinute)

    // Determine if card is "small" and needs expansion
    const isSmallCard = originalHeight < 100 // Increased threshold for small cards
    const hasExpandableContent = Boolean(
      appointment.internalNotes ||
      appointment.subscriptionName ||
      (appointment.serviceType === "garden" && (appointment.gardenTrimNails || appointment.gardenBrush || appointment.gardenBath || appointment.latePickupRequested)) ||
      appointment.clientName ||
      treatments[0]?.treatmentType ||
      treatments.length > 1 // Multiple treatments
    )

    // Use expanded height if card is expanded, otherwise original height
    const height = (isExpanded && isSmallCard)
      ? Math.max(originalHeight, 150) // More generous expanded height
      : originalHeight

    const primaryTreatment = treatments[0]
    const treatmentName = primaryTreatment?.name ?? "ללא שיוך לטיפול"
    const rawTreatmentTypeName = primaryTreatment?.treatmentType ?? appointment.serviceName ?? ""
    const treatmentTypeName = rawTreatmentTypeName?.trim() ? rawTreatmentTypeName.trim() : undefined
    const rawClassification = appointment.clientClassification ?? primaryTreatment?.clientClassification ?? ""
    const classification = rawClassification.trim() ? rawClassification.trim() : undefined
    const serviceStyle = SERVICE_STYLES[appointment.serviceType]
    const isProposedMeeting = Boolean(appointment.isProposedMeeting)

    // Get card styling based on appointment type
    const getCardStyle = (appointment: ManagerAppointment): string => {
      if (appointment.isProposedMeeting) {
        return "bg-lime-50 border-lime-200"
      }

      // Personal appointments get purple styling
      if (appointment.isPersonalAppointment) {
        return "bg-purple-100 border-purple-300"
      }

      // Private appointments get purple styling
      if (appointment.appointmentType === "private") {
        return "bg-purple-100 border-purple-300"
      }

      // Garden appointments get special styling
      if (appointment.serviceType === "garden") {
        if (appointment.gardenIsTrial) {
          return "bg-amber-100 border-amber-300"
        } else if (appointment.gardenAppointmentType === "full-day") {
          return "bg-green-100 border-green-300"
        } else {
          return "bg-blue-100 border-blue-300"
        }
      }

      return serviceStyle.card
    }

    const cardStyle = getCardStyle(appointment)
    const statusStyle = getStatusStyle(appointment.status, appointment)
    const subscriptionName = appointment.subscriptionName
    const notes = appointment.notes?.trim()
    const internalNotes = appointment.internalNotes?.trim()
    const originalTimeRangeLabel = `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`

    // If dragging and we have target time, show both original and target times
    let timeRangeLabel = originalTimeRangeLabel
    if (isDragging && highlightedSlots && draggedAppointment.appointment && draggedAppointment.appointment.id === appointment.id) {
      const targetStartTime = addMinutes(timeline.start, highlightedSlots.startTimeSlot * intervalMinutes)
      const targetEndTime = addMinutes(targetStartTime, actualDurationMinutes)
      const targetTimeRangeLabel = `${format(targetStartTime, "HH:mm")} - ${format(targetEndTime, "HH:mm")}`
      timeRangeLabel = `${originalTimeRangeLabel} ← ${targetTimeRangeLabel}`
    }
    if (previewEndDate) {
      const previewRangeLabel = `${format(startDate, "HH:mm")} - ${format(previewEndDate, "HH:mm")}`
      timeRangeLabel = previewRangeLabel === originalTimeRangeLabel
        ? previewRangeLabel
        : `${originalTimeRangeLabel} ← ${previewRangeLabel}`
    }

    // Client information
    const clientName = appointment.clientName ?? primaryTreatment?.clientName
    const clientPhone = appointment.clientPhone

    // Expand/collapse handlers
    const handleExpandCard = (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpandedCards(prev => new Set([...prev, appointment.id]))
    }

    const handleCollapseCard = (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpandedCards(prev => {
        const newSet = new Set(prev)
        newSet.delete(appointment.id)
        return newSet
      })
    }
    return (
      <div
        key={appointment.id}
        onClick={() => handleAppointmentClick(appointment)}
        className={cn(
          "w-full flex flex-col rounded-lg border px-3 py-2 text-right shadow-sm transition relative",
          "hover:-translate-y-[1px] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
          cardStyle,
          "cursor-pointer",
          isResizing && "ring-2 ring-blue-400/70 shadow-md"
        )}
        style={{ height }}
      >
        <div className={cn(
          "flex flex-col",
          !isExpanded && "overflow-hidden" // Hide overflowing content when not expanded
        )}>
          <div className="flex items-center justify-between gap-2 text-xs">
            {/* Only show time for non-garden appointments or garden appointments that are not full-day */}
            {appointment.serviceType !== "garden" || appointment.gardenAppointmentType !== "full-day" ? (
              <span className={cn(
                "text-gray-600",
                isDragging && highlightedSlots && draggedAppointment.appointment && draggedAppointment.appointment.id === appointment.id && "font-medium",
                isResizing && "font-medium text-blue-700"
              )}>
                {timeRangeLabel}
              </span>
            ) : (
              <span className="text-gray-600 font-medium">
                יום מלא
              </span>
            )}
            <div className="flex items-center gap-1">
              {isProposedMeeting ? (
                <>
                  <Badge
                    variant="outline"
                    className="text-[11px] font-medium border-lime-200 bg-lime-50 text-lime-700"
                  >
                    מפגש מוצע
                  </Badge>
                  {appointment.proposedLinkedAppointmentId && (
                    <Badge
                      variant="outline"
                      className="text-[11px] font-medium border-blue-200 bg-blue-50 text-blue-700"
                    >
                      תיאום מחדש
                    </Badge>
                  )}
                </>
              ) : (
                appointment.serviceType !== "garden" && (
                  <Badge
                    variant="outline"
                    className={cn("text-[11px] font-medium", statusStyle)}
                  >
                    {appointment.status}
                  </Badge>
                )
              )}
              {internalNotes && (
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-600" title="יש הערות צוות פנימי">
                  <MessageSquare className="h-3 w-3" />
                </div>
              )}
              {!isProposedMeeting && appointment.hasCrossServiceAppointment && (
                <div
                  className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-600"
                  title={appointment.serviceType === "garden" ? "יש גם תור למספרה" : "יש גם תור לגן"}
                >
                  {appointment.serviceType === "garden" ? (
                    <Scissors className="h-3 w-3" />
                  ) : (
                    <Bone className="h-3 w-3" />
                  )}
                </div>
              )}
              {!isProposedMeeting && (
                <div
                  className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full",
                    isAppointmentPaid(appointment.paymentStatus)
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  )}
                  title={isAppointmentPaid(appointment.paymentStatus) ? "שולם" : "לא שולם"}
                >
                  <DollarSign className="h-3 w-3" />
                </div>
              )}
              {/* Expand/Collapse icon for small cards */}
              {(isSmallCard || isExpanded) && (
                <div
                  className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-full cursor-pointer transition-colors border-2 shadow-sm",
                    isExpanded
                      ? "bg-purple-200 text-purple-700 hover:bg-purple-300 border-purple-300"
                      : "bg-purple-100 text-purple-600 hover:bg-purple-200 border-purple-200"
                  )}
                  title={isExpanded ? "כווץ" : "הרחב"}
                  onClick={isExpanded ? handleCollapseCard : handleExpandCard}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              )}
              {/* 3-dots menu for all appointments */}
              <Popover>
                <PopoverTrigger asChild>
                  <div
                    className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors"
                    title="פעולות נוספות"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  <div className="space-y-1">
                    {isProposedMeeting ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-lime-700 hover:text-lime-800 hover:bg-lime-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenProposedMeetingEditor(appointment)
                          }}
                        >
                          <Pencil className="h-4 w-4 ml-2" />
                          ערוך מפגש
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProposedMeeting(appointment)
                          }}
                        >
                          <Trash2 className="h-4 w-4 ml-2" />
                          מחק מפגש
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (appointment.serviceType === "garden") {
                              openGardenEditModal(appointment)
                            } else {
                              openGroomingEditModal(appointment)
                            }
                          }}
                        >
                          <Pencil className="h-4 w-4 ml-2" />
                          ערוך תור
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelAppointment(appointment)
                          }}
                        >
                          <Clock className="h-4 w-4 ml-2" />
                          בטל תור
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDuplicateAppointment(appointment)
                          }}
                        >
                          <Copy className="h-4 w-4 ml-2" />
                          שכפל תור
                        </Button>
                        {appointment.serviceType === "grooming" &&
                          (appointment.appointmentType === "business" || appointment.appointmentType === "private") &&
                          !appointment.isPersonalAppointment && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenRescheduleProposal(appointment)
                              }}
                            >
                              <CalendarCog className="h-4 w-4 ml-2" />
                              הצע זמן חדש
                            </Button>
                          )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteAppointment(appointment)
                          }}
                        >
                          <Trash2 className="h-4 w-4 ml-2" />
                          מחק תור
                        </Button>
                      </>
                    )}
                    {!isProposedMeeting && appointment.appointmentType !== "private" && !appointment.isPersonalAppointment && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePaymentClick(appointment)
                        }}
                      >
                        <DollarSign className="h-4 w-4 ml-2" />
                        תשלום
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {isProposedMeeting ? (
              <div className="space-y-2 text-sm">
                <div className="text-sm  text-lime-800">
                  {appointment.proposedTitle || "מפגש מוצע"}
                </div>
                <div className="text-xs text-gray-600">
                  קוד: <span className="font-mono tracking-wide text-gray-900">{appointment.proposedMeetingCode || "—"}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  <span className="rounded-full bg-lime-100 text-lime-800 px-2 py-0.5">
                    {appointment.proposedInvites?.length ?? 0} לקוחות נקודתיים
                  </span>
                  <span className="rounded-full bg-lime-50 text-lime-700 px-2 py-0.5">
                    {appointment.proposedCategories?.length ?? 0} קטגוריות
                  </span>
                </div>
                {appointment.proposedLinkedAppointmentId && appointment.proposedOriginalStart && appointment.proposedOriginalEnd && (
                  <div className="text-xs text-blue-700 bg-blue-50/70 border border-blue-100 rounded px-2 py-1" title="התור המקורי יוזז לזמן החדש לאחר אישור הלקוח">
                    תור מקורי: {format(new Date(appointment.proposedOriginalStart), "dd.MM.yyyy HH:mm")} - {format(new Date(appointment.proposedOriginalEnd), "HH:mm")}
                  </div>
                )}
                {appointment.proposedSummary && (
                  <div className="text-xs text-gray-500 line-clamp-2">
                    {appointment.proposedSummary}
                  </div>
                )}
              </div>
            ) : appointment.isPersonalAppointment ? (
              // Personal appointment UI - show description instead of treatment details
              <div className="text-sm font-medium text-purple-700">
                {appointment.personalAppointmentDescription || "תור אישי"}
              </div>
            ) : (
              // Regular appointment UI - show treatment details
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (primaryTreatment) {
                        handleTreatmentClick(primaryTreatment)
                      }
                    }}
                    className="text-sm text-purple-600 hover:text-purple-800 hover:underline cursor-pointer"
                    disabled={!primaryTreatment}
                  >
                    {treatmentName}
                  </button>
                  {classification ? (
                    <Badge variant="secondary" className="text-[10px] font-medium bg-purple-100 text-purple-700">
                      {classification}
                    </Badge>
                  ) : null}
                  {treatmentTypeName ? (
                    <Badge variant="outline" className="text-[10px] font-medium border-slate-200 bg-white/80 text-gray-700">
                      {treatmentTypeName}
                    </Badge>
                  ) : null}
                </div>
                {clientName && (
                  <div className="text-xs text-gray-600">
                    שם לקוח: <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleClientClick({
                          name: clientName,
                          classification: appointment.clientClassification ?? primaryTreatment?.clientClassification,
                          phone: appointment.clientPhone,
                          email: appointment.clientEmail,
                          recordId: appointment.recordId,
                          recordNumber: appointment.recordNumber
                        })
                      }}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {clientName}
                    </button>
                  </div>
                )}
              </>
            )}
            {appointment.serviceType === "garden" && (appointment.gardenTrimNails || appointment.gardenBrush || appointment.gardenBath || appointment.latePickupRequested) && (
              <div className="flex items-center gap-1 mt-1">
                {appointment.gardenTrimNails && (
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-orange-100 text-orange-600" title="גזירת ציפורניים">
                    <Scissors className="h-3 w-3" />
                  </div>
                )}
                {appointment.gardenBrush && (
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-pink-100 text-pink-600" title="סירוק">
                    <Wand2 className="h-3 w-3" />
                  </div>
                )}
                {appointment.gardenBath && (
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600" title="רחצה">
                    <Droplets className="h-3 w-3" />
                  </div>
                )}
                {appointment.latePickupRequested && (
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-yellow-100 text-yellow-600" title="איסוף מאוחר">
                    <Clock className="h-3 w-3" />
                  </div>
                )}
              </div>
            )}
          </div>
          {subscriptionName ? (
            <div className="mt-1 text-xs text-gray-600" title={subscriptionName}>
              כרטיסייה: <span className="font-medium text-gray-700">{subscriptionName}</span>
            </div>
          ) : null}
          {internalNotes ? (
            <div className="mt-1 text-xs text-gray-500" title={internalNotes}>
              <span className="font-medium text-gray-600">הערות צוות:</span> {internalNotes}
            </div>
          ) : null}
        </div>
        {appointment.serviceType === "grooming" && (
          <button
            type="button"
            data-dnd-kit-no-drag
            onPointerDown={(event) => handleResizeStart(event, appointment)}
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-3 flex items-center justify-center cursor-ns-resize focus:outline-none z-10"
            title="שינוי אורך התור"
          >
            <span
              className={cn(
                "h-1.5 w-12 rounded-full bg-blue-400 transition-colors",
                "hover:bg-blue-500",
                isResizing && "bg-blue-500"
              )}
            />
          </button>
        )}
      </div>
    )
  }

  // Group constraints by station
  const constraintsByStation = useMemo(() => {
    const map = new Map<string, typeof constraints>()
    for (const constraint of constraints) {
      if (visibleStationIds.length > 0 && !visibleStationIds.includes(constraint.station_id)) {
        continue
      }
      if (!map.has(constraint.station_id)) {
        map.set(constraint.station_id, [])
      }
      map.get(constraint.station_id)!.push(constraint)
    }
    return map
  }, [constraints, visibleStationIds])

  const extractCustomReason = (notes: { text?: string } | null): string | null => {
    if (!notes?.text) return null
    const match = notes.text.match(/\[CUSTOM_REASON:(.+?)\]/)
    return match ? match[1] : null
  }

  const getConstraintDisplayReason = (reason: string | null, notes: { text?: string } | null): string => {
    if (reason) {
      const reasonLabels: Record<string, string> = {
        sick: "מחלה",
        vacation: "חופשה",
        ad_hoc: "אד-הוק",
      }
      return reasonLabels[reason] || reason
    }
    const customReason = extractCustomReason(notes)
    return customReason || "אילוץ"
  }

  const handleEditConstraint = async (constraint: typeof constraints[0]) => {
    // Clear any default times when manually editing (not from drag)
    setEditingConstraintDefaultTimes(null)
    try {
      // Fetch all constraints with the same start_time and end_time
      // Constraints with the same times are typically part of the same group
      let query = supabase
        .from("station_unavailability")
        .select("station_id, reason, notes")
        .eq("start_time", constraint.start_time)
        .eq("end_time", constraint.end_time)

      const { data: allConstraints, error } = await query

      if (error) throw error

      if (!allConstraints || allConstraints.length === 0) {
        // Fallback to just the current constraint's station
        setEditingConstraint(constraint)
        setEditingConstraintStationIds([constraint.station_id])
        setIsConstraintDialogOpen(true)
        return
      }

      // Filter client-side to find constraints with matching reason and notes
      // We compare the notes structure manually since JSONB comparison in PostgREST is complex
      const constraintReason = constraint.reason
      const constraintNotesJson = constraint.notes ? JSON.stringify(constraint.notes) : null

      const relatedConstraints = allConstraints.filter(c => {
        const cReason = c.reason
        const cNotesJson = c.notes ? JSON.stringify(c.notes) : null

        // Match if reason and notes are the same
        const reasonMatch = constraintReason === cReason || (!constraintReason && !cReason)
        const notesMatch = constraintNotesJson === cNotesJson || (!constraintNotesJson && !cNotesJson)

        return reasonMatch && notesMatch
      })

      const stationIds = relatedConstraints.map(c => c.station_id)

      setEditingConstraint(constraint)
      setEditingConstraintStationIds(stationIds.length > 0 ? stationIds : [constraint.station_id])
      setIsConstraintDialogOpen(true)
    } catch (error) {
      console.error("Error fetching related constraints:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את האילוץ לעריכה",
        variant: "destructive",
      })
    }
  }

  const handleDeleteConstraintClick = async (constraintId: string) => {
    try {
      // Find the constraint
      const constraint = constraints.find(c => c.id === constraintId)
      if (!constraint) return

      // Fetch all constraints with the same start_time and end_time
      let query = supabase
        .from("station_unavailability")
        .select("id, station_id, reason, notes")
        .eq("start_time", constraint.start_time)
        .eq("end_time", constraint.end_time)

      // Handle reason matching
      if (constraint.reason) {
        query = query.eq("reason", constraint.reason)
      } else {
        query = query.is("reason", null)
      }

      const { data: allConstraints, error } = await query

      if (error) throw error

      if (!allConstraints || allConstraints.length === 0) {
        setConstraintToDelete(constraintId)
        setConstraintToDeleteDetails(null)
        setDeleteFromAllStations(true)
        setShowDeleteConstraintDialog(true)
        return
      }

      // Filter client-side to find constraints with matching notes
      const constraintNotesJson = constraint.notes ? JSON.stringify(constraint.notes) : null

      const relatedConstraints = allConstraints.filter(c => {
        const cNotesJson = c.notes ? JSON.stringify(c.notes) : null
        return constraintNotesJson === cNotesJson || (!constraintNotesJson && !cNotesJson)
      })

      const stationIds = relatedConstraints.map(c => c.station_id)

      // Fetch station names
      const stationNames = stationIds
        .map(id => stations.find(s => s.id === id)?.name)
        .filter((name): name is string => Boolean(name))

      setConstraintToDelete(constraintId)
      setConstraintToDeleteDetails({
        constraint,
        relatedConstraints: relatedConstraints as typeof constraints,
        stationIds,
        stationNames,
      })
      setDeleteFromAllStations(stationIds.length > 1)
      setShowDeleteConstraintDialog(true)
    } catch (error) {
      console.error("Error fetching constraint details:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את פרטי האילוץ",
        variant: "destructive",
      })
    }
  }

  const handleDeleteConstraint = async () => {
    if (!constraintToDelete) return

    try {
      let constraintIdsToDelete: string[] = [constraintToDelete]

      // If deleting from all stations and there are related constraints
      if (deleteFromAllStations && constraintToDeleteDetails && constraintToDeleteDetails.relatedConstraints.length > 1) {
        constraintIdsToDelete = constraintToDeleteDetails.relatedConstraints.map(c => c.id)
      }

      const { error } = await supabase
        .from("station_unavailability")
        .delete()
        .in("id", constraintIdsToDelete)

      if (error) throw error

      toast({
        title: "הצלחה",
        description: deleteFromAllStations && constraintIdsToDelete.length > 1
          ? `האילוץ נמחק מ-${constraintIdsToDelete.length} עמדות בהצלחה`
          : "האילוץ נמחק בהצלחה",
      })

      // Refresh constraints
      const dayStart = startOfDay(selectedDate)
      const dayEnd = addHours(dayStart, 24)
      const { data: constraintsData } = await supabase
        .from("station_unavailability")
        .select(`
          id,
          station_id,
          reason,
          notes,
          start_time,
          end_time,
          is_active
        `)
        .lt("start_time", dayEnd.toISOString())
        .gt("end_time", dayStart.toISOString())
      setConstraints(constraintsData || [])
      setConstraintToDelete(null)
      setConstraintToDeleteDetails(null)
      setShowDeleteConstraintDialog(false)
      setDeleteFromAllStations(true)
    } catch (error) {
      console.error("Error deleting constraint:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את האילוץ",
        variant: "destructive",
      })
    }
  }

  const handleMoveConstraint = async (
    constraint: typeof constraints[0],
    newStationId: string,
    newStartTime: Date,
    newEndTime: Date
  ) => {
    try {
      const { error } = await supabase
        .from("station_unavailability")
        .update({
          station_id: newStationId,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
        })
        .eq("id", constraint.id)

      if (error) throw error

      toast({
        title: "הצלחה",
        description: "האילוץ הועבר בהצלחה",
      })

      // Refresh constraints
      const dayStart = startOfDay(selectedDate)
      const dayEnd = addHours(dayStart, 24)
      const { data: constraintsData } = await supabase
        .from("station_unavailability")
        .select(`
          id,
          station_id,
          reason,
          notes,
          start_time,
          end_time
        `)
        .lt("start_time", dayEnd.toISOString())
        .gt("end_time", dayStart.toISOString())
      setConstraints(constraintsData || [])
    } catch (error) {
      console.error("Error moving constraint:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן להעביר את האילוץ",
        variant: "destructive",
      })
    }
  }

  const handleDuplicateConstraint = (constraint: typeof constraints[0]) => {
    // Parse dates and times from the constraint
    const startDate = new Date(constraint.start_time)
    const endDate = new Date(constraint.end_time)
    const startTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
    const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`

    // Set editing constraint to null so it acts as a new constraint
    setEditingConstraint(null)
    setEditingConstraintStationIds([constraint.station_id])
    setEditingConstraintDefaultTimes({
      startDate: startDate,
      endDate: endDate,
      startTime: startTime,
      endTime: endTime,
      isActive: constraint.is_active,
    })
    setIsConstraintDialogOpen(true)
  }
  const DraggableConstraintCard = ({ constraint }: { constraint: typeof constraints[0] }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({
      id: constraint.id,
      data: {
        type: 'constraint',
        constraint,
      },
      disabled: false,
    })

    const startDate = parseISODate(constraint.start_time)
    const endDate = parseISODate(constraint.end_time)

    if (!startDate || !endDate) {
      return null
    }

    // Check if constraint overlaps with the timeline
    const timelineStart = timeline.start
    const timelineEnd = timeline.end

    const constraintStart = max([startDate, timelineStart])
    const constraintEnd = min([endDate, timelineEnd])

    if (constraintEnd <= constraintStart) {
      return null // Constraint doesn't overlap with visible timeline
    }

    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const top = differenceInMinutes(constraintStart, timelineStart) * pixelsPerMinute

    // Use resizing preview end date if available
    const previewEndDate = constraintResizingPreview?.constraintId === constraint.id ? constraintResizingPreview.endDate : null
    const effectiveEndDate = previewEndDate ?? constraintEnd
    const originalHeight = Math.max(1, differenceInMinutes(effectiveEndDate, constraintStart) * pixelsPerMinute)
    const isResizing = Boolean(previewEndDate)

    const reasonText = getConstraintDisplayReason(constraint.reason, constraint.notes)

    // If dragging and we have target time, show both original and target times
    const startDateFormatted = format(startDate, "HH:mm")
    const endDateFormatted = format(endDate, "HH:mm")
    let timeRangeLabel = `${startDateFormatted} - ${endDateFormatted}`
    if (isDragging && highlightedSlots && draggedConstraint.constraint && draggedConstraint.constraint.id === constraint.id) {
      const targetStartTime = addMinutes(timeline.start, highlightedSlots.startTimeSlot * intervalMinutes)
      const constraintDurationMinutes = differenceInMinutes(endDate, startDate)
      const targetEndTime = addMinutes(targetStartTime, constraintDurationMinutes)
      const targetTimeRangeLabel = `${format(targetStartTime, "HH:mm")} - ${format(targetEndTime, "HH:mm")}`
      timeRangeLabel = `${timeRangeLabel} ← ${targetTimeRangeLabel}`
    }
    if (previewEndDate) {
      const previewRangeLabel = `${format(startDate, "HH:mm")} - ${format(previewEndDate, "HH:mm")}`
      timeRangeLabel = previewRangeLabel === `${startDateFormatted} - ${endDateFormatted}`
        ? previewRangeLabel
        : `${startDateFormatted} - ${endDateFormatted} ← ${previewRangeLabel}`
    }

    // Extract notes text without the custom reason marker
    let notes: string | null = null
    if (constraint.notes && typeof constraint.notes === 'object' && (constraint.notes as any).text) {
      const notesText = (constraint.notes as any).text as string
      const notesWithoutReason = notesText.replace(/\[CUSTOM_REASON:[^\]]+\]\s?/, "").trim()
      if (notesWithoutReason) {
        notes = notesWithoutReason
      }
    }

    // Determine if card is "small" and needs expansion
    const isSmallCard = originalHeight < 100
    const hasExpandableContent = Boolean(notes)
    const isExpanded = expandedConstraints.has(constraint.id)

    // Use expanded height if card is expanded, otherwise original height
    const height = (isExpanded && isSmallCard)
      ? Math.max(originalHeight, 150) // More generous expanded height
      : originalHeight

    // Expand/collapse handlers
    const handleExpandCard = (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpandedConstraints(prev => new Set([...prev, constraint.id]))
    }

    const handleCollapseCard = (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpandedConstraints(prev => {
        const newSet = new Set(prev)
        newSet.delete(constraint.id)
        return newSet
      })
    }

    const style: React.CSSProperties = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      position: 'absolute' as const,
      top: `${top}px`,
      left: constraint.is_active ? '0' : '8px',
      right: constraint.is_active ? '0' : '8px',
      zIndex: 0
    } : {
      position: 'absolute' as const,
      top: `${top}px`,
      left: constraint.is_active ? '0' : '8px',
      right: constraint.is_active ? '0' : '8px',
      zIndex: 0
    }

    return (
      <div
        ref={setNodeRef}
        style={{ ...style, height, minHeight: height < 40 ? 40 : height }}
        {...listeners}
        {...attributes}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          // Active constraints: transparent green styling exactly like gray slots - full width, minimal styling
          "bg-orange-100  border-orange-300 rounded-md opacity-80 hover:opacity-100 transition-opacity group flex flex-col cursor-grab active:cursor-grabbing",
          isDragging && "opacity-50",
          isResizing && constraint.is_active
            ? "ring-2 ring-green-400/70 shadow-md"
            : "ring-2 ring-orange-400/70 shadow-md"
        )}
        onClick={(e) => {
          // Don't open details if clicking on the menu button or expand button
          if ((e.target as HTMLElement).closest('[data-constraint-menu]') ||
            (e.target as HTMLElement).closest('[data-constraint-expand]')) {
            return
          }
          setSelectedConstraint(constraint)
          setIsConstraintDetailsOpen(true)
        }}
      >
        {/* 3-dots menu and expand/collapse icon positioned at top-left (RTL: right side) */}
        <div className="absolute top-1 left-1 flex items-center gap-1" style={{ zIndex: 20 }}>
          {/* Expand/Collapse icon for small cards - appears first (rightmost in RTL) */}
          {(isSmallCard && hasExpandableContent) || isExpanded ? (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0 bg-white/90 backdrop-blur-sm rounded-full shadow-sm",
                constraint.is_active
                  ? "text-green-700 hover:text-green-900 hover:bg-green-200"
                  : "text-orange-700 hover:text-orange-900 hover:bg-orange-200"
              )}
              data-constraint-expand
              title={isExpanded ? "כווץ" : "הרחב"}
              onClick={isExpanded ? handleCollapseCard : handleExpandCard}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          ) : null}

          {/* 3-dots menu - appears second (left of collapse icon in RTL, making it leftest) */}
          <div
            data-constraint-menu
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 w-6 p-0 bg-white/90 backdrop-blur-sm rounded-full shadow-sm",
                    constraint.is_active
                      ? "text-green-700 hover:text-green-900 hover:bg-green-200"
                      : "text-orange-700 hover:text-orange-900 hover:bg-orange-200"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start" dir="rtl" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditConstraint(constraint)
                    }}
                  >
                    <Pencil className="h-4 w-4 ml-2" />
                    ערוך
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDuplicateConstraint(constraint)
                    }}
                  >
                    <Copy className="h-4 w-4 ml-2" />
                    שכפל
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteConstraintClick(constraint.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 ml-2" />
                    מחק
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Constraint content - time at top, then reason, then notes */}
        <div className={cn(
          "flex flex-col flex-1 px-2 py-2 text-right pointer-events-none",
          !isExpanded && "overflow-hidden" // Hide overflowing content when not expanded
        )}>
          {/* For active constraints: show reason prominently, time less prominently */}
          {constraint.is_active ? (
            <>
              {/* Reason is the main content for active constraints */}
              <div className="text-sm font-semibold text-green-900 mb-0.5">
                {reasonText || "אילוץ פעיל"}
              </div>
              {/* Time shown smaller */}
              <div className="text-xs text-green-700/80">
                {timeRangeLabel}
              </div>
            </>
          ) : (
            <>
              {/* Time at the top */}
              <div className={cn(
                "text-xs text-gray-600 mb-1",
                isResizing && "font-medium text-orange-700"
              )}>
                {timeRangeLabel}
              </div>
              {/* Reason */}
              <div className="text-xs font-medium text-orange-800 mb-1">
                {reasonText}
              </div>
            </>
          )}

          {/* Notes if available */}
          {notes && (
            <div className={cn(
              "text-xs mt-1",
              constraint.is_active ? "text-green-700" : "text-orange-700",
              !isExpanded && "line-clamp-2"
            )}>
              {notes}
            </div>
          )}
        </div>
        {/* Resize handle at the bottom */}
        <button
          type="button"
          data-dnd-kit-no-drag
          onPointerDown={(event) => handleConstraintResizeStart(event, constraint)}
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-3 flex items-center justify-center cursor-ns-resize focus:outline-none z-10"
          title="שינוי אורך האילוץ"
        >
          <span
            className={cn(
              "h-1.5 w-12 rounded-full transition-colors",
              constraint.is_active
                ? "bg-green-400 hover:bg-green-500"
                : "bg-orange-400 hover:bg-orange-500",
              isResizing && (constraint.is_active ? "bg-green-500" : "bg-orange-500")
            )}
          />
        </button>
      </div>
    )
  }

  const renderConstraintBlock = (constraint: typeof constraints[0]) => {
    return <DraggableConstraintCard key={constraint.id} constraint={constraint} />
  }

  // Helper function to check if a time slot is covered by an active constraint
  const isSlotCoveredByActiveConstraint = (slotTime: Date, stationId: string): boolean => {
    const stationConstraints = constraintsByStation.get(stationId) ?? []
    const slotTimeISO = slotTime.toISOString()

    return stationConstraints.some(constraint => {
      if (!constraint.is_active) return false // Only consider active constraints

      const constraintStart = parseISODate(constraint.start_time)
      const constraintEnd = parseISODate(constraint.end_time)

      if (!constraintStart || !constraintEnd) return false

      // Check if slot time is within the constraint time range
      return slotTimeISO >= constraintStart.toISOString() && slotTimeISO < constraintEnd.toISOString()
    })
  }

  // Helper function to check if a slot is generally unavailable (outside working hours)
  // without considering active constraints
  const isSlotGenerallyUnavailable = (slotTime: Date, stationId: string): boolean => {
    const workingHours = stationWorkingHours[stationId]
    if (!workingHours || workingHours.length === 0) {
      // If no working hours defined, slot is generally unavailable
      return true
    }

    // Map JavaScript getDay() (0=Sunday, 1=Monday, etc.) to database weekday format
    const dayNumber = slotTime.getDay()
    const weekdayMap: Record<number, string> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    }
    const weekday = weekdayMap[dayNumber]

    if (!weekday) {
      return true // Default to unavailable if weekday can't be determined
    }

    const slotTimeMinutes = slotTime.getHours() * 60 + slotTime.getMinutes()

    // Get all shifts for this weekday
    const dayShifts = workingHours.filter(h => h.weekday.toLowerCase() === weekday)
    if (dayShifts.length === 0) {
      // No shifts for this day - slot is generally unavailable
      return true
    }

    // Check if slot time is within any shift
    const isWithinShift = dayShifts.some(shift => {
      const openTimeParts = shift.open_time.split(':')
      const closeTimeParts = shift.close_time.split(':')
      const openHour = parseInt(openTimeParts[0], 10)
      const openMin = parseInt(openTimeParts[1], 10)
      const closeHour = parseInt(closeTimeParts[0], 10)
      const closeMin = parseInt(closeTimeParts[1], 10)

      const openMinutes = openHour * 60 + openMin
      const closeMinutes = closeHour * 60 + closeMin

      return slotTimeMinutes >= openMinutes && slotTimeMinutes < closeMinutes
    })

    // If not within any shift, it's generally unavailable
    return !isWithinShift
  }

  // Helper function to check if a time slot is within a station's working hours
  const isSlotWithinWorkingHours = (slotTime: Date, stationId: string): boolean => {
    // First check if there's an active constraint covering this slot
    // Active constraints make slots available even outside working hours
    if (isSlotCoveredByActiveConstraint(slotTime, stationId)) {
      return true
    }

    const workingHours = stationWorkingHours[stationId]
    if (!workingHours || workingHours.length === 0) {
      // If no working hours defined, mark all slots as unavailable (gray)
      return false
    }

    // Map JavaScript getDay() (0=Sunday, 1=Monday, etc.) to database weekday format
    // Database stores 'sunday', 'monday', 'tuesday', etc. (lowercase)
    const dayNumber = slotTime.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const weekdayMap: Record<number, string> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    }
    const weekday = weekdayMap[dayNumber]

    if (!weekday) {
      console.warn(`Invalid day number: ${dayNumber}`)
      return true // Default to available if weekday can't be determined
    }

    const slotTimeMinutes = slotTime.getHours() * 60 + slotTime.getMinutes()

    // Get all shifts for this weekday
    const dayShifts = workingHours.filter(h => h.weekday.toLowerCase() === weekday)
    if (dayShifts.length === 0) {
      // No shifts for this day - slot is not available
      return false
    }

    // Check if slot time is within any shift
    const isWithinShift = dayShifts.some(shift => {
      // Handle time format - might be "HH:mm" or "HH:mm:ss"
      const openTimeParts = shift.open_time.split(':')
      const closeTimeParts = shift.close_time.split(':')
      const openHour = parseInt(openTimeParts[0], 10)
      const openMin = parseInt(openTimeParts[1], 10)
      const closeHour = parseInt(closeTimeParts[0], 10)
      const closeMin = parseInt(closeTimeParts[1], 10)

      const openMinutes = openHour * 60 + openMin
      const closeMinutes = closeHour * 60 + closeMin

      // Slot is available if it's within the shift (open <= slot < close)
      // For the last slot, we check if it starts before the close time
      return slotTimeMinutes >= openMinutes && slotTimeMinutes < closeMinutes
    })

    return isWithinShift
  }

  const DroppableStationColumn = ({ station }: { station: ManagerStation }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: station.id,
      data: {
        type: 'station',
        station,
      },
    })

    const appointments = groupedAppointments.get(station.id) ?? []
    const stationConstraints = constraintsByStation.get(station.id) ?? []
    const hasWorkingHours = stationWorkingHours[station.id] && stationWorkingHours[station.id].length > 0

    return (
      <div key={station.id} className="flex flex-col gap-2">
        <div
          ref={setNodeRef}
          id={`station-${station.id}`}
          data-testid={`station-${station.id}`}
          className={cn(
            "relative overflow-hidden rounded-lg border bg-white transition-colors",
            isOver ? "border-blue-400 bg-blue-50" : "border-slate-200",
            station.serviceType === 'grooming' ? "cursor-crosshair hover:bg-slate-50" : "cursor-default"
          )}
          style={{ height: timeline.height }}
          onMouseDown={(e) => handleCreateDragStart(e, station.id)}
        >
          <div className="absolute inset-0 pointer-events-none">
            {timeline.slots.map((slot, index) => {
              // Calculate the time for this slot
              const slotTime = addMinutes(timeline.start, index * intervalMinutes)
              const isAvailable = isSlotWithinWorkingHours(slotTime, station.id)
              const isGenerallyUnavailable = isSlotGenerallyUnavailable(slotTime, station.id)
              const hasActiveConstraint = isSlotCoveredByActiveConstraint(slotTime, station.id)
              // Slots made available by active constraint: generally unavailable but made available by active constraint
              const isMadeAvailableByConstraint = isGenerallyUnavailable && hasActiveConstraint

              return (
                <div
                  key={`${station.id}-slot-${slot.offset}`}
                  className={cn("absolute left-0 right-0 border-b border-slate-100 transition-colors", {
                    // Unavailable slots get gray background - make it more visible
                    "bg-gray-300/80": !isAvailable && !isMadeAvailableByConstraint,
                    // Available slots (from working hours or made available by active constraint) alternate with light background
                    "bg-slate-50/70": (isAvailable || isMadeAvailableByConstraint) && index % 2 === 0,
                    // Highlighted slots override availability
                    "bg-blue-200 border-blue-300": highlightedSlots?.stationId === station.id && highlightedSlots?.allTimeSlots.includes(index),
                    "bg-blue-300 border-blue-400": highlightedSlots?.stationId === station.id && (highlightedSlots?.startTimeSlot === index || highlightedSlots?.endTimeSlot === index),
                  })}
                  style={{ top: slot.offset, height: slot.height }}
                />
              )
            })}
          </div>
          <div className="absolute inset-0 pointer-events-none">
            {timeline.hourMarkers.map((marker) => (
              <div
                key={`${station.id}-marker-${marker.label}-${marker.offset}`}
                className="absolute inset-x-0 border-t border-dashed border-slate-200"
                style={{ top: marker.offset }}
              />
            ))}
          </div>
          <div className="absolute inset-0">
            {/* Render constraints first (behind appointments) but still clickable */}
            {/* Only show inactive constraints as visual blocks, active ones affect slot coloring but aren't displayed */}
            {stationConstraints.filter(c => !c.is_active).map((constraint) => renderConstraintBlock(constraint))}
            {/* Render appointments on top */}
            {appointments.map((appointment) => (
              <DraggableAppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>

          {/* Drag-to-create preview overlay */}
          {dragToCreate.isDragging && dragToCreate.stationId === station.id && dragToCreate.startTime && dragToCreate.endTime && (
            <div
              className="absolute left-0 right-0 bg-purple-200 border-2 border-purple-400 rounded opacity-70 pointer-events-none z-10"
              style={{
                top: (differenceInMinutes(dragToCreate.startTime, timeline.start) / intervalMinutes) * (timeline.slots[0]?.height || 60),
                height: (differenceInMinutes(dragToCreate.endTime, dragToCreate.startTime) / intervalMinutes) * (timeline.slots[0]?.height || 60)
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-purple-800">
                {format(dragToCreate.startTime, 'HH:mm')} - {format(dragToCreate.endTime, 'HH:mm')}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  type GardenSection = {
    id: string
    title: string
    badgeLabel: string
    badgeClassName: string
    indicatorClassName: string
    titleBackgroundClassName: string
    dropZoneClassName: string
    dropZoneHoverClassName: string
    appointments: ManagerAppointment[]
  }

  const GardenColumn = ({ sections }: { sections: GardenSection[] }) => {
    const defaultAccordionValues = sections.map((section) => section.id)

    const GardenAccordionSection = ({ section }: { section: GardenSection }) => {
      const { setNodeRef, isOver } = useDroppable({
        id: section.id,
        data: {
          type: 'garden-column',
          columnId: section.id,
        },
      })

      return (
        <AccordionItem
          value={section.id}
          className="border-b border-emerald-200 last:border-b-0"
        >
          <AccordionTrigger className={cn("px-2 text-right text-sm font-semibold text-gray-900", section.titleBackgroundClassName)}>
            <div className="flex w-full items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className={cn("inline-block h-2.5 w-2.5 rounded-full", section.indicatorClassName)} />
                {section.title} ({section.appointments.length})
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  handleCreateGardenAppointment(section.id)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    handleCreateGardenAppointment(section.id)
                  }
                }}
                className="ml-2 rounded-full p-1 hover:bg-gray-200 transition-colors"
                title="הוסף תור גן חדש"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent >
            <div
              ref={setNodeRef}
              data-testid={`garden-column-${section.id}`}
              className={cn(
                "space-y-2 rounded-md border border-dashed px-2 py-2 transition-colors shadow-sm",
                isOver ? section.dropZoneHoverClassName : section.dropZoneClassName
              )}
              style={{ minHeight: section.appointments.length ? 0 : 96 }}
            >
              {section.appointments.length ? (
                section.appointments.map((appointment) => (
                  <DraggableAppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    isGardenColumn
                  />
                ))
              ) : (
                <div className="py-4 text-center text-xs text-gray-500">
                  אין תורים להצגה
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        <div
          className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
          style={{ height: timeline.height }}
        >
          <div className="absolute inset-0 pointer-events-none">
            {timeline.slots.map((slot, index) => (
              <div
                key={`garden-slot-${slot.offset}`}
                className={cn("absolute left-0 right-0 border-b border-slate-100", {
                  "bg-slate-50/70": index % 2 === 0,
                })}
                style={{ top: slot.offset, height: slot.height }}
              />
            ))}
          </div>
          <div className="absolute inset-0 pointer-events-none">
            {timeline.hourMarkers.map((marker) => (
              <div
                key={`garden-marker-${marker.label}-${marker.offset}`}
                className="absolute inset-x-0 border-t border-dashed border-slate-200"
                style={{ top: marker.offset }}
              />
            ))}
          </div>
          <div className="relative z-10 flex h-full flex-col overflow-hidden">
            <Accordion
              type="multiple"
              defaultValue={defaultAccordionValues}
              className="flex-1 overflow-y-auto px-2 py-2"
            >
              {sections.map((section) => (
                <GardenAccordionSection key={section.id} section={section} />
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    )
  }
  const isInitialLoading = !hasLoadedInitialData && (isLoading || !data)
  const shouldShowInitialError = !hasLoadedInitialData && !!error && !isLoading
  const shouldShowInitialLoader = isInitialLoading && showInitialLoader && !shouldShowInitialError

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8" dir="rtl">
      {shouldShowInitialError ? (
        <Alert variant="destructive" className="border border-red-200 bg-red-50">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>שגיאה בטעינת הלוח</AlertTitle>
          <AlertDescription>{scheduleErrorMessage}</AlertDescription>
        </Alert>
      ) : shouldShowInitialLoader ? (
        <div
          className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex w-full max-w-3xl flex-col gap-4 px-10 py-8">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-end gap-2 text-right">
                <span className="text-base font-semibold text-gray-900">מכין את לוח הניהול...</span>
                <span className="text-sm text-gray-500">טוען את העמדות, התורים וההגדרות המעודכנות.</span>
              </div>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-6 h-3 rounded-full bg-slate-100 animate-pulse" />
              <div className="col-span-2 h-24 rounded-lg bg-slate-50 animate-pulse" />
              <div className="col-span-2 h-24 rounded-lg bg-slate-50 animate-pulse" />
              <div className="col-span-2 h-24 rounded-lg bg-slate-50 animate-pulse" />
              <div className="col-span-6 h-3 rounded-full bg-slate-100 animate-pulse" />
              <div className="col-span-6 h-3 rounded-full bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      ) : isInitialLoading ? (
        <div className="h-64 rounded-lg border border-transparent" aria-hidden="true" />
      ) : error ? (
        <Alert variant="destructive" className="border border-red-200 bg-red-50">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>שגיאה בטעינת הלוח</AlertTitle>
          <AlertDescription>{scheduleErrorMessage}</AlertDescription>
        </Alert>
      ) : !filteredStations.length && !shouldShowGardenColumns ? (
        <Alert className="border border-amber-200 bg-amber-50">
          <AlertTitle>אין עמדות להצגה</AlertTitle>
          <AlertDescription>
            בחר עמדות להצגה או בדוק אם קיימות עמדות פעילות עבור התאריך והשירות שנבחרו.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="relative flex items-start gap-6 overflow-visible" dir="ltr">
          {hasLoadedInitialData && isFetching && (
            <div className="pointer-events-none absolute -top-10 right-0 z-40 flex justify-end">
              <div className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-gray-600 shadow">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>מרענן נתונים חיים...</span>
              </div>
            </div>
          )}
          {/* Main Schedule Grid */}
          <div className="flex-1 min-w-0" dir="rtl">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              {/* Fixed Header Row - Outside overflow container for proper sticky behavior */}
              <div
                className="sticky z-30 bg-white border-b border-slate-200 shadow-md mb-2 rounded-t-lg"
                style={{ top: "var(--navbar-height, 72px)" }}
              >
                <div
                  className="relative overflow-x-auto overflow-y-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-0.5 px-1"
                  ref={headerScrollContainerRef}
                  onScroll={handleHeaderScroll}
                >
                  <div className="flex flex-nowrap items-center gap-4 px-3 pb-1" dir="rtl">
                    <div className="flex flex-1 min-w-0 items-center gap-3">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {stations.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleScrollBackward}
                              disabled={!canScrollBackward}
                              className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                              title="גלול אחורה"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                            <StationFilterPopover
                              stations={stations}
                              visibleStationIds={visibleStationIds}
                              onSelectAll={handleSelectAllStations}
                              onClear={handleClearStations}
                              onToggle={handleStationToggle}
                              sensors={stationReorderSensors}
                              onReorderEnd={handleStationReorderEnd}
                              isStationOrderSaving={isStationOrderSaving}
                              showWaitingListColumn={showWaitingListColumn}
                              waitingListCount={waitingListSummary.filtered}
                              onToggleWaitingList={(next) => setShowWaitingListColumn(next)}
                              align="start"
                              trigger={
                                <Button type="button" variant="outline" size="sm" className="flex items-center gap-1 text-xs">
                                  <SlidersHorizontal className="h-4 w-4" />
                                  <span>עמדות</span>
                                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                    {visibleStationIds.length === 0 ? stations.length : visibleStationIds.length}/{stations.length}
                                  </span>
                                </Button>
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleScrollForward}
                              disabled={!canScrollForward}
                              className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                              title="גלול קדימה"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        {stationColumnSlots > 0 && filteredStations.length > stationColumnSlots && (
                          <div className="flex items-center gap-1 rounded border border-slate-200 bg-white/95 px-1 py-0.5 shadow-sm text-xs text-gray-600">
                            <span className="px-1 whitespace-nowrap">
                              {displayedRangeStart}-{displayedRangeEnd} / {filteredStations.length}
                            </span>
                          </div>
                        )}
                      </div>
                      <div
                        ref={scheduleSearchContainerRef}
                        className={cn(
                          "relative flex-1 min-w-[48px] overflow-visible transition-[max-width] duration-300",
                          isScheduleSearchVisuallyExpanded ? "max-w-xl" : "max-w-[56px]"
                        )}
                        style={{ zIndex: 60 }}
                      >
                        {isScheduleSearchVisuallyExpanded ? (
                          <div
                            className={cn(
                              "flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm transition-all duration-300 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100",
                              isScheduleSearchOpen ? "border-blue-200 shadow-lg scale-[1.01]" : ""
                            )}
                          >
                            <Search className="h-4 w-4 text-gray-400" />
                            <input
                              ref={scheduleSearchInputRef}
                              type="text"
                              dir="rtl"
                              value={scheduleSearchTerm}
                              onChange={(event) => {
                                setScheduleSearchTerm(event.target.value)
                                setIsScheduleSearchOpen(true)
                              }}
                              onFocus={() => setIsScheduleSearchOpen(true)}
                              onKeyDown={handleScheduleSearchInputKeyDown}
                              placeholder="חיפוש תורים, לקוחות או כלבים"
                              className="flex-1 border-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                              autoComplete="off"
                            />
                            {scheduleSearchTerm && (
                              <button
                                type="button"
                                className="text-gray-400 transition hover:text-gray-600"
                                onClick={() => setScheduleSearchTerm("")}
                                title="נקה חיפוש"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setIsScheduleSearchExpanded(true)
                              setIsScheduleSearchOpen(true)
                              requestAnimationFrame(() => scheduleSearchInputRef.current?.focus())
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-gray-500 shadow-sm transition-all duration-300 hover:border-blue-200 hover:text-blue-600 hover:shadow-md"
                            title="פתח חיפוש"
                          >
                            <Search className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                        {formattedCurrentDateLabel}
                      </div>
                      <div className="flex items-center gap-1 rounded border border-slate-200 bg-white/95 px-1 py-0.5 shadow-sm">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100"
                          onClick={handlePreviousWeek}
                          title="שבוע קודם"
                          aria-label="שבוע קודם"
                        >
                          <ChevronsRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100"
                          onClick={handlePreviousDay}
                          title="יום קודם"
                          aria-label="יום קודם"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 rounded border-blue-200 bg-blue-50/80 px-2 text-[12px] font-semibold text-blue-700 hover:bg-blue-100"
                          onClick={handleJumpToToday}
                          title="חזרה להיום"
                          aria-label="חזרה להיום"
                        >
                          <CalendarIcon className="ml-1 h-3 w-3" />
                          היום
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100"
                          onClick={handleNextDay}
                          title="יום הבא"
                          aria-label="יום הבא"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded text-gray-600 hover:bg-gray-100"
                          onClick={handleNextWeek}
                          title="שבוע הבא"
                          aria-label="שבוע הבא"
                        >
                          <ChevronsLeft className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {scheduleSearchDropdown}
                  <div className="grid gap-6" style={{ gridTemplateColumns }}>
                    <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 shadow-sm" dir="ltr">
                      ציר זמן
                    </div>

                    {showWaitingListColumn && (
                      <div className="rounded-lg border border-emerald-100 bg-white px-3 py-1.5 shadow-sm">
                        <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                          <span>רשימת המתנה</span>
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100">
                            {waitingListSummary.filtered}/{waitingListSummary.total}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          להיום · עודכן {waitingListLastUpdatedLabel}
                        </div>
                      </div>
                    )}


                    {/* Garden Column Headers */}
                    {shouldShowGardenColumns && (
                      <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                        <span className="text-sm font-semibold text-gray-900">גן</span>
                      </div>
                    )}

                    {visibleStationsWindow.map((station) => {
                      const hasWorkingHours = stationWorkingHours[station.id] && stationWorkingHours[station.id].length > 0
                      return (
                        <div key={`header-${station.id}`} className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-gray-900">{station.name}</span>
                            {!hasWorkingHours && station.serviceType === "grooming" && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600 transition-colors hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300"
                                    title="אין שעות עבודה מוגדרות לעמדה זו"
                                  >
                                    <AlertCircle className="h-3.5 w-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" side="bottom" className="w-56 text-sm" dir="rtl">
                                  לעמדה זו אין שעות עבודה מוגדרות. הגדר שעות עבודה כדי לאפשר קבלת תורים.
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4 text-gray-600" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" dir="rtl">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingStation(station)
                                    setIsStationEditDialogOpen(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4 ml-2" />
                                  ערוך
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setStationToDuplicate(station)
                                    setIsDuplicateStationDialogOpen(true)
                                  }}
                                >
                                  <Copy className="h-4 w-4 ml-2" />
                                  שכפל
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setStationConstraintsContext({ stationId: station.id, stationName: station.name, date: selectedDate })
                                    setIsStationConstraintsModalOpen(true)
                                  }}
                                >
                                  <CalendarCog className="h-4 w-4 ml-2" />
                                  נהל אילוצים
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Content Grid */}
              <div
                className="relative overflow-x-auto overflow-y-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                ref={contentScrollContainerRef}
                onScroll={handleContentScroll}
              >
                <div className="grid gap-6" style={{ gridTemplateColumns }}>
                  <div className="flex flex-col gap-2" dir="ltr">
                    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white" style={{ height: timeline.height }}>
                      <div className="absolute inset-0 pointer-events-none">
                        {timeline.slots.map((slot, index) => (
                          <div
                            key={`timeline-slot-${slot.offset}`}
                            className={cn("absolute left-0 right-0 border-b border-slate-100", {
                              "bg-slate-50/70": index % 2 === 0,
                            })}
                            style={{ top: slot.offset, height: slot.height }}
                          />
                        ))}
                      </div>
                      <div className="absolute inset-0 pointer-events-none">
                        {timeline.hourMarkers.map((marker) => (
                          <div key={`timeline-marker-${marker.label}-${marker.offset}`} className="absolute left-0 right-0" style={{ top: marker.offset }}>
                            <div className="absolute left-0 right-0 border-t border-dashed border-slate-300" />
                          </div>
                        ))}
                      </div>
                      <div className="absolute inset-0 pointer-events-none">
                        {timeline.slots.map((slot) => {
                          const estimatedLabelHeight = 18
                          const labelCenter = slot.offset + slot.height / 2
                          const minTop = 4
                          const maxTop = Math.max(minTop, timeline.height - estimatedLabelHeight - 4)
                          const baseTop = labelCenter - estimatedLabelHeight / 2
                          const clampedTop = Math.min(Math.max(baseTop, minTop), maxTop)
                          return (
                            <div
                              key={`timeline-label-${slot.label}-${slot.offset}`}
                              className="absolute inset-x-1 flex items-center justify-center rounded bg-white/90 px-1 py-0.5 text-[11px] font-medium text-gray-600"
                              style={{ top: clampedTop }}
                            >
                              {slot.label}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>


                  {showWaitingListColumn && (
                    <div className="flex flex-col" dir="rtl">
                      <div
                        className="relative overflow-hidden rounded-lg border border-emerald-100 bg-white"
                        style={{ height: timeline.height }}
                      >
                        <div className="flex h-full flex-col">
                          <div className="space-y-3 border-b border-slate-100 px-3 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{waitingListDateLabel}</p>
                                <p className="text-xs text-gray-500">
                                  {waitingListSummary.filtered} מתוך {waitingListSummary.total} ממתינים
                                </p>
                              </div>

                            </div>

                            {waitlistHasEntries && (
                              <div className="flex flex-wrap gap-1 text-[11px]">
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                                  מספרה {waitingListSummary.scopeCounts.grooming}
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                  גן {waitingListSummary.scopeCounts.daycare}
                                </span>
                                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">
                                  שילוב {waitingListSummary.scopeCounts.both}
                                </span>
                              </div>
                            )}

                            <div className="relative" dir="rtl">
                              <Input
                                value={waitingListSearchTerm}
                                onChange={(event) => setWaitingListSearchTerm(event.target.value)}
                                placeholder="חיפוש לפי שם כלב, לקוח או טלפון"
                                className="pr-9 text-sm"
                              />
                              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            </div>

                            <div className="space-y-3">
                              <div>
                                <Label className="mb-1 block text-xs font-medium text-gray-500">סיווג לקוח</Label>
                                <AutocompleteFilter
                                  value={customerTypeQuery}
                                  onChange={setCustomerTypeQuery}
                                  onSelect={handleSelectCustomerType}
                                  placeholder="חפש סוג לקוח..."
                                  searchFn={searchCustomerTypes}
                                  minSearchLength={0}
                                  autoSearchOnFocus
                                  initialLoadOnMount
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-xs font-medium text-gray-500">קטגוריית גזע</Label>
                                <AutocompleteFilter
                                  value={treatmentCategoryQuery}
                                  onChange={setTreatmentCategoryQuery}
                                  onSelect={handleSelectTreatmentCategory}
                                  placeholder="חפש קטגוריה..."
                                  searchFn={searchTreatmentCategories}
                                  minSearchLength={0}
                                  autoSearchOnFocus
                                  initialLoadOnMount
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-xs font-medium text-gray-500">טיפוס גזע</Label>
                                <AutocompleteFilter
                                  value={treatmentTypeQuery}
                                  onChange={setTreatmentTypeQuery}
                                  onSelect={handleSelectTreatmentType}
                                  placeholder="חפש טיפוס..."
                                  searchFn={searchTreatmentTypes}
                                  minSearchLength={0}
                                  autoSearchOnFocus
                                  initialLoadOnMount
                                />
                              </div>
                            </div>

                            {waitlistHasFilters && (
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex flex-wrap gap-1">
                                  {selectedCustomerTypes.map((type) => (
                                    <button
                                      key={`customer-type-${type.id}`}
                                      type="button"
                                      onClick={() => removeCustomerType(type.id)}
                                      className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"
                                    >
                                      {type.name}
                                      <X className="h-3 w-3" />
                                    </button>
                                  ))}
                                  {selectedTreatmentCategories.map((category) => (
                                    <button
                                      key={`treatment-category-${category.id}`}
                                      type="button"
                                      onClick={() => removeTreatmentCategory(category.id)}
                                      className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"
                                    >
                                      {category.name}
                                      <X className="h-3 w-3" />
                                    </button>
                                  ))}
                                  {selectedTreatmentTypes.map((type) => (
                                    <button
                                      key={`treatment-type-${type.id}`}
                                      type="button"
                                      onClick={() => removeTreatmentType(type.id)}
                                      className="inline-flex items-center gap-1 rounded-full border border-purple-100 bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700"
                                    >
                                      {type.name}
                                      <X className="h-3 w-3" />
                                    </button>
                                  ))}
                                </div>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  onClick={clearWaitingListFilters}
                                  className="px-0 text-xs text-emerald-700"
                                >
                                  נקה ({waitingListActiveFiltersCount})
                                </Button>
                              </div>
                            )}
                          </div>

                          <ScrollArea className="flex-1 px-3 py-3">
                            <div className="space-y-3 pr-3">
                              {isLoadingWaitingList ? (
                                <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-gray-500">
                                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                  טוען רשימת המתנה...
                                </div>
                              ) : waitingListError ? (
                                <Alert variant="destructive">
                                  <AlertTitle>שגיאה</AlertTitle>
                                  <AlertDescription>{waitingListError}</AlertDescription>
                                </Alert>
                              ) : filteredWaitingListEntries.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center text-sm text-gray-500">
                                  אין ממתינים שעונים למסננים שנבחרו
                                </div>
                              ) : (
                                <Accordion
                                  type="single"
                                  collapsible
                                  value={waitlistSection ?? undefined}
                                  onValueChange={(value) => setWaitlistSection(value || null)}
                                  className="space-y-3"
                                >
                                  <AccordionItem value="client-types">
                                    <AccordionTrigger className="text-sm font-semibold text-gray-900 justify-between text-right flex-row-reverse">
                                      לפי סיווג לקוח ({waitlistBuckets.clientTypes.length})
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-3">
                                      {renderWaitlistBucketGroups(
                                        waitlistBuckets.clientTypes,
                                        "client",
                                        handleWaitlistCardClick
                                      )}
                                    </AccordionContent>
                                  </AccordionItem>
                                  <AccordionItem value="treatment-categories">
                                    <AccordionTrigger className="text-sm font-semibold text-gray-900 justify-between text-right flex-row-reverse">
                                      לפי קטגוריית גזע ({waitlistBuckets.treatmentCategories.length})
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-3">
                                      {renderWaitlistBucketGroups(
                                        waitlistBuckets.treatmentCategories,
                                        "category",
                                        handleWaitlistCardClick
                                      )}
                                    </AccordionContent>
                                  </AccordionItem>
                                  <AccordionItem value="treatment-types">
                                    <AccordionTrigger className="text-sm font-semibold text-gray-900 justify-between text-right flex-row-reverse">
                                      לפי טיפוס גזע ({waitlistBuckets.treatmentTypes.length})
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-3">
                                      {renderWaitlistBucketGroups(
                                        waitlistBuckets.treatmentTypes,
                                        "type",
                                        handleWaitlistCardClick
                                      )}
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Garden Columns */}
                  {shouldShowGardenColumns && (
                    <GardenColumn sections={gardenSections} />
                  )}

                  {visibleStationsWindow.map((station) => (
                    <DroppableStationColumn key={station.id} station={station} />
                  ))}
                </div>

                <DragOverlay>
                  {draggedAppointment.appointment ? (
                    <div className="w-64">
                      {renderAppointmentCard(draggedAppointment.appointment, true)}
                    </div>
                  ) : draggedConstraint.constraint ? (
                    <div className="w-64">
                      <div className="bg-orange-100 border border-orange-300 rounded-md px-2 py-2 text-right">
                        {(() => {
                          const startDate = parseISODate(draggedConstraint.constraint.start_time)
                          const endDate = parseISODate(draggedConstraint.constraint.end_time)
                          if (!startDate || !endDate) return null

                          const originalStartTime = format(startDate, "HH:mm")
                          const originalEndTime = format(endDate, "HH:mm")

                          // Calculate target time if we have highlighted slots
                          let timeRangeLabel = `${originalStartTime} - ${originalEndTime}`
                          if (highlightedSlots && highlightedSlots.startTimeSlot !== undefined) {
                            const targetStartTime = addMinutes(timeline.start, highlightedSlots.startTimeSlot * intervalMinutes)
                            const constraintDurationMinutes = differenceInMinutes(endDate, startDate)
                            const targetEndTime = addMinutes(targetStartTime, constraintDurationMinutes)
                            const targetTimeRangeLabel = `${format(targetStartTime, "HH:mm")} - ${format(targetEndTime, "HH:mm")}`
                            timeRangeLabel = `${originalStartTime} - ${originalEndTime} ← ${targetTimeRangeLabel}`
                          }

                          return (
                            <>
                              <div className="text-xs text-gray-600 mb-1 font-medium">
                                {timeRangeLabel}
                              </div>
                              <div className="text-xs font-medium text-orange-800">
                                {getConstraintDisplayReason(draggedConstraint.constraint.reason, draggedConstraint.constraint.notes)}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  ) : draggedWaitlistEntry.entry ? (
                    <div className="w-64">
                      <WaitlistCard entry={draggedWaitlistEntry.entry} isDragging />
                    </div>
                  ) : null}
                </DragOverlay>
              </div>
            </DndContext>
          </div>
          {/* Right Sidebar Control Panel */}
          <div className="w-80 flex-shrink-0 rounded-lg bg-gray-50 p-4" dir="rtl">
            <div className="space-y-4">
              {/* Action Buttons Section */}
              <div className="flex flex-col gap-2">
                <Button onClick={() => setShowServiceTypeSelectionModal(true)} className="w-full">קבע תור חדש</Button>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="w-full">
                  {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  <span className="mr-2">רענן נתונים</span>
                </Button>
              </div>

              {/* Navigation Controls Section */}
              {stations.length ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">ניווט בין עמדות</h3>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleScrollBackward}
                      disabled={!canScrollBackward}
                      className="cursor-pointer hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <span className="text-xs text-gray-600 text-center">
                      {displayedRangeStart}-{displayedRangeEnd} מתוך {filteredStations.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleScrollForward}
                      disabled={!canScrollForward}
                      className="cursor-pointer hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ) : null}





              {/* Station Filters Section */}
              {stations.length ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">סינון עמדות</h3>
                    {isStationOrderSaving && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>שומר...</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StationFilterPopover
                      stations={stations}
                      visibleStationIds={visibleStationIds}
                      onSelectAll={handleSelectAllStations}
                      onClear={handleClearStations}
                      onToggle={handleStationToggle}
                      sensors={stationReorderSensors}
                      onReorderEnd={handleStationReorderEnd}
                      isStationOrderSaving={isStationOrderSaving}
                      showWaitingListColumn={showWaitingListColumn}
                      waitingListCount={waitingListSummary.filtered}
                      onToggleWaitingList={(next) => setShowWaitingListColumn(next)}
                      trigger={
                        <Button variant="outline" className="flex items-center gap-2 flex-1 justify-between text-sm">
                          <span className="font-medium text-gray-900">{stationFilterSummary}</span>
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            {visibleStationIds.length === 0 ? stations.length : visibleStationIds.length}/{stations.length}
                          </span>
                        </Button>
                      }
                    />
                  </div>
                </div>
              ) : null}

              {/* Display Settings Section */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">הגדרות תצוגה</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-2 block">מרווח זמן</label>
                    <Select value={String(intervalMinutes)} onValueChange={(value) => setIntervalMinutes(Number(value))}>
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
                    <label className="text-sm text-gray-600 mb-2 block">גודל תורים</label>
                    <Select value={String(pixelsPerMinuteScale)} onValueChange={(value) => setPixelsPerMinuteScale(Number(value))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="בחר גודל" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">קטן מאוד</SelectItem>
                        <SelectItem value="2">קטן</SelectItem>
                        <SelectItem value="3">בינוני</SelectItem>
                        <SelectItem value="4">גדול</SelectItem>
                        <SelectItem value="5">גדול מאוד</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Picker Section */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex  items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-gray-900">תאריך</h3>
                      <button
                        type="button"
                        onClick={handleJumpToToday}
                        className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        היום
                      </button>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      {/* Tomorrow Button (Right Arrow) */}


                      {/* Date Selection Button */}
                      <SmallCalendar
                        mode="single"
                        month={calendarMonth}
                        onMonthChange={(month) => setCalendarMonth(startOfMonth(month))}
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                      />




                    </div>
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>
      )}
      {/* Appointment Details Sheet */}
      {selectedAppointment?.isProposedMeeting ? (
        <ProposedMeetingSheet
          open={isDetailsOpen}
          onOpenChange={handleDetailsOpenChange}
          meeting={selectedAppointment}
          onEdit={handleOpenProposedMeetingEditor}
          onDelete={handleDeleteProposedMeeting}
          onSendInvite={(invite) => handleSendSingleProposedInvite(invite, selectedAppointment)}
          onSendAll={handleSendAllProposedInvites}
          onSendCategory={(categoryId) => handleSendCategoryInvites(selectedAppointment, categoryId)}
          onSendAllCategories={() => handleSendAllCategoryInvites(selectedAppointment)}
          sendingInviteId={sendingInviteId}
          sendingAll={sendingAllInvites}
          sendingCategoryId={sendingCategoryId}
          sendingCategoriesBatch={sendingCategoriesBatch}
          deleting={isDeletingProposed}
        />
      ) : (
        <AppointmentDetailsSheet
          open={isDetailsOpen}
          onOpenChange={handleDetailsOpenChange}
          selectedAppointment={selectedAppointment}
          onTreatmentClick={handleTreatmentClick}
          onClientClick={handleClientClick}
          onEditAppointment={(appointment) => {
            if (appointment.serviceType === "garden") {
              openGardenEditModal(appointment)
            } else {
              openGroomingEditModal(appointment)
            }
          }}
          onCancelAppointment={handleCancelAppointment}
          onDeleteAppointment={handleDeleteAppointment}
          isLoading={isLoadingAppointment}
        />
      )}

      {/* Treatment Details Sheet */}
      <TreatmentDetailsSheet
        open={isTreatmentDetailsOpen}
        onOpenChange={handleTreatmentDetailsOpenChange}
        selectedTreatment={selectedTreatment}
        showAllPastAppointments={showAllPastAppointments}
        setShowAllPastAppointments={setShowAllPastAppointments}
        data={data}
        onClientClick={handleClientClick}
        onAppointmentClick={(appointment) => {
          setSelectedAppointment(appointment)
          setIsTreatmentDetailsOpen(false)
          setIsDetailsOpen(true)
        }}
        onShowTreatmentAppointments={(treatmentId, treatmentName) => {
          setSelectedTreatmentForAppointments({ id: treatmentId, name: treatmentName })
          setShowTreatmentAppointmentsModal(true)
        }}
      />

      {/* Client Details Sheet */}
      <ClientDetailsSheet
        open={isClientDetailsOpen}
        onOpenChange={handleClientDetailsOpenChange}
        selectedClient={selectedClient}
        data={data}
        onTreatmentClick={handleTreatmentClick}
      />

      {/* Constraint Details Sheet */}
      <ConstraintDetailsSheet
        open={isConstraintDetailsOpen}
        onOpenChange={setIsConstraintDetailsOpen}
        selectedConstraint={selectedConstraint}
        stationName={selectedConstraint ? stations.find(s => s.id === selectedConstraint.station_id)?.name : undefined}
      />

      {/* Move Confirmation Modal */}
      <MoveConfirmationDialog
        open={moveConfirmationOpen}
        onOpenChange={setMoveConfirmationOpen}
        moveDetails={moveDetails}
        hourlyTimeSelection={hourlyTimeSelection}
        setHourlyTimeSelection={setHourlyTimeSelection}
        updateCustomerMove={updateCustomerMove}
        setUpdateCustomerMove={setUpdateCustomerMove}
        onConfirm={handleConfirmMove}
        loading={moveLoading}
        onCancel={() => {
          setMoveConfirmationOpen(false)
          setMoveDetails(null)
          setHourlyTimeSelection(null)
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationDialog
        open={deleteConfirmationOpen}
        onOpenChange={setDeleteConfirmationOpen}
        appointmentToDelete={appointmentToDelete}
        updateCustomer={updateCustomer}
        setUpdateCustomer={setUpdateCustomer}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmationOpen(false)}
        isLoading={isDeleting}
        onAppointmentClick={handleGroupAppointmentClick}
      />

      {/* Cancel Confirmation Dialog */}
      <CancelConfirmationDialog
        open={cancelConfirmationOpen}
        onOpenChange={setCancelConfirmationOpen}
        appointmentToCancel={appointmentToCancel}
        updateCustomerCancel={updateCustomerCancel}
        setUpdateCustomerCancel={setUpdateCustomerCancel}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelConfirmationOpen(false)}
        isLoading={isCancelling}
        onAppointmentClick={handleGroupAppointmentClick}
      />

      {/* Duplicate Series Modal */}
      <DuplicateSeriesModal
        open={duplicateSeriesOpen}
        onOpenChange={setDuplicateSeriesOpen}
        appointment={appointmentToDuplicate}
        onConfirm={handleConfirmDuplicate}
        onCancel={() => {
          setDuplicateSeriesOpen(false)
          setAppointmentToDuplicate(null)
        }}
        loading={duplicateLoading}
      />

      {/* Duplicate Success Modal */}
      <DuplicateSuccessModal
        open={duplicateSuccessOpen}
        onOpenChange={setDuplicateSuccessOpen}
        appointments={createdAppointments}
        onAppointmentClick={handleCreatedAppointmentClick}
      />

      {/* Garden Edit Modal */}
      <GardenEditModal
        open={gardenEditOpen}
        onOpenChange={setGardenEditOpen}
        editingAppointment={editingAppointment}
        gardenEditForm={gardenEditForm}
        setGardenEditForm={setGardenEditForm}
        updateCustomerGarden={updateCustomerGarden}
        setUpdateCustomerGarden={setUpdateCustomerGarden}
        gardenEditLoading={gardenEditLoading}
        onCancel={() => {
          setGardenEditOpen(false)
          setEditingAppointment(null)
        }}
        onDelete={handleDeleteAppointment}
        onConfirm={handleGardenEditConfirm}
      />

      {/* Grooming Edit Modal */}
      <GroomingEditModal
        open={groomingEditOpen}
        onOpenChange={setGroomingEditOpen}
        editingGroomingAppointment={editingGroomingAppointment}
        groomingEditForm={groomingEditForm}
        setGroomingEditForm={setGroomingEditForm}
        updateCustomerGrooming={updateCustomerGrooming}
        setUpdateCustomerGrooming={setUpdateCustomerGrooming}
        groomingEditLoading={groomingEditLoading}
        stations={stations}
        pendingResizeState={pendingResizeState}
        onCancel={() => {
          // If this was a resize operation, revert the changes
          if (pendingResizeState) {
            // Revert the frontend changes by updating the cache
            dispatch(
              supabaseApi.util.updateQueryData(
                'getManagerSchedule',
                {
                  date: format(selectedDate, 'yyyy-MM-dd'),
                  serviceType: serviceFilter
                },
                (draft) => {
                  if (!draft) return
                  const appointmentIndex = draft.appointments.findIndex(
                    (apt) => apt.id === pendingResizeState.appointment.id
                  )
                  if (appointmentIndex === -1) return

                  draft.appointments[appointmentIndex] = {
                    ...draft.appointments[appointmentIndex],
                    endDateTime: pendingResizeState.originalEndTime.toISOString(),
                    durationMinutes: pendingResizeState.originalDuration,
                  }
                }
              )
            )

            setPendingResizeState(null)
          }

          setGroomingEditOpen(false)
          setEditingGroomingAppointment(null)
        }}
        onDelete={handleDeleteAppointment}
        onConfirm={handleGroomingEditConfirm}
      />

      {/* Waiting List Drop Confirmation */}
      <Dialog
        open={showWaitlistDropDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelWaitlistPlacement()
          } else {
            setShowWaitlistDropDialog(true)
          }
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שיבוץ לקוח מרשימת ההמתנה</DialogTitle>
            <DialogDescription>
              נפתח עבורך שמירת תור עסקי עם הפרטים שנגררו.
            </DialogDescription>
          </DialogHeader>
          {pendingWaitlistPlacement && (
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <p className="mb-1">
                  להוסיף את{" "}
                  <span className="font-semibold">{pendingWaitlistPlacement.entry.treatmentName}</span>
                  {pendingWaitlistPlacement.entry.customerName && (
                    <>
                      {" "}
                      <span className="text-gray-400">/</span>{" "}
                      <span className="font-semibold">{pendingWaitlistPlacement.entry.customerName}</span>
                    </>
                  )}
                </p>
                <p>
                  לעמדה{" "}
                  <span className="font-semibold">
                    {pendingPlacementStation?.name || pendingWaitlistPlacement.stationId}
                  </span>{" "}
                  בשעות{" "}
                  <span className="font-semibold">
                    {format(pendingWaitlistPlacement.startTime, "HH:mm")} -{" "}
                    {format(pendingWaitlistPlacement.endTime, "HH:mm")}
                  </span>
                  ?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remove-waitlist"
                  checked={shouldRemoveFromWaitlist}
                  onCheckedChange={(checked) => setShouldRemoveFromWaitlist(Boolean(checked))}
                />
                <Label htmlFor="remove-waitlist" className="text-xs text-gray-700">
                  הסר את הלקוח מרשימת ההמתנה לאחר יצירת התור
                </Label>
              </div>
            </div>
          )}
          <DialogFooter dir="ltr">
            <Button variant="outline" onClick={handleCancelWaitlistPlacement}>
              ביטול
            </Button>
            <Button onClick={handleConfirmWaitlistPlacement} disabled={!pendingWaitlistPlacement}>
              המשך ליצירת תור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Type Selection Modal */}
      <AppointmentTypeSelectionModal
        open={showAppointmentTypeSelection}
        onOpenChange={setShowAppointmentTypeSelection}
        finalizedDragTimes={finalizedDragTimes}
        stations={stations}
        onSelectPrivate={() => {
          setShowAppointmentTypeSelection(false)
          setShowPrivateAppointmentModal(true)
        }}
        onSelectBusiness={() => {
          setShowAppointmentTypeSelection(false)
          setPrefillBusinessCustomer(null)
          setPrefillBusinessTreatment(null)
          setPendingWaitlistEntryId(null)
          setShouldRemoveFromWaitlist(true)
          setShowBusinessAppointmentModal(true)
        }}
        onSelectProposed={handleOpenProposedMeetingCreate}
        onSelectConstraint={() => {
          setShowAppointmentTypeSelection(false)
          setEditingConstraint(null)
          if (finalizedDragTimes?.startTime && finalizedDragTimes?.endTime && finalizedDragTimes?.stationId) {
            setEditingConstraintStationIds([finalizedDragTimes.stationId])
          } else {
            setEditingConstraintStationIds([])
          }
          setIsConstraintDialogOpen(true)
        }}
        onCancel={() => {
          setShowAppointmentTypeSelection(false)
          setFinalizedDragTimes(null)
        }}
      />

      {/* Private Appointment Modal */}
      <PrivateAppointmentModal
        open={showPrivateAppointmentModal}
        onOpenChange={setShowPrivateAppointmentModal}
        finalizedDragTimes={finalizedDragTimes}
        privateAppointmentForm={privateAppointmentForm}
        setPrivateAppointmentForm={setPrivateAppointmentForm}
        createPrivateAppointmentLoading={createManagerAppointmentLoading}
        stations={stations}
        onCancel={() => {
          setShowPrivateAppointmentModal(false)
          setPrivateAppointmentForm({ name: '', selectedStations: [] })
          setFinalizedDragTimes(null)
        }}
        onConfirm={handleCreatePrivateAppointment}
        onUpdateTimes={(times) => {
          setFinalizedDragTimes(times)
        }}
      />

      {/* Business Appointment Modal */}
      <BusinessAppointmentModal
        open={showBusinessAppointmentModal}
        onOpenChange={setShowBusinessAppointmentModal}
        finalizedDragTimes={finalizedDragTimes}
        stations={stations}
        prefillCustomer={prefillBusinessCustomer}
        prefillTreatment={prefillBusinessTreatment}
        onCancel={() => {
          setShowBusinessAppointmentModal(false)
          setFinalizedDragTimes(null)
          setPendingWaitlistEntryId(null)
          setPrefillBusinessCustomer(null)
          setPrefillBusinessTreatment(null)
          setShouldRemoveFromWaitlist(true)
        }}
        onSuccess={() => {
          void handleBusinessAppointmentSuccess()
        }}
      />

      <ProposedMeetingModal
        open={showProposedMeetingModal}
        onOpenChange={(open) => {
          setShowProposedMeetingModal(open)
          if (!open) {
            setEditingProposedMeeting(null)
            setProposedMeetingTimes(null)
          }
        }}
        mode={proposedMeetingMode}
        stations={stations.map((station) => ({
          id: station.id,
          name: station.name,
          serviceType: station.serviceType ?? "grooming",
        }))}
        defaultTimes={proposedMeetingTimes}
        initialData={proposedModalInitialData}
        loading={proposedMeetingMode === "create" ? creatingProposedMeeting : updatingProposedMeeting}
        onSubmit={handleSubmitProposedMeeting}
      />

      {/* New Garden Appointment Modal */}
      <NewGardenAppointmentModal
        open={newGardenAppointmentModalOpen}
        onOpenChange={setNewGardenAppointmentModalOpen}
        appointmentType={newGardenAppointmentType}
        loading={createManagerAppointmentLoading}
        defaultDate={selectedDate}
        onConfirm={async (appointmentData) => {
          try {
            // Combine date and time to create ISO datetime strings
            const dateStr = appointmentData.date?.toISOString().split('T')[0]
            const startDateTime = `${dateStr}T${appointmentData.startTime}:00`
            const endDateTime = `${dateStr}T${appointmentData.endTime}:00`

            // Get garden stations from the schedule data
            const gardenStations = stations.filter((s) => s.serviceType === 'garden')

            // Get station ID based on treatment size, or use first garden station if available
            let stationId: string | undefined
            if (gardenStations.length > 0) {
              // Try to find station by name (small treatments vs regular)
              const smallTreatmentStation = gardenStations.find((s: any) =>
                s.name?.toLowerCase().includes('קטן') ||
                s.name?.toLowerCase().includes('small')
              )
              const regularStation = gardenStations.find((s: any) =>
                !s.name?.toLowerCase().includes('קטן') &&
                !s.name?.toLowerCase().includes('small')
              )

              if (appointmentData.treatment?.isSmall === true && smallTreatmentStation) {
                stationId = smallTreatmentStation.id
              } else if (regularStation) {
                stationId = regularStation.id
              } else {
                // Fallback to first garden station
                stationId = gardenStations[0].id
              }
            }

            if (!stationId) {
              throw new Error('לא נמצאה עמדה זמינה לגן')
            }

            // Call the create-manager-appointment function which already handles the webhook
            const result = await createManagerAppointment({
              name: `${appointmentData.customer?.fullName || ''} - ${appointmentData.treatment?.name || ''}`,
              stationId,
              selectedStations: [stationId],
              startTime: new Date(startDateTime).toISOString(),
              endTime: new Date(endDateTime).toISOString(),
              appointmentType: "garden",
              customerId: appointmentData.customer?.recordId || appointmentData.customer?.id,
              treatmentId: appointmentData.treatment?.id,
              gardenAppointmentType: appointmentData.appointmentType, // 'full-day' | 'hourly' | 'trial'
              services: {
                gardenTrimNails: appointmentData.gardenTrimNails,
                gardenBrush: appointmentData.gardenBrush,
                gardenBath: appointmentData.gardenBath,
              },
              latePickupRequested: appointmentData.latePickupRequested,
              latePickupNotes: appointmentData.latePickupNotes,
              notes: appointmentData.notes,
              internalNotes: appointmentData.internalNotes,
            }).unwrap()


            toast({
              title: "תור גן נוצר בהצלחה!",
              description: `התור של ${data.treatment?.name} נוסף ללוח הזמנים`,
            })

            // Navigate to the appointment date if different from current view
            if (dateStr && format(selectedDate, 'yyyy-MM-dd') !== dateStr) {
              const targetDate = parseISO(dateStr)
              if (targetDate) {
                setSelectedDate(targetDate)
              }
            }

            // Close modal and refetch data
            setNewGardenAppointmentModalOpen(false)
            await refetch()
          } catch (error) {
            console.error('Error creating garden appointment:', error)
            toast({
              title: "שגיאה ביצירת התור",
              description: "אירעה שגיאה בעת יצירת תור הגן",
              variant: "destructive",
            })
          }
        }}
      />
      {/* Service Type Selection Modal */}
      <ServiceTypeSelectionModal
        open={showServiceTypeSelectionModal}
        onOpenChange={setShowServiceTypeSelectionModal}
        onSelectGrooming={() => {
          // Open appointment type selection (personal/business) with default values
          const groomingStations = stations.filter(s => s.serviceType === 'grooming')
          const firstGroomingStation = groomingStations[0]

          if (firstGroomingStation) {
            // Create default times for the selected date
            const defaultStartTime = new Date(selectedDate)
            defaultStartTime.setHours(9, 0, 0, 0) // 09:00

            const defaultEndTime = new Date(selectedDate)
            defaultEndTime.setHours(10, 0, 0, 0) // 10:00

            setFinalizedDragTimes({
              startTime: defaultStartTime,
              endTime: defaultEndTime,
              stationId: firstGroomingStation.id
            })
            setShowAppointmentTypeSelection(true)
          } else {
            toast({
              title: "שגיאה",
              description: "לא נמצאו עמדות מספרה",
              variant: "destructive",
            })
          }
        }}
        onSelectGarden={() => {
          // Open garden appointment modal
          setNewGardenAppointmentType('hourly')
          setNewGardenAppointmentModalOpen(true)
        }}
      />

      {/* Treatment Appointments Modal */}
      {selectedTreatmentForAppointments && (
        <TreatmentAppointmentsModal
          open={showTreatmentAppointmentsModal}
          onOpenChange={setShowTreatmentAppointmentsModal}
          treatmentId={selectedTreatmentForAppointments.id}
          treatmentName={selectedTreatmentForAppointments.name}
          onAppointmentClick={(appointment) => {
            setSelectedAppointment(appointment)
            setShowTreatmentAppointmentsModal(false)
            setIsDetailsOpen(true)
          }}
        />
      )}

      {/* Payment Modal */}
      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        appointment={selectedAppointmentForPayment}
        onConfirm={(paymentData) => {
          toast({
            title: "תשלום נקלט בהצלחה",
            description: `תשלום בסך ₪${paymentData.amount} נרשם בהצלחה`,
          })
          setShowPaymentModal(false)
          // TODO: Send payment data to backend
        }}
      />

      {/* Constraint Edit Dialog */}
      <ConstraintEditDialog
        open={isConstraintDialogOpen}
        onOpenChange={(open) => {
          setIsConstraintDialogOpen(open)
          if (!open) {
            setEditingConstraint(null)
            setEditingConstraintStationIds([])
            setEditingConstraintDefaultTimes(null)
            setFinalizedDragTimes(null)
          }
        }}
        constraint={editingConstraint ? {
          id: editingConstraint.id,
          station_id: editingConstraint.station_id,
          reason: editingConstraint.reason,
          notes: editingConstraint.notes,
          start_time: editingConstraint.start_time,
          end_time: editingConstraint.end_time,
        } : null}
        stationIds={editingConstraintStationIds}
        defaultStartDate={editingConstraintDefaultTimes?.startDate || finalizedDragTimes?.startTime || null}
        defaultEndDate={editingConstraintDefaultTimes?.endDate || finalizedDragTimes?.endTime || null}
        defaultStartTime={editingConstraintDefaultTimes?.startTime || (finalizedDragTimes?.startTime ? `${String(finalizedDragTimes.startTime.getHours()).padStart(2, "0")}:${String(finalizedDragTimes.startTime.getMinutes()).padStart(2, "0")}` : undefined)}
        defaultEndTime={editingConstraintDefaultTimes?.endTime || (finalizedDragTimes?.endTime ? `${String(finalizedDragTimes.endTime.getHours()).padStart(2, "0")}:${String(finalizedDragTimes.endTime.getMinutes()).padStart(2, "0")}` : undefined)}
        defaultIsActive={editingConstraintDefaultTimes?.isActive}
        onSave={async () => {
          // Invalidate cache to refresh ManagerSchedule data
          await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule']))

          // Refresh constraints after save
          const dayStart = startOfDay(selectedDate)
          const dayEnd = addHours(dayStart, 24)
          const { data: constraintsData } = await supabase
            .from("station_unavailability")
            .select(`
              id,
              station_id,
              reason,
              notes,
              start_time,
              end_time,
              is_active
            `)
            .lt("start_time", dayEnd.toISOString())
            .gt("end_time", dayStart.toISOString())
          setConstraints(constraintsData || [])
          setFinalizedDragTimes(null)
        }}
      />

      {/* Constraint Delete Confirmation Dialog */}
      <Dialog open={showDeleteConstraintDialog} onOpenChange={(open) => {
        setShowDeleteConstraintDialog(open)
        if (!open) {
          setConstraintToDelete(null)
          setConstraintToDeleteDetails(null)
          setDeleteFromAllStations(true)
        }
      }}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">מחיקת אילוץ</DialogTitle>
            <DialogDescription className="text-right">
              האם אתה בטוח שברצונך למחוק את האילוץ?
            </DialogDescription>
          </DialogHeader>

          {(() => {
            // Get constraint details - either from details or from constraints list
            const constraint = constraintToDeleteDetails?.constraint || constraints.find(c => c.id === constraintToDelete)
            if (!constraint) return null

            const stationNames = constraintToDeleteDetails?.stationNames ||
              [stations.find(s => s.id === constraint.station_id)?.name].filter((n): n is string => Boolean(n))
            const startDate = parseISODate(constraint.start_time)
            const endDate = parseISODate(constraint.end_time)
            const reasonText = getConstraintDisplayReason(constraint.reason, constraint.notes)
            const notesText = constraint.notes?.text?.replace(/\[CUSTOM_REASON:[^\]]+\]\s?/, "") || ""

            return (
              <div className="space-y-4 py-4">
                {/* Constraint Details */}
                <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">עמדות:</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {stationNames.map((name, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">סיבה:</Label>
                      <p className="text-sm font-medium mt-1">{reasonText || "-"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">תאריך ושעה התחלה:</Label>
                      <p className="text-sm font-medium mt-1">
                        {startDate ? format(startDate, "dd/MM/yyyy HH:mm") : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">תאריך ושעה סיום:</Label>
                      <p className="text-sm font-medium mt-1">
                        {endDate ? format(endDate, "dd/MM/yyyy HH:mm") : "-"}
                      </p>
                    </div>
                  </div>

                  {notesText && (
                    <div>
                      <Label className="text-sm text-gray-600">הערות:</Label>
                      <p className="text-sm mt-1">{notesText}</p>
                    </div>
                  )}
                </div>

                {/* Multi-station selection */}
                {stationNames.length > 1 && (
                  <div className="space-y-3 border rounded-lg p-4">
                    <Label className="text-base font-semibold">אפשרויות מחיקה:</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="delete-all"
                          checked={deleteFromAllStations}
                          onCheckedChange={(checked) => setDeleteFromAllStations(checked === true)}
                        />
                        <Label htmlFor="delete-all" className="cursor-pointer text-sm">
                          מחק מכל העמדות ({stationNames.length} עמדות)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="delete-current"
                          checked={!deleteFromAllStations}
                          onCheckedChange={(checked) => setDeleteFromAllStations(checked !== true)}
                        />
                        <Label htmlFor="delete-current" className="cursor-pointer text-sm">
                          מחק רק מהעמדה הנוכחית ({stations.find(s => s.id === constraint.station_id)?.name || stationNames[0]})
                        </Label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          <DialogFooter className="sm:justify-start gap-2">
            <Button
              variant="destructive"
              onClick={handleDeleteConstraint}
            >
              מחק
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConstraintDialog(false)
                setConstraintToDelete(null)
                setConstraintToDeleteDetails(null)
                setDeleteFromAllStations(true)
              }}
            >
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Station Edit Dialog */}
      <StationEditDialog
        open={isStationEditDialogOpen}
        onOpenChange={setIsStationEditDialogOpen}
        station={editingStation ? {
          id: editingStation.id,
          name: editingStation.name,
          is_active: editingStation.isActive ?? true
        } : null}
        onSaved={async () => {
          // Refresh the schedule data after saving
          await refetch()
          dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Station"]))
          // Refetch station working hours to update gray slots immediately
          await fetchStationWorkingHours()
        }}
      />
      {/* Duplicate Station Dialog */}
      <DuplicateStationDialog
        open={isDuplicateStationDialogOpen}
        onOpenChange={setIsDuplicateStationDialogOpen}
        station={stationToDuplicate ? {
          id: stationToDuplicate.id,
          name: stationToDuplicate.name,
          is_active: stationToDuplicate.isActive ?? true
        } : null}
        stations={stations.map(s => ({
          id: s.id,
          name: s.name,
          is_active: s.isActive ?? true
        })) || []}
        onConfirm={async (params) => {
          if (!stationToDuplicate) return

          setIsDuplicatingStation(true)
          try {
            const sourceStationId = stationToDuplicate.id
            let targetStationId: string

            // Get grooming service ID
            const { data: groomingService } = await supabase
              .from("services")
              .select("id")
              .eq("name", "grooming")
              .maybeSingle()

            const groomingServiceId = groomingService?.id

            if (params.mode === "new") {
              // Create new station
              if (!params.name) throw new Error("Station name is required for new station")

              const { data: newStation, error: stationError } = await supabase
                .from("stations")
                .insert({
                  name: params.name,
                  is_active: stationToDuplicate.isActive,
                })
                .select("id, name, is_active")
                .single()

              if (stationError) throw stationError
              if (!newStation) throw new Error("Failed to create duplicate station")
              targetStationId = newStation.id

              // Fetch working hours for the original station
              const { data: originalWorkingHours, error: hoursError } = await supabase
                .from("station_working_hours")
                .select("*")
                .eq("station_id", sourceStationId)

              if (hoursError) throw hoursError

              // Duplicate working hours
              if (originalWorkingHours && originalWorkingHours.length > 0) {
                const shiftsToInsert = originalWorkingHours.map((shift) => ({
                  station_id: targetStationId,
                  weekday: shift.weekday,
                  open_time: shift.open_time,
                  close_time: shift.close_time,
                  shift_order: shift.shift_order || 0,
                }))

                const { error: insertError } = await supabase.from("station_working_hours").insert(shiftsToInsert)
                if (insertError) throw insertError
              }

              // Copy treatmentType relations if requested
              if (groomingServiceId && params.copyTreatmentTypeRelations) {
                // Copy service_station_matrix
                const { data: originalMatrixData } = await supabase
                  .from("service_station_matrix")
                  .select("base_time_minutes")
                  .eq("service_id", groomingServiceId)
                  .eq("station_id", sourceStationId)
                  .maybeSingle()

                const originalBaseTime = originalMatrixData?.base_time_minutes || 0

                await supabase
                  .from("service_station_matrix")
                  .upsert({
                    service_id: groomingServiceId,
                    station_id: targetStationId,
                    base_time_minutes: originalBaseTime,
                    price: 0,
                  }, { onConflict: "service_id,station_id" })

                // Copy station_treatmentType_rules
                const { data: originalRules } = await supabase
                  .from("station_treatmentType_rules")
                  .select("*")
                  .eq("station_id", sourceStationId)

                if (originalRules && originalRules.length > 0) {
                  for (const rule of originalRules) {
                    const { data: treatmentTypeModifier } = await supabase
                      .from("treatmentType_modifiers")
                      .select("time_modifier_minutes")
                      .eq("service_id", groomingServiceId)
                      .eq("treatment_type_id", rule.treatment_type_id)
                      .maybeSingle()

                    const defaultTime = treatmentTypeModifier?.time_modifier_minutes || 60
                    const durationMinutes = rule.duration_modifier_minutes || (originalBaseTime + defaultTime)

                    await supabase
                      .from("station_treatmentType_rules")
                      .upsert({
                        station_id: targetStationId,
                        treatment_type_id: rule.treatment_type_id,
                        is_active: rule.is_active ?? true,
                        remote_booking_allowed: rule.remote_booking_allowed ?? false,
                        requires_staff_approval: rule.requires_staff_approval ?? false,
                        duration_modifier_minutes: durationMinutes,
                      }, { onConflict: "station_id,treatment_type_id" })
                  }
                }
              }

              toast({
                title: "הצלחה",
                description: "העמדה שוכפלה בהצלחה",
              })
            } else {
              // Copy to existing stations
              if (!params.targetStationIds || params.targetStationIds.length === 0) {
                throw new Error("At least one target station is required")
              }

              for (const targetId of params.targetStationIds) {
                if (params.copyDetails) {
                  // Update is_active (but NOT the name)
                  await supabase
                    .from("stations")
                    .update({ is_active: stationToDuplicate.isActive })
                    .eq("id", targetId)

                  // Copy working hours - delete existing and insert new ones
                  await supabase.from("station_working_hours").delete().eq("station_id", targetId)

                  const { data: originalWorkingHours } = await supabase
                    .from("station_working_hours")
                    .select("*")
                    .eq("station_id", sourceStationId)

                  if (originalWorkingHours && originalWorkingHours.length > 0) {
                    const shiftsToInsert = originalWorkingHours.map((shift) => ({
                      station_id: targetId,
                      weekday: shift.weekday,
                      open_time: shift.open_time,
                      close_time: shift.close_time,
                      shift_order: shift.shift_order || 0,
                    }))

                    await supabase.from("station_working_hours").insert(shiftsToInsert)
                  }
                }

                // Copy treatmentType relations if requested
                if (groomingServiceId && params.copyTreatmentTypeRelations) {
                  const { data: originalMatrixData } = await supabase
                    .from("service_station_matrix")
                    .select("base_time_minutes")
                    .eq("service_id", groomingServiceId)
                    .eq("station_id", sourceStationId)
                    .maybeSingle()

                  const originalBaseTime = originalMatrixData?.base_time_minutes || 0

                  await supabase
                    .from("service_station_matrix")
                    .upsert({
                      service_id: groomingServiceId,
                      station_id: targetId,
                      base_time_minutes: originalBaseTime,
                      price: 0,
                    }, { onConflict: "service_id,station_id" })

                  const { data: originalRules } = await supabase
                    .from("station_treatmentType_rules")
                    .select("*")
                    .eq("station_id", sourceStationId)

                  if (originalRules && originalRules.length > 0) {
                    for (const rule of originalRules) {
                      const { data: treatmentTypeModifier } = await supabase
                        .from("treatmentType_modifiers")
                        .select("time_modifier_minutes")
                        .eq("service_id", groomingServiceId)
                        .eq("treatment_type_id", rule.treatment_type_id)
                        .maybeSingle()

                      const defaultTime = treatmentTypeModifier?.time_modifier_minutes || 60
                      const durationMinutes = rule.duration_modifier_minutes || (originalBaseTime + defaultTime)

                      await supabase
                        .from("station_treatmentType_rules")
                        .upsert({
                          station_id: targetId,
                          treatment_type_id: rule.treatment_type_id,
                          is_active: rule.is_active ?? true,
                          remote_booking_allowed: rule.remote_booking_allowed ?? false,
                          requires_staff_approval: rule.requires_staff_approval ?? false,
                          duration_modifier_minutes: durationMinutes,
                        }, { onConflict: "station_id,treatment_type_id" })
                    }
                  }
                }
              }

              toast({
                title: "הצלחה",
                description: `הנתונים הועתקו ל-${params.targetStationIds.length} עמדות בהצלחה`,
              })
            }

            // Refresh schedule data
            await refetch()
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Station"]))
            // Refetch station working hours to update gray slots immediately
            await fetchStationWorkingHours()

            setIsDuplicateStationDialogOpen(false)
            setStationToDuplicate(null)
          } catch (error) {
            console.error("Error duplicating station:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשכפל את העמדה"
            toast({
              title: "שגיאה",
              description: errorMessage,
              variant: "destructive",
            })
          } finally {
            setIsDuplicatingStation(false)
          }
        }}
        isDuplicating={isDuplicatingStation}
      />

      <StationConstraintsModal
        open={isStationConstraintsModalOpen}
        context={stationConstraintsContext}
        onOpenChange={(open) => {
          setIsStationConstraintsModalOpen(open)
          if (!open) {
            setStationConstraintsContext(null)
          }
        }}
      />
    </div>
  )
}

export default ManagerSchedule
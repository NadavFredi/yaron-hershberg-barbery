import type { PointerEvent as ReactPointerEvent } from "react"
import { format } from "date-fns"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"

// Store popover open state outside component to persist across unmounts
const popoverOpenStateMap = new Map<string, boolean>()
const popoverOpeningWindowMap = new Map<string, boolean>()
import {
  AlertTriangle,
  Bone,
  CalendarCog,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  DollarSign,
  Droplets,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Receipt,
  Scissors,
  Star,
  Trash2,
  Wand2,
  XCircle,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, extractGroomingAppointmentId } from "@/lib/utils"
import type { ManagerAppointment } from "../../types"
import { useAppointmentCard } from "./appointmentCard.module"
import { useSearchParams } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { OrderDetailsModal } from "@/components/dialogs/manager-schedule/PaymentModal/OrderDetailsModal"
import { useGetSeriesAppointmentsQuery, supabaseApi } from "@/store/services/supabaseApi"
import { AppointmentActionsMenu } from "./AppointmentActionsMenu"
import { useToast } from "@/hooks/use-toast"
import { useAppDispatch } from "@/store/hooks"
import { MANYCHAT_FLOW_IDS } from "@/lib/manychat"
import { setShowDogReadyModal, setDogReadyModalAppointment } from "@/store/slices/managerScheduleSlice"
import { SelectReminderDialog } from "@/components/dialogs/reminders/SelectReminderDialog"

interface AppointmentCardProps {
  appointment: ManagerAppointment
  isDragging?: boolean
  onResizeStart?: (event: ReactPointerEvent<HTMLButtonElement>, appointment: ManagerAppointment) => void
  overlapCount?: number
}

/**
 * Standalone appointment card component that reads all data from Redux
 */
export function AppointmentCard({ appointment, isDragging = false, onResizeStart, overlapCount = 0 }: AppointmentCardProps) {
  const dispatch = useAppDispatch()
  // Initialize from persisted state if exists
  const [isPopoverOpen, setIsPopoverOpen] = useState(() => {
    return popoverOpenStateMap.get(appointment.id) ?? false
  })
  const [isPaymentHovering, setIsPaymentHovering] = useState(false)
  const [hasOrder, setHasOrder] = useState(false)
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false)
  const [isCheckmarkMenuOpen, setIsCheckmarkMenuOpen] = useState(false)
  const [hasReminderSent, setHasReminderSent] = useState(false)
  const [isProcessingAction, setIsProcessingAction] = useState(false)
  const [isSelectReminderDialogOpen, setIsSelectReminderDialogOpen] = useState(false)
  // Use client_approved_arrival (timestamp) to determine if client approved arrival
  // This is separate from client_confirmed_arrival (boolean) which is for client self-confirmation
  const [localClientApprovedArrival, setLocalClientApprovedArrival] = useState<string | null | undefined>(appointment.clientApprovedArrival)
  const cardRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Sync local state with appointment prop when it changes
  useEffect(() => {
    console.log('[AppointmentCard] clientApprovedArrival changed:', {
      appointmentId: appointment.id,
      clientApprovedArrival: appointment.clientApprovedArrival,
      type: typeof appointment.clientApprovedArrival,
      isTruthy: !!appointment.clientApprovedArrival
    })
    setLocalClientApprovedArrival(appointment.clientApprovedArrival)
  }, [appointment.clientApprovedArrival, appointment.id])

  // Fetch series appointments to calculate weeks interval
  const { data: seriesData } = useGetSeriesAppointmentsQuery(
    { seriesId: appointment?.seriesId || '' },
    { skip: !appointment?.seriesId }
  )

  // Calculate weeks interval from series appointments
  const weeksInterval = useMemo(() => {
    if (!seriesData?.appointments || seriesData.appointments.length < 2) return null

    const sortedAppointments = [...seriesData.appointments].sort((a, b) =>
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    )

    // Calculate interval between first two appointments
    const firstDate = new Date(sortedAppointments[0].startDateTime)
    const secondDate = new Date(sortedAppointments[1].startDateTime)
    const diffMs = secondDate.getTime() - firstDate.getTime()
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))

    return diffWeeks > 0 ? diffWeeks : null
  }, [seriesData])

  // Sync state to external map whenever it changes
  useEffect(() => {
    popoverOpenStateMap.set(appointment.id, isPopoverOpen)
  }, [isPopoverOpen, appointment.id])

  // Restore state on mount if it was persisted
  useEffect(() => {
    const persistedState = popoverOpenStateMap.get(appointment.id)
    if (persistedState !== undefined && persistedState !== isPopoverOpen) {
      setIsPopoverOpen(persistedState)
    }
  }, []) // Only on mount - empty deps

  // Check for orders when appointment is available
  useEffect(() => {
    const checkForOrder = async () => {
      if (!appointment) {
        setHasOrder(false)
        return
      }

      // Extract the actual appointment ID based on service type
      let appointmentId: string | undefined
      // All appointments are grooming appointments
      appointmentId = extractGroomingAppointmentId(
        appointment.id,
        appointment.groomingAppointmentId
      )

      // Fallback: try to use the ID directly if it looks like a UUID
      if (!appointmentId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (uuidRegex.test(appointment.id)) {
          appointmentId = appointment.id
        } else {
          appointmentId = appointment.groomingAppointmentId
        }
      }

      if (!appointmentId) {
        setHasOrder(false)
        return
      }

      try {
        const appointmentIdField = "grooming_appointment_id"

        // Check for orders directly linked to appointment
        const idsToCheck = [appointmentId]
        if (appointment.id && appointment.id !== appointmentId) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (uuidRegex.test(appointment.id)) {
            idsToCheck.push(appointment.id)
          }
        }

        const { data: directOrders, error: directError } = await supabase
          .from("orders")
          .select("id")
          .in(appointmentIdField, idsToCheck)
          .limit(1)

        if (directError) throw directError

        if (directOrders && directOrders.length > 0) {
          setHasOrder(true)
          return
        }

        // If no direct orders, check via cart_appointments
        const { data: cartAppointments, error: cartError } = await supabase
          .from("cart_appointments")
          .select("cart_id")
          .in(appointmentIdField, idsToCheck)
          .limit(10)

        if (cartError) throw cartError

        if (cartAppointments && cartAppointments.length > 0) {
          const cartIds = cartAppointments.map(ca => ca.cart_id).filter(Boolean)
          if (cartIds.length > 0) {
            const { data: ordersByCart, error: ordersError } = await supabase
              .from("orders")
              .select("id")
              .in("cart_id", cartIds)
              .limit(1)

            if (ordersError) throw ordersError
            setHasOrder(ordersByCart && ordersByCart.length > 0)
            return
          }
        }

        setHasOrder(false)
      } catch (error) {
        console.error("[AppointmentCard] Error checking for order:", error)
        setHasOrder(false)
      }
    }

    checkForOrder()
  }, [appointment])

  // Check if reminder was sent for this appointment
  useEffect(() => {
    const checkReminderSent = async () => {
      if (!appointment) return

      // Proposed meetings don't have reminders (they're not real appointments yet)
      if (appointment.isProposedMeeting) {
        setHasReminderSent(false)
        return
      }

      const appointmentId = extractGroomingAppointmentId(
        appointment.id,
        appointment.groomingAppointmentId
      )
      const appointmentType = "grooming"

      if (!appointmentId) {
        setHasReminderSent(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from("appointment_reminder_sent")
          .select("id")
          .eq("appointment_id", appointmentId)
          .eq("appointment_type", appointmentType)
          .limit(1)

        if (error) throw error
        setHasReminderSent((data?.length ?? 0) > 0)
      } catch (error) {
        console.error("[AppointmentCard] Error checking reminder:", error)
        setHasReminderSent(false)
      }
    }

    checkReminderSent()
  }, [appointment])

  const highlightAppointmentId = searchParams.get("highlightAppointment")
  const isHighlighted = highlightAppointmentId === appointment.id
  const hookResult = useAppointmentCard({ appointment, isDragging })

  // Remove highlighting on hover
  const handleMouseEnter = () => {
    if (isHighlighted) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete("highlightAppointment")
      setSearchParams(newParams, { replace: true })
    }
  }

  // Get highlight color based on appointment type to match card style
  const getHighlightColor = () => {
    if (appointment.isProposedMeeting) {
      return {
        ring: "ring-lime-400",
        border: "border-lime-500",
        shadow: "rgba(132, 204, 22, 0.5)", // lime-500 with opacity
      }
    }
    if (appointment.isPersonalAppointment || appointment.appointmentType === "private") {
      return {
        ring: "ring-purple-400",
        border: "border-purple-500",
        shadow: "rgba(168, 85, 247, 0.5)", // purple-500 with opacity
      }
    }
    // Grooming appointments use blue
    return {
      ring: "ring-blue-400",
      border: "border-blue-500",
      shadow: "rgba(59, 130, 246, 0.5)", // blue-500 with opacity
    }
  }

  const highlightColors = getHighlightColor()

  // Remove title attributes when popover is open to prevent hover tooltips
  useEffect(() => {
    if (!cardRef.current) return

    if (isPopoverOpen) {
      // Store original titles and remove them immediately
      const allElements = cardRef.current.querySelectorAll('[title]')
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        const title = htmlEl.getAttribute('title')
        if (title && !htmlEl.hasAttribute('data-original-title')) {
          htmlEl.setAttribute('data-original-title', title)
          htmlEl.removeAttribute('title')
        }
      })
    } else {
      // Restore original titles
      const elementsWithStoredTitle = cardRef.current.querySelectorAll('[data-original-title]')
      elementsWithStoredTitle.forEach((el) => {
        const htmlEl = el as HTMLElement
        const originalTitle = htmlEl.getAttribute('data-original-title')
        if (originalTitle) {
          htmlEl.setAttribute('title', originalTitle)
          htmlEl.removeAttribute('data-original-title')
        }
      })
    }
  }, [isPopoverOpen])

  // Also handle when popover opens/closes to immediately remove titles
  useEffect(() => {
    if (!cardRef.current) return

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(() => {
      if (isPopoverOpen && cardRef.current) {
        cardRef.current.querySelectorAll('[title]').forEach((el) => {
          const htmlEl = el as HTMLElement
          const title = htmlEl.getAttribute('title')
          if (title && !htmlEl.hasAttribute('data-original-title')) {
            htmlEl.setAttribute('data-original-title', title)
            htmlEl.removeAttribute('title')
          }
        })
      }
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [isPopoverOpen])

  // Broadcast popover open/close so columns can temporarily disable hover/ghost previews
  useEffect(() => {
    const eventName = "manager-schedule:appointment-menu-toggle"
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { appointmentId: appointment.id, isOpen: isPopoverOpen },
      })
    )

    return () => {
      // Ensure we always signal closed on unmount
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { appointmentId: appointment.id, isOpen: false },
        })
      )
    }
  }, [appointment.id, isPopoverOpen])

  if (!hookResult) {
    return null
  }

  const {
    startDate,
    endDate,
    isResizing,
    isExpanded,
    originalHeight,
    isSmallCard,
    height,
    primaryDog,
    dogName,
    breedName,
    crossServiceIndicator,
    classification,
    isProposedMeeting,
    cardStyle,
    statusStyle,
    subscriptionName,
    notes,
    internalNotes,
    timeRangeLabel,
    clientName,
    highlightedSlots,
    draggedAppointment,
    pinnedAppointmentsHook,
    isFirstAppointment,
    isApproved,
    isWaitingForApproval,
    hasPaidOrder,
    paidSum,
    handleAppointmentClick,
    handleDogClick,
    handleClientClick,
    handleOpenClientCommunication,
    handleCancelAppointment,
    handleOpenProposedMeetingEditor,
    handleDeleteProposedMeeting,
    handleDeleteAppointment,
    handleDuplicateAppointment,
    handlePaymentClick,
    handleOpenRescheduleProposal,
    openGroomingEditModal,
    openPersonalAppointmentEditModal,
    handleExpandCard,
    handleCollapseCard,
    handleApproveAppointment,
    handleDeclineAppointment,
    handleApproveWithChange,
  } = hookResult

  const [isApprovalMenuOpen, setIsApprovalMenuOpen] = useState(false)
  const { toast } = useToast()

  // Handlers for checkmark actions
  const handleSendReminder = useCallback(() => {
    // Open the reminder selection dialog instead of sending directly
    setIsSelectReminderDialogOpen(true)
    setIsCheckmarkMenuOpen(false)
  }, [])

  const handleSendDefaultReminder = useCallback(async () => {
    if (isProcessingAction) return

    setIsProcessingAction(true)
    try {
      if (!appointment.clientPhone || !appointment.clientName || !appointment.clientId) {
        throw new Error("חסרים פרטי לקוח")
      }

      // Fetch the default reminder
      const { data: defaultReminder, error: fetchError } = await supabase
        .from("appointment_reminders")
        .select("id, flow_id, description")
        .eq("is_manual", true)
        .eq("is_active", true)
        .eq("is_default", true)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (!defaultReminder || !defaultReminder.flow_id) {
        throw new Error("לא נמצאה תזכורת ברירת מחדל. אנא הגדר תזכורת ברירת מחדל בהגדרות.")
      }

      // Extract appointment ID based on service type
      let appointmentId: string
      if (appointment.serviceType === "grooming") {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      } else {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      }

      const appointmentType = "grooming"

      const { data, error } = await supabase.functions.invoke("send-appointment-reminder", {
        body: {
          users: [
            {
              phone: appointment.clientPhone,
              name: appointment.clientName,
              fields: {},
            },
          ],
          flow_id: defaultReminder.flow_id,
          appointment_id: appointmentId,
          appointment_type: appointmentType,
          customer_id: appointment.clientId,
        },
      })

      if (error) throw error

      // Check if the result is successful
      const phoneDigits = appointment.clientPhone.replace(/\D/g, "")
      const result = data?.[phoneDigits]

      if (result?.success) {
        toast({
          title: "הצלחה",
          description: `התזכורת "${defaultReminder.description || 'ברירת מחדל'}" נשלחה בהצלחה`,
        })
        setHasReminderSent(true)
        setIsCheckmarkMenuOpen(false)
      } else {
        throw new Error(result?.error || "Failed to send reminder")
      }
    } catch (error) {
      console.error("Error sending default reminder:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן לשלוח תזכורת",
        variant: "destructive",
      })
    } finally {
      setIsProcessingAction(false)
    }
  }, [appointment, toast, isProcessingAction])

  const handleReminderSelected = useCallback(async (reminder: { id: string; flow_id: string; description: string | null }) => {
    if (isProcessingAction) return

    setIsProcessingAction(true)
    try {
      if (!appointment.clientPhone || !appointment.clientName || !appointment.clientId) {
        throw new Error("חסרים פרטי לקוח")
      }

      if (!reminder.flow_id) {
        throw new Error("מזהה זרימה לא תקין")
      }

      // Extract appointment ID based on service type
      let appointmentId: string
      if (appointment.serviceType === "grooming") {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      } else {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      }

      const appointmentType = "grooming"

      const { data, error } = await supabase.functions.invoke("send-appointment-reminder", {
        body: {
          users: [
            {
              phone: appointment.clientPhone,
              name: appointment.clientName,
              fields: {},
            },
          ],
          flow_id: reminder.flow_id,
          appointment_id: appointmentId,
          appointment_type: appointmentType,
          customer_id: appointment.clientId,
        },
      })

      if (error) throw error

      // Check if the result is successful
      const phoneDigits = appointment.clientPhone.replace(/\D/g, "")
      const result = data?.[phoneDigits]

      if (result?.success) {
        toast({
          title: "הצלחה",
          description: `התזכורת "${reminder.description || 'ללא תיאור'}" נשלחה בהצלחה`,
        })
        setHasReminderSent(true)
      } else {
        throw new Error(result?.error || "Failed to send reminder")
      }
    } catch (error) {
      console.error("Error sending reminder:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן לשלוח תזכורת",
        variant: "destructive",
      })
    } finally {
      setIsProcessingAction(false)
    }
  }, [appointment, toast, isProcessingAction])

  const handleCustomerApprovedArrival = useCallback(async () => {
    if (isProcessingAction) return

    setIsProcessingAction(true)
    try {
      let appointmentId: string
      const tableName = "grooming_appointments"

      if (appointment.serviceType === "grooming") {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      } else {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      }

      const approvedTime = new Date().toISOString()

      // Optimistic update - update local state immediately
      setLocalClientApprovedArrival(approvedTime)

      const { error } = await supabase
        .from(tableName)
        .update({
          client_approved_arrival: approvedTime,
          client_confirmed_arrival: true
        })
        .eq("id", appointmentId)

      if (error) {
        // Revert optimistic update on error
        setLocalClientApprovedArrival(appointment.clientApprovedArrival)
        throw error
      }

      toast({
        title: "הצלחה",
        description: "אושרה הגעת הלקוח",
      })
      setIsCheckmarkMenuOpen(false)
      // Refresh schedule
      dispatch(
        supabaseApi.util.invalidateTags([
          { type: 'ManagerSchedule', id: 'LIST' },
          'Appointment',
        ])
      )
    } catch (error) {
      console.error("Error updating arrival:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן לעדכן",
        variant: "destructive",
      })
    } finally {
      setIsProcessingAction(false)
    }
  }, [appointment, toast, isProcessingAction, dispatch])

  const handleCustomerNotApprovedArrival = useCallback(async () => {
    if (isProcessingAction) return

    setIsProcessingAction(true)
    try {
      let appointmentId: string
      const tableName = "grooming_appointments"

      if (appointment.serviceType === "grooming") {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      } else {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      }

      // Optimistic update - update local state immediately
      setLocalClientApprovedArrival(null)

      const { error } = await supabase
        .from(tableName)
        .update({
          client_approved_arrival: null,
          client_confirmed_arrival: false
        })
        .eq("id", appointmentId)

      if (error) {
        // Revert optimistic update on error
        setLocalClientApprovedArrival(appointment.clientApprovedArrival)
        throw error
      }

      toast({
        title: "הצלחה",
        description: "הוסר אישור הגעת הלקוח",
      })
      setIsCheckmarkMenuOpen(false)
      // Refresh schedule
      dispatch(
        supabaseApi.util.invalidateTags([
          { type: 'ManagerSchedule', id: 'LIST' },
          'Appointment',
        ])
      )
    } catch (error) {
      console.error("Error removing arrival approval:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן לעדכן",
        variant: "destructive",
      })
    } finally {
      setIsProcessingAction(false)
    }
  }, [appointment, toast, isProcessingAction, dispatch])

  const handleSendCompletionMessage = useCallback(() => {
    if (isProcessingAction) return

    // Open the dog ready modal instead of sending directly
    dispatch(setDogReadyModalAppointment(appointment))
    dispatch(setShowDogReadyModal(true))
    setIsCheckmarkMenuOpen(false)
  }, [appointment, dispatch, isProcessingAction])

  const handleTreatmentStarted = useCallback(async () => {
    if (isProcessingAction) return

    setIsProcessingAction(true)
    try {
      let appointmentId: string
      const tableName = "grooming_appointments"

      if (appointment.serviceType === "grooming") {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      } else {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      }

      // Use appointment start_at as default
      const { error } = await supabase
        .from(tableName)
        .update({ treatment_started_at: appointment.startDateTime })
        .eq("id", appointmentId)

      if (error) throw error

      toast({
        title: "הצלחה",
        description: "הטיפול התחיל",
      })
      setIsCheckmarkMenuOpen(false)
      // Refresh schedule
      dispatch(
        supabaseApi.util.invalidateTags([
          { type: 'ManagerSchedule', id: 'LIST' },
          'Appointment',
        ])
      )
    } catch (error) {
      console.error("Error updating treatment start:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן לעדכן",
        variant: "destructive",
      })
    } finally {
      setIsProcessingAction(false)
    }
  }, [appointment, toast, isProcessingAction, dispatch])

  const handleTreatmentEnded = useCallback(async () => {
    if (isProcessingAction) return

    setIsProcessingAction(true)
    try {
      let appointmentId: string
      const tableName = "grooming_appointments"

      if (appointment.serviceType === "grooming") {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      } else {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      }

      // Check if treatment_started_at exists, if not use appointment start_at
      const { data: currentAppointment, error: fetchError } = await supabase
        .from(tableName)
        .select("treatment_started_at")
        .eq("id", appointmentId)
        .single()

      if (fetchError) throw fetchError

      const updates: Record<string, string> = {
        treatment_ended_at: new Date().toISOString(),
      }

      // If treatment_started_at is not set, use appointment start_at as default
      if (!currentAppointment?.treatment_started_at) {
        updates.treatment_started_at = appointment.startDateTime
      }

      const { error } = await supabase
        .from(tableName)
        .update(updates)
        .eq("id", appointmentId)

      if (error) throw error

      toast({
        title: "הצלחה",
        description: "הטיפול הסתיים",
      })
      setIsCheckmarkMenuOpen(false)
      // Refresh schedule
      dispatch(
        supabaseApi.util.invalidateTags([
          { type: 'ManagerSchedule', id: 'LIST' },
          'Appointment',
        ])
      )
    } catch (error) {
      console.error("Error updating treatment end:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן לעדכן",
        variant: "destructive",
      })
    } finally {
      setIsProcessingAction(false)
    }
  }, [appointment, toast, isProcessingAction, dispatch])

  const hasOverlaps = overlapCount > 0

  // Scroll into view when highlighted
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      // Small delay to ensure the calendar is rendered
      const timeoutId = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [isHighlighted])

  return (
    <div
      ref={cardRef}
      key={appointment.id}
      onMouseEnter={handleMouseEnter}
      onClick={(e) => {
        // Don't open sheet if clicking on resize handle or if currently resizing
        if (isResizing) {
          return
        }
        // Don't open sheet if popover is open
        if (isPopoverOpen) {
          return
        }
        const target = e.target as HTMLElement
        if (target.closest('[data-dnd-kit-no-drag]')) {
          return
        }
        handleAppointmentClick()
      }}
      className={cn(
        "w-full flex flex-col rounded-lg border px-3 py-2 text-right shadow-sm transition relative",
        !isPopoverOpen && "hover:-translate-y-[1px] hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        cardStyle,
        "cursor-pointer",
        isResizing && "ring-2 ring-blue-400/70 shadow-md",
        // Visual indicator for overlapping appointments - red dashed border only
        hasOverlaps && !isHighlighted && "border-red-400 border-2 border-dashed",
        // Extreme highlighting for highlighted appointment - use colors matching card style
        isHighlighted && `ring-4 ${highlightColors.ring} ${highlightColors.border} border-4 shadow-2xl z-50 animate-pulse`,
        // When popover is open, prevent hover tooltips by disabling pointer events on non-interactive elements
        isPopoverOpen && "[&_*[title]:not([role='button']):not(button):not(a)]:pointer-events-none",
        // Waiting for approval styling - half transparent with amber/yellow tint
        isWaitingForApproval && "opacity-60 border-amber-400 border-2 bg-amber-50/50 backdrop-blur-sm"
      )}
      style={{
        height,
        ...(isHighlighted && {
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          boxShadow: `0 0 0 4px ${highlightColors.shadow}, 0 25px 50px -12px rgba(0, 0, 0, 0.5)`
        })
      }}
    >
      <div className={cn(
        "flex flex-col",
        !isExpanded && "overflow-hidden"
      )}>
        <div className="flex items-center justify-between gap-2 text-xs">
          {(
            <span className={cn(
              "text-gray-600",
              isDragging && highlightedSlots && draggedAppointment.appointment && draggedAppointment.appointment.id === appointment.id && "font-medium",
              isResizing && "font-medium text-blue-700"
            )}>
              {timeRangeLabel}
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
              <>
                {(
                  <Popover open={isCheckmarkMenuOpen} onOpenChange={setIsCheckmarkMenuOpen} modal={false}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        data-dnd-kit-no-drag
                        className={cn(
                          "flex items-center justify-center w-5 h-5 rounded-full transition-colors cursor-pointer",
                          localClientApprovedArrival
                            ? "bg-green-100 text-green-600 hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                        title={localClientApprovedArrival && localClientApprovedArrival !== null && localClientApprovedArrival !== undefined && localClientApprovedArrival !== '' ? "לקוח אישר הגעה" : "לקוח לא אישר הגעה"}
                        data-testid={`checkmark-${appointment.id}`}
                        data-approved={(localClientApprovedArrival && localClientApprovedArrival !== null && localClientApprovedArrival !== undefined && localClientApprovedArrival !== '') ? "true" : "false"}
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                      >
                        <CheckCircle className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-56 p-1 z-[100]"
                      align="end"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      onInteractOutside={(e) => {
                        setIsCheckmarkMenuOpen(false)
                      }}
                    >
                      <div className="space-y-1">
                        {localClientApprovedArrival && localClientApprovedArrival !== null && localClientApprovedArrival !== undefined && localClientApprovedArrival !== '' ? (
                          // Green checkmark menu - customer approved arrival
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSendCompletionMessage()
                              }}
                              disabled={isProcessingAction}
                            >
                              <MessageSquare className="h-4 w-4 ml-2" />
                              שלח הודעת סיום
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTreatmentStarted()
                              }}
                              disabled={isProcessingAction}
                            >
                              <Clock className="h-4 w-4 ml-2" />
                              לקוח התחיל טיפול
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTreatmentEnded()
                              }}
                              disabled={isProcessingAction}
                            >
                              <CheckCircle className="h-4 w-4 ml-2" />
                              לקוח סיים טיפול
                            </Button>
                            <div className="border-t my-1" />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCustomerNotApprovedArrival()
                              }}
                              disabled={isProcessingAction}
                            >
                              <XCircle className="h-4 w-4 ml-2" />
                              לקוח לא אישר הגעה
                            </Button>
                          </>
                        ) : (
                          // Gray checkmark menu - no reminder sent
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCustomerApprovedArrival()
                              }}
                              disabled={isProcessingAction}
                            >
                              <CheckCircle className="h-4 w-4 ml-2" />
                              לקוח אישר הגעה
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSendDefaultReminder()
                              }}
                              disabled={isProcessingAction}
                            >
                              <Star className="h-4 w-4 ml-2 fill-current" />
                              שלח תזכורת ברירת מחדל
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSendReminder()
                              }}
                              disabled={isProcessingAction}
                            >
                              <MessageSquare className="h-4 w-4 ml-2" />
                              שלח תזכורת
                            </Button>
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {isWaitingForApproval && (
                  <Popover open={isApprovalMenuOpen} onOpenChange={setIsApprovalMenuOpen} modal={false}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        data-dnd-kit-no-drag
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsApprovalMenuOpen(true)
                        }}
                        className="cursor-pointer"
                      >
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                          title="ממתין לאישור - לחץ לפעולות"
                        >
                          ממתין לאישור
                        </Badge>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-48 p-1 z-[100]"
                      align="end"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      onInteractOutside={(e) => {
                        setIsApprovalMenuOpen(false)
                      }}
                    >
                      <div className="space-y-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleApproveAppointment()
                            setIsApprovalMenuOpen(false)
                          }}
                        >
                          <CheckCircle className="h-4 w-4 ml-2" />
                          אישור
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeclineAppointment()
                            setIsApprovalMenuOpen(false)
                          }}
                        >
                          <X className="h-4 w-4 ml-2" />
                          דחייה
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleApproveWithChange()
                            setIsApprovalMenuOpen(false)
                          }}
                        >
                          <Pencil className="h-4 w-4 ml-2" />
                          אישור עם שינויים
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </>
            )}
            {notes && (
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-600" title="יש הערות לקוח">
                <MessageSquare className="h-3 w-3" />
              </div>
            )}
            {!isProposedMeeting && appointment.hasCrossServiceAppointment && (
              <div
                className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-600"
                title="יש גם תור לגן"
              >
                <Bone className="h-3 w-3" />
              </div>
            )}
            {!isProposedMeeting && (
              <Popover open={hasPaidOrder && paidSum > 0 && isPaymentHovering} modal={false}>
                <PopoverTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-center w-5 h-5 rounded-full cursor-pointer transition-all",
                      hasPaidOrder
                        ? "bg-green-100 text-green-600 hover:bg-green-200"
                        : "bg-red-100 text-red-600"
                    )}
                    title={hasPaidOrder ? "שולם" : "לא שולם"}
                    onMouseEnter={() => setIsPaymentHovering(true)}
                    onMouseLeave={() => setIsPaymentHovering(false)}
                  >
                    <DollarSign className="h-3 w-3" />
                  </div>
                </PopoverTrigger>
                {hasPaidOrder && paidSum > 0 && (
                  <PopoverContent
                    className="w-auto p-2 text-sm text-right"
                    side="top"
                    align="end"
                    onMouseEnter={() => setIsPaymentHovering(true)}
                    onMouseLeave={() => setIsPaymentHovering(false)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-semibold text-green-700">
                      סכום ששולם: ₪{paidSum.toFixed(2)}
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            )}
            {(isSmallCard || isExpanded) && (
              <div
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full cursor-pointer transition-colors border-2 shadow-sm",
                  isExpanded
                    ? "bg-purple-200 text-purple-700 hover:bg-purple-300 border-purple-300"
                    : "bg-purple-100 text-purple-600 hover:bg-purple-200 border-purple-200"
                )}
                title={isExpanded ? "כווץ" : "הרחב"}
                onClick={isExpanded ? handleCollapseCard : handleExpandCard}
              >
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </div>
            )}
            <Popover
              open={isPopoverOpen}
              onOpenChange={(open) => {
                const isOpeningWindow = popoverOpeningWindowMap.get(appointment.id) ?? false

                // Handle opens and closes
                if (open) {
                  // Opening - set flag and state
                  popoverOpeningWindowMap.set(appointment.id, true)
                  popoverOpenStateMap.set(appointment.id, true)
                  setIsPopoverOpen(true)
                  // Clear flag after delay
                  setTimeout(() => {
                    popoverOpeningWindowMap.set(appointment.id, false)
                  }, 600)
                } else {
                  // Closing - check if we're in opening window
                  if (isOpeningWindow) {
                    // Force open to prevent close during opening window
                    setTimeout(() => {
                      setIsPopoverOpen(true)
                      popoverOpenStateMap.set(appointment.id, true)
                    }, 0)
                    return
                  }
                  popoverOpenStateMap.set(appointment.id, false)
                  setIsPopoverOpen(false)
                }
              }}
              modal={false}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  data-dnd-kit-no-drag
                  className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors relative z-10"
                  title="פעולות נוספות"
                  onMouseDown={(e) => {
                    // Prevent drag listeners from capturing this event
                    e.stopPropagation()
                  }}
                  onPointerDown={(e) => {
                    // Prevent drag sensors from hijacking the click
                    e.stopPropagation()
                    // Set opening window IMMEDIATELY on pointerDown to protect against any early closes
                    if (!isPopoverOpen) {
                      popoverOpeningWindowMap.set(appointment.id, true)
                    }
                  }}
                  onClick={(e) => {
                    // Stop propagation to prevent card click handler from firing
                    e.stopPropagation()
                  }}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-48 p-1 z-[100]"
                align="end"
                onClick={(e) => {
                  // Prevent clicks inside popover from bubbling to card click handler
                  e.stopPropagation()
                }}
                onInteractOutside={(e) => {
                  const target = e.target as HTMLElement
                  const isOpeningWindow = popoverOpeningWindowMap.get(appointment.id) ?? false

                  // Prevent closing during the opening window
                  if (isOpeningWindow) {
                    e.preventDefault()
                    return
                  }

                  // Check if clicking on the card itself
                  if (cardRef.current && cardRef.current.contains(target)) {
                    // Check if it's the trigger button itself (should toggle)
                    const triggerButton = cardRef.current.querySelector('button[data-dnd-kit-no-drag]')
                    const isTriggerButton = triggerButton && (triggerButton === target || triggerButton.contains(target))

                    if (isTriggerButton) {
                      // Allow the close - PopoverTrigger will handle the toggle
                      return
                    } else {
                      // Clicking on card (but not trigger) - prevent close
                      e.preventDefault()
                      return
                    }
                  }

                  // Clicking truly outside - manually close since modal={false}
                  setIsPopoverOpen(false)
                  popoverOpenStateMap.set(appointment.id, false)
                }}
                onPointerEnter={(e) => {
                  // Immediately remove all title attributes when mouse enters popover area
                  e.stopPropagation()
                  if (cardRef.current) {
                    cardRef.current.querySelectorAll('[title]').forEach((el) => {
                      const htmlEl = el as HTMLElement
                      if (!htmlEl.hasAttribute('data-original-title')) {
                        const title = htmlEl.getAttribute('title')
                        if (title) {
                          htmlEl.setAttribute('data-original-title', title)
                          htmlEl.removeAttribute('title')
                        }
                      }
                    })
                  }
                }}
              >
                <AppointmentActionsMenu
                  appointment={appointment}
                  isProposedMeeting={isProposedMeeting}
                  clientName={clientName}
                  primaryDog={primaryDog}
                  hasOrder={hasOrder}
                  pinnedAppointmentsHook={pinnedAppointmentsHook}
                  onEdit={() => {
                    if (appointment.isPersonalAppointment || appointment.appointmentType === "private") {
                      openPersonalAppointmentEditModal()
                    } else {
                      openGroomingEditModal()
                    }
                  }}
                  onDuplicate={handleDuplicateAppointment}
                  onCancel={handleCancelAppointment}
                  onDelete={handleDeleteAppointment}
                  onOpenClientCommunication={handleOpenClientCommunication}
                  onRescheduleProposal={handleOpenRescheduleProposal}
                  onPayment={handlePaymentClick}
                  onShowOrder={() => setIsOrderDetailsModalOpen(true)}
                  onEditProposedMeeting={handleOpenProposedMeetingEditor}
                  onDeleteProposedMeeting={handleDeleteProposedMeeting}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="mt-1 flex flex-col gap-1">
          {isProposedMeeting ? (
            <div className="space-y-2 text-sm">
              <div className="text-sm text-lime-800">
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
            <div className="text-sm font-medium text-purple-700">
              {appointment.personalAppointmentDescription}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (primaryDog) {
                      handleDogClick(primaryDog)
                    }
                  }}
                  className="text-sm text-purple-600 hover:text-purple-800 hover:underline cursor-pointer"
                  disabled={!primaryDog}
                >
                  {dogName}
                </button>
                {breedName && (
                  <Badge variant="outline" className="text-[10px] font-medium border-slate-200 bg-white/80 text-gray-700">
                    {breedName}
                  </Badge>
                )}
                {crossServiceIndicator && (
                  <Badge variant="outline" className="text-[10px] font-medium border-slate-200 bg-white/80 text-gray-700">
                    {crossServiceIndicator}
                  </Badge>
                )}
              </div>
              {clientName && (
                <div className="text-xs text-gray-600">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClientClick({
                        name: clientName,
                        classification: appointment.clientClassification ?? primaryDog?.clientClassification,
                        phone: appointment.clientPhone,
                        email: appointment.clientEmail,
                        recordId: appointment.recordId,
                        recordNumber: appointment.recordNumber,
                        clientId: appointment.clientId,
                        id: appointment.clientId
                      })
                    }}
                    className={cn(
                      "font-medium hover:underline cursor-pointer",
                      isFirstAppointment
                        ? "text-green-600 hover:text-green-800"
                        : "text-blue-600 hover:text-blue-800"
                    )}
                  >
                    {clientName}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {subscriptionName && (
          <div className="mt-1 text-xs text-gray-600" title={subscriptionName}>
            כרטיסייה: <span className="font-medium text-gray-700">{subscriptionName}</span>
          </div>
        )}
        {appointment.seriesId && weeksInterval && (
          <div className="mt-1 text-xs text-gray-700 font-medium">
            מחזורי {weeksInterval}
          </div>
        )}
        {internalNotes && (
          <div className="mt-1 text-xs text-gray-500" title={internalNotes}>
            <span className="font-medium text-gray-600">הערות צוות:</span> {internalNotes}
          </div>
        )}
      </div>
      {appointment.serviceType === "grooming" && onResizeStart && (
        <button
          type="button"
          data-dnd-kit-no-drag
          onPointerDown={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onResizeStart(event, appointment)
          }}
          onMouseDown={(event) => {
            event.stopPropagation()
            event.preventDefault()
          }}
          onTouchStart={(event) => {
            event.stopPropagation()
            event.preventDefault()
          }}
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
      <OrderDetailsModal
        open={isOrderDetailsModalOpen}
        onOpenChange={setIsOrderDetailsModalOpen}
        appointmentId={extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)}
        serviceType="grooming"
      />
      <SelectReminderDialog
        open={isSelectReminderDialogOpen}
        onOpenChange={setIsSelectReminderDialogOpen}
        onSelect={handleReminderSelected}
      />
    </div>
  )
}

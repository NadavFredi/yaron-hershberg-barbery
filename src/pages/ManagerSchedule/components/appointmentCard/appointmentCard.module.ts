import type { MouseEvent as ReactMouseEvent } from "react"
import { useCallback, useMemo, useState, useEffect } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { supabase } from "@/integrations/supabase/client"
import {
  addExpandedAppointmentCard,
  removeExpandedAppointmentCard,
  setAppointmentToCancel,
  setAppointmentToDelete,
  setAppointmentToDuplicate,
  setCancelConfirmationOpen,
  setDeleteConfirmationOpen,
  setDuplicateSeriesOpen,
  setEditingGroomingAppointment,
  setEditingPersonalAppointment,
  setEditingProposedMeeting,
  setGroomingEditOpen,
  setPersonalAppointmentEditOpen,
  setIsClientDetailsOpen,
  setIsDetailsOpen,
  setIsDogDetailsOpen,
  setProposedMeetingMode,
  setProposedMeetingTimes,
  setProposedMeetingToDelete,
  setRescheduleTargetAppointment,
  setRescheduleTimes,
  setSelectedAppointment,
  setSelectedAppointmentForPayment,
  setPaymentCartId,
  setSelectedClient,
  setSelectedDog,
  setShowAllPastAppointments,
  setShowDeleteProposedDialog,
  setShowPaymentModal,
  setShowProposedMeetingModal,
  setShowRescheduleProposalModal,
  setCustomerCommunicationAppointment,
  setShowCustomerCommunicationModal,
  setApproveWithModifyDialogOpen,
  setAppointmentToApproveWithModify,
} from "@/store/slices/managerScheduleSlice"
import { addMinutes, differenceInMinutes, format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { usePinnedAppointments } from "@/pages/ManagerSchedule/pinnedAppointments/usePinnedAppointments"
import {
  supabaseApi,
  useGetManagerScheduleQuery,
  useGetClientAppointmentHistoryQuery,
  useGetAppointmentOrdersQuery,
} from "@/store/services/supabaseApi"
import { buildTimeline, getAppointmentDates, parseISODate, PIXELS_PER_MINUTE_SCALE } from "../../managerSchedule.module"
import type { ClientDetails, ManagerAppointment, ManagerDog } from "../../types.ts"
import { getStatusStyle, SERVICE_STYLES } from "../../constants"
import { extractGroomingAppointmentId } from "@/lib/utils"
import { cancelAppointment } from "@/pages/Appointments/Appointments.module"
import { approveAppointmentByManager } from "@/integrations/supabase/supabaseService"
import { SERVICE_CATEGORY_VARIANTS, type ServiceCategoryVariant } from "@/lib/serviceCategoryVariants"

interface UseAppointmentCardParams {
  appointment: ManagerAppointment
  isDragging?: boolean
}

/**
 * Hook that encapsulates all logic for the AppointmentCard component
 */
export function useAppointmentCard({ appointment, isDragging = false }: UseAppointmentCardParams) {
  const dispatch = useAppDispatch()
  const { toast } = useToast()

  // Redux state
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
  const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
  const intervalMinutes = useAppSelector((state) => state.managerSchedule.intervalMinutes)
  const pixelsPerMinuteScale = useAppSelector((state) => state.managerSchedule.pixelsPerMinuteScale)
  const _serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)
  const resizingPreview = useAppSelector((state) => state.managerSchedule.resizingPreview)
  const expandedAppointmentCards = useAppSelector((state) => state.managerSchedule.expandedAppointmentCards)
  const highlightedSlots = useAppSelector((state) => state.managerSchedule.highlightedSlots)
  const draggedAppointment = useAppSelector((state) => state.managerSchedule.draggedAppointment)

  // Data fetching
  const formattedDate = format(selectedDate, "yyyy-MM-dd")
  const { data } = useGetManagerScheduleQuery({
    date: formattedDate,
    serviceType: "both",
  })

  // Pinned appointments hook
  const pinnedAppointmentsHook = usePinnedAppointments({ scheduleData: data })

  // Compute timeline for drag preview
  const timeline = useMemo(() => {
    if (!data) return null
    return buildTimeline(selectedDate, data, intervalMinutes, pixelsPerMinuteScale, [], undefined)
  }, [selectedDate, data, intervalMinutes, pixelsPerMinuteScale])

  // Get appointment dates
  const dates = useMemo(() => getAppointmentDates(appointment), [appointment])
  if (!dates) {
    return null
  }

  const { start: startDate, end: endDate } = dates
  const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
  const previewEndDate =
    resizingPreview?.appointmentId === appointment.id && resizingPreview.endDate
      ? new Date(resizingPreview.endDate)
      : null
  const effectiveEndDate = previewEndDate ?? endDate
  const actualDurationMinutes = differenceInMinutes(endDate, startDate)
  const displayedDurationMinutes = Math.max(intervalMinutes, differenceInMinutes(effectiveEndDate, startDate))
  const isResizing = Boolean(previewEndDate)
  const isExpanded = expandedAppointmentCards.includes(appointment.id)

  const originalHeight = Math.max(1, displayedDurationMinutes * pixelsPerMinute)

  const isSmallCard = originalHeight < 100

  const height = isExpanded && isSmallCard ? Math.max(originalHeight, 150) : originalHeight

  const dogName = ""

  const hasOtherServiceAppointment = false
  const breedName = undefined
  const crossServiceIndicator = undefined
  const rawClassification = appointment.clientClassification ?? ""
  const classification = rawClassification.trim() ? rawClassification.trim() : undefined
  const serviceStyle = SERVICE_STYLES[appointment.serviceType]
  const isProposedMeeting = Boolean(appointment.isProposedMeeting)

  const getCardStyle = (appointment: ManagerAppointment): string => {
    if (appointment.isProposedMeeting) {
      return "bg-lime-50 border-lime-200"
    }
    if (appointment.isPersonalAppointment) {
      return "bg-primary/20 border-purple-300"
    }
    if (appointment.appointmentType === "private") {
      return "bg-primary/20 border-purple-300"
    }
    // For business appointments, use service category variant colors if available
    if (appointment.appointmentType === "business" && appointment.serviceCategoryVariant) {
      const variant = appointment.serviceCategoryVariant as ServiceCategoryVariant
      const variantConfig = SERVICE_CATEGORY_VARIANTS[variant]
      if (variantConfig) {
        return `${variantConfig.bgLight} ${variantConfig.border}`
      }
    }
    // Fallback to default service style
    return serviceStyle.card
  }

  const cardStyle = getCardStyle(appointment)
  const statusStyle = getStatusStyle(appointment.status, appointment)
  const subscriptionName = appointment.subscriptionName
  const notes = appointment.notes?.trim()
  const internalNotes = appointment.internalNotes?.trim()
  const originalTimeRangeLabel = `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`

  let timeRangeLabel = originalTimeRangeLabel
  if (
    isDragging &&
    highlightedSlots &&
    draggedAppointment.appointment &&
    draggedAppointment.appointment.id === appointment.id &&
    timeline
  ) {
    const targetStartTime = addMinutes(timeline.start, highlightedSlots.startTimeSlot * intervalMinutes)
    const targetEndTime = addMinutes(targetStartTime, actualDurationMinutes)
    const targetTimeRangeLabel = `${format(targetStartTime, "HH:mm")} - ${format(targetEndTime, "HH:mm")}`
    timeRangeLabel = `${originalTimeRangeLabel} ← ${targetTimeRangeLabel}`
  }
  if (previewEndDate) {
    const previewRangeLabel = `${format(startDate, "HH:mm")} - ${format(previewEndDate, "HH:mm")}`
    timeRangeLabel =
      previewRangeLabel === originalTimeRangeLabel
        ? previewRangeLabel
        : `${originalTimeRangeLabel} ← ${previewRangeLabel}`
  }

  const clientName = appointment.clientName
  const clientPhone = appointment.clientPhone

  // Check if this is the first appointment for this owner (not cancelled or deleted)
  const clientId = appointment.clientId
  const { data: clientAppointmentHistory } = useGetClientAppointmentHistoryQuery(
    { clientId: clientId ?? "" },
    { skip: !clientId }
  )

  const isFirstAppointment = useMemo(() => {
    if (!appointment.clientId) {
      return false
    }

    const allAppointments =
      clientAppointmentHistory?.appointments.map((apt) => ({
        id: apt.id,
        startAt: apt.startAt,
        status: apt.status,
      })) || []

    const validAppointments = allAppointments.filter((apt) => {
      const status = (apt.status || "").toLowerCase()
      return (
        !status.includes("cancel") &&
        !status.includes("בוטל") &&
        !status.includes("מבוטל") &&
        !status.includes("deleted")
      )
    })

    if (validAppointments.length === 0) {
      return false
    }

    validAppointments.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

    const firstAppointment = validAppointments[0]
    const thisAppointmentDate = new Date(appointment.startDateTime)
    const firstAppointmentDate = new Date(firstAppointment.startAt)

    return firstAppointment.id === appointment.id && thisAppointmentDate.getTime() === firstAppointmentDate.getTime()
  }, [appointment.clientId, appointment.startDateTime, appointment.id, clientAppointmentHistory])

  // Check if appointment is approved
  const isApproved = useMemo(() => {
    const status = appointment.status?.toLowerCase() || ""
    return (
      status.includes("approve") || status.includes("מאושר") || status.includes("confirm") || status.includes("מאשר")
    )
  }, [appointment.status])

  // Check if appointment is cancelled
  const isCancelled = useMemo(() => {
    const status = appointment.status?.toLowerCase() || ""
    return status.includes("cancel") || status.includes("בוטל") || status.includes("מבוטל")
  }, [appointment.status])

  // Check if appointment is waiting for manager approval (status is "pending")
  // Note: This is different from client approval, which is a separate mechanism
  const isWaitingForApproval = useMemo(() => {
    // Don't show waiting for approval for proposed meetings, they have their own styling
    if (appointment.isProposedMeeting) {
      return false
    }

    // Don't show if cancelled
    if (isCancelled) {
      return false
    }

    // Only show "waiting for approval" if status is "pending" (waiting for manager approval)
    // This means the appointment was created with status "pending" because it needs manager approval
    // based on the approval matrix/rules. Client cannot approve this - only managers can.
    const status = appointment.status?.toLowerCase() || ""
    return status === "pending" || status.includes("pending") || status.includes("ממתין")
  }, [appointment.status, appointment.isProposedMeeting, isCancelled])

  // Check if there's a paid cart/order related to this appointment
  // Skip orders query for proposed meetings (they don't have orders)
  // Extract actual UUID - proposed meetings won't have a valid grooming appointment ID
  const actualGroomingId = appointment.isProposedMeeting
    ? undefined
    : extractGroomingAppointmentId(appointment.id, (appointment as any).groomingAppointmentId)

  const { data: appointmentOrders } = useGetAppointmentOrdersQuery(
    {
      appointmentId: actualGroomingId || appointment.id,
      serviceType: "grooming",
    },
    { skip: !actualGroomingId || appointment.isProposedMeeting }
  )

  const hasPaidOrder = useMemo(() => {
    const orders = appointmentOrders?.orders || []
    return orders.some((order) => {
      const status = (order.status || "").toLowerCase()
      return status === "completed" || status === "paid" || status.includes("שולם") || status.includes("הושלם")
    })
  }, [appointmentOrders])

  const paidSum = useMemo(() => {
    const orders = appointmentOrders?.orders || []
    return orders
      .filter((order) => {
        const status = (order.status || "").toLowerCase()
        return status === "completed" || status === "paid" || status.includes("שולם") || status.includes("הושלם")
      })
      .reduce((sum, order) => sum + (order.total || 0), 0)
  }, [appointmentOrders])

  // Handlers
  const handleAppointmentClick = useCallback(() => {
    dispatch(setSelectedAppointment(appointment))
    dispatch(setIsDetailsOpen(true))
  }, [dispatch, appointment])

  const handleDogClick = useCallback(
    (dog: ManagerDog) => {
      dispatch(
        setSelectedDog({
          id: dog.id,
          name: dog.name,
          clientClassification: dog.clientClassification,
          owner: dog.clientName
            ? {
                name: dog.clientName,
                classification: dog.clientClassification,
              }
            : undefined,
          gender: dog.gender,
          notes: dog.notes,
          medicalNotes: dog.medicalNotes,
          importantNotes: dog.importantNotes,
          internalNotes: dog.internalNotes,
          vetName: dog.vetName,
          vetPhone: dog.vetPhone,
          healthIssues: dog.healthIssues,
          birthDate: dog.birthDate,
          tendsToBite: dog.tendsToBite,
          aggressiveWithOtherDogs: dog.aggressiveWithOtherDogs,
          hasBeenToGarden: dog.hasBeenToGarden,
          suitableForGardenFromQuestionnaire: dog.suitableForGardenFromQuestionnaire,
          notSuitableForGardenFromQuestionnaire: dog.notSuitableForGardenFromQuestionnaire,
          recordId: dog.recordId,
          recordNumber: dog.recordNumber,
        })
      )
      dispatch(setShowAllPastAppointments(false))
      dispatch(setIsClientDetailsOpen(false))
      dispatch(setSelectedClient(null))
      dispatch(setIsDogDetailsOpen(true))
    },
    [dispatch]
  )

  const handleClientClick = useCallback(
    (client: ClientDetails) => {
      // Open client sheet when clicking on client name directly
      dispatch(
        setSelectedClient({
          name: client.name,
          classification: client.classification,
          phone: client.phone,
          email: client.email,
          recordId: client.recordId,
          recordNumber: client.recordNumber,
          clientId: client.clientId || client.id,
        })
      )
      dispatch(setIsClientDetailsOpen(true))
    },
    [dispatch]
  )

  const handleOpenClientCommunication = useCallback(() => {
    // Open customer communication modal when explicitly clicking on communication button
    dispatch(setCustomerCommunicationAppointment(appointment))
    dispatch(setShowCustomerCommunicationModal(true))
  }, [dispatch, appointment])

  const handleCancelAppointment = useCallback(() => {
    if (appointment.isProposedMeeting) {
      return
    }
    dispatch(setAppointmentToCancel(appointment))
    dispatch(setCancelConfirmationOpen(true))
  }, [dispatch, appointment])

  const handleOpenProposedMeetingEditor = useCallback(
    (overrides?: { startTime?: Date; endTime?: Date; stationId?: string }) => {
      if (!appointment.proposedMeetingId) {
        return
      }

      const startTime = overrides?.startTime ?? new Date(appointment.startDateTime)
      const endTime = overrides?.endTime ?? new Date(appointment.endDateTime)
      const stationId = overrides?.stationId ?? appointment.stationId

      dispatch(setProposedMeetingMode("edit"))
      dispatch(
        setEditingProposedMeeting({
          ...appointment,
          startDateTime: startTime.toISOString(),
          endDateTime: endTime.toISOString(),
          stationId,
        })
      )
      dispatch(
        setProposedMeetingTimes({
          startTime,
          endTime,
          stationId,
        })
      )
      dispatch(setShowProposedMeetingModal(true))
    },
    [dispatch, appointment]
  )

  const handleDeleteProposedMeeting = useCallback(() => {
    if (!appointment.proposedMeetingId) {
      return
    }
    dispatch(setProposedMeetingToDelete(appointment))
    dispatch(setShowDeleteProposedDialog(true))
  }, [dispatch, appointment])

  const handleDeleteAppointment = useCallback(() => {
    if (appointment.isProposedMeeting) {
      handleDeleteProposedMeeting()
      return
    }
    dispatch(setAppointmentToDelete(appointment))
    dispatch(setDeleteConfirmationOpen(true))
  }, [dispatch, appointment, handleDeleteProposedMeeting])

  const handleDuplicateAppointment = useCallback(() => {
    if (appointment.isProposedMeeting) {
      handleOpenProposedMeetingEditor()
      return
    }
    dispatch(setAppointmentToDuplicate(appointment))
    dispatch(setDuplicateSeriesOpen(true))
  }, [dispatch, appointment, handleOpenProposedMeetingEditor])

  const handlePaymentClick = useCallback(async () => {
    if (appointment.isProposedMeeting || !appointment.clientId) {
      return
    }

    try {
      // Use the selected date from the board (the date the user is viewing)
      // Get date components in local timezone
      const year = selectedDate.getFullYear()
      const month = selectedDate.getMonth()
      const day = selectedDate.getDate()

      // Create day boundaries in local timezone for the selected date
      const dayStart = new Date(year, month, day, 0, 0, 0, 0)
      const dayEnd = new Date(year, month, day, 23, 59, 59, 999)

      // Find all appointments for the same owner on the same day
      // Note: We only filter by enum value "cancelled" in the query, then filter Hebrew statuses in JS
      const { data: groomingData, error: groomingError } = await supabase
        .from("grooming_appointments")
        .select("id, amount_due, status")
        .eq("customer_id", appointment.clientId)
        .gte("start_at", dayStart.toISOString())
        .lte("start_at", dayEnd.toISOString())
        .neq("status", "cancelled")

      if (groomingError) {
        console.error("Error fetching grooming appointments:", groomingError)
        toast({
          title: "שגיאה",
          description: "לא הצלחנו לטעון את התורים",
          variant: "destructive",
        })
        return
      }

      // Filter out cancelled appointments (including Hebrew statuses)
      const isCancelledStatus = (status: string | null | undefined): boolean => {
        if (!status) return false
        const normalized = status.toLowerCase()
        return (
          normalized === "cancelled" ||
          normalized.includes("cancel") ||
          normalized === "בוטל" ||
          normalized.includes("מבוטל")
        )
      }

      const allAppointments = (groomingData || [])
        .filter((apt) => !isCancelledStatus(apt.status))
        .map((apt) => ({
          id: apt.id,
          serviceType: "grooming" as const,
          amountDue: apt.amount_due || 0,
        }))

      if (allAppointments.length === 0) {
        toast({
          title: "שגיאה",
          description: "לא נמצאו תורים ללקוח זה ביום זה",
          variant: "destructive",
        })
        return
      }

      // Check if there's an existing active cart for this customer
      const { data: existingCarts, error: cartsError } = await supabase
        .from("carts")
        .select("id")
        .eq("customer_id", appointment.clientId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)

      if (cartsError) {
        console.error("Error checking existing carts:", cartsError)
      }

      let cartId: string

      if (existingCarts && existingCarts.length > 0) {
        // Use existing cart
        cartId = existingCarts[0].id

        // Check which appointments are already in the cart
        const { data: existingCartAppointments } = await supabase
          .from("cart_appointments")
          .select("grooming_appointment_id")
          .eq("cart_id", cartId)

        const existingAppointmentIds = new Set<string>()
        existingCartAppointments?.forEach((ca) => {
          if (ca.grooming_appointment_id) {
            existingAppointmentIds.add(ca.grooming_appointment_id)
          }
        })

        // Add appointments that aren't already in the cart
        // Filter out proposed meetings (they can't be added to carts)
        const appointmentsToAdd = allAppointments.filter((apt) => {
          if (apt.isProposedMeeting) return false // Skip proposed meetings
          return !existingAppointmentIds.has(apt.id)
        })

        if (appointmentsToAdd.length > 0) {
          const cartAppointmentsToInsert = appointmentsToAdd.map((apt) => {
            // Extract actual UUID for grooming appointments
            const actualGroomingId = extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)

            return {
              cart_id: cartId,
              grooming_appointment_id: actualGroomingId || null,
              appointment_price: apt.amountDue,
            }
          })

          const { error: insertError } = await supabase.from("cart_appointments").insert(cartAppointmentsToInsert)

          if (insertError) {
            console.error("Error adding appointments to cart:", insertError)
            toast({
              title: "שגיאה",
              description: "לא הצלחנו להוסיף את התורים לעגלה",
              variant: "destructive",
            })
            return
          }
        }
      } else {
        // Create new cart
        const { data: newCart, error: createCartError } = await supabase
          .from("carts")
          .insert({
            customer_id: appointment.clientId,
            status: "active",
          })
          .select("id")
          .single()

        if (createCartError || !newCart) {
          console.error("Error creating cart:", createCartError)
          toast({
            title: "שגיאה",
            description: "לא הצלחנו ליצור עגלה",
            variant: "destructive",
          })
          return
        }

        cartId = newCart.id

        // Add all appointments to cart_appointments
        // Filter out proposed meetings (they can't be added to carts)
        const appointmentsToAddToNewCart = allAppointments.filter((apt) => !apt.isProposedMeeting)

        const cartAppointmentsToInsert = appointmentsToAddToNewCart.map((apt) => ({
          cart_id: cartId,
          grooming_appointment_id: extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId),
          appointment_price: apt.amountDue,
        }))

        const { error: insertError } = await supabase.from("cart_appointments").insert(cartAppointmentsToInsert)

        if (insertError) {
          console.error("Error adding appointments to cart:", insertError)
          toast({
            title: "שגיאה",
            description: "לא הצלחנו להוסיף את התורים לעגלה",
            variant: "destructive",
          })
          return
        }
      }

      // Open payment modal with cartId
      dispatch(setSelectedAppointmentForPayment(appointment))
      dispatch(setPaymentCartId(cartId))
      dispatch(setShowPaymentModal(true))
    } catch (error) {
      console.error("Error in handlePaymentClick:", error)
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בעת פתיחת תשלום",
        variant: "destructive",
      })
    }
  }, [dispatch, appointment, toast])

  const handleOpenRescheduleProposal = useCallback(() => {
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

    dispatch(setRescheduleTargetAppointment(appointment))
    dispatch(
      setRescheduleTimes({
        startTime: new Date(start.getTime()),
        endTime: new Date(end.getTime()),
        stationId: appointment.stationId,
      })
    )
    dispatch(setShowRescheduleProposalModal(true))
  }, [dispatch, toast, appointment])

  const openGroomingEditModal = useCallback(() => {
    const startDate = parseISODate(appointment.startDateTime)
    if (!startDate) {
      toast({
        title: "שגיאה בעריכת התור",
        description: "לא ניתן לפתוח את עריכת התור בגלל נתוני זמן חסרים או לא תקינים.",
        variant: "destructive",
      })
      return
    }

    dispatch(setEditingGroomingAppointment(appointment))
    dispatch(setGroomingEditOpen(true))
  }, [dispatch, toast, appointment])

  const openPersonalAppointmentEditModal = useCallback(() => {
    const startDate = parseISODate(appointment.startDateTime)
    if (!startDate) {
      toast({
        title: "שגיאה בעריכת התור",
        description: "לא ניתן לפתוח את עריכת התור בגלל נתוני זמן חסרים או לא תקינים.",
        variant: "destructive",
      })
      return
    }

    dispatch(setEditingPersonalAppointment(appointment))
    dispatch(setPersonalAppointmentEditOpen(true))
  }, [dispatch, toast, appointment])

  const handleExpandCard = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation()
      dispatch(addExpandedAppointmentCard(appointment.id))
    },
    [dispatch, appointment.id]
  )

  const handleCollapseCard = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation()
      dispatch(removeExpandedAppointmentCard(appointment.id))
    },
    [dispatch, appointment.id]
  )

  // Approval handlers
  const handleApproveAppointment = useCallback(async () => {
    try {
      const appointmentType = "grooming"
      const appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)

      // Store original status for potential rollback
      const originalStatus = appointment.status

      // Helper function to update appointment in cache
      const updateAppointmentInCache = (draft: any, newStatus: string) => {
        if (!draft || !draft.appointments) {
          console.warn("[handleApproveAppointment] No draft or appointments found")
          return false
        }

        // Try multiple matching strategies
        // First, try by direct ID match (most reliable)
        let appointmentIndex = draft.appointments.findIndex((apt: ManagerAppointment) => apt.id === appointment.id)

        // If not found by direct ID, try by extracted ID
        if (appointmentIndex === -1) {
          appointmentIndex = draft.appointments.findIndex((apt: ManagerAppointment) => {
            if (apt.serviceType === "grooming") {
              const aptId = extractGroomingAppointmentId(apt.id)
              return aptId === appointmentId
            }
            return false
          })
        }

        if (appointmentIndex !== -1) {
          const oldStatus = draft.appointments[appointmentIndex].status
          draft.appointments[appointmentIndex].status = newStatus
          draft.appointments[appointmentIndex].updated_at = new Date().toISOString()
          console.log(
            `[handleApproveAppointment] Updated appointment ${appointment.id} from ${oldStatus} to ${newStatus}`
          )
          return true
        } else {
          console.warn(
            `[handleApproveAppointment] Appointment ${appointment.id} (extracted: ${appointmentId}) not found in cache. Total appointments: ${draft.appointments.length}`
          )
          return false
        }
      }

      // Optimistically update Redux cache immediately - update all cached queries
      const patchResults: Array<{ undo: () => void }> = []

      // Helper to try updating a query and collect the patch result
      const tryUpdateQuery = (queryParams: { date: string; serviceType?: "grooming" | "both" }) => {
        try {
          const patchResult = dispatch(
            supabaseApi.util.updateQueryData("getManagerSchedule", queryParams, (draft) => {
              const updated = updateAppointmentInCache(draft, "scheduled")
              return draft // Always return draft for Immer
            })
          )
          if (patchResult) {
            patchResults.push(patchResult)
            console.log(`[handleApproveAppointment] Updated cache for query:`, queryParams)
          } else {
            console.warn(`[handleApproveAppointment] No cache entry found for query:`, queryParams)
          }
        } catch (error) {
          console.error(
            `[handleApproveAppointment] Error updating cache for query ${JSON.stringify(queryParams)}:`,
            error
          )
        }
      }

      // Update the query that's currently being used (with "both" serviceType)
      tryUpdateQuery({ date: formattedDate, serviceType: "both" })

      // Also update with "grooming" serviceType in case that's what's cached
      tryUpdateQuery({ date: formattedDate, serviceType: "grooming" })

      // Also try without serviceType (uses default)
      tryUpdateQuery({ date: formattedDate })

      const result = await approveAppointmentByManager(appointmentId, appointmentType, "scheduled")

      if (result.success) {
        toast({
          title: "הצלחה",
          description: result.message || "התור אושר בהצלחה",
        })
        // Invalidate cache to refresh the schedule (ensures data consistency)
        // But do it after a short delay to let the optimistic update be visible
        setTimeout(() => {
          dispatch(supabaseApi.util.invalidateTags([{ type: "ManagerSchedule", id: "LIST" }, "Appointment"]))
        }, 1000)
      } else {
        // Revert optimistic updates on error
        patchResults.forEach((patch) => patch.undo())
        toast({
          title: "שגיאה",
          description: result.error || "לא ניתן לאשר את התור",
          variant: "destructive",
        })
      }
    } catch (error) {
      // Revert optimistic updates on error
      const appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)

      const revertUpdate = (draft: any) => {
        if (!draft || !draft.appointments) return
        const appointmentIndex = draft.appointments.findIndex((apt: ManagerAppointment) => apt.id === appointment.id)
        if (appointmentIndex !== -1) {
          draft.appointments[appointmentIndex].status = appointment.status
        }
      }

      dispatch(
        supabaseApi.util.updateQueryData(
          "getManagerSchedule",
          { date: formattedDate, serviceType: "both" },
          revertUpdate
        )
      )
      dispatch(
        supabaseApi.util.updateQueryData(
          "getManagerSchedule",
          { date: formattedDate, serviceType: "grooming" },
          revertUpdate
        )
      )

      console.error("Error approving appointment:", error)
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה באישור התור",
        variant: "destructive",
      })
    }
  }, [appointment, toast, dispatch, formattedDate])

  const handleDeclineAppointment = useCallback(async () => {
    try {
      const appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)

      // Optimistically update Redux cache immediately
      dispatch(
        supabaseApi.util.updateQueryData(
          "getManagerSchedule",
          { date: formattedDate, serviceType: "both" },
          (draft) => {
            if (draft && draft.appointments) {
              const appointmentIndex = draft.appointments.findIndex(
                (apt) => apt.serviceType === "grooming" && extractGroomingAppointmentId(apt.id) === appointmentId
              )
              if (appointmentIndex !== -1) {
                draft.appointments[appointmentIndex].status = "cancelled"
                draft.appointments[appointmentIndex].updated_at = new Date().toISOString()
              }
            }
          }
        )
      )

      const result = await cancelAppointment(appointmentId)

      if (result.success) {
        toast({
          title: "הצלחה",
          description: "התור בוטל בהצלחה",
        })
        // Invalidate cache to refresh the schedule (ensures data consistency)
        dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment"]))
      } else {
        // Revert optimistic update on error
        dispatch(
          supabaseApi.util.updateQueryData(
            "getManagerSchedule",
            { date: formattedDate, serviceType: "both" },
            (draft) => {
              if (draft && draft.appointments) {
                const appointmentIndex = draft.appointments.findIndex(
                  (apt) => apt.serviceType === "grooming" && extractGroomingAppointmentId(apt.id) === appointmentId
                )
                if (appointmentIndex !== -1) {
                  draft.appointments[appointmentIndex].status = appointment.status
                }
              }
            }
          )
        )
        toast({
          title: "שגיאה",
          description: result.error || "לא ניתן לבטל את התור",
          variant: "destructive",
        })
      }
    } catch (error) {
      // Revert optimistic update on error
      const appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      dispatch(
        supabaseApi.util.updateQueryData(
          "getManagerSchedule",
          { date: formattedDate, serviceType: "both" },
          (draft) => {
            if (draft && draft.appointments) {
              const appointmentIndex = draft.appointments.findIndex(
                (apt) => apt.serviceType === "grooming" && extractGroomingAppointmentId(apt.id) === appointmentId
              )
              if (appointmentIndex !== -1) {
                draft.appointments[appointmentIndex].status = appointment.status
              }
            }
          }
        )
      )
      console.error("Error declining appointment:", error)
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בביטול התור",
        variant: "destructive",
      })
    }
  }, [appointment, toast, dispatch, formattedDate])

  const handleApproveWithChange = useCallback(() => {
    // Open approve with modify dialog first
    dispatch(setAppointmentToApproveWithModify(appointment))
    dispatch(setApproveWithModifyDialogOpen(true))
  }, [appointment, dispatch])

  return {
    // Computed values
    dates,
    startDate,
    endDate,
    pixelsPerMinute,
    previewEndDate,
    effectiveEndDate,
    actualDurationMinutes,
    displayedDurationMinutes,
    isResizing,
    isExpanded,
    originalHeight,
    isSmallCard,
    height,
    dogName,
    breedName,
    crossServiceIndicator,
    classification,
    serviceStyle,
    isProposedMeeting,
    cardStyle,
    statusStyle,
    subscriptionName,
    notes,
    internalNotes,
    originalTimeRangeLabel,
    timeRangeLabel,
    clientName,
    clientPhone,
    timeline,
    highlightedSlots,
    draggedAppointment,
    isFirstAppointment,
    isApproved,
    isWaitingForApproval,
    hasPaidOrder,
    paidSum,

    // Hooks
    pinnedAppointmentsHook,

    // Handlers
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
  }
}

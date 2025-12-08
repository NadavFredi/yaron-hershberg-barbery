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
  setEditingGardenAppointment,
  setEditingGroomingAppointment,
  setEditingPersonalAppointment,
  setEditingProposedMeeting,
  setGardenEditOpen,
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
import { extractGroomingAppointmentId, extractGardenAppointmentId } from "@/lib/utils"
import { cancelAppointment } from "@/pages/Appointments/Appointments.module"
import { approveAppointmentByManager } from "@/integrations/supabase/supabaseService"

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

  const originalHeight =
    appointment.serviceType === "garden" ? 140 : Math.max(1, displayedDurationMinutes * pixelsPerMinute)

  const isSmallCard = originalHeight < 100

  const height = isExpanded && isSmallCard ? Math.max(originalHeight, 150) : originalHeight

  const primaryDog = appointment.dogs[0]
  const dogName = primaryDog?.name ?? "ללא שיוך לכלב"
  const rawBreedName = primaryDog?.breed ?? appointment.serviceName ?? ""
  
  // Check if same dog has the other service type appointment on the same day
  const hasOtherServiceAppointment = useMemo(() => {
    if (!data?.appointments || !primaryDog?.id || appointment.isProposedMeeting) {
      return false
    }

    // For grooming appointments, check if there's also a garden appointment
    // For garden appointments, check if there's also a grooming appointment
    const targetServiceType = appointment.serviceType === "grooming" ? "garden" : "grooming"

    return data.appointments.some((apt: ManagerAppointment) => {
      if (apt.id === appointment.id || apt.isProposedMeeting) return false
      if (apt.serviceType !== targetServiceType) return false
      const aptDog = apt.dogs?.[0]
      return aptDog?.id === primaryDog.id
    })
  }, [data?.appointments, primaryDog?.id, appointment.id, appointment.serviceType, appointment.isProposedMeeting])

  // Get base breed name and separate indicator
  const breedName = rawBreedName?.trim() ? rawBreedName.trim() : undefined
  
  const crossServiceIndicator = useMemo(() => {
    if (!hasOtherServiceAppointment) {
      return undefined
    }
    
    if (appointment.serviceType === "grooming") {
      return "+ גן"
    } else if (appointment.serviceType === "garden") {
      return "+ תספורת"
    }
    return undefined
  }, [hasOtherServiceAppointment, appointment.serviceType])
  const rawClassification = appointment.clientClassification ?? primaryDog?.clientClassification ?? ""
  const classification = rawClassification.trim() ? rawClassification.trim() : undefined
  const serviceStyle = SERVICE_STYLES[appointment.serviceType]
  const isProposedMeeting = Boolean(appointment.isProposedMeeting)

  const getCardStyle = (appointment: ManagerAppointment): string => {
    if (appointment.isProposedMeeting) {
      return "bg-lime-50 border-lime-200"
    }
    if (appointment.isPersonalAppointment) {
      return "bg-purple-100 border-purple-300"
    }
    if (appointment.appointmentType === "private") {
      return "bg-purple-100 border-purple-300"
    }
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

  const clientName = appointment.clientName ?? primaryDog?.clientName
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
    return (
      status.includes("cancel") || status.includes("בוטל") || status.includes("מבוטל")
    )
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
  const { data: appointmentOrders } = useGetAppointmentOrdersQuery(
    { appointmentId: appointment.id, serviceType: appointment.serviceType === "grooming" ? "grooming" : "garden" },
    { skip: !appointment.id || appointment.isProposedMeeting }
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
          breed: dog.breed,
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
      dispatch(setSelectedClient({
        name: client.name,
        classification: client.classification,
        phone: client.phone,
        email: client.email,
        recordId: client.recordId,
        recordNumber: client.recordNumber,
        clientId: client.clientId || client.id,
      }))
      dispatch(setIsClientDetailsOpen(true))
    },
    [dispatch]
  )

  const handleOpenClientCommunication = useCallback(
    () => {
      // Open customer communication modal when explicitly clicking on communication button
      dispatch(setCustomerCommunicationAppointment(appointment))
      dispatch(setShowCustomerCommunicationModal(true))
    },
    [dispatch, appointment]
  )

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
      const [groomingResult, daycareResult] = await Promise.all([
        supabase
          .from("grooming_appointments")
          .select("id, amount_due, status")
          .eq("customer_id", appointment.clientId)
          .gte("start_at", dayStart.toISOString())
          .lte("start_at", dayEnd.toISOString())
          .neq("status", "cancelled"),
        supabase
          .from("daycare_appointments")
          .select("id, amount_due, status")
          .eq("customer_id", appointment.clientId)
          .gte("start_at", dayStart.toISOString())
          .lte("start_at", dayEnd.toISOString())
          .neq("status", "cancelled"),
      ])

      if (groomingResult.error) {
        console.error("Error fetching grooming appointments:", groomingResult.error)
        toast({
          title: "שגיאה",
          description: "לא הצלחנו לטעון את התורים",
          variant: "destructive",
        })
        return
      }

      if (daycareResult.error) {
        console.error("Error fetching daycare appointments:", daycareResult.error)
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

      const allAppointments = [
        ...(groomingResult.data || [])
          .filter((apt) => !isCancelledStatus(apt.status))
          .map((apt) => ({
            id: apt.id,
            serviceType: "grooming" as const,
            amountDue: apt.amount_due || 0,
          })),
        ...(daycareResult.data || [])
          .filter((apt) => !isCancelledStatus(apt.status))
          .map((apt) => ({
            id: apt.id,
            serviceType: "garden" as const,
            amountDue: apt.amount_due || 0,
          })),
      ]

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
          .select("grooming_appointment_id, daycare_appointment_id")
          .eq("cart_id", cartId)

        const existingAppointmentIds = new Set<string>()
        existingCartAppointments?.forEach((ca) => {
          if (ca.grooming_appointment_id) {
            existingAppointmentIds.add(ca.grooming_appointment_id)
          }
          if (ca.daycare_appointment_id) {
            existingAppointmentIds.add(ca.daycare_appointment_id)
          }
        })

        // Add appointments that aren't already in the cart
        const appointmentsToAdd = allAppointments.filter((apt) => !existingAppointmentIds.has(apt.id))

        if (appointmentsToAdd.length > 0) {
          const cartAppointmentsToInsert = appointmentsToAdd.map((apt) => ({
            cart_id: cartId,
            grooming_appointment_id: apt.serviceType === "grooming" ? apt.id : null,
            daycare_appointment_id: apt.serviceType === "garden" ? apt.id : null,
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
        const cartAppointmentsToInsert = allAppointments.map((apt) => ({
          cart_id: cartId,
          grooming_appointment_id: apt.serviceType === "grooming" ? apt.id : null,
          daycare_appointment_id: apt.serviceType === "garden" ? apt.id : null,
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

  const openGardenEditModal = useCallback(() => {
    const dates = getAppointmentDates(appointment)
    if (!dates) {
      toast({
        title: "שגיאה בעריכת התור",
        description: "לא ניתן לפתוח את עריכת התור בגלל נתוני זמן חסרים או לא תקינים.",
        variant: "destructive",
      })
      return
    }

    dispatch(setEditingGardenAppointment(appointment))
    dispatch(setGardenEditOpen(true))
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
      let appointmentId: string
      const appointmentType = appointment.serviceType === "grooming" ? "grooming" : "garden"
      
      if (appointment.serviceType === "grooming") {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      } else {
        appointmentId = extractGardenAppointmentId(appointment.id, appointment.gardenAppointmentId)
      }
      
      const result = await approveAppointmentByManager(appointmentId, appointmentType, "approved")
      
      if (result.success) {
        toast({
          title: "הצלחה",
          description: result.message || "התור אושר בהצלחה",
        })
        // Invalidate cache to refresh the schedule
        dispatch(
          supabaseApi.util.invalidateTags([
            { type: 'ManagerSchedule', id: 'LIST' },
            'Appointment',
            'GardenAppointment'
          ])
        )
      } else {
        toast({
          title: "שגיאה",
          description: result.error || "לא ניתן לאשר את התור",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error approving appointment:", error)
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה באישור התור",
        variant: "destructive",
      })
    }
  }, [appointment, toast, dispatch])

  const handleDeclineAppointment = useCallback(async () => {
    try {
      let appointmentId: string
      
      if (appointment.serviceType === "grooming") {
        appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
      } else {
        appointmentId = extractGardenAppointmentId(appointment.id, appointment.gardenAppointmentId)
      }
      
      const result = await cancelAppointment(appointmentId)
      
      if (result.success) {
        toast({
          title: "הצלחה",
          description: "התור בוטל בהצלחה",
        })
        // Invalidate cache to refresh the schedule
        dispatch(
          supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment"])
        )
      } else {
        toast({
          title: "שגיאה",
          description: result.error || "לא ניתן לבטל את התור",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error declining appointment:", error)
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בביטול התור",
        variant: "destructive",
      })
    }
  }, [appointment, toast, dispatch])

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
    primaryDog,
    dogName,
    rawBreedName,
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
    openGardenEditModal,
    openGroomingEditModal,
    openPersonalAppointmentEditModal,
    handleExpandCard,
    handleCollapseCard,
    handleApproveAppointment,
    handleDeclineAppointment,
    handleApproveWithChange,
  }
}

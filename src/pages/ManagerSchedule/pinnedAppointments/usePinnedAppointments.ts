import { useMemo, useCallback, useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  useGetPinnedAppointmentsQuery,
  usePinAppointmentMutation,
  useUnpinAppointmentMutation,
  useUpdatePinnedAppointmentMutation,
  type PinReason,
} from "./pinnedAppointmentsApi"
import { useLazyGetManagerAppointmentQuery } from "@/store/services/supabaseApi"
import { supabase } from "@/integrations/supabase/client"
import type { ManagerAppointment, ManagerScheduleData } from "../types"

interface UsePinnedAppointmentsOptions {
  scheduleData?: ManagerScheduleData | null
}

export function usePinnedAppointments({ scheduleData }: UsePinnedAppointmentsOptions = {}) {
  const { toast } = useToast()
  
  // RTK Query hooks
  const { data: pinnedAppointments = [], refetch: refetchPinned, isLoading: isLoadingPinned } = useGetPinnedAppointmentsQuery()
  const [pinAppointment] = usePinAppointmentMutation()
  const [unpinAppointment] = useUnpinAppointmentMutation()
  const [updatePinnedAppointment] = useUpdatePinnedAppointmentMutation()
  const [fetchManagerAppointment] = useLazyGetManagerAppointmentQuery()

  // Map of appointment IDs to pin IDs for quick lookup
  const pinnedAppointmentsMap = useMemo(() => {
    const map = new Map<string, string>() // appointment_id-appointment_type -> pin_id
    pinnedAppointments.forEach((pin) => {
      const key = `${pin.appointment_id}-${pin.appointment_type}`
      map.set(key, pin.id)
    })
    return map
  }, [pinnedAppointments])

  // State for fetched appointments that aren't in schedule data
  const [fetchedAppointments, setFetchedAppointments] = useState<Map<string, ManagerAppointment>>(new Map())

  // Fetch appointments that aren't in the current schedule data
  useEffect(() => {
    const fetchMissingAppointments = async () => {
      const allAppointments = [
        ...(scheduleData?.appointments?.grooming || []),
        ...(scheduleData?.appointments?.daycare || []),
        ...(scheduleData?.appointments?.proposed || []),
      ]
      
      const missingPins = pinnedAppointments.filter((pin) => {
        const key = `${pin.appointment_id}-${pin.appointment_type}`
        // For proposed meetings (UUID stored), check both the UUID and prefixed ID
        // For regular appointments, check by ID
        const existsInSchedule = allAppointments.some((apt) => {
          if (apt.serviceType === pin.appointment_type) {
            // Match by regular ID
            if (apt.id === pin.appointment_id) return true
            // For proposed meetings, also match by proposedMeetingId (UUID)
            if (apt.isProposedMeeting && apt.proposedMeetingId === pin.appointment_id) return true
          }
          return false
        })
        return !existsInSchedule
      })

      if (missingPins.length === 0) return

      console.log('[usePinnedAppointments] Fetching missing appointments:', missingPins.length)
      
      const newFetched = new Map<string, ManagerAppointment>()
      const pinsToRemove: string[] = []
      
      for (const pin of missingPins) {
        // Check if this is a proposed meeting UUID (try to fetch from proposed_meetings)
        // Proposed meetings are stored with their actual UUID (not prefixed) when pinned
        const { data: proposedMeeting } = await supabase
          .from("proposed_meetings")
          .select("id")
          .eq("id", pin.appointment_id)
          .maybeSingle()
        
        if (proposedMeeting) {
          // This is a proposed meeting - it should be in schedule data
          // If not found, it might have been deleted, but we don't auto-unpin proposed meetings
          // as they might just not be loaded yet
          continue
        }
        
        const serviceType = pin.appointment_type === "daycare" ? "garden" : "grooming"
        try {
          const appointment = await fetchManagerAppointment(
            {
              appointmentId: pin.appointment_id,
              serviceType,
            },
            true
          ).unwrap()

          if (appointment) {
            const key = `${pin.appointment_id}-${pin.appointment_type}`
            newFetched.set(key, appointment)
          }
        } catch (error) {
          // Appointment not found (likely cancelled/deleted) - automatically unpin it
          // Silently cleanup - no need to log as this is expected behavior
          pinsToRemove.push(pin.id)
        }
      }

      // Automatically remove pins for appointments that don't exist (cancelled/deleted)
      if (pinsToRemove.length > 0) {
        console.log(`[usePinnedAppointments] Auto-cleaning ${pinsToRemove.length} pinned appointment(s) that no longer exist`)
        for (const pinId of pinsToRemove) {
          try {
            await unpinAppointment({ pinId }).unwrap()
          } catch (unpinError) {
            // Silently fail - appointment might already be unpinned or doesn't exist
          }
        }
        // Refetch pinned appointments after cleanup
        await refetchPinned()
      }

      if (newFetched.size > 0) {
        setFetchedAppointments((prev) => {
          const merged = new Map(prev)
          newFetched.forEach((value, key) => merged.set(key, value))
          return merged
        })
      }
    }

    fetchMissingAppointments()
  }, [pinnedAppointments, scheduleData, fetchManagerAppointment, unpinAppointment, refetchPinned])

  // Create appointments map from pinned appointments
  const pinnedAppointmentsAppointmentsMap = useMemo(() => {
    const map = new Map<string, ManagerAppointment>()
    const allAppointments = [
      ...(scheduleData?.appointments?.grooming || []),
      ...(scheduleData?.appointments?.daycare || []),
      ...(scheduleData?.appointments?.proposed || []),
    ]
    
    pinnedAppointments.forEach((pin) => {
      const key = `${pin.appointment_id}-${pin.appointment_type}`
      
      // First try to find in schedule data
      // For proposed meetings, check both the UUID and the prefixed ID
      let appointment = allAppointments.find((apt) => {
        if (apt.serviceType === pin.appointment_type) {
          // Match by regular ID
          if (apt.id === pin.appointment_id) return true
          // For proposed meetings, also match by proposedMeetingId
          if (apt.isProposedMeeting && apt.proposedMeetingId === pin.appointment_id) return true
        }
        return false
      })
      
      // If not found, try fetched appointments
      if (!appointment) {
        appointment = fetchedAppointments.get(key)
      }
      
      if (appointment) {
        map.set(key, appointment)
      }
    })
    return map
  }, [pinnedAppointments, scheduleData, fetchedAppointments])

  // Get the actual ID to use for pinning (real UUID for proposed meetings, regular ID for others)
  const getPinId = useCallback((appointment: ManagerAppointment): string => {
    // For proposed meetings, use the actual UUID from proposedMeetingId instead of the prefixed ID
    if (appointment.isProposedMeeting && appointment.proposedMeetingId) {
      return appointment.proposedMeetingId
    }
    return appointment.id
  }, [])

  // Check if an appointment is pinned
  const isAppointmentPinned = useCallback((appointment: ManagerAppointment): boolean => {
    const pinId = getPinId(appointment)
    const key = `${pinId}-${appointment.serviceType}`
    return pinnedAppointmentsMap.has(key)
  }, [pinnedAppointmentsMap, getPinId])

  // Get pin ID for an appointment
  const getPinRecordId = useCallback((appointment: ManagerAppointment): string | undefined => {
    const pinId = getPinId(appointment)
    const key = `${pinId}-${appointment.serviceType}`
    return pinnedAppointmentsMap.get(key)
  }, [pinnedAppointmentsMap, getPinId])

  // Pin appointment handler
  const handlePinAppointment = useCallback(async (appointment: ManagerAppointment, reason?: PinReason) => {
    // Use actual UUID for proposed meetings, regular ID for others
    const pinId = getPinId(appointment)
    
    console.log('[handlePinAppointment] Starting pin operation:', {
      appointmentId: appointment.id,
      pinId: pinId,
      appointmentType: appointment.serviceType,
      reason: reason || "quick_access",
    })
    
    try {
      console.log('[handlePinAppointment] Calling pinAppointment mutation...')
      const result = await pinAppointment({
        appointment_id: pinId, // Use the real UUID for proposed meetings
        appointment_type: appointment.serviceType,
        reason: reason || "quick_access",
      }).unwrap()
      
      console.log('[handlePinAppointment] Pin successful:', result)
      
      toast({
        title: "תור נצמד",
        description: "התור נוסף לרשימת התורים המסומנים",
      })
      
      console.log('[handlePinAppointment] Refetching pinned appointments...')
      await refetchPinned()
      
      // Clear fetched appointments cache to force refetch of missing ones
      setFetchedAppointments(new Map())
    } catch (error) {
      console.error("[handlePinAppointment] Failed to pin appointment:", error)
      const errorMessage = error instanceof Error ? error.message : "שגיאה בצמידת התור"
      toast({
        title: "שגיאה בצמידת התור",
        description: errorMessage.includes("limit") 
          ? "הגעת למגבלה של 20 תורים מסומנים. הסר תורים ישנים כדי להוסיף חדשים."
          : errorMessage,
        variant: "destructive",
      })
      throw error // Re-throw so caller knows it failed
    }
  }, [pinAppointment, refetchPinned, toast])

  // Unpin appointment handler
  const handleUnpinAppointment = useCallback(async (appointment: ManagerAppointment) => {
    const pinRecordId = getPinRecordId(appointment)
    if (!pinRecordId) return

    try {
      await unpinAppointment({
        pinId: pinRecordId,
      }).unwrap()
      
      toast({
        title: "תור הוסר מהסימון",
        description: "התור הוסר מרשימת התורים המסומנים",
      })
      
      refetchPinned()
    } catch (error) {
      console.error("Failed to unpin appointment:", error)
      toast({
        title: "שגיאה בהסרת הסימון",
        description: "לא ניתן להסיר את התור מהסימון",
        variant: "destructive",
      })
    }
  }, [getPinRecordId, unpinAppointment, refetchPinned, toast])

  // Unpin by pin ID handler
  const handleUnpinById = useCallback(async (pinId: string) => {
    try {
      await unpinAppointment({ pinId }).unwrap()
      toast({
        title: "תור הוסר מהסימון",
        description: "התור הוסר מרשימת התורים המסומנים",
      })
      refetchPinned()
    } catch (error) {
      console.error("Failed to unpin appointment:", error)
      toast({
        title: "שגיאה בהסרת הסימון",
        description: "לא ניתן להסיר את התור מהסימון",
        variant: "destructive",
      })
    }
  }, [unpinAppointment, refetchPinned, toast])

  // Update pinned appointment target date handler
  const handleUpdatePinnedTargetDate = useCallback(async (pinId: string, targetDate: string | null) => {
    try {
      await updatePinnedAppointment({
        pinId,
        updates: { target_date: targetDate },
      }).unwrap()
      refetchPinned()
    } catch (error) {
      console.error("Failed to update pinned appointment:", error)
      toast({
        title: "שגיאה בעדכון תאריך יעד",
        description: "לא ניתן לעדכן את תאריך היעד",
        variant: "destructive",
      })
    }
  }, [updatePinnedAppointment, refetchPinned, toast])

    return {
      // Data
      pinnedAppointments,
      pinnedAppointmentsAppointmentsMap,
      isLoadingPinned,
      
      // Computed values
      isAppointmentPinned,
      getPinId: getPinRecordId, // Return the pin record ID getter for backward compatibility
      
      // Handlers
      handlePinAppointment,
      handleUnpinAppointment,
      handleUnpinById,
      handleUpdatePinnedTargetDate,
      
      // Refetch
      refetchPinned,
    }
}

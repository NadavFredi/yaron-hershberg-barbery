import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { supabaseApi, useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { DuplicateStationDialog } from "@/components/dialogs/settings/stations/DuplicateStationDialog"
import { format } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import {
    setIsDuplicateStationDialogOpen,
    setStationToDuplicate,
    setIsDuplicatingStation
} from "@/store/slices/managerScheduleSlice"

export function ManagerDuplicateStationDialog() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const open = useAppSelector((state) => state.managerSchedule.isDuplicateStationDialogOpen)
    const stationToDuplicate = useAppSelector((state) => state.managerSchedule.stationToDuplicate)
    const isDuplicatingStation = useAppSelector((state) => state.managerSchedule.isDuplicatingStation)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data, refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const stations = data?.stations || []

    const handleOpenChange = (value: boolean) => {
        dispatch(setIsDuplicateStationDialogOpen(value))
        if (!value) {
            dispatch(setStationToDuplicate(null))
        }
    }

    const handleConfirm = async (params: any) => {
        if (!stationToDuplicate) return

        dispatch(setIsDuplicatingStation(true))
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

                // Copy service relations if requested
                if (groomingServiceId && params.copyServiceRelations) {
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
                            price_adjustment: 0,
                        }, { onConflict: "service_id,station_id" })
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

                    // Copy service relations if requested
                    if (groomingServiceId && params.copyServiceRelations) {
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
                                price_adjustment: 0,
                            }, { onConflict: "service_id,station_id" })
                    }
                }

                toast({
                    title: "הצלחה",
                    description: `הנתונים הועתקו ל-${params.targetStationIds.length} עמדות בהצלחה`,
                })
            }

            // Refresh schedule data
            await refetch()
            // Invalidate RTK Query cache
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Station"]))
            dispatch(supabaseApi.util.invalidateTags(["StationWorkingHours", "ShiftRestrictions"]))
            // Invalidate React Query cache
            queryClient.invalidateQueries({ queryKey: ['stations'] })
            queryClient.invalidateQueries({ queryKey: ['services-with-stats'] })

            dispatch(setIsDuplicateStationDialogOpen(false))
            dispatch(setStationToDuplicate(null))
        } catch (error) {
            console.error("Error duplicating station:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשכפל את העמדה"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            dispatch(setIsDuplicatingStation(false))
        }
    }

    return (
        <DuplicateStationDialog
            open={open}
            onOpenChange={handleOpenChange}
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
            onConfirm={handleConfirm}
            isDuplicating={isDuplicatingStation}
        />
    )
}


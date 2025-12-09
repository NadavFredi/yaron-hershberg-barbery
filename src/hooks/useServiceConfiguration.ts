import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useServices } from "./useServices"
import { useStations } from "./useStations"

export interface ServiceStationConfig {
  id: string
  service_id: string
  station_id: string
  base_time_minutes: number
  price_adjustment: number
  created_at: string
}

export interface BreedModifier {
  id: string
  service_id: string
  breed_id: string
  time_modifier_minutes: number
  created_at: string
}

export interface BreedAdjustment {
  breed_id: string
  breed_name: string
  time_modifier_minutes: number
}

export interface StationWithConfig {
  id: string
  name: string
  is_active: boolean
  base_time_minutes: number
  price_adjustment: number
}

export const useServiceStationConfigs = (serviceId: string) => {
  return useQuery({
    queryKey: ["service-station-configs", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_station_matrix").select("*").eq("service_id", serviceId)

      if (error) throw error
      return data as ServiceStationConfig[]
    },
  })
}

// Removed useBreedModifiers - barbery system doesn't use breeds

export const useUpdateServiceStationConfig = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      serviceId,
      stationId,
      baseTimeMinutes,
      priceAdjustment,
    }: {
      serviceId: string
      stationId: string
      baseTimeMinutes: number
      priceAdjustment?: number
    }) => {
      // First check if record exists
      const { data: existing } = await supabase
        .from("service_station_matrix")
        .select("id")
        .eq("service_id", serviceId)
        .eq("station_id", stationId)
        .single()

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from("service_station_matrix")
          .update({
            base_time_minutes: baseTimeMinutes,
            price_adjustment: priceAdjustment || 0,
          })
          .eq("service_id", serviceId)
          .eq("station_id", stationId)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from("service_station_matrix")
          .insert({
            service_id: serviceId,
            station_id: stationId,
            base_time_minutes: baseTimeMinutes,
            price_adjustment: priceAdjustment || 0,
          })
          .select()
          .single()

        if (error) throw error
        return data
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["service-station-configs", variables.serviceId] })
      queryClient.invalidateQueries({ queryKey: ["services-with-stats"] })
    },
  })
}

export const useDeleteServiceStationConfig = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ serviceId, stationId }: { serviceId: string; stationId: string }) => {
      const { error } = await supabase
        .from("service_station_matrix")
        .delete()
        .eq("service_id", serviceId)
        .eq("station_id", stationId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["service-station-configs", variables.serviceId] })
      queryClient.invalidateQueries({ queryKey: ["services-with-stats"] })
    },
  })
}

// Removed useUpdateBreedModifier - barbery system doesn't use breeds

// Main composite hook that combines all the functionality
export const useServiceConfiguration = (serviceId: string) => {
  const { data: services } = useServices()
  const { data: allStations } = useStations()
  const { data: stationConfigs } = useServiceStationConfigs(serviceId)
  const updateStationConfigMutation = useUpdateServiceStationConfig()

  const service = services?.find((s) => s.id === serviceId)

  // Combine stations with their configurations
  const stations: StationWithConfig[] =
    allStations?.map((station) => {
      const config = stationConfigs?.find((c) => c.station_id === station.id)
      return {
        id: station.id,
        name: station.name,
        is_active: station.is_active,
        base_time_minutes: config?.base_time_minutes || 60,
        price_adjustment: config?.price_adjustment || 0,
      }
    }) || []

  // Get breed adjustments with proper names from the joined data
  const breedAdjustments: BreedAdjustment[] =
    breedModifiersWithBreeds?.map((modifier) => ({
      breed_id: modifier.breed_id,
      breed_name: modifier.breeds?.name || "גזע לא ידוע",
      time_modifier_minutes: modifier.time_modifier_minutes,
    })) || []

  const updateStationConfig = async (params: {
    serviceId: string
    stationId: string
    baseTimeMinutes: number
    priceAdjustment?: number
  }) => {
    return updateStationConfigMutation.mutateAsync(params)
  }

  // Removed breed-related functions - barbery system doesn't use breeds
  const addBreedAdjustments = async (_breedIds: string[]) => {
    return Promise.resolve()
  }
  const removeBreedAdjustment = async (_breedId: string) => {
    return Promise.resolve()
  }
  const updateBreedTimeAdjustment = async (_breedId: string, _timeModifierMinutes: number) => {
    return Promise.resolve()
  }

  const applyTimeToAllStations = async (timeMinutes: number) => {
    const promises = stations.map((station) =>
      updateStationConfigMutation.mutateAsync({
        serviceId,
        stationId: station.id,
        baseTimeMinutes: timeMinutes,
        priceAdjustment: station.price_adjustment,
      })
    )
    return Promise.all(promises)
  }

  return {
    service,
    stations,
    breedAdjustments,
    isLoading: !services || !allStations,
    updateStationConfig,
    addBreedAdjustments,
    removeBreedAdjustment,
    updateBreedTimeAdjustment,
    applyTimeToAllStations,
  }
}

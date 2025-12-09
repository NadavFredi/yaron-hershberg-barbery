import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface ServiceSubAction {
  id: string
  service_id: string
  name: string
  description?: string
  duration: number
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  name: string
  description?: string
  base_price: number
  duration?: number
  is_active: boolean
  mode: "simple" | "complicated"
  created_at: string
  updated_at: string
  service_sub_actions?: ServiceSubAction[]
}

export interface ServiceWithStats extends Service {
  averageTime: number
  configuredStationsCount: number
  totalStationsCount: number
  priceRange: {
    min: number
    max: number
  }
}

export const useServices = () => {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select(
          `
          *,
          service_sub_actions (
            id,
            service_id,
            name,
            description,
            duration,
            order_index,
            is_active,
            created_at,
            updated_at
          )
        `
        )
        .order("name")

      if (error) throw error

      // Sort sub actions by order_index
      return (data as Service[]).map((service) => ({
        ...service,
        service_sub_actions: service.service_sub_actions?.sort((a, b) => a.order_index - b.order_index),
      }))
    },
  })
}

export const useServicesWithStats = () => {
  return useQuery({
    queryKey: ["services-with-stats"],
    queryFn: async () => {
      // Get services with their station configurations
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select(
          `
          *,
          service_station_matrix(
            base_time_minutes,
            price_adjustment,
            station_id,
            stations(is_active)
          )
        `
        )
        .order("name")

      if (servicesError) throw servicesError

      // Get total active stations count
      const { count: totalStationsCount } = await supabase
        .from("stations")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)

      const servicesWithStats: ServiceWithStats[] = servicesData.map((service) => {
        const configs = service.service_station_matrix || []
        const activeConfigs = configs.filter((config) => config.stations?.is_active)

        const averageTime =
          activeConfigs.length > 0
            ? Math.round(
                activeConfigs.reduce((sum, config) => sum + config.base_time_minutes, 0) / activeConfigs.length
              )
            : 0

        // Calculate price range based on base_price + price_adjustment
        const finalPrices = activeConfigs.map((config) => service.base_price + (config.price_adjustment || 0))

        const priceRange =
          finalPrices.length > 0
            ? {
                min: Math.min(...finalPrices),
                max: Math.max(...finalPrices),
              }
            : { min: service.base_price, max: service.base_price }

        return {
          id: service.id,
          name: service.name,
          description: service.description,
          base_price: service.base_price,
          created_at: service.created_at,
          updated_at: service.updated_at,
          averageTime,
          configuredStationsCount: activeConfigs.length,
          totalStationsCount: totalStationsCount || 0,
          priceRange,
        }
      })

      return servicesWithStats
    },
  })
}

export const useCreateService = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (serviceData: {
      name: string
      description?: string
      base_price: number
      duration?: number
      is_active?: boolean
      mode?: "simple" | "complicated"
    }) => {
      const { data, error } = await supabase
        .from("services")
        .insert({
          ...serviceData,
          mode: serviceData.mode || "simple",
          is_active: serviceData.is_active ?? true,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] })
      queryClient.invalidateQueries({ queryKey: ["services-with-stats"] })
    },
  })
}

export const useUpdateService = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      serviceId,
      name,
      description,
      base_price,
      duration,
      is_active,
      mode,
    }: {
      serviceId: string
      name?: string
      description?: string
      base_price?: number
      duration?: number
      is_active?: boolean
      mode?: "simple" | "complicated"
    }) => {
      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (base_price !== undefined) updateData.base_price = base_price
      if (duration !== undefined) updateData.duration = duration
      if (is_active !== undefined) updateData.is_active = is_active
      if (mode !== undefined) updateData.mode = mode

      const { data, error } = await supabase.from("services").update(updateData).eq("id", serviceId).select().single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["services"] })
      queryClient.invalidateQueries({ queryKey: ["services-with-stats"] })
    },
  })
}

// Sub actions hooks
export const useCreateServiceSubAction = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (subActionData: {
      service_id: string
      name: string
      description?: string
      duration: number
      order_index: number
      is_active?: boolean
    }) => {
      const { data, error } = await supabase
        .from("service_sub_actions")
        .insert({
          ...subActionData,
          is_active: subActionData.is_active ?? true,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
  })
}

export const useUpdateServiceSubAction = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      subActionId,
      name,
      description,
      duration,
      order_index,
      is_active,
    }: {
      subActionId: string
      name?: string
      description?: string
      duration?: number
      order_index?: number
      is_active?: boolean
    }) => {
      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (duration !== undefined) updateData.duration = duration
      if (order_index !== undefined) updateData.order_index = order_index
      if (is_active !== undefined) updateData.is_active = is_active

      const { data, error } = await supabase
        .from("service_sub_actions")
        .update(updateData)
        .eq("id", subActionId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
  })
}

export const useDeleteServiceSubAction = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (subActionId: string) => {
      const { error } = await supabase.from("service_sub_actions").delete().eq("id", subActionId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
  })
}

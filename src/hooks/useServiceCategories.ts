import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { ServiceCategoryVariant } from "@/lib/serviceCategoryVariants"

export interface ServiceCategory {
  id: string
  name: string
  variant: ServiceCategoryVariant
  is_default?: boolean
  created_at: string
  updated_at: string
}

export interface ServiceCategoryWithServices extends ServiceCategory {
  services_count?: number
}

export const useServiceCategories = () => {
  return useQuery({
    queryKey: ["service-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_categories").select("*").order("name")

      if (error) throw error
      return data as ServiceCategory[]
    },
  })
}

export const useServiceCategoriesWithCounts = () => {
  return useQuery({
    queryKey: ["service-categories-with-counts"],
    queryFn: async () => {
      // First get all categories
      const { data: categories, error: categoriesError } = await supabase
        .from("service_categories")
        .select("*")
        .order("name")

      if (categoriesError) throw categoriesError

      // Then get counts for each category
      const categoriesWithCounts = await Promise.all(
        (categories || []).map(async (category) => {
          const { count, error: countError } = await supabase
            .from("services")
            .select("*", { count: "exact", head: true })
            .eq("service_category_id", category.id)

          if (countError) {
            console.error("Error counting services for category:", category.id, countError)
            return { ...category, services_count: 0 }
          }

          return {
            ...category,
            services_count: count || 0,
          }
        })
      )

      return categoriesWithCounts as ServiceCategoryWithServices[]
    },
  })
}

export const useCreateServiceCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (categoryData: { name: string; variant: ServiceCategoryVariant; is_default?: boolean }) => {
      const { data, error } = await supabase.from("service_categories").insert(categoryData).select().single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-categories"] })
      queryClient.invalidateQueries({ queryKey: ["service-categories-with-counts"] })
      queryClient.invalidateQueries({ queryKey: ["default-service-category"] })
    },
  })
}

export const useUpdateServiceCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      categoryId,
      name,
      variant,
      is_default,
    }: {
      categoryId: string
      name?: string
      variant?: ServiceCategoryVariant
      is_default?: boolean
    }) => {
      // If setting this as default, unset all other defaults first
      if (is_default === true) {
        await supabase.from("service_categories").update({ is_default: false }).neq("id", categoryId)
      }

      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (variant !== undefined) updateData.variant = variant
      if (is_default !== undefined) updateData.is_default = is_default

      const { data, error } = await supabase
        .from("service_categories")
        .update(updateData)
        .eq("id", categoryId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-categories"] })
      queryClient.invalidateQueries({ queryKey: ["service-categories-with-counts"] })
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
  })
}

export const useServicesByCategory = (categoryId: string | null) => {
  return useQuery({
    queryKey: ["services-by-category", categoryId],
    queryFn: async () => {
      if (!categoryId) return []

      const { data, error } = await supabase
        .from("services")
        .select("id, name, is_active")
        .eq("service_category_id", categoryId)
        .order("name")

      if (error) throw error
      return data || []
    },
    enabled: !!categoryId,
  })
}

export const useDefaultServiceCategory = () => {
  return useQuery({
    queryKey: ["default-service-category"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_categories").select("*").eq("is_default", true).maybeSingle()

      if (error) throw error
      return data as ServiceCategory | null
    },
  })
}

export const useDeleteServiceCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase.from("service_categories").delete().eq("id", categoryId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-categories"] })
      queryClient.invalidateQueries({ queryKey: ["service-categories-with-counts"] })
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
  })
}

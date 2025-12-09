import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { ServiceCategoryVariant } from "@/lib/serviceCategoryVariants"

export interface ServiceCategory {
  id: string
  name: string
  variant: ServiceCategoryVariant
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
      const { data: categories, error: categoriesError } = await supabase
        .from("service_categories")
        .select(
          `
          *,
          services(count)
        `
        )
        .order("name")

      if (categoriesError) throw categoriesError

      return (categories as any[]).map((category) => ({
        ...category,
        services_count: Array.isArray(category.services) ? category.services.length : 0,
      })) as ServiceCategoryWithServices[]
    },
  })
}

export const useCreateServiceCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (categoryData: { name: string; variant: ServiceCategoryVariant }) => {
      const { data, error } = await supabase.from("service_categories").insert(categoryData).select().single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-categories"] })
      queryClient.invalidateQueries({ queryKey: ["service-categories-with-counts"] })
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
    }: {
      categoryId: string
      name?: string
      variant?: ServiceCategoryVariant
    }) => {
      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (variant !== undefined) updateData.variant = variant

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

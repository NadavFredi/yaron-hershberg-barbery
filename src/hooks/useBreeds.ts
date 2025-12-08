
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface Breed {
    id: string
    name: string
    created_at?: string
    size_class?: string | null
    min_groom_price?: number | null
    max_groom_price?: number | null
}

export const useBreeds = () => {
    return useQuery({
        queryKey: ["breeds"],
        queryFn: async () => {
            // Breeds table doesn't exist in this system - return empty array
            return [] as Breed[]
        }
    })
}


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
            const { data, error } = await supabase
                .from("breeds")
                .select("*")
                .order("name")

            if (error) {
                throw error
            }

            return data as Breed[]
        }
    })
}

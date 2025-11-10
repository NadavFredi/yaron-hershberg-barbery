
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface Breed {
    id: string
    name: string
    created_at?: string
    airtable_id?: string | null
    size_class?: string | null
    min_groom_price?: number | null
    max_groom_price?: number | null
}

export const useBreeds = () => {
    return useQuery({
        queryKey: ["breeds"],
        queryFn: async () => {
            console.log("🔄 [useBreeds] נטען רשימת גזעים מהטבלה הציבורית")

            const { data, error } = await supabase
                .from("breeds")
                .select("*")
                .order("name")

            if (error) {
                console.error("❌ [useBreeds] שגיאה בטעינת הגזעים:", error)
                throw error
            }

            console.log("✅ [useBreeds] נמצאו", data?.length ?? 0, "גזעים")
            return data as Breed[]
        }
    })
}

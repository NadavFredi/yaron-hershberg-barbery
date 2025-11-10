
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface TreatmentType {
    id: string
    name: string
    created_at?: string
    airtable_id?: string | null
    size_class?: string | null
    min_groom_price?: number | null
    max_groom_price?: number | null
}

export const useTreatmentTypes = () => {
    return useQuery({
        queryKey: ["treatmentTypes"],
        queryFn: async () => {
            console.log("🔄 [useTreatmentTypes] נטען רשימת גזעים מהטבלה הציבורית")

            const { data, error } = await supabase
                .from("treatmentTypes")
                .select("*")
                .order("name")

            if (error) {
                console.error("❌ [useTreatmentTypes] שגיאה בטעינת הגזעים:", error)
                throw error
            }

            console.log("✅ [useTreatmentTypes] נמצאו", data?.length ?? 0, "גזעים")
            return data as TreatmentType[]
        }
    })
}

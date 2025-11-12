
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface TreatmentType {
    id: string
    name: string
    description?: string | null
    default_duration_minutes?: number | null
    default_price?: number | null
    display_order?: number | null
    color_hex?: string | null
    size_class?: string | null
    min_groom_price?: number | null
    max_groom_price?: number | null
}

interface SupabaseTreatmentType {
    id: string
    name: string
    description: string | null
    default_duration_minutes: number | null
    default_price: number | null
    display_order: number | null
    color_hex: string | null
}

function useTreatmentTypes() {
    return useQuery({
        queryKey: ["serviceTypes"],
        queryFn: async () => {
            console.log("🔄 [useTreatmentTypes] טוען סוגי טיפולים מהמאגרים החדשים")

            const { data, error } = await supabase
                .from("treatment_types")
                .select("id, name, description, default_duration_minutes, default_price, display_order, color_hex")
                .order("display_order", { ascending: true })
                .order("name", { ascending: true })

            if (error) {
                console.error("❌ [useTreatmentTypes] שגיאה בטעינת סוגי הטיפול:", error)
                throw error
            }

            const mapped = (data ?? []).map((record) => {
                const treatment = record as SupabaseTreatmentType
                return {
                    id: treatment.id,
                    name: treatment.name,
                    description: treatment.description,
                    default_duration_minutes: treatment.default_duration_minutes,
                    default_price: treatment.default_price,
                    display_order: treatment.display_order,
                    color_hex: treatment.color_hex,
                    size_class: null,
                    min_groom_price: treatment.default_price,
                    max_groom_price: treatment.default_price
                } satisfies TreatmentType
            })

            console.log("✅ [useTreatmentTypes] נטענו", mapped.length, "סוגי טיפול")
            return mapped
        }
    })
}

export { useTreatmentTypes }
export default useTreatmentTypes

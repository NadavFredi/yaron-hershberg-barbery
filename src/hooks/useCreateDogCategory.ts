import { useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export interface UseCreateDogCategoryOptions {
    onSuccess?: (id: string, name: string) => void
}

export function useCreateDogCategory(options?: UseCreateDogCategoryOptions) {
    const { toast } = useToast()

    const createDogCategory = useCallback(
        async (name: string): Promise<string | null> => {
            try {
                console.log("🆕 [useCreateDogCategory] Creating new dog category:", name)
                
                const payload = {
                    name: name.trim(),
                }

                const { data, error } = await supabase
                    .from("dog_categories")
                    .insert(payload)
                    .select("id, name")
                    .single()

                if (error) throw error

                toast({
                    title: "קטגוריית כלבים נוצרה",
                    description: `הקטגוריה "${data.name}" נוספה בהצלחה.`,
                })

                console.log("✅ [useCreateDogCategory] Dog category created:", { id: data.id, name: data.name })
                
                if (options?.onSuccess) {
                    options.onSuccess(data.id, data.name)
                }

                return data.id
            } catch (error) {
                console.error("❌ [useCreateDogCategory] Failed to create dog category:", error)
                const errorMessage = error instanceof Error ? error.message : "לא ניתן ליצור את קטגוריית הכלבים"
                toast({
                    title: "שגיאה ביצירת קטגוריית כלבים",
                    description: errorMessage,
                    variant: "destructive",
                })
                return null
            }
        },
        [toast, options]
    )

    return { createDogCategory }
}


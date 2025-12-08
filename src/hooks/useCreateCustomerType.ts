import { useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export interface UseCreateCustomerTypeOptions {
    onSuccess?: (id: string, name: string) => void
}

export function useCreateCustomerType(options?: UseCreateCustomerTypeOptions) {
    const { toast } = useToast()

    const createCustomerType = useCallback(
        async (name: string): Promise<string | null> => {
            try {
                console.log("🆕 [useCreateCustomerType] Creating new customer type:", name)
                
                // Fetch max priority to calculate next priority
                const { data: maxPriorityData, error: priorityError } = await supabase
                    .from("customer_types")
                    .select("priority")
                    .order("priority", { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (priorityError) {
                    console.warn("⚠️ [useCreateCustomerType] Could not fetch max priority, using default:", priorityError)
                }

                const maxPriority = maxPriorityData?.priority ?? 0
                const nextPriority = maxPriority + 1

                const payload = {
                    name: name.trim(),
                    priority: nextPriority,
                }

                const { data, error } = await supabase
                    .from("customer_types")
                    .insert(payload)
                    .select("id, name")
                    .single()

                if (error) throw error

                toast({
                    title: "סוג לקוח נוצר",
                    description: `הסוג "${data.name}" נוסף בהצלחה.`,
                })

                console.log("✅ [useCreateCustomerType] Customer type created:", { id: data.id, name: data.name })
                
                if (options?.onSuccess) {
                    options.onSuccess(data.id, data.name)
                }

                return data.id
            } catch (error) {
                console.error("❌ [useCreateCustomerType] Failed to create customer type:", error)
                const errorMessage = error instanceof Error ? error.message : "לא ניתן ליצור את סוג הלקוח"
                toast({
                    title: "שגיאה ביצירת סוג לקוח",
                    description: errorMessage,
                    variant: "destructive",
                })
                return null
            }
        },
        [toast, options]
    )

    return { createCustomerType }
}


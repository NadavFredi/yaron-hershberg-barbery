import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuth } from "./useSupabaseAuth"

export function useManagerRole() {
  const { user, hasInitialized } = useSupabaseAuth()
  const [isManager, setIsManager] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkManagerRole = async () => {
      // Wait for auth to initialize before checking role
      if (!hasInitialized) {
        setIsLoading(true)
        return
      }

      // If auth initialized but no user, user is not a manager
      if (!user) {
        setIsManager(false)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).single()

        if (error) {
          console.error("[useManagerRole] Error checking manager role:", error)
          setIsManager(false)
        } else {
          const isUserManager = data?.role === "manager"
          console.log("[useManagerRole] Role check result:", {
            userId: user.id,
            role: data?.role,
            isManager: isUserManager,
          })
          setIsManager(isUserManager)
        }
      } catch (error) {
        console.error("Error checking manager role:", error)
        setIsManager(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkManagerRole()
  }, [user, hasInitialized])

  return { isManager, isLoading }
}

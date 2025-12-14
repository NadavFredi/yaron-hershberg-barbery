import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuth } from "./useSupabaseAuth"

export function useManagerRole() {
  const { user, hasInitialized } = useSupabaseAuth()
  const [isManager, setIsManager] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const userId = user?.id ?? null

  useEffect(() => {
    const checkManagerRole = async () => {
      // Wait for auth to initialize before checking role
      if (!hasInitialized) {
        setIsLoading(true)
        return
      }

      // If auth initialized but no user, user is not a manager
      if (!userId) {
        setIsManager(false)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).single()

        if (error) {
          setIsManager(false)
        } else {
          const isUserManager = data?.role === "manager"
          setIsManager(isUserManager)
        }
      } catch (error) {
        setIsManager(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkManagerRole()
  }, [userId, hasInitialized])

  return { isManager, isLoading }
}

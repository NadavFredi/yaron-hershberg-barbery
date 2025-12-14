import { useState, useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuth } from "./useSupabaseAuth"

/**
 * Hook to check if the current screen requires password protection
 * and if the password has been verified in this session
 */
export function useProtectedScreenPassword() {
  const { user } = useSupabaseAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [isProtected, setIsProtected] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [screenId, setScreenId] = useState<string | null>(null)

  useEffect(() => {
    checkIfScreenIsProtected()
  }, [location.pathname, searchParams, user])

  const checkIfScreenIsProtected = async () => {
    if (!user) {
      setIsProtected(false)
      setIsChecking(false)
      return
    }

    setIsChecking(true)

    try {
      // Determine screen ID based on route
      const currentScreenId = getScreenIdFromRoute(location.pathname, searchParams)
      setScreenId(currentScreenId)

      if (!currentScreenId) {
        setIsProtected(false)
        setIsChecking(false)
        return
      }

      // Check if this screen is protected
      const { data, error } = await supabase
        .from("manager_protected_screens")
        .select("is_protected")
        .eq("manager_id", user.id)
        .eq("screen_id", currentScreenId)
        .single()

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" which is fine
        console.error("Error checking protected screen:", error)
        setIsProtected(false)
      } else {
        setIsProtected(data?.is_protected || false)
      }
    } catch (error) {
      console.error("Error checking protected screen:", error)
      setIsProtected(false)
    } finally {
      setIsChecking(false)
    }
  }

  // Check if password was verified in this session
  const isPasswordVerified = () => {
    return sessionStorage.getItem("protected_screen_password_verified") === "true"
  }

  return {
    isProtected: isProtected || false,
    isChecking,
    screenId,
    isPasswordVerified,
    checkIfScreenIsProtected,
  }
}

/**
 * Get screen ID from current route
 */
function getScreenIdFromRoute(pathname: string, searchParams: URLSearchParams): string | null {
  // Manager dashboard
  if (pathname === "/manager") {
    return "manager"
  }

  // Manager screens with section parameter
  if (pathname === "/manager-screens") {
    const section = searchParams.get("section")
    const mode = searchParams.get("mode")

    if (section === "waiting-list") return "waiting-list"
    if (section === "appointments") return "appointments"
    if (section === "customers") {
      if (mode === "list" || !mode) return "customers-list"
      if (mode === "types") return "customer-types"
      if (mode === "sources") return "lead-sources"
      return "customers-list"
    }
    if (section === "workers") return "workers"
    if (section === "services") {
      if (mode === "services" || !mode) return "services"
      if (mode === "service-category") return "service-category"
      return "services"
    }
    if (section === "products") return "products"
    if (section === "payments") return "payments"
    if (section === "subscriptions") return "subscriptions"
    if (section === "reports") return "reports"
    if (section === "reminders") return "reminders"
    if (section === "settings") return "settings"
  }

  return null
}

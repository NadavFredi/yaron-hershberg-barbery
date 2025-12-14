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
        .maybeSingle()

      if (error) {
        console.error("Error checking protected screen:", error)
        setIsProtected(false)
      } else {
        // If no row found (data is null), screen is not protected
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

    // Appointments section
    if (section === "waiting-list") return "waiting-list"
    if (section === "appointments") return "appointments"

    // Customers section - from second-level children
    if (section === "customers") {
      if (mode === "list" || !mode) return "customers-list"
      if (mode === "types") return "customer-types"
      if (mode === "sources") return "lead-sources"
      return "customers-list"
    }

    // Services section - from second-level children
    if (section === "services") {
      if (mode === "services" || !mode) return "services"
      if (mode === "service-category") return "service-category"
      return "services"
    }

    // Workers section - from third-level items
    if (section === "workers") {
      if (mode === "workers" || !mode) return "workers-workers"
      if (mode === "shifts") return "workers-shifts"
      if (mode === "presence") return "workers-presence"
      return "workers-workers"
    }

    // Products section - from third-level items
    if (section === "products") {
      if (mode === "products" || !mode) return "products-products"
      if (mode === "brands") return "products-brands"
      return "products-products"
    }

    // Payments section - from third-level items
    if (section === "payments") {
      if (mode === "list" || !mode) return "payments-list"
      if (mode === "carts") return "payments-carts"
      if (mode === "debts") return "payments-debts"
      return "payments-list"
    }

    // Subscriptions section - from third-level items
    if (section === "subscriptions") {
      if (mode === "list" || !mode) return "subscriptions-list"
      if (mode === "types") return "subscriptions-types"
      return "subscriptions-list"
    }

    // Reports section - from third-level items
    if (section === "reports") {
      if (mode === "payments" || !mode) return "reports-payments"
      if (mode === "clients") return "reports-clients"
      if (mode === "appointments") return "reports-appointments"
      if (mode === "subscriptions") return "reports-subscriptions"
      if (mode === "shifts") return "reports-shifts"
      return "reports-payments"
    }

    // Reminders section - from third-level items
    if (section === "reminders") {
      if (mode === "settings" || !mode) return "reminders-settings"
      if (mode === "sent") return "reminders-sent"
      return "reminders-settings"
    }

    // Settings section - from third-level items
    if (section === "settings") {
      if (mode === "working-hours" || !mode) return "settings-working-hours"
      if (mode === "stations") return "settings-stations"
      if (mode === "stations-per-day") return "settings-stations-per-day"
      if (mode === "service-station-matrix") return "settings-service-station-matrix"
      if (mode === "constraints") return "settings-constraints"
      if (mode === "protected-screens") return "settings-protected-screens"
      return "settings-working-hours"
    }
  }

  return null
}

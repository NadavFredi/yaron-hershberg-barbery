import { useEffect } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useManagerRole } from "@/hooks/useManagerRole"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import { Loader2 } from "lucide-react"
import AdminLayout from "@/components/layout/AdminLayout"
import { SettingsProductsSection } from "@/components/settings/SettingsProductsSection/SettingsProductsSection"
import BrandsSection from "@/pages/BrandsSection"

const VALID_MODES = ["products", "brands"] as const

type ModeId = (typeof VALID_MODES)[number]

const isValidMode = (value: string | null): value is ModeId => {
  return Boolean(value && VALID_MODES.includes(value as ModeId))
}

export default function ProductsSection() {
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const { hasInitialized } = useSupabaseAuth()
    const { isManager, isLoading } = useManagerRole()

    const modeFromUrl = searchParams.get("mode")
    const currentSection = searchParams.get("section")
    const activeMode: ModeId = isValidMode(modeFromUrl) ? (modeFromUrl as ModeId) : "products"

    // Ensure URL always has section and mode for deep links/bookmarks
    useEffect(() => {
        if (location.pathname !== "/manager-screens") {
            return
        }

        if (currentSection && currentSection !== "products") {
            return
        }

        if (!isValidMode(modeFromUrl)) {
            setSearchParams({ section: "products", mode: activeMode }, { replace: true })
            return
        }

        if (currentSection !== "products") {
            setSearchParams({ section: "products", mode: activeMode }, { replace: true })
        }
    }, [location.pathname, currentSection, modeFromUrl, setSearchParams, activeMode])

    useEffect(() => {
        // Wait for auth to initialize before checking manager role
        console.log("[ProductsSection] Auth check:", { hasInitialized, isLoading, isManager })
        if (hasInitialized && !isLoading && isManager === false) {
            console.log("[ProductsSection] Redirecting to /manager - user is not a manager")
            navigate("/manager", { replace: true })
        }
    }, [hasInitialized, isManager, isLoading, navigate])

    // Wait for auth to initialize before showing anything
    if (!hasInitialized || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-4 text-gray-600">טוען...</span>
            </div>
        )
    }

    // After auth initialized, check if user is manager
    if (!isManager) {
        return null // Will redirect
    }

    return (
        <AdminLayout>
            <div className="min-h-screen bg-background py-6" dir="rtl">
                <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12">
                    {activeMode === "products" && <SettingsProductsSection />}
                    {activeMode === "brands" && <BrandsSection />}
                </div>
            </div>
        </AdminLayout>
    )
}


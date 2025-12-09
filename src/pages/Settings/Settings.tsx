import { useEffect, useState, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useManagerRole } from "@/hooks/useManagerRole"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import AdminLayout from "@/components/layout/AdminLayout"
import { SettingsWorkingHoursSection } from "@/components/settings/SettingsWorkingHoursSection/SettingsWorkingHoursSection"
import { SettingsStationsSection } from "@/components/settings/SettingsStationsSection/SettingsStationsSection"
import { SettingsStationsPerDaySection } from "@/components/settings/SettingsStationsPerDaySection/SettingsStationsPerDaySection"
import { SettingsServiceStationMatrixSection } from "@/components/settings/SettingsServiceStationMatrixSection/SettingsServiceStationMatrixSection"
import { SettingsConstraintsSection } from "@/components/settings/SettingsConstraintsSection/SettingsConstraintsSection"
const VALID_SECTIONS = ["working-hours", "stations", "stations-per-day", "service-station-matrix", "constraints"] as const
type SectionId = typeof VALID_SECTIONS[number]

export default function Settings() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { hasInitialized } = useSupabaseAuth()
    const { isManager, isLoading } = useManagerRole()

    // Get initial section from URL param or default to "working-hours"
    // Also check if constraintId is present, which means we should open constraints section
    const constraintId = searchParams.get("constraintId")
    const sectionFromUrl = searchParams.get("mode")
    const initialSection = (constraintId ? "constraints" : (sectionFromUrl && VALID_SECTIONS.includes(sectionFromUrl as SectionId)
        ? sectionFromUrl
        : "working-hours"))

    const [activeSection, setActiveSection] = useState<string>(initialSection)
    const isUserNavigationRef = useRef(false)

    // Sync activeSection with URL param when URL changes (e.g., browser back/forward)
    useEffect(() => {
        // Skip if this change was triggered by user clicking a tab
        if (isUserNavigationRef.current) {
            isUserNavigationRef.current = false
            return
        }

        const urlSection = searchParams.get("mode")
        // Only update if URL has a valid section that differs from current state
        if (urlSection && VALID_SECTIONS.includes(urlSection as SectionId) && urlSection !== activeSection) {
            console.log("[Settings] URL mode param changed (browser navigation), updating active section:", urlSection)
            setActiveSection(urlSection)
        }
    }, [searchParams, activeSection])

    // Handle section change from URL (when ThirdLevelSubnav changes it)
    useEffect(() => {
        const urlSection = searchParams.get("mode")
        if (urlSection && VALID_SECTIONS.includes(urlSection as SectionId)) {
            isUserNavigationRef.current = true
            setActiveSection(urlSection)
        }
    }, [searchParams])

    useEffect(() => {
        // Wait for auth to initialize before checking manager role
        console.log("[Settings] Auth check:", { hasInitialized, isLoading, isManager })
        if (hasInitialized && !isLoading && isManager === false) {
            console.log("[Settings] Redirecting to /manager - user is not a manager")
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
                    {/* Active Section Content - Only render the active section to avoid unnecessary API calls */}
                    {activeSection === "working-hours" && <SettingsWorkingHoursSection />}
                    {activeSection === "stations" && <SettingsStationsSection />}
                    {activeSection === "stations-per-day" && <SettingsStationsPerDaySection />}
                    {activeSection === "service-station-matrix" && <SettingsServiceStationMatrixSection />}
                    {activeSection === "constraints" && <SettingsConstraintsSection />}
                </div>
            </div>
        </AdminLayout>
    )
}

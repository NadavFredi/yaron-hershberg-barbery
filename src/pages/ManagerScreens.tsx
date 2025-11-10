import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useManagerRole } from "@/hooks/useManagerRole"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import Settings from "@/pages/Settings/Settings"
import WaitingListPage from "@/pages/WaitingListPage"
import CustomersSection from "@/pages/CustomersSection"
import TreatmentsSection from "@/pages/TreatmentsSection"
import AppointmentsSection from "@/pages/AppointmentsSection"
import WorkersSection from "@/pages/WorkersSection"

const VALID_SECTIONS = ["settings", "waiting-list", "customers", "treatments", "appointments", "workers"] as const
type SectionId = typeof VALID_SECTIONS[number]

export default function ManagerScreens() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { hasInitialized } = useSupabaseAuth()
    const { isManager, isLoading } = useManagerRole()

    // Get initial section from URL param or default to "settings"
    const sectionFromUrl = searchParams.get("section")
    const initialSection = (sectionFromUrl && VALID_SECTIONS.includes(sectionFromUrl as SectionId)
        ? sectionFromUrl
        : "settings")

    const [activeSection, setActiveSection] = useState<string>(initialSection)

    // Update active section when URL changes (e.g., from dropdown)
    useEffect(() => {
        const sectionFromUrl = searchParams.get("section")
        if (sectionFromUrl && VALID_SECTIONS.includes(sectionFromUrl as SectionId)) {
            setActiveSection(sectionFromUrl)
        }
    }, [searchParams])

    useEffect(() => {
        // Wait for auth to initialize before checking manager role
        if (hasInitialized && !isLoading && isManager === false) {
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
        <div className="min-h-screen" dir="rtl">
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-12 xl:px-20">
                <div className="pt-0 pb-4 sm:pb-6">
                    {activeSection === "settings" && <Settings />}
                    {activeSection === "waiting-list" && <WaitingListPage />}
                    {activeSection === "customers" && <CustomersSection />}
                    {activeSection === "treatments" && <TreatmentsSection />}
                    {activeSection === "appointments" && <AppointmentsSection />}
          {activeSection === "workers" && <WorkersSection />}
                </div>
            </div>
        </div>
    )
}

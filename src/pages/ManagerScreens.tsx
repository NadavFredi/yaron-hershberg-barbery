import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useManagerRole } from "@/hooks/useManagerRole"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import Settings from "@/pages/Settings/Settings"
import WaitingListPage from "@/pages/WaitingListPage"
import CustomersSection from "@/pages/CustomersSection"
import DogsSection from "@/pages/DogsSection"
import AppointmentsSection from "@/pages/AppointmentsSection"
import WorkersSection from "@/pages/WorkersSection"
import ProductsSection from "@/pages/ProductsSection"
import PaymentsSection from "@/pages/PaymentsSection"
import SubscriptionsSection from "@/pages/SubscriptionsSection"
import ReportsSection from "@/pages/ReportsSection"
import RemindersPage from "@/pages/RemindersPage"

const VALID_SECTIONS = ["settings", "waiting-list", "customers", "dogs", "appointments", "workers", "products", "payments", "subscriptions", "reports", "reminders"] as const
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
            <div className="mx-auto w-full  ">
                <div className="pt-0 pb-4 sm:pb-6">
                    {activeSection === "settings" && <Settings />}
                    {activeSection === "waiting-list" && <WaitingListPage />}
                    {activeSection === "customers" && <CustomersSection />}
                    {activeSection === "dogs" && <DogsSection />}
                    {activeSection === "appointments" && <AppointmentsSection />}
                    {activeSection === "workers" && <WorkersSection />}
                    {activeSection === "products" && <ProductsSection />}
                    {activeSection === "payments" && <PaymentsSection />}
                    {activeSection === "subscriptions" && <SubscriptionsSection />}
                    {activeSection === "reports" && <ReportsSection />}
                    {activeSection === "reminders" && <RemindersPage />}
                </div>
            </div>
        </div>
    )
}

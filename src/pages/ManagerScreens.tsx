import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useManagerRole } from "@/hooks/useManagerRole"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import { useProtectedScreenPassword } from "@/hooks/useProtectedScreenPassword"
import { ProtectedScreenPasswordDialog } from "@/components/dialogs/ProtectedScreenPasswordDialog"
import Settings from "@/pages/Settings/Settings"
import WaitingListPage from "@/pages/WaitingListPage"
import CustomersSection from "@/pages/CustomersSection"
import AppointmentsSection from "@/pages/AppointmentsSection"
import WorkersSection from "@/pages/WorkersSection"
import ServicesSection from "@/pages/ServicesSection"
import ProductsSection from "@/pages/ProductsSection"
import PaymentsSection from "@/pages/PaymentsSection"
import SubscriptionsSection from "@/pages/SubscriptionsSection"
import ReportsSection from "@/pages/ReportsSection"
import RemindersPage from "@/pages/RemindersPage"

const VALID_SECTIONS = ["settings", "waiting-list", "customers", "appointments", "workers", "services", "products", "payments", "subscriptions", "reports", "reminders"] as const
type SectionId = typeof VALID_SECTIONS[number]

// Map screen IDs to their Hebrew labels
const SCREEN_NAMES: Record<string, string> = {
    "manager": "לוח מנהל",
    "waiting-list": "רשימת המתנה",
    "appointments": "ניהול תורים",
    "customers-list": "רשימת לקוחות",
    "customer-types": "סוגי לקוחות",
    "lead-sources": "מקורות הגעה",
    "workers": "עובדים",
    "services": "שירותים",
    "service-category": "קטגוריות שירותים",
    "products": "מוצרים",
    "payments": "תשלומים",
    "subscriptions": "מנויים",
    "reports": "דוחות",
    "reminders": "תזכורות תורים",
    "settings": "הגדרות",
}

export default function ManagerScreens() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { hasInitialized } = useSupabaseAuth()
    const { isManager, isLoading } = useManagerRole()
    const { isProtected, isChecking, screenId, isPasswordVerified } = useProtectedScreenPassword()
    const [showPasswordDialog, setShowPasswordDialog] = useState(false)

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

    // Check if password is required when screen changes
    useEffect(() => {
        if (!isChecking && hasInitialized && isManager) {
            if (isProtected && !isPasswordVerified()) {
                setShowPasswordDialog(true)
            }
        }
    }, [isProtected, isChecking, hasInitialized, isManager, isPasswordVerified])

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

    // Show loading while checking protection status
    if (isChecking) {
        return (
            <div className="flex items-center justify-center min-h-screen" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-4 text-gray-600">טוען...</span>
            </div>
        )
    }

    // Don't render content if protected and password not verified
    if (isProtected && !isPasswordVerified() && !showPasswordDialog) {
        return null
    }

    const screenName = screenId ? SCREEN_NAMES[screenId] || screenId : undefined

    return (
        <>
            <ProtectedScreenPasswordDialog
                open={showPasswordDialog}
                onClose={() => {
                    setShowPasswordDialog(false)
                    // Redirect to manager dashboard if password cancelled
                    if (!isPasswordVerified()) {
                        navigate("/manager")
                    }
                }}
                onSuccess={() => {
                    setShowPasswordDialog(false)
                }}
                screenName={screenName}
            />
            <div className="min-h-screen" dir="rtl">
                <div className="mx-auto w-full  ">
                    <div className="pt-0 pb-4 sm:pb-6">
                        {activeSection === "settings" && <Settings />}
                        {activeSection === "waiting-list" && <WaitingListPage />}
                        {activeSection === "customers" && <CustomersSection />}
                        {activeSection === "appointments" && <AppointmentsSection />}
                        {activeSection === "workers" && <WorkersSection />}
                        {activeSection === "services" && <ServicesSection />}
                        {activeSection === "products" && <ProductsSection />}
                        {activeSection === "payments" && <PaymentsSection />}
                        {activeSection === "subscriptions" && <SubscriptionsSection />}
                        {activeSection === "reports" && <ReportsSection />}
                        {activeSection === "reminders" && <RemindersPage />}
                    </div>
                </div>
            </div>
        </>
    )
}

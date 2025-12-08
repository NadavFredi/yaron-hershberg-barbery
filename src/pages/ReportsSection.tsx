import { useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import PaymentsReport from "@/pages/reports/PaymentsReport"
import ClientsReport from "@/pages/reports/ClientsReport"
import AppointmentsReport from "@/pages/reports/AppointmentsReport"
import SubscriptionsReport from "@/pages/reports/SubscriptionsReport"
import EmployeeShiftsReport from "@/pages/reports/EmployeeShiftsReport"

export default function ReportsSection() {
    const [searchParams] = useSearchParams()
    const mode = searchParams.get("mode") || "payments"

    return (
        <div className="min-h-screen bg-background" dir="rtl">
            <div className="mx-auto w-full max-w-[95%] px-2 sm:px-3 lg:px-4 py-4">
                {mode === "payments" && <PaymentsReport />}
                {mode === "clients" && <ClientsReport />}
                {mode === "appointments" && <AppointmentsReport />}
                {mode === "subscriptions" && <SubscriptionsReport />}
                {mode === "shifts" && <EmployeeShiftsReport />}
                {!["payments", "clients", "appointments", "subscriptions", "shifts"].includes(mode) && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                            <p className="text-gray-600">טוען דוח...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}


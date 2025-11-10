import { useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import TreatmentPlansListPage from "@/pages/TreatmentPlansListPage"
import { TreatmentsSubnav } from "@/components/navigation/TreatmentsSubnav"
import TreatmentCategoriesManagementPage from "@/pages/treatments/TreatmentCategoriesManagementPage"

const VALID_MODES = ["list", "category1", "category2"] as const

type ModeId = (typeof VALID_MODES)[number]

const isValidMode = (value: string | null): value is ModeId => {
    return Boolean(value && VALID_MODES.includes(value as ModeId))
}

export default function TreatmentsSection() {
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()

    const modeFromUrl = searchParams.get("mode")
    const currentSection = searchParams.get("section")
    const activeMode: ModeId = isValidMode(modeFromUrl) ? (modeFromUrl as ModeId) : "list"

    useEffect(() => {
        if (location.pathname !== "/manager-screens") {
            return
        }

        if (currentSection && currentSection !== "treatments") {
            return
        }

        if (!isValidMode(modeFromUrl)) {
            setSearchParams({ section: "treatments", mode: activeMode }, { replace: true })
            return
        }

        if (currentSection !== "treatments") {
            setSearchParams({ section: "treatments", mode: activeMode }, { replace: true })
        }
    }, [location.pathname, currentSection, modeFromUrl, setSearchParams, activeMode])

    const handleModeChange = (mode: ModeId) => {
        console.log("[TreatmentsSection] Switching mode:", mode)
        setSearchParams({ section: "treatments", mode }, { replace: true })
    }

    return (
        <div className="min-h-screen" dir="rtl">
            <TreatmentsSubnav activeMode={activeMode} onModeChange={handleModeChange} />
            <div className="bg-background py-6">
                <div className="mx-auto w-full px-1 sm:px-2 lg:px-3">
                    {activeMode === "list" && <TreatmentPlansListPage />}
                    {activeMode === "category1" && <TreatmentCategoriesManagementPage variant="category1" />}
                    {activeMode === "category2" && <TreatmentCategoriesManagementPage variant="category2" />}
                </div>
            </div>
        </div>
    )
}


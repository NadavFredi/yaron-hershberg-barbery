import { useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import DogsListPage from "@/pages/DogsListPage"
import { DogsSubnav } from "@/components/navigation/DogsSubnav"
import DogCategoriesManagementPage from "@/pages/dogs/DogCategoriesManagementPage"

const VALID_MODES = ["list", "category1", "category2"] as const

type ModeId = (typeof VALID_MODES)[number]

const isValidMode = (value: string | null): value is ModeId => {
    return Boolean(value && VALID_MODES.includes(value as ModeId))
}

export default function DogsSection() {
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()

    const modeFromUrl = searchParams.get("mode")
    const currentSection = searchParams.get("section")
    const activeMode: ModeId = isValidMode(modeFromUrl) ? (modeFromUrl as ModeId) : "list"

    useEffect(() => {
        if (location.pathname !== "/manager-screens") {
            return
        }

        if (currentSection && currentSection !== "dogs") {
            return
        }

        if (!isValidMode(modeFromUrl)) {
            setSearchParams({ section: "dogs", mode: activeMode }, { replace: true })
            return
        }

        if (currentSection !== "dogs") {
            setSearchParams({ section: "dogs", mode: activeMode }, { replace: true })
        }
    }, [location.pathname, currentSection, modeFromUrl, setSearchParams, activeMode])

    const handleModeChange = (mode: ModeId) => {
        console.log("[DogsSection] Switching mode:", mode)
        setSearchParams({ section: "dogs", mode }, { replace: true })
    }

    return (
        <div className="min-h-screen" dir="rtl">
            <DogsSubnav activeMode={activeMode} onModeChange={handleModeChange} />
            <div className="bg-background py-6">
                <div className="mx-auto w-full px-1 sm:px-2 lg:px-3">
                    {activeMode === "list" && <DogsListPage />}
                    {activeMode === "category1" && <DogCategoriesManagementPage variant="category1" />}
                    {activeMode === "category2" && <DogCategoriesManagementPage variant="category2" />}
                </div>
            </div>
        </div>
    )
}


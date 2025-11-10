import { useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import CustomersListPage from "@/pages/CustomersListPage"
import { CustomersSubnav } from "@/components/navigation/CustomersSubnav"

const VALID_MODES = ["list"] as const

type ModeId = (typeof VALID_MODES)[number]

const isValidMode = (value: string | null): value is ModeId => {
  return Boolean(value && VALID_MODES.includes(value as ModeId))
}

export default function CustomersSection() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const modeFromUrl = searchParams.get("mode")
  const currentSection = searchParams.get("section")
  const activeMode: ModeId = isValidMode(modeFromUrl) ? (modeFromUrl as ModeId) : "list"

  // Ensure URL always has section and mode for deep links/bookmarks
  useEffect(() => {
    if (location.pathname !== "/manager-screens") {
      return
    }

    if (currentSection && currentSection !== "customers") {
      return
    }

    if (!isValidMode(modeFromUrl)) {
      setSearchParams({ section: "customers", mode: activeMode }, { replace: true })
      return
    }

    if (currentSection !== "customers") {
      setSearchParams({ section: "customers", mode: activeMode }, { replace: true })
    }
  }, [location.pathname, currentSection, modeFromUrl, setSearchParams, activeMode])

  const handleModeChange = (mode: ModeId) => {
    console.log("[CustomersSection] Switching mode:", mode)
    setSearchParams({ section: "customers", mode }, { replace: true })
  }

  return (
    <div className="min-h-screen" dir="rtl">
      <CustomersSubnav activeMode={activeMode} onModeChange={handleModeChange} />
      <div className="bg-background py-6">
        <div className="mx-auto w-full px-1 sm:px-2 lg:px-3">
          {activeMode === "list" && <CustomersListPage />}
        </div>
      </div>
    </div>
  )
}

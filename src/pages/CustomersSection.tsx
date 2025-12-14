import { useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import CustomersListPage from "@/pages/CustomersListPage"
import CustomerTypesPage from "@/pages/CustomerTypesPage"
import LeadSourcesPage from "@/pages/LeadSourcesPage"

const VALID_MODES = ["list", "types", "sources"] as const

type ModeId = (typeof VALID_MODES)[number]

const isValidMode = (value: string | null): value is ModeId => {
  return Boolean(value && VALID_MODES.includes(value as ModeId))
}

export default function CustomersSection() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const modeFromUrl = searchParams.get("mode")
  const currentSection = searchParams.get("section")
  const typeParam = searchParams.get("type")
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
      const params: Record<string, string> = { section: "customers", mode: activeMode }
      if (typeParam) {
        params.type = typeParam
      }
      setSearchParams(params, { replace: true })
      return
    }

    if (currentSection !== "customers") {
      const params: Record<string, string> = { section: "customers", mode: activeMode }
      if (typeParam) {
        params.type = typeParam
      }
      setSearchParams(params, { replace: true })
    }
  }, [location.pathname, currentSection, modeFromUrl, setSearchParams, activeMode, typeParam])

  return (
    <div className="min-h-screen" dir="rtl">
      <div className="bg-background py-6">
        <div className="mx-auto w-full px-1 sm:px-2 lg:px-3">
          {activeMode === "list" && <CustomersListPage />}
          {activeMode === "types" && <CustomerTypesPage />}
          {activeMode === "sources" && <LeadSourcesPage />}
        </div>
      </div>
    </div>
  )
}

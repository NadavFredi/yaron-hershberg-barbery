import { useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import SubscriptionsListPage from "@/pages/SubscriptionsListPage"
import SubscriptionTypesPage from "@/pages/SubscriptionTypesPage"

const VALID_MODES = ["list", "types"] as const

type ModeId = (typeof VALID_MODES)[number]

const isValidMode = (value: string | null): value is ModeId => {
  return Boolean(value && VALID_MODES.includes(value as ModeId))
}

export default function SubscriptionsSection() {
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

    if (currentSection && currentSection !== "subscriptions") {
      return
    }

    if (!isValidMode(modeFromUrl)) {
      const params: Record<string, string> = { section: "subscriptions", mode: activeMode }
      if (typeParam) {
        params.type = typeParam
      }
      setSearchParams(params, { replace: true })
      return
    }

    if (currentSection !== "subscriptions") {
      const params: Record<string, string> = { section: "subscriptions", mode: activeMode }
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
          {activeMode === "list" && <SubscriptionsListPage />}
          {activeMode === "types" && <SubscriptionTypesPage />}
        </div>
      </div>
    </div>
  )
}


import { useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import PaymentsListPage from "@/pages/PaymentsListPage"
import CartsSection from "@/pages/CartsSection"

const VALID_MODES = ["list", "carts"] as const

type ModeId = (typeof VALID_MODES)[number]

const isValidMode = (value: string | null): value is ModeId => {
  return Boolean(value && VALID_MODES.includes(value as ModeId))
}

export default function PaymentsSection() {
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

    if (currentSection && currentSection !== "payments") {
      return
    }

    if (!isValidMode(modeFromUrl)) {
      setSearchParams({ section: "payments", mode: activeMode }, { replace: true })
      return
    }

    if (currentSection !== "payments") {
      setSearchParams({ section: "payments", mode: activeMode }, { replace: true })
    }
  }, [location.pathname, currentSection, modeFromUrl, setSearchParams, activeMode])

  return (
    <div className="min-h-screen" dir="rtl">
      <div className="bg-background py-6">
        <div className="mx-auto w-full px-1 sm:px-2 lg:px-3">
          {activeMode === "list" && <PaymentsListPage />}
          {activeMode === "carts" && <CartsSection />}
        </div>
      </div>
    </div>
  )
}


import { useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import ServicesListPage from "@/pages/ServicesListPage"

export default function ServicesSection() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentSection = searchParams.get("section")

  // Ensure URL always has section for deep links/bookmarks
  useEffect(() => {
    if (location.pathname !== "/manager-screens") {
      return
    }

    if (currentSection && currentSection !== "services") {
      return
    }

    if (currentSection !== "services") {
      setSearchParams({ section: "services" }, { replace: true })
    }
  }, [location.pathname, currentSection, setSearchParams])

  return (
    <div className="min-h-screen" dir="rtl">
      <div className="bg-background py-6">
        <div className="mx-auto w-full px-1 sm:px-2 lg:px-3">
          <ServicesListPage />
        </div>
      </div>
    </div>
  )
}


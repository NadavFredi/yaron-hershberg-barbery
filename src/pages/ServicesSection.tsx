import { useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import ServicesListPage from "@/pages/ServicesListPage"
import ServiceCategoriesPage from "@/pages/ServiceCategoriesPage"

export default function ServicesSection() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentSection = searchParams.get("section")
  const modeParam = searchParams.get("mode")

  // Ensure URL always has section and mode for deep links/bookmarks
  useEffect(() => {
    if (location.pathname !== "/manager-screens") {
      return
    }

    if (currentSection && currentSection !== "services") {
      return
    }

    if (currentSection !== "services") {
      setSearchParams({ section: "services", mode: "services" }, { replace: true })
      return
    }

    // If section is services but no mode, default to services
    if (currentSection === "services" && !modeParam) {
      setSearchParams({ section: "services", mode: "services" }, { replace: true })
    }
  }, [location.pathname, currentSection, modeParam, setSearchParams])

  const activeMode = modeParam === "service-category" ? "service-category" : "services"

  return (
    <div className="min-h-screen" dir="rtl">
      <div className="bg-background py-6">
        <div className="mx-auto w-full px-1 sm:px-2 lg:px-3">
          {activeMode === "service-category" && <ServiceCategoriesPage />}
          {activeMode === "services" && <ServicesListPage />}
        </div>
      </div>
    </div>
  )
}


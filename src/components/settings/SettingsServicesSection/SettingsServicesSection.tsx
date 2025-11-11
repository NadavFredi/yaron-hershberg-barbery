import { useState } from "react"
import ServiceLibrary from "@/components/admin/ServiceLibrary"
import ServiceEditor from "@/components/admin/ServiceEditor"

export function SettingsServicesSection() {
  const [currentView, setCurrentView] = useState<"library" | "editor">("library")
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  const handleEditService = (serviceId: string) => {
    setSelectedServiceId(serviceId)
    setCurrentView("editor")
  }

  const handleBackToLibrary = () => {
    setCurrentView("library")
    setSelectedServiceId(null)
  }

  return (
    <div className="space-y-6" dir="rtl">
      {currentView === "library" && (
        <ServiceLibrary onEditService={handleEditService} />
      )}

      {currentView === "editor" && selectedServiceId && (
        <ServiceEditor serviceId={selectedServiceId} onBack={handleBackToLibrary} />
      )}
    </div>
  )
}


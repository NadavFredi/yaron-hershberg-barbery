import React, { useEffect, useRef } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { AlertCircle, Building2, Clock, Scissors } from "lucide-react"

interface SettingsSubnavProps { }

export const SETTINGS_SECTIONS = [
  { id: "working-hours", label: "שעות עבודה גלובליות", icon: <Clock className="h-4 w-4" /> },
  { id: "stations", label: "ניהול עמדות", icon: <Building2 className="h-4 w-4" /> },
  { id: "services", label: "ניהול שירותים", icon: <Scissors className="h-4 w-4" /> },
  { id: "constraints", label: "אילוצים", icon: <AlertCircle className="h-4 w-4" /> },
] as const

export function SettingsSubnav({ }: SettingsSubnavProps) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const subnavRef = useRef<HTMLDivElement | null>(null)

  // Only show when settings section is active
  const isSettingsActive = location.pathname === "/manager-screens" && searchParams.get("section") === "settings"

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isSettingsActive) {
      document.documentElement.style.setProperty("--settings-subnav-height", "0px")
    }
  }, [isSettingsActive])

  useEffect(() => {
    if (!isSettingsActive || !subnavRef.current || typeof window === "undefined") {
      return
    }

    const updateHeight = () => {
      const height = subnavRef.current?.offsetHeight ?? 0
      document.documentElement.style.setProperty("--settings-subnav-height", `${height}px`)
    }

    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(subnavRef.current)

    return () => {
      observer.disconnect()
      document.documentElement.style.setProperty("--settings-subnav-height", "0px")
    }
  }, [isSettingsActive])

  if (!isSettingsActive) {
    return null
  }

  const currentMode = searchParams.get("mode") || "working-hours"

  const handleSectionChange = (sectionId: string) => {
    // Keep section=settings in URL to maintain ManagerSubnav visibility
    setSearchParams({ section: "settings", mode: sectionId }, { replace: true })
  }

  return (
    <div
      ref={subnavRef}
      className="hidden xl:block xl:z-30 xl:-mt-px xl:bg-gradient-to-r xl:from-indigo-50 xl:to-purple-50 xl:border-b xl:border-indigo-200/50 xl:shadow-sm xl:border-t xl:border-indigo-200/30"
    >
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <nav
          className="flex flex-wrap items-center justify-center gap-2 overflow-x-auto py-2"
          aria-label="תפריט הגדרות"
        >
          {SETTINGS_SECTIONS.map((section) => {
            const isActive = currentMode === section.id

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSectionChange(section.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-700 hover:text-indigo-600 hover:bg-white/80"
                )}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

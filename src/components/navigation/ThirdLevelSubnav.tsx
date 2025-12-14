import React, { useEffect, useRef } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import { setIsSubnavHovered, setIsNavbarHovered } from "@/store/slices/navbarSlice"
import {
  Tag,
  Ticket,
  CreditCard,
  ShoppingCart,
  Package,
  BarChart3,
  AlertCircle,
  Building2,
  Clock,
  CalendarDays,
  UserCog,
  ListChecks,
  ClipboardList,
  TrendingUp,
  PieChart,
  DollarSign,
  Calendar,
  Users as UsersIcon,
  Settings,
  History,
  Grid3x3,
  Lock,
} from "lucide-react"

// Define all third level navigation sections
export const THIRD_LEVEL_SECTIONS = {
  settings: [
    { id: "working-hours", label: "שעות עבודה גלובליות", icon: Clock },
    { id: "stations", label: "ניהול עמדות", icon: Building2 },
    { id: "stations-per-day", label: "עמדות לפי יום", icon: CalendarDays },
    { id: "service-station-matrix", label: "מטריצת שירותים-עמדות", icon: Grid3x3 },
    { id: "constraints", label: "אילוצים", icon: AlertCircle },
    { id: "protected-screens", label: "מסכים מוגנים", icon: Lock },
  ],
  subscriptions: [
    { id: "list", label: "מנויים", description: "ניהול רשימת מנויים", icon: Ticket },
    { id: "types", label: "סוגי מנויים", description: "הגדרת סוגים ומחירים", icon: Tag },
  ],
  payments: [
    { id: "list", label: "תשלומים", description: "רשימת תשלומים", icon: CreditCard },
    { id: "carts", label: "עגלות", description: "ניהול עגלות קניות", icon: ShoppingCart },
    { id: "debts", label: "חובות", description: "ניהול חובות לקוחות", icon: DollarSign },
  ],
  products: [
    { id: "products", label: "מוצרים", description: "ניהול רשימת מוצרים", icon: Package },
    { id: "brands", label: "מותגים", description: "ניהול מותגים", icon: Tag },
  ],
  workers: [
    { id: "workers", label: "עובדים", description: "ניהול רשימת עובדים", icon: UserCog },
    { id: "shifts", label: "משמרות עובדים", description: "ניהול משמרות עובדים", icon: ListChecks },
    { id: "presence", label: "דיווח נוכחות", description: "ניהול נוכחות עובדים בזמן אמת", icon: ClipboardList },
  ],
  reports: [
    { id: "payments", label: "תשלומים", description: "דוחות תשלומים מפורטים", icon: DollarSign },
    { id: "clients", label: "לקוחות", description: "סטטיסטיקות לקוחות", icon: UsersIcon },
    { id: "appointments", label: "תורים", description: "ניתוח תורים ועמדות", icon: Calendar },
    { id: "subscriptions", label: "מנויים", description: "דוחות מנויים", icon: Ticket },
    { id: "shifts", label: "משמרות עובדים", description: "דוחות משמרות", icon: Clock },
  ],
  reminders: [
    { id: "settings", label: "הגדרות", description: "הגדרת תזכורות אוטומטיות", icon: Settings },
    { id: "sent", label: "תזכורות שנשלחו", description: "היסטוריית תזכורות שנשלחו ללקוחות", icon: History },
  ],
} as const

type SectionKey = keyof typeof THIRD_LEVEL_SECTIONS

export function ThirdLevelSubnav() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const subnavRef = useRef<HTMLDivElement | null>(null)
  const dispatch = useAppDispatch()
  const { isNavbarPinned, isNavbarVisible, isOnManagerBoard, isSubnavHovered } = useAppSelector(
    (state) => state.navbar
  )

  // Handle both /settings route and /manager-screens?section=settings
  const currentSectionFromUrl = searchParams.get("section") as SectionKey | null
  const isSettingsRoute = location.pathname === "/settings"
  const currentSection: SectionKey | null = isSettingsRoute ? "settings" : currentSectionFromUrl
  const currentMode = searchParams.get("mode") || ""

  // Get sections for current section, or empty array if not found
  const sections = currentSection && currentSection in THIRD_LEVEL_SECTIONS
    ? THIRD_LEVEL_SECTIONS[currentSection]
    : []

  // Only show when we have a valid section with third level navigation
  const shouldShow = Boolean(currentSection && sections.length > 0)

  // Collapse when navbar is collapsed on manager pages, unless hovered
  const isCollapsed = isOnManagerBoard && !isNavbarPinned && !isNavbarVisible && !isSubnavHovered

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!shouldShow) {
      document.documentElement.style.setProperty("--third-level-subnav-height", "0px")
    }
  }, [shouldShow])

  useEffect(() => {
    if (!shouldShow || !subnavRef.current || typeof window === "undefined") {
      return
    }

    const updateHeight = () => {
      const height = subnavRef.current?.offsetHeight ?? 0
      document.documentElement.style.setProperty("--third-level-subnav-height", `${height}px`)
    }

    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(subnavRef.current)

    return () => {
      observer.disconnect()
      document.documentElement.style.setProperty("--third-level-subnav-height", "0px")
    }
  }, [shouldShow])

  if (!shouldShow) {
    return null
  }

  const handleSectionChange = (sectionId: string) => {
    // Keep the current section in URL and update mode
    if (currentSection) {
      const isSettingsRoute = location.pathname === "/settings"
      if (isSettingsRoute) {
        // For /settings route, just update mode param
        setSearchParams({ mode: sectionId }, { replace: true })
      } else {
        // For /manager-screens route, update both section and mode
        setSearchParams({ section: currentSection, mode: sectionId }, { replace: true })
      }
    }
  }

  // Get aria label based on section
  const ariaLabels: Record<SectionKey, string> = {
    settings: "תפריט הגדרות",
    subscriptions: "תפריט מנויים",
    payments: "תפריט תשלומים",
    products: "תפריט מוצרים",
    workers: "תפריט עובדים",
    reports: "תפריט דוחות",
    reminders: "תפריט תזכורות",
  }

  return (
    <div
      ref={subnavRef}
      data-nav-level="3"
      className={cn(
        "hidden xl:block xl:z-20 xl:-mt-px xl:bg-gradient-to-r xl:from-indigo-50 xl:to-purple-50 xl:border-b xl:border-indigo-200/50 xl:shadow-sm xl:border-t xl:border-indigo-200/30 transition-all duration-300",
        isCollapsed && "xl:opacity-0 xl:max-h-0 xl:overflow-hidden"
      )}
      onMouseEnter={() => {
        if (isOnManagerBoard && !isNavbarPinned) {
          console.log("[ThirdLevelSubnav] Mouse entered - setting isSubnavHovered(true)")
          dispatch(setIsSubnavHovered(true))
        }
      }}
      onMouseLeave={(e) => {
        if (isOnManagerBoard && !isNavbarPinned) {
          const relatedTarget = e.relatedTarget as HTMLElement | null
          // Don't hide if moving to another nav level (1/2/3) or hover zone
          const navLevelTarget = relatedTarget?.closest("[data-nav-level]")
          const isMovingWithinNavLevels = Boolean(navLevelTarget) || !!relatedTarget?.closest('[data-nav-hover-zone="true"]')
          console.log("[ThirdLevelSubnav] Mouse left", { relatedTarget: relatedTarget?.tagName, navLevel: (navLevelTarget as HTMLElement | null)?.dataset.navLevel, isMovingWithinNavLevels })
          // If relatedTarget is null (moving to content below) or not moving within nav levels, hide
          if (!relatedTarget || !isMovingWithinNavLevels) {
            console.log("[ThirdLevelSubnav] Setting isSubnavHovered(false)")
            dispatch(setIsSubnavHovered(false))
            dispatch(setIsNavbarHovered(false))
          } else {
            console.log("[ThirdLevelSubnav] NOT setting isSubnavHovered(false) - moving within nav levels/hover zone")
          }
        }
      }}
    >
      <div className="max-w-full mx-auto px-6 sm:px-8 lg:px-12">
        <nav
          className="flex flex-wrap items-center justify-center gap-2 overflow-x-auto py-3"
          aria-label={currentSection ? ariaLabels[currentSection] : "תפריט משנה"}
        >
          {sections.map((section) => {
            const isActive = currentMode === section.id
            const IconComponent = section.icon as React.ComponentType<{ className?: string }>

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSectionChange(section.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-700 hover:text-indigo-600 hover:bg-white/80 hover:shadow-sm"
                )}
              >
                <IconComponent className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{section.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

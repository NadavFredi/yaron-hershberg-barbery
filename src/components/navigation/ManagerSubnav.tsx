import React, { useEffect, useRef } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import { setIsSubnavHovered, setIsNavbarHovered, setIsNavbarPinned } from "@/store/slices/navbarSlice"
import {
  Settings,
  CalendarClock,
  Users,
  LayoutDashboard,
  ClipboardList,
  UserCog,
  Package,
  CreditCard,
  Ticket,
  BarChart3,
  Bell,
  Wrench,
  FolderTree,
  List,
  HelpCircle
} from "lucide-react"

interface ManagerSubnavProps {
  isManager: boolean
}

export interface ManagerNavChild {
  id: string
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  match: (pathname: string, sectionParam?: string | null, modeParam?: string | null) => boolean
}

export interface ManagerNavSection {
  id: string
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  match: (pathname: string, sectionParam?: string | null, modeParam?: string | null) => boolean
  children?: ManagerNavChild[]
}

export const APPOINTMENT_CHILD_LINKS: ManagerNavChild[] = [
  {
    id: "dashboard",
    to: "/manager",
    label: "לוח מנהל",
    icon: LayoutDashboard,
    match: (pathname) => pathname === "/manager"
  },
  {
    id: "waiting-list",
    to: "/manager-screens?section=waiting-list",
    label: "רשימת המתנה",
    icon: ClipboardList,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "waiting-list"
  },
  {
    id: "appointments",
    to: "/manager-screens?section=appointments",
    label: "ניהול תורים",
    icon: CalendarClock,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "appointments"
  }
]

export const SERVICES_CHILD_LINKS: ManagerNavChild[] = [
  {
    id: "services",
    to: "/manager-screens?section=services&mode=services",
    label: "שירותים",
    icon: List,
    match: (pathname, sectionParam, modeParam) =>
      pathname === "/manager-screens" && sectionParam === "services" && (modeParam === "services" || modeParam === null)
  },
  {
    id: "service-category",
    to: "/manager-screens?section=services&mode=service-category",
    label: "קטגוריות שירותים",
    icon: FolderTree,
    match: (pathname, sectionParam, modeParam) =>
      pathname === "/manager-screens" && sectionParam === "services" && modeParam === "service-category"
  }

]

export const CUSTOMERS_CHILD_LINKS: ManagerNavChild[] = [
  {
    id: "customers-list",
    to: "/manager-screens?section=customers&mode=list",
    label: "רשימת לקוחות",
    icon: Users,
    match: (pathname, sectionParam, modeParam) =>
      pathname === "/manager-screens" && sectionParam === "customers" && (modeParam === "list" || modeParam === null)
  },
  {
    id: "customer-types",
    to: "/manager-screens?section=customers&mode=types",
    label: "סוגי לקוחות",
    icon: List,
    match: (pathname, sectionParam, modeParam) =>
      pathname === "/manager-screens" && sectionParam === "customers" && modeParam === "types"
  },
  {
    id: "lead-sources",
    to: "/manager-screens?section=customers&mode=sources",
    label: "מקורות הגעה",
    icon: FolderTree,
    match: (pathname, sectionParam, modeParam) =>
      pathname === "/manager-screens" && sectionParam === "customers" && modeParam === "sources"
  }
]

export const MANAGER_NAV_SECTIONS: ManagerNavSection[] = [
  {
    id: "appointments",
    to: "/manager",
    label: "תורים",
    icon: CalendarClock,
    match: (pathname, sectionParam) =>
      pathname === "/manager" ||
      (pathname === "/manager-screens" &&
        (sectionParam === "appointments" || sectionParam === "waiting-list")),
    children: APPOINTMENT_CHILD_LINKS
  },
  {
    id: "customers",
    to: "/manager-screens?section=customers",
    label: "לקוחות",
    icon: Users,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "customers",
    children: CUSTOMERS_CHILD_LINKS
  },
  {
    id: "workers",
    to: "/manager-screens?section=workers",
    label: "עובדים",
    icon: UserCog,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "workers"
  },
  {
    id: "services",
    to: "/manager-screens?section=services&mode=services",
    label: "שירותים",
    icon: Wrench,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "services",
    children: SERVICES_CHILD_LINKS
  },
  {
    id: "products",
    to: "/manager-screens?section=products",
    label: "מוצרים",
    icon: Package,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "products"
  },
  {
    id: "payments",
    to: "/manager-screens?section=payments",
    label: "תשלומים",
    icon: CreditCard,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "payments"
  },
  {
    id: "subscriptions",
    to: "/manager-screens?section=subscriptions",
    label: "מנויים",
    icon: Ticket,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "subscriptions"
  },
  {
    id: "reports",
    to: "/manager-screens?section=reports&mode=payments",
    label: "דוחות",
    icon: BarChart3,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "reports"
  },
  {
    id: "reminders",
    to: "/manager-screens?section=reminders&mode=settings",
    label: "תזכורות תורים",
    icon: Bell,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "reminders"
  },
  {
    id: "faqs",
    to: "/manager-screens?section=faqs",
    label: "שאלות ותשובות",
    icon: HelpCircle,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "faqs"
  },
  {
    id: "settings",
    to: "/manager-screens?section=settings&mode=working-hours",
    label: "הגדרות",
    icon: Settings,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "settings"
  }
]

export function ManagerSubnav({ isManager }: ManagerSubnavProps) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const subnavRef = useRef<HTMLDivElement | null>(null)
  const dispatch = useAppDispatch()
  const { isNavbarPinned, isNavbarVisible, isOnManagerBoard, isSubnavHovered } = useAppSelector((state) => state.navbar)
  const hasInitializedFromUrlRef = useRef(false)

  const currentSection = searchParams.get("section")
  const modeParam = searchParams.get("mode")
  const pinnedParam = searchParams.get("pinned")

  const isManagerScreensActive =
    location.pathname.startsWith("/manager-screens") ||
    location.pathname === "/manager" ||
    location.pathname.startsWith("/manager/")

  const shouldShow = isManager && isManagerScreensActive

  // Initialize Redux from URL only once (if not already initialized)
  // After initialization, Redux is the source of truth
  // This ensures it's synced even if Navbar hasn't rendered yet
  useEffect(() => {
    if (shouldShow && !hasInitializedFromUrlRef.current) {
      hasInitializedFromUrlRef.current = true

      if (pinnedParam !== null) {
        // URL has pinned param - initialize Redux from URL
        const urlPinned = pinnedParam === "true"
        dispatch(setIsNavbarPinned(urlPinned))
      } else {
        // No pinned param in URL - ensure navbar is pinned by default
        dispatch(setIsNavbarPinned(true))
      }
    }
  }, [shouldShow, pinnedParam, dispatch])

  // Reset initialization flag when leaving manager pages
  useEffect(() => {
    if (!shouldShow) {
      hasInitializedFromUrlRef.current = false
    }
  }, [shouldShow])

  // Collapse subnav when navbar is collapsed on any manager page, unless hovered
  const isCollapsed = isOnManagerBoard && !isNavbarPinned && !isNavbarVisible && !isSubnavHovered

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!shouldShow) {
      document.documentElement.style.setProperty("--manager-subnav-height", "0px")
    }
  }, [shouldShow])

  useEffect(() => {
    if (!shouldShow || !subnavRef.current || typeof window === "undefined") {
      return
    }

    const updateHeight = () => {
      const height = subnavRef.current?.offsetHeight ?? 0
      document.documentElement.style.setProperty("--manager-subnav-height", `${height}px`)
    }

    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(subnavRef.current)

    return () => {
      observer.disconnect()
      document.documentElement.style.setProperty("--manager-subnav-height", "0px")
    }
  }, [shouldShow])

  if (!shouldShow) {
    return null
  }

  const activeSection = MANAGER_NAV_SECTIONS.find((section) =>
    section.match(location.pathname, currentSection, modeParam)
  )

  return (
    <div
      ref={subnavRef}
      data-nav-level="2"
      className={cn(
        "hidden xl:block xl:z-40 xl:-mb-px xl:bg-gradient-to-r xl:from-primary/10 xl:to-indigo-50 xl:border-b xl:border-primary/20 xl:shadow-sm transition-all duration-300",
        isCollapsed && "xl:opacity-0 xl:max-h-0 xl:overflow-hidden"
      )}
      onMouseEnter={() => {
        if (isOnManagerBoard && !isNavbarPinned) {
          dispatch(setIsSubnavHovered(true))
        }
      }}
      onMouseLeave={(e) => {
        if (isOnManagerBoard && !isNavbarPinned) {
          const relatedTarget = e.relatedTarget as HTMLElement | null
          // Don't hide if moving to another nav level (1/2/3) or the hover zone
          const navLevelTarget = relatedTarget?.closest("[data-nav-level]")
          const isMovingWithinNavLevels = Boolean(navLevelTarget) || !!relatedTarget?.closest('[data-nav-hover-zone="true"]')
          // If relatedTarget is null (moving to content below) or not moving within nav levels, hide
          if (!relatedTarget || !isMovingWithinNavLevels) {
            dispatch(setIsSubnavHovered(false))
            dispatch(setIsNavbarHovered(false))
          }
        }
      }}
    >
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <nav
          className="flex items-center justify-center gap-2 overflow-x-auto py-2.5"
          aria-label="תפריט מנהל"
        >
          {MANAGER_NAV_SECTIONS.map((section) => {
            const isActive = section.match(location.pathname, currentSection, modeParam)

            return (
              <Link
                key={section.id}
                to={section.to}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-white shadow-md"
                    : "text-gray-700 hover:text-primary hover:bg-white/80 hover:shadow-sm"
                )}
              >
                <section.icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{section.label}</span>
              </Link>
            )
          })}
        </nav>

        {activeSection?.children ? (
          <div className="mt-3 rounded-xl border border-indigo-200/40 bg-gradient-to-r from-indigo-50 via-purple-50 to-primary/10 shadow-sm">
            <nav
              className="flex items-center justify-center gap-2 overflow-x-auto px-3 py-2 sm:px-4"
              aria-label="תפריט משנה לניהול תורים"
            >
              {activeSection.children.map((child) => {
                const isChildActive = child.match(location.pathname, currentSection, modeParam)

                return (
                  <Link
                    key={child.id}
                    to={child.to}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                      isChildActive
                        ? "bg-indigo-600 text-white shadow-md"
                        : "text-gray-700 hover:text-indigo-600 hover:bg-white/80 hover:shadow-sm"
                    )}
                  >
                    <child.icon className={`h-4 w-4 ${isChildActive ? "text-white" : "text-slate-500"}`} />
                    <span>{child.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        ) : null}
      </div>
    </div>
  )
}

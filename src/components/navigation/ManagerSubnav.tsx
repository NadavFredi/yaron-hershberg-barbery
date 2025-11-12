import React, { useEffect, useRef } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Settings, CalendarClock, Users, LayoutDashboard, ClipboardList, UserCog } from "lucide-react"

interface ManagerSubnavProps {
  isManager: boolean
}

export interface ManagerNavChild {
  id: string
  to: string
  label: string
  icon: React.ReactNode
  match: (pathname: string, sectionParam?: string | null, modeParam?: string | null) => boolean
}

export interface ManagerNavSection {
  id: string
  to: string
  label: string
  icon: React.ReactNode
  match: (pathname: string, sectionParam?: string | null, modeParam?: string | null) => boolean
  children?: ManagerNavChild[]
}

export const APPOINTMENT_CHILD_LINKS: ManagerNavChild[] = [
  {
    id: "dashboard",
    to: "/manager",
    label: "לוח מנהל",
    icon: <LayoutDashboard className="h-4 w-4" />,
    match: (pathname) => pathname === "/manager"
  },
  {
    id: "waiting-list",
    to: "/manager-screens?section=waiting-list",
    label: "רשימת המתנה",
    icon: <ClipboardList className="h-4 w-4" />,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "waiting-list"
  },
  {
    id: "appointments",
    to: "/manager-screens?section=appointments",
    label: "ניהול תורים",
    icon: <CalendarClock className="h-4 w-4" />,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "appointments"
  }
]

export const MANAGER_NAV_SECTIONS: ManagerNavSection[] = [
  {
    id: "appointments",
    to: "/manager",
    label: "תורים",
    icon: <CalendarClock className="h-4 w-4" />,
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
    icon: <Users className="h-4 w-4" />,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "customers"
  },
  {
    id: "workers",
    to: "/manager-screens?section=workers",
    label: "עובדים",
    icon: <UserCog className="h-4 w-4" />,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "workers"
  },
  {
    id: "settings",
    to: "/manager-screens?section=settings&mode=working-hours",
    label: "הגדרות",
    icon: <Settings className="h-4 w-4" />,
    match: (pathname, sectionParam) =>
      pathname === "/manager-screens" && sectionParam === "settings"
  }
]

export function ManagerSubnav({ isManager }: ManagerSubnavProps) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const subnavRef = useRef<HTMLDivElement | null>(null)

  const currentSection = searchParams.get("section")
  const modeParam = searchParams.get("mode")

  const isManagerScreensActive =
    location.pathname.startsWith("/manager-screens") ||
    location.pathname === "/manager" ||
    location.pathname.startsWith("/manager/")

  const shouldShow = isManager && isManagerScreensActive

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
      className="hidden xl:block xl:z-40 xl:-mb-px xl:bg-gradient-to-r xl:from-blue-50 xl:to-indigo-50 xl:border-b xl:border-blue-200/50 xl:shadow-sm"
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
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-700 hover:text-blue-600 hover:bg-white/80"
                )}
              >
                {section.icon}
                <span>{section.label}</span>
              </Link>
            )
          })}
        </nav>

        {activeSection?.children ? (
          <div className="mt-3 rounded-xl border border-indigo-200/40 bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 shadow-sm">
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
                        : "text-gray-700 hover:text-indigo-600 hover:bg-white/80"
                    )}
                  >
                    {child.icon}
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

import { Users } from "lucide-react"
import { cn } from "@/lib/utils"

export const CUSTOMERS_SECTIONS: Array<{
  id: "list"
  label: string
  description: string
  icon: JSX.Element
}> = [
  {
    id: "list",
    label: "לקוחות",
    description: "ניהול רשימת לקוחות",
    icon: <Users className="h-4 w-4" />,
  },
]

interface CustomersSubnavProps {
  activeMode: "list"
  onModeChange: (mode: "list") => void
}

export function CustomersSubnav({ activeMode, onModeChange }: CustomersSubnavProps) {
  return (
    <div
      className="hidden xl:block xl:z-20 xl:-mt-px xl:bg-gradient-to-r xl:from-indigo-50 xl:to-purple-50 xl:border-b xl:border-indigo-200/50 xl:shadow-sm xl:border-t xl:border-indigo-200/30"
    >
      <div className="max-w-full mx-auto px-6 sm:px-8 lg:px-12">
        <nav className="flex flex-wrap items-center justify-center gap-2 overflow-x-auto py-3" aria-label="תפריט לקוחות">
          {CUSTOMERS_SECTIONS.map((section) => {
            const isActive = activeMode === section.id

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onModeChange(section.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
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

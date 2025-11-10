import { Sparkles, Tag, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

export const TREATMENTS_SECTIONS: Array<{
    id: "list" | "category1" | "category2"
    label: string
    description: string
    icon: JSX.Element
}> = [
    {
        id: "list",
        label: "כלבים",
        description: "רשימת כל הכלבים במערכת",
        icon: <Sparkles className="h-4 w-4" />,
    },
    {
        id: "category1",
        label: "קטגוריה 1",
        description: "ניהול קטגוריות סוג כלב",
        icon: <Layers className="h-4 w-4" />,
    },
    {
        id: "category2",
        label: "קטגוריה 2",
        description: "ניהול קטגוריות התנהגות",
        icon: <Tag className="h-4 w-4" />,
    },
]

interface TreatmentsSubnavProps {
    activeMode: "list" | "category1" | "category2"
    onModeChange: (mode: "list" | "category1" | "category2") => void
}

export function TreatmentsSubnav({ activeMode, onModeChange }: TreatmentsSubnavProps) {
    return (
        <div
            className="hidden xl:block xl:z-20 xl:-mt-px xl:bg-gradient-to-r xl:from-indigo-50 xl:to-purple-50 xl:border-b xl:border-indigo-200/50 xl:shadow-sm xl:border-t xl:border-indigo-200/30"
        >
            <div className="max-w-full mx-auto px-6 sm:px-8 lg:px-12">
                <nav className="flex flex-wrap items-center justify-center gap-2 overflow-x-auto py-3" aria-label="תפריט כלבים">
                    {TREATMENTS_SECTIONS.map((section) => {
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

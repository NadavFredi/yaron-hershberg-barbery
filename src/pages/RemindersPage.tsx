import { useEffect } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { Bell } from "lucide-react"
import ReminderSettings from "@/components/reminders/ReminderSettings"
import SentRemindersTable from "@/components/reminders/SentRemindersTable"

const VALID_MODES = ["settings", "sent"] as const

type ModeId = (typeof VALID_MODES)[number]

const isValidMode = (value: string | null): value is ModeId => {
    return Boolean(value && VALID_MODES.includes(value as ModeId))
}

export default function RemindersPage() {
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()

    const modeFromUrl = searchParams.get("mode")
    const currentSection = searchParams.get("section")
    const activeMode: ModeId = isValidMode(modeFromUrl) ? (modeFromUrl as ModeId) : "settings"

    // Ensure URL always has section and mode for deep links/bookmarks
    useEffect(() => {
        if (location.pathname !== "/manager-screens") {
            return
        }

        if (currentSection && currentSection !== "reminders") {
            return
        }

        if (!isValidMode(modeFromUrl)) {
            setSearchParams({ section: "reminders", mode: activeMode }, { replace: true })
            return
        }

        if (currentSection !== "reminders") {
            setSearchParams({ section: "reminders", mode: activeMode }, { replace: true })
        }
    }, [location.pathname, currentSection, modeFromUrl, setSearchParams, activeMode])

    return (
        <div className="min-h-screen" dir="rtl">
            <div className="bg-background py-6">
                <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12">
                    <div className="space-y-6 mb-6">
                        <div className="flex items-center gap-2">
                            <Bell className="h-6 w-6" />
                            <h2 className="text-2xl font-bold text-gray-900">
                                תזכורות תורים
                            </h2>
                        </div>
                    </div>
                    {activeMode === "settings" && <ReminderSettings />}
                    {activeMode === "sent" && <SentRemindersTable />}
                </div>
            </div>
        </div>
    )
}


import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Loader2, Save, Lock, LockOpen, Eye, EyeOff, ChevronDown } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import { MANAGER_NAV_SECTIONS, APPOINTMENT_CHILD_LINKS, CUSTOMERS_CHILD_LINKS, SERVICES_CHILD_LINKS } from "@/components/navigation/ManagerSubnav"
import { THIRD_LEVEL_SECTIONS } from "@/components/navigation/ThirdLevelSubnav"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Build all manager screens dynamically from navbar structure
const MANAGER_SCREENS = [
  // Appointments section - from second-level children
  ...APPOINTMENT_CHILD_LINKS.map((child) => ({
    id: child.id,
    label: child.label,
    section: "appointments" as const,
  })),
  // Customers section - from second-level children
  ...CUSTOMERS_CHILD_LINKS.map((child) => ({
    id: child.id,
    label: child.label,
    section: "customers" as const,
  })),
  // Services section - from second-level children
  ...SERVICES_CHILD_LINKS.map((child) => ({
    id: child.id,
    label: child.label,
    section: "services" as const,
  })),
  // Workers section - from third-level items
  ...THIRD_LEVEL_SECTIONS.workers.map((item) => ({
    id: `workers-${item.id}`,
    label: item.label,
    section: "workers" as const,
  })),
  // Products section - from third-level items
  ...THIRD_LEVEL_SECTIONS.products.map((item) => ({
    id: `products-${item.id}`,
    label: item.label,
    section: "products" as const,
  })),
  // Payments section - from third-level items
  ...THIRD_LEVEL_SECTIONS.payments.map((item) => ({
    id: `payments-${item.id}`,
    label: item.label,
    section: "payments" as const,
  })),
  // Subscriptions section - from third-level items
  ...THIRD_LEVEL_SECTIONS.subscriptions.map((item) => ({
    id: `subscriptions-${item.id}`,
    label: item.label,
    section: "subscriptions" as const,
  })),
  // Reports section - from third-level items
  ...THIRD_LEVEL_SECTIONS.reports.map((item) => ({
    id: `reports-${item.id}`,
    label: item.label,
    section: "reports" as const,
  })),
  // Reminders section - from third-level items
  ...THIRD_LEVEL_SECTIONS.reminders.map((item) => ({
    id: `reminders-${item.id}`,
    label: item.label,
    section: "reminders" as const,
  })),
  // Settings section - from third-level items
  ...THIRD_LEVEL_SECTIONS.settings.map((item) => ({
    id: `settings-${item.id}`,
    label: item.label,
    section: "settings" as const,
  })),
]

interface ProtectedScreen {
  screen_id: string
  is_protected: boolean
}

export function SettingsProtectedScreensSection() {
  const { user } = useSupabaseAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [protectedScreens, setProtectedScreens] = useState<Record<string, boolean>>({})
  const [hasPassword, setHasPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSettingPassword, setIsSettingPassword] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadProtectedScreens()
  }, [user])

  const loadProtectedScreens = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      // Check if password is set
      const { data: passwordData } = await supabase
        .from("manager_protected_screen_passwords")
        .select("id")
        .eq("manager_id", user.id)
        .single()

      setHasPassword(!!passwordData)

      // Load protected screens
      const { data: screensData, error } = await supabase
        .from("manager_protected_screens")
        .select("screen_id, is_protected")
        .eq("manager_id", user.id)

      if (error) {
        console.error("Error loading protected screens:", error)
        toast.error("שגיאה בטעינת הגדרות המסכים המוגנים")
        return
      }

      // Convert to record format
      const screensMap: Record<string, boolean> = {}
      screensData?.forEach((screen) => {
        screensMap[screen.screen_id] = screen.is_protected
      })

      // Initialize all screens (default to false if not in DB)
      MANAGER_SCREENS.forEach((screen) => {
        if (!(screen.id in screensMap)) {
          screensMap[screen.id] = false
        }
      })

      setProtectedScreens(screensMap)
    } catch (error) {
      console.error("Error loading protected screens:", error)
      toast.error("שגיאה בטעינת הגדרות המסכים המוגנים")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleScreen = (screenId: string) => {
    if (!hasPassword) {
      toast.error("יש להגדיר סיסמה לפני שמירת מסכים מוגנים")
      return
    }

    setProtectedScreens((prev) => ({
      ...prev,
      [screenId]: !prev[screenId],
    }))
  }

  const handleSaveProtectedScreens = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      const screens = Object.entries(protectedScreens).map(([screen_id, is_protected]) => ({
        screen_id,
        is_protected,
      }))

      const { data, error } = await supabase.functions.invoke("manage-protected-screens", {
        body: {
          action: "update_protected_screens",
          screens,
        },
      })

      if (error) {
        throw error
      }

      toast.success("המסכים המוגנים נשמרו בהצלחה")
    } catch (error) {
      console.error("Error saving protected screens:", error)
      toast.error("שגיאה בשמירת המסכים המוגנים")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetPassword = async () => {
    if (!user) return

    if (newPassword.length < 4) {
      toast.error("הסיסמה חייבת להכיל לפחות 4 תווים")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("הסיסמאות לא תואמות")
      return
    }

    setIsSettingPassword(true)
    try {
      const { data, error } = await supabase.functions.invoke("manage-protected-screens", {
        body: {
          action: "set_password",
          password: newPassword,
        },
      })

      if (error) {
        throw error
      }

      setHasPassword(true)
      setNewPassword("")
      setConfirmPassword("")
      toast.success("הסיסמה הוגדרה בהצלחה")
    } catch (error) {
      console.error("Error setting password:", error)
      toast.error("שגיאה בהגדרת הסיסמה")
    } finally {
      setIsSettingPassword(false)
    }
  }

  const handleResetPassword = async () => {
    if (!user) return

    if (newPassword.length < 4) {
      toast.error("הסיסמה חייבת להכיל לפחות 4 תווים")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("הסיסמאות לא תואמות")
      return
    }

    setIsSettingPassword(true)
    try {
      const { data, error } = await supabase.functions.invoke("manage-protected-screens", {
        body: {
          action: "set_password",
          password: newPassword,
        },
      })

      if (error) {
        throw error
      }

      setNewPassword("")
      setConfirmPassword("")
      toast.success("הסיסמה עודכנה בהצלחה")
    } catch (error) {
      console.error("Error resetting password:", error)
      toast.error("שגיאה בעדכון הסיסמה")
    } finally {
      setIsSettingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="mr-2">טוען הגדרות מסכים מוגנים...</span>
      </div>
    )
  }

  // Group screens by section
  const screensBySection = MANAGER_SCREENS.reduce((acc, screen) => {
    if (!acc[screen.section]) {
      acc[screen.section] = []
    }
    acc[screen.section].push(screen)
    return acc
  }, {} as Record<string, Array<{ id: string; label: string; section: string }>>)

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">מסכים מוגנים</h2>
          <p className="text-sm text-gray-500 mt-1">הגדר אילו מסכים דורשים סיסמה לגישה</p>
        </div>
        <Button
          onClick={handleSaveProtectedScreens}
          disabled={isSaving || !hasPassword}
          className="flex items-center gap-2 shadow-sm"
          size="sm"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          שמור שינויים
        </Button>
      </div>

      {/* Password Section - Modern Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          {hasPassword ? (
            <Lock className="h-4 w-4 text-blue-600" />
          ) : (
            <LockOpen className="h-4 w-4 text-gray-400" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">
            {hasPassword ? "סיסמה מוגדרת" : "הגדר סיסמה"}
          </h3>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          {hasPassword
            ? "ניתן לשנות את הסיסמה למטה. הסיסמה נדרשת לגישה למסכים המוגנים."
            : "יש להגדיר סיסמה לפני שמירת מסכים מוגנים. הסיסמה תשמש לגישה למסכים המוגנים בלבד."}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="new-password" className="text-xs font-medium text-gray-700 mb-1 block">
              {hasPassword ? "סיסמה חדשה" : "סיסמה"}
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="הזן סיסמה (לפחות 4 תווים)"
                className="pr-9 h-9 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-password" className="text-xs font-medium text-gray-700 mb-1 block">
              אישור סיסמה
            </Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="הזן שוב את הסיסמה"
              className="h-9 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
            />
          </div>
        </div>
        <Button
          onClick={hasPassword ? handleResetPassword : handleSetPassword}
          disabled={isSettingPassword || !newPassword || !confirmPassword}
          className="mt-3 flex items-center gap-2"
          size="sm"
        >
          {isSettingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
          {hasPassword ? "עדכן סיסמה" : "הגדר סיסמה"}
        </Button>
      </div>

      {/* Protected Screens List - 2 Column Layout */}
      {!hasPassword && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-sm">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            יש להגדיר סיסמה למעלה לפני שמירת מסכים מוגנים
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-900">רשימת מסכים</h3>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
            {Object.entries(screensBySection).map(([sectionId, screens]) => {
              const section = MANAGER_NAV_SECTIONS.find((s) => s.id === sectionId)
              const isExpanded = expandedSections.has(sectionId)
              const IconComponent = section?.icon

              return (
                <Collapsible
                  key={sectionId}
                  open={isExpanded}
                  onOpenChange={() => toggleSection(sectionId)}
                  className="bg-gray-50/50 rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow"
                >
                  <CollapsibleTrigger className="w-full group">
                    <div className="flex items-center justify-between w-full py-3 px-4 hover:bg-gray-100/50 transition-colors">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {IconComponent && (
                          <IconComponent className="h-4 w-4 text-gray-600 flex-shrink-0" />
                        )}
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {section?.label || sectionId}
                        </h4>
                        <span className="text-xs font-medium text-gray-600 bg-white px-2 py-0.5 rounded-md border border-gray-200 flex-shrink-0">
                          {screens.length}
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 mr-1 group-hover:text-gray-600",
                          isExpanded && "transform rotate-180"
                        )}
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1.5 p-3 pt-2">
                      {screens.map((screen) => (
                        <div
                          key={screen.id}
                          className="flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-white transition-colors group bg-white/50"
                        >
                          <Checkbox
                            id={`screen-${screen.id}`}
                            checked={protectedScreens[screen.id] || false}
                            onCheckedChange={() => handleToggleScreen(screen.id)}
                            disabled={!hasPassword}
                          />
                          <Label
                            htmlFor={`screen-${screen.id}`}
                            className="cursor-pointer text-sm font-medium text-gray-700 flex-1 group-hover:text-gray-900"
                          >
                            {screen.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

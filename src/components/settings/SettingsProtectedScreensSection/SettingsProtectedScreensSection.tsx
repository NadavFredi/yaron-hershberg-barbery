import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Loader2, Save, Lock, LockOpen, Eye, EyeOff, ChevronDown } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import { MANAGER_NAV_SECTIONS, APPOINTMENT_CHILD_LINKS, CUSTOMERS_CHILD_LINKS, SERVICES_CHILD_LINKS } from "@/components/navigation/ManagerSubnav"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Define all manager screens with their IDs
const MANAGER_SCREENS = [
  // Main sections
  { id: "manager", label: "לוח מנהל", section: "appointments" },
  { id: "waiting-list", label: "רשימת המתנה", section: "appointments" },
  { id: "appointments", label: "ניהול תורים", section: "appointments" },
  { id: "customers-list", label: "רשימת לקוחות", section: "customers" },
  { id: "customer-types", label: "סוגי לקוחות", section: "customers" },
  { id: "lead-sources", label: "מקורות הגעה", section: "customers" },
  { id: "workers", label: "עובדים", section: "workers" },
  { id: "services", label: "שירותים", section: "services" },
  { id: "service-category", label: "קטגוריות שירותים", section: "services" },
  { id: "products", label: "מוצרים", section: "products" },
  { id: "payments", label: "תשלומים", section: "payments" },
  { id: "subscriptions", label: "מנויים", section: "subscriptions" },
  { id: "reports", label: "דוחות", section: "reports" },
  { id: "reminders", label: "תזכורות תורים", section: "reminders" },
  { id: "settings", label: "הגדרות", section: "settings" },
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
  }, {} as Record<string, typeof MANAGER_SCREENS>)

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
    <div className="space-y-2">
      <div>
        <h2 className="text-lg font-bold text-gray-900">מסכים מוגנים</h2>
        <p className="text-xs text-gray-600 mt-0.5">הגדר אילו מסכים דורשים סיסמה לגישה</p>
      </div>

      {/* Password Section */}
      <div className="border rounded-md p-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          {hasPassword ? <Lock className="h-3.5 w-3.5 text-green-600" /> : <LockOpen className="h-3.5 w-3.5 text-gray-400" />}
          <h3 className="text-sm font-semibold">{hasPassword ? "סיסמה הוגדרה" : "הגדר סיסמה"}</h3>
        </div>
        <p className="text-xs text-gray-600">
          {hasPassword
            ? "סיסמה מוגדרת. תוכל לשנות אותה למטה."
            : "יש להגדיר סיסמה לפני שמירת מסכים מוגנים. הסיסמה תשמש לגישה למסכים המוגנים בלבד."}
        </p>

        <div className="space-y-1.5">
          <div>
            <Label htmlFor="new-password" className="text-xs">{hasPassword ? "סיסמה חדשה" : "סיסמה"}</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="הזן סיסמה (לפחות 4 תווים)"
                className="pr-8 h-7 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-password" className="text-xs">אישור סיסמה</Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="הזן שוב את הסיסמה"
              className="h-7 text-xs"
            />
          </div>
          <Button
            onClick={hasPassword ? handleResetPassword : handleSetPassword}
            disabled={isSettingPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-1 h-7 text-xs px-2"
            size="sm"
          >
            {isSettingPassword && <Loader2 className="h-3 w-3 animate-spin" />}
            {hasPassword ? "עדכן סיסמה" : "הגדר סיסמה"}
          </Button>
        </div>
      </div>

      {/* Protected Screens List */}
      <div className="border rounded-md p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">רשימת מסכים</h3>
          <Button
            onClick={handleSaveProtectedScreens}
            disabled={isSaving || !hasPassword}
            className="flex items-center gap-1 h-7 text-xs px-2"
            size="sm"
          >
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            <Save className="h-3 w-3" />
            שמור שינויים
          </Button>
        </div>

        {!hasPassword && (
          <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
            <p className="text-xs text-yellow-800">
              יש להגדיר סיסמה למעלה לפני שמירת מסכים מוגנים
            </p>
          </div>
        )}

        <div className="space-y-0.5">
          {Object.entries(screensBySection).map(([sectionId, screens]) => {
            const section = MANAGER_NAV_SECTIONS.find((s) => s.id === sectionId)
            const isExpanded = expandedSections.has(sectionId)
            const IconComponent = section?.icon

            return (
              <Collapsible
                key={sectionId}
                open={isExpanded}
                onOpenChange={() => toggleSection(sectionId)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between w-full py-1 px-1.5 rounded hover:bg-gray-50">
                    <div className="flex items-center gap-1.5">
                      {IconComponent && <IconComponent className="h-3 w-3 text-gray-600" />}
                      <h4 className="text-xs font-medium text-gray-700">
                        {section?.label || sectionId}
                      </h4>
                      <span className="text-xs text-gray-500">({screens.length})</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 text-gray-500 transition-transform duration-200",
                        isExpanded && "transform rotate-180"
                      )}
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-0.5 pr-3 pb-1">
                    {screens.map((screen) => (
                      <div
                        key={screen.id}
                        className="flex items-center justify-between py-0.5 px-1.5 rounded hover:bg-gray-50"
                      >
                        <Label
                          htmlFor={`screen-${screen.id}`}
                          className="cursor-pointer flex-1 text-xs"
                        >
                          {screen.label}
                        </Label>
                        <Switch
                          id={`screen-${screen.id}`}
                          checked={protectedScreens[screen.id] || false}
                          onCheckedChange={() => handleToggleScreen(screen.id)}
                          disabled={!hasPassword}
                          className="scale-75"
                        />
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
  )
}

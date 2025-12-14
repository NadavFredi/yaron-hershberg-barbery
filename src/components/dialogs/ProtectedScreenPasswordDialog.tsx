import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface ProtectedScreenPasswordDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  screenName?: string
}

export function ProtectedScreenPasswordDialog({
  open,
  onClose,
  onSuccess,
  screenName,
}: ProtectedScreenPasswordDialogProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async () => {
    if (!password) {
      setError("אנא הזן סיסמה")
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const { data, error: verifyError } = await supabase.functions.invoke("manage-protected-screens", {
        body: {
          action: "verify_password",
          password,
        },
      })

      if (verifyError) {
        throw verifyError
      }

      if (data?.valid) {
        // Store in sessionStorage that password was verified
        sessionStorage.setItem("protected_screen_password_verified", "true")
        // Dispatch custom event to notify navbar
        window.dispatchEvent(new Event("secureModeChanged"))
        setPassword("")
        onSuccess()
        onClose()
      } else {
        setError("סיסמה שגויה")
      }
    } catch (err) {
      console.error("Error verifying password:", err)
      setError("שגיאה באימות הסיסמה")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isVerifying) {
      handleVerify()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <DialogTitle>נדרשת סיסמה</DialogTitle>
          </div>
          <DialogDescription>
            {screenName
              ? `המסך "${screenName}" מוגן בסיסמה. אנא הזן את הסיסמה כדי להמשיך.`
              : "המסך מוגן בסיסמה. אנא הזן את הסיסמה כדי להמשיך."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="password">סיסמה</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                onKeyPress={handleKeyPress}
                placeholder="הזן סיסמה"
                className="pr-10"
                autoFocus
                disabled={isVerifying}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isVerifying}>
              ביטול
            </Button>
            <Button onClick={handleVerify} disabled={isVerifying || !password} className="flex items-center gap-2">
              {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
              אימות
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

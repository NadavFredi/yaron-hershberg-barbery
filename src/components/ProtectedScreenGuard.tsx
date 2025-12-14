import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

interface ProtectedScreenGuardProps {
  screenName?: string
  onEnterPassword: () => void
}

export function ProtectedScreenGuard({ screenName, onEnterPassword }: ProtectedScreenGuardProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-8 max-w-md mx-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              נדרשת סיסמה
            </h2>
            <p className="text-sm text-gray-600">
              {screenName
                ? `המסך "${screenName}" מוגן בסיסמה. יש להזין סיסמה כדי לראות את תוכן המסך.`
                : "המסך מוגן בסיסמה. יש להזין סיסמה כדי לראות את תוכן המסך."}
            </p>
          </div>
          <Button onClick={onEnterPassword} className="mt-2" size="lg">
            <Lock className="h-4 w-4 ml-2" />
            הזן סיסמה
          </Button>
        </div>
      </div>
    </div>
  )
}

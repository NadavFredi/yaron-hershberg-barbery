import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, RefreshCw, Eye, EyeOff, Loader2, User, Phone, Mail } from "lucide-react"
import type { WorkerSummary } from "@/types/worker"

interface ResetPasswordDialogProps {
    open: boolean
    onOpenChange: (value: boolean) => void
    worker: WorkerSummary
    onSetPassword: (worker: WorkerSummary, password: string) => Promise<void>
    onGenerateLink: (worker: WorkerSummary) => Promise<void>
    isSubmitting: boolean
}

export const ResetPasswordDialog = ({
    open,
    onOpenChange,
    worker,
    onSetPassword,
    onGenerateLink,
    isSubmitting,
}: ResetPasswordDialogProps) => {
    const [step, setStep] = useState<"select" | "set_password" | "generate_link">("select")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        if (!open) {
            setStep("select")
            setPassword("")
            setShowPassword(false)
            setErrors({})
        }
    }, [open])

    const generatePassword = () => {
        // Generate a secure password with 12 characters: uppercase, lowercase, numbers, and symbols
        const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"
        const lowercase = "abcdefghijkmnopqrstuvwxyz"
        const numbers = "23456789"
        const symbols = "!@#$%&*"
        
        // Ensure at least one of each type
        let generatedPassword = ""
        generatedPassword += uppercase[Math.floor(Math.random() * uppercase.length)]
        generatedPassword += lowercase[Math.floor(Math.random() * lowercase.length)]
        generatedPassword += numbers[Math.floor(Math.random() * numbers.length)]
        generatedPassword += symbols[Math.floor(Math.random() * symbols.length)]
        
        // Fill the rest randomly
        const allChars = uppercase + lowercase + numbers + symbols
        for (let i = generatedPassword.length; i < 12; i++) {
            generatedPassword += allChars[Math.floor(Math.random() * allChars.length)]
        }
        
        // Shuffle the password
        generatedPassword = generatedPassword.split("").sort(() => Math.random() - 0.5).join("")
        
        setPassword(generatedPassword)
        setShowPassword(true)
    }

    const validatePassword = (): boolean => {
        const nextErrors: Record<string, string> = {}
        if (!password || password.trim().length < 8) {
            nextErrors.password = "יש להזין סיסמה באורך של לפחות 8 תווים"
        }
        setErrors(nextErrors)
        return Object.keys(nextErrors).length === 0
    }

    const handleSetPasswordClick = async () => {
        if (!validatePassword()) {
            return
        }
        await onSetPassword(worker, password)
    }

    const handleGenerateLinkClick = async () => {
        await onGenerateLink(worker)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">
                        {step === "select" ? "איפוס סיסמה" : step === "set_password" ? "הגדרת סיסמה חדשה" : "יצירת קישור איפוס"}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {step === "select" 
                            ? `בחר את שיטת איפוס הסיסמה עבור ${worker.fullName || "העובד"}`
                            : step === "set_password"
                            ? "הגדר סיסמה חדשה עבור העובד"
                            : "צור קישור שהעובד יכול להשתמש בו כדי לאפס את הסיסמה בעצמו"}
                    </DialogDescription>
                </DialogHeader>

                {step === "select" && (
                    <div className="py-4 space-y-3">
                        <Button
                            onClick={() => setStep("set_password")}
                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                                    <Key className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="text-right flex-1">
                                    <div className="font-semibold">הגדר סיסמה חדשה</div>
                                    <div className="text-sm text-gray-500">הגדר סיסמה חדשה ישירות עבור העובד</div>
                                </div>
                            </div>
                        </Button>

                        <Button
                            onClick={() => setStep("generate_link")}
                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                                    <RefreshCw className="h-5 w-5 text-green-600" />
                                </div>
                                <div className="text-right flex-1">
                                    <div className="font-semibold">צור קישור איפוס</div>
                                    <div className="text-sm text-gray-500">צור קישור שהעובד יכול להשתמש בו בעצמו</div>
                                </div>
                            </div>
                        </Button>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                ביטול
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {step === "set_password" && (
                    <div className="py-4 space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-right">
                            <div className="text-sm font-semibold text-slate-700 mb-2">פרטי העובד:</div>
                            <div className="space-y-1.5 text-sm text-slate-600">
                                <div className="flex items-center justify-end gap-2">
                                    <span className="font-medium">{worker.fullName || "ללא שם"}</span>
                                    <User className="h-4 w-4 text-slate-400" />
                                </div>
                                {worker.phoneNumber && (
                                    <div className="flex items-center justify-end gap-2">
                                        <span>{worker.phoneNumber}</span>
                                        <Phone className="h-4 w-4 text-slate-400" />
                                    </div>
                                )}
                                {worker.email && (
                                    <div className="flex items-center justify-end gap-2">
                                        <span>{worker.email}</span>
                                        <Mail className="h-4 w-4 text-slate-400" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="reset-password-input" className="text-right">
                                    סיסמה חדשה
                                </Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={generatePassword}
                                    className="h-7 text-xs"
                                >
                                    <RefreshCw className="h-3 w-3 ml-1" />
                                    צור סיסמה
                                </Button>
                            </div>
                            <div className="relative">
                                <Input
                                    id="reset-password-input"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(event) => {
                                        setPassword(event.target.value)
                                        setErrors({})
                                    }}
                                    className="text-right pr-10"
                                    placeholder="לפחות 8 תווים"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                            {errors.password ? <p className="text-xs text-rose-600">{errors.password}</p> : null}
                        </div>

                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-right">
                            <p className="text-xs text-green-800">
                                העובד יוכל להתחבר מיד עם הסיסמה החדשה באמצעות האימייל או מספר הטלפון שלו.
                            </p>
                        </div>

                        <DialogFooter className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep("select")}>
                                חזרה
                            </Button>
                            <Button
                                onClick={handleSetPasswordClick}
                                disabled={isSubmitting || !password || password.length < 8}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        מעדכן...
                                    </>
                                ) : (
                                    <>
                                        <Key className="mr-2 h-4 w-4" />
                                        הגדר סיסמה
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {step === "generate_link" && (
                    <div className="py-4 space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-right">
                            <div className="text-sm font-semibold text-slate-700 mb-2">פרטי העובד:</div>
                            <div className="space-y-1.5 text-sm text-slate-600">
                                <div className="flex items-center justify-end gap-2">
                                    <span className="font-medium">{worker.fullName || "ללא שם"}</span>
                                    <User className="h-4 w-4 text-slate-400" />
                                </div>
                                {worker.phoneNumber && (
                                    <div className="flex items-center justify-end gap-2">
                                        <span>{worker.phoneNumber}</span>
                                        <Phone className="h-4 w-4 text-slate-400" />
                                    </div>
                                )}
                                {worker.email && (
                                    <div className="flex items-center justify-end gap-2">
                                        <span>{worker.email}</span>
                                        <Mail className="h-4 w-4 text-slate-400" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-right">
                            <p className="text-sm text-blue-800">
                                הקישור יועתק אוטומטית ללוח לאחר יצירתו. העבר את הקישור לעובד.
                            </p>
                        </div>

                        <DialogFooter className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep("select")}>
                                חזרה
                            </Button>
                            <Button
                                onClick={handleGenerateLinkClick}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        יוצר...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        צור קישור איפוס
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}


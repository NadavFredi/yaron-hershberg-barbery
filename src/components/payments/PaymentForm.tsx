import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { User, Mail, Phone } from "lucide-react"

export interface PaymentFormData {
    fullName: string
    phone: string
    email: string
}

interface PaymentFormProps {
    initialData?: Partial<PaymentFormData>
    onSubmit: (data: PaymentFormData) => void
    onValidationChange?: (isValid: boolean) => void
    disabled?: boolean
    showChildName?: boolean
    childName?: string
    onChildNameChange?: (name: string) => void
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
    initialData,
    onSubmit,
    onValidationChange,
    disabled = false,
    showChildName = false,
    childName = "",
    onChildNameChange,
}) => {
    const [fullName, setFullName] = useState(initialData?.fullName || "")
    const [phone, setPhone] = useState(initialData?.phone || "")
    const [email, setEmail] = useState(initialData?.email || "")
    const [isPhoneValid, setIsPhoneValid] = useState(true)
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        if (initialData) {
            setFullName(initialData.fullName || "")
            setPhone(initialData.phone || "")
            setEmail(initialData.email || "")
        }
    }, [initialData])

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {}

        if (!fullName.trim()) {
            newErrors.fullName = "שם מלא נדרש"
        }

        if (!phone.trim()) {
            newErrors.phone = "מספר טלפון נדרש"
        } else if (!isPhoneValid) {
            newErrors.phone = "מספר טלפון לא תקין"
        }

        if (!email.trim()) {
            newErrors.email = "כתובת אימייל נדרשת"
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(email.trim())) {
                newErrors.email = "כתובת אימייל לא תקינה"
            }
        }

        setErrors(newErrors)
        const isValid = Object.keys(newErrors).length === 0
        onValidationChange?.(isValid)
        return isValid
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (validate()) {
            onSubmit({
                fullName: fullName.trim(),
                phone: phone.trim(),
                email: email.trim(),
            })
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
            {showChildName && (
                <div className="space-y-2">
                    <Label htmlFor="childName" className="flex items-center gap-2 text-right">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>שם הילד</span>
                    </Label>
                    <Input
                        id="childName"
                        type="text"
                        value={childName}
                        onChange={(e) => onChildNameChange?.(e.target.value)}
                        placeholder="הכנס שם הילד"
                        className="text-right"
                        dir="rtl"
                        disabled={disabled}
                    />
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2 text-right">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>שם מלא <span className="text-red-500">*</span></span>
                </Label>
                <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="הכנס שם מלא"
                    className="text-right"
                    dir="rtl"
                    disabled={disabled}
                    required
                />
                {errors.fullName && <p className="text-xs text-red-500 text-right">{errors.fullName}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2 text-right">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>טלפון <span className="text-red-500">*</span></span>
                </Label>
                <PhoneInput
                    id="phone"
                    value={phone}
                    onChange={setPhone}
                    onValidationChange={setIsPhoneValid}
                    placeholder="הכנס מספר טלפון"
                    disabled={disabled}
                    defaultCountry="il"
                />
                {errors.phone && <p className="text-xs text-red-500 text-right">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-right">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span>אימייל <span className="text-red-500">*</span></span>
                </Label>
                <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="text-right"
                    dir="rtl"
                    disabled={disabled}
                    required
                />
                {errors.email && <p className="text-xs text-red-500 text-right">{errors.email}</p>}
            </div>
        </form>
    )
}


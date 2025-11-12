import { useState, useCallback, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useUpdateTreatmentMutation } from "@/store/services/supabaseApi"
import { useTreatmentTypes } from "@/hooks/useTreatmentTypes"
import { getTreatmentById } from "@/integrations/supabase/supabaseService"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { format, parseISO, isValid as isValidDate } from "date-fns"

interface EditTreatmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    treatmentId: string | null
    onSuccess?: () => void
    lockTreatmentTypeSelection?: boolean
}

const parseBirthDateString = (value?: string | null): Date | null => {
    if (!value) {
        return null
    }

    try {
        const parsedIso = parseISO(value)
        if (isValidDate(parsedIso)) {
            return parsedIso
        }
    } catch (error) {
        console.warn("⚠️ [EditTreatmentDialog] Failed to parse ISO birth date, falling back to Date constructor", {
            value,
            error,
        })
    }

    const fallback = new Date(value)
    if (isValidDate(fallback)) {
        return fallback
    }

    console.warn("⚠️ [EditTreatmentDialog] Unable to parse birth date string", { value })
    return null
}

export function EditTreatmentDialog({ open, onOpenChange, treatmentId, onSuccess, lockTreatmentTypeSelection = false }: EditTreatmentDialogProps) {
    const { toast } = useToast()
    const [updateTreatment, { isLoading: isUpdatingTreatment }] = useUpdateTreatmentMutation()
    const { data: treatmentTypes = [], isLoading: isLoadingTreatmentTypes } = useTreatmentTypes()
    const [isLoadingTreatmentData, setIsLoadingTreatmentData] = useState(false)
    const [treatmentTypeSearchValue, setTreatmentTypeSearchValue] = useState("")

    const [treatmentData, setTreatmentData] = useState({
        name: "",
        treatment_type_id: "",
        gender: "male" as "male" | "female",
        birth_date: null as Date | null,
        health_notes: "",
        vet_name: "",
        vet_phone: "",
        aggression_risk: false,
        people_anxious: false,
    })

    // Load treatment data when dialog opens
    useEffect(() => {
        if (open && treatmentId) {
            setIsLoadingTreatmentData(true)
            getTreatmentById(treatmentId)
                .then((result) => {
                    if (result.success && result.treatment) {
                        const treatment = result.treatment
                        // If treatment has no treatmentType, use first treatmentType as default
                        const defaultTreatmentTypeId = treatment.treatment_type_id || (treatmentTypes.length > 0 ? treatmentTypes[0].id : "")
                        const defaultTreatmentTypeName =
                            treatmentTypes.find((treatmentType) => treatmentType.id === defaultTreatmentTypeId)?.name || ""
                        const parsedBirthDate = parseBirthDateString(treatment.birth_date)
                        console.log("🐾 [EditTreatmentDialog] Loaded treatment data", {
                            treatmentId,
                            rawBirthDate: treatment.birth_date,
                            parsedBirthDate,
                        })
                        setTreatmentData({
                            name: treatment.name,
                            treatment_type_id: defaultTreatmentTypeId,
                            gender: treatment.gender,
                            birth_date: parsedBirthDate,
                            health_notes: treatment.health_notes || "",
                            vet_name: treatment.vet_name || "",
                            vet_phone: treatment.vet_phone || "",
                            aggression_risk: treatment.aggression_risk ?? false,
                            people_anxious: treatment.people_anxious ?? false,
                        })
                        setTreatmentTypeSearchValue(defaultTreatmentTypeName)
                    } else {
                        toast({
                            title: "שגיאה",
                            description: result.error || "לא ניתן לטעון את פרטי הלקוח",
                            variant: "destructive",
                        })
                        onOpenChange(false)
                    }
                })
                .catch((error) => {
                    console.error("Failed to load treatment data:", error)
                    toast({
                        title: "שגיאה",
                        description: "לא ניתן לטעון את פרטי הלקוח",
                        variant: "destructive",
                    })
                    onOpenChange(false)
                })
                .finally(() => {
                    setIsLoadingTreatmentData(false)
                })
        }
    }, [open, treatmentId, treatmentTypes, toast, onOpenChange])

    const treatmentTypeNameById = useMemo(() => {
        const lookup = new Map<string, string>()
        treatmentTypes.forEach((treatmentType) => {
            lookup.set(treatmentType.id, treatmentType.name)
        })
        return lookup
    }, [treatmentTypes])

    useEffect(() => {
        if (!treatmentData.treatment_type_id) {
            return
        }

        const resolvedName = treatmentTypeNameById.get(treatmentData.treatment_type_id) || ""
        if (resolvedName && resolvedName !== treatmentTypeSearchValue) {
            setTreatmentTypeSearchValue(resolvedName)
        }
    }, [treatmentData.treatment_type_id, treatmentTypeNameById, treatmentTypeSearchValue])

    const searchTreatmentTypes = useCallback(
        async (searchTerm: string) => {
            const normalizedTerm = searchTerm.trim().toLowerCase()
            const filtered = treatmentTypes
                .filter((treatmentType) => {
                    if (!normalizedTerm) {
                        return true
                    }
                    return treatmentType.name.toLowerCase().includes(normalizedTerm)
                })
                .map((treatmentType) => treatmentType.name)

            const uniqueResults = Array.from(new Set(filtered)).slice(0, 20)

            console.log("🔎 [EditTreatmentDialog] Filtering treatmentTypes for autocomplete", {
                searchTerm,
                results: uniqueResults.length,
            })

            return uniqueResults
        },
        [treatmentTypes]
    )

    const handleClose = useCallback(() => {
        if (isUpdatingTreatment || isLoadingTreatmentData) {
            return
        }
        onOpenChange(false)
        // Reset form after a delay to allow animation to complete
        setTimeout(() => {
            setTreatmentData({
                name: "",
                treatment_type_id: "",
                gender: "male",
                birth_date: null,
                health_notes: "",
                vet_name: "",
                vet_phone: "",
                aggression_risk: false,
                people_anxious: false,
            })
            setTreatmentTypeSearchValue("")
        }, 300)
    }, [isUpdatingTreatment, isLoadingTreatmentData, onOpenChange])

    const handleUpdateTreatment = useCallback(async () => {
        if (!treatmentId) {
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן לקוח ללא שיוך",
                variant: "destructive",
            })
            return
        }

        if (!treatmentData.name.trim()) {
            toast({
                title: "שדה חובה",
                description: "שם הלקוח נדרש",
                variant: "destructive",
            })
            return
        }

        if (!lockTreatmentTypeSelection) {
            if (!treatmentData.treatment_type_id || treatmentData.treatment_type_id === "__none__") {
                toast({
                    title: "שדה חובה",
                    description: "יש לבחור סגנון שירות ללקוח",
                    variant: "destructive",
                })
                return
            }
        }

        try {
            console.log("🔍 [EditTreatmentDialog] Updating treatment with data:", treatmentData)
            const result = await updateTreatment({
                treatmentId,
                name: treatmentData.name.trim(),
                ...(lockTreatmentTypeSelection ? {} : { treatment_type_id: treatmentData.treatment_type_id }),
                gender: treatmentData.gender,
                birth_date: treatmentData.birth_date ? format(treatmentData.birth_date, "yyyy-MM-dd") : null,
                health_notes: treatmentData.health_notes.trim() || null,
                vet_name: treatmentData.vet_name.trim() || null,
                vet_phone: treatmentData.vet_phone.trim() || null,
                aggression_risk: treatmentData.aggression_risk || null,
                people_anxious: treatmentData.people_anxious || null,
            }).unwrap()

            if (result.success) {
                toast({
                    title: "הלקוח עודכן בהצלחה",
                    description: `פרטי ${treatmentData.name} עודכנו בהצלחה.`,
                })
                handleClose()
                onSuccess?.()
            } else {
                throw new Error(result.error || "שגיאה בעדכון הלקוח")
            }
        } catch (error) {
            console.error("Failed to update treatment:", error)
            toast({
                title: "שגיאה בעדכון הלקוח",
                description: error instanceof Error ? error.message : "לא ניתן לעדכן את הלקוח כעת",
                variant: "destructive",
            })
        }
    }, [treatmentId, treatmentData, updateTreatment, toast, handleClose, onSuccess, lockTreatmentTypeSelection])

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto text-right">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>ערוך פרטי לקוח</DialogTitle>
                    <DialogDescription>
                        {lockTreatmentTypeSelection ? "ניתן לעדכן פרטים, אך לא ניתן לשנות את סגנון השירות לאחר שנקבעו תורים." : "עדכן את הפרטים של הלקוח"}
                    </DialogDescription>
                </DialogHeader>
                {isLoadingTreatmentData ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="mr-2 text-sm text-gray-500">טוען פרטי לקוח...</span>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-treatment-name" className="text-right">
                                שם הלקוח <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="edit-treatment-name"
                                placeholder="הכנס שם הלקוח"
                                value={treatmentData.name}
                                onChange={(e) => setTreatmentData({ ...treatmentData, name: e.target.value })}
                                className="text-right"
                                dir="rtl"
                            />
                        </div>

                        <div className="space-y-2">
                                <Label htmlFor="edit-treatment-treatmentType" className="text-right">
                                סגנון שירות <span className="text-red-500">*</span>
                            </Label>
                            {lockTreatmentTypeSelection ? (
                                <>
                                    <Input
                                        id="edit-treatment-treatmentType"
                                        value={treatmentTypeSearchValue}
                                        disabled
                                        className="text-right"
                                        dir="rtl"
                                    />
                                    <p className="text-xs text-gray-500 text-right">
                                        לא ניתן לשנות סגנון שירות ללקוח שכבר הוזמנו לו תורים.
                                    </p>
                                </>
                            ) : (
                                <AutocompleteFilter
                                    value={treatmentTypeSearchValue}
                                    onChange={(value) => {
                                        setTreatmentTypeSearchValue(value)
                                        setTreatmentData((prev) => {
                                            const currentTreatmentTypeName = prev.treatment_type_id ? treatmentTypeNameById.get(prev.treatment_type_id) || "" : ""
                                            const normalizedTyped = value.trim().toLowerCase()
                                            const normalizedCurrent = currentTreatmentTypeName.trim().toLowerCase()
                                            const shouldClear =
                                                !value.trim() ||
                                                !normalizedCurrent ||
                                                normalizedTyped !== normalizedCurrent

                                            if (shouldClear) {
                                                console.log("⚠️ [EditTreatmentDialog] Clearing treatmentType selection due to manual input", {
                                                    typedValue: value,
                                                    previousTreatmentTypeId: prev.treatment_type_id,
                                                    previousTreatmentTypeName: currentTreatmentTypeName,
                                                })
                                            }

                                            return {
                                                ...prev,
                                                treatment_type_id: shouldClear ? "" : prev.treatment_type_id,
                                            }
                                        })
                                    }}
                                    onSelect={(selectedName) => {
                                        const matchedTreatmentType = treatmentTypes.find((treatmentType) => treatmentType.name === selectedName)
                                        console.log("✅ [EditTreatmentDialog] TreatmentType selected from autocomplete", {
                                            selectedName,
                                            matchedTreatmentTypeId: matchedTreatmentType?.id || null,
                                        })
                                        setTreatmentTypeSearchValue(selectedName)
                                        setTreatmentData((prev) => ({
                                            ...prev,
                                            treatment_type_id: matchedTreatmentType?.id || "",
                                        }))
                                    }}
                                    placeholder={isLoadingTreatmentTypes ? "טוען סגנונות..." : "הקלד כדי לחפש סגנון"}
                                    className="text-right"
                                    searchFn={searchTreatmentTypes}
                                    minSearchLength={1}
                                    debounceMs={200}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={10}
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-treatment-gender" className="text-right">מין</Label>
                                <Select
                                    value={treatmentData.gender}
                                    onValueChange={(value: "male" | "female") =>
                                        setTreatmentData({ ...treatmentData, gender: value })
                                    }
                                >
                                    <SelectTrigger id="edit-treatment-gender" className="text-right" dir="rtl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">זכר</SelectItem>
                                        <SelectItem value="female">נקבה</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-treatment-birth-date" className="text-right">תאריך לידה</Label>
                                <DatePickerInput
                                    id="edit-treatment-birth-date"
                                    value={treatmentData.birth_date}
                                    onChange={(date) => {
                                        console.log("📅 [EditTreatmentDialog] Birth date updated", { date })
                                        setTreatmentData({ ...treatmentData, birth_date: date })
                                    }}
                                    className="text-right w-full"
                                    dir="rtl"
                                />
                            </div>
                        </div>



                        <div className="space-y-2">
                            <Label htmlFor="edit-treatment-health-notes" className="text-right">הערות בריאות</Label>
                            <Textarea
                                id="edit-treatment-health-notes"
                                placeholder="הערות על בעיות בריאות, אלרגיות וכו'"
                                value={treatmentData.health_notes}
                                onChange={(e) => setTreatmentData({ ...treatmentData, health_notes: e.target.value })}
                                className="text-right min-h-[80px]"
                                dir="rtl"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <input
                                    type="checkbox"
                                    id="edit-treatment-aggression-risk"
                                    checked={treatmentData.aggression_risk}
                                    onChange={(e) => setTreatmentData({ ...treatmentData, aggression_risk: e.target.checked })}
                                    className="h-4 w-4"
                                />
                                <Label htmlFor="edit-treatment-aggression-risk" className="text-right cursor-pointer">
                                    סיכון התנהגותי מול אחרים
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <input
                                    type="checkbox"
                                    id="edit-treatment-people-anxious"
                                    checked={treatmentData.people_anxious}
                                    onChange={(e) => setTreatmentData({ ...treatmentData, people_anxious: e.target.checked })}
                                    className="h-4 w-4"
                                />
                                <Label htmlFor="edit-treatment-people-anxious" className="text-right cursor-pointer">
                                    נוטה להיבהל ממגע במסגרת חדשה
                                </Label>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-treatment-vet-name" className="text-right">שם הוטרינר</Label>
                                <Input
                                    id="edit-treatment-vet-name"
                                    placeholder="שם הוטרינר"
                                    value={treatmentData.vet_name}
                                    onChange={(e) => setTreatmentData({ ...treatmentData, vet_name: e.target.value })}
                                    className="text-right"
                                    dir="rtl"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-treatment-vet-phone" className="text-right">טלפון הוטרינר</Label>
                                <Input
                                    id="edit-treatment-vet-phone"
                                    placeholder="טלפון הוטרינר"
                                    value={treatmentData.vet_phone}
                                    onChange={(e) => setTreatmentData({ ...treatmentData, vet_phone: e.target.value })}
                                    className="text-right"
                                    dir="rtl"
                                />
                            </div>
                        </div>
                    </div>
                )}
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        onClick={handleUpdateTreatment}
                        disabled={isUpdatingTreatment || isLoadingTreatmentData || !treatmentData.name.trim()}
                        className="inline-flex items-center gap-2"
                    >
                        {isUpdatingTreatment && <Loader2 className="h-4 w-4 animate-spin" />}
                        עדכן לקוח
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isUpdatingTreatment || isLoadingTreatmentData}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


import { useState, useCallback, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useCreateTreatmentMutation } from "@/store/services/supabaseApi"
import { useTreatmentTypes } from "@/hooks/useTreatmentTypes"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { supabase } from "@/integrations/supabase/client"
import { format, parse } from "date-fns"

interface AddTreatmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string | null
    onSuccess?: (treatmentId: string) => void
}

export function AddTreatmentDialog({ open, onOpenChange, customerId, onSuccess }: AddTreatmentDialogProps) {
    const { toast } = useToast()
    const [createTreatment, { isLoading: isCreatingTreatment }] = useCreateTreatmentMutation()
    const { data: treatmentTypes = [], isLoading: isLoadingTreatmentTypes } = useTreatmentTypes()

    const [treatmentData, setTreatmentData] = useState({
        name: "",
        treatment_type_id: "",
        treatment_type_name: "", // For AutocompleteFilter display
        gender: "" as "" | "male" | "female",
        birth_date: null as Date | null,
        health_notes: "",
        vet_name: "",
        vet_phone: "",
        aggression_risk: false,
        people_anxious: false,
    })

    // Search function for treatmentTypes
    const searchTreatmentTypes = useCallback(async (searchTerm: string): Promise<string[]> => {
        try {
            let query = supabase
                .from("treatmentTypes")
                .select("name")
                .order("name")
                .limit(20)

            // If there's a search term, filter by it; otherwise return first 20
            if (searchTerm && searchTerm.trim().length > 0) {
                query = query.ilike("name", `%${searchTerm.trim()}%`)
            }

            const { data, error } = await query

            if (error) throw error
            return (data || []).map(b => b.name)
        } catch (error) {
            console.error("Error searching treatmentTypes:", error)
            return []
        }
    }, [])

    const handleClose = useCallback(() => {
        if (isCreatingTreatment) {
            return
        }
        onOpenChange(false)
        // Reset form after a delay to allow animation to complete
        setTimeout(() => {
            setTreatmentData({
                name: "",
                treatment_type_id: "",
                treatment_type_name: "",
                gender: "",
                birth_date: null,
                health_notes: "",
                vet_name: "",
                vet_phone: "",
                aggression_risk: false,
                people_anxious: false,
            })
        }, 300)
    }, [isCreatingTreatment, onOpenChange])

    const handleCreateTreatment = useCallback(async () => {
        if (!customerId) {
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף כלב ללא זיהוי לקוח",
                variant: "destructive",
            })
            return
        }

        if (!treatmentData.name.trim()) {
            toast({
                title: "שדה חובה",
                description: "שם הכלב נדרש",
                variant: "destructive",
            })
            return
        }

        if (treatmentData.gender !== "male" && treatmentData.gender !== "female") {
            toast({
                title: "שדה חובה",
                description: "יש לבחור מין לכלב",
                variant: "destructive",
            })
            return
        }

        // Validate treatmentType selection
        const selectedTreatmentType = treatmentTypes.find(b => b.name === treatmentData.treatment_type_name)
        if (!selectedTreatmentType) {
            toast({
                title: "שדה חובה",
                description: "יש לבחור גזע לכלב",
                variant: "destructive",
            })
            return
        }

        try {
            console.log("🔍 [AddTreatmentDialog] Creating treatment with data:", treatmentData)
            const result = await createTreatment({
                customerId,
                name: treatmentData.name.trim(),
                treatment_type_id: selectedTreatmentType.id,
                gender: treatmentData.gender,
                birth_date: treatmentData.birth_date ? format(treatmentData.birth_date, "yyyy-MM-dd") : null,
                health_notes: treatmentData.health_notes.trim() || null,
                vet_name: treatmentData.vet_name.trim() || null,
                vet_phone: treatmentData.vet_phone.trim() || null,
                aggression_risk: treatmentData.aggression_risk || null,
                people_anxious: treatmentData.people_anxious || null,
            }).unwrap()

            if (result.success && result.treatmentId) {
                toast({
                    title: "הכלב נוסף בהצלחה",
                    description: `${treatmentData.name} נוסף לרשימת הכלבים שלך.`,
                })
                handleClose()
                onSuccess?.(result.treatmentId)
            } else {
                throw new Error(result.error || "שגיאה ביצירת הכלב")
            }
        } catch (error) {
            console.error("Failed to create treatment:", error)
            toast({
                title: "שגיאה ביצירת הכלב",
                description: error instanceof Error ? error.message : "לא ניתן ליצור את הכלב כעת",
                variant: "destructive",
            })
        }
    }, [customerId, treatmentData, createTreatment, toast, handleClose, onSuccess])

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto text-right">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>הוסף כלב חדש</DialogTitle>
                    <DialogDescription>מלא את הפרטים כדי להוסיף כלב חדש לרשימה שלך</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="add-treatment-name" className="text-right">
                            שם הכלב <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="add-treatment-name"
                            placeholder="הכנס שם הכלב"
                            value={treatmentData.name}
                            onChange={(e) => setTreatmentData({ ...treatmentData, name: e.target.value })}
                            className="text-right"
                            dir="rtl"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="add-treatment-treatmentType" className="text-right">
                            גזע <span className="text-red-500">*</span>
                        </Label>
                        <AutocompleteFilter
                            value={treatmentData.treatment_type_name}
                            onChange={(treatmentTypeName) => {
                                const treatmentType = treatmentTypes.find(b => b.name === treatmentTypeName)
                                setTreatmentData({
                                    ...treatmentData,
                                    treatment_type_name: treatmentTypeName,
                                    treatment_type_id: treatmentType?.id || ""
                                })
                            }}
                            onSelect={(treatmentTypeName) => {
                                const treatmentType = treatmentTypes.find(b => b.name === treatmentTypeName)
                                setTreatmentData({
                                    ...treatmentData,
                                    treatment_type_name: treatmentTypeName,
                                    treatment_type_id: treatmentType?.id || ""
                                })
                            }}
                            placeholder={isLoadingTreatmentTypes ? "טוען גזעים..." : "חפש גזע..."}
                            searchFn={searchTreatmentTypes}
                            minSearchLength={0}
                            autoSearchOnFocus={true}
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="add-treatment-gender" className="text-right">
                                מין <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={treatmentData.gender}
                                onValueChange={(value: "male" | "female") =>
                                    setTreatmentData({ ...treatmentData, gender: value })
                                }
                            >
                                <SelectTrigger id="add-treatment-gender" className="text-right" dir="rtl">
                                    <SelectValue placeholder="בחר מין" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">זכר</SelectItem>
                                    <SelectItem value="female">נקבה</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add-treatment-birth-date" className="text-right">תאריך לידה</Label>
                            <DatePickerInput
                                id="add-treatment-birth-date"
                                value={treatmentData.birth_date}
                                onChange={(date) => setTreatmentData({ ...treatmentData, birth_date: date })}
                                placeholder="dd/mm/yyyy"
                                className="text-right w-full"
                                dir="rtl"
                            />
                        </div>
                    </div>



                    <div className="space-y-2">
                        <Label htmlFor="add-treatment-health-notes" className="text-right">הערות בריאות</Label>
                        <Textarea
                            id="add-treatment-health-notes"
                            placeholder="הערות על בעיות בריאות, אלרגיות וכו'"
                            value={treatmentData.health_notes}
                            onChange={(e) => setTreatmentData({ ...treatmentData, health_notes: e.target.value })}
                            className="text-right min-h-[80px]"
                            dir="rtl"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                                id="add-treatment-aggression-risk"
                                checked={treatmentData.aggression_risk}
                                onCheckedChange={(checked) => setTreatmentData({ ...treatmentData, aggression_risk: checked === true })}
                            />
                            <Label htmlFor="add-treatment-aggression-risk" className="text-right cursor-pointer">
                                סיכון תוקפנות כלפי כלבים אחרים
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                                id="add-treatment-people-anxious"
                                checked={treatmentData.people_anxious}
                                onCheckedChange={(checked) => setTreatmentData({ ...treatmentData, people_anxious: checked === true })}
                            />
                            <Label htmlFor="add-treatment-people-anxious" className="text-right cursor-pointer">
                                נוטה להיבהל ממגע במסגרת חדשה
                            </Label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="add-treatment-vet-name" className="text-right">שם הוטרינר</Label>
                            <Input
                                id="add-treatment-vet-name"
                                placeholder="שם הוטרינר"
                                value={treatmentData.vet_name}
                                onChange={(e) => setTreatmentData({ ...treatmentData, vet_name: e.target.value })}
                                className="text-right"
                                dir="rtl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add-treatment-vet-phone" className="text-right">טלפון הוטרינר</Label>
                            <Input
                                id="add-treatment-vet-phone"
                                placeholder="טלפון הוטרינר"
                                value={treatmentData.vet_phone}
                                onChange={(e) => setTreatmentData({ ...treatmentData, vet_phone: e.target.value })}
                                className="text-right"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        onClick={handleCreateTreatment}
                        disabled={
                            isCreatingTreatment ||
                            !treatmentData.name.trim() ||
                            treatmentData.gender !== "male" && treatmentData.gender !== "female"
                        }
                        className="inline-flex items-center gap-2"
                    >
                        {isCreatingTreatment && <Loader2 className="h-4 w-4 animate-spin" />}
                        הוסף כלב
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isCreatingTreatment}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


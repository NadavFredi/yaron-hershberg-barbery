import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Loader2, Save } from "lucide-react"
import { useEffect, useState } from "react"

interface GardenCapacityLimit {
    id: string
    effective_date: string
    total_limit: number
    hourly_limit: number
    trial_limit: number
    full_day_limit: number
    daily_cost: number
    hourly_cost: number
    daily_cost_with_grooming: number
    fetching_late_pricing_addition: number
}

export function SettingsGardenSection() {
    const { toast } = useToast()
    const [limit, setLimit] = useState<GardenCapacityLimit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const [formData, setFormData] = useState({
        total_limit: 0,
        hourly_limit: 0,
        trial_limit: 0,
        full_day_limit: 0,
        daily_cost: 0,
        hourly_cost: 0,
        daily_cost_with_grooming: 0,
        fetching_late_pricing_addition: 0,
    })

    useEffect(() => {
        fetchLimit()
    }, [])

    const fetchLimit = async () => {
        try {
            setIsLoading(true)
            // Fetch the first (and should be only) row, or create one if none exists
            const { data, error } = await supabase
                .from("daycare_capacity_limits")
                .select("*")
                .order("effective_date", { ascending: false })
                .limit(1)
                .single()

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error
            }

            if (data) {
                setLimit(data)
                setFormData({
                    total_limit: data.total_limit || 0,
                    hourly_limit: data.hourly_limit || 0,
                    trial_limit: data.trial_limit || 0,
                    full_day_limit: data.full_day_limit || 0,
                    daily_cost: data.daily_cost || 0,
                    hourly_cost: data.hourly_cost || 0,
                    daily_cost_with_grooming: data.daily_cost_with_grooming || 0,
                    fetching_late_pricing_addition: data.fetching_late_pricing_addition || 0,
                })
            } else {
                // No row exists, create a default one
                const { data: newData, error: createError } = await supabase
                    .from("daycare_capacity_limits")
                    .insert({
                        effective_date: new Date().toISOString().split('T')[0],
                        total_limit: 0,
                        hourly_limit: 0,
                        trial_limit: 0,
                        full_day_limit: 0,
                        daily_cost: 0,
                        hourly_cost: 0,
                        daily_cost_with_grooming: 0,
                        fetching_late_pricing_addition: 0,
                    })
                    .select()
                    .single()

                if (createError) throw createError

                setLimit(newData)
                setFormData({
                    total_limit: 0,
                    hourly_limit: 0,
                    trial_limit: 0,
                    full_day_limit: 0,
                    daily_cost: 0,
                    hourly_cost: 0,
                    daily_cost_with_grooming: 0,
                    fetching_late_pricing_addition: 0,
                })
            }
        } catch (error) {
            console.error("Error fetching garden capacity limits:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את הגדרות הגן",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            setIsSaving(true)

            // Validate inputs
            if (formData.total_limit < 0 || formData.hourly_limit < 0 ||
                formData.trial_limit < 0 || formData.full_day_limit < 0 ||
                formData.daily_cost < 0 || formData.hourly_cost < 0 ||
                formData.daily_cost_with_grooming < 0 || formData.fetching_late_pricing_addition < 0) {
                toast({
                    title: "שגיאה",
                    description: "כל הערכים חייבים להיות מספרים חיוביים",
                    variant: "destructive",
                })
                return
            }

            if (limit) {
                // Update existing row
                const { error } = await supabase
                    .from("daycare_capacity_limits")
                    .update({
                        total_limit: formData.total_limit,
                        hourly_limit: formData.hourly_limit,
                        trial_limit: formData.trial_limit,
                        full_day_limit: formData.full_day_limit,
                        daily_cost: formData.daily_cost,
                        hourly_cost: formData.hourly_cost,
                        daily_cost_with_grooming: formData.daily_cost_with_grooming,
                        fetching_late_pricing_addition: formData.fetching_late_pricing_addition,
                    })
                    .eq("id", limit.id)

                if (error) throw error

                toast({
                    title: "הצלחה",
                    description: "הגדרות הגן עודכנו בהצלחה",
                })
            } else {
                // Create new row (shouldn't happen, but just in case)
                const { error } = await supabase
                    .from("daycare_capacity_limits")
                    .insert({
                        effective_date: new Date().toISOString().split('T')[0],
                        total_limit: formData.total_limit,
                        hourly_limit: formData.hourly_limit,
                        trial_limit: formData.trial_limit,
                        full_day_limit: formData.full_day_limit,
                        daily_cost: formData.daily_cost,
                        hourly_cost: formData.hourly_cost,
                        daily_cost_with_grooming: formData.daily_cost_with_grooming,
                        fetching_late_pricing_addition: formData.fetching_late_pricing_addition,
                    })

                if (error) throw error

                toast({
                    title: "הצלחה",
                    description: "הגדרות הגן נוצרו בהצלחה",
                })
            }

            await fetchLimit()
        } catch (error) {
            console.error("Error saving garden capacity limits:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הגדרות הגן",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-4 text-gray-600">טוען...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6" dir="rtl">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">הגדרות גן</h2>
                <p className="text-gray-600 mt-1">נהל את הגבלות הקיבולת של הגן</p>
            </div>

            <Card>

                <CardContent className="space-y-4 pt-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">הגבלות קיבולת</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    מקסימום כלבים כולל
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.total_limit}
                                    onChange={(e) => setFormData({ ...formData, total_limit: parseInt(e.target.value) || 0 })}
                                    className="text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    מקסימום שעתי
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.hourly_limit}
                                    onChange={(e) => setFormData({ ...formData, hourly_limit: parseInt(e.target.value) || 0 })}
                                    className="text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    מקסימום ניסיון
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.trial_limit}
                                    onChange={(e) => setFormData({ ...formData, trial_limit: parseInt(e.target.value) || 0 })}
                                    className="text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    מקסימום יום מלא
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.full_day_limit}
                                    onChange={(e) => setFormData({ ...formData, full_day_limit: parseInt(e.target.value) || 0 })}
                                    className="text-right"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">תמחור</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    עלות יומית (₪)
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={formData.daily_cost}
                                    onChange={(e) => setFormData({ ...formData, daily_cost: parseFloat(e.target.value) || 0 })}
                                    className="text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    עלות שעתית (₪)
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={formData.hourly_cost}
                                    onChange={(e) => setFormData({ ...formData, hourly_cost: parseFloat(e.target.value) || 0 })}
                                    className="text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    עלות יומית עם טיפוח (₪)
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={formData.daily_cost_with_grooming}
                                    onChange={(e) => setFormData({ ...formData, daily_cost_with_grooming: parseFloat(e.target.value) || 0 })}
                                    className="text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    תוספת איחור לאיסוף (₪)
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={formData.fetching_late_pricing_addition}
                                    onChange={(e) => setFormData({ ...formData, fetching_late_pricing_addition: parseFloat(e.target.value) || 0 })}
                                    className="text-right"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-start pt-4">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                    שומר...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 ml-2" />
                                    שמור הגדרות
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

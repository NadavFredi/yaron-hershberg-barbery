import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Save, Plus, Trash2, History, Brush } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { extractGroomingAppointmentId } from "@/lib/utils"

interface HairColoringModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointmentId: string | null
    groomingAppointmentId: string | null
    customerId: string | null
    customerName?: string
}

export const HairColoringModal: React.FC<HairColoringModalProps> = ({
    open,
    onOpenChange,
    appointmentId,
    groomingAppointmentId,
    customerId,
    customerName,
}) => {
    const { toast } = useToast()
    
    // Current session state
    const [hairColoringSession, setHairColoringSession] = useState<{
        id: string | null
        total_dosage: number | null
        oxygen_level: number | null
        notes: string | null
    } | null>(null)
    
    const [hairColoringItems, setHairColoringItems] = useState<Array<{
        id: string
        color_number: number
        dosage: number
        notes: string | null
    }>>([])
    
    const [isSavingHairColoring, setIsSavingHairColoring] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    
    // History state
    const [hairColoringHistory, setHairColoringHistory] = useState<Array<{
        session: {
            id: string
            total_dosage: number | null
            oxygen_level: number | null
            notes: string | null
            created_at: string
        }
        items: Array<{
            id: string
            color_number: number
            dosage: number
            notes: string | null
        }>
        appointment: {
            start_at: string
            customer_name: string
        }
    }>>([])
    
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)

    // Fetch current session data
    const fetchHairColoringData = async () => {
        if (!appointmentId && !groomingAppointmentId || !open) {
            setHairColoringSession(null)
            setHairColoringItems([])
            return
        }

        setIsLoading(true)
        const actualAppointmentId = extractGroomingAppointmentId(appointmentId || "", groomingAppointmentId || "")
        
        if (!actualAppointmentId) {
            setHairColoringSession(null)
            setHairColoringItems([])
            setIsLoading(false)
            return
        }

        try {
            // Fetch session
            const { data: sessionData, error: sessionError } = await supabase
                .from("hair_coloring_sessions")
                .select("*")
                .eq("grooming_appointment_id", actualAppointmentId)
                .maybeSingle()

            if (sessionError && sessionError.code !== "PGRST116") {
                console.error("Error fetching hair coloring session:", sessionError)
                setIsLoading(false)
                return
            }

            if (sessionData) {
                setHairColoringSession({
                    id: sessionData.id,
                    total_dosage: sessionData.total_dosage,
                    oxygen_level: sessionData.oxygen_level,
                    notes: sessionData.notes,
                })

                // Fetch items
                const { data: itemsData, error: itemsError } = await supabase
                    .from("hair_coloring_items")
                    .select("*")
                    .eq("hair_coloring_session_id", sessionData.id)
                    .order("created_at", { ascending: true })

                if (itemsError) {
                    console.error("Error fetching hair coloring items:", itemsError)
                    setHairColoringItems([])
                } else {
                    setHairColoringItems(itemsData || [])
                }
            } else {
                setHairColoringSession(null)
                setHairColoringItems([])
            }
        } catch (error) {
            console.error("Error fetching hair coloring data:", error)
            setHairColoringSession(null)
            setHairColoringItems([])
        } finally {
            setIsLoading(false)
        }
    }

    // Fetch history
    const fetchHairColoringHistory = async () => {
        if (!customerId || !open) return

        setIsLoadingHistory(true)
        try {
            // First get all grooming appointments for this customer
            const { data: appointments, error: appointmentsError } = await supabase
                .from("grooming_appointments")
                .select("id, start_at, customer_id, customer:customers!grooming_appointments_customer_id_fkey(full_name)")
                .eq("customer_id", customerId)
                .order("start_at", { ascending: false })
                .limit(50)

            if (appointmentsError) throw appointmentsError

            // Then get hair coloring sessions for these appointments
            const appointmentIds = (appointments || []).map(a => a.id)
            if (appointmentIds.length === 0) {
                setHairColoringHistory([])
                setIsLoadingHistory(false)
                return
            }

            const { data: sessions, error: sessionsError } = await supabase
                .from("hair_coloring_sessions")
                .select(`
                    *,
                    items:hair_coloring_items(*)
                `)
                .in("grooming_appointment_id", appointmentIds)
                .order("created_at", { ascending: false })

            if (sessionsError) throw sessionsError

            // Combine the data
            const history = (sessions || []).map((session) => {
                const appointment = appointments?.find(a => a.id === session.grooming_appointment_id)
                return {
                    session: {
                        id: session.id,
                        total_dosage: session.total_dosage,
                        oxygen_level: session.oxygen_level,
                        notes: session.notes,
                        created_at: session.created_at,
                    },
                    items: session.items || [],
                    appointment: {
                        start_at: appointment?.start_at || "",
                        customer_name: (appointment?.customer as { full_name: string } | null)?.full_name || customerName || "",
                    },
                }
            })

            setHairColoringHistory(history)
        } catch (error) {
            console.error("Error fetching hair coloring history:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את היסטוריית הצביעה",
                variant: "destructive",
            })
        } finally {
            setIsLoadingHistory(false)
        }
    }

    // Load data when modal opens
    useEffect(() => {
        if (open) {
            fetchHairColoringData()
            if (customerId) {
                fetchHairColoringHistory()
            }
        }
    }, [open, appointmentId, groomingAppointmentId, customerId])

    const handleSaveHairColoring = async () => {
        if (!appointmentId && !groomingAppointmentId) return

        const actualAppointmentId = extractGroomingAppointmentId(appointmentId || "", groomingAppointmentId || "")
        if (!actualAppointmentId) return

        setIsSavingHairColoring(true)
        try {
            let sessionId: string

            if (hairColoringSession?.id) {
                // Update existing session
                const { data, error } = await supabase
                    .from("hair_coloring_sessions")
                    .update({
                        total_dosage: hairColoringSession.total_dosage || null,
                        oxygen_level: hairColoringSession.oxygen_level || null,
                        notes: hairColoringSession.notes || null,
                    })
                    .eq("id", hairColoringSession.id)
                    .select()
                    .single()

                if (error) throw error
                sessionId = data.id

                // Delete existing items
                await supabase
                    .from("hair_coloring_items")
                    .delete()
                    .eq("hair_coloring_session_id", sessionId)
            } else {
                // Create new session
                const { data, error } = await supabase
                    .from("hair_coloring_sessions")
                    .insert({
                        grooming_appointment_id: actualAppointmentId,
                        total_dosage: hairColoringSession?.total_dosage || null,
                        oxygen_level: hairColoringSession?.oxygen_level || null,
                        notes: hairColoringSession?.notes || null,
                    })
                    .select()
                    .single()

                if (error) throw error
                sessionId = data.id
            }

            // Insert items
            if (hairColoringItems.length > 0) {
                const itemsToInsert = hairColoringItems.map(item => ({
                    hair_coloring_session_id: sessionId,
                    color_number: item.color_number,
                    dosage: item.dosage,
                    notes: item.notes || null,
                }))

                const { error: itemsError } = await supabase
                    .from("hair_coloring_items")
                    .insert(itemsToInsert)

                if (itemsError) throw itemsError
            }

            toast({
                title: "נשמר בהצלחה",
                description: "פרטי הצביעה נשמרו",
            })

            // Refresh data
            await fetchHairColoringData()
            if (customerId) {
                await fetchHairColoringHistory()
            }
        } catch (error) {
            console.error("Error saving hair coloring:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את פרטי הצביעה",
                variant: "destructive",
            })
        } finally {
            setIsSavingHairColoring(false)
        }
    }

    const handleDeleteSession = async () => {
        if (!hairColoringSession?.id) return

        try {
            const { error } = await supabase
                .from("hair_coloring_sessions")
                .delete()
                .eq("id", hairColoringSession.id)

            if (error) throw error

            toast({
                title: "נמחק בהצלחה",
                description: "פרטי הצביעה נמחקו",
            })

            setHairColoringSession(null)
            setHairColoringItems([])
            await fetchHairColoringHistory()
        } catch (error) {
            console.error("Error deleting hair coloring:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את פרטי הצביעה",
                variant: "destructive",
            })
        }
    }

    const handleAddColorItem = () => {
        setHairColoringItems([
            ...hairColoringItems,
            {
                id: `temp-${Date.now()}`,
                color_number: 0,
                dosage: 0,
                notes: null,
            },
        ])
    }

    const handleRemoveColorItem = (index: number) => {
        setHairColoringItems(hairColoringItems.filter((_, i) => i !== index))
    }

    const handleUpdateColorItem = (index: number, field: "color_number" | "dosage" | "notes", value: number | string) => {
        const updated = [...hairColoringItems]
        updated[index] = {
            ...updated[index],
            [field]: value,
        }
        setHairColoringItems(updated)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Brush className="h-5 w-5 text-pink-600" />
                        צבעים - {customerName || "לקוח"}
                    </DialogTitle>
                    <DialogDescription>
                        ניהול פרטי צביעה לטיפול זה וצפייה בהיסטוריה
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="current" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="current">טיפול נוכחי</TabsTrigger>
                        <TabsTrigger value="history">היסטוריה</TabsTrigger>
                    </TabsList>

                    <TabsContent value="current" className="mt-4">
                        <ScrollArea className="max-h-[calc(90vh-12rem)] pr-4">
                            <div className="space-y-4">
                                {/* Notes */}
                                <div>
                                    <label className="text-sm text-gray-700 mb-1 block">הערות</label>
                                    <Textarea
                                        value={hairColoringSession?.notes || ""}
                                        onChange={(e) => {
                                            setHairColoringSession({
                                                id: hairColoringSession?.id || null,
                                                total_dosage: hairColoringSession?.total_dosage || null,
                                                oxygen_level: hairColoringSession?.oxygen_level || null,
                                                notes: e.target.value || null,
                                            })
                                        }}
                                        placeholder="הזן הערות..."
                                        className="text-sm text-right bg-pink-50 border-pink-200 resize-y min-h-[60px]"
                                        dir="rtl"
                                    />
                                </div>

                                {/* Colors Table */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-gray-700">צבעים</label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAddColorItem}
                                            className="h-8 px-3 text-xs"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            הוסף צבע
                                        </Button>
                                    </div>
                                    {hairColoringItems.length === 0 ? (
                                        <div className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-300 rounded">
                                            אין צבעים. לחץ על "הוסף צבע" כדי להוסיף.
                                        </div>
                                    ) : (
                                        <div className="border border-gray-200 rounded-md overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-gray-50">
                                                        <TableHead className="text-sm h-9 text-right">מס' צבע</TableHead>
                                                        <TableHead className="text-sm h-9 text-right">מינון</TableHead>
                                                        <TableHead className="text-sm h-9 text-right">הערות</TableHead>
                                                        <TableHead className="text-sm h-9 w-12"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {hairColoringItems.map((item, index) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="p-2">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={item.color_number || ""}
                                                                    onChange={(e) => handleUpdateColorItem(index, "color_number", parseFloat(e.target.value) || 0)}
                                                                    placeholder="0.00"
                                                                    className="text-sm h-8 text-right"
                                                                    dir="rtl"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="p-2">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={item.dosage || ""}
                                                                    onChange={(e) => handleUpdateColorItem(index, "dosage", parseFloat(e.target.value) || 0)}
                                                                    placeholder="0"
                                                                    className="text-sm h-8 text-right"
                                                                    dir="rtl"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="p-2">
                                                                <Input
                                                                    type="text"
                                                                    value={item.notes || ""}
                                                                    onChange={(e) => handleUpdateColorItem(index, "notes", e.target.value)}
                                                                    placeholder="הערות"
                                                                    className="text-sm h-8 text-right"
                                                                    dir="rtl"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="p-2 w-12">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveColorItem(index)}
                                                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>

                                {/* Summary Fields - Below Table */}
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                                    <div>
                                        <label className="text-sm text-gray-700 mb-1 block">מינון כולל</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={hairColoringSession?.total_dosage || ""}
                                            onChange={(e) => {
                                                const value = e.target.value === "" ? null : parseFloat(e.target.value)
                                                setHairColoringSession({
                                                    id: hairColoringSession?.id || null,
                                                    total_dosage: value,
                                                    oxygen_level: hairColoringSession?.oxygen_level || null,
                                                    notes: hairColoringSession?.notes || null,
                                                })
                                            }}
                                            placeholder="0"
                                            className="text-sm h-9"
                                            dir="rtl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-700 mb-1 block">חמצן</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={hairColoringSession?.oxygen_level || ""}
                                            onChange={(e) => {
                                                const value = e.target.value === "" ? null : parseFloat(e.target.value)
                                                setHairColoringSession({
                                                    id: hairColoringSession?.id || null,
                                                    total_dosage: hairColoringSession?.total_dosage || null,
                                                    oxygen_level: value,
                                                    notes: hairColoringSession?.notes || null,
                                                })
                                            }}
                                            placeholder="0"
                                            className="text-sm h-9"
                                            dir="rtl"
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                    <div>
                                        {hairColoringSession?.id && (
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={handleDeleteSession}
                                                className="h-9"
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                מחק צביעה
                                            </Button>
                                        )}
                                    </div>
                                    <Button
                                        onClick={handleSaveHairColoring}
                                        disabled={isSavingHairColoring || isLoading}
                                        className="h-9"
                                    >
                                        {isSavingHairColoring ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                שומר...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                שמור
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="history" className="mt-4">
                        <ScrollArea className="max-h-[calc(90vh-12rem)] pr-4">
                            {isLoadingHistory ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                </div>
                            ) : hairColoringHistory.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    אין היסטוריית צביעה עבור לקוח זה
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {hairColoringHistory.map((entry) => (
                                        <div key={entry.session.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium text-sm">
                                                        {format(new Date(entry.appointment.start_at), "dd/MM/yyyy HH:mm")}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {entry.appointment.customer_name}
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 text-xs">
                                                    {entry.session.total_dosage !== null && (
                                                        <div>
                                                            <span className="text-gray-500">מינון:</span>{" "}
                                                            <span className="font-medium">{entry.session.total_dosage}</span>
                                                        </div>
                                                    )}
                                                    {entry.session.oxygen_level !== null && (
                                                        <div>
                                                            <span className="text-gray-500">חמצן:</span>{" "}
                                                            <span className="font-medium">{entry.session.oxygen_level}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {entry.items.length > 0 && (
                                                <div className="border-t border-gray-100 pt-3">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-gray-50">
                                                                <TableHead className="text-xs h-8 text-right">מס' צבע</TableHead>
                                                                <TableHead className="text-xs h-8 text-right">מינון</TableHead>
                                                                <TableHead className="text-xs h-8 text-right">הערות</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {entry.items.map((item) => (
                                                                <TableRow key={item.id}>
                                                                    <TableCell className="text-xs text-right">
                                                                        {item.color_number}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-right">
                                                                        {item.dosage}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-right">
                                                                        {item.notes || "-"}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                            {entry.session.notes && (
                                                <div className="text-xs text-gray-600 border-t border-gray-100 pt-2">
                                                    <span className="font-medium">הערות:</span> {entry.session.notes}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}


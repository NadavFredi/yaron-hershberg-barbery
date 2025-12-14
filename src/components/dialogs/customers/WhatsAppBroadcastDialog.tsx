import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { SiWhatsapp } from "react-icons/si"

interface CustomField {
    fieldId: string
    value: string
}

interface WhatsAppBroadcastDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedCustomerIds: string[]
    onSuccess?: () => void
}

export function WhatsAppBroadcastDialog({
    open,
    onOpenChange,
    selectedCustomerIds,
    onSuccess,
}: WhatsAppBroadcastDialogProps) {
    const { toast } = useToast()
    const [flowId, setFlowId] = useState("")
    const [customFields, setCustomFields] = useState<CustomField[]>([{ fieldId: "", value: "" }])
    const [isSending, setIsSending] = useState(false)

    const handleAddField = () => {
        setCustomFields([...customFields, { fieldId: "", value: "" }])
    }

    const handleRemoveField = (index: number) => {
        setCustomFields(customFields.filter((_, i) => i !== index))
    }

    const handleFieldChange = (index: number, field: "fieldId" | "value", value: string) => {
        const updated = [...customFields]
        updated[index] = { ...updated[index], [field]: value }
        setCustomFields(updated)
    }

    const handleSend = async () => {
        if (!flowId.trim()) {
            toast({
                title: "שגיאה",
                description: "יש להזין Flow ID",
                variant: "destructive",
            })
            return
        }

        // Validate custom fields - all should have both fieldId and value if any are filled
        const hasIncompleteFields = customFields.some(
            (field) => (field.fieldId && !field.value) || (!field.fieldId && field.value)
        )
        if (hasIncompleteFields) {
            toast({
                title: "שגיאה",
                description: "יש למלא גם Field ID וגם Value לכל השדות המותאמים",
                variant: "destructive",
            })
            return
        }

        // Filter out empty custom fields
        const validCustomFields = customFields.filter(
            (field) => field.fieldId.trim() && field.value.trim()
        )

        console.log("📱 [WhatsAppBroadcastDialog] Sending WhatsApp broadcast", {
            customerIds: selectedCustomerIds,
            flowId,
            customFields: validCustomFields,
        })

        setIsSending(true)
        try {
            const { data, error } = await supabase.functions.invoke("send-whatsapp-broadcast", {
                body: {
                    customerIds: selectedCustomerIds,
                    flowId: flowId.trim(),
                    customFields: validCustomFields.length > 0 ? validCustomFields : undefined,
                },
            })

            if (error) throw error

            const response = data as { success?: boolean; error?: string; message?: string }
            if (!response?.success) {
                throw new Error(response?.error || "שליחת השידור נכשלה")
            }

            toast({
                title: "הצלחה",
                description: response.message || `השידור נשלח ל-${selectedCustomerIds.length} לקוחות`,
            })

            // Reset form
            setFlowId("")
            setCustomFields([{ fieldId: "", value: "" }])
            onOpenChange(false)
            if (onSuccess) {
                onSuccess()
            }
        } catch (error: any) {
            console.error("❌ [WhatsAppBroadcastDialog] Failed to send broadcast:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לשלוח את השידור",
                variant: "destructive",
            })
        } finally {
            setIsSending(false)
        }
    }

    const handleClose = () => {
        if (!isSending) {
            setFlowId("")
            setCustomFields([{ fieldId: "", value: "" }])
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent dir="rtl" className="max-w-2xl text-right">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right flex items-center gap-2">
                        <SiWhatsapp className="h-5 w-5 text-green-600" />
                        שידור WhatsApp
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        שלח Flow ID ל-{selectedCustomerIds.length} לקוחות שנבחרו
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-right">
                    <div className="space-y-2">
                        <Label htmlFor="flow-id" className="text-right">
                            Flow ID <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="flow-id"
                            placeholder="הזן Flow ID"
                            value={flowId}
                            onChange={(e) => setFlowId(e.target.value)}
                            className="text-right"
                            dir="rtl"
                            disabled={isSending}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-right">שדות מותאמים (אופציונלי)</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddField}
                                disabled={isSending}
                            >
                                <Plus className="h-4 w-4 ml-2" />
                                הוסף שדה
                            </Button>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {customFields.map((field, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <div className="flex-1 space-y-1">
                                        <Input
                                            placeholder="Field ID"
                                            value={field.fieldId}
                                            onChange={(e) => handleFieldChange(index, "fieldId", e.target.value)}
                                            className="text-right"
                                            dir="rtl"
                                            disabled={isSending}
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <Input
                                            placeholder="Value"
                                            value={field.value}
                                            onChange={(e) => handleFieldChange(index, "value", e.target.value)}
                                            className="text-right"
                                            dir="rtl"
                                            disabled={isSending}
                                        />
                                    </div>
                                    {customFields.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveField(index)}
                                            disabled={isSending}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button onClick={handleSend} disabled={isSending || !flowId.trim()}>
                        {isSending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        <SiWhatsapp className="ml-2 h-4 w-4" />
                        שלח שידור
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSending}
                    >
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, X, UserPlus } from "lucide-react"
import { CustomerSearchInput, Customer } from "@/components/CustomerSearchInput"
import { DatePickerInput } from "@/components/DatePickerInput"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface BulkAssignSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscriptionTypeId: string | null
  subscriptionTypeName: string
  onSuccess: () => void
}

export function BulkAssignSubscriptionDialog({
  open,
  onOpenChange,
  subscriptionTypeId,
  subscriptionTypeName,
  onSuccess,
}: BulkAssignSubscriptionDialogProps) {
  const { toast } = useToast()
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([])
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [purchasePrice, setPurchasePrice] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && subscriptionTypeId) {
      setSelectedCustomers([])
      setPurchaseDate(new Date().toISOString().split("T")[0])
      // Fetch ticket type price to set as default
      supabase
        .from("ticket_types")
        .select("price")
        .eq("id", subscriptionTypeId)
        .single()
        .then(({ data }) => {
          if (data?.price) {
            setPurchasePrice(data.price.toString())
          } else {
            setPurchasePrice("0")
          }
        })
        .catch(() => {
          setPurchasePrice("0")
        })
    }
  }, [open, subscriptionTypeId])

  const handleAddCustomer = (customer: Customer) => {
    if (!selectedCustomers.find((c) => c.id === customer.id)) {
      setSelectedCustomers([...selectedCustomers, customer])
    }
  }

  const handleRemoveCustomer = (customerId: string) => {
    setSelectedCustomers(selectedCustomers.filter((c) => c.id !== customerId))
  }

  const handleSubmit = async () => {
    if (!subscriptionTypeId || selectedCustomers.length === 0) {
      return
    }

    try {
      setIsSubmitting(true)
      console.log("📝 [BulkAssignSubscriptionDialog] Assigning subscriptions:", {
        customerIds: selectedCustomers.map((c) => c.id),
        ticketTypeId: subscriptionTypeId,
        purchaseDate,
      })

      // Fetch ticket type to get expiration details
      const { data: ticketType, error: typeError } = await supabase
        .from("ticket_types")
        .select("id, type, total_entries, expiration_days, expiry_calculation_method, price")
        .eq("id", subscriptionTypeId)
        .single()

      if (typeError || !ticketType) {
        throw new Error("סוג המנוי לא נמצא")
      }

      // Parse purchase price (default to 0 if empty or invalid)
      const priceValue = purchasePrice.trim() === "" ? 0 : parseFloat(purchasePrice) || 0

      // Calculate expiry date based on expiry_calculation_method
      const purchaseDateObj = new Date(purchaseDate)
      let expiresOn: string | null = null
      if (ticketType.expiry_calculation_method === "from_purchase_date" && ticketType.expiration_days) {
        const expiryDate = new Date(purchaseDateObj)
        expiryDate.setDate(expiryDate.getDate() + ticketType.expiration_days)
        expiresOn = expiryDate.toISOString().split("T")[0]
      }
      // If expiry_calculation_method is "from_first_usage", expires_on will be set to NULL
      // and calculated when the ticket is first used

      // Prepare tickets to insert (bulk insert)
      const ticketsToInsert = selectedCustomers.map((customer) => ({
        customer_id: customer.id,
        ticket_type_id: subscriptionTypeId,
        total_entries: ticketType.type === "entrances" ? ticketType.total_entries : null,
        expires_on: expiresOn,
        purchase_date: purchaseDateObj.toISOString().split("T")[0],
        purchase_price: priceValue,
      }))

      console.log(`📝 [BulkAssignSubscriptionDialog] Creating ${ticketsToInsert.length} tickets in bulk`)

      const { data: createdTickets, error: insertError } = await supabase
        .from("tickets")
        .insert(ticketsToInsert)
        .select("id")

      if (insertError) {
        console.error("❌ [BulkAssignSubscriptionDialog] Failed to create tickets:", insertError)
        throw new Error(insertError.message || "שגיאה ביצירת מנויים")
      }

      console.log(`✅ [BulkAssignSubscriptionDialog] Successfully created ${createdTickets?.length ?? 0} tickets`)

      toast({
        title: "מנויים הוקצו בהצלחה",
        description: `הוקצו ${selectedCustomers.length} מנויים מסוג "${subscriptionTypeName}" ללקוחות שנבחרו.`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("❌ [BulkAssignSubscriptionDialog] Failed to assign subscriptions:", error)
      toast({
        title: "שגיאה בהקצאת מנויים",
        description: error instanceof Error ? error.message : "לא ניתן להקצות מנויים כעת",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent dir="rtl" className="sm:max-w-lg text-right max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-right">הקצאת מנוי ללקוחות</DialogTitle>
          <DialogDescription className="text-right">
            הקצה מנוי מסוג "{subscriptionTypeName}" ללקוחות מרובים. ניתן לבחור לקוחות מרובים.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 overflow-y-auto flex-1 min-h-0 pr-4" style={{ scrollbarGutter: 'stable', direction: 'ltr' }} dir="ltr">
          <div className="space-y-4" dir="rtl">
            <div className="space-y-2">
              <Label>הוסף לקוחות</Label>
              <CustomerSearchInput
                selectedCustomer={null}
                onCustomerSelect={handleAddCustomer}
                onCustomerClear={() => {}}
                placeholder="חפש לקוח להוספה..."
                label=""
                clearSearchOnSelect
                keepFocusAfterSelect
              />
            </div>

            {selectedCustomers.length > 0 && (
              <div className="space-y-2">
                <Label>לקוחות שנבחרו ({selectedCustomers.length})</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-gray-50 max-h-40 overflow-y-auto">
                  {selectedCustomers.map((customer) => (
                    <Badge key={customer.id} variant="secondary" className="flex items-center gap-1 pr-2">
                      {customer.fullName || "ללא שם"}
                      {customer.phone && <span className="text-xs">({customer.phone})</span>}
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomer(customer.id)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="purchase-date">תאריך רכישה</Label>
              <DatePickerInput
                id="purchase-date"
                value={purchaseDate ? new Date(purchaseDate) : null}
                onChange={(date) => setPurchaseDate(date ? date.toISOString().split("T")[0] : "")}
                className="text-right w-full"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-price">מחיר רכישה (₪)</Label>
              <Input
                id="purchase-price"
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                className="text-right"
                dir="rtl"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">השאר 0 להקצאה חינמית</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedCustomers.length === 0 || !subscriptionTypeId}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                מקצה...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                הקצה מנוי ({selectedCustomers.length})
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            בטל
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

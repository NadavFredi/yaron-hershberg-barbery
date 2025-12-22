import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Loader2, Search, Pencil } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface SubscriptionTypeSummary {
  id: string
  name: string
  price: number | null
}

interface Subscription {
  id: string
  customer_id: string
  customer_name: string
  customer_phone: string | null
  ticket_type_id: string | null
  ticket_type: SubscriptionTypeSummary | null
  expires_on: string | null
  total_entries: number | null
  purchase_date: string
  created_at: string
  remaining_entries?: number
}

export default function SubscriptionsListPage() {
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const subscriptionTypeParam = searchParams.get("type")
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionTypeSummary[]>([])
  const [isLoadingTypes, setIsLoadingTypes] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isEditPurchaseDateOpen, setIsEditPurchaseDateOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [purchaseDateValue, setPurchaseDateValue] = useState("")
  const [isSavingPurchaseDate, setIsSavingPurchaseDate] = useState(false)

  // Filter states
  const [subscriptionTypeFilter, setSubscriptionTypeFilter] = useState<string>(subscriptionTypeParam ?? "all")

  useEffect(() => {
    if (subscriptionTypeParam && subscriptionTypeParam !== subscriptionTypeFilter) {
      setSubscriptionTypeFilter(subscriptionTypeParam)
    }
    if (!subscriptionTypeParam && subscriptionTypeFilter !== "all") {
      setSubscriptionTypeFilter("all")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionTypeParam])

  const handleSubscriptionTypeFilterChange = (value: string) => {
    setSubscriptionTypeFilter(value)
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === "all") {
      params.delete("type")
    } else {
      params.set("type", value)
    }
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    fetchSubscriptions()
    fetchSubscriptionTypes()
  }, [])

  const fetchSubscriptionTypes = async () => {
    try {
      setIsLoadingTypes(true)
      console.log("🔍 [SubscriptionsListPage] Fetching subscription types...")
      const { data, error } = await supabase
        .from("ticket_types")
        .select("id, name, price")
        .order("name", { ascending: true })

      if (error) throw error
      const types = (data || []).map((type) => ({
        id: type.id,
        name: type.name,
        price: type.price,
      })) as SubscriptionTypeSummary[]
      setSubscriptionTypes(types)
      console.log("✅ [SubscriptionsListPage] Loaded subscription types:", types)
    } catch (error) {
      console.error("❌ [SubscriptionsListPage] Failed to load subscription types:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את סוגי המנויים",
        variant: "destructive",
      })
    } finally {
      setIsLoadingTypes(false)
    }
  }

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true)
      console.log("🔍 [SubscriptionsListPage] Fetching subscriptions...")
      
      let query = supabase
        .from("tickets")
        .select(
          `
          id,
          customer_id,
          ticket_type_id,
          expires_on,
          total_entries,
          purchase_date,
          created_at,
          customers:customer_id (
            id,
            full_name,
            phone
          ),
          ticket_types:ticket_type_id (
            id,
            name,
            price
          )
        `
        )
        .order("created_at", { ascending: false })

      const { data, error } = await query

      if (error) throw error

      const transformed = (data || []).map((ticket: any) => {
        const customer = Array.isArray(ticket.customers) ? ticket.customers[0] : ticket.customers
        const ticketType = Array.isArray(ticket.ticket_types) ? ticket.ticket_types[0] : ticket.ticket_types

        // Calculate remaining entries
        let remainingEntries: number | undefined = undefined
        if (ticket.total_entries !== null) {
          // Fetch usages to calculate remaining
          // For now, we'll just show total_entries
          remainingEntries = ticket.total_entries
        }

        return {
          id: ticket.id,
          customer_id: ticket.customer_id,
          customer_name: customer?.full_name || "לא ידוע",
          customer_phone: customer?.phone || null,
          ticket_type_id: ticket.ticket_type_id,
          ticket_type: ticketType
            ? {
                id: ticketType.id,
                name: ticketType.name,
                price: ticketType.price,
              }
            : null,
          expires_on: ticket.expires_on,
          total_entries: ticket.total_entries,
          purchase_date: ticket.purchase_date || ticket.created_at.split("T")[0],
          created_at: ticket.created_at,
          remaining_entries: remainingEntries,
        } as Subscription
      })

      console.log("✅ [SubscriptionsListPage] Loaded subscriptions:", transformed)
      setSubscriptions(transformed)
    } catch (error) {
      console.error("❌ [SubscriptionsListPage] Failed to load subscriptions:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את המנויים",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "ללא תאריך תפוגה"
    const date = new Date(dateString)
    return date.toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" })
  }

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return "—"
    const date = new Date(dateString)
    return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const handleEditPurchaseDate = (subscription: Subscription) => {
    setEditingSubscription(subscription)
    setPurchaseDateValue(subscription.purchase_date)
    setIsEditPurchaseDateOpen(true)
  }

  const handleSavePurchaseDate = async () => {
    if (!editingSubscription || !purchaseDateValue) return

    try {
      setIsSavingPurchaseDate(true)
      console.log("📝 [SubscriptionsListPage] Updating purchase date:", { id: editingSubscription.id, purchase_date: purchaseDateValue })
      const { error } = await supabase
        .from("tickets")
        .update({ purchase_date: purchaseDateValue })
        .eq("id", editingSubscription.id)

      if (error) throw error

      toast({
        title: "תאריך רכישה עודכן",
        description: "תאריך הרכישה עודכן בהצלחה.",
      })

      setIsEditPurchaseDateOpen(false)
      setEditingSubscription(null)
      await fetchSubscriptions()
    } catch (error) {
      console.error("❌ [SubscriptionsListPage] Failed to update purchase date:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את תאריך הרכישה",
        variant: "destructive",
      })
    } finally {
      setIsSavingPurchaseDate(false)
    }
  }

  const filteredSubscriptions = subscriptions.filter((subscription) => {
    const matchesSearch =
      subscription.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscription.customer_phone?.includes(searchTerm) ||
      subscription.ticket_type?.name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = subscriptionTypeFilter === "all" || subscription.ticket_type_id === subscriptionTypeFilter

    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>מנויים</CardTitle>
              <CardDescription>ניהול כל המנויים והכרטיסיות של הלקוחות</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="חפש לפי שם לקוח, טלפון או סוג מנוי..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 text-right"
                    dir="rtl"
                  />
                </div>
              </div>
              <div className="w-[200px]">
                <Select value={subscriptionTypeFilter} onValueChange={handleSubscriptionTypeFilterChange}>
                  <SelectTrigger className="text-right" dir="rtl">
                    <SelectValue placeholder="סוג מנוי" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="all">כל הסוגים</SelectItem>
                    {subscriptionTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin ml-2" />
                טוען מנויים...
              </div>
            ) : filteredSubscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <p className="text-lg font-medium">לא נמצאו מנויים</p>
                <p className="text-sm">
                  {searchTerm || subscriptionTypeFilter !== "all"
                    ? "נסה לשנות את הפילטרים"
                    : "עדיין לא נוספו מנויים למערכת"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 bg-white shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[hsl(228_36%_95%)]">
                      <TableHead className="text-right text-sm font-semibold text-primary">לקוח</TableHead>
                      <TableHead className="text-right text-sm font-semibold text-primary">טלפון</TableHead>
                      <TableHead className="text-right text-sm font-semibold text-primary">סוג מנוי</TableHead>
                      <TableHead className="text-right text-sm font-semibold text-primary">יתרה</TableHead>
                      <TableHead className="text-right text-sm font-semibold text-primary">תאריך רכישה</TableHead>
                      <TableHead className="text-right text-sm font-semibold text-primary">תאריך תפוגה</TableHead>
                      <TableHead className="text-right text-sm font-semibold text-primary">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((subscription) => (
                      <TableRow key={subscription.id} className="hover:bg-gray-50">
                        <TableCell className="text-right font-medium">{subscription.customer_name}</TableCell>
                        <TableCell className="text-right text-gray-600">{subscription.customer_phone || "—"}</TableCell>
                        <TableCell className="text-right">
                          {subscription.ticket_type ? (
                            <Badge variant="outline" className="border-primary/20 text-gray-700">
                              {subscription.ticket_type.name}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">ללא סוג</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {subscription.remaining_entries !== undefined ? (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              {subscription.remaining_entries} / {subscription.total_entries}
                            </Badge>
                          ) : subscription.total_entries === null ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              ללא הגבלה
                            </Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          <div className="flex items-center gap-2 justify-start">
                            {formatDateShort(subscription.purchase_date)}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPurchaseDate(subscription)}
                              className="h-6 w-6 p-0"
                              title="ערוך תאריך רכישה"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-gray-600">{formatDate(subscription.expires_on)}</TableCell>
                        <TableCell className="text-right">—</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Purchase Date Dialog */}
      <Dialog open={isEditPurchaseDateOpen} onOpenChange={(open) => !open && !isSavingPurchaseDate && setIsEditPurchaseDateOpen(false)}>
        <DialogContent dir="rtl" className="sm:max-w-md text-right">
          <DialogHeader>
            <DialogTitle className="text-right">ערוך תאריך רכישה</DialogTitle>
            <DialogDescription className="text-right">
              עדכן את תאריך הרכישה עבור המנוי של {editingSubscription?.customer_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="purchase-date">תאריך רכישה</Label>
              <Input
                id="purchase-date"
                type="date"
                value={purchaseDateValue}
                onChange={(e) => setPurchaseDateValue(e.target.value)}
                className="text-right"
                dir="rtl"
                disabled={isSavingPurchaseDate}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
            <Button onClick={handleSavePurchaseDate} disabled={isSavingPurchaseDate || !purchaseDateValue} className="flex items-center gap-2">
              {isSavingPurchaseDate && <Loader2 className="h-4 w-4 animate-spin" />}
              שמור
            </Button>
            <Button variant="outline" onClick={() => setIsEditPurchaseDateOpen(false)} disabled={isSavingPurchaseDate}>
              בטל
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


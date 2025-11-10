import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { format } from "date-fns"

interface RawCustomer {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  classification: string | null
  created_at: string
}

interface CustomerView {
  id: string
  fullName: string
  phone: string
  email: string
  classification: string
  createdAt: string
}

const translateClassification = (value: string | null | undefined) => {
  if (!value) return "ללא סיווג"
  const normalized = value.toLowerCase()
  switch (normalized) {
    case "vip":
      return "לקוחות VIP"
    case "standard":
      return "לקוחות קבועים"
    case "inactive":
      return "לא פעיל"
    default:
      return "לקוח חדש"
  }
}

const mapCustomers = (rows: RawCustomer[]): CustomerView[] =>
  rows.map((row) => ({
    id: row.id,
    fullName: row.full_name?.trim() || "לקוח ללא שם",
    phone: row.phone?.trim() || "—",
    email: row.email?.trim() || "—",
    classification: translateClassification(row.classification),
    createdAt: format(new Date(row.created_at), "dd.MM.yyyy HH:mm"),
  }))

export default function CustomersListPage() {
  const [customers, setCustomers] = useState<CustomerView[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadCustomers = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, phone, email, classification, created_at")
        .order("created_at", { ascending: false })

      if (error) throw error
      setCustomers(mapCustomers((data ?? []) as RawCustomer[]))
    } catch (error) {
      console.error("Failed to load customers:", error)
      setErrorMessage("לא הצלחנו לטעון את רשימת הלקוחות. נסו לרענן את העמוד או לבדוק את החיבור למסד הנתונים.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCustomers()
  }, [])

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers
    const needle = searchTerm.trim().toLowerCase()
    return customers.filter((customer) =>
      [customer.fullName, customer.phone, customer.email, customer.classification]
        .join("|")
        .toLowerCase()
        .includes(needle),
    )
  }, [customers, searchTerm])

  return (
    <div className="space-y-6" dir="rtl">
      <header className="space-y-2 text-right">
        <h1 className="text-3xl font-bold text-slate-900">לקוחות המספרה</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          סקירה של כל הלקוחות במספרה יוצאת הדופן של ירון הרשברג. ניתן לבצע חיפוש מהיר לפי שם, טלפון או דוא״ל.
        </p>
      </header>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1 text-right">
            <CardTitle className="text-xl font-semibold text-slate-900">רשימת לקוחות</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              הנתונים נטענים ישירות מתוך Supabase ומציגים את פרטי הקשר ואת הסיווג של כל לקוח.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="חיפוש לפי שם / טלפון / דוא״ל / סיווג"
              className="w-full min-w-[220px] text-right"
            />
            <Button
              variant="outline"
              onClick={() => void loadCustomers()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              רענון ידני
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-right text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-right font-semibold text-slate-700">לקוח</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">טלפון</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">דוא״ל</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">סיווג</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">נוצר בתאריך</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        <span>טוען לקוחות...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Sparkles className="h-10 w-10 text-amber-500" />
                        <p className="text-base font-semibold text-slate-700">לא נמצאו לקוחות תואמים</p>
                        <p className="text-sm text-slate-500">נסו לנקות את החיפוש או לרענן את הנתונים.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-slate-50">
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold text-slate-900">{customer.fullName}</span>
                          <span className="text-xs text-slate-500">#{customer.id.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">{customer.phone}</TableCell>
                      <TableCell className="text-right text-sm text-slate-600">{customer.email}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                          {customer.classification}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">{customer.createdAt}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 bg-slate-50/70">
        <CardHeader className="text-right">
          <CardTitle className="text-lg font-semibold text-slate-800">ניהול לקוחות</CardTitle>
          <CardDescription className="text-sm text-slate-600">
            בקרוב נוסיף כלים מתקדמים לשיוך טיפולים, הערות צוות וניהול העדפות. בינתיים אפשר לעבוד עם הרשימה המוצגת כאן.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}


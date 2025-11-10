import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { format } from "date-fns"

interface RawTreatmentRow {
  id: string
  name: string | null
  created_at: string
  client: {
    id: string
    full_name: string | null
    phone: string | null
    email: string | null
  } | null
  treatmentType: {
    id: string
    name: string | null
    default_duration_minutes: number | null
    default_price: number | null
  } | null
}

interface ManagerTreatmentView {
  id: string
  treatmentName: string
  createdAt: string
  clientName: string
  clientPhone: string
  clientEmail: string
  treatmentTypeName: string
  durationLabel: string
  priceLabel: string
}

const formatDuration = (minutes: number | null | undefined) => {
  if (!minutes || minutes <= 0) return "משך מותאם אישית"
  if (minutes < 60) return `${minutes} דקות`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder === 0 ? `${hours} שעות` : `${hours} שעות ו-${remainder} דקות`
}

const formatPrice = (price: number | null | undefined) => {
  if (typeof price !== "number" || Number.isNaN(price)) return "לפי הצעת מחיר"
  return `₪${price.toLocaleString("he-IL")}`
}

const mapTreatments = (rows: RawTreatmentRow[]): ManagerTreatmentView[] =>
  rows.map((row) => ({
    id: row.id,
    treatmentName: row.name?.trim() || "טיפול ללא שם",
    createdAt: format(new Date(row.created_at), "dd.MM.yyyy HH:mm"),
    clientName: row.client?.full_name?.trim() || "לקוח ללא שם",
    clientPhone: row.client?.phone?.trim() || "—",
    clientEmail: row.client?.email?.trim() || "—",
    treatmentTypeName: row.treatmentType?.name?.trim() || "טרם הוגדר טיפול מוביל",
    durationLabel: formatDuration(row.treatmentType?.default_duration_minutes),
    priceLabel: formatPrice(row.treatmentType?.default_price),
  }))

export default function TreatmentsListPage() {
  const [treatments, setTreatments] = useState<ManagerTreatmentView[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadTreatments = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const { data, error } = await supabase
        .from("treatments")
        .select(`
          id,
          name,
          created_at,
          client:customers (
            id,
            full_name,
            phone,
            email
          ),
          treatmentType:treatment_types (
            id,
            name,
            default_duration_minutes,
            default_price
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTreatments(mapTreatments((data ?? []) as RawTreatmentRow[]))
    } catch (error) {
      console.error("Failed to load treatments:", error)
      setErrorMessage("לא הצלחנו לטעון את רשימת הטיפולים. נסו לרענן או בדקו שהמסד זמין.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTreatments()
  }, [])

  const filteredTreatments = useMemo(() => {
    if (!searchTerm.trim()) return treatments
    const needle = searchTerm.trim().toLowerCase()
    return treatments.filter((treatment) =>
      [
        treatment.treatmentName,
        treatment.clientName,
        treatment.clientPhone,
        treatment.clientEmail,
        treatment.treatmentTypeName,
      ]
        .join("|")
        .toLowerCase()
        .includes(needle),
    )
  }, [treatments, searchTerm])

  return (
    <div className="space-y-6" dir="rtl">
      <header className="space-y-2 text-right">
        <h1 className="text-3xl font-bold text-slate-900">טיפולים במספרה</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          רשימת כל טיפולי השיער המיוחדים במספרה יוצאת הדופן של ירון הרשברג. כאן תוכלו לעקוב אחרי הלקוחות והטיפולים
          שבוצעו עבורם.
        </p>
      </header>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1 text-right">
            <CardTitle className="text-xl font-semibold text-slate-900">רשימת טיפולים</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              ניתן לבצע חיפוש מהיר לפי שם טיפול, לקוח או סוג טיפול מוביל.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="חיפוש חופשי (טיפול / לקוח / טיפול מוביל)"
              className="w-full min-w-[220px] text-right"
            />
            <Button
              variant="outline"
              onClick={() => void loadTreatments()}
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
                  <TableHead className="text-right font-semibold text-slate-700">טיפול</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">לקוח</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">פרטי קשר</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">טיפול מיוחד</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">נוצר בתאריך</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        <span>טוען טיפולים...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTreatments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Sparkles className="h-10 w-10 text-amber-500" />
                        <p className="text-base font-semibold text-slate-700">לא נמצאו טיפולים תואמים</p>
                        <p className="text-sm text-slate-500">נסו חיפוש אחר או רענון נתונים.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTreatments.map((treatment) => (
                    <TableRow key={treatment.id} className="hover:bg-slate-50">
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold text-slate-900">{treatment.treatmentName}</span>
                          <span className="text-xs text-slate-500">#{treatment.id.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-medium text-slate-900">{treatment.clientName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">
                        <div className="flex flex-col items-end gap-1">
                          <span>{treatment.clientPhone}</span>
                          <span>{treatment.clientEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                            {treatment.treatmentTypeName}
                          </Badge>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{treatment.durationLabel}</span>
                            <span>•</span>
                            <span>{treatment.priceLabel}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">
                        {treatment.createdAt}
                      </TableCell>
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
          <CardTitle className="text-lg font-semibold text-slate-800">מה הלאה?</CardTitle>
          <CardDescription className="text-sm text-slate-600">
            בקרוב נרחיב את המסך עם פעולות מתקדמות ושיוך מהיר של טיפולים ללקוחות. עד אז אפשר לבצע ניהול בסיסי דרך רשימה זו.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}


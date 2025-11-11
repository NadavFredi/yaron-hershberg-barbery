
import { Fragment, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ChevronDown, Plus } from 'lucide-react'
import { useServicesWithStats, useCreateService } from '@/hooks/useServices'
import { useToast } from '@/hooks/use-toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ServiceEditor from './ServiceEditor'
import { cn } from '@/lib/utils'

interface ServiceLibraryProps {
  defaultExpandedServiceId?: string | null
}

const ServiceLibrary = ({ defaultExpandedServiceId = null }: ServiceLibraryProps) => {
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceBasePrice, setNewServiceBasePrice] = useState<number>(100)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(defaultExpandedServiceId)
  const { toast } = useToast()

  const { data: serviceStats, isLoading, error, refetch } = useServicesWithStats()
  const createServiceMutation = useCreateService()

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value)

  const handleCreateService = async () => {
    if (!newServiceName.trim()) return

    try {
      await createServiceMutation.mutateAsync({
        name: newServiceName.trim(),
        base_price: newServiceBasePrice
      })

      toast({
        title: "שירות נוצר בהצלחה",
        description: `השירות "${newServiceName}" נוסף לספריית השירותים`,
      })

      setNewServiceName('')
      setNewServiceBasePrice(100)
      setIsDialogOpen(false)
      await refetch()
    } catch (error) {
      console.error('Error creating service:', error)
      toast({
        title: "שגיאה ביצירת השירות",
        description: "אנא נסה שוב",
        variant: "destructive",
      })
    }
  }

  const handleToggleService = (serviceId: string) => {
    setExpandedServiceId((current) => current === serviceId ? null : serviceId)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center bg-gray-50" dir="rtl">
        <div className="flex items-center space-x-2 space-x-reverse">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-base text-gray-600">טוען שירותים...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center">
          <p className="mb-4 text-lg text-red-600">שגיאה בטעינת השירותים</p>
          <Button onClick={() => refetch()}>נסה שוב</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">סטודיו השירותים שלנו</h1>
            <p className="text-lg text-gray-600">כאן מנהלים את כל סוגי הטיפולים שהמספרה מציעה</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4" />
                שירות חדש
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right">שירות חדש</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="serviceName" className="mb-2 block text-right">
                    איך נקרא לשירות החדש?
                  </Label>
                  <Input
                    id="serviceName"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="למשל: תספורת מלאה"
                    className="text-right"
                  />
                </div>
                <div>
                  <Label htmlFor="serviceBasePrice" className="mb-2 block text-right">
                    מחיר בסיס (₪)
                  </Label>
                  <Input
                    id="serviceBasePrice"
                    type="number"
                    value={newServiceBasePrice}
                    onChange={(e) => setNewServiceBasePrice(parseInt(e.target.value) || 0)}
                    placeholder="100"
                    className="text-right"
                    min="0"
                    step="5"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    ביטול
                  </Button>
                  <Button
                    onClick={handleCreateService}
                    disabled={!newServiceName.trim() || createServiceMutation.isPending}
                  >
                    {createServiceMutation.isPending ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        יוצר...
                      </>
                    ) : (
                      'צור שירות'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Table containerClassName="overflow-x-auto">
            <TableHeader className="bg-[hsl(228_36%_95%)]">
              <TableRow className="bg-transparent [&>th]:text-right">
                <TableHead className="w-12 text-center text-sm font-semibold text-primary"></TableHead>
                <TableHead className="text-right text-sm font-semibold text-primary">שם השירות</TableHead>
                <TableHead className="text-right text-sm font-semibold text-primary w-32">מחיר בסיס</TableHead>
                <TableHead className="text-right text-sm font-semibold text-primary w-32">זמן ממוצע</TableHead>
                <TableHead className="text-right text-sm font-semibold text-primary w-40">כיסוי עמדות</TableHead>
                <TableHead className="text-right text-sm font-semibold text-primary w-40">טווח מחירים</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!serviceStats || serviceStats.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                    אין עדיין שירותים במערכת. צרו שירות חדש כדי להתחיל.
                  </TableCell>
                </TableRow>
              )}

              {serviceStats?.map((service) => {
                const isExpanded = expandedServiceId === service.id
                return (
                  <Fragment key={service.id}>
                    <TableRow
                      className="cursor-pointer bg-white transition-colors hover:bg-blue-50/40"
                      onClick={() => handleToggleService(service.id)}
                    >
                      <TableCell className="w-12 align-middle text-center">
                        <ChevronDown
                          className={cn(
                            "mx-auto h-5 w-5 text-blue-600 transition-transform duration-200",
                            isExpanded ? "rotate-180" : ""
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col">
                          <span className="text-base font-semibold text-gray-900">{service.name}</span>
                          {service.description && (
                            <span className="mt-1 text-xs text-gray-500">{service.description}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-gray-700">{formatCurrency(service.base_price)}</TableCell>
                      <TableCell className="text-right text-gray-700">
                        {service.averageTime > 0 ? `${service.averageTime} דקות` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-gray-700">
                        {service.configuredStationsCount} מתוך {service.totalStationsCount}
                      </TableCell>
                      <TableCell className="text-right text-gray-700">
                        {formatCurrency(service.priceRange.min)} – {formatCurrency(service.priceRange.max)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-white">
                        <TableCell colSpan={6} className="bg-indigo-50/40 px-6 pb-6 pt-8">
                          <ServiceEditor serviceId={service.id} variant="embedded" />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default ServiceLibrary;

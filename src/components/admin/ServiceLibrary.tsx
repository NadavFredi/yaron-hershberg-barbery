
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ChevronDown, Plus } from 'lucide-react'
import { useServicesWithStats, useCreateService } from '@/hooks/useServices'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import type { CheckedState } from '@radix-ui/react-checkbox'
import { useServiceConfiguration } from '@/hooks/useServiceConfiguration'
import type { StationWithConfig } from '@/hooks/useServiceConfiguration'

interface ServiceLibraryProps {
  defaultExpandedServiceId?: string | null
}

type ParentField = 'is_active' | 'remote_booking_allowed' | 'requires_staff_approval'

const parentFieldLabels: Record<ParentField, string> = {
  is_active: 'פעיל',
  remote_booking_allowed: 'תור מרחוק',
  requires_staff_approval: 'אישור צוות',
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value)

const clampMinutes = (value: string, fallback: number) => {
  const numeric = Number.parseInt(value, 10)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(5, numeric)
}

const parsePriceAdjustment = (value: string, fallback: number) => {
  const numeric = Number.parseInt(value, 10)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return numeric
}

const ServiceLibrary = ({ defaultExpandedServiceId = null }: ServiceLibraryProps) => {
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceBasePrice, setNewServiceBasePrice] = useState<number>(100)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(defaultExpandedServiceId)
  const [pendingParentToggle, setPendingParentToggle] = useState<string | null>(null)
  const { toast } = useToast()

  const { data: serviceStats, isLoading, error, refetch } = useServicesWithStats()
  const createServiceMutation = useCreateService()

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

  const getTriStateForField = useCallback((serviceId: string, field: ParentField) => {
    const service = serviceStats?.find((item) => item.id === serviceId)
    if (!service) {
      return { checked: false, indeterminate: false }
    }

    const relevantConfigs = service.stationConfigs.filter((config) => config.station_is_active)
    if (relevantConfigs.length === 0) {
      return { checked: false, indeterminate: false }
    }

    const enabledCount = relevantConfigs.filter((config) => config[field]).length
    if (enabledCount === 0) {
      return { checked: false, indeterminate: false }
    }
    if (enabledCount === relevantConfigs.length) {
      return { checked: true, indeterminate: false }
    }
    return { checked: false, indeterminate: true }
  }, [serviceStats])

  const handleParentCheckboxChange = async (
    serviceId: string,
    field: ParentField,
    currentState: { checked: boolean; indeterminate: boolean }
  ) => {
    const service = serviceStats?.find((item) => item.id === serviceId)
    if (!service || service.stationConfigs.length === 0) {
      toast({
        title: 'אין עמדות לעדכן',
        description: 'לשירות זה אין עמדות מוגדרות כרגע.',
        variant: 'destructive',
      })
      return
    }

    const nextValue = currentState.checked && !currentState.indeterminate ? false : true
    const mutationKey = `${serviceId}:${field}`
    setPendingParentToggle(mutationKey)

    try {
      const { error: updateError } = await supabase
        .from('service_station_matrix')
        .update({ [field]: nextValue })
        .eq('service_id', serviceId)

      if (updateError) {
        throw updateError
      }

      toast({
        title: 'השינוי נשמר',
        description: `עודכן ערך "${parentFieldLabels[field]}" עבור כל העמדות`,
      })

      await refetch()
    } catch (updateError) {
      console.error('Error updating parent checkbox:', updateError)
      toast({
        title: 'שגיאה בעדכון',
        description: 'לא הצלחנו לעדכן את ההגדרה עבור כל העמדות. נסו שוב.',
        variant: 'destructive',
      })
    } finally {
      setPendingParentToggle(null)
    }
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
          <div className="divide-y divide-slate-100">
            {(!serviceStats || serviceStats.length === 0) && (
              <div className="py-10 text-center text-gray-500">אין עדיין שירותים במערכת. צרו שירות חדש כדי להתחיל.</div>
            )}

            {serviceStats?.map((service) => {
              const isExpanded = expandedServiceId === service.id
              const activeTriState = getTriStateForField(service.id, 'is_active')
              const remoteTriState = getTriStateForField(service.id, 'remote_booking_allowed')
              const approvalTriState = getTriStateForField(service.id, 'requires_staff_approval')
              const hasConfigurations = service.stationConfigs.length > 0

              const activeStationCount = service.stationConfigs.filter((config) => config.is_active && config.station_is_active).length

              return (
                <div
                  key={service.id}
                  className={cn(
                    'transition-colors',
                    isExpanded ? 'bg-indigo-50/50' : 'bg-white'
                  )}
                >
                  <div
                    className="flex cursor-pointer flex-col gap-6 px-6 py-6 transition-colors hover:bg-indigo-50/70 md:flex-row md:items-start md:justify-between"
                    onClick={() => handleToggleService(service.id)}
                  >
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-semibold text-gray-900">{service.name}</span>
                            {service.description ? (
                              <Badge variant="outline" className="text-xs font-normal text-gray-600">
                                {service.description}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                            <SummaryStat label="מחיר בסיס" value={formatCurrency(service.base_price)} />
                            <SummaryStat
                              label="זמן ממוצע"
                              value={service.averageTime > 0 ? `${service.averageTime} דקות` : 'לא הוגדר'}
                            />
                            <SummaryStat
                              label="כיסוי עמדות"
                              value={`${activeStationCount} מתוך ${service.totalStationsCount}`}
                            />
                            <SummaryStat
                              label="טווח מחירים"
                              value={`${formatCurrency(service.priceRange.min)} – ${formatCurrency(service.priceRange.max)}`}
                            />
                          </div>
                        </div>
                        <ChevronDown
                          className={cn(
                            "ml-2 h-6 w-6 text-blue-600 transition-transform duration-200",
                            isExpanded ? "rotate-180" : ""
                          )}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        {(Object.keys(parentFieldLabels) as ParentField[]).map((field) => {
                          const triState =
                            field === 'is_active'
                              ? activeTriState
                              : field === 'remote_booking_allowed'
                                ? remoteTriState
                                : approvalTriState
                          const mutationKey = `${service.id}:${field}`
                          const isPending = pendingParentToggle === mutationKey

                          return (
                            <ParentControl
                              key={field}
                              label={parentFieldLabels[field]}
                              triState={triState}
                              disabled={isPending || !hasConfigurations}
                              onToggle={() => handleParentCheckboxChange(service.id, field, triState)}
                              onClick={(event) => event.stopPropagation()}
                              isPending={isPending}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-indigo-100/70 bg-indigo-50/60 px-6 pb-8 pt-6">
                      <ServiceStationsPanel serviceId={service.id} basePrice={service.base_price} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceLibrary;

interface ParentControlProps {
  label: string;
  triState: { checked: boolean; indeterminate: boolean };
  disabled?: boolean;
  onToggle: () => void;
  onClick: (event: MouseEvent) => void;
  isPending: boolean;
}

const ParentControl = ({ label, triState, disabled, onToggle, onClick, isPending }: ParentControlProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50",
        disabled && "cursor-not-allowed opacity-70"
      )}
      onClick={onClick}
    >
      <Checkbox
        checked={triState.checked}
        indeterminate={triState.indeterminate}
        onCheckedChange={() => onToggle()}
        disabled={disabled}
      />
      <span>{label}</span>
      {isPending ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> : null}
    </div>
  )
}

interface SummaryStatProps {
  label: string;
  value: string;
}

const SummaryStat = ({ label, value }: SummaryStatProps) => (
  <div className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900">{value}</span>
  </div>
)

interface ServiceStationsPanelProps {
  serviceId: string;
  basePrice: number;
}

const ServiceStationsPanel = ({ serviceId, basePrice }: ServiceStationsPanelProps) => {
  const { stations, isLoading, updateStationConfig } = useServiceConfiguration(serviceId)
  const { toast } = useToast()

  const activeStations = useMemo(
    () => stations.filter((station) => station.station_is_active),
    [stations]
  )

  const handleSave = async (stationId: string, baseTimeMinutes: number, priceAdjustment: number) => {
    try {
      await updateStationConfig({
        serviceId,
        stationId,
        baseTimeMinutes,
        priceAdjustment,
      })
      toast({
        title: 'העמדה עודכנה',
        description: 'ההגדרות נשמרו בהצלחה.',
      })
    } catch (saveError) {
      console.error('Error saving station configuration:', saveError)
      toast({
        title: 'שגיאה בשמירת העמדה',
        description: 'לא הצלחנו לעדכן את ההגדרות. נסו שוב.',
        variant: 'destructive',
      })
    }
  }

  const handleToggle = async (stationId: string, field: ParentField, value: boolean) => {
    try {
      await updateStationConfig({
        serviceId,
        stationId,
        ...(field === 'is_active' ? { isActive: value } : {}),
        ...(field === 'remote_booking_allowed' ? { remoteBookingAllowed: value } : {}),
        ...(field === 'requires_staff_approval' ? { requiresStaffApproval: value } : {}),
      })
      toast({
        title: 'עודכן בהצלחה',
        description: `עודכן ערך "${parentFieldLabels[field]}" לעמדה`,
      })
    } catch (toggleError) {
      console.error('Error toggling station field:', toggleError)
      toast({
        title: 'שגיאה בעדכון',
        description: 'לא הצלחנו לשנות את ההגדרה לעמדה הזו. נסו שוב.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!stations.length) {
    return <div className="text-center text-gray-500">אין עדיין עמדות זמינות למספרה.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">ניהול עמדות עבור השירות</h3>
        <span className="text-sm text-gray-500">
          {activeStations.length} עמדות פעילות מתוך {stations.length} עמדות כוללות
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((station) => (
          <StationCard
            key={station.id}
            station={station}
            basePrice={basePrice}
            onSave={handleSave}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  )
}

interface StationCardProps {
  station: StationWithConfig;
  basePrice: number;
  onSave: (stationId: string, baseTimeMinutes: number, priceAdjustment: number) => Promise<void>;
  onToggle: (stationId: string, field: ParentField, value: boolean) => Promise<void>;
}

const StationCard = ({ station, basePrice, onSave, onToggle }: StationCardProps) => {
  const [time, setTime] = useState(station.base_time_minutes.toString())
  const [price, setPrice] = useState(station.price_adjustment.toString())
  const [isSaving, setIsSaving] = useState(false)
  const [toggleLoading, setToggleLoading] = useState<Record<ParentField, boolean>>({
    is_active: false,
    remote_booking_allowed: false,
    requires_staff_approval: false,
  })

  const finalPrice = basePrice + parsePriceAdjustment(price, station.price_adjustment)
  const localIsDisabled = !station.station_is_active

  useEffect(() => {
    setTime(station.base_time_minutes.toString())
  }, [station.base_time_minutes])

  useEffect(() => {
    setPrice(station.price_adjustment.toString())
  }, [station.price_adjustment])

  const handleSaveClick = async () => {
    const minutes = clampMinutes(time, station.base_time_minutes)
    const priceAdjustment = parsePriceAdjustment(price, station.price_adjustment)

    setIsSaving(true)
    try {
      await onSave(station.id, minutes, priceAdjustment)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleChange = async (field: ParentField, checked: CheckedState) => {
    const value = checked === true
    setToggleLoading((prev) => ({ ...prev, [field]: true }))
    try {
      await onToggle(station.id, field, value)
    } finally {
      setToggleLoading((prev) => ({ ...prev, [field]: false }))
    }
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md",
        !station.is_active && "border-dashed border-amber-300 bg-amber-50/60",
        localIsDisabled && "opacity-70"
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-gray-900">{station.name}</h4>
            <p className="mt-1 text-xs text-gray-500">
              {station.station_is_active ? 'עמדה פעילה' : 'עמדה מושבתת בלוח הזמנים'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!station.is_active && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                לא פעיל בשירות זה
              </Badge>
            )}
            {!station.station_is_active && (
              <Badge variant="outline" className="border-amber-200 text-amber-600">
                עמדה מושבתת
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-gray-500">זמן (דקות)</Label>
            <Input
              value={time}
              onChange={(event) => setTime(event.target.value)}
              type="number"
              min={0}
              className="h-10 text-center"
              disabled={isSaving}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-gray-500">תוספת מחיר (₪)</Label>
            <Input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              type="number"
              className="h-10 text-center"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>מחיר סופי</span>
          <span className="font-semibold text-gray-900">{formatCurrency(finalPrice)}</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <StationToggle
            label="פעיל"
            checked={station.is_active}
            field="is_active"
            onCheckedChange={handleToggleChange}
            isLoading={toggleLoading.is_active}
            disabled={localIsDisabled}
          />
          <StationToggle
            label="תור מרחוק"
            checked={station.remote_booking_allowed}
            field="remote_booking_allowed"
            onCheckedChange={handleToggleChange}
            isLoading={toggleLoading.remote_booking_allowed}
            disabled={!station.is_active || localIsDisabled}
          />
          <StationToggle
            label="אישור צוות"
            checked={station.requires_staff_approval}
            field="requires_staff_approval"
            onCheckedChange={handleToggleChange}
            isLoading={toggleLoading.requires_staff_approval}
            disabled={!station.is_active || localIsDisabled}
          />
        </div>
      </div>

      <Button
        className="mt-5 w-full"
        onClick={handleSaveClick}
        disabled={isSaving || localIsDisabled}
      >
        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
        {isSaving ? 'שומר...' : 'שמור'}
      </Button>
    </div>
  )
}

interface StationToggleProps {
  label: string;
  checked: boolean;
  field: ParentField;
  isLoading: boolean;
  disabled?: boolean;
  onCheckedChange: (field: ParentField, checked: CheckedState) => void;
}

const StationToggle = ({ label, checked, disabled, field, isLoading, onCheckedChange }: StationToggleProps) => (
  <label
    className={cn(
      "flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-gray-600",
      disabled && "cursor-not-allowed opacity-60"
    )}
  >
    <Checkbox
      checked={checked}
      onCheckedChange={(state) => onCheckedChange(field, state)}
      disabled={disabled}
    />
    <span>{label}</span>
    {isLoading ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> : null}
  </label>
)

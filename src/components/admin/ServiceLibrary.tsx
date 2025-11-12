
import React, { Fragment, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ChevronDown, Plus, MoreHorizontal, Save } from 'lucide-react'
import { useServicesWithStats, useCreateService } from '@/hooks/useServices'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import type { CheckedState } from '@radix-ui/react-checkbox'
import { useServiceConfiguration } from '@/hooks/useServiceConfiguration'
import type { StationWithConfig } from '@/hooks/useServiceConfiguration'
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateService } from '@/hooks/useServices'
import { useStations } from '@/hooks/useStations'

interface ServiceLibraryProps {
  defaultExpandedServiceId?: string | null
}

type ParentField = 'is_active' | 'remote_booking_allowed' | 'requires_staff_approval'
type InlineField = 'basePrice' | 'baseTime' | 'minPrice' | 'maxPrice'

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
  const [inlineEdit, setInlineEdit] = useState<{ serviceId: string; field: InlineField } | null>(null)
  const [inlineValue, setInlineValue] = useState('')
  const [inlineLoadingKey, setInlineLoadingKey] = useState<string | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const updateServiceMutation = useUpdateService()

  const { data: serviceStats, isLoading, error, refetch } = useServicesWithStats()
  const createServiceMutation = useCreateService()
  const { data: allStations } = useStations()

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

    // Check ALL station configs, not just active stations
    const relevantConfigs = service.stationConfigs
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
    if (!allStations || allStations.length === 0) {
      toast({
        title: 'אין עמדות זמינות',
        description: 'אין עמדות במערכת לעדכן.',
        variant: 'destructive',
      })
      return
    }

    const nextValue = currentState.checked && !currentState.indeterminate ? false : true
    const mutationKey = `${serviceId}:${field}`
    setPendingParentToggle(mutationKey)

    try {
      // First, ensure all stations have configs for this service
      const service = serviceStats?.find((item) => item.id === serviceId)
      const existingStationIds = new Set(service?.stationConfigs.map(c => c.station_id) || [])

      // Create missing configs
      const missingStations = allStations.filter(s => !existingStationIds.has(s.id))
      if (missingStations.length > 0) {
        const inserts = missingStations.map(station => ({
          service_id: serviceId,
          station_id: station.id,
          base_time_minutes: 60,
          price_adjustment: 0,
          is_active: field === 'is_active' ? nextValue : true,
          remote_booking_allowed: field === 'remote_booking_allowed' ? nextValue : false,
          requires_staff_approval: field === 'requires_staff_approval' ? nextValue : false,
        }))

        const { error: insertError } = await supabase
          .from('service_station_matrix')
          .insert(inserts)

        if (insertError) {
          throw insertError
        }
      }

      // Update all configs for this service
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
      await queryClient.invalidateQueries({ queryKey: ['service-station-configs', serviceId] })
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

  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    const confirmDelete =
      typeof globalThis !== 'undefined' && typeof globalThis.confirm === 'function'
        ? globalThis.confirm(`האם למחוק את השירות "${serviceName}"? הפעולה אינה הפיכה.`)
        : true
    if (!confirmDelete) return

    try {
      const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId)

      if (deleteError) {
        throw deleteError
      }

      toast({
        title: 'השירות נמחק',
        description: `השירות "${serviceName}" הוסר מהמערכת.`,
      })

      if (expandedServiceId === serviceId) {
        setExpandedServiceId(null)
      }

      await refetch()
    } catch (error) {
      console.error('Error deleting service:', error)
      toast({
        title: 'שגיאה במחיקת השירות',
        description: 'לא הצלחנו למחוק את השירות. נסו שוב.',
        variant: 'destructive',
      })
    }
  }

  const startInlineEdit = (serviceId: string, field: InlineField, value: number) => {
    setInlineEdit({ serviceId, field })
    setInlineValue(Number.isFinite(value) ? value.toString() : '0')
  }

  const cancelInlineEdit = () => {
    setInlineEdit(null)
    setInlineValue('')
  }

  const handleInlineSubmit = async (service: (typeof serviceStats)[number]) => {
    if (!inlineEdit || inlineEdit.serviceId !== service.id || inlineLoadingKey) return

    const parsed = Number(inlineValue)
    if (!Number.isFinite(parsed)) {
      cancelInlineEdit()
      return
    }

    const numericValue = Math.max(0, Math.round(parsed))
    const key = `${service.id}-${inlineEdit.field}`
    setInlineLoadingKey(key)

    try {
      switch (inlineEdit.field) {
        case 'basePrice': {
          await updateServiceMutation.mutateAsync({
            serviceId: service.id,
            base_price: numericValue,
          })
          break
        }
        case 'baseTime': {
          const minutes = Math.max(5, numericValue)
          const { error } = await supabase
            .from('service_station_matrix')
            .update({ base_time_minutes: minutes })
            .eq('service_id', service.id)

          if (error) {
            throw error
          }
          break
        }
        case 'minPrice': {
          const delta = numericValue - service.priceRange.min
          if (delta !== 0) {
            await updateServiceMutation.mutateAsync({
              serviceId: service.id,
              base_price: service.base_price + delta,
            })
          }
          break
        }
        case 'maxPrice': {
          const currentMax = service.priceRange.max
          const delta = numericValue - currentMax
          if (delta !== 0) {
            const maxConfigs = service.stationConfigs.filter(
              (config) => service.base_price + (config.price_adjustment || 0) === currentMax
            )
            const updates = maxConfigs.map((config) =>
              supabase
                .from('service_station_matrix')
                .update({ price_adjustment: (config.price_adjustment || 0) + delta })
                .eq('service_id', service.id)
                .eq('station_id', config.station_id)
            )
            const results = await Promise.all(updates)
            const failed = results.find((res) => res.error)
            if (failed?.error) {
              throw failed.error
            }
          }
          break
        }
        default:
          break
      }

      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['service-station-configs', service.id] })
      cancelInlineEdit()
    } catch (error) {
      console.error('Error updating inline value:', error)
      toast({
        title: 'שגיאה בעדכון',
        description: 'לא הצלחנו לשמור את הערך החדש. נסו שוב.',
        variant: 'destructive',
      })
    } finally {
      setInlineLoadingKey(null)
    }
  }

  const renderEditableValue = (
    service: (typeof serviceStats)[number],
    field: InlineField,
    displayValue: string,
    numericValue: number,
    placeholder?: string,
    widthClass = 'min-w-[80px]'
  ) => {
    const key = `${service.id}-${field}`
    const isEditing = inlineEdit?.serviceId === service.id && inlineEdit.field === field
    const isLoading = inlineLoadingKey === key

    return (
      <div
        className={cn('flex justify-end', widthClass)}
        onClick={(event) => event.stopPropagation()}
      >
        {isEditing ? (
          <Input
            autoFocus
            type="number"
            value={inlineValue}
            placeholder={placeholder}
            onChange={(event) => setInlineValue(event.target.value)}
            onBlur={() => handleInlineSubmit(service)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleInlineSubmit(service)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancelInlineEdit()
              }
            }}
            className="h-8 w-full text-center"
          />
        ) : (
          <button
            type="button"
            className="flex w-full items-center justify-center rounded border border-transparent px-2 py-1 text-sm font-medium text-gray-700 transition hover:border-indigo-200 hover:bg-indigo-50"
            onClick={() => startInlineEdit(service.id, field, numericValue)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : displayValue}
          </button>
        )}
      </div>
    )
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
            <TableHeader className="bg-slate-50">
              <TableRow className="text-xs text-gray-600">
                <TableHead className="w-12 text-center"></TableHead>
                <TableHead className="text-right font-semibold">שם השירות</TableHead>
                <TableHead className="w-28 text-right font-semibold">מחיר בסיס</TableHead>
                <TableHead className="w-28 text-right font-semibold">זמן בסיס</TableHead>
                <TableHead className="w-32 text-right font-semibold">כיסוי עמדות</TableHead>
                <TableHead className="w-40 text-right font-semibold">טווח מחירים</TableHead>
                <TableHead className="w-28 text-center font-semibold">פעיל</TableHead>
                <TableHead className="w-32 text-center font-semibold">תור מרחוק</TableHead>
                <TableHead className="w-32 text-center font-semibold">אישור צוות</TableHead>
                <TableHead className="w-12 text-center font-semibold"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!serviceStats || serviceStats.length === 0) && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-gray-500">
                    אין עדיין שירותים במערכת. צרו שירות חדש כדי להתחיל.
                  </TableCell>
                </TableRow>
              )}

              {serviceStats?.map((service) => {
                const isExpanded = expandedServiceId === service.id
                const activeTriState = getTriStateForField(service.id, 'is_active')
                const remoteTriState = getTriStateForField(service.id, 'remote_booking_allowed')
                const approvalTriState = getTriStateForField(service.id, 'requires_staff_approval')
                const activeStationCount = service.stationConfigs.filter((config) => config.is_active && config.station_is_active).length

                return (
                  <Fragment key={service.id}>
                    <TableRow
                      className={cn(
                        'cursor-pointer text-sm transition-colors',
                        isExpanded ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                      )}
                      onClick={() => handleToggleService(service.id)}
                    >
                      <TableCell className="text-center align-middle">
                        <ChevronDown
                          className={cn(
                            "mx-auto h-5 w-5 text-blue-600 transition-transform duration-200",
                            isExpanded ? "rotate-180" : ""
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <span className="text-sm font-semibold text-gray-900">{service.name}</span>
                      </TableCell>
                      <TableCell className="text-right align-middle text-gray-700">
                        {renderEditableValue(
                          service,
                          'basePrice',
                          formatCurrency(service.base_price),
                          service.base_price
                        )}
                      </TableCell>
                      <TableCell className="text-right align-middle text-gray-700">
                        {renderEditableValue(
                          service,
                          'baseTime',
                          service.baseTime > 0 ? `${service.baseTime} דקות` : 'קבע זמן',
                          service.baseTime > 0 ? service.baseTime : 60,
                          undefined,
                          'min-w-[90px]'
                        )}
                      </TableCell>
                      <TableCell className="text-right align-middle text-gray-700">
                        {activeStationCount} מתוך {service.totalStationsCount}
                      </TableCell>
                      <TableCell className="text-right align-middle text-gray-700">
                        <div className="flex items-center justify-end gap-2">
                          {renderEditableValue(
                            service,
                            'minPrice',
                            formatCurrency(service.priceRange.min),
                            service.priceRange.min,
                            undefined,
                            'min-w-[70px]'
                          )}
                          <span className="text-xs text-gray-400">–</span>
                          {renderEditableValue(
                            service,
                            'maxPrice',
                            formatCurrency(service.priceRange.max),
                            service.priceRange.max,
                            undefined,
                            'min-w-[70px]'
                          )}
                        </div>
                      </TableCell>
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
                          <TableCell
                            key={`${service.id}-${field}`}
                            className="text-center align-middle"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ParentControl
                              triState={triState}
                              disabled={isPending}
                              onToggle={() => handleParentCheckboxChange(service.id, field, triState)}
                              isPending={isPending}
                            />
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-center align-middle" onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-right" dir="rtl">
                            <DropdownMenuItem onClick={() => setExpandedServiceId(service.id)}>
                              עריכה
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setExpandedServiceId(service.id)}>
                              צפייה
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleDeleteService(service.id, service.name)}
                            >
                              מחיקה
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-indigo-50/40">
                        <TableCell colSpan={10} className="border-t border-indigo-100/70 px-6 pb-6 pt-6 align-top">
                          <ServiceStationsPanel
                            serviceId={service.id}
                            basePrice={service.base_price}
                            description={service.description}
                          />
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

interface ParentControlProps {
  triState: { checked: boolean; indeterminate: boolean };
  disabled?: boolean;
  onToggle: () => void;
  isPending: boolean;
}

const ParentControl = ({ triState, disabled, onToggle, isPending }: ParentControlProps) => {
  return (
    <div
      className={cn(
        "mx-auto flex w-fit items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-gray-600 transition hover:border-blue-200 hover:bg-blue-50",
        disabled && "cursor-not-allowed opacity-70"
      )}
    >
      <Checkbox
        checked={triState.checked}
        indeterminate={triState.indeterminate}
        onCheckedChange={() => onToggle()}
        disabled={disabled}
      />
      {isPending ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> : null}
    </div>
  )
}

interface ServiceStationsPanelProps {
  serviceId: string;
  basePrice: number;
  description?: string | null;
}

const ServiceStationsPanel = ({ serviceId, basePrice, description }: ServiceStationsPanelProps) => {
  const { stations, isLoading, updateStationConfig } = useServiceConfiguration(serviceId)
  const { toast } = useToast()
  const stationRefs = useRef<Map<string, StationCardRef>>(new Map())
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [dirtyStationIds, setDirtyStationIds] = useState<Set<string>>(new Set())

  const handleSave = async (params: {
    stationId: string;
    baseTimeMinutes: number;
    priceAdjustment: number;
    isActive: boolean;
    remoteBookingAllowed: boolean;
    requiresStaffApproval: boolean;
  }) => {
    try {
      await updateStationConfig({
        serviceId,
        stationId: params.stationId,
        baseTimeMinutes: params.baseTimeMinutes,
        priceAdjustment: params.priceAdjustment,
        isActive: params.isActive,
        remoteBookingAllowed: params.remoteBookingAllowed,
        requiresStaffApproval: params.requiresStaffApproval,
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

  const handleDirtyChange = useCallback((stationId: string, isDirty: boolean) => {
    setDirtyStationIds(prev => {
      const next = new Set(prev)
      if (isDirty) {
        next.add(stationId)
      } else {
        next.delete(stationId)
      }
      return next
    })
  }, [])

  const handleSaveAll = async () => {
    const dirtyStations = Array.from(stationRefs.current.values()).filter(ref => ref.isDirty())
    if (dirtyStations.length === 0) {
      toast({
        title: 'אין שינויים לשמירה',
        description: 'כל העמדות כבר נשמרו.',
      })
      return
    }

    setIsSavingAll(true)
    try {
      await Promise.all(dirtyStations.map(ref => ref.save()))
      // Clear dirty state after successful save
      setDirtyStationIds(new Set())
      toast({
        title: 'כל השינויים נשמרו',
        description: `נשמרו ${dirtyStations.length} עמדות בהצלחה.`,
      })
    } catch (error) {
      console.error('Error saving all stations:', error)
      toast({
        title: 'שגיאה בשמירה',
        description: 'חלק מהעמדות לא נשמרו. נסו שוב.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingAll(false)
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {description ? (
          <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        ) : <div />}
        {dirtyStationIds.size > 0 && (
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={isSavingAll}
            className="flex items-center gap-2 justify-end"
          >
            {isSavingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            שמור הכל
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((station) => (
          <StationCard
            key={station.id}
            ref={(ref) => {
              if (ref) {
                stationRefs.current.set(station.id, ref)
              } else {
                stationRefs.current.delete(station.id)
              }
            }}
            station={station}
            basePrice={basePrice}
            onSave={handleSave}
            onDirtyChange={handleDirtyChange}
          />
        ))}
      </div>
    </div>
  )
}

interface StationCardRef {
  save: () => Promise<void>;
  isDirty: () => boolean;
}

interface StationCardProps {
  station: StationWithConfig;
  basePrice: number;
  onSave: (params: {
    stationId: string;
    baseTimeMinutes: number;
    priceAdjustment: number;
    isActive: boolean;
    remoteBookingAllowed: boolean;
    requiresStaffApproval: boolean;
  }) => Promise<void>;
  onDirtyChange?: (stationId: string, isDirty: boolean) => void;
}

const StationCard = React.forwardRef<StationCardRef, StationCardProps>(({ station, basePrice, onSave, onDirtyChange }, ref) => {
  const [time, setTime] = useState(station.base_time_minutes.toString())
  const [price, setPrice] = useState(station.price_adjustment.toString())
  const [isSaving, setIsSaving] = useState(false)
  const [isActiveDraft, setIsActiveDraft] = useState<boolean>(station.is_active)
  const [remoteDraft, setRemoteDraft] = useState<boolean>(station.remote_booking_allowed)
  const [approvalDraft, setApprovalDraft] = useState<boolean>(station.requires_staff_approval)
  const [original, setOriginal] = useState({
    baseTime: station.base_time_minutes,
    price: station.price_adjustment,
    isActive: station.is_active,
    remote: station.remote_booking_allowed,
    approval: station.requires_staff_approval,
  })

  const priceNumber = parsePriceAdjustment(price, station.price_adjustment)
  const finalPrice = basePrice + priceNumber
  const localIsDisabled = !station.station_is_active

  useEffect(() => {
    setTime(station.base_time_minutes.toString())
    setPrice(station.price_adjustment.toString())
    setIsActiveDraft(station.is_active)
    setRemoteDraft(station.remote_booking_allowed)
    setApprovalDraft(station.requires_staff_approval)
    setOriginal({
      baseTime: station.base_time_minutes,
      price: station.price_adjustment,
      isActive: station.is_active,
      remote: station.remote_booking_allowed,
      approval: station.requires_staff_approval,
    })
  }, [
    station.base_time_minutes,
    station.price_adjustment,
    station.is_active,
    station.remote_booking_allowed,
    station.requires_staff_approval,
  ])

  useEffect(() => {
    if (!isActiveDraft) {
      setRemoteDraft(false)
      setApprovalDraft(false)
    }
  }, [isActiveDraft])

  const minutes = clampMinutes(time, station.base_time_minutes)

  const isDirty =
    minutes !== original.baseTime ||
    priceNumber !== original.price ||
    isActiveDraft !== original.isActive ||
    remoteDraft !== original.remote ||
    approvalDraft !== original.approval

  useEffect(() => {
    onDirtyChange?.(station.id, isDirty)
  }, [isDirty, station.id, onDirtyChange])

  const handleSaveClick = useCallback(async () => {
    if (!isDirty) return

    setIsSaving(true)
    try {
      await onSave({
        stationId: station.id,
        baseTimeMinutes: minutes,
        priceAdjustment: priceNumber,
        isActive: isActiveDraft,
        remoteBookingAllowed: remoteDraft,
        requiresStaffApproval: approvalDraft,
      })
      setTime(minutes.toString())
      setPrice(priceNumber.toString())
      setOriginal({
        baseTime: minutes,
        price: priceNumber,
        isActive: isActiveDraft,
        remote: remoteDraft,
        approval: approvalDraft,
      })
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, minutes, priceNumber, isActiveDraft, remoteDraft, approvalDraft, station.id, onSave])

  useImperativeHandle(ref, () => ({
    save: handleSaveClick,
    isDirty: () => isDirty,
  }), [isDirty, handleSaveClick])

  const handleCancel = () => {
    setTime(original.baseTime.toString())
    setPrice(original.price.toString())
    setIsActiveDraft(original.isActive)
    setRemoteDraft(original.remote)
    setApprovalDraft(original.approval)
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-sm transition hover:border-blue-300",
        !station.is_active && "border-dashed border-amber-300 bg-amber-50/50",
        localIsDisabled && "opacity-70"
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{station.name}</h4>
            <p className="mt-1 text-[11px] text-gray-500">
              {station.station_is_active ? 'עמדה פעילה' : 'עמדה מושבתת בלוח הזמנים'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!station.is_active && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[11px]">
                לא פעיל בשירות זה
              </Badge>
            )}
            {!station.station_is_active && (
              <Badge variant="outline" className="border-amber-200 text-amber-600 text-[11px]">
                עמדה מושבתת
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-gray-500">זמן (דקות)</Label>
            <Input
              value={time}
              onChange={(event) => setTime(event.target.value)}
              type="number"
              min={0}
              className="h-9 text-center"
              disabled={isSaving}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-gray-500">תוספת מחיר (₪)</Label>
            <Input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              type="number"
              className="h-9 text-center"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>מחיר סופי</span>
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(finalPrice)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <StationToggle
            label="פעיל"
            checked={isActiveDraft}
            onCheckedChange={(state) => setIsActiveDraft(state === true)}
            disabled={localIsDisabled}
          />
          <StationToggle
            label="תור מרחוק"
            checked={remoteDraft}
            onCheckedChange={(state) => setRemoteDraft(state === true)}
            disabled={!isActiveDraft || localIsDisabled}
          />
          <StationToggle
            label="אישור צוות"
            checked={approvalDraft}
            onCheckedChange={(state) => setApprovalDraft(state === true)}
            disabled={!isActiveDraft || localIsDisabled}
          />
        </div>
      </div>

      <div className="mt-3 flex w-full gap-2">
        <Button
          className="h-9 flex-1 text-sm"
          onClick={handleSaveClick}
          disabled={isSaving || localIsDisabled || !isDirty}
        >
          {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? 'שומר...' : 'שמור'}
        </Button>
        {isDirty ? (
          <Button
            variant="outline"
            className="h-9 px-4 text-sm"
            onClick={handleCancel}
            disabled={isSaving}
          >
            בטל
          </Button>
        ) : null}
      </div>
    </div>
  )
})

StationCard.displayName = 'StationCard'

interface StationToggleProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (state: CheckedState) => void;
}

const StationToggle = ({ label, checked, disabled, onCheckedChange }: StationToggleProps) => (
  <label
    className={cn(
      "flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-gray-600",
      disabled && "cursor-not-allowed opacity-60"
    )}
  >
    <Checkbox
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    />
    <span>{label}</span>
  </label>
)

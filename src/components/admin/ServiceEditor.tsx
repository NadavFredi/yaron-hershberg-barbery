
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowRight, Plus, X, Search, Clock, Loader2 } from 'lucide-react'
import { useServiceConfiguration } from '@/hooks/useServiceConfiguration'
import ServiceBasePriceEditor from './ServiceBasePriceEditor'
import PriceStepper from './PriceStepper'
import SmartTreatmentTypeSelectorMultiple from './SmartTreatmentTypeSelectorMultiple'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import type { CheckedState } from '@radix-ui/react-checkbox'

interface ServiceEditorProps {
  serviceId: string;
  onBack?: () => void;
  variant?: 'standalone' | 'embedded';
}

type StationDraft = {
  time: string;
  price: string;
  isActive: boolean;
};

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

const ServiceEditor = ({ serviceId, onBack, variant = 'standalone' }: ServiceEditorProps) => {
  // All hooks must be called at the top level, unconditionally
  const [isTreatmentTypeSelectorOpen, setIsTreatmentTypeSelectorOpen] = useState(false);
  const [treatmentTypeSearchTerm, setTreatmentTypeSearchTerm] = useState('');
  const [isApplyAllDialogOpen, setIsApplyAllDialogOpen] = useState(false);
  const [applyAllTime, setApplyAllTime] = useState(60);
  const [stationDrafts, setStationDrafts] = useState<Record<string, StationDraft>>({})
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])
  const [updatingStationIds, setUpdatingStationIds] = useState<string[]>([])
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [bulkTime, setBulkTime] = useState<string>('')
  const [bulkPrice, setBulkPrice] = useState<string>('')
  const { toast } = useToast();

  const {
    service,
    stations,
    treatmentTypeAdjustments,
    isLoading,
    updateStationConfig,
    addTreatmentTypeAdjustments,
    removeTreatmentTypeAdjustment,
    updateTreatmentTypeTimeAdjustment,
    applyTimeToAllStations
  } = useServiceConfiguration(serviceId);

  const filteredTreatmentTypeAdjustments = useMemo(() => {
    if (!treatmentTypeAdjustments) {
      return []
    }

    let filtered = treatmentTypeAdjustments
    if (treatmentTypeSearchTerm.trim()) {
      filtered = treatmentTypeAdjustments.filter((adj) =>
        adj.treatment_type_name.toLowerCase().includes(treatmentTypeSearchTerm.toLowerCase())
      )
    }

    return filtered.sort((a, b) => a.treatment_type_name.localeCompare(b.treatment_type_name, 'he'))
  }, [treatmentTypeAdjustments, treatmentTypeSearchTerm])

  const sortedStations = useMemo(() => {
    if (!stations) {
      return []
    }
    return [...stations].sort((a, b) => a.name.localeCompare(b.name, 'he'))
  }, [stations])

  useEffect(() => {
    if (!sortedStations.length) {
      setStationDrafts({})
      setSelectedStationIds([])
      return
    }

    setStationDrafts((prev) => {
      let changed = false
      const next: Record<string, StationDraft> = {}

      sortedStations.forEach((station) => {
        const existing = prev[station.id]
        const draft: StationDraft = {
          time: existing?.time ?? station.base_time_minutes.toString(),
          price: existing?.price ?? (station.price_adjustment || 0).toString(),
          isActive: station.is_active,
        }

        next[station.id] = draft

        if (!existing || existing.isActive !== draft.isActive) {
          changed = true
        }
      })

      if (!changed && Object.keys(prev).length === Object.keys(next).length) {
        return prev
      }

      return next
    })

    setSelectedStationIds((prev) => {
      const next = prev.filter((id) => sortedStations.some((station) => station.id === id))
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev
      }
      return next
    })
  }, [sortedStations])

  const toggleAllStations = useCallback(
    (checked: CheckedState) => {
      if (checked === true) {
        setSelectedStationIds(sortedStations.map((station) => station.id))
      } else if (checked === false) {
        setSelectedStationIds([])
      }
    },
    [sortedStations]
  )

  const toggleStationSelection = useCallback((stationId: string, checked: CheckedState) => {
    setSelectedStationIds((prev) => {
      if (checked === true) {
        if (prev.includes(stationId)) {
          return prev
        }
        return [...prev, stationId]
      }
      return prev.filter((id) => id !== stationId)
    })
  }, [])

  const updateStationDraftValue = useCallback((stationId: string, field: 'time' | 'price', value: string) => {
    setStationDrafts((prev) => {
      const current = prev[stationId] ?? { time: '', price: '', isActive: false }
      return {
        ...prev,
        [stationId]: {
          ...current,
          [field]: value,
        },
      }
    })
  }, [])

  const handleRowUpdate = useCallback(async (stationId: string) => {
    const station = sortedStations.find((s) => s.id === stationId)
    if (!station) return

    const draft = stationDrafts[stationId] ?? {
      time: station.base_time_minutes.toString(),
      price: (station.price_adjustment || 0).toString(),
      isActive: station.is_active,
    }

    const minutes = clampMinutes(draft.time, station.base_time_minutes)
    const priceAdjustment = parsePriceAdjustment(draft.price, station.price_adjustment || 0)

    setUpdatingStationIds((prev) => (prev.includes(stationId) ? prev : [...prev, stationId]))
    try {
      await updateStationConfig({
        serviceId,
        stationId,
        baseTimeMinutes: minutes,
        priceAdjustment,
      })
      setStationDrafts((prev) => ({
        ...prev,
        [stationId]: {
          ...prev[stationId],
          time: minutes.toString(),
          price: priceAdjustment.toString(),
        },
      }))
    } catch (error) {
      console.error('Error updating station configuration:', error)
      toast({
        title: "שגיאה בעדכון העמדה",
        description: "אנא נסה שוב",
        variant: "destructive",
      })
    } finally {
      setUpdatingStationIds((prev) => prev.filter((id) => id !== stationId))
    }
  }, [sortedStations, stationDrafts, updateStationConfig, serviceId, toast])

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>, stationId: string) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleRowUpdate(stationId)
    }
  }, [handleRowUpdate])

  const handleBulkApply = useCallback(async () => {
    if (!selectedStationIds.length) {
      toast({
        title: "בחר עמדות לעדכון",
        description: "סמן לפחות עמדה אחת ולאחר מכן העדכן.",
        variant: "destructive",
      })
      return
    }

    const timeValue = bulkTime.trim()
    const priceValue = bulkPrice.trim()

    if (!timeValue && !priceValue) {
      toast({
        title: "אין ערכי עדכון",
        description: "הזן זמן או תוספת מחיר לעדכן.",
        variant: "destructive",
      })
      return
    }

    setIsBulkUpdating(true)
    try {
      const updates: Array<{ stationId: string; minutes: number; priceAdjustment: number }> = []

      await Promise.all(
        selectedStationIds.map((stationId) => {
          const station = sortedStations.find((s) => s.id === stationId)
          if (!station) return Promise.resolve()

          const draft = stationDrafts[stationId] ?? {
            time: station.base_time_minutes.toString(),
            price: (station.price_adjustment || 0).toString(),
            isActive: station.is_active,
          }

          const minutes = timeValue
            ? clampMinutes(timeValue, station.base_time_minutes)
            : clampMinutes(draft.time, station.base_time_minutes)

          const priceAdjustment = priceValue
            ? parsePriceAdjustment(priceValue, station.price_adjustment || 0)
            : parsePriceAdjustment(draft.price, station.price_adjustment || 0)

          updates.push({ stationId, minutes, priceAdjustment })

          return updateStationConfig({
            serviceId,
            stationId,
            baseTimeMinutes: minutes,
            priceAdjustment,
          })
        })
      )

      if (updates.length) {
        setStationDrafts((prev) => {
          const next = { ...prev }
          updates.forEach(({ stationId, minutes, priceAdjustment }) => {
            if (next[stationId]) {
              next[stationId] = {
                ...next[stationId],
                time: minutes.toString(),
                price: priceAdjustment.toString(),
              }
            }
          })
          return next
        })
      }

      toast({
        title: "העמדות עודכנו בהצלחה",
        description: `עודכנו ${updates.length} עמדות.`,
      })

      setBulkTime('')
      setBulkPrice('')
    } catch (error) {
      console.error('Error applying bulk station update:', error)
      toast({
        title: "שגיאה בעדכון מרוכז",
        description: "אנא נסה שוב",
        variant: "destructive",
      })
    } finally {
      setIsBulkUpdating(false)
    }
  }, [selectedStationIds, bulkTime, bulkPrice, sortedStations, stationDrafts, updateStationConfig, serviceId, toast])

  const clearSelection = useCallback(() => setSelectedStationIds([]), [])

  const headerCheckboxState: CheckedState =
    sortedStations.length === 0
      ? false
      : selectedStationIds.length === sortedStations.length
        ? true
        : selectedStationIds.length > 0
          ? 'indeterminate'
          : false

  const bulkActionDisabled =
    selectedStationIds.length === 0 ||
    (bulkTime.trim() === '' && bulkPrice.trim() === '') ||
    isBulkUpdating

  const handleTreatmentTypesSelect = useCallback(async (treatmentTypeIds: string[]) => {
    try {
      await addTreatmentTypeAdjustments(treatmentTypeIds)
      toast({
        title: "גזעים נוספו בהצלחה",
        description: `${treatmentTypeIds.length} גזעים נוספו לשירות`,
      })
    } catch (error) {
      console.error('Error adding treatmentTypes:', error)
      toast({
        title: "שגיאה בהוספת הגזעים",
        description: "אנא נסה שוב",
        variant: "destructive",
      })
    }
  }, [addTreatmentTypeAdjustments, toast])

  const handleRemoveTreatmentType = useCallback(async (treatmentTypeId: string) => {
    try {
      await removeTreatmentTypeAdjustment(treatmentTypeId)
    } catch (error) {
      console.error('Error removing treatmentType:', error)
    }
  }, [removeTreatmentTypeAdjustment])

  const handleTreatmentTypeTimeChange = useCallback(async (treatmentTypeId: string, newTimeAdjustment: number) => {
    try {
      await updateTreatmentTypeTimeAdjustment(treatmentTypeId, newTimeAdjustment)
    } catch (error) {
      console.error('Error updating treatmentType time:', error)
    }
  }, [updateTreatmentTypeTimeAdjustment])

  const handleApplyTimeToAll = useCallback(async () => {
    try {
      await applyTimeToAllStations(applyAllTime)
      setIsApplyAllDialogOpen(false)

      setStationDrafts((prev) => {
        const next = { ...prev }
        sortedStations.forEach((station) => {
          if (next[station.id]) {
            next[station.id] = {
              ...next[station.id],
              time: applyAllTime.toString(),
            }
          }
        })
        return next
      })

      toast({
        title: "זמן עודכן בכל העמדות",
        description: `כל העמדות עודכנו ל-${applyAllTime} דקות`,
      })
    } catch (error) {
      console.error('Error applying time to all stations:', error)
      toast({
        title: "שגיאה בעדכון הזמן",
        description: "אנא נסה שוב",
        variant: "destructive",
      })
    }
  }, [applyTimeToAllStations, applyAllTime, sortedStations, toast])

  // Early return after all hooks have been called
  if (isLoading || !service) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נתוני השירות...</p>
        </div>
      </div>
    );
  }

  // Get excluded treatmentType IDs for the selector
  const excludeTreatmentTypeIds = treatmentTypeAdjustments?.map(adj => adj.treatment_type_id) || [];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      {variant === 'standalone' ? (
        <div className="flex items-center justify-between">
          <div>
            {onBack && (
              <Button
                variant="ghost"
                onClick={onBack}
                className="mb-4 text-blue-600 hover:text-blue-700"
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה לרשימת השירותים
              </Button>
            )}
            <h1 className="text-3xl font-bold text-gray-900">עריכת שירות: {service.name}</h1>
            {service.description && (
              <p className="mt-1 text-gray-600">{service.description}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-gray-900">ניהול הגדרות השירות</h2>
          <p className="text-sm text-gray-600">
            עדכון מחיר בסיס, זמני עבודה והתאמות לגזעים – הכל במקום אחד.
          </p>
        </div>
      )}

      {/* Base Price Editor */}
      <ServiceBasePriceEditor
        serviceId={serviceId}
        serviceName={service.name}
        currentBasePrice={service.base_price}
      />

      {/* Station Configuration */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-xl">ניהול זמני עמדות</CardTitle>
              <p className="mt-1 text-sm text-gray-600">
                בחר עמדות ועדכן זמן (בדקות) ותוספת מחיר בפעולה אחת.
              </p>
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">זמן (דקות)</span>
                <Input
                  value={bulkTime}
                  onChange={(event) => setBulkTime(event.target.value)}
                  type="number"
                  min={0}
                  className="h-9 w-24 text-center"
                  placeholder="לדוגמה 60"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">תוספת מחיר</span>
                <Input
                  value={bulkPrice}
                  onChange={(event) => setBulkPrice(event.target.value)}
                  type="number"
                  className="h-9 w-24 text-center"
                  placeholder="לדוגמה 15"
                />
              </div>
              <Button
                disabled={bulkActionDisabled}
                onClick={handleBulkApply}
                className="flex items-center gap-2"
              >
                {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isBulkUpdating
                  ? 'מעבד...'
                  : selectedStationIds.length
                    ? `עדכן ${selectedStationIds.length} עמדות`
                    : 'עדכן עמדות'}
              </Button>
              <Button
                variant="outline"
                onClick={clearSelection}
                disabled={selectedStationIds.length === 0}
              >
                נקה בחירה
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsApplyAllDialogOpen(true)}
                className="text-blue-600 hover:text-blue-700"
              >
                <Clock className="ml-2 h-4 w-4" />
                זמן אחיד לכל העמדות
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table containerClassName="overflow-x-auto">
            <TableHeader className="bg-[hsl(228_36%_95%)]">
              <TableRow className="[&>th]:text-center">
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={headerCheckboxState}
                    onCheckedChange={toggleAllStations}
                    aria-label="בחר את כל העמדות"
                  />
                </TableHead>
                <TableHead className="text-right">שם העמדה</TableHead>
                <TableHead className="text-center w-32">זמן (דקות)</TableHead>
                <TableHead className="text-center w-32">תוספת מחיר</TableHead>
                <TableHead className="text-center w-32">מחיר סופי</TableHead>
                <TableHead className="text-center w-24">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStations.map((station) => {
                const draft = stationDrafts[station.id] ?? {
                  time: station.base_time_minutes.toString(),
                  price: (station.price_adjustment || 0).toString(),
                  isActive: station.is_active,
                }
                const isSelected = selectedStationIds.includes(station.id)
                const isUpdating = updatingStationIds.includes(station.id)
                const priceNumber = parsePriceAdjustment(draft.price, station.price_adjustment || 0)
                const finalPrice = service.base_price + priceNumber

                return (
                  <TableRow key={station.id}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => toggleStationSelection(station.id, checked)}
                        aria-label={`בחר את ${station.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900">{station.name}</span>
                        {!station.is_active && (
                          <Badge variant="outline" className="border-amber-200 text-amber-600">
                            לא פעילה
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        value={draft.time}
                        onChange={(event) => updateStationDraftValue(station.id, 'time', event.target.value)}
                        onKeyDown={(event) => handleInputKeyDown(event, station.id)}
                        className="mx-auto h-9 w-24 text-center"
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        value={draft.price}
                        onChange={(event) => updateStationDraftValue(station.id, 'price', event.target.value)}
                        onKeyDown={(event) => handleInputKeyDown(event, station.id)}
                        className="mx-auto h-9 w-24 text-center"
                      />
                    </TableCell>
                    <TableCell className="text-center text-gray-700">
                      ₪{finalPrice.toLocaleString('he-IL')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRowUpdate(station.id)}
                        disabled={isUpdating}
                        className="mx-auto flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isUpdating ? 'שומר...' : 'שמור'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {sortedStations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                    אין עמדות זמינות כרגע.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* TreatmentType Adjustments */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl">התאמות מיוחדות לגזעים</CardTitle>
              <p className="mt-1 text-sm text-gray-600">
                הוסף זמן נוסף לגזעים מסוימים (למשל: פודל טויי +15 דקות)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="חפש/י גזע..."
                  value={treatmentTypeSearchTerm}
                  onChange={(e) => setTreatmentTypeSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={() => setIsTreatmentTypeSelectorOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="ml-2 h-4 w-4" />
                הוסף גזעים
              </Button>
            </div>
          </div>
          <div className="relative md:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="חפש/י גזע..."
              value={treatmentTypeSearchTerm}
              onChange={(e) => setTreatmentTypeSearchTerm(e.target.value)}
              className="mt-3 pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredTreatmentTypeAdjustments.length > 0 ? (
            <div className="space-y-3">
              {filteredTreatmentTypeAdjustments.map((adjustment) => (
                <div
                  key={adjustment.treatment_type_id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="text-base font-semibold text-gray-900">
                      {adjustment.treatment_type_name}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">זמן נוסף:</span>
                      <PriceStepper
                        value={adjustment.time_modifier_minutes}
                        onChange={(newTime) => handleTreatmentTypeTimeChange(adjustment.treatment_type_id, newTime)}
                        step={5}
                        min={-30}
                        max={120}
                      />
                      <span className="text-sm text-gray-600">דקות</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="self-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemoveTreatmentType(adjustment.treatment_type_id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : treatmentTypeAdjustments && treatmentTypeAdjustments.length > 0 && treatmentTypeSearchTerm ? (
            <div className="text-center py-8">
              <p className="mb-4 text-gray-500">לא נמצאו גזעים התואמים לחיפוש "{treatmentTypeSearchTerm}"</p>
              <Button
                variant="outline"
                onClick={() => setTreatmentTypeSearchTerm('')}
              >
                נקה חיפוש
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>אין עדיין התאמות מיוחדות לגזעים.</p>
              <p className="mt-2 text-sm">לחץ על "הוסף גזעים" כדי להתחיל.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Time to All Dialog */}
      <Dialog open={isApplyAllDialogOpen} onOpenChange={setIsApplyAllDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>החל זמן אחיד על כל העמדות</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                זמן (דקות): {applyAllTime}
              </label>
              <Slider
                value={[applyAllTime]}
                onValueChange={([newValue]) => setApplyAllTime(newValue)}
                max={180}
                min={15}
                step={15}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>15 דקות</span>
                <span>3 שעות</span>
              </div>
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse">
              <Button variant="outline" onClick={() => setIsApplyAllDialogOpen(false)}>
                בטל
              </Button>
              <Button onClick={handleApplyTimeToAll}>
                החל על כל העמדות
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart TreatmentType Selector */}
      <SmartTreatmentTypeSelectorMultiple
        open={isTreatmentTypeSelectorOpen}
        onOpenChange={setIsTreatmentTypeSelectorOpen}
        onTreatmentTypesSelect={handleTreatmentTypesSelect}
        excludeTreatmentTypeIds={excludeTreatmentTypeIds}
      />
    </div>
  );
};

export default ServiceEditor;

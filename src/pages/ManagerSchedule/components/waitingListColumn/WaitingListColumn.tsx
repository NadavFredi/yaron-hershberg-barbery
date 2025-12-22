import { ChevronDown, Loader2, Search, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useWaitingList, type ManagerWaitlistEntry, type WaitlistBucketGroup } from "./useWaitingList"
import { DraggableWaitlistCard } from "./DraggableWaitlistCard"

interface WaitingListColumnProps {
  selectedDate: Date
  timelineHeight: number
}

function renderWaitlistBucketGroups(
  groups: WaitlistBucketGroup[],
  prefix: string,
  activeWaitlistBucket: string | null,
  setActiveWaitlistBucket: (bucketId: string | null) => void,
  handleWaitlistCardClick: (entry: ManagerWaitlistEntry) => void
) {
  if (!groups.length) {
    return (
      <div
        key={`${prefix}-empty`}
        className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-3 text-center text-xs text-gray-500"
      >
        אין רשומות בקבוצה זו
      </div>
    )
  }

  return groups.map((group) => {
    const bucketId = `${prefix}-${group.id}`
    const isOpen = activeWaitlistBucket === bucketId
    return (
      <div
        key={bucketId}
        className="rounded-lg border border-slate-100 bg-slate-50/70 p-2"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between text-right"
          dir="rtl"
          onClick={() => setActiveWaitlistBucket(isOpen ? null : bucketId)}
        >
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-sm font-semibold text-gray-900">{group.label}</span>
            <span className="text-xs text-gray-500">{group.entries.length}</span>
          </div>
          <ChevronDown
            className={cn("h-4 w-4 text-gray-500 transition-transform", isOpen ? "rotate-180" : "")}
          />
        </button>
        {isOpen && (
          <div className="mt-3 space-y-2">
            {group.entries.map((entry) => (
              <DraggableWaitlistCard
                key={`${bucketId}-${entry.id}`}
                entry={entry}
                onCardClick={() => handleWaitlistCardClick(entry)}
              />
            ))}
          </div>
        )}
      </div>
    )
  })
}

export function WaitingListColumn({ selectedDate, timelineHeight }: WaitingListColumnProps) {
  const {
    filteredWaitingListEntries,
    isLoadingWaitingList,
    waitingListError,
    waitingListSummary,
    waitlistBuckets,
    waitingListDateLabel,
    waitingListLastUpdatedLabel,
    waitlistHasEntries,
    waitlistHasFilters,
    waitingListActiveFiltersCount,
    waitingListSearchTerm,
    setWaitingListSearchTerm,
    selectedCustomerTypes,
    customerTypeQuery,
    setCustomerTypeQuery,
    searchCustomerTypes,
    handleSelectCustomerType,
    removeCustomerType,
    clearWaitingListFilters,
    waitlistSection,
    setWaitlistSection,
    activeWaitlistBucket,
    setActiveWaitlistBucket,
    handleWaitlistCardClick,
  } = useWaitingList({ selectedDate })

  return (
    <div className="flex flex-col" dir="rtl">
      <div
        className="relative overflow-hidden rounded-lg border border-emerald-100 bg-white"
        style={{ height: timelineHeight }}
      >
        <div className="flex h-full flex-col">
          <div className="space-y-3 border-b border-slate-100 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{waitingListDateLabel}</p>
                <p className="text-xs text-gray-500">
                  {waitingListSummary.filtered} מתוך {waitingListSummary.total} ממתינים
                </p>
              </div>
            </div>

            {waitlistHasEntries && (
              <div className="flex flex-wrap gap-1 text-[11px]">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  מספרה {waitingListSummary.scopeCounts.grooming}
                </span>
              </div>
            )}

            <div className="relative" dir="rtl">
              <Input
                value={waitingListSearchTerm}
                onChange={(event) => setWaitingListSearchTerm(event.target.value)}
                placeholder="חיפוש לפי שם לקוח או טלפון"
                className="pr-9 text-sm"
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="space-y-3">
              <div>
                <Label className="mb-1 block text-xs font-medium text-gray-500">סיווג לקוח</Label>
                <AutocompleteFilter
                  value={customerTypeQuery}
                  onChange={setCustomerTypeQuery}
                  onSelect={handleSelectCustomerType}
                  placeholder="חפש סוג לקוח..."
                  searchFn={searchCustomerTypes}
                  minSearchLength={0}
                  autoSearchOnFocus
                  initialLoadOnMount
                />
              </div>
            </div>

            {waitlistHasFilters && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {selectedCustomerTypes.map((type) => (
                    <button
                      key={`customer-type-${type.id}`}
                      type="button"
                      onClick={() => removeCustomerType(type.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                    >
                      {type.name}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={clearWaitingListFilters}
                  className="px-0 text-xs text-emerald-700"
                >
                  נקה ({waitingListActiveFiltersCount})
                </Button>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 px-3 py-3">
            <div className="space-y-3 pr-3">
              {isLoadingWaitingList ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  טוען רשימת המתנה...
                </div>
              ) : waitingListError ? (
                <Alert variant="destructive">
                  <AlertTitle>שגיאה</AlertTitle>
                  <AlertDescription>{waitingListError}</AlertDescription>
                </Alert>
              ) : filteredWaitingListEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center text-sm text-gray-500">
                  אין ממתינים שעונים למסננים שנבחרו
                </div>
              ) : (
                <Accordion
                  type="single"
                  collapsible
                  value={waitlistSection ?? undefined}
                  onValueChange={(value) => setWaitlistSection(value || null)}
                  className="space-y-3"
                >
                  <AccordionItem value="client-types">
                    <AccordionTrigger className="text-sm font-semibold text-gray-900 justify-between text-right flex-row-reverse">
                      לפי סיווג לקוח ({waitlistBuckets.clientTypes.length})
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      {renderWaitlistBucketGroups(
                        waitlistBuckets.clientTypes,
                        "client",
                        activeWaitlistBucket,
                        setActiveWaitlistBucket,
                        handleWaitlistCardClick
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}


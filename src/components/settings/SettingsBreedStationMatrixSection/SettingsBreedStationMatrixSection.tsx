import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Save, Search, X, ChevronLeft, ChevronRight, CheckSquare, Square, MoreVertical, Copy, Trash2, ChevronUp, ChevronDown, Globe, ShieldCheck, Info, Check, Settings, RefreshCw } from "lucide-react"
import { useSettingsBreedStationMatrixSection } from "./SettingsBreedStationMatrixSection.module"
import { DuplicateStationDialog } from "../../dialogs/settings/stations/DuplicateStationDialog"
import { DeleteStationDialog } from "../../dialogs/settings/stations/DeleteStationDialog"
import { DuplicateBreedDialog } from "../../dialogs/settings/breeds/DuplicateBreedDialog"
import { DeleteBreedDialog } from "../../dialogs/settings/breeds/DeleteBreedDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration-utils"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { STATIONS_PER_VIEW, BREEDS_PER_PAGE } from "./SettingsBreedStationMatrixSection.consts"
import { MultiSelectDropdown } from "./components/MultiSelectDropdown"
import { AddBreedDialog } from "./components/AddBreedDialog"
import { AddStationDialog } from "./components/AddStationDialog"
import { StationSelectionDialog } from "./components/StationSelectionDialog"

export function SettingsBreedStationMatrixSection() {
    const {
        breeds,
        filteredBreeds,
        visibleBreeds,
        allStations,
        allStationsIncludingInactive,
        visibleStations,
        selectedStationIds,
        stationPage,
        breedPage,
        searchTerm,
        categoryFilterIds,
        selectedColumnFilter,
        columnFilterNeedsApproval,
        columnFilterIsActive,
        columnFilterRemoteBooking,
        columnFilterDurationMin,
        columnFilterDurationMax,
        groomingServiceId,
        matrix,
        initialMatrix,
        isLoading,
        isSaving,
        isStationDialogOpen,
        isAddStationDialogOpen,
        isAddBreedDialogOpen,
        newStationName,
        newBreedName,
        isAddingStation,
        isAddingBreed,
        stationToDelete,
        stationToDuplicate,
        isDeleteConfirmOpen,
        isDuplicateConfirmOpen,
        isTransferDialogOpen,
        breedToDuplicate,
        isDuplicateBreedDialogOpen,
        isDuplicatingBreed,
        breedToDelete,
        isDeleteBreedDialogOpen,
        isDeletingBreed,
        isTypingDuration,
        durationInputValues,
        isTypingDefault,
        defaultDurationInputValues,
        expandedBreedId,
        editedBreedPrices,
        dogCategories,
        breedCategoriesMap,
        editedCategoriesMap,
        savingBreedId,
        savingBreedRowId,
        sensors,
        setSearchTerm,
        setCategoryFilterIds,
        setSelectedColumnFilter,
        setColumnFilterNeedsApproval,
        setColumnFilterIsActive,
        setColumnFilterRemoteBooking,
        setColumnFilterDurationMin,
        setColumnFilterDurationMax,
        setIsStationDialogOpen,
        setIsAddStationDialogOpen,
        setIsAddBreedDialogOpen,
        setNewStationName,
        setNewBreedName,
        setStationToDelete,
        setStationToDuplicate,
        setIsDeleteConfirmOpen,
        setIsDuplicateConfirmOpen,
        setIsTransferDialogOpen,
        setBreedToDuplicate,
        setIsDuplicateBreedDialogOpen,
        setBreedToDelete,
        setIsDeleteBreedDialogOpen,
        setIsTypingDuration,
        setDurationInputValues,
        setIsTypingDefault,
        setDefaultDurationInputValues,
        setExpandedBreedId,
        setEditedBreedPrices,
        setEditedCategoriesMap,
        getDefaultTimeForBreed,
        getBreedCategories,
        breedHasPriceChanges,
        breedHasMatrixChanges,
        getBreedStatus,
        toggleBreedExpand,
        handleToggleSupport,
        handleDefaultTimeChange,
        handleStationTimeChange,
        handleApplyDefaultToAll,
        handleToggleStationSelection,
        handleDragEnd,
        handleTurnOnAllStations,
        handleTurnOffAllStations,
        handleMarkAllRemoteBooking,
        handleMarkAllNoRemoteBooking,
        handleMarkAllApprovalNeeded,
        handleMarkAllNoApprovalNeeded,
        handleAddBreed,
        handleAddStation,
        handleSave,
        handlePriceChange,
        handleCategoriesChange,
        handleNotesChange,
        handleSaveBreedPrices,
        handleCancelBreedPrices,
        handleSaveBreedRow,
        handleRevertBreedRow,
        handleToggleRemoteBooking,
        handleToggleApproval,
        handleNextStationPage,
        handlePreviousStationPage,
        handleNextBreedPage,
        handlePreviousBreedPage,
        handleDuplicateStation,
        handleDuplicateBreed,
        handleDeleteBreed,
        confirmDeleteBreed,
        confirmDuplicateBreed,
        confirmDuplicateStation,
        handleDeleteStation,
        confirmDeleteStation,
        handleTransferAndDelete,
        maxStationPage,
        canGoPreviousStation,
        canGoNextStation,
        maxBreedPage,
        canGoPreviousBreed,
        canGoNextBreed,
    } = useSettingsBreedStationMatrixSection()

    // All logic is now in the module file
    // Only UI rendering remains here


    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2">טוען מטריצת גזעים-עמדות...</span>
            </div>
        )
    }

    if (!groomingServiceId) {
        return (
            <div className="text-center py-12 text-gray-500">
                שירות טיפוח לא נמצא במערכת. אנא הוסף שירות טיפוח תחילה.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">מטריצת גזעים-עמדות</h2>
                    <p className="text-gray-600 mt-1">נהל את כל הגדרות המערכת - גזעים, שעות עבודה, עמדות ומטריצות</p>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipContent side="bottom" className="max-w-xs" dir="rtl">
                                <div className="space-y-2 text-sm">
                                    <p className="font-medium">הסבר:</p>
                                    <ul className="list-disc list-inside space-y-1 mr-2">
                                        <li>סמן ✓ כדי לאפשר לעמדה לטפל בגזע מסוים</li>
                                        <li>זמן ברירת מחדל חל על כל העמדות התומכות בגזע זה</li>
                                        <li>ניתן להגדיר זמן ספציפי לכל עמדה (עוקף את ברירת המחדל)</li>
                                        <li>הזמן הכולל = זמן בסיסי של העמדה + זמן תיקון הגזע</li>
                                    </ul>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <AddBreedDialog
                        open={isAddBreedDialogOpen}
                        onOpenChange={setIsAddBreedDialogOpen}
                        breedName={newBreedName}
                        onBreedNameChange={setNewBreedName}
                        onAdd={handleAddBreed}
                        isAdding={isAddingBreed}
                    />

                    <AddStationDialog
                        open={isAddStationDialogOpen}
                        onOpenChange={setIsAddStationDialogOpen}
                        stationName={newStationName}
                        onStationNameChange={setNewStationName}
                        onAdd={handleAddStation}
                        isAdding={isAddingStation}
                    />

                    <StationSelectionDialog
                        open={isStationDialogOpen}
                        onOpenChange={setIsStationDialogOpen}
                        allStations={allStationsIncludingInactive}
                        selectedStationIds={selectedStationIds}
                        onToggleStation={handleToggleStationSelection}
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                    />
                    <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Save className="h-4 w-4" />
                        שמור שינויים
                    </Button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ">
                {/* Search */}
                <div className="relative">
                    <Label className="text-sm text-right block mb-2">חפש גזע</Label>
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            placeholder="חפש גזע..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pr-10 h-10"
                            dir="rtl"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm("")}
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Filter */}
                <div className="space-y-2 min-w-0">
                    <Label className="text-sm text-right block">קטגוריה</Label>
                    <MultiSelectDropdown
                        options={dogCategories.map((category) => ({ id: category.id, name: category.name }))}
                        selectedIds={categoryFilterIds}
                        onSelectionChange={setCategoryFilterIds}
                        placeholder="סנן לפי קטגוריה"
                        className="w-full h-10"
                    />
                </div>

                {/* Column Filter */}
                <div className="space-y-2 min-w-0">
                    <Label className="text-sm text-right block">בחר עמודה לסינון</Label>
                    <Select
                        value={selectedColumnFilter || "all"}
                        onValueChange={(value) => {
                            setSelectedColumnFilter(value === "all" ? null : value)
                            // Reset column-specific filters when changing column
                            setColumnFilterNeedsApproval(null)
                            setColumnFilterIsActive(null)
                            setColumnFilterRemoteBooking(null)
                            setColumnFilterDurationMin("")
                            setColumnFilterDurationMax("")
                        }}
                    >
                        <SelectTrigger className="w-full h-10" dir="rtl">
                            <SelectValue placeholder="בחר עמודה..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">הצג את כל העמודות</SelectItem>
                            {allStations
                                .filter((s) => selectedStationIds.includes(s.id))
                                .map((station) => (
                                    <SelectItem key={station.id} value={station.id}>
                                        {station.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Column-Specific Filters (shown when column is selected) */}
            {selectedColumnFilter && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="space-y-2">
                        <Label className="text-sm text-right block">פעיל</Label>
                        <Select
                            value={columnFilterIsActive === null ? "all" : columnFilterIsActive ? "true" : "false"}
                            onValueChange={(value) => setColumnFilterIsActive(value === "all" ? null : value === "true")}
                        >
                            <SelectTrigger className="w-full" dir="rtl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="true">פעיל</SelectItem>
                                <SelectItem value="false">לא פעיל</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm text-right block">תור מרחוק</Label>
                        <Select
                            value={columnFilterRemoteBooking === null ? "all" : columnFilterRemoteBooking ? "true" : "false"}
                            onValueChange={(value) => setColumnFilterRemoteBooking(value === "all" ? null : value === "true")}
                        >
                            <SelectTrigger className="w-full" dir="rtl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="true">כן</SelectItem>
                                <SelectItem value="false">לא</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm text-right block">דרוש אישור</Label>
                        <Select
                            value={columnFilterNeedsApproval === null ? "all" : columnFilterNeedsApproval ? "true" : "false"}
                            onValueChange={(value) => setColumnFilterNeedsApproval(value === "all" ? null : value === "true")}
                        >
                            <SelectTrigger className="w-full" dir="rtl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="true">כן</SelectItem>
                                <SelectItem value="false">לא</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm text-right block">משך זמן</Label>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="מינימום"
                                value={columnFilterDurationMin}
                                onChange={(e) => {
                                    const cleaned = e.target.value.replace(/[^\d:]/g, "")
                                    setColumnFilterDurationMin(cleaned)
                                }}
                                className="w-full text-xs"
                                dir="rtl"
                            />
                            <Input
                                type="text"
                                placeholder="מקסימום"
                                value={columnFilterDurationMax}
                                onChange={(e) => {
                                    const cleaned = e.target.value.replace(/[^\d:]/g, "")
                                    setColumnFilterDurationMax(cleaned)
                                }}
                                className="w-full text-xs"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination - Top */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {/* Breed Pagination */}
                    {filteredBreeds.length > BREEDS_PER_PAGE && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                            <button
                                type="button"
                                onClick={handlePreviousBreedPage}
                                disabled={!canGoPreviousBreed}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="גזע קודם"
                            >
                                <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="text-xs">
                                {breedPage * BREEDS_PER_PAGE + 1}-{Math.min((breedPage + 1) * BREEDS_PER_PAGE, filteredBreeds.length)} מתוך {filteredBreeds.length}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextBreedPage}
                                disabled={!canGoNextBreed}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="גזע הבא"
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                    {/* Station Pagination */}
                    {!selectedColumnFilter && selectedStationIds.length > STATIONS_PER_VIEW && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 mr-4">
                            <button
                                type="button"
                                onClick={handlePreviousStationPage}
                                disabled={!canGoPreviousStation}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="עמדה קודמת"
                            >
                                <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="text-xs">
                                עמדות {stationPage + 1}-{Math.min(stationPage + STATIONS_PER_VIEW, selectedStationIds.length)} מתוך {selectedStationIds.length}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextStationPage}
                                disabled={!canGoNextStation}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="עמדה הבאה"
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="border rounded-lg">
                <div className="overflow-x-auto overflow-y-auto max-h-[800px] [direction:ltr] custom-scrollbar">
                    <div className="[direction:rtl]">
                        <div className="relative w-full">
                            <table className="w-full caption-bottom text-sm table-fixed">
                                <thead className="sticky top-0 z-20 [&_tr]:border-b bg-background">
                                    <tr className="border-b transition-colors bg-[hsl(228_36%_95%)]">
                                        <th className="text-right sticky pr-6 right-0 bg-[hsl(228_36%_95%)] text-primary font-semibold z-20 border-r-2 border-primary/20 align-middle" style={{ width: '380px', minWidth: '380px' }}>
                                            גזע / זמן ברירת מחדל
                                        </th>
                                        {visibleStations.map((station, stationIndex) => {
                                            const isLastStation = stationIndex === visibleStations.length - 1
                                            const headerBorderClasses = isLastStation
                                                ? 'border-l-2 border-r-2 border-primary/20'
                                                : 'border-l-2 border-r-2 border-primary/20'

                                            return (
                                                <th key={station.id} className={`text-center ${station.is_active ? 'bg-[hsl(228_36%_95%)]' : 'bg-gray-200 opacity-75'} text-primary font-semibold ${headerBorderClasses} h-12 px-3 align-middle`} style={{ width: '180px', minWidth: '180px' }}>
                                                    <div className="flex items-center justify-between gap-2 w-full">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 flex-shrink-0"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" dir="rtl">
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDuplicateStation(station)}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <Copy className="h-4 w-4" />
                                                                    שכפל
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDeleteStation(station)}
                                                                    className="flex items-center gap-2 text-red-600"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    מחק
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <div className="text-center flex-1 flex flex-col items-center gap-1">
                                                            <span className={!station.is_active ? 'text-gray-500' : ''}>{station.name}</span>
                                                            {!station.is_active && (
                                                                <span className="text-xs text-gray-400 bg-gray-300 px-2 py-0.5 rounded" title="עמדה לא פעילה">
                                                                    לא פעילה
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </th>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {filteredBreeds.length === 0 ? (
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <td colSpan={visibleStations.length + 1} className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center text-gray-500 py-8">
                                                {breeds.length === 0
                                                    ? "אין גזעים במערכת. הוסף גזע חדש כדי להתחיל."
                                                    : "לא נמצאו גזעים התואמים את החיפוש."}
                                            </td>
                                        </tr>
                                    ) : (
                                        visibleBreeds.map((breed) => {
                                            const defaultTime = getDefaultTimeForBreed(breed.id)
                                            const breedCells = matrix[breed.id] || {}
                                            const breedStatus = getBreedStatus(breed.id)
                                            const isExpanded = expandedBreedId === breed.id
                                            const editedPrices = editedBreedPrices[breed.id] || {}
                                            const hasPriceChanges = breedHasPriceChanges(breed.id)
                                            const hasMatrixChanges = breedHasMatrixChanges(breed.id)
                                            const isRowDirty = hasPriceChanges || hasMatrixChanges
                                            const isRowSaving = savingBreedRowId === breed.id

                                            // Get status color for filled circle (softer colors)
                                            const statusColor = breedStatus === 'none' ? 'bg-gray-300' : breedStatus === 'some' ? 'bg-blue-300' : 'bg-green-300'

                                            return [
                                                <tr
                                                    key={breed.id}
                                                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                                >
                                                    <td className="sticky right-0 bg-white z-10 border-r-2 border-primary/20 px-4 align-middle [&:has([role=checkbox])]:pr-0" style={{ width: '380px', minWidth: '380px' }}>
                                                        <div className="flex items-center justify-between gap-2 w-full" dir="rtl">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => toggleBreedExpand(breed.id)}
                                                                    className="h-6 w-6 p-0 flex-shrink-0"
                                                                    title={isExpanded ? "צמצם" : "הרחב"}
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronUp className="h-4 w-4" />
                                                                    ) : (
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                                <div className={`h-4 w-4 rounded-full ${statusColor} flex-shrink-0`} />
                                                                <div className="flex flex-col  min-w-0 max-w-[140px]">
                                                                    <span className="font-medium truncate whitespace-nowrap block w-full text-right">{breed.name}</span>
                                                                    <span className="text-xs text-gray-500 text-right">
                                                                        {`ברירת מחדל: ${formatDurationFromMinutes(defaultTime ?? 60)}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                                                {isRowDirty && (
                                                                    <>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                                                            title="בטל שינויים"
                                                                            onClick={() => handleRevertBreedRow(breed.id)}
                                                                            disabled={isRowSaving}
                                                                        >
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                                                                            title="שמור שינויים"
                                                                            onClick={() => handleSaveBreedRow(breed.id)}
                                                                            disabled={isRowSaving}
                                                                        >
                                                                            {isRowSaving ? (
                                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            ) : (
                                                                                <Check className="h-3.5 w-3.5" />
                                                                            )}
                                                                        </Button>
                                                                        <div className="w-px h-5 bg-gray-300 mx-0.5" />
                                                                    </>
                                                                )}
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-0.5">
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                            title="הפעל את כל העמדות"
                                                                            onClick={() => handleTurnOnAllStations(breed.id)}
                                                                        >
                                                                            <CheckSquare className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                                                            title="תור מרחוק - כן (סמן את כל העמדות כתומכות בתור מרחוק)"
                                                                            onClick={() => handleMarkAllRemoteBooking(breed.id)}
                                                                        >
                                                                            <Globe className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                                                            title="אישור - כן (סמן את כל העמדות כנדרשות אישור)"
                                                                            onClick={() => handleMarkAllApprovalNeeded(breed.id)}
                                                                        >
                                                                            <ShieldCheck className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                    <div className="flex items-center gap-0.5">
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                            title="כבה את כל העמדות"
                                                                            onClick={() => handleTurnOffAllStations(breed.id)}
                                                                        >
                                                                            <Square className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                            title="תור מרחוק - לא (סמן את כל העמדות ללא תמיכה בתור מרחוק)"
                                                                            onClick={() => handleMarkAllNoRemoteBooking(breed.id)}
                                                                        >
                                                                            <Globe className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                            title="אישור - לא (סמן את כל העמדות ללא דרישת אישור)"
                                                                            onClick={() => handleMarkAllNoApprovalNeeded(breed.id)}
                                                                        >
                                                                            <ShieldCheck className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="w-px h-5 bg-gray-300 mx-0.5" />
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0"
                                                                            title="פעולות קבוצתיות"
                                                                        >
                                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" dir="rtl" className="min-w-[180px]">
                                                                        <div className="px-2 py-1.5">
                                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                                <Settings className="h-3.5 w-3.5 text-gray-500" />
                                                                                <span className="text-xs font-semibold text-gray-600">זמן ברירת מחדל</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <Input
                                                                                    id={`default-${breed.id}`}
                                                                                    type="text"
                                                                                    value={
                                                                                        isTypingDefault[breed.id]
                                                                                            ? (defaultDurationInputValues[breed.id] ?? formatDurationFromMinutes(defaultTime ?? 60))
                                                                                            : (defaultTime !== undefined ? formatDurationFromMinutes(defaultTime) : "")
                                                                                    }
                                                                                    onChange={(e) => {
                                                                                        const value = e.target.value
                                                                                        const cleaned = value.replace(/[^\d:]/g, "")
                                                                                        setDefaultDurationInputValues((prev) => ({
                                                                                            ...prev,
                                                                                            [breed.id]: cleaned,
                                                                                        }))
                                                                                        const minutes = parseDurationToMinutes(cleaned)
                                                                                        if (minutes !== null && minutes >= 0) {
                                                                                            handleDefaultTimeChange(breed.id, minutes.toString())
                                                                                        }
                                                                                    }}
                                                                                    onFocus={(e) => {
                                                                                        setIsTypingDefault((prev) => ({
                                                                                            ...prev,
                                                                                            [breed.id]: true,
                                                                                        }))
                                                                                        const currentValue = formatDurationFromMinutes(defaultTime ?? 60)
                                                                                        setDefaultDurationInputValues((prev) => ({
                                                                                            ...prev,
                                                                                            [breed.id]: currentValue,
                                                                                        }))
                                                                                        setTimeout(() => {
                                                                                            e.target.select()
                                                                                        }, 0)
                                                                                    }}
                                                                                    onBlur={(e) => {
                                                                                        setIsTypingDefault((prev) => {
                                                                                            const newState = { ...prev }
                                                                                            delete newState[breed.id]
                                                                                            return newState
                                                                                        })
                                                                                        const value = e.target.value
                                                                                        const minutes = parseDurationToMinutes(value)
                                                                                        const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (defaultTime ?? 60)
                                                                                        const formatted = formatDurationFromMinutes(finalMinutes)
                                                                                        setDefaultDurationInputValues((prev) => ({
                                                                                            ...prev,
                                                                                            [breed.id]: formatted,
                                                                                        }))
                                                                                        if (finalMinutes !== defaultTime) {
                                                                                            handleDefaultTimeChange(breed.id, finalMinutes.toString())
                                                                                        }
                                                                                    }}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === "Enter") {
                                                                                            e.preventDefault()
                                                                                            const value = e.target.value
                                                                                            const minutes = parseDurationToMinutes(value)
                                                                                            const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (defaultTime ?? 60)
                                                                                            handleDefaultTimeChange(breed.id, finalMinutes.toString())
                                                                                            e.target.blur()
                                                                                        }
                                                                                    }}
                                                                                    className="h-7 w-14 text-xs text-right flex-1"
                                                                                    dir="rtl"
                                                                                    placeholder="1:00"
                                                                                />
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => handleApplyDefaultToAll(breed.id)}
                                                                                    className="h-7 w-7 p-0"
                                                                                    title="החל על כל העמדות"
                                                                                >
                                                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="border-t my-1" />
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleDuplicateBreed(breed)}
                                                                            className="flex items-center gap-2"
                                                                        >
                                                                            <Copy className="h-4 w-4" />
                                                                            שכפל גזע
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleDeleteBreed(breed)}
                                                                            className="flex items-center gap-2 text-red-600"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                            מחק גזע
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {visibleStations.map((station, stationIndex) => {
                                                        const cell = breedCells[station.id] || { supported: false }
                                                        const displayTime = cell.stationTime || defaultTime || 60
                                                        const isTyping = isTypingDuration[breed.id]?.[station.id] ?? false

                                                        const remoteBooking = cell?.remote_booking_allowed ?? false
                                                        const approvalNeeded = cell?.is_approval_needed ?? false

                                                        // Match column colors with headers - alternating subtle primary tint and white
                                                        const columnColor = stationIndex % 2 === 0
                                                            ? 'bg-primary/3 border-primary/10'  // Even: very subtle primary tint
                                                            : 'bg-white border-gray-100'  // Odd: white

                                                        // Add right border to the last (rightmost) station column
                                                        const isLastStation = stationIndex === visibleStations.length - 1
                                                        const borderClasses = isLastStation
                                                            ? `${columnColor} border-l-2 border-r-2 border-primary/20`
                                                            : `${columnColor} border-l-2 border-r-2 border-primary/20`

                                                        return (
                                                            <td key={station.id} className={`text-center align-middle ${borderClasses} px-4 py-1`} style={{ width: '180px', minWidth: '180px' }}>
                                                                <div className="flex items-center gap-3 justify-center w-full max-w-full">
                                                                    <Input
                                                                        type="text"
                                                                        disabled={!cell.supported}
                                                                        value={
                                                                            cell.supported
                                                                                ? (isTyping
                                                                                    ? (durationInputValues[breed.id]?.[station.id] ?? formatDurationFromMinutes(displayTime))
                                                                                    : formatDurationFromMinutes(displayTime))
                                                                                : "-"
                                                                        }
                                                                        onChange={(e) => {
                                                                            if (!cell.supported) return // Prevent changes when disabled
                                                                            const value = e.target.value
                                                                            // Only allow numbers and colons
                                                                            const cleaned = value.replace(/[^\d:]/g, "")

                                                                            setDurationInputValues((prev) => ({
                                                                                ...prev,
                                                                                [breed.id]: {
                                                                                    ...(prev[breed.id] || {}),
                                                                                    [station.id]: cleaned,
                                                                                },
                                                                            }))

                                                                            // Try to parse and update if valid
                                                                            const minutes = parseDurationToMinutes(cleaned)
                                                                            if (minutes !== null && minutes >= 0) {
                                                                                handleStationTimeChange(breed.id, station.id, minutes.toString())
                                                                            }
                                                                        }}
                                                                        onFocus={(e) => {
                                                                            if (!cell.supported) return // Prevent focus when disabled
                                                                            setIsTypingDuration((prev) => ({
                                                                                ...prev,
                                                                                [breed.id]: {
                                                                                    ...(prev[breed.id] || {}),
                                                                                    [station.id]: true,
                                                                                },
                                                                            }))
                                                                            const currentValue = formatDurationFromMinutes(displayTime)
                                                                            setDurationInputValues((prev) => ({
                                                                                ...prev,
                                                                                [breed.id]: {
                                                                                    ...(prev[breed.id] || {}),
                                                                                    [station.id]: currentValue,
                                                                                },
                                                                            }))
                                                                            setTimeout(() => {
                                                                                e.target.select()
                                                                            }, 0)
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            if (!cell.supported) return // Prevent blur handling when disabled
                                                                            setIsTypingDuration((prev) => {
                                                                                const newState = { ...prev }
                                                                                if (newState[breed.id]) {
                                                                                    newState[breed.id] = { ...newState[breed.id] }
                                                                                    delete newState[breed.id][station.id]
                                                                                }
                                                                                return newState
                                                                            })
                                                                            const value = e.target.value
                                                                            const minutes = parseDurationToMinutes(value)
                                                                            const finalMinutes = minutes !== null && minutes >= 0 ? minutes : displayTime
                                                                            const formatted = formatDurationFromMinutes(finalMinutes)

                                                                            setDurationInputValues((prev) => ({
                                                                                ...prev,
                                                                                [breed.id]: {
                                                                                    ...(prev[breed.id] || {}),
                                                                                    [station.id]: formatted,
                                                                                },
                                                                            }))

                                                                            if (finalMinutes !== displayTime) {
                                                                                handleStationTimeChange(breed.id, station.id, finalMinutes.toString())
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (!cell.supported) return // Prevent key handling when disabled
                                                                            if (e.key === "Enter") {
                                                                                e.preventDefault()
                                                                                const value = e.target.value
                                                                                const minutes = parseDurationToMinutes(value)
                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : displayTime
                                                                                handleStationTimeChange(breed.id, station.id, finalMinutes.toString())
                                                                                e.target.blur()
                                                                            }
                                                                        }}
                                                                        className="w-20 h-8 text-xs text-center"
                                                                        dir="rtl"
                                                                        placeholder={cell.supported ? "1:30" : "-"}
                                                                        title={cell.supported ? "זמן ספציפי לעמדה זו (עוקף ברירת מחדל)" : "עמדה לא פעילה"}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => cell.supported && handleToggleRemoteBooking(breed.id, station.id)}
                                                                        disabled={!cell.supported}
                                                                        className={`flex items-center justify-center p-0.5 rounded transition-colors ${cell.supported
                                                                            ? (remoteBooking
                                                                                ? 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'
                                                                                : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50')
                                                                            : 'text-gray-200 cursor-not-allowed'
                                                                            } ${cell.supported ? 'cursor-pointer' : ''}`}
                                                                        title={
                                                                            !cell.supported
                                                                                ? "עמדה לא פעילה - הפעל עמדה כדי לאפשר תור מרחוק"
                                                                                : (remoteBooking ? "לחץ כדי לכבות תור מרחוק" : "לחץ כדי לאפשר תור מרחוק")
                                                                        }
                                                                    >
                                                                        <Globe className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => cell.supported && handleToggleApproval(breed.id, station.id)}
                                                                        disabled={!cell.supported}
                                                                        className={`flex items-center justify-center p-0.5 rounded transition-colors ${cell.supported
                                                                            ? (approvalNeeded
                                                                                ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-50'
                                                                                : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50')
                                                                            : 'text-gray-200 cursor-not-allowed'
                                                                            } ${cell.supported ? 'cursor-pointer' : ''}`}
                                                                        title={
                                                                            !cell.supported
                                                                                ? "עמדה לא פעילה - הפעל עמדה כדי לדרוש אישור"
                                                                                : (approvalNeeded ? "לחץ כדי להסיר דרישת אישור" : "לחץ כדי לדרוש אישור צוות")
                                                                        }
                                                                    >
                                                                        <ShieldCheck className="h-4 w-4" strokeWidth={2.5} />
                                                                    </button>
                                                                    <Checkbox
                                                                        checked={cell.supported}
                                                                        onCheckedChange={() => handleToggleSupport(breed.id, station.id)}
                                                                        className="scale-125"
                                                                    />
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>,
                                                <tr
                                                    key={`${breed.id}-details`}
                                                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                                >
                                                    <td colSpan={visibleStations.length + 1} className="px-4 align-middle [&:has([role=checkbox])]:pr-0 bg-gray-50 p-0">
                                                        <Collapsible open={isExpanded}>
                                                            <CollapsibleContent>
                                                                <div className="p-4 border-t-2 border-primary/20" dir="rtl">
                                                                    <div className="flex items-center justify-between mb-4">
                                                                        <h3 className="text-sm font-semibold text-gray-900">מחירים והערות עבור {breed.name}</h3>
                                                                        {hasPriceChanges && (
                                                                            <div className="flex items-center gap-2">
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={() => handleCancelBreedPrices(breed.id)}
                                                                                    disabled={savingBreedId === breed.id}
                                                                                    className="h-8 text-xs"
                                                                                >
                                                                                    <X className="h-3 w-3 ml-1" />
                                                                                    ביטול
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={() => handleSaveBreedPrices(breed.id)}
                                                                                    disabled={savingBreedId === breed.id}
                                                                                    className="h-8 text-xs"
                                                                                >
                                                                                    {savingBreedId === breed.id ? (
                                                                                        <>
                                                                                            <Loader2 className="h-3 w-3 animate-spin ml-1" />
                                                                                            שומר...
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Save className="h-3 w-3 ml-1" />
                                                                                            שמור שינויים
                                                                                        </>
                                                                                    )}
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor={`size-${breed.id}`} className="text-xs text-gray-600">
                                                                                גודל:
                                                                            </Label>
                                                                            <Select
                                                                                value={editedPrices.size_class || "__none__"}
                                                                                onValueChange={(value) => handlePriceChange(breed.id, 'size_class', value)}
                                                                            >
                                                                                <SelectTrigger className="h-8" dir="rtl">
                                                                                    <SelectValue placeholder="-" />
                                                                                </SelectTrigger>
                                                                                <SelectContent dir="rtl">
                                                                                    <SelectItem value="__none__">-</SelectItem>
                                                                                    <SelectItem value="small">קטן</SelectItem>
                                                                                    <SelectItem value="medium">בינוני</SelectItem>
                                                                                    <SelectItem value="medium_large">בינוני-גדול</SelectItem>
                                                                                    <SelectItem value="large">גדול</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mb-4">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs text-gray-600">קטגוריה</Label>
                                                                            <MultiSelectDropdown
                                                                                options={dogCategories.map(category => ({ id: category.id, name: category.name }))}
                                                                                selectedIds={getBreedCategories(breed.id)}
                                                                                onSelectionChange={(selectedIds) => handleCategoriesChange(breed.id, selectedIds)}
                                                                                placeholder="בחר קטגוריות..."
                                                                                className="w-full"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor={`min-price-${breed.id}`} className="text-xs text-gray-600">
                                                                                מחיר מינימום טיפוח:
                                                                            </Label>
                                                                            <Input
                                                                                id={`min-price-${breed.id}`}
                                                                                type="number"
                                                                                step="1"
                                                                                value={editedPrices.min_groom_price ?? ""}
                                                                                onChange={(e) => handlePriceChange(breed.id, 'min_groom_price', e.target.value)}
                                                                                placeholder="-"
                                                                                className="h-8"
                                                                                dir="rtl"
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor={`max-price-${breed.id}`} className="text-xs text-gray-600">
                                                                                מחיר מקסימום טיפוח:
                                                                            </Label>
                                                                            <Input
                                                                                id={`max-price-${breed.id}`}
                                                                                type="number"
                                                                                step="1"
                                                                                value={editedPrices.max_groom_price ?? ""}
                                                                                onChange={(e) => handlePriceChange(breed.id, 'max_groom_price', e.target.value)}
                                                                                placeholder="-"
                                                                                className="h-8"
                                                                                dir="rtl"
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor={`hourly-price-${breed.id}`} className="text-xs text-gray-600">
                                                                                מחיר שעתי:
                                                                            </Label>
                                                                            <Input
                                                                                id={`hourly-price-${breed.id}`}
                                                                                type="number"
                                                                                step="1"
                                                                                value={editedPrices.hourly_price ?? ""}
                                                                                onChange={(e) => handlePriceChange(breed.id, 'hourly_price', e.target.value)}
                                                                                placeholder="-"
                                                                                className="h-8"
                                                                                dir="rtl"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label htmlFor={`notes-${breed.id}`} className="text-xs text-gray-600">
                                                                            הערות:
                                                                        </Label>
                                                                        <Textarea
                                                                            id={`notes-${breed.id}`}
                                                                            value={editedPrices.notes || ""}
                                                                            onChange={(e) => handleNotesChange(breed.id, e.target.value)}
                                                                            placeholder="הכנס הערות לגזע זה..."
                                                                            className="min-h-[80px]"
                                                                            dir="rtl"
                                                                        />
                                                                    </div>

                                                                </div>
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                    </td>
                                                </tr>,
                                            ]
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pagination - Bottom */}
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                    {/* Breed Pagination */}
                    {filteredBreeds.length > BREEDS_PER_PAGE && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                            <button
                                type="button"
                                onClick={handlePreviousBreedPage}
                                disabled={!canGoPreviousBreed}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="גזע קודם"
                            >
                                <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="text-xs">
                                {breedPage * BREEDS_PER_PAGE + 1}-{Math.min((breedPage + 1) * BREEDS_PER_PAGE, filteredBreeds.length)} מתוך {filteredBreeds.length}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextBreedPage}
                                disabled={!canGoNextBreed}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="גזע הבא"
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                    {/* Station Pagination */}
                    {!selectedColumnFilter && selectedStationIds.length > STATIONS_PER_VIEW && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 mr-4">
                            <button
                                type="button"
                                onClick={handlePreviousStationPage}
                                disabled={!canGoPreviousStation}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="עמדה קודמת"
                            >
                                <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="text-xs">
                                עמדות {stationPage + 1}-{Math.min(stationPage + STATIONS_PER_VIEW, selectedStationIds.length)} מתוך {selectedStationIds.length}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextStationPage}
                                disabled={!canGoNextStation}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="עמדה הבאה"
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Dialogs */}
            <DuplicateStationDialog
                open={isDuplicateConfirmOpen}
                onOpenChange={setIsDuplicateConfirmOpen}
                station={stationToDuplicate}
                stations={allStations}
                onConfirm={confirmDuplicateStation}
                isDuplicating={isAddingStation}
            />

            <DuplicateBreedDialog
                open={isDuplicateBreedDialogOpen}
                onOpenChange={setIsDuplicateBreedDialogOpen}
                breed={breedToDuplicate}
                breeds={breeds}
                onConfirm={confirmDuplicateBreed}
                isDuplicating={isDuplicatingBreed}
            />

            {/* Delete Breed Dialog */}
            <DeleteBreedDialog
                open={isDeleteBreedDialogOpen}
                onOpenChange={setIsDeleteBreedDialogOpen}
                breed={breedToDelete}
                onConfirm={confirmDeleteBreed}
                isDeleting={isDeletingBreed}
            />

            <DeleteStationDialog
                deleteConfirmOpen={isDeleteConfirmOpen}
                onDeleteConfirmChange={setIsDeleteConfirmOpen}
                transferDialogOpen={isTransferDialogOpen}
                onTransferDialogChange={setIsTransferDialogOpen}
                station={stationToDelete}
                stations={allStations}
                onConfirmDelete={confirmDeleteStation}
                onTransferAndDelete={handleTransferAndDelete}
            />
        </div>
    )
}

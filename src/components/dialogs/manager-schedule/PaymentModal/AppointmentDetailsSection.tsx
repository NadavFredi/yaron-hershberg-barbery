import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Info, Loader2, CheckCircle2, X, History } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import type { BreedPriceRange } from "./types"

interface AppointmentDetailsSectionProps {
    appointment: ManagerAppointment | null
    appointmentPrice: string
    isLoadingBreedPrices: boolean
    breedPriceInfo: BreedPriceRange | null
    isPriceDirty: boolean
    isSavingPrice: boolean
    priceSaved: boolean
    onPriceChange: (price: string) => void
    onCancelPriceChange: () => void
    onSavePrice: () => void
    onShowPreviousPayments: () => void
}

export const AppointmentDetailsSection: React.FC<AppointmentDetailsSectionProps> = ({
    appointment,
    appointmentPrice,
    isLoadingBreedPrices,
    breedPriceInfo,
    isPriceDirty,
    isSavingPrice,
    priceSaved,
    onPriceChange,
    onCancelPriceChange,
    onSavePrice,
    onShowPreviousPayments,
}) => {
    const navigate = useNavigate()

    const handleBreedClick = () => {
        // Navigate to settings breeds page with search parameter (like in sheets)
        if (breedPriceInfo?.breedName) {
            navigate(`/settings?mode=breeds&search=${encodeURIComponent(breedPriceInfo.breedName)}`)
        }
    }
    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 relative">
            {/* Loading Overlay */}
            {isLoadingBreedPrices && (
                <div className="absolute inset-0 bg-blue-50/80 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                </div>
            )}

            {/* Appointment Time and Duration Info - Compact */}
            {appointment?.startDateTime && appointment?.endDateTime && (
                <div className="flex items-center gap-3 text-xs text-gray-600 pb-2 border-b border-blue-200">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    <span className="text-gray-500">פרטי התור:</span>
                    <span className="font-medium text-gray-700">
                        {new Date(appointment.startDateTime).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        })}
                    </span>
                    <span className="text-gray-400">-</span>
                    <span className="font-medium text-gray-700">
                        {new Date(appointment.endDateTime).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        })}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="font-medium text-gray-700">
                        {(() => {
                            const start = new Date(appointment.startDateTime)
                            const end = new Date(appointment.endDateTime)
                            const durationMs = end.getTime() - start.getTime()
                            const totalMinutes = Math.floor(durationMs / (1000 * 60))
                            const hours = Math.floor(totalMinutes / 60)
                            const minutes = totalMinutes % 60
                            if (hours > 0 && minutes > 0) {
                                return `${hours} שעות ו-${minutes} דקות`
                            } else if (hours > 0) {
                                return `${hours} שעות`
                            } else {
                                return `${minutes} דקות`
                            }
                        })()}
                    </span>
                </div>
            )}

            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-gray-700 text-right flex-1">מחיר התור</Label>
                    {appointment?.clientId && appointment?.dogs && appointment.dogs.length > 0 && appointment.dogs[0].id && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900"
                            onClick={onShowPreviousPayments}
                        >
                            <History className="h-3 w-3 ml-1" />
                            תשלומים קודמים
                        </Button>
                    )}
                </div>
                <div className="relative">
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">₪</span>

                    {/* Action buttons inside input - appears when price is modified */}
                    {isPriceDirty && !isSavingPrice && (
                        <div className="absolute left-1 top-1/2 transform -translate-y-1/2 flex gap-1 z-10">
                            {/* Cancel button (X icon) */}
                            <button
                                type="button"
                                onClick={onCancelPriceChange}
                                className="text-red-600 hover:text-red-700"
                                title="ביטול שינוי"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            {/* Save button (checkmark) */}
                            <button
                                type="button"
                                onClick={onSavePrice}
                                className="text-green-600 hover:text-green-700"
                                title="שמירה"
                            >
                                <CheckCircle2 className="h-5 w-5" />
                            </button>
                        </div>
                    )}

                    {/* Loading indicator inside input */}
                    {isSavingPrice && (
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600 z-10">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    )}

                    {/* Success checkmark inside input */}
                    {priceSaved && (
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 z-10">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    )}

                    <Input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        value={appointmentPrice}
                        onChange={(e) => {
                            const value = e.target.value
                            // Allow numbers and decimal point
                            // Remove any characters that aren't digits or decimal point
                            let numericValue = value.replace(/[^0-9.]/g, '')
                            
                            // Ensure only one decimal point
                            const parts = numericValue.split('.')
                            if (parts.length > 2) {
                                // If more than one decimal point, keep only the first one
                                numericValue = parts[0] + '.' + parts.slice(1).join('')
                            }

                            // If result is empty, set to 0
                            if (numericValue === '' || numericValue === '.') {
                                onPriceChange('0')
                            } else if (appointmentPrice === '0' && numericValue !== '0' && !numericValue.startsWith('0.')) {
                                // If field shows "0" and user types a digit (not 0.), remove the 0 prefix
                                const newValue = numericValue.replace(/^0+/, '')
                                onPriceChange(newValue === '' || newValue === '.' ? '0' : newValue)
                            } else {
                                onPriceChange(numericValue)
                            }
                        }}
                        onKeyDown={(e) => {
                            // Save price when Enter is pressed and price is dirty
                            if (e.key === 'Enter' && isPriceDirty && !isSavingPrice) {
                                e.preventDefault()
                                onSavePrice()
                            }
                        }}
                        onFocus={(e) => {
                            // When user focuses on the input, if it's "0", select all for easy replacement
                            if (appointmentPrice === '0') {
                                e.target.select()
                            }
                        }}
                        className={`text-right text-xl font-bold text-blue-900 pr-8 h-10 ${(isPriceDirty || isSavingPrice || priceSaved) ? 'pl-16' : ''
                            }`}
                        dir="rtl"
                        disabled={isSavingPrice}
                    />
                </div>
            </div>

            {/* Breed Price Range Info - only show for grooming */}
            {appointment?.serviceType === 'grooming' && breedPriceInfo && !isLoadingBreedPrices && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                    <div className="flex items-center flex-wrap gap-1.5 text-xs text-gray-600">
                        <Info className="h-3 w-3 flex-shrink-0" />
                        <span>מידע מחירים לגזע:</span>
                        {breedPriceInfo.breedName && (
                            <button
                                onClick={handleBreedClick}
                                className="font-semibold text-blue-700 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                                title="לחץ כדי לראות פרטי הגזע"
                            >
                                {breedPriceInfo.breedName}
                            </button>
                        )}
                        {breedPriceInfo.minPrice && (
                            <>
                                <span className="text-gray-300 mx-0.5">•</span>
                                <span className="text-gray-600">
                                    מינ': <span className="font-semibold text-green-700">₪{breedPriceInfo.minPrice}</span>
                                </span>
                            </>
                        )}
                        {breedPriceInfo.maxPrice && (
                            <>
                                <span className="text-gray-300 mx-0.5">•</span>
                                <span className="text-gray-600">
                                    מקס': <span className="font-semibold text-green-700">₪{breedPriceInfo.maxPrice}</span>
                                </span>
                            </>
                        )}
                        {breedPriceInfo.hourlyPrice && (
                            <>
                                <span className="text-gray-300 mx-0.5">•</span>
                                <span className="text-gray-600">
                                    שעתי: <span className="font-semibold text-blue-700">₪{breedPriceInfo.hourlyPrice}</span>
                                </span>
                            </>
                        )}
                    </div>
                    {breedPriceInfo.notes && (
                        <div className="mt-1 pt-1 border-t border-blue-200/50">
                            <div className="text-xs text-gray-600">
                                <span className="text-gray-500">הערות:</span> <span className="text-gray-700">{breedPriceInfo.notes}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}





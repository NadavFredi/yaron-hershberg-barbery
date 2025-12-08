import React from 'react'

interface TotalSummarySectionProps {
    appointmentPrice: string
    productsTotal: number
}

export const TotalSummarySection: React.FC<TotalSummarySectionProps> = ({
    appointmentPrice,
    productsTotal,
}) => {
    const appointmentPriceValue = parseFloat(appointmentPrice) || 0
    const grandTotal = appointmentPriceValue + productsTotal

    return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-center gap-2 flex-wrap">
                {/* Appointment Price */}
                <div className="flex flex-col items-center min-w-[100px]">
                    <div className="text-2xl font-bold text-blue-900">₪{appointmentPriceValue.toFixed(2)}</div>
                    <div className="text-xs text-gray-600 mt-1">מחיר תור</div>
                </div>

                {/* Plus sign */}
                <div className="text-2xl font-bold text-gray-400">+</div>

                {/* Products and Garden Total */}
                <div className="flex flex-col items-center min-w-[100px]">
                    <div className="text-2xl font-bold text-green-700">₪{productsTotal.toFixed(2)}</div>
                    <div className="text-xs text-gray-600 mt-1">מוצרים וגן</div>
                </div>

                {/* Equals sign */}
                <div className="text-2xl font-bold text-gray-400">=</div>

                {/* Grand Total */}
                <div className="flex flex-col items-center min-w-[100px]">
                    <div className="text-3xl font-bold text-green-900">
                        ₪{grandTotal.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">סה״כ לתשלום</div>
                </div>
            </div>
        </div>
    )
}



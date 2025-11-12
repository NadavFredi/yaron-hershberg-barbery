import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"

interface ClientDetails {
    name: string
    classification?: string
    customerTypeName?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
    preferences?: string
    recordId?: string
    recordNumber?: string
}

interface TreatmentDetails {
    id: string
    name: string
    treatmentType?: string
    clientClassification?: string
    owner?: ClientDetails
    age?: string
    weight?: string
    gender?: string
    notes?: string
    medicalNotes?: string
    importantNotes?: string
    internalNotes?: string
    vetName?: string
    vetPhone?: string
    healthIssues?: string
    birthDate?: string
    tendsToBite?: string
    aggressiveWithOtherTreatments?: string
    hasBeenToGarden?: boolean
    suitableForGardenFromQuestionnaire?: boolean
    notSuitableForGardenFromQuestionnaire?: boolean
    recordId?: string
    recordNumber?: string
}

// Helper function to format birth date and calculate age
const formatBirthDateWithAge = (birthDateString?: string) => {
    if (!birthDateString) return null

    try {
        // Parse the date (assuming it comes in YYYY-MM-DD format from Airtable)
        const birthDate = new Date(birthDateString)
        if (isNaN(birthDate.getTime())) return null

        // Format as DD/MM/YYYY
        const day = birthDate.getDate().toString().padStart(2, '0')
        const month = (birthDate.getMonth() + 1).toString().padStart(2, '0')
        const year = birthDate.getFullYear()
        const formattedDate = `${day}/${month}/${year}`

        // Calculate age in years and months
        const today = new Date()
        let years = today.getFullYear() - birthDate.getFullYear()
        let months = today.getMonth() - birthDate.getMonth()

        if (today.getDate() < birthDate.getDate()) {
            months--
        }

        if (months < 0) {
            years--
            months += 12
        }

        // Format age string
        let ageString = ''
        if (years > 0) {
            ageString += `${years} שנים`
        }
        if (months > 0) {
            if (ageString) ageString += ' '
            ageString += `${months} חודשים`
        }

        // If less than a month old
        if (years === 0 && months === 0) {
            ageString = 'פחות מחודש'
        }

        return `${formattedDate} (${ageString})`
    } catch (error) {
        console.error('Error formatting birth date:', error)
        return null
    }
}

interface TreatmentDetailsSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedTreatment: TreatmentDetails | null
    showAllPastAppointments: boolean
    setShowAllPastAppointments: (show: boolean) => void
    data?: { appointments?: any[] }
    onClientClick: (client: ClientDetails) => void
    onAppointmentClick: (appointment: any) => void
    onShowTreatmentAppointments: (treatmentId: string, treatmentName: string) => void
}

export const TreatmentDetailsSheet = ({
    open,
    onOpenChange,
    selectedTreatment,
    showAllPastAppointments: _showAllPastAppointments,
    setShowAllPastAppointments: _setShowAllPastAppointments,
    data: _data,
    onClientClick,
    onAppointmentClick: _onAppointmentClick,
    onShowTreatmentAppointments,
}: TreatmentDetailsSheetProps) => {

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full max-w-md overflow-y-auto" dir="rtl">
                <SheetHeader>
                    <SheetTitle className="text-right">פרטי לקוח</SheetTitle>
                    <SheetDescription className="text-right">צפו בכל הפרטים על הלקוח.</SheetDescription>
                </SheetHeader>

                {selectedTreatment ? (
                    <div className="mt-6 space-y-6 text-right">
                        <div className="space-y-3">
                            <div className="space-y-2 text-sm text-gray-600">
                                <div>
                                    שם הלקוח: <span className="font-medium text-gray-900">{selectedTreatment.name}</span>
                                </div>
                                {selectedTreatment.treatmentType && (
                                    <div>
                                        גזע: <span className="font-medium text-gray-900">{selectedTreatment.treatmentType}</span>
                                    </div>
                                )}
                                <div>
                                    סיווג: <span className="font-medium text-gray-900">{selectedTreatment.clientClassification || 'לא ידוע'}</span>
                                </div>
                                {selectedTreatment.owner && (
                                    <div>
                                        בעלים: <button
                                            type="button"
                                            onClick={() => onClientClick(selectedTreatment.owner!)}
                                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                        >
                                            {selectedTreatment.owner.name}
                                        </button>
                                    </div>
                                )}
                                {selectedTreatment.owner?.customerTypeName && (
                                    <div>
                                        סוג לקוח: <span className="font-medium text-gray-900">{selectedTreatment.owner.customerTypeName}</span>
                                    </div>
                                )}
                                {selectedTreatment.age && (
                                    <div>
                                        גיל: <span className="font-medium text-gray-900">{selectedTreatment.age}</span>
                                    </div>
                                )}
                                {selectedTreatment.weight && (
                                    <div>
                                        משקל: <span className="font-medium text-gray-900">{selectedTreatment.weight} ק"ג</span>
                                    </div>
                                )}
                                {selectedTreatment.gender && (
                                    <div>
                                        מין: <span className="font-medium text-gray-900">{selectedTreatment.gender}</span>
                                    </div>
                                )}
                                <div>
                                    תאריך לידה: <span className="font-medium text-gray-900">{selectedTreatment.birthDate ? formatBirthDateWithAge(selectedTreatment.birthDate) : ''}</span>
                                </div>
                            </div>
                        </div>

                        {/* Health and Medical Information */}
                        {(selectedTreatment.healthIssues || selectedTreatment.vetName || selectedTreatment.vetPhone) && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-red-900">מידע רפואי</h3>
                                    {selectedTreatment.healthIssues && (
                                        <div>
                                            <h4 className="text-xs font-medium text-red-800 mb-1">בעיות בריאות/אלרגיות:</h4>
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                <p className="whitespace-pre-wrap text-sm text-red-800">{selectedTreatment.healthIssues}</p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedTreatment.vetName && (
                                        <div>
                                            <span className="text-sm text-gray-600">שם הוטרינר: </span>
                                            <span className="font-medium text-gray-900">{selectedTreatment.vetName}</span>
                                        </div>
                                    )}
                                    {selectedTreatment.vetPhone && (
                                        <div>
                                            <span className="text-sm text-gray-600">טלפון של הוטרינר: </span>
                                            <span className="font-medium text-gray-900">{selectedTreatment.vetPhone}</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Behavioral Information */}
                        {(selectedTreatment.tendsToBite || selectedTreatment.aggressiveWithOtherTreatments) && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-purple-900">מידע התנהגותי</h3>
                                    {selectedTreatment.tendsToBite && (
                                        <div>
                                            <h4 className="text-xs font-medium text-purple-800 mb-1">האם הלקוח נוטה להילחץ או להירתע ממגע במסגרת חדשה:</h4>
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                <p className="text-sm text-purple-800">{selectedTreatment.tendsToBite}</p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedTreatment.aggressiveWithOtherTreatments && (
                                        <div>
                                            <h4 className="text-xs font-medium text-purple-800 mb-1">האם הלקוח עלול להפגין התנהגות מאתגרת בסביבה חברתית:</h4>
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                <p className="text-sm text-purple-800">{selectedTreatment.aggressiveWithOtherTreatments}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Garden Information */}
                        {(selectedTreatment.hasBeenToGarden !== undefined || selectedTreatment.suitableForGardenFromQuestionnaire !== undefined || selectedTreatment.notSuitableForGardenFromQuestionnaire !== undefined) && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-green-900">מידע גן</h3>
                                    {selectedTreatment.hasBeenToGarden !== undefined && (
                                        <div>
                                            <span className="text-sm text-gray-600">האם הלקוח היה במספרה: </span>
                                            <span className={`font-medium ${selectedTreatment.hasBeenToGarden ? 'text-green-800' : 'text-gray-600'}`}>
                                                {selectedTreatment.hasBeenToGarden ? 'כן' : 'לא'}
                                            </span>
                                        </div>
                                    )}
                                    {selectedTreatment.suitableForGardenFromQuestionnaire !== undefined && (
                                        <div>
                                            <span className="text-sm text-gray-600">האם נמצא מתאים לגן מהשאלון: </span>
                                            <span className={`font-medium ${selectedTreatment.suitableForGardenFromQuestionnaire ? 'text-green-800' : 'text-gray-600'}`}>
                                                {selectedTreatment.suitableForGardenFromQuestionnaire ? 'כן' : 'לא'}
                                            </span>
                                        </div>
                                    )}
                                    {selectedTreatment.notSuitableForGardenFromQuestionnaire !== undefined && (
                                        <div>
                                            <span className="text-sm text-gray-600">האם נמצא לא מתאים לגן מהשאלון: </span>
                                            <span className={`font-medium ${selectedTreatment.notSuitableForGardenFromQuestionnaire ? 'text-red-800' : 'text-gray-600'}`}>
                                                {selectedTreatment.notSuitableForGardenFromQuestionnaire ? 'כן' : 'לא'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Important Notes */}
                        {selectedTreatment.importantNotes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-orange-900">משהו נוסף שחשוב שנדע</h3>
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                        <p className="whitespace-pre-wrap text-sm text-orange-800">{selectedTreatment.importantNotes}</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Internal Notes */}
                        {selectedTreatment.internalNotes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-blue-900">הערות פנימי</h3>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="whitespace-pre-wrap text-sm text-blue-800">{selectedTreatment.internalNotes}</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedTreatment.notes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-900">הערות</h3>
                                    <p className="whitespace-pre-wrap text-sm text-gray-600">{selectedTreatment.notes}</p>
                                </div>
                            </>
                        )}

                        {selectedTreatment.medicalNotes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-red-900">הערות רפואיות</h3>
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="whitespace-pre-wrap text-sm text-red-800">{selectedTreatment.medicalNotes}</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Record Information */}
                        {(selectedTreatment.recordId || selectedTreatment.recordNumber) && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-900">פרטי רשומה</h3>
                                    <div className="text-xs text-gray-500 space-y-1">
                                        {selectedTreatment.recordId && (
                                            <div>מזהה רשומה: <span className="font-mono text-gray-700">{selectedTreatment.recordId}</span></div>
                                        )}
                                        {selectedTreatment.recordNumber && (
                                            <div>מספר רשומה: <span className="font-mono text-gray-700">{selectedTreatment.recordNumber}</span></div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        <Separator />
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-gray-900">תורים</h3>
                            <Button
                                variant="outline"
                                className="w-full justify-center gap-2"
                                onClick={() => selectedTreatment && onShowTreatmentAppointments(selectedTreatment.id, selectedTreatment.name)}
                            >
                                <Calendar className="h-4 w-4" />
                                הצג תורים של {selectedTreatment.name}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center text-sm text-gray-500">לא נבחר לקוח</div>
                )}
            </SheetContent>
        </Sheet>
    )
}

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

interface DogDetails {
    id: string
    name: string
    breed?: string
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
    aggressiveWithOtherDogs?: string
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

interface DogDetailsSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedDog: DogDetails | null
    showAllPastAppointments: boolean
    setShowAllPastAppointments: (show: boolean) => void
    data?: { appointments?: any[] }
    onClientClick: (client: ClientDetails) => void
    onAppointmentClick: (appointment: any) => void
    onShowDogAppointments: (dogId: string, dogName: string) => void
}

export const DogDetailsSheet = ({
    open,
    onOpenChange,
    selectedDog,
    showAllPastAppointments: _showAllPastAppointments,
    setShowAllPastAppointments: _setShowAllPastAppointments,
    data: _data,
    onClientClick,
    onAppointmentClick: _onAppointmentClick,
    onShowDogAppointments,
}: DogDetailsSheetProps) => {

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full max-w-md overflow-y-auto" dir="rtl">
                <SheetHeader>
                    <SheetTitle className="text-right">פרטי כלב</SheetTitle>
                    <SheetDescription className="text-right">צפו בכל הפרטים על הכלב.</SheetDescription>
                </SheetHeader>

                {selectedDog ? (
                    <div className="mt-6 space-y-6 text-right">
                        <div className="space-y-3">
                            <div className="space-y-2 text-sm text-gray-600">
                                <div>
                                    שם הכלב: <span className="font-medium text-gray-900">{selectedDog.name}</span>
                                </div>
                                {selectedDog.breed && (
                                    <div>
                                        גזע: <span className="font-medium text-gray-900">{selectedDog.breed}</span>
                                    </div>
                                )}
                                <div>
                                    סיווג: <span className="font-medium text-gray-900">{selectedDog.clientClassification || 'לא ידוע'}</span>
                                </div>
                                {selectedDog.owner && (
                                    <div>
                                        בעלים: <button
                                            type="button"
                                            onClick={() => onClientClick(selectedDog.owner!)}
                                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                        >
                                            {selectedDog.owner.name}
                                        </button>
                                    </div>
                                )}
                                {selectedDog.owner?.customerTypeName && (
                                    <div>
                                        סוג לקוח: <span className="font-medium text-gray-900">{selectedDog.owner.customerTypeName}</span>
                                    </div>
                                )}
                                {selectedDog.age && (
                                    <div>
                                        גיל: <span className="font-medium text-gray-900">{selectedDog.age}</span>
                                    </div>
                                )}
                                {selectedDog.weight && (
                                    <div>
                                        משקל: <span className="font-medium text-gray-900">{selectedDog.weight} ק"ג</span>
                                    </div>
                                )}
                                {selectedDog.gender && (
                                    <div>
                                        מין: <span className="font-medium text-gray-900">{selectedDog.gender}</span>
                                    </div>
                                )}
                                <div>
                                    תאריך לידה: <span className="font-medium text-gray-900">{selectedDog.birthDate ? formatBirthDateWithAge(selectedDog.birthDate) : ''}</span>
                                </div>
                            </div>
                        </div>

                        {/* Health and Medical Information */}
                        {(selectedDog.healthIssues || selectedDog.vetName || selectedDog.vetPhone) && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-red-900">מידע רפואי</h3>
                                    {selectedDog.healthIssues && (
                                        <div>
                                            <h4 className="text-xs font-medium text-red-800 mb-1">בעיות בריאות/אלרגיות:</h4>
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                <p className="whitespace-pre-wrap text-sm text-red-800">{selectedDog.healthIssues}</p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedDog.vetName && (
                                        <div>
                                            <span className="text-sm text-gray-600">שם הוטרינר: </span>
                                            <span className="font-medium text-gray-900">{selectedDog.vetName}</span>
                                        </div>
                                    )}
                                    {selectedDog.vetPhone && (
                                        <div>
                                            <span className="text-sm text-gray-600">טלפון של הוטרינר: </span>
                                            <span className="font-medium text-gray-900">{selectedDog.vetPhone}</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Behavioral Information */}
                        {(selectedDog.tendsToBite || selectedDog.aggressiveWithOtherDogs) && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-purple-900">מידע התנהגותי</h3>
                                    {selectedDog.tendsToBite && (
                                        <div>
                                            <h4 className="text-xs font-medium text-purple-800 mb-1">האם הכלב נוטה לנשוך אנשים או להיבהל ממגע במסגרת חדשה:</h4>
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                <p className="text-sm text-purple-800">{selectedDog.tendsToBite}</p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedDog.aggressiveWithOtherDogs && (
                                        <div>
                                            <h4 className="text-xs font-medium text-purple-800 mb-1">האם הכלב עלול להפגין תוקפנות כלפי כלבים אחרים:</h4>
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                <p className="text-sm text-purple-800">{selectedDog.aggressiveWithOtherDogs}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Garden Information */}
                        {(selectedDog.hasBeenToGarden !== undefined || selectedDog.suitableForGardenFromQuestionnaire !== undefined || selectedDog.notSuitableForGardenFromQuestionnaire !== undefined) && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-green-900">מידע גן</h3>
                                    {selectedDog.hasBeenToGarden !== undefined && (
                                        <div>
                                            <span className="text-sm text-gray-600">האם הכלב היה בגן: </span>
                                            <span className={`font-medium ${selectedDog.hasBeenToGarden ? 'text-green-800' : 'text-gray-600'}`}>
                                                {selectedDog.hasBeenToGarden ? 'כן' : 'לא'}
                                            </span>
                                        </div>
                                    )}
                                    {selectedDog.suitableForGardenFromQuestionnaire !== undefined && (
                                        <div>
                                            <span className="text-sm text-gray-600">האם נמצא מתאים לגן מהשאלון: </span>
                                            <span className={`font-medium ${selectedDog.suitableForGardenFromQuestionnaire ? 'text-green-800' : 'text-gray-600'}`}>
                                                {selectedDog.suitableForGardenFromQuestionnaire ? 'כן' : 'לא'}
                                            </span>
                                        </div>
                                    )}
                                    {selectedDog.notSuitableForGardenFromQuestionnaire !== undefined && (
                                        <div>
                                            <span className="text-sm text-gray-600">האם נמצא לא מתאים לגן מהשאלון: </span>
                                            <span className={`font-medium ${selectedDog.notSuitableForGardenFromQuestionnaire ? 'text-red-800' : 'text-gray-600'}`}>
                                                {selectedDog.notSuitableForGardenFromQuestionnaire ? 'כן' : 'לא'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Important Notes */}
                        {selectedDog.importantNotes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-orange-900">משהו נוסף שחשוב שנדע</h3>
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                        <p className="whitespace-pre-wrap text-sm text-orange-800">{selectedDog.importantNotes}</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Internal Notes */}
                        {selectedDog.internalNotes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-blue-900">הערות פנימי</h3>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="whitespace-pre-wrap text-sm text-blue-800">{selectedDog.internalNotes}</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedDog.notes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-900">הערות</h3>
                                    <p className="whitespace-pre-wrap text-sm text-gray-600">{selectedDog.notes}</p>
                                </div>
                            </>
                        )}

                        {selectedDog.medicalNotes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-red-900">הערות רפואיות</h3>
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="whitespace-pre-wrap text-sm text-red-800">{selectedDog.medicalNotes}</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Record Information */}
                        {(selectedDog.recordId || selectedDog.recordNumber) && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-900">פרטי רשומה</h3>
                                    <div className="text-xs text-gray-500 space-y-1">
                                        {selectedDog.recordId && (
                                            <div>מזהה רשומה: <span className="font-mono text-gray-700">{selectedDog.recordId}</span></div>
                                        )}
                                        {selectedDog.recordNumber && (
                                            <div>מספר רשומה: <span className="font-mono text-gray-700">{selectedDog.recordNumber}</span></div>
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
                                onClick={() => selectedDog && onShowDogAppointments(selectedDog.id, selectedDog.name)}
                            >
                                <Calendar className="h-4 w-4" />
                                הצג תורים של {selectedDog.name}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center text-sm text-gray-500">לא נבחר כלב</div>
                )}
            </SheetContent>
        </Sheet>
    )
}

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import type { ManagerAppointment, ManagerDog } from "@/types/managerSchedule"

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

interface ClientDetailsSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedClient: ClientDetails | null
    data?: { appointments?: ManagerAppointment[] }
    onDogClick: (dog: ManagerDog) => void
}

export const ClientDetailsSheet = ({
    open,
    onOpenChange,
    selectedClient,
    data,
    onDogClick,
}: ClientDetailsSheetProps) => {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full max-w-md overflow-y-auto" dir="rtl">
                <SheetHeader>
                    <SheetTitle className="text-right">פרטי לקוח</SheetTitle>
                    <SheetDescription className="text-right">צפו בכל הפרטים על הלקוח.</SheetDescription>
                </SheetHeader>

                {selectedClient ? (
                    <div className="mt-6 space-y-6 text-right">
                        <div className="space-y-3">
                            <div className="space-y-2 text-sm text-gray-600">
                                <div>
                                    שם: <span className="font-medium text-gray-900">{selectedClient.name}</span>
                                </div>
                                <div>
                                    סיווג: <span className="font-medium text-gray-900">{selectedClient.classification || 'לא ידוע'}</span>
                                </div>
                                <div>
                                    סוג מותאם: <span className="font-medium text-gray-900">{selectedClient.customerTypeName || 'ללא סוג'}</span>
                                </div>
                                {selectedClient.phone && (
                                    <div>
                                        טלפון: <span className="font-medium text-gray-900">{selectedClient.phone}</span>
                                    </div>
                                )}
                                {selectedClient.email && (
                                    <div>
                                        דוא"ל: <span className="font-medium text-gray-900">{selectedClient.email}</span>
                                    </div>
                                )}
                                {selectedClient.address && (
                                    <div>
                                        כתובת: <span className="font-medium text-gray-900">{selectedClient.address}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedClient.notes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-900">הערות</h3>
                                    <p className="whitespace-pre-wrap text-sm text-gray-600">{selectedClient.notes}</p>
                                </div>
                            </>
                        )}

                        {selectedClient.preferences && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-900">העדפות</h3>
                                    <p className="whitespace-pre-wrap text-sm text-gray-600">{selectedClient.preferences}</p>
                                </div>
                            </>
                        )}

                        <Separator />
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-gray-900">כלבים</h3>
                            <div className="space-y-2">
                                {(() => {
                                    // Get all dogs belonging to this client from all appointments
                                    const clientDogs = new Map<string, ManagerDog>()
                                    data?.appointments?.forEach(appointment => {
                                        appointment.dogs.forEach(dog => {
                                            // Check multiple possible client name matches
                                            const appointmentClientName = appointment.clientName ?? appointment.dogs[0]?.clientName
                                            const dogClientName = dog.clientName
                                            const isMatch = dogClientName === selectedClient.name ||
                                                appointmentClientName === selectedClient.name ||
                                                (appointmentClientName && appointmentClientName === dogClientName && dogClientName === selectedClient.name)

                                            if (isMatch && !clientDogs.has(dog.id)) {
                                                clientDogs.set(dog.id, dog)
                                            }
                                        })
                                    })

                                    const dogs = Array.from(clientDogs.values())

                                    if (dogs.length === 0) {
                                        return (
                                            <div className="text-center text-sm text-gray-500 py-4">
                                                אין כלבים עבור לקוח זה
                                            </div>
                                        )
                                    }

                                    return dogs.map((dog) => (
                                        <div
                                            key={dog.id}
                                            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                                        >
                                            <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                                                <button
                                                    type="button"
                                                    onClick={() => onDogClick(dog)}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                                >
                                                    {dog.name}
                                                </button>
                                                {dog.breed ? <span className="text-xs text-gray-600">{dog.breed}</span> : null}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-600">
                                                סיווג: <span className="font-medium text-gray-700">{dog.clientClassification || 'לא ידוע'}</span>
                                            </div>
                                        </div>
                                    ))
                                })()}
                            </div>
                        </div>

                        {/* Record Information */}
                        {(selectedClient.recordId || selectedClient.recordNumber) && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-900">פרטי רשומה</h3>
                                    <div className="text-xs text-gray-500 space-y-1">
                                        {selectedClient.recordId && (
                                            <div>מזהה רשומה: <span className="font-mono text-gray-700">{selectedClient.recordId}</span></div>
                                        )}
                                        {selectedClient.recordNumber && (
                                            <div>מספר רשומה: <span className="font-mono text-gray-700">{selectedClient.recordNumber}</span></div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="py-12 text-center text-sm text-gray-500">לא נבחר לקוח</div>
                )}
            </SheetContent>
        </Sheet>
    )
}

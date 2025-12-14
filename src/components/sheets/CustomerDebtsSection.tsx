import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CreditCard } from "lucide-react"
import { CustomerDebtsModal } from "@/components/dialogs/debts/CustomerDebtsModal"
import { useAppSelector } from "@/store/hooks"

interface CustomerDebtsSectionProps {
    customerId: string
    customerName?: string
}

export function CustomerDebtsSection({ customerId, customerName }: CustomerDebtsSectionProps) {
    const [isDebtsModalOpen, setIsDebtsModalOpen] = useState(false)
    const selectedClient = useAppSelector((state) => state.managerSchedule.selectedClient)
    const displayName = customerName || selectedClient?.name || "לקוח"

    return (
        <>
            <Separator />
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">חובות</h3>
                <Button
                    variant="outline"
                    className="w-full justify-center gap-2"
                    onClick={() => setIsDebtsModalOpen(true)}
                >
                    <CreditCard className="h-4 w-4" />
                    הצג חובות של {displayName}
                </Button>
            </div>

            <CustomerDebtsModal
                open={isDebtsModalOpen}
                onOpenChange={setIsDebtsModalOpen}
                customerId={customerId}
                customerName={displayName}
            />
        </>
    )
}

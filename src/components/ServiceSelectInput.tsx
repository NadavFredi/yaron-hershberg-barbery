import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, X } from "lucide-react"
import { useServices, useCreateService, type Service } from "@/hooks/useServices"
import { useToast } from "@/hooks/use-toast"

interface ServiceSelectInputProps {
  selectedServiceId: string | null
  onServiceSelect: (service: Service) => void
  onServiceClear?: () => void
  disabled?: boolean
  label?: string
  placeholder?: string
  className?: string
}

const ADD_NEW_SERVICE_VALUE = "__add_new_service__"

export function ServiceSelectInput({
  selectedServiceId,
  onServiceSelect,
  onServiceClear,
  disabled = false,
  label = "בחירת שירות",
  placeholder = "בחר שירות",
  className,
}: ServiceSelectInputProps) {
  const { data: services = [], isLoading, isFetching, error, refetch } = useServices()
  const createServiceMutation = useCreateService()
  const { toast } = useToast()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newServiceName, setNewServiceName] = useState("")
  const [newServiceBasePrice, setNewServiceBasePrice] = useState("100")

  const handleValueChange = (value: string) => {
    if (value === ADD_NEW_SERVICE_VALUE) {
      setIsCreateDialogOpen(true)
      return
    }

    const service = services.find((svc) => svc.id === value)
    if (service) {
      onServiceSelect(service)
    }
  }

  const handleCreateService = async () => {
    const trimmedName = newServiceName.trim()
    if (!trimmedName) {
      toast({
        title: "יש להזין שם שירות",
        description: "אנא הזינו שם שירות לפני יצירתו.",
        variant: "destructive",
      })
      return
    }

    const parsedBasePrice = Number.parseInt(newServiceBasePrice, 10)
    const basePrice = Number.isFinite(parsedBasePrice) ? parsedBasePrice : 0

    try {
      const created = await createServiceMutation.mutateAsync({
        name: trimmedName,
        base_price: basePrice,
      })

      toast({
        title: "השירות נוצר בהצלחה",
        description: `השירות "${created.name}" נוסף לרשימת השירותים.`,
      })

      setNewServiceName("")
      setNewServiceBasePrice("100")
      setIsCreateDialogOpen(false)

      const refreshed = await refetch()
      const createdService =
        refreshed.data?.find?.((svc) => svc.id === created.id) ?? created
      if (createdService) {
        onServiceSelect(createdService)
      }
    } catch (creationError) {
      console.error("[ServiceSelectInput] Failed to create service:", creationError)
      toast({
        title: "שגיאה ביצירת השירות",
        description: "לא ניתן היה ליצור את השירות. נסו שוב מאוחר יותר.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className={className}>
      <Label className="text-sm font-medium text-gray-700 mb-2 text-right block">
        {label}
      </Label>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-4 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>טוען שירותים...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Select
            dir="rtl"
            value={selectedServiceId ?? ""}
            onValueChange={handleValueChange}
            disabled={disabled || isFetching}
          >
            <SelectTrigger className="w-full text-right">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent dir="rtl" align="end" sideOffset={4} className="text-right">
              {services.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  אין שירותים זמינים. הוסיפו שירות חדש.
                </div>
              ) : (
                services.map((service) => (
                  <SelectItem key={service.id} value={service.id} className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-medium">{service.name}</span>
                      {service.description && (
                        <span className="text-xs text-gray-500">{service.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
              <div className="border-t border-gray-200 my-1" />
              <SelectItem value={ADD_NEW_SERVICE_VALUE} className="text-right text-blue-600">
                <div className="flex items-center justify-end gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">הוסף שירות חדש</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {selectedServiceId && onServiceClear && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onServiceClear}
              disabled={disabled}
              title="נקה בחירה"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-600 text-right">
          לא ניתן לטעון את רשימת השירותים. נסו לרענן את העמוד.
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת שירות חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name" className="text-right block">
                שם השירות
              </Label>
              <Input
                id="service-name"
                value={newServiceName}
                onChange={(event) => setNewServiceName(event.target.value)}
                placeholder="לדוגמה: תספורת פרימיום"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-price" className="text-right block">
                מחיר בסיסי (₪)
              </Label>
              <Input
                id="service-price"
                type="number"
                min="0"
                value={newServiceBasePrice}
                onChange={(event) => setNewServiceBasePrice(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter dir="ltr">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={createServiceMutation.isPending}
            >
              ביטול
            </Button>
            <Button onClick={handleCreateService} disabled={createServiceMutation.isPending}>
              {createServiceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  יוצר שירות...
                </>
              ) : (
                "צור שירות"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


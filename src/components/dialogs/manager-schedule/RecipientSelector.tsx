import { useEffect, useState, useRef, useMemo } from 'react'
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Phone, Loader2, X, ChevronDown } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import type { Database } from "@/integrations/supabase/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { PhoneInput } from "@/components/ui/phone-input"
import { cn } from "@/lib/utils"
import { isValidPhoneNumber } from "libphonenumber-js"

type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"]

export interface CustomPhoneRecipient {
  phone: string
  name: string
}

export interface RecipientSelection {
  ownerPhone: string | null
  selectedContactIds: string[]
  customPhones: CustomPhoneRecipient[]
}

interface RecipientSelectorProps {
  customerId: string | null
  customerPhone?: string | null
  customerName?: string | null
  forceOwner?: boolean // If true, owner is always selected and cannot be unchecked (default: true)
  onSelectionChange: (selection: RecipientSelection) => void
  className?: string
}

export const RecipientSelector: React.FC<RecipientSelectorProps> = ({
  customerId,
  customerPhone: initialCustomerPhone,
  customerName,
  forceOwner = true,
  onSelectionChange,
  className = ""
}) => {
  const [customerPhone, setCustomerPhone] = useState<string>("")
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [customPhones, setCustomPhones] = useState<CustomPhoneRecipient[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const [multiSelectOpen, setMultiSelectOpen] = useState(false)
  const [searchValue, setSearchValue] = useState<string>("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch customer contacts when customerId changes
  useEffect(() => {
    if (!customerId) {
      setCustomerPhone("")
      setCustomerContacts([])
      setSelectedContactIds(new Set())
      setCustomPhones([])
      return
    }

    const fetchContacts = async () => {
      setIsLoadingContacts(true)
      try {
        // Get customer phone
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('phone')
          .eq('id', customerId)
          .maybeSingle()

        if (!customerError && customerData) {
          const phone = customerData.phone || initialCustomerPhone || ""
          setCustomerPhone(phone)
          // Select owner by default if phone exists
          if (phone) {
            setSelectedContactIds(new Set(["__owner__"]))
          }
        } else if (initialCustomerPhone) {
          setCustomerPhone(initialCustomerPhone)
          // Select owner by default if phone exists
          setSelectedContactIds(new Set(["__owner__"]))
        }

        // Fetch customer contacts
        const { data: contactsData, error: contactsError } = await supabase
          .from('customer_contacts')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: true })

        if (!contactsError && contactsData) {
          setCustomerContacts(contactsData)
        }
      } catch (error) {
        console.error("Error fetching contacts:", error)
      } finally {
        setIsLoadingContacts(false)
      }
    }

    fetchContacts()
  }, [customerId, initialCustomerPhone])

  // Notify parent of selection changes - send ALL custom phones (including empty ones) for validation
  useEffect(() => {
    // If owner is selected (either by forceOwner or manually), include owner phone
    const isOwnerSelected = selectedContactIds.has("__owner__") || (forceOwner && customerPhone)
    onSelectionChange({
      ownerPhone: isOwnerSelected && customerPhone ? customerPhone : null,
      selectedContactIds: Array.from(selectedContactIds).filter(id => id !== "__owner__"), // Exclude __owner__ from contact IDs
      customPhones: customPhones // Send all, including empty ones, so parent can validate
    })
  }, [customerPhone, selectedContactIds, customPhones, forceOwner, onSelectionChange])

  const handleContactToggle = (contactId: string) => {
    setSelectedContactIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(contactId)) {
        newSet.delete(contactId)
      } else {
        newSet.add(contactId)
      }
      return newSet
    })
  }

  const handleAddCustomPhone = () => {
    setCustomPhones(prev => [...prev, { phone: "", name: "" }])
  }

  const handleCustomPhoneChange = (index: number, value: string) => {
    setCustomPhones(prev => {
      const newPhones = [...prev]
      newPhones[index] = { ...newPhones[index], phone: value }
      return newPhones
    })
  }

  const handleCustomNameChange = (index: number, value: string) => {
    setCustomPhones(prev => {
      const newPhones = [...prev]
      newPhones[index] = { ...newPhones[index], name: value }
      return newPhones
    })
  }

  const handleRemoveCustomPhone = (index: number) => {
    setCustomPhones(prev => prev.filter((_, i) => i !== index))
  }

  // Validate custom phones
  const customPhoneValidation = useMemo(() => {
    return customPhones.map((cp) => {
      const hasName = cp.name.trim().length > 0
      const hasPhone = cp.phone.trim().length > 0
      let isValidPhone = false

      if (hasPhone) {
        try {
          isValidPhone = isValidPhoneNumber(cp.phone)
        } catch {
          isValidPhone = false
        }
      }

      return {
        hasName,
        hasPhone,
        isValidPhone,
        isValid: hasName && hasPhone && isValidPhone
      }
    })
  }, [customPhones])

  const handleOwnerToggle = (checked: boolean) => {
    if (forceOwner) {
      // Owner cannot be unchecked if forceOwner is true
      return
    }
    // If forceOwner is false, we could handle owner selection here
    // For now, we'll keep it simple and just respect forceOwner
  }

  if (!customerId) {
    return null
  }

  // Build options list: owner + contacts
  const allRecipients: Array<{ id: string; name: string; phone: string; isOwner: boolean }> = []
  if (customerPhone) {
    const ownerDisplayName = customerName 
      ? `בעלים (${customerName})`
      : forceOwner 
        ? "בעלים (נשלח תמיד)" 
        : "בעלים"
    allRecipients.push({
      id: "__owner__",
      name: ownerDisplayName,
      phone: customerPhone,
      isOwner: true
    })
  }
  customerContacts.forEach(contact => {
    allRecipients.push({
      id: contact.id,
      name: contact.name || "ללא שם",
      phone: contact.phone || "",
      isOwner: false
    })
  })

  // Owner is selected by default, or if forceOwner is true, or if manually selected
  const isOwnerSelected = selectedContactIds.has("__owner__") || (forceOwner && customerPhone)
  const contactIdsWithoutOwner = Array.from(selectedContactIds).filter(id => id !== "__owner__")
  const selectedRecipientIds = isOwnerSelected && customerPhone
    ? ["__owner__", ...contactIdsWithoutOwner]
    : contactIdsWithoutOwner

  const selectedRecipients = allRecipients.filter(r => selectedRecipientIds.includes(r.id))
  const filteredRecipients = allRecipients.filter(r => {
    if (!searchValue) return true
    return r.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      r.phone.includes(searchValue)
  })

  const handleRecipientToggle = (recipientId: string) => {
    if (recipientId === "__owner__" && forceOwner) {
      // Owner cannot be toggled if forceOwner is true
      return
    }
    handleContactToggle(recipientId)
  }

  return (
    <div className={`space-y-3 ${className}`} dir="rtl">
      <Label className="text-right flex items-center gap-2">
        <Phone className="h-4 w-4 text-gray-400" />
        בחר נמענים לשליחת ההודעה
      </Label>

      {isLoadingContacts ? (
        <div className="flex items-center justify-center py-4" dir="rtl">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <span className="mr-2 text-xs text-gray-600">טוען אנשי קשר...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Compact Multi-Select for Owner and Contacts */}
          <Popover open={multiSelectOpen} onOpenChange={setMultiSelectOpen} modal={false}>
            <PopoverAnchor asChild>
              <div
                className={cn(
                  "relative flex-1 min-h-10 border border-input bg-background rounded-md",
                  "flex flex-wrap items-center gap-1 px-2 py-1.5 text-sm",
                  "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                  "cursor-text"
                )}
                onClick={(e) => {
                  // Don't open if clicking on the chevron button
                  if ((e.target as HTMLElement).closest('button')) {
                    return
                  }
                  if (!multiSelectOpen) {
                    e.preventDefault()
                    e.stopPropagation()
                    setMultiSelectOpen(true)
                    // Focus input after popover opens
                    setTimeout(() => {
                      inputRef.current?.focus()
                    }, 50)
                  }
                }}
                dir="rtl"
              >
                {selectedRecipients.length > 0 && !searchValue ? (
                  <>
                    {selectedRecipients.map((recipient) => (
                      <Badge
                        key={recipient.id}
                        variant="secondary"
                        className="text-xs h-6 px-2 flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!recipient.isOwner || !forceOwner) {
                            handleRecipientToggle(recipient.id)
                          }
                        }}
                      >
                        <span>{recipient.name}</span>
                        {(!recipient.isOwner || !forceOwner) && (
                          <X className="h-3 w-3 cursor-pointer hover:text-destructive" />
                        )}
                      </Badge>
                    ))}
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchValue}
                      onChange={(e) => {
                        setSearchValue(e.target.value)
                        if (!multiSelectOpen) {
                          setMultiSelectOpen(true)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && searchValue === "") {
                          if (selectedRecipients.length > 0) {
                            const lastRecipient = selectedRecipients[selectedRecipients.length - 1]
                            if (!lastRecipient.isOwner || !forceOwner) {
                              handleRecipientToggle(lastRecipient.id)
                            }
                          }
                        }
                      }}
                      placeholder=""
                      className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-right"
                      dir="rtl"
                      onFocus={(e) => {
                        // Prevent auto-opening on focus - only open when user explicitly clicks or types
                        e.stopPropagation()
                      }}
                    />
                  </>
                ) : (
                  <Input
                    ref={inputRef}
                    value={searchValue}
                    onChange={(e) => {
                      setSearchValue(e.target.value)
                      if (!multiSelectOpen) {
                        setMultiSelectOpen(true)
                      }
                    }}
                    onFocus={(e) => {
                      // Prevent auto-opening on focus - only open when user explicitly clicks or types
                      e.stopPropagation()
                    }}
                    placeholder="בחר נמענים..."
                    dir="rtl"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto px-0 text-right"
                  />
                )}
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-500 flex-shrink-0"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setMultiSelectOpen(!multiSelectOpen)
                  }}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </PopoverAnchor>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" dir="rtl">
              <div className="max-h-60 overflow-auto">
                {filteredRecipients.length > 0 ? (
                  filteredRecipients.map((recipient) => (
                    <label
                      key={recipient.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedRecipientIds.includes(recipient.id)}
                        disabled={recipient.isOwner && forceOwner}
                        onCheckedChange={() => handleRecipientToggle(recipient.id)}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 text-right">
                        <div className="text-sm font-medium">{recipient.name}</div>
                        <div className="text-xs text-gray-500">{recipient.phone}</div>
                      </div>
                    </label>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500 text-center">
                    לא נמצאו תוצאות
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Custom Phones */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600 text-right">מספרים מותאמים אישית</div>
            {customPhones.map((customPhone, index) => {
              const validation = customPhoneValidation[index]
              const hasName = customPhone.name.trim().length > 0
              const hasPhone = customPhone.phone.trim().length > 0

              // Show errors if either field is filled but the entry is incomplete/invalid
              const showNameError = hasPhone && !hasName
              const showPhoneError = (hasPhone && !validation.isValidPhone) || (hasName && !hasPhone)

              return (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-gray-600 text-right block mb-1">
                      שם {showNameError && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      type="text"
                      placeholder="הזן שם"
                      value={customPhone.name}
                      onChange={(e) => handleCustomNameChange(index, e.target.value)}
                      className={cn(
                        "text-right",
                        showNameError && "border-red-500 focus-visible:ring-red-500"
                      )}
                      dir="rtl"
                      required
                    />
                    {showNameError && (
                      <p className="text-xs text-red-500 text-right mt-1">שם נדרש</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-600 text-right block mb-1">
                      מספר טלפון {showPhoneError && <span className="text-red-500">*</span>}
                    </Label>
                    <PhoneInput
                      value={customPhone.phone}
                      onChange={(value) => handleCustomPhoneChange(index, value)}
                      placeholder="הזן מספר טלפון"
                      defaultCountry="il"
                      className={cn(
                        "w-full",
                        showPhoneError && "[&_input]:border-red-500 [&_input]:focus-visible:ring-red-500"
                      )}
                      showValidation={true}
                    />

                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCustomPhone(index)}
                    className="h-8 w-8 mb-0.5"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCustomPhone}
              className="w-full text-right"
              dir="rtl"
            >
              + הוסף מספר מותאם אישית
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}


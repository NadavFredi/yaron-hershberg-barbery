import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useDebounce } from "@/hooks/useDebounce"
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import type { OrderItem, Product, BreedPriceRange, PaymentData, CartAppointment } from "./types"
import { useLazyGetManagerAppointmentQuery, supabaseApi } from "@/store/services/supabaseApi"
import { useToast } from "@/hooks/use-toast"
import type { RecipientSelection } from "../RecipientSelector.tsx"

interface UsePaymentModalProps {
  open: boolean
  appointment: ManagerAppointment | null // For backward compatibility
  cartId?: string | null // If provided, fetch cart and appointments
  customerId?: string | null // If provided, use this customer when creating a new cart
  onConfirm: (paymentData: PaymentData) => void
  onOpenChange: (open: boolean) => void
}

export const usePaymentModal = ({
  open,
  appointment,
  cartId: providedCartId,
  customerId: providedCustomerId,
  onConfirm,
  onOpenChange,
}: UsePaymentModalProps) => {
  // Get selected date from Redux
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
  const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
  const [fetchManagerAppointment] = useLazyGetManagerAppointmentQuery()

  // Step and payment state
  const [step, setStep] = useState(1)
  const [paymentType, setPaymentType] = useState<"apps" | "credit" | "bank_transfer" | null>(null)
  const [paymentSubType, setPaymentSubType] = useState<string | null>(null)
  const [hasReceipt, setHasReceipt] = useState(true)
  const [paidSum, setPaidSum] = useState<string>("")

  // Cart appointments state (for multiple appointments support)
  const [cartAppointments, setCartAppointments] = useState<CartAppointment[]>([])
  const [originalCartAppointments, setOriginalCartAppointments] = useState<CartAppointment[]>([])
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)

  // Legacy appointment price state (for backward compatibility with single appointment)
  const [appointmentPrice, setAppointmentPrice] = useState<string>("")
  const [originalAppointmentPrice, setOriginalAppointmentPrice] = useState<string>("0")
  const [isLoadingBreedPrices, setIsLoadingBreedPrices] = useState(false)
  const [breedPriceRange, setBreedPriceRange] = useState<BreedPriceRange | null>(null)
  const [showPreviousPayments, setShowPreviousPayments] = useState(false)
  const [isSavingPrice, setIsSavingPrice] = useState(false)
  const [priceSaved, setPriceSaved] = useState(false)

  // Product search and management
  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isAddingNewItem, setIsAddingNewItem] = useState(false)
  const [newItemSearchResults, setNewItemSearchResults] = useState<Product[]>([])
  const [tempNewItem, setTempNewItem] = useState({ name: "", price: "0", quantity: "1" })
  const [showProductSuggestions, setShowProductSuggestions] = useState(false)
  const [isLoadingInitialProducts, setIsLoadingInitialProducts] = useState(false)
  const [hasSearchedProducts, setHasSearchedProducts] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [showProductCreateDialog, setShowProductCreateDialog] = useState(false)
  const [productToCreateName, setProductToCreateName] = useState("")
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])

  // Order items and cart
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [cartId, setCartId] = useState<string | null>(null)
  const [originalOrderItems, setOriginalOrderItems] = useState<OrderItem[]>([])
  const [isLoadingCart, setIsLoadingCart] = useState(false)
  const [isSavingCart, setIsSavingCart] = useState(false)
  const [cartSaved, setCartSaved] = useState(false)
  const [isSendingPaymentRequest, setIsSendingPaymentRequest] = useState(false)
  const [showPaymentIframe, setShowPaymentIframe] = useState(false)
  const [paymentPostData, setPaymentPostData] = useState<Record<string, string | number> | undefined>(undefined)
  const [isLoadingHandshake, setIsLoadingHandshake] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isCartPaid, setIsCartPaid] = useState(false)
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null)
  const [recipientSelection, setRecipientSelection] = useState<RecipientSelection>({
    ownerPhone: null,
    selectedContactIds: [],
    customPhones: [],
  })
  const [paymentLinkRecipientSelection, setPaymentLinkRecipientSelection] = useState<RecipientSelection>({
    ownerPhone: null,
    selectedContactIds: [],
    customPhones: [],
  })
  const [receivedAmount, setReceivedAmount] = useState<string>("")
  const [isMarkingAsReceived, setIsMarkingAsReceived] = useState(false)
  const [hasSavedCard, setHasSavedCard] = useState<boolean>(false)
  const [isCheckingSavedCard, setIsCheckingSavedCard] = useState(false)
  const [savedCardAmount, setSavedCardAmount] = useState<string>("")
  const [isLoadingSavedCardPayment, setIsLoadingSavedCardPayment] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false)
  const [isPollingPayment, setIsPollingPayment] = useState(false)

  // Debounce the search term
  const debouncedSearchTerm = useDebounce(tempNewItem.name, 300)

  // Filter out products that are already in the order items
  const filteredSearchResults = useMemo(() => {
    const selectedProductIds = new Set(orderItems.map((item) => item.id))
    return newItemSearchResults.filter((product) => !selectedProductIds.has(product.id))
  }, [newItemSearchResults, orderItems])

  // Create a new cart for standalone payments
  const createNewCart = async () => {
    setIsLoadingCart(true)
    setIsLoadingAppointments(true)
    try {
      // Create a new cart with customer_id if provided
      const { data: newCart, error: cartError } = await supabase
        .from("carts")
        .insert({
          status: "active",
          customer_id: providedCustomerId || null,
        })
        .select()
        .single()

      if (cartError) throw cartError

      if (newCart) {
        setCartId(newCart.id)
        setCartAppointments([])
        setOriginalCartAppointments([])
        setOrderItems([])
        setOriginalOrderItems([])
        setCustomerId(providedCustomerId || null)
      }
    } catch (err) {
      console.error("Error creating new cart:", err)
      toast({
        title: "שגיאה",
        description: "לא ניתן ליצור עגלה חדשה",
        variant: "destructive",
      })
      setCartId(null)
      setCartAppointments([])
      setOriginalCartAppointments([])
    } finally {
      setIsLoadingCart(false)
      setIsLoadingAppointments(false)
    }
  }

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep(1)
      setPaymentType(null)
      setPaymentSubType(null)
      setHasReceipt(true)
      setPaidSum("")
      setProducts([])
      setBreedPriceRange(null)
      setPriceSaved(false)
      setCartSaved(false)

      if (providedCartId) {
        // Fetch cart with appointments
        fetchCartWithAppointments(providedCartId)
        setAppointmentPrice("0") // Initialize to 0 for cart mode
        setIsCartPaid(false)
        setPaidOrderId(null)
      } else if (appointment) {
        // Legacy mode: single appointment
        const basePrice = appointment?.price || 0
        setAppointmentPrice(basePrice.toString())
        setOriginalAppointmentPrice(basePrice.toString())
        fetchActiveCart()

        if (appointment?.serviceType === "grooming" && appointment?.dogs && appointment.dogs.length > 0) {
          fetchBreedPrices(appointment.dogs[0].breed)
        }
      } else {
        // No appointment and no cartId - create a new cart for standalone payments
        setAppointmentPrice("0")
        createNewCart()
      }

      fetchInitialProducts()

      // Check for saved card
      checkSavedCard()
    }
  }, [open, appointment, providedCartId])

  // Check if customer has saved card
  const checkSavedCard = async () => {
    let customerId: string | null = null

    if (appointment?.clientId) {
      customerId = appointment.clientId
    } else if (providedCartId) {
      const { data: cartData } = await supabase.from("carts").select("customer_id").eq("id", providedCartId).single()
      customerId = cartData?.customer_id || null
    }

    if (!customerId) {
      setHasSavedCard(false)
      return
    }

    setIsCheckingSavedCard(true)
    try {
      const { data, error } = await supabase
        .from("credit_tokens")
        .select("id")
        .eq("customer_id", customerId)
        .not("token", "is", null)
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error("Error checking saved card:", error)
        setHasSavedCard(false)
      } else {
        setHasSavedCard(!!data)
      }
    } catch (err) {
      console.error("Error checking saved card:", err)
      setHasSavedCard(false)
    } finally {
      setIsCheckingSavedCard(false)
    }
  }

  // Calculate saved card amount when saved_card is selected
  useEffect(() => {
    if (paymentSubType === "saved_card" && !savedCardAmount) {
      // Calculate total amount
      const productsTotal = orderItems.reduce((sum, item) => sum + item.price * item.amount, 0)
      let appointmentPriceValue = 0

      if (providedCartId && cartAppointments.length > 0) {
        appointmentPriceValue = cartAppointments.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
      } else if (appointment) {
        appointmentPriceValue = parseFloat(appointmentPrice) || 0
      }

      const totalAmount = productsTotal + appointmentPriceValue
      if (totalAmount > 0) {
        setSavedCardAmount(totalAmount.toString())
      }
    }
  }, [paymentSubType, orderItems, cartAppointments, appointmentPrice, appointment, providedCartId, savedCardAmount])

  // Handle debounced search
  useEffect(() => {
    if (!isInputFocused) {
      return
    }

    const searchTerm = debouncedSearchTerm.trim()

    if (searchTerm.length >= 2) {
      searchProducts(searchTerm)
    } else if (searchTerm.length === 0) {
      if (filteredSearchResults.length === 0) {
        fetchInitialProducts()
      }
    } else {
      setNewItemSearchResults([])
      setIsLoadingProducts(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, isInputFocused])

  // Calculate paidSum when wire/cash is selected
  useEffect(() => {
    if (paymentSubType === "bank_transfer" || paymentSubType === "cash") {
      // Calculate total amount
      const productsTotal = orderItems.reduce((sum, item) => sum + item.price * item.amount, 0)
      let appointmentPriceValue = 0

      if (providedCartId && cartAppointments.length > 0) {
        appointmentPriceValue = cartAppointments.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
      } else if (appointment) {
        appointmentPriceValue = parseFloat(appointmentPrice) || 0
      }

      const totalAmount = productsTotal + appointmentPriceValue
      if (totalAmount > 0 && !paidSum) {
        setPaidSum(totalAmount.toString())
      }
    }
  }, [paymentSubType, orderItems, cartAppointments, appointmentPrice, appointment, providedCartId, paidSum])

  // Auto-generate payment link when payment_page is selected
  useEffect(() => {
    if (paymentSubType === "payment_page") {
      const currentCartId = cartId || providedCartId
      if (currentCartId) {
        const origin =
          typeof globalThis !== "undefined" && typeof globalThis.location !== "undefined"
            ? globalThis.location.origin
            : ""
        // Use hasReceipt to determine shouldCreateInvoice (default to true if not specified)
        const shouldCreateInvoice = hasReceipt !== undefined ? hasReceipt : true
        const link = `${origin}/payment?cartId=${currentCartId}&shouldCreateInvoice=${shouldCreateInvoice}`
        setPaymentLink(link)
      }
    }
  }, [paymentSubType, cartId, providedCartId, hasReceipt])

  // Fetch breed prices
  const fetchBreedPrices = async (breedName?: string) => {
    if (!breedName) {
      setIsLoadingBreedPrices(false)
      return
    }

    setIsLoadingBreedPrices(true)
    try {
      // Breeds table doesn't exist in this system - return null
      const data = null
      const error = null

      if (error) throw error

      if (data) {
        const minPrice = data.min_groom_price != null ? Number(data.min_groom_price) : null
        const maxPrice = data.max_groom_price != null ? Number(data.max_groom_price) : null
        const hourlyPrice = data.hourly_price != null ? Number(data.hourly_price) : null
        const notes = data.notes || null

        setBreedPriceRange({
          minPrice,
          maxPrice,
          hourlyPrice,
          notes,
          breedName,
        })

        setAppointmentPrice((currentPrice) => {
          if (currentPrice === "0" || parseFloat(currentPrice) === 0) {
            if (hourlyPrice && appointment?.startDateTime && appointment?.endDateTime) {
              const start = new Date(appointment.startDateTime)
              const end = new Date(appointment.endDateTime)
              const durationMs = end.getTime() - start.getTime()
              const totalHours = durationMs / (1000 * 60 * 60)
              const calculatedPrice = Math.round(hourlyPrice * totalHours)

              if (calculatedPrice > 0) {
                setOriginalAppointmentPrice(calculatedPrice.toString())
                return calculatedPrice.toString()
              }
            }

            if (minPrice) {
              setOriginalAppointmentPrice(minPrice.toString())
              return minPrice.toString()
            }
          }
          return currentPrice
        })
      } else {
        setBreedPriceRange(null)
      }
    } catch (err) {
      setBreedPriceRange(null)
    } finally {
      setIsLoadingBreedPrices(false)
    }
  }

  // Get breed price info
  const getBreedPriceInfo = () => {
    return breedPriceRange
  }

  // Check if price is dirty
  const isPriceDirty = () => {
    return appointmentPrice !== originalAppointmentPrice && appointmentPrice !== "0"
  }

  // Reset price to original
  const handleCancelPriceChange = () => {
    setAppointmentPrice(originalAppointmentPrice)
    setPriceSaved(false)
  }

  // Save appointment price
  const handleSavePrice = async () => {
    if (!appointment?.id || !isPriceDirty()) return

    setIsSavingPrice(true)
    try {
      const price = parseFloat(appointmentPrice) || 0

      // Update amount_due directly using PostgREST
      const { error: updateError } = await supabase
        .from("grooming_appointments")
        .update({ amount_due: price })
        .eq("id", appointment.id)

      if (updateError) {
        console.error("Error updating appointment price:", updateError)
        throw updateError
      }

      // Call Make.com webhook if needed (for external integrations)
      // This can be done in the background without blocking the UI
      if (appointment.recordId || appointment.recordNumber) {
        try {
          const webhookUrl = "https://hook.eu2.make.com/sjaximdjzif3b9tqrr6kxfhm1c81pe63"
          await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              appointmentId: appointment.id,
              price: price,
              recordId: appointment.recordId,
              recordNumber: appointment.recordNumber,
              serviceType: appointment.serviceType,
            }),
          })
        } catch (webhookError) {
          // Log but don't fail - webhook is not critical for the update
          console.warn("Webhook call failed (non-critical):", webhookError)
        }
      }

      setOriginalAppointmentPrice(appointmentPrice)
      setPriceSaved(true)

      setTimeout(() => {
        setPriceSaved(false)
      }, 3000)
    } catch (err) {
      console.error("Error saving appointment price:", err)
      toast({
        title: "שגיאה",
        description: "לא הצלחנו לשמור את המחיר",
        variant: "destructive",
      })
    } finally {
      setIsSavingPrice(false)
    }
  }

  // Fetch initial products
  const fetchInitialProducts = async () => {
    setIsLoadingInitialProducts(true)
    try {
      const { data, error } = await supabase.from("products").select("id, name, retail_price").order("name").limit(5)

      if (error) {
        throw error
      }

      const foundProducts: Product[] = (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.retail_price || 0,
        description: "",
      }))

      setNewItemSearchResults(foundProducts)
    } catch (err) {
      setNewItemSearchResults([])
    } finally {
      setIsLoadingInitialProducts(false)
    }
  }

  // Search products
  const searchProducts = async (query: string) => {
    if (query.length < 2) {
      setNewItemSearchResults([])
      setIsLoadingProducts(false)
      return
    }

    setIsLoadingProducts(true)
    setHasSearchedProducts(false)
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, retail_price")
        .ilike("name", `%${query}%`)
        .order("name")
        .limit(20)

      if (error) {
        throw error
      }

      const foundProducts: Product[] = (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.retail_price || 0,
        description: "",
      }))

      setProducts(foundProducts)
      setNewItemSearchResults(foundProducts)
      setHasSearchedProducts(true)
      setShowProductCreateDialog(false)
    } catch (err) {
      setProducts([])
      setNewItemSearchResults([])
    } finally {
      setIsLoadingProducts(false)
    }
  }

  // Handle product selection from search
  const handleSelectProductFromSearch = (product: Product, quantity: string) => {
    const isAlreadySelected = orderItems.some((item) => item.id === product.id)
    if (isAlreadySelected) {
      return
    }

    const newOrderItem: OrderItem = {
      id: product.id,
      name: product.name,
      amount: parseInt(quantity) || 1,
      price: product.price,
      needsInvoice: false,
    }

    setOrderItems([...orderItems, newOrderItem])
    setIsAddingNewItem(false)
    setTempNewItem({ name: "", price: "0", quantity: "1" })
    setNewItemSearchResults([])
    setShowProductSuggestions(false)
    setIsInputFocused(false)
  }

  // Handle using product as temporary item
  const handleUseAsTempItem = () => {
    const newOrderItem: OrderItem = {
      id: `temp_${Date.now()}`,
      name: tempNewItem.name,
      amount: parseInt(tempNewItem.quantity) || 1,
      price: parseFloat(tempNewItem.price) || 0,
      needsInvoice: false,
    }

    setOrderItems([...orderItems, newOrderItem])
    setIsAddingNewItem(false)
    setTempNewItem({ name: "", price: "0", quantity: "1" })
    setNewItemSearchResults([])
    setShowProductSuggestions(false)
    setIsInputFocused(false)
  }

  // Handle opening product creation dialog
  const handleOpenCreateProductDialog = async () => {
    try {
      const { data, error } = await supabase.from("brands").select("id, name").order("name")

      if (error) throw error
      setBrands(data || [])
    } catch (err) {
      setBrands([])
    }

    setProductToCreateName(tempNewItem.name)
    setShowProductCreateDialog(true)
    setShowProductSuggestions(false)
    setIsInputFocused(false)
  }

  // Handle product created successfully
  const handleProductCreated = async () => {
    if (tempNewItem.name.length >= 2) {
      await searchProducts(tempNewItem.name)
    } else {
      await fetchInitialProducts()
    }
    setShowProductCreateDialog(false)
  }

  // Handle cancel adding item
  const handleCancelAddingItem = () => {
    setIsAddingNewItem(false)
    setTempNewItem({ name: "", price: "0", quantity: "1" })
    setNewItemSearchResults([])
    setShowProductSuggestions(false)
  }

  // Handle start adding item
  const handleStartAddingItem = () => {
    setIsAddingNewItem(true)
    setTempNewItem({ name: "", price: "0", quantity: "1" })
  }

  // Update item price
  const handleUpdateItemPrice = (itemId: string, newPrice: number) => {
    setOrderItems(orderItems.map((item) => (item.id === itemId ? { ...item, price: newPrice } : item)))
  }

  // Update item quantity
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setOrderItems(
      orderItems
        .map((item) => {
          if (item.id === itemId) {
            const newAmount = item.amount + delta
            if (newAmount <= 0) {
              return null as OrderItem | null
            }
            return { ...item, amount: newAmount }
          }
          return item
        })
        .filter((item): item is OrderItem => item !== null)
    )
  }

  // Remove item from order
  const handleRemoveItem = (itemId: string) => {
    setOrderItems(orderItems.filter((item) => item.id !== itemId))
  }

  // Calculate total amount
  const calculateTotal = () => {
    const productsTotal = orderItems.reduce((total, item) => total + item.price * item.amount, 0)

    if (providedCartId && cartAppointments.length > 0) {
      // Sum all appointment prices
      const appointmentsTotal = cartAppointments.reduce((total, ca) => total + (ca.appointment_price || 0), 0)
      return productsTotal + appointmentsTotal
    } else if (appointment) {
      // Legacy mode: single appointment price
      return productsTotal + (parseFloat(appointmentPrice) || 0)
    }

    return productsTotal
  }

  // Check if appointments are dirty (computed value)
  const isAppointmentsDirty = useMemo(() => {
    if (!providedCartId) return false

    if (cartAppointments.length !== originalCartAppointments.length) return true

    for (const cartAppt of cartAppointments) {
      const originalAppt = originalCartAppointments.find((oa) => oa.id === cartAppt.id)
      if (!originalAppt || originalAppt.appointment_price !== cartAppt.appointment_price) {
        return true
      }
    }

    for (const originalAppt of originalCartAppointments) {
      if (!cartAppointments.find((ca) => ca.id === originalAppt.id)) {
        return true
      }
    }

    return false
  }, [providedCartId, cartAppointments, originalCartAppointments])

  // Check if garden appointments are dirty (computed value)
  const isGardenAppointmentsDirty = useMemo(() => {
    // No garden/daycare appointments in the app
    return false
  }, [])

  // Check if products are dirty (computed value)
  const isProductsDirty = useMemo(() => {
    if (orderItems.length !== originalOrderItems.length) return true

    for (const item of orderItems) {
      const originalItem = originalOrderItems.find((oi) => oi.id === item.id)
      if (
        !originalItem ||
        originalItem.amount !== item.amount ||
        originalItem.price !== item.price ||
        originalItem.name !== item.name
      ) {
        return true
      }
    }

    for (const originalItem of originalOrderItems) {
      if (!orderItems.find((item) => item.id === originalItem.id)) {
        return true
      }
    }

    return false
  }, [orderItems, originalOrderItems])

  // Check if cart is dirty (both appointments and products)
  const isCartDirty = useMemo(() => {
    return isAppointmentsDirty || isProductsDirty
  }, [isAppointmentsDirty, isProductsDirty])

  // Fetch active cart
  const fetchActiveCart = async () => {
    if (!appointment?.id || !appointment?.serviceType) return

    setIsLoadingCart(true)
    try {
      // Query cart_appointments to find active cart for this appointment
      const appointmentIdField = "grooming_appointment_id"

      // First, find the cart_appointment entry for this appointment
      const { data: cartApptData, error: cartApptError } = await supabase
        .from("cart_appointments")
        .select("cart_id, appointment_price, carts!inner(id, status)")
        .eq(appointmentIdField, appointment.id)
        .eq("carts.status", "active")
        .maybeSingle()

      if (cartApptError) throw cartApptError

      if (!cartApptData) {
        // No active cart found for this appointment
        setCartId(null)
        setOrderItems([])
        setOriginalOrderItems([])
        return
      }

      const foundCartId = cartApptData.cart_id
      setCartId(foundCartId)

      // Update appointment price from cart_appointment if it has a saved price
      if (cartApptData.appointment_price && cartApptData.appointment_price > 0) {
        setAppointmentPrice(cartApptData.appointment_price.toString())
        setOriginalAppointmentPrice(cartApptData.appointment_price.toString())
      }

      // Fetch cart items for this cart
      const { data: itemsData, error: itemsError } = await supabase
        .from("cart_items")
        .select(
          `
                    id,
                    quantity,
                    unit_price,
                    item_name,
                    product_id,
                    products (
                        id,
                        name
                    )
                `
        )
        .eq("cart_id", foundCartId)
        .order("created_at")

      if (itemsError) throw itemsError

      // Map cart items to OrderItem format
      const mappedItems: OrderItem[] = (itemsData || []).map((item: any) => {
        // Use product_id if product exists, otherwise use cart_item id for temp items
        const product = item.products
        const itemId = product?.id || item.id
        // Get product name: use item_name if available (for temp items), otherwise product name
        const productName = item.item_name || product?.name || "פריט ללא שם"

        return {
          id: itemId,
          name: productName,
          amount: Number(item.quantity) || 1,
          price: Number(item.unit_price) || 0,
          needsInvoice: false,
        }
      })

      setOrderItems(mappedItems)
      setOriginalOrderItems([...mappedItems])
    } catch (err) {
      console.error("Error fetching active cart:", err)
      setCartId(null)
      setOrderItems([])
      setOriginalOrderItems([])
    } finally {
      setIsLoadingCart(false)
    }
  }

  // Fetch cart with appointments (for multiple appointments support)
  const fetchCartWithAppointments = async (cartIdToFetch: string) => {
    setIsLoadingCart(true)
    setIsLoadingAppointments(true)
    try {
      setCartId(cartIdToFetch)

      // Fetch cart items (exclude temporary grooming products which are saved as cart_items but shown in grooming section)
      const { data: itemsData, error: itemsError } = await supabase
        .from("cart_items")
        .select(
          `
                    id,
                    quantity,
                    unit_price,
                    item_name,
                    product_id,
                    products (
                        id,
                        name
                    )
                `
        )
        .eq("cart_id", cartIdToFetch)
        .order("created_at")

      if (itemsError) throw itemsError

      // Filter out temporary grooming products (they're shown in grooming section, not products)
      const filteredItems = (itemsData || []).filter(
        (item: any) => !item.item_name || !item.item_name.startsWith("מספרה:")
      )

      const mappedItems: OrderItem[] = filteredItems.map((item: any) => {
        const product = item.products
        const itemId = product?.id || item.id
        const productName = item.item_name || product?.name || "פריט ללא שם"

        return {
          id: itemId,
          name: productName,
          amount: Number(item.quantity) || 1,
          price: Number(item.unit_price) || 0,
          needsInvoice: false,
        }
      })

      setOrderItems(mappedItems)
      setOriginalOrderItems([...mappedItems])

      // Check if cart has a paid order
      const { data: paidOrderData, error: paidOrderError } = await supabase
        .from("orders")
        .select("id, status, total")
        .eq("cart_id", cartIdToFetch)
        .maybeSingle()

      if (!paidOrderError && paidOrderData) {
        const status = (paidOrderData.status || "").toLowerCase()
        const isPaid =
          status === "completed" || status === "paid" || status.includes("שולם") || status.includes("הושלם")
        setIsCartPaid(isPaid)
        setPaidOrderId(isPaid ? paidOrderData.id : null)
      } else {
        setIsCartPaid(false)
        setPaidOrderId(null)
      }

      // Get customer_id from cart
      const { data: cartData, error: cartError } = await supabase
        .from("carts")
        .select("customer_id")
        .eq("id", cartIdToFetch)
        .single()

      if (cartError) throw cartError
      if (!cartData?.customer_id) {
        setCartAppointments([])
        setOriginalCartAppointments([])
        setCustomerId(null)
        return
      }

      setCustomerId(cartData.customer_id)

      // Fetch appointments for the same customer on the selected date (ignore cart_appointments)
      // Use the selected date from the board
      const year = selectedDate.getFullYear()
      const month = selectedDate.getMonth()
      const day = selectedDate.getDate()

      // Create day boundaries in local timezone for the selected date
      const dayStart = new Date(year, month, day, 0, 0, 0, 0)
      const dayEnd = new Date(year, month, day, 23, 59, 59, 999)

      // Fetch appointments from API for the same day
      const groomingResult = await supabase
        .from("grooming_appointments")
        .select("id, amount_due, status")
        .eq("customer_id", cartData.customer_id)
        .gte("start_at", dayStart.toISOString())
        .lte("start_at", dayEnd.toISOString())
        .neq("status", "cancelled")

      if (groomingResult.error) throw groomingResult.error

      // Filter out cancelled appointments (including Hebrew statuses)
      const isCancelledStatus = (status: string | null | undefined): boolean => {
        if (!status) return false
        const normalized = status.toLowerCase()
        return (
          normalized === "cancelled" ||
          normalized.includes("cancel") ||
          normalized === "בוטל" ||
          normalized.includes("מבוטל")
        )
      }

      const allAppointmentIds = (groomingResult.data || [])
        .filter((apt) => !isCancelledStatus(apt.status))
        .map((apt) => ({ id: apt.id, serviceType: "grooming" as const, amountDue: apt.amount_due || 0 }))

      // Fetch full appointment data and create cart appointments
      const appointmentsWithData: CartAppointment[] = []
      for (const apt of allAppointmentIds) {
        const appointmentData = await fetchManagerAppointment(
          { appointmentId: apt.id, serviceType: apt.serviceType },
          true
        ).unwrap()

        if (appointmentData) {
          const appointmentPrice = appointmentData.price || apt.amountDue || 0

          // Check if this appointment already exists in cart_appointments to preserve price
          const { data: existingCartAppt } = await supabase
            .from("cart_appointments")
            .select("id, appointment_price")
            .eq("cart_id", cartIdToFetch)
            .eq("grooming_appointment_id", apt.id)
            .maybeSingle()

          const finalPrice =
            existingCartAppt?.appointment_price && existingCartAppt.appointment_price > 0
              ? existingCartAppt.appointment_price
              : appointmentPrice

          appointmentsWithData.push({
            id: existingCartAppt?.id || `temp_${apt.id}`,
            cart_id: cartIdToFetch,
            grooming_appointment_id: apt.id,
            appointment_price: finalPrice,
            appointment: appointmentData,
          })
        }
      }

      // Also fetch temporary grooming products from cart_items
      const { data: tempGroomingItems, error: tempItemsError } = await supabase
        .from("cart_items")
        .select("id, item_name, quantity, unit_price")
        .eq("cart_id", cartIdToFetch)
        .like("item_name", "מספרה:%")

      if (tempItemsError) {
        console.error("Error fetching temp grooming items:", tempItemsError)
      }

      // Convert cart_items to CartAppointment objects
      if (tempGroomingItems && tempGroomingItems.length > 0) {
        const tempGroomingAppointments: CartAppointment[] = tempGroomingItems.map((item) => {
          // Parse item_name: "מספרה: DogName (Breed)" or "מספרה: Breed"
          const match = item.item_name?.match(/מספרה:\s*(.+?)(?:\s*\((.+?)\))?$/)
          const dogName = match?.[1]?.trim() || "לקוח"
          const breed = match?.[2]?.trim() || match?.[1]?.trim() || ""

          return {
            id: item.id,
            cart_id: cartIdToFetch,
            grooming_appointment_id: null,
            appointment_price: item.unit_price || 0,
            appointment: {
              id: item.id,
              serviceType: "grooming",
              stationId: "",
              stationName: "מספרה",
              startDateTime: new Date().toISOString(),
              endDateTime: new Date().toISOString(),
              status: "pending",
              notes: "",
              dogs: [
                {
                  id: `temp_${item.id}`,
                  name: dogName,
                  breed: breed,
                },
              ],
              _isTempGroomingProduct: true,
              _tempItemName: item.item_name || "",
            } as any,
          }
        })

        appointmentsWithData.push(...tempGroomingAppointments)
      }

      setCartAppointments(appointmentsWithData)
      setOriginalCartAppointments([...appointmentsWithData])
    } catch (err) {
      console.error("Error fetching cart with appointments:", err)
      setCartId(null)
      setOrderItems([])
      setOriginalOrderItems([])
      setCartAppointments([])
      setOriginalCartAppointments([])
    } finally {
      setIsLoadingCart(false)
      setIsLoadingAppointments(false)
    }
  }

  // Update appointment price in cart appointments
  const handleUpdateAppointmentPrice = (cartAppointmentId: string, newPrice: number) => {
    setCartAppointments((prev) =>
      prev.map((ca) => (ca.id === cartAppointmentId ? { ...ca, appointment_price: newPrice } : ca))
    )
  }

  // Remove appointment from cart
  const handleRemoveAppointment = (cartAppointmentId: string) => {
    setCartAppointments((prev) => prev.filter((ca) => ca.id !== cartAppointmentId))
  }

  // Save cart with multiple appointments
  const handleSaveCartWithAppointments = async (): Promise<string | null> => {
    if (!providedCartId) return null

    setIsSavingCart(true)
    try {
      const currentCartId = providedCartId

      // Update cart updated_at
      const { error: updateError } = await supabase
        .from("carts")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentCartId)

      if (updateError) throw updateError

      // Delete existing cart items
      const { error: deleteItemsError } = await supabase.from("cart_items").delete().eq("cart_id", currentCartId)

      if (deleteItemsError) throw deleteItemsError

      // Insert new cart items
      if (orderItems.length > 0) {
        const productIdsToFetch = orderItems
          .filter((item) => item.id && !item.id.startsWith("temp_"))
          .map((item) => item.id)

        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIdsToFetch)

        if (productsError) throw productsError

        const productsMap = new Map<string, { id: string; name: string }>()
        ;(productsData || []).forEach((product) => {
          productsMap.set(product.id, { id: product.id, name: product.name })
        })

        const cartItemsToInsert = orderItems.map((item) => {
          let productId: string | null = null
          let itemName: string = item.name

          const productInfo = productsMap.get(item.id)
          if (productInfo) {
            productId = productInfo.id
            itemName = productInfo.name
          }

          return {
            cart_id: currentCartId,
            product_id: productId,
            item_name: itemName,
            quantity: item.amount,
            unit_price: item.price,
          }
        })

        const { error: insertItemsError } = await supabase.from("cart_items").insert(cartItemsToInsert)

        if (insertItemsError) throw insertItemsError
      }

      // Update cart appointments
      // Delete removed appointments
      const currentAppointmentIds = new Set(cartAppointments.map((ca) => ca.id))
      const originalAppointmentIds = originalCartAppointments.map((ca) => ca.id)
      const removedIds = originalAppointmentIds.filter((id) => !currentAppointmentIds.has(id))

      if (removedIds.length > 0) {
        const { error: deleteApptsError } = await supabase.from("cart_appointments").delete().in("id", removedIds)

        if (deleteApptsError) throw deleteApptsError
      }

      // Update or insert appointments
      for (const cartAppt of cartAppointments) {
        // Skip if appointment ID is null (violates check constraint)
        if (!cartAppt.grooming_appointment_id) {
          console.warn("Skipping cart_appointment insert: appointment ID is null", cartAppt)
          continue
        }

        if (originalCartAppointments.find((oca) => oca.id === cartAppt.id)) {
          // Update existing
          const { error: updateError } = await supabase
            .from("cart_appointments")
            .update({ appointment_price: cartAppt.appointment_price })
            .eq("id", cartAppt.id)

          if (updateError) throw updateError
        } else {
          // Insert new
          const { error: insertError } = await supabase.from("cart_appointments").insert({
            cart_id: currentCartId,
            grooming_appointment_id: cartAppt.grooming_appointment_id,
            appointment_price: cartAppt.appointment_price,
          })

          if (insertError) throw insertError
        }
      }

      setOriginalOrderItems([...orderItems])
      setOriginalCartAppointments([...cartAppointments])
      setCartSaved(true)

      setTimeout(() => {
        setCartSaved(false)
      }, 3000)

      return currentCartId
    } catch (err) {
      console.error("Error saving cart with appointments:", err)
      throw err
    } finally {
      setIsSavingCart(false)
    }
  }

  // Save appointments only
  const handleSaveAppointments = async (): Promise<void> => {
    if (!providedCartId) return

    setIsSavingCart(true)
    try {
      const currentCartId = providedCartId

      // Update cart updated_at
      const { error: updateError } = await supabase
        .from("carts")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentCartId)

      if (updateError) throw updateError

      // Separate real appointments from temporary grooming products
      const realAppointments = cartAppointments.filter(
        (ca) =>
          ca.grooming_appointment_id &&
          !ca.grooming_appointment_id.startsWith("temp_") &&
          ca.grooming_appointment_id !== null
      )
      const tempGroomingProducts = cartAppointments.filter(
        (ca) => !ca.grooming_appointment_id && (ca.appointment as any)?._isTempGroomingProduct
      )

      // Delete all existing cart_appointments for this cart first
      const { error: deleteAllApptsError } = await supabase
        .from("cart_appointments")
        .delete()
        .eq("cart_id", currentCartId)

      if (deleteAllApptsError) throw deleteAllApptsError

      // Insert real appointments
      if (realAppointments.length > 0) {
        const appointmentsToInsert = realAppointments.map((ca) => ({
          cart_id: currentCartId,
          grooming_appointment_id: ca.grooming_appointment_id,
          appointment_price: ca.appointment_price,
        }))

        const { data: insertedAppts, error: insertError } = await supabase
          .from("cart_appointments")
          .insert(appointmentsToInsert)
          .select("id, grooming_appointment_id")

        if (insertError) throw insertError
      }

      // Save temporary grooming products as cart_items
      if (tempGroomingProducts.length > 0) {
        // Delete existing temp grooming products (items with item_name starting with "מספרה:")
        const { error: deleteTempItemsError } = await supabase
          .from("cart_items")
          .delete()
          .eq("cart_id", currentCartId)
          .like("item_name", "מספרה:%")

        if (deleteTempItemsError) throw deleteTempItemsError

        // Insert temporary grooming products as cart_items
        const tempItemsToInsert = tempGroomingProducts.map((ca) => {
          const appointment = ca.appointment as any
          return {
            cart_id: currentCartId,
            product_id: null,
            item_name:
              appointment._tempItemName ||
              `מספרה: ${appointment.dogs?.[0]?.name || "לקוח"} (${appointment.dogs?.[0]?.breed || ""})`,
            quantity: 1, // Default quantity, can be enhanced later
            unit_price: ca.appointment_price,
          }
        })

        const { data: insertedItems, error: insertItemsError } = await supabase
          .from("cart_items")
          .insert(tempItemsToInsert)
          .select("id")

        if (insertItemsError) throw insertItemsError

        // Update the IDs for temp appointments
        if (insertedItems) {
          const updatedAppointments = cartAppointments.map((ca) => {
            const appointment = ca.appointment as any
            if (appointment?._isTempGroomingProduct) {
              const inserted = insertedItems.find((_, idx) => tempGroomingProducts[idx]?.id === ca.id)
              if (inserted) {
                return { ...ca, id: inserted.id }
              }
            }
            return ca
          })
          setCartAppointments(updatedAppointments)
          setOriginalCartAppointments([...updatedAppointments])
        } else {
          setOriginalCartAppointments([...cartAppointments])
        }
      } else {
        setOriginalCartAppointments([...cartAppointments])
      }

      setCartSaved(true)

      setTimeout(() => {
        setCartSaved(false)
      }, 3000)
    } catch (err) {
      console.error("Error saving appointments:", err)
      // Error is handled by the caller
      throw err
    } finally {
      setIsSavingCart(false)
    }
  }

  // Save products only
  const handleSaveProducts = async (): Promise<void> => {
    if (!providedCartId) return

    setIsSavingCart(true)
    try {
      const currentCartId = providedCartId

      // Update cart updated_at
      const { error: updateError } = await supabase
        .from("carts")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentCartId)

      if (updateError) throw updateError

      // Delete existing cart items
      const { error: deleteItemsError } = await supabase.from("cart_items").delete().eq("cart_id", currentCartId)

      if (deleteItemsError) throw deleteItemsError

      // Insert new cart items
      if (orderItems.length > 0) {
        const productIdsToFetch = orderItems
          .filter((item) => item.id && !item.id.startsWith("temp_"))
          .map((item) => item.id)

        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIdsToFetch)

        if (productsError) throw productsError

        const productsMap = new Map<string, { id: string; name: string }>()
        ;(productsData || []).forEach((product) => {
          productsMap.set(product.id, { id: product.id, name: product.name })
        })

        const cartItemsToInsert = orderItems.map((item) => {
          let productId: string | null = null
          let itemName: string = item.name

          const productInfo = productsMap.get(item.id)
          if (productInfo) {
            productId = productInfo.id
            itemName = productInfo.name
          }

          return {
            cart_id: currentCartId,
            product_id: productId,
            item_name: itemName,
            quantity: item.amount,
            unit_price: item.price,
          }
        })

        const { error: insertItemsError } = await supabase.from("cart_items").insert(cartItemsToInsert)

        if (insertItemsError) throw insertItemsError
      }

      setOriginalOrderItems([...orderItems])
      setCartSaved(true)

      setTimeout(() => {
        setCartSaved(false)
      }, 3000)
    } catch (err) {
      console.error("Error saving products:", err)
      throw err
    } finally {
      setIsSavingCart(false)
    }
  }

  // Save products appointments
  const handleSaveProductsAndGarden = async (): Promise<void> => {
    if (!providedCartId) return

    setIsSavingCart(true)
    try {
      const currentCartId = providedCartId

      // Update cart updated_at
      const { error: updateError } = await supabase
        .from("carts")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentCartId)

      if (updateError) throw updateError

      // Delete existing cart items
      const { error: deleteItemsError } = await supabase.from("cart_items").delete().eq("cart_id", currentCartId)

      if (deleteItemsError) throw deleteItemsError

      // Insert new cart items
      if (orderItems.length > 0) {
        const productIdsToFetch = orderItems
          .filter((item) => item.id && !item.id.startsWith("temp_"))
          .map((item) => item.id)

        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIdsToFetch)

        if (productsError) throw productsError

        const productsMap = new Map<string, { id: string; name: string }>()
        ;(productsData || []).forEach((product) => {
          productsMap.set(product.id, { id: product.id, name: product.name })
        })

        const cartItemsToInsert = orderItems.map((item) => {
          let productId: string | null = null
          let itemName: string = item.name

          const productInfo = productsMap.get(item.id)
          if (productInfo) {
            productId = productInfo.id
            itemName = productInfo.name
          }

          return {
            cart_id: currentCartId,
            product_id: productId,
            item_name: itemName,
            quantity: item.amount,
            unit_price: item.price,
          }
        })

        const { error: insertItemsError } = await supabase.from("cart_items").insert(cartItemsToInsert)

        if (insertItemsError) throw insertItemsError
      }

      // Update original state
      setOriginalCartAppointments([...cartAppointments])

      setOriginalOrderItems([...orderItems])
      setCartSaved(true)

      setTimeout(() => {
        setCartSaved(false)
      }, 3000)
    } catch (err) {
      console.error("Error saving products:", err)
      throw err
    } finally {
      setIsSavingCart(false)
    }
  }

  // Save cart (legacy mode for single appointment)
  const handleSaveCart = async (): Promise<string | null> => {
    if (providedCartId) {
      // New mode: save cart with multiple appointments
      return handleSaveCartWithAppointments()
    } else if (!appointment?.id || !appointment?.serviceType) {
      return null
    }

    // Legacy mode: single appointment
    setIsSavingCart(true)
    try {
      const appointmentIdField = "grooming_appointment_id"

      let currentCartId = cartId

      // Create or update cart
      if (currentCartId) {
        // Update existing cart
        const { error: updateError } = await supabase
          .from("carts")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentCartId)

        if (updateError) throw updateError

        // Update cart_appointment price
        const { error: updateApptError } = await supabase
          .from("cart_appointments")
          .update({
            appointment_price: parseFloat(appointmentPrice) || 0,
          })
          .eq("cart_id", currentCartId)
          .or(`${appointmentIdField}.eq.${appointment.id}`)

        if (updateApptError) throw updateApptError
      } else {
        // Create new cart
        const cartData: any = {
          status: "active",
        }

        if (appointment.clientId) {
          cartData.customer_id = appointment.clientId
        }

        const { data: newCart, error: createError } = await supabase
          .from("carts")
          .insert(cartData)
          .select("id")
          .single()

        if (createError) throw createError
        currentCartId = newCart.id
        setCartId(currentCartId)

        // Create cart_appointment entry
        const { error: cartApptError } = await supabase.from("cart_appointments").insert({
          cart_id: currentCartId,
          [appointmentIdField]: appointment.id,
          appointment_price: parseFloat(appointmentPrice) || 0,
        })

        if (cartApptError) throw cartApptError
      }

      // Delete existing cart items
      const { error: deleteError } = await supabase.from("cart_items").delete().eq("cart_id", currentCartId)

      if (deleteError) throw deleteError

      // Insert new cart items
      if (orderItems.length > 0) {
        // Batch fetch all products at once for better performance
        const productIdsToLookup = orderItems
          .filter((item) => item.id && !item.id.startsWith("temp_"))
          .map((item) => item.id)

        let productsMap = new Map<string, { id: string; name: string }>()

        if (productIdsToLookup.length > 0) {
          // Fetch products by UUID
          const { data: productsById } = await supabase.from("products").select("id, name").in("id", productIdsToLookup)

          if (productsById) {
            productsById.forEach((product) => {
              productsMap.set(product.id, { id: product.id, name: product.name })
            })
          }
        }

        // Map order items to cart items
        const cartItemsToInsert = orderItems.map((item) => {
          let productId: string | null = null
          let itemName: string = item.name

          // Check if this is a product (not a temp item)
          if (item.id && !item.id.startsWith("temp_")) {
            const product = productsMap.get(item.id)
            if (product) {
              productId = product.id
              itemName = product.name || item.name
            }
            // If not found in map, it's a temp item - productId stays null, itemName is already set
          }

          return {
            cart_id: currentCartId,
            product_id: productId,
            item_name: itemName,
            quantity: item.amount,
            unit_price: item.price,
          }
        })

        const { error: insertError } = await supabase.from("cart_items").insert(cartItemsToInsert)

        if (insertError) throw insertError
      }

      setOriginalOrderItems([...orderItems])
      setCartSaved(true)

      setTimeout(() => {
        setCartSaved(false)
      }, 3000)

      return currentCartId
    } catch (err) {
      console.error("Error saving cart:", err)
      throw err
    } finally {
      setIsSavingCart(false)
    }
  }

  // Send payment request
  const handleSendPaymentRequest = async () => {
    if (!appointment?.id || (paymentSubType !== "bit" && paymentSubType !== "paybox")) return

    setIsSendingPaymentRequest(true)
    try {
      if (orderItems.length === 0 && (!providedCartId || cartAppointments.length === 0)) {
        throw new Error("לא ניתן לשלוח בקשת תשלום ללא פריטים בעגלה")
      }

      // Collect all recipient phone numbers with names
      const recipientPhones: string[] = []
      const recipientNames: Map<string, string> = new Map()

      // Add owner phone if selected
      if (recipientSelection.ownerPhone) {
        recipientPhones.push(recipientSelection.ownerPhone)
        if (appointment?.clientName) {
          recipientNames.set(recipientSelection.ownerPhone, appointment.clientName)
        }
      }

      // Add selected contact phones
      if (recipientSelection.selectedContactIds.length > 0 && appointment?.clientId) {
        const { data: contacts } = await supabase
          .from("customer_contacts")
          .select("phone, name")
          .in("id", recipientSelection.selectedContactIds)
          .eq("customer_id", appointment.clientId)

        if (contacts) {
          contacts.forEach((contact) => {
            if (contact.phone) {
              recipientPhones.push(contact.phone)
              recipientNames.set(contact.phone, contact.name || appointment?.clientName || "לקוח")
            }
          })
        }
      }

      // Add custom phones
      recipientSelection.customPhones.forEach((customPhone) => {
        if (customPhone.phone && customPhone.name) {
          recipientPhones.push(customPhone.phone)
          recipientNames.set(customPhone.phone, customPhone.name)
        }
      })

      if (recipientPhones.length === 0) {
        throw new Error("יש לבחור לפחות נמען אחד לשליחת בקשת התשלום")
      }

      let currentCartId = cartId
      if (isCartDirty || !currentCartId) {
        const savedCartId = await handleSaveCart()
        if (!savedCartId) {
          throw new Error("לא הצלחנו לשמור או ליצור עגלה")
        }
        currentCartId = savedCartId
      }

      if (!currentCartId) {
        throw new Error("לא הצלחנו לקבל מזהה עגלה")
      }

      // Get first appointment ID for the request
      let appointmentIdForRequest = appointment.id
      if (providedCartId && cartAppointments.length > 0) {
        const firstAppointment = cartAppointments[0]?.appointment
        if (firstAppointment?.id) {
          appointmentIdForRequest = firstAppointment.id
        }
      }

      // Prepare recipients with names
      const recipients = recipientPhones.map((phone) => ({
        phone,
        name: recipientNames.get(phone) || appointment?.clientName || "לקוח",
      }))

      const { error } = await supabase.functions.invoke("send-payment-request", {
        body: {
          cartId: currentCartId,
          appointmentId: appointmentIdForRequest,
          paymentGateway: paymentSubType === "bit" ? "bit" : "paybox",
          recipients: recipients, // Send array of {phone, name} objects
        },
      })

      if (error) throw error

      toast({
        title: "בקשת תשלום נשלחה",
        description: `נשלחה בקשת תשלום ל-${recipientPhones.length} נמען/ים`,
      })

      // Don't close the modal - user can continue or mark as received
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "אירעה שגיאה בשליחת בקשת התשלום"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
      throw err
    } finally {
      setIsSendingPaymentRequest(false)
    }
  }

  const handleMarkAsReceived = async () => {
    if (!appointment?.id || (paymentSubType !== "bit" && paymentSubType !== "paybox")) return

    setIsMarkingAsReceived(true)
    try {
      const receivedAmountNum = parseFloat(receivedAmount)
      if (isNaN(receivedAmountNum) || receivedAmountNum <= 0) {
        throw new Error("יש להזין סכום תשלום תקין")
      }

      // Set paidSum to the received amount
      setPaidSum(receivedAmount)

      // Temporarily change payment type to cash to use the existing payment flow
      // Use a synchronous approach to ensure the state is updated
      const originalPaymentSubType = paymentSubType

      // Directly call handleConfirm with cash payment type
      // We'll pass a flag or modify the logic to treat this as paid
      // Temporarily set paymentSubType to cash and paidSum, then call handleConfirm
      // We need to ensure the state is updated, so we'll use a workaround
      const originalPaidSum = paidSum
      setPaidSum(receivedAmount)
      setPaymentSubType("cash")

      // Wait a tick to ensure state updates
      await new Promise((resolve) => setTimeout(resolve, 0))

      try {
        // Use handleConfirm which will process the payment with the received amount
        await handleConfirm()
      } finally {
        // Restore original values (though modal will close anyway)
        setPaymentSubType(originalPaymentSubType)
        setPaidSum(originalPaidSum)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "אירעה שגיאה בסימון התשלום"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
      throw err
    } finally {
      setIsMarkingAsReceived(false)
    }
  }

  // Navigation handlers
  const handleBackStep = () => {
    if (step === 4) {
      setStep(3)
    } else if (step === 3) {
      setStep(2)
      setPaymentSubType(null)
    } else if (step === 2) {
      setStep(1)
      setPaymentType(null)
    }
  }

  const handleContinueFromStep1 = async () => {
    // Save appointment price if it's dirty before continuing
    if (isPriceDirty() && appointment?.id && !isSavingPrice) {
      await handleSavePrice()
    }

    // Save cart if it's dirty before continuing
    if (isCartDirty && !isSavingCart) {
      if (providedCartId) {
        // Cart mode: save cart with appointments
        await handleSaveCartWithAppointments()
      } else if (cartId || appointment?.id) {
        // Single appointment mode: save cart
        await handleSaveCart()
      }
    }

    // If no cart exists for this appointment, create one
    if (appointment?.id && appointment?.serviceType && !cartId && !providedCartId) {
      try {
        const appointmentIdField = "grooming_appointment_id"

        // Create new cart
        const cartData: any = {
          status: "active",
        }

        if (appointment.clientId) {
          cartData.customer_id = appointment.clientId
        }

        const { data: newCart, error: createError } = await supabase
          .from("carts")
          .insert(cartData)
          .select("id")
          .single()

        if (createError) {
          console.error("Error creating cart:", createError)
          toast({
            title: "שגיאה",
            description: "לא הצלחנו ליצור עגלה",
            variant: "destructive",
          })
          return
        }

        const newCartId = newCart.id
        setCartId(newCartId)

        // Create cart_appointment entry
        const { error: cartApptError } = await supabase.from("cart_appointments").insert({
          cart_id: newCartId,
          [appointmentIdField]: appointment.id,
          appointment_price: parseFloat(appointmentPrice) || 0,
        })

        if (cartApptError) {
          console.error("Error creating cart appointment:", cartApptError)
          toast({
            title: "שגיאה",
            description: "לא הצלחנו ליצור קשר בין העגלה לתור",
            variant: "destructive",
          })
          return
        }

        console.log("✅ [PaymentModal] Created cart for appointment:", newCartId)
      } catch (err) {
        console.error("Error creating cart:", err)
        toast({
          title: "שגיאה",
          description: "לא הצלחנו ליצור עגלה",
          variant: "destructive",
        })
        return
      }
    }

    setStep(2)
  }

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      console.log("🔄 [PaymentModal] Starting payment confirmation", {
        paymentType,
        paymentSubType,
        hasReceipt,
        paidSum,
        isCartPaid,
        providedCartId,
        cartId,
        orderItemsCount: orderItems.length,
        cartAppointmentsCount: cartAppointments.length,
      })

      // Check if cart is already paid
      if (isCartPaid) {
        throw new Error("העגלה כבר שולמה. לא ניתן לבצע תשלום נוסף.")
      }

      // If payment_page is selected, open payment iframe instead of creating order directly
      if (paymentSubType === "payment_page") {
        await handleOpenPaymentPage()
        setIsConfirming(false)
        return
      }

      // Ensure cart is saved before creating order
      let currentCartId = cartId
      if (isCartDirty || !currentCartId) {
        const savedCartId = await handleSaveCart()
        if (!savedCartId) {
          throw new Error("לא הצלחנו לשמור את העגלה")
        }
        currentCartId = savedCartId
      }

      if (!currentCartId) {
        throw new Error("חסרים פרטים ליצירת הזמנה")
      }

      // Fetch actual cart data from database to validate
      const { data: cartData, error: cartDataError } = await supabase
        .from("carts")
        .select(
          `
                    cart_items(quantity, unit_price),
                    cart_appointments(appointment_price, grooming_appointment_id)
                `
        )
        .eq("id", currentCartId)
        .single()

      if (cartDataError) {
        console.error("❌ [PaymentModal] Error fetching cart data:", cartDataError)
      }

      // Calculate totals from actual database data
      const actualCartItems = (cartData?.cart_items || []) as Array<{ quantity: number; unit_price: number }>
      const actualCartAppointments = (cartData?.cart_appointments || []) as Array<{
        appointment_price: number
        grooming_appointment_id: string | null
      }>

      const actualProductsTotal = actualCartItems.reduce(
        (sum, item) => sum + (item.unit_price || 0) * (item.quantity || 0),
        0
      )
      const actualAppointmentsTotal = actualCartAppointments.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)

      // If cart_appointments have no prices but have appointment references, fetch prices from appointments
      let directAppointmentPrice = 0
      if (actualAppointmentsTotal === 0 && actualCartAppointments.length > 0) {
        for (const ca of actualCartAppointments) {
          if (ca.grooming_appointment_id) {
            const { data: groomingAppt } = await supabase
              .from("grooming_appointments")
              .select("amount_due")
              .eq("id", ca.grooming_appointment_id)
              .single()
            directAppointmentPrice += groomingAppt?.amount_due || 0
          }
        }
      }

      // Use cart_appointments total, or fallback to direct appointment prices
      const finalAppointmentsFromDB = actualAppointmentsTotal > 0 ? actualAppointmentsTotal : directAppointmentPrice

      // Also calculate from state for comparison
      const productsTotal = orderItems.reduce((sum, item) => sum + item.price * item.amount, 0)
      let appointmentPriceValue = 0

      if (providedCartId && cartAppointments.length > 0) {
        // Sum all appointment prices (excluding temporary grooming products)
        appointmentPriceValue = cartAppointments
          .filter((ca) => !(ca.appointment as any)?._isTempGroomingProduct)
          .reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
      } else if (appointment) {
        // Legacy mode: single appointment price
        appointmentPriceValue = parseFloat(appointmentPrice) || 0
      }

      // Use the maximum of actual database data or state data
      // Include both cart_appointments and direct appointment prices
      // If state has items but DB doesn't (cart not saved yet), use state values
      const dbTotal = actualProductsTotal + finalAppointmentsFromDB
      const stateTotal = productsTotal + appointmentPriceValue
      const totalAmount = Math.max(dbTotal, stateTotal)

      console.log("📊 [PaymentModal] Cart totals:", {
        currentCartId,
        actualProductsTotal,
        actualAppointmentsTotal,
        directAppointmentPrice,
        finalAppointmentsFromDB,
        productsTotal,
        appointmentPriceValue,
        totalAmount,
        actualCartItemsCount: actualCartItems?.length || 0,
        actualCartAppointmentsCount: actualCartAppointments?.length || 0,
        hasGroomingAppts: actualCartAppointments.some((ca) => ca.grooming_appointment_id),
        hasDaycareAppts: false,
        orderItemsCount: orderItems.length,
        cartAppointmentsCount: cartAppointments.length,
        cartAppointments: cartAppointments.map((ca) => ({
          id: ca.id,
          price: ca.appointment_price,
          groomingId: ca.grooming_appointment_id,
        })),
        actualCartItems: actualCartItems,
        actualCartAppointments: actualCartAppointments,
      })

      // Validate that there's something to pay for
      // Check both database totals and state totals - if either has items, allow payment
      const hasItemsInDB = actualCartItems.length > 0 || actualCartAppointments.length > 0
      const hasItemsInState = orderItems.length > 0 || cartAppointments.length > 0

      if (totalAmount <= 0 && !hasItemsInDB && !hasItemsInState) {
        console.error("❌ [PaymentModal] No items found:", {
          totalAmount,
          hasItemsInDB,
          hasItemsInState,
          actualCartItems: actualCartItems.length,
          actualCartAppointments: actualCartAppointments.length,
          orderItems: orderItems.length,
          cartAppointments: cartAppointments.length,
        })
        throw new Error("לא ניתן לבצע תשלום - אין פריטים או תורים בעגלה")
      }

      // If totalAmount is 0 but we have items, use a minimum of 1 or recalculate from state
      const finalTotalAmount =
        totalAmount > 0 ? totalAmount : hasItemsInState ? Math.max(productsTotal + appointmentPriceValue, 1) : 0

      if (finalTotalAmount <= 0) {
        throw new Error("לא ניתן לבצע תשלום - אין פריטים או תורים בעגלה")
      }

      // For wire/cash payments, use paidSum if provided, otherwise use totalAmount
      const isWireOrCash = paymentSubType === "bank_transfer" || paymentSubType === "cash"
      const paidAmount = isWireOrCash && paidSum ? parseFloat(paidSum) : totalAmount

      if (isWireOrCash && (!paidSum || isNaN(paidAmount) || paidAmount <= 0)) {
        throw new Error("יש להזין סכום תשלום תקין")
      }

      // Create order from cart
      // Use actual totals from database, fallback to state if needed
      const finalProductsTotal = actualProductsTotal > 0 ? actualProductsTotal : productsTotal
      const finalAppointmentsTotal = finalAppointmentsFromDB > 0 ? finalAppointmentsFromDB : appointmentPriceValue
      const finalSubtotal = finalProductsTotal + finalAppointmentsTotal
      const finalTotal = isWireOrCash ? paidAmount : totalAmount

      const orderData: any = {
        cart_id: currentCartId,
        status: isWireOrCash ? "paid" : "pending",
        subtotal: finalSubtotal,
        total: finalTotal, // For wire/cash, use paid amount as total
      }

      // Store payment method in metadata (since payment_method column may not exist)
      // We'll use a payments record to track the payment method
      const paymentMethod = paymentSubType || paymentType || "bank_transfer"

      // Add appointment fields only if we have appointments (legacy mode)
      if (appointment?.id && appointment?.serviceType) {
        const appointmentIdField = "grooming_appointment_id"
        orderData[appointmentIdField] = appointment.id
      }

      // Add customer_id if available
      if (appointment?.clientId) {
        orderData.customer_id = appointment.clientId
      } else if (providedCartId) {
        // Try to get customer_id from cart
        const { data: cartData } = await supabase.from("carts").select("customer_id").eq("id", currentCartId).single()

        if (cartData?.customer_id) {
          orderData.customer_id = cartData.customer_id
        }
      }

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select("id")
        .single()

      if (orderError) throw orderError

      // Fetch cart items to copy to order_items
      const { data: cartItems, error: fetchCartItemsError } = await supabase
        .from("cart_items")
        .select("product_id, item_name, quantity, unit_price")
        .eq("cart_id", currentCartId)

      if (fetchCartItemsError) throw fetchCartItemsError

      // Create order_items from cart_items (immutable snapshot)
      if (cartItems && cartItems.length > 0) {
        const orderItemsToInsert = cartItems.map((item) => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          item_name: item.item_name || "פריט ללא שם",
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))

        const { error: orderItemsError } = await supabase.from("order_items").insert(orderItemsToInsert)

        if (orderItemsError) throw orderItemsError
      }

      // Mark cart as completed
      const { error: cartUpdateError } = await supabase
        .from("carts")
        .update({ status: "completed" })
        .eq("id", currentCartId)

      if (cartUpdateError) {
        console.error("Error updating cart status:", cartUpdateError)
        // Don't throw - order is already created
      }

      // Create payment record to store payment method
      let paymentRecordId: string | null = null
      if (orderData.customer_id) {
        try {
          console.log("💳 [PaymentModal] Creating payment record", {
            orderId: newOrder.id,
            customerId: orderData.customer_id,
            amount: paidAmount,
            method: paymentMethod,
          })

          const { data: paymentRecord, error: paymentError } = await supabase
            .from("payments")
            .insert({
              customer_id: orderData.customer_id,
              amount: paidAmount,
              method: paymentMethod,
              status: isWireOrCash ? "paid" : "unpaid",
              metadata: {
                order_id: newOrder.id,
                cart_id: currentCartId,
                payment_type: paymentType,
                payment_sub_type: paymentSubType,
                paid_amount: isWireOrCash ? paidAmount : null,
              },
            })
            .select("id")
            .single()

          if (paymentError) {
            console.error("❌ [PaymentModal] Error creating payment record:", paymentError)
            // Don't throw - order is already created
          } else {
            paymentRecordId = paymentRecord.id
            console.log("✅ [PaymentModal] Payment record created:", paymentRecordId)
          }
        } catch (paymentErr) {
          console.error("❌ [PaymentModal] Error creating payment record:", paymentErr)
          // Don't throw - order is already created
        }
      }

      // Create invoice if hasReceipt is checked and payment is wire/cash
      if (hasReceipt && isWireOrCash && paymentRecordId && orderData.customer_id) {
        try {
          console.log("📄 [PaymentModal] Creating invoice for payment", {
            paymentId: paymentRecordId,
            orderId: newOrder.id,
            customerId: orderData.customer_id,
          })

          // Get customer email for invoice
          const { data: customerData } = await supabase
            .from("customers")
            .select("email")
            .eq("id", orderData.customer_id)
            .single()

          const customerEmail = customerData?.email || ""

          if (customerEmail) {
            const { data: invoiceResult, error: invoiceError } = await supabase.functions.invoke("send-invoice", {
              body: {
                paymentId: paymentRecordId,
                email: customerEmail,
                customerId: orderData.customer_id,
              },
            })

            if (invoiceError) {
              console.error("❌ [PaymentModal] Invoice creation failed:", invoiceError)
              toast({
                title: "שגיאה ביצירת חשבונית",
                description: "התשלום בוצע בהצלחה, אך לא הצלחנו ליצור חשבונית. נסה ליצור חשבונית מאוחר יותר.",
                variant: "destructive",
              })
            } else {
              // Check the response data for success/error
              const result = invoiceResult as any
              if (result && typeof result === "object") {
                if ("success" in result && result.success === false) {
                  const errorMessage = result.error || "נכשל ביצירת חשבונית"
                  console.error("❌ [PaymentModal] Invoice creation failed:", errorMessage)
                  toast({
                    title: "שגיאה ביצירת חשבונית",
                    description: `התשלום בוצע בהצלחה, אך לא הצלחנו ליצור חשבונית: ${errorMessage}`,
                    variant: "destructive",
                  })
                } else {
                  console.log("✅ [PaymentModal] Invoice created successfully")
                }
              } else {
                console.log("✅ [PaymentModal] Invoice created successfully")
              }
            }
          } else {
            console.warn("⚠️ [PaymentModal] Customer email not found, skipping invoice creation")
          }
        } catch (invoiceErr) {
          console.error("❌ [PaymentModal] Error creating invoice:", invoiceErr)
          toast({
            title: "שגיאה ביצירת חשבונית",
            description: "התשלום בוצע בהצלחה, אך אירעה שגיאה ביצירת חשבונית.",
            variant: "destructive",
          })
        }
      }

      // Invalidate cache for all appointments in the cart to refresh paid status
      const appointmentIdsToInvalidate = new Set<string>()

      // Add appointments from cart_appointments
      if (actualCartAppointments && actualCartAppointments.length > 0) {
        actualCartAppointments.forEach((ca) => {
          if (ca.grooming_appointment_id) {
            appointmentIdsToInvalidate.add(ca.grooming_appointment_id)
          }
        })
      }

      // Add appointments from state
      if (cartAppointments && cartAppointments.length > 0) {
        cartAppointments.forEach((ca) => {
          if (ca.grooming_appointment_id) {
            appointmentIdsToInvalidate.add(ca.grooming_appointment_id)
          }
        })
      }

      // Add legacy appointment if exists
      if (appointment?.id) {
        appointmentIdsToInvalidate.add(appointment.id)
      }

      // Invalidate cache for all affected appointments
      if (appointmentIdsToInvalidate.size > 0) {
        const tagsToInvalidate = Array.from(appointmentIdsToInvalidate).flatMap((apptId) => [
          { type: "Appointment" as const, id: `orders-grooming-${apptId}` },
          { type: "Appointment" as const, id: `orders-garden-${apptId}` },
        ])

        dispatch(supabaseApi.util.invalidateTags(tagsToInvalidate))
        console.log("🔄 [PaymentModal] Invalidated cache for appointments:", Array.from(appointmentIdsToInvalidate))
      }

      const paymentData: PaymentData = {
        amount: isWireOrCash ? paidAmount : totalAmount,
        paymentMethod: (paymentSubType || paymentType) as "apps" | "credit" | "bank_transfer",
        orderItems,
        hasReceipt,
        editedAppointmentPrice: appointmentPriceValue,
      }

      console.log("✅ [PaymentModal] Payment confirmed successfully", {
        orderId: newOrder.id,
        amount: isWireOrCash ? paidAmount : totalAmount,
        paymentMethod: paymentMethod,
      })

      onConfirm(paymentData)
      handleReset()
    } catch (err) {
      console.error("❌ [PaymentModal] Error creating order from cart:", err)
      // Re-throw the error so the UI can show it to the user
      throw err
    } finally {
      setIsConfirming(false)
    }
  }

  // Handle opening payment page with Tranzila handshake
  const handleOpenPaymentPage = async () => {
    try {
      setIsLoadingHandshake(true)

      // Ensure cart is saved first
      let currentCartId = cartId
      if (isCartDirty || !currentCartId) {
        const savedCartId = await handleSaveCart()
        if (!savedCartId) {
          throw new Error("לא הצלחנו לשמור את העגלה")
        }
        currentCartId = savedCartId
      }

      if (!currentCartId) {
        throw new Error("חסרים פרטים ליצירת הזמנה")
      }

      // Calculate total amount
      const productsTotal = orderItems.reduce((sum, item) => sum + item.price * item.amount, 0)
      let appointmentPriceValue = 0

      if (providedCartId && cartAppointments.length > 0) {
        appointmentPriceValue = cartAppointments.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
      } else if (appointment) {
        appointmentPriceValue = parseFloat(appointmentPrice) || 0
      }

      const totalAmount = productsTotal + appointmentPriceValue

      if (totalAmount <= 0) {
        throw new Error("לא ניתן לבצע תשלום - אין פריטים או תורים בעגלה")
      }

      // Get customer info for payment
      let customerId: string | null = null
      let customerName = ""
      let customerPhone = ""
      let customerEmail = ""

      if (appointment?.clientId) {
        customerId = appointment.clientId
        customerName = appointment.clientName || ""
        customerPhone = appointment.clientPhone || ""
        customerEmail = appointment.clientEmail || ""
      } else if (providedCartId) {
        const { data: cartData } = await supabase
          .from("carts")
          .select("customer_id, customers(id, full_name, phone, email)")
          .eq("id", currentCartId)
          .single()

        if (cartData?.customer_id) {
          customerId = cartData.customer_id
          const customer = cartData.customers as any
          customerName = customer?.full_name || ""
          customerPhone = customer?.phone || ""
          customerEmail = customer?.email || ""
        }
      }

      if (!customerId) {
        throw new Error("לא נמצא לקוח לעגלה")
      }

      // Call tranzila-handshake to get thtk
      console.log("🤝 [PaymentModal] Getting Tranzila handshake token...", { totalAmount })
      const { data: handshakeData, error: handshakeError } = await supabase.functions.invoke("tranzila-handshake", {
        body: { sum: totalAmount },
      })

      // Log detailed error information for debugging
      if (handshakeError) {
        console.error("❌ [PaymentModal] Handshake error details:", {
          message: handshakeError.message,
          context: handshakeError.context,
          status: handshakeError.status,
          error: handshakeError,
        })
      }

      if (handshakeData && !handshakeData.success) {
        console.error("❌ [PaymentModal] Handshake returned unsuccessful:", handshakeData)
      }

      // Check for errors - either in error object or in data.error field
      if (handshakeError || !handshakeData?.success || !handshakeData?.thtk) {
        // Extract error message from multiple possible sources
        let errorMessage = "לא ניתן להתחבר למערכת התשלומים"

        if (handshakeError) {
          errorMessage = handshakeError.message || errorMessage
        } else if (handshakeData?.error) {
          errorMessage = handshakeData.error
        } else if (handshakeData && !handshakeData.success) {
          errorMessage = handshakeData.error || "שגיאה ביצירת חיבור למערכת התשלומים"
        }

        console.error("❌ [PaymentModal] Handshake failed:", {
          handshakeError,
          handshakeData,
          errorMessage,
          hasData: !!handshakeData,
          dataSuccess: handshakeData?.success,
          hasThtk: !!handshakeData?.thtk,
        })
        throw new Error(errorMessage)
      }

      const thtk = handshakeData.thtk
      console.log("✅ [PaymentModal] Handshake successful, token received")

      // Build POST data for Tranzila iframe
      const buildPostData = (): Record<string, string | number> => {
        const postData: Record<string, string | number> = {}

        const addParam = (key: string, value: string | number) => {
          if (value !== null && value !== undefined && value !== "") {
            postData[key] = value
          }
        }

        // Add supplier (required for Tranzila)
        addParam("supplier", "bloved29")

        // Add thtk token from handshake
        addParam("thtk", thtk)

        // Required parameters
        addParam("new_process", 1)
        addParam("lang", "il")
        addParam("sum", totalAmount)
        addParam("currency", 1)
        addParam("tranmode", "AK")

        // For single payments, use cred_type=1 (One payment - default)
        // cred_type options: 1 = One payment, 6 = Credit installments, 8 = Installments
        addParam("cred_type", 1) // Single payment

        // Add customer information
        if (customerName) {
          addParam("contact", customerName)
          addParam("customer_name", customerName)
        }
        if (customerPhone) {
          addParam("phone", customerPhone.replace(/\D/g, ""))
        }
        if (customerEmail) {
          addParam("email", customerEmail)
        }
        if (customerId) {
          addParam("record_id", customerId)
        }

        // Add custom data with cart ID
        addParam(
          "mymore",
          JSON.stringify({
            cart_id: currentCartId,
            payment_type: paymentType,
          })
        )

        // Add product list as JSON
        const productList = [
          ...orderItems.map((item) => ({
            product_name: item.name,
            product_quantity: item.amount,
            product_price: item.price,
          })),
          ...(appointmentPriceValue > 0
            ? [
                {
                  product_name: (() => {
                    if (providedCartId && cartAppointments.length > 0) {
                      // Get dog names from cart appointments
                      const dogNames = cartAppointments
                        .map((ca) => ca.appointment?.dogs?.[0]?.name)
                        .filter((name): name is string => !!name)
                        .join(", ")
                      return dogNames ? `תספורת - ${dogNames}` : `תורים (${cartAppointments.length})`
                    } else if (appointment?.serviceType === "grooming" && appointment?.dogs?.[0]?.name) {
                      return `תספורת - ${appointment.dogs[0]?.name || ""}`
                    }
                    return "תור"
                  })(),
                  product_quantity: 1,
                  product_price: appointmentPriceValue,
                },
              ]
            : []),
        ]
        addParam("json_purchase_data", JSON.stringify(productList))
        addParam("u71", 1)

        // Add notify_url_address for callback
        const supabaseUrl = import.meta.env.VITE_PROD_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
        if (supabaseUrl) {
          const notifyUrl = `${supabaseUrl}/functions/v1/payment-received-callback`
          addParam("notify_url_address", notifyUrl)
        }

        return postData
      }

      const paymentPostData = buildPostData()

      console.log("📋 [PaymentModal] Payment POST Data prepared:", {
        supplier: paymentPostData.supplier,
        hasThtk: !!paymentPostData.thtk,
        totalAmount,
        customerId,
      })

      setPaymentPostData(paymentPostData)
      setShowPaymentIframe(true)
    } catch (error) {
      console.error("❌ [PaymentModal] Error opening payment page:", error)
      throw error
    } finally {
      setIsLoadingHandshake(false)
    }
  }

  // Handle payment iframe success
  const handlePaymentIframeSuccess = async (data?: any) => {
    console.log("✅ [PaymentModal] Payment successful:", data)

    // Close iframe and proceed with order creation
    setShowPaymentIframe(false)
    setPaymentPostData(undefined)

    // Create order from cart (similar to handleConfirm)
    try {
      let currentCartId = cartId
      if (!currentCartId) {
        const savedCartId = await handleSaveCart()
        if (!savedCartId) {
          throw new Error("לא הצלחנו לשמור את העגלה")
        }
        currentCartId = savedCartId
      }

      if (!currentCartId) {
        throw new Error("חסרים פרטים ליצירת הזמנה")
      }

      const productsTotal = orderItems.reduce((sum, item) => sum + item.price * item.amount, 0)
      let appointmentPriceValue = 0

      if (providedCartId && cartAppointments.length > 0) {
        appointmentPriceValue = cartAppointments.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
      } else if (appointment) {
        appointmentPriceValue = parseFloat(appointmentPrice) || 0
      }

      const totalAmount = productsTotal + appointmentPriceValue

      const orderData: any = {
        cart_id: currentCartId,
        status: "pending",
        subtotal: productsTotal,
        total: totalAmount,
        payment_method: paymentType || "credit",
      }

      if (appointment?.id && appointment?.serviceType) {
        const appointmentIdField = "grooming_appointment_id"
        orderData[appointmentIdField] = appointment.id
      }

      if (appointment?.clientId) {
        orderData.customer_id = appointment.clientId
      } else if (providedCartId) {
        const { data: cartData } = await supabase.from("carts").select("customer_id").eq("id", currentCartId).single()

        if (cartData?.customer_id) {
          orderData.customer_id = cartData.customer_id
        }
      }

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select("id")
        .single()

      if (orderError) throw orderError

      const { data: cartItems, error: cartItemsError } = await supabase
        .from("cart_items")
        .select("product_id, item_name, quantity, unit_price")
        .eq("cart_id", currentCartId)

      if (cartItemsError) throw cartItemsError

      if (cartItems && cartItems.length > 0) {
        const orderItemsToInsert = cartItems.map((item) => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          item_name: item.item_name || "פריט ללא שם",
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))

        const { error: orderItemsError } = await supabase.from("order_items").insert(orderItemsToInsert)

        if (orderItemsError) throw orderItemsError
      }

      const { error: cartUpdateError } = await supabase
        .from("carts")
        .update({ status: "completed" })
        .eq("id", currentCartId)

      if (cartUpdateError) {
        console.error("Error updating cart status:", cartUpdateError)
      }

      const paymentData: PaymentData = {
        amount: totalAmount,
        paymentMethod: paymentType || "credit",
        orderItems,
        hasReceipt,
        editedAppointmentPrice: appointmentPriceValue,
      }

      onConfirm(paymentData)
      handleReset()
    } catch (err) {
      console.error("Error creating order after payment:", err)
      throw err
    }
  }

  // Handle payment iframe error
  const handlePaymentIframeError = (error: string) => {
    console.error("❌ [PaymentModal] Payment error:", error)
    setShowPaymentIframe(false)
    setPaymentPostData(undefined)
  }

  // Handle saved card payment via API
  const handleChargeSavedCard = async () => {
    try {
      setIsLoadingSavedCardPayment(true)

      const amount = parseFloat(savedCardAmount)
      if (!amount || amount <= 0) {
        throw new Error("יש להזין סכום תשלום תקין")
      }

      // Ensure cart is saved first
      let currentCartId = cartId
      if (isCartDirty || !currentCartId) {
        const savedCartId = await handleSaveCart()
        if (!savedCartId) {
          throw new Error("לא הצלחנו לשמור את העגלה")
        }
        currentCartId = savedCartId
      }

      // Get customer info
      let customerId: string | null = null

      if (appointment?.clientId) {
        customerId = appointment.clientId
      } else if (providedCartId || currentCartId) {
        const cartIdToUse = providedCartId || currentCartId
        const { data: cartData } = await supabase.from("carts").select("customer_id").eq("id", cartIdToUse).single()

        if (cartData?.customer_id) {
          customerId = cartData.customer_id
        }
      }

      if (!customerId) {
        throw new Error("לא נמצא לקוח")
      }

      // Get saved credit token with CVV
      const { data: creditToken, error: tokenError } = await supabase
        .from("credit_tokens")
        .select("id, token, cvv, last4")
        .eq("customer_id", customerId)
        .not("token", "is", null)
        .limit(1)
        .single()

      if (tokenError || !creditToken?.token) {
        throw new Error("לא נמצא כרטיס אשראי שמור במערכת")
      }

      // Build items array from orderItems and cartAppointments
      const items: Array<{
        name: string
        type: string
        unit_price: number
        units_number: number
      }> = []

      // Add products
      orderItems.forEach((item) => {
        items.push({
          name: item.name,
          type: "I", // Item
          unit_price: item.price,
          units_number: item.amount,
        })
      })

      // Add appointments
      let appointmentPriceValue = 0
      if (providedCartId && cartAppointments.length > 0) {
        appointmentPriceValue = cartAppointments.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
        if (appointmentPriceValue > 0) {
          // Get dog names from cart appointments
          const dogNames = cartAppointments
            .map((ca) => ca.appointment?.dogs?.[0]?.name)
            .filter((name): name is string => !!name)
            .join(", ")
          const productName = dogNames ? `תספורת - ${dogNames}` : `תורים (${cartAppointments.length})`
          items.push({
            name: productName,
            type: "I",
            unit_price: appointmentPriceValue,
            units_number: 1,
          })
        }
      } else if (appointment) {
        appointmentPriceValue = parseFloat(appointmentPrice) || 0
        if (appointmentPriceValue > 0) {
          const firstDog = appointment?.dogs?.[0]
          const productName =
            appointment?.serviceType === "grooming" && firstDog?.name ? `תספורת - ${firstDog.name}` : "תור"
          items.push({
            name: productName,
            type: "I",
            unit_price: appointmentPriceValue,
            units_number: 1,
          })
        }
      }

      // If amount is different from items total, add adjustment
      const itemsTotal = items.reduce((sum, item) => sum + item.unit_price * item.units_number, 0)
      if (Math.abs(amount - itemsTotal) > 0.01) {
        items.push({
          name: "התאמת סכום",
          type: "I",
          unit_price: amount - itemsTotal,
          units_number: 1,
        })
      }

      console.log("💳 [PaymentModal] Charging saved card via API:", {
        customerId,
        amount,
        itemsCount: items.length,
        hasToken: !!creditToken.token,
        hasCvv: !!creditToken.cvv,
      })

      // Call charge-saved-card function
      const { data: chargeData, error: chargeError } = await supabase.functions.invoke("charge-saved-card", {
        body: {
          token: creditToken.token,
          cvv: creditToken.cvv,
          amount: amount,
          items: items,
          customerId: customerId,
          cartId: currentCartId,
        },
      })

      if (chargeError || !chargeData?.success) {
        throw new Error(chargeError?.message || chargeData?.error || "לא הצלחנו לבצע תשלום")
      }

      console.log("✅ [PaymentModal] Saved card payment successful:", chargeData)

      // Create order from cart
      await handleSavedCardPaymentSuccess(chargeData, currentCartId, amount)
    } catch (error) {
      console.error("❌ [PaymentModal] Error charging saved card:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא הצלחנו לבצע תשלום",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSavedCardPayment(false)
    }
  }

  // Handle saved card payment success (create order)
  const handleSavedCardPaymentSuccess = async (chargeData: any, currentCartId: string, amount: number) => {
    try {
      const productsTotal = orderItems.reduce((sum, item) => sum + item.price * item.amount, 0)
      let appointmentPriceValue = 0

      if (providedCartId && cartAppointments.length > 0) {
        appointmentPriceValue = cartAppointments.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
      } else if (appointment) {
        appointmentPriceValue = parseFloat(appointmentPrice) || 0
      }

      const orderData: any = {
        cart_id: currentCartId,
        status: "paid",
        subtotal: productsTotal + appointmentPriceValue,
        total: amount,
        payment_method: "saved_card",
      }

      if (appointment?.id && appointment?.serviceType) {
        const appointmentIdField = "grooming_appointment_id"
        orderData[appointmentIdField] = appointment.id
      }

      if (appointment?.clientId) {
        orderData.customer_id = appointment.clientId
      } else if (providedCartId || currentCartId) {
        const { data: cartData } = await supabase.from("carts").select("customer_id").eq("id", currentCartId).single()

        if (cartData?.customer_id) {
          orderData.customer_id = cartData.customer_id
        }
      }

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select("id")
        .single()

      if (orderError) throw orderError

      const { data: cartItems, error: cartItemsError } = await supabase
        .from("cart_items")
        .select("product_id, item_name, quantity, unit_price")
        .eq("cart_id", currentCartId)

      if (cartItemsError) throw cartItemsError

      if (cartItems && cartItems.length > 0) {
        const orderItemsToInsert = cartItems.map((item) => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          item_name: item.item_name || "פריט ללא שם",
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))

        const { error: orderItemsError } = await supabase.from("order_items").insert(orderItemsToInsert)

        if (orderItemsError) throw orderItemsError
      }

      const { error: cartUpdateError } = await supabase
        .from("carts")
        .update({ status: "completed" })
        .eq("id", currentCartId)

      if (cartUpdateError) {
        console.error("Error updating cart status:", cartUpdateError)
      }

      const paymentData: PaymentData = {
        amount: amount,
        paymentMethod: "credit",
        orderItems,
        hasReceipt,
        editedAppointmentPrice: appointmentPriceValue,
      }

      toast({
        title: "הצלחה",
        description: "התשלום בוצע בהצלחה",
      })

      onConfirm(paymentData)
      handleReset()
    } catch (err) {
      console.error("Error creating order after saved card payment:", err)
      throw err
    }
  }

  const handleReset = () => {
    setStep(1)
    setPaymentType(null)
    setPaymentSubType(null)
    setOrderItems([])
    setOriginalOrderItems([])
    setHasReceipt(true)
    setPaidSum("")
    setAppointmentPrice("0")
    setOriginalAppointmentPrice("0")
    setPriceSaved(false)
    setCartId(null)
    setCartSaved(false)
    setShowPaymentIframe(false)
    setPaymentPostData(undefined)
    setSavedCardAmount("")
  }

  const handleClose = () => {
    handleReset()
    onOpenChange(false)
  }

  // Input focus handlers
  const handleInputFocus = () => {
    setIsInputFocused(true)
    setShowProductSuggestions(true)
    // If we already have results, show them immediately
    if (filteredSearchResults.length > 0) {
      return
    }
    // Otherwise fetch initial products if input is empty
    if (tempNewItem.name.length === 0) {
      setIsLoadingInitialProducts(true)
      fetchInitialProducts()
    }
  }

  const handleInputBlur = () => {
    setIsInputFocused(false)
    setTimeout(() => {
      setShowProductSuggestions(false)
    }, 200)
  }

  // Temp item handlers
  const handleTempItemNameChange = (name: string) => {
    setTempNewItem({ ...tempNewItem, name })
  }

  const handleTempItemQuantityChange = (quantity: string) => {
    setTempNewItem({ ...tempNewItem, quantity })
  }

  const handleTempItemPriceChange = (price: string) => {
    setTempNewItem({ ...tempNewItem, price })
  }

  // Payment link handlers
  const generatePaymentLink = (shouldCreateInvoice: boolean = true) => {
    const currentCartId = cartId || providedCartId
    if (!currentCartId) {
      toast({
        title: "שגיאה",
        description: "לא ניתן ליצור קישור תשלום - חסר מזהה עגלה",
        variant: "destructive",
      })
      return
    }

    const origin =
      typeof globalThis !== "undefined" && typeof globalThis.location !== "undefined" ? globalThis.location.origin : ""
    const link = `${origin}/payment?cartId=${currentCartId}&shouldCreateInvoice=${shouldCreateInvoice}`
    setPaymentLink(link)
    return link
  }

  const copyPaymentLink = async () => {
    const linkToCopy = paymentLink || generatePaymentLink()
    if (!linkToCopy) return

    try {
      await navigator.clipboard.writeText(linkToCopy)
      setCopyLinkSuccess(true)
      toast({
        title: "הועתק",
        description: "קישור התשלום הועתק ללוח",
      })
      setTimeout(() => setCopyLinkSuccess(false), 2000)
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן להעתיק את הקישור",
        variant: "destructive",
      })
    }
  }

  const sendPaymentLink = async () => {
    const linkToSend = paymentLink || generatePaymentLink()
    if (!linkToSend) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לשלוח קישור תשלום - חסר קישור",
        variant: "destructive",
      })
      return
    }

    // Collect all recipient phone numbers with names
    const recipientPhones: string[] = []
    const recipientNames: Map<string, string> = new Map()

    // Add owner phone if selected
    if (paymentLinkRecipientSelection.ownerPhone) {
      recipientPhones.push(paymentLinkRecipientSelection.ownerPhone)
      if (appointment?.clientName) {
        recipientNames.set(paymentLinkRecipientSelection.ownerPhone, appointment.clientName)
      }
    }

    // Add selected contact phones
    if (paymentLinkRecipientSelection.selectedContactIds.length > 0 && appointment?.clientId) {
      const { data: contacts } = await supabase
        .from("customer_contacts")
        .select("phone, name")
        .in("id", paymentLinkRecipientSelection.selectedContactIds)
        .eq("customer_id", appointment.clientId)

      if (contacts) {
        contacts.forEach((contact) => {
          if (contact.phone) {
            recipientPhones.push(contact.phone)
            recipientNames.set(contact.phone, contact.name || appointment?.clientName || "לקוח")
          }
        })
      }
    }

    // Add custom phones
    paymentLinkRecipientSelection.customPhones.forEach((customPhone) => {
      if (customPhone.phone && customPhone.name) {
        recipientPhones.push(customPhone.phone)
        recipientNames.set(customPhone.phone, customPhone.name)
      }
    })

    if (recipientPhones.length === 0) {
      toast({
        title: "שגיאה",
        description: "יש לבחור לפחות נמען אחד לשליחת קישור התשלום",
        variant: "destructive",
      })
      return
    }

    try {
      // Import ManyChat flow ID
      const { MANYCHAT_FLOW_IDS } = await import("@/lib/manychat")
      const flowId = MANYCHAT_FLOW_IDS.SEND_TRANZILLA_PAYMENT_LINK

      if (!flowId) {
        throw new Error("ManyChat flow ID for SEND_TRANZILLA_PAYMENT_LINK not configured")
      }

      // Prepare users array for ManyChat
      const users = recipientPhones.map((phone) => ({
        phone: phone,
        name: recipientNames.get(phone) || appointment?.clientName || "לקוח",
        fields: {
          // Pass payment link as a custom field - ManyChat flow will use it
          // Note: You may need to add a custom field in ManyChat for payment_link
          // For now, we'll pass it and the flow can extract it from the URL or use a custom field
        },
      }))

      // Call set-manychat-fields-and-send-flow to send the payment link
      console.log(`📤 [PaymentModal] Sending Tranzila payment link to ${users.length} recipient(s)`)

      const { data: manychatResult, error: manychatError } = await supabase.functions.invoke(
        "set-manychat-fields-and-send-flow",
        {
          body: {
            users: users,
            flow_id: flowId,
          },
        }
      )

      if (manychatError) {
        console.error("Error calling ManyChat function:", manychatError)
        throw new Error(`Failed to send payment link via ManyChat: ${manychatError.message}`)
      }

      // Check results
      const results = manychatResult as Record<string, { success: boolean; error?: string }>
      const successCount = Object.values(results).filter((r) => r.success).length
      const failureCount = Object.values(results).filter((r) => !r.success).length

      console.log(`✅ [PaymentModal] Payment link sent to ${successCount} recipient(s), ${failureCount} failed`)

      if (successCount === 0) {
        throw new Error("Failed to send payment link to any recipients")
      }

      toast({
        title: "קישור נשלח",
        description: `קישור תשלום נשלח ל-${successCount} נמען/ים`,
      })

      // Start polling for payment
      startPollingPayment()
    } catch (error) {
      console.error("Error sending payment link:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא הצלחנו לשלוח את קישור התשלום",
        variant: "destructive",
      })
    }
  }

  const startPollingPayment = () => {
    if (!cartId && !providedCartId) return
    if (isPollingPayment) return

    setIsPollingPayment(true)
    const currentCartId = cartId || providedCartId

    const pollInterval = setInterval(async () => {
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, status")
        .eq("cart_id", currentCartId)
        .maybeSingle()

      if (orderData) {
        const status = (orderData.status || "").toLowerCase()
        const isPaid =
          status === "completed" || status === "paid" || status.includes("שולם") || status.includes("הושלם")

        if (isPaid) {
          clearInterval(pollInterval)
          setIsPollingPayment(false)
          setIsCartPaid(true)
          setPaidOrderId(orderData.id)
          toast({
            title: "תשלום התקבל",
            description: "התשלום התקבל בהצלחה",
          })
        }
      }
    }, 3000) // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
      setIsPollingPayment(false)
    }, 300000)
  }

  return {
    // State
    step,
    paymentType,
    paymentSubType,
    hasReceipt,
    paidSum,
    appointmentPrice,
    originalAppointmentPrice,
    isLoadingBreedPrices,
    breedPriceRange,
    showPreviousPayments,
    isSavingPrice,
    priceSaved,
    orderItems,
    isLoadingCart,
    isSavingCart,
    cartSaved,
    isSendingPaymentRequest,
    isAddingNewItem,
    tempNewItem,
    showProductSuggestions,
    isInputFocused,
    isLoadingInitialProducts,
    isLoadingProducts,
    hasSearchedProducts,
    filteredSearchResults,
    showProductCreateDialog,
    setShowProductCreateDialog,
    productToCreateName,
    setProductToCreateName,
    brands,
    // New: Cart appointments state
    cartAppointments,
    originalCartAppointments,
    isLoadingAppointments,
    originalOrderItems,
    products,

    // Computed
    breedPriceInfo: getBreedPriceInfo(),
    isPriceDirty: isPriceDirty(),
    calculateTotal,
    isCartDirty,
    isAppointmentsDirty,
    isGardenAppointmentsDirty,
    isProductsDirty,

    // Handlers
    setStep,
    setPaymentType,
    setPaymentSubType,
    setHasReceipt,
    setPaidSum,
    setAppointmentPrice,
    setShowPreviousPayments,
    handleCancelPriceChange,
    handleSavePrice,
    handleRemoveItem,
    handleUpdateQuantity,
    handleUpdateItemPrice,
    handleStartAddingItem,
    handleCancelAddingItem,
    handleSelectProductFromSearch,
    handleUseAsTempItem,
    handleOpenCreateProductDialog,
    handleProductCreated,
    handleSaveCart,
    handleSaveAppointments,
    handleSaveProducts,
    handleSaveProductsAndGarden,
    handleSendPaymentRequest,
    recipientSelection,
    setRecipientSelection,
    paymentLinkRecipientSelection,
    setPaymentLinkRecipientSelection,
    receivedAmount,
    setReceivedAmount,
    isMarkingAsReceived,
    handleMarkAsReceived,
    handleBackStep,
    handleContinueFromStep1,
    handleConfirm,
    handleClose,
    handleInputFocus,
    handleInputBlur,
    handleTempItemNameChange,
    handleTempItemQuantityChange,
    handleTempItemPriceChange,
    fetchInitialProducts,
    // New: Appointment handlers
    handleUpdateAppointmentPrice,
    handleRemoveAppointment,
    setCartAppointments,
    // Payment iframe state
    showPaymentIframe,
    paymentPostData,
    isLoadingHandshake,
    isConfirming,
    handlePaymentIframeSuccess,
    handlePaymentIframeError,
    isCartPaid,
    paidOrderId,
    // Saved card state
    hasSavedCard,
    isCheckingSavedCard,
    savedCardAmount,
    setSavedCardAmount,
    isLoadingSavedCardPayment,
    handleChargeSavedCard,
    // Payment link
    paymentLink,
    copyLinkSuccess,
    isPollingPayment,
    generatePaymentLink,
    copyPaymentLink,
    sendPaymentLink,
    startPollingPayment,
  }
}

/**
 * Tranzila API Client
 * Handles authentication and API calls to Tranzila services
 */

interface TranzilaApiConfig {
  appKey: string
  secret: string
  terminalName: string
}

interface TranzilaApiHeaders {
  "X-tranzila-api-access-token": string
  "X-tranzila-api-app-key": string
  "X-tranzila-api-nonce": string
  "X-tranzila-api-request-time": string
}

/**
 * Generate random nonce
 */
function generateNonce(): string {
  // For debugging: allow fixed nonce from env var (only use in development!)
  const debugNonce = Deno.env.get("TRANZILLA_DEBUG_NONCE")
  if (debugNonce) {
    console.log("⚠️ [generateNonce] Using DEBUG nonce from TRANZILLA_DEBUG_NONCE env var")
    return debugNonce
  }

  // Generate a random hex string
  // Working example uses 75 chars, but standard is 32 bytes = 64 hex chars
  // Try generating a longer nonce to match working example format
  const bytes = new Uint8Array(38) // 38 bytes = 76 hex chars (close to 75)
  crypto.getRandomValues(bytes)
  const nonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  // Trim to 75 chars to match working example format
  return nonce.substring(0, 75)
}

/**
 * Tranzila API Client class
 */
export class TranzilaApiClient {
  private config: TranzilaApiConfig

  constructor(config: TranzilaApiConfig) {
    this.config = config
  }

  /**
   * Generate authentication headers for Tranzila API
   */
  async generateHeaders(): Promise<TranzilaApiHeaders> {
    // Debug mode: allow overriding timestamp/nonce, but only if timestamp is fresh (±5 min) to avoid invalid tokens
    const nowTs = Math.floor(Date.now() / 1000)
    const debugTimestampRaw = Deno.env.get("TRANZILLA_DEBUG_TIMESTAMP")
    const debugNonce = Deno.env.get("TRANZILLA_DEBUG_NONCE")

    let timestamp = debugTimestampRaw ? parseInt(debugTimestampRaw) : nowTs
    let nonce = debugNonce || generateNonce()

    const debugTimestampFresh = debugTimestampRaw ? Math.abs(timestamp - nowTs) <= 300 : false
    if (debugTimestampRaw && !debugTimestampFresh) {
      console.log(
        "⚠️ [generateHeaders] Provided TRANZILLA_DEBUG_TIMESTAMP is stale; using current timestamp to avoid invalid token"
      )
      timestamp = nowTs
    }

    if (debugTimestampFresh || debugNonce) {
      console.log("⚠️ [generateHeaders] DEBUG MODE: Using fixed timestamp/nonce from env vars")
    }

    // Generate access token using Tranzila spec:
    // HMAC_SHA256(secret + request_time + nonce as key, app_key as message)
    const encoder = new TextEncoder()
    const hmacKey = this.config.secret + timestamp.toString() + nonce
    const keyData = encoder.encode(hmacKey)
    const messageData = encoder.encode(this.config.appKey)
    const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData)
    const hashArray = Array.from(new Uint8Array(signature))
    const accessKey = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

    console.log("🔐 [TranzilaApiClient] Generated auth headers:", {
      appKey: this.config.appKey,
      appKeyLength: this.config.appKey?.length || 0,
      secret: this.config.secret, // Full secret for debugging (remove in production)
      secretLength: this.config.secret?.length || 0,
      timestamp,
      timestampString: timestamp.toString(),
      nonce: nonce, // Full nonce for debugging
      nonceLength: nonce.length,
      accessToken: accessKey, // Full access token for debugging
      accessTokenLength: accessKey.length,
      // Show the exact formula being used
      formula: `HMAC_SHA256("${this.config.secret}" + "${timestamp.toString()}" + "${nonce}" as key, "${
        this.config.appKey
      }" as message)`,
    })

    return {
      "X-tranzila-api-access-token": accessKey,
      "X-tranzila-api-app-key": this.config.appKey,
      "X-tranzila-api-nonce": nonce,
      "X-tranzila-api-request-time": timestamp.toString(),
    }
  }

  /**
   * Get documents by transaction IDs
   */
  async getDocuments(transactionIds: number[]): Promise<any> {
    const headers = await this.generateHeaders()

    const response = await fetch("https://billing5.tranzila.com/api/documents_db/get_documents", {
      method: "POST",
      headers: {
        Accept: "application/json, application/xml",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        terminal_names: [this.config.terminalName],
        transaction_ids: transactionIds,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Tranzila API error: ${response.status} ${errorText}`)
    }

    return await response.json()
  }

  /**
   * Get retrieval key by transaction ID
   */
  async getRetrievalKeyByTransactionId(transactionId: string): Promise<string | null> {
    const data = await this.getDocuments([parseInt(transactionId)])

    if (data.status_code !== 0 || !data.documents || data.documents.length === 0) {
      return null
    }

    return data.documents[0].retrieval_key
  }

  /**
   * Get invoice document by retrieval key
   */
  async getInvoiceByRetrievalKey(retrievalKey: string): Promise<string> {
    const response = await fetch(`https://my.tranzila.com/api/get_financial_document/${retrievalKey}`, {
      method: "GET",
      headers: {
        Accept: "text/html, application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch invoice: ${response.status} ${errorText}`)
    }

    return await response.text()
  }

  /**
   * Get invoice for a payment (fetches retrieval_key on-demand, then fetches invoice)
   * This is a convenience method that combines getRetrievalKeyByTransactionId and getInvoiceByRetrievalKey
   */
  async getInvoiceForPayment(transactionId: string): Promise<string> {
    const retrievalKey = await this.getRetrievalKeyByTransactionId(transactionId)

    if (!retrievalKey) {
      throw new Error("No invoice found for this transaction")
    }

    return await this.getInvoiceByRetrievalKey(retrievalKey)
  }

  /**
   * Create a credit card transaction using saved token
   */
  async createCreditCardTransaction(params: {
    token: string
    cvv?: string | null
    items: Array<{
      name: string
      type: string
      unit_price: number
      units_number: number
    }>
    terminalPassword: string
  }): Promise<any> {
    const { token, cvv, items, terminalPassword } = params

    const requestBody: any = {
      terminal_name: this.config.terminalName,
      token: token, // Use saved token (parameter name per Tranzila API docs)
      items: items,
    }

    // CVV is required for tokenized payments - if missing, throw error
    if (!cvv || cvv.trim() === "") {
      throw new Error("CVV is required for tokenized payments. Please ensure the saved card has CVV stored.")
    }

    requestBody.cvv = cvv.trim()

    console.log("📋 [TranzilaApiClient] Creating credit card transaction:", {
      terminalName: this.config.terminalName,
      hasToken: !!requestBody.token,
      hasCvv: !!requestBody.cvv,
      itemsCount: items.length,
    })

    // Call Tranzila API
    const apiUrl = `https://api.tranzila.com/v1/transaction/credit_card/create?TranzilaPW=${terminalPassword}`
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ [TranzilaApiClient] Tranzila API error:", errorText)
      throw new Error(`Tranzila API error: ${response.status} ${errorText}`)
    }

    const responseData = await response.json()
    console.log("✅ [TranzilaApiClient] Transaction response:", responseData)

    // Check if payment was successful
    if (responseData.Response && responseData.Response !== "000") {
      const errorMessage = responseData.error || responseData.Error || "Payment failed"
      throw new Error(errorMessage)
    }

    return responseData
  }

  /**
   * Create an invoice document via Tranzila API
   */
  async createInvoice(params: {
    documentDate: string
    customerName: string
    customerId?: string
    customerEmail?: string
    customerAddress?: string
    customerCity?: string
    customerZip?: string
    customerCountryCode?: string
    items: Array<{
      code?: string
      name: string
      unitPrice: number
      quantity: number
    }>
    payments: Array<{
      amount: number
      paymentDate: string
    }>
    vatPercent?: number
    action?: "1" | "3" // "1" for debit/invoice, "3" for credit/refund
  }): Promise<any> {
    const headers = await this.generateHeaders()

    // Format items for Tranzila API
    const formattedItems = params.items.map((item) => ({
      type: "I",
      code: item.code || "1",
      name: item.name,
      price_type: "G",
      unit_price: item.unitPrice.toFixed(2),
      units_number: item.quantity.toString(),
      unit_type: "1",
      currency_code: "ILS",
      to_doc_currency_exchange_rate: "1",
    }))

    // Format payments for Tranzila API
    const formattedPayments = params.payments.map((payment) => ({
      // Align with working example: 10 = credit card
      payment_method: 10,
      payment_date: payment.paymentDate,
      amount: payment.amount.toFixed(2),
      currency_code: "ILS",
      to_doc_currency_exchange_rate: "1",
    }))

    // Parse address into lines
    const addressLines = params.customerAddress ? params.customerAddress.split("\n") : []
    const addressLine1 = addressLines[0] || ""
    const addressLine2 = addressLines.slice(1).join(" ") || ""

    const requestBody: Record<string, any> = {
      terminal_name: this.config.terminalName,
      document_date: params.documentDate,
      document_type: "IR", // Invoice Receipt
      action: params.action || "1", // Default to "1" (debit/invoice), "3" for credit/refund
      document_language: "heb",
      document_currency_code: "ILS",
      vat_percent: (params.vatPercent || 17).toString(),
      client_company: "",
      client_name: params.customerName,
      client_email: params.customerEmail || "",
      client_address_line_1: addressLine1,
      client_address_line_2: addressLine2,
      client_zip: params.customerZip || "",
      client_city: params.customerCity || "",
      client_country_code: params.customerCountryCode || "IL",
      items: formattedItems,
      payments: formattedPayments,
    }

    if (params.customerId) {
      requestBody.client_id = params.customerId
    }

    const apiUrl = "https://billing5.tranzila.com/api/documents_db/create_document"

    console.log("📋 [TranzilaApiClient] Creating invoice:", {
      terminalName: this.config.terminalName,
      customerName: params.customerName,
      itemsCount: formattedItems.length,
      paymentsCount: formattedPayments.length,
    })

    console.log("🔑 [TranzilaApiClient] Request details:", {
      url: apiUrl,
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-tranzila-api-access-token": headers["X-tranzila-api-access-token"]?.substring(0, 20) + "...",
        "X-tranzila-api-app-key": headers["X-tranzila-api-app-key"],
        "X-tranzila-api-nonce": headers["X-tranzila-api-nonce"]?.substring(0, 20) + "...",
        "X-tranzila-api-request-time": headers["X-tranzila-api-request-time"],
      },
      body: requestBody,
    })

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ [TranzilaApiClient] Tranzila API error:", {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url: apiUrl,
        headers: {
          "X-tranzila-api-access-token": headers["X-tranzila-api-access-token"]?.substring(0, 20) + "...",
          "X-tranzila-api-app-key": headers["X-tranzila-api-app-key"],
        },
      })
      throw new Error(`Tranzila API error: ${response.status} ${errorText}`)
    }

    const responseData = await response.json()
    console.log("✅ [TranzilaApiClient] Invoice creation response:", responseData)

    return responseData
  }
}

/**
 * Create Tranzila API client from environment variables
 */
export function createTranzilaClient(): TranzilaApiClient {
  // Try multiple possible environment variable names for compatibility
  const appKeyFromApiKey = Deno.env.get("TRANZILLA_API_APP_KEY")
  const appKeyFromAppKey = Deno.env.get("TRANZILLA_APP_KEY")
  const appKey = appKeyFromApiKey || appKeyFromAppKey

  const secretFromSecret = Deno.env.get("TRANZILLA_PASSWORD")
  const secret = secretFromSecret

  // Fix typo in secret name (TERINAL -> TERMINAL)
  const terminalName = Deno.env.get("TRANZILLA_TERMINAL_NAME") || Deno.env.get("TRANZILLA_TERINAL_NAME") || "bloved29"

  // For invoice creation, we need both appKey and secret
  if (!appKey || !secret) {
    console.error("❌ [createTranzilaClient] Missing required credentials:", {
      appKeyMissing: !appKey,
      secretMissing: !secret,
    })
    throw new Error(
      `Missing Tranzila API credentials. Please set TRANZILLA_PASSWORD (and TRANZILLA_API_APP_KEY if not set). ` +
        `Current status: appKey=${!!appKey}, secret=${!!secret}`
    )
  }

  const client = new TranzilaApiClient({
    appKey,
    secret,
    terminalName,
  })

  console.log("✅ [createTranzilaClient] Client created with terminal:", terminalName)

  return client
}

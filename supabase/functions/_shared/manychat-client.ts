/**
 * ManyChat API Client
 *
 * Shared client for interacting with ManyChat API across edge functions.
 * Provides centralized ManyChat operations with consistent error handling and logging.
 */

const MANYCHAT_API_BASE_URL = "https://api.manychat.com/fb"

export interface ManyChatSubscriber {
  id?: string
  subscriber_id?: string
  phone?: string
  name?: string
  first_name?: string
  last_name?: string
  email?: string
  custom_fields?: Array<{
    id: number
    name: string
    type: string
    value: string
  }>
  [key: string]: unknown
}

export interface ManyChatApiResponse<T = unknown> {
  status: string
  data?: T
  error?: string
}

export interface ManyChatSendFlowRequest {
  subscriber_id: number
  flow_ns: string
}

export interface ManyChatSetCustomFieldRequest {
  subscriber_id: number | string
  field_id: string
  field_value: string
}

export interface ManyChatSetMultipleFieldsRequest {
  subscriber_id: number
  fields: Array<{
    field_id?: string | number
    field_name?: string
    field_value: string | number
  }>
}

export interface ManyChatCreateSubscriberRequest {
  email?: string | null
  phone?: string
  whatsapp_phone?: string
  first_name?: string
  last_name?: string
  gender?: string | null
  consent_phrase?: string
  has_opt_in_sms?: boolean
  has_opt_in_email?: boolean | null
}

/**
 * ManyChat Custom Field definition
 */
export interface ManyChatCustomField {
  id: string
  name: string
  type: string
  description: string
}

/**
 * ManyChat Flow Type to Flow ID mapping
 *
 * This object maps flow type identifiers to their corresponding ManyChat flow IDs.
 * Flow IDs are used to trigger specific flows in ManyChat via the API.
 */
export const MANYCHAT_FLOW_IDS: Record<string, string> = {
  YOUR_DOG_IS_READY_IN_X_MINUTES: "content20251128211128_639274",
  YOUR_APPOINTMENT_APPROVED: "content20251205234121_595370",
  YOUR_APPOINTMENT_APPROVED_WITH_MODIFY: "content20251205234451_085450",
  YOUR_APPOINTMENT_WAITING_FOR_CONFIRMATION: "content20251205234241_956262",
  APPOINTMNET_REMINDER_1: "content20251205234637_532200",
  SEND_BIT_PAYMENT_LINK: "content20251128214307_012273",
  SEND_PAYBOX_PAYMENT_LINK: "content20251201003718_892652",
  SEND_TRANZILLA_PAYMENT_LINK: "content20251205143857_351142",
  SEND_INVOICE_LINK: "content20251128215202_243231",
  SEND_REPEATED_APPOINTMENT_MESSAGE: "content20251130194103_209205",
  APPIONTMENT_UPDATED: "content20251201111926_514113",
  PROPOSE_NEW_TIME: "content20251201112040_161169",
  APPOINTMENT_DELETED: "content20251201140903_119694",
} as const

/**
 * Type for ManyChat flow type keys
 */
export type ManyChatFlowType = keyof typeof MANYCHAT_FLOW_IDS

/**
 * Get ManyChat flow ID by flow type
 *
 * @param flowType - The flow type identifier
 * @returns The ManyChat flow ID, or undefined if not found
 */
export function getManyChatFlowId(flowType: string): string | undefined {
  return MANYCHAT_FLOW_IDS[flowType]
}

/**
 * ManyChat Custom Fields mapping
 *
 * This object maps custom field names to their ManyChat field definitions.
 * Each field includes its ID, name, type, and description.
 */
export const MANYCHAT_CUSTOM_FIELDS: Record<string, ManyChatCustomField> = {
  X_ENTRY_REMAIN_ON_CARD: {
    id: "13540563",
    name: "X entry remain on card",
    type: "text",
    description: "",
  },
  BARBER_DATE_APPOINTMENT: {
    id: "14008196",
    name: "barber_date_appointment",
    type: "text",
    description: "",
  },
  BARBER_HOUR_APPOINTMENT: {
    id: "13701535",
    name: "Barber_Hour_appointment",
    type: "text",
    description: "",
  },
  SUBSCRIPTION_TYPE: {
    id: "13530741",
    name: "subscription_type",
    type: "text",
    description: "",
  },
  SUBSCRIPTION_END_DATE: {
    id: "13530744",
    name: "subscription_end_date",
    type: "text",
    description: "",
  },
  EMAIL: {
    id: "13711552",
    name: "email",
    type: "text",
    description: "",
  },
  MEETING_RECORD_ID: {
    id: "13581070",
    name: "meeting_record_id",
    type: "text",
    description: "",
  },
  CUSTOM_PHONE: {
    id: "13711554",
    name: "custom_phone",
    type: "text",
    description: "",
  },
  AGENT_REPLAY: {
    id: "13746876",
    name: "Agent_replay",
    type: "text",
    description: "",
  },
  AVOID_AI: {
    id: "13767424",
    name: "avoid_ai",
    type: "text",
    description: "",
  },
  CLIENT_NAME: {
    id: "13701533",
    name: "Client_name",
    type: "text",
    description: "",
  },
  SUBJECT_NAME_AIRTABLE: {
    id: "13755131",
    name: "Subject_name_airtable",
    type: "text",
    description: "",
  },
  TREATMENT_RECORD_ID: {
    id: "13801242",
    name: "treatment_record_id",
    type: "text",
    description: "",
  },
  PRICE_LIST_SENT: {
    id: "13797292",
    name: "האם נשלח מחירון",
    type: "boolean",
    description: "",
  },
} as const

/**
 * Type for ManyChat custom field keys
 */
export type ManyChatCustomFieldKey = keyof typeof MANYCHAT_CUSTOM_FIELDS

/**
 * Get ManyChat custom field by key
 *
 * @param fieldKey - The custom field key
 * @returns The ManyChat custom field definition, or undefined if not found
 */
export function getManyChatCustomField(fieldKey: string): ManyChatCustomField | undefined {
  return MANYCHAT_CUSTOM_FIELDS[fieldKey as ManyChatCustomFieldKey]
}

/**
 * Get ManyChat custom field ID by key
 *
 * @param fieldKey - The custom field key
 * @returns The ManyChat custom field ID, or undefined if not found
 */
export function getManyChatCustomFieldId(fieldKey: string): string | undefined {
  return MANYCHAT_CUSTOM_FIELDS[fieldKey as ManyChatCustomFieldKey]?.id
}

/**
 * ManyChat API Client
 */
export class ManyChatClient {
  private apiKey: string

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("ManyChat API key is required")
    }
    this.apiKey = apiKey
  }

  /**
   * Get API key from environment or throw error
   */
  static fromEnvironment(): ManyChatClient {
    const apiKey = Deno.env.get("MANYCHAT_API_KEY")
    if (!apiKey) {
      throw new Error("MANYCHAT_API_KEY environment variable not set")
    }
    return new ManyChatClient(apiKey)
  }

  /**
   * Make a request to ManyChat API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ManyChatApiResponse<T>> {
    const url = `${MANYCHAT_API_BASE_URL}${endpoint}`

    console.log(`📤 [ManyChat] ${options.method || "GET"} ${endpoint}`)

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [ManyChat] API error: ${response.status} - ${errorText}`)
        throw new Error(`ManyChat API error: ${response.status} - ${errorText}`)
      }

      const data: ManyChatApiResponse<T> = await response.json()

      if (data.status !== "success") {
        console.error(`❌ [ManyChat] API returned non-success status:`, data)
        throw new Error(data.error || "ManyChat API returned non-success status")
      }

      console.log(`✅ [ManyChat] Request successful`)
      return data
    } catch (error) {
      console.error(`❌ [ManyChat] Exception in API request:`, error)
      throw error
    }
  }

  /**
   * Send a flow to a subscriber
   */
  async sendFlow(subscriberId: string | number, flowId: string): Promise<void> {
    const subscriberIdNum = typeof subscriberId === "string" ? parseInt(subscriberId, 10) : subscriberId

    if (isNaN(subscriberIdNum)) {
      throw new Error(`Invalid subscriber_id: ${subscriberId} (must be a number)`)
    }

    console.log(`📤 [ManyChat] Sending flow ${flowId} to subscriber ${subscriberIdNum}`)

    await this.request<{ flow_id?: string; subscriber_id?: string }>("/sending/sendFlow", {
      method: "POST",
      body: JSON.stringify({
        subscriber_id: subscriberIdNum,
        flow_ns: flowId,
      }),
    })
  }

  /**
   * Get subscriber information by subscriber ID
   */
  async getSubscriberById(subscriberId: string): Promise<ManyChatSubscriber | null> {
    console.log(`🔍 [ManyChat] Getting subscriber by ID: ${subscriberId}`)

    try {
      const response = await this.request<ManyChatSubscriber>(`/subscriber/getInfo?subscriber_id=${subscriberId}`)

      if (response.data) {
        // Handle both array and object responses
        if (Array.isArray(response.data)) {
          return response.data.length > 0 ? response.data[0] : null
        }
        return response.data as ManyChatSubscriber
      }

      return null
    } catch (error) {
      // If 404, subscriber doesn't exist (this is expected)
      if (error instanceof Error && error.message.includes("404")) {
        return null
      }
      throw error
    }
  }

  /**
   * Find subscriber by custom field (phone)
   * Uses custom phone field (field ID: 13711554)
   */
  async findSubscriberByPhone(phone: string): Promise<ManyChatSubscriber | null> {
    const phoneDigits = phone.replace(/\D/g, "")
    console.log(`🔍 [ManyChat] Finding subscriber by phone (digits only): ${phoneDigits}`)

    try {
      const response = await this.request<ManyChatSubscriber | ManyChatSubscriber[]>(
        `/subscriber/findByCustomField?field_id=13711554&field_value=${encodeURIComponent(phoneDigits)}`
      )

      if (response.data) {
        // ManyChat returns an empty array [] when no user is found
        if (Array.isArray(response.data)) {
          if (response.data.length === 0) {
            console.log(`ℹ️ [ManyChat] Empty array returned - subscriber not found`)
            return null
          }
          return response.data[0] as ManyChatSubscriber
        }
        return response.data as ManyChatSubscriber
      }

      return null
    } catch (error) {
      // If 404, subscriber doesn't exist (this is expected)
      if (error instanceof Error && error.message.includes("404")) {
        return null
      }
      throw error
    }
  }

  /**
   * Create a new subscriber in ManyChat
   */
  async createSubscriber(
    phone: string,
    name: string,
    options: Partial<ManyChatCreateSubscriberRequest> = {}
  ): Promise<string> {
    const phoneDigits = phone.replace(/\D/g, "")
    console.log(`➕ [ManyChat] Creating subscriber with phone: ${phoneDigits}, name: ${name}`)

    if (!phoneDigits || phoneDigits.length < 9) {
      throw new Error("Phone number is required to create ManyChat subscriber")
    }

    // Split name into first_name and last_name
    const nameParts = name.trim().split(/\s+/)
    const firstName = nameParts[0] || name
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""

    const payload: ManyChatCreateSubscriberRequest = {
      email: null,
      phone: phoneDigits,
      whatsapp_phone: phoneDigits,
      first_name: firstName,
      last_name: lastName,
      gender: null,
      consent_phrase: "i agree to recieve marketing content from maayan arama",
      has_opt_in_sms: true,
      has_opt_in_email: null,
      ...options,
    }

    const response = await this.request<{ id?: string; subscriber_id?: string }>("/subscriber/createSubscriber", {
      method: "POST",
      body: JSON.stringify(payload),
    })

    if (!response.data) {
      throw new Error("Failed to get subscriber_id from ManyChat response")
    }

    const subscriberId = response.data.id || response.data.subscriber_id
    if (!subscriberId) {
      throw new Error("Failed to extract subscriber_id from ManyChat response")
    }

    console.log(`✅ [ManyChat] Created subscriber with ID: ${subscriberId}`)
    return String(subscriberId)
  }

  /**
   * Set a custom field value for a subscriber
   */
  async setCustomField(subscriberId: string | number, fieldId: string, fieldValue: string): Promise<void> {
    const subscriberIdNum = typeof subscriberId === "string" ? parseInt(subscriberId, 10) : subscriberId

    if (isNaN(subscriberIdNum)) {
      throw new Error(`Invalid subscriber_id: ${subscriberId} (must be a number)`)
    }

    console.log(`📝 [ManyChat] Setting custom field ${fieldId} = ${fieldValue} for subscriber ${subscriberIdNum}`)

    await this.request("/subscriber/setCustomField", {
      method: "POST",
      body: JSON.stringify({
        subscriber_id: subscriberIdNum,
        field_id: fieldId,
        field_value: fieldValue,
      }),
    })
  }

  /**
   * Set multiple custom fields for a subscriber in a single API call
   * More efficient than calling setCustomField multiple times
   *
   * Fields can be specified by either fieldId (numeric ID) or fieldName (string name)
   */
  async setMultipleFields(
    subscriberId: string | number,
    fields: Array<{ fieldId?: string | number; fieldName?: string; fieldValue: string | number }>
  ): Promise<void> {
    const subscriberIdNum = typeof subscriberId === "string" ? parseInt(subscriberId, 10) : subscriberId

    if (isNaN(subscriberIdNum)) {
      throw new Error(`Invalid subscriber_id: ${subscriberId} (must be a number)`)
    }

    if (!fields || fields.length === 0) {
      console.warn(`⚠️ [ManyChat] No fields provided to setMultipleFields, skipping`)
      return
    }

    // Validate that each field has either fieldId or fieldName
    for (const field of fields) {
      if (!field.fieldId && !field.fieldName) {
        throw new Error("Each field must have either fieldId or fieldName")
      }
      if (field.fieldId && field.fieldName) {
        throw new Error("Field cannot have both fieldId and fieldName - use one or the other")
      }
    }

    console.log(
      `📝 [ManyChat] Setting ${fields.length} custom fields for subscriber ${subscriberIdNum}`,
      fields.map((f) => `${f.fieldId || f.fieldName}=${f.fieldValue}`).join(", ")
    )

    const payload: ManyChatSetMultipleFieldsRequest = {
      subscriber_id: subscriberIdNum,
      fields: fields.map((f) => {
        const fieldObj: {
          field_value: string | number
          field_id?: string | number
          field_name?: string
        } = { field_value: f.fieldValue }
        if (f.fieldId) {
          // Convert fieldId to number if it's a numeric string
          fieldObj.field_id =
            typeof f.fieldId === "string" && /^\d+$/.test(f.fieldId) ? parseInt(f.fieldId, 10) : f.fieldId
        }
        if (f.fieldName) {
          fieldObj.field_name = f.fieldName
        }
        return fieldObj
      }),
    }

    await this.request("/subscriber/setCustomFields", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  /**
   * Get or create a subscriber by phone
   * First tries to find existing subscriber, then creates if not found
   */
  async getOrCreateSubscriber(phone: string, name: string): Promise<ManyChatSubscriber> {
    // Try to find existing subscriber
    let subscriber = await this.findSubscriberByPhone(phone)

    if (subscriber) {
      // Verify we have a valid ID
      const subscriberId = subscriber.subscriber_id || subscriber.id
      if (!subscriberId) {
        console.warn(`⚠️ [ManyChat] Subscriber found but no ID, recreating...`)
        subscriber = null
      } else {
        console.log(`✅ [ManyChat] Found existing subscriber: ${subscriberId}`)
        return subscriber
      }
    }

    // Create new subscriber if not found
    console.log(`➕ [ManyChat] Subscriber not found, creating new one...`)
    const subscriberId = await this.createSubscriber(phone, name)

    // Set custom phone field (field ID: 13711554) to normalized phone (digits only)
    const phoneDigits = phone.replace(/\D/g, "")
    if (phoneDigits) {
      try {
        await this.setCustomField(subscriberId, "13711554", phoneDigits)
      } catch (fieldError) {
        console.warn(`⚠️ [ManyChat] Failed to set custom phone field:`, fieldError)
        // Non-critical, continue
      }
    }

    // Fetch full subscriber data
    const fullSubscriber = await this.getSubscriberById(subscriberId)
    if (fullSubscriber) {
      return fullSubscriber
    }

    // Fallback: return minimal subscriber object
    return {
      id: subscriberId,
      subscriber_id: subscriberId,
      phone: phone,
      name: name,
    }
  }
}

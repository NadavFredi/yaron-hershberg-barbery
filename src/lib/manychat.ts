/**
 * ManyChat Flow Type to Flow ID mapping
 *
 * This object maps flow type identifiers to their corresponding ManyChat flow IDs.
 * Flow IDs are used to trigger specific flows in ManyChat via the API.
 *
 * Note: For edge functions, use the ManyChatClient from `supabase/functions/_shared/manychat-client.ts`
 * instead of making direct API calls. See docs/MANYCHAT_CLIENT.md for details.
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
 * ManyChat Custom Field definition
 */
export interface ManyChatCustomField {
  id: string
  name: string
  type: string
  description: string
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
  GARDEN_DATE_APPOINTMENT: {
    id: "13530715",
    name: "garden_date_appointment",
    type: "text",
    description: "",
  },
  BARBER_DATE_APPOINTMENT: {
    id: "13530717",
    name: "barber_date_appointment",
    type: "text",
    description: "",
  },
  DOG_TYPE: {
    id: "13530726",
    name: "dog_type",
    type: "text",
    description: "",
  },
  BARBER_HOUR_APPOINTMENT: {
    id: "13530728",
    name: "barber_hour_appointment",
    type: "text",
    description: "",
  },
  DOG_READY_IN_X_TIME: {
    id: "13530732",
    name: "dog_ready_in_X_time",
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
    id: "13581191",
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
  IF_WAS_ON_GARDEN_AND_SUITABLE_TO_IT: {
    id: "13562478",
    name: "If was on garden and suitable to it",
    type: "text",
    description: "",
  },
  CUSTOM_PHONE: {
    id: "13563482",
    name: "custom_phone",
    type: "text",
    description: "",
  },
  DOG_NAME: {
    id: "dog_name",
    name: "dog_name",
    type: "text",
    description: "",
  },
  INVOICE_URL: {
    id: "14000829",
    name: "invoice_url",
    type: "text",
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

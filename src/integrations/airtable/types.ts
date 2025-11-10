// Airtable types and interfaces
export interface AirtableField {
  id: string
  name: string
  type: string
  description?: string
  options?: any
}

export interface AirtableTable {
  id: string
  name: string
  description?: string
  primaryField?: AirtableField
  fields?: AirtableField[]
}

export interface AirtableRecord {
  id: string
  fields: Record<string, any>
  _rawJson: {
    id: string
    createdTime: string
    commentCount: number
    [key: string]: any
  }
}

export interface AirtableBase {
  id: string
  name: string
  description?: string
  tables: AirtableTable[]
}

// Environment variables interface
export interface AirtableConfig {
  AIRTABLE_PAT: string
  AIRTABLE_BASE_ID: string
}

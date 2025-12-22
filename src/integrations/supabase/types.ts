export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      appointment_payments: {
        Row: {
          amount: number
          created_at: string
          daycare_appointment_id: string | null
          grooming_appointment_id: string | null
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          daycare_appointment_id?: string | null
          grooming_appointment_id?: string | null
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          daycare_appointment_id?: string | null
          grooming_appointment_id?: string | null
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_payments_daycare_appointment_id_fkey"
            columns: ["daycare_appointment_id"]
            isOneToOne: false
            referencedRelation: "daycare_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_payments_grooming_appointment_id_fkey"
            columns: ["grooming_appointment_id"]
            isOneToOne: false
            referencedRelation: "grooming_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          }
        ]
      }
      breed_modifiers: {
        Row: {
          breed_id: string
          created_at: string
          id: string
          service_id: string
          time_modifier_minutes: number
        }
        Insert: {
          breed_id: string
          created_at?: string
          id?: string
          service_id: string
          time_modifier_minutes?: number
        }
        Update: {
          breed_id?: string
          created_at?: string
          id?: string
          service_id?: string
          time_modifier_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "breed_modifiers_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breed_modifiers_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      breeds: {
        Row: {
          airtable_id: string | null
          created_at: string
          id: string
          max_groom_price: number | null
          min_groom_price: number | null
          name: string
          size_class: string | null
        }
        Insert: {
          airtable_id?: string | null
          created_at?: string
          id?: string
          max_groom_price?: number | null
          min_groom_price?: number | null
          name: string
          size_class?: string | null
        }
        Update: {
          airtable_id?: string | null
          created_at?: string
          id?: string
          max_groom_price?: number | null
          min_groom_price?: number | null
          name?: string
          size_class?: string | null
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          close_time: string
          created_at: string
          id: string
          open_time: string
          updated_at: string
          weekday: string
        }
        Insert: {
          close_time: string
          created_at?: string
          id?: string
          open_time: string
          updated_at?: string
          weekday: string
        }
        Update: {
          close_time?: string
          created_at?: string
          id?: string
          open_time?: string
          updated_at?: string
          weekday?: string
        }
        Relationships: []
      }
      calendar_settings: {
        Row: {
          created_at: string
          id: string
          open_days_ahead: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          open_days_ahead?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          open_days_ahead?: number
          updated_at?: string
        }
        Relationships: []
      }
      combined_appointments: {
        Row: {
          created_at: string
          daycare_appointment_id: string | null
          grooming_appointment_id: string | null
          id: string
        }
        Insert: {
          created_at?: string
          daycare_appointment_id?: string | null
          grooming_appointment_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          daycare_appointment_id?: string | null
          grooming_appointment_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combined_appointments_daycare_appointment_id_fkey"
            columns: ["daycare_appointment_id"]
            isOneToOne: false
            referencedRelation: "daycare_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combined_appointments_grooming_appointment_id_fkey"
            columns: ["grooming_appointment_id"]
            isOneToOne: false
            referencedRelation: "grooming_appointments"
            referencedColumns: ["id"]
          }
        ]
      }
      credit_tokens: {
        Row: {
          airtable_id: string | null
          created_at: string
          customer_id: string
          cvv: string | null
          id: string
          last4: string | null
          provider: string | null
          token: string | null
          updated_at: string
        }
        Insert: {
          airtable_id?: string | null
          created_at?: string
          customer_id: string
          cvv?: string | null
          id?: string
          last4?: string | null
          provider?: string | null
          token?: string | null
          updated_at?: string
        }
        Update: {
          airtable_id?: string | null
          created_at?: string
          customer_id?: string
          cvv?: string | null
          id?: string
          last4?: string | null
          provider?: string | null
          token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      customers: {
        Row: {
          address: string | null
          airtable_id: string | null
          auth_user_id: string | null
          classification: Database["public"]["Enums"]["customer_class"]
          created_at: string
          email: string | null
          full_name: string
          gov_id: string | null
          id: string
          phone: string
          phone_search: string | null
          send_invoice: boolean
          updated_at: string
          whatsapp_link: string | null
        }
        Insert: {
          address?: string | null
          airtable_id?: string | null
          auth_user_id?: string | null
          classification?: Database["public"]["Enums"]["customer_class"]
          created_at?: string
          email?: string | null
          full_name: string
          gov_id?: string | null
          id?: string
          phone: string
          phone_search?: string | null
          send_invoice?: boolean
          updated_at?: string
          whatsapp_link?: string | null
        }
        Update: {
          address?: string | null
          airtable_id?: string | null
          auth_user_id?: string | null
          classification?: Database["public"]["Enums"]["customer_class"]
          created_at?: string
          email?: string | null
          full_name?: string
          gov_id?: string | null
          id?: string
          phone?: string
          phone_search?: string | null
          send_invoice?: boolean
          updated_at?: string
          whatsapp_link?: string | null
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          id: string
          customer_id: string
          name: string
          phone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          name: string
          phone: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          name?: string
          phone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      daycare_appointments: {
        Row: {
          airtable_id: string | null
          amount_due: number | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          dog_id: string
          end_at: string
          garden_bath: boolean | null
          garden_brush: boolean | null
          garden_trim_nails: boolean | null
          id: string
          internal_notes: string | null
          late_pickup_notes: string | null
          late_pickup_requested: boolean | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          questionnaire_result: Database["public"]["Enums"]["questionnaire_result"]
          series_id: string | null
          service_type: Database["public"]["Enums"]["daycare_service_type"]
          start_at: string
          station_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          airtable_id?: string | null
          amount_due?: number | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          dog_id: string
          end_at: string
          garden_bath?: boolean | null
          garden_brush?: boolean | null
          garden_trim_nails?: boolean | null
          id?: string
          internal_notes?: string | null
          late_pickup_notes?: string | null
          late_pickup_requested?: boolean | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          questionnaire_result?: Database["public"]["Enums"]["questionnaire_result"]
          series_id?: string | null
          service_type?: Database["public"]["Enums"]["daycare_service_type"]
          start_at: string
          station_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          airtable_id?: string | null
          amount_due?: number | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          dog_id?: string
          end_at?: string
          garden_bath?: boolean | null
          garden_brush?: boolean | null
          garden_trim_nails?: boolean | null
          id?: string
          internal_notes?: string | null
          late_pickup_notes?: string | null
          late_pickup_requested?: boolean | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          questionnaire_result?: Database["public"]["Enums"]["questionnaire_result"]
          series_id?: string | null
          service_type?: Database["public"]["Enums"]["daycare_service_type"]
          start_at?: string
          station_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daycare_appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daycare_appointments_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daycare_appointments_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          }
        ]
      }
      daycare_capacity_limits: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          regular_limit: number
          trial_limit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          id?: string
          regular_limit?: number
          trial_limit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          regular_limit?: number
          trial_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      daycare_waitlist: {
        Row: {
          airtable_id: string | null
          created_at: string
          customer_id: string
          dog_id: string
          end_date: string | null
          id: string
          notes: string | null
          requested_range: unknown
          service_scope: Database["public"]["Enums"]["service_scope"]
          start_date: string
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
        }
        Insert: {
          airtable_id?: string | null
          created_at?: string
          customer_id: string
          dog_id: string
          end_date?: string | null
          id?: string
          notes?: string | null
          requested_range?: unknown
          service_scope?: Database["public"]["Enums"]["service_scope"]
          start_date: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Update: {
          airtable_id?: string | null
          created_at?: string
          customer_id?: string
          dog_id?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          requested_range?: unknown
          service_scope?: Database["public"]["Enums"]["service_scope"]
          start_date?: string
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daycare_waitlist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daycare_waitlist_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          }
        ]
      }
      dogs: {
        Row: {
          aggression_risk: boolean | null
          airtable_id: string | null
          birth_date: string | null
          breed_id: string | null
          created_at: string
          customer_id: string
          gender: Database["public"]["Enums"]["dog_gender"]
          health_notes: string | null
          id: string
          image_url: string | null
          is_small: boolean | null
          name: string
          people_anxious: boolean | null
          questionnaire_result: Database["public"]["Enums"]["questionnaire_result"]
          staff_notes: string | null
          updated_at: string
          vet_name: string | null
          vet_phone: string | null
        }
        Insert: {
          aggression_risk?: boolean | null
          airtable_id?: string | null
          birth_date?: string | null
          breed_id?: string | null
          created_at?: string
          customer_id: string
          gender?: Database["public"]["Enums"]["dog_gender"]
          health_notes?: string | null
          id?: string
          image_url?: string | null
          is_small?: boolean | null
          name: string
          people_anxious?: boolean | null
          questionnaire_result?: Database["public"]["Enums"]["questionnaire_result"]
          staff_notes?: string | null
          updated_at?: string
          vet_name?: string | null
          vet_phone?: string | null
        }
        Update: {
          aggression_risk?: boolean | null
          airtable_id?: string | null
          birth_date?: string | null
          breed_id?: string | null
          created_at?: string
          customer_id?: string
          gender?: Database["public"]["Enums"]["dog_gender"]
          health_notes?: string | null
          id?: string
          image_url?: string | null
          is_small?: boolean | null
          name?: string
          people_anxious?: boolean | null
          questionnaire_result?: Database["public"]["Enums"]["questionnaire_result"]
          staff_notes?: string | null
          updated_at?: string
          vet_name?: string | null
          vet_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dogs_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dogs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      garden_questionnaires: {
        Row: {
          aggressive_towards_dogs: boolean | null
          airtable_id: string | null
          bites_people: boolean | null
          created_at: string
          dog_id: string
          id: string
          photo_url: string | null
          result: Database["public"]["Enums"]["questionnaire_result"]
          staff_comment: string | null
          staff_reviewed_by: string | null
          storage_object: string | null
          submitted_at: string
          terms_accepted: boolean | null
          updated_at: string
        }
        Insert: {
          aggressive_towards_dogs?: boolean | null
          airtable_id?: string | null
          bites_people?: boolean | null
          created_at?: string
          dog_id: string
          id?: string
          photo_url?: string | null
          result?: Database["public"]["Enums"]["questionnaire_result"]
          staff_comment?: string | null
          staff_reviewed_by?: string | null
          storage_object?: string | null
          submitted_at?: string
          terms_accepted?: boolean | null
          updated_at?: string
        }
        Update: {
          aggressive_towards_dogs?: boolean | null
          airtable_id?: string | null
          bites_people?: boolean | null
          created_at?: string
          dog_id?: string
          id?: string
          photo_url?: string | null
          result?: Database["public"]["Enums"]["questionnaire_result"]
          staff_comment?: string | null
          staff_reviewed_by?: string | null
          storage_object?: string | null
          submitted_at?: string
          terms_accepted?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garden_questionnaires_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garden_questionnaires_staff_reviewed_by_fkey"
            columns: ["staff_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      hair_coloring_items: {
        Row: {
          color_number: number
          created_at: string
          dosage: number
          hair_coloring_session_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          color_number: number
          created_at?: string
          dosage: number
          hair_coloring_session_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          color_number?: number
          created_at?: string
          dosage?: number
          hair_coloring_session_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hair_coloring_items_hair_coloring_session_id_fkey"
            columns: ["hair_coloring_session_id"]
            isOneToOne: false
            referencedRelation: "hair_coloring_sessions"
            referencedColumns: ["id"]
          }
        ]
      }
      hair_coloring_sessions: {
        Row: {
          created_at: string
          grooming_appointment_id: string
          id: string
          notes: string | null
          oxygen_level: number | null
          total_dosage: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          grooming_appointment_id: string
          id?: string
          notes?: string | null
          oxygen_level?: number | null
          total_dosage?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          grooming_appointment_id?: string
          id?: string
          notes?: string | null
          oxygen_level?: number | null
          total_dosage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hair_coloring_sessions_grooming_appointment_id_fkey"
            columns: ["grooming_appointment_id"]
            isOneToOne: false
            referencedRelation: "grooming_appointments"
            referencedColumns: ["id"]
          }
        ]
      }
      grooming_appointments: {
        Row: {
          airtable_id: string | null
          amount_due: number | null
          appointment_kind: Database["public"]["Enums"]["appointment_kind"]
          billing_triggered_at: string | null
          billing_url: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          dog_id: string
          end_at: string
          id: string
          internal_notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          personal_reason: string | null
          pickup_reminder_sent_at: string | null
          series_id: string | null
          service_id: string | null
          start_at: string
          station_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          airtable_id?: string | null
          amount_due?: number | null
          appointment_kind?: Database["public"]["Enums"]["appointment_kind"]
          billing_triggered_at?: string | null
          billing_url?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          dog_id: string
          end_at: string
          id?: string
          internal_notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          personal_reason?: string | null
          pickup_reminder_sent_at?: string | null
          series_id?: string | null
          service_id?: string | null
          start_at: string
          station_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          airtable_id?: string | null
          amount_due?: number | null
          appointment_kind?: Database["public"]["Enums"]["appointment_kind"]
          billing_triggered_at?: string | null
          billing_url?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          dog_id?: string
          end_at?: string
          id?: string
          internal_notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          personal_reason?: string | null
          pickup_reminder_sent_at?: string | null
          series_id?: string | null
          service_id?: string | null
          start_at?: string
          station_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grooming_appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_appointments_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_appointments_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          }
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          daycare_appointment_id: string | null
          grooming_appointment_id: string | null
          id: string
          status: string | null
          subtotal: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          daycare_appointment_id?: string | null
          grooming_appointment_id?: string | null
          id?: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          daycare_appointment_id?: string | null
          grooming_appointment_id?: string | null
          id?: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_daycare_appointment_id_fkey"
            columns: ["daycare_appointment_id"]
            isOneToOne: false
            referencedRelation: "daycare_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_grooming_appointment_id_fkey"
            columns: ["grooming_appointment_id"]
            isOneToOne: false
            referencedRelation: "grooming_appointments"
            referencedColumns: ["id"]
          }
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_id: string
          external_id: string | null
          id: string
          metadata: Json | null
          method: string | null
          status: Database["public"]["Enums"]["payment_status"]
          token_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_id: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          token_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_id?: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          token_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "credit_tokens"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          airtable_id: string | null
          brand: string | null
          bundle_price: number | null
          category: string | null
          cost_price: number | null
          created_at: string
          id: string
          name: string
          retail_price: number | null
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          airtable_id?: string | null
          brand?: string | null
          bundle_price?: number | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          name: string
          retail_price?: number | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          airtable_id?: string | null
          brand?: string | null
          bundle_price?: number | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          name?: string
          retail_price?: number | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_station_matrix: {
        Row: {
          base_time_minutes: number
          created_at: string
          id: string
          price_adjustment: number
          service_id: string
          station_id: string
          updated_at: string
        }
        Insert: {
          base_time_minutes?: number
          created_at?: string
          id?: string
          price_adjustment?: number
          service_id: string
          station_id: string
          updated_at?: string
        }
        Update: {
          base_time_minutes?: number
          created_at?: string
          id?: string
          price_adjustment?: number
          service_id?: string
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_station_matrix_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_station_matrix_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          }
        ]
      }
      services: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      station_breed_rules: {
        Row: {
          breed_id: string | null
          created_at: string
          duration_modifier_minutes: number | null
          id: string
          is_active: boolean
          price_modifier: number | null
          remote_booking_allowed: boolean
          requires_staff_approval: boolean
          station_id: string
          updated_at: string
        }
        Insert: {
          breed_id?: string | null
          created_at?: string
          duration_modifier_minutes?: number | null
          id?: string
          is_active?: boolean
          price_modifier?: number | null
          remote_booking_allowed?: boolean
          requires_staff_approval?: boolean
          station_id: string
          updated_at?: string
        }
        Update: {
          breed_id?: string | null
          created_at?: string
          duration_modifier_minutes?: number | null
          id?: string
          is_active?: boolean
          price_modifier?: number | null
          remote_booking_allowed?: boolean
          requires_staff_approval?: boolean
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_breed_rules_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_breed_rules_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          }
        ]
      }
      station_unavailability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          notes: Json | null
          reason: Database["public"]["Enums"]["absence_reason"] | null
          start_time: string
          station_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          notes?: Json | null
          reason?: Database["public"]["Enums"]["absence_reason"] | null
          start_time: string
          station_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          notes?: Json | null
          reason?: Database["public"]["Enums"]["absence_reason"] | null
          start_time?: string
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_unavailability_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          }
        ]
      }
      stations: {
        Row: {
          break_between_appointments: number
          calendar_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          slot_interval_minutes: number
          updated_at: string
          work_end: string | null
          work_start: string | null
          working_days: string[] | null
        }
        Insert: {
          break_between_appointments?: number
          calendar_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slot_interval_minutes?: number
          updated_at?: string
          work_end?: string | null
          work_start?: string | null
          working_days?: string[] | null
        }
        Update: {
          break_between_appointments?: number
          calendar_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slot_interval_minutes?: number
          updated_at?: string
          work_end?: string | null
          work_start?: string | null
          working_days?: string[] | null
        }
        Relationships: []
      }
      ticket_types: {
        Row: {
          airtable_id: string | null
          created_at: string
          description: string | null
          id: string
          is_unlimited: boolean
          name: string
          price: number | null
          total_entries: number | null
          updated_at: string
        }
        Insert: {
          airtable_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_unlimited?: boolean
          name: string
          price?: number | null
          total_entries?: number | null
          updated_at?: string
        }
        Update: {
          airtable_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_unlimited?: boolean
          name?: string
          price?: number | null
          total_entries?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_usages: {
        Row: {
          airtable_id: string | null
          created_at: string
          daycare_appointment_id: string | null
          dog_id: string | null
          grooming_appointment_id: string | null
          id: string
          ticket_id: string
          units_used: number
          used_at: string
        }
        Insert: {
          airtable_id?: string | null
          created_at?: string
          daycare_appointment_id?: string | null
          dog_id?: string | null
          grooming_appointment_id?: string | null
          id?: string
          ticket_id: string
          units_used?: number
          used_at?: string
        }
        Update: {
          airtable_id?: string | null
          created_at?: string
          daycare_appointment_id?: string | null
          dog_id?: string | null
          grooming_appointment_id?: string | null
          id?: string
          ticket_id?: string
          units_used?: number
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_usages_daycare_appointment_id_fkey"
            columns: ["daycare_appointment_id"]
            isOneToOne: false
            referencedRelation: "daycare_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_usages_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_usages_grooming_appointment_id_fkey"
            columns: ["grooming_appointment_id"]
            isOneToOne: false
            referencedRelation: "grooming_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_usages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          }
        ]
      }
      tickets: {
        Row: {
          airtable_id: string | null
          created_at: string
          customer_id: string
          expires_on: string | null
          id: string
          ticket_type_id: string | null
          total_entries: number | null
          updated_at: string
        }
        Insert: {
          airtable_id?: string | null
          created_at?: string
          customer_id: string
          expires_on?: string | null
          id?: string
          ticket_type_id?: string | null
          total_entries?: number | null
          updated_at?: string
        }
        Update: {
          airtable_id?: string | null
          created_at?: string
          customer_id?: string
          expires_on?: string | null
          id?: string
          ticket_type_id?: string | null
          total_entries?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          }
        ]
      }
      proposed_meetings: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          end_at: string
          id: string
          notes: string | null
          reschedule_appointment_id: string | null
          reschedule_customer_id: string | null
          reschedule_dog_id: string | null
          reschedule_original_end_at: string | null
          reschedule_original_start_at: string | null
          service_type: "grooming" | "garden"
          start_at: string
          station_id: string
          status: string
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          end_at: string
          id?: string
          notes?: string | null
          reschedule_appointment_id?: string | null
          reschedule_customer_id?: string | null
          reschedule_dog_id?: string | null
          reschedule_original_end_at?: string | null
          reschedule_original_start_at?: string | null
          service_type?: "grooming" | "garden"
          start_at: string
          station_id: string
          status?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          end_at?: string
          id?: string
          notes?: string | null
          reschedule_appointment_id?: string | null
          reschedule_customer_id?: string | null
          reschedule_dog_id?: string | null
          reschedule_original_end_at?: string | null
          reschedule_original_start_at?: string | null
          service_type?: "grooming" | "garden"
          start_at?: string
          station_id?: string
          status?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposed_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_meetings_reschedule_appointment_id_fkey"
            columns: ["reschedule_appointment_id"]
            isOneToOne: false
            referencedRelation: "grooming_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_meetings_reschedule_customer_id_fkey"
            columns: ["reschedule_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_meetings_reschedule_dog_id_fkey"
            columns: ["reschedule_dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_meetings_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          }
        ]
      }
      proposed_meeting_invites: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          last_notified_at: string | null
          last_webhook_status: string | null
          notification_count: number
          proposed_meeting_id: string
          source: "manual" | "category"
          source_category_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          last_notified_at?: string | null
          last_webhook_status?: string | null
          notification_count?: number
          proposed_meeting_id: string
          source?: "manual" | "category"
          source_category_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          last_notified_at?: string | null
          last_webhook_status?: string | null
          notification_count?: number
          proposed_meeting_id?: string
          source?: "manual" | "category"
          source_category_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposed_meeting_invites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_meeting_invites_proposed_meeting_id_fkey"
            columns: ["proposed_meeting_id"]
            isOneToOne: false
            referencedRelation: "proposed_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_meeting_invites_source_category_id_fkey"
            columns: ["source_category_id"]
            isOneToOne: false
            referencedRelation: "customer_types"
            referencedColumns: ["id"]
          }
        ]
      }
      proposed_meeting_categories: {
        Row: {
          created_at: string
          customer_type_id: string
          id: string
          proposed_meeting_id: string
        }
        Insert: {
          created_at?: string
          customer_type_id: string
          id?: string
          proposed_meeting_id: string
        }
        Update: {
          created_at?: string
          customer_type_id?: string
          id?: string
          proposed_meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposed_meeting_categories_customer_type_id_fkey"
            columns: ["customer_type_id"]
            isOneToOne: false
            referencedRelation: "customer_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_meeting_categories_proposed_meeting_id_fkey"
            columns: ["proposed_meeting_id"]
            isOneToOne: false
            referencedRelation: "proposed_meetings"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bytea_to_text: { Args: { data: string }; Returns: string }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      text_to_bytea: { Args: { data: string }; Returns: string }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      absence_reason: "sick" | "vacation" | "ad_hoc"
      appointment_kind: "business" | "personal"
      appointment_status: "pending" | "approved" | "cancelled" | "matched"
      customer_class: "new" | "vip" | "standard" | "inactive"
      daycare_service_type: "full_day" | "trial" | "hourly"
      dog_gender: "male" | "female"
      payment_status: "unpaid" | "paid" | "partial"
      questionnaire_result: "not_required" | "pending" | "approved" | "rejected"
      service_category: "grooming" | "daycare" | "retail"
      service_scope: "grooming" | "daycare" | "both"
      waitlist_status: "active" | "fulfilled" | "cancelled"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      absence_reason: ["sick", "vacation", "ad_hoc"],
      appointment_kind: ["business", "personal"],
      appointment_status: ["pending", "approved", "cancelled", "matched"],
      customer_class: ["new", "vip", "standard", "inactive"],
      daycare_service_type: ["full_day", "trial", "hourly"],
      dog_gender: ["male", "female"],
      payment_status: ["unpaid", "paid", "partial"],
      questionnaire_result: ["not_required", "pending", "approved", "rejected"],
      service_category: ["grooming", "daycare", "retail"],
      service_scope: ["grooming", "daycare", "both"],
      waitlist_status: ["active", "fulfilled", "cancelled"],
    },
  },
} as const

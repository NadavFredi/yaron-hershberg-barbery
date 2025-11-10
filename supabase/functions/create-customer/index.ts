import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface CreateCustomerRequest {
  full_name: string
  phone_number: string
  email?: string
  customer_type_id?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🔍 [create-customer] Function called with method:", req.method)

    // Get auth token from request
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.error("❌ [create-customer] No authorization header")
      return new Response(JSON.stringify({ success: false, error: "Unauthorized - No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { full_name, phone_number, email, customer_type_id }: CreateCustomerRequest = await req.json()
    console.log("📋 [create-customer] Received request for:", {
      full_name,
      phone_number,
      email: email || "no email",
      customer_type_id: customer_type_id || "none",
    })

    // Validate required fields
    if (!full_name || !phone_number) {
      return new Response(JSON.stringify({ success: false, error: "שם מלא ומספר טלפון נדרשים" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Normalize phone number
    const digitsOnlyPhone = phone_number.replace(/\D/g, "")

    if (!digitsOnlyPhone) {
      return new Response(JSON.stringify({ success: false, error: "מספר טלפון לא תקין" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const trimmedPhone = phone_number.trim()
    const hasExplicitPlus = trimmedPhone.startsWith("+")
    const looksLikeIsraeliMobile = digitsOnlyPhone.length === 10 && digitsOnlyPhone.startsWith("0")

    const normalizedPhoneDigits = hasExplicitPlus
      ? digitsOnlyPhone
      : looksLikeIsraeliMobile
      ? `972${digitsOnlyPhone.slice(1)}`
      : digitsOnlyPhone

    if (normalizedPhoneDigits.length < 9 || normalizedPhoneDigits.length > 15) {
      return new Response(JSON.stringify({ success: false, error: "מספר טלפון חייב להכיל בין 9 ל-15 ספרות" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const phoneForAuth = `+${normalizedPhoneDigits}`

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL environment variable")
    }

    if (!supabaseServiceKey) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
          "For local development, this should be automatically available. " +
          "Check your Supabase configuration or set it manually."
      )
    }

    console.log("✅ [create-customer] Using Supabase URL:", supabaseUrl)
    console.log("✅ [create-customer] Service key available:", !!supabaseServiceKey)

    // Use service role to bypass RLS for manager operations
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify manager is authenticated
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()
    if (authError || !user) {
      console.error("❌ [create-customer] Authentication failed:", authError?.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized - Invalid or expired session. Please log in again.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ [create-customer] Manager authenticated:", user.id)

    let resolvedCustomerTypeId: string | null = null
    if (customer_type_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(customer_type_id)) {
        console.warn("⚠️ [create-customer] Invalid customer_type_id format received:", customer_type_id)
        return new Response(JSON.stringify({ success: false, error: "סוג הלקוח שנבחר אינו תקין" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { data: customerType, error: customerTypeError } = await supabaseClient
        .from("customer_types")
        .select("id")
        .eq("id", customer_type_id)
        .maybeSingle()

      if (customerTypeError) {
        console.error("❌ [create-customer] Error validating customer type:", customerTypeError)
        return new Response(JSON.stringify({ success: false, error: "שגיאה באימות סוג הלקוח" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      if (!customerType) {
        console.warn("⚠️ [create-customer] Customer type not found for id:", customer_type_id)
        return new Response(JSON.stringify({ success: false, error: "סוג הלקוח שנבחר לא נמצא" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      resolvedCustomerTypeId = customerType.id
      console.log("✅ [create-customer] Customer type validated:", resolvedCustomerTypeId)
    }

    const assignCustomerTypeIfNeeded = async (customerId: string | null | undefined) => {
      if (!resolvedCustomerTypeId || !customerId) {
        return null
      }

      const { data: currentType, error: currentTypeError } = await supabaseClient
        .from("customers")
        .select("customer_type_id")
        .eq("id", customerId)
        .maybeSingle()

      if (currentTypeError) {
        console.error("❌ [create-customer] Failed checking current customer type:", currentTypeError)
        throw new Error("שגיאה בבדיקת סוג הלקוח")
      }

      if (currentType?.customer_type_id === resolvedCustomerTypeId) {
        console.log("ℹ️ [create-customer] Customer already assigned requested type:", resolvedCustomerTypeId)
        return currentType.customer_type_id
      }

      const { data: updatedCustomer, error: updateTypeError } = await supabaseClient
        .from("customers")
        .update({ customer_type_id: resolvedCustomerTypeId })
        .eq("id", customerId)
        .select("customer_type_id")
        .maybeSingle()

      if (updateTypeError) {
        console.error("❌ [create-customer] Failed assigning customer type:", updateTypeError)
        throw new Error("לא ניתן לשייך את סוג הלקוח שנבחר")
      }

      console.log("✅ [create-customer] Customer type assigned:", {
        customerId,
        customer_type_id: updatedCustomer?.customer_type_id || resolvedCustomerTypeId,
      })

      return updatedCustomer?.customer_type_id || resolvedCustomerTypeId
    }

    // Check if user exists with this phone or email
    let existingUser = null
    if (email) {
      const { data: emailUsers } = await supabaseClient.auth.admin.listUsers()
      existingUser = emailUsers?.users?.find((u) => u.email === email)
      if (existingUser) {
        console.log("⚠️ [create-customer] User with email already exists:", email)
        // Check if profile exists
        const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", existingUser.id).single()

        if (profile) {
          // Check if customer record exists
          const { data: customer } = await supabaseClient
            .from("customers")
            .select("*")
            .eq("auth_user_id", existingUser.id)
            .single()

          // Ensure customer record exists and get its ID
          let customerRecord
          if (!customer) {
            console.log("📝 [create-customer] Creating customer record for existing user...")
            const { data: newCustomer, error: customerError } = await supabaseClient
              .from("customers")
              .insert({
                auth_user_id: existingUser.id,
                full_name: profile.full_name || full_name,
                phone: profile.phone_number || normalizedPhoneDigits,
                email: profile.email || email || null,
                phone_search: normalizedPhoneDigits,
                customer_type_id: resolvedCustomerTypeId,
              })
              .select("id")
              .single()

            if (customerError) {
              console.error("❌ [create-customer] Error creating customer record:", customerError)
            } else {
              customerRecord = newCustomer
            }
          } else {
            customerRecord = { id: customer.id }
          }

          // Get the actual customer record ID (not auth user ID) if not already set
          if (!customerRecord) {
            const { data: fetchedCustomer } = await supabaseClient
              .from("customers")
              .select("id")
              .eq("auth_user_id", existingUser.id)
              .single()
            customerRecord = fetchedCustomer
          }

          let assignedTypeId: string | null = null
          if (customerRecord?.id) {
            try {
              assignedTypeId = await assignCustomerTypeIfNeeded(customerRecord.id)
            } catch (assignError) {
              console.error("❌ [create-customer] Failed to assign customer type for existing email user:", assignError)
              return new Response(
                JSON.stringify({
                  success: false,
                  error: assignError instanceof Error ? assignError.message : "לא ניתן לשייך את סוג הלקוח",
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              )
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              customerId: customerRecord?.id || existingUser.id,
              customerTypeId: assignedTypeId || customer?.customer_type_id || null,
              customer: {
                id: customerRecord?.id || existingUser.id,
                fullName: profile?.full_name || full_name,
                phone: profile?.phone_number || normalizedPhoneDigits,
                email: profile?.email || email || null,
                customerTypeId: assignedTypeId || customer?.customer_type_id || null,
              },
              message: "לקוח קיים במערכת",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }
      }
    }

    // Check phone number
    const { data: phoneUsers } = await supabaseClient.auth.admin.listUsers()
    existingUser = phoneUsers?.users?.find((u) => u.phone === phoneForAuth)
    if (existingUser) {
      console.log("⚠️ [create-customer] User with phone already exists:", phoneForAuth)
      const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", existingUser.id).single()

      if (profile) {
        // Check if customer record exists
        const { data: customer } = await supabaseClient
          .from("customers")
          .select("*")
          .eq("auth_user_id", existingUser.id)
          .single()

        // If profile exists but no customer record, create it
        if (!customer) {
          console.log("📝 [create-customer] Creating customer record for existing user...")
          const { error: customerError } = await supabaseClient.from("customers").insert({
            auth_user_id: existingUser.id,
            full_name: profile.full_name || full_name,
            phone: profile.phone_number || normalizedPhoneDigits,
            email: profile.email || email || null,
            phone_search: normalizedPhoneDigits,
            customer_type_id: resolvedCustomerTypeId,
          })

          if (customerError) {
            console.error("❌ [create-customer] Error creating customer record:", customerError)
          }
        }

        // Get the actual customer record ID (not auth user ID)
        const { data: customerRecord } = await supabaseClient
          .from("customers")
          .select("id")
          .eq("auth_user_id", existingUser.id)
          .single()

        let assignedTypeId: string | null = null
        if (customerRecord?.id) {
          try {
            assignedTypeId = await assignCustomerTypeIfNeeded(customerRecord.id)
          } catch (assignError) {
            console.error("❌ [create-customer] Failed to assign customer type for existing phone user:", assignError)
            return new Response(
              JSON.stringify({
                success: false,
                error: assignError instanceof Error ? assignError.message : "לא ניתן לשייך את סוג הלקוח",
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            customerId: customerRecord?.id || existingUser.id,
            customerTypeId: assignedTypeId || customer?.customer_type_id || null,
            customer: {
              id: customerRecord?.id || existingUser.id,
              fullName: profile.full_name || full_name,
              phone: profile.phone_number || normalizedPhoneDigits,
              email: profile.email || email || null,
              customerTypeId: assignedTypeId || customer?.customer_type_id || null,
            },
            message: "לקוח קיים במערכת",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    }

    // Generate a temporary email if not provided
    const customerEmail = email || `temp_${normalizedPhoneDigits}@customer.local`

    // Generate a secure random password (customer can reset it later if needed)
    const tempPassword = crypto.randomUUID() + crypto.randomUUID()

    console.log("👤 [create-customer] Creating customer user...")

    // Create the auth user
    const { data: authData, error: authUserError } = await supabaseClient.auth.admin.createUser({
      email: customerEmail,
      password: tempPassword,
      email_confirm: true,
      phone: phoneForAuth,
      phone_confirm: true,
      user_metadata: {
        full_name,
        phone_number: normalizedPhoneDigits,
        is_manager_created: true,
      },
    })

    if (authUserError) {
      console.error("❌ [create-customer] Auth user creation error:", authUserError)

      // Check if user already exists
      const errorMessage = authUserError.message.toLowerCase()
      if (
        errorMessage.includes("already been registered") ||
        errorMessage.includes("user already exists") ||
        errorMessage.includes("duplicate") ||
        errorMessage.includes("already registered")
      ) {
        // User exists - try to find them and return their ID
        console.log("⚠️ [create-customer] User already exists, searching for existing user...")

        // Search by phone first
        const { data: phoneUsers } = await supabaseClient.auth.admin.listUsers()
        const existingUserByPhone = phoneUsers?.users?.find((u) => u.phone === phoneForAuth)
        if (existingUserByPhone) {
          const { data: profile } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", existingUserByPhone.id)
            .single()

          if (profile) {
            // Ensure customer record exists
            const { data: customer } = await supabaseClient
              .from("customers")
              .select("*")
              .eq("auth_user_id", existingUserByPhone.id)
              .single()

            // Ensure customer record exists and get its ID
            let customerRecord
            if (!customer) {
              console.log("📝 [create-customer] Creating customer record for existing user by phone...")
              const { data: newCustomer, error: customerInsertError } = await supabaseClient
                .from("customers")
                .insert({
                  auth_user_id: existingUserByPhone.id,
                  full_name: profile.full_name || full_name,
                  phone: profile.phone_number || normalizedPhoneDigits,
                  email: profile.email || email || null,
                  phone_search: normalizedPhoneDigits,
                  customer_type_id: resolvedCustomerTypeId,
                })
                .select("id")
                .single()

              if (customerInsertError) {
                console.error("❌ [create-customer] Error creating customer record:", customerInsertError)
              } else {
                customerRecord = newCustomer
              }
            } else {
              customerRecord = { id: customer.id }
            }

            // Get the actual customer record ID (not auth user ID) if not already set
            if (!customerRecord) {
              const { data: fetchedCustomer } = await supabaseClient
                .from("customers")
                .select("id")
                .eq("auth_user_id", existingUserByPhone.id)
                .single()
              customerRecord = fetchedCustomer
            }

            let assignedTypeId: string | null = null
            if (customerRecord?.id) {
              try {
                assignedTypeId = await assignCustomerTypeIfNeeded(customerRecord.id)
              } catch (assignError) {
                console.error(
                  "❌ [create-customer] Failed to assign customer type for duplicate phone user:",
                  assignError
                )
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: assignError instanceof Error ? assignError.message : "לא ניתן לשייך את סוג הלקוח",
                  }),
                  { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                )
              }
            }

            return new Response(
              JSON.stringify({
                success: true,
                customerId: customerRecord?.id || existingUserByPhone.id,
                customerTypeId: assignedTypeId || customer?.customer_type_id || null,
                customer: {
                  id: customerRecord?.id || existingUserByPhone.id,
                  fullName: profile.full_name || full_name,
                  phone: profile.phone_number || normalizedPhoneDigits,
                  email: profile.email || email || null,
                  customerTypeId: assignedTypeId || customer?.customer_type_id || null,
                },
                message: "לקוח קיים במערכת",
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            )
          }
        }

        // Search by email if provided
        if (email) {
          const { data: emailUsers } = await supabaseClient.auth.admin.listUsers()
          const existingUserByEmail = emailUsers?.users?.find((u) => u.email === email)
          if (existingUserByEmail) {
            const { data: profile } = await supabaseClient
              .from("profiles")
              .select("*")
              .eq("id", existingUserByEmail.id)
              .single()

            if (profile) {
              // Ensure customer record exists
              const { data: customer } = await supabaseClient
                .from("customers")
                .select("*")
                .eq("auth_user_id", existingUserByEmail.id)
                .single()

              // Ensure customer record exists and get its ID
              let customerRecord
              if (!customer) {
                console.log("📝 [create-customer] Creating customer record for existing user by email...")
                const { data: newCustomer, error: customerInsertError } = await supabaseClient
                  .from("customers")
                  .insert({
                    auth_user_id: existingUserByEmail.id,
                    full_name: profile.full_name || full_name,
                    phone: profile.phone_number || normalizedPhoneDigits,
                    email: profile.email || email,
                    phone_search: normalizedPhoneDigits,
                    customer_type_id: resolvedCustomerTypeId,
                  })
                  .select("id")
                  .single()

                if (customerInsertError) {
                  console.error("❌ [create-customer] Error creating customer record:", customerInsertError)
                } else {
                  customerRecord = newCustomer
                }
              } else {
                customerRecord = { id: customer.id }
              }

              // Get the actual customer record ID (not auth user ID) if not already set
              if (!customerRecord) {
                const { data: fetchedCustomer } = await supabaseClient
                  .from("customers")
                  .select("id")
                  .eq("auth_user_id", existingUserByEmail.id)
                  .single()
                customerRecord = fetchedCustomer
              }

              let assignedTypeId: string | null = null
              if (customerRecord?.id) {
                try {
                  assignedTypeId = await assignCustomerTypeIfNeeded(customerRecord.id)
                } catch (assignError) {
                  console.error(
                    "❌ [create-customer] Failed to assign customer type for duplicate email user:",
                    assignError
                  )
                  return new Response(
                    JSON.stringify({
                      success: false,
                      error: assignError instanceof Error ? assignError.message : "לא ניתן לשייך את סוג הלקוח",
                    }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  )
                }
              }

              return new Response(
                JSON.stringify({
                  success: true,
                  customerId: customerRecord?.id || existingUserByEmail.id,
                  customerTypeId: assignedTypeId || customer?.customer_type_id || null,
                  customer: {
                    id: customerRecord?.id || existingUserByEmail.id,
                    fullName: profile.full_name || full_name,
                    phone: profile.phone_number || normalizedPhoneDigits,
                    email: profile.email || email,
                    customerTypeId: assignedTypeId || customer?.customer_type_id || null,
                  },
                  message: "לקוח קיים במערכת",
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
              )
            }
          }
        }

        // If we can't find the user, return an error
        return new Response(
          JSON.stringify({
            success: false,
            error: "לקוח עם פרטים אלה כבר קיים במערכת",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }

      // For other auth errors, return the error message
      return new Response(JSON.stringify({ success: false, error: authUserError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("✅ [create-customer] User created successfully:", authData.user.id)

    // Create profile with customer role
    console.log("📝 [create-customer] Creating customer profile...")
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .insert({
        id: authData.user.id,
        full_name: full_name.trim(),
        phone_number: normalizedPhoneDigits,
        email: email || null,
        role: "customer",
      })
      .select()

    if (profileError) {
      console.error("❌ [create-customer] Profile error:", profileError)
      // Clean up auth user if profile creation fails
      await supabaseClient.auth.admin.deleteUser(authData.user.id).catch((err) => {
        console.error("Failed to cleanup auth user:", err)
      })
      return new Response(JSON.stringify({ success: false, error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("✅ [create-customer] Profile created successfully")

    // Create customer record
    console.log("📝 [create-customer] Creating customer record...")
    const { error: customerError, data: customerData } = await supabaseClient
      .from("customers")
      .insert({
        auth_user_id: authData.user.id,
        full_name: full_name.trim(),
        phone: normalizedPhoneDigits,
        email: email || null,
        phone_search: normalizedPhoneDigits,
        customer_type_id: resolvedCustomerTypeId,
      })
      .select()
      .single()

    if (customerError) {
      console.error("❌ [create-customer] Customer record error:", customerError)
      // Don't fail the whole operation if customer record creation fails
      // The profile is already created, so the user can still function
      // But log the error for debugging
    } else {
      console.log("✅ [create-customer] Customer record created successfully:", customerData?.id)
    }

    // Return the actual customer record ID (not auth user ID)
    const customerRecordId = customerData?.id || authData.user.id

    return new Response(
      JSON.stringify({
        success: true,
        customerId: customerRecordId,
        customerTypeId: customerData?.customer_type_id || resolvedCustomerTypeId || null,
        customer: {
          id: customerRecordId,
          fullName: full_name,
          phone: normalizedPhoneDigits,
          email: email || null,
          customerTypeId: customerData?.customer_type_id || resolvedCustomerTypeId || null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("💥 [create-customer] Unexpected error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "שגיאה בלתי צפויה",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

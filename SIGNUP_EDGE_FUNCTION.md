# Signup Edge Function

This document describes the new signup system that uses a single API call to handle user registration and external webhook integration.

## Overview

The signup process now works as follows:

1. **Frontend** makes a single POST request to `/functions/v1/signup`
2. **Edge Function** creates the user account in Supabase
3. **Edge Function** creates the user profile
4. **Edge Function** calls the external webhook API
5. **Edge Function** stores the returned `client_id` in the user profile
6. **Frontend** receives confirmation and can auto-sign-in the user

## API Endpoint

**URL:** `/functions/v1/signup`  
**Method:** POST  
**Content-Type:** application/json

### Request Body

```json
{
  "email": "user@example.com",
  "password": "userpassword",
  "full_name": "User Full Name",
  "phone_number": "0501234567"
}
```

### Response

**Success (200):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
    // ... other user fields
  },
  "client_id": "1234"
}
```

**Error (400/500):**

```json
{
  "error": "Error message"
}
```

## Database Changes

The `profiles` table now includes a `client_id` field:

```sql
ALTER TABLE public.profiles ADD COLUMN client_id TEXT;
```

## External Webhook

The edge function calls the webhook at:
`https://hook.eu2.make.com/ze29lr9ryurkaamjflfe8vd6habc7511`

**Webhook Request:**

```json
{
  "phone": "0501234567",
  "name": "User Full Name",
  "email": "user@example.com"
}
```

**Webhook Response:**

```json
{
  "cliend_id": "1234"
}
```

## Deployment

To deploy the signup edge function:

```bash
supabase functions deploy signup
```

Or use the deployment script:

```bash
./deploy-functions.sh
```

## Testing

Test the signup function using the provided test script:

```bash
cd scripts
deno run --allow-net --allow-env test-signup.ts
```

## Frontend Integration

The frontend now makes a single API call to the edge function instead of using Supabase auth directly. The user is automatically signed in after successful registration.

## Error Handling

- If the webhook call fails, the user is still created but a warning is returned
- All errors are logged for debugging
- The function gracefully handles network issues with the external API

## Security

- Uses Supabase service role key for admin operations
- Validates all input fields
- CORS headers are properly configured
- No sensitive data is exposed in error messages

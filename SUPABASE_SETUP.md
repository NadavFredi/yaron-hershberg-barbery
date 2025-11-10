# 🔒 Secure Airtable Integration with Supabase

This setup moves all Airtable API calls to Supabase Edge Functions, keeping your tokens secure on the backend.

## 🚀 **Quick Start**

### 1. **Install Supabase CLI**

```bash
npm install -g supabase
```

### 2. **Set Environment Variables**

Create a `.env.local` file in your project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Airtable Configuration (for Supabase Edge Functions)
AIRTABLE_PAT=your_airtable_personal_access_token
AIRTABLE_BASE_ID=your_airtable_base_id
```

### 3. **Start Supabase Locally**

```bash
supabase start
```

### 4. **Set Secrets for Edge Functions**

```bash
supabase secrets set --env-file .env.local
```

### 5. **Deploy Edge Functions**

```bash
supabase functions deploy airtable-api
```

## 🏗️ **Architecture Overview**

```
Frontend (React) → Supabase Client → Individual Edge Functions → Airtable API
                                      ↓
                                 Secure Token Storage
```

## 📁 **File Structure**

```
supabase/
├── functions/
│   ├── list-owner-treatments/      # List owner treatments endpoint
│   ├── check-treatment-registration/ # Check treatment registration endpoint
│   ├── get-treatment-appointments/  # Get treatment appointments endpoint
│   ├── get-available-dates/   # Get available dates endpoint
│   └── get-available-times/   # Get available times endpoint
├── config.toml               # Supabase configuration
└── .env.local                # Environment variables (not in git)

src/
├── integrations/
│   └── supabase/
│       ├── client.ts         # Supabase client
│       ├── airtableService.ts # Secure API service
│       └── types.ts          # TypeScript types
└── components/
    └── SecureAirtableDemo.tsx # Demo component
```

## 🔧 **Available API Functions**

### 1. **List Owner Treatments**

```typescript
const treatments = await listOwnerTreatments(ownerId)
```

### 2. **Check Treatment Registration**

```typescript
const status = await checkTreatmentRegistration(treatmentId)
```

### 3. **Get Treatment Appointments**

```typescript
const appointments = await getTreatmentAppointments(treatmentId)
```

### 4. **Get Available Dates**

```typescript
const dates = await getAvailableDates(treatmentId, month)
```

### 5. **Get Available Times**

```typescript
const times = await getAvailableTimes(treatmentId, date)
```

## 🧪 **Testing**

### **Local Development**

1. Start Supabase: `supabase start`
2. Visit: `http://localhost:8082/secure-demo`
3. Test all API functions

### **Production Deployment**

1. Deploy to Supabase: `supabase functions deploy airtable-api --project-ref your-project-ref`
2. Set production secrets
3. Update environment variables

## 🔐 **Security Features**

- ✅ **Token Protection**: Airtable tokens never leave the backend
- ✅ **Authentication**: Supabase handles user authentication
- ✅ **Rate Limiting**: Can be implemented in Edge Functions
- ✅ **Audit Logs**: All API calls are logged
- ✅ **CORS Protection**: Proper CORS headers configured
- ✅ **Error Handling**: Secure error messages (no token exposure)

## 🚨 **Important Notes**

### **Environment Variables**

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Public anon key (safe for frontend)
- `AIRTABLE_PAT`: Personal Access Token (stored securely on Supabase)
- `AIRTABLE_BASE_ID`: Your Airtable base ID

### **Secrets Management**

```bash
# List current secrets
supabase secrets list

# Set secrets from file
supabase secrets set --env-file .env.local

# Set individual secrets
supabase secrets set AIRTABLE_PAT=your_token_here
```

## 🔄 **Migration from Direct Airtable Calls**

### **Before (Insecure)**

```typescript
// ❌ DON'T DO THIS - exposes tokens
const response = await fetch("https://api.airtable.com/v0/...", {
  headers: {
    Authorization: `Bearer ${AIRTABLE_PAT}`, // Token exposed!
  },
})
```

### **After (Secure)**

```typescript
// ✅ DO THIS - tokens stay secure
const treatments = await listOwnerTreatments(ownerId)
```

## 🐛 **Troubleshooting**

### **Edge Function Not Found**

```bash
# Check if function is deployed
supabase functions list

# Redeploy if needed
supabase functions deploy airtable-api
```

### **Authentication Errors**

```bash
# Check Supabase client configuration
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY)
```

### **Token Errors**

```bash
# Check if secrets are set
supabase secrets list

# Set secrets again
supabase secrets set --env-file .env.local
```

## 📚 **Next Steps**

1. **Replace Direct Calls**: Update all components to use the secure service
2. **Add Authentication**: Implement user authentication with Supabase Auth
3. **Rate Limiting**: Add rate limiting to Edge Functions
4. **Caching**: Implement caching for frequently accessed data
5. **Monitoring**: Add logging and monitoring to Edge Functions

## 🆘 **Support**

- **Supabase Docs**: https://supabase.com/docs
- **Edge Functions**: https://supabase.com/docs/guides/functions
- **Security Best Practices**: https://supabase.com/docs/guides/security

#!/bin/bash

echo "🚀 Deploying all Supabase Edge Functions..."
echo "============================================="

# Deploy all functions
echo "📦 Deploying signup..."
supabase functions deploy signup

echo "📦 Deploying get-profile-appointments..."
supabase functions deploy get-profile-appointments

echo "📦 Deploying check-treatment-registration..."
supabase functions deploy check-treatment-registration

echo "📦 Deploying get-treatment-appointments..."
supabase functions deploy get-treatment-appointments

echo "📦 Deploying get-available-dates..."
supabase functions deploy get-available-dates

echo "📦 Deploying get-available-times..."
supabase functions deploy get-available-times

echo ""
echo "✅ All Edge Functions deployed successfully!"
echo ""
echo "🔍 To verify deployment, run:"
echo "   supabase functions list"
echo ""
echo "🧪 Test the functions at: http://localhost:8082/secure-demo"

#!/bin/bash

echo "🚀 Deploying all Supabase Edge Functions..."
echo "============================================="

# Deploy all functions
echo "📦 Deploying signup..."
supabase functions deploy signup

echo "📦 Deploying list-owner-dogs..."
supabase functions deploy list-owner-dogs

echo "📦 Deploying check-dog-registration..."
supabase functions deploy check-dog-registration

echo "📦 Deploying get-dog-appointments..."
supabase functions deploy get-dog-appointments

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

#!/bin/bash

echo "🔒 Setting up Secure Airtable Integration with Supabase"
echo "========================================================"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
else
    echo "✅ Supabase CLI already installed"
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local file not found. Creating template..."
    cat > .env.local << EOF
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Airtable Configuration (for Supabase Edge Functions)
AIRTABLE_PAT=your_airtable_personal_access_token_here
AIRTABLE_BASE_ID=your_airtable_base_id_here
EOF
    echo "📝 Created .env.local template. Please fill in your actual values!"
    echo "🚨 IMPORTANT: Never commit .env.local to version control!"
else
    echo "✅ .env.local file exists"
fi

# Check if Supabase is running
if supabase status &> /dev/null; then
    echo "✅ Supabase is running locally"
else
    echo "🔄 Starting Supabase locally..."
    supabase start
fi

# Set secrets if .env.local exists and has content
if [ -f .env.local ] && [ -s .env.local ]; then
    echo "🔐 Setting Supabase secrets from .env.local..."
    supabase secrets set --env-file .env.local
else
    echo "⚠️  Please fill in .env.local before setting secrets"
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo "1. Fill in your actual values in .env.local"
echo "2. Run: supabase secrets set --env-file .env.local"
echo "3. Run: supabase functions deploy get-profile-appointments"
echo "4. Run: supabase functions deploy check-treatment-registration"
echo "5. Run: supabase functions deploy get-treatment-appointments"
echo "6. Run: supabase functions deploy get-available-dates"
echo "7. Run: supabase functions deploy get-available-times"
echo "4. Visit: http://localhost:8082/secure-demo"
echo ""
echo "📚 See SUPABASE_SETUP.md for detailed instructions"

#!/bin/bash
set -e

echo "🔍 Chrome Web Store OAuth Credentials Test"
echo "==========================================="
echo ""

# Check if secrets are provided as environment variables
if [[ -z "$CWS_CLIENT_ID" ]] || [[ -z "$CWS_CLIENT_SECRET" ]] || [[ -z "$CWS_REFRESH_TOKEN" ]]; then
  echo "❌ Please set environment variables:"
  echo "   export CWS_CLIENT_ID='your-client-id'"
  echo "   export CWS_CLIENT_SECRET='your-client-secret'"
  echo "   export CWS_REFRESH_TOKEN='your-refresh-token'"
  echo ""
  echo "To get values from GitHub secrets:"
  echo "   gh secret list"
  exit 1
fi

echo "✅ Environment variables found"
echo "   Client ID: ${CWS_CLIENT_ID:0:20}..."
echo "   Client Secret: ${CWS_CLIENT_SECRET:0:15}..."
echo "   Refresh Token: ${CWS_REFRESH_TOKEN:0:15}..."
echo ""

echo "🔑 Testing OAuth token exchange..."
TOKEN_RESPONSE=$(curl -s "https://oauth2.googleapis.com/token" \
  -d "client_id=${CWS_CLIENT_ID}" \
  -d "client_secret=${CWS_CLIENT_SECRET}" \
  -d "refresh_token=${CWS_REFRESH_TOKEN}" \
  -d "grant_type=refresh_token")

echo "📋 Token Response:"
echo "$TOKEN_RESPONSE" | python3 -m json.tool
echo ""

# Check if we got an access token
if echo "$TOKEN_RESPONSE" | python3 -c "import sys,json; obj=json.load(sys.stdin); exit(0 if 'access_token' in obj else 1)" 2>/dev/null; then
  echo "✅ SUCCESS! Access token obtained"
  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
  echo "   Access Token: ${ACCESS_TOKEN:0:30}..."
  echo ""
  echo "🎉 Your credentials are working correctly!"
else
  echo "❌ FAILED to get access token"
  echo ""
  echo "Common fixes:"
  echo "1. Verify OAuth consent screen is configured with test users"
  echo "2. Ensure redirect URI is: https://developers.google.com/oauthplayground"
  echo "3. Regenerate refresh token using OAuth Playground with exact same credentials"
  echo "4. Check that Chrome Web Store API is enabled in your GCP project"
  exit 1
fi

#!/bin/bash
# ============================================
# SmartDesk AI — Nail Salon Automation
# Quick webhook test script
# Usage: ./scripts/test-webhook.sh
# ============================================

N8N_URL="${N8N_WEBHOOK_URL:-http://localhost:5678}"
WEBHOOK_PATH="/webhook/nail-salon-inbound"
TEST_PHONE="${TEST_PHONE:-4025551234}"

echo "🧪 SmartDesk AI — Webhook Test"
echo "================================"
echo "n8n URL: $N8N_URL"
echo "Test Phone: $TEST_PHONE"
echo ""

# Test 1: Greeting
echo "📱 Test 1: Sending greeting message..."
curl -s -X POST "$N8N_URL$WEBHOOK_PATH" \
  -H "Content-Type: application/json" \
  -d "{\"msisdn\": \"$TEST_PHONE\", \"text\": \"Hi, I want to book an appointment\", \"messageId\": \"test-001\", \"channel\": \"vonage\"}" \
  | jq .

echo ""
sleep 2

# Test 2: Booking inquiry
echo "📱 Test 2: Sending booking inquiry..."
curl -s -X POST "$N8N_URL$WEBHOOK_PATH" \
  -H "Content-Type: application/json" \
  -d "{\"msisdn\": \"$TEST_PHONE\", \"text\": \"I want gel nails for tomorrow at 2pm. My name is Sarah.\", \"messageId\": \"test-002\", \"channel\": \"vonage\"}" \
  | jq .

echo ""
sleep 2

# Test 3: FAQ
echo "📱 Test 3: Sending FAQ..."
curl -s -X POST "$N8N_URL$WEBHOOK_PATH" \
  -H "Content-Type: application/json" \
  -d "{\"msisdn\": \"$TEST_PHONE\", \"text\": \"How much is a full acrylic set?\", \"messageId\": \"test-003\", \"channel\": \"vonage\"}" \
  | jq .

echo ""
echo "✅ Tests complete! Check n8n execution logs and Airtable for results."
echo ""
echo "💡 Tip: Check your n8n dashboard at $N8N_URL for execution details."

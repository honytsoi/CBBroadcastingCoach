#!/bin/bash

# ==============================
# Backend Testing Script
# ==============================

# Load environment variables (if needed)
# Uncomment the following line if you have an .env file with environment variables.
# source .env

# Set environment (dev or live)
ENV="live"  # Change to "dev" for local testing

if [ "$ENV" == "dev" ]; then
  BASE_URL="http://localhost:8787"
else
  BASE_URL="https://apibackend.adult-webcam-faq.com"
fi

echo "Testing backend on $BASE_URL..."

# Helper function to log test results
log_result() {
  local test_name="$1"
  local result="$2"

  if [ "$result" == "PASS" ]; then
    echo "✅ TEST PASSED: $test_name"
  else
    echo "❌ TEST FAILED: $test_name"
  fi
}

# ==============================
# Step 1: Get a Valid Session Key
# ==============================
echo "Step 1: Getting a valid session key..."
SESSION_KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/get-session-key" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "broadcaster": "streamer_abc"
  }')

# Parse session key and timestamp using jq
SESSION_KEY=$(echo "$SESSION_KEY_RESPONSE" | jq -r '.sessionKey')
EXPIRES_AT=$(echo "$SESSION_KEY_RESPONSE" | jq -r '.expiresAt')

if [ "$SESSION_KEY" != "null" ] && [ "$EXPIRES_AT" != "null" ]; then
  log_result "Get Session Key" "PASS"
  echo "Session Key: $SESSION_KEY"
  echo "Expires At: $EXPIRES_AT"
else
  log_result "Get Session Key" "FAIL"
  echo "Response: $SESSION_KEY_RESPONSE"
  exit 1
fi

# ==============================
# Step 2: Test Generate Prompt with Valid Session Key
# ==============================
echo "Step 2: Testing generate-prompt with a valid session key..."
VALID_PROMPT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-prompt" \
  -H "Content-Type: application/json" \
  -d '{
    "context": [
      { "type": "chat", "text": "john_doe says hello!", "timestamp": "2023-10-01T12:05:00Z" }
    ],
    "broadcaster": "streamer_abc",
    "preferences": "",
    "sessionKey": "'"$SESSION_KEY"'"
  }')

# Parse response fields
ACTION=$(echo "$VALID_PROMPT_RESPONSE" | jq -r '.action')
CONTENT=$(echo "$VALID_PROMPT_RESPONSE" | jq -r '.content')
NEW_SESSION_KEY=$(echo "$VALID_PROMPT_RESPONSE" | jq -r '.sessionKey')

if [ "$ACTION" != "null" ] && [ "$CONTENT" != "null" ] && [ "$NEW_SESSION_KEY" != "null" ]; then
  log_result "Generate Prompt (Valid Session Key)" "PASS"
  echo "Action: $ACTION"
  echo "Content: $CONTENT"
  echo "New Session Key: $NEW_SESSION_KEY"
else
  log_result "Generate Prompt (Valid Session Key)" "FAIL"
  echo "Response: $VALID_PROMPT_RESPONSE"
  exit 1
fi

# ==============================
# Step 3: Test Generate Prompt with Invalid Session Key
# ==============================
echo "Step 3: Testing generate-prompt with an invalid session key..."
INVALID_PROMPT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-prompt" \
  -H "Content-Type: application/json" \
  -d '{
    "context": [
      { "type": "chat", "text": "john_doe says hello!", "timestamp": "2023-10-01T12:05:00Z" }
    ],
    "broadcaster": "streamer_abc",
    "preferences": "",
    "sessionKey": "INVALID_SESSION_KEY"
  }')

# Parse error message
ERROR_MESSAGE=$(echo "$INVALID_PROMPT_RESPONSE" | jq -r '.error')

if [ "$ERROR_MESSAGE" == "Invalid or missing session key" ]; then
  log_result "Generate Prompt (Invalid Session Key)" "PASS"
  echo "Error Message: $ERROR_MESSAGE"
else
  log_result "Generate Prompt (Invalid Session Key)" "FAIL"
  echo "Response: $INVALID_PROMPT_RESPONSE"
  exit 1
fi

# ==============================
# Step 4: Test Generate Prompt with Missing Context
# ==============================
echo "Step 4: Testing generate-prompt with missing context..."
MISSING_CONTEXT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-prompt" \
  -H "Content-Type: application/json" \
  -d '{
    "context": [],
    "broadcaster": "streamer_abc",
    "preferences": "",
    "sessionKey": "'"$SESSION_KEY"'"
  }')

# Parse error message
ERROR_MESSAGE=$(echo "$MISSING_CONTEXT_RESPONSE" | jq -r '.error')

if [ "$ERROR_MESSAGE" == "Invalid or missing context" ]; then
  log_result "Generate Prompt (Missing Context)" "PASS"
  echo "Error Message: $ERROR_MESSAGE"
else
  log_result "Generate Prompt (Missing Context)" "FAIL"
  echo "Response: $MISSING_CONTEXT_RESPONSE"
  exit 1
fi

# ==============================
# Final Summary
# ==============================
echo "All tests completed."


#!/bin/bash
# run-headless-tests.sh

# Handle script arguments
KEEP_SCREENSHOTS=1  # Default to keeping screenshots
CLEAN_SCREENSHOTS=0

# Process command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --clean-screenshots)
      CLEAN_SCREENSHOTS=1
      shift
      ;;
    --no-screenshots)
      KEEP_SCREENSHOTS=0
      shift
      ;;
    *)
      # Unknown option
      shift
      ;;
  esac
done

# Set up screenshots directory
SCREENSHOTS_DIR="tests/headless/screenshots"
mkdir -p "$SCREENSHOTS_DIR"

# Clean screenshots if requested
if [[ $CLEAN_SCREENSHOTS -eq 1 ]]; then
  echo "Cleaning previous screenshots..."
  rm -f "$SCREENSHOTS_DIR"/*.png
fi

# Kill any existing processes using port 8787
echo "Checking for existing processes on port 8787..."
EXISTING_PID=$(lsof -t -i:8787 2>/dev/null)
if [ ! -z "$EXISTING_PID" ]; then
  echo "Killing existing process $EXISTING_PID using port 8787..."
  kill $EXISTING_PID
  sleep 2
fi

# Start the server in background
echo "Starting development server..."
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Run tests
node tests/headless/test-example.js

# Capture exit code
TEST_EXIT_CODE=$?

# Kill server
echo "Shutting down server..."
kill $SERVER_PID 2>/dev/null || true

# Make sure no processes are left on port 8787
EXISTING_PID=$(lsof -t -i:8787 2>/dev/null)
if [ ! -z "$EXISTING_PID" ]; then
  echo "Cleaning up remaining process $EXISTING_PID..."
  kill $EXISTING_PID 2>/dev/null || true
fi

# Report on screenshots
SCREENSHOT_COUNT=$(ls "$SCREENSHOTS_DIR"/*.png 2>/dev/null | wc -l)
if [[ $SCREENSHOT_COUNT -gt 0 ]]; then
  echo "Captured $SCREENSHOT_COUNT screenshots in $SCREENSHOTS_DIR"
  
  # List recent screenshots
  echo "Most recent screenshots:"
  ls -lt "$SCREENSHOTS_DIR" | head -5
fi

echo "Test completed with exit code: $TEST_EXIT_CODE"

# Exit with test exit code
exit $TEST_EXIT_CODE
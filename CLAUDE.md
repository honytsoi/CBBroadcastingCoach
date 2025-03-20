# Broadcasting Coach Project Guidelines

## Build/Test Commands
```bash
# Start development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy

# Run all tests
npm test

# Run single test (example pattern)
npx jest path/to/test.js -t "test name pattern"

# Check backend connectivity
./backend_testing.sh
```

## Code Style Guidelines
- **Module System**: Use ES Modules (`import`/`export`) for frontend, CommonJS (`require`) for backend
- **Naming**: camelCase for variables/functions, PascalCase for classes, UPPERCASE for constants
- **Indentation**: Tabs, width of 2 spaces
- **Error Handling**: Always use try/catch blocks for async operations, log errors and update UI
- **State Management**: Use centralized state objects (e.g., `configState`, `appState`)
- **Async Pattern**: Prefer async/await over Promise chains
- **Documentation**: JSDoc comments for complex functions
- **Security**: Never expose API keys in client code, validate sessionKeys server-side

## Testing
Jest is used for testing with mocks for browser APIs like localStorage and speechSynthesis.
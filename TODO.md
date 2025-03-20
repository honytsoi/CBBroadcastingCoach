# Broadcasting Coach TODO List

## High Priority

1. **Fix CryptoJS Integration**
   - **Files**: `/static/src/user-manager.js` (lines 322-336)
   - **Issue**: The `ProtectionEncode` and `ProtectionDeEncode` methods use CryptoJS library but it's not imported
   - **Solution**: Add proper import for CryptoJS or implement a different encryption method
   - **Implementation Notes**: Consider using the Web Crypto API as a native alternative or add a script tag in index.html to include CryptoJS from a CDN

2. **Fix Syntax Error in ImportData Method**
   - **Files**: `/static/src/user-manager.js` (around line 250)
   - **Issue**: Missing closing brace `{` in the try/catch block
   - **Solution**: Add the missing brace to properly close the try/catch statement
   - **Implementation Notes**: The error is causing the method to fail silently, breaking the data import functionality

## Medium Priority

3. **Fix Error Display Helper Function**
   - **Files**: `/static/src/displayError.js`
   - **Issue**: References `getOrCreateErrorDisplay()` but this function isn't defined in that file
   - **Solution**: Either import this function from another module or implement it directly in displayError.js
   - **Implementation Notes**: The function should create and return an error display DOM element

4. **Standardize CloudflareWorkerAPI Import**
   - **Files**: 
     - `/static/src/app.js` (uses `import * as CloudflareWorkerAPI`)
     - `/static/src/config.js` (uses `import CloudflareWorkerAPI from`)
   - **Issue**: Inconsistent importing causing confusion with `.default` property usage
   - **Solution**: Standardize the import pattern across all files
   - **Implementation Notes**: Recommend using `import CloudflareWorkerAPI from './api/cloudflareWorker.js'` and updating all references

5. **Update README Documentation**
   - **Files**: `/README.md`
   - **Issue**: Contains crossed-out references to OpenRouter that need proper updating
   - **Solution**: Remove all OpenRouter references and update to reflect Cloudflare Worker integration
   - **Implementation Notes**: Update sections: Requirements, Setup Instructions, Privacy & Security, and Technical Details

## Low Priority

6. **Add Reason Parameter to generateCoachingPrompt Calls**
   - **Files**: `/static/src/app.js` (in event-based prompt functions)
   - **Issue**: Some calls to `generateCoachingPrompt()` are missing the `reason` parameter
   - **Solution**: Add the reason parameter to all calls (e.g., "chatMessage", "userEnter", "inactivity")
   - **Implementation Notes**: The reason parameter is used for analytics and can help with debugging

7. **Implement Password Validation for Data Exports**
   - **Files**: `/static/src/config.js` (in data management UI section)
   - **Issue**: No validation to ensure export passwords meet minimum security requirements
   - **Solution**: Add password strength validation before allowing password-protected exports
   - **Implementation Notes**: Check for minimum length (8+ chars), complexity (letters, numbers, special chars)

8. **Replace Hardcoded Fallback Model**
   - **Files**: `/static/src/modelLoader.js` (line 58)
   - **Issue**: Hardcoded fallback AI model (`@cf/meta/llama-3.2-1b-instruct`) might become outdated
   - **Solution**: Implement a more dynamic fallback system or store fallback models in config
   - **Implementation Notes**: Consider fetching available models from an environment variable or configuration file
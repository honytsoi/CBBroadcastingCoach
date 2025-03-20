
/**
 * Display an error message on the screen
 */
export function displayError(error) {
    const errorDisplay = getOrCreateErrorDisplay();
    const isQuotaError = error.message.toLowerCase().includes('quota') || 
                         error.message.toLowerCase().includes('limit') ||
                         error.message.toLowerCase().includes('exceeded');
    
    // Set title based on error type
    let errorTitle = 'Error';
    if (isQuotaError) {
        errorTitle = 'Quota Exceeded Error';
        errorDisplay.style.backgroundColor = '#fff3cd';
        errorDisplay.style.borderColor = '#ffecb5';
    } else {
        errorDisplay.style.backgroundColor = '#ffebee';
        errorDisplay.style.borderColor = '#ffcdd2';
    }
    
    // Build error message HTML
    errorDisplay.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">${errorTitle}</div>
        <div>${error.message}</div>
        <div style="text-align: right; margin-top: 10px;">
            <button onclick="document.getElementById('errorDisplay').style.display='none'" 
                    style="padding: 5px 10px; background: #f1f1f1; border: none; border-radius: 3px; cursor: pointer;">
                Dismiss
            </button>
        </div>
    `;
    
    errorDisplay.style.display = 'block';
    
    // Auto-hide after 20 seconds if it's not a quota error
    if (!isQuotaError) {
        setTimeout(() => {
            if (errorDisplay) {
                errorDisplay.style.display = 'none';
            }
        }, 20000);
    }
}


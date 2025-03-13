// QR Scanner Module for Broadcasting Real-Time Coach

// State related to QR scanning
const scannerState = {
    scanning: false
};

// DOM Elements
let qrScanner;
let qrCanvas;
let startScanBtn;
let scanResult;
let apiEndpointEl;

// Initialize QR scanner module
function initQRScanner(onQRCodeDetected) {
    // Get DOM elements
    qrScanner = document.getElementById('qrScanner');
    qrCanvas = document.getElementById('qrCanvas');
    startScanBtn = document.getElementById('startScan');
    scanResult = document.getElementById('scanResult');
    apiEndpointEl = document.getElementById('apiEndpoint');
    
    // Add event listeners
    startScanBtn.addEventListener('click', () => {
        if (!scannerState.scanning) {
            startQRScanner(onQRCodeDetected);
        } else {
            stopQRScanner();
        }
    });
}

// Start QR code scanner
async function startQRScanner(onQRCodeDetected) {
    if (!scannerState.scanning) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            qrScanner.srcObject = stream;
            await qrScanner.play();
            scannerState.scanning = true;
            startScanBtn.textContent = 'Cancel Scan';
            qrScanner.classList.remove('hidden');
            scanForQRCode(onQRCodeDetected);
        } catch (error) {
            console.error('Error accessing camera:', error);
            window.addActivityItem('Error accessing camera. Please check permissions.', 'event');
        }
    } else {
        stopQRScanner();
        startScanBtn.textContent = 'Scan QR Code';
    }
}

// Stop QR code scanner
function stopQRScanner() {
    if (qrScanner.srcObject) {
        qrScanner.srcObject.getTracks().forEach(track => track.stop());
        qrScanner.srcObject = null;
    }
    scannerState.scanning = false;
    qrScanner.classList.add('hidden');
}

// Scan for QR code in video stream
function scanForQRCode(onQRCodeDetected) {
    if (!scannerState.scanning) return;

    const context = qrCanvas.getContext('2d', { willReadFrequently: true });
    qrCanvas.width = qrScanner.videoWidth;
    qrCanvas.height = qrScanner.videoHeight;
    
    if (qrScanner.videoWidth === 0) {
        // Video not ready yet, try again soon
        requestAnimationFrame(() => scanForQRCode(onQRCodeDetected));
        return;
    }

    context.drawImage(qrScanner, 0, 0, qrCanvas.width, qrCanvas.height);
    const imageData = context.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
    
    try {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
            // QR code detected
            const url = code.data;
            if (url.includes('eventsapi.chaturbate.com/events/')) {
                stopQRScanner();
                if (onQRCodeDetected && typeof onQRCodeDetected === 'function') {
                    onQRCodeDetected(url);
                }
                displayQRCodeResult(url);
            } else {
                window.addActivityItem('Invalid QR code. Please scan a valid Chaturbate events API QR code.', 'event');
                requestAnimationFrame(() => scanForQRCode(onQRCodeDetected));
            }
        } else {
            // No QR code found, continue scanning
            requestAnimationFrame(() => scanForQRCode(onQRCodeDetected));
        }
    } catch (error) {
        console.error('Error scanning QR code:', error);
        requestAnimationFrame(() => scanForQRCode(onQRCodeDetected));
    }
}

// Display QR code scan result
function displayQRCodeResult(url) {
    apiEndpointEl.textContent = url;
    scanResult.classList.remove('hidden');
}

// Export functions and state
export {
    initQRScanner,
    startQRScanner,
    stopQRScanner,
    scannerState
};

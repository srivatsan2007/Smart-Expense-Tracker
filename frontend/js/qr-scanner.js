document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initScanner();
});

let html5QrCode = null;
let scannedExpenseData = null;

function initScanner() {
    html5QrCode = new Html5Qrcode("reader");

    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            // Prefer back camera if available, else use the first one
            let cameraId = devices[0].id;
            const backCamera = devices.find(d => d.label.toLowerCase().includes('back'));
            if (backCamera) {
                cameraId = backCamera.id;
            }

            html5QrCode.start(
                cameraId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                (decodedText, decodedResult) => {
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignored. html5-qrcode calls this frequently on scan failure.
                }
            ).catch((err) => {
                console.error("Error starting scanner:", err);
                // Fallback to prompting user for an image instead of live camera if failed
                document.getElementById('reader').innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <p>Camera access denied or unavailable.</p>
                    </div>
                `;
            });
        } else {
            console.error("No cameras found.");
            document.getElementById('reader').innerHTML = "<p>No cameras found on this device.</p>";
        }
    }).catch(err => {
        console.error("Error getting cameras:", err);
    });
}

function handleScanSuccess(decodedText) {
    try {
        // We expect decodedText to be a valid URL pointing to the PDF receipt
        const url = new URL(decodedText);
        
        // Stop scanning
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                console.log("Scanner stopped after successful scan.");
            }).catch(err => console.error("Error stopping scanner", err));
        }

        // Show result UI
        document.getElementById('scan-result').style.display = "block";
        document.getElementById('scan-result').innerHTML = `
            <h4><i class="fas fa-check-circle" style="color: #28a745;"></i> Scan Successful!</h4>
            <p style="margin-top: 10px;">Receipt URL detected.</p>
            <button onclick="window.open('${url.href}', '_blank')" class="btn btn-primary" style="width: 100%; margin-top: 15px;">
                <i class="fas fa-external-link-alt"></i> Open Receipt PDF
            </button>
        `;

        // Automatically open the PDF
        window.open(url.href, '_blank');
        
    } catch (e) {
        console.error("Failed to parse QR code data as URL:", e);
        // Fallback if it's old JSON format just in case
        try {
            const parsedData = JSON.parse(decodedText);
            if (parsedData.amount && parsedData.category) {
                alert("This is an old format QR code without a PDF receipt.");
            } else {
                alert("Invalid QR Code format.");
            }
        } catch(err) {
            alert("Invalid QR Code format. Please scan a valid Expense Receipt QR.");
        }
    }
}

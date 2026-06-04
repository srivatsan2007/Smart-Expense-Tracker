let generatedPdfBlob = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check if auth is resolved (Firebase auth is asynchronous)
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            showError("You must be logged in to view this receipt.");
            // Optionally redirect to login.html
            // window.location.href = "login.html";
            return;
        }
        
        await loadReceipt();
    });
});

async function loadReceipt() {
    const params = new URLSearchParams(window.location.search);
    const expenseId = params.get('id');

    if (!expenseId) {
        showError("Invalid receipt URL.");
        return;
    }

    try {
        const db = firebase.firestore();
        const docRef = db.collection("qrShares").doc(expenseId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            
            // Security check - optional if Firestore rules already block it, 
            // but good for UX.
            const currentUser = firebase.auth().currentUser;
            if (data.userId !== currentUser.uid) {
                showError("You do not have permission to view this receipt.");
                return;
            }

            await displayPDF(data);
        } else {
            showError("Receipt not found.");
        }
    } catch (error) {
        console.error("Error loading receipt:", error);
        showError("Error loading receipt data. " + error.message);
    }
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    const errDiv = document.getElementById('error-message');
    errDiv.style.display = 'block';
    errDiv.querySelector('p').textContent = message;
}

async function displayPDF(expenseData) {
    try {
        // Generate PDF exactly as we did in qr-generator, but on the fly!
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header styling
        doc.setFillColor(30, 30, 40);
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(0, 245, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("SMART EXPENSE TRACKER", 20, 25);
        
        // Receipt Details
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        
        doc.text(`Receipt ID: ${expenseData.expenseId}`, 20, 55);
        const dateStr = expenseData.createdAt ? expenseData.createdAt.toDate().toLocaleString() : new Date().toLocaleString();
        doc.text(`Date: ${dateStr}`, 20, 65);
        
        // Items Table Header
        doc.setFillColor(230, 230, 230);
        doc.rect(20, 75, 170, 10, 'F');
        doc.setFont("helvetica", "bold");
        doc.text("Description", 25, 82);
        doc.text("Category", 110, 82);
        doc.text("Amount", 160, 82);
        
        // Items
        doc.setFont("helvetica", "normal");
        let y = 92;
        if (expenseData.items && expenseData.items.length > 0) {
            expenseData.items.forEach(item => {
                doc.text(item.description, 25, y);
                doc.text(item.category, 110, y);
                doc.text(`Rs. ${item.amount.toFixed(2)}`, 160, y);
                y += 10;
            });
        } else {
            // Fallback for older single-item format if any exist
            doc.text(expenseData.description || "N/A", 25, y);
            doc.text(expenseData.category || "N/A", 110, y);
            doc.text(`Rs. ${(expenseData.amount || 0).toFixed(2)}`, 160, y);
            y += 10;
        }
        
        // Total Line
        doc.setLineWidth(0.5);
        doc.line(20, y, 190, y);
        y += 10;
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL AMOUNT", 110, y);
        doc.setTextColor(0, 150, 200);
        doc.text(`Rs. ${(expenseData.totalAmount || expenseData.amount || 0).toFixed(2)}`, 160, y);
        
        // Footer Verification Badge
        y += 40;
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("Verified by Smart Expense Tracker Platform", 20, y);
        
        // Output blob
        generatedPdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(generatedPdfBlob);
        
        // Update UI
        document.getElementById('loading').style.display = 'none';
        
        const iframe = document.getElementById('pdf-iframe');
        iframe.src = pdfUrl;
        iframe.style.display = 'block';
        
        document.getElementById('actions').style.display = 'flex';

    } catch (err) {
        console.error("Error generating PDF:", err);
        showError("Failed to render PDF document.");
    }
}

function downloadPDF() {
    if (!generatedPdfBlob) return;
    
    const url = URL.createObjectURL(generatedPdfBlob);
    const link = document.createElement("a");
    const expenseId = new URLSearchParams(window.location.search).get('id') || 'receipt';
    
    link.download = `${expenseId}.pdf`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
}

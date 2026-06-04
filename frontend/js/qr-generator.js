document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    const form = document.getElementById('qr-form');
    if (form) {
        form.addEventListener('submit', handleGenerateQR);
    }

    const addBtn = document.getElementById('add-item-btn');
    if (addBtn) {
        addBtn.addEventListener('click', addExpenseItem);
    }
});

let currentQRData = null;

function addExpenseItem() {
    const container = document.getElementById('expense-items-container');
    const newItem = document.createElement('div');
    newItem.className = 'expense-item';
    newItem.style.padding = '15px';
    newItem.style.background = 'rgba(255,255,255,0.05)';
    newItem.style.borderRadius = '8px';
    newItem.style.marginBottom = '15px';
    newItem.style.position = 'relative';

    newItem.innerHTML = `
        <button type="button" class="btn remove-item-btn" style="position: absolute; top: 10px; right: 10px; background: transparent; color: var(--danger-color); padding: 5px; border: none;"><i class="fas fa-times"></i></button>
        <div class="form-row">
            <div class="form-group">
                <label>Amount</label>
                <input type="number" class="form-control item-amount" placeholder="e.g., 500" required>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select class="form-control item-category" required>
                    <option value="Food">Food & Dining</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Housing">Housing/Rent</option>
                    <option value="Bills">Bills & Utilities</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Other">Other</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" class="form-control item-description" placeholder="e.g., Internet Bill" required>
        </div>
    `;

    // Add remove listener
    newItem.querySelector('.remove-item-btn').addEventListener('click', function() {
        newItem.remove();
    });

    container.appendChild(newItem);
}

async function handleGenerateQR(e) {
    e.preventDefault();
    
    const user = firebase.auth().currentUser;
    if (!user) {
        alert("You must be logged in to generate a QR code.");
        return;
    }

    const items = [];
    let totalAmount = 0;
    document.querySelectorAll('.expense-item').forEach(el => {
        const amount = parseFloat(el.querySelector('.item-amount').value);
        const category = el.querySelector('.item-category').value;
        const desc = el.querySelector('.item-description').value;
        
        if (amount && category && desc) {
            items.push({ amount, category, description: desc });
            totalAmount += amount;
        }
    });

    if (items.length === 0) {
        alert("Please add at least one valid expense.");
        return;
    }

    const expenseId = "EXP" + Date.now();
    const expenseData = {
        expenseId: expenseId,
        items: items,
        totalAmount: totalAmount,
        date: new Date().toISOString(),
        userId: user.uid
    };

    // Update UI to show loading
    const generateBtn = document.getElementById('generate-btn');
    const originalBtnText = generateBtn.innerHTML;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Receipt...';
    generateBtn.disabled = true;

    try {
        // Create the receipt URL
        // We use window.location.origin to get the current domain (e.g. http://localhost:5000)
        const receiptURL = `${window.location.origin}/receipt.html?id=${expenseId}`;
        
        // Save to Firestore
        await saveQRToFirebase(expenseData, receiptURL);

        currentQRData = receiptURL;

        // Generate QR Code with Receipt URL
        const canvas = document.getElementById("qrCanvas");
        QRCode.toCanvas(canvas, receiptURL, {
            width: 250,
            margin: 2,
            color: {
                dark: "#00F5FF", // Neon cyan
                light: "#FFFFFF" 
            }
        });
        
        canvas.style.display = "block";
        document.getElementById('qr-actions').style.display = "flex";
        
    } catch (err) {
        console.error("Error in QR generation flow:", err);
        alert("Failed to generate QR code and receipt.");
    } finally {
        generateBtn.innerHTML = originalBtnText;
        generateBtn.disabled = false;
    }
}

async function saveQRToFirebase(expenseData, receiptURL) {
    try {
        const db = firebase.firestore();
        
        await db.collection("qrShares").doc(expenseData.expenseId).set({
            userId: expenseData.userId,
            expenseId: expenseData.expenseId,
            items: expenseData.items,
            totalAmount: expenseData.totalAmount,
            receiptURL: receiptURL,
            qrGenerated: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('qr-status').style.display = "block";
        setTimeout(() => {
            document.getElementById('qr-status').style.display = "none";
        }, 3000);
        
        console.log("QR Saved to Firestore with link: ", receiptURL);
    } catch(error) {
        console.error("Error saving to Firestore:", error);
        throw error;
    }
}

function downloadQR() {
    const canvas = document.getElementById("qrCanvas");
    if (!canvas || canvas.style.display === "none") return;
    
    const link = document.createElement("a");
    link.download = `expense-qr-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

async function shareQR() {
    if (!currentQRData) return;
    
    try {
        const canvas = document.getElementById("qrCanvas");
        canvas.toBlob(async (blob) => {
            const file = new File([blob], "expense-qr.png", { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Split Expense Receipt',
                    text: 'Scan this QR code to view the PDF receipt.',
                    files: [file]
                });
            } else {
                alert("Native sharing is not supported. Please download the QR code.");
            }
        });
    } catch (err) {
        console.error("Share failed:", err);
    }
}

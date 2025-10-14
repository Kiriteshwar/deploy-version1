// Check for overdue fees and display alert
async function checkOverdueFees() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) return; // Not logged in

        const response = await fetch('/api/fees', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) return;

        const data = await response.json();
        const latestPayment = data.payments && data.payments[0];
        
        if (latestPayment && latestPayment.balance > 0) {
            // Create alert if it doesn't exist
            if (!document.getElementById('fee-alert')) {
                const alertDiv = document.createElement('div');
                alertDiv.id = 'fee-alert';
                alertDiv.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #dc3545;
                    color: white;
                    padding: 12px;
                    text-align: center;
                    font-weight: bold;
                    z-index: 9999;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 10px;
                `;
                
                const message = document.createElement('span');
                message.innerHTML = `⚠️ You have a pending fee balance of ₹${latestPayment.balance}. Please clear your dues.`;
                
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '×';
                closeBtn.style.cssText = `
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0 10px;
                    margin-left: 10px;
                `;
                closeBtn.onclick = () => alertDiv.remove();
                
                const viewDetailsBtn = document.createElement('button');
                viewDetailsBtn.innerHTML = 'View Details';
                viewDetailsBtn.style.cssText = `
                    background: white;
                    color: #dc3545;
                    border: none;
                    padding: 5px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    margin-left: 15px;
                `;
                viewDetailsBtn.onclick = () => window.location.href = '/fee-details.html';
                
                alertDiv.appendChild(message);
                alertDiv.appendChild(viewDetailsBtn);
                alertDiv.appendChild(closeBtn);
                
                // Adjust body padding to prevent content from being hidden under alert
                const header = document.querySelector('header');
                if (header) {
                    header.style.marginTop = '48px';
                }
                
                document.body.insertBefore(alertDiv, document.body.firstChild);
            }
        }
    } catch (error) {
        console.error('Error checking fee status:', error);
    }
}

// Check when page loads
document.addEventListener('DOMContentLoaded', checkOverdueFees); 
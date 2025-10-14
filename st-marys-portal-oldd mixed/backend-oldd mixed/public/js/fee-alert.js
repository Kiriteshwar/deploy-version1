// Check for overdue fees and display alert
async function checkOverdueFees() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) return; // Not logged in

        // Check if we're on the dashboard and alert was already shown this session
        const isDashboard = window.location.pathname.includes('dashboard.html') || window.location.pathname === '/';
        const alertShownThisSession = sessionStorage.getItem('fee_alert_shown');
        
        if (isDashboard && alertShownThisSession === 'true') {
            return; // Don't show alert again on dashboard for this session
        }

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
                    padding: 12px 8px;
                    text-align: center;
                    font-weight: bold;
                    z-index: 9999;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    min-height: 48px;
                `;
                
                const message = document.createElement('span');
                message.innerHTML = `⚠️ You have pending fees. Please clear your dues.`;
                message.style.cssText = `
                    font-size: 14px;
                    line-height: 1.4;
                    flex-grow: 1;
                    min-width: 200px;
                `;
                
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '×';
                closeBtn.style.cssText = `
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 8px 12px;
                    margin: 0;
                    min-width: 44px;
                    min-height: 44px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                `;
                closeBtn.onmouseover = () => closeBtn.style.backgroundColor = 'rgba(255,255,255,0.2)';
                closeBtn.onmouseout = () => closeBtn.style.backgroundColor = 'transparent';
                closeBtn.onclick = () => alertDiv.remove();
                
                const viewDetailsBtn = document.createElement('button');
                viewDetailsBtn.innerHTML = 'View Details';
                viewDetailsBtn.style.cssText = `
                    background: white;
                    color: #dc3545;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 13px;
                    margin: 0;
                    min-height: 36px;
                    white-space: nowrap;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transition: all 0.2s;
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
                
                // Mark alert as shown for this session if on dashboard
                if (isDashboard) {
                    sessionStorage.setItem('fee_alert_shown', 'true');
                }
            }
        }
    } catch (error) {
        console.error('Error checking fee status:', error);
    }
}

// Check when page loads
document.addEventListener('DOMContentLoaded', checkOverdueFees); 
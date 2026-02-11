function showNotification(message, type = 'info') {
    console.log('Notification triggered:', message, type); // Debug log

    // Get or create container
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    
    // Icon based on type (using FontAwesome classes if available, otherwise simplified)
    let iconHtml = '';
    const hasFontAwesome = document.querySelector('link[href*="font-awesome"]');
    
    if (hasFontAwesome) {
        if (type === 'success') iconHtml = '<i class="fas fa-check-circle" style="color: #10b981; margin-right: 12px; font-size: 18px;"></i>';
        else if (type === 'error') iconHtml = '<i class="fas fa-circle-xmark" style="color: #ef4444; margin-right: 12px; font-size: 18px;"></i>';
        else if (type === 'warning') iconHtml = '<i class="fas fa-triangle-exclamation" style="color: #f59e0b; margin-right: 12px; font-size: 18px;"></i>';
        else iconHtml = '<i class="fas fa-info-circle" style="color: #2563eb; margin-right: 12px; font-size: 18px;"></i>';
    } else {
        // Fallback or simple styling
        let color = '#2563eb';
        if (type === 'success') color = '#10b981';
        if (type === 'error') color = '#ef4444';
        if (type === 'warning') color = '#f59e0b';
        iconHtml = `<span style="color: ${color}; margin-right: 12px; font-weight: bold; font-size: 18px;">●</span>`;
    }
    
    toast.innerHTML = `
        <div class="notification-content">
            ${iconHtml}
            <span class="notification-message">${message}</span>
        </div>
        <span class="notification-close" onclick="this.closest('.notification-toast').remove()">&times;</span>
    `;

    container.appendChild(toast);

    // Trigger animation
    // Use setTimeout to ensure the browser has time to render the initial state
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Auto remove
    setTimeout(() => {
        if (toast && toast.parentElement) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
            }, 500); // Wait for transition
        }
    }, 5000);
}

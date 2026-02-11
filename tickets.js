// Tickets Management Logic

const SCRIPT_URL = window.APP_CONFIG && window.APP_CONFIG.SCRIPT_URL ? window.APP_CONFIG.SCRIPT_URL : 'https://script.google.com/macros/s/AKfycbyMTRZJHjIsjJOlRQYM_cek9cGvDLBe8v018aBXwl2UoptVRVs6pbwwvvdBx_isCTv9/exec';

(function() {
    try {
        const storedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = storedTheme || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {}
})();

function setupThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    const syncIcon = () => {
        const theme = document.documentElement.getAttribute('data-theme');
        btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    };

    syncIcon();
    btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
        syncIcon();
        try { window.dispatchEvent(new Event('themechange')); } catch (e) {}
    });
}

document.addEventListener('DOMContentLoaded', function() {
    setupThemeToggle();
    // Check authentication
    const isAuthenticated = sessionStorage.getItem('adminAuthenticated');
    
    if (!isAuthenticated) {
        showNotification('Access Denied. Please login first.', 'error');
        setTimeout(function() {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    // Initialize UI
    fetchTickets();
    setupEditModal();
    setupCreateModal();
    setupRefresh();
});

let allTickets = []; // Store fetched tickets
let ticketIdToDelete = null; // Store ID for deletion

function setupRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = function() {
            fetchTickets(true);
        };
    }
}

// Helper to toggle Sync Modal
function showSyncModal() {
    const syncModal = document.getElementById('syncModal');
    if (syncModal) syncModal.style.display = 'flex';
}

function hideSyncModal() {
    const syncModal = document.getElementById('syncModal');
    if (syncModal) {
        setTimeout(() => {
            syncModal.style.display = 'none';
        }, 1000);
    }
}

function fetchTickets(manual = false) {
    if (!manual && window.TICKETING_CACHE && typeof window.TICKETING_CACHE.getTickets === 'function') {
        const cachedTickets = window.TICKETING_CACHE.getTickets();
        if (cachedTickets) {
            allTickets = cachedTickets;
            renderTable(allTickets);
            return;
        }
    }

    const tableBody = document.getElementById('ticketsTableBody');
    const refreshBtn = document.getElementById('refreshBtn');
    let icon = null;

    if (refreshBtn) {
        icon = refreshBtn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        refreshBtn.disabled = true;
    }

    // Show modal only for manual refresh
    if (manual) {
        showSyncModal();
    }

    // Only show full loading row if table is empty (first load)
    if (tableBody.children.length === 0 || (tableBody.children.length === 1 && tableBody.children[0].innerText.includes('Loading'))) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Loading tickets...</td></tr>';
    }

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getTickets' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            allTickets = data.data;
            if (window.TICKETING_CACHE && typeof window.TICKETING_CACHE.setTickets === 'function') {
                window.TICKETING_CACHE.setTickets(allTickets);
            }
            renderTable(allTickets);
            if (manual) showNotification('Data synced successfully.', 'success');
        } else {
            console.error('Error fetching tickets:', data.message);
            if (manual) showNotification('Error fetching data.', 'error');
            if (tableBody.innerHTML.includes('Loading')) {
                 tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading tickets.</td></tr>';
            }
        }
    })
    .catch(error => {
        console.error('Network Error:', error);
        if (manual) showNotification('Network error during sync.', 'error');
        if (tableBody.innerHTML.includes('Loading')) {
             tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Network Error.</td></tr>';
        }
    })
    .finally(() => {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            if (icon) icon.classList.remove('fa-spin');
        }
        hideSyncModal();
    });
}

function renderTable(tickets) {
    const tableBody = document.getElementById('ticketsTableBody');
    tableBody.innerHTML = '';

    if (tickets.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No tickets found.</td></tr>';
        return;
    }

    tickets.forEach(ticket => {
        const row = document.createElement('tr');
        
        // Format Date
        let dateStr = ticket.date;
        try {
            const dateObj = new Date(ticket.date);
            if (!isNaN(dateObj)) dateStr = dateObj.toLocaleDateString();
        } catch(e) {}

        row.innerHTML = `
            <td><strong>${ticket.id}</strong></td>
            <td>${ticket.subject}</td>
            <td>${ticket.requesterName}</td>
            <td><span class="status-badge status-${ticket.status.toLowerCase().replace(' ', '-')}">${ticket.status}</span></td>
            <td>${ticket.priority}</td>
            <td>${dateStr}</td>
            <td>
                <button class="action-btn btn-edit" onclick="openEditModal('${ticket.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn btn-delete" onclick="openDeleteModal('${ticket.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// --- Edit Modal Logic ---
function setupEditModal() {
    const form = document.getElementById('editForm');
    if (form) {
        form.onsubmit = function(e) {
            e.preventDefault();
            saveTicket();
        };
    }

    // Fix: Attach event listeners for Cancel and Close buttons
    const cancelBtn = document.getElementById('cancelEdit');
    if (cancelBtn) {
        cancelBtn.onclick = closeEditModal;
    }

    const modal = document.getElementById('editModal');
    if (modal) {
        const closeSpan = modal.querySelector('.close');
        if (closeSpan) {
            closeSpan.onclick = closeEditModal;
        }
    }
}

function openEditModal(id) {
    const ticket = allTickets.find(t => t.id === id);
    if (!ticket) return;

    // Populate fields
    document.getElementById('editId').value = ticket.id;
    document.getElementById('editSubject').value = ticket.subject || '';
    document.getElementById('editDescription').value = ticket.description || '';
    document.getElementById('editRequester').value = ticket.requesterName || '';
    document.getElementById('editAssignedTo').value = ticket.assignedTo || '';
    document.getElementById('editDepartment').value = ticket.department || 'IT';
    document.getElementById('editStatus').value = ticket.status || 'Pending';
    document.getElementById('editPriority').value = ticket.priority || 'Low';
    document.getElementById('editCategory').value = ticket.category || 'Other';
    document.getElementById('editTicketType').value = ticket.ticketType || 'Incident';

    // Show modal
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() { // Called by HTML onclick
    document.getElementById('editModal').style.display = 'none';
}

function saveTicket() {
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    showSyncModal(); // Show sync modal

    const formData = {
        action: 'updateTicket',
        id: document.getElementById('editId').value,
        subject: document.getElementById('editSubject').value,
        description: document.getElementById('editDescription').value,
        requesterName: document.getElementById('editRequester').value,
        assignedTo: document.getElementById('editAssignedTo').value,
        department: document.getElementById('editDepartment').value,
        status: document.getElementById('editStatus').value,
        priority: document.getElementById('editPriority').value,
        category: document.getElementById('editCategory').value,
        ticketType: document.getElementById('editTicketType').value
    };

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Ticket updated successfully!', 'success');
            closeEditModal();
            if (window.TICKETING_CACHE && typeof window.TICKETING_CACHE.clearTickets === 'function') {
                window.TICKETING_CACHE.clearTickets();
            }
            fetchTickets(true);
        } else {
            showNotification('Error updating ticket: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Failed to save changes.', 'error');
    })
    .finally(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        hideSyncModal(); // Hide sync modal
    });
}

// --- Create Modal Logic ---
function setupCreateModal() {
    const form = document.getElementById('createForm');
    if (form) {
        form.onsubmit = function(e) {
            e.preventDefault();
            createTicket();
        };
    }
}

function openCreateModal() {
    document.getElementById('createForm').reset();
    const dept = document.getElementById('createDepartment');
    const prio = document.getElementById('createPriority');
    const cat = document.getElementById('createCategory');
    const type = document.getElementById('createTicketType');
    if (dept) dept.value = '';
    if (prio) prio.value = '';
    if (cat) cat.value = '';
    if (type) type.value = '';
    document.getElementById('createModal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
}

function createTicket() {
    const formEl = document.getElementById('createForm');
    if (formEl) {
        if (typeof formEl.reportValidity === 'function') {
            if (!formEl.reportValidity()) return;
        } else if (typeof formEl.checkValidity === 'function') {
            if (!formEl.checkValidity()) return;
        }
    }

    const saveBtn = document.getElementById('createSaveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Creating...';
    saveBtn.disabled = true;
    showSyncModal(); // Show sync modal

    const formData = {
        action: 'createTicket',
        subject: document.getElementById('createSubject').value,
        description: document.getElementById('createDescription').value,
        requesterName: document.getElementById('createRequester').value,
        department: document.getElementById('createDepartment').value,
        priority: document.getElementById('createPriority').value,
        category: document.getElementById('createCategory').value,
        ticketType: document.getElementById('createTicketType').value
    };

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Ticket created successfully!', 'success');
            closeCreateModal();
            if (window.TICKETING_CACHE && typeof window.TICKETING_CACHE.clearTickets === 'function') {
                window.TICKETING_CACHE.clearTickets();
            }
            fetchTickets(true);
        } else {
            showNotification('Error creating ticket: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Failed to create ticket.', 'error');
    })
    .finally(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        hideSyncModal(); // Hide sync modal
    });
}

// --- Delete Modal Logic ---
function openDeleteModal(id) {
    ticketIdToDelete = id;
    const modal = document.getElementById('deleteModal');
    
    // Setup confirm button
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.onclick = confirmDelete;
    
    modal.style.display = 'flex';
}

function closeDeleteModal() {
    ticketIdToDelete = null;
    document.getElementById('deleteModal').style.display = 'none';
}

function confirmDelete() {
    if (!ticketIdToDelete) return;
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = 'Deleting...';
    confirmBtn.disabled = true;
    showSyncModal(); // Show sync modal

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'deleteTicket',
            id: ticketIdToDelete
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Ticket deleted successfully.', 'success');
            closeDeleteModal();
            if (window.TICKETING_CACHE && typeof window.TICKETING_CACHE.clearTickets === 'function') {
                window.TICKETING_CACHE.clearTickets();
            }
            fetchTickets(true);
        } else {
            showNotification('Error deleting ticket: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Failed to delete ticket.', 'error');
    })
    .finally(() => {
        confirmBtn.textContent = originalText;
        confirmBtn.disabled = false;
        hideSyncModal(); // Hide sync modal
    });
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        if (event.target.id === 'syncModal') return; // Prevent closing sync modal
        event.target.style.display = 'none';
    }
}

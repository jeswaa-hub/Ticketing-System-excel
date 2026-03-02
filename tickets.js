// Tickets Management Logic

const SCRIPT_URL = window.APP_CONFIG && window.APP_CONFIG.SCRIPT_URL ? window.APP_CONFIG.SCRIPT_URL : 'https://script.google.com/macros/s/AKfycbyMTRZJHjIsjJOlRQYM_cek9cGvDLBe8v018aBXwl2UoptVRVs6pbwwvvdBx_isCTv9/exec';

const subjectToCategoryMap = {
    'Hardware Repair/Issue': 'Hardware',
    'Software Installation/Issue': 'Software',
    'Network/Wi-Fi Connectivity': 'Network',
    'Account/Password Access': 'Access/Login',
    'Email Configuration/Issue': 'Access/Login',
    'Printer/Peripheral Issue': 'Hardware',
    'System Access Request': 'Access/Login',
    'General Inquiry/Others': 'Others'
};

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
    setupFilters();

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            sessionStorage.removeItem('adminAuthenticated');
            window.location.href = 'index.html';
        });
    }
});

let allTickets = []; // Store fetched tickets
let filteredTickets = []; // Store filtered results
let ticketIdToDelete = null; // Store ID for deletion

// --- Filtering Logic ---
function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');

    const handleFilter = () => {
        applyFilters();
    };

    if (searchInput) searchInput.addEventListener('input', handleFilter);
    if (statusFilter) statusFilter.addEventListener('change', handleFilter);
    if (priorityFilter) priorityFilter.addEventListener('change', handleFilter);
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const statusTerm = document.getElementById('statusFilter')?.value || '';
    const priorityTerm = document.getElementById('priorityFilter')?.value || '';

    filteredTickets = allTickets.filter(ticket => {
        const matchesSearch = !searchTerm || 
            ticket.id.toLowerCase().includes(searchTerm) ||
            ticket.subject.toLowerCase().includes(searchTerm) ||
            ticket.requesterName.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !statusTerm || ticket.status === statusTerm;
        const matchesPriority = !priorityTerm || ticket.priority === priorityTerm;

        return matchesSearch && matchesStatus && matchesPriority;
    });

    renderTable(filteredTickets);
}

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
            applyFilters();
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
            applyFilters(); // Apply filters to new data
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
    const noResults = document.getElementById('noResultsRow');
    tableBody.innerHTML = '';

    if (tickets.length === 0) {
        if (noResults) {
            noResults.classList.remove('hidden');
        } else {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No tickets found.</td></tr>';
        }
        return;
    }

    if (noResults) noResults.classList.add('hidden');

    tickets.forEach(ticket => {
        const row = document.createElement('tr');
        
        // Format Date
        let dateStr = ticket.date;
        try {
            const dateObj = new Date(ticket.date);
            if (!isNaN(dateObj)) dateStr = dateObj.toLocaleDateString();
        } catch(e) {}

        row.innerHTML = `
            <td class="py-5 px-4 font-semibold text-gray-700 dark:text-gray-200">${ticket.id}</td>
            <td class="py-5 px-4">${ticket.subject}</td>
            <td class="py-5 px-4">${ticket.requesterName}</td>
            <td class="py-5 px-4 text-center"><span class="status-badge status-${ticket.status.toLowerCase().replace(' ', '-')}">${ticket.status}</span></td>
            <td class="py-5 px-4 text-center font-medium">${ticket.priority}</td>
            <td class="py-5 px-4 text-center">${dateStr}</td>
            <td class="py-5 px-4 text-center whitespace-nowrap">
                <button class="action-btn btn-edit mx-1" onclick="openEditModal('${ticket.id}')" title="Edit">
                    <i class="fas fa-edit text-lg"></i>
                </button>
                <button class="action-btn btn-delete mx-1" onclick="openDeleteModal('${ticket.id}')" title="Delete">
                    <i class="fas fa-trash text-lg"></i>
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

        // --- Auto-Category Logic for Edit Modal ---
        const subjectSelect = document.getElementById('editSubject');
        const categorySelect = document.getElementById('editCategory');
        
        if (subjectSelect && categorySelect) {
            subjectSelect.addEventListener('change', function() {
                const selectedSubject = subjectSelect.value;
                
                // Show/Hide Other Subject input
                const subjectOther = document.getElementById('editSubjectOther');
                if (subjectOther) {
                    if (selectedSubject === 'General Inquiry/Others') {
                        subjectOther.classList.remove('hidden');
                        subjectOther.required = true;
                    } else {
                        subjectOther.classList.add('hidden');
                        subjectOther.required = false;
                        subjectOther.value = '';
                    }
                }

                const mappedCategory = subjectToCategoryMap[selectedSubject];
                if (mappedCategory) {
                    categorySelect.value = (mappedCategory === 'Others' ? 'Other' : mappedCategory);
                    categorySelect.dispatchEvent(new Event('change'));
                }
            });
        }

        // Show/Hide Other Category input
        if (categorySelect) {
            categorySelect.addEventListener('change', function() {
                const categoryOther = document.getElementById('editCategoryOther');
                if (categoryOther) {
                    if (categorySelect.value === 'Other') {
                        categoryOther.classList.remove('hidden');
                        categoryOther.required = true;
                    } else {
                        categoryOther.classList.add('hidden');
                        categoryOther.required = false;
                        categoryOther.value = '';
                    }
                }
            });
        }

        // Show/Hide Other Ticket Type input
        const typeSelect = document.getElementById('editTicketType');
        if (typeSelect) {
            typeSelect.addEventListener('change', function() {
                const typeOther = document.getElementById('editTicketTypeOther');
                if (typeOther) {
                    if (typeSelect.value === 'Other') {
                        typeOther.classList.remove('hidden');
                        typeOther.required = true;
                    } else {
                        typeOther.classList.add('hidden');
                        typeOther.required = false;
                        typeOther.value = '';
                    }
                }
            });
        }
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
    
    // Helper to set select and handle 'Other'
    const setSelectValue = (selectId, otherId, value, options) => {
        const select = document.getElementById(selectId);
        const other = document.getElementById(otherId);
        if (!select) return;

        if (options.includes(value)) {
            select.value = value;
            if (other) {
                other.classList.add('hidden');
                other.value = '';
            }
        } else if (value) {
            // If value is not in options, set to 'Others' and show text input
            const otherValue = selectId.includes('Subject') ? 'General Inquiry/Others' : 'Other';
            select.value = otherValue;
            if (other) {
                other.classList.remove('hidden');
                other.value = value;
            }
        }
    };

    const subjectOptions = Array.from(document.getElementById('editSubject').options).map(o => o.value);
    const categoryOptions = Array.from(document.getElementById('editCategory').options).map(o => o.value);

    setSelectValue('editSubject', 'editSubjectOther', ticket.subject, subjectOptions);
    setSelectValue('editCategory', 'editCategoryOther', ticket.category, categoryOptions);
    
    const typeOptions = Array.from(document.getElementById('editTicketType').options).map(o => o.value);
    setSelectValue('editTicketType', 'editTicketTypeOther', ticket.ticketType, typeOptions);

    document.getElementById('editDescription').value = ticket.description || '';
    document.getElementById('editRequester').value = ticket.requesterName || '';
    document.getElementById('editAssignedTo').value = ticket.assignedTo || '';
    document.getElementById('editDepartment').value = ticket.department || 'IT';
    document.getElementById('editStatus').value = ticket.status || 'Pending';
    document.getElementById('editPriority').value = ticket.priority || 'Low';
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

    // Helper function to get value (dropdown or text input if 'Others' is selected)
    const getValue = (selectId, otherId) => {
        const select = document.getElementById(selectId);
        const other = document.getElementById(otherId);
        if (select && (select.value === 'Other' || select.value === 'General Inquiry/Others') && other && other.value.trim()) {
            return other.value.trim();
        }
        return select ? select.value : '';
    };

    const formData = {
        action: 'updateTicket',
        id: document.getElementById('editId').value,
        subject: getValue('editSubject', 'editSubjectOther'),
        description: document.getElementById('editDescription').value,
        requesterName: document.getElementById('editRequester').value,
        assignedTo: document.getElementById('editAssignedTo').value,
        department: document.getElementById('editDepartment').value,
        status: document.getElementById('editStatus').value,
        priority: document.getElementById('editPriority').value,
        category: getValue('editCategory', 'editCategoryOther'),
        ticketType: getValue('editTicketType', 'editTicketTypeOther')
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

        // --- Auto-Category Logic for Create Modal ---
        const subjectSelect = document.getElementById('createSubject');
        const categorySelect = document.getElementById('createCategory');
        
        if (subjectSelect && categorySelect) {
            subjectSelect.addEventListener('change', function() {
                const selectedSubject = subjectSelect.value;
                
                // Show/Hide Other Subject input
                const subjectOther = document.getElementById('createSubjectOther');
                if (subjectOther) {
                    if (selectedSubject === 'General Inquiry/Others') {
                        subjectOther.classList.remove('hidden');
                        subjectOther.required = true;
                    } else {
                        subjectOther.classList.add('hidden');
                        subjectOther.required = false;
                        subjectOther.value = '';
                    }
                }

                const mappedCategory = subjectToCategoryMap[selectedSubject];
                if (mappedCategory) {
                    categorySelect.value = (mappedCategory === 'Others' ? 'Other' : mappedCategory);
                    categorySelect.dispatchEvent(new Event('change'));
                }
            });
        }

        // Show/Hide Other Category input
        if (categorySelect) {
            categorySelect.addEventListener('change', function() {
                const categoryOther = document.getElementById('createCategoryOther');
                if (categoryOther) {
                    if (categorySelect.value === 'Other') {
                        categoryOther.classList.remove('hidden');
                        categoryOther.required = true;
                    } else {
                        categoryOther.classList.add('hidden');
                        categoryOther.required = false;
                        categoryOther.value = '';
                    }
                }
            });
        }

        // Show/Hide Other Ticket Type input
        const typeSelect = document.getElementById('createTicketType');
        if (typeSelect) {
            typeSelect.addEventListener('change', function() {
                const typeOther = document.getElementById('createTicketTypeOther');
                if (typeOther) {
                    if (typeSelect.value === 'Other') {
                        typeOther.classList.remove('hidden');
                        typeOther.required = true;
                    } else {
                        typeOther.classList.add('hidden');
                        typeOther.required = false;
                        typeOther.value = '';
                    }
                }
            });
        }
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

    // Hide Other inputs
    const subjectOther = document.getElementById('createSubjectOther');
    const categoryOther = document.getElementById('createCategoryOther');
    const typeOther = document.getElementById('createTicketTypeOther');
    if (subjectOther) subjectOther.classList.add('hidden');
    if (categoryOther) categoryOther.classList.add('hidden');
    if (typeOther) typeOther.classList.add('hidden');

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

    // Helper function to get value (dropdown or text input if 'Others' is selected)
    const getValue = (selectId, otherId) => {
        const select = document.getElementById(selectId);
        const other = document.getElementById(otherId);
        if (select && (select.value === 'Other' || select.value === 'General Inquiry/Others') && other && other.value.trim()) {
            return other.value.trim();
        }
        return select ? select.value : '';
    };

    const formData = {
        action: 'createTicket',
        subject: getValue('createSubject', 'createSubjectOther'),
        description: document.getElementById('createDescription').value,
        requesterName: document.getElementById('createRequester').value,
        department: document.getElementById('createDepartment').value,
        priority: document.getElementById('createPriority').value,
        category: getValue('createCategory', 'createCategoryOther'),
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

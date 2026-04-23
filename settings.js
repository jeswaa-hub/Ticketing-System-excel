// Settings Page Logic

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
        btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun block dark:hidden w-6 h-6 text-xl"></i><i class="fas fa-sun hidden dark:block w-6 h-6 text-xl"></i>' : '<i class="fas fa-moon block dark:hidden w-6 h-6 text-xl"></i><i class="fas fa-moon hidden dark:block w-6 h-6 text-xl"></i>';
    };

    syncIcon();
    btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
        syncIcon();
    });
}

// Default Data
const DEFAULT_CATEGORIES = ['Hardware', 'Software', 'Network', 'Access/Login', 'Others'];
const DEFAULT_TICKET_TYPES = ['Incident', 'Request', 'Inquiry', 'Others'];

// Keys for LocalStorage
const CATEGORIES_KEY = 'ticketing_categories';
const TICKET_TYPES_KEY = 'ticketing_ticket_types';

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

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            sessionStorage.removeItem('adminAuthenticated');
            window.location.href = 'index.html';
        });
    }

    // Initialize settings from localStorage or defaults
    initializeSettings();
    renderLists();

    // Modal Logic
    const itemModal = document.getElementById('itemModal');
    const closeBtns = document.querySelectorAll('.close-modal');
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            itemModal.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === itemModal) {
            itemModal.style.display = 'none';
        }
    });

    // Add buttons
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
        openModal('category', 'Add Category', -1);
    });

    document.getElementById('addTicketTypeBtn').addEventListener('click', () => {
        openModal('ticketType', 'Add Ticket Type', -1);
    });

    // Form submit
    document.getElementById('itemForm').addEventListener('submit', handleFormSubmit);
});

function initializeSettings() {
    if (!localStorage.getItem(CATEGORIES_KEY)) {
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!localStorage.getItem(TICKET_TYPES_KEY)) {
        localStorage.setItem(TICKET_TYPES_KEY, JSON.stringify(DEFAULT_TICKET_TYPES));
    }
}

function getItems(type) {
    const key = type === 'category' ? CATEGORIES_KEY : TICKET_TYPES_KEY;
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch(e) {
        return type === 'category' ? DEFAULT_CATEGORIES : DEFAULT_TICKET_TYPES;
    }
}

function saveItems(type, items) {
    const key = type === 'category' ? CATEGORIES_KEY : TICKET_TYPES_KEY;
    localStorage.setItem(key, JSON.stringify(items));
}

function renderLists() {
    renderList('category', 'categoriesList');
    renderList('ticketType', 'ticketTypesList');
}

function renderList(type, listId) {
    const listEl = document.getElementById(listId);
    const items = getItems(type);
    
    listEl.innerHTML = '';
    
    items.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700';
        
        // Ensure "Others" cannot be deleted/edited easily if it's required for logic, but we can allow edit.
        const isOthers = item.toLowerCase() === 'others';
        
        li.innerHTML = `
            <span class="font-medium text-gray-800 dark:text-gray-200">${item}</span>
            <div class="flex gap-2">
                <button onclick="editItem('${type}', ${index})" class="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                ${!isOthers ? `
                <button onclick="deleteItem('${type}', ${index})" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
                ` : ''}
            </div>
        `;
        listEl.appendChild(li);
    });
}

function openModal(type, title, index) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('itemType').value = type;
    document.getElementById('itemOriginalIndex').value = index;
    
    const input = document.getElementById('itemName');
    
    if (index >= 0) {
        const items = getItems(type);
        input.value = items[index];
    } else {
        input.value = '';
    }
    
    document.getElementById('itemModal').style.display = 'flex';
    setTimeout(() => input.focus(), 100);
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('itemType').value;
    const index = parseInt(document.getElementById('itemOriginalIndex').value);
    const newValue = document.getElementById('itemName').value.trim();
    
    if (!newValue) {
        showNotification('Name cannot be empty', 'error');
        return;
    }

    const items = getItems(type);
    
    // Check for duplicates
    const isDuplicate = items.some((item, i) => item.toLowerCase() === newValue.toLowerCase() && i !== index);
    if (isDuplicate) {
        showNotification('This item already exists', 'error');
        return;
    }

    if (index >= 0) {
        items[index] = newValue;
        showNotification('Updated successfully', 'success');
    } else {
        // If "Others" exists, insert before it
        const othersIndex = items.findIndex(i => i.toLowerCase() === 'others');
        if (othersIndex !== -1) {
            items.splice(othersIndex, 0, newValue);
        } else {
            items.push(newValue);
        }
        showNotification('Added successfully', 'success');
    }
    
    saveItems(type, items);
    renderLists();
    document.getElementById('itemModal').style.display = 'none';
}

window.editItem = function(type, index) {
    const typeName = type === 'category' ? 'Category' : 'Ticket Type';
    openModal(type, `Edit ${typeName}`, index);
};

window.deleteItem = function(type, index) {
    if (confirm('Are you sure you want to delete this item?')) {
        const items = getItems(type);
        items.splice(index, 1);
        saveItems(type, items);
        renderLists();
        showNotification('Deleted successfully', 'success');
    }
};

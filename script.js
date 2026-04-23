window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMTRZJHjIsjJOlRQYM_cek9cGvDLBe8v018aBXwl2UoptVRVs6pbwwvvdBx_isCTv9/exec';
window.APP_CONFIG.ADMIN_TOKEN = '1BEdnvsuY5_FXVGpxyfU6r15RnQeio6hTtjj5DG0Vz8KGh0qQfBeQP8HY';

window.TICKETING_CACHE = window.TICKETING_CACHE || (function() {
  const DATA_KEY = 'ticketing:tickets:data:v1';
  const TS_KEY = 'ticketing:tickets:ts:v1';

  const safeParse = (raw) => {
    try { return JSON.parse(raw); } catch (e) { return null; }
  };

  const getTickets = () => {
    try {
      const raw = sessionStorage.getItem(DATA_KEY);
      if (!raw) return null;
      const parsed = safeParse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  };

  const setTickets = (tickets) => {
    if (!Array.isArray(tickets)) return;
    try {
      sessionStorage.setItem(DATA_KEY, JSON.stringify(tickets));
      sessionStorage.setItem(TS_KEY, String(Date.now()));
    } catch (e) {}
  };

  const clearTickets = () => {
    try {
      sessionStorage.removeItem(DATA_KEY);
      sessionStorage.removeItem(TS_KEY);
    } catch (e) {}
  };

  const getLastSync = () => {
    try {
      const raw = sessionStorage.getItem(TS_KEY);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  };

  return { getTickets, setTickets, clearTickets, getLastSync };
})();

document.addEventListener('DOMContentLoaded', function() {
  // Get the form element
  var form = document.getElementById('ticketForm');
  
  var SCRIPT_URL = window.APP_CONFIG && window.APP_CONFIG.SCRIPT_URL ? window.APP_CONFIG.SCRIPT_URL : '';
  
  if (form) {
    // --- Dynamic Settings Load ---
    const CATEGORIES_KEY = 'ticketing_categories';
    const TICKET_TYPES_KEY = 'ticketing_ticket_types';
    const DEFAULT_CATEGORIES = ['Hardware', 'Software', 'Network', 'Access/Login', 'Others'];
    const DEFAULT_TICKET_TYPES = ['Incident', 'Request', 'Inquiry', 'Others'];

    const categorySelect = document.getElementById('category');
    const ticketTypeSelect = document.getElementById('ticketType');

    if (categorySelect) {
      let categories = [];
      try {
        categories = JSON.parse(localStorage.getItem(CATEGORIES_KEY)) || DEFAULT_CATEGORIES;
      } catch(e) {
        categories = DEFAULT_CATEGORIES;
      }
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
      });
    }

    if (ticketTypeSelect) {
      let ticketTypes = [];
      try {
        ticketTypes = JSON.parse(localStorage.getItem(TICKET_TYPES_KEY)) || DEFAULT_TICKET_TYPES;
      } catch(e) {
        ticketTypes = DEFAULT_TICKET_TYPES;
      }
      ticketTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        ticketTypeSelect.appendChild(option);
      });
    }

    // --- Auto-Category Logic ---
    const subjectSelect = document.getElementById('subject');

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

    if (subjectSelect && categorySelect) {
      subjectSelect.addEventListener('change', function() {
        const selectedSubject = subjectSelect.value;
        
        // Show/Hide Other Subject input
        const subjectOther = document.getElementById('subjectOther');
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
          categorySelect.value = mappedCategory;
          // Trigger change event for category to show/hide its "Other" field
          categorySelect.dispatchEvent(new Event('change'));
        }
      });
    }

    // Show/Hide Other Category input
    if (categorySelect) {
      categorySelect.addEventListener('change', function() {
        const categoryOther = document.getElementById('categoryOther');
        if (categoryOther) {
          if (categorySelect.value === 'Others') {
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

    // Show/Hide Other Department input
    const departmentSelect = document.getElementById('department');
    if (departmentSelect) {
      departmentSelect.addEventListener('change', function() {
        const departmentOther = document.getElementById('departmentOther');
        if (departmentOther) {
          if (departmentSelect.value === 'Others') {
            departmentOther.classList.remove('hidden');
            departmentOther.required = true;
          } else {
            departmentOther.classList.add('hidden');
            departmentOther.required = false;
            departmentOther.value = '';
          }
        }
      });
    }

    // Show/Hide Other Ticket Type input
    if (ticketTypeSelect) {
      ticketTypeSelect.addEventListener('change', function() {
        const ticketTypeOther = document.getElementById('ticketTypeOther');
        if (ticketTypeOther) {
          if (ticketTypeSelect.value === 'Others') {
            ticketTypeOther.classList.remove('hidden');
            ticketTypeOther.required = true;
          } else {
            ticketTypeOther.classList.add('hidden');
            ticketTypeOther.required = false;
            ticketTypeOther.value = '';
          }
        }
      });
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Helper function to get value (dropdown or text input if 'Others' is selected)
      const getValue = (selectId, otherId) => {
        const select = document.getElementById(selectId);
        const other = document.getElementById(otherId);
        if (select && (select.value === 'Others' || select.value === 'General Inquiry/Others') && other && other.value.trim()) {
          return other.value.trim();
        }
        return select ? select.value : '';
      };

      // Collect form data
      var formData = {
        requesterName: document.getElementById('requesterName').value,
        email: document.getElementById('email').value,
        department: getValue('department', 'departmentOther'),
        subject: getValue('subject', 'subjectOther'),
        category: getValue('category', 'categoryOther'),
        priority: document.getElementById('priority').value,
        ticketType: getValue('ticketType', 'ticketTypeOther'),
        description: document.getElementById('description').value
      };
      
      // Show loading state
      var submitBtn = document.getElementById('submitBtn');
      var originalText = submitBtn.textContent;
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;
      
      // Use fetch to send data to Google Apps Script
      fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(formData)
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(response) {
        // Handle success
        console.log('Success:', response);
        if (response.status === 'success') {
          showNotification(response.message, 'success');
          form.reset();
        } else {
          showNotification('Error: ' + response.message, 'error');
        }
      })
      .catch(function(error) {
        // Handle error
        console.error('Error:', error);
        showNotification('An error occurred: ' + error.message, 'error');
      })
      .finally(function() {
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      });
    });
  }

  // --- Admin Access Logic ---
  const secretCode = 'admin';
  const adminToken = window.APP_CONFIG && window.APP_CONFIG.ADMIN_TOKEN ? window.APP_CONFIG.ADMIN_TOKEN : '';
  let inputBuffer = '';
  
  const modal = document.getElementById('adminModal');
  const closeBtn = document.querySelector('.close');
  const loginBtn = document.getElementById('adminLoginBtn');
  const keyInput = document.getElementById('adminKey');

  // Listen for secret code
  if (modal && keyInput) {
    document.addEventListener('keydown', function(e) {
      if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
        inputBuffer += e.key.toLowerCase();
        
        if (inputBuffer.length > secretCode.length) {
          inputBuffer = inputBuffer.slice(-secretCode.length);
        }
        
        if (inputBuffer === secretCode) {
          modal.style.display = 'flex';
          inputBuffer = '';
          keyInput.focus();
        }
      }
    });
  }

  // Close modal
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      modal.style.display = 'none';
    });
  }

  if (modal) {
    window.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  // Handle Login
  if (loginBtn) {
    loginBtn.addEventListener('click', function() {
      const enteredKey = keyInput.value.trim();
      if (enteredKey === adminToken) {
        sessionStorage.setItem('adminAuthenticated', 'true');
        window.location.href = 'admin.html';
      } else {
        showNotification('Invalid Access Token', 'error');
        keyInput.value = '';
      }
    });
  }
});

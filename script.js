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
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Collect form data
      var formData = {
        requesterName: document.getElementById('requesterName').value,
        email: document.getElementById('email').value,
        department: document.getElementById('department').value,
        subject: document.getElementById('subject').value,
        category: document.getElementById('category').value,
        priority: document.getElementById('priority').value,
        ticketType: document.getElementById('ticketType').value,
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

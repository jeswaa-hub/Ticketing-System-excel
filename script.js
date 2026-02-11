document.addEventListener('DOMContentLoaded', function() {
  // Get the form element
  var form = document.getElementById('ticketForm');
  
  // REPLACE THIS WITH YOUR DEPLOYED WEB APP URL
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMTRZJHjIsjJOlRQYM_cek9cGvDLBe8v018aBXwl2UoptVRVs6pbwwvvdBx_isCTv9/exec';
  
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
  const adminToken = '1BEdnvsuY5_FXVGpxyfU6r15RnQeio6hTtjj5DG0Vz8KGh0qQfBeQP8HY';
  let inputBuffer = '';
  
  const modal = document.getElementById('adminModal');
  const closeBtn = document.querySelector('.close');
  const loginBtn = document.getElementById('adminLoginBtn');
  const keyInput = document.getElementById('adminKey');

  // Listen for secret code
  document.addEventListener('keydown', function(e) {
    // Only track letters
    if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
      inputBuffer += e.key.toLowerCase();
      
      // Keep buffer same length as secret code
      if (inputBuffer.length > secretCode.length) {
        inputBuffer = inputBuffer.slice(-secretCode.length);
      }
      
      // Check for match
      if (inputBuffer === secretCode) {
        modal.style.display = 'flex';
        inputBuffer = ''; // Reset
        keyInput.focus();
      }
    }
  });

  // Close modal
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      modal.style.display = 'none';
    });
  }

  window.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

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

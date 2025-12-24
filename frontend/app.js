// Discord Bot Dashboard - Frontend Application
// Implements secure login, XSS protection, and real-time updates

// DOM Elements
const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const tokenInput = document.getElementById('tokenInput');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');
const logoutBtn = document.getElementById('logoutBtn');
const botName = document.getElementById('botName');
const botAvatar = document.getElementById('botAvatar');
const totalMessages = document.getElementById('totalMessages');
const uniqueUsers = document.getElementById('uniqueUsers');
const messagesList = document.getElementById('messagesList');

// State management
let updateInterval = null;

// XSS Protection: Escape HTML to prevent script injection
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Display error message
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
  setTimeout(() => {
    errorMsg.style.display = 'none';
  }, 5000);
}

// Show loading state
function setLoading(isLoading) {
  const btnText = loginBtn.querySelector('.btn-text');
  const btnLoader = loginBtn.querySelector('.btn-loader');
  
  if (isLoading) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    loginBtn.disabled = true;
    tokenInput.disabled = true;
  } else {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    loginBtn.disabled = false;
    tokenInput.disabled = false;
  }
}

// Login function
async function handleLogin() {
  const token = tokenInput.value.trim();
  
  // Validate token input
  if (!token) {
    showError('يرجى إدخال توكن البوت');
    return;
  }
  
  setLoading(true);
  errorMsg.style.display = 'none';
  
  try {
    // Send login request to API
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Clear token input for security
      tokenInput.value = '';
      
      // Update bot information
      botName.textContent = escapeHtml(data.bot.name);
      botAvatar.src = data.bot.avatar;
      botAvatar.alt = escapeHtml(data.bot.name);
      
      // Switch to dashboard view
      loginPage.style.display = 'none';
      dashboardPage.style.display = 'block';
      
      // Start real-time updates
      startAutoUpdate();
      
      // Load initial data
      await updateDashboard();
    } else {
      showError(data.message || 'فشل تسجيل الدخول');
    }
  } catch (error) {
    showError('حدث خطأ في الاتصال بالخادم');
    console.error('Login error:', error);
  } finally {
    setLoading(false);
  }
}

// Logout function
async function handleLogout() {
  try {
    // Stop auto-updates
    stopAutoUpdate();
    
    // Send logout request
    await fetch('/api/logout');
    
    // Reset UI
    loginPage.style.display = 'flex';
    dashboardPage.style.display = 'none';
    tokenInput.value = '';
    messagesList.innerHTML = '<div class="empty-state">لا توجد رسائل بعد</div>';
    
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Update dashboard data
async function updateDashboard() {
  try {
    // Fetch stats and messages in parallel
    const [statsResponse, messagesResponse] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/messages')
    ]);
    
    const stats = await statsResponse.json();
    const messages = await messagesResponse.json();
    
    // Update stats with XSS protection
    totalMessages.textContent = escapeHtml(stats.totalMessages.toString());
    uniqueUsers.textContent = escapeHtml(stats.uniqueUsers.toString());
    
    // Update messages list
    if (messages.length === 0) {
      messagesList.innerHTML = '<div class="empty-state">لا توجد رسائل بعد</div>';
    } else {
      // Render messages with XSS protection
      messagesList.innerHTML = messages.map(msg => `
        <div class="message-card" data-message-id="${escapeHtml(msg.id)}">
          <div class="message-header">
            <img src="${escapeHtml(msg.authorAvatar)}" alt="${escapeHtml(msg.author)}" class="message-avatar">
            <div class="message-info">
              <span class="message-author">${escapeHtml(msg.author)}</span>
              <span class="message-time">${escapeHtml(new Date(msg.timestamp).toLocaleString('ar-EG'))}</span>
            </div>
          </div>
          <div class="message-content">${escapeHtml(msg.content)}</div>
        </div>
      `).reverse().join('');
    }
  } catch (error) {
    console.error('Update error:', error);
  }
}

// Start auto-update interval
function startAutoUpdate() {
  // Update every 3 seconds
  updateInterval = setInterval(updateDashboard, 3000);
}

// Stop auto-update interval
function stopAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

// Event listeners
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);

// Allow Enter key to submit login
tokenInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleLogin();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAutoUpdate();
});

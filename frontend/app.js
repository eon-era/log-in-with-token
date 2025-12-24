// Discord Bot Dashboard - Frontend JavaScript

const API_URL = window.location.origin;

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

// State
let isLoggedIn = false;
let updateInterval = null;

// Utility Functions
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
  setTimeout(() => {
    errorMsg.style.display = 'none';
  }, 5000);
}

function setLoading(loading) {
  const btnText = loginBtn.querySelector('.btn-text');
  const btnLoader = loginBtn.querySelector('.btn-loader');
  
  if (loading) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    loginBtn.disabled = true;
  } else {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    loginBtn.disabled = false;
  }
}

function showDashboard(botData) {
  loginPage.style.display = 'none';
  dashboardPage.style.display = 'block';
  
  botName.textContent = botData.name;
  botAvatar.src = botData.avatar;
  botAvatar.alt = botData.name;
  
  isLoggedIn = true;
  
  // Start auto-update
  updateDashboard();
  updateInterval = setInterval(updateDashboard, 3000);
}

function showLogin() {
  loginPage.style.display = 'flex';
  dashboardPage.style.display = 'none';
  tokenInput.value = '';
  errorMsg.textContent = '';
  isLoggedIn = false;
  
  // Stop auto-update
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

// API Functions
async function login(token) {
  try {
    setLoading(true);
    errorMsg.style.display = 'none';
    
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      showDashboard(data.bot);
    } else {
      showError(data.message || 'حدث خطأ أثناء تسجيل الدخول');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('فشل الاتصال بالخادم. يرجى التحقق من تشغيل الخادم والمحاولة مرة أخرى');
  } finally {
    setLoading(false);
  }
}

async function logout() {
  try {
    const response = await fetch(`${API_URL}/api/logout`);
    const data = await response.json();
    
    if (data.success) {
      showLogin();
    }
  } catch (error) {
    console.error('Logout error:', error);
    showLogin(); // Show login anyway
  }
}

async function updateDashboard() {
  if (!isLoggedIn) return;
  
  try {
    // Fetch stats
    const statsResponse = await fetch(`${API_URL}/api/stats`);
    const stats = await statsResponse.json();
    
    totalMessages.textContent = stats.totalMessages || 0;
    uniqueUsers.textContent = stats.uniqueUsers || 0;
    
    // Fetch messages
    const messagesResponse = await fetch(`${API_URL}/api/messages`);
    const messages = await messagesResponse.json();
    
    renderMessages(messages);
  } catch (error) {
    console.error('Update error:', error);
  }
}

function renderMessages(messages) {
  if (!messages || messages.length === 0) {
    messagesList.innerHTML = '<div class="empty-state">لا توجد رسائل بعد</div>';
    return;
  }
  
  messagesList.innerHTML = messages.map(msg => `
    <div class="message-card">
      <div class="message-header">
        <img src="${escapeHtml(msg.authorAvatar)}" alt="${escapeHtml(msg.author)}" class="message-avatar">
        <div class="message-info">
          <span class="message-author">${escapeHtml(msg.author)}</span>
          <span class="message-time">${formatTime(msg.timestamp)}</span>
        </div>
      </div>
      <div class="message-content">${escapeHtml(msg.content)}</div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `منذ ${diffDays} يوم`;
}

// Event Listeners
loginBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  
  if (!token) {
    showError('يرجى إدخال توكن البوت');
    return;
  }
  
  await login(token);
});

tokenInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loginBtn.click();
  }
});

logoutBtn.addEventListener('click', async () => {
  if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
    await logout();
  }
});

// Initialize particles animation
function createParticles() {
  const particlesContainer = document.querySelector('.particles');
  if (!particlesContainer) return;
  
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 3 + 's';
    particle.style.animationDuration = (Math.random() * 3 + 2) + 's';
    particlesContainer.appendChild(particle);
  }
}

// Initialize on page load
createParticles();


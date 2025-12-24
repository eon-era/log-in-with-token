require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many login attempts',
    message: 'تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

let messages = [];
let client = null;
let botInfo = { name: 'Offline', avatar: '', online: false };
let isConnecting = false;

app.post('/api/login', loginLimiter, async (req, res) => {
  const { token } = req.body;
  
  // Validate token input
  if (!token || token.trim() === '') {
    return res.status(400).json({ 
      error: 'Token is required',
      message: 'يرجى إدخال توكن البوت' 
    });
  }

  // Sanitize token (remove whitespace, validate format)
  const sanitizedToken = token.trim();
  
  // Basic token format validation (Discord tokens are base64-like strings)
  if (sanitizedToken.length < 50 || sanitizedToken.includes(' ')) {
    return res.status(400).json({ 
      error: 'Invalid token format',
      message: 'صيغة التوكن غير صحيحة. يجب أن يكون التوكن نص طويل بدون مسافات' 
    });
  }

  if (isConnecting) {
    return res.status(429).json({ 
      error: 'Connection in progress',
      message: 'جاري الاتصال، يرجى الانتظار...' 
    });
  }

  isConnecting = true;

  try {
    // Destroy existing client if any
    if (client) {
      await client.destroy();
      client = null;
    }

    // Create new client with proper intents and partials
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
      ],
      partials: [Partials.Channel, Partials.Message]
    });

    // Set up message handler
    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // Only process DMs
      if (!message.guild) {
        messages.unshift({
          id: message.id,
          author: message.author.username,
          authorAvatar: message.author.displayAvatarURL(),
          content: message.content,
          timestamp: message.createdAt
        });
        
        // Keep only last 100 messages
        if (messages.length > 100) messages.pop();
      }
    });

    // Set up error handler
    client.on('error', (error) => {
      console.error('Discord client error:', error);
    });

    // Login with timeout
    const loginTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Login timeout')), 15000)
    );

    await Promise.race([
      client.login(sanitizedToken),
      loginTimeout
    ]);
    
    // Wait for client to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Ready timeout')), 10000);
      client.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    botInfo = {
      name: client.user.username,
      avatar: client.user.displayAvatarURL(),
      online: true
    };

    isConnecting = false;
    
    // Don't send back the token
    res.json({ 
      success: true, 
      bot: botInfo,
      message: 'تم تسجيل الدخول بنجاح!' 
    });
  } catch (error) {
    isConnecting = false;
    
    // Cleanup on error
    if (client) {
      try {
        await client.destroy();
      } catch (e) {
        console.error('Error destroying client:', e);
      }
      client = null;
    }

    console.error('Login error:', error);

    // Provide user-friendly error messages
    let errorMessage = 'حدث خطأ غير معروف';
    let errorCode = 'UNKNOWN_ERROR';

    if (error.message.includes('TOKEN_INVALID') || error.code === 'TokenInvalid') {
      errorMessage = 'التوكن غير صحيح. يرجى التحقق من التوكن والمحاولة مرة أخرى';
      errorCode = 'INVALID_TOKEN';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'انتهت مهلة الاتصال. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى';
      errorCode = 'TIMEOUT';
    } else if (error.message.includes('DISALLOWED_INTENTS')) {
      errorMessage = 'يجب تفعيل صلاحيات Message Content Intent من لوحة تحكم Discord';
      errorCode = 'MISSING_INTENTS';
    } else if (error.code === 'ENOTFOUND' || error.message.includes('getaddrinfo')) {
      errorMessage = 'لا يمكن الاتصال بخوادم Discord. يرجى التحقق من اتصال الإنترنت';
      errorCode = 'NETWORK_ERROR';
    }

    res.status(401).json({ 
      error: errorCode,
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/messages', (req, res) => {
  res.json(messages);
});

app.get('/api/stats', (req, res) => {
  res.json({
    totalMessages: messages.length,
    uniqueUsers: [...new Set(messages.map(m => m.author))].length,
    botName: botInfo.name,
    botAvatar: botInfo.avatar,
    online: botInfo.online
  });
});

app.get('/api/logout', async (req, res) => {
  try {
    if (client) {
      await client.destroy();
      client = null;
    }
    messages = [];
    botInfo = { name: 'Offline', avatar: '', online: false };
    isConnecting = false;
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'LOGOUT_ERROR',
      message: 'حدث خطأ أثناء تسجيل الخروج' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    online: botInfo.online,
    timestamp: new Date().toISOString()
  });
});

// Demo endpoint for testing (only for development)
if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEMO === 'true') {
  app.post('/api/demo-login', (req, res) => {
    // Mock successful login for UI testing
    const mockBotInfo = {
      name: 'Demo Bot',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
      online: true
    };
    
    // Add some demo messages
    messages = [
      {
        id: '1',
        author: 'User123',
        authorAvatar: 'https://cdn.discordapp.com/embed/avatars/1.png',
        content: 'مرحباً! هذه رسالة تجريبية',
        timestamp: new Date(Date.now() - 60000)
      },
      {
        id: '2',
        author: 'Ahmed',
        authorAvatar: 'https://cdn.discordapp.com/embed/avatars/2.png',
        content: 'كيف يمكنني استخدام البوت؟',
        timestamp: new Date(Date.now() - 120000)
      },
      {
        id: '3',
        author: 'Sara',
        authorAvatar: 'https://cdn.discordapp.com/embed/avatars/3.png',
        content: 'البوت رائع! شكراً على الجهد المبذول',
        timestamp: new Date(Date.now() - 180000)
      }
    ];
    
    botInfo = mockBotInfo;
    
    res.json({ 
      success: true, 
      bot: mockBotInfo,
      message: 'تم تسجيل الدخول بنجاح! (وضع تجريبي)' 
    });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
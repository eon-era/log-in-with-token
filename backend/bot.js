const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

let messages = [];
let client = null;
let botInfo = { name: 'Offline', avatar: '', online: false };

app.post('/api/login', async (req, res) => {
  const { token } = req.body;
  
  // Validate token presence
  if (!token) {
    return res.status(400).json({ 
      success: false, 
      error: 'Token is required',
      message: 'يرجى إدخال توكن البوت'
    });
  }

  // Validate token format (basic check)
  if (typeof token !== 'string' || token.trim().length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid token format',
      message: 'صيغة التوكن غير صحيحة'
    });
  }

  try {
    // Destroy existing client if any
    if (client) {
      await client.destroy();
    }

    // Create new Discord client with proper intents
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
      ],
      partials: ['CHANNEL']
    });

    // Setup message listener for DMs
    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // Only track DMs (non-guild messages)
      if (!message.guild) {
        messages.push({
          id: message.id,
          author: message.author.username,
          authorAvatar: message.author.displayAvatarURL(),
          content: message.content,
          timestamp: message.createdAt
        });
        
        // Keep only last 100 messages
        if (messages.length > 100) messages.shift();
      }
    });

    // Handle client errors
    client.on('error', (error) => {
      console.error('Discord client error:', error.message);
    });

    // Attempt login with the provided token
    await client.login(token);
    
    // Update bot information after successful login
    botInfo = {
      name: client.user.username,
      avatar: client.user.displayAvatarURL(),
      online: true,
      id: client.user.id
    };

    // Return success response
    res.json({ 
      success: true, 
      bot: botInfo,
      message: 'تم تسجيل الدخول بنجاح'
    });
  } catch (error) {
    // Handle different error types
    let errorMessage = 'فشل تسجيل الدخول';
    let statusCode = 401;
    
    if (error.code === 'TOKEN_INVALID') {
      errorMessage = 'التوكن غير صحيح';
    } else if (error.code === 'DISALLOWED_INTENTS') {
      errorMessage = 'يرجى تفعيل الصلاحيات المطلوبة في لوحة المطورين';
      statusCode = 403;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: 'Authentication failed',
      message: errorMessage
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
    online: botInfo.online,
    botId: botInfo.id || ''
  });
});

app.get('/api/logout', async (req, res) => {
  if (client) {
    await client.destroy();
    client = null;
  }
  messages = [];
  botInfo = { name: 'Offline', avatar: '', online: false };
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
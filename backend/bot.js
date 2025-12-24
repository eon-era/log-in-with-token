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
  
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    if (client) {
      await client.destroy();
    }

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
      ],
      partials: ['CHANNEL']
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      if (!message.guild) {
        messages.push({
          id: message.id,
          author: message.author.username,
          authorAvatar: message.author.displayAvatarURL(),
          content: message.content,
          timestamp: message.createdAt
        });
        
        if (messages.length > 100) messages.shift();
      }
    });

    await client.login(token);
    
    botInfo = {
      name: client.user.username,
      avatar: client.user.displayAvatarURL(),
      online: true
    };

    res.json({ success: true, bot: botInfo });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
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
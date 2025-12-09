
const fs = require('fs');
const path = require('path');
let WebhookClient;

const sharedChannels = require('../data/shared-channels.json');
const COUNTING_WEBHOOKS = sharedChannels.counting_webhooks || [];
const COUNTING_CHANNELS = sharedChannels.counting || [];
const dataPath = path.join(__dirname, '../data/counting.json');

// Load saved data or initialize defaults
let data = {
  counting: 1,
  lastCounterID: '0000000000',
};

if (fs.existsSync(dataPath)) {
  try {
    const file = fs.readFileSync(dataPath, 'utf-8');
    data = JSON.parse(file);
  } catch (err) {
    console.error('Failed to load counting data:', err);
  }
}

let { counting, lastCounterID } = data;

function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify({ counting, lastCounterID }, null, 2));
}

if (!WebhookClient) {
  WebhookClient = require('discord.js').WebhookClient;
}
async function sendViaWebhook(webhookUrl, username, content, client, channelId) {
  try {
    const webhook = new WebhookClient({ url: webhookUrl });
    const webhookMessage = await webhook.send({ username, content });
    
    // React to the webhook message with check emoji
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(webhookMessage.id);
        await message.react(':check:1383179048980582500');
      }
    } catch (reactionErr) {
      console.error('Failed to react to webhook message:', reactionErr);
    }
  } catch (err) {
    console.error('Failed to send via webhook:', err);
  }
}

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (!COUNTING_CHANNELS.includes(message.channel.id) || message.author.bot) return;


    // ?counting set - Reset count command
    if (message.content.startsWith('?counting set')) {
      if (!message.member.permissions.has('Administrator')) {
        return message.reply("❌ You don't have permission to reset the count.");
      }

      const args = message.content.split(' ');
      const newCount = parseInt(args[2]);

      if (isNaN(newCount)) {
        return message.reply("❌ Please provide a valid number. Example: `?counting set 123`");
      }

      counting = newCount;
      lastCounterID = '0000000000';
      saveData();
      await message.react('🔁');
      // Send as normal bot message
      return message.channel.send(`✅ Counting reset. Continue with **${counting}**`);
    }

    // ?counting rlc - Reset last counter ID command
    if (message.content === '?counting rlc') {
      if (!message.member.permissions.has('Administrator')) {
        return message.reply("❌ You don't have permission to reset the last counter.");
      }

      lastCounterID = '0000000000';
      saveData();
      await message.react('✅');
      // Send as normal bot message
      return message.channel.send(`🔄 Last counter ID reset.`);
    }


    // Counting logic
    if (message.author.id === lastCounterID) {
      await message.delete();
      // Send as normal bot message
      const warning = await message.channel.send(`<@${message.author.id}>, you can't count twice in a row!`);
      setTimeout(() => warning.delete().catch(() => {}), 5000);
      return;
    }

    if (message.content.trim() === String(counting)) {
      lastCounterID = message.author.id;
      counting++;
      saveData();
      await message.react(':check:1383179048980582500'); // Correct count

      // Forward the successful count to all other counting channels using webhook URLs
      for (const webhookObj of COUNTING_WEBHOOKS) {
        if (webhookObj.channel_id !== message.channel.id) {
          sendViaWebhook(webhookObj.url, message.author.displayName, message.content.trim(), message.client, webhookObj.channel_id);
        }
      }

      // 🎉 Celebration message for every 100th number
      if ((counting - 1) % 100 === 0) {
        // Send as normal bot message
        await message.channel.send(`🎉 We have reached **${counting - 1}**! Keep counting!`);
      }

    } else {
      await message.delete();
      // Send as normal bot message
      const warning = await message.channel.send(`<@${message.author.id}>, we are currently at: **${counting}**`);
      setTimeout(() => warning.delete().catch(() => {}), 5000);
    }
  });
};

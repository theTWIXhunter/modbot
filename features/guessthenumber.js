const fs = require('fs');
const path = require('path');
const { WebhookClient } = require('discord.js');

module.exports = (client) => {
  // Load shared channel configuration
  const sharedPath = path.join(__dirname, '..', 'data', 'shared-channels.json');
  let sharedConfig = {};

  try {
    if (fs.existsSync(sharedPath)) {
      sharedConfig = JSON.parse(fs.readFileSync(sharedPath, 'utf8'));
    } else {
      console.error('shared-channels.json not found! Guess Number feature disabled.');
      return;
    }
  } catch (err) {
    console.error('Error loading shared-channels.json:', err);
    return;
  }

  // Channel IDs for guess the number game (from shared config)
  const GUESS_NUMBER_CHANNELS = sharedConfig.guessthenumber || [];

  // Webhook configuration (from shared config)
  const GUESS_NUMBER_WEBHOOKS = sharedConfig.guessthenumber_webhooks || [];

  const CHECK_EMOJI = '<:check:1383179048980582500>';
  const dataPath = path.join(__dirname, '..', 'data', 'guessnumber.json');

  // Initialize or load game data
  function loadGameData() {
    try {
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        // Ensure personal highscores exist
        if (!data.personalHighscores) data.personalHighscores = {};

        return data;
      }
    } catch (error) {
      console.error('Error loading guess number data:', error);
    }

    // Default game data
    return {
      currentNumber: generateRandomNumber(),
      tries: 0,
      highscore: 0,
      personalHighscores: {}
    };
  }

  function saveGameData(data) {
    try {
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving guess number data:', error);
    }
  }

  function generateRandomNumber() {
    return Math.floor(Math.random() * 101); // 0 to 100
  }

  // Webhook forwarding function
  async function sendViaWebhook(webhookUrl, username, content, options = {}, client = null, channelId = null) {
    try {
      const webhook = new WebhookClient({ url: webhookUrl });
      const webhookMessage = await webhook.send({ username, content, ...options });

      // React to the webhook message
      if (client && channelId) {
        try {
          const channel = await client.channels.fetch(channelId);
          if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(webhookMessage.id);
            const guess = parseInt(content.trim());

            if (!isNaN(guess) && guess >= 0 && guess <= 100) {
              if (guess < gameData.currentNumber) {
                await message.react('⬆️');
              } else if (guess > gameData.currentNumber) {
                await message.react('⬇️');
              } else {
                await message.react(CHECK_EMOJI);
              }
            }
          }
        } catch (reactionErr) {
          console.error('Failed to react to webhook message:', reactionErr);
        }
      }
    } catch (err) {
      console.error('Failed to send via webhook:', err);
    }
  }

  // Initialize game data
  let gameData = loadGameData();

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!GUESS_NUMBER_CHANNELS.includes(message.channel.id)) return;

    const content = message.content.trim();

    // Admin command to set number
    if (content.startsWith('?guessthenumber set')) {
      if (!message.member.permissions.has('Administrator')) {
        return message.reply("❌ You don't have permission to set the number.");
      }

      const args = content.split(' ');
      const newNumber = parseInt(args[2]);

      if (isNaN(newNumber) || newNumber < 0 || newNumber > 100) {
        return message.reply("❌ Please provide a valid number between 0 and 100. Example: `?guessthenumber set 42`");
      }

      gameData.currentNumber = newNumber;
      saveGameData(gameData);
      await message.react('🔁');
      return message.channel.send(`✅ Number set to **${newNumber}**.`);
    }

    // Validate number guess
    if (!/^\d{1,3}$/.test(content)) {
      await message.delete();
      const warning = await message.channel.send(`<@${message.author.id}>, your message must be a number between 0 and 100.`);
      setTimeout(() => warning.delete().catch(() => {}), 5000);
      return;
    }

    const guess = Number(content);

    if (guess < 0 || guess > 100) {
      await message.delete();
      const warning = await message.channel.send(`<@${message.author.id}>, your message must be a number between 0 and 100.`);
      setTimeout(() => warning.delete().catch(() => {}), 5000);
      return;
    }

    // Forward guess via webhook to other servers
    for (const webhookObj of GUESS_NUMBER_WEBHOOKS) {
      if (webhookObj.channel_id !== message.channel.id) {
        sendViaWebhook(
          webhookObj.url,
          message.member.displayName,
          message.content,
          {},
          message.client,
          webhookObj.channel_id
        );
      }
    }

    gameData.tries++;

    let embedData = null;

    if (guess < gameData.currentNumber) {
      await message.react('⬆️');
    } else if (guess > gameData.currentNumber) {
      await message.react('⬇️');
    } else {
      // Correct guess
      await message.react(CHECK_EMOJI);

      if (gameData.highscore === 0 || gameData.tries < gameData.highscore) {
        gameData.highscore = gameData.tries;
      }

      const userId = message.author.id;

      if (!gameData.personalHighscores[userId] ||
          gameData.tries < gameData.personalHighscores[userId]) {
        gameData.personalHighscores[userId] = gameData.tries;
      }

      embedData = {
        title: `${message.member.displayName} guessed the number!`,
        description:
          `🎉 The number was **${gameData.currentNumber}**!\n\n` +
          `📊 Tries this round: **${gameData.tries}**\n` +
          `🏆 Global Highscore: **${gameData.highscore}**\n` +
          `👤 Your Personal Best: **${gameData.personalHighscores[userId]}**\n\n` +
          `**The game has restarted! Guess the next number below!**`,
        color: 64367
      };

      // Reset game
      gameData.currentNumber = generateRandomNumber();
      gameData.tries = 0;
    }

    saveGameData(gameData);

    // Broadcast embed to all channels
    if (embedData) {
      await message.channel.send({ embeds: [embedData] });

      for (const channelId of GUESS_NUMBER_CHANNELS) {
        if (channelId !== message.channel.id) {
          setTimeout(async () => {
            try {
              const channel = await message.client.channels.fetch(channelId);
              if (channel && channel.isTextBased()) {
                await channel.send({ embeds: [embedData] });
              }
            } catch (error) {
              console.error('Failed to send embed:', error);
            }
          }, 1500);
        }
      }
    }
  });

  console.log('Guess Number feature loaded (shared-config mode)');
};

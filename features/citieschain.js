const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const sharedChannels = require('../data/shared-channels.json');
let WebhookClient;
const CITIESCHAIN_WEBHOOKS = sharedChannels.citieschain_webhooks || [];
const CITIESCHAIN_CHANNELS = sharedChannels.citieschain;
if (!WebhookClient) {
  WebhookClient = require('discord.js').WebhookClient;
}
function getWebhookUrlForChannel(channelId) {
  const obj = CITIESCHAIN_WEBHOOKS.find(w => w.channel_id === channelId);
  return obj ? obj.url : null;
}
async function sendViaWebhook(channelId, username, content, options = {}, client = null) {
  const url = getWebhookUrlForChannel(channelId);
  if (!url) return;
  try {
    const webhook = new WebhookClient({ url });
    const webhookMessage = await webhook.send({ username, content, ...options });
    
    // React to the webhook message with check emoji if it's a successful city (starts with '!')
    if (client && content.startsWith('!')) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(webhookMessage.id);
          await message.react(CHECK_EMOJI);
        }
      } catch (reactionErr) {
        console.error('Failed to react to webhook message:', reactionErr);
      }
    }
  } catch (err) {
    console.error('Failed to send via webhook:', err);
  }
}
const STATE_FILE = path.join(__dirname, '../data/gameState.json');
const GEO_NAMES_USERNAME = process.env.GEO_NAMES_USERNAME;
const CHECK_EMOJI = '<:check:1383179048980582500>';
const EMBED_COLOR = 12451584;

let gameState = {
  currentCity: null,
  lastUserId: null,
  usedCities: [],
  streak: 0,
  highscore: 0,
  lastLetter: null,
};

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(gameState, null, 2));
}

if (fs.existsSync(STATE_FILE)) {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      gameState = Object.assign(gameState, parsed);
    }
  } catch {
    // ignore errors, keep defaults
  }
}

function resetGame() {
  gameState.currentCity = null;
  gameState.lastUserId = null;
  gameState.usedCities = [];
  gameState.streak = 0;
  gameState.lastLetter = null;
  saveState();
}

async function isValidCity(city) {
  const cityLower = city.toLowerCase();
  const langs = ['nl', 'en'];

  for (const lang of langs) {
    const url = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(city)}&maxRows=50&featureClass=P&username=${GEO_NAMES_USERNAME}&lang=${lang}&isNameRequired=false`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.geonames || data.geonames.length === 0) continue;

      for (const place of data.geonames) {
        if (place.name.toLowerCase() === cityLower) return true;

        if (place.alternateNames) {
          for (const alt of place.alternateNames) {
            if (alt.name.toLowerCase() === cityLower) return true;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return false;
}

function createEmbedMessage(user, errorMsg) {
  return {
    embeds: [{
      title: `${user.displayName} ruined the streak of ${gameState.streak}!!`,
      description: `${errorMsg}\n\n📊 Current streak: ${gameState.streak}\n🏆 Highscore: ${gameState.highscore}\n\n### We start again with the letter __${gameState.lastLetter?.toUpperCase() || '?'}__!`,
      color: EMBED_COLOR
    }],
    allowedMentions: { users: [user.id] }
  };
}

async function handleMessage(message) {
  if (!CITIESCHAIN_CHANNELS.includes(message.channel.id)) return;
  console.log("CITIESCHAIN.JS: message recieved in cities chain channel")
  if (message.author.bot) return;
  const content = message.content.trim();

    // Only forward messages that start with '!' via webhook
    if (content.startsWith('!')) {
      for (const channelId of CITIESCHAIN_CHANNELS) {
        if (channelId !== message.channel.id) {
          sendViaWebhook(channelId, message.author.displayName, message.content, {}, message.client).catch(() => {});
          console.log(`CITIESCHAIN.JS: message has been forwarded`)
        }
      }
    }

  // Admin commands & info (starting with ?citieschain)
  if (content.startsWith('?citieschain')) {
    const args = content.split(' ');
    const subcmd = args[1];
    console.log(`CITIESCHAIN.JS: ?citieschain has been used by ${message.author} (${message.content})`)
    // ?citieschain rlc (reset last chainer)
    if (subcmd === 'rlc') {
      if (!message.member.permissions.has('Administrator')) return;
      gameState.lastUserId = null;
      saveState();
      await message.reply({ content: '✅ Last chainer reset.', allowedMentions: { repliedUser: false }, failIfNotExists: false });
      console.log(`CITIESCHAIN.JS: Last chainer got reset`)
      return;
    }

    // ?citieschain sll <letter> (set last letter)
    if (subcmd === 'sll') {
      if (!message.member.permissions.has('Administrator')) return;
      if (args.length !== 3 || args[2].length !== 1 || !/[a-z]/i.test(args[2])) {
        await message.reply({ content: '❌ Usage: ?citieschain sll <single letter>', allowedMentions: { repliedUser: false }, failIfNotExists: false });
        console.warn(`CITIESCHAIN.JS: unable to set last letter`)
        return;
      }
      gameState.lastLetter = args[2].toLowerCase();
      saveState();
      await message.reply({ content: `✅ Last letter set to **${gameState.lastLetter.toUpperCase()}**`, allowedMentions: { repliedUser: false }, failIfNotExists: false });
      console.log(`CITIESCHAIN.JS: Last letter set to ${gameState.lastLetter.toUpperCase()}`)
      return;
    }

    // ?citieschain info
    if (subcmd === 'info') {
      await message.reply({ content: `📊 Current streak: **${gameState.streak}**\n🏆 Highscore: **${gameState.highscore}**`, allowedMentions: { repliedUser: false }, failIfNotExists: false });
      console.log("CITIESCHAIN.JS: info message has been sent")
      return;
    }

    console.log(`CITIESCHAIN.JS: unknown subcomand (${subcmd})`)
    return; // unknown subcommand
  }

  // City guess (must start with !)
  if (!content.startsWith('!')) return;
  const cityName = content.slice(1).trim();
  if (!cityName) return;

  // Check if user tried to play twice in a row
  if (gameState.lastUserId === message.author.id) {
    console.log(`CITIESCHAIN.JS: ${gameState.lastUserId} tried to chain multiple times`)
    // Send streak ruined message as normal bot message to all channels, with 1 second delay for other channels
    for (const channelId of CITIESCHAIN_CHANNELS) {
      if (channelId !== message.channel.id) {
        setTimeout(async () => {
          const clientChannel = await message.client.channels.fetch(channelId).catch(() => null);
          if (clientChannel && clientChannel.isTextBased()) {
            clientChannel.send(createEmbedMessage(message.author, '(you cannot play twice in a row!)')).catch(() => {});
          }
        }, 1500);
      }
    }
    message.channel.send(createEmbedMessage(message.author, '(you cannot play twice in a row!)'));
    resetGame();
    return;
  }

  // Check if city was already used
  if (gameState.usedCities.includes(cityName.toLowerCase())) {
    for (const channelId of CITIESCHAIN_CHANNELS) {
      if (channelId !== message.channel.id) {
        setTimeout(async () => {
          const clientChannel = await message.client.channels.fetch(channelId).catch(() => null);
          if (clientChannel && clientChannel.isTextBased()) {
            clientChannel.send(createEmbedMessage(message.author, `(city \`${cityName}\` was already used!)`)).catch(() => {});
          }
        }, 1500);
      }
    }
    message.channel.send(createEmbedMessage(message.author, `(city \`${cityName}\` was already used!)`));
    resetGame();
    console.log(`CITIESCHAIN.JS: ${cityName.toLowerCase()} was already used.`)
    return;
  }

  // Check first letter matches last letter or current city ending
  const expectedFirstLetter = gameState.lastLetter
    ? gameState.lastLetter
    : gameState.currentCity
    ? gameState.currentCity.slice(-1).toLowerCase()
    : null;

  if (expectedFirstLetter) {
    if (cityName[0].toLowerCase() !== expectedFirstLetter) {
      for (const channelId of CITIESCHAIN_CHANNELS) {
        if (channelId !== message.channel.id) {
          setTimeout(async () => {
            const clientChannel = await message.client.channels.fetch(channelId).catch(() => null);
            if (clientChannel && clientChannel.isTextBased()) {
              clientChannel.send(createEmbedMessage(message.author, `(city \`${cityName}\` must start with \`${expectedFirstLetter.toUpperCase()}\`!)`)).catch(() => {});
            }
          }, 1500);
        }
      }
      message.channel.send(createEmbedMessage(message.author, `(city \`${cityName}\` must start with \`${expectedFirstLetter.toUpperCase()}\`!)`));
      resetGame();
      return;
      console.log(`CITIESCHAIN.JS: ${cityName} does not start with ${expectedFirstLetter}`)
    }
  }

  // Validate city existence
  const validCity = await isValidCity(cityName);
  if (!validCity) {
    for (const channelId of CITIESCHAIN_CHANNELS) {
      if (channelId !== message.channel.id) {
        setTimeout(async () => {
          const clientChannel = await message.client.channels.fetch(channelId).catch(() => null);
          if (clientChannel && clientChannel.isTextBased()) {
            clientChannel.send(createEmbedMessage(message.author, `(city \`${cityName}\` was not found!)`)).catch(() => {});
          }
        }, 1500);
      }
    }
    message.channel.send(createEmbedMessage(message.author, `(city \`${cityName}\` was not found!)`));
    resetGame();
    return;
  }

  // Passed all checks: accept city
  gameState.usedCities.push(cityName.toLowerCase());
  gameState.currentCity = cityName;
  gameState.lastLetter = cityName.slice(-1).toLowerCase();
  gameState.streak++;
  gameState.lastUserId = message.author.id;

  if (gameState.streak > gameState.highscore) gameState.highscore = gameState.streak;

  saveState();

  await message.react(CHECK_EMOJI);

  // Forward the successful city to all other citieschain channels
  // (No need to forward again, already done at the top for all messages)
}

module.exports = {
  init(client) {
    client.on('messageCreate', handleMessage);
  }
};

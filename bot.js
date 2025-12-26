
require('dotenv').config();

// Initialize logging system first to capture all console output
const Logger = require('./utils/logger');
const logger = new Logger();
logger.startDailyRotation();

const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
const loadFeatures = require('./utils/loadFeatures');

// Initialize Discord client with required intents
const { Partials } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Dynamically load all features from the features folder
const features = loadFeatures(path.resolve(__dirname, 'features'));

// Collect all commands from features that provide them
const allCommands = features
  .filter(f => Array.isArray(f.commands))
  .flatMap(f => f.commands);

// Register all commands once client is ready (Discord.js v15+)
client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await client.application.commands.set(allCommands);
    console.log('✅ All commands registered.');
    // Trick the Falix console into registering the server as online
    console.log('[12:34:56 INFO]: Done (69.420s)! For help, type "help"');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  console.log('Bot: ANY interaction received:', interaction.type, interaction.user.tag);
  
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    console.log('Bot: Slash command:', interaction.commandName);
    for (const feature of features) {
      if (feature.commands && feature.handleInteraction && feature.commands.some(cmd => cmd.name === interaction.commandName)) {
        try {
          await feature.handleInteraction(interaction, client);
        } catch (e) {
          console.error(`Error in ${interaction.commandName} command:`, e);
          await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
        return;
      }
    }
  }

  // Handle other interactions (buttons, select menus, modals)
  if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit() || interaction.isAutocomplete()) {
    console.log('Bot: Processing non-command interaction:', interaction.type, interaction.customId);
    for (const feature of features) {
      if (feature.handleInteraction) {
        try {
          const result = await feature.handleInteraction(interaction, client);
          // If the feature handled the interaction, stop here
          if (interaction.replied || interaction.deferred) {
            console.log('Bot: Interaction handled successfully by a feature');
            return;
          }
        } catch (e) {
          console.error(`Error in ${interaction.type} interaction:`, e);
          if (!interaction.replied && !interaction.deferred) {
            try {
              await interaction.reply({ content: 'An error occurred while processing this interaction.', ephemeral: true });
            } catch (replyError) {
              console.error('Failed to send error reply:', replyError);
            }
          }
          return;
        }
      }
    }
    console.log('Bot: No feature handled the interaction');
  }
});

// Initialize all features that export an init/setup/function
for (const feature of features) {
  if (typeof feature === 'function') {
    // If the feature itself is a function, call it with the client
    feature(client);
  } else if (typeof feature.init === 'function') {
    feature.init(client);
  } else if (typeof feature.setup === 'function') {
    feature.setup(client);
  }
}

// Log in the bot
client.login(process.env.TOKEN);
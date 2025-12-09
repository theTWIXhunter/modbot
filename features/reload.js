const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

module.exports = {
  commands: [
    new SlashCommandBuilder()
      .setName('reload')
      .setDescription('Reload bot features without restarting')
      .addStringOption(option =>
        option.setName('feature')
          .setDescription('Specific feature to reload (leave empty to reload all)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .setDefaultMemberPermissions('0') // Only administrators can use this command
  ],

  async handleInteraction(interaction, client) {
    // Only handle reload command interactions
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;
    if (interaction.commandName !== 'reload') return;

    // Handle autocomplete for feature selection
    if (interaction.isAutocomplete()) {
      try {
        const focusedValue = interaction.options.getFocused();
        const featuresDir = path.join(__dirname);
        const files = fs.readdirSync(featuresDir);
        
        const choices = files
          .filter(file => file.endsWith('.js') && file !== 'reload.js')
          .map(file => file.replace('.js', ''))
          .filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase()))
          .slice(0, 25); // Discord limit
        
        await interaction.respond(
          choices.map(choice => ({ name: choice, value: choice }))
        );
      } catch (error) {
        console.error('Autocomplete error:', error);
        await interaction.respond([]);
      }
      return;
    }

    const STAFF_USER_ID = '1244004992046596232'; // the_twix_hunter
    
    // Check if the user is the bot owner
    if (interaction.user.id !== STAFF_USER_ID) {
      return await interaction.reply({ 
        content: 'Only the bot owner can use this command.', 
        flags: 64 // EPHEMERAL flag
      });
    }

    await interaction.deferReply({ flags: 64 }); // EPHEMERAL flag

    const specificFeature = interaction.options.getString('feature');

    try {
      const featuresDir = path.join(__dirname);
      const files = fs.readdirSync(featuresDir);
      
      let reloadedCount = 0;
      const reloadedFeatures = [];
      let filesToReload = [];

      if (specificFeature) {
        // Reload specific feature
        const featureFile = `${specificFeature}.js`;
        if (files.includes(featureFile)) {
          filesToReload = [featureFile];
        } else {
          return await interaction.editReply({
            content: `❌ Feature \`${specificFeature}\` not found. Available features: ${files.filter(f => f.endsWith('.js') && f !== 'reload.js').map(f => f.replace('.js', '')).join(', ')}`
          });
        }
      } else {
        // Reload all features
        filesToReload = files.filter(file => file.endsWith('.js') && file !== 'reload.js');
      }
      
      for (const file of filesToReload) {
        const featurePath = path.join(featuresDir, file);
        const fullPath = require.resolve(featurePath);
        
        // Remove from cache
        delete require.cache[fullPath];
        reloadedFeatures.push(file);
        reloadedCount++;
      }

      if (!specificFeature) {
        // Only remove all listeners when reloading all features
        client.removeAllListeners('messageCreate');
        client.removeAllListeners('interactionCreate');
      } else {
        // For specific feature reload, we need to remove all listeners and re-add them
        // This is necessary because we can't selectively remove listeners
        client.removeAllListeners('messageCreate');
        client.removeAllListeners('interactionCreate');
      }

      // Re-require loadFeatures and reload all features
      const loadFeaturesPath = require.resolve('../loadFeatures');
      delete require.cache[loadFeaturesPath];
      const loadFeatures = require('../loadFeatures');
      
      // Reload all features
      const features = loadFeatures(path.join(__dirname));
      
      // Collect all commands from features that provide them
      const allCommands = features
        .filter(f => Array.isArray(f.commands))
        .flatMap(f => f.commands);

      // Re-register commands
      await client.application.commands.set(allCommands);

      if (!specificFeature) {
        // Re-setup interaction handler only when reloading all
        client.on('interactionCreate', async (interaction) => {
          if (!interaction.isChatInputCommand()) return;

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
        });
      } else {
        // Also re-setup interaction handler for specific reloads
        client.on('interactionCreate', async (interaction) => {
          if (!interaction.isChatInputCommand()) return;

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
        });
      }

      // Initialize all features that export an init/setup/function
      for (const feature of features) {
        if (typeof feature === 'function') {
          feature(client);
        } else if (typeof feature.init === 'function') {
          feature.init(client);
        } else if (typeof feature.setup === 'function') {
          feature.setup(client);
        }
      }

      const reloadType = specificFeature ? `feature \`${specificFeature}\`` : `${reloadedCount} features`;
      await interaction.editReply({
        content: `✅ Successfully reloaded ${reloadType}:\n\`\`\`${reloadedFeatures.join(', ')}\`\`\`\n🔄 Commands re-registered${!specificFeature ? ' and event listeners refreshed' : ''}.`
      });

      console.log(`🔄 Features reloaded by ${interaction.user.tag}: ${reloadedFeatures.join(', ')}`);

    } catch (error) {
      console.error('Error reloading features:', error);
      await interaction.editReply({
        content: `❌ Failed to reload ${specificFeature ? `feature \`${specificFeature}\`` : 'features'}: ${error.message}`
      });
    }
  }
};

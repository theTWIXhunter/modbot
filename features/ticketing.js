const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  commands: [
    new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Manage tickets')
      .addSubcommand(subcommand =>
        subcommand
          .setName('setup')
          .setDescription('Send the ticket creation message')
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('Channel to send the ticket message in')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('close')
          .setDescription('Close a ticket')
          .addStringOption(option =>
            option.setName('reason')
              .setDescription('Reason for closing (optional)')
              .setRequired(false)
          )
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  ],

  async handleInteraction(interaction, client) {
    const MODERATOR_ROLE_ID = '1406519855347269693';
    const TARGET_GUILD_ID = '1406513249914191872';

    // Debug logging
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      console.log('Ticketing: Interaction type:', interaction.type, 'CustomId:', interaction.customId);
    }

    // Only handle interactions relevant to ticketing
    const isTicketInteraction = 
      (interaction.isButton() && interaction.customId === 'create_ticket') ||
      (interaction.isStringSelectMenu() && (interaction.customId === 'ticket_category' || interaction.customId.startsWith('ticket_product_'))) ||
      (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_reason_')) ||
      (interaction.isChatInputCommand() && interaction.commandName === 'ticket') ||
      (interaction.isAutocomplete() && interaction.commandName === 'ticket');

    if (!isTicketInteraction) {
      if (interaction.isButton() && interaction.customId === 'create_ticket') {
        console.log('Ticketing: create_ticket button not matching filter - this should not happen');
      }
      return;
    }

    console.log('Ticketing: Handling interaction:', interaction.customId || interaction.commandName);

    // Handle button interactions
    if (interaction.isButton()) {
      console.log('Ticketing: Processing button interaction:', interaction.customId);
      if (interaction.customId === 'create_ticket') {
        console.log('Ticketing: Creating ticket category selection...');
        try {
          // Show category selection
          const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('ticket_category')
            .setPlaceholder('Select a category')
            .addOptions([
              {
                label: 'Reporting a user',
                value: 'reporting',
                description: 'Report a user for breaking rules'
              },
              {
                label: 'I have an issue',
                value: 'issue',
                description: 'Technical or other issues'
              },
              {
                label: 'I have a question',
                value: 'question',
                description: 'General questions'
              },
              {
                label: 'Bug report',
                value: 'bugreport',
                description: 'Report a bug'
              },
              {
                label: 'Other',
                value: 'other',
                description: 'Something else'
              }
            ]);

          const row = new ActionRowBuilder().addComponents(categorySelect);

          await interaction.reply({
            content: 'Please select a category for your ticket:',
            components: [row],
            flags: 64 // EPHEMERAL
          });
        } catch (error) {
          console.error('Error handling create_ticket button:', error);
          await interaction.reply({
            content: '❌ Failed to create ticket. Please try again.',
            flags: 64 // EPHEMERAL
          });
        }
      }
      return;
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_category') {
        const category = interaction.values[0];
        
        // If reporting a user, skip product selection
        if (category === 'reporting') {
          await this.showReasonModal(interaction, category, 'discord-server');
          return;
        }

        // Show product selection
        const productSelect = new StringSelectMenuBuilder()
          .setCustomId(`ticket_product_${category}`)
          .setPlaceholder('Select a product')
          .addOptions([
            {
              label: 'Discord Server',
              value: 'discord-server',
              description: 'Issues with this Discord server'
            },
            {
              label: 'DiscordAuth Plugin',
              value: 'discordauth-plugin',
              description: 'DiscordAuth related issues'
            },
            {
              label: 'ModBot Bot',
              value: 'modbot-bot',
              description: 'ModBot related issues'
            },
            {
              label: 'Better Falix Web Extension',
              value: 'better-falix-webextension',
              description: 'Better Falix extension issues'
            },
            {
              label: 'General/Other',
              value: 'general-other',
              description: 'Other products or general questions'
            }
          ]);

        const row = new ActionRowBuilder().addComponents(productSelect);

        await interaction.update({
          content: 'Please select the product your ticket is about:',
          components: [row]
        });
      }

      if (interaction.customId.startsWith('ticket_product_')) {
        const category = interaction.customId.split('_')[2];
        const product = interaction.values[0];
        
        await this.showReasonModal(interaction, category, product);
      }
      return;
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('ticket_reason_')) {
        const [, , category, product] = interaction.customId.split('_');
        const reason = interaction.fields.getTextInputValue('reason');
        
        await this.createTicketChannel(interaction, category, product, reason);
      }
      return;
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'setup') {
        // Check if user has permission
        if (!interaction.member.roles.cache.has(MODERATOR_ROLE_ID)) {
          return await interaction.reply({
            content: 'Only moderators can use this command.',
            flags: 64 // EPHEMERAL
          });
        }

        const targetChannel = interaction.options.getChannel('channel');

        const embed = new EmbedBuilder()
          .setTitle('🎫 Create a Ticket')
          .setDescription('Need help? Click the button below to create a support ticket.\n\nOur team will assist you as soon as possible!')
          .setColor(0x00AE86)
          .setFooter({ text: 'Please provide as much detail as possible when creating your ticket.' });

        const button = new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫');

        const row = new ActionRowBuilder().addComponents(button);

        try {
          await targetChannel.send({
            embeds: [embed],
            components: [row]
          });

          await interaction.reply({
            content: `✅ Ticket creation message sent to ${targetChannel}!`,
            flags: 64 // EPHEMERAL
          });
        } catch (error) {
          console.error('Error sending ticket message:', error);
          await interaction.reply({
            content: '❌ Failed to send ticket message. Make sure I have permission to send messages in that channel.',
            flags: 64 // EPHEMERAL
          });
        }
      }

      if (subcommand === 'close') {
        // Check if user has permission
        if (!interaction.member.roles.cache.has(MODERATOR_ROLE_ID)) {
          return await interaction.reply({
            content: 'Only moderators can close tickets.',
            flags: 64 // EPHEMERAL
          });
        }

        // Check if this is a ticket channel
        if (!interaction.channel.name.includes('-') || !interaction.channel.name.match(/\d+$/)) {
          return await interaction.reply({
            content: 'This command can only be used in ticket channels.',
            flags: 64 // EPHEMERAL
          });
        }

        const reason = interaction.options.getString('reason') || 'the issue has been solved';
        
        await this.closeTicket(interaction, reason);
      }
    }
  },

  async showReasonModal(interaction, category, product) {
    const modal = new ModalBuilder()
      .setCustomId(`ticket_reason_${category}_${product}`)
      .setTitle('Ticket Details');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Please describe your issue/question in detail')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(10)
      .setMaxLength(1000)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  },

  async createTicketChannel(interaction, category, product, reason) {
    try {
      const MODERATOR_ROLE_ID = '1406519855347269693';
      const TICKETS_CATEGORY_ID = '1406518723119943752';
      const TICKET_LOGS_CHANNEL_ID = '1406518651397607465';
      const timestamp = Date.now();
      
      // Create short product names for channel
      const productNames = {
        'discord-server': 'Discord',
        'discordauth-plugin': 'DCAuth',
        'modbot-bot': 'ModBot',
        'better-falix-webextension': 'BetterFalix',
        'general-other': 'General'
      };

      // Create short category names for channel
      const categoryNames = {
        'reporting': 'Report',
        'issue': 'Issue',
        'question': 'Question',
        'bugreport': 'Bug',
        'other': 'Other'
      };

      const channelName = `${productNames[product]}-${categoryNames[category]}-${timestamp}`;

      // Create the ticket channel
      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKETS_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: MODERATOR_ROLE_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
          }
        ]
      });

      // Create ticket information embed
      const ticketEmbed = new EmbedBuilder()
        .setTitle('🎫 Ticket Created')
        .setDescription(`**User:** ${interaction.user}\n**Category:** ${category.charAt(0).toUpperCase() + category.slice(1)}\n**Product:** ${product.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n**Details:**\n${reason}`)
        .setColor(0x00AE86)
        .setTimestamp()
        .setFooter({ text: `Ticket ID: ${timestamp} | Creator: ${interaction.user.id}` });

      await ticketChannel.send({
        content: `${interaction.user}`,
        embeds: [ticketEmbed]
      });

      await interaction.reply({
        content: `✅ Your ticket has been created: ${ticketChannel}`,
        flags: 64 // EPHEMERAL
      });

      // Send log to ticket logs channel
      try {
        const logsChannel = await interaction.guild.channels.fetch(TICKET_LOGS_CHANNEL_ID);
        if (logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🎫 New Ticket Created')
            .setDescription(`**Channel:** ${ticketChannel}\n**Creator:** ${interaction.user} (${interaction.user.tag})\n**Category:** ${category.charAt(0).toUpperCase() + category.slice(1)}\n**Product:** ${product.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n**Details:**\n${reason}`)
            .setColor(0x00AE86)
            .setTimestamp()
            .setFooter({ text: `Ticket ID: ${timestamp}` });

          await logsChannel.send({ embeds: [logEmbed] });
        }
      } catch (logError) {
        console.error('Error sending ticket creation log:', logError);
      }

    } catch (error) {
      console.error('Error creating ticket:', error);
      await interaction.reply({
        content: '❌ Failed to create ticket. Please try again.',
        flags: 64 // EPHEMERAL
      });
    }
  },

  async closeTicket(interaction, reason) {
    try {
      const MODERATOR_ROLE_ID = '1406519855347269693';
      const TICKET_LOGS_CHANNEL_ID = '1406518651397607465';
      
      // Get ticket creator from channel permissions
      const permissions = interaction.channel.permissionOverwrites.cache;
      let ticketCreator = null;
      
      // First, try to get the creator from the embed footer (most reliable)
      const messages = await interaction.channel.messages.fetch({ limit: 10 });
      const firstMessage = messages.last();
      if (firstMessage && firstMessage.embeds.length > 0) {
        const embed = firstMessage.embeds[0];
        if (embed.footer && embed.footer.text.includes('Creator:')) {
          const creatorId = embed.footer.text.split('Creator: ')[1];
          try {
            ticketCreator = await interaction.guild.members.fetch(creatorId);
            //console.log(`✅ Found ticket creator from embed: ${ticketCreator.user.tag}`);
          } catch (error) {
            //console.log('❌ Creator from embed not found, trying permissions...');
          }
        }
      }
      
      // Fallback: look through permissions (excluding @everyone role)
      if (!ticketCreator) {
        for (const [id, permission] of permissions) {
          // Skip if it's the everyone role
          if (id === interaction.guild.roles.everyone.id) continue;
          
          try {
            const member = await interaction.guild.members.fetch(id);
            if (member && !member.user.bot) {
              // Accept any real user (including moderators)
              ticketCreator = member;
              //console.log(`✅ Found ticket creator from permissions: ${ticketCreator.user.tag}`);
              break;
            }
          } catch (fetchError) {
            // User might have left the server, continue looking
            continue;
          }
        }
      }

      // Send DM to ticket creator
      if (ticketCreator) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setTitle('🎫 Ticket Closed')
            .setDescription(`Your ticket **${interaction.channel.name}** has been closed.\n\n**Reason:** ${reason}`)
            .setColor(0xff6b6b)
            .setTimestamp();

          await ticketCreator.send({ embeds: [dmEmbed] });
          //console.log(`✅ DM sent to ${ticketCreator.user.tag} for ticket ${interaction.channel.name}`);
        } catch (dmError) {
          console.log(`❌ Could not send DM to ${ticketCreator.user.tag}:`, dmError.message);
        }
      } else {
        console.log('❌ Could not find ticket creator');
      }

      // Send closing message in channel
      const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket has been closed by ${interaction.user}.\n\n**Reason:** ${reason}\n\nThis channel will be deleted in 10 seconds.`)
        .setColor(0xff6b6b)
        .setTimestamp();

      await interaction.reply({ embeds: [closeEmbed] });

      // Send log to ticket logs channel before deleting
      try {
        const logsChannel = await interaction.guild.channels.fetch(TICKET_LOGS_CHANNEL_ID);
        if (logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(`**Channel:** ${interaction.channel.name}\n**Closed by:** ${interaction.user} (${interaction.user.tag})\n**Creator:** ${ticketCreator ? `${ticketCreator.user.tag} (${ticketCreator.user.id})` : 'Unknown'}\n\n**Reason:** ${reason}`)
            .setColor(0xff6b6b)
            .setTimestamp();

          await logsChannel.send({ embeds: [logEmbed] });
        }
      } catch (logError) {
        console.error('Error sending ticket closure log:', logError);
      }

      // Delete channel after 10 seconds
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          console.error('Error deleting ticket channel:', error);
        }
      }, 10000);

    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.reply({
        content: '❌ Failed to close ticket. Please try again.',
        flags: 64 // EPHEMERAL
      });
    }
  }
};

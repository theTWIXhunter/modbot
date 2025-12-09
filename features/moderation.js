const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('(un)Timeout users')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add timeout to a user')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to timeout')
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('duration')
            .setDescription('Timeout duration in seconds (max 2419200)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove timeout from a user')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to remove timeout from')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

module.exports = {
  commands,

  async handleInteraction(interaction) {
    if (interaction.commandName !== 'timeout') return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need admin permissions to manage timeouts.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const member = interaction.options.getMember('user');

    if (!member) {
      return interaction.reply({ content: 'User not found in this guild.', ephemeral: true });
    }

    if (subcommand === 'add') {
      const durationSeconds = interaction.options.getInteger('duration');

      if (durationSeconds <= 0 || durationSeconds > 2419200) {
        return interaction.reply({ content: 'Duration must be between 1 second and 28 days (2419200 seconds).', ephemeral: true });
      }

      try {
        await member.timeout(durationSeconds * 1000, `Timeout added by ${interaction.user.tag}`);
        return interaction.reply(`⏱️ Timed out ${member.user.tag} for ${durationSeconds} seconds.`);
      } catch (error) {
        console.error('Error applying timeout:', error);
        return interaction.reply({ content: 'Failed to timeout the user.', ephemeral: true });
      }
    }

    if (subcommand === 'remove') {
      try {
        await member.timeout(null, `Timeout removed by ${interaction.user.tag}`);
        return interaction.reply(`✅ Removed timeout from ${member.user.tag}.`);
      } catch (error) {
        console.error('Error removing timeout:', error);
        return interaction.reply({ content: 'Failed to remove timeout from the user.', ephemeral: true });
      }
    }
  }
};

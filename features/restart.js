const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const countingChannelId = '1382736294219874395';
const citiesChainChannelId = '1384924280180969622';

const commands = [
  new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Restart the bot (locks #counting and #cities-chain, then exits)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

async function lockChannel(client, channelId, name) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) throw new Error(`Channel ${name} not found.`);
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      SendMessages: false
    });
    console.log(`🔒 ${name} locked.`);
  } catch (err) {
    console.error(`❌ Failed to lock ${name}:`, err);
  }
}

async function unlockChannel(client, channelId, name) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) throw new Error(`Channel ${name} not found.`);
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      SendMessages: null
    });
    console.log(`🔓 ${name} unlocked.`);
  } catch (err) {
    console.error(`❌ Failed to unlock ${name}:`, err);
  }
}

async function handleInteraction(interaction, client) {
  if (interaction.commandName !== 'restart') return;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  await interaction.reply({ content: '🔄 Restarting the bot... (locking channels)', ephemeral: true });

  await lockChannel(client, countingChannelId, '#counting');
  await lockChannel(client, citiesChainChannelId, '#cities-chain');

  process.exit(0);
}

function setup(client) {
  client.once('ready', async () => {
    await unlockChannel(client, countingChannelId, '#counting');
    await unlockChannel(client, citiesChainChannelId, '#cities-chain');
  });
}

module.exports = {
  commands,
  handleInteraction,
  setup
};

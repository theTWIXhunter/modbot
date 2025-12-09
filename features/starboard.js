const { EmbedBuilder } = require('discord.js');

module.exports = function(client) {
  const STARBOARD_CHANNELS = ['1384205905641472091', '1406676757213610134']; // #starboard old & new
  const MEMES_CHANNELS = ['1277135505741320285', '1406517772346982411'];     // #memes old & new
  const BOT_TESTING_CHANNEL = '1383752816006402159'; // #bot-testing
  const STAR_EMOJI = '⭐';

  // Map guilds to their corresponding starboard channels
  const guildToStarboard = {
    '1229827448754147349': '1384205905641472091', // old server -> old starboard
    '1406513249914191872': '1406676757213610134'  // new server -> new starboard
  };

  const thresholds = {
    [MEMES_CHANNELS[0]]: 3,
    [MEMES_CHANNELS[1]]: 3,
    [BOT_TESTING_CHANNEL]: 1
  };

  client.on('messageCreate', async (message) => {
    if (MEMES_CHANNELS.includes(message.channel.id) && !message.author.bot) {
      try {
        await message.react(STAR_EMOJI);
      } catch (err) {
        console.error('Failed to auto-react with ⭐:', err);
      }
    }
  });

  client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.emoji.name !== STAR_EMOJI) return;

    try {
      if (reaction.partial) await reaction.fetch();
      const message = reaction.message;

      const threshold = thresholds[message.channel.id] || 3;
      if (reaction.count < threshold) return;

      // Get the corresponding starboard channel based on the guild
      const starboardChannelId = guildToStarboard[message.guildId] || STARBOARD_CHANNELS[0];
      const starboardChannel = await client.channels.fetch(starboardChannelId).catch(() => null);
      if (!starboardChannel) return;

      const alreadyPosted = await starboardChannel.messages.fetch({ limit: 100 });
      if ([...alreadyPosted.values()].some(msg => msg.content.includes(message.id))) return;

      const jumpLink = `https://discord.com/channels/${message.guildId}/${message.channel.id}/${message.id}`;
      let description = message.content || '';
      let needsJumpNotice = false;

      // Trigger notice if content is empty
      if (!message.content) {
        needsJumpNotice = true;
      }

      // Check content length
      if (description.length > 4096) {
        description = description.slice(0, 4096 - 100); // Leave space for the notice
        needsJumpNotice = true;
      }

      // Check attachments
      const imageAttachment = [...message.attachments.values()].find(att =>
        att.contentType?.startsWith('image/') || att.height
      );
      const nonImageOrMultiple = message.attachments.size > 1 ||
        (message.attachments.size === 1 && !imageAttachment);

      if (nonImageOrMultiple) needsJumpNotice = true;

      if (needsJumpNotice) {
        description += `\n\n*Message continued but was too long, or has unsuported attachments\nSee original message here: [Jump to message](${jumpLink})*`;
      }

      const embed = new EmbedBuilder()
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setDescription(description || '‎')
        .setColor(16373760)
        .setFooter({
          text: `⭐ | #${message.channel.name}`
        });

      if (imageAttachment) {
        embed.setImage(imageAttachment.url);
      } else if (message.embeds.length > 0) {
        const embedImage = message.embeds[0].image?.url;
        if (embedImage) embed.setImage(embedImage);
      }

      await starboardChannel.send({
        embeds: [embed]
      });

    } catch (err) {
      console.error('Error handling star reaction:', err);
    }
  });
};

module.exports = (client) => {
  const STAFF_USER_ID = '1244004992046596232'; // the_twix_hunter
  const GUILD_IDS = ['1406513249914191872', '1229827448754147349']; // Both server IDs
  const MODERATOR_ROLE_ID = '1406519855347269693'; // Moderator role ID
  const pingTracker = new Map(); // Map<guildId, Map<userId, { count, lastPing }>>

  function isEmoji(str) {
    // Simple emoji regex (covers most cases)
    return /(?:\p{Emoji}|\p{Extended_Pictographic})/u.test(str);
  }

  client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Only act in the two guilds
    if (!GUILD_IDS.includes(message.guild?.id)) return;

    // Filter: 1-char messages that are not emoji
    if (message.content.length === 1 && !isEmoji(message.content)) {
      try {
        await message.delete();
      } catch (err) {
        // Ignore delete errors
      }
      return;
    }

    // Staff ping logic
    if (message.mentions.users.has(STAFF_USER_ID)) {
      // Exception: Allow moderators to ping staff without triggering the response
      if (message.member?.roles.cache.has(MODERATOR_ROLE_ID)) return;

      // Track pings per user per guild
      const guildId = message.guild.id;
      if (!pingTracker.has(guildId)) pingTracker.set(guildId, new Map());
      const userPings = pingTracker.get(guildId);
      const now = Date.now();
      const pingData = userPings.get(message.author.id) || { count: 0, lastPing: 0, timeout: false };

      // If user is timed out, ignore
      if (pingData.timeout && now - pingData.lastPing < 60_000) {
        try {
          await message.reply('You are temporarily muted for 1 minute due to having 2 staff pings within a few minutes.');
          await message.delete();
        } catch {}
        return;
      }

      // If last ping was more than 1 minute ago, reset count
      if (now - pingData.lastPing > 60_000) {
        pingData.count = 0;
        pingData.timeout = false;
      }
      pingData.count++;
      pingData.lastPing = now;

      if (pingData.count >= 2) {
        // Timeout for 1 minute using Discord's actual timeout feature
        pingData.timeout = true;
        userPings.set(message.author.id, pingData);
        try {
          // Discord timeout: set communication disabled until now + 1 minute
          await message.member.timeout?.(60_000, 'Excessive staff pings');
          await message.reply('You have been timed out for 1 minute due to excessive staff pings.');
          await message.delete();
        } catch {}
        return;
      }

      userPings.set(message.author.id, pingData);
      try {
        const reply = await message.reply("please don't ping staff! I run this server alone and have other things to do in life. Please have some patience");
        setTimeout(async () => {
          try {
            await reply.delete();
          } catch (deleteError) {}
        }, 3000);
      } catch (error) {
        // Ignore send errors
      }
    }
  });
};

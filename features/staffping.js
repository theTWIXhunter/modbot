module.exports = (client) => {
  const STAFF_USER_ID = '1244004992046596232'; // the_twix_hunter
  const TARGET_GUILD_ID = '1406513249914191872'; // Specific guild ID
  const MODERATOR_ROLE_ID = '1406519855347269693'; // Moderator role ID
  
  client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if message is in the target guild
    if (message.guild?.id !== TARGET_GUILD_ID) return;
    
    // Check if the staff member was mentioned
    if (message.mentions.users.has(STAFF_USER_ID)) {
      // Exception: Allow moderators to ping staff without triggering the response
      if (message.member?.roles.cache.has(MODERATOR_ROLE_ID)) return;
      try {
        const reply = await message.reply("please don't ping staff! I run this server alone and have other things to do in life. Please have some patience");
        
        // Delete both messages after 3 seconds
        setTimeout(async () => {
          try {
            //await message.delete();   //uncomment to delete user message, commented because deleting valid staff pings (eg. moderation requests) is something we can't do and it doesn't even solve anything as the message still ghost pings me anyway
            await reply.delete();
          } catch (deleteError) {
            console.error('Error deleting messages:', deleteError);
          }
        }, 3000);
      } catch (error) {
        console.error('Error sending staff ping reply:', error);
      }
    }
  });
};

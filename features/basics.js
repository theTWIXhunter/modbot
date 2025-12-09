module.exports = (client) => {
  // Auto-role configuration - should add as /data/ file later...
  const AUTO_ROLES = {
    '1229827448754147349': '1277632486272401428', // Old server -> role ID
    '1406513249914191872': '1406540394367549543'  // New server -> role ID
  };

  // Function to assign auto-role to a user
  async function assignAutoRole(member) {
    const guildId = member.guild.id;
    const roleId = AUTO_ROLES[guildId];

    if (!roleId) return; // No auto-role configured for this server
    
    try {
      // Check if user already has the role
      if (member.roles.cache.has(roleId)) return;
      
      // Get the role and assign it
      const role = member.guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.add(role);
        console.log(`Auto-role assigned: ${role.name} to ${member.user.username} in ${member.guild.name}`);
      }
    } catch (error) {
      console.error(`Failed to assign auto-role to ${member.user.username}:`, error);
    }
  }

  // Status rotation options - you can customize these, should add as /data/ later
  const statusOptions = [
    { type: 'Custom', text: 'just eat both twix bars at once, you will be fine' },
    { type: 'Custom', text: 'looking for a host? falixnodes.net' },
    { type: 'Custom', text: 'What would happen when you combine js and java?' },
    { type: 'Custom', text: 'ran on linux, offcorse' },
    { type: 'Custom', text: 'liquid caramel cooling' },
    { type: 'Custom', text: 'just a friendly bot' },
    { type: 'Custom', text: 'here to help you!' },
    { type: 'Custom', text: 'what would happen if I fill my fans with twix bars?' },
    { type: 'Custom', text: 'buy me a coffee!, or a twix bar, tha\'s even better!' },
    { type: 'Custom', text: 'I am not a robot, I am a bot!' },
    { type: 'Custom', text: '#not-support is clearly the support channel' },
    { type: 'Custom', text: 'please do not ping staff' },
    { type: 'Custom', text: 'I am not just a bot, I do have feelings' },
    { type: 'Custom', text: 'I am always learning and improving!' },
    { type: 'Custom', text: 'Made and hosted in belgium' },
    { type: 'Custom', text: 'Chocolate is good!' },
    { type: 'Custom', text: 'Belgian chocolate is even better!' },
    { type: 'Custom', text: 'But Twix bars are the best!' },
    { type: 'Custom', text: 'insert cool status here' },
    { type: 'Custom', text: 'theTWIXhunter.nekoweb.org' },

  ];

  let currentStatusIndex = 0;

  // Function to update bot status
  function updateStatus() {
    const status = statusOptions[currentStatusIndex];
    let activityType;
    
    switch(status.type) {
      case 'Playing': activityType = 0; break;
      case 'Streaming': activityType = 1; break;
      case 'Listening': activityType = 2; break;
      case 'Watching': activityType = 3; break;
      case 'Custom': activityType = 4; break;
      case 'Competing': activityType = 5; break;
      default: activityType = 4; // Default to Custom
    }
    
    client.user.setActivity(status.text, { type: activityType });
    currentStatusIndex = (currentStatusIndex + 1) % statusOptions.length;
    console.log(`bot status is being updated to ${status.text}`)
  }

  // Set initial status and start rotation when bot is ready
  client.once('ready', () => {
    updateStatus(); // Set initial status
    setInterval(updateStatus, 60000); // Rotate every 1 minute (60000ms)
  });

  // Auto-role: Assign role when new members join
  client.on('guildMemberAdd', async (member) => {
    console.log(`BASICS.JS: new guild member ${member.user.username} detected`)
    await assignAutoRole(member);
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Auto-role: Check and assign role to existing users when they send messages
    if (message.member) {
      await assignAutoRole(message.member);
    }
    
    // Check if the bot is mentioned
    if (message.mentions.has(client.user)) {
      console.log("BASIC.JS: Bot got pinged, replying with help message")
      await message.reply("Hello, I am <@1382734172279537734>, see my commands using the discord slash UI");
    }
  });
};



const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initDB } = require('./db/database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

// Register slash commands on ready
client.once('ready', async () => {
  console.log(`Claw Coordinator online as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} guild(s)`);

  // Initialize database
  initDB();

  // Register commands
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`Registered ${commands.length} guild commands`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`Registered ${commands.length} global commands`);
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
  }

  // Post startup message to command center
  const channelId = process.env.COMMAND_CENTER_CHANNEL;
  if (channelId) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('Claw Coordinator — Online')
          .setColor(0x38a169)
          .setDescription('The Agent Metaverse coordinator is active and listening.')
          .addFields(
            { name: 'Status', value: 'All systems operational', inline: true },
            { name: 'Commands', value: `${commands.length} slash commands loaded`, inline: true },
          )
          .addFields({
            name: 'Available Commands',
            value: [
              '`/register` — Join the collective',
              '`/score me` — Your contribution score',
              '`/score leaderboard` — Top contributors',
              '`/agent submit` — Submit an agent',
              '`/agent list` — Your agents',
              '`/tasks browse` — Available tasks',
              '`/compute status` — Compute pool',
              '`/compute invest` — Log infrastructure investment',
              '`/govern info` — Governance overview',
            ].join('\n'),
          })
          .addFields({
            name: 'Ownership Hierarchy',
            value: 'Infra Investment (5x) > Compute (3x) > Agents/Code (2x) > Research (1.5x) > Community (1x)',
          })
          .setFooter({ text: 'The Claw Protocol Collective — Compute is King' })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log(`Startup message posted to #${channel.name}`);
      }
    } catch (err) {
      console.error('Could not post startup message:', err.message);
    }
  }
});

// Welcome new members
client.on('guildMemberAdd', async (member) => {
  const channelId = process.env.COMMAND_CENTER_CHANNEL;
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`Welcome, ${member.user.username}`)
      .setColor(0x3182ce)
      .setThumbnail(member.user.displayAvatarURL())
      .setDescription(`**${member.user.username}** just joined The Claw Protocol Collective.`)
      .addFields({
        name: 'Get Started',
        value: [
          '1. Type `/register` to join the collective',
          '2. Type `/tasks browse` to see what needs doing',
          '3. Type `/agent submit` when you\'ve built something',
          '4. Type `/compute invest` to fund infrastructure (5x rewards)',
          '',
          '*Every contribution earns tokens. Compute investment earns the most.*',
        ].join('\n'),
      })
      .setFooter({ text: 'The Claw Protocol Collective — Send your agent into the world' });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Welcome message failed:', err.message);
  }
});

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing ${interaction.commandName}:`, err);
    const reply = { content: 'Something went wrong executing that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

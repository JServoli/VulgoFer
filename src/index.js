import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { commands, customIds } from "./commands.js";
import { config } from "./config.js";
import { startBirthdayScheduler } from "./birthdayScheduler.js";
import {
  enforceVoiceLock,
  leaveLockedVoiceChannel,
  startVoiceLock,
} from "./voiceLock.js";
import { loadServerStore, saveServerStore } from "./serverStore.js";
import { trackInitialVoiceStates, trackVoiceStateUpdate } from "./voiceRanking.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const commandMap = new Map(
  commands.map((command) => [command.data.name, command])
);

const voiceLeaveApprovalUserIds = new Set();
const polls = new Map();

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function formatVoiceLeaveApprovalStatus() {
  const approved = voiceLeaveApprovalUserIds.size;
  const required = config.voiceLeaveRequiredApprovals;
  const mentions = [...voiceLeaveApprovalUserIds].map((userId) => `<@${userId}>`);

  return [
    `Confirmacoes de saida da call: ${approved}/${required}.`,
    mentions.length ? `Admins que confirmaram: ${mentions.join(", ")}` : null,
    "O bot so sai quando admins diferentes completarem a quantidade exigida.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleButton(interaction) {
  if (interaction.customId.startsWith("poll:")) {
    const parts = interaction.customId.split(":");
    const optionIndex = Number(parts.pop());
    const pollId = parts.slice(1).join(":");
    const poll = polls.get(pollId);

    if (!poll) {
      await interaction.reply({
        content: "Essa votacao nao esta mais ativa.",
        ephemeral: true,
      });
      return;
    }

    poll.votes.set(interaction.user.id, optionIndex);

    const counts = poll.options.map((_, index) =>
      [...poll.votes.values()].filter((vote) => vote === index).length
    );
    const lines = poll.options.map((option, index) => `${option}: ${counts[index]} voto(s)`);

    await interaction.update({
      content: `Votacao: ${poll.question}\n${lines.join("\n")}`,
      components: interaction.message.components,
    });
    return;
  }

  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: "So administradores podem confirmar essa acao.",
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === customIds.confirmLeaveVoice) {
    voiceLeaveApprovalUserIds.add(interaction.user.id);

    if (voiceLeaveApprovalUserIds.size < config.voiceLeaveRequiredApprovals) {
      await interaction.update({
        content: formatVoiceLeaveApprovalStatus(),
        components: interaction.message.components,
      });
      return;
    }

    const left = await leaveLockedVoiceChannel(client);
    voiceLeaveApprovalUserIds.clear();

    await interaction.update({
      content: left
        ? "Saida liberada por 3 admins diferentes. A trava da call fica pausada por 60 segundos."
        : "Confirmado, mas o bot nao estava em uma call.",
      components: [],
    });
    return;
  }

  if (interaction.customId === customIds.confirmKickProtectedUser) {
    const store = await loadServerStore();
    store.counters.protectedKickAttempts += 1;
    await saveServerStore(store);

    const member = await interaction.guild.members.fetch(config.protectedUserId);
    await member.kick("Expulsao confirmada pelo botao do Baliau Thomossex.");

    await interaction.update({
      content: `${member.user.tag} foi expulso do servidor.`,
      components: [],
    });
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Baliau Thomossex conectado como ${readyClient.user.tag}`);
  trackInitialVoiceStates(client);
  startVoiceLock(client);
  startBirthdayScheduler(client);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  await trackVoiceStateUpdate(oldState, newState);

  if (oldState.member?.id !== client.user.id && newState.member?.id !== client.user.id) {
    return;
  }

  await enforceVoiceLock(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commandMap.get(interaction.commandName);
    if (!command) {
      return;
    }

    await command.execute(interaction, {
      polls,
      voiceLeaveApprovalUserIds,
      formatVoiceLeaveApprovalStatus,
    });
  } catch (error) {
    console.error(error);

    if (error.code === 10062) {
      return;
    }

    const response = {
      content: "Nao consegui executar essa acao agora.",
      ephemeral: true,
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    } catch (replyError) {
      console.error(replyError);
    }
  }
});

await client.login(config.token);

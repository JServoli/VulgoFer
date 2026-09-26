// ---------------------------------------------------------------------------
// VulgoFer - guarda da call, rodado pelo deploy.sh antes de reiniciar o bot.
//
// Se o bot sair de uma call onde esta sozinho, a call acaba e o tempo dela
// zera. Entao:
//   - bot numa call COM gente   -> avisa no RESTART_NOTICE_CHANNEL_ID marcando
//                                  quem esta la e libera o restart (exit 0)
//   - bot numa call SEM ninguem -> bloqueia o restart (exit 3)
//   - bot fora de call          -> nao ha call a perder, libera (exit 0)
// Qualquer erro sai com codigo != 0 e o deploy nao reinicia.
//
// FORCE_RESTART=1 libera mesmo com a call vazia (emergencia).
// ---------------------------------------------------------------------------
import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "../src/config.js";

const EXIT_EMPTY_CALL = 3;

if (!config.guildId || !config.restartNoticeChannelId) {
  console.error("[call-guard] DISCORD_GUILD_ID e RESTART_NOTICE_CHANNEL_ID precisam estar no .env.");
  process.exit(2);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

async function finish(code) {
  await client.destroy();
  process.exit(code);
}

setTimeout(() => {
  console.error("[call-guard] Discord nao respondeu em 30s.");
  process.exit(4);
}, 30_000).unref();

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(config.guildId);
    const me = await guild.members.fetchMe();
    const voiceChannel = me.voice.channel;

    if (!voiceChannel) {
      console.log("[call-guard] bot fora de call - restart liberado.");
      await finish(0);
      return;
    }

    const userIds = [...voiceChannel.members.values()]
      .filter((member) => !member.user.bot)
      .map((member) => member.id);

    if (!userIds.length) {
      if (process.env.FORCE_RESTART === "1") {
        console.log(`[call-guard] call "${voiceChannel.name}" vazia, mas FORCE_RESTART=1.`);
        await finish(0);
        return;
      }

      console.log(`[call-guard] ninguem na call "${voiceChannel.name}" com o bot - restart bloqueado.`);
      await finish(EXIT_EMPTY_CALL);
      return;
    }

    const channel = await client.channels.fetch(config.restartNoticeChannelId);
    await channel.send({
      content: `${userIds.map((id) => `<@${id}>`).join(" ")} vou reiniciar rapidinho pra atualizar, ja volto!`,
      allowedMentions: { users: userIds },
    });

    console.log(`[call-guard] ${userIds.length} pessoa(s) na call - aviso enviado, restart liberado.`);
    await finish(0);
  } catch (error) {
    console.error("[call-guard] erro:", error.message);
    await finish(1);
  }
});

client.login(config.token);

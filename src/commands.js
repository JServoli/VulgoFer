import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { loadBirthdayStore, parseBirthday, saveBirthdayStore } from "./birthdayStore.js";
import { config } from "./config.js";
import { joinLockedVoiceChannel } from "./voiceLock.js";
import { formatDuration, loadServerStore, saveServerStore } from "./serverStore.js";
import { getVoiceRanking } from "./voiceRanking.js";

export const customIds = {
  confirmKickProtectedUser: "protected-user:kick-confirm",
  confirmLeaveVoice: "voice-lock:leave-confirm",
  claimValorantRole: "valorant:claim-role",
};

function adminOnly(builder) {
  return builder.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

function canManageMessages(builder) {
  return builder.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
}

function canManageRoles(builder) {
  return builder.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);
}

function canManageNicknames(builder) {
  return builder.setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames);
}

function parseReminderDuration(input) {
  const match = input.trim().match(/^(\d+)\s*(s|m|h|d)$/i);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

function birthdaySortValue(birthday) {
  const now = new Date();
  const currentKey = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  return birthday.key >= currentKey ? birthday.key : `99-${birthday.key}`;
}

export const commands = [
  {
    data: new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Confere se o Baliau Thomossex esta online."),
    async execute(interaction) {
      await interaction.reply("Pong! Baliau Thomossex online.");
    },
  },
  {
    data: adminOnly(
      new SlashCommandBuilder()
        .setName("call")
        .setDescription("Controla a permanencia do bot na call configurada.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("sair")
            .setDescription("Abre uma votacao de admins para o bot sair da call.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("status")
            .setDescription("Mostra status da trava de call.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("puxar")
            .setDescription("Forca o bot a voltar para a call configurada.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("aprovadores")
            .setDescription("Mostra admins que ja aprovaram a saida da call.")
        )
    ),
    async execute(interaction, context) {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "sair") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(customIds.confirmLeaveVoice)
            .setLabel("Confirmar saida da call")
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
          content: `Pedido aberto. Sao necessarias ${config.voiceLeaveRequiredApprovals} confirmacoes de admins diferentes para liberar a saida da call.`,
          components: [row],
        });
        return;
      }

      if (subcommand === "status") {
        const guild = await interaction.client.guilds.fetch(config.guildId);
        const me = await guild.members.fetchMe();

        await interaction.reply({
          content: [
            `Call configurada: <#${config.voiceChannelId}>`,
            `Call atual: ${me.voice.channelId ? `<#${me.voice.channelId}>` : "fora de call"}`,
            `Trava ativa: ${config.voiceChannelId ? "sim" : "nao"}`,
            `Admins exigidos para sair: ${config.voiceLeaveRequiredApprovals}`,
          ].join("\n"),
          ephemeral: true,
        });
        return;
      }

      if (subcommand === "puxar") {
        await joinLockedVoiceChannel(interaction.client);
        await interaction.reply({
          content: `Voltei para <#${config.voiceChannelId}>.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: context.formatVoiceLeaveApprovalStatus(),
        ephemeral: true,
      });
    },
  },
  {
    data: adminOnly(
      new SlashCommandBuilder()
        .setName("alvo")
        .setDescription("Acoes contra o membro configurado.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("expulsar")
            .setDescription("Mostra o botao para expulsar o membro alvo.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("contador")
            .setDescription("Mostra quantas vezes tentaram expulsar o alvo.")
        )
    ),
    async execute(interaction) {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "contador") {
        const store = await loadServerStore();
        await interaction.reply({
          content: `Tentativas de expulsar <@${config.protectedUserId}>: ${store.counters.protectedKickAttempts}.`,
          ephemeral: true,
        });
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customIds.confirmKickProtectedUser)
          .setLabel("Expulsar membro alvo")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: `Clique para expulsar <@${config.protectedUserId}> do servidor.`,
        components: [row],
        ephemeral: true,
      });
    },
  },
  {
    data: adminOnly(
      new SlashCommandBuilder()
        .setName("aniversario")
        .setDescription("Gerencia aniversarios dos participantes.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("definir")
            .setDescription("Define o aniversario de um participante.")
            .addUserOption((option) =>
              option
                .setName("participante")
                .setDescription("Participante que faz aniversario.")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("data")
                .setDescription("Data no formato DD/MM.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remover")
            .setDescription("Remove o aniversario de um participante.")
            .addUserOption((option) =>
              option
                .setName("participante")
                .setDescription("Participante que tera o aniversario removido.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("listar")
            .setDescription("Lista os aniversarios cadastrados.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("proximos")
            .setDescription("Lista os proximos aniversarios.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("hoje")
            .setDescription("Mostra aniversariantes de hoje.")
        )
    ),
    async execute(interaction) {
      const subcommand = interaction.options.getSubcommand();
      const store = await loadBirthdayStore();

      if (subcommand === "definir") {
        const user = interaction.options.getUser("participante", true);
        const birthday = parseBirthday(interaction.options.getString("data", true));

        if (!birthday) {
          await interaction.reply({
            content: "Data invalida. Use o formato DD/MM, por exemplo `14/05`.",
            ephemeral: true,
          });
          return;
        }

        store.birthdays[user.id] = {
          key: birthday.key,
          label: birthday.label,
        };
        await saveBirthdayStore(store);

        await interaction.reply({
          content: `Aniversario de ${user} definido para ${birthday.label}.`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === "remover") {
        const user = interaction.options.getUser("participante", true);
        delete store.birthdays[user.id];
        await saveBirthdayStore(store);

        await interaction.reply({
          content: `Aniversario de ${user} removido.`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === "proximos") {
        const lines = Object.entries(store.birthdays)
          .sort(([, a], [, b]) => birthdaySortValue(a).localeCompare(birthdaySortValue(b)))
          .slice(0, 10)
          .map(([userId, birthday]) => `- <@${userId}>: ${birthday.label}`);

        await interaction.reply({
          content: lines.length
            ? `Proximos aniversarios:\n${lines.join("\n")}`
            : "Nenhum aniversario cadastrado ainda.",
          ephemeral: true,
        });
        return;
      }

      if (subcommand === "hoje") {
        const now = new Date();
        const key = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(
          now.getDate()
        ).padStart(2, "0")}`;
        const users = Object.entries(store.birthdays)
          .filter(([, birthday]) => birthday.key === key)
          .map(([userId]) => `<@${userId}>`);

        await interaction.reply({
          content: users.length
            ? `Hoje tem aniversario de: ${users.join(", ")}`
            : "Hoje nao tem aniversariante cadastrado.",
          ephemeral: true,
        });
        return;
      }

      const lines = Object.entries(store.birthdays).map(
        ([userId, birthday]) => `- <@${userId}>: ${birthday.label}`
      );

      await interaction.reply({
        content: lines.length
          ? `Aniversarios cadastrados:\n${lines.join("\n")}`
          : "Nenhum aniversario cadastrado ainda.",
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("perfil")
      .setDescription("Mostra informacoes de um membro.")
      .addUserOption((option) =>
        option.setName("membro").setDescription("Membro para consultar.").setRequired(true)
      ),
    async execute(interaction) {
      const user = interaction.options.getUser("membro", true);
      const member = await interaction.guild.members.fetch(user.id);
      const birthdays = await loadBirthdayStore();
      const birthday = birthdays.birthdays[user.id]?.label ?? "nao cadastrado";
      const joinedAt = member.joinedAt
        ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>`
        : "desconhecido";

      await interaction.reply({
        content: [
          `Perfil de ${user}`,
          `ID: ${user.id}`,
          `Entrou no servidor: ${joinedAt}`,
          `Cargo mais alto: ${member.roles.highest}`,
          `Aniversario: ${birthday}`,
        ].join("\n"),
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("zoar")
      .setDescription("Manda uma zoeira leve para alguem.")
      .addUserOption((option) =>
        option.setName("membro").setDescription("Alvo da zoeira.").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("texto").setDescription("Texto da zoeira.").setRequired(false)
      ),
    async execute(interaction) {
      const user = interaction.options.getUser("membro", true);
      const text =
        interaction.options.getString("texto") ??
        "voce foi oficialmente convocado para refletir sobre suas escolhas.";

      await interaction.reply(`${user}, ${text}`);
    },
  },
  {
    data: adminOnly(
      new SlashCommandBuilder()
        .setName("zoarprivado")
        .setDescription("Manda uma zoeira privada para alguem.")
        .addUserOption((option) =>
          option.setName("membro").setDescription("Membro alvo.").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("motivo")
            .setDescription("Motivo falso da zoeira.")
            .setRequired(false)
        )
    ),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });

      const user = interaction.options.getUser("membro", true);
      const reason =
        interaction.options.getString("motivo") ??
        "conduta altamente suspeita detectada pelo Baliau Thomossex";

      try {
        await user.send(
          [
            "ALERTA DO BALIAU THOMOSSEX",
            "",
            "Voce foi banido do servidor.",
            "",
            "Motivo:",
            `${reason}. A auditoria encontrou niveis criticos de atividade suspeita, incluindo mas nao limitado a: logar no servidor com energia de protagonista secundario, emitir opinioes em horario comercial, falhar no teste do bom senso, carregar aura de quem clica em aceitar cookies sem ler, e acumular evidencias suficientes para ativar o protocolo OMAGA.`,
            "",
            "Penalidade aplicada: banimento simbolico, perda temporaria do direito de falar 'literalmente eu' e encaminhamento automatico para o setor de memes internos.",
          ].join("\n")
        );

        await interaction.editReply({
          content: `Zoeira privada enviada para ${user}.`,
        });
      } catch {
        await interaction.editReply({
          content: `Nao consegui mandar DM para ${user}. A pessoa pode estar com mensagens privadas bloqueadas.`,
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("ranking-call")
      .setDescription("Mostra quem passou mais tempo em call."),
    async execute(interaction) {
      const ranking = await getVoiceRanking(10);
      const lines = ranking.map(
        (entry) => `${entry.position}. <@${entry.userId}> - ${entry.label}`
      );

      await interaction.reply(lines.length ? `Ranking de call:\n${lines.join("\n")}` : "Ainda nao ha tempo de call registrado.");
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("votacao")
      .setDescription("Cria uma votacao simples com botoes.")
      .addStringOption((option) =>
        option.setName("pergunta").setDescription("Pergunta da votacao.").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("opcao1").setDescription("Primeira opcao.").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("opcao2").setDescription("Segunda opcao.").setRequired(true)
      ),
    async execute(interaction, context) {
      const pollId = `${Date.now()}:${interaction.id}`;
      const question = interaction.options.getString("pergunta", true);
      const options = [
        interaction.options.getString("opcao1", true),
        interaction.options.getString("opcao2", true),
      ];

      context.polls.set(pollId, {
        question,
        options,
        votes: new Map(),
      });

      const row = new ActionRowBuilder().addComponents(
        options.map((option, index) =>
          new ButtonBuilder()
            .setCustomId(`poll:${pollId}:${index}`)
            .setLabel(option.slice(0, 80))
            .setStyle(index === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        )
      );

      await interaction.reply({
        content: `Votacao: ${question}\n0 votos em cada opcao.`,
        components: [row],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("lembrete")
      .setDescription("Cria um lembrete simples.")
      .addStringOption((option) =>
        option.setName("texto").setDescription("Texto do lembrete.").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("tempo").setDescription("Tempo: 10s, 5m, 2h ou 1d.").setRequired(true)
      ),
    async execute(interaction) {
      const text = interaction.options.getString("texto", true);
      const duration = parseReminderDuration(interaction.options.getString("tempo", true));

      if (!duration || duration > 7 * 24 * 60 * 60 * 1000) {
        await interaction.reply({
          content: "Tempo invalido. Use algo como `10s`, `5m`, `2h` ou `1d` ate no maximo 7d.",
          ephemeral: true,
        });
        return;
      }

      setTimeout(() => {
        interaction.channel
          ?.send(`${interaction.user}, lembrete: ${text}`)
          .catch(console.error);
      }, duration);

      await interaction.reply({
        content: `Lembrete criado para daqui ${formatDuration(duration)}.`,
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("frase")
      .setDescription("Gerencia frases do servidor.")
      .addSubcommand((subcommand) =>
        subcommand.setName("sortear").setDescription("Manda uma frase aleatoria.")
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("adicionar")
          .setDescription("Adiciona uma frase.")
          .addStringOption((option) =>
            option.setName("texto").setDescription("Frase para salvar.").setRequired(true)
          )
      ),
    async execute(interaction) {
      const subcommand = interaction.options.getSubcommand();
      const store = await loadServerStore();

      if (subcommand === "adicionar") {
        const text = interaction.options.getString("texto", true);
        store.phrases.push({
          text,
          authorId: interaction.user.id,
          createdAt: new Date().toISOString(),
        });
        await saveServerStore(store);

        await interaction.reply({
          content: "Frase adicionada.",
          ephemeral: true,
        });
        return;
      }

      if (!store.phrases.length) {
        await interaction.reply("Ainda nao tem frase cadastrada.");
        return;
      }

      const phrase = store.phrases[Math.floor(Math.random() * store.phrases.length)];
      await interaction.reply(phrase.text);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("valorant")
      .setDescription("Acoes para jogar Valorant.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("cargo")
          .setDescription("Manda o botao para pegar o cargo Valorant.")
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("chamar")
          .setDescription("Chama no privado todo mundo com o cargo Valorant.")
      ),
    async execute(interaction) {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "cargo") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(customIds.claimValorantRole)
            .setLabel("Pegar cargo Valorant")
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
          content: `Clique no botao para ganhar o cargo <@&${config.valorantRoleId}>.`,
          components: [row],
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const members = await interaction.guild.members.fetch();
      const valorantMembers = members.filter(
        (member) => !member.user.bot && member.roles.cache.has(config.valorantRoleId)
      );

      if (!valorantMembers.size) {
        await interaction.editReply("Nao encontrei ninguem com o cargo Valorant.");
        return;
      }

      let sent = 0;
      let failed = 0;

      for (const member of valorantMembers.values()) {
        try {
          await member.send("VAMO JOGAR VAVA - VAMO JOGAR VAVA - VAMO JOGAR VAVA");
          sent += 1;
        } catch {
          failed += 1;
        }
      }

      await interaction.editReply(
        `Chamei ${sent} pessoa(s) com o cargo Valorant no privado.` +
          (failed ? ` Nao consegui mandar para ${failed}.` : "")
      );
    },
  },
  {
    data: canManageNicknames(
      new SlashCommandBuilder()
        .setName("apelido")
        .setDescription("Muda o apelido de um membro.")
        .addUserOption((option) =>
          option.setName("membro").setDescription("Membro alvo.").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("texto").setDescription("Novo apelido.").setRequired(true)
        )
    ),
    async execute(interaction) {
      const user = interaction.options.getUser("membro", true);
      const nickname = interaction.options.getString("texto", true);
      const member = await interaction.guild.members.fetch(user.id);

      await member.setNickname(nickname, `Alterado por ${interaction.user.tag}`);
      await interaction.reply({
        content: `Apelido de ${user} alterado para ${nickname}.`,
        ephemeral: true,
      });
    },
  },
  {
    data: canManageMessages(
      new SlashCommandBuilder()
        .setName("limpar")
        .setDescription("Apaga mensagens recentes do canal.")
        .addIntegerOption((option) =>
          option
            .setName("quantidade")
            .setDescription("Quantidade entre 1 e 100.")
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
    ),
    async execute(interaction) {
      if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: "Esse comando precisa ser usado em canal de texto.",
          ephemeral: true,
        });
        return;
      }

      const amount = interaction.options.getInteger("quantidade", true);
      const deleted = await interaction.channel.bulkDelete(amount, true);

      await interaction.reply({
        content: `Apaguei ${deleted.size} mensagens recentes.`,
        ephemeral: true,
      });
    },
  },
  {
    data: canManageRoles(
      new SlashCommandBuilder()
        .setName("cargo")
        .setDescription("Gerencia cargos de membros.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("dar")
            .setDescription("Da um cargo para um membro.")
            .addUserOption((option) =>
              option.setName("membro").setDescription("Membro alvo.").setRequired(true)
            )
            .addRoleOption((option) =>
              option.setName("cargo").setDescription("Cargo para dar.").setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remover")
            .setDescription("Remove um cargo de um membro.")
            .addUserOption((option) =>
              option.setName("membro").setDescription("Membro alvo.").setRequired(true)
            )
            .addRoleOption((option) =>
              option.setName("cargo").setDescription("Cargo para remover.").setRequired(true)
            )
        )
    ),
    async execute(interaction) {
      const subcommand = interaction.options.getSubcommand();
      const user = interaction.options.getUser("membro", true);
      const role = interaction.options.getRole("cargo", true);
      const member = await interaction.guild.members.fetch(user.id);

      if (subcommand === "dar") {
        await member.roles.add(role, `Cargo dado por ${interaction.user.tag}`);
        await interaction.reply({
          content: `Cargo ${role} dado para ${user}.`,
          ephemeral: true,
        });
        return;
      }

      await member.roles.remove(role, `Cargo removido por ${interaction.user.tag}`);
      await interaction.reply({
        content: `Cargo ${role} removido de ${user}.`,
        ephemeral: true,
      });
    },
  },
];

export const commandData = commands.map((command) => command.data.toJSON());

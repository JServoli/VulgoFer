# Baliau Thomossex

Bot do Discord do projeto VulgoFer.

## Permissoes e conexoes

O bot usa comandos slash, entao as conexoes necessarias sao:

- Gateway intents: `Guilds` e `GuildVoiceStates`
- OAuth2 scopes: `bot` e `applications.commands`
- Permissoes do bot: `View Channels`, `Send Messages`, `Kick Members`, `Mention Everyone`, `Connect`, `Speak`, `Manage Messages`, `Manage Nicknames` e `Manage Roles`

URL de convite:

```text
https://discord.com/oauth2/authorize?client_id=1504613301995180052&permissions=405941250&integration_type=0&scope=bot+applications.commands
```

Esse link abre normalmente no Discord pelo navegador.

## Configuracao

1. Crie uma aplicacao em <https://discord.com/developers/applications>.
2. Na aba **Bot**, crie o bot e copie o token.
3. Na aba **OAuth2**, use a URL acima para adicionar o bot ao servidor.
4. Copie `.env.example` para `.env` e preencha:

```env
DISCORD_TOKEN=token_do_bot
DISCORD_CLIENT_ID=id_do_discord
DISCORD_GUILD_ID=id_do_servidor
DISCORD_VOICE_CHANNEL_ID=id_da_call
DISCORD_ANNOUNCEMENT_CHANNEL_ID=id_do_chat
RANDOM_MESSAGE_CHANNEL_ID=id_do_chat
RANDOM_MESSAGE_TEXT="O Baliau é gay"
BIRTHDAY_ANNOUNCEMENT_CHANNEL_ID=id_do_chat
UPDATE_LOG_CHANNEL_ID=769408368762028062
VALORANT_ROLE_ID=id_do_cargo
VOICE_LEAVE_REQUIRED_APPROVALS=3
```

## Rodando

```bash
npm install
npm run deploy:commands
npm start
```

Se `DISCORD_GUILD_ID` estiver preenchido, os comandos sao publicados apenas no servidor de teste. Sem ele, os comandos ficam globais e podem demorar para aparecer.

## Comandos

- `/ping`: confere se o bot esta online.
- `/call sair`: abre uma votacao; o bot so sai depois de 3 administradores diferentes confirmarem no botao.
- `/call status`: mostra onde o bot esta e se a trava esta ativa.
- `/call puxar`: forca o bot a voltar para a call configurada.
- `/call aprovadores`: mostra admins que ja aprovaram a saida.
- `/alvo expulsar`: mostra um botao para expulsar o usuario `338809624474157056`.
- `/alvo contador`: mostra quantas tentativas de expulsao foram feitas.
- `/aniversario definir participante data`: define aniversario no formato `DD/MM`.
- `/aniversario listar`: lista aniversarios cadastrados.
- `/aniversario proximos`: lista os proximos aniversarios.
- `/aniversario hoje`: mostra os aniversariantes do dia.
- `/aniversario remover participante`: remove aniversario cadastrado.
- `/perfil membro`: mostra informacoes de um membro.
- `/zoar membro texto`: manda uma zoeira leve.
- `/zoarprivado membro motivo`: manda uma zoeira privada falsa de banimento.
- `/ranking-call`: mostra quem passou mais tempo em call.
- `/votacao pergunta opcao1 opcao2`: cria votacao com botoes.
- `/lembrete texto tempo`: cria lembrete temporario, como `10s`, `5m`, `2h` ou `1d`.
- `/frase adicionar texto`: salva uma frase.
- `/frase sortear`: manda uma frase aleatoria.
- `/apelido membro texto`: muda apelido de um membro.
- `/limpar quantidade`: apaga mensagens recentes.
- `/cargo dar membro cargo`: da um cargo para um membro.
- `/cargo remover membro cargo`: remove um cargo de um membro.

Para expulsar o membro alvo, o cargo do bot precisa estar acima do cargo dele na hierarquia do servidor.
Para alterar cargos e apelidos, o cargo do bot tambem precisa estar acima dos cargos envolvidos.

Enquanto o processo estiver rodando, o bot tenta voltar para a call configurada se for movido ou desconectado. Se o computador desligar ou o processo encerrar, o bot cai porque esta hospedado localmente.

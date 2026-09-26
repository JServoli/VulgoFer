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
BIRTHDAY_ANNOUNCEMENT_CHANNEL_ID=id_do_chat
UPDATE_LOG_CHANNEL_ID=769408368762028062
VOICE_MODERATION_LOG_CHANNEL_ID=769408368762028062
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

## Hospedagem (Oracle Cloud Always Free)

O bot roda 24/7 numa VM da Oracle Cloud, gerenciado pelo systemd.

| Item | Valor |
| --- | --- |
| Instancia | `vulgofer-bot` (Ubuntu 22.04) |
| Shape | `VM.Standard.E2.1.Micro` - 1 OCPU / 1 GB (Always Free) |
| Regiao | `sa-saopaulo-1` (Brazil East) |
| Servico | `vulgofer-bot.service` |
| Deploy | `scripts/deploy.sh` - pull do GitHub + restart |

### Primeira instalacao

```bash
ssh ubuntu@<ip-da-vm>
curl -fsSL https://raw.githubusercontent.com/JServoli/VulgoFer/main/scripts/setup-vm.sh | bash
nano ~/VulgoFer/.env        # preencher o DISCORD_TOKEN
sudo systemctl restart vulgofer-bot
```

O `setup-vm.sh` e idempotente: instala o Node 20, cria 1 GB de swap (a micro tem so 1 GB de RAM),
clona o repositorio, instala as dependencias, registra os comandos slash e habilita o servico no boot.

### Operacao

```bash
sudo systemctl status vulgofer-bot      # estado atual
journalctl -u vulgofer-bot -f           # logs ao vivo
journalctl -u vulgofer-bot -n 100       # ultimos 100 eventos
bash ~/VulgoFer/scripts/deploy.sh       # atualizar para o ultimo commit
```

### Guarda da call

O `deploy.sh` so reinicia o bot se houver alguem na call junto com ele: se o bot sair de uma call vazia, a call acaba e o tempo dela zera.
Antes do restart, o `scripts/call-guard.js` avisa no `RESTART_NOTICE_CHANNEL_ID` marcando quem esta na call.
Com a call vazia o codigo e atualizado mas o restart fica pendente (`.deployed-rev` guarda a versao que esta rodando) e e tentado de novo na proxima execucao.
Emergencia: `FORCE_RESTART=1 bash scripts/deploy.sh`.

O tempo de call do `/ranking-call` e salvo a cada 5 minutos e no desligamento, entao restart ou queda nao apagam mais as sessoes em andamento.

### Deploy automatico (opcional)

```bash
sudo systemctl enable --now vulgofer-update.timer
```

A VM passa a checar o GitHub a cada 10 minutos e se atualiza sozinha quando aparece commit novo na `main`.
O `npm ci` e o registro de comandos slash so rodam quando os arquivos correspondentes mudaram.
O `git pull --ff-only` garante que uma edicao feita direto na VM nunca seja sobrescrita em silencio:
o deploy falha e avisa, em vez de apagar o trabalho.

### Resiliencia

- `Restart=always` - o systemd sobe o bot de novo se o processo morrer.
- `WantedBy=multi-user.target` - o bot volta sozinho depois de um reboot da VM.
- `MemoryHigh=500M` / `MemoryMax=800M` - o bot nunca engole a VM inteira.
- Swap de 1 GB - margem para picos de memoria do Node.

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
- `/wishlist adicionar produto`: monitora o preco de um produto e posta os melhores precos atuais no canal da wishlist.
- `/wishlist listar`: mostra os produtos que voce monitora.
- `/wishlist remover item`: para de monitorar um produto (numero do `/wishlist listar`).

### Wishlist / radar de promocoes

Os precos vem do [Zoom](https://www.zoom.com.br), comparador de lojas brasileiras (`src/priceSource.js` le o JSON `__NEXT_DATA__` das paginas, sem dependencia extra).
O pedido fica salvo em `data/wishlist.json` (produto -> usuarios). A cada `WISHLIST_CHECK_INTERVAL_MINUTES` o bot confere os produtos de novo e, se o menor preco cair pelo menos `WISHLIST_MIN_DROP_PERCENT`%, avisa no `WISHLIST_CHANNEL_ID` marcando quem monitora, com o link de compra.
Se o Zoom mudar o layout, o log mostra `__NEXT_DATA__ nao encontrado` e so o `priceSource.js` precisa de ajuste.

Para expulsar o membro alvo, o cargo do bot precisa estar acima do cargo dele na hierarquia do servidor.
Para alterar cargos e apelidos, o cargo do bot tambem precisa estar acima dos cargos envolvidos.

Enquanto o processo estiver rodando, o bot tenta voltar para a call configurada se for movido ou desconectado. O servico roda em VM com `Restart=always`, entao ele volta sozinho depois de uma queda do processo ou de um reboot da maquina.

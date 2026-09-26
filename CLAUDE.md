# VulgoFer - contexto do projeto

Bot do Discord "Baliau Thomossex". Node >= 20, ESM, discord.js v14.

## Estrutura

- `src/index.js` - cliente, eventos e roteamento de interacoes
- `src/commands.js` - definicao e handlers dos slash commands
- `src/config.js` - leitura do `.env`
- `src/deploy-commands.js` - registra os slash commands na API do Discord
- `src/*Store.js` - persistencia em arquivo (`data/`, fora do git)
- `src/priceSource.js` - busca de precos no Zoom (scraping do `__NEXT_DATA__`)
- `src/wishlistMonitor.js` - relatorio da wishlist e loop de checagem de precos
- `deploy/` - units do systemd
- `scripts/setup-vm.sh` - instalacao idempotente da VM
- `scripts/deploy.sh` - pull do GitHub + restart do servico (passa pelo guarda da call)
- `scripts/call-guard.js` - libera o restart so com gente na call e avisa antes

## Producao

O bot roda 24/7 numa VM Ubuntu 22.04 na Oracle Cloud (Always Free,
`VM.Standard.E2.1.Micro`, regiao `sa-saopaulo-1`), sob o servico systemd
`vulgofer-bot.service`, em `/home/ubuntu/VulgoFer`.

O IP e as credenciais de acesso ficam fora do repositorio: consulte o console
da OCI ou o arquivo local `.infra.local` (nao versionado).

Operacao na VM:

```bash
sudo systemctl status vulgofer-bot     # estado
journalctl -u vulgofer-bot -f          # logs ao vivo
bash ~/VulgoFer/scripts/deploy.sh      # atualizar para o ultimo commit
```

## Regras de trabalho

- Segredo nunca entra em codigo, README ou log: sempre `.env`, com espelho em `.env.example`.
- IP, hostname e caminho absoluto de maquina nao vao para o repositorio.
- IDs de canal, cargo e usuario devem vir do `.env`. Hoje `src/config.js` ainda tem
  fallback chumbado (canais de log, `valorantRoleId`, `protectedUserId`) - migrar.
- Mexeu no bot, reinicie o servico e confira o `journalctl` antes de dar por pronto.
- Restart em producao so via `scripts/deploy.sh`: o `scripts/call-guard.js` so libera com alguem na call
  junto com o bot (call vazia + bot saindo = a call acaba e o tempo dela zera) e antes avisa no
  `RESTART_NOTICE_CHANNEL_ID` marcando quem esta la. Call vazia = restart adiado para a proxima execucao.
- Diretorio raiz dos projetos na maquina local: `J:\Projetos`.
- Ao concluir qualquer alteracao de codigo, pergunte:
  "Deseja fazer um commit automático dessa atualização?"

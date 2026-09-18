# Instalar o Codexbot no Mac

Uma linha no **Terminal do macOS**, com seu usuário normal:

```sh
curl -fsSL https://raw.githubusercontent.com/10K-Digital/codexbot/main/install.sh | bash
```

A linha baixa e executa o instalador público do repositório oficial. Ele acompanha a versão de `main`. Leia o script antes de executar se quiser conferir exatamente o que será feito. Não use `sudo` na linha inteira. O Homebrew pode solicitar a senha do macOS no próprio fluxo; o login do ChatGPT é concluído por você no navegador. Uma linha inicia o processo, mas essas confirmações continuam sendo necessárias.

## O que acontece

1. Confere macOS e usuário, procura Node.js 22+, npm, Git, Google Chrome e Codex.
2. Instala dependências ausentes com Homebrew, usando seu instalador oficial quando necessário. Se não encontrar Codex, instala o pacote oficial `@openai/codex` em `~/.local/share/codexbot/tools`, sem `sudo npm`.
3. Confirma a autenticação **com ChatGPT**. Se houver autenticação por chave de API, para e pede que você troque o modo manualmente, sem apagar credenciais. Variáveis de chave de API não são transferidas para o serviço.
4. Clona o código em `~/dev/codexbot`, ou atualiza o checkout previamente registrado somente por fast-forward. Recusa outro repositório, branch diferente de `main`, alterações locais e divergências; nunca usa reset ou descarta edições.
5. Executa `npm ci`, `npm run setup` e `npm test`. O setup é aditivo; uma instalação nova recebe apenas o General Manager padrão e as skills nativas do produto.
6. Confere a instalação e o LaunchAgent. Uma atualização recusa tarefas enfileiradas, em execução ou aguardando. Verifica o estado em disco e, com o serviço carregado, também pela API local autenticada. Interrompe o serviço e confere novamente antes de copiar arquivos.
7. Faz backup privado, preserva dados existentes e instala o serviço do usuário. Confere `/health` e a conexão do Codex, então abre `http://127.0.0.1:4320/connect` (ou a porta configurada).

O Mac precisa estar ligado, conectado e com o usuário logado. O serviço inicia no login, não antes dele. Algumas ferramentas precisam da área de trabalho desbloqueada. Use uma versão do macOS compatível com as dependências atuais; o instalador não contorna os requisitos do Homebrew, Node ou Chrome. O acesso ao Codex e seus limites dependem da conta/assinatura ChatGPT. Não há instalação de modelo de inferência local nem promessa de uso ilimitado.

## Baixar, ler e só depois executar

```sh
curl -fSL https://raw.githubusercontent.com/10K-Digital/codexbot/main/install.sh -o /tmp/codexbot-install.sh
less /tmp/codexbot-install.sh
bash /tmp/codexbot-install.sh
```

Se o download falhar, não execute um arquivo antigo que já estava nesse caminho. Para auditoria reproduzível, substitua `main` pelo SHA que você revisou ao baixar o script; o checkout instalado continua acompanhando `main`. O instalador não oferece ainda instalação de uma versão fixada. Homebrew e npm também baixam suas próprias dependências.

Opções (após baixar o arquivo):

```sh
# Apenas informa requisitos; não baixa, autentica, instala nem altera o serviço.
bash /tmp/codexbot-install.sh --check

# Escolhe o checkout oficial, separado da pasta de dados instalada.
bash /tmp/codexbot-install.sh --source "$HOME/dev/codexbot"

# Não abre o navegador ao terminar.
bash /tmp/codexbot-install.sh --no-open

# Também instala uv e a transcrição local opcional com faster-whisper.
bash /tmp/codexbot-install.sh --with-local-voice
```

`--with-local-voice` baixa Python, bibliotecas e o modelo de transcrição. Não é necessário para a voz em tempo real experimental, que depende do Codex e do acesso da conta. Para passar opções pela linha curta, use `| bash -s -- --no-open`, por exemplo.

## Onde ficam código, dados e serviço

| Item | Local padrão |
| --- | --- |
| Checkout atualizado | `~/dev/codexbot` |
| Registro do checkout escolhido | `~/.config/codexbot/source` |
| Aplicação e dados instalados | `~/Library/Application Support/Codexbot` |
| Descritor da instalação | `.private/install.json` no checkout |
| Backup antes da instalação/atualização | `.private/backups/<data>/` no checkout |
| Serviço | `one.codexbot.service` |
| LaunchAgent | `~/Library/LaunchAgents/one.codexbot.service.plist` |
| Logs privados | `.runtime/service.log` e `.runtime/service-error.log` na instalação |

O backup contém a instalação inteira existente, incluindo `.private`, `.runtime`, perfis de navegador, e cópias do plist e descritor quando presentes. A pasta tem permissão 700 e fica fora do Git. Pode ocupar bastante espaço; remova backups antigos apenas após verificar sua recuperação. O instalador não apaga backups automaticamente. Credenciais gerenciadas pelo Codex fora da instalação não são copiadas para o backup.

O descritor salva o caminho e o identificador reais; instalações personalizadas continuam nesses destinos. Se uma pasta de dados já existe, mas o checkout escolhido não tem descritor, o instalador para em vez de assumir que pertence a você. Use o checkout original com `--source`. A adoção explícita é possível com `CODEXBOT_HOME` e `CODEXBOT_SERVICE_LABEL`, depois de conferir caminhos e dados:

```sh
CODEXBOT_HOME="$HOME/Library/Application Support/Codexbot" \
CODEXBOT_SERVICE_LABEL=one.codexbot.service \
bash /tmp/codexbot-install.sh --source "$HOME/dev/codexbot"
```

`EQUIPE_CODEX` permite indicar o executável do Codex; `CODEX_HOME` seleciona seu diretório de configuração quando necessário. `CODEXBOT_PORT` e o alias legado `EQUIPE_PORT` alteram a porta. O serviço preserva seu ambiente anterior e os valores explicitamente selecionados. Não use outra conta ou copie credenciais de terceiros.

## Atualizar e resolver falhas

Execute novamente a linha inicial. Ela reutiliza o checkout registrado. Para instalações antigas, indique o checkout original com `--source`. Não use um checkout temporário/worktree como destino do instalador: ele exige um checkout normal de `main` e conserva ali o descritor e os backups.

- **Tarefas ativas:** termine ou cancele pela interface, aguarde a conclusão e tente novamente. Não edite o estado para ocultá-las.
- **Código com alterações:** revise e preserve seu trabalho. O instalador não faz stash, merge de divergências ou reset. Não tente contornar isso apagando a pasta de dados.
- **Porta ocupada ou serviço de outra instalação:** confira o descritor e o plist existente antes de escolher outro destino. Não encerre um processo desconhecido.
- **Homebrew ou ferramentas Apple incompletos:** conclua as instruções exibidas por eles e execute novamente. As dependências já instaladas serão reaproveitadas.
- **Login/health falhou:** confira a autenticação do executável selecionado (`codex login status`, ou seu caminho real) e os logs privados. Não publique logs/credenciais. Em modo API key, use `codex login` e escolha sua conta ChatGPT antes de tentar novamente.
- **Instalador interrompido:** confira se ainda há um processo instalador em execução antes de remover `.private/installer.lock` manualmente. Um lock existente impede duas atualizações simultâneas pelo mesmo checkout.

Se a falha ocorreu antes de começar a instalação, o wrapper tenta reabrir o serviço anterior. Depois de tentar ativar a nova versão, mantém os arquivos e o backup para inspeção: **não restaura um estado antigo automaticamente**, porque tarefas agendadas podem já ter executado ações externas. Para recuperar, pare o serviço correto, preserve uma cópia do estado atual, revise tarefas e possíveis efeitos externos, e só então restaure a cópia de `installation/`, o `service.plist` e o `install.json` nos caminhos registrados em `plan.json`. Recarregue o plist e confira `/health`. Não reproduza tarefas interrompidas sem revisão.

O comando de nível baixo `npm run install-service` continua disponível para manutenção supervisionada, mas não inclui os checks de tarefas e backup do wrapper. Após setup/testes manuais, prefira `node scripts/install-local.mjs --bootstrap` para essa proteção.

## Celular e acesso remoto

O instalador abre apenas a ponte local. Não habilita VPN, túnel público, Tailscale Funnel nem publica a interface. Depois da instalação, siga [como funciona a ponte](mac-bridge.md) e [acesso remoto](remote-access.md) para Tailscale privado, SSH ou uma configuração pública com autenticação. A PWA, notificações e microfone remoto dependem de HTTPS e das permissões do navegador.

Referências: [Homebrew](https://brew.sh/), [instalação do Codex CLI](https://developers.openai.com/codex/cli), [autenticação do Codex](https://developers.openai.com/codex/auth), [repositório oficial](https://github.com/10K-Digital/codexbot).

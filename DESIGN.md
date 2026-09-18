# Codexbot — interface de operação

Preservar o modelo de conversas por agente, skills, rotinas e atividade. O usuário usa o desktop para delegar trabalho e o telefone para acompanhar e responder. A conversa deve ser o foco, com navegação familiar de mensageiro.

O tema claro serve uso diurno em telas pequenas; o escuro reduz luminosidade à noite. Cores semânticas em tokens CSS: verdes para conexão e ações, neutros levemente esverdeados para superfícies, âmbar para revisão, vermelho somente para falhas confirmadas. Tipografia do sistema por legibilidade e compatibilidade com macOS/iOS. SVGs lineares consistentes, sem emojis como controles.

Desktop: navegação com busca, conversa e painel de contexto. Mobile <=760px: conversa de largura total e menu de agentes lateral com foco contido. Compositor fixo dentro da viewport visual, proteção de área segura, botões de toque e Enter multiline no touch. Preferências incluem tema e endereço privado remoto.

Movimento: entrada discreta do estado vazio e do diálogo; menu desliza com ease-out. Estados contínuos apenas enquanto há trabalho/conexão pendente. Respeitar prefers-reduced-motion. Não animar cada token recebido nem reconstruir painéis sem mudança.

Erros: recuperação temporária é um estado de progresso; detalhes técnicos aparecem apenas em falha terminal. Interações e conteúdo devem sobreviver à reconexão. Não repetir pedidos mutáveis silenciosamente.

Materialidade: fundos planos em sálvia no claro e verde profundo no escuro. Componentes com volume suave, iluminação superior esquerda, bordas iluminadas e sombras difusas. Jade acetinado nas ações principais. Transparência mais perceptível só nos diálogos, menus flutuantes e compositor; manter leitura opaca e alto contraste. Mobile reduz blur e mantém alvos de toque, sem efeitos dependentes de hover. Respeitar movimento reduzido, transparência reduzida e cores forçadas.

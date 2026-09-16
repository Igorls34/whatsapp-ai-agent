import { config } from '../config.js';

const tools = [
  {
    type: 'function',
    function: {
      name: 'consultar_disponibilidade',
      description:
        'Consulta a agenda do Igor e retorna os horários livres para os próximos dias. Use quando o cliente quiser agendar uma reunião, orçamento ou papo técnico.',
      parameters: {
        type: 'object',
        properties: {
          dias: {
            type: 'integer',
            description: 'Quantos dias à frente consultar (padrão: 3).',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendar_reuniao',
      description:
        'Reserva um horário na agenda do Igor. Use SOMENTE depois que o cliente confirmar um horário que você ofereceu. O argumento data_hora deve usar exatamente o formato retornado por consultar_disponibilidade (ex: 2026-09-15T14:00).',
      parameters: {
        type: 'object',
        properties: {
          data_hora: {
            type: 'string',
            description: 'Horário escolhido pelo cliente no formato ISO local (ex: 2026-09-15T14:00).',
          },
          telefone: {
            type: 'string',
            description: 'Telefone do cliente com DDI, ex: 5511987654321.',
          },
          nome: {
            type: 'string',
            description: 'Nome do cliente, se conhecido.',
          },
          motivo: {
            type: 'string',
            description: 'Motivo resumido da reunião (ex: "Orçamento de sistema de vendas").',
          },
        },
        required: ['data_hora', 'telefone'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'salvar_resumo_cliente',
      description:
        'Persiste um resumo consolidado sobre o cliente (contexto do projeto, assunto tratado, decisões). Use ao final de interações importantes para a memória de longo prazo.',
      parameters: {
        type: 'object',
        properties: {
          telefone: {
            type: 'string',
            description: 'Telefone do cliente com DDI, ex: 5511987654321.',
          },
          resumo: {
            type: 'string',
            description: 'Novo resumo completo e consolidado sobre o cliente.',
          },
        },
        required: ['telefone', 'resumo'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notificar_emergencia',
      description:
        'Aciona o canal de emergência do Igor para casos urgentes: cliente reclamando/enfurecido, bug crítico em produção, ou pedido explícito de falar com um humano agora.',
      parameters: {
        type: 'object',
        properties: {
          telefone: {
            type: 'string',
            description: 'Telefone do cliente que acionou a emergência.',
          },
          nome: {
            type: 'string',
            description: 'Nome do cliente, se conhecido.',
          },
          mensagem: {
            type: 'string',
            description: 'Resumo do motivo da urgência.',
          },
        },
        required: ['telefone', 'mensagem'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_imagem',
      description:
        'Envia uma imagem ou GIF ao cliente via WhatsApp. Use quando for útil mostrar um logo, catálogo visual, portfolio, GIF animado ou material. O argumento imagem deve ser um apelido da lista de imagens disponíveis no contexto (seção "Imagens disponíveis"). O arquivo cadastrado (.png/.jpg/.gif) define o formato enviado.',
      parameters: {
        type: 'object',
        properties: {
          telefone: {
            type: 'string',
            description: 'Telefone do cliente com DDI, ex: 5511987654321.',
          },
          imagem: {
            type: 'string',
            description: 'Apelido da imagem no manifest (ex: "logo_igor", "catalogo_servicos", "boasvindas_gif").',
          },
          legenda: {
            type: 'string',
            description: 'Legenda curta que acompanha a imagem, se fizer sentido.',
          },
        },
        required: ['telefone', 'imagem'],
        additionalProperties: false,
      },
    },
  },
];

export default tools;
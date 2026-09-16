import { createAvailabilityService } from './availabilityService.js';
import { createSchedulingService } from './schedulingService.js';
import { createClientMemoryService } from './clientMemoryService.js';
import { createEmergencyService } from './emergencyService.js';
import { createImageService } from './imageService.js';
import { createNotificationService } from './notificationService.js';

// Ponte entre os tools definidos em llm/tools.js e as implementações reais.
// Qualquer erro/indisponibilidade do banco é convertido em JSON estruturado
// para o LLM conseguir responder com elegância (edge case "DB offline").
export function createToolExecutor({ repos, getSocket, config }) {
  const availability = createAvailabilityService(repos);
  const scheduling = createSchedulingService(repos);
  const clientMemory = createClientMemoryService(repos);
  const emergency = createEmergencyService({ getSocket, config });
  const images = createImageService({ getSocket, config });
  const notifications = createNotificationService({ getSocket, config });

  return {
    execute: async (name, args) => {
      try {
        switch (name) {
          case 'consultar_disponibilidade':
            return await availability.consultar(args);
          case 'agendar_reuniao': {
            const resultado = await scheduling.agendar(args);
            // Notifica o Igor via WhatsApp e email quando o agendamento é confirmado
            if (resultado.ok && resultado.agendamento) {
              notifications.notificarAgendamento({
                data_hora: resultado.agendamento.data_hora,
                telefone: args.telefone,
                nome: args.nome,
                motivo: args.motivo,
              }).catch((err) => console.error('[notif] falha pós-agendamento:', err));
            }
            return resultado;
          }
          case 'salvar_resumo_cliente':
            return await clientMemory.salvarResumo(args);
          case 'notificar_emergencia':
            return await emergency.notificar(args);
          case 'enviar_imagem':
            if (!config.imagens.ativo) return { ok: false, motivo: 'imagens_desativadas' };
            return await images.enviar(args);
          default:
            return { ok: false, motivo: 'ferramenta_desconhecida' };
        }
      } catch (err) {
        console.error(`[tool:${name}] falhou`, err);
        return {
          ok: false,
          motivo: 'banco_indisponivel',
          msg_usuario:
            'Estou com instabilidade na minha memória agora 😅. Se puder, me passe o essencial aqui mesmo que eu repasso ao Igor.',
        };
      }
    },
  };
}
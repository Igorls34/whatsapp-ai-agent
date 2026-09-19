import fs from 'node:fs';
import path from 'node:path';
import { textoBoasVindas } from '../prompt/persona.js';

// Envio de imagens ao cliente.
//
// As imagens ficam em assets/imagens/ e são catalogadas em manifest.json:
//
//   {
//     "logo_igor":      { "arquivo": "logo.png",              "descricao": "Logo do Igor Dev" },
//     "catalogo_serv":  { "arquivo": "catalogo-servicos.png", "descricao": "Tabela de serviços e preços" }
//   }
//
// O LLM escolhe o apelido (chave) e o serviço localiza o arquivo e envia via WhatsApp.
export function createImageService({ getSocket, config }) {
  const dir = config.imagens.dir;
  const manifestPath = path.join(dir, 'manifest.json');

  function carregarManifest() {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const data = JSON.parse(raw);
      return typeof data === 'object' && data ? data : {};
    } catch (err) {
      console.warn(`[imagens] manifest ausente/inválido em ${manifestPath}:`, err.message);
      return {};
    }
  }

  return {
    // Lista os apelidos disponíveis (para o LLM saber o que pode enviar).
    listar() {
      const manifest = carregarManifest();
      return Object.entries(manifest).map(([apelido, info]) => ({
        apelido,
        arquivo: info?.arquivo || info,
        descricao: info?.descricao || '',
      }));
    },

    // Envia a imagem/gif de boas-vindas para o cliente (com legenda de apresentação).
    // Retorna { ok: true } quando o material existe. Se o arquivo/manifest estiver
    // ausente, retorna { ok: false, motivo } para o caller decidir se envia só texto.
    async enviarBoasVindas({ telefone, remoteJid }) {
      return this.enviar({
        telefone,
        imagem: config.welcomes.imagem,
        legenda: textoBoasVindas(config.welcomes.texto),
        remoteJid,
      });
    },

    async enviar({ telefone, imagem, legenda = '', remoteJid }) {
      if (!telefone || !imagem) return { ok: false, motivo: 'dados_incompletos' };

      const socket = getSocket();
      if (!socket) return { ok: false, motivo: 'socket_indisponivel' };

      const manifest = carregarManifest();
      const info = manifest[imagem];
      if (!info) return { ok: false, motivo: 'imagem_desconhecida' };

      const arquivo = info?.arquivo || info;
      const caminho = path.join(dir, arquivo);
      if (!fs.existsSync(caminho)) {
        return { ok: false, motivo: 'arquivo_ausente', arquivo };
      }

      // Usa o remoteJid (LID ou telefone) quando informado; senão monta do telefone.
      const jid = remoteJid || `${telefone}@s.whatsapp.net`;
      try {
        const buffer = fs.readFileSync(caminho);
        const ehGif = arquivo.toLowerCase().endsWith('.gif');

        if (ehGif) {
          // Baileys envia GIF como vídeo com gifPlayback (loop automático).
          await socket.sendMessage(jid, {
            video: buffer,
            gifPlayback: true,
            caption: legenda || undefined,
          });
        } else {
          await socket.sendMessage(jid, {
            image: buffer,
            caption: legenda || undefined,
          });
        }
        return { ok: true, imagem_enviada: imagem, arquivo, tipo: ehGif ? 'gif' : 'imagem' };
      } catch (err) {
        console.error(`[imagens] falha ao enviar "${imagem}":`, err);
        return { ok: false, motivo: 'falha_envio' };
      }
    },
  };
}
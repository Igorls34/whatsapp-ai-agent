// Rotas de pareamento do WhatsApp: página /qr, status JSON e imagem PNG.
//
// Substituem o servidor Python ad-hoc (:8090) e o popup do Windows: o QR vive
// no mesmo processo/porta do app e é atualizado pelo evento do Baileys.
import QRCode from 'qrcode';
import { buffer, html, json } from '../respond.js';

const PAGINA_QR = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WhatsApp — QR Code do Bot</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center;
           justify-content:center; gap:14px; background:#0a0a0a; color:#fff;
           font-family:'Segoe UI',sans-serif; }
    h2 { font-size:18px; margin:0; text-align:center; color:#8b5cf6; }
    img { width:300px; height:300px; background:#fff; padding:10px; border-radius:12px;
          box-shadow:0 6px 24px rgba(0,0,0,.5); }
    p  { margin:0; font-size:13px; color:#a1a1aa; text-align:center; }
    .warn { color:#f87171; }
    .ok { color:#34d399; }
    .box { display:flex; flex-direction:column; align-items:center; gap:14px; padding:24px;
           background:#0a0a0a; border:1px solid #1f1f1f; border-radius:16px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Escaneie com o WhatsApp do Igor</h2>
    <img id="qr" alt="QR Code (aguardando...)" src="" style="display:none" />
    <p id="status">Verificando o estado do WhatsApp…</p>
    <p class="warn">PRIVADO: não compartilhe nem exponha este QR.</p>
  </div>
  <script>
    const img = document.getElementById('qr');
    const status = document.getElementById('status');

    async function atualizar() {
      try {
        const res = await fetch('/api/qr', { cache: 'no-store' });
        const d = await res.json();
        if (d.conectado) {
          img.style.display = 'none';
          status.className = 'ok';
          status.textContent = 'WhatsApp conectado ✅';
          return;
        }
        status.className = '';
        if (d.temQr) {
          img.style.display = 'block';
          img.src = '/qr.png?t=' + Date.now();
          const hora = d.atualizadoEm ? new Date(d.atualizadoEm).toLocaleTimeString('pt-BR') : '';
          status.textContent = 'QR atualizado' + (hora ? ' às ' + hora : '') + ' — atualizo sozinho.';
        } else {
          img.style.display = 'none';
          status.textContent = 'Aguardando o QR do WhatsApp…';
        }
      } catch (err) {
        status.className = 'warn';
        status.textContent = 'Não consegui consultar o status. Tentando de novo…';
      }
    }

    atualizar();
    setInterval(atualizar, 3000);
  </script>
</body>
</html>`;

export function registrarRotasQr(router, { qrState }) {
  router.get('/qr', ({ res }) => html(res, 200, PAGINA_QR));

  router.get('/api/qr', ({ res }) => {
    const { conectado, qr, atualizadoEm } = qrState.estado();
    return json(res, 200, {
      ok: true,
      conectado,
      temQr: Boolean(qr),
      atualizadoEm,
    });
  });

  router.get('/qr.png', async ({ res }) => {
    const { qr } = qrState.estado();
    if (!qr) {
      return json(res, 404, { ok: false, erro: 'Nenhum QR disponível no momento.' });
    }
    try {
      const png = await QRCode.toBuffer(qr, { width: 360, margin: 2 });
      return buffer(res, 200, png, 'image/png');
    } catch (err) {
      console.error('[qr] falha ao gerar PNG:', err.message);
      return json(res, 500, { ok: false, erro: 'Falha ao gerar o QR.' });
    }
  });
}

// Estado do pareamento do WhatsApp mantido em memória.
//
// O Baileys emite um QR novo a cada ~20s enquanto o celular não pareia. Em vez
// de salvar PNG/HTML em disco ou abrir popup, o app guarda o código atual aqui
// e o servidor HTTP serve a página `/qr` para quem estiver pareando.
export function createQrState() {
  let qr = null;
  let atualizadoEm = null;
  let conectado = false;

  return {
    definirQr(valor) {
      if (!valor) return;
      qr = String(valor);
      atualizadoEm = Date.now();
      conectado = false;
    },
    limparQr() {
      qr = null;
      atualizadoEm = null;
    },
    conectar() {
      conectado = true;
      qr = null;
      atualizadoEm = null;
    },
    desconectar() {
      conectado = false;
    },
    estado() {
      return { conectado, qr, atualizadoEm };
    },
  };
}

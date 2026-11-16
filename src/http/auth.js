// Guard de autenticação do painel: se ADMIN_TOKEN estiver preenchido, exige
// `Authorization: Bearer <token>`. Sem token configurado, o acesso é livre
// (uso local). Só se aplica às rotas do painel — chat, QR e /health ficam fora.
export function criarGuardAdmin(token) {
  return (req) => !token || req.headers?.authorization === `Bearer ${token}`;
}

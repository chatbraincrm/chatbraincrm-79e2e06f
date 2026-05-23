## Objetivo

Trocar o e-mail do super admin de `superadmin@vendus.com.br` para `chatbraincrm@gmail.com`, mantendo o mesmo usuário (mesmo `user_id`, mesmas roles, mesmo histórico).

## Passos

1. Rodar um `UPDATE` direto em `auth.users` (e em `public.profiles`) trocando o e-mail do usuário atual para `chatbraincrm@gmail.com`, já marcando `email_confirmed_at` para não exigir reconfirmação.
2. Manter a senha atual (`@Thaisa95`) — só o e-mail muda.
3. Confirmar com você que o login passa a funcionar em `/login` com:
  - E-mail: `chatbraincrm@gmail.com`
  - Senha: `@Thaisa95`

## Observações

- Roles (`super_admin` / `admin`) ficam intactas porque estão atreladas ao `user_id`, não ao e-mail.
- Se `chatbraincrm@gmail.com` já existir como outro usuário no sistema, pode fundir e descartar o antigo.
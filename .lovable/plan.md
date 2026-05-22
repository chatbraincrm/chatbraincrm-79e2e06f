## Problema

O usuário `superadmin@vendus.com.br` existe no Lovable Cloud (criado em 22/05 às 08:34, e-mail já confirmado), mas a senha armazenada não bate com `@Mudarsenha#123`. Por isso o endpoint `/auth/v1/token` responde `400 invalid_credentials`.

## Solução

Rodar uma migration única que atualiza o hash de senha desse usuário diretamente em `auth.users` usando `crypt()` com `bcrypt`, definindo a senha para `@Mudarsenha#123`.

### Passos

1. Executar migration SQL:
   ```sql
   UPDATE auth.users
   SET encrypted_password = crypt('@Mudarsenha#123', gen_salt('bf')),
       updated_at = now()
   WHERE email = 'superadmin@vendus.com.br';
   ```
2. Confirmar com o usuário para testar login novamente em `/login` com as credenciais informadas.

### Observações

- Não mexe em RLS, triggers ou outras tabelas.
- Após o primeiro login bem-sucedido recomendo trocar a senha em **Perfil → Segurança**.
- Se preferir, posso também gerar uma senha temporária aleatória em vez de usar a fornecida no chat (mais seguro, já que ela ficou visível no histórico).

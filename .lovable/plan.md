

## Diagnóstico do Problema de Login no Domínio Publicado

### Causa Raiz Identificada

Existem **3 problemas distintos** que impedem o login no domínio publicado:

---

### Problema 1: Usuários com email real no auth (principal)

Dois usuários registraram com email real em vez do pseudo-email baseado em telefone:

| Usuário | Telefone | Email no Auth | Login com telefone funciona? |
|---|---|---|---|
| Evandro Junior | 37998443194 | `evandrojr237@outlook.com` | **NÃO** — o login monta `37998443194@plataforma.app` mas o auth espera `evandrojr237@outlook.com` |
| Josué dos Santos | 16997981311 | `josuedossantos972@gmail.com` | **NÃO** — mesmo problema + email não confirmado |
| Lucas Lopes | 16994142398 | `16994142398@plataforma.app` | SIM |
| Teste Bot | 11988776655 | `11988776655@plataforma.app` | SIM |

O Login.tsx converte telefone em `{digits}@plataforma.app`, mas esses 2 usuários foram criados com email real — então o `signInWithPassword` sempre retorna "Invalid login credentials".

### Problema 2: Email não confirmado

O usuário `josuedossantos972@gmail.com` tem `email_confirmed_at = NULL`. Mesmo corrigindo o problema 1, ele não conseguirá logar sem confirmar.

### Problema 3: Sessões obsoletas no localStorage

Os logs mostram dezenas de erros "Session not found" vindos do domínio publicado. Quando o usuário tem um token expirado no localStorage, o Supabase tenta refresh, falha com 403, e o app fica em loop. Isso pode causar comportamento estranho antes mesmo de tentar login.

---

### Plano de Correção

#### 1. Corrigir login para suportar ambos os formatos (Login.tsx)
- Tentar primeiro com `{digits}@plataforma.app` (novo padrão)
- Se falhar, tentar com o email do perfil via uma busca na tabela profiles pelo telefone
- Criar uma edge function ou RPC `get_auth_email_by_phone` (SECURITY DEFINER) que retorna o email de auth baseado no telefone, sem expor dados sensíveis

#### 2. Confirmar email do usuário Josué (migração SQL)
- Executar migração para confirmar o email via `auth.users` update (ou usar a abordagem de RPC admin)

#### 3. Limpar sessão obsoleta no AuthContext
- No `AuthContext`, ao receber `session_not_found` ou erro no `getSession`, chamar `supabase.auth.signOut()` para limpar o localStorage e evitar loops

#### 4. (Opcional) Migrar emails legados para padrão pseudo-email
- Atualizar os 2 usuários com email real para o formato `{digits}@plataforma.app` no `auth.users` para que o login por telefone funcione diretamente

---

### Detalhes Técnicos

**Nova função SQL** (`get_auth_email_by_phone`):
```sql
CREATE FUNCTION public.get_auth_email_by_phone(_phone text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email FROM auth.users u
  WHERE u.raw_user_meta_data->>'phone' = _phone
  LIMIT 1;
$$;
```

**Login.tsx** — lógica atualizada:
1. Primeiro tenta `signInWithPassword({ email: pseudoEmail, password })`
2. Se falhar, chama `rpc('get_auth_email_by_phone', { _phone: phoneDigits })`
3. Se retornar um email diferente, tenta login com esse email
4. Se ambos falharem, mostra erro

**AuthContext** — tratamento de sessão obsoleta:
- Ao detectar erro de sessão no `getSession`, limpa localStorage com `signOut()` silencioso


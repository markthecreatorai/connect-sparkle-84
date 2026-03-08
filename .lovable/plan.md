

## Problema Identificado

O erro real nos logs é claro:

```
"userClient.auth.getClaims is not a function"
```

A função `getClaims()` **não existe** no Supabase JS SDK v2.49.1. Foi introduzida incorretamente na última edição da edge function `gamification`. As outras edge functions (`admin-actions`, `manage-investment`) usam `getUser()` corretamente e funcionam.

Isso causa falha no Dashboard (que chama gamification ao carregar), e combinado com a sessão stale (session_not_found nos logs), o app fica em loop de erro.

Além disso, os problemas de "Session not found" nos auth logs (sessão `43802169-57d6-44fb-b9fc-b627adb29b6c`) indicam que o fix do AuthContext para limpar sessões stale ainda não foi publicado no domínio.

---

## Plano de Correção

### 1. Corrigir edge function `gamification/index.ts`
Substituir `getClaims(token)` por `getUser()` (mesmo padrão das outras edge functions):

```typescript
const { data: { user }, error: authErr } = await userClient.auth.getUser();
if (authErr || !user) throw new Error("Unauthorized");
const userId = user.id;
```

### 2. Publicar o app
As correções do AuthContext (limpeza de sessão stale) e do Login (fallback para email legado) já estão no código mas precisam ser publicadas para o domínio `avengersplataforma.lovable.app`.


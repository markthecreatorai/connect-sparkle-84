

# Migração completa para Mercado Pago (Depósitos + Saques)

## Situação Atual
- **Depósitos**: Frontend chama `asaas-pix`, mas já existe `mercadopago-pix` funcional
- **Saques**: Frontend chama `asaas-payout` (Asaas transfers API)
- **Webhook**: Existe `asaas-webhook` e `mercadopago-webhook`

## Plano de Mudanças

### 1. Atualizar o secret `MERCADOPAGO_ACCESS_TOKEN`
Atualizar com o Access Token fornecido: `APP_USR-2298394252227042-0313...`
> **Nota**: O Access Token parece estar truncado. Confirme se é o valor completo.

### 2. Frontend — Deposit.tsx
Trocar a chamada de `asaas-pix` → `mercadopago-pix` (linha 161).

### 3. Frontend — AdminWithdrawals.tsx  
Trocar a chamada de `asaas-payout` → `mercadopago-payout` e atualizar a mensagem de sucesso (linhas 52-60).

### 4. Criar edge function `mercadopago-payout`
Nova função para envio de PIX via Mercado Pago usando a API de **Payouts/Disbursements** (`/v1/payouts`). Fluxo:
- Verifica se o caller é admin
- Busca dados do saque (withdrawal)
- Envia PIX ao beneficiário via API do MP
- Atualiza status do saque e transação

### 5. Atualizar `mercadopago-webhook`
Adaptar para processar tanto pagamentos recebidos (depósitos) quanto confirmações de pagamentos enviados (payouts), seguindo a mesma lógica do `asaas-webhook` atual (crédito de saldo, comissões, VIP upgrades).

### 6. Limpeza
- Remover referências textuais ao "Asaas" no frontend
- Manter as edge functions do Asaas no código (podem ser removidas depois), mas não serão mais chamadas

### Detalhes Técnicos

**mercadopago-payout** usará:
```
POST https://api.mercadopago.com/v1/payouts
Authorization: Bearer {ACCESS_TOKEN}
{
  "amount": net_amount,
  "payment_method_id": "pix_transfer",
  "receiver_id": null,
  "external_reference": withdrawal_id,
  "description": "Saque #xxx",
  "metadata": { pix_key, pix_key_type }
}
```

**Config**: Adicionar `[functions.mercadopago-payout] verify_jwt = false` ao config.toml.


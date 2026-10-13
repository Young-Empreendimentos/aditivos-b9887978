# Como publicar as regras do Firestore (com segurança)

> ⚠️ **Isto NÃO sobe pelo Railway.** As regras vão para o **Firebase** (projeto
> `gerador-aditivos`), à parte do app. E **regra errada tranca todo mundo pra fora** —
> então siga o teste antes de confiar. (Mesma lição do perrengue de RLS no Supabase.)

## Antes de publicar: GUARDE as regras atuais
No Firebase Console → **Firestore Database → Rules**, **copie o conteúdo atual** e cole
num arquivo de backup (ex.: `firestore.rules.ANTES.txt`). É o seu "desfazer".

## Opção A — pelo Console (mais simples)
1. Firebase Console → projeto **gerador-aditivos** → **Firestore Database → Rules**.
2. Apague o conteúdo e cole o de `firestore.rules` (deste repositório).
3. Clique em **Publish**.

## Opção B — pela CLI (se tiver firebase-tools)
```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```
(O `.firebaserc` já aponta para `gerador-aditivos`.)

## TESTE LOGO APÓS PUBLICAR (não pule)
Faça os 3 testes — se qualquer um falhar, **republique o backup na hora**:

1. **Admin continua entrando:** logue com `elen@` (ou `eduardo@`) → abre normal, e a tela
   **Usuários** lista todo mundo. ✅
2. **Usuário comum aprovado usa:** logue com uma conta comum já aprovada → consegue
   **gerar um aditivo** e abrir **Quitação** (lê empresa/template/config). ✅
3. **Não dá pra se auto-promover:** com uma conta comum, no DevTools (console do navegador),
   tente escrever o próprio papel:
   ```js
   // deve dar "Missing or insufficient permissions"
   firebase.firestore().collection('roles_gerador_aditivos')
     .doc('suaconta@youngempreendimentos.com.br')
     .set({ role: 'admin', status: 'aprovado' }, { merge: true })
   ```
   Tem que **falhar** (permissão negada). ✅

## O que as regras garantem
- Só conta **@youngempreendimentos.com.br** logada.
- **Aprovação de verdade no servidor:** usuário pendente não lê/grava dados (só cria a
  própria solicitação pendente e lê o próprio status).
- **Sem auto-elevação:** ninguém escreve o próprio `role`/`status`; aprovar/mudar papel é
  só **coordenador/admin**. Sementes (eduardo/elen/suelen) mantêm o papel fixo.
- **Config/templates/quitação:** leitura p/ aprovados, escrita só coordenador/admin.
- **Históricos:** aprovados criam/editam; **ninguém apaga** (regra "nunca apagar dados").
- Serviços com Admin SDK / Service Account (n8n lendo `quitacao_configuracoes`) **ignoram**
  as regras — os bots não quebram.

## Endurecimento opcional (depois, se quiser)
Para barrar conta forjada via provedor e-mail/senha, adicione em `isYoung()`:
`&& request.auth.token.email_verified == true`. Login Google sempre é verificado, então é
seguro — mas teste de novo os 3 passos após publicar.

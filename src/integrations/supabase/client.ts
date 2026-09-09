// Este arquivo veio do scaffold do Lovable, mas o Recalcula NÃO usa este cliente:
// o acesso ao Supabase é feito pela Edge Function `sienge-proxy` (autenticada por
// Firebase). Ele só existe porque componentes copiados de outros sistemas (ex.:
// CelebracaoVenda) podem importá-lo.
//
// PROTEÇÃO: o Recalcula não tem as VITE_SUPABASE_* (o Railway não define env vars).
// Sem os fallbacks abaixo, `createClient(undefined, undefined)` ESTOURA no carregamento
// e derruba o app inteiro (tela branca). Os placeholders evitam o crash — o cliente
// fica inerte (chave falsa, sem acesso a nada). Não coloque a chave anon/secret aqui.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sem-chave';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "ERRORE CONFIGURAZIONE: SUPABASE_URL o SUPABASE_ANON_KEY sono mancanti.\n" +
    "Assicurati di averle impostate nelle variabili d'ambiente di Vercel o nel tuo file .env."
  );
}

// Inizializziamo il client. Se le chiavi mancano, l'errore verrà catturato dalle chiamate ai servizi
// invece di bloccare l'intero mount di React all'avvio.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

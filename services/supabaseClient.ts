
import { createClient } from '@supabase/supabase-js';

// Le variabili vengono iniettate da Vite tramite il blocco 'define'
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Fallback URL e Key per prevenire il crash immediato se l'utente non ha ancora configurato i segreti
const DEFAULT_URL = 'https://placeholder-project.supabase.co';
const DEFAULT_KEY = 'placeholder-key';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "ATTENZIONE: Configurazione Supabase mancante.\n" +
    "L'app non potrà salvare i dati. Assicurati di impostare SUPABASE_URL e SUPABASE_ANON_KEY " +
    "nelle variabili d'ambiente del progetto."
  );
}

export const supabase = createClient(
  supabaseUrl || DEFAULT_URL,
  supabaseAnonKey || DEFAULT_KEY
);

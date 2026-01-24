
import { User, Experiment, Session } from "../types";

/**
 * GUIDA ALLA PRODUZIONE:
 * Per connettersi a Supabase, installa @supabase/supabase-js e sostituisci
 * i blocchi localStorage con chiamate: 
 * const { data } = await supabase.from('experiments').select('*')
 */

const USERS_KEY = 'eeg_lab_users_db';
const EXPS_KEY = 'eeg_lab_experiments_db';
const INVITES_KEY = 'eeg_lab_invites_db';
const INITIAL_INVITE = 'LAB-2025';

// Simuliamo una latenza di rete reale per testare l'esperienza utente
const networkDelay = () => new Promise(res => setTimeout(res, 400));

export const dataService = {
  // Gestione Utenti
  getUsers: async (): Promise<User[]> => {
    await networkDelay();
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  },
  
  saveUser: async (user: User) => {
    await networkDelay();
    const users = await dataService.getUsers();
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
  },

  findUser: async (email: string): Promise<User | undefined> => {
    const users = await dataService.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  updateUserRole: async (userId: string, newRole: 'Admin' | 'Researcher') => {
    await networkDelay();
    const users = await dataService.getUsers();
    const updated = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
  },

  // Gestione Inviti (In produzione questo andrebbe su una tabella sicura)
  getInvites: async (): Promise<string[]> => {
    const invites = localStorage.getItem(INVITES_KEY);
    if (!invites) {
      const initial = [INITIAL_INVITE];
      localStorage.setItem(INVITES_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(invites);
  },

  generateInvite: async (): Promise<string> => {
    await networkDelay();
    const code = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const invites = await dataService.getInvites();
    localStorage.setItem(INVITES_KEY, JSON.stringify([...invites, code]));
    return code;
  },

  validateAndUseInvite: async (code: string): Promise<'Admin' | 'Researcher' | null> => {
    await networkDelay();
    const invites = await dataService.getInvites();
    const normalizedCode = code.trim().toUpperCase();
    
    if (invites.includes(normalizedCode)) {
      if (normalizedCode !== INITIAL_INVITE) {
        const remaining = invites.filter(c => c !== normalizedCode);
        localStorage.setItem(INVITES_KEY, JSON.stringify(remaining));
      }
      return normalizedCode === INITIAL_INVITE ? 'Admin' : 'Researcher';
    }
    return null;
  },

  // Gestione Esperimenti
  getExperiments: async (userId: string): Promise<Experiment[]> => {
    await networkDelay();
    const allExps: Experiment[] = JSON.parse(localStorage.getItem(EXPS_KEY) || '[]');
    // In produzione: la query filtrata viene fatta dal database
    return allExps.filter(e => e.userId === userId);
  },

  saveExperiment: async (exp: Experiment) => {
    await networkDelay();
    const allExps: Experiment[] = JSON.parse(localStorage.getItem(EXPS_KEY) || '[]');
    localStorage.setItem(EXPS_KEY, JSON.stringify([...allExps, exp]));
  },

  updateExperiment: async (updatedExp: Experiment) => {
    await networkDelay();
    const allExps: Experiment[] = JSON.parse(localStorage.getItem(EXPS_KEY) || '[]');
    const newExps = allExps.map(e => e.id === updatedExp.id ? updatedExp : e);
    localStorage.setItem(EXPS_KEY, JSON.stringify(newExps));
  },

  deleteExperiment: async (id: string) => {
    await networkDelay();
    const allExps: Experiment[] = JSON.parse(localStorage.getItem(EXPS_KEY) || '[]');
    localStorage.setItem(EXPS_KEY, JSON.stringify(allExps.filter(e => e.id !== id)));
  }
};

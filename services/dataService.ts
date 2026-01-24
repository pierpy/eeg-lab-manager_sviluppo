import { User, Experiment, Session } from "../types";
import { supabase } from "./supabaseClient";

export const dataService = {
  // Gestione Utenti
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      console.error("Errore fetch utenti:", error);
      throw error;
    }
    return data as User[];
  },
  
  saveUser: async (user: User) => {
    const { error } = await supabase.from('users').insert([{
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }]);
    if (error) throw error;
  },

  findUser: async (email: string): Promise<User | undefined> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle(); // maybeSingle non lancia errore se non trova nulla
    
    if (error) {
      console.error("Errore ricerca utente:", error);
      throw error;
    }
    return data || undefined;
  },

  updateUserRole: async (userId: string, newRole: 'Admin' | 'Researcher') => {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);
    if (error) throw error;
  },

  // Gestione Inviti
  generateInvite: async (): Promise<string> => {
    const code = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('invites').insert([{ code, role: 'Researcher' }]);
    if (error) throw error;
    return code;
  },

  validateAndUseInvite: async (code: string): Promise<'Admin' | 'Researcher' | null> => {
    const normalizedCode = code.trim().toUpperCase();
    const { data, error } = await supabase
      .from('invites')
      .select('role')
      .eq('code', normalizedCode)
      .single();
    
    if (error || !data) return null;

    if (normalizedCode !== 'LAB-2025') {
      await supabase.from('invites').delete().eq('code', normalizedCode);
    }
    
    return data.role as 'Admin' | 'Researcher';
  },

  // Gestione Esperimenti
  getExperiments: async (userId: string): Promise<Experiment[]> => {
    const { data, error } = await supabase
      .from('experiments')
      .select('*, sessions(*)')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });
    
    if (error) throw error;

    // Supabase restituisce le sessioni annidate come camel_case o snake_case a seconda dei nomi colonne.
    // Mappiamo i dati per matchare le nostre interfacce TS.
    return (data || []).map((exp: any) => ({
      ...exp,
      userId: exp.user_id,
      startDate: exp.start_date,
      sessions: (exp.sessions || []).map((s: any) => ({
        id: s.id,
        experimentId: s.experiment_id,
        subjectId: s.subject_id,
        date: s.date,
        durationMinutes: s.duration_minutes,
        samplingRate: s.sampling_rate,
        channelCount: s.channel_count,
        notes: s.notes,
        technicianName: s.technician_name
      }))
    })) as Experiment[];
  },

  saveExperiment: async (exp: Experiment) => {
    const { error } = await supabase.from('experiments').insert([{
      id: exp.id,
      user_id: exp.userId,
      title: exp.title,
      description: exp.description,
      status: exp.status,
      start_date: exp.startDate
    }]);
    if (error) throw error;
  },

  updateExperiment: async (updatedExp: Experiment) => {
    const { error: expError } = await supabase
      .from('experiments')
      .update({
        title: updatedExp.title,
        description: updatedExp.description,
        status: updatedExp.status
      })
      .eq('id', updatedExp.id);
    
    if (expError) throw expError;

    // Sincronizzazione sessioni
    for (const sess of updatedExp.sessions) {
      const { error: sessError } = await supabase
        .from('sessions')
        .upsert([{
          id: sess.id,
          experiment_id: updatedExp.id,
          subject_id: sess.subjectId,
          date: sess.date,
          duration_minutes: sess.durationMinutes,
          sampling_rate: sess.samplingRate,
          channel_count: sess.channelCount,
          notes: sess.notes,
          technician_name: sess.technicianName
        }]);
      if (sessError) throw sessError;
    }
  },

  deleteExperiment: async (id: string) => {
    const { error } = await supabase.from('experiments').delete().eq('id', id);
    if (error) throw error;
  }
};

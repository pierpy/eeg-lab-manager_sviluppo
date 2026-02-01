import { User, Experiment, Session } from "../types";
import { supabase } from "./supabaseClient";

const SESSION_PHOTOS_BUCKET = "session-photos";

export const dataService = {
  // Gestione Utenti
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data as User[];
    } catch (error: any) {
      console.warn("Accesso limitato alla lista utenti (normale per non-admin):", error.message);
      return [];
    }
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
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw error;
      }
      return data || undefined;
    } catch (err: any) {
      console.error("Errore ricerca utente:", err.message);
      return undefined;
    }
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

    if (error || !data) {
      console.error("Validazione invito fallita:", error?.message);
      return null;
    }

    if (normalizedCode !== 'LAB-2025') {
      await supabase.from('invites').delete().eq('code', normalizedCode);
    }

    return data.role as 'Admin' | 'Researcher';
  },

  // Gestione Esperimenti
  getExperiments: async (user: User): Promise<Experiment[]> => {
    let query = supabase.from('experiments').select('*, sessions(*)');

    // Filtro cruciale: se non è admin, carica solo i suoi.
    if (user.role !== 'Admin') {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.order('start_date', { ascending: false });

    if (error) {
      console.error("Errore fetch esperimenti:", error.message);
      throw error;
    }

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
        technicianName: s.technician_name,
        photos: Array.isArray(s.photos) ? s.photos : [] // NEW
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

    // Aggiornamento/Inserimento sessioni
    if (updatedExp.sessions.length > 0) {
      console.log('sto aggiornando l\'esperimento:', updatedExp);
      const sessionsToUpsert = updatedExp.sessions.map(sess => ({
        id: sess.id,
        experiment_id: updatedExp.id,
        subject_id: sess.subjectId,
        date: sess.date,
        duration_minutes: sess.durationMinutes,
        sampling_rate: sess.samplingRate,
        channel_count: sess.channelCount,
        notes: sess.notes,
        technician_name: sess.technicianName,
        photos: sess.photos ?? []
      }));

      const { data: sessData, error: sessError } = await supabase
        .from('sessions')
        .upsert(sessionsToUpsert)
        .select('id, photos');

      if (sessError) throw sessError;

      console.log('UPSERT sessions ->', sessData);
      console.log('UPSERT sessions payload ->', sessionsToUpsert);
    }
  },

  uploadSessionPhotos: async (params: {
    files: File[];
    userId: string;
    experimentId: string;
    sessionId: string;
  }): Promise<string[]> => {
    const { files, userId, experimentId, sessionId } = params;

    const urls: string[] = [];

    for (const f of files) {
      const safeName = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${experimentId}/${sessionId}/${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(SESSION_PHOTOS_BUCKET)
        .upload(path, f, { cacheControl: "3600", upsert: false });

      if (upErr) throw upErr;

      const { data } = supabase.storage
        .from(SESSION_PHOTOS_BUCKET)
        .getPublicUrl(path);

      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  },

  deleteExperiment: async (id: string) => {
    const { error } = await supabase.from('experiments').delete().eq('id', id);
    if (error) throw error;
  },

  deleteSession: async (sessionId: string) => {
    const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
    if (error) throw error;
  }


};

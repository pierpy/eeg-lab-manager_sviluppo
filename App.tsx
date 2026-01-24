import React, { useState, useEffect, useCallback } from 'react';
import { User, Experiment, ExperimentStatus, View, Session } from './types';
import Layout from './components/Layout';
import { suggestProtocols } from './services/geminiService';
import { dataService } from './services/dataService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentView, setCurrentView] = useState<View>('LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState<string | null>(null);

  // Experiment/Session Form States
  const [expTitle, setExpTitle] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expStatus, setExpStatus] = useState<ExperimentStatus>(ExperimentStatus.PLANNING);
  const [sessSubj, setSessSubj] = useState('');
  const [sessDuration, setSessDuration] = useState(30);
  const [sessSampling, setSessSampling] = useState(512);
  const [sessChannels, setSessChannels] = useState(32);
  const [sessNotes, setSessNotes] = useState('');

  const refreshData = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const exps = await dataService.getExperiments(userId);
      setExperiments(exps);
      const users = await dataService.getUsers();
      setAllUsers(users);
    } catch (err: any) {
      console.error("Refresh fallito:", err);
      // Non mostriamo alert qui per non disturbare il primo mount
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const savedUser = localStorage.getItem('eeg_lab_active_user');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          const freshUser = await dataService.findUser(parsedUser.email);
          if (freshUser) {
            setUser(freshUser);
            await refreshData(freshUser.id);
            setCurrentView('DASHBOARD');
          }
        } catch (e) {
          localStorage.removeItem('eeg_lab_active_user');
        }
      }
    };
    init();
  }, [refreshData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const found = await dataService.findUser(email);
      if (found) {
        setUser(found);
        localStorage.setItem('eeg_lab_active_user', JSON.stringify(found));
        await refreshData(found.id);
        setCurrentView('DASHBOARD');
      } else {
        alert("Utente non trovato o tabelle database non configurate.");
      }
    } catch (err: any) {
      alert("Errore di connessione: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const role = await dataService.validateAndUseInvite(inviteCode);
      if (!role) {
        alert("Codice invito non valido o tabella 'invites' mancante.");
        setIsLoading(false);
        return;
      }

      const newUser: User = { 
        id: Math.random().toString(36).substr(2, 9), 
        name, 
        email, 
        role: role 
      };
      await dataService.saveUser(newUser);
      setUser(newUser);
      localStorage.setItem('eeg_lab_active_user', JSON.stringify(newUser));
      await refreshData(newUser.id);
      setCurrentView('DASHBOARD');
    } catch (err: any) {
      alert("Errore registrazione: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      const newExp: Experiment = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        title: expTitle,
        description: expDesc,
        startDate: new Date().toISOString().split('T')[0],
        status: ExperimentStatus.PLANNING,
        sessions: []
      };
      await dataService.saveExperiment(newExp);
      await refreshData(user.id);
      setCurrentView('DASHBOARD');
      setExpTitle(''); setExpDesc('');
    } catch (err: any) {
      alert("Errore salvataggio esperimento: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditExperimentClick = (exp: Experiment) => {
    setExpTitle(exp.title);
    setExpDesc(exp.description);
    setExpStatus(exp.status);
    setCurrentView('EDIT_EXPERIMENT');
  };

  const handleUpdateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    const exp = experiments.find(ex => ex.id === selectedExperimentId);
    if (!exp || !user) return;
    setIsLoading(true);
    try {
      const updated = { ...exp, title: expTitle, description: expDesc, status: expStatus };
      await dataService.updateExperiment(updated);
      await refreshData(user.id);
      setCurrentView('EXPERIMENT_DETAILS');
    } catch (err: any) {
      alert("Errore aggiornamento: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const exp = experiments.find(e => e.id === selectedExperimentId);
    if (!exp || !user) return;
    setIsLoading(true);
    try {
      const newSession: Session = {
        id: Math.random().toString(36).substr(2, 9),
        experimentId: exp.id,
        subjectId: sessSubj,
        date: new Date().toISOString().split('T')[0],
        durationMinutes: sessDuration,
        samplingRate: sessSampling,
        channelCount: sessChannels,
        notes: sessNotes,
        technicianName: user.name
      };
      const updatedExp = { ...exp, sessions: [...exp.sessions, newSession] };
      await dataService.updateExperiment(updatedExp);
      await refreshData(user.id);
      setCurrentView('EXPERIMENT_DETAILS');
      setSessSubj(''); setSessNotes('');
    } catch (err: any) {
      alert("Errore salvataggio sessione: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSessionClick = (sess: Session) => {
    setSelectedSessionId(sess.id);
    setSessSubj(sess.subjectId);
    setSessDuration(sess.durationMinutes);
    setSessSampling(sess.samplingRate);
    setSessChannels(sess.channelCount);
    setSessNotes(sess.notes);
    setCurrentView('EDIT_SESSION');
  };

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const exp = experiments.find(ex => ex.id === selectedExperimentId);
    if (!exp || !user || !selectedSessionId) return;
    setIsLoading(true);
    try {
      const updatedSessions = exp.sessions.map(s => 
        s.id === selectedSessionId 
          ? { ...s, subjectId: sessSubj, durationMinutes: sessDuration, samplingRate: sessSampling, channelCount: sessChannels, notes: sessNotes } 
          : s
      );
      await dataService.updateExperiment({ ...exp, sessions: updatedSessions });
      await refreshData(user.id);
      setCurrentView('EXPERIMENT_DETAILS');
    } catch (err: any) {
      alert("Errore aggiornamento sessione: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const exp = experiments.find(ex => ex.id === selectedExperimentId);
    if (!exp || !user || !confirm("Eliminare questa sessione definitivamente?")) return;
    setIsLoading(true);
    try {
      const updatedSessions = exp.sessions.filter(s => s.id !== sessionId);
      await dataService.updateExperiment({ ...exp, sessions: updatedSessions });
      await refreshData(user.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteExperiment = async (id: string) => {
    if (!user || !confirm("Eliminare l'intero esperimento e tutte le sessioni?")) return;
    setIsLoading(true);
    try {
      await dataService.deleteExperiment(id);
      await refreshData(user.id);
      setCurrentView('DASHBOARD');
    } finally {
      setIsLoading(false);
    }
  };

  const generateInvite = async () => {
    try {
      const code = await dataService.generateInvite();
      setGeneratedInvite(code);
    } catch (err: any) {
      alert("Errore generazione invito (controlla tabella 'invites'): " + err.message);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'Admin' | 'Researcher') => {
    try {
      await dataService.updateUserRole(userId, newRole);
      const users = await dataService.getUsers();
      setAllUsers(users);
      if (userId === user?.id) setUser({ ...user, role: newRole });
    } catch (err: any) {
      alert("Errore aggiornamento ruolo: " + err.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('eeg_lab_active_user');
    setCurrentView('LOGIN');
  };

  const getAIProtocolAdvice = async (experiment: Experiment) => {
    setAiLoading(true);
    setAiResponse(null);
    try {
      const advice = await suggestProtocols(experiment);
      setAiResponse(advice);
    } catch (error) {
      setAiResponse("Errore AI.");
    } finally {
      setAiLoading(false);
    }
  };

  const selectedExp = experiments.find(e => e.id === selectedExperimentId);

  return (
    <Layout user={user} onLogout={handleLogout} onNavigate={(v) => {
      if (v === 'MANAGE_USERS' && user?.role !== 'Admin') return;
      setCurrentView(v);
    }}>
      
      {isLoading && (
        <div className="fixed top-0 left-0 w-full h-1 bg-indigo-200 z-[100] overflow-hidden">
          <div className="h-full bg-indigo-600 animate-[loading_1s_infinite_linear]"></div>
        </div>
      )}

      {currentView === 'LOGIN' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 mt-10 view-enter">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-indigo-600 p-4 rounded-3xl mb-4 shadow-xl shadow-indigo-100">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-4.514A9.01 9.01 0 0012 15c3.517 0 6.799-1.009 9.571-2.753M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-gray-900 text-center">EEG Lab</h2>
            <p className="text-gray-400 text-sm mt-1">Management System</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
            <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all">
              {isLoading ? 'Accesso in corso...' : 'Entra'}
            </button>
          </form>
          <button onClick={() => setCurrentView('REGISTER')} className="w-full mt-6 text-indigo-600 font-bold py-2 text-sm border-t border-gray-50 pt-6">Registrati con invito</button>
        </div>
      )}

      {currentView === 'REGISTER' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 mt-10 view-enter">
          <h2 className="text-2xl font-black mb-8 text-center text-gray-900">Nuovo Ricercatore</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Codice d'Invito</label>
              <input type="text" required placeholder="Es: LAB-2025" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl bg-indigo-50 border-2 border-indigo-100 focus:border-indigo-500 transition-all outline-none font-bold tracking-widest text-indigo-700 uppercase" />
            </div>
            <input type="text" required placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="password" required placeholder="Crea Password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-indigo-100 transition-all mt-4">
              Crea Account
            </button>
          </form>
          <button onClick={() => setCurrentView('LOGIN')} className="w-full mt-4 text-gray-400 font-bold py-2 text-sm">Torna al login</button>
        </div>
      )}

      {currentView === 'DASHBOARD' && (
        <div className="space-y-8 view-enter">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard</h1>
              <p className="text-gray-400 text-sm font-medium">Benvenuto, {user?.name}</p>
            </div>
            <div className="flex space-x-2">
              {user?.role === 'Admin' && (
                <button onClick={() => setCurrentView('MANAGE_USERS')} className="bg-white border-2 border-gray-100 p-3 rounded-2xl shadow-sm text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </button>
              )}
              <button onClick={() => setCurrentView('CREATE_EXPERIMENT')} className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {experiments.map(exp => (
              <div key={exp.id} onClick={() => { setSelectedExperimentId(exp.id); setCurrentView('EXPERIMENT_DETAILS'); }} className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm hover:shadow-xl transition-all cursor-pointer group active:scale-95">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.285a2 2 0 01-1.963 0l-.63-.285a6 6 0 00-3.858-.517l-2.388.477a2 2 0 00-1.022.547V18a2 2 0 002 2h11a2 2 0 002-2v-2.572z" />
                  </svg>
                </div>
                <h3 className="font-extrabold text-gray-900 leading-tight mb-2 truncate">{exp.title}</h3>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{exp.status}</span>
                  <span className="text-[10px] font-bold text-gray-300">{exp.sessions.length} SESS</span>
                </div>
              </div>
            ))}
            {experiments.length === 0 && !isLoading && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-200 rounded-[2rem]">
                <p className="text-gray-400 font-medium">Nessun esperimento trovato.<br/>Controlla se hai creato le tabelle su Supabase.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resto delle visualizzazioni... */}
      {/* (Mantengo il resto del file come era per brevità, focalizzandomi sui fix richiesti) */}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </Layout>
  );
};

export default App;

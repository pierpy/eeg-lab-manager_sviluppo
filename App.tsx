
import React, { useState, useEffect, useCallback } from 'react';
import { User, Experiment, ExperimentStatus, View, Session } from './types';
import Layout from './components/Layout';
import { suggestProtocols, summarizeSessionData } from './services/geminiService';
import { dataService } from './services/dataService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentView, setCurrentView] = useState<View>('LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
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

  const refreshData = useCallback(async (activeUser: User) => {
    setIsLoading(true);
    try {
      const exps = await dataService.getExperiments(activeUser);
      setExperiments(exps);
      
      if (activeUser.role === 'Admin') {
        const users = await dataService.getUsers();
        setAllUsers(users);
      }
    } catch (err: any) {
      console.error("Errore refresh dati:", err);
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
            await refreshData(freshUser);
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
        await refreshData(found);
        setCurrentView('DASHBOARD');
      } else {
        alert("Email non trovata. Registrati se non hai un account.");
      }
    } catch (err: any) {
      alert("Errore login: " + err.message);
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
        alert("Codice invito non valido.");
        setIsLoading(false);
        return;
      }
      const newUser: User = { 
        id: Math.random().toString(36).substr(2, 9), 
        name, email, role 
      };
      await dataService.saveUser(newUser);
      setUser(newUser);
      localStorage.setItem('eeg_lab_active_user', JSON.stringify(newUser));
      await refreshData(newUser);
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
    setIsActionLoading(true);
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
      await refreshData(user);
      setCurrentView('DASHBOARD');
      setExpTitle(''); setExpDesc('');
    } catch (err: any) {
      alert("Errore creazione esperimento: " + err.message);
    } finally { 
      setIsActionLoading(false); 
    }
  };

  const handleUpdateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    const exp = experiments.find(ex => ex.id === selectedExperimentId);
    if (!exp || !user) return;
    setIsActionLoading(true);
    try {
      await dataService.updateExperiment({ ...exp, title: expTitle, description: expDesc, status: expStatus });
      await refreshData(user);
      setCurrentView('EXPERIMENT_DETAILS');
    } catch (err: any) {
      alert("Errore aggiornamento: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const handleDeleteExperiment = async () => {
    if (!selectedExperimentId || !user) return;
    if (!confirm("Sei sicuro di voler eliminare definitivamente questo esperimento e tutte le sue sessioni?")) return;
    setIsActionLoading(true);
    try {
      await dataService.deleteExperiment(selectedExperimentId);
      await refreshData(user);
      setCurrentView('DASHBOARD');
    } catch (err: any) {
      alert("Errore eliminazione: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const exp = experiments.find(e => e.id === selectedExperimentId);
    if (!exp || !user) return;
    setIsActionLoading(true);
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
      await dataService.updateExperiment({ ...exp, sessions: [...exp.sessions, newSession] });
      await refreshData(user);
      setCurrentView('EXPERIMENT_DETAILS');
      setSessSubj(''); setSessNotes('');
    } catch (err: any) {
      alert("Errore salvataggio sessione: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const exp = experiments.find(ex => ex.id === selectedExperimentId);
    if (!exp || !user || !selectedSessionId) return;
    setIsActionLoading(true);
    try {
      const updatedSessions = exp.sessions.map(s => 
        s.id === selectedSessionId 
          ? { ...s, subjectId: sessSubj, durationMinutes: sessDuration, samplingRate: sessSampling, channelCount: sessChannels, notes: sessNotes } 
          : s
      );
      await dataService.updateExperiment({ ...exp, sessions: updatedSessions });
      await refreshData(user);
      setCurrentView('EXPERIMENT_DETAILS');
    } catch (err: any) {
      alert("Errore aggiornamento sessione: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const handleDeleteSession = async () => {
    if (!selectedSessionId || !user) return;
    if (!confirm("Eliminare questa sessione?")) return;
    setIsActionLoading(true);
    try {
      await dataService.deleteSession(selectedSessionId);
      await refreshData(user);
      setCurrentView('EXPERIMENT_DETAILS');
    } catch (err: any) {
      alert("Errore eliminazione sessione: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const getAIProtocolAdvice = async (exp: Experiment) => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const advice = await suggestProtocols(exp);
      setAiResponse(advice);
    } catch (err: any) {
      console.error("AI Error:", err);
      setAiResponse("Errore AI: Assicurati che la descrizione sia dettagliata.");
    } finally {
      setAiLoading(false);
    }
  };

  const selectedExp = experiments.find(e => e.id === selectedExperimentId);

  return (
    <Layout user={user} onLogout={() => { setUser(null); localStorage.removeItem('eeg_lab_active_user'); setCurrentView('LOGIN'); }} onNavigate={setCurrentView}>
      
      {(isLoading || isActionLoading) && (
        <div className="fixed top-0 left-0 w-full h-1 bg-indigo-200 z-[100] overflow-hidden">
          <div className="h-full bg-indigo-600 animate-[loading_1s_infinite_linear]"></div>
        </div>
      )}

      {currentView === 'LOGIN' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 mt-10 view-enter">
          <h2 className="text-3xl font-black text-gray-900 text-center mb-8 tracking-tighter italic">EEG Lab</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
            <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50">Entra nel Lab</button>
          </form>
          <button onClick={() => setCurrentView('REGISTER')} className="w-full mt-6 text-indigo-600 font-bold py-2 text-sm border-t border-gray-50 pt-6">Registrati con Codice Invito</button>
        </div>
      )}

      {currentView === 'REGISTER' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 mt-10 view-enter">
          <h2 className="text-2xl font-black mb-8 text-center tracking-tight">Crea Profilo Ricercatore</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <input type="text" required placeholder="Codice Invito (es. LAB-2025)" value={inviteCode} onChange={e => setInviteCode(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-indigo-50 border-2 border-indigo-100 focus:border-indigo-500 font-bold uppercase tracking-widest text-center" />
            <input type="text" required placeholder="Nome e Cognome" value={name} onChange={e => setName(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="email" required placeholder="La tua Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="password" required placeholder="Password Sicura" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-indigo-100 mt-4 disabled:opacity-50">Registrati Ora</button>
          </form>
          <button onClick={() => setCurrentView('LOGIN')} className="w-full mt-4 text-gray-400 font-bold text-sm">Hai già un account? Log in</button>
        </div>
      )}

      {currentView === 'DASHBOARD' && (
        <div className="space-y-8 view-enter">
          <div className="flex justify-between items-center bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-3xl font-black tracking-tight">Ciao, {user?.name.split(' ')[0]}</h1>
              <p className="opacity-80 text-sm font-medium">Pronto per una nuova sessione EEG?</p>
            </div>
            <button onClick={() => setCurrentView('CREATE_EXPERIMENT')} className="relative z-10 bg-white text-indigo-600 p-5 rounded-2xl shadow-lg active:scale-95 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            </button>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="col-span-full flex items-center justify-between px-2">
              <h3 className="text-lg font-black text-slate-800">I tuoi Esperimenti</h3>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{experiments.length} totali</span>
            </div>
            {experiments.length === 0 && !isLoading && (
              <div className="col-span-full py-16 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <div className="text-indigo-200 mb-4 flex justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <p className="text-slate-400 font-medium">Non hai ancora inserito esperimenti.</p>
                <button onClick={() => setCurrentView('CREATE_EXPERIMENT')} className="mt-4 text-indigo-600 font-black text-sm hover:underline">Clicca qui per iniziare</button>
              </div>
            )}
            {experiments.map(exp => (
              <div key={exp.id} onClick={() => { setSelectedExperimentId(exp.id); setCurrentView('EXPERIMENT_DETAILS'); }} className="bg-white p-6 rounded-[2.2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-3 h-3 rounded-full ${exp.status === ExperimentStatus.ONGOING ? 'bg-emerald-400 animate-pulse' : 'bg-slate-200'}`}></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{exp.startDate}</span>
                </div>
                <h3 className="font-extrabold text-slate-900 mb-2 truncate group-hover:text-indigo-600 transition-colors">{exp.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 h-8 mb-4">{exp.description || 'Senza descrizione.'}</p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                  <span className="text-[9px] font-black uppercase tracking-tighter text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">{exp.status}</span>
                  <div className="flex -space-x-2">
                    {Array.from({length: Math.min(exp.sessions.length, 3)}).map((_, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-400">S</div>
                    ))}
                    {exp.sessions.length > 3 && <span className="text-[10px] font-bold text-slate-300 ml-3">+{exp.sessions.length - 3}</span>}
                    {exp.sessions.length === 0 && <span className="text-[10px] font-bold text-slate-200">No sessioni</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentView === 'CREATE_EXPERIMENT' && (
        <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 view-enter">
          <div className="flex items-center space-x-4 mb-8">
            <button onClick={() => setCurrentView('DASHBOARD')} className="p-3 bg-slate-50 rounded-2xl text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Nuovo Esperimento</h2>
          </div>
          <form onSubmit={handleCreateExperiment} className="space-y-6">
            <div>
              <label className="text-xs font-black uppercase text-slate-400 mb-2 block ml-2">Titolo Ricerca</label>
              <input type="text" required placeholder="Es: Studio ERP Linguaggio" value={expTitle} onChange={e => setExpTitle(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 border-2 border-transparent focus:bg-white transition-all" />
            </div>
            <div>
              <label className="text-xs font-black uppercase text-slate-400 mb-2 block ml-2">Obbiettivi e Metodologia</label>
              <textarea placeholder="Descrivi il paradigma usato, gli stimoli..." value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none h-40 focus:ring-2 focus:ring-indigo-500 border-2 border-transparent focus:bg-white transition-all resize-none" />
            </div>
            <button type="submit" disabled={isActionLoading} className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex justify-center items-center">
              {isActionLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Avvia Esperimento"}
            </button>
          </form>
        </div>
      )}

      {currentView === 'EXPERIMENT_DETAILS' && selectedExp && (
        <div className="space-y-6 view-enter pb-20">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{selectedExp.status}</span>
                  <span className="text-[10px] font-bold text-slate-300">ID: {selectedExp.id}</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">{selectedExp.title}</h2>
                <p className="text-slate-500 text-sm leading-relaxed">{selectedExp.description}</p>
              </div>
              <button onClick={() => { 
                setExpTitle(selectedExp.title); 
                setExpDesc(selectedExp.description); 
                setExpStatus(selectedExp.status); 
                setCurrentView('EDIT_EXPERIMENT'); 
              }} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
              </button>
            </div>
            
            <div className="flex space-x-3 pt-6 border-t border-slate-50">
              <button 
                onClick={() => getAIProtocolAdvice(selectedExp)} 
                disabled={aiLoading}
                className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-lg shadow-slate-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 ${aiLoading ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.657 15.657a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM16.464 14.95a1 1 0 10-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707z" />
                </svg>
                {aiLoading ? 'Analisi...' : 'Protocollo AI'}
              </button>
              <button onClick={() => setCurrentView('ADD_SESSION')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100">Nuova Sessione</button>
            </div>

            {aiResponse && !aiLoading && (
              <div className="mt-8 p-6 bg-indigo-50 text-indigo-900 rounded-[2rem] border-2 border-indigo-100 text-sm whitespace-pre-wrap leading-relaxed relative animate-pulse">
                <button onClick={() => setAiResponse(null)} className="absolute top-4 right-4 text-indigo-300 font-bold">×</button>
                <div className="text-indigo-400 font-black mb-3 uppercase tracking-widest text-[10px] flex items-center">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></span>
                  Suggerimenti Gemini AI
                </div>
                {aiResponse}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-black text-slate-800 ml-6 tracking-tight">Sessioni Registrate ({selectedExp.sessions.length})</h3>
            {selectedExp.sessions.length === 0 && (
              <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 text-center">
                <p className="text-slate-400 font-medium">Ancora nessuna sessione per questo esperimento.</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {selectedExp.sessions.map(sess => (
                <div key={sess.id} className="bg-white p-6 rounded-[2.2rem] shadow-sm border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-all">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="font-bold text-slate-900">Sogg: {sess.subjectId}</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {sess.date} • {sess.durationMinutes} min • {sess.samplingRate}Hz • {sess.channelCount}CH
                    </div>
                  </div>
                  <button onClick={() => { 
                    setSelectedSessionId(sess.id);
                    setSessSubj(sess.subjectId);
                    setSessDuration(sess.durationMinutes);
                    setSessSampling(sess.samplingRate);
                    setSessChannels(sess.channelCount);
                    setSessNotes(sess.notes);
                    setCurrentView('EDIT_SESSION'); 
                  }} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modifica Esperimento View */}
      {currentView === 'EDIT_EXPERIMENT' && selectedExp && (
        <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 view-enter">
          <h2 className="text-2xl font-black mb-8 text-slate-800">Modifica Esperimento</h2>
          <form onSubmit={handleUpdateExperiment} className="space-y-6">
            <input type="text" required value={expTitle} onChange={e => setExpTitle(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" placeholder="Titolo" />
            <textarea value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none h-40" placeholder="Descrizione" />
            <select value={expStatus} onChange={e => setExpStatus(e.target.value as ExperimentStatus)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none font-bold">
              <option value={ExperimentStatus.PLANNING}>In Pianificazione</option>
              <option value={ExperimentStatus.ONGOING}>In Corso</option>
              <option value={ExperimentStatus.COMPLETED}>Completato</option>
              <option value={ExperimentStatus.ARCHIVED}>Archiviato</option>
            </select>
            <button type="submit" disabled={isActionLoading} className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all">Salva Modifiche</button>
            <button type="button" onClick={handleDeleteExperiment} disabled={isActionLoading} className="w-full py-2 text-red-500 font-bold">Elimina Esperimento</button>
            <button type="button" onClick={() => setCurrentView('EXPERIMENT_DETAILS')} className="w-full py-2 text-slate-400 font-bold">Annulla</button>
          </form>
        </div>
      )}

      {/* Modifica Sessione View */}
      {currentView === 'EDIT_SESSION' && selectedExp && (
        <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 view-enter">
          <h2 className="text-2xl font-black mb-8 text-slate-800">Dettagli Sessione</h2>
          <form onSubmit={handleUpdateSession} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-black uppercase text-slate-400 mb-1 ml-2 block">ID Soggetto</label>
              <input type="text" required value={sessSubj} onChange={e => setSessSubj(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div>
              <label className="text-xs font-black uppercase text-slate-400 mb-1 ml-2 block">Durata (min)</label>
              <input type="number" required value={sessDuration} onChange={e => setSessDuration(Number(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div>
              <label className="text-xs font-black uppercase text-slate-400 mb-1 ml-2 block">Sampling (Hz)</label>
              <input type="number" required value={sessSampling} onChange={e => setSessSampling(Number(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-black uppercase text-slate-400 mb-1 ml-2 block">Canali EEG</label>
              <input type="number" required value={sessChannels} onChange={e => setSessChannels(Number(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-black uppercase text-slate-400 mb-1 ml-2 block">Note Tecniche</label>
              <textarea value={sessNotes} onChange={e => setSessNotes(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none h-32" />
            </div>
            <button type="submit" disabled={isActionLoading} className="col-span-2 bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl mt-4">Aggiorna Sessione</button>
            <button type="button" onClick={handleDeleteSession} disabled={isActionLoading} className="col-span-2 text-red-500 font-bold py-2">Elimina Sessione</button>
            <button type="button" onClick={() => setCurrentView('EXPERIMENT_DETAILS')} className="col-span-2 text-slate-400 font-bold">Annulla</button>
          </form>
        </div>
      )}

      {currentView === 'ADD_SESSION' && (
        <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 view-enter">
          <h2 className="text-2xl font-black mb-8 text-slate-800">Nuova Sessione</h2>
          <form onSubmit={handleAddSession} className="grid grid-cols-2 gap-4">
            <input type="text" required placeholder="ID Soggetto (Es: SUB-001)" value={sessSubj} onChange={e => setSessSubj(e.target.value)} className="col-span-2 px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            <input type="number" required placeholder="Durata (min)" value={sessDuration} onChange={e => setSessDuration(Number(e.target.value))} className="px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            <input type="number" required placeholder="Sampling (Hz)" value={sessSampling} onChange={e => setSessSampling(Number(e.target.value))} className="px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            <input type="number" required placeholder="N. Canali (Es: 32)" value={sessChannels} onChange={e => setSessChannels(Number(e.target.value))} className="col-span-2 px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            <textarea placeholder="Note sull'impedenza, artefatti..." value={sessNotes} onChange={e => setSessNotes(e.target.value)} className="col-span-2 px-6 py-4 rounded-2xl bg-slate-50 outline-none h-32" />
            <button type="submit" disabled={isActionLoading} className="col-span-2 bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl mt-4">Salva Sessione</button>
            <button type="button" onClick={() => setCurrentView('EXPERIMENT_DETAILS')} className="col-span-2 text-slate-400 font-bold">Annulla</button>
          </form>
        </div>
      )}

      {currentView === 'MANAGE_USERS' && user?.role === 'Admin' && (
        <div className="max-w-4xl mx-auto space-y-8 view-enter pb-24">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Team del Lab</h2>
              <button onClick={async () => { const code = await dataService.generateInvite(); setGeneratedInvite(code); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-100">Crea Invito</button>
            </div>
            {generatedInvite && (
              <div className="mb-10 p-6 bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] flex justify-between items-center animate-bounce">
                <div>
                  <div className="text-[10px] font-black uppercase text-emerald-500 mb-1">Nuovo Codice Invito:</div>
                  <div className="text-2xl font-black text-emerald-700 tracking-widest uppercase">{generatedInvite}</div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(generatedInvite); alert("Codice Copiato!"); }} className="bg-white text-emerald-600 px-6 py-3 rounded-2xl font-black text-xs shadow-sm">COPIA</button>
              </div>
            )}
            <div className="space-y-4">
              {allUsers.length === 0 && <p className="text-center text-slate-400 font-medium py-10">Caricamento ricercatori...</p>}
              {allUsers.map(u => (
                <div key={u.id} className="flex justify-between items-center p-6 bg-slate-50 rounded-[2rem] border border-transparent hover:border-slate-200 transition-all">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xl">{u.name[0]}</div>
                    <div>
                      <div className="font-extrabold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </div>
                  </div>
                  <select value={u.role} onChange={(e) => dataService.updateUserRole(u.id, e.target.value as any).then(() => user && refreshData(user))} className="bg-white border-2 border-slate-100 rounded-xl text-xs font-black px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none uppercase tracking-tighter">
                    <option value="Admin">Admin</option>
                    <option value="Researcher">Researcher</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </Layout>
  );
};

export default App;

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
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const savedUser = localStorage.getItem('eeg_lab_active_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        const freshUser = await dataService.findUser(parsedUser.email);
        if (freshUser) {
          setUser(freshUser);
          await refreshData(freshUser.id);
          setCurrentView('DASHBOARD');
        }
      }
    };
    init();
  }, [refreshData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const found = await dataService.findUser(email);
    if (found) {
      setUser(found);
      localStorage.setItem('eeg_lab_active_user', JSON.stringify(found));
      await refreshData(found.id);
      setCurrentView('DASHBOARD');
    } else {
      alert("Utente non trovato.");
    }
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const role = await dataService.validateAndUseInvite(inviteCode);
    if (!role) {
      alert("Codice invito non valido.");
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
    setIsLoading(false);
  };

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
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
    const updated = { ...exp, title: expTitle, description: expDesc, status: expStatus };
    await dataService.updateExperiment(updated);
    await refreshData(user.id);
    setCurrentView('EXPERIMENT_DETAILS');
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const exp = experiments.find(e => e.id === selectedExperimentId);
    if (!exp || !user) return;
    setIsLoading(true);
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
    const updatedSessions = exp.sessions.map(s => 
      s.id === selectedSessionId 
        ? { ...s, subjectId: sessSubj, durationMinutes: sessDuration, samplingRate: sessSampling, channelCount: sessChannels, notes: sessNotes } 
        : s
    );
    await dataService.updateExperiment({ ...exp, sessions: updatedSessions });
    await refreshData(user.id);
    setCurrentView('EXPERIMENT_DETAILS');
  };

  const handleDeleteSession = async (sessionId: string) => {
    const exp = experiments.find(ex => ex.id === selectedExperimentId);
    if (!exp || !user || !confirm("Eliminare questa sessione definitivamente?")) return;
    setIsLoading(true);
    const updatedSessions = exp.sessions.filter(s => s.id !== sessionId);
    await dataService.updateExperiment({ ...exp, sessions: updatedSessions });
    await refreshData(user.id);
  };

  const handleDeleteExperiment = async (id: string) => {
    if (!user || !confirm("Eliminare l'intero esperimento e tutte le sessioni?")) return;
    setIsLoading(true);
    await dataService.deleteExperiment(id);
    await refreshData(user.id);
    setCurrentView('DASHBOARD');
  };

  const generateInvite = async () => {
    const code = await dataService.generateInvite();
    setGeneratedInvite(code);
  };

  const handleUpdateRole = async (userId: string, newRole: 'Admin' | 'Researcher') => {
    await dataService.updateUserRole(userId, newRole);
    const users = await dataService.getUsers();
    setAllUsers(users);
    if (userId === user?.id) setUser({ ...user, role: newRole });
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
              <input type="text" required placeholder="Richiedi ad un Admin" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
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
          </div>
        </div>
      )}

      {currentView === 'EXPERIMENT_DETAILS' && selectedExp && (
        <div className="space-y-6 view-enter">
          <div className="flex items-center space-x-4">
            <button onClick={() => setCurrentView('DASHBOARD')} className="p-3 bg-white rounded-2xl shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl font-black truncate flex-1">{selectedExp.title}</h1>
            <button onClick={() => handleEditExperimentClick(selectedExp)} className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-gray-50 shadow-sm space-y-4">
            <p className="text-gray-500 text-sm font-medium leading-relaxed">{selectedExp.description}</p>
            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
               <span className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedExp.status}</span>
               <button onClick={() => getAIProtocolAdvice(selectedExp)} disabled={aiLoading} className="flex items-center space-x-2 text-indigo-600 font-bold text-xs">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                 <span>{aiLoading ? 'Analisi...' : 'Protocolli AI'}</span>
               </button>
            </div>
          </div>

          {aiResponse && (
            <div className="bg-indigo-900 text-white p-8 rounded-[2rem] shadow-2xl relative view-enter overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-4">AI Insight Report</h4>
              <p className="text-sm font-medium leading-relaxed italic">"{aiResponse}"</p>
              <button onClick={() => setAiResponse(null)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-gray-900">Sessioni Acquisite</h2>
            <button onClick={() => setCurrentView('ADD_SESSION')} className="bg-white border border-gray-100 px-5 py-2 rounded-2xl text-xs font-black uppercase tracking-widest text-indigo-600 shadow-sm active:scale-95 transition-transform">Nuova</button>
          </div>

          <div className="space-y-4">
            {selectedExp.sessions.map(sess => (
              <div key={sess.id} className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm relative group overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-black text-gray-900">Soggetto {sess.subjectId}</div>
                    <div className="text-[10px] text-gray-300 font-bold tracking-widest">{sess.date}</div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => handleEditSessionClick(sess)} className="p-2 text-indigo-400 hover:text-indigo-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteSession(sess.id)} className="p-2 text-red-300 hover:text-red-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-widest mb-4">
                  <div className="bg-gray-50 p-3 rounded-2xl flex flex-col items-center">
                    <span className="text-gray-300 mb-1">Freq</span>
                    <span>{sess.samplingRate}Hz</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-2xl flex flex-col items-center">
                    <span className="text-gray-300 mb-1">Ch</span>
                    <span>{sess.channelCount}</span>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl text-xs font-medium text-gray-500 italic">"{sess.notes}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentView === 'CREATE_EXPERIMENT' && (
        <div className="max-w-xl mx-auto view-enter">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
            <h2 className="text-2xl font-black mb-8">Nuovo Progetto</h2>
            <form onSubmit={handleCreateExperiment} className="space-y-5">
              <input type="text" required placeholder="Nome dello studio" value={expTitle} onChange={e => setExpTitle(e.target.value)} 
                className="w-full p-5 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
              <textarea placeholder="Descrizione e ipotesi di ricerca..." value={expDesc} onChange={e => setExpDesc(e.target.value)} 
                className="w-full p-5 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 outline-none h-40 font-medium" />
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setCurrentView('DASHBOARD')} className="flex-1 p-5 bg-gray-100 rounded-2xl font-black text-gray-400 text-sm">Esci</button>
                <button type="submit" disabled={isLoading} className="flex-1 p-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100">Crea Studio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {currentView === 'EDIT_EXPERIMENT' && (
        <div className="max-w-xl mx-auto view-enter">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
            <h2 className="text-2xl font-black mb-8">Modifica Progetto</h2>
            <form onSubmit={handleUpdateExperiment} className="space-y-5">
              <input type="text" required value={expTitle} onChange={e => setExpTitle(e.target.value)} 
                className="w-full p-5 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
              <textarea value={expDesc} onChange={e => setExpDesc(e.target.value)} 
                className="w-full p-5 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 outline-none h-40 font-medium" />
              <select value={expStatus} onChange={e => setExpStatus(e.target.value as ExperimentStatus)} className="w-full p-5 bg-gray-50 rounded-2xl border-none outline-none font-bold">
                {Object.values(ExperimentStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setCurrentView('EXPERIMENT_DETAILS')} className="flex-1 p-5 bg-gray-100 rounded-2xl font-black text-gray-400 text-sm">Annulla</button>
                <button type="submit" disabled={isLoading} className="flex-1 p-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100">Salva Modifiche</button>
              </div>
              <button type="button" onClick={() => handleDeleteExperiment(selectedExperimentId!)} className="w-full text-red-500 font-bold text-xs mt-4">Elimina definitivamente questo studio</button>
            </form>
          </div>
        </div>
      )}

      {currentView === 'ADD_SESSION' && (
        <div className="max-w-xl mx-auto view-enter">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
            <h2 className="text-2xl font-black mb-8">Registra Dati</h2>
            <form onSubmit={handleAddSession} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required placeholder="Soggetto ID" value={sessSubj} onChange={e => setSessSubj(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-bold" />
                <input type="number" required placeholder="Minuti" value={sessDuration} onChange={e => setSessDuration(parseInt(e.target.value))} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Freq (Hz)" value={sessSampling} onChange={e => setSessSampling(parseInt(e.target.value))} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-bold" />
                <input type="number" placeholder="Canali" value={sessChannels} onChange={e => setSessChannels(parseInt(e.target.value))} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-bold" />
              </div>
              <textarea placeholder="Note tecniche..." value={sessNotes} onChange={e => setSessNotes(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl outline-none h-24 font-medium" />
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setCurrentView('EXPERIMENT_DETAILS')} className="flex-1 p-5 bg-gray-100 rounded-2xl font-black text-gray-400 text-sm">Annulla</button>
                <button type="submit" disabled={isLoading} className="flex-1 p-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100">Salva Sessione</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {currentView === 'EDIT_SESSION' && (
        <div className="max-w-xl mx-auto view-enter">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
            <h2 className="text-2xl font-black mb-8">Modifica Sessione</h2>
            <form onSubmit={handleUpdateSession} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required value={sessSubj} onChange={e => setSessSubj(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-bold" />
                <input type="number" required value={sessDuration} onChange={e => setSessDuration(parseInt(e.target.value))} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" value={sessSampling} onChange={e => setSessSampling(parseInt(e.target.value))} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-bold" />
                <input type="number" value={sessChannels} onChange={e => setSessChannels(parseInt(e.target.value))} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-bold" />
              </div>
              <textarea value={sessNotes} onChange={e => setSessNotes(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl outline-none h-24 font-medium" />
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setCurrentView('EXPERIMENT_DETAILS')} className="flex-1 p-5 bg-gray-100 rounded-2xl font-black text-gray-400 text-sm">Annulla</button>
                <button type="submit" disabled={isLoading} className="flex-1 p-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100">Aggiorna Dati</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {currentView === 'MANAGE_USERS' && user?.role === 'Admin' && (
        <div className="space-y-6 view-enter">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => setCurrentView('DASHBOARD')} className="p-3 bg-white rounded-2xl shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-black">Team Management</h1>
            </div>
            <button onClick={generateInvite} className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100">Nuovo Invito</button>
          </div>

          {generatedInvite && (
            <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between animate-bounce">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Codice Generato</p>
                <p className="text-2xl font-black tracking-widest">{generatedInvite}</p>
              </div>
              <button onClick={() => setGeneratedInvite(null)} className="p-2 bg-white/20 rounded-xl">OK</button>
            </div>
          )}

          <div className="bg-white rounded-[2rem] border border-gray-50 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {allUsers.map(u => (
                <div key={u.id} className="p-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-400 uppercase">
                      {u.name.substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-400 font-medium">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${u.role === 'Admin' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                      {u.role}
                    </span>
                    {u.id !== user.id && (
                      <button 
                        onClick={() => handleUpdateRole(u.id, u.role === 'Admin' ? 'Researcher' : 'Admin')}
                        className="p-2 text-gray-300 hover:text-indigo-600 transition-colors"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

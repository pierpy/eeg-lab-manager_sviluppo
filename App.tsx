
import * as React from 'react';
import { User, Experiment, ExperimentStatus, View, Session } from './types';
import Layout from './components/Layout';
import { suggestProtocols } from './services/geminiService';
import { dataService } from './services/dataService';

const { useState, useEffect, useCallback, useMemo } = React;

const [sessPhotoFiles, setSessPhotoFiles] = useState<File[]>([]);
const [sessPhotos, setSessPhotos] = useState<string[]>([]); // usato in EDIT_SESSION (urls esistenti)

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
  const [sessDate, setSessDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessDuration, setSessDuration] = useState(30);
  const [sessSampling, setSessSampling] = useState(512);
  const [sessChannels, setSessChannels] = useState(32);
  const [sessNotes, setSessNotes] = useState('');

  // Sincronizzazione dati
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

  // Inizializzazione sessione
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

  // Memoizzazione esperimento selezionato
  const selectedExp = useMemo(() => {
    if (!selectedExperimentId) return null;
    return experiments.find(e => String(e.id) === String(selectedExperimentId)) || null;
  }, [experiments, selectedExperimentId]);

  // Gestione Navigazione Centralizzata
  const navigateTo = (view: View) => {
    // Reset stati form quando si cambia vista
    if (view === 'CREATE_EXPERIMENT') {
      setExpTitle('');
      setExpDesc('');
      setExpStatus(ExperimentStatus.PLANNING);
    }
    if (view === 'ADD_SESSION') {
      setSessSubj('');
      setSessDate(new Date().toISOString().split('T')[0]);
      setSessDuration(30);
      setSessSampling(512);
      setSessChannels(32);
      setSessNotes('');
      setSessPhotoFiles([]);
      setSessPhotos([]);
    }
    if (view === 'DASHBOARD') {
      setSelectedExperimentId(null);
      setAiResponse(null);
    }
    setCurrentView(view);
  };

  // Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const found = await dataService.findUser(email);
      if (found) {
        setUser(found);
        localStorage.setItem('eeg_lab_active_user', JSON.stringify(found));
        await refreshData(found);
        navigateTo('DASHBOARD');
      } else {
        alert("Email non trovata.");
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
      navigateTo('DASHBOARD');
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
      navigateTo('DASHBOARD');
    } catch (err: any) {
      alert("Errore creazione: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExp || !user) return;
    setIsActionLoading(true);
    try {
      await dataService.updateExperiment({ ...selectedExp, title: expTitle, description: expDesc, status: expStatus });
      await refreshData(user);
      navigateTo('EXPERIMENT_DETAILS');
    } catch (err: any) {
      alert("Errore aggiornamento: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const handleDeleteExperiment = async () => {
    if (!selectedExperimentId || !user) return;
    if (!confirm("Eliminare definitivamente l'esperimento?")) return;
    setIsActionLoading(true);
    try {
      await dataService.deleteExperiment(selectedExperimentId);
      await refreshData(user);
      navigateTo('DASHBOARD');
    } catch (err: any) {
      alert("Errore eliminazione: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExp || !user) return;
    setIsActionLoading(true);
    try {
      const newSession: Session = {
        id: Math.random().toString(36).substr(2, 9),
        experimentId: selectedExp.id,
        subjectId: sessSubj,
        date: sessDate,
        durationMinutes: sessDuration,
        samplingRate: sessSampling,
        channelCount: sessChannels,
        notes: sessNotes,
        technicianName: user.name
      };
      await dataService.updateExperiment({ ...selectedExp, sessions: [...selectedExp.sessions, newSession] });
      await refreshData(user);
      navigateTo('EXPERIMENT_DETAILS');
    } catch (err: any) {
      alert("Errore sessione: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExp || !user || !selectedSessionId) return;
    setIsActionLoading(true);
    try {
      const updatedSessions = selectedExp.sessions.map(s =>
        String(s.id) === String(selectedSessionId)
          ? { ...s, subjectId: sessSubj, date: sessDate, durationMinutes: sessDuration, samplingRate: sessSampling, channelCount: sessChannels, notes: sessNotes }
          : s
      );
      await dataService.updateExperiment({ ...selectedExp, sessions: updatedSessions });
      await refreshData(user);
      navigateTo('EXPERIMENT_DETAILS');
    } catch (err: any) {
      alert("Errore aggiornamento sessione: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const handleDeleteSession = async () => {
    if (!selectedSessionId || !user) return;
    if (!confirm("Eliminare la sessione?")) return;
    setIsActionLoading(true);
    try {
      await dataService.deleteSession(selectedSessionId);
      await refreshData(user);
      navigateTo('EXPERIMENT_DETAILS');
    } catch (err: any) {
      alert("Errore eliminazione sessione: " + err.message);
    } finally { setIsActionLoading(false); }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const getAIProtocolAdvice = async (exp: Experiment) => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const advice = await suggestProtocols(exp);
      setAiResponse(advice);
    } catch (err: any) {
      setAiResponse("Errore AI. Controlla la connessione.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Layout
      user={user}
      onLogout={() => { setUser(null); localStorage.removeItem('eeg_lab_active_user'); navigateTo('LOGIN'); }}
      onNavigate={navigateTo}
    >
      {(isLoading || isActionLoading) && (
        <div className="fixed top-0 left-0 w-full h-1 bg-indigo-200 z-[200] overflow-hidden no-print">
          <div className="h-full bg-indigo-600 animate-[loading_1s_infinite_linear]"></div>
        </div>
      )}

      {currentView === 'LOGIN' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 mt-10 view-enter">
          <h2 className="text-3xl font-black text-gray-900 text-center mb-8 italic">EEG Lab</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl active:scale-95 transition-all">Accedi</button>
          </form>
          <button onClick={() => navigateTo('REGISTER')} className="w-full mt-6 text-indigo-600 font-bold py-2 text-sm border-t border-gray-50 pt-6 text-center block">Nuovo ricercatore? Registrati</button>
        </div>
      )}

      {currentView === 'REGISTER' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 mt-10 view-enter">
          <h2 className="text-2xl font-black mb-8 text-center">Registrazione</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <input type="text" required placeholder="Codice Invito" value={inviteCode} onChange={e => setInviteCode(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-indigo-50 border-2 border-indigo-100 font-bold uppercase tracking-widest text-center" />
            <input type="text" required placeholder="Nome e Cognome" value={name} onChange={e => setName(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none outline-none" />
            <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none outline-none" />
            <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none outline-none" />
            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl mt-4">Crea Account</button>
          </form>
          <button onClick={() => navigateTo('LOGIN')} className="w-full mt-4 text-gray-400 font-bold text-sm text-center block">Torna al login</button>
        </div>
      )}

      {currentView === 'DASHBOARD' && (
        <div className="space-y-8 view-enter">
          <div className="flex justify-between items-center bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-3xl font-black">Ciao, {user?.name.split(' ')[0]}</h1>
              <p className="opacity-80 text-sm">Gestisci i tuoi protocolli EEG</p>
            </div>
            <button onClick={() => navigateTo('CREATE_EXPERIMENT')} className="relative z-10 bg-white text-indigo-600 p-5 rounded-2xl shadow-lg active:scale-95 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="col-span-full flex items-center justify-between px-2">
              <h3 className="text-lg font-black text-slate-800">I tuoi Esperimenti</h3>
              <div className="flex items-center space-x-2">
                {user?.role === 'Admin' && (
                  <button onClick={() => navigateTo('MANAGE_USERS')} className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full hover:bg-slate-200 transition-colors">Admin Panel</button>
                )}
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{experiments.length}</span>
              </div>
            </div>
            {experiments.length === 0 && !isLoading && (
              <div className="col-span-full py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                <p className="text-slate-400">Ancora nessun esperimento inserito.</p>
              </div>
            )}
            {experiments.map(exp => (
              <div
                key={String(exp.id)}
                onClick={() => {
                  setSelectedExperimentId(String(exp.id));
                  navigateTo('EXPERIMENT_DETAILS');
                }}
                className="bg-white p-6 rounded-[2.2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-3 h-3 rounded-full ${exp.status === ExperimentStatus.ONGOING ? 'bg-emerald-400 animate-pulse' : 'bg-slate-200'}`}></div>
                  <span className="text-[10px] font-black uppercase text-slate-300">{exp.startDate}</span>
                </div>
                <h3 className="font-extrabold text-slate-900 mb-2 truncate group-hover:text-indigo-600">{exp.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 h-8">{exp.description || 'Senza descrizione.'}</p>
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">{exp.status}</span>
                  <span className="text-[10px] font-bold text-slate-300">{exp.sessions.length} Sessioni</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentView === 'EXPERIMENT_DETAILS' && (
        <div className="space-y-6 view-enter pb-20">
          {!selectedExp ? (
            <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100">
              <p className="text-slate-400 mb-6 font-bold">Caricamento esperimento...</p>
              <button onClick={() => navigateTo('DASHBOARD')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black">Torna alla Dashboard</button>
            </div>
          ) : (
            <>
              {/* Layout di stampa nascosto */}
              <div className="print-only print-container">
                <div className="report-header">
                  <h1 style={{ fontSize: '24pt', fontWeight: 'bold' }}>EEG Lab Manager - Report Esperimento</h1>
                  <p>Data Report: {new Date().toLocaleDateString()}</p>
                  <p>Ricercatore: {user?.name}</p>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '18pt', fontWeight: 'bold' }}>{selectedExp.title}</h2>
                  <p style={{ fontSize: '11pt', marginTop: '10px' }}>{selectedExp.description}</p>
                  <p style={{ marginTop: '5px' }}>Status: <strong>{selectedExp.status}</strong> | Data Inizio: {selectedExp.startDate}</p>
                </div>
                <h3>Lista Sessioni</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Soggetto</th>
                      <th>Durata</th>
                      <th>Sampling</th>
                      <th>Canali</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedExp.sessions.map(s => (
                      <tr key={s.id}>
                        <td>{s.date}</td>
                        <td>{s.subjectId}</td>
                        <td>{s.durationMinutes} min</td>
                        <td>{s.samplingRate} Hz</td>
                        <td>{s.channelCount}</td>
                        <td>{s.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 no-print">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">{selectedExp.title}</h2>
                    <p className="text-slate-500 text-sm whitespace-pre-wrap">{selectedExp.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={handleExportPDF} className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-colors" title="Esporta PDF">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    <button onClick={() => {
                      setExpTitle(selectedExp.title);
                      setExpDesc(selectedExp.description);
                      setExpStatus(selectedExp.status);
                      navigateTo('EDIT_EXPERIMENT');
                    }} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-50">
                  <button
                    onClick={() => getAIProtocolAdvice(selectedExp)}
                    disabled={aiLoading}
                    className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase flex items-center shadow-lg active:scale-95 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 ${aiLoading ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.657 15.657a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM16.464 14.95a1 1 0 10-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707z" /></svg>
                    {aiLoading ? 'Analisi...' : 'Suggerimenti AI'}
                  </button>
                  <button onClick={() => navigateTo('ADD_SESSION')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all">Nuova Sessione</button>
                  <button onClick={handleExportPDF} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Esporta Report
                  </button>
                </div>

                {aiResponse && (
                  <div className="mt-8 p-6 bg-indigo-50 text-indigo-900 rounded-[2rem] border-2 border-indigo-100 text-sm whitespace-pre-wrap leading-relaxed relative">
                    <button onClick={() => setAiResponse(null)} className="absolute top-4 right-4 text-indigo-300 font-bold">×</button>
                    <div className="text-indigo-400 font-black mb-3 uppercase tracking-widest text-[10px]">Gemini AI Insight</div>
                    {aiResponse}
                  </div>
                )}
              </div>

              <div className="space-y-4 no-print">
                <h3 className="text-xl font-black text-slate-800 ml-6">Sessioni ({selectedExp.sessions.length})</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedExp.sessions.map(sess => (
                    <div key={String(sess.id)} className="bg-white p-6 rounded-[2.2rem] shadow-sm border border-slate-100 flex justify-between items-center hover:border-indigo-200 transition-all">
                      <div>
                        <div className="font-bold text-slate-900">Sogg: {sess.subjectId}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{sess.date} • {sess.durationMinutes} min</div>
                      </div>
                      <button onClick={() => {
                        setSelectedSessionId(String(sess.id));
                        setSessSubj(sess.subjectId);
                        setSessDate(sess.date);
                        setSessDuration(sess.durationMinutes);
                        setSessSampling(sess.samplingRate);
                        setSessChannels(sess.channelCount);
                        setSessNotes(sess.notes);
                        setSessPhotos(sess.photos ?? []); // <<<<<< QUI
                        setSessPhotoFiles([]);           // <<<<<< QUI
                        navigateTo('EDIT_SESSION');
                      }} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {currentView === 'CREATE_EXPERIMENT' && (
        <div className="max-w-2xl mx-auto bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-2xl view-enter no-print">
          <h2 className="text-2xl font-black mb-8">Nuovo Esperimento</h2>
          <form onSubmit={handleCreateExperiment} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 ml-2">Titolo Progetto</label>
              <input type="text" required placeholder="Es: Studio sulla memoria a breve termine" value={expTitle} onChange={e => setExpTitle(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 ml-2">Descrizione</label>
              <textarea placeholder="Descrizione e obbiettivi scientifici..." value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none h-40 focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none" />
            </div>
            <div className="pt-4 space-y-4">
              <button type="submit" disabled={isActionLoading} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50">Crea Progetto</button>
              <button type="button" onClick={() => navigateTo('DASHBOARD')} className="w-full text-slate-400 font-bold py-2 text-center block hover:text-slate-600">Annulla</button>
            </div>
          </form>
        </div>
      )}

      {currentView === 'EDIT_EXPERIMENT' && selectedExp && (
        <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-2xl view-enter no-print">
          <h2 className="text-2xl font-black mb-8">Gestisci Esperimento</h2>
          <form onSubmit={handleUpdateExperiment} className="space-y-6">
            <input type="text" required value={expTitle} onChange={e => setExpTitle(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            <textarea value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none h-40" />
            <select value={expStatus} onChange={e => setExpStatus(e.target.value as ExperimentStatus)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none font-bold">
              <option value={ExperimentStatus.PLANNING}>In Pianificazione</option>
              <option value={ExperimentStatus.ONGOING}>In Corso</option>
              <option value={ExperimentStatus.COMPLETED}>Completato</option>
              <option value={ExperimentStatus.ARCHIVED}>Archiviato</option>
            </select>
            <button type="submit" disabled={isActionLoading} className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl">Salva Modifiche</button>
            <button type="button" onClick={handleDeleteExperiment} className="w-full text-red-500 font-bold py-2 text-center block">Elimina Esperimento</button>
            <button type="button" onClick={() => navigateTo('EXPERIMENT_DETAILS')} className="w-full text-slate-400 font-bold py-2 text-center block">Torna indietro</button>
          </form>
        </div>
      )}

      {currentView === 'ADD_SESSION' && selectedExp && (
        <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-2xl view-enter no-print">
          <h2 className="text-2xl font-black mb-8">Registra Sessione</h2>
          <form onSubmit={handleAddSession} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">ID Soggetto</label>
              <input type="text" required placeholder="Es: SUBJ-001" value={sessSubj} onChange={e => setSessSubj(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data Registrazione</label>
              <input type="date" required value={sessDate} onChange={e => setSessDate(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Durata (min)</label>
              <input type="number" required placeholder="min" value={sessDuration} onChange={e => setSessDuration(Number(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sampling (Hz)</label>
              <input type="number" required placeholder="Hz" value={sessSampling} onChange={e => setSessSampling(Number(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Numero Canali</label>
              <input type="number" required placeholder="Es: 32" value={sessChannels} onChange={e => setSessChannels(Number(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Note Sessione</label>
              <textarea placeholder="Note tecniche..." value={sessNotes} onChange={e => setSessNotes(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none h-32" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Foto (opzionali)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setSessPhotoFiles(Array.from(e.target.files || []))}
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none"
              />
            </div>
            <button type="submit" disabled={isActionLoading} className="col-span-2 bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl mt-4 active:scale-95 transition-transform">Salva Sessione</button>
            <button type="button" onClick={() => navigateTo('EXPERIMENT_DETAILS')} className="col-span-2 text-slate-400 font-bold py-2 text-center block">Annulla</button>
          </form>
        </div>
      )}

      {currentView === 'EDIT_SESSION' && selectedExp && (
        <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-2xl view-enter no-print">
          <h2 className="text-2xl font-black mb-8">Dettagli Sessione</h2>
          <form onSubmit={handleUpdateSession} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">ID Soggetto</label>
              <input type="text" required value={sessSubj} onChange={e => setSessSubj(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data Registrazione</label>
              <input type="date" required value={sessDate} onChange={e => setSessDate(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Durata (min)</label>
              <input type="number" required value={sessDuration} onChange={e => setSessDuration(Number(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sampling (Hz)</label>
              <input type="number" required value={sessSampling} onChange={e => setSessSampling(Number(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Numero Canali</label>
              <input type="number" required value={sessChannels} onChange={e => setSessChannels(Number(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Note Sessione</label>
              <textarea value={sessNotes} onChange={e => setSessNotes(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 outline-none h-32" />
            </div>
            <button type="submit" disabled={isActionLoading} className="col-span-2 bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-xl mt-4">Aggiorna</button>
            <button type="button" onClick={handleDeleteSession} className="col-span-2 text-red-500 font-bold py-2 text-center block">Elimina Sessione</button>
            <button type="button" onClick={() => navigateTo('EXPERIMENT_DETAILS')} className="col-span-2 text-slate-400 font-bold py-2 text-center block">Torna indietro</button>
          </form>
        </div>
      )}

      {currentView === 'MANAGE_USERS' && user?.role === 'Admin' && (
        <div className="max-w-4xl mx-auto space-y-8 view-enter pb-24 no-print">
          <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Team del Lab</h2>
              <button
                onClick={async () => {
                  setIsActionLoading(true);
                  try {
                    const code = await dataService.generateInvite();
                    setGeneratedInvite(code);
                  } catch (e) {
                    alert("Errore generazione invito");
                  } finally {
                    setIsActionLoading(false);
                  }
                }}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all"
              >
                Crea Codice Invito
              </button>
            </div>

            {generatedInvite && (
              <div className="mb-10 p-6 bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] flex flex-col sm:flex-row justify-between items-center animate-bounce gap-4">
                <div className="text-center sm:text-left">
                  <div className="text-[10px] font-black uppercase text-emerald-500 mb-1">Nuovo Codice Invito Ricercatore:</div>
                  <div className="text-3xl font-black text-emerald-700 tracking-widest uppercase select-all">{generatedInvite}</div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedInvite);
                    alert("Codice Copiato in memoria!");
                  }}
                  className="bg-white text-emerald-600 px-6 py-3 rounded-2xl font-black text-xs shadow-sm hover:shadow-md transition-shadow"
                >
                  COPIA CODICE
                </button>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest ml-4 mb-2">Membri Attivi ({allUsers.length})</h3>
              {allUsers.length === 0 && <p className="text-center text-slate-400 font-medium py-10 italic">Nessun ricercatore registrato oltre a te.</p>}
              {allUsers.map(u => (
                <div key={u.id} className="flex flex-col sm:flex-row justify-between items-center p-6 bg-slate-50 rounded-[2rem] border border-transparent hover:border-slate-200 transition-all gap-4">
                  <div className="flex items-center space-x-4 w-full">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xl shadow-inner uppercase">{u.name[0]}</div>
                    <div className="truncate">
                      <div className="font-extrabold text-slate-900 truncate">{u.name}</div>
                      <div className="text-xs text-slate-400 truncate">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <span className="text-[10px] font-black uppercase text-slate-300">Ruolo:</span>
                    <select
                      value={u.role}
                      onChange={(e) => {
                        const newRole = e.target.value as any;
                        if (confirm(`Cambiare il ruolo di ${u.name} in ${newRole}?`)) {
                          dataService.updateUserRole(u.id, newRole).then(() => user && refreshData(user));
                        }
                      }}
                      className="w-full sm:w-auto bg-white border-2 border-slate-100 rounded-xl text-[10px] font-black px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none uppercase tracking-tighter shadow-sm"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Researcher">Ricercatore</option>
                    </select>
                  </div>
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
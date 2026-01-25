
import * as React from 'react';
import { User, View } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onNavigate: (view: View) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onNavigate }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <button 
            onClick={() => onNavigate('DASHBOARD')}
            className="flex items-center space-x-2 text-xl font-black tracking-tight active:scale-95 transition-all"
          >
            <div className="bg-white text-indigo-700 p-1.5 rounded-lg shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="hidden xs:block">EEG Lab</span>
          </button>
          
          {user && (
            <div className="flex items-center space-x-2 sm:space-x-3">
              {user.role === 'Admin' && (
                <button 
                  onClick={() => onNavigate('MANAGE_USERS')}
                  className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors border border-white/10 flex items-center space-x-2"
                  title="Gestione Team"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Team</span>
                </button>
              )}
              
              <div className="flex flex-col items-end mr-1 sm:mr-2">
                <span className="text-[9px] sm:text-[10px] font-black uppercase opacity-60 tracking-tighter">{user.role}</span>
                <span className="text-xs sm:text-sm font-bold truncate max-w-[80px] sm:max-w-[120px]">{user.name.split(' ')[0]}</span>
              </div>
              
              <button 
                onClick={onLogout}
                className="bg-white/10 hover:bg-white/20 p-2 sm:p-2.5 rounded-xl transition-colors border border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-8 pb-32">
        {children}
      </main>

      {user && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-900/90 text-white flex items-center px-6 py-4 rounded-[2.5rem] shadow-2xl backdrop-blur-xl border border-white/10 z-[100] sm:hidden w-[90%] max-w-[340px] justify-between">
          <button onClick={() => onNavigate('DASHBOARD')} className="p-2 active:scale-90 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button onClick={() => onNavigate('CREATE_EXPERIMENT')} className="bg-white text-indigo-900 p-3 rounded-full shadow-lg active:scale-90 transition-transform -translate-y-2 border-4 border-indigo-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button onClick={() => onNavigate('MANAGE_USERS')} className={`p-2 active:scale-90 transition-transform ${user.role !== 'Admin' ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        </nav>
      )}
    </div>
  );
};

export default Layout;

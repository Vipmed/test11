/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import TestScreen from "./components/TestScreen";
import TestBase from "./components/TestBase";
import Analytics from "./components/Analytics";
import AdminPanel from "./components/AdminPanel";
import SavedQuestions from "./components/SavedQuestions";
import Settings from "./components/Settings";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import { AuthProvider, useAuth } from "./context/AuthContext";

import { XCircle, Menu } from "lucide-react";
import { auth } from "@/src/lib/firebase";
import { motion, AnimatePresence } from "motion/react";

function AuthenticatedApp() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isAuthenticated = !!user;

  useEffect(() => {
    setIsSidebarOpen(false);
    document.getElementById('main-scroll-container')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (profile?.settings?.theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [profile?.settings?.theme]);

  if (isAuthenticated && profile && !profile.isApproved && profile.role !== 'SUPERADMIN') {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-[2rem] text-center space-y-6">
           <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
              <XCircle className="w-8 h-8 text-red-500" />
           </div>
           <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Доступ обмежено</h2>
           <p className="text-slate-400 text-sm leading-relaxed italic">
             Ваш акаунт очікує на підтвердження адміністратором (Босом). 
             Будь ласка, зачекайте, поки ваша заявка буде перевірена.
           </p>
           <button 
            onClick={() => auth.signOut()}
            className="w-full py-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
           >
             Вийти
           </button>
        </div>
      </div>
    );
  }

  const isTestPage = location.pathname === "/test";

  return (
    <div className="flex h-screen bg-bg-main text-slate-200 overflow-hidden relative">
      {isAuthenticated && !isTestPage && (
        <>
          {/* Mobile Overlay */}
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[40] lg:hidden"
              />
            )}
          </AnimatePresence>

          <Sidebar user={user} profile={profile} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </>
      )}
      
      <main className="flex-1 overflow-auto relative flex flex-col">
        {isAuthenticated && !isTestPage && (
          <header className="lg:hidden h-14 border-b border-slate-800 flex items-center px-4 shrink-0 bg-bg-side z-[30]">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link to="/" onClick={() => document.getElementById('main-scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' })} className="ml-3 flex items-center gap-2 cursor-pointer outline-none">
              <div className="w-2 h-2 bg-accent rounded-sm"></div>
              <span className="font-bold text-sm text-white">MedTest Pro</span>
            </Link>
          </header>
        )}

        <div id="main-scroll-container" className="flex-1 overflow-auto">
          <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
          <Route 
            path="/" 
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/test" 
            element={isAuthenticated ? <TestScreen /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/test-base" 
            element={isAuthenticated ? <TestBase /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/analytics" 
            element={isAuthenticated ? <Analytics /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/admin" 
            element={isAuthenticated && (profile?.role === 'SUPERADMIN' || profile?.role === 'ADMIN') ? <AdminPanel /> : <Navigate to="/" />} 
          />
          <Route 
            path="/saved" 
            element={isAuthenticated ? <SavedQuestions /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/settings" 
            element={isAuthenticated ? <Settings /> : <Navigate to="/login" />} 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </main>
  </div>
);
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AuthenticatedApp />
      </Router>
    </AuthProvider>
  );
}

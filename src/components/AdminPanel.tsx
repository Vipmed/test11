import React, { useState } from "react";
import { Users, Database, FileText, Activity, Server, Info, Shield } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import UsersTab from "./admin/UsersTab";
import DatabaseTab from "./admin/DatabaseTab";
import ReportsTab from "./admin/ReportsTab";
import LogsTab from "./admin/LogsTab";
import SystemTab from "./admin/SystemTab";
import { db } from "@/src/lib/firebase";
import { collection, query, getDocs, updateDoc, doc, deleteDoc, writeBatch, where, orderBy } from "firebase/firestore";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'database' | 'reports' | 'logs' | 'system'>('users');
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void; hideCancel?: boolean; requiredWord?: string } | null>(null);
  const [promptModal, setPromptModal] = useState<{ message: string; defaultValue: string; onConfirm: (val: string) => void } | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [confirmInput, setConfirmInput] = useState("");

  const showAlert = (message: string) => {
     setConfirmModal({
        message,
        hideCancel: true,
        onConfirm: () => {
          setConfirmModal(null);
          setConfirmInput("");
        }
     });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-bg-main min-h-screen">
      <AnimatePresence>
        {confirmModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6"
          >
             <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
             >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-orange-500" />
                <h3 className="text-xl font-black text-white mb-4">Підтвердження дії</h3>
                <p className="text-xs text-slate-400 mb-6 font-mono leading-relaxed">
                  {confirmModal.message}
                  {confirmModal.requiredWord && (
                    <span className="block mt-4 text-rose-500">
                      Введіть слово <span className="text-white font-black">"{confirmModal.requiredWord}"</span> для підтвердження:
                    </span>
                  )}
                </p>

                {confirmModal.requiredWord && (
                  <input 
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                    placeholder={confirmModal.requiredWord}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-[10px] font-black uppercase tracking-widest placeholder:text-slate-700 focus:outline-none focus:border-rose-500 transition-colors mb-8"
                  />
                )}

                <div className="flex gap-3">
                  {!confirmModal.hideCancel && (
                     <button 
                       onClick={() => {
                         setConfirmModal(null);
                         setConfirmInput("");
                       }}
                       className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
                     >
                       Скасувати
                     </button>
                  )}
                  <button 
                    onClick={() => {
                      confirmModal.onConfirm();
                      setConfirmInput("");
                    }}
                    disabled={!!confirmModal.requiredWord && confirmInput !== confirmModal.requiredWord}
                    className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:grayscale text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-rose-500/20"
                  >
                    Зрозуміло
                  </button>
                </div>
             </motion.div>
          </motion.div>
        )}

        {promptModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6"
          >
             <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
             >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-blue-500" />
                <h3 className="text-xl font-black text-white mb-4">Зміна назви</h3>
                <p className="text-xs text-slate-400 mb-6 font-mono leading-relaxed">{promptModal.message}</p>
                <input 
                   type="text"
                   value={promptValue}
                   onChange={(e) => setPromptValue(e.target.value)}
                   className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 mb-8 text-sm text-white focus:outline-none focus:border-accent"
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setPromptModal(null)}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Скасувати
                  </button>
                  <button 
                    onClick={() => promptModal.onConfirm(promptValue)}
                    className="flex-1 py-4 bg-accent hover:bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-accent/20"
                  >
                    Зберегти
                  </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-orange-500/10 rounded-2xl">
                 <Shield className="text-orange-500 w-5 h-5" />
              </div>
              <div>
                 <h1 className="text-2xl font-black text-white tracking-tight">Панель Управління</h1>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Супер-Адміністратор</p>
              </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-8 bg-slate-900/50 p-2 rounded-3xl border border-slate-800/50 backdrop-blur-sm">
        {[
          { id: 'users', label: 'Доступи', icon: Users },
          { id: 'database', label: 'Бази та Імпорт', icon: Database },
          { id: 'reports', label: 'Репорти', icon: FileText },
          { id: 'logs', label: 'Аудит', icon: Activity },
          { id: 'system', label: 'Система', icon: Server }
        ].map((t) => (
           <button
             key={t.id}
             onClick={() => setActiveTab(t.id as any)}
             className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
              ${activeTab === t.id ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-slate-500 hover:text-white"}`}
           >
             <t.icon className="w-3.5 h-3.5" />
             <span className="hidden sm:inline">{t.label}</span>
           </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
      {activeTab === 'users' && (
        <motion.div 
          key="users"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <UsersTab showAlert={showAlert} setConfirmModal={setConfirmModal} />
        </motion.div>
      )}

      {activeTab === 'database' && (
        <motion.div 
          key="database"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <DatabaseTab 
             showAlert={showAlert} 
             setPromptModal={setPromptModal} 
             setPromptValue={setPromptValue}
             setConfirmModal={setConfirmModal} 
          />
        </motion.div>
      )}

      {activeTab === 'reports' && (
        <motion.div 
          key="reports"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <ReportsTab showAlert={showAlert} setConfirmModal={setConfirmModal} />
        </motion.div>
      )}

      {activeTab === 'logs' && (
        <motion.div 
          key="logs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <LogsTab />
        </motion.div>
      )}

      {activeTab === 'system' && (
        <motion.div 
          key="system"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <SystemTab setConfirmModal={setConfirmModal} />
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-8 bg-orange-950/10 border border-orange-900/20 p-6 rounded-3xl flex gap-4">
          <Info className="w-5 h-5 text-orange-500 shrink-0" />
          <p className="text-xs text-orange-400 font-medium leading-relaxed">
            <b>Порада Боса:</b> Тільки схвалені (Approved) користувачі зможуть використовувати AI-підказки та переглядати розширену базу тестів. Нові реєстрації за замовчуванням мають статус "Заблоковано".
          </p>
      </div>
    </div>
  );
}

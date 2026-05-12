import React, { useEffect, useState } from "react";
import { Crown, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { doc, onSnapshot, updateDoc, setDoc, getDoc, collectionGroup, getDocs, writeBatch, collection } from "firebase/firestore";
import { logEvent, AuditEventType } from "@/src/lib/audit";

export default function SystemTab({ 
  setConfirmModal 
}: { 
  setConfirmModal: (modal: any) => void 
}) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reseting, setReseting] = useState(false);
  const [actionProgress, setActionProgress] = useState<string | null>(null);
  const [logs, setLogs] = useState<{msg: string, type: 'info' | 'success' | 'error'}[]>([]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [{msg, type}, ...prev].slice(0, 5));
  };

  useEffect(() => {
    const docRef = doc(db, "system", "config");
    // ...
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setConfig(snap.data());
      } else {
        // Initialize if not exists
        const defaultConfig = {
          aiExplain: true,
          autoApprove: false,
          sessionLimit: true,
          updatedAt: new Date()
        };
        setDoc(docRef, defaultConfig);
        setConfig(defaultConfig);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleSetting = async (key: string, currentValue: boolean) => {
    try {
      const docRef = doc(db, "system", "config");
      await updateDoc(docRef, {
        [key]: !currentValue,
        updatedAt: new Date()
      });
      logEvent(AuditEventType.SYSTEM_CONFIG_CHANGE, `${key.toUpperCase()}: ${!currentValue}`);
    } catch (err) {
      console.error("Failed to update config", err);
    }
  };

  const clearSavedQuestions = async () => {
    setReseting(true);
    setActionProgress("questions");
    addLog("Початок очищення збережених питань...", "info");
    try {
      // Fetching without order to avoid index requirements for simple listing
      const qGroup = collectionGroup(db, "questions");
      const qSnap = await getDocs(qGroup);
      const qDocs = qSnap.docs.filter(d => d.ref.path.includes("saved_questions"));
      
      if (qDocs.length === 0) {
        addLog("Збережених питань не знайдено", "info");
        setReseting(false);
        setActionProgress(null);
        return;
      }

      let deletedCount = 0;
      for (let i = 0; i < qDocs.length; i += 400) {
         const batch = writeBatch(db);
         const chunk = qDocs.slice(i, i + 400);
         chunk.forEach(d => batch.delete(d.ref));
         await batch.commit();
         deletedCount += chunk.length;
         addLog(`Видалено... ${deletedCount}/${qDocs.length}`, "info");
      }
      addLog(`Успішно видалено ${deletedCount} питань`, "success");
      logEvent(AuditEventType.SYSTEM_CONFIG_CHANGE, `CLEANUP: Deleted ${deletedCount} saved questions`);
    } catch (err: any) {
      console.error("Cleanup Error:", err);
      addLog(`Помилка: ${err.message}`, "error");
      handleFirestoreError(err, OperationType.DELETE, "saved_questions/**/*");
    } finally {
      setReseting(false);
      setActionProgress(null);
      setConfirmModal(null);
    }
  };

  const clearAttempts = async () => {
    setReseting(true);
    setActionProgress("attempts");
    addLog("Початок очищення історії спроб...", "info");
    try {
      const aGroup = collectionGroup(db, "attempts");
      const aSnap = await getDocs(aGroup);
      const aDocs = aSnap.docs;
      
      if (aDocs.length === 0) {
        addLog("Історії спроб не знайдено", "info");
        setReseting(false);
        setActionProgress(null);
        return;
      }

      let deletedCount = 0;
      for (let i = 0; i < aDocs.length; i += 400) {
         const batch = writeBatch(db);
         const chunk = aDocs.slice(i, i + 400);
         chunk.forEach(d => batch.delete(d.ref));
         await batch.commit();
         deletedCount += chunk.length;
         addLog(`Видалено... ${deletedCount}/${aDocs.length}`, "info");
      }
      addLog(`Успішно видалено ${deletedCount} записів`, "success");
      logEvent(AuditEventType.SYSTEM_CONFIG_CHANGE, `CLEANUP: Deleted ${deletedCount} attempts`);
    } catch (err: any) {
      console.error("Cleanup Error:", err);
      addLog(`Помилка: ${err.message}`, "error");
      handleFirestoreError(err, OperationType.DELETE, "attempts/**/*");
    } finally {
      setReseting(false);
      setActionProgress(null);
      setConfirmModal(null);
    }
  };

  const resetUserAnalytics = async () => {
    setReseting(true);
    setActionProgress("stats");
    addLog("Скидання аналітики користувачів...", "info");
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const userDocs = usersSnap.docs;
      
      if (userDocs.length === 0) {
         addLog("Користувачів не знайдено", "info");
         setReseting(false);
         setActionProgress(null);
         return;
      }

      for (let i = 0; i < userDocs.length; i += 400) {
         const batch = writeBatch(db);
         const chunk = userDocs.slice(i, i + 400);
         chunk.forEach(d => {
            batch.update(d.ref, {
               stats: { totalSolved: 0, totalCorrect: 0, byCategory: {}, activity: {} },
               streak: 0,
               progress: {}
            });
         });
         await batch.commit();
         addLog(`Оновлено... ${Math.min((i+400), userDocs.length)}/${userDocs.length}`, "info");
      }
      addLog(`Скинуто статистику для ${userDocs.length} користувачів`, "success");
      logEvent(AuditEventType.SYSTEM_CONFIG_CHANGE, `CLEANUP: Reset analytics for ${userDocs.length} users`);
    } catch (err: any) {
      console.error("Cleanup Error:", err);
      addLog(`Помилка: ${err.message}`, "error");
      handleFirestoreError(err, OperationType.UPDATE, "users");
    } finally {
      setReseting(false);
      setActionProgress(null);
      setConfirmModal(null);
    }
  };

  const clearAuditLogs = async () => {
    setReseting(true);
    setActionProgress("logs");
    addLog("Видалення системних логів...", "info");
    try {
      const logsSnap = await getDocs(collection(db, "audit_logs"));
      const logDocs = logsSnap.docs;
      
      if (logDocs.length === 0) {
        addLog("Логів не знайдено", "info");
        setReseting(false);
        setActionProgress(null);
        return;
      }

      let deletedCount = 0;
      for (let i = 0; i < logDocs.length; i += 400) {
         const batch = writeBatch(db);
         const chunk = logDocs.slice(i, i + 400);
         chunk.forEach(d => batch.delete(d.ref));
         await batch.commit();
         deletedCount += chunk.length;
         addLog(`Видалено... ${deletedCount}/${logDocs.length}`, "info");
      }
      addLog(`Видалено ${deletedCount} логів`, "success");
    } catch (err: any) {
      console.error("Cleanup Error:", err);
      addLog(`Помилка: ${err.message}`, "error");
      handleFirestoreError(err, OperationType.DELETE, "audit_logs");
    } finally {
      setReseting(false);
      setActionProgress(null);
      setConfirmModal(null);
    }
  };

  const requestAction = (type: string, title: string, fn: () => void) => {
    setConfirmModal({
      message: `Ви намагаєтесь виконати дію: "${title}". Це неможливо буде відмінити.`,
      requiredWord: "ВИДАЛИТИ",
      onConfirm: fn
    });
  };


  if (loading) {
     return (
        <div className="flex items-center justify-center py-20 lg:col-span-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
     );
  }

  const settings = [
    { key: "aiExplain", label: "AI Розбір", desc: "Вказувати AI причину помилки", value: config?.aiExplain },
    { key: "autoApprove", label: "Автоматичне схвалення", desc: "Схвалювати студентів з доменом @tnmu.edu.ua", value: config?.autoApprove },
    { key: "sessionLimit", label: "Обмеження сесій", desc: "Заборона одночасного входу з різних пристроїв", value: config?.sessionLimit }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Конфігурація</h3>
            <div className="space-y-4">
                {settings.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-6 bg-slate-950 border border-slate-800 rounded-[2rem] min-h-[110px]">
                    <div className="pr-4 flex-1">
                        <p className="text-sm font-black text-white uppercase mb-1 leading-tight tracking-tight">{item.label}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="flex items-center justify-center pt-1">
                    <div 
                      onClick={() => toggleSetting(item.key, item.value)}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-colors cursor-pointer shrink-0 border border-slate-800",
                        item.value ? "bg-accent shadow-[0_0_15px_rgba(59,130,246,0.5)] border-accent/20" : "bg-slate-900"
                    )}>
                        <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-xl",
                            item.value ? "right-1" : "left-1"
                        )} />
                    </div>
                    </div>
                </div>
                ))}
            </div>
        </div>

        <div className="lg:col-span-6 space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center">
              <Crown className="w-16 h-16 text-orange-500/20 mb-6" />
              <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">Версія Системи 2.4-tnmu</h3>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-8">
                  Побудовано на AI-архітектурі для швидкої обробки баз тестів. Всі дані зашифровані.
              </p>
              <button className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
              Check for updates
              </button>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/10 rounded-[2.5rem] p-8">
              <div className="flex items-center gap-3 mb-4">
                 <AlertTriangle className="w-5 h-5 text-rose-500" />
                 <h3 className="text-sm font-black text-rose-500 uppercase tracking-widest">Небезпечна зона</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-6 leading-relaxed">
                 Використовуйте ці інструменти для вибіркового очищення даних.
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => requestAction("questions", "Очистити збережені питання", clearSavedQuestions)}
                  disabled={reseting}
                  className="w-full flex items-center justify-between px-6 py-4 bg-rose-500/10 hover:bg-rose-500 group rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                   <span className="text-rose-500 group-hover:text-white">Очистити збережені питання</span>
                   {actionProgress === "questions" ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Trash2 className="w-4 h-4 text-rose-500 group-hover:text-white" />}
                </button>

                <button 
                  onClick={() => requestAction("attempts", "Очистити історію спроб", clearAttempts)}
                  disabled={reseting}
                  className="w-full flex items-center justify-between px-6 py-4 bg-rose-500/10 hover:bg-rose-500 group rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                   <span className="text-rose-500 group-hover:text-white">Очистити історію спроб</span>
                   {actionProgress === "attempts" ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Trash2 className="w-4 h-4 text-rose-500 group-hover:text-white" />}
                </button>

                <button 
                  onClick={() => requestAction("stats", "Скинути аналітику профілів", resetUserAnalytics)}
                  disabled={reseting}
                  className="w-full flex items-center justify-between px-6 py-4 bg-rose-500/10 hover:bg-rose-500 group rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                   <span className="text-rose-500 group-hover:text-white">Скинути аналітику профілів</span>
                   {actionProgress === "stats" ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Trash2 className="w-4 h-4 text-rose-500 group-hover:text-white" />}
                </button>

                <div className="pt-4 mt-4 border-t border-rose-500/10" />

                <button 
                  onClick={() => requestAction("logs", "Видалити всі системні логи", clearAuditLogs)}
                  disabled={reseting}
                  className="w-full flex items-center justify-between px-6 py-4 bg-slate-800 hover:bg-slate-700 group rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                   <span className="text-slate-400 group-hover:text-white">Видалити всі системні логи</span>
                   {actionProgress === "logs" ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Trash2 className="w-4 h-4 text-slate-500 group-hover:text-white" />}
                </button>

                {logs.length > 0 && (
                  <div className="mt-6 p-4 bg-black/40 rounded-2xl border border-slate-800 space-y-2 overflow-hidden">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Останні дії</p>
                    {logs.map((log, idx) => (
                      <div key={idx} className={cn(
                        "text-[10px] font-bold uppercase tracking-tight flex items-center gap-2",
                        log.type === 'success' ? "text-emerald-500" : log.type === 'error' ? "text-rose-500" : "text-slate-400"
                      )}>
                        <div className={cn("w-1 h-1 rounded-full", log.type === 'success' ? "bg-emerald-500" : log.type === 'error' ? "bg-rose-500" : "bg-slate-500")} />
                        {log.msg}
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>
        </div>
    </div>
  );
}

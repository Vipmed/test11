import React, { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { db } from "@/src/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export default function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "audit_logs"),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => {
        const data = doc.data();
        let timestamp = "Зараз";
        if (data.timestamp) {
          const date = data.timestamp.toDate();
          timestamp = `${date.toLocaleDateString()} | ${date.toLocaleTimeString()}`;
        }
        return { id: doc.id, ...data, timestampStr: timestamp };
      });
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleExportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `medtest_logs_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-sm font-black text-white uppercase tracking-widest">Аудит-лог</h3>
        <button 
          onClick={handleExportLogs} 
          disabled={logs.length === 0}
          className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          Експорт (.json)
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Завантаження журналу...</p>
          </div>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Час</th>
                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Подія</th>
                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Деталі</th>
                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Користувач</th>
                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/20 transition-colors font-mono text-xs">
                  <td className="py-4 text-slate-400 px-4">{log.timestampStr}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded inline-block text-[10px] uppercase font-bold ${
                      log.event === 'USER_BLOCKED' || log.event === 'USER_DELETED' ? 'bg-rose-500/10 text-rose-500' :
                      log.event === 'DB_IMPORT' || log.event === 'USER_CREATED' ? 'bg-emerald-500/10 text-emerald-500' :
                      log.event === 'USER_LOGIN' ? 'bg-emerald-500/10 text-emerald-500' :
                      log.event === 'DB_DELETE' || log.event === 'QUESTION_DELETE' ? 'bg-rose-500/10 text-rose-500' :
                      log.event === 'SAVED_QUESTION' ? 'bg-indigo-500/10 text-indigo-500' :
                      log.event === 'REPORT_SUBMITTED' || log.event === 'REPORT_ACTION' ? 'bg-amber-500/10 text-amber-500' :
                      log.event === 'USER_APPROVED' || log.event === 'USER_ROLE_CHANGE' ? 'bg-blue-500/10 text-blue-500' :
                      log.event === 'SYSTEM_CONFIG_CHANGE' || log.event === 'QUESTION_EDIT' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {log.event === 'USER_BLOCKED' ? 'БЛОКУВАННЯ' :
                      log.event === 'USER_DELETED' ? 'ВИДАЛЕННЯ КОРИСТУВАЧА' :
                      log.event === 'DB_IMPORT' ? 'ІМПОРТ БД' :
                      log.event === 'USER_CREATED' ? 'СТВОРЕННЯ КОРИСТУВАЧА' :
                      log.event === 'USER_LOGIN' ? 'ВХІД' :
                      log.event === 'DB_DELETE' ? 'ВИДАЛЕННЯ БД' :
                      log.event === 'QUESTION_DELETE' ? 'ВИДАЛЕННЯ ПИТАННЯ' :
                      log.event === 'SAVED_QUESTION' ? 'ЗБЕРЕЖЕННЯ' :
                      log.event === 'REPORT_SUBMITTED' ? 'СКАРГА' :
                      log.event === 'REPORT_ACTION' ? 'ДІЯ ЗІ СКАРГОЮ' :
                      log.event === 'USER_APPROVED' ? 'СХВАЛЕННЯ' :
                      log.event === 'USER_ROLE_CHANGE' ? 'ЗМІНА РОЛІ' :
                      log.event === 'SYSTEM_CONFIG_CHANGE' ? 'НАЛАШТУВАННЯ' :
                      log.event === 'QUESTION_EDIT' ? 'РЕДАГУВАННЯ ПИТАННЯ' :
                      log.event}
                    </span>
                  </td>
                  <td className="py-4 text-slate-300 truncate max-w-xs" title={log.detail}>{log.detail}</td>
                  <td className="py-4 text-slate-400">{log.email || "Система"}</td>
                  <td className="py-4 text-slate-500">{log.ip}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    Журнал порожній
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

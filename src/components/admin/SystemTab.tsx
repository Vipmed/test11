import React, { useEffect, useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/lib/firebase";
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { logEvent, AuditEventType } from "@/src/lib/audit";

export default function SystemTab() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "system", "config");
    
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:col-span-12">
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
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
    </div>
  );
}

import { useState } from "react";
import { User, Mail, Shield, Bell, Lock, Save, Trash2, Info, GraduationCap, Stethoscope, Snowflake, Sun, Edit3 } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { logEvent, AuditEventType } from "@/src/lib/audit";

export default function Settings() {
  const { user, profile, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const avatars = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Kiki",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Loki",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Sasha",
  ];

  const handleAvatarSelect = async (url: string) => {
    setIsSaving(true);
    await updateProfile({ avatarUrl: url });
    logEvent(AuditEventType.SYSTEM_CONFIG_CHANGE, `Changed avatar`, user?.uid, user?.email || undefined);
    setShowAvatarModal(false);
    setIsSaving(false);
  };

  const tabs = [
    { id: "profile", label: "Профіль", icon: User },
    { id: "features", label: "Додатки", icon: Save },
    { id: "security", label: "Безпека", icon: Lock },
    { id: "notifications", label: "Сповіщення", icon: Bell },
  ];

  const toggleSetting = async (id: string) => {
    if (!profile) return;
    
    if (id === "aiEnabled" || id === "sidebarEnabled") {
      alert("Цей функціонал знаходиться в розробці.");
      return;
    }

    setIsSaving(true);
    const newSettings = { 
      ...profile.settings, 
      [id]: !profile.settings?.[id] 
    };
    await updateProfile({ settings: newSettings });
    logEvent(AuditEventType.SYSTEM_CONFIG_CHANGE, `Toggle ${id}: ${newSettings[id]}`, user?.uid, user?.email || undefined);
    setIsSaving(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-bg-main min-h-screen">
      <AnimatePresence>
        {showAvatarModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6"
          >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
               className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] p-8 shadow-3xl text-center"
             >
                <h2 className="text-xl font-black text-white uppercase tracking-tight mb-8">Оберіть Аватар</h2>
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {avatars.map((url, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleAvatarSelect(url)}
                      className="w-full aspect-square rounded-2xl border border-slate-800 hover:border-accent transition-all overflow-hidden p-1"
                    >
                      <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover rounded-xl" />
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAvatarModal(false)} className="text-slate-500 uppercase text-[10px] font-black tracking-widest hover:text-white transition-colors">Скасувати</button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-10">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Налаштування акаунту</h1>
        <p className="text-slate-500 text-sm">Керуйте своїм профілем та налаштуваннями доступу.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Tabs */}
        <div className="w-full lg:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all uppercase tracking-widest",
                activeTab === tab.id 
                  ? "bg-accent text-white shadow-lg shadow-blue-500/20" 
                  : "text-slate-500 hover:text-white hover:bg-slate-900"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {activeTab === "profile" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
                <div className="flex items-center gap-6">
                   <div 
                     onClick={() => setShowAvatarModal(true)}
                     className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-4xl font-bold shadow-2xl cursor-pointer hover:ring-4 ring-accent/30 transition-all overflow-hidden relative group"
                   >
                      {profile?.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : user?.photoURL ? (
                        <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        user?.email?.[0].toUpperCase() || "U"
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 className="w-6 h-6 text-white" />
                      </div>
                   </div>
                   <div>
                      <h2 className="text-xl font-bold text-white mb-1">{user?.displayName || user?.email?.split('@')[0]}</h2>
                      <div className="flex items-center gap-2">
                        {(profile?.role === 'ADMIN' || profile?.role === 'SUPERADMIN') && (
                          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono uppercase font-black tracking-widest">
                            {profile?.role}
                          </span>
                        )}
                        {profile?.isApproved && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-black tracking-widest uppercase border border-emerald-500/20">
                            Схвалено
                          </span>
                        )}
                      </div>
                   </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail Адреса</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input 
                        type="text" 
                        readOnly
                        value={user?.email || ""}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-400 font-mono cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {(profile?.role === 'ADMIN' || profile?.role === 'SUPERADMIN') && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Роль у системі</label>
                      <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        <input 
                          type="text" 
                          readOnly
                          value={profile?.role === 'SUPERADMIN' ? "Супербос" : profile?.role || "Користувач"}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-400 font-mono cursor-not-allowed"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Курс</label>
                      <select 
                        value={profile?.course || ""}
                        onChange={(e) => updateProfile({ course: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white font-bold outline-none focus:border-accent"
                      >
                        {[1, 2, 3, 4, 5, 6].map(c => <option key={c} value={c}>{c} Курс</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Спеціальність</label>
                      <select 
                        value={profile?.specialty || ""}
                        onChange={(e) => updateProfile({ specialty: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white font-bold outline-none focus:border-accent"
                      >
                        <option value="med">Медицина</option>
                        <option value="dent">Стоматологія</option>
                        <option value="pharm">Фармація</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Сесія</label>
                      <select 
                        value={profile?.sessionType || ""}
                        onChange={(e) => updateProfile({ sessionType: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white font-bold outline-none focus:border-accent"
                      >
                        <option value="winter">Зимова</option>
                        <option value="summer">Літня</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                   <button className="flex items-center gap-2 bg-accent text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-blue-600 transition-all uppercase tracking-widest shadow-lg shadow-blue-500/10 active:scale-95 disabled:opacity-50">
                     <Save className="w-4 h-4" />
                     Зберегти зміни
                   </button>
                </div>
              </div>

              <div className="bg-red-950/10 border border-red-900/20 rounded-3xl p-8">
                 <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Небезпечна зона
                 </h3>
                 {profile?.role === 'SUPERADMIN' ? (
                   <>
                     <p className="text-xs text-red-400/80 mb-6 leading-relaxed">
                       Видалення акаунту призведе до повної втрати вашого прогресу, збережених питань та аналітики. Цю дію неможливо скасувати.
                     </p>
                     <button className="text-xs font-black uppercase text-red-500 hover:underline">
                        Видалити мій акаунт назавжди
                     </button>
                   </>
                 ) : (
                   <p className="text-xs text-slate-500 leading-relaxed italic">
                     Тільки СУПЕРБОС (Superadmin) може видаляти акаунти. Будь ласка, зверніться до підтримки, якщо вам потрібно видалити свій профіль.
                   </p>
                 )}
              </div>
            </motion.div>
          )}

          {activeTab === "features" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[var(--bg-side)] border border-[var(--border-dim)] rounded-3xl p-8 space-y-6"
            >
              <h3 className="text-lg font-bold text-[var(--text-bold)] mb-6 uppercase tracking-tighter">Налаштування AI та Інтерфейсу</h3>
              
              <div className="space-y-4">
                 <div className="mb-6 p-5 bg-[var(--bg-main)] border border-[var(--border-dim)] rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-[var(--text-bold)] uppercase tracking-tight">Тема оформлення</p>
                        <p className="text-[10px] text-[var(--muted)] uppercase font-black tracking-widest">Обрано: {profile?.settings?.theme === 'light' ? 'Світла' : 'Темна'}</p>
                    </div>
                  <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-dim)]">
                        <button 
                          onClick={() => updateProfile({ settings: { ...profile?.settings, theme: 'light' } })}
                          className={cn("px-4 py-2 rounded-lg text-xs font-black uppercase transition-all", profile?.settings?.theme === 'light' ? "bg-accent text-white" : "text-[var(--muted)] hover:text-[var(--text-bold)]")}
                        >
                          Світла
                        </button>
                        <button 
                          onClick={() => updateProfile({ settings: { ...profile?.settings, theme: 'dark' } })}
                          className={cn("px-4 py-2 rounded-lg text-xs font-black uppercase transition-all", (!profile?.settings?.theme || profile?.settings?.theme === 'dark') ? "bg-accent text-white" : "text-[var(--muted)] hover:text-[var(--text-bold)]")}
                        >
                          Темна
                        </button>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] ml-1">Асистент та Панель</p>
                    {[
                      { id: "aiEnabled", label: "AI Пояснення (В розробці)", desc: "Автоматично розбирати питання за допомогою AI" },
                      { id: "sidebarEnabled", label: "Панель аналізу (В розробці)", desc: "Бічна панель з AI-аналізом (тільки для десктопів)" },
                    ].map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-5 bg-[var(--bg-main)] border border-[var(--border-dim)] rounded-2xl hover:border-accent/30 transition-all">
                          <div>
                              <p className="text-sm font-bold text-[var(--text-bold)] uppercase tracking-tight">{item.label}</p>
                              <p className="text-[10px] text-[var(--muted)]">{item.desc}</p>
                          </div>
                          <button 
                            onClick={() => toggleSetting(item.id)}
                            disabled={isSaving || item.id === "aiEnabled" || item.id === "sidebarEnabled"}
                            className={cn(
                            "w-11 h-5 rounded-full relative transition-all duration-300",
                            (item.id !== "aiEnabled" && item.id !== "sidebarEnabled" && profile?.settings?.[item.id]) ? "bg-accent shadow-lg shadow-blue-500/30" : "bg-slate-300 dark:bg-slate-800",
                            (item.id === "aiEnabled" || item.id === "sidebarEnabled") && "opacity-50 cursor-not-allowed"
                            )}
                          >
                              <div className={cn(
                                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                (item.id !== "aiEnabled" && item.id !== "sidebarEnabled" && profile?.settings?.[item.id]) ? "right-1" : "left-1"
                              )} />
                          </button>
                        </div>
                    ))}
                 </div>
              </div>
              
              <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10 flex gap-4">
                 <Info className="w-5 h-5 text-accent shrink-0" />
                 <p className="text-[10px] text-[var(--muted)] leading-normal italic">
                   Ці параметри впливають на зручність підготовки. AI-аналіз доступний лише у режимах "Тренування" та "Бліц".
                 </p>
              </div>
            </motion.div>
          )}

          {activeTab === "security" && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
             >
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-orange-500" />
                   </div>
                   <div>
                      <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Налаштування безпеки</h3>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Двофакторна автентифікація та пароль</p>
                   </div>
                </div>
                
                <div className="space-y-4 opacity-50 filter grayscale pointer-events-none mb-8">
                   {[
                     { label: "Двофакторна автентифікація", desc: "Додатковий захист за допомогою OTP", value: "Вимкнено" },
                     { label: "Зміна пароля", desc: "Оновити ваш пароль доступу", value: "*******" },
                   ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-5 bg-slate-950 border border-slate-800 rounded-2xl">
                         <div>
                            <p className="text-sm font-bold text-white uppercase">{item.label}</p>
                            <p className="text-[10px] text-slate-500">{item.desc}</p>
                         </div>
                         <div className="text-xs font-mono text-slate-600">{item.value}</div>
                      </div>
                   ))}
                </div>

                <div className="p-6 bg-orange-950/20 border border-orange-500/20 rounded-2xl">
                  <div className="flex gap-4">
                     <Info className="w-5 h-5 text-orange-500 shrink-0" />
                     <div>
                        <p className="text-xs font-bold text-orange-100 uppercase mb-1">Інформація по 2FA</p>
                        <p className="text-[10px] text-orange-200/60 leading-relaxed italic">
                           Ви увійшли через сторонній сервіс автентифікації. 
                           Керування безпекою, двофакторною автентифікацією (2FA) та зміна пароля здійснюються 
                           безпосередньо в налаштуваннях вашого акаунта.
                        </p>
                     </div>
                  </div>
                </div>
             </motion.div>
          )}

          {activeTab === "notifications" && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
             >
                <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-tighter">Сповіщення</h3>
                <div className="space-y-4">
                   {[
                     { id: "notifyNewBases", label: "Нові бази тестів", desc: "Сповіщати про оновлення питань від ТНМУ" },
                     { id: "notifyAiReports", label: "AI Коментарі", desc: "Отримувати тижневий звіт з аналізом AI" },
                     { id: "notifyStreak", label: "Смуга успіху", desc: "Нагадування про щоденні сесії" }
                   ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                         <div>
                            <p className="text-sm font-bold text-white uppercase tracking-tight">{item.label}</p>
                            <p className="text-[10px] text-slate-500">{item.desc}</p>
                         </div>
                         <div 
                           onClick={() => toggleSetting(item.id)}
                           className={cn(
                             "w-10 h-5 rounded-full relative cursor-pointer transition-all",
                             profile?.settings?.[item.id] ? "bg-accent" : "bg-slate-800 border border-slate-700"
                           )}
                         >
                            <div className={cn(
                              "absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-all",
                              profile?.settings?.[item.id] ? "right-1" : "left-1"
                            )} />
                         </div>
                      </div>
                   ))}
                </div>
             </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

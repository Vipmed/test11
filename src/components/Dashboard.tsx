import { motion, AnimatePresence } from "motion/react";
import { Play, Flame, Trophy, Save, Search, AlertCircle, Clock, Zap, BarChart2, GraduationCap, ArrowRight, BookOpen } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/src/context/AuthContext";
import { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

export default function Dashboard() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState<any>({});
  const [showOnboarding, setShowOnboarding] = useState(!profile?.course);
  const [bases, setBases] = useState<any[]>([]);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const fetchBases = async () => {
      try {
        const q = query(collection(db, "bases"), orderBy("createdAt", "desc"), limit(4));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setBases(data.filter((b: any) => b.status === "Active" || !b.status));
      } catch (err) {
        console.error("Failed to fetch bases", err);
      }
    };
    fetchBases();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, 'saved_questions', user.uid, 'questions'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setErrorCount(snap.size);
    }, (err) => {
      console.error("Failed to sync error count", err);
    });
    
    return () => unsubscribe();
  }, [user?.uid]);

  const nextStep = async (data: any) => {
    const newData = { ...onboardingData, ...data };
    setOnboardingData(newData);
    
    if (onboardingStep < 3) {
      setOnboardingStep(prev => prev + 1);
    } else {
      await updateProfile(newData);
      setShowOnboarding(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-12">
      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="bg-[var(--bg-side)] border border-[var(--border-dim)] w-full max-w-2xl rounded-[3rem] p-12 shadow-3xl text-center"
             >
                <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-accent/20">
                   <GraduationCap className="w-8 h-8 text-accent" />
                </div>

                {onboardingStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h2 className="text-3xl font-black text-[var(--text-bold)] uppercase tracking-tighter mb-4">На якому ви курсі?</h2>
                    <p className="text-[var(--muted)] mb-10 max-w-md mx-auto text-sm">Це допоможе AI підібрати актуальні питання до сесії.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-left">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <button 
                          key={i} 
                          onClick={() => nextStep({ course: i.toString() })}
                          className="p-6 bg-[var(--bg-main)] border border-[var(--border-dim)] rounded-3xl hover:border-accent group transition-all"
                        >
                          <p className="text-lg font-black text-[var(--text-bold)] uppercase group-hover:text-accent">{i} Курс</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {onboardingStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h2 className="text-3xl font-black text-[var(--text-bold)] uppercase tracking-tighter mb-4">Ваша спеціальність?</h2>
                    <p className="text-[var(--muted)] mb-10 max-w-md mx-auto text-sm">Оберіть ваш факультет або напрямок навчання.</p>
                    <div className="grid grid-cols-1 gap-4 text-left">
                      {[
                        { id: 'med', label: 'Медицина' },
                        { id: 'dent', label: 'Стоматологія' },
                        { id: 'pharm', label: 'Фармація' },
                      ].map(s => (
                        <button 
                          key={s.id} 
                          onClick={() => nextStep({ specialty: s.id })}
                          className="p-6 bg-[var(--bg-main)] border border-[var(--border-dim)] rounded-3xl hover:border-accent group transition-all"
                        >
                          <p className="text-lg font-black text-[var(--text-bold)] uppercase group-hover:text-accent">{s.label}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {onboardingStep === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h2 className="text-3xl font-black text-[var(--text-bold)] uppercase tracking-tighter mb-4">До якої сесії готуємось?</h2>
                    <p className="text-[var(--muted)] mb-10 max-w-md mx-auto text-sm">Це останній крок для персоналізації вашої бази тестів.</p>
                    <div className="grid grid-cols-2 gap-4 text-left">
                      {[
                        { id: 'winter', label: 'Зимова сесія' },
                        { id: 'summer', label: 'Літня сесія' },
                      ].map(s => (
                        <button 
                          key={s.id} 
                          onClick={() => nextStep({ sessionType: s.id })}
                          className="p-8 bg-[var(--bg-main)] border border-[var(--border-dim)] rounded-3xl hover:border-accent group transition-all text-center"
                        >
                          <p className="text-lg font-black text-[var(--text-bold)] uppercase group-hover:text-accent">{s.label}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
                
                <div className="mt-8 flex justify-between items-center px-4">
                  <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={cn("w-2 h-2 rounded-full", i === onboardingStep ? "bg-accent" : "bg-[var(--border-dim)]")} />
                    ))}
                  </div>
                  <button 
                    onClick={() => setShowOnboarding(false)}
                    className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest hover:text-[var(--text-bold)] transition-colors"
                  >
                    Пропустити
                  </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-bold)]">Головна Панель</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Видання Senior v2.4 • Вітаємо, Босе.</p>
        </div>
        <div className="flex gap-2">
            <div className="bg-[var(--bg-side)] border border-[var(--border-dim)] px-4 py-2 rounded-xl flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span className="font-mono font-bold text-[var(--text-bold)] uppercase tracking-tight">
                  {profile?.streak || 0} ДНІВ СЕРІЇ
                </span>
            </div>
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* Speed Run Logic */}
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="col-span-12 lg:col-span-8 bg-[var(--bg-side)]/40 border border-[var(--border-dim)] p-8 rounded-[2rem] group relative overflow-hidden h-72 flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap className="w-48 h-48 text-[var(--text-main)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-accent font-bold uppercase tracking-widest mb-4">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              Тренування Speed-Run
            </div>
            <h2 className="text-3xl font-bold max-w-md text-[var(--text-bold)] leading-tight">
              {bases.length > 0 ? bases[0].name : "Турбо-база тестів 2024"}
            </h2>
            <p className="text-[var(--muted)] text-sm mt-3 max-w-sm">
              {bases.length > 0 ? `Доступно ${bases[0].count} питань. ` : ""}
              Оптимізовано для швидкого запам'ятовування з автоматичним переходом та КШ.
            </p>
          </div>
          <Link to="/test-base" className="mt-4 inline-flex items-center gap-2 bg-accent text-white px-8 py-3.5 rounded-2xl font-bold text-sm min-w-fit w-max hover:bg-blue-600 transition-all z-10 shadow-lg shadow-blue-500/20 active:scale-95">
            Почати Сесію
            <Play className="w-4 h-4 fill-white" />
          </Link>
        </motion.div>

        {/* Stress Test */}
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="col-span-12 md:col-span-6 lg:col-span-4 bg-[var(--bg-side)] border border-[var(--border-dim)] p-8 rounded-[2rem] flex flex-col justify-between"
        >
          <div>
            <Trophy className="w-8 h-8 text-yellow-500 mb-6" />
            <h3 className="text-xl font-bold text-[var(--text-bold)] uppercase tracking-tight">Стрес-Тест</h3>
            <p className="text-[var(--muted)] text-sm mt-2">200 випадкових питань. Без підказок. Жорсткий таймер 200 хв. Симуляція іспиту.</p>
          </div>
          <Link to="/test-base?mode=stress" className="mt-8 text-center w-full border border-[var(--border-dim)] hover:bg-[var(--bg-card)] py-4 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest text-[var(--muted)] hover:text-[var(--text-bold)]">
            Почати Іспит
          </Link>
        </motion.div>

        {/* Saved Folders */}
        <Link to="/saved" className="col-span-12 md:col-span-6 lg:col-span-4 bg-[var(--bg-side)]/40 border border-[var(--border-dim)] p-8 rounded-[2rem] flex flex-col items-center justify-center gap-4 group cursor-pointer hover:bg-[var(--bg-side)]/60 transition-colors">
            <Save className="w-10 h-10 text-[var(--muted)] group-hover:text-[var(--text-bold)] transition-colors" />
            <span className="text-xs font-black font-mono tracking-[0.3em] text-[var(--muted)] uppercase group-hover:text-[var(--text-main)]">Збережені матеріали</span>
        </Link>

        {/* Analytics Mini Heatmap */}
        <div className="col-span-12 md:col-span-9 lg:col-span-6 bg-[var(--bg-side)]/40 border border-[var(--border-dim)] p-8 rounded-[2rem]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-[var(--muted)]">
                <BarChart2 className="w-4 h-4" />
                Глобальна Активність
            </h3>
            <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className={cn("w-2 h-2 rounded-sm", i === 3 ? "bg-accent" : "bg-[var(--border-dim)]")} />
                ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const activityData = profile?.stats?.activity || {};
              return Array.from({ length: 112 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (111 - i));
                const dateStr = d.toISOString().split('T')[0];
                const count = activityData[dateStr] || 0;
                const bg = count > 50 ? "bg-accent" : count > 20 ? "bg-accent/60" : count > 0 ? "bg-accent/30" : "bg-[var(--border-dim)]";
                return (
                  <div 
                    key={i} 
                    title={`${dateStr}: ${count} питань`}
                    className={cn("w-[10px] h-[10px] rounded-[2px] transition-colors duration-500", bg)} 
                  />
                );
              });
            })()}
          </div>
        </div>

        {/* Search */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-[var(--bg-side)] border border-[var(--border-dim)] p-8 rounded-[2rem]">
           <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] group-focus-within:text-accent transition-colors" />
              <input 
                type="text" 
                placeholder="Пошук в базах (G/K)..." 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    window.location.href = `/test?search=${encodeURIComponent(e.currentTarget.value)}`;
                  }
                }}
                className="w-full bg-[var(--bg-main)] border border-[var(--border-dim)] rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono text-[var(--text-bold)]"
              />
           </div>
           <div className="mt-4 flex flex-wrap gap-2">
              {["Гематологія", "Анатомія", "Патологія"].map(tag => (
                <Link 
                  key={tag} 
                  to={`/test-base?category=${tag}`}
                  className="text-[9px] uppercase font-mono tracking-widest px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-md text-[var(--muted)] hover:text-[var(--text-bold)] cursor-pointer transition-colors"
                >
                  {tag}
                </Link>
              ))}
           </div>
        </div>

        {/* Weak Point / Error Tracker */}
        <motion.div 
          whileHover={{ scale: 1.01 }}
          onClick={() => navigate('/saved')}
          className="col-span-12 lg:col-span-8 bg-red-950/10 border border-red-900/20 p-8 rounded-[2rem] flex items-center justify-between cursor-pointer hover:bg-red-950/20 transition-all group"
        >
           <div className="flex items-start gap-6">
              <div className="w-14 h-14 rounded-2xl bg-red-900/20 flex items-center justify-center flex-shrink-0 border border-red-900/30 group-hover:bg-red-900/40 transition-colors">
                 <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                 <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-2 leading-none">ПОКАЗНИК ЗБЕРЕЖЕНИХ ПИТАНЬ</h4>
                 <p className="text-xl text-red-500 leading-relaxed font-black uppercase tracking-tight">
                    <b>{errorCount}</b> Збережених питань
                 </p>
                 <p className="text-[10px] text-red-500/60 uppercase font-bold tracking-widest mt-1">Опрацьовувати збережені питання та помилки</p>
              </div>
           </div>
           <ArrowRight className="w-6 h-6 text-red-900/40 group-hover:text-red-500 transition-all group-hover:translate-x-1" />
        </motion.div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Book, GraduationCap, Clock, Zap, Target, ArrowRight, Database, Snowflake, Sun, Settings, AlertCircle, RefreshCw, Trash2, X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useAuth } from "@/src/context/AuthContext";
import { db } from "@/src/lib/firebase";
import { collection, query, where, getDocs, orderBy, writeBatch } from "firebase/firestore";

const MODES = [
  { id: 'practice', name: 'Тренування', icon: Book, desc: 'Питання за темами, AI підказки увімкнені.', color: 'text-blue-500' },
  { id: 'speed', name: 'Бліц-опитування', icon: Zap, desc: 'Випадкові питання на швидкість (1.5с на відповідь).', color: 'text-amber-500' },
  { id: 'exam', name: 'Імітація Іспиту', icon: Target, desc: 'Контрольна робота: обмежений час, без підказок.', color: 'text-red-500' },
  { id: 'stress', name: 'Стрес-Тест', icon: Zap, desc: 'До 200 питань, 200 хвилин. Справжня імітація екзамена.', color: 'text-orange-500' }
];

const ERROR_MODES = [
  { id: 'check', name: 'Перевірити помилки', icon: AlertCircle, desc: 'Перегляд питань, у яких ви помилилися.', color: 'text-red-500' },
  { id: 'practice_err', name: 'Пройти помилки', icon: RefreshCw, desc: 'Тренування виключно по вашим помилкам.', color: 'text-orange-500' },
  { id: 'clear', name: 'Очистити', icon: Trash2, desc: 'Скинути історію ваших помилок.', color: 'text-slate-500' }
];

export default function TestBase() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [questionLimit, setQuestionLimit] = useState<number | 'all'>('all');
  const [showChangeContext, setShowChangeContext] = useState(false);
  const [courseSubjects, setCourseSubjects] = useState<any[]>([]);
  const [loadingBases, setLoadingBases] = useState(true);
  const [totalQuestionsInSystem, setTotalQuestionsInSystem] = useState(0);

  const initialMode = searchParams.get('mode');

  const LIMITS = [24, 48, 80, 'all'];
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [errorCounts, setErrorCounts] = useState<Record<string, number>>({});

  const fetchErrorCounts = useCallback(async () => {
    if (!profile?.uid) return;
    try {
      const q = query(collection(db, "saved_questions", profile.uid, "questions"));
      const snap = await getDocs(q);
      const counts: Record<string, number> = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.baseId) {
          counts[data.baseId] = (counts[data.baseId] || 0) + 1;
        }
      });
      setErrorCounts(counts);
    } catch (err) {
      console.error("Error fetching error counts:", err);
    }
  }, [profile?.uid]);

  useEffect(() => {
    fetchErrorCounts();
  }, [fetchErrorCounts]);

  useEffect(() => {
    const fetchBases = async () => {
      setLoadingBases(true);
      if (!profile?.course || !profile?.uid) {
        setLoadingBases(false);
        return;
      }
      try {
        const qAll = query(collection(db, "bases"), where("status", "==", "Active"));
        const snapAll = await getDocs(qAll);
        const total = snapAll.docs.reduce((acc, d) => acc + (d.data().count || 0), 0);
        setTotalQuestionsInSystem(total);

        const q = query(
          collection(db, "bases"), 
          where("course", "==", String(profile.course)),
          where("specialty", "==", profile.specialty || "med"),
          where("status", "==", "Active")
        );
        const snap = await getDocs(q);
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        
        if (profile?.sessionType) {
          data = data.filter((b: any) => b.session === profile.sessionType);
        }

        setCourseSubjects(data.length > 0 ? data : []);
      } catch (error) {
        console.error("Error fetching bases", error);
      } finally {
        setLoadingBases(false);
      }
    };
    fetchBases();
  }, [profile?.course, profile?.sessionType, profile?.specialty, profile?.uid]);

  const handleStartTest = (modeId: string) => {
    navigate(`/test?mode=${modeId}&subject=${selectedSubjects.join(',')}&limit=${questionLimit}`);
  };

  useEffect(() => {
    if (selectedSubjects.length > 0) {
      setTimeout(() => {
        const element = document.getElementById('modes-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [selectedSubjects]);

  const handleChangeContext = async (data: any) => {
    await updateProfile(data);
    setShowChangeContext(false);
  };

  const groupedSubjects = courseSubjects.reduce((acc, sub) => {
    if (sub.folderName) {
      if (!acc[`folder_${sub.folderName}`]) acc[`folder_${sub.folderName}`] = { type: 'folder', name: sub.folderName, items: [] };
      acc[`folder_${sub.folderName}`].items.push(sub);
    } else {
      acc[sub.id] = { type: 'single', item: sub };
    }
    return acc;
  }, {} as Record<string, any>);

  const [subjectSearch, setSubjectSearch] = useState("");
  
  const filteredGroupedSubjects = Object.keys(groupedSubjects).reduce((acc, key) => {
    const group = groupedSubjects[key];
    if (group.type === 'folder') {
      const filteredItems = group.items.filter((item: any) => 
        item.name.toLowerCase().includes(subjectSearch.toLowerCase())
      );
      if (filteredItems.length > 0) {
        acc[key] = { ...group, items: filteredItems };
      }
    } else {
      if (group.item.name.toLowerCase().includes(subjectSearch.toLowerCase())) {
        acc[key] = group;
      }
    }
    return acc;
  }, {} as Record<string, any>);

  const toggleFolder = (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  const isFolderSelected = (folderKey: string) => {
    const items = groupedSubjects[folderKey]?.items || [];
    return items.every((i: any) => selectedSubjects.includes(i.id)) && items.length > 0;
  };

  const handleSelectGroup = (key: string, type: 'folder' | 'single') => {
    if (type === 'single') {
      const id = groupedSubjects[key].item.id;
      if (initialMode === 'stress') {
        navigate(`/test?mode=stress&subject=${id}`);
      } else {
        setSelectedSubjects(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      }
    } else {
      const items = groupedSubjects[key].items.map((i: any) => i.id);
      if (initialMode === 'stress') {
        navigate(`/test?mode=stress&subject=${items.join(',')}`);
      } else {
        if (isFolderSelected(key)) {
          setSelectedSubjects(prev => prev.filter(id => !items.includes(id)));
        } else {
          setSelectedSubjects(prev => Array.from(new Set([...prev, ...items])));
        }
      }
    }
  };

  if (!profile?.course) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-6">
          <Settings className="w-8 h-8 text-slate-500" />
        </div>
        <h2 className="text-2xl font-black text-[var(--text-bold)] uppercase mb-4">Налаштуйте профіль</h2>
        <p className="text-[var(--muted)] max-w-sm mb-8">Щоб ми знали, які тести вам показувати, будь ласка, оберіть ваш курс та спеціальність в налаштуваннях або на головній панелі.</p>
        <button 
          onClick={() => navigate('/settings')}
          className="bg-accent text-white px-8 py-3 rounded-xl font-bold uppercase text-xs tracking-widest"
        >
          До налаштувань
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 pb-20 relative">
      <AnimatePresence>
        {showChangeContext && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.9, y: 20 }}
               className="bg-[var(--bg-side)] border border-[var(--border-dim)] w-full max-w-md rounded-[2.5rem] p-8 shadow-3xl relative"
             >
                <button onClick={() => setShowChangeContext(false)} className="absolute top-6 right-6 text-[var(--muted)] hover:text-[var(--text-bold)]">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-black text-[var(--text-bold)] uppercase tracking-tighter mb-6">Змінити контекст</h3>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest ml-1">Курс</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6].map(c => (
                        <button 
                          key={c}
                          onClick={() => handleChangeContext({ course: c.toString() })}
                          className={cn(
                            "py-2 rounded-xl text-xs font-bold transition-all border",
                            profile.course?.toString() === c.toString() ? "bg-accent border-accent text-white" : "bg-[var(--bg-main)] border-[var(--border-dim)] text-[var(--muted)]"
                          )}
                        >
                          {c} Курс
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest ml-1">Спеціальність</label>
                    <div className="grid grid-cols-1 gap-2">
                      {['med', 'dent', 'pharm'].map(s => (
                        <button 
                          key={s}
                          onClick={() => handleChangeContext({ specialty: s })}
                          className={cn(
                            "py-3 px-4 rounded-xl text-xs font-bold transition-all border text-left flex justify-between items-center",
                            profile.specialty === s ? "bg-accent border-accent text-white" : "bg-[var(--bg-main)] border-[var(--border-dim)] text-[var(--muted)]"
                          )}
                        >
                          {s === 'med' ? 'Медицина' : s === 'dent' ? 'Стоматологія' : 'Фармація'}
                          {profile.specialty === s && <GraduationCap className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest ml-1">Сесія</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['winter', 'summer'].map(s => (
                        <button 
                          key={s}
                          onClick={() => handleChangeContext({ sessionType: s })}
                          className={cn(
                            "py-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2",
                            profile.sessionType === s ? "bg-accent border-accent text-white" : "bg-[var(--bg-main)] border-[var(--border-dim)] text-[var(--muted)]"
                          )}
                        >
                          {s === 'winter' ? <Snowflake className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                          {s === 'winter' ? 'Зимова' : 'Літня'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full cursor-pointer hover:bg-accent/20 transition-all" onClick={() => setShowChangeContext(true)}>
           <Database className="w-3.5 h-3.5 text-accent" />
           <span className="text-[10px] font-black text-accent uppercase tracking-widest">База для {profile.course} курсу ({profile.specialty === 'med' ? 'Медицина' : profile.specialty === 'dent' ? 'Стоматологія' : 'Фармація'}) • Змінити</span>
        </div>
        <h1 className="text-4xl font-black text-[var(--text-bold)] uppercase tracking-tighter">Вибір дисципліни</h1>
        <p className="text-[var(--muted)] max-w-lg mx-auto text-sm leading-relaxed uppercase font-bold tracking-tight">
          Оберіть базу тестів для підготовки до {profile.sessionType === 'winter' ? 'зимової' : 'літньої'} сесії.
        </p>

        <div className="max-w-md mx-auto mt-6 relative group">
           <Database className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] group-focus-within:text-accent transition-colors" />
           <input 
              type="text"
              placeholder="Швидкий фільтр дисциплін..."
              value={subjectSearch}
              onChange={(e) => setSubjectSearch(e.target.value)}
              className="w-full bg-[var(--bg-side)] border border-[var(--border-dim)] rounded-2xl py-4 pl-12 pr-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all text-[var(--text-bold)] placeholder:text-[var(--muted)]/50 shadow-sm"
           />
        </div>
      </header>

      {/* 1. Subject Selection */}
      <div className="space-y-6">
        <h2 className="text-sm font-black text-[var(--muted)] uppercase tracking-[0.2em] ml-1">1. Оберіть базу (дисципліну)</h2>
        {loadingBases ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-[10px] font-black uppercase text-[var(--muted)] tracking-widest">Завантаження баз...</p>
          </div>
        ) : (
          <>
            {courseSubjects.length === 0 ? (
              <div className="text-center py-20 bg-bg-main border border-border border-dashed rounded-[2rem] flex flex-col items-center justify-center">
                <Database className="w-8 h-8 text-[var(--muted)] mx-auto mb-4" />
                <p className="text-sm font-bold text-[var(--text-bold)] uppercase mb-2">Для ваших налаштувань баз не знайдено</p>
                <div className="space-y-1 text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-6">
                  <p>Курс: {profile.course}</p>
                  <p>Спеціальність: {profile.specialty === 'med' ? 'Медицина' : profile.specialty === 'dent' ? 'Стоматологія' : 'Фармація'}</p>
                  <p>Сесія: {profile.sessionType === 'winter' ? 'Зимова' : 'Літня'}</p>
                </div>
                <p className="text-[10px] text-[var(--muted)]/50 max-w-xs mb-8">
                  У системі всього {totalQuestionsInSystem} питань, але жодне не відповідає вашому фільтру. Перевірте налаштування натиснувши "Змінити" вгорі.
                </p>
                <button 
                  onClick={() => setShowChangeContext(true)}
                  className="bg-accent text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
                >
                  Змінити фільтри
                </button>
              </div>
            ) : Object.keys(filteredGroupedSubjects).length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xs font-black uppercase text-[var(--muted)] tracking-widest">Нічого не знайдено за запитом "{subjectSearch}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {Object.keys(filteredGroupedSubjects).map((key) => {
                  const group = filteredGroupedSubjects[key];
                  
                  if (group.type === 'folder') {
                    const isSelected = isFolderSelected(key);
                    const isExpanded = expandedFolders[key];
                    const folderErrorCount = group.items.reduce((sum: number, i: any) => sum + (errorCounts[i.id] || 0), 0);
                    return (
                      <div key={key} className="flex flex-col gap-2">
                        <div
                          onClick={() => handleSelectGroup(key, 'folder')}
                          className={cn(
                            "p-5 lg:p-8 rounded-2xl lg:rounded-[2rem] border transition-all text-left flex justify-between items-center group cursor-pointer",
                            isSelected 
                              ? "bg-accent border-accent text-white shadow-xl shadow-accent/20" 
                              : "bg-[var(--bg-card)] border-[var(--border-dim)] text-[var(--muted)] hover:border-accent hover:bg-bg-side"
                          )}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={cn(
                                "text-lg lg:text-xl font-black uppercase tracking-tight lg:mb-2",
                                isSelected ? "text-white" : "text-[var(--text-bold)] group-hover:text-accent"
                              )}>📁 {group.name}</h3>
                              <button 
                                onClick={(e) => toggleFolder(key, e)} 
                                className={cn("px-3 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer", isSelected ? "bg-white/20 hover:bg-white/30" : "bg-slate-800 hover:bg-slate-700")}
                              >
                                {isExpanded ? "Сховати" : "Розгорнути"}
                              </button>
                            </div>
                            <p className="text-[10px] font-mono uppercase tracking-widest opacity-60 font-bold">
                              {group.items.length} файлів • {group.items.reduce((sum: number, i: any) => sum + (i.count || 0), 0)} Питань
                            </p>
                          </div>
                          {folderErrorCount > 0 && (
                            <div className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shrink-0 shadow-lg shadow-red-500/20">
                              {folderErrorCount} ПОМИЛОК
                            </div>
                          )}
                        </div>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="flex flex-col gap-2 pl-4 border-l-2 border-accent/20 ml-4 overflow-hidden"
                            >
                              {group.items.map((sub: any) => {
                                const isSubSelected = selectedSubjects.includes(sub.id);
                                return (
                                  <button
                                    key={sub.id}
                                    onClick={() => {
                                      if (initialMode === 'stress') {
                                        navigate(`/test?mode=stress&subject=${sub.id}`);
                                      } else {
                                        setSelectedSubjects(prev => prev.includes(sub.id) ? prev.filter(x => x !== sub.id) : [...prev, sub.id]);
                                      }
                                    }}
                                    className={cn(
                                      "p-4 rounded-2xl border transition-all text-left flex justify-between items-center group",
                                      isSubSelected 
                                        ? "bg-accent/20 border-accent text-white" 
                                        : "bg-[var(--bg-main)] border-[var(--border-dim)] text-[var(--muted)] hover:border-accent hover:text-white"
                                    )}
                                  >
                                    <div>
                                      <h3 className="text-sm font-black uppercase tracking-tight">{sub.name}</h3>
                                      <p className="text-[9px] font-mono uppercase tracking-widest opacity-60 font-bold">
                                        {sub.count} Питань
                                      </p>
                                    </div>
                                    {errorCounts[sub.id] > 0 && (
                                      <div className="bg-red-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full shrink-0 shadow-sm shadow-red-500/30">
                                        {errorCounts[sub.id]}
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }

                  const sub = group.item;
                  const isSelected = selectedSubjects.includes(sub.id);
                  return (
                    <button
                      key={sub.id}
                      onClick={() => handleSelectGroup(key, 'single')}
                      className={cn(
                        "p-5 lg:p-8 rounded-2xl lg:rounded-[2rem] border transition-all text-left flex justify-between items-center group flex-col sm:flex-row h-full",
                        isSelected 
                          ? "bg-accent border-accent text-white shadow-xl shadow-accent/20" 
                          : "bg-[var(--bg-card)] border-[var(--border-dim)] text-[var(--muted)] hover:border-accent hover:bg-bg-side"
                      )}
                    >
                      <div className="w-full">
                        <h3 className={cn(
                          "text-lg lg:text-xl font-black uppercase tracking-tight lg:mb-2",
                          isSelected ? "text-white" : "text-[var(--text-bold)] group-hover:text-accent"
                        )}>{sub.name}</h3>
                        <p className="text-[10px] font-mono uppercase tracking-widest opacity-60 font-bold">
                          {sub.count} Питань в базі
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {errorCounts[sub.id] > 0 && (
                          <div className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shrink-0 shadow-lg shadow-red-500/20">
                            {errorCounts[sub.id]} ПОМИЛОК
                          </div>
                        )}
                        <ArrowRight className={cn("w-5 h-5 transition-transform mt-4 sm:mt-0", isSelected ? "translate-x-1" : "opacity-0 lg:group-hover:opacity-100")} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. Mode Selection */}
      <AnimatePresence>
        {selectedSubjects.length > 0 && (
          <motion.div 
            id="modes-section"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="space-y-12"
          >
            <div className="h-px bg-[var(--border-dim)] w-full" />
            
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <h2 className="text-sm font-black text-[var(--muted)] uppercase tracking-[0.2em] ml-1">2. Формат та обсяг</h2>
                  <p className="text-[10px] text-accent font-bold uppercase tracking-widest ml-1">Обрано баз: {selectedSubjects.length}</p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest ml-1">Кількість питань</span>
                  <div className="flex bg-bg-main p-1 rounded-xl border border-[var(--border-dim)]">
                    {LIMITS.map(l => (
                      <button
                        key={l}
                        onClick={() => setQuestionLimit(l as any)}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                          questionLimit === l ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-[var(--muted)] hover:text-[var(--text-bold)]"
                        )}
                      >
                        {l === 'all' ? 'Вся база' : l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleStartTest(mode.id)}
                    className="bg-[var(--bg-side)] border border-[var(--border-dim)] p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] text-left hover:border-accent transition-all group hover:bg-[var(--bg-card)] shadow-sm flex flex-col items-start gap-4 min-h-[220px]"
                  >
                    <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-accent/20 transition-all", mode.color)}>
                      <mode.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-black text-[var(--text-bold)] uppercase tracking-tight mb-1 group-hover:text-accent transition-colors">{mode.name}</h3>
                        <p className="text-[11px] sm:text-xs text-[var(--muted)] leading-relaxed font-bold uppercase tracking-tight">{mode.desc}</p>
                    </div>
                    <div className="mt-auto pt-4 flex items-center justify-between w-full">
                        <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em] flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                          Почати <ArrowRight className="w-3 h-3" />
                        </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <h2 className="text-sm font-black text-[var(--muted)] uppercase tracking-[0.2em] ml-1">3. Робота над помилками</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {ERROR_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={async () => {
                      if (mode.id === 'clear') {
                          if (!profile) return;
                          if (window.confirm("Очистити помилки для обраних баз?")) {
                            try {
                                const q = query(collection(db, "saved_questions", profile.uid || "", "questions"));
                                const snap = await getDocs(q);
                                const batch = writeBatch(db);
                                snap.forEach(d => {
                                  if (selectedSubjects.includes(d.data().baseId)) {
                                    batch.delete(d.ref);
                                  }
                                });
                                await batch.commit();
                                fetchErrorCounts();
                                alert('Помилки очищено!');
                            } catch(err) {
                                console.error(err);
                            }
                          }
                      } else {
                        navigate(`/test?mode=${mode.id}&subject=${selectedSubjects.join(',')}`);
                      }
                    }}
                    className="bg-[var(--bg-side)] border border-[var(--border-dim)] p-6 rounded-[2rem] text-left hover:border-red-500/50 transition-all group hover:bg-[var(--bg-card)] shadow-sm flex items-center gap-4 border-dashed"
                  >
                    <div className={cn("w-10 h-10 rounded-xl bg-[var(--bg-main)] flex items-center justify-center border border-[var(--border-dim)] group-hover:border-red-500/20 transition-all", mode.color)}>
                      <mode.icon className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-[var(--text-bold)] uppercase tracking-tight group-hover:text-red-500 transition-colors">{mode.name}</h3>
                        <p className="text-[10px] text-[var(--muted)] leading-none font-bold uppercase tracking-tight mt-1">{mode.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, BookOpen, BarChart2, Settings, User, LogOut, ChevronRight, Bookmark, X, Sun, Moon, Shield } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { motion } from "motion/react";
import { auth, db } from "@/src/lib/firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "@/src/context/AuthContext";
import { collection, query, onSnapshot } from "firebase/firestore";

const navItems = [
  { icon: LayoutDashboard, label: "Панель", path: "/" },
  { icon: BookOpen, label: "Тестування", path: "/test-base" },
  { icon: BarChart2, label: "Аналітика", path: "/analytics" },
  { icon: Bookmark, label: "Збережене", path: "/saved", hasBadge: true },
  { icon: Settings, label: "Налаштування", path: "/settings" },
];

export default function Sidebar({ user, profile, isOpen, onClose }: { user: any, profile: any, isOpen?: boolean, onClose?: () => void }) {
  const { updateProfile } = useAuth();
  const location = useLocation();
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'saved_questions', user.uid, 'questions'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setSavedCount(snap.size);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const handleLogout = () => {
    signOut(auth);
  };

  const toggleTheme = () => {
    const currentTheme = profile?.settings?.theme || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    updateProfile({ settings: { ...profile?.settings, theme: newTheme } });
  };

  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-[50] w-64 border-r border-[var(--border-dim)] bg-bg-side flex flex-col pt-6 pb-4 transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="px-6 mb-8 flex items-center justify-between">
        <Link to="/" onClick={() => { document.getElementById('main-scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' }); onClose(); }} className="flex items-center gap-2 mb-1 group transition-transform active:scale-95">
          <div className="w-3 h-3 bg-accent rounded-sm group-hover:rotate-45 transition-transform"></div>
          <h1 className="font-bold tracking-tight text-[var(--text-bold)] group-hover:text-accent transition-colors">MedTest Pro</h1>
        </Link>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-slate-500 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-8 overflow-y-auto pt-2">
        {/* NAVIGATION */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4 block ml-2">Навігація</label>
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative",
                  location.pathname === item.path 
                    ? "bg-accent/10 text-accent font-bold" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="font-medium tracking-tight flex-1">{item.label}</span>
                {item.hasBadge && savedCount > 0 && (
                  <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-lg font-bold font-mono">
                    {savedCount}
                  </span>
                )}
                {location.pathname === item.path && (
                  <motion.div layoutId="activeNav" className="absolute left-[-1rem] w-1 h-4 bg-accent rounded-r-full" />
                )}
              </Link>
            ))}
            
            {(profile?.role === 'SUPERADMIN' || profile?.role === 'ADMIN') && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative text-orange-400/80 hover:text-orange-400 hover:bg-orange-400/5 mt-4",
                  location.pathname === "/admin" && "bg-orange-400/10 text-orange-400"
                )}
              >
                <Shield className="w-4 h-4" />
                <span className="text-sm font-bold uppercase tracking-tight">Панель Боса</span>
              </Link>
            )}
          </div>
        </div>

        {/* QUICK LINKS */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4 block ml-2">Швидкий доступ</label>
          <div className="space-y-1 px-1">
            <Link to="/saved" className="flex items-center gap-3 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <span className="w-1 h-1 rounded-full bg-slate-700 mt-0.5" />
              <span className="italic"># Збережені питання</span>
            </Link>
            <div className="flex items-center gap-3 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
              <span className="w-1 h-1 rounded-full bg-slate-700 mt-0.5" />
              <span className="italic"># Гематологія ключі</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-[var(--border-dim)] space-y-3">
        <div className="flex items-center gap-2">
            <Link 
              to="/settings"
              className="flex-1 flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold overflow-hidden shadow-lg">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" referrerPolicy="no-referrer" />
                ) : user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" />
                ) : (
                  user?.email?.[0].toUpperCase() || "U"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--text-bold)] truncate">{user?.displayName || user?.email?.split('@')[0]}</p>
                <p className="text-[9px] text-[var(--muted)] uppercase tracking-widest">{profile?.specialty || 'Студент'}</p>
              </div>
            </Link>
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--border-dim)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--muted)] hover:text-accent transition-all shrink-0"
              title="Перемкнути тему"
            >
              {profile?.settings?.theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
        </div>
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all group"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Вийти</span>
        </button>
      </div>
    </div>
  );
}

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell 
} from "recharts";
import { AlertCircle, TrendingUp, Target, Brain, BarChart2 } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { collection, query, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

export default function Analytics() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [errorCount, setErrorCount] = useState(0);
  const [totalSystemQuestions, setTotalSystemQuestions] = useState(2000);

  useEffect(() => {
    const fetchTotal = async () => {
      try {
        const snap = await getDocs(collection(db, "bases"));
        const total = snap.docs.reduce((sum, doc) => sum + (doc.data().count || 0), 0);
        if (total > 0) setTotalSystemQuestions(total);
      } catch (e) {
        console.error("Failed to fetch total questions", e);
      }
    };
    fetchTotal();
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

  const categoryStats = profile?.stats?.byCategory || {};
  const chartData = Object.entries(categoryStats).map(([name, data]: [string, any]) => {
    const score = data.solved > 0 ? Math.round((data.correct / data.solved) * 100) : 0;
    return {
      name,
      score,
      color: score > 80 ? "#22c55e" : score > 50 ? "#eab308" : "#ef4444"
    };
  }).sort((a, b) => b.score - a.score);

  const weakPoints = Object.entries(categoryStats)
    .map(([name, data]: [string, any]) => {
      const score = data.solved > 0 ? Math.round((data.correct / data.solved) * 100) : 0;
      return { 
        category: name, 
        score, 
        gap: `${100 - score}%`,
        recommendation: score < 50 ? `Критичний рівень. Зверніть особливу увагу на категорію ${name}.` : `Рекомендовано повторити розділ ${name} для кращого результату.`
      };
    })
    .filter(wp => wp.score < 80)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white uppercase">Аналітика успішності</h1>
        <p className="text-slate-500 text-sm mt-1">Глибокий аналіз вашого прогресу в підготовці до сесії.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Stats Summary */}
        {[
          { 
            label: "Загальна точність", 
            value: profile?.stats?.totalSolved > 0 
              ? `${Math.round((profile?.stats?.totalCorrect / profile?.stats?.totalSolved) * 100)}%` 
              : "0%", 
            icon: Target, 
            color: "text-blue-400" 
          },
          { 
            label: "Вирішено питань", 
            value: `${profile?.stats?.totalSolved || 0} / ${totalSystemQuestions}`, 
            icon: Brain, 
            color: "text-purple-400" 
          },
          { label: "Днів поспіль", value: `${profile?.streak || 0} Днів`, icon: TrendingUp, color: "text-green-400" },
          { label: "Збережено питань", value: errorCount.toString(), icon: AlertCircle, color: "text-red-400" },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start">
                <stat.icon className={cn("w-5 h-5", stat.color)} />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Статистика</span>
              </div>
              <div>
                <p className="text-2xl font-black font-mono text-white leading-none">{stat.value}</p>
                <p className="text-[10px] text-slate-500 mt-2 uppercase font-bold tracking-tight">{stat.label}</p>
              </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 p-8 rounded-[2rem]">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-8 text-slate-400">Результативність за категоріями</h3>
          <div className="h-[320px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.02)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fill: "#64748b", fontSize: 10 }}
                  />
                  <Tooltip 
                    cursor={{ fill: "rgba(255,255,255,0.01)" }}
                    contentStyle={{ 
                      backgroundColor: "#0d0d0e", 
                      border: "1px solid #1e293b", 
                      borderRadius: "16px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                    }}
                    itemStyle={{ color: "#fff", fontWeight: "bold", fontSize: "12px" }}
                    labelStyle={{ color: "#94a3b8", fontSize: "10px", marginBottom: "4px", fontWeight: "bold" }}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-3xl text-slate-500 gap-4">
                <BarChart2 className="w-8 h-8 opacity-20" />
                <p className="text-xs uppercase tracking-widest font-bold">Немає даних для аналізу</p>
                <p className="text-[10px] lowercase max-w-[200px] text-center opacity-60">Пройдіть декілька тестів, щоб побачити свою результативність</p>
              </div>
            )}
          </div>
        </div>

        {/* Weakpoint List */}
        <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 p-8 rounded-[2rem] flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-6 text-slate-400">Звіт по слабких місцях</h3>
          <div className="space-y-6 flex-1">
            {weakPoints.length > 0 ? weakPoints.map((wp, i) => (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i} 
                className="space-y-2"
              >
                <div className="flex justify-between items-center">
                   <span className="text-xs font-bold text-red-500 uppercase">{wp.category}</span>
                   <span className="text-[10px] font-mono text-red-500 font-bold px-2 py-0.5 bg-red-500/10 rounded">GAP: {wp.gap}</span>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] text-slate-400 leading-relaxed font-mono">
                  {wp.recommendation}
                </div>
              </motion.div>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-3 opacity-40">
                 <AlertCircle className="w-6 h-6" />
                 <p className="text-[10px] uppercase font-black tracking-widest">Слабких місць не знайдено</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => navigate('/test?mode=practice&auto=true')}
            className="mt-8 w-full bg-accent text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/10 active:scale-95"
          >
            Згенерувати сесію тренування
          </button>
        </div>
      </div>
    </div>
  );
}

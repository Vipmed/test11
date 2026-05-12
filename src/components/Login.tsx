import React, { useState } from "react";
import { Lock, Mail, ChevronRight, LogIn, AlertCircle, XCircle, GraduationCap, Stethoscope, Snowflake, Sun } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/src/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { cn } from "@/src/lib/utils";

import { logEvent, AuditEventType } from "@/src/lib/audit";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [infoModal, setInfoModal] = useState<{title: string, content: string} | null>(null);

  // Registration specifics
  const [course, setCourse] = useState("1");
  const [specialty, setSpecialty] = useState("med");
  const [sessionType, setSessionType] = useState("summer");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        logEvent(AuditEventType.USER_LOGIN, `Google Login: ${result.user.email}`, result.user.uid, result.user.email || undefined);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let finalEmail = email;
      if (!email.includes("@")) {
        finalEmail = `${email}@medicus.ua`;
      }

      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, finalEmail, password);
        if (result.user) {
          logEvent(AuditEventType.USER_LOGIN, `Registered with email: ${result.user.email}`, result.user.uid, result.user.email || undefined);
          
          // Pre-configure profile since we asked in registration
          const userDocRef = doc(db, 'users', result.user.uid);
          await setDoc(userDocRef, {
            uid: result.user.uid,
            email: result.user.email,
            role: 'USER',
            isApproved: false,
            createdAt: serverTimestamp(),
            course,
            specialty,
            sessionType,
            isConfigured: true,
            settings: { 
              aiByDefault: false, 
              theme: 'dark', 
              showSidebarCloseBtn: true,
              sidebarEnabled: true
            },
            stats: {
              totalSolved: 0,
              totalCorrect: 0,
              totalQuestions: 2000
            }
          }, { merge: true });
        }
      } else {
        const result = await signInWithEmailAndPassword(auth, finalEmail, password);
        if (result.user) {
          logEvent(AuditEventType.USER_LOGIN, `Login with email: ${result.user.email}`, result.user.uid, result.user.email || undefined);
        }
      }
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        setError("Помилка: Метод входу 'Email/Password' не ввімкнено в консолі Firebase. Будь ласка, активуйте його в розділі Authentication > Sign-in method.");
      } else if (error.code === 'auth/invalid-credential') {
        setError("Невірний логін або пароль. Перевірте дані або зареєструйтеся.");
      } else if (error.code === 'auth/invalid-email') {
        setError("Некоректний формат електронної пошти.");
      } else if (error.code === 'auth/email-already-in-use') {
        setError("Ця пошта вже використовується.");
      } else if (error.code === 'auth/weak-password') {
        setError("Пароль занадто слабкий (мінімум 6 символів).");
      } else if (error.code === 'auth/network-request-failed') {
        setError("Помилка мережі. Перевірте підключення.");
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 blur-[120px] rounded-full" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm z-10"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-2xl">
            <span className="text-black font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">MedTest Pro</h1>
          <p className="text-slate-500 text-sm mt-2">Видання ТНМУ (База тестів)</p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3 mb-6" noValidate>
          <div className="space-y-1">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Логін або Email" 
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 text-sm text-white focus:outline-none focus:border-accent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="password" 
                placeholder="Пароль" 
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 text-sm text-white focus:outline-none focus:border-accent"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <AnimatePresence>
            {isRegistering && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2 overflow-hidden"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Курс</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[1, 2, 3, 4, 5, 6].map(c => (
                      <button 
                        key={c}
                        type="button"
                        onClick={() => setCourse(c.toString())}
                        className={cn(
                          "py-2 rounded-lg text-[10px] font-bold transition-all border",
                          course === c.toString() ? "bg-accent border-accent text-white" : "bg-slate-900 border-slate-800 text-slate-500"
                        )}
                      >
                        {c} Курс
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Спеціальність</label>
                    <select 
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-[10px] text-white font-bold outline-none focus:border-accent"
                    >
                      <option value="med">Медицина</option>
                      <option value="dent">Стоматологія</option>
                      <option value="pharm">Фармація</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Сесія</label>
                    <select 
                      value={sessionType}
                      onChange={(e) => setSessionType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-[10px] text-white font-bold outline-none focus:border-accent"
                    >
                      <option value="winter">Зимова</option>
                      <option value="summer">Літня</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
              <AlertCircle className="w-3 h-3" />
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white font-black py-4 rounded-2xl hover:bg-blue-600 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-xs shadow-lg shadow-accent/20"
          >
            {loading ? "Зачекайте..." : isRegistering ? "Зареєструватися" : "Увійти"}
          </button>
          

          <button 
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full text-[10px] text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            {isRegistering ? "Вже маєте акаунт? Увійти" : "Немає акаунту? Реєстрація"}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold px-4 text-slate-600 bg-black">Або</div>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
            {loading ? "Авторизація..." : "Увійти через Google"}
          </button>

          <p className="text-[10px] text-center text-slate-500 uppercase tracking-widest leading-relaxed">
            Вхід тільки для студентів ТНМУ. <br/>Всі дії реєструються в системному аудиті.
          </p>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <div className="flex justify-center gap-4 text-[10px] text-slate-600 uppercase tracking-widest font-medium">
                <span 
                  onClick={() => setInfoModal({
                    title: "Запит на доступ",
                    content: "Якщо ви студент ТНМУ і не можете увійти, надішліть запит адміністратору на пошту vip.medicus@gmail.com, вказавши ПІБ та академічну групу."
                  })}
                  className="hover:text-white cursor-pointer transition-colors"
                >
                  Запит на доступ
                </span>
                <span>•</span>
                <span 
                  onClick={() => setInfoModal({
                    title: "Офлайн PWA",
                    content: "MedTest Pro підтримує роботу без інтернету. Натисніть 'Додати на головний екран' у налаштуваннях браузера (Safari/Chrome), щоб встановити додаток. Це дозволить проходити тести в укриттях або при блекаутах."
                  })}
                  className="hover:text-white cursor-pointer transition-colors"
                >
                  Офлайн PWA
                </span>
                <span>•</span>
                <span className="hover:text-white cursor-default transition-colors">v2.4.0</span>
            </div>
        </div>

        <AnimatePresence>
          {infoModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
              onClick={() => setInfoModal(null)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] max-w-sm w-full relative"
                onClick={e => e.stopPropagation()}
              >
                <button 
                  onClick={() => setInfoModal(null)}
                  className="absolute top-6 right-6 text-slate-500 hover:text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">{infoModal.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium uppercase tracking-tight">
                  {infoModal.content}
                </p>
                <button 
                  onClick={() => setInfoModal(null)}
                  className="w-full bg-white text-black font-black py-3 rounded-xl mt-8 text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Зрозуміло
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

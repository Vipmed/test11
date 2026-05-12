import React, { useState, useEffect } from "react";
import { auth, db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, query, getDocs, updateDoc, doc, addDoc, deleteDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '@/firebase-applet-config.json';
import { Shield, Users, CheckCircle, XCircle, Plus, Search, Trash2, Copy, Check, Loader2, Calendar, Clock, ExternalLink, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { logEvent, AuditEventType } from "@/src/lib/audit";
import { onSnapshot } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  isApproved: boolean;
  createdAt: any;
  lastSeen?: any;
  stats?: {
    totalAttempts: number;
    correctRate: number;
    questionsProcessed: number;
  };
}

interface UsersTabProps {
  showAlert: (msg: string) => void;
  setConfirmModal: (modal: any) => void;
}

export default function UsersTab({ showAlert, setConfirmModal }: UsersTabProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", role: "USER" });
  const [generatedCreds, setGeneratedCreds] = useState<{login: string, pass: string} | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        userList.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      // Sort by lastSeen descending
      userList.sort((a, b) => {
        const lastA = a.lastSeen?.toMillis?.() || 0;
        const lastB = b.lastSeen?.toMillis?.() || 0;
        return lastB - lastA;
      });
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus(type);
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  const isUserOnline = (lastSeen: any) => {
    if (!lastSeen) return false;
    const now = Date.now();
    const last = lastSeen.toMillis?.() || 0;
    return (now - last) < 300000; // 5 minutes
  };

  const removeUser = async (uid: string, userEmail: string) => {
    if (userEmail === 'vip.medicus@gmail.com' || userEmail === auth.currentUser?.email) {
      showAlert("Ви не можете видалити цього користувача.");
      return;
    }
    setConfirmModal({
      message: "Вилучити цього користувача повністю?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "users", uid));
          await logEvent(
            AuditEventType.USER_DELETED, 
            `Користувача видалено: ${userEmail} (UID: ${uid})`,
            auth.currentUser?.uid,
            auth.currentUser?.email || undefined
          );
          setConfirmModal(null);
        } catch (error) {
          setConfirmModal(null);
          handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
          showAlert("Помилка видалення. Перевірте консоль.");
        }
      }
    });
  };

  const toggleApproval = async (uid: string, currentStatus: boolean, userEmail: string) => {
    try {
      if (userEmail === 'vip.medicus@gmail.com') return; // root admin
      await updateDoc(doc(db, "users", uid), { isApproved: !currentStatus });
      await logEvent(
        currentStatus ? AuditEventType.USER_BLOCKED : AuditEventType.USER_APPROVED,
        `${currentStatus ? "Заблоковано" : "Схвалено"} користувача: ${userEmail} (UID: ${uid})`,
        auth.currentUser?.uid,
        auth.currentUser?.email || undefined
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      showAlert("Помилка оновлення статусу.");
    }
  };

  const changeRole = async (uid: string, currentRole: string, userEmail: string) => {
    try {
      if (userEmail === 'vip.medicus@gmail.com') return; // root admin
      const nextRole = currentRole === 'USER' ? 'ADMIN' : (currentRole === 'ADMIN' ? 'SUPERADMIN' : 'USER');
      await updateDoc(doc(db, "users", uid), { role: nextRole });
      await logEvent(
        AuditEventType.USER_ROLE_CHANGE,
        `Змінено роль для ${userEmail} на ${nextRole}`,
        auth.currentUser?.uid,
        auth.currentUser?.email || undefined
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      showAlert("Помилка оновлення ролі.");
    }
  };

  const generateCredentials = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const login = newUser.email || `med_user_${randomSuffix}`;
    const pass = Math.random().toString(36).slice(-8) + "!";
    setGeneratedCreds({ login, pass });
    setNewUser(prev => ({ ...prev, email: login }));
  };

  const handleCreateUser = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      if (!newUser.email || !generatedCreds) {
        showAlert("Спочатку згенеруйте доступ.");
        setIsCreating(false);
        return;
      }

      // 1. Prepare email
      const cleanEmail = newUser.email.trim();
      const finalEmail = cleanEmail.includes("@") ? cleanEmail : `${cleanEmail}@medicus.ai`;

      // 2. Create in Firebase Auth using a dedicated secondary instance
      let secondaryApp;
      try {
        secondaryApp = getApp("AdminAuthHelper");
      } catch (e) {
        secondaryApp = initializeApp(firebaseConfig, "AdminAuthHelper");
      }
      const secondaryAuth = getAuth(secondaryApp);
      
      const authResult = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, generatedCreds.pass);
      const uid = authResult.user.uid;
      
      // Cleanup the secondary auth session
      await signOut(secondaryAuth);
      
      // 3. Create profile in Firestore with the same UID
      await setDoc(doc(db, "users", uid), {
        email: finalEmail,
        role: newUser.role,
        isApproved: true,
        createdAt: serverTimestamp(),
      });

      await logEvent(
        AuditEventType.USER_CREATED,
        `Створено нового користувача: ${finalEmail} з роллю ${newUser.role} (UID: ${uid})`,
        auth.currentUser?.uid,
        auth.currentUser?.email || undefined
      );

      setShowAddModal(false);
      setGeneratedCreds(null);
      setNewUser({ email: "", role: "USER" });
      showAlert(`Користувача ${finalEmail} успішно створено!`);
    } catch (error: any) {
       console.error("User creation failed:", error);
       if (error.code === 'auth/email-already-in-use') {
         showAlert("Цей логін/email вже зайнятий.");
       } else if (error.code === 'auth/weak-password') {
         showAlert("Пароль занадто слабкий.");
       } else {
         handleFirestoreError(error, OperationType.WRITE, "users");
       }
    } finally {
       setIsCreating(false);
    }
  };

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-4 md:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Пошук за email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => {
                setNewUser({ email: "", role: "USER" });
                setGeneratedCreds(null);
                setShowAddModal(true);
              }}
              className="px-5 py-3 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Додати
            </button>
            <div className="h-8 w-px bg-slate-800 mx-2" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Всього: {users.length}</span>
            <span className="text-[10px] font-bold text-emerald-500 uppercase ml-2">
              Онлайн: {users.filter(u => isUserOnline(u.lastSeen)).length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          {loading ? (
             <div className="text-center p-10 text-slate-500 text-xs font-mono">Завантаження...</div>
          ) : (
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4">Користувач</th>
                  <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Статус</th>
                  <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Роль (Доступ)</th>
                  <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right pr-4">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase())).map((user) => {
                  const online = isUserOnline(user.lastSeen);
                  return (
                    <tr 
                      key={user.uid} 
                      onClick={() => setSelectedUser(user)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 group-hover:border-slate-600 transition-colors">
                              <Users className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                            </div>
                            {online && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">{user.email}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {user.lastSeen ? `Був: ${user.lastSeen.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Давно не був'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             toggleApproval(user.uid, user.isApproved, user.email);
                           }}
                           disabled={user.email === 'vip.medicus@gmail.com'}
                           className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-50 ${user.isApproved ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'}`}
                        >
                          {user.isApproved ? <><CheckCircle className="w-3.5 h-3.5"/> Схвалено</> : <><XCircle className="w-3.5 h-3.5"/> Заблоковано</>}
                        </button>
                      </td>
                      <td className="py-4">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            changeRole(user.uid, user.role, user.email);
                          }}
                          disabled={user.email === 'vip.medicus@gmail.com'}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-50 ${user.role === 'ADMIN' || user.role === 'SUPERADMIN' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          {user.role}
                        </button>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex justify-end pr-2">
                          <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               removeUser(user.uid, user.email);
                             }} 
                             disabled={user.email === 'vip.medicus@gmail.com'}
                             className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6"
          >
             <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
             >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-blue-400" />
                <h3 className="text-xl font-black text-white mb-2">Додати користувача</h3>
                <p className="text-xs text-slate-400 mb-6 font-mono leading-relaxed">
                   Згенеруйте логін та пароль для користувача. Логін можна змінити на email пізніше.
                </p>

                <div className="space-y-4">
                   <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Логін (або Email)</label>
                      <input 
                         type="text" 
                         value={newUser.email}
                         onChange={(e) => {
                            setNewUser({...newUser, email: e.target.value});
                            if (generatedCreds) setGeneratedCreds({...generatedCreds, login: e.target.value});
                         }}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent"
                         placeholder="med_user_1234 або email"
                      />
                   </div>

                   {generatedCreds && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Дані для копіювання</label>
                          <button 
                            onClick={() => copyToClipboard(`Логін: ${newUser.email}\nПароль: ${generatedCreds.pass}`, 'all')}
                            className="text-accent hover:text-blue-400 transition-colors flex items-center gap-1"
                          >
                            {copyStatus === 'all' ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
                            <span className="text-[8px] font-black uppercase tracking-widest">{copyStatus === 'all' ? 'Скопійовано' : 'Копіювати все'}</span>
                          </button>
                        </div>
                        
                        <div 
                          onClick={() => copyToClipboard(`Логін: ${newUser.email}\nПароль: ${generatedCreds.pass}`, 'all')}
                          className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 cursor-pointer group hover:bg-emerald-500/20 transition-all relative"
                        >
                          <div className="space-y-2 font-mono text-sm">
                            <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                              <span>Логін</span>
                              <span className="text-emerald-500 font-black">{newUser.email}</span>
                            </div>
                            <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                              <span>Пароль</span>
                              <span className="text-emerald-500 font-black">{generatedCreds.pass}</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-emerald-500/20 text-center">
                             <span className="text-[9px] font-black text-emerald-500/50 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Натисніть, щоб скопіювати все разом</span>
                          </div>
                        </div>
                      </div>
                   )}

                   <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Роль у системі</label>
                      <select 
                         value={newUser.role}
                         onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent"
                      >
                         <option value="USER">USER (Дефолт)</option>
                         <option value="ADMIN">ADMIN (Управління)</option>
                      </select>
                   </div>
                   
                   {!generatedCreds && (
                      <button 
                         onClick={generateCredentials}
                         className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                         <Shield className="w-4 h-4" />
                         Згенерувати доступ
                      </button>
                   )}
                </div>

                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => { setShowAddModal(false); setGeneratedCreds(null); }}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Скасувати
                  </button>
                  <button 
                    onClick={handleCreateUser}
                    disabled={!newUser.email || isCreating}
                    className="flex-1 py-4 bg-accent hover:bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:hover:bg-accent flex items-center justify-center gap-2"
                  >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isCreating ? "Створення..." : "Створити"}
                  </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedUser && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedUser(null)}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6"
          >
             <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl relative overflow-hidden"
             >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-blue-500 to-indigo-500" />
                
                <div className="flex justify-between items-start mb-8">
                   <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-slate-800 flex items-center justify-center border border-slate-700">
                          <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        {isUserOnline(selectedUser.lastSeen) && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-slate-900 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.6)]" />
                        )}
                      </div>
                      <div>
                         <h3 className="text-xl font-black text-white leading-tight">{selectedUser.email}</h3>
                         <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${selectedUser.role === 'USER' ? 'bg-slate-800 text-slate-400' : 'bg-amber-500/10 text-amber-500'}`}>
                               {selectedUser.role}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">UID: {selectedUser.uid}</span>
                         </div>
                      </div>
                   </div>
                   <button 
                    onClick={() => setSelectedUser(null)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                   >
                     <XCircle className="w-6 h-6 text-slate-500" />
                   </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Зареєстровано</span>
                    </div>
                    <p className="text-xs font-bold text-white">
                      {selectedUser.createdAt?.toDate().toLocaleDateString() || "Невідомо"}
                    </p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Остання активність</span>
                    </div>
                    <p className="text-xs font-bold text-white">
                      {selectedUser.lastSeen ? selectedUser.lastSeen.toDate().toLocaleString() : "Давно"}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6 mb-8">
                   <div className="flex items-center gap-2 mb-6 text-slate-500">
                      <Activity className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Статистика активності</span>
                   </div>
                   
                   <div className="grid grid-cols-3 gap-6">
                      <div className="text-center">
                         <p className="text-2xl font-black text-white mb-1">{selectedUser.stats?.totalAttempts || 0}</p>
                         <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Всього спроб</p>
                      </div>
                      <div className="text-center border-x border-slate-800">
                         <p className="text-2xl font-black text-accent mb-1">{selectedUser.stats?.correctRate || 0}%</p>
                         <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Успішність</p>
                      </div>
                      <div className="text-center">
                         <p className="text-2xl font-black text-emerald-500 mb-1">{selectedUser.stats?.questionsProcessed || 0}</p>
                         <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Питань пройдено</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-3">
                   <button 
                    onClick={() => {
                      toggleApproval(selectedUser.uid, selectedUser.isApproved, selectedUser.email);
                      setSelectedUser(prev => prev ? {...prev, isApproved: !prev.isApproved} : null);
                    }}
                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${selectedUser.isApproved ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500'} hover:text-white group`}
                   >
                     {selectedUser.isApproved ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                     {selectedUser.isApproved ? "Заблокувати доступ" : "Схвалити доступ"}
                   </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

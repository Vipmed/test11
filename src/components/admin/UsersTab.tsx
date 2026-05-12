import React, { useState, useEffect } from "react";
import { auth, db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, query, getDocs, updateDoc, doc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Shield, Users, CheckCircle, XCircle, Plus, Search, Trash2, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface UserProfile {
  uid: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  isApproved: boolean;
  createdAt: any;
}

interface UsersTabProps {
  showAlert: (msg: string) => void;
  setConfirmModal: (modal: any) => void;
}

export default function UsersTab({ showAlert, setConfirmModal }: UsersTabProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", role: "USER" });
  const [generatedCreds, setGeneratedCreds] = useState<{login: string, pass: string} | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"));
      const querySnapshot = await getDocs(q);
      const userList: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        userList.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(userList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "users");
    } finally {
      setLoading(false);
    }
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
          fetchUsers();
          setConfirmModal(null);
        } catch (error) {
          setConfirmModal(null);
          showAlert("Помилка видалення.");
        }
      }
    });
  };

  const toggleApproval = async (uid: string, currentStatus: boolean, userEmail: string) => {
    try {
      if (userEmail === 'vip.medicus@gmail.com') return; // root admin
      await updateDoc(doc(db, "users", uid), { isApproved: !currentStatus });
      fetchUsers();
    } catch (error) {
      showAlert("Помилка оновлення статусу.");
    }
  };

  const changeRole = async (uid: string, currentRole: string, userEmail: string) => {
    try {
      if (userEmail === 'vip.medicus@gmail.com') return; // root admin
      const nextRole = currentRole === 'USER' ? 'ADMIN' : (currentRole === 'ADMIN' ? 'SUPERADMIN' : 'USER');
      await updateDoc(doc(db, "users", uid), { role: nextRole });
      fetchUsers();
    } catch (error) {
      showAlert("Помилка оновлення ролі.");
    }
  };

  const generateCredentials = () => {
    const pass = Math.random().toString(36).slice(-8) + "!";
    setGeneratedCreds({ login: newUser.email, pass });
  };

  const handleCreateUser = async () => {
    try {
      if (!newUser.email) return;
      await addDoc(collection(db, "users"), {
        email: newUser.email,
        role: newUser.role,
        isApproved: true,
        createdAt: serverTimestamp(),
      });
      setShowAddModal(false);
      fetchUsers();
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, "users");
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
              onClick={() => setShowAddModal(true)}
              className="px-5 py-3 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Додати
            </button>
            <div className="h-8 w-px bg-slate-800 mx-2" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Всього: {users.length}</span>
            <button 
              onClick={fetchUsers} 
              className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
            >
              Оновити
            </button>
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
                {users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase())).map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                          <Users className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{user.email}</p>
                          <p className="text-[10px] text-slate-500 font-mono">UID: {user.uid.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <button 
                         onClick={() => toggleApproval(user.uid, user.isApproved, user.email)}
                         disabled={user.email === 'vip.medicus@gmail.com'}
                         className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-50 ${user.isApproved ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'}`}
                      >
                        {user.isApproved ? <><CheckCircle className="w-3.5 h-3.5"/> Approved</> : <><XCircle className="w-3.5 h-3.5"/> Blocked</>}
                      </button>
                    </td>
                    <td className="py-4">
                      <button 
                        onClick={() => changeRole(user.uid, user.role, user.email)}
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
                           onClick={() => removeUser(user.uid, user.email)} 
                           disabled={user.email === 'vip.medicus@gmail.com'}
                           className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
                   Новий користувач отримає доступ до системи. Рекомендуємо спочатку згенерувати тимчасовий пароль.
                </p>

                <div className="space-y-4">
                   <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Email користувача</label>
                      <input 
                         type="email" 
                         value={newUser.email}
                         onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent"
                         placeholder="student@tnmu.edu.ua"
                      />
                   </div>
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
                   
                   {!generatedCreds ? (
                      <button 
                         onClick={generateCredentials}
                         className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                         <Shield className="w-3.5 h-3.5" />
                         Згенерувати доступ
                      </button>
                   ) : (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                         <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Дані для входу (скопіюйте!)</p>
                         <div className="space-y-1 font-mono text-xs text-white">
                            <p>Логін: {generatedCreds.login}</p>
                            <p>Пароль: {generatedCreds.pass}</p>
                         </div>
                      </div>
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
                    className="flex-1 py-4 bg-accent hover:bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-accent/20"
                  >
                    Створити
                  </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

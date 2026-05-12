import React, { useState, useEffect } from "react";
import { db } from "@/src/lib/firebase";
import { collection, query, getDocs, updateDoc, doc, deleteDoc, orderBy, where, limit } from "firebase/firestore";
import { FileText, CheckCircle, Edit3, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { logEvent, AuditEventType } from "@/src/lib/audit";
import { auth } from "@/src/lib/firebase";

interface ReportsTabProps {
  showAlert: (msg: string) => void;
  setConfirmModal: (modal: any) => void;
}

export default function ReportsTab({ showAlert, setConfirmModal }: ReportsTabProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [inspectingReport, setInspectingReport] = useState<any>(null);
  const [inspectingQuestion, setInspectingQuestion] = useState<any>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const q = query(collection(db, "reports"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Fetch reports error:", error);
    }
  };

  const openReport = async (report: any) => {
    try {
      setInspectingReport(report);
      const qSnap = await getDocs(query(collection(db, "questions"), where("id", "==", report.questionId), limit(1)));
      if (!qSnap.empty) {
        setInspectingQuestion({ docId: qSnap.docs[0].id, ...qSnap.docs[0].data() });
      } else {
        const docSnap = await getDocs(query(collection(db, "questions"), where("__name__", "==", report.questionId), limit(1)));
        if (!docSnap.empty) {
             setInspectingQuestion({ docId: docSnap.docs[0].id, ...docSnap.docs[0].data() });
        } else {
             setInspectingQuestion(null);
        }
      }
    } catch(err) {
      console.error(err);
    }
  };

  const saveInspectedQuestion = async () => {
    if(!inspectingQuestion || !inspectingQuestion.docId) return;
    try {
       await updateDoc(doc(db, "questions", inspectingQuestion.docId), {
          text: inspectingQuestion.text,
          options: inspectingQuestion.options,
          correctIdx: inspectingQuestion.correctIdx
       });
       await logEvent(
         AuditEventType.QUESTION_EDIT,
         `Оновлено питання (через скаргу) ID: ${inspectingQuestion.docId}`,
         auth.currentUser?.uid,
         auth.currentUser?.email || undefined
       );
       showAlert("Питання успішно оновлено!");
    } catch(err) {
       console.error(err);
       showAlert("Помилка збереження.");
    }
  };

  const resolveReport = async (id: string) => {
    setConfirmModal({
      message: "Помітити цей звіт як вирішений?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "reports", id));
          await logEvent(
            AuditEventType.REPORT_ACTION,
            `Звіт розглянуто та видалено ID: ${id}`,
            auth.currentUser?.uid,
            auth.currentUser?.email || undefined
          );
          fetchReports();
          if(inspectingReport?.id === id) {
             setInspectingReport(null);
             setInspectingQuestion(null);
          }
          setConfirmModal(null);
        } catch (error) {
          setConfirmModal(null);
          showAlert("Помилка при обробці репорту.");
        }
      }
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Запити користувачів ({reports.length})</h3>
            <div className="space-y-3 custom-scrollbar overflow-y-auto max-h-[600px] pr-2">
               {reports.map((r) => (
                  <button 
                     key={r.id} 
                     onClick={() => openReport(r)}
                     className={`w-full text-left p-5 rounded-2xl border transition-all ${inspectingReport?.id === r.id ? 'bg-accent/10 border-accent/30' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                  >
                     <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-black text-accent uppercase tracking-widest">{r.type === 'error' ? 'Помилка' : r.type === 'typo' ? 'Опечатка' : 'Пояснення'}</span>
                       <span className="text-[10px] text-slate-500 font-mono">{r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleString() : ''}</span>
                     </div>
                     <p className="text-xs text-slate-300 font-mono line-clamp-2">{r.comment}</p>
                  </button>
               ))}
               {reports.length === 0 && (
                  <div className="text-center p-8 text-slate-500 text-xs font-mono">Немає нових звітів</div>
               )}
            </div>
         </div>

         <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Деталі запиту</h3>
            {inspectingReport ? (
               <div className="space-y-8">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Коментар від ({inspectingReport.userEmail})</label>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-mono text-white">
                      {inspectingReport.comment}
                    </div>
                  </div>
                  
                  {inspectingQuestion && (
                    <div className="space-y-4">
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Редагування питання</label>
                       <textarea 
                          value={inspectingQuestion.text}
                          onChange={(e) => setInspectingQuestion({...inspectingQuestion, text: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-300 min-h-[120px] focus:outline-none focus:border-accent"
                       />
                       <div className="space-y-2">
                         {inspectingQuestion.options.map((opt: string, i: number) => (
                           <div key={i} className="flex gap-2">
                              <input 
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...inspectingQuestion.options];
                                  newOpts[i] = e.target.value;
                                  setInspectingQuestion({...inspectingQuestion, options: newOpts});
                                }}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-accent"
                              />
                              <button 
                                onClick={() => setInspectingQuestion({...inspectingQuestion, correctIdx: i})}
                                className={`px-4 rounded-xl text-[10px] font-black uppercase transition-all ${inspectingQuestion.correctIdx === i ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                              >
                                Правильна
                              </button>
                           </div>
                         ))}
                       </div>
                       
                       <div className="flex gap-4 pt-4">
                         <button onClick={saveInspectedQuestion} className="flex-1 py-3 bg-accent/20 text-accent hover:bg-accent/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex justify-center items-center gap-2">
                           <Edit3 className="w-3.5 h-3.5" />
                           Зберегти зміни
                         </button>
                         <button onClick={() => resolveReport(inspectingReport.id)} className="flex-1 py-3 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex justify-center items-center gap-2">
                           <CheckCircle className="w-3.5 h-3.5" />
                           Вирішено
                         </button>
                       </div>
                    </div>
                  )}
                  {!inspectingQuestion && (
                    <div className="text-center p-8 bg-slate-950 border border-slate-800 rounded-2xl">
                       <p className="text-xs text-slate-500 font-mono">Питання не знайдено (можливо видалено)</p>
                       <button onClick={() => resolveReport(inspectingReport.id)} className="mt-4 px-6 py-2 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors inline-flex items-center gap-2">
                         <CheckCircle className="w-3.5 h-3.5" />
                         Все одно закрити
                       </button>
                    </div>
                  )}
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-50">
                  <FileText className="w-12 h-12 text-slate-500 mb-4" />
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Виберіть звіт зліва</p>
               </div>
            )}
         </div>
      </div>
    </>
  );
}

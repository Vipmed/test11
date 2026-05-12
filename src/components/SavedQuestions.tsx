import { useState, useEffect } from "react";
import { db, auth, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, query, getDocs, deleteDoc, doc } from "firebase/firestore";
import { Bookmark, Trash2, Home, ChevronRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/src/lib/utils";

export default function SavedQuestions() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSaved = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'saved_questions', auth.currentUser.uid, 'questions'));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => list.push({ docId: d.id, ...d.data() }));
      setQuestions(list);
    } catch (error) {
       handleFirestoreError(error, OperationType.LIST, `saved_questions/${auth.currentUser?.uid}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, []);

  const removeSaved = async (docId: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'saved_questions', auth.currentUser.uid, 'questions', docId));
      setQuestions(prev => prev.filter(q => q.docId !== docId));
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `saved_questions/${auth.currentUser?.uid}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-bg-main min-h-screen">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
              <Bookmark className="w-6 h-6 text-accent fill-accent" />
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                Збережені питання
                <span className="text-sm bg-accent/20 text-accent px-3 py-1 rounded-full font-mono font-bold tracking-normal leading-none mb-1 ring-1 ring-accent/30">
                  {questions.length}
                </span>
              </h1>
          </div>
          <p className="text-slate-500 text-sm">Ваша персональна база складних випадків.</p>
        </div>
        <div className="flex items-center gap-3">
          {questions.length > 0 && (
            <Link 
              to={`/test?mode=practice&subject=saved`}
              className="bg-accent text-white px-6 py-2.5 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Тренувати збережені
            </Link>
          )}
          <Link to="/" className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors">
             <Home className="w-5 h-5 text-white" />
          </Link>
        </div>
      </header>

      <div className="space-y-4 max-w-4xl">
        {questions.map((q) => (
          <div key={q.docId} className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl group hover:border-accent/30 transition-all">
            <div className="flex justify-between items-start mb-4">
               <span className="text-[10px] font-black text-accent uppercase tracking-widest bg-accent/10 px-2 py-0.5 rounded">{q.category}</span>
               <button 
                onClick={() => removeSaved(q.docId)}
                className="text-slate-600 hover:text-red-500 transition-colors p-2"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>
            <h3 className="text-lg font-bold text-white mb-6 leading-relaxed">{q.text}</h3>
            <div className="grid gap-2">
               {q.options.map((opt: string, idx: number) => (
                 <div 
                  key={idx}
                  className={cn(
                    "p-3 rounded-xl border text-sm flex items-center gap-3",
                    idx === q.correctIdx ? "bg-accent/10 border-accent/30 text-accent font-bold" : "bg-slate-950 border-slate-800 text-slate-500"
                  )}
                 >
                   <span className="w-6 h-6 rounded flex items-center justify-center bg-slate-900 text-[10px]">{idx + 1}</span>
                   {opt}
                 </div>
               ))}
            </div>
          </div>
        ))}

        {questions.length === 0 && !loading && (
          <div className="py-20 text-center flex flex-col items-center opacity-30">
             <BookOpen className="w-12 h-12 mb-4" />
             <p className="text-sm font-bold uppercase tracking-widest">Збережених питань поки немає</p>
             <Link to="/test" className="mt-4 text-accent hover:underline text-xs font-bold">Перейти до тестування</Link>
          </div>
        )}
      </div>
    </div>
  );
}

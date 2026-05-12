import React, { useState, useRef, useEffect } from "react";
import * as mammoth from "mammoth";
import { parseOffice } from "officeparser";
import { db, auth } from "@/src/lib/firebase";
import { collection, addDoc, doc, serverTimestamp, writeBatch, query, getDocs, updateDoc, deleteDoc, orderBy, where } from "firebase/firestore";
import { Database, FileText, Plus, Trash2, Edit3, CheckCircle, XCircle, Upload, Loader2, Sparkles, Eye } from "lucide-react";

import { logEvent, AuditEventType } from "@/src/lib/audit";

interface DatabaseTabProps {
  showAlert: (msg: string) => void;
  setPromptModal: (modal: any) => void;
  setPromptValue: (val: string) => void;
  setConfirmModal: (modal: any) => void;
}

export default function DatabaseTab({ showAlert, setPromptModal, setPromptValue, setConfirmModal }: DatabaseTabProps) {
  const [bases, setBases] = useState<any[]>([]);
  const [importText, setImportText] = useState("");
  const [importConfig, setImportConfig] = useState({ name: "", folderName: "", course: "3", session: "summer", specialty: "med" });
  const [isUploading, setIsUploading] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<any[] | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingBase, setEditingBase] = useState<any>(null);
  const [baseQuestions, setBaseQuestions] = useState<any[]>([]);
  const [loadingBaseDetails, setLoadingBaseDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionData, setEditingQuestionData] = useState<any>(null);
  const [editingMetadata, setEditingMetadata] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBases();
  }, []);

  const fetchBases = async () => {
    try {
      const q = query(collection(db, "bases"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setBases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Fetch bases error:", error);
    }
  };

  const removeBase = async (id: string) => {
    setConfirmModal({
      message: "Ви впевнені, що хочете видалити цю базу? Всі питання будуть стерті.",
      onConfirm: async () => {
        try {
          const qRef = collection(db, "questions");
          const qSnapshot = await getDocs(query(qRef, where("baseId", "==", id)));
          
          const docs = qSnapshot.docs;
          for (let i = 0; i < docs.length; i += 400) {
             const batch = writeBatch(db);
             const chunk = docs.slice(i, i + 400);
             chunk.forEach((d) => batch.delete(d.ref));
             if (i + 400 >= docs.length) {
                batch.delete(doc(db, "bases", id));
             }
             await batch.commit();
          }
          
          if (docs.length === 0) {
             const batch = writeBatch(db);
             batch.delete(doc(db, "bases", id));
             await batch.commit();
          }
          
          logEvent(AuditEventType.DB_DELETE, `Base ID: ${id}`);
          fetchBases();
          setConfirmModal(null);
        } catch (error) {
          console.error(error);
          setConfirmModal(null);
          showAlert("Помилка при видаленні.");
        }
      }
    });
  };

  const toggleBaseStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = (currentStatus === "Active" || !currentStatus) ? "Draft" : "Active";
      await updateDoc(doc(db, "bases", id), { status: newStatus });
      await logEvent(
        AuditEventType.SYSTEM_CONFIG_CHANGE,
        `Змінено статус бази: ${id} на ${newStatus}`,
        auth.currentUser?.uid,
        auth.currentUser?.email || undefined
      );
      fetchBases();
    } catch (error) {
      console.error(error);
      showAlert("Помилка при зміні статусу.");
    }
  };

  const openBaseForEditing = async (base: any) => {
    setEditingBase(base);
    setLoadingBaseDetails(true);
    setSearchQuery("");
    try {
      const qRef = collection(db, "questions");
      const qSnapshot = await getDocs(query(qRef, where("baseId", "==", base.id)));
      let bqs = qSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      bqs.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setBaseQuestions(bqs);
    } catch(err) {
      console.error(err);
      showAlert("Помилка завантаження питань бази");
      setEditingBase(null);
    }
    setLoadingBaseDetails(false);
  };

  const handleUpdateQuestion = async (qId: string, newText: string, newOptions: string[], newCorrectIdx: number) => {
    try {
      await updateDoc(doc(db, "questions", qId), {
         text: newText,
         options: newOptions,
         correctIdx: newCorrectIdx
      });
      await logEvent(
        AuditEventType.QUESTION_EDIT,
        `Оновлено питання ID: ${qId}`,
        auth.currentUser?.uid,
        auth.currentUser?.email || undefined
      );
      setBaseQuestions(prev => prev.map(q => q.id === qId ? { ...q, text: newText, options: newOptions, correctIdx: newCorrectIdx } : q));
      showAlert("Питання збережено!");
    } catch(err) {
      console.error(err);
      showAlert("Помилка оновлення питання");
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
     setConfirmModal({
        message: "Видалити це питання з бази?",
        onConfirm: async () => {
           try {
              await deleteDoc(doc(db, "questions", qId));
              await logEvent(
                AuditEventType.QUESTION_DELETE,
                `Видалено питання ID: ${qId}`,
                auth.currentUser?.uid,
                auth.currentUser?.email || undefined
              );
              setBaseQuestions(prev => prev.filter(q => q.id !== qId));
              showAlert("Питання видалено");
              setConfirmModal(null);
              // Decrement count in base
              if (editingBase) {
                 await updateDoc(doc(db, "bases", editingBase.id), { count: baseQuestions.length - 1 });
                 fetchBases();
                 setEditingBase({ ...editingBase, count: editingBase.count - 1 });
              }
           } catch(err) {
              console.error(err);
              showAlert("Помилка видалення");
              setConfirmModal(null);
           }
        }
     });
  };

  const editBaseMetadata = async (base: any) => {
    // Basic implementation using prompt/confirm simple UI for now
    // Actually, let's just use the setConfirmModal with a custom UI if possible, 
    // but the system setConfirmModal usually takes just a message.
    // I'll add a simple custom modal state for metadata editing.
    setEditingMetadata(base);
  };

  const updateBaseMetadata = async (id: string, updates: any) => {
    try {
      await updateDoc(doc(db, "bases", id), updates);
      await logEvent(
        AuditEventType.SYSTEM_CONFIG_CHANGE,
        `Оновлено метадані бази: ${id}. Зміни: ${JSON.stringify(updates)}`,
        auth.currentUser?.uid,
        auth.currentUser?.email || undefined
      );
      fetchBases();
      setEditingMetadata(null);
      showAlert("Метадані оновлено!");
    } catch (error) {
      console.error(error);
      showAlert("Помилка оновлення метаданих.");
    }
  };

  const stripRtf = (str: string) => {
    let result = str.replace(/\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/g, "");
    result = result.replace(/\\\n/g, "\n");
    return result;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    await new Promise(r => setTimeout(r, 50)); // Allow UI to repaint

    try {
      if (file.name.endsWith('.pdf')) {
         showAlert("PDF файли автоматично не підтримуються через складне форматування. Будь ласка, скопіюйте текст вручну і вставте в поле.");
         setIsUploading(false);
         return;
      }
      
      let newText = "";

      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        newText = result.value;
      } else if (file.name.endsWith('.rtf')) {
        try {
           const arrayBuffer = await file.arrayBuffer();
           const ast = await parseOffice(arrayBuffer);
           let parsedText = ast.toText();
           
           // Detect if RTF was parsed as ISO-8859-1 but actually contains Windows-1251 (Cyrillic)
           const latin1Match = parsedText.match(/[\xC0-\xFF]/g);
           const cyrillicMatch = parsedText.match(/[А-Яа-яЄєІіЇїҐґ]/g);
           
           if (latin1Match && (!cyrillicMatch || latin1Match.length > cyrillicMatch.length)) {
               const bytes = new Uint8Array(parsedText.length);
               for (let i = 0; i < parsedText.length; i++) {
                   bytes[i] = parsedText.charCodeAt(i) & 0xFF;
               }
               parsedText = new TextDecoder('windows-1251').decode(bytes);
           }
           
           newText = parsedText;
        } catch (e) {
           console.error("RTF parse error", e);
           const text = await file.text();
           newText = stripRtf(text);
        }
      } else {
        newText = await file.text();
      }

      if (!newText || newText.trim().length === 0) {
        setIsUploading(false);
        showAlert("Файл порожній або його формат не підтримується для автоматичного читання. Вставте текст вручну.");
        return;
      }

      setImportText(newText);
      setIsUploading(false);
      showAlert("Файл успішно зачитано. Тепер ви можете переглянути або змінити текст і натиснути 'Виконати імпорт бази'.");
    } catch (err) {
      console.error(err);
      showAlert("Помилка при читанні файлу.");
      setIsUploading(false);
    }
  };

  const handleImport = async (overrideText?: string | React.MouseEvent) => {
    const textToParse = typeof overrideText === 'string' ? overrideText : importText;
    if (!textToParse) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    await new Promise(r => setTimeout(r, 50)); // Allow UI to repaint and show loading state
    
    try {
      let parsedQuestions = [];
      let tryParse = null;
      try { tryParse = JSON.parse(textToParse); } catch(e) {}
      
      if (tryParse && Array.isArray(tryParse)) {
         parsedQuestions = tryParse;
      } else if (tryParse && typeof tryParse === 'object' && tryParse.questions) {
         parsedQuestions = tryParse.questions;
      } else {
         const cleanText = textToParse.replace(/\r/g, '');
         let blocks = [];
         
         const hasNumbering = /(?:^|\n)\s*(?:Задача|Питання|Test|Вопрос|№)?\s*\d+[\.\)]\s*/i.test(cleanText);
         
         if (hasNumbering) {
            blocks = cleanText.split(/(?:^|\n)(?=\s*(?:Задача|Питання|Test|Вопрос|№)?\s*\d+[\.\)]\s*)/i).filter(b => b.trim().length > 10);
         } else {
            blocks = cleanText.split(/\n\s*\n/).filter(b => b.trim().length > 10);
         }
         
         parsedQuestions = blocks.map((b, i) => {
            const lines = b.trim().split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) return null;
            
            let optionsStartIndex = lines.findIndex(
              l =>
                /^[-+*]/.test(l) ||
                /^[A-EА-ЯІЇЄa-eа-яіїє][\.\)]\s*\*?/i.test(l)
            );
            if (optionsStartIndex === -1 || optionsStartIndex === 0) optionsStartIndex = 1;
            
            const text = lines.slice(0, optionsStartIndex).join('\n');
            let optionsLines = lines.slice(optionsStartIndex);

            const normalizedOptions: string[] = [];

            for (let j = 0; j < optionsLines.length; j++) {
              const current = optionsLines[j];
              const next = optionsLines[j + 1];

              if (/^[A-EА-ЯІЇЄa-eа-яіїє][\.\)]\s*\*?\s*$/i.test(current) && next) {
                normalizedOptions.push(`${current} ${next}`);
                j++;
              } else {
                normalizedOptions.push(current);
              }
            }

            optionsLines = normalizedOptions;

            let correctOptStr = "А";
            let foundCorrectIndex = 0;

            let options = optionsLines.map((opt, optIdx) => {
              let isCorrect =
                /^[A-EА-ЯІЇЄa-eа-яіїє][\.\)]\s*\*/i.test(opt) ||
                opt.includes('*') ||
                opt.startsWith('+') ||
                opt.startsWith('*') ||
                opt.endsWith('+') ||
                opt.endsWith('*');

              let cleanOpt = opt
                .replace(/^[-+*]*(?:[A-EА-ЯІЇЄa-eа-яіїє]|[0-9]+)[\.\)]\s*\*?\s*/i, '')
                .replace(/\s*\+$/, '')
                .replace(/\*/g, '')
                .trim();
              if (isCorrect) foundCorrectIndex = optIdx;
              return cleanOpt;
            }).filter(o => o);
            
            if (options.length < 2) {
               // Fallback if formatting is weird
               options = optionsLines.length > 0 ? optionsLines : ["Так", "Ні", "Не знаю"];
            }

            correctOptStr = options[foundCorrectIndex] || options[0];

            return {
               id: `gen-${i}`,
               text: text.slice(0, 1000),
               options: options,
               correctOption: correctOptStr,
               correctIdx: foundCorrectIndex || 0,
               category: "Загальна"
            };
         }).filter(Boolean);
      }

      if (parsedQuestions.length === 0) {
         parsedQuestions = [{ 
           id: "1", 
           text: "Пусте питання", 
           options: ["-"], 
           correctOption: "-",
           correctIdx: 0,
           category: "Загальна"
         }];
      }

      setPreviewQuestions(parsedQuestions);
      setIsUploading(false);
    } catch (e) {
      console.error(e);
      showAlert("Помилка під час аналізу тексту.");
      setIsUploading(false);
    }
  };

  const confirmUpload = async () => {
    if (!previewQuestions || previewQuestions.length === 0) return;
    setIsUploading(true);
    setUploadProgress(1); // START HERE IS CRITICAL FOR UI TO RENDER THE PROGRESS BAR
    await new Promise(r => setTimeout(r, 50)); // Allow UI to repaint
    
    try {
      const baseRef = collection(db, "bases");
      const baseName = importConfig.name || `База від ${new Date().toLocaleDateString()}`;
      const docRef = await addDoc(baseRef, {
        name: baseName,
        folderName: importConfig.folderName || null,
        course: importConfig.course,
        specialty: importConfig.specialty,
        session: importConfig.session,
        count: previewQuestions.length,
        status: 'Active',
        color: 'text-emerald-500',
        createdAt: serverTimestamp()
      });
      
      const qRef = collection(db, "questions");
      let count = 0;
      for (let i = 0; i < previewQuestions.length; i += 400) {
         const batch = writeBatch(db);
         const chunk = previewQuestions.slice(i, i + 400);
         chunk.forEach((q, idx) => {
            const newDocRef = doc(qRef);
            batch.set(newDocRef, {
                text: q.text,
                options: q.options,
                correctIdx: typeof q.correctIdx === 'number' ? q.correctIdx : 0,
                category: q.category || 'Загальна',
                baseId: docRef.id,
                orderIndex: count + idx
            });
         });
         await batch.commit();
         count += chunk.length;
         setUploadProgress(Math.floor((count / previewQuestions.length) * 100));
         await new Promise(r => setTimeout(r, 100)); // Allow UI to repaint
      }

      setImportText("");
      setPreviewQuestions(null);
      fetchBases();
      logEvent(AuditEventType.DB_IMPORT, `Base: ${baseName}, Questions: ${previewQuestions.length}`);
      showAlert(`Базу успішно імпортовано: ${previewQuestions.length} питань.`);
    } catch (e) {
      console.error(e);
      showAlert("Помилка імпорту.");
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
         <div className="lg:col-span-3 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
               <div className="w-12 h-12 bg-accent/20 text-accent rounded-2xl flex items-center justify-center mb-4">
                  <Database className="w-6 h-6" />
               </div>
               <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Статистика баз</h3>
               <p className="text-xs text-slate-500 mb-6">Загальна інформація про матеріали</p>
               <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-400">Активних баз</span>
                  <span className="text-lg font-black text-white">{bases.filter(b => b.status === "Active").length}</span>
               </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Питань у системі</p>
               <p className="text-2xl font-black text-white">{bases.reduce((acc, b) => acc + (b.count || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Черга на імпорт</p>
               <p className="text-2xl font-black text-accent">0</p>
            </div>
         </div>

         <div className="lg:col-span-7 space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Завантаження бази</h3>
                <p className="text-xs text-slate-500">Завантажте файл з питаннями (.docx, .json, .rtf, .txt)</p>
              </div>
              
              <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`w-full border-2 border-dashed ${isUploading ? 'border-accent bg-accent/5' : 'border-slate-700 hover:border-accent bg-slate-950/50 hover:bg-slate-950'} rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group`}
              >
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${isUploading ? 'bg-accent/20 text-accent' : 'bg-slate-900 group-hover:bg-accent/20 text-slate-400 group-hover:text-accent'}`}>
                    {isUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
                 </div>
                 <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">{isUploading ? 'Обробка файлу...' : 'Натисніть для вибору файлу'}</h4>
                 <p className="text-xs text-slate-500 font-mono">Підтримуються DOCX, RTF, TXT, JSON</p>
                 <input ref={fileInputRef} type="file" className="hidden" accept=".json,.pdf,.rtf,.txt,.docx" onChange={handleFileUpload} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <input 
                  type="text" 
                  placeholder="Назва бази" 
                  value={importConfig.name}
                  onChange={(e) => setImportConfig({...importConfig, name: e.target.value})}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                />
                <input 
                  type="text" 
                  placeholder="Папка/Об'єднання (необов.)" 
                  value={importConfig.folderName || ""}
                  onChange={(e) => setImportConfig({...importConfig, folderName: e.target.value})}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                />
                <select 
                  value={importConfig.course}
                  onChange={(e) => setImportConfig({...importConfig, course: e.target.value})}
                  className="col-span-3 lg:col-span-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                >
                  <option value="1">1 Курс</option>
                  <option value="2">2 Курс</option>
                  <option value="3">3 Курс</option>
                  <option value="4">4 Курс</option>
                  <option value="5">5 Курс</option>
                  <option value="6">6 Курс</option>
                </select>
                <select 
                  value={importConfig.specialty}
                  onChange={(e) => setImportConfig({...importConfig, specialty: e.target.value})}
                  className="col-span-3 lg:col-span-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                >
                  <option value="med">Медицина</option>
                  <option value="dent">Стоматологія</option>
                  <option value="pharm">Фармація</option>
                </select>
                <select 
                  value={importConfig.session}
                  onChange={(e) => setImportConfig({...importConfig, session: e.target.value})}
                  className="col-span-3 lg:col-span-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                >
                  <option value="winter">Зимова сесія</option>
                  <option value="summer">Літня сесія</option>
                </select>
              </div>

              <textarea 
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='Завантажте файл кнопкою вище (DOCX, PDF, RTF), або вставте текст сюди для редагування...'
                className="w-full h-80 bg-slate-950 border border-slate-800 rounded-[2rem] p-6 text-xs font-mono text-slate-400 focus:outline-none focus:border-accent resize-none placeholder:italic"
              />
              <button 
                id="import-btn"
                onClick={handleImport}
                disabled={isUploading}
                className="w-full bg-accent text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-accent/20 disabled:opacity-50 relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isUploading ? `Обробка... ${uploadProgress > 0 ? uploadProgress + '%' : ''}` : "Виконати імпорт бази"}
                </span>
                {isUploading && uploadProgress > 0 && (
                  <div 
                    className="absolute bottom-0 left-0 h-full bg-black/20 transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }} 
                  />
                )}
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
               <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Завантажені бази</h3>
               <div className="space-y-4">
                  {bases.map((base) => (
                    <div key={base.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-slate-950 border border-slate-800 rounded-2xl gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                             <span className="text-sm font-bold text-white max-w-[200px] md:max-w-xs truncate" title={base.name}>{base.name}</span>
                             <button onClick={() => editBaseMetadata(base)} className="text-slate-500 hover:text-white p-1">
                               <Edit3 className="w-3.5 h-3.5" />
                             </button>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono">
                             {base.count || 0} питань • {base.course} Курс • 
                             {base.specialty === 'med' ? ' Мед ' : base.specialty === 'dent' ? ' Стом ' : ' Фарм '} • 
                             {base.session === 'summer' ? 'Літо' : 'Зима'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <button 
                           onClick={() => openBaseForEditing(base)}
                           className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full md:w-auto flex justify-center items-center gap-2"
                        >
                           <Eye className="w-3.5 h-3.5" /> Переглянути
                        </button>
                        <button 
                           onClick={() => toggleBaseStatus(base.id, base.status)}
                           className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full md:w-auto flex justify-center items-center gap-2 ${base.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                           {base.status === 'Active' ? <><CheckCircle className="w-3.5 h-3.5" /> Активно</> : <><XCircle className="w-3.5 h-3.5" /> Чернетка</>}
                        </button>
                        <button onClick={() => removeBase(base.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {bases.length === 0 && (
                     <div className="text-center p-8 bg-slate-950 border border-slate-800 rounded-2xl">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Баз ще немає</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
      {previewQuestions && (
          <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md p-6 flex flex-col">
             <div className="flex-1 w-full max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-3xl flex flex-col overflow-hidden relative">
                {isUploading && uploadProgress > 0 && (
                  <div 
                    className="absolute top-0 left-0 h-1.5 bg-accent transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }} 
                  />
                )}
                
                <div className="flex justify-between items-center mb-6 shrink-0">
                   <div>
                     <h2 className="text-xl font-black text-white uppercase tracking-widest">Попередній перегляд бази</h2>
                     <p className="text-xs text-slate-500 font-mono mt-1">Знайдено питань: {previewQuestions.length}</p>
                   </div>
                   <div className="flex gap-4">
                     <button 
                       onClick={() => { setPreviewQuestions(null); setIsUploading(false); setUploadProgress(0); }} 
                       disabled={isUploading}
                       className="px-6 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors disabled:opacity-50"
                     >
                       Скасувати
                     </button>
                     <button 
                       onClick={confirmUpload}
                       disabled={isUploading}
                       className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-lg shadow-accent/20 disabled:opacity-50"
                     >
                       {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                       {isUploading ? `Завантаження... ${uploadProgress}%` : 'Затвердити і завантажити'}
                     </button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
                   {previewQuestions.slice(0, 100).map((q, idx) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                         <div className="flex gap-4 items-start mb-4">
                            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0 border border-slate-800">
                               <span className="text-xs font-black text-slate-500">{idx + 1}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-200 leading-relaxed whitespace-pre-wrap">{q.text}</p>
                         </div>
                         <div className="space-y-2 pl-12 flex flex-col items-start gap-2">
                           {q.options.map((opt: string, optIdx: number) => {
                             const isCorrect = optIdx === q.correctIdx;
                             return (
                               <div key={optIdx} className={`px-4 py-2 rounded-xl text-xs font-semibold ${isCorrect ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                                 {isCorrect && <span className="mr-2 font-black">✓</span>}
                                 {opt}
                               </div>
                             );
                           })}
                         </div>
                      </div>
                   ))}
                   {previewQuestions.length > 100 && (
                     <div className="text-center p-8 bg-slate-950 border border-slate-800 rounded-2xl">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Показано перші 100 питань із {previewQuestions.length}</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        )}

      {editingBase && (
          <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md p-6 flex flex-col">
             <div className="flex-1 w-full max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-3xl flex flex-col overflow-hidden relative">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 shrink-0 gap-4">
                   <div>
                     <h2 className="text-xl font-black text-white uppercase tracking-widest">{editingBase.name}</h2>
                     <p className="text-xs text-slate-500 font-mono mt-1">Питань у базі: {baseQuestions.length}</p>
                   </div>
                   <div className="flex flex-wrap gap-4 items-center">
                     <div className="relative">
                        <input 
                           type="text"
                           placeholder="Пошук питань..."
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent w-64"
                        />
                     </div>
                     <button 
                       onClick={() => showAlert("Ця функція знаходиться у розробці. ШІ зможе автоматично знаходити помилки та покращувати питання.")}
                       className="flex items-center gap-2 px-6 py-3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600 via-accent to-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-colors shadow-lg shadow-accent/20"
                     >
                       <Sparkles className="w-4 h-4" /> AI Оптимізація
                     </button>
                     <button 
                       onClick={() => setEditingBase(null)} 
                       className="px-6 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors"
                     >
                       Закрити
                     </button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
                   {loadingBaseDetails ? (
                      <div className="flex items-center justify-center h-full">
                         <Loader2 className="w-8 h-8 animate-spin text-accent" />
                      </div>
                   ) : (
                      baseQuestions.filter(q => q.text.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 100).map((q, idx) => (
                         <div key={q.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                            <div className="flex justify-between items-start mb-4">
                               <div className="flex gap-4 items-start flex-1">
                                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0 border border-slate-800">
                                     <span className="text-xs font-black text-slate-500">{idx + 1}</span>
                                  </div>
                                  {editingQuestionId === q.id ? (
                                    <textarea
                                      value={editingQuestionData.text}
                                      onChange={(e) => setEditingQuestionData({ ...editingQuestionData, text: e.target.value })}
                                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-accent min-h-[100px]"
                                    />
                                  ) : (
                                    <p className="text-sm font-bold text-slate-200 leading-relaxed whitespace-pre-wrap">{q.text}</p>
                                  )}
                               </div>
                               <div className="flex flex-col gap-2 shrink-0 ml-4">
                                  {editingQuestionId === q.id ? (
                                    <>
                                      <button onClick={() => {
                                         handleUpdateQuestion(q.id, editingQuestionData.text, editingQuestionData.options, editingQuestionData.correctIdx);
                                         setEditingQuestionId(null);
                                      }} className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-colors">
                                        <CheckCircle className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => setEditingQuestionId(null)} className="p-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl hover:bg-slate-800 transition-colors">
                                        <XCircle className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => {
                                        setEditingQuestionId(q.id);
                                        setEditingQuestionData({ text: q.text, options: [...q.options], correctIdx: q.correctIdx });
                                      }} className="p-2 bg-slate-900 border border-slate-800 text-blue-400 rounded-xl hover:bg-blue-400/10 transition-colors">
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 bg-slate-900 border border-slate-800 text-rose-500 rounded-xl hover:bg-rose-500/10 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                               </div>
                            </div>
                            <div className="space-y-2 pl-12 flex flex-col items-start gap-2 w-full">
                              {(editingQuestionId === q.id ? editingQuestionData.options : q.options).map((opt: string, optIdx: number) => {
                                const isCorrect = optIdx === (editingQuestionId === q.id ? editingQuestionData.correctIdx : q.correctIdx);
                                return (
                                  <div key={optIdx} className="w-full flex items-center gap-2">
                                    {editingQuestionId === q.id ? (
                                      <>
                                        <button 
                                          onClick={() => setEditingQuestionData({ ...editingQuestionData, correctIdx: optIdx })}
                                          className={`w-6 h-6 rounded-md flex justify-center items-center shrink-0 border ${isCorrect ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-slate-900 border-slate-800 text-transparent'}`}
                                        >
                                          ✓
                                        </button>
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => {
                                            const newOps = [...editingQuestionData.options];
                                            newOps[optIdx] = e.target.value;
                                            setEditingQuestionData({ ...editingQuestionData, options: newOps });
                                          }}
                                          className={`flex-1 bg-slate-900 border ${isCorrect ? 'border-emerald-500/30' : 'border-slate-800'} rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none focus:border-accent text-slate-300`}
                                        />
                                      </>
                                    ) : (
                                      <div className={`px-4 py-2 rounded-xl text-xs font-semibold ${isCorrect ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                                        {isCorrect && <span className="mr-2 font-black">✓</span>}
                                        {opt}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                            </div>
                         </div>
                      ))
                   )}
                   {!loadingBaseDetails && baseQuestions.length > 100 && searchQuery === "" && (
                     <div className="text-center p-8 bg-slate-950 border border-slate-800 rounded-2xl">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Показано перші 100 питань із {baseQuestions.length}. Скористайтеся пошуком.</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
      )}

      {editingMetadata && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
           <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Редагувати метадані</h3>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Назва бази</label>
                    <input 
                       type="text" 
                       value={editingMetadata.name}
                       onChange={(e) => setEditingMetadata({ ...editingMetadata, name: e.target.value })}
                       className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Курс</label>
                       <select 
                          value={editingMetadata.course}
                          onChange={(e) => setEditingMetadata({ ...editingMetadata, course: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                       >
                          {[1,2,3,4,5,6].map(c => <option key={c} value={String(c)}>{c} Курс</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Спеціальність</label>
                       <select 
                          value={editingMetadata.specialty || "med"}
                          onChange={(e) => setEditingMetadata({ ...editingMetadata, specialty: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                       >
                          <option value="med">Медицина</option>
                          <option value="dent">Стоматологія</option>
                          <option value="pharm">Фармація</option>
                       </select>
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Сесія</label>
                    <select 
                       value={editingMetadata.session || "summer"}
                       onChange={(e) => setEditingMetadata({ ...editingMetadata, session: e.target.value })}
                       className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                    >
                       <option value="winter">Зимова</option>
                       <option value="summer">Літня</option>
                    </select>
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <button 
                    onClick={() => setEditingMetadata(null)}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                 >
                    Скасувати
                 </button>
                 <button 
                    onClick={() => updateBaseMetadata(editingMetadata.id, {
                       name: editingMetadata.name,
                       course: editingMetadata.course,
                       specialty: editingMetadata.specialty || "med",
                       session: editingMetadata.session || "summer"
                    })}
                    className="flex-1 px-4 py-3 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-accent/20"
                 >
                    Зберегти
                 </button>
              </div>
           </div>
        </div>
      )}
    </>
  );
}

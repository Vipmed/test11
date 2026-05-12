import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Home, ChevronLeft, ChevronRight, Save, Zap, Clock, Info, BrainCircuit, Loader2, Bookmark, BookmarkCheck, BarChart3, Download, Flag, X, RefreshCw, Settings, Search, Flame } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { Question } from "@/src/constants";
import { explainQuestion } from "@/src/services/geminiService";
import { auth, db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { setDoc, doc, getDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where, getDocs, limit } from "firebase/firestore";
import { useAuth } from "@/src/context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { searchQuestions } from "@/src/services/searchService";

const MOCK_QUESTIONS: Question[] = [
  {
    id: "1",
    text: "Хворий 45-ти років скаржиться на задишку при фізичному навантаженні, періодичні болі в ділянці серця. Об'єктивно: межі серця розширені вліво, при аускультації — систолічний шум на верхівці, що проводиться в пахвову ділянку. Яка найбільш імовірна вада серця?",
    options: [
      "Мітральний стеноз",
      "Мітральна недостатність",
      "Аортальний стеноз",
      "Аортальна недостатність",
      "Стеноз тристулкового клапана"
    ],
    correctIdx: 1,
    category: "Кардіологія",
    baseId: "base2024"
  },
  {
    id: "2",
    text: "У пацієнта з гіпертонічною хворобою розвинувся напад задишки, серцебиття. Об'єктивно: дихання 32/хв, пульс 110/хв, АТ 200/110 мм рт.ст. В легенях вислуховуються вологі дрібнопухирчасті хрипи. Яке ускладнення виникло?",
    options: [
      "Серцева астма",
      "Тромбоемболія легеневої артерії",
      "Напад бронхіальної астми",
      "Пневмоторакс",
      "Пневмонія"
    ],
    correctIdx: 0,
    category: "Кардіологія",
    baseId: "base2024"
  },
  {
    id: "3",
    text: "Для лікування залізодефіцитної анемії хворому призначено препарати заліза. Який показник свідчить про ефективність терапії через 7-10 днів?",
    options: [
      "Збільшення кількості лейкоцитів",
      "Збільшення вмісту гемоглобіну",
      "Ретикулоцитарний криз",
      "Зменшення швидкості осідання еритроцитів",
      "Збільшення кількості тромбоцитів"
    ],
    correctIdx: 2,
    category: "Гематологія",
    baseId: "base2024"
  }
];

import { logEvent, AuditEventType } from "@/src/lib/audit";

export default function TestScreen() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [autoNextDelay, setAutoNextDelay] = useState(2);
  const [timer, setTimer] = useState(0);
  const [showAiExplain, setShowAiExplain] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportComment, setReportComment] = useState("");
  const [isFinished, setIsFinished] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [jumpValue, setJumpValue] = useState("");
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [autoNextOnError, setAutoNextOnError] = useState(true);
  const [revealCorrectImmediately, setRevealCorrectImmediately] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showSkippedWarning, setShowSkippedWarning] = useState(false);
  const [systemConfig, setSystemConfig] = useState<any>(null);

  useEffect(() => {
    const fetchSystemConfig = async () => {
      const snap = await getDoc(doc(db, "system", "config"));
      if (snap.exists()) {
        setSystemConfig(snap.data());
      }
    };
    fetchSystemConfig();
  }, []);

  useEffect(() => {
    setJumpValue((currentIndex + 1).toString());
  }, [currentIndex]);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoNextRef = useRef<NodeJS.Timeout | null>(null);

  const subject = searchParams.get("subject") || "all";
  const mode = searchParams.get("mode") || "practice";
  const limitParam = searchParams.get("limit");
  const searchTerm = searchParams.get("search");
  const isStressTest = mode === "stress";

  const aiEnabled = false; // Forced disabled (stub)
  const sidebarEnabled = false; // Forced disabled (stub)

  const [timeLeft, setTimeLeft] = useState(isStressTest ? 200 * 60 : 0);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      let fetched: Question[] = [];
      const questionLimitVal = limitParam === 'all' ? 5000 : parseInt(limitParam || (isStressTest ? "200" : "80"));
      const baseIds = (subject && subject !== 'all') ? subject.split(',') : [];
      
      if (searchTerm) {
        // Use optimized search service
        const results = await searchQuestions(searchTerm, baseIds, 500);
        fetched = results;
      } else if (subject === "saved") {
        if (!auth.currentUser) return;
        const q = query(collection(db, "saved_questions", auth.currentUser.uid, "questions"));
        const snap = await getDocs(q);
        snap.forEach(d => {
          fetched.push({ ...(d.data() as Question), id: d.id });
        });
      } else if (mode === "practice_err" || mode === "check") {
        if (!auth.currentUser) return;
        if (baseIds.length > 0 && baseIds[0] !== 'all') {
           const q = query(collection(db, "saved_questions", auth.currentUser.uid, "questions"));
           const snap = await getDocs(q);
           snap.forEach(d => {
             const data = d.data() as any;
             if (baseIds.includes(data.baseId)) {
                fetched.push({ ...(data as Question), id: d.id });
             }
           });
        }
      } else {
        if (baseIds.length > 0) {
           // Optimized: handle multiple baseIds using chunked 'in' queries
           const chunks: string[][] = [];
           for (let i = 0; i < baseIds.length; i += 10) {
             chunks.push(baseIds.slice(i, i + 10));
           }
           
           const promises = chunks.map(chunk => 
             getDocs(query(collection(db, "questions"), where("baseId", "in", chunk)))
           );
           
           const snaps = await Promise.all(promises);
           snaps.forEach(snap => snap.forEach(d => fetched.push({ ...(d.data() as Question), id: d.id })));
           
           if (limitParam !== 'all') {
              fetched = fetched.sort(() => Math.random() - 0.5).slice(0, questionLimitVal);
           }
        } else {
          // Default: fetch from all questions if 'all' or no subject
          const q = query(collection(db, "questions"), limit(questionLimitVal));
          const snap = await getDocs(q);
          snap.forEach(d => {
            fetched.push({ ...(d.data() as Question), id: d.id });
          });
        }
      }

      if (isStressTest) {
        if (fetched.length === 0) {
           fetched = [...MOCK_QUESTIONS];
        }
        // Only slice to 200, do not repeat to force 200 if fewer are available
        fetched = fetched.slice(0, 200).map((q, i) => ({ ...q, id: `stress-${i}` }));
      } else if (fetched.length === 0) {
        fetched = MOCK_QUESTIONS;
      }
      
      // Randomize if not a small subset or if explicitly requested (not usually for training)
      if (mode !== 'practice') {
        fetched = fetched.sort(() => Math.random() - 0.5);
      } else {
        // Sort sequentially if practice mode. 
        // Newer questions have orderIndex to preserve natural order.
        fetched = fetched.sort((a, b) => {
           const aIdx = (a as any).orderIndex ?? 0;
           const bIdx = (b as any).orderIndex ?? 0;
           if (aIdx !== bIdx) return aIdx - bIdx;
           // Fallback for older dbs without orderIndex
           return a.id.localeCompare(b.id);
        });
      }

      // Shuffle options for each question
      fetched = fetched.map(q => {
        const optionsWithMetadata = q.options.map((opt, idx) => ({
          text: opt,
          isCorrect: idx === q.correctIdx
        }));
        
        // Fisher-Yates shuffle
        for (let i = optionsWithMetadata.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [optionsWithMetadata[i], optionsWithMetadata[j]] = [optionsWithMetadata[j], optionsWithMetadata[i]];
        }
        
        return {
          ...q,
          options: optionsWithMetadata.map(o => o.text),
          correctIdx: optionsWithMetadata.findIndex(o => o.isCorrect)
        };
      });
      
      setQuestions(fetched);
      if (fetched.length > 0) {
        logEvent(AuditEventType.TEST_START, `Mode: ${mode}, Questions: ${fetched.length}`, user?.uid, user?.email || undefined);
      }
      
      // Update streak on successful session start (if not already updated today)
      if (user && fetched.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const lastActive = profile?.lastActiveDate;
        if (lastActive !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          const newStreak = (lastActive === yesterdayStr) ? (profile?.streak || 0) + 1 : 1;
          
          updateProfile({
            streak: newStreak,
            lastActiveDate: today
          }).catch(err => console.error("Streak sync failed:", err));
        }
      }
    } catch (e) {
      console.error(e);
      // Fallback to mock questions without forcing 200 items unless they were already there
      setQuestions(MOCK_QUESTIONS);
    } finally {
      setLoading(false);
    }
  }, [subject, auth.currentUser?.uid, isStressTest, limitParam, searchTerm, mode]);

  useEffect(() => {
    fetchQuestions();
    if (isStressTest) {
      setAutoNextDelay(0.3); // Very fast but visible
      setAutoNextOnError(true);
      setRevealCorrectImmediately(true);
    }
  }, [fetchQuestions, isStressTest]);

  // Restore progress for practice mode
  useEffect(() => {
    if (!loading && questions.length > 0 && profile && !hasRestoredProgress && mode === 'practice') {
      const savedProgress = profile.progress?.[subject];
      if (savedProgress !== undefined && typeof savedProgress === 'number' && savedProgress < questions.length && savedProgress >= 0) {
        setCurrentIndex(savedProgress);
        setJumpValue((savedProgress + 1).toString());
      }
      setHasRestoredProgress(true);
    }
  }, [loading, questions.length, profile, hasRestoredProgress, mode, subject]);

  const question = questions[currentIndex];
  const isRepeat = question?.id?.includes('stress') ? false : (parseInt(question?.id || '0') % 3 === 0);

  // Check if saved
  useEffect(() => {
    const checkSaved = async () => {
      if (!auth.currentUser || !question?.id) return;
      const docRef = doc(db, "saved_questions", auth.currentUser.uid, "questions", question.id);
      const snap = await getDoc(docRef);
      setIsSaved(snap.exists());
    };
    checkSaved();
  }, [currentIndex, question?.id]);

  const handleSave = async () => {
    if (!auth.currentUser || !question?.id) return;
    const docRef = doc(db, "saved_questions", auth.currentUser.uid, "questions", question.id);
    
    try {
      if (isSaved) {
        await deleteDoc(docRef);
        setIsSaved(false);
        logEvent(AuditEventType.SAVED_QUESTION, `Removed from saved: ${question.id}`, user?.uid, user?.email || undefined);
      } else {
        await setDoc(docRef, {
          ...question,
          savedAt: new Date().toISOString()
        });
        setIsSaved(true);
        logEvent(AuditEventType.SAVED_QUESTION, `Added to saved: ${question.id}`, user?.uid, user?.email || undefined);
        setToastMessage("Питання збережено!");
        setTimeout(() => setToastMessage(""), 2000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `saved_questions/${auth.currentUser.uid}`);
    }
  };

  const handleAiExplain = useCallback(async () => {
    if (!question) return;
    if (aiResponse) {
      setShowAiExplain(true);
      return;
    }

    setIsAiLoading(true);
    setShowAiExplain(true);
    try {
      const result = await explainQuestion(question.text, question.options[question.correctIdx]);
      setAiResponse(result);
    } catch (e) {
      console.error(e);
    }
    setIsAiLoading(false);
  }, [aiResponse, question]);

  const goToQuestion = useCallback((nextIdx: number) => {
     if (autoNextRef.current) clearTimeout(autoNextRef.current);
     setCurrentIndex(nextIdx);
     
     // Save progress for practice mode
     if (mode === 'practice' && user) {
       updateProfile({
         progress: {
           ...(profile?.progress || {}),
           [subject]: nextIdx
         }
       }).catch(e => console.error("Failed to save progress", e));
     }

     const prevAnswer = answers[nextIdx];
     if (prevAnswer !== undefined) {
         const correct = prevAnswer === questions[nextIdx].correctIdx;
         if (correct || isStressTest) {
           setSelectedIdx(prevAnswer);
           setIsCorrect(correct);
         } else {
           setSelectedIdx(null);
           setIsCorrect(null);
         }
     } else {
         setSelectedIdx(null);
         setIsCorrect(null);
     }
     setAiResponse(null);
     setShowAiExplain(false);
     setJumpValue("");
  }, [answers, questions, isStressTest, mode, user, profile, subject, updateProfile]);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      logEvent(AuditEventType.TEST_START, `Navigating to question ${currentIndex + 2}/${questions.length}`, user?.uid, user?.email || undefined);
      goToQuestion(currentIndex + 1);
    } else if (questions.length > 0) {
      handleFinishCheck();
    }
  }, [currentIndex, questions.length, goToQuestion, user?.uid, user?.email]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      goToQuestion(currentIndex - 1);
    }
  }, [currentIndex, goToQuestion]);

  const handleJump = () => {
    const val = parseInt(jumpValue);
    if (!isNaN(val) && val >= 1 && val <= questions.length) {
      goToQuestion(val - 1);
    } else {
      setJumpValue((currentIndex + 1).toString());
    }
  };

  const handleSelect = useCallback((idx: number) => {
    // If already answered and (it's stress test OR it was correct), don't allow changes
    if ((answers[currentIndex] !== undefined && (isStressTest || isCorrect)) || !question) return;
    
    // Also guard with selectedIdx for the current render cycle
    if (selectedIdx !== null && (isStressTest || isCorrect)) return;

    const isFirstAttempt = answers[currentIndex] === undefined;
    const wasPreviouslyWrong = answers[currentIndex] !== undefined && answers[currentIndex] !== question.correctIdx;

    setSelectedIdx(idx);
    setAnswers(prev => {
      // In stress test, if somehow multiple clicks pass, only keep the first one
      if (isStressTest && prev[currentIndex] !== undefined) return prev;
      return { ...prev, [currentIndex]: idx };
    });
    const correct = idx === question.correctIdx;
    setIsCorrect(correct);

    if (correct) {
      if (isFirstAttempt) {
        setStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
      } else if (wasPreviouslyWrong) {
        setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
      }

      if (auth.currentUser && question.id) {
        const errorRef = doc(db, "saved_questions", auth.currentUser.uid, "questions", question.id);
        deleteDoc(errorRef).catch(err => console.error("Error removal failed:", err));
      }
      
      if (aiEnabled) {
         handleAiExplain();
      }
      if (autoNextDelay >= 0) {
        autoNextRef.current = setTimeout(() => {
          handleNext();
        }, autoNextDelay * 1000);
      }
    } else {
      if (isFirstAttempt) {
        setStats(prev => ({ ...prev, total: prev.total + 1 }));
      }
      
      if (auth.currentUser && question.id) {
        const errorRef = doc(db, "saved_questions", auth.currentUser.uid, "questions", question.id);
        setDoc(errorRef, {
           ...question,
           baseId: question.baseId || (subject.includes(',') ? subject.split(',')[0] : subject),
           errorAt: new Date().toISOString()
        }).catch(err => console.error("Auto error save failed:", err));
      }
      
      if (aiEnabled) {
         handleAiExplain();
      }
      if (autoNextDelay >= 0 && autoNextOnError) {
        autoNextRef.current = setTimeout(() => {
          handleNext();
        }, autoNextDelay * 1000);
      }
    }
  }, [selectedIdx, isCorrect, question, answers, currentIndex, autoNextDelay, autoNextOnError, handleNext, aiEnabled, handleAiExplain, auth.currentUser, subject]);

  const handleFinishCheck = () => {
    const unanswered = questions.map((_, i) => i).filter(i => answers[i] === undefined);
    if (unanswered.length > 0) {
       setShowSkippedWarning(true);
    } else {
       handleFinish();
    }
  };

  const handleFinish = async () => {
    setShowSkippedWarning(false);
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    logEvent(AuditEventType.TEST_COMPLETE, `Score: ${stats.correct}/${stats.total}`, user?.uid, user?.email || undefined);

    // Update global stats
    if (user && profile) {
      const currentStats = profile.stats || { totalSolved: 0, totalCorrect: 0, totalQuestions: 2000, byCategory: {}, activity: {} };
      const newByCategory = { ...(currentStats.byCategory || {}) };
      const today = new Date().toISOString().split('T')[0];
      const newActivity = { ...(currentStats.activity || {}) };
      newActivity[today] = (newActivity[today] || 0) + stats.total;
      
      // Calculate stats per category for this session
      Object.entries(answers).forEach(([idxStr, ansIdx]) => {
        const idx = parseInt(idxStr);
        const q = questions[idx];
        if (!q) return;
        const cat = q.category || "Загальна";
        
        if (!newByCategory[cat]) {
          newByCategory[cat] = { solved: 0, correct: 0 };
        }
        
        newByCategory[cat].solved += 1;
        if (ansIdx === q.correctIdx) {
          newByCategory[cat].correct += 1;
        }
      });

      updateProfile({
        stats: {
          ...currentStats,
          totalSolved: (currentStats.totalSolved || 0) + stats.total,
          totalCorrect: (currentStats.totalCorrect || 0) + stats.correct,
          byCategory: newByCategory,
          activity: newActivity
        }
      }).catch(err => console.error("Stats update failed:", err));
    }

    // Streak Logic
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastActive = profile?.lastActiveDate;
      const currentStreak = profile?.streak || 0;

      if (lastActive === today) {
        // Already updated today
        return;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = 1;
      if (lastActive === yesterdayStr) {
        newStreak = currentStreak + 1;
      }

      await updateProfile({
        streak: newStreak,
        lastActiveDate: today
      });
    } catch (err) {
      console.error("Failed to update streak", err);
    }
  };

  const handleReportAction = () => {
    setShowReportModal(true);
    setReportComment("");
  };

  const submitReport = async () => {
    if (!question) return;
    try {
      const reportRef = collection(db, "reports");
      await addDoc(reportRef, {
        questionId: String(question.id),
        questionText: String(question.text),
        comment: reportComment,
        reportedBy: String(user?.email || user?.uid || "Anonymous"),
        timestamp: serverTimestamp(),
        status: "pending"
      });
      logEvent(AuditEventType.REPORT_SUBMITTED, `Report on question ${question.id}: ${reportComment.slice(0, 50)}`, user?.uid, user?.email || undefined);
      setShowReportModal(false);
      setToastMessage("Репорт успішно відправлено!");
      setTimeout(() => setToastMessage(""), 2000);
    } catch (error) {
      console.error("Report failed:", error);
      alert("Помилка при відправці звіту. Спробуйте пізніше.");
    }
  };

  const [activeTab, setActiveTab] = useState<'question' | 'analysis'>('question');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const showCloseBtn = profile?.settings?.showSidebarCloseBtn ?? true;

  useEffect(() => {
    if (aiEnabled && selectedIdx !== null && !isSidebarCollapsed) {
       setActiveTab('analysis');
    }
  }, [selectedIdx, aiEnabled, isSidebarCollapsed]);

  const exportResultsPDF = async () => {
    const element = document.getElementById("results-container");
    if (!element) return;
    
    try {
      const imgData = await toPng(element, { 
        pixelRatio: 2,
        backgroundColor: document.documentElement.classList.contains("dark") ? "#0f172a" : "#ffffff"
      });
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const isDark = document.documentElement.classList.contains("dark") || true; 
      const bgColor = isDark ? "#0f172a" : "#ffffff";
      
      pdf.setFillColor(bgColor);
      pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), "F");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const yOffset = pdfHeight < pageHeight ? (pageHeight - pdfHeight) / 2 : 0;
      
      pdf.addImage(imgData, "PNG", 0, yOffset, pdfWidth, pdfHeight);
      pdf.save(`MedTest_Results_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keypresses when typing in an input or textarea
      if (
        (e.target as HTMLElement).tagName === "INPUT" || 
        (e.target as HTMLElement).tagName === "TEXTAREA"
      ) {
        return;
      }
      
      if (e.code.startsWith("Digit") && "123456789".includes(e.code.slice(5))) {
        const digit = parseInt(e.code.slice(5));
        if (digit >= 1 && digit <= 5) handleSelect(digit - 1);
      } else if (e.code === "Space") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
        handlePrev();
      } else if (e.code === "ArrowRight") {
        handleNext();
      } else if (e.code === "KeyS") {
        handleSave();
      } else if (e.code === "KeyR") {
        handleReportAction();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSelect, handleNext, handlePrev, handleSave]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
      if (isStressTest) {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleFinish();
            return 0;
          }
          return prev - 1;
        });
      } else {
        setTimeLeft(prev => {
          if (prev > 0) {
            if (prev <= 1) {
              handleFinish();
              return 0;
            }
            return prev - 1;
          }
          return 0;
        });
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStressTest]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="h-screen bg-bg-main flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Завантаження бази тестів...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="h-screen bg-bg-main flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-bg-side border border-border-dim p-8 rounded-3xl space-y-6">
           <h2 className="text-xl font-black text-text-bold uppercase tracking-tight">Питань не знайдено</h2>
           <p className="text-muted text-sm italic">
             Ми не змогли знайти нічого за запитом {searchTerm ? `"${searchTerm}"` : "в цій базі"}.
           </p>
           <button 
            onClick={() => navigate('/')}
            className="w-full py-3 bg-accent text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-blue-600 transition-all"
           >
             Повернутись на головну
           </button>
        </div>
      </div>
    );
  }
  const renderAISidebar = () => {
    return (
      <div className="flex flex-col gap-3 h-full pb-20 lg:pb-0">
           <div className="flex items-center justify-between border-b border-[var(--border-dim)] pb-2 lg:border-none lg:pb-0">
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <BrainCircuit className="w-4 h-4 text-accent" />
                 </div>
                 <div>
                   <h3 className="text-[11px] font-black text-[var(--text-bold)] uppercase tracking-tight">MedTest AI</h3>
                   <p className="text-[8px] text-[var(--muted)] font-bold uppercase">Аналіз</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                {showCloseBtn && (
                  <button 
                    onClick={() => {
                      setActiveTab('question');
                      setIsSidebarCollapsed(true);
                    }}
                    className="p-1.5 text-[var(--muted)] hover:text-[var(--text-bold)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
           </div>

           <AnimatePresence mode="wait">
             {!showAiExplain ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[var(--border-dim)] rounded-3xl min-h-[120px]"
                >
                   {selectedIdx !== null ? (
                      <button 
                        onClick={handleAiExplain}
                        className="bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-white transition-colors px-6 py-3 rounded-2xl flex flex-col items-center justify-center gap-2 group"
                      >
                         <BrainCircuit className="w-6 h-6 group-hover:scale-110 transition-transform" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Виконати розбір питання</span>
                      </button>
                   ) : (
                      <>
                        <Loader2 className="w-6 h-6 text-[var(--border-dim)] mb-2" />
                        <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest text-center">Очікування<br/>відповіді</p>
                      </>
                   )}
                </motion.div>
             ) : isAiLoading ? (
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="flex-1 flex flex-col items-center justify-center min-h-[120px]"
               >
                  <Loader2 className="w-5 h-5 text-accent animate-spin mb-2" />
                  <p className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest animate-pulse">Аналіз...</p>
               </motion.div>
             ) : aiResponse && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="space-y-3"
               >
                  <div className="bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl p-3 relative">
                     <span className="absolute -top-1.5 left-3 bg-accent text-[7px] font-black text-white px-1 py-0.5 rounded uppercase">Логіка</span>
                     <p className="text-xs text-[var(--text-main)] leading-relaxed italic">
                        {aiResponse.explanation}
                     </p>
                  </div>

                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-3">
                    <span className="text-[7px] font-black text-orange-500 uppercase tracking-widest block mb-0.5">Мнемоніка</span>
                    <p className="text-[11px] text-orange-600 dark:text-orange-200 font-bold italic">{aiResponse.mnemonic}</p>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl">
                    <span className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest">Ключ</span>
                    <span className="text-[9px] font-mono font-black text-accent uppercase">{aiResponse.keyword}</span>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>

           <div className="mt-auto pt-3 border-t border-[var(--border-dim)]">
              <div className="grid grid-cols-2 gap-2 text-[7px] font-mono text-[var(--muted)] uppercase">
                 <div className="flex items-center gap-1"><kbd className="bg-[var(--bg-card)] px-1 rounded text-[var(--text-bold)] border border-[var(--border-dim)]">1-5</kbd> ВІДПОВІДЬ</div>
                 <div className="flex items-center gap-1"><kbd className="bg-[var(--bg-card)] px-1 rounded text-[var(--text-bold)] border border-[var(--border-dim)]">Space</kbd> ДАЛІ</div>
              </div>
           </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-bg-main flex flex-col relative">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          .print-section, .print-section * { visibility: visible !important; }
          .print-section { position: fixed; left: 0; top: 0; width: 100%; height: 100%; padding: 2cm !important; margin: 0 !important; overflow: visible !important; }
          @page { margin: 0; size: auto; }
        }
      `}} />

      {/* Test Header */}
      <header className="h-10 sm:h-12 border-b border-[var(--border-dim)] flex items-center justify-between px-3 sm:px-6 bg-bg-side z-20 shrink-0">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link to={isStressTest ? "/" : "/test-base"} className="text-[var(--muted)] hover:text-accent transition-all p-1.5 hover:bg-accent/5 rounded-lg">
            <Home className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div className="hidden sm:block h-4 w-px bg-[var(--border-dim)]" />
          <div className="flex items-center gap-2">
             <div className="flex flex-col">
               <span className={cn(
                 "text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em]",
                 isStressTest ? "text-red-500" : "text-accent"
               )}>
                 {isStressTest ? "Stress Mode" : mode.toUpperCase()}
               </span>
               <span className={cn(
                 "text-xs sm:text-sm font-mono font-bold tabular-nums",
                 (timeLeft > 0 && timeLeft < 300) ? "text-red-500 animate-pulse" : "text-[var(--text-bold)]"
               )}>
                 {(isStressTest || timeLeft > 0) ? formatTime(timeLeft) : formatTime(timer)}
               </span>
             </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1 sm:ml-2">
             <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-lg">
                <span className="text-[10px] font-mono font-black text-green-500">{stats.correct}</span>
             </div>
             <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-lg">
                <span className="text-[10px] font-mono font-black text-red-500">{stats.total - stats.correct}</span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-1 rounded-xl shadow-sm">
           <div className="flex items-center gap-1.5">
              <span className="text-[8px] text-[var(--muted)] font-black uppercase tracking-widest hidden sm:inline">Питання</span>
              <span className="text-[8px] text-[var(--muted)] font-black uppercase tracking-widest sm:hidden">Пит.</span>
              <div className="flex items-center gap-1">
                <input 
                  type="text"
                  value={jumpValue}
                  onChange={(e) => setJumpValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                  className="w-8 bg-bg-main/50 border border-[var(--border-dim)] text-center font-mono text-[10px] font-bold text-[var(--text-bold)] focus:outline-none focus:border-accent rounded-md transition-all py-0.5"
                />
                <span className="text-[10px] font-bold text-[var(--muted)] opacity-50">/ {questions.length}</span>
              </div>
           </div>
           
           {!isStressTest && (
             <>
               <div className="w-px h-4 bg-[var(--border-dim)] mx-1" />
               <div className="relative">
                 <button 
                   className="flex items-center gap-1.5 p-1 px-2 hover:bg-slate-800 rounded-md transition-colors"
                   onClick={() => setShowTimerSettings(!showTimerSettings)}
                 >
                   <Clock className="w-3.5 h-3.5 text-[var(--muted)]" />
                   <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest hidden sm:block">
                     Налаштування {(autoNextDelay > 0 || timeLeft > 0) && <span className="text-accent ml-1 text-[8px]">On</span>}
                   </span>
                 </button>
                 {showTimerSettings && (
                    <div className="absolute top-full right-0 mt-2 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl shadow-2xl p-4 w-64 z-50">
                      <div className="flex justify-between items-center mb-4">
                         <span className="text-[10px] font-black uppercase text-[var(--muted)]">Авто-перемикання</span>
                         <button 
                           className={cn(
                             "w-6 h-3 rounded-full relative transition-all duration-300",
                             autoNextDelay > 0 ? "bg-accent" : "bg-slate-700"
                           )}
                           onClick={() => setAutoNextDelay(autoNextDelay === 0 ? 3 : 0)}
                         >
                           <div className={cn(
                             "absolute top-[2px] w-2 h-2 bg-white rounded-full transition-all duration-300 shadow-sm",
                             autoNextDelay > 0 ? "right-[2px]" : "left-[2px]"
                           )} />
                         </button>
                      </div>
                      
                      {autoNextDelay > 0 && (
                        <>
                          <div className="mb-4">
                            <div className="flex justify-between text-[10px] font-bold text-[var(--muted)] mb-2">
                               <span>Затримка (сек)</span>
                               <span>{autoNextDelay} с</span>
                            </div>
                            <input 
                              type="range" 
                              min="1" 
                              max="10" 
                              value={autoNextDelay} 
                              onChange={(e) => setAutoNextDelay(parseInt(e.target.value))}
                              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          
                          <div className="flex justify-between items-center border-t border-[var(--border-dim)] pt-4 mb-4">
                             <span className="text-[10px] font-black uppercase text-red-500">При помилці</span>
                             <button 
                               className={cn(
                                 "w-6 h-3 rounded-full relative transition-all duration-300",
                                 autoNextOnError ? "bg-red-500" : "bg-slate-700"
                               )}
                               onClick={() => setAutoNextOnError(!autoNextOnError)}
                             >
                               <div className={cn(
                                 "absolute top-[2px] w-2 h-2 bg-white rounded-full transition-all duration-300 shadow-sm",
                                 autoNextOnError ? "right-[2px]" : "left-[2px]"
                               )} />
                             </button>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between items-center border-t border-[var(--border-dim)] pt-4">
                         <span className="text-[10px] font-black uppercase text-[var(--muted)]">Таймер (хв)</span>
                         <input
                           type="number"
                           min="0"
                           placeholder="0"
                           value={Math.floor(timeLeft / 60) || ''}
                           onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setTimeLeft(val * 60);
                           }}
                           className="w-12 bg-bg-main/50 border border-[var(--border-dim)] text-center font-mono text-[10px] font-bold text-[var(--text-bold)] focus:outline-none focus:border-accent rounded-md transition-all py-1"
                         />
                      </div>
                    </div>
                 )}
               </div>
             </>
           )}
        </div>

        <div className="hidden sm:flex items-center gap-6">
            <button 
              onClick={handleSave}
              className={cn(
                "text-[9px] flex items-center gap-2 transition-all uppercase tracking-widest font-black p-2 rounded-xl border border-transparent",
                isSaved ? "text-accent bg-accent/5 border-accent/10" : "text-[var(--muted)] hover:text-[var(--text-bold)] hover:bg-bg-side"
              )}
            >
                {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                {isSaved ? "Збережено" : "Зберегти"}
            </button>
            <button 
              onClick={handleReportAction}
              className="text-[9px] text-[var(--muted)] flex items-center gap-2 hover:text-red-400 transition-all p-2 rounded-xl hover:bg-red-500/5 uppercase tracking-widest font-black"
            >
                <Flag className="w-4 h-4" />
                Репорт
            </button>
        </div>
      </header>

      <AnimatePresence>
        {toastMessage && <Toast message={toastMessage} />}
      </AnimatePresence>

      <AnimatePresence>
        {showReportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[var(--bg-card)] border border-[var(--border-dim)] w-full max-w-md rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Flag className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">Повідомити про помилку</h3>
                    <p className="text-xs text-[var(--muted)]">Питання #{currentIndex + 1}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-[var(--muted)] hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-6">
                <label className="block text-xs font-black text-[var(--muted)] uppercase tracking-wider mb-2">
                  Опишіть проблему (необов'язково)
                </label>
                <textarea
                  value={reportComment}
                  onChange={(e) => setReportComment(e.target.value)}
                  placeholder="Наприклад: неправильна правильна відповідь, помилка в тексті..."
                  className="w-full bg-[var(--bg-main)] border border-[var(--border-dim)] rounded-xl p-3 text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-accent resize-none transition-colors h-24"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  onClick={submitReport}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Відправити
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSkippedWarning && (
           <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6"
           >
              <motion.div 
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-xl bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-3xl rounded-full" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 blur-3xl rounded-full" />
                
                <h2 className="text-2xl font-black text-white uppercase tracking-widest relative z-10 mb-4">
                  Ви пропустили питання!
                </h2>
                
                <p className="text-sm font-medium text-slate-400 mb-8 relative z-10">
                  Перед завершенням тесту ви можете повернутися до питань, на які не дали відповіді.
                </p>
                
                <div className="w-full relative z-10">
                  <div className="flex flex-wrap gap-2 justify-center mb-8 max-h-[250px] overflow-y-auto custom-scrollbar pr-2 pb-2">
                    {questions.map((_, i) => i).filter(i => answers[i] === undefined).map(idx => (
                       <button
                         key={idx}
                         onClick={() => {
                           goToQuestion(idx);
                           setShowSkippedWarning(false);
                         }}
                         className="w-10 h-10 rounded-xl bg-[var(--bg-side)] border border-[var(--border-dim)] hover:border-accent hover:text-accent font-mono text-xs font-bold text-[var(--text-bold)] transition-colors relative group"
                       >
                         {idx + 1}
                         <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                           Питання {idx + 1}
                         </span>
                       </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full relative z-10">
                  <button 
                    onClick={() => setShowSkippedWarning(false)}
                    className="flex-1 px-6 py-4 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors"
                  >
                    Повернутись до тесту
                  </button>
                  <button 
                    onClick={handleFinish}
                    className="flex-1 px-6 py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                  >
                    Завершити все одно
                  </button>
                </div>
              </motion.div>
           </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFinished && (
           <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6 print:bg-white print-section"
           >
              <motion.div 
                id="results-container"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-[3rem] p-12 shadow-3xl text-center print:bg-white print:border-none print:shadow-none print:max-w-full"
              >
                  <div className="w-24 h-24 bg-accent/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 print:hidden shadow-inner border border-accent/10">
                     <BarChart3 className="w-12 h-12 text-accent" />
                  </div>
                  <h2 className="text-4xl font-black text-[var(--text-bold)] uppercase tracking-tighter mb-2 print:text-black">Тестування завершено!</h2>
                  <p className="text-[var(--muted)] mb-10 font-medium text-sm tracking-widest uppercase opacity-70 print:text-slate-900">Результати тестування MedTest Pro</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-10 text-left">
                     <div className="bg-[var(--bg-card)] p-6 rounded-[2rem] border border-[var(--border-dim)] print:bg-slate-100 print:border-slate-300">
                        <p className="text-[9px] font-black text-[var(--muted)] uppercase mb-1 print:text-slate-600 tracking-widest">Користувач</p>
                        <p className="text-xl font-bold text-[var(--text-bold)] print:text-black truncate">{user?.email || "Анонім"}</p>
                     </div>
                     <div className="bg-[var(--bg-card)] p-6 rounded-[2rem] border border-[var(--border-dim)] print:bg-slate-100 print:border-slate-300">
                        <p className="text-[9px] font-black text-[var(--muted)] uppercase mb-1 print:text-slate-600 tracking-widest">Дата</p>
                        <p className="text-xl font-bold text-[var(--text-bold)] print:text-black">{new Date().toLocaleDateString()}</p>
                     </div>
                     <div className="bg-[var(--bg-card)] p-6 rounded-[2rem] border border-[var(--border-dim)] print:bg-slate-100 print:border-slate-300">
                        <p className="text-[9px] font-black text-[var(--muted)] uppercase mb-1 print:text-slate-600 tracking-widest">Успішність</p>
                        <p className="text-3xl font-black text-accent print:text-black">{Math.round((stats.correct / (stats.total || 1)) * 100)}%</p>
                     </div>
                     <div className="bg-[var(--bg-card)] p-6 rounded-[2rem] border border-[var(--border-dim)] print:bg-slate-100 print:border-slate-300">
                        <p className="text-[9px] font-black text-[var(--muted)] uppercase mb-1 print:text-slate-600 tracking-widest">Вірні відповіді</p>
                        <p className="text-3xl font-black text-[var(--text-bold)] print:text-black">{stats.correct} / {stats.total}</p>
                     </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 print:hidden">
                    <button 
                      onClick={exportResultsPDF}
                      className="flex-1 bg-slate-800 text-white py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-3 shadow-md border border-slate-700"
                    >
                      <Download className="w-5 h-5 text-accent" />
                      Завантажити PDF
                    </button>
                    <button 
                      onClick={() => navigate('/')}
                      className="flex-1 bg-accent text-white py-4 rounded-[1.5rem] font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-accent/20"
                    >
                      На головну
                    </button>
                  </div>
              </motion.div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row relative">
        {/* Test Area */}
        <div className={cn(
          "flex-1 p-2 sm:p-3 lg:p-4 flex flex-col items-center bg-bg-main/50 scroll-smooth overflow-y-auto",
          activeTab === 'analysis' && "hidden lg:flex"
        )}>
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="w-full flex flex-col gap-2 lg:gap-3 py-1 px-1 max-w-5xl"
            >
              <div className="space-y-2 lg:space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em] font-mono bg-accent/5 px-2 py-0.5 rounded-full border border-accent/10">{question?.category}</span>
                    {isRepeat && (
                      <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full font-black tracking-widest uppercase text-[9px]">
                        <RefreshCw className="w-3 h-3" />
                        Повтор
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={handlePrev} className="p-2 hover:bg-accent/5 rounded-lg text-[var(--muted)] hover:text-accent transition-all"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                    <button onClick={handleNext} className="p-2 hover:bg-accent/5 rounded-lg text-[var(--muted)] hover:text-accent transition-all"><ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                  </div>
                </div>
                <h2 className={cn(
                  "font-medium leading-tight text-[var(--text-bold)] tracking-tight transition-all",
                  (question?.text?.length || 0) < 100 
                    ? "text-base sm:text-lg md:text-xl lg:text-2xl" 
                    : (question?.text?.length || 0) < 250
                    ? "text-sm sm:text-base md:text-lg lg:text-xl"
                    : "text-xs sm:text-sm md:text-base lg:text-lg"
                )}>
                  {question?.text}
                </h2>
              </div>

              <div className={cn(
                "grid gap-2 w-full transition-all mt-1 grid-cols-1 md:grid-cols-2"
              )}>
                {question?.options.map((option, idx) => {
                  const isSelected = selectedIdx === idx;
                  const isCorrectOption = idx === question.correctIdx;
                  const showCorrect = selectedIdx !== null && isCorrectOption && (isSelected || revealCorrectImmediately);
                  const showWrong = isSelected && !isCorrectOption;

                  return (
                      <motion.button
                        key={idx}
                        whileHover={{ scale: (selectedIdx === null || !isCorrect) ? 1.002 : 1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelect(idx)}
                        className={cn(
                          "w-full p-2.5 sm:p-3 rounded-xl border transition-all flex flex-row items-center gap-3 relative group text-left",
                          (!selectedIdx || !isCorrect) && "bg-[var(--bg-card)] border-[var(--border-dim)] hover:border-accent/40 hover:bg-bg-side shadow-sm",
                          showCorrect && "bg-accent/10 border-accent text-accent shadow-md shadow-accent/5",
                          showWrong && "bg-red-500/10 border-red-500 text-red-500 font-bold shadow-md shadow-red-500/5",
                          isCorrect && !isSelected && "opacity-30 border-transparent bg-[var(--bg-card)]/40"
                        )}
                        style={{ minHeight: 'auto' }}
                      >
                        <span className={cn(
                          "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold border transition-colors",
                          showCorrect ? "bg-accent border-accent text-white" : "bg-bg-main border-[var(--border-dim)] text-[var(--muted)] group-hover:border-accent/30"
                        )}>
                          {idx + 1}
                        </span>
                        <span className="text-[11px] sm:text-xs font-medium tracking-tight leading-tight w-full">{option}</span>
                      
                      {isSelected && (
                         <div className="absolute right-3 top-3">
                            {isCorrectOption ? <Zap className="w-4 h-4 text-accent animate-pulse" /> : <Info className="w-4 h-4 text-red-500" />}
                         </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-4 mb-10">
                {currentIndex === questions.length - 1 ? (
                  <button 
                    onClick={handleFinishCheck}
                    className="w-full sm:w-auto bg-red-500 text-white py-3 px-10 rounded-2xl font-black text-[10px] tracking-widest hover:bg-red-600 transition-all uppercase shadow-lg shadow-red-500/20 active:scale-95"
                  >
                    Завершити тест
                  </button>
                ) : (
                  <button 
                    onClick={handleNext}
                    className="w-full sm:w-auto bg-accent text-white py-3 px-10 rounded-2xl font-black text-[10px] tracking-widest hover:bg-blue-600 transition-all uppercase shadow-lg shadow-blue-500/20 active:scale-95"
                  >
                    Наступне питання
                  </button>
                )}
                {sidebarEnabled && (
                  <div className="lg:hidden w-full">
                    <button 
                      onClick={() => setActiveTab('analysis')}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-dim)] text-[var(--muted)] py-4 px-10 rounded-[1.5rem] font-black text-[10px] tracking-widest uppercase hover:text-accent transition-colors"
                    >
                      Аналіз AI
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* AI Analysis Sidebar - Integrated */}
        {sidebarEnabled && !isSidebarCollapsed && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className={cn(
               "w-full lg:w-[320px] bg-bg-side border-l border-[var(--border-dim)] p-4 lg:p-6 shrink-0 z-30 lg:h-screen lg:sticky lg:top-0 lg:overflow-y-auto",
               activeTab === 'question' && "hidden lg:block"
            )}
          >
             {renderAISidebar()}
          </motion.div>
        )}
        
        {/* Sidebar Mini-Toggle if collapsed */}
        {sidebarEnabled && isSidebarCollapsed && (
          <button 
            onClick={() => setIsSidebarCollapsed(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-20 bg-accent text-white rounded-l-2xl flex items-center justify-center group transition-all hover:w-10 z-30 shadow-2xl"
          >
             <BrainCircuit className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* Floating Bottom Nav for Mobile Question/Analysis Toggle */}
      {sidebarEnabled && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 flex bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-1.5 shadow-2xl z-50">
           <button 
            onClick={() => setActiveTab('question')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'question' ? "bg-accent text-white" : "text-slate-400"
            )}
           > Питання </button>
           <button 
            onClick={() => setActiveTab('analysis')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'analysis' ? "bg-accent text-white" : "text-slate-400"
            )}
           > Аналіз </button>
        </div>
      )}
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-10 left-10 z-[60] bg-accent text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center gap-2 border border-blue-400/30"
    >
       <BookmarkCheck className="w-4 h-4" />
       {message}
    </motion.div>
  );
}


import React, { useState, useCallback, useEffect } from 'react';
import { 
  BookOpen, Trophy, Plus, ArrowLeft, GraduationCap, X, Sparkles, 
  BarChart2, Hash, BrainCircuit, History, Trash2, ClipboardCheck, 
  Loader2, CheckCircle, Lock, MessageCircle, AlertCircle, Library, 
  ChevronRight, Calendar, Layers, Camera, FileText, FileSpreadsheet, FileType
} from 'lucide-react';
import { WordItem, AppView, LearningSessionStats, QuizQuestion, StudySet } from './types';
import FileUpload from './components/FileUpload';
import Flashcard from './components/Flashcard';
import { generateQuiz } from './services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_MISSED_KEY = 'vocab_boost_missed_words';
const STORAGE_HISTORY_KEY = 'vocab_boost_history_words';
const STORAGE_LIBRARY_KEY = 'vocab_boost_library_v1';

const DEMO_WORDS: WordItem[] = [
  { id: '1', term: 'Environment', masteryLevel: 0 },
  { id: '2', term: 'Challenge', masteryLevel: 0 },
  { id: '3', term: 'Technology', masteryLevel: 0 },
  { id: '4', term: 'Experience', masteryLevel: 0 },
  { id: '5', term: 'Government', masteryLevel: 0 },
  { id: '6', term: 'Society', masteryLevel: 0 },
  { id: '7', term: 'Benefit', masteryLevel: 0 },
  { id: '8', term: 'Influence', masteryLevel: 0 },
];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [wordList, setWordList] = useState<WordItem[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [stats, setStats] = useState<LearningSessionStats>({ total: 0, correct: 0, incorrect: 0, wordCount: 0, startTime: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // 持久化状态
  const [missedWords, setMissedWords] = useState<WordItem[]>([]);
  const [historyWords, setHistoryWords] = useState<WordItem[]>([]);
  const [library, setLibrary] = useState<StudySet[]>([]);
  
  // 测验专有状态
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [lastIncorrectInSession, setLastIncorrectInSession] = useState<WordItem[]>([]);

  useEffect(() => {
    const savedMissed = localStorage.getItem(STORAGE_MISSED_KEY);
    const savedHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
    const savedLibrary = localStorage.getItem(STORAGE_LIBRARY_KEY);
    
    if (savedMissed) setMissedWords(JSON.parse(savedMissed));
    if (savedHistory) setHistoryWords(JSON.parse(savedHistory));
    if (savedLibrary) setLibrary(JSON.parse(savedLibrary));
  }, []);

  const saveMissed = (words: WordItem[]) => {
    setMissedWords(words);
    localStorage.setItem(STORAGE_MISSED_KEY, JSON.stringify(words));
  };

  const saveHistory = (words: WordItem[]) => {
    setHistoryWords(words);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(words));
  };

  const saveToLibrary = (set: StudySet) => {
    const newLibrary = [set, ...library.filter(item => item.name !== set.name)].slice(0, 20);
    setLibrary(newLibrary);
    localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(newLibrary));
  };

  const deleteFromLibrary = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newLibrary = library.filter(item => item.id !== id);
    setLibrary(newLibrary);
    localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(newLibrary));
  };

  const startLearning = (words: WordItem[]) => {
    const uniqueWords = Array.from(new Set(words.map(w => w.term.toLowerCase())))
      .map(term => words.find(w => w.term.toLowerCase() === term)!);
    setWordList(uniqueWords);
    setCurrentWordIndex(0);
    setLastIncorrectInSession([]);
    setStats({ total: uniqueWords.length, correct: 0, incorrect: 0, wordCount: uniqueWords.length, startTime: Date.now() });
    setView(AppView.LEARNING);
  };

  const handleUpload = (words: WordItem[], fileName: string, type: 'IMAGE' | 'DOC' | 'EXCEL' | 'TEXT') => {
    const newSet: StudySet = {
      id: `set-${Date.now()}`,
      name: fileName,
      wordCount: words.length,
      words: words,
      type: type,
      createdAt: Date.now()
    };
    saveToLibrary(newSet);
    startLearning(words);
  };

  const startDemoLearning = () => {
    const mockHistory = DEMO_WORDS.slice(0, 4).map(w => ({
      ...w,
      lastMemorizedAt: Date.now()
    }));
    saveHistory(mockHistory);
    
    // 演示也将存入词库
    const demoSet: StudySet = {
      id: 'demo-set',
      name: '系统演示词库',
      wordCount: DEMO_WORDS.length,
      words: DEMO_WORDS,
      type: 'DEMO',
      createdAt: Date.now()
    };
    saveToLibrary(demoSet);
    startLearning(DEMO_WORDS);
  };

  const startWeeklyTest = async () => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentWords = historyWords.filter(w => (w.lastMemorizedAt || 0) > oneWeekAgo);
    
    if (recentWords.length < 3) {
      setErrorMessage("你需要先背诵并掌握至少 3 个单词才能开启测试哦！");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setQuizLoading(true);
    try {
      const shuffled = [...recentWords].sort(() => 0.5 - Math.random()).slice(0, 10);
      const questions = await generateQuiz(shuffled.map(w => w.term));
      
      if (questions && questions.length > 0) {
        setQuizQuestions(questions);
        setCurrentQuizIndex(0);
        setStats({ total: questions.length, correct: 0, incorrect: 0, wordCount: questions.length, startTime: Date.now() });
        setLastIncorrectInSession([]);
        setView(AppView.TESTING);
      } else {
        setErrorMessage("AI 老师开小差了，没能生成题目，请稍后再试。");
      }
    } catch (e) {
      setErrorMessage("测验生成出错，请检查网络连接。");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleCardResult = useCallback((success: boolean) => {
    setIsProcessing(true);
    const currentWord = wordList[currentWordIndex];
    setTimeout(() => {
        if (success) {
          setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
          const updatedWord = { ...currentWord, lastMemorizedAt: Date.now() };
          const newHistory = [updatedWord, ...historyWords.filter(w => w.term.toLowerCase() !== currentWord.term.toLowerCase())].slice(0, 500);
          saveHistory(newHistory);
          saveMissed(missedWords.filter(w => w.term.toLowerCase() !== currentWord.term.toLowerCase()));
        } else {
          setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
          setLastIncorrectInSession(prev => [...prev, currentWord]);
          if (!missedWords.some(w => w.term.toLowerCase() === currentWord.term.toLowerCase())) {
            saveMissed([...missedWords, currentWord]);
          }
        }
        if (currentWordIndex < wordList.length - 1) {
            setCurrentWordIndex(prev => prev + 1);
        } else {
            setView(AppView.SUMMARY);
        }
        setIsProcessing(false);
    }, 400);
  }, [currentWordIndex, wordList, missedWords, historyWords]);

  const handleQuizAnswer = (isCorrect: boolean) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    const currentQuestion = quizQuestions[currentQuizIndex];
    const originalWord = historyWords.find(w => w.term.toLowerCase() === currentQuestion.word.toLowerCase());

    setTimeout(() => {
      if (isCorrect) {
        setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
      } else {
        setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
        if (originalWord) {
          setLastIncorrectInSession(prev => [...prev, originalWord]);
          if (!missedWords.some(w => w.term.toLowerCase() === originalWord.term.toLowerCase())) {
            saveMissed([...missedWords, originalWord]);
          }
        }
      }

      if (currentQuizIndex < quizQuestions.length - 1) {
        setCurrentQuizIndex(prev => prev + 1);
      } else {
        setView(AppView.SUMMARY);
      }
      setIsProcessing(false);
    }, 800);
  };

  const renderLanding = () => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCount = historyWords.filter(w => (w.lastMemorizedAt || 0) > oneWeekAgo).length;
    const canTest = recentCount >= 3;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16 relative bg-[#F8FAFF]">
        <AnimatePresence>
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-[60] bg-rose-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold"
            >
              <AlertCircle size={20} />
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-12 text-center">
          <div className="relative inline-block mb-8">
              <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200 rotate-6 hover:rotate-0 transition-transform duration-500">
                  <BookOpen className="text-white" size={48} />
              </div>
              <div className="absolute -top-2 -right-2 bg-yellow-400 p-2 rounded-full shadow-lg border-4 border-white">
                  <Sparkles className="text-white" size={16} />
              </div>
          </div>
          <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">
            词汇<span className="text-indigo-600">达人</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-sm mx-auto font-medium">
            基于 AI 的智能单词学习工具<br/>拍照提词、文档分析、掌握“云”词库
          </p>
        </div>

        <FileUpload onUpload={handleUpload} />

        <div className="w-full max-w-2xl mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 强化复习 */}
          <motion.div 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => missedWords.length > 0 && startLearning(missedWords)}
            className={`group flex items-center gap-4 border-2 p-5 rounded-[2.5rem] transition-all shadow-sm ${
              missedWords.length > 0 
                ? 'bg-orange-50 border-orange-100 cursor-pointer hover:border-orange-400 hover:shadow-lg' 
                : 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              missedWords.length > 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-slate-300 text-white'
            }`}>
              <BrainCircuit size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">强化复习</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{missedWords.length > 0 ? `${missedWords.length} 待攻克` : '无错词'}</p>
            </div>
          </motion.div>

          {/* 每周测验 */}
          <motion.div 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={startWeeklyTest}
            className={`group flex items-center gap-4 border-2 p-5 rounded-[2.5rem] cursor-pointer transition-all shadow-sm ${
              quizLoading ? 'bg-slate-50 border-slate-200' : 
              canTest ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg' :
              'bg-slate-50 border-slate-100 opacity-80'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              quizLoading ? 'bg-white text-indigo-400 animate-pulse' : 
              canTest ? 'bg-white text-indigo-600 shadow-lg' : 
              'bg-slate-300 text-white'
            }`}>
              {quizLoading ? <Loader2 size={24} className="animate-spin" /> : canTest ? <ClipboardCheck size={24} /> : <Lock size={20} />}
            </div>
            <div className="flex-1">
              <h3 className={`font-bold ${canTest ? 'text-white' : 'text-slate-800'}`}>{quizLoading ? 'AI 组卷中' : '每周测验'}</h3>
              <p className={`text-[10px] uppercase font-bold tracking-wider ${canTest ? 'text-indigo-100' : 'text-slate-400'}`}>
                {canTest ? '检验本周成果' : `需再记 ${3 - recentCount} 词`}
              </p>
            </div>
          </motion.div>
        </div>

        {/* “云端”词库列表 */}
        <div className="w-full max-w-2xl mt-12 mb-20">
            <div className="flex items-center justify-between mb-6 px-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                        <Library size={18} />
                    </div>
                    <h2 className="text-xl font-black text-slate-800">我的词库 <span className="text-slate-400 font-medium text-sm ml-2">已同步至本地</span></h2>
                </div>
                {library.length > 0 && <span className="text-xs font-bold text-slate-400">{library.length} / 20</span>}
            </div>

            <div className="grid grid-cols-1 gap-3">
                {library.length > 0 ? library.map((set) => (
                    <motion.div 
                        layout
                        key={set.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => startLearning(set.words)}
                        className="group flex items-center justify-between bg-white border border-slate-100 p-4 rounded-[1.5rem] cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                set.type === 'IMAGE' ? 'bg-purple-50 text-purple-600' :
                                set.type === 'DOC' ? 'bg-blue-50 text-blue-600' :
                                set.type === 'EXCEL' ? 'bg-emerald-50 text-emerald-600' :
                                'bg-slate-50 text-slate-600'
                            }`}>
                                {set.type === 'IMAGE' ? <Camera size={20} /> :
                                 set.type === 'DOC' ? <FileText size={20} /> :
                                 set.type === 'EXCEL' ? <FileSpreadsheet size={20} /> :
                                 <FileType size={20} />}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors truncate max-w-[200px]">{set.name}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                                        <Layers size={10} /> {set.wordCount} 单词
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                                        <Calendar size={10} /> {new Date(set.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={(e) => deleteFromLibrary(set.id, e)}
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                             >
                                <Trash2 size={16} />
                             </button>
                             <div className="p-2 bg-slate-50 group-hover:bg-indigo-50 text-slate-300 group-hover:text-indigo-600 rounded-xl transition-all">
                                <ChevronRight size={18} />
                             </div>
                        </div>
                    </motion.div>
                )) : (
                    <div className="text-center py-12 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Plus className="text-slate-300" size={32} />
                        </div>
                        <p className="text-slate-400 font-medium">暂无词库内容，快去导入你的第一份清单吧！</p>
                    </div>
                )}
            </div>
        </div>

        <div className="mt-8 pb-12">
          <button 
            onClick={startDemoLearning} 
            className="group flex flex-col items-center gap-3 text-slate-400 hover:text-indigo-600 font-bold text-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-[1px] bg-slate-200 group-hover:bg-indigo-200" />
              <span>初次体验？试试内置词库</span>
              <div className="w-8 h-[1px] bg-slate-200 group-hover:bg-indigo-200" />
            </div>
          </button>
        </div>
      </div>
    );
  };

  const renderLearning = () => {
    const currentWord = wordList[currentWordIndex];
    if (!currentWord) return null;

    return (
      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col items-center justify-center min-h-[90vh]">
        <div className="w-full flex justify-between items-center mb-8">
            <button onClick={() => setView(AppView.LANDING)} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors group">
                <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-slate-200 transition-colors"><ArrowLeft size={20} /></div>
                <span>返回主页</span>
            </button>
            <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">正在背诵</span>
                <span className="text-xl font-black text-slate-800">{currentWordIndex + 1} / {wordList.length}</span>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><GraduationCap size={20} /></div>
        </div>

        <div className="w-full bg-slate-100 h-2 rounded-full mb-12 overflow-hidden max-w-md">
            <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${((currentWordIndex + 1) / wordList.length) * 100}%` }}></div>
        </div>

        <div className="w-full flex-1 flex items-center justify-center">
          <Flashcard word={currentWord} onResult={handleCardResult} isProcessing={isProcessing} />
        </div>
      </div>
    );
  };

  const renderTesting = () => {
    const q = quizQuestions[currentQuizIndex];
    const progress = (currentQuizIndex / quizQuestions.length) * 100;
    
    return (
      <div className="max-w-2xl mx-auto min-h-screen flex flex-col px-6 py-10">
        <div className="flex justify-between items-center mb-8">
            <button onClick={() => setView(AppView.LANDING)} className="p-3 rounded-2xl bg-white border border-slate-100 text-slate-400"><X size={20} /></button>
            <div className="text-center">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 block">Weekly Quiz</span>
                <span className="text-xl font-black text-slate-800">{currentQuizIndex + 1} / {quizQuestions.length}</span>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black">?</div>
        </div>

        <div className="w-full bg-slate-100 h-2 rounded-full mb-12 overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
            <motion.div 
              key={q.word}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] shadow-xl p-10 border border-slate-50 text-center mb-10"
            >
                <h2 className="text-5xl font-black text-slate-900 mb-6">{q.word}</h2>
                <div className="bg-indigo-50 py-3 px-6 rounded-2xl inline-block text-indigo-600 font-bold italic">"{q.context}"</div>
            </motion.div>

            <div className="grid grid-cols-1 gap-4">
                {q.options.map((option, idx) => (
                    <motion.button
                        key={`${q.word}-${idx}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleQuizAnswer(option === q.correctAnswer)}
                        disabled={isProcessing}
                        className={`py-5 px-8 rounded-2xl text-lg font-bold border-2 transition-all flex justify-between items-center ${
                          isProcessing && option === q.correctAnswer ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 
                          'bg-white border-slate-100 text-slate-700 hover:border-indigo-500 hover:text-indigo-600'
                        }`}
                    >
                        <span>{option}</span>
                        {isProcessing && option === q.correctAnswer && <CheckCircle size={24} className="text-emerald-500" />}
                    </motion.button>
                ))}
            </div>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    const accuracy = Math.round((stats.correct / stats.total) * 100) || 0;
    const hasMissed = lastIncorrectInSession.length > 0;
    const isTest = quizQuestions.length > 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#FAFBFF] py-12">
        <div className="max-w-md w-full text-center space-y-8">
            <div className="relative inline-block">
                <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl animate-bounce-slow ${accuracy > 60 ? 'bg-yellow-400 shadow-yellow-200' : 'bg-slate-400 shadow-slate-200'}`}>
                    <Trophy size={64} className="text-white" />
                </div>
            </div>
            
            <div>
                <h2 className="text-4xl font-black text-slate-900 mb-2">{accuracy >= 80 ? '太出色了！' : '不错哦！'}</h2>
                <p className="text-slate-500 font-medium">{isTest ? '测验评分已出炉' : '本次学习会话已完成'}</p>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="text-3xl font-black text-emerald-500 mb-1">{stats.correct}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">正确 / 掌握</div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="text-3xl font-black text-orange-400 mb-1">{stats.incorrect}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">错误 / 加强</div>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-600 font-bold">整体准确率</span>
                    <span className="text-2xl font-black text-indigo-600">{accuracy}%</span>
                 </div>
                 <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden p-1">
                    <div className={`h-full rounded-full transition-all duration-1000 ${accuracy > 80 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${accuracy}%` }}></div>
                 </div>
            </div>

            <div className="space-y-4 pt-4">
              {hasMissed && (
                <button onClick={() => startLearning(lastIncorrectInSession)} className="w-full bg-orange-500 text-white py-5 rounded-[1.5rem] text-lg font-black hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3">
                    <BrainCircuit size={24} />
                    即刻复习错词 ({lastIncorrectInSession.length})
                </button>
              )}
              <button onClick={() => { setQuizQuestions([]); setView(AppView.LANDING); }} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] text-lg font-black hover:bg-indigo-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-100 flex items-center justify-center gap-3">
                  <History size={24} />
                  返回主页
              </button>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {view === AppView.LANDING && renderLanding()}
      {view === AppView.LEARNING && renderLearning()}
      {view === AppView.TESTING && renderTesting()}
      {view === AppView.SUMMARY && renderSummary()}
    </div>
  );
};

export default App;

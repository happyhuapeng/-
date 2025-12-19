import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Sparkles, Loader2, RotateCw, Check, CheckCircle2, ChevronRight } from 'lucide-react';
import { WordItem, AIWordDetails } from '../types';
import { getWordDetails } from '../services/geminiService';

interface FlashcardProps {
  word: WordItem;
  onResult: (success: boolean) => void;
  isProcessing: boolean;
}

const Flashcard: React.FC<FlashcardProps> = ({ word, onResult, isProcessing }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [aiDetails, setAiDetails] = useState<AIWordDetails | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showCompleteTip, setShowCompleteTip] = useState(false);

  // 统一的朗读函数
  const speak = useCallback((text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // 取消之前的所有朗读任务，防止重叠
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85; 
    window.speechSynthesis.speak(utterance);
  }, []);

  // 核心功能：单词出现时自动朗读
  useEffect(() => {
    setIsFlipped(false);
    setAiDetails(null);
    setIsLoadingAi(false);
    setShowCompleteTip(false);
    
    const timer = setTimeout(() => {
      speak(word.term);
    }, 300);

    return () => clearTimeout(timer);
  }, [word.id, speak]);

  const fetchAiDetails = async () => {
    if (isLoadingAi) return;
    setIsLoadingAi(true);
    setShowCompleteTip(false);
    
    const details = await getWordDetails(word.term);
    
    if (details) {
      setAiDetails(details);
      setShowCompleteTip(true);
      setTimeout(() => setShowCompleteTip(false), 3000);
    }
    setIsLoadingAi(false);
  };

  const handleFlip = () => {
    if (isProcessing) return;
    setIsFlipped(!isFlipped);
    // 如果翻到背面且没有详情，自动触发 AI 生成
    if (!isFlipped && !word.definition && !aiDetails && !isLoadingAi) {
      fetchAiDetails();
    }
  };

  const displayDef = word.definition || aiDetails?.definition;
  const displayPhonetic = word.phonetic || aiDetails?.phonetic;
  const displayExample = word.example || aiDetails?.exampleSentence;
  const displayChinese = aiDetails?.chineseTranslation;

  return (
    <div className="w-full max-w-md mx-auto h-[450px] perspective-1000 relative">
      <motion.div
        className="w-full h-full relative preserve-3d cursor-pointer"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        onClick={handleFlip}
      >
        {/* 正面 */}
        <div className="absolute w-full h-full backface-hidden bg-white rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center p-10 border border-slate-100 overflow-hidden">
          <div className="absolute top-6 left-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">当前单词</span>
          </div>
          
          <motion.h2 
            key={word.term}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-6xl font-black text-slate-800 mb-8 tracking-tight text-center"
          >
            {word.term}
          </motion.h2>
          
          <button 
            onClick={(e) => speak(word.term, e)}
            className="group p-6 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-lg active:scale-90"
          >
            <Volume2 size={36} />
          </button>
          
          <div className="mt-14 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-slate-300">
              <RotateCw size={14} className="animate-spin-slow" />
              <p className="text-xs font-medium">点击卡片查看 AI 详细释义</p>
            </div>
            {/* 掌握程度提示 */}
            <div className="flex gap-1.5">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className={`w-8 h-1 rounded-full ${i < word.masteryLevel ? 'bg-indigo-500' : 'bg-slate-100'}`} />
                ))}
            </div>
          </div>
        </div>

        {/* 背面 */}
        <div 
          className="absolute w-full h-full backface-hidden bg-gradient-to-br from-indigo-50/50 to-white rounded-[2.5rem] shadow-2xl flex flex-col p-8 overflow-hidden border border-indigo-100"
          style={{ transform: 'rotateY(180deg)' }}
        >
          {/* AI 进度条 */}
          <AnimatePresence>
            {isLoadingAi && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 top-0 h-1.5 bg-indigo-100/50 overflow-hidden"
              >
                <motion.div 
                  className="h-full bg-indigo-600"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  style={{ width: "40%" }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between items-start mb-6 pt-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{word.term}</h3>
                <button 
                  onClick={(e) => speak(word.term, e)}
                  className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                >
                  <Volume2 size={20} />
                </button>
              </div>
              {displayPhonetic && <span className="text-indigo-500 font-mono text-sm tracking-widest mt-1">{displayPhonetic}</span>}
            </div>
            
            <div className="flex items-center gap-2">
               <AnimatePresence mode="wait">
                 {isLoadingAi ? (
                   <motion.div 
                     key="loading"
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     exit={{ scale: 0.8, opacity: 0 }}
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-100"
                   >
                     <Loader2 size={12} className="animate-spin text-indigo-600" />
                     <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">AI 思考中</span>
                   </motion.div>
                 ) : showCompleteTip ? (
                   <motion.div 
                     key="complete"
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     exit={{ scale: 0.8, opacity: 0 }}
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 shadow-sm"
                   >
                     <CheckCircle2 size={12} className="text-emerald-600" />
                     <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">生成完毕</span>
                   </motion.div>
                 ) : !displayDef ? (
                   <button 
                     onClick={(e) => { e.stopPropagation(); fetchAiDetails(); }} 
                     className="p-2 text-indigo-400 hover:text-indigo-600 bg-white rounded-xl shadow-sm border border-indigo-50 transition-all hover:scale-105"
                   >
                     <Sparkles size={20} />
                   </button>
                 ) : null}
               </AnimatePresence>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto no-scrollbar pb-4">
            {displayChinese && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center"
              >
                <span className="text-xl font-bold text-white bg-indigo-600 px-5 py-2 rounded-2xl shadow-lg shadow-indigo-100">
                  {displayChinese}
                </span>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <div className="w-1 h-3 bg-indigo-400 rounded-full" />
                <h4 className="text-[10px] font-bold uppercase tracking-widest">英/英定义</h4>
              </div>
              <p className="text-slate-600 text-[13px] leading-relaxed font-medium">
                {isLoadingAi && !displayDef ? "AI 老师正在认真备课..." : displayDef || "暂无定义，可手动点击星星生成"}
              </p>
            </div>

            {displayExample && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2 bg-white p-4 rounded-2xl border border-indigo-50 relative group/example shadow-[0_4px_12px_rgba(79,70,229,0.03)]"
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">实战例句</h4>
                  <button 
                    onClick={(e) => speak(displayExample, e)} 
                    className="text-indigo-300 hover:text-indigo-500 transition-colors p-1"
                  >
                    <Volume2 size={16} />
                  </button>
                </div>
                <p className="text-slate-700 italic text-sm leading-relaxed pr-2">"{displayExample}"</p>
              </motion.div>
            )}
          </div>
          
          <div className="mt-auto flex justify-center text-[10px] text-slate-300 font-bold uppercase tracking-widest py-2 border-t border-slate-50">
            再次点击卡片返回
          </div>
        </div>
      </motion.div>

      {/* 底部按钮：始终可见，大幅提升操作效率 */}
      <motion.div 
        key={`actions-${word.id}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute -bottom-28 left-0 right-0 flex gap-4"
      >
        <button
          onClick={() => onResult(false)}
          disabled={isProcessing}
          className="flex-1 group bg-white text-slate-500 py-5 px-6 rounded-[1.5rem] font-bold border border-slate-200 shadow-sm hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <RotateCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
          <span>没记住</span>
        </button>
        <button
          onClick={() => onResult(true)}
          disabled={isProcessing}
          className="flex-1 group bg-indigo-600 text-white py-5 px-6 rounded-[1.5rem] font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <Check size={20} className="group-hover:scale-125 transition-transform" />
          <span>记住了</span>
        </button>
      </motion.div>
    </div>
  );
};

export default Flashcard;
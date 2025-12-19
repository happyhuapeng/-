
import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, FileSpreadsheet, Camera, Image as ImageIcon, Loader2, FileType } from 'lucide-react';
import { WordItem } from '../types';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { extractWordsFromImage, extractVocabularyFromText } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
  onUpload: (words: WordItem[], fileName: string, type: 'IMAGE' | 'DOC' | 'EXCEL' | 'TEXT') => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageOCR = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    setProcessingMsg("AI 正在阅读图片...");
    
    const previewUrl = URL.createObjectURL(file);
    setPreviewImage(previewUrl);

    try {
      const base64Data = await fileToBase64(file);
      const words = await extractWordsFromImage(base64Data, file.type);
      
      if (words && words.length > 0) {
        const wordItems: WordItem[] = words.map((w, i) => ({
          id: `ocr-${i}-${Date.now()}`,
          term: w,
          masteryLevel: 0
        }));
        onUpload(wordItems, file.name, 'IMAGE');
      } else {
        setError("AI 没能从图中识别到单词，请尝试更清晰的照片。");
        setPreviewImage(null);
      }
    } catch (err) {
      setError("识别过程中出现错误，请重试。");
      setPreviewImage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const parseWordDoc = async (file: File) => {
    setIsProcessing(true);
    setProcessingMsg("正在解析 Word 文档...");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      
      if (!text || text.trim().length < 10) {
        setError("文档内容过少，无法有效分析。");
        return;
      }

      setProcessingMsg("AI 老师正在阅读并抽取重点词汇...");
      const words = await extractVocabularyFromText(text);
      
      if (words && words.length > 0) {
        onUpload(words.map((w, i) => ({
          id: `word-extract-${i}-${Date.now()}`,
          term: w,
          masteryLevel: 0
        })), file.name, 'DOC');
      } else {
        setError("未能从文档中抽取到适合初中阶段的重点词汇。");
      }
    } catch (err) {
      setError("Word 文档解析失败，请确保是 .docx 格式。");
    } finally {
      setIsProcessing(false);
    }
  };

  const parseExcel = async (file: File) => {
    setIsProcessing(true);
    setProcessingMsg("正在解析表格...");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      const words: WordItem[] = [];

      rows.forEach((row, index) => {
        if (!row || row.length === 0) return;
        const firstCell = String(row[0] || '').toLowerCase().trim();
        if (index === 0 && (firstCell === 'term' || firstCell === 'word' || firstCell.includes('词'))) return;

        const term = String(row[0] || '').trim();
        if (!term) return;

        words.push({
          id: `word-${index}-${Date.now()}`,
          term,
          definition: row[1] ? String(row[1]).trim() : undefined,
          example: row[2] ? String(row[2]).trim() : undefined,
          masteryLevel: 0
        });
      });

      if (words.length === 0) {
        setError("表格中未发现有效单词，请确保 A 列是单词。");
        return;
      }
      onUpload(words, file.name, 'EXCEL');
    } catch (err) {
      setError("Excel 解析失败，请检查文件格式。");
    } finally {
      setIsProcessing(false);
    }
  };

  const parseTextOrCsv = async (file: File) => {
    setIsProcessing(true);
    setProcessingMsg("正在读取文件...");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    const words: WordItem[] = [];
    
    lines.forEach((line, index) => {
      if (index === 0 && (line.toLowerCase().includes('term') || line.toLowerCase().includes('word'))) return;
      const parts = line.split(',');
      if (parts.length >= 2) {
        words.push({
          id: `word-${index}-${Date.now()}`,
          term: parts[0].trim(),
          definition: parts[1].trim(),
          example: parts[2]?.trim(),
          masteryLevel: 0
        });
      } else {
        const cleanTerm = line.trim();
        if (cleanTerm) words.push({ id: `word-${index}-${Date.now()}`, term: cleanTerm, masteryLevel: 0 });
      }
    });

    if (words.length === 0) {
      setError("未发现有效单词。请上传每行一个单词的文本或 CSV。");
      setIsProcessing(false);
      return;
    }
    onUpload(words, file.name, 'TEXT');
    setIsProcessing(false);
  };

  const parseFile = async (file: File) => {
    setError(null);
    setPreviewImage(null);
    if (file.type.startsWith('image/')) {
        await handleImageOCR(file);
    } else if (file.name.endsWith('.docx')) {
        await parseWordDoc(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        await parseExcel(file);
    } else {
        await parseTextOrCsv(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white border-2 border-indigo-100 rounded-[2.5rem] p-8 text-center shadow-xl overflow-hidden"
          >
            {previewImage && (
              <div className="relative mx-auto w-64 h-64 mb-6 rounded-2xl overflow-hidden shadow-inner bg-slate-100">
                <img src={previewImage} className="w-full h-full object-cover opacity-50" alt="Preview" />
                <motion.div 
                  className="absolute left-0 right-0 h-1 bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.8)] z-10"
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                />
              </div>
            )}
            {!previewImage && (
              <div className="mb-6 flex justify-center">
                 <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center relative">
                    <FileType size={40} className="text-indigo-400" />
                    <motion.div 
                      className="absolute inset-0 border-2 border-indigo-500 rounded-2xl"
                      animate={{ opacity: [0, 1, 0], scale: [0.9, 1.1, 0.9] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                 </div>
              </div>
            )}
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <h3 className="text-xl font-bold text-slate-800">{processingMsg}</h3>
              <p className="text-sm text-slate-400 font-medium">AI 正在深度分析内容，请耐心等待</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="normal"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* 拍照/图片入口 */}
            <div 
              onClick={() => imageInputRef.current?.click()}
              className="relative overflow-hidden group cursor-pointer border-2 border-indigo-100 bg-white rounded-[2rem] p-8 text-center transition-all duration-300 hover:border-indigo-500 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <Camera size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">拍照/图片识词</h3>
              <p className="text-xs text-slate-400 leading-relaxed">识别课本或试卷中的单词<br/>AI 自动提取，即刻背诵</p>
              <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>

            {/* 文件上传入口 */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative overflow-hidden group cursor-pointer border-2 border-slate-100 bg-white rounded-[2rem] p-8 text-center transition-all duration-300 hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <FileText size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">文本/表格/Word</h3>
              <p className="text-xs text-slate-400 leading-relaxed">支持 Excel, Word (.docx), TXT<br/>AI 自动抽取长文章中的考点词</p>
              <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.csv,.xlsx,.xls,.docx" onChange={handleFileChange} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 text-rose-500 bg-rose-50 py-3 px-4 rounded-xl text-xs font-bold"
        >
          <AlertCircle size={14} />
          {error}
        </motion.div>
      )}

      {/* 拖拽区域 */}
      {!isProcessing && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
          className={`border-2 border-dashed rounded-2xl p-4 text-center transition-colors text-xs font-medium ${isDragging ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-400'}`}
        >
          或者将图片、Word 文档、表格拖拽到此处
        </div>
      )}
    </div>
  );
};

export default FileUpload;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Palette,
  Type as TypeIcon,
  Smile,
  BookOpen,
  Heart,
  Zap,
  Loader2,
  Trash2,
  Wand2,
  Copy,
  Check,
  Image as ImageIcon,
  Paperclip,
  FileText,
  FileAudio,
  File as FileIcon,
  X,
  Settings,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Cpu,
  History,
  Download,
  Eye,
  EyeOff,
  Lightbulb,
  ChevronRight,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import mammoth from 'mammoth';
import { generatePromptDirectly, FilePart } from './services/geminiService';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PromptHistory {
  id: string;
  prompt: string;
  mood: string;
  topic: string;            // first 60 chars of input or filename
  createdAt: number;
  imageUrl?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MOODS = [
  { id: 'educational', label: 'Giáo dục', icon: BookOpen, color: '#4A90E2' },
  { id: 'emotional', label: 'Cảm xúc', icon: Heart, color: '#FF6B6B' },
  { id: 'parenting', label: 'Nuôi dạy', icon: Smile, color: '#FFB347' },
  { id: 'inspiring', label: 'Truyền cảm hứng', icon: Zap, color: '#B19CD9' },
];

const AI_MODELS = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', badge: 'Mặc định', desc: 'Nhanh & ổn định' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', badge: 'Chất lượng cao', desc: 'Chính xác hơn' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', badge: 'Dự phòng', desc: 'Khi model khác lỗi' },
];

const TEMPLATES = [
  { id: 'lifecycle', label: 'Vòng đời thực vật 🌱', topic: 'Vòng đời của cây: hạt giống, nảy mầm, ra lá, ra hoa, kết quả' },
  { id: 'math', label: 'Phép tính lớp 1 🔢', topic: 'Phép cộng trừ trong phạm vi 10 cho học sinh lớp 1' },
  { id: 'water', label: 'Vòng tuần hoàn nước 💧', topic: 'Vòng tuần hoàn của nước: bốc hơi, ngưng tụ, mưa, chảy tràn' },
  { id: 'solar', label: 'Hệ mặt trời 🪐', topic: 'Hệ mặt trời: Mặt Trời, 8 hành tinh, vệ tinh, tiểu hành tinh' },
  { id: 'vietnam', label: 'Lịch sử Việt Nam 🏯', topic: 'Các triều đại lịch sử Việt Nam: Đinh, Lý, Trần, Lê, Nguyễn' },
  { id: 'env', label: 'Bảo vệ môi trường 🌍', topic: 'Bảo vệ môi trường: tái chế, trồng cây, tiết kiệm nước, năng lượng sạch' },
  { id: 'body', label: 'Cơ thể con người 🫀', topic: 'Các cơ quan trong cơ thể người: tim, phổi, não, dạ dày, thận' },
  { id: 'emotion', label: 'Cảm xúc của bé 😊', topic: 'Các loại cảm xúc: vui, buồn, tức giận, sợ hãi, ngạc nhiên, yêu thương' },
];

const MAX_HISTORY = 20;
const HISTORY_KEY = 'cutemind_history';

// ─── Pollinations URL helper ──────────────────────────────────────────────────
function getImageUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt.slice(0, 1000));
  return `https://image.pollinations.ai/prompt/${encoded}?width=800&height=600&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Core state
  const [inputText, setInputText] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeMood, setActiveMood] = useState('educational');
  const [error, setError] = useState<string | null>(null);

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API / Model
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempModel, setTempModel] = useState('gemini-2.0-flash');

  // Preview (Pollinations)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingImg, setIsLoadingImg] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // History
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Templates
  const [showTemplates, setShowTemplates] = useState(false);

  // ── Load from localStorage ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('gemini_api_key');
      const savedModel = localStorage.getItem('gemini_selected_model');
      const savedHist = localStorage.getItem(HISTORY_KEY);
      const envKey = import.meta.env.VITE_API_KEY;

      if (savedModel) setSelectedModel(savedModel);
      if (savedHist) setHistory(JSON.parse(savedHist));

      if (savedKey) setApiKey(savedKey);
      else if (envKey) setApiKey(envKey);
      else setShowApiKeyModal(true);
    } catch (e) {
      console.warn('LocalStorage not available:', e);
      const envKey = import.meta.env.VITE_API_KEY;
      if (envKey) setApiKey(envKey);
      else setShowApiKeyModal(true);
    }
  }, []);

  // ── Save API key ──────────────────────────────────────────────────────────
  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      localStorage.setItem('gemini_api_key', tempApiKey.trim());
      localStorage.setItem('gemini_selected_model', tempModel);
      setApiKey(tempApiKey.trim());
      setSelectedModel(tempModel);
      setShowApiKeyModal(false);
      setTempApiKey('');
      setError(null);
    }
  };

  // ── Save to history ────────────────────────────────────────────────────────
  const saveToHistory = useCallback((prompt: string, mood: string, topic: string, imgUrl?: string) => {
    const entry: PromptHistory = {
      id: Date.now().toString(),
      prompt,
      mood,
      topic: topic.slice(0, 60),
      createdAt: Date.now(),
      imageUrl: imgUrl,
    };
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { }
      return next;
    });
  }, []);

  // ── Generate ───────────────────────────────────────────────────────────────
  const doGenerate = useCallback(async (key: string, model: string) => {
    if (!inputText.trim() && !selectedFile) return;
    setIsGenerating(true);
    setError(null);
    setImagePrompt('');
    setPreviewUrl(null);

    try {
      let filePart: FilePart | undefined;
      let extraText = '';

      if (selectedFile) {
        if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const buf = await selectedFile.arrayBuffer();
          const res = await mammoth.extractRawText({ arrayBuffer: buf });
          extraText = res.value;
        } else if (
          selectedFile.type.startsWith('image/') ||
          selectedFile.type.startsWith('audio/') ||
          selectedFile.type === 'application/pdf'
        ) {
          const b64 = await new Promise<string>(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(selectedFile);
          });
          filePart = { inlineData: { data: b64, mimeType: selectedFile.type } };
        }
      }

      const combined = inputText + (extraText ? `\n\nDocument Content:\n${extraText}` : '');
      const prompt = await generatePromptDirectly(combined, activeMood, key, filePart, model);

      const topic = selectedFile ? selectedFile.name : inputText;
      const imgUrl = showPreview ? getImageUrl(prompt) : undefined;

      setImagePrompt(prompt);
      setPreviewUrl(imgUrl ?? null);
      saveToHistory(prompt, activeMood, topic, imgUrl);

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#FFD1DC', '#B2E2F2', '#C1E1C1', '#FFB347'] });

      setSelectedFile(null);
      setFilePreview(null);
      setInputText('');
    } catch (err: any) {
      console.error('Lỗi tạo prompt:', err);
      setError(err?.message ?? 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  }, [inputText, selectedFile, activeMood, showPreview, saveToHistory]);

  const handleGenerate = () => {
    if (!apiKey) { setShowApiKeyModal(true); return; }
    doGenerate(apiKey, selectedModel);
  };

  const handleRetry = () => { setError(null); doGenerate(apiKey, selectedModel); };

  // ── File ───────────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };
  const removeFile = () => {
    setSelectedFile(null); setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Copy ───────────────────────────────────────────────────────────────────
  const handleCopyPrompt = (text = imagePrompt) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Export txt ─────────────────────────────────────────────────────────────
  const handleDownloadTxt = (text = imagePrompt) => {
    const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cutemind_prompt_${Date.now()}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Export image ───────────────────────────────────────────────────────────
  const handleDownloadImg = async (url = previewUrl) => {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = `cutemind_image_${Date.now()}.jpg`;
      a.click(); URL.revokeObjectURL(href);
    } catch { window.open(url, '_blank'); }
  };

  // ── Delete history entry ───────────────────────────────────────────────────
  const deleteHistory = (id: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { }
      return next;
    });
  };

  // ── Load from history ──────────────────────────────────────────────────────
  const loadFromHistory = (entry: PromptHistory) => {
    setImagePrompt(entry.prompt);
    setPreviewUrl(entry.imageUrl ?? null);
    setActiveMood(entry.mood);
    setShowHistory(false);
  };

  // ── Template select ────────────────────────────────────────────────────────
  const applyTemplate = (tmpl: typeof TEMPLATES[number]) => {
    setInputText(tmpl.topic);
    setShowTemplates(false);
  };

  const moodLabel = MOODS.find(m => m.id === activeMood)?.label ?? '';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#FFF9F2]">

      {/* ── TOP BANNER: Cộng đồng Ms Lý AI ─────────────────────────────────── */}
      <div
        className="flex-shrink-0 w-full px-6 py-3 flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: 'linear-gradient(135deg, #FF6B35 0%, #F7C59F 40%, #C084FC 80%, #818CF8 100%)',
        }}
      >
        {/* Left: title + description */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-white/25 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-base leading-tight tracking-wide">
              🌟 Cộng đồng Ms Lý AI
            </p>
            <p className="text-white/85 text-[11px] font-medium leading-tight truncate max-w-sm">
              Truy cập nhóm để nhận FREE nhiều App ứng dụng trong kinh doanh, công việc &amp; giáo dục...
            </p>
          </div>
        </div>

        {/* Right: links + phone */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <span className="text-white/90 text-[11px] font-bold bg-white/20 px-3 py-1.5 rounded-full">
            📞 0962 859 488
          </span>
          <a
            href="https://www.facebook.com/nguyen.ly.254892/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-[11px] font-black bg-[#1877F2] hover:bg-[#166fe5] px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors shadow-md"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Facebook
          </a>
          <a
            href="https://zalo.me/g/wupdcx020"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-[11px] font-black bg-[#0068FF] hover:bg-[#0057d9] px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors shadow-md"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 48 48">
              <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm8.5 28.5c-.4.7-1.2 1-1.9.7-5.3-2.7-9.4-7.3-11.5-12.8-.3-.8.1-1.7.9-2 .8-.3 1.7.1 2 .9 1.8 4.8 5.4 8.8 10.1 11.2.7.4 1 1.3.4 2z" />
            </svg>
            Zalo Nhóm
          </a>
        </div>
      </div>

      {/* ── MAIN APP LAYOUT ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden bg-[#FFF9F2]">

        {/* ── SIDEBAR LEFT ─────────────────────────────────────────────────── */}
        <motion.aside
          initial={{ x: -300 }} animate={{ x: 0 }}
          className="w-80 glass-panel m-4 flex flex-col overflow-hidden border-r border-orange-100"
        >
          {/* Header */}
          <div className="p-6 border-b border-orange-50 bg-white/50">
            <h1 className="text-2xl font-display text-orange-500 flex items-center gap-2">
              <Sparkles className="w-6 h-6" /> CuteMind AI
            </h1>
            <p className="text-xs text-gray-400 font-medium mt-1">Biến ý tưởng thành tranh vẽ đáng yêu</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* ── Templates strip ── */}
            <div>
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="w-full flex items-center justify-between text-sm font-bold text-gray-600 hover:text-orange-500 transition-colors"
              >
                <span className="flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-400" /> Chủ đề mẫu nhanh</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-90' : ''}`} />
              </button>
              <AnimatePresence>
                {showTemplates && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 grid grid-cols-1 gap-1.5 overflow-hidden"
                  >
                    {TEMPLATES.map(tmpl => (
                      <button
                        key={tmpl.id}
                        onClick={() => applyTemplate(tmpl)}
                        className="text-left px-3 py-2 rounded-xl bg-yellow-50 hover:bg-yellow-100 border border-yellow-100 text-xs font-medium text-yellow-800 transition-colors"
                      >
                        {tmpl.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Input ── */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                <TypeIcon className="w-4 h-4" /> Nội dung của bạn
              </label>
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Nhập chủ đề hoặc đính kèm tệp (Ảnh, PDF, Audio, Word)..."
                  className="w-full h-36 p-4 rounded-2xl border-2 border-orange-100 focus:border-orange-300 focus:ring-0 transition-all resize-none text-sm bg-white/50"
                />
                <AnimatePresence>
                  {selectedFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute bottom-4 left-4 right-4 p-2 bg-white rounded-xl border border-orange-100 shadow-sm flex items-center gap-3 z-10"
                    >
                      {filePreview
                        ? <img src={filePreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                        : (
                          <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-400">
                            {selectedFile.type.startsWith('audio/') ? <FileAudio className="w-5 h-5" />
                              : selectedFile.type === 'application/pdf' ? <FileText className="w-5 h-5" />
                                : <FileIcon className="w-5 h-5" />}
                          </div>
                        )
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-600 truncate">{selectedFile.name}</p>
                        <p className="text-[8px] text-gray-400 uppercase">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button onClick={removeFile} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Error Banner ── */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-700 font-medium leading-relaxed">{error}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowApiKeyModal(true)}
                      className="flex-1 py-2 bg-white border-2 border-red-100 hover:border-red-300 text-red-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1">
                      <Settings className="w-3 h-3" /> Đổi API Key
                    </button>
                    <button onClick={handleRetry}
                      disabled={isGenerating || (!inputText.trim() && !selectedFile)}
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Thử lại
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Action row ── */}
            <div className="flex gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden"
                accept="image/*,audio/*,application/pdf,.docx" />
              <button onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 bg-white border-2 border-orange-100 hover:border-orange-300 text-orange-500 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2">
                <Paperclip className="w-4 h-4" /> Đính kèm
              </button>
              <button onClick={handleGenerate}
                disabled={isGenerating || (!inputText.trim() && !selectedFile)}
                className="flex-[2] py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 group">
                {isGenerating
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...</>
                  : <><Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Sinh Câu Lệnh</>
                }
              </button>
            </div>

            {/* ── Mood selector ── */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                <Smile className="w-4 h-4" /> Chọn Mood
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MOODS.map(mood => (
                  <button key={mood.id} onClick={() => setActiveMood(mood.id)}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${activeMood === mood.id
                      ? 'border-orange-400 bg-orange-50 text-orange-600'
                      : 'border-gray-100 bg-white text-gray-400 hover:border-orange-200'
                      }`}>
                    <mood.icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{mood.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Toggle preview ── */}
            <button onClick={() => setShowPreview(v => !v)}
              className="w-full py-2.5 bg-white border-2 border-gray-100 hover:border-indigo-200 text-gray-500 hover:text-indigo-500 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2">
              {showPreview ? <><EyeOff className="w-3.5 h-3.5" /> Tắt xem ảnh AI</> : <><Eye className="w-3.5 h-3.5" /> Bật xem ảnh AI (Pollinations)</>}
            </button>

            {/* ── Prompt result in sidebar ── */}
            {imagePrompt && (
              <div className="pt-5 border-t border-orange-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-500" /> Prompt
                  </label>
                  <div className="flex gap-1">
                    <button onClick={() => handleCopyPrompt()}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                      {copied ? <><Check className="w-3 h-3" /> Đã copy</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                    <span className="text-gray-300 mx-1">|</span>
                    <button onClick={() => handleDownloadTxt()}
                      className="text-[10px] font-bold text-green-500 hover:text-green-600 flex items-center gap-1">
                      <Download className="w-3 h-3" /> .txt
                    </button>
                  </div>
                </div>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative">
                  <div className="w-full p-4 bg-indigo-50/50 rounded-2xl border-2 border-indigo-100 text-xs text-indigo-900 leading-relaxed font-medium max-h-48 overflow-y-auto">
                    {imagePrompt}
                  </div>
                  <button onClick={() => { setImagePrompt(''); setPreviewUrl(null); }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center text-gray-400 hover:text-red-500 transition-all border border-gray-100">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </motion.div>
                <p className="text-[10px] text-gray-400 italic text-center">Dùng trên Midjourney hoặc DALL-E 3</p>
              </div>
            )}
          </div>
        </motion.aside>

        {/* ── MAIN AREA ────────────────────────────────────────────────────── */}
        <main className="flex-1 relative flex flex-col bg-white overflow-hidden">

          {/* Header */}
          <header className="h-16 flex items-center justify-between px-8 border-b border-orange-50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-400" />
              <span className="font-display text-lg text-gray-700">Kết quả</span>
              {selectedModel && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 rounded-full text-[10px] font-bold text-orange-500 border border-orange-100">
                  <Cpu className="w-3 h-3" />{selectedModel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowHistory(v => !v)}
                className={`px-4 py-2 border-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${showHistory ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-orange-100 hover:border-orange-300 text-gray-600'
                  }`}>
                <History className="w-4 h-4" />
                Lịch sử {history.length > 0 && <span className="ml-0.5 bg-orange-400 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">{history.length}</span>}
              </button>
              <button onClick={() => { setTempApiKey(''); setTempModel(selectedModel); setShowApiKeyModal(true); }}
                className="px-4 py-2 bg-white border-2 border-orange-100 hover:border-orange-300 text-gray-600 rounded-full text-sm font-bold flex flex-col items-center transition-all shadow-sm">
                <div className="flex items-center gap-2"><Settings className="w-4 h-4" /> Settings</div>
                <span className="text-[9px] text-red-500 font-medium">Lấy API key để sử dụng app</span>
              </button>
              <button onClick={() => confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 }, shapes: ['circle', 'square'], colors: ['#FF69B4', '#87CEEB', '#98FB98', '#DDA0DD'] })}
                className="px-4 py-2 bg-pink-400 hover:bg-pink-500 text-white rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-pink-100">
                <Heart className="w-4 h-4" /> Make it cute!
              </button>
            </div>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex">

            {/* ── History Panel ── */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                  className="h-full border-r border-orange-100 bg-[#FFF9F2] flex flex-col overflow-hidden flex-shrink-0"
                >
                  <div className="p-4 border-b border-orange-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2"><History className="w-4 h-4 text-indigo-400" /> Lịch sử Prompt</h3>
                    <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {history.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <Clock className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm">Chưa có lịch sử</p>
                      </div>
                    ) : (
                      history.map(entry => (
                        <div key={entry.id}
                          className="group p-3 bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 transition-all cursor-pointer space-y-2"
                          onClick={() => loadFromHistory(entry)}
                        >
                          {entry.imageUrl && (
                            <img src={entry.imageUrl} alt="hist" className="w-full h-24 object-cover rounded-xl"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-700 truncate">{entry.topic || 'Không có tiêu đề'}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {MOODS.find(m => m.id === entry.mood)?.label} · {new Date(entry.createdAt).toLocaleDateString('vi-VN')}
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={e => { e.stopPropagation(); handleCopyPrompt(entry.prompt); }}
                                className="p-1.5 hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 rounded-lg transition-colors" title="Copy">
                                <Copy className="w-3 h-3" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); handleDownloadTxt(entry.prompt); }}
                                className="p-1.5 hover:bg-green-50 text-gray-400 hover:text-green-500 rounded-lg transition-colors" title="Download txt">
                                <Download className="w-3 h-3" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); deleteHistory(entry.id); }}
                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors" title="Xóa">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{entry.prompt.slice(0, 120)}…</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Result & Preview ── */}
            <div className="flex-1 p-8 overflow-y-auto flex items-start justify-center">
              <AnimatePresence mode="wait">
                {!imagePrompt ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                    className="text-center space-y-6 max-w-md mt-12"
                  >
                    <div className="w-32 h-32 bg-orange-50 rounded-full flex items-center justify-center mx-auto">
                      <Wand2 className="w-16 h-16 text-orange-200" />
                    </div>
                    <h2 className="text-2xl font-display text-gray-800">Sẵn sàng tạo câu lệnh?</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Chọn chủ đề mẫu hoặc nhập nội dung ở bên trái, rồi nhấn <b>"Sinh Câu Lệnh"</b>.
                    </p>
                    <p className="text-[11px] text-orange-400 font-medium">
                      ✨ Ảnh AI sẽ được tạo tự động qua Pollinations.ai (miễn phí)
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-3xl space-y-6"
                  >
                    {/* Prompt card */}
                    <div className="glass-panel p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-500">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800">AI Image Prompt</h3>
                            <p className="text-[10px] text-gray-400">Mood: {moodLabel} · {selectedModel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDownloadTxt()}
                            className="px-4 py-2 rounded-full font-bold text-sm bg-green-500 hover:bg-green-600 text-white flex items-center gap-2 transition-all">
                            <Download className="w-4 h-4" /> .txt
                          </button>
                          <button onClick={() => handleCopyPrompt()}
                            className={`px-4 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-2 ${copied ? 'bg-green-500 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                              }`}>
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Đã sao chép' : 'Sao chép'}
                          </button>
                        </div>
                      </div>

                      <div className="p-6 bg-gray-50 rounded-[24px] border-2 border-dashed border-gray-200 text-base text-gray-700 leading-relaxed font-medium italic">
                        "{imagePrompt}"
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {[{ icon: Palette, color: 'orange', label: 'Màu sắc rực rỡ' },
                        { icon: Sparkles, color: 'blue', label: 'Phong cách Cute' },
                        { icon: BookOpen, color: 'purple', label: 'Dễ hiểu cho bé' }
                        ].map(({ icon: Icon, color, label }) => (
                          <div key={label} className={`p-3 bg-${color}-50 rounded-2xl flex flex-col items-center text-center gap-1`}>
                            <Icon className={`w-5 h-5 text-${color}-400`} />
                            <span className={`text-[10px] font-bold text-${color}-700 uppercase`}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Image Preview (Pollinations) ── */}
                    {showPreview && previewUrl && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        className="glass-panel p-6 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-pink-400" /> Xem trước ảnh AI
                            <span className="text-[10px] text-gray-400 font-normal">(Pollinations.ai · miễn phí)</span>
                          </h3>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setIsLoadingImg(true); setPreviewUrl(getImageUrl(imagePrompt)); }}
                              className="px-3 py-1.5 bg-white border border-gray-200 hover:border-orange-300 rounded-full text-xs font-bold text-gray-500 flex items-center gap-1 transition-all"
                            >
                              <RefreshCw className="w-3 h-3" /> Tạo lại ảnh
                            </button>
                            <button onClick={() => handleDownloadImg()}
                              className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-full text-xs font-bold flex items-center gap-1 transition-all">
                              <Download className="w-3 h-3" /> Tải ảnh
                            </button>
                          </div>
                        </div>

                        <div className="relative w-full rounded-[20px] overflow-hidden bg-gray-100 min-h-[300px] flex items-center justify-center">
                          {isLoadingImg && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 gap-3">
                              <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                              <p className="text-sm text-gray-500 font-medium">Đang tạo ảnh… (15–30 giây)</p>
                            </div>
                          )}
                          <img
                            src={previewUrl}
                            alt="AI generated mindmap"
                            className="w-full rounded-[20px] object-contain"
                            onLoad={() => setIsLoadingImg(false)}
                            onLoadStart={() => setIsLoadingImg(true)}
                            onError={() => setIsLoadingImg(false)}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 text-center">
                          Ảnh do Pollinations.ai tạo — có thể không hoàn hảo. Dùng Midjourney để chất lượng cao hơn.
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* ── API Key Modal ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showApiKeyModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-500">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-display text-gray-800">Cấu hình API Key</h3>
                        <p className="text-xs text-gray-400">Yêu cầu để sử dụng AI</p>
                      </div>
                    </div>
                    {apiKey && (
                      <button onClick={() => setShowApiKeyModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                    <p className="text-xs text-blue-700 leading-relaxed font-medium">
                      API key được lưu an toàn trong trình duyệt của bạn.
                    </p>
                    <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer"
                      className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
                      Lấy API key tại Google AI Studio <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Gemini API Key</label>
                    <input
                      type="password"
                      value={tempApiKey}
                      onChange={e => setTempApiKey(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
                      placeholder={apiKey ? 'Nhập key mới...' : 'Dán API key vào đây...'}
                      className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-orange-400 focus:ring-0 transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5" /> Chọn Model AI
                    </label>
                    <div className="grid gap-2">
                      {AI_MODELS.map(m => (
                        <button key={m.id} onClick={() => setTempModel(m.id)}
                          className={`p-3 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${tempModel === m.id ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-white hover:border-orange-200'
                            }`}>
                          <div>
                            <p className={`text-sm font-bold ${tempModel === m.id ? 'text-orange-600' : 'text-gray-700'}`}>{m.label}</p>
                            <p className="text-[10px] text-gray-400">{m.desc}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${tempModel === m.id ? 'bg-orange-200 text-orange-700' : 'bg-gray-100 text-gray-500'
                            }`}>{m.badge}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={handleSaveApiKey}
                    disabled={!tempApiKey.trim() && !apiKey}
                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 text-white rounded-2xl font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" /> Lưu cấu hình
                  </button>
                  {!apiKey && (
                    <p className="text-[10px] text-red-500 text-center font-medium">* Bạn phải nhập API key để sử dụng ứng dụng.</p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* end main app layout div */}
    </div>
  );
}

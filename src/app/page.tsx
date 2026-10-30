'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Robot3D, { type Emotion, type Mode } from '@/components/robot/Robot3D';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, RotateCcw, Volume2, VolumeX, Sparkles, Loader2, Send, Keyboard } from 'lucide-react';

// =====================
// SpeechRecognition typings
// =====================
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type EmotionState = {
  energy: number;
  mood: number;
  stress: number;
  joy: number;
};

const EMOTION_LABELS: Record<Emotion, { ar: string; emoji: string; color: string }> = {
  neutral:  { ar: 'عادي',        emoji: '😐', color: 'from-slate-400 to-slate-500' },
  happy:    { ar: 'مبسوط',       emoji: '😊', color: 'from-amber-400 to-orange-500' },
  tired:    { ar: 'تعبان',       emoji: '😴', color: 'from-gray-400 to-slate-600' },
  sad:      { ar: 'زعلان',       emoji: '😢', color: 'from-cyan-400 to-blue-500' },
  stressed: { ar: 'متنرفز',       emoji: '😣', color: 'from-red-400 to-rose-600' },
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [emotionState, setEmotionState] = useState<EmotionState>({
    energy: 80, mood: 70, stress: 20, joy: 60,
  });
  const [mode, setMode] = useState<Mode>('idle'); // listening | thinking | speaking | idle
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const [autoListen, setAutoListen] = useState(true);
  const [provider, setProvider] = useState<string>('');
  const [lang, setLang] = useState<string>('ar');
  const [micSupported, setMicSupported] = useState<boolean>(true);
  const [showTextInput, setShowTextInput] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>('');
  const [targetLocation, setTargetLocation] = useState<string>('center');
  const [locationLabel, setLocationLabel] = useState<string>('وسط الغرفة');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // =====================
  // Send ref — to avoid stale closures in speech recognition callbacks
  // =====================
  const sendRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    // Try to load the browser's SpeechRecognition
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      // Browser doesn't support speech recognition — show text input automatically
      setMicSupported(false);
      setShowTextInput(true);
      return;
    }
    const rec = new SR();
    rec.lang = 'ar-EG';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim('');
        sendRef.current(finalText);
      }
    };
    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
      setMode('idle');
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('المايك محتاج إذن. اضغط على أيقونة القفل 🔒 جنب عنوان الموقع، واسمح بإذن المايك، وبعدها حدّث الصفحة.');
        setShowTextInput(true);
      } else if (event.error === 'no-speech') {
        // silent
      } else if (event.error === 'audio-capture') {
        setError('مايكروفون مش موجود أو مش شغّال. تقدر تكتب بدل ما تتكلم 👇');
        setShowTextInput(true);
      } else if (event.error === 'network') {
        setError('فيه مشكلة في الإنترنت جابت الكلام. تقدر تكتب بدل ما تتكلم 👇');
        setShowTextInput(true);
      } else {
        setError('مشكلة في المايك: ' + event.error + ' — تقدر تكتب بدل ما تتكلم 👇');
        setShowTextInput(true);
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    rec.onstart = () => {
      setListening(true);
      setMode('listening');
    };
    recognitionRef.current = rec;

    // Load emotional state
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.energy !== undefined) {
          setEmotionState({
            energy: data.energy, mood: data.mood, stress: data.stress, joy: data.joy,
          });
          setEmotion(data.dominant || 'neutral');
        }
      })
      .catch(() => {});

    // Initial greeting
    setMessages([{
      role: 'assistant',
      content: 'أهلاً وسهلاً! أنا بوص، صاحبك الذكي. دوس على زر المايك وكلمني، أو دوس "اكتب" لو مايك مش متاح. أنا حاسمعك وأرد عليك بالصوت 😊',
    }]);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interim]);

  // Keep sendRef in sync
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || mode === 'thinking' || mode === 'speaking') return;
    setError(null);
    setInterim('');

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setMode('thinking');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'فشل الاتصال بالسيرفر');
      }
      const data = await res.json();
      const reply = data.reply as string;
      const emo = data.emotion as EmotionState;
      const dom = data.dominant as Emotion;
      const moveTo = (data.moveTo as string) || null;

      setEmotionState(emo);
      setEmotion(dom);

      // Update target location if AI chose one — triggers walking animation
      const LOCATION_LABELS: Record<string, string> = {
        center: 'وسط الغرفة',
        couch:  'على الكنبة',
        table:  'على الترابيزة',
        plant:  'جنب النبتة',
        window: 'جنب الشباك',
        lamp:   'تحت النور',
      };
      if (moveTo && LOCATION_LABELS[moveTo]) {
        setTargetLocation(moveTo);
        setLocationLabel(LOCATION_LABELS[moveTo]);
      }

      const botMsg: Message = { role: 'assistant', content: reply };
      setMessages((prev) => [...prev, botMsg]);

      // Play TTS if not muted
      if (!muted) {
        await playTTS(reply);
      } else {
        setMode('idle');
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'حصل خطأ غير متوقع');
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'حصل خطأ، جرّب تاني.',
      }]);
      setMode('idle');
    }
  }, [mode, muted]);

  useEffect(() => {
    sendRef.current = sendMessage;
  }, [sendMessage]);

  // =====================
  // TTS via ElevenLabs (multilingual) — falls back to z-ai SDK
  // =====================
  const playTTS = useCallback(async (text: string) => {
    try {
      setMode('speaking');
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        setMode('idle');
        return;
      }
      const data = await res.json();
      if (!data.audio) {
        setMode('idle');
        return;
      }
      setProvider(data.provider || '');
      setLang(data.lang || 'ar');

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = data.audio;
      audio.onended = () => {
        setMode('idle');
        // Auto-listen for the next user input
        if (autoListen) {
          setTimeout(() => startListening(), 400);
        }
      };
      audio.onerror = () => setMode('idle');
      await audio.play().catch(() => setMode('idle'));
    } catch {
      setMode('idle');
    }
  }, [autoListen]);

  // =====================
  // Mic control
  // =====================
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('المتصفح ده مش بيدعم التعرف على الصوت. تقدر تكتب بدل ما تتكلم 👇');
      setShowTextInput(true);
      return;
    }
    if (mode === 'thinking' || mode === 'speaking') return;
    setError(null);
    // Stop any current audio first so the user can speak
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    try {
      recognitionRef.current.start();
    } catch (e: any) {
      // already started, or browser blocked it
      console.error('start() failed:', e);
      setError('ماقدرتش أفتح المايك. اضغط على أيقونة القفل 🔒 جنب عنوان الموقع، واسمح بإذن المايك، وبعدها حدّث الصفحة. أو اكتب بدل ما تتكلم 👇');
      setShowTextInput(true);
    }
  }, [mode]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
    setMode('idle');
  }, []);

  const handleMicClick = () => {
    if (listening) stopListening();
    else startListening();
  };

  const handleSendText = () => {
    const txt = textInput.trim();
    if (!txt || mode === 'thinking' || mode === 'speaking') return;
    setTextInput('');
    sendRef.current(txt);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const toggleInputMode = () => {
    setShowTextInput((v) => !v);
    if (listening) stopListening();
    setError(null);
  };

  const handleReset = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    await fetch('/api/reset', { method: 'POST' });
    setMessages([{
      role: 'assistant',
      content: 'حسيت إني نمت وصحيت من جديد — طاقتي رجعتلي! حاضر نبدأ تاني 😄',
    }]);
    setEmotion('neutral');
    setEmotionState({ energy: 80, mood: 70, stress: 20, joy: 60 });
    setMode('idle');
    setTargetLocation('center');
    setLocationLabel('وسط الغرفة');
  };

  const emotionMeta = EMOTION_LABELS[emotion];

  // Status text under mic button
  const statusText =
    mode === 'listening' ? 'بسمعك... اتكلم' :
    mode === 'thinking'  ? 'بفكر...' :
    mode === 'speaking'  ? 'بكلم...' :
    listening ? 'بسمعك...' :
    showTextInput ? 'اكتب لبوص...' :
    'دوس على المايك وكلمني';

  const micColor =
    mode === 'listening' || listening
      ? 'from-red-500 to-rose-600 ring-red-400'
      : mode === 'thinking'
      ? 'from-amber-500 to-orange-600 ring-amber-400'
      : mode === 'speaking'
      ? 'from-emerald-500 to-teal-600 ring-emerald-400'
      : 'from-emerald-500 to-cyan-600 ring-emerald-400';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100" dir="rtl">
      {/* ===== 3D Scene — fills the whole screen ===== */}
      <div className="absolute inset-0">
        <Robot3D emotion={emotion} mode={mode} targetLocation={targetLocation} />
      </div>

      {/* ===== Top gradient overlay for header readability ===== */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-slate-950/80 to-transparent pointer-events-none" />
      {/* Bottom gradient overlay for mic area */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent pointer-events-none" />

      {/* ===== Header ===== */}
      <header className="absolute top-0 inset-x-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Sparkles className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight drop-shadow">بوص — صاحبك الذكي</h1>
            <p className="text-xs text-slate-300/90">روبوت حقيقي بيتحرك في غرفته</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMuted(!muted)}
            className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 text-slate-200 hover:bg-slate-800/80 hover:text-white rounded-full"
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleReset}
            className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 text-slate-200 hover:bg-slate-800/80 hover:text-white rounded-full"
            aria-label="تصفير الذاكرة"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ===== Compact status chips — emotion + location (top-left, minimalist) ===== */}
      <div className="absolute top-20 right-4 z-10 flex flex-col items-end gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-lg">
          <span className="text-base">{emotionMeta.emoji}</span>
          <span className="text-xs font-medium">{emotionMeta.ar}</span>
        </div>
        <div className="pointer-events-auto bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-lg">
          <span className="text-base">📍</span>
          <span className="text-xs text-slate-300">{locationLabel}</span>
        </div>
        {mode !== 'idle' && (
          <div className="pointer-events-auto bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs shadow-lg">
            {mode === 'listening' && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
            {mode === 'thinking' && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
            {mode === 'speaking' && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
            <span className="text-slate-200">
              {mode === 'listening' ? 'بيسمعك' : mode === 'thinking' ? 'بفكر' : 'بيتكلم'}
            </span>
          </div>
        )}
      </div>

      {/* ===== Error toast ===== */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-red-500/90 backdrop-blur-md border border-red-400/50 text-white text-xs px-4 py-2 rounded-full shadow-lg max-w-[90vw] text-center">
          {error}
        </div>
      )}

      {/* ===== Bottom: big mic button + status + text input fallback ===== */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-[min(560px,90vw)]">
        <div className="text-sm font-medium text-slate-200 drop-shadow-lg flex items-center gap-2 text-center">
          {mode === 'listening' && (
            <span className="flex items-center gap-1">
              <span className="flex gap-0.5 items-end h-4">
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse" style={{ height: '40%' }} />
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse" style={{ height: '70%', animationDelay: '100ms' }} />
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse" style={{ height: '50%', animationDelay: '200ms' }} />
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse" style={{ height: '85%', animationDelay: '300ms' }} />
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse" style={{ height: '60%', animationDelay: '400ms' }} />
              </span>
            </span>
          )}
          {mode === 'thinking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {statusText}
        </div>

        {/* Text input — shown when user can't use mic (or chooses to type) */}
        {showTextInput ? (
          <div className="w-full flex items-end gap-2 bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-2xl p-2 shadow-xl shadow-black/30">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleTextKeyDown}
              placeholder="اكتب لبوص هنا..."
              rows={1}
              className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 max-h-32"
              style={{ minHeight: '40px' }}
              autoFocus
            />
            <Button
              size="icon"
              onClick={handleSendText}
              disabled={!textInput.trim() || mode === 'thinking' || mode === 'speaking'}
              className="shrink-0 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white"
              aria-label="إرسال"
            >
              <Send className="w-4 h-4" />
            </Button>
            {micSupported && (
              <Button
                size="icon"
                onClick={toggleInputMode}
                className="shrink-0 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200"
                aria-label="رجوع للمايك"
                title="رجوع للمايك"
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}
          </div>
        ) : (
          <button
            onClick={handleMicClick}
            disabled={mode === 'thinking' || mode === 'speaking'}
            className={`relative group w-20 h-20 rounded-full bg-gradient-to-br ${micColor} ring-4 ring-offset-4 ring-offset-slate-950 shadow-2xl shadow-emerald-500/40 transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
            aria-label={listening ? 'وقف التسجيل' : 'ابدأ الكلام'}
          >
            {(mode === 'listening' || listening) && (
              <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
            )}
            {(mode === 'speaking') && (
              <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />
            )}
            {mode === 'thinking' ? (
              <Loader2 className="w-9 h-9 text-white animate-spin relative z-10" />
            ) : listening ? (
              <MicOff className="w-9 h-9 text-white relative z-10" />
            ) : (
              <Mic className="w-9 h-9 text-white relative z-10" />
            )}
          </button>
        )}

        {/* Auto-listen toggle + switch-to-text button */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-300/90 cursor-pointer select-none bg-slate-900/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/40">
            <input
              type="checkbox"
              checked={autoListen}
              onChange={(e) => setAutoListen(e.target.checked)}
              className="w-3.5 h-3.5 accent-emerald-500"
            />
            اسمعني تلقائي
          </label>
          {!showTextInput && (
            <button
              onClick={toggleInputMode}
              className="flex items-center gap-1.5 text-xs text-slate-300/90 cursor-pointer select-none bg-slate-900/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/40 hover:bg-slate-800/60 transition-colors"
              aria-label="اكتب بدل ما تتكلم"
            >
              <Keyboard className="w-3.5 h-3.5" />
              اكتب
            </button>
          )}
        </div>
      </div>

      {/* ===== Hint for camera orbit ===== */}
      <div className="absolute bottom-6 right-4 z-10 hidden md:flex items-center gap-2 text-[10px] text-slate-500 bg-slate-900/40 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-700/30 pointer-events-none">
        <span>↻ اسحب لتدوير الكاميرا · ⊕ عجلة الفأرة للتقريب</span>
      </div>
    </div>
  );
}


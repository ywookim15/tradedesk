'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Mic, MicOff, Volume2, VolumeX, Trash2, Zap, Brain, Radio, X, Download, BarChart2 } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import NeuralNetworkCanvas from '@/components/assistant/NeuralNetworkCanvas'
import type { ChatMessage, AssistantStatus } from '@/types'

// ── Web Speech API type shims ─────────────────────────────────────────────────
interface SRResult   { transcript: string }
interface SRItem     { [i: number]: SRResult; isFinal: boolean }
interface SRList     { [i: number]: SRItem; length: number }
interface SREvent    { results: SRList; resultIndex: number }
interface SRInstance {
  continuous: boolean; interimResults: boolean; lang: string
  start(): void; stop(): void; abort(): void
  onstart:  (() => void) | null
  onend:    (() => void) | null
  onerror:  ((e: { error: string }) => void) | null
  onresult: ((e: SREvent) => void) | null
}
function makeSR(): SRInstance | null {
  if (typeof window === 'undefined') return null
  type SRCtor = new () => SRInstance
  const w = window as typeof window & { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

// ── Types ─────────────────────────────────────────────────────────────────────
type GeminiContent = { role: 'user' | 'model'; parts: [{ text: string }] }
type ChartPoint    = { label: string; value: number }
type ChartModal    = { title: string; data: ChartPoint[]; chartType: 'line' | 'bar' }

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function toHistory(msgs: ChatMessage[]): GeminiContent[] {
  return msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }))
}

const FREE_LIMIT  = 10
const WAVE_DELAYS = [0, 0.12, 0.24, 0.08, 0.18, 0.04, 0.16]

const STATUS_META: Record<AssistantStatus, { label: string; bg: string; glow: string; text: string }> = {
  idle:      { label: 'Idle',      bg: '#0F1729', glow: 'none',                           text: '#8A99B3' },
  listening: { label: 'Listening', bg: '#00C896', glow: '0 0 32px rgba(0,200,150,0.55)',   text: '#00C896' },
  thinking:  { label: 'Thinking',  bg: '#2F80ED', glow: '0 0 32px rgba(47,128,237,0.55)', text: '#2F80ED' },
  speaking:  { label: 'Speaking',  bg: '#4FA3FF', glow: '0 0 32px rgba(79,163,255,0.55)', text: '#4FA3FF' },
}

// ── Updated welcome message — no "Hey Buddy" ──────────────────────────────────
const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Hi! I'm your TradeDesk AI assistant. Enable "Always Listening" to stay hands-free, or tap the mic button to speak. I'll give you real-time market data, technical reads, and trading analysis on demand. You can also type any question below.`,
  timestamp: new Date(),
}

// ── Visual intent detection ───────────────────────────────────────────────────
const VISUAL_RE = /\b(chart|graph|visuali[sz]e|plot|show\s+me|display|draw)\b/i
const TICKER_RE = /\b([A-Z]{1,5})\b/g
const COMMON_WORDS = new Set(['A', 'I', 'ME', 'MY', 'THE', 'FOR', 'AND', 'OR', 'OF', 'IN', 'IS', 'IT', 'AT', 'BE', 'DO', 'TO', 'UP', 'BY', 'P&L', 'RSI', 'EPS'])

function detectVisualIntent(text: string): { hasIntent: boolean; ticker?: string; chartType: 'line' | 'bar' } {
  if (!VISUAL_RE.test(text)) return { hasIntent: false, chartType: 'line' }
  const tickers = [...text.matchAll(TICKER_RE)]
    .map(m => m[1])
    .filter(t => !COMMON_WORDS.has(t))
  const ticker    = tickers[0]
  const isBar     = /comparison|compare|sector|vs\.|versus|breakdown|allocation|profile/i.test(text)
  return { hasIntent: true, ticker, chartType: isBar ? 'bar' : 'line' }
}

// ── Voice selection ───────────────────────────────────────────────────────────
const PREFERRED_VOICES = [
  'google us english',
  'google uk english female',
  'samantha',
  'karen',
  'victoria',
  'moira',
  'ava',
  'nicky',
  'zira',
]

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const pref of PREFERRED_VOICES) {
    const v = voices.find(v => v.name.toLowerCase().includes(pref))
    if (v) return v
  }
  return (
    voices.find(v => /female/i.test(v.name) && v.lang.startsWith('en')) ??
    voices.find(v => v.lang.startsWith('en')) ??
    voices[0] ??
    null
  )
}

// ── Natural speech — split text at sentence boundaries ───────────────────────
function speakNatural(
  text: string,
  voice: SpeechSynthesisVoice | null,
  onStart: () => void,
  onEnd: () => void,
) {
  speechSynthesis.cancel()
  // Split into sentences, preserving punctuation
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)

  if (!sentences.length) { onEnd(); return }

  let idx = 0
  function speakNext() {
    if (idx === 0) onStart()
    if (idx >= sentences.length) { onEnd(); return }
    const utt  = new SpeechSynthesisUtterance(sentences[idx])
    if (voice) utt.voice = voice
    utt.rate   = 0.95
    utt.pitch  = 1.0
    utt.volume = 1.0
    utt.onend  = () => { idx++; setTimeout(speakNext, idx < sentences.length ? 80 : 0) }
    utt.onerror = () => { idx++; speakNext() }
    speechSynthesis.speak(utt)
    idx++
  }
  // To avoid split loop duplication, reset and call via closure
  idx = 0
  speakNextOuter()

  function speakNextOuter() {
    if (idx === 0) onStart()
    const batch = sentences.slice()
    let i = 0
    function next() {
      if (i >= batch.length) { onEnd(); return }
      const utt = new SpeechSynthesisUtterance(batch[i])
      if (voice) utt.voice = voice
      utt.rate   = 0.95
      utt.pitch  = 1.0
      utt.volume = 1.0
      utt.onend   = () => { i++; setTimeout(next, i < batch.length ? 80 : 0) }
      utt.onerror = () => { i++; next() }
      speechSynthesis.speak(utt)
      i++
    }
    next()
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { isPro: boolean; queriesUsed: number; userName: string }

export default function AssistantClient({ isPro, queriesUsed: initQ, userName }: Props) {
  const [status,       setStatus]       = useState<AssistantStatus>('idle')
  const [messages,     setMessages]     = useState<ChatMessage[]>([WELCOME])
  const [alwaysOn,     setAlwaysOn]     = useState(false)
  const [transcript,   setTranscript]   = useState('')
  const [queriesUsed,  setQueriesUsed]  = useState(initQ)
  const [voiceOut,     setVoiceOut]     = useState(true)
  const [limitReached, setLimitReached] = useState(false)
  const [noSpeech,     setNoSpeech]     = useState(false)
  const [chartModal,   setChartModal]   = useState<ChartModal | null>(null)

  // Stable refs
  const messagesRef  = useRef(messages)
  const statusRef    = useRef<AssistantStatus>('idle')
  const alwaysOnRef  = useRef(false)
  const voiceOutRef  = useRef(true)
  const queriesRef   = useRef(initQ)
  const voiceRef     = useRef<SpeechSynthesisVoice | null>(null)
  const queryRef     = useRef<SRInstance | null>(null)
  const startQryRef  = useRef<() => void>(() => {})
  const sendMsgRef   = useRef<(t: string) => void>(() => {})
  const isMounted    = useRef(true)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const chatRef      = useRef<HTMLDivElement>(null)
  const chartDlRef   = useRef<HTMLDivElement>(null)

  // Web Audio API refs (for neural network amplitude)
  const audioCtxRef  = useRef<AudioContext | null>(null)
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  // Sync refs
  useEffect(() => { messagesRef.current  = messages    }, [messages])
  useEffect(() => { statusRef.current    = status      }, [status])
  useEffect(() => { alwaysOnRef.current  = alwaysOn    }, [alwaysOn])
  useEffect(() => { voiceOutRef.current  = voiceOut    }, [voiceOut])
  useEffect(() => { queriesRef.current   = queriesUsed }, [queriesUsed])

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, transcript])

  // Cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false
      queryRef.current?.abort()
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
      teardownAudio()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Web Audio API: setup/teardown on listening state ─────────────────────
  useEffect(() => {
    if (status === 'listening') {
      setupAudio()
    } else {
      teardownAudio()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function setupAudio() {
    if (typeof window === 'undefined' || audioCtxRef.current) return
    try {
      const stream  = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = stream
      const ctx     = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      ctx.createMediaStreamSource(stream).connect(analyser)
    } catch { /* mic permission denied or not available */ }
  }

  function teardownAudio() {
    analyserRef.current = null
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
  }

  // ── Voice loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!makeSR()) setNoSpeech(true)
    const load = () => { voiceRef.current = pickVoice(speechSynthesis.getVoices()) }
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // ── speak ─────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!voiceOutRef.current || typeof speechSynthesis === 'undefined') return
    speechSynthesis.cancel()
    speakNatural(
      text,
      voiceRef.current,
      () => { if (isMounted.current) setStatus('speaking') },
      () => {
        if (!isMounted.current) return
        setStatus('idle')
        if (alwaysOnRef.current) startQryRef.current()
      },
    )
  }, [])

  // ── Chart data fetcher ────────────────────────────────────────────────────
  const fetchChartData = useCallback(async (ticker: string, chartType: 'line' | 'bar') => {
    try {
      const res  = await fetch(`/api/stock/chart?symbol=${encodeURIComponent(ticker)}&period=1mo`)
      const json = await res.json() as { data: { time: string | number; close: number }[] }
      if (!json.data?.length) return
      const points: ChartPoint[] = json.data.slice(-30).map((d) => ({
        label: typeof d.time === 'number'
          ? new Date(d.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : String(d.time).slice(5),
        value: d.close,
      }))
      setChartModal({ title: `${ticker} — 30-day Price`, data: points, chartType })
    } catch { /* silent — chart is enhancement, not core */ }
  }, [])

  // ── sendMessage ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || statusRef.current === 'thinking') return
    if (!isPro && queriesRef.current >= FREE_LIMIT) { setLimitReached(true); return }

    // Visual intent detection (Task 2)
    const visual = detectVisualIntent(trimmed)

    const historyForApi = toHistory(messagesRef.current.filter(m => m.id !== 'welcome'))

    if (!isMounted.current) return
    setMessages(prev => [...prev, { id: uid(), role: 'user', content: trimmed, timestamp: new Date() }])
    setTranscript('')
    setStatus('thinking')

    try {
      const res  = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: trimmed, history: historyForApi }),
      })

      if (!isMounted.current) return
      if (res.status === 429) { setLimitReached(true); setStatus('idle'); return }

      const data = await res.json() as { response?: string; queriesUsed?: number; error?: string }

      if (!res.ok || !data.response) {
        setMessages(prev => [...prev, {
          id: uid(), role: 'assistant',
          content: 'Sorry — I had trouble responding. Please try again.',
          timestamp: new Date(),
        }])
        setStatus('idle')
        return
      }

      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: data.response!, timestamp: new Date() }])
      if (data.queriesUsed != null) setQueriesUsed(data.queriesUsed)
      setStatus('idle')
      speak(data.response!)

      // Trigger chart popup if visual intent detected and ticker found (Task 2)
      if (visual.hasIntent && visual.ticker) {
        fetchChartData(visual.ticker, visual.chartType)
      }

    } catch {
      if (!isMounted.current) return
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant',
        content: 'Network error — check your connection and try again.',
        timestamp: new Date(),
      }])
      setStatus('idle')
    }
  }, [isPro, speak, fetchChartData])

  useEffect(() => { sendMsgRef.current = sendMessage }, [sendMessage])

  // ── Voice recognition ─────────────────────────────────────────────────────
  useEffect(() => {
    function startQuery() {
      const sr = makeSR()
      if (!sr) return
      queryRef.current?.abort()
      if (!isMounted.current) return
      setStatus('listening')
      setTranscript('')
      let final = ''

      sr.continuous      = false
      sr.interimResults  = true
      sr.lang            = 'en-US'

      sr.onresult = (e) => {
        let interim = ''
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript
          else interim += e.results[i][0].transcript
        }
        if (isMounted.current) setTranscript(final + interim)
      }

      sr.onend = () => {
        queryRef.current = null
        if (!isMounted.current) return
        const query = final.trim()
        if (query) {
          sendMsgRef.current(query)
        } else {
          setStatus('idle'); setTranscript('')
          if (alwaysOnRef.current) setTimeout(() => startQryRef.current(), 200)
        }
      }

      sr.onerror = (e) => {
        queryRef.current = null
        if (e.error !== 'aborted' && isMounted.current) {
          setStatus('idle'); setTranscript('')
          if (alwaysOnRef.current) setTimeout(() => startQryRef.current(), 500)
        }
      }

      try { sr.start(); queryRef.current = sr } catch { /* permission denied */ }
    }

    startQryRef.current = startQuery
    return () => { queryRef.current?.abort() }
  }, [])

  // Start/stop always-on mode
  useEffect(() => {
    if (alwaysOn && statusRef.current === 'idle') {
      startQryRef.current()
    } else if (!alwaysOn) {
      queryRef.current?.abort(); queryRef.current = null
    }
  }, [alwaysOn])

  // ── Text input state + handlers ───────────────────────────────────────────
  const [textInput, setTextInput] = useState('')

  const handleTextSend = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const t = textInput.trim()
    if (!t) return
    setTextInput('')
    sendMsgRef.current(t)
  }, [textInput])

  const handleMicClick = useCallback(() => {
    if (status === 'listening') {
      queryRef.current?.abort(); queryRef.current = null
      setStatus('idle'); setTranscript('')
      if (alwaysOnRef.current) startQryRef.current()
    } else if (status === 'idle' || status === 'speaking') {
      speechSynthesis?.cancel()
      startQryRef.current()
    }
  }, [status])

  const stopAction = useCallback(() => {
    speechSynthesis?.cancel()
    queryRef.current?.abort(); queryRef.current = null
    setStatus('idle'); setTranscript('')
    if (alwaysOnRef.current) setTimeout(() => startQryRef.current(), 200)
  }, [])

  const clearChat = useCallback(() => {
    setMessages([WELCOME]); setLimitReached(false); setTranscript('')
  }, [])

  // ── Chart modal export ────────────────────────────────────────────────────
  const exportChart = useCallback(() => {
    if (!chartDlRef.current) return
    const svg = chartDlRef.current.querySelector('svg')
    if (!svg) return
    const data  = new XMLSerializer().serializeToString(svg)
    const blob  = new Blob([data], { type: 'image/svg+xml' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href      = url
    a.download  = `${chartModal?.title ?? 'chart'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [chartModal])

  // ── Derived ───────────────────────────────────────────────────────────────
  const meta       = STATUS_META[status]
  const isAnimated = status === 'listening' || status === 'speaking'
  const waveColor  = status === 'listening' ? '#00C896' : '#4FA3FF'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden relative">

      {/* ── Neural network background canvas (Task 1) ──────────────────────── */}
      <div className="absolute inset-0 pointer-events-none opacity-60 z-0">
        <NeuralNetworkCanvas
          analyserRef={analyserRef}
          status={status}
          className="w-full h-full"
        />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#1E2D4A] flex-shrink-0 bg-[#0A0F1E]/70 backdrop-blur-sm">
        <div>
          <h1 className="text-lg font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
            AI Voice Assistant
          </h1>
          <p className="text-xs text-[#8A99B3] mt-0.5">
            {noSpeech
              ? 'Voice not supported — try Chrome or Edge'
              : `Hey ${userName} · Tap the mic or enable Always Listening`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceOut(v => !v)}
            title={voiceOut ? 'Mute AI voice' : 'Enable AI voice'}
            className="w-8 h-8 rounded-[4px] flex items-center justify-center text-[#8A99B3] hover:text-[#F0F4FF] hover:bg-[#1E2D4A] transition-colors"
          >
            {voiceOut ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          {!isPro && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#8A99B3] bg-[#0F1729] border border-[#1E2D4A] px-2.5 py-1.5 rounded-[4px]">
              <Zap size={11} className="text-[#2F80ED]" />
              {queriesUsed}/{FREE_LIMIT} today
            </div>
          )}
          {isPro && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#00C896] bg-[#0F1729] border border-[#1E2D4A] px-2.5 py-1.5 rounded-[4px]">
              <Zap size={11} />
              Pro · Unlimited
            </div>
          )}
          <button
            onClick={clearChat}
            title="Clear conversation"
            className="w-8 h-8 rounded-[4px] flex items-center justify-center text-[#8A99B3] hover:text-[#FF4D4D] hover:bg-[#FF4D4D]/10 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-hidden flex flex-col lg:flex-row-reverse">

        {/* ── Status panel ──────────────────────────────────────────────────── */}
        <aside className="lg:w-72 xl:w-80 border-b lg:border-b-0 lg:border-l border-[#1E2D4A] flex lg:flex-col items-center lg:justify-start gap-4 lg:gap-6 px-4 lg:px-6 py-3 lg:py-8 flex-shrink-0 bg-[#0A0F1E]/50 backdrop-blur-sm">

          {/* Status orb */}
          <div className="relative flex items-center justify-center flex-shrink-0">
            {status === 'listening' && (
              <span className="absolute rounded-full animate-ping"
                style={{ width: 88, height: 88, backgroundColor: 'rgba(0,200,150,0.18)' }} />
            )}
            {status === 'thinking' && (
              <span className="absolute rounded-full animate-spin"
                style={{ width: 84, height: 84, border: '2px solid #2F80ED', borderTopColor: 'transparent', borderRightColor: 'rgba(47,128,237,0.4)' }} />
            )}
            <div
              className="relative flex items-center justify-center rounded-full transition-all duration-500"
              style={{ width: 72, height: 72, backgroundColor: meta.bg, boxShadow: meta.glow }}
            >
              {status === 'idle'      && <Mic     size={26} className="text-[#8A99B3]" />}
              {status === 'listening' && <Mic     size={26} className="text-white" />}
              {status === 'thinking'  && <Brain   size={26} className="text-white animate-pulse" />}
              {status === 'speaking'  && <Volume2 size={26} className="text-white" />}
            </div>
          </div>

          {/* Status label + waveform */}
          <div className="flex lg:flex-col items-center gap-3 lg:gap-4">
            <p className="text-xs font-semibold tracking-wide" style={{ color: meta.text }}>
              {meta.label}
            </p>
            <div className="flex items-end gap-1" style={{ height: 28 }}>
              {WAVE_DELAYS.map((delay, i) => (
                <div key={i} className="w-1.5 rounded-full transition-all duration-300"
                  style={{
                    height: isAnimated ? '100%' : '3px',
                    backgroundColor: isAnimated ? waveColor : '#1E2D4A',
                    animation: isAnimated ? `waveform 0.75s ease-in-out ${delay}s infinite alternate` : 'none',
                    transformOrigin: 'bottom',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Live transcript */}
          {transcript && (
            <p className="hidden lg:block text-[11px] text-[#8A99B3] text-center leading-relaxed max-w-[200px] italic">
              &ldquo;{transcript}&rdquo;
            </p>
          )}

          <div className="hidden lg:block flex-1" />

          {/* Always-listening toggle */}
          <div className="lg:w-full lg:border-t lg:border-[#1E2D4A] lg:pt-5">
            <button
              onClick={() => setAlwaysOn(v => !v)}
              disabled={noSpeech}
              className="flex items-center gap-2.5 lg:w-full disabled:opacity-40 group"
            >
              <Radio size={13} className={alwaysOn ? 'text-[#2F80ED]' : 'text-[#8A99B3] group-hover:text-[#F0F4FF]'} />
              <span className="hidden lg:inline text-xs text-[#8A99B3] flex-1 text-left">Always Listening</span>
              {alwaysOn && <span className="w-1.5 h-1.5 rounded-full bg-[#00C896] animate-pulse" />}
              <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${alwaysOn ? 'bg-[#2F80ED]' : 'bg-[#1E2D4A]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${alwaysOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>

          {/* Daily quota bar */}
          {!isPro && (
            <div className="hidden lg:block w-full">
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px] text-[#8A99B3]">Daily queries</span>
                <span className="text-[10px] text-[#8A99B3]">{queriesUsed} / {FREE_LIMIT}</span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: FREE_LIMIT }).map((_, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full transition-colors"
                    style={{ backgroundColor: i < queriesUsed ? '#2F80ED' : '#1E2D4A' }}
                  />
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Chat panel ─────────────────────────────────────────────────────── */}
        <section
          ref={chatRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-3 bg-[#0A0F1E]/30"
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-up`}>
              <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#2F80ED] text-white rounded-[6px] rounded-br-none'
                  : 'bg-[#0F1729]/90 border border-[#1E2D4A] card-glow text-[#F0F4FF] rounded-[6px] rounded-bl-none'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-4 h-4 rounded-full bg-[#2F80ED] flex items-center justify-center flex-shrink-0">
                      <Zap size={9} className="text-white" />
                    </div>
                    <span className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">TradeDesk AI</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p suppressHydrationWarning className="text-[10px] opacity-40 mt-1.5 text-right">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {/* Thinking bubble */}
          {status === 'thinking' && (
            <div className="flex justify-start animate-fade-up">
              <div className="bg-[#0F1729]/90 border border-[#1E2D4A] card-glow rounded-[6px] rounded-bl-none px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-4 h-4 rounded-full bg-[#2F80ED] flex items-center justify-center">
                    <Zap size={9} className="text-white" />
                  </div>
                  <span className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">TradeDesk AI</span>
                </div>
                <div className="flex gap-1.5 items-center py-0.5">
                  {[0, 0.18, 0.36].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-[#2F80ED] animate-bounce"
                      style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Live transcript bubble */}
          {status === 'listening' && transcript && (
            <div className="flex justify-end animate-fade-up">
              <div className="max-w-[85%] sm:max-w-[75%] px-4 py-3 bg-[#2F80ED]/20 border border-[#2F80ED]/40 text-[#F0F4FF] rounded-[6px] rounded-br-none italic text-sm">
                {transcript}
              </div>
            </div>
          )}

          {/* Daily limit card */}
          {limitReached && (
            <div className="mx-auto max-w-xs w-full bg-[#0F1729] border border-[#2F80ED]/40 rounded-[6px] p-5 text-center animate-fade-up">
              <Zap size={22} className="text-[#2F80ED] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#F0F4FF] mb-1">Daily limit reached</p>
              <p className="text-xs text-[#8A99B3] mb-4 leading-relaxed">
                Free users get {FREE_LIMIT} AI queries per day. Upgrade to Pro for unlimited access.
              </p>
              <Link
                href="/pricing"
                className="inline-block text-xs bg-[#2F80ED] hover:bg-[#4FA3FF] text-white px-5 py-2 rounded-[4px] transition-colors font-medium"
              >
                Upgrade to Pro →
              </Link>
            </div>
          )}

          <div ref={bottomRef} className="h-1" />
        </section>
      </div>

      {/* ── Input / control bar ────────────────────────────────────────────── */}
      <div className="relative z-10 flex-shrink-0 border-t border-[#1E2D4A] bg-[#0A0F1E]/80 backdrop-blur-sm">
        {/* Text input row */}
        <form onSubmit={handleTextSend} className="flex items-center gap-2 px-4 sm:px-6 pt-3 pb-2">
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Type a question…"
            disabled={status === 'thinking'}
            className="flex-1 bg-[#0F1729] border border-[#1E2D4A] focus:border-[#2F80ED] text-[#F0F4FF] text-sm px-4 py-2 rounded-[4px] outline-none transition-colors placeholder:text-[#8A99B3] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || status === 'thinking'}
            className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-[4px] transition-colors whitespace-nowrap"
          >
            Send
          </button>
        </form>

        {/* Voice row */}
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 pb-4">
          <button
            onClick={() => setAlwaysOn(v => !v)}
            disabled={noSpeech}
            className="flex items-center gap-2 disabled:opacity-40 group"
          >
            <Radio size={13} className={alwaysOn ? 'text-[#2F80ED]' : 'text-[#8A99B3] group-hover:text-[#F0F4FF]'} />
            <span className="text-xs text-[#8A99B3] group-hover:text-[#F0F4FF] transition-colors">
              Always On {alwaysOn && <span className="text-[#00C896]">· Active</span>}
            </span>
            {alwaysOn && <span className="w-1.5 h-1.5 rounded-full bg-[#00C896] animate-pulse" />}
          </button>

          {/* Central mic button */}
          <button
            onClick={handleMicClick}
            disabled={noSpeech || status === 'thinking'}
            title={status === 'listening' ? 'Stop listening' : 'Tap to speak'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
              status === 'listening'
                ? 'bg-[#00C896] text-white shadow-[0_0_24px_rgba(0,200,150,0.6)]'
                : status === 'speaking'
                ? 'bg-[#4FA3FF]/20 border-2 border-[#4FA3FF] text-[#4FA3FF]'
                : 'bg-[#0F1729] border-2 border-[#1E2D4A] text-[#8A99B3] hover:border-[#2F80ED] hover:text-[#2F80ED]'
            }`}
          >
            {status === 'listening' ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <div className="flex items-center gap-3">
            {status === 'speaking' && (
              <button
                onClick={stopAction}
                className="text-xs px-3 py-1.5 bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 text-[#FF4D4D] rounded-[4px] hover:bg-[#FF4D4D]/20 transition-colors font-medium"
              >
                Stop
              </button>
            )}
            {!isPro && (
              <span className="text-xs text-[#8A99B3]">{queriesUsed}/{FREE_LIMIT}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Chart pop-up modal (Task 2) ─────────────────────────────────────── */}
      {chartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10,15,30,0.85)' }}
          onClick={() => setChartModal(null)}
        >
          <div
            className="modal-in w-full max-w-xl bg-[#0F1729] border border-[#1E2D4A] rounded-[8px] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2D4A]">
              <div className="flex items-center gap-2">
                <BarChart2 size={15} className="text-[#2F80ED]" />
                <span className="text-sm font-semibold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                  {chartModal.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportChart}
                  title="Export as SVG"
                  className="flex items-center gap-1.5 text-[10px] text-[#8A99B3] hover:text-[#4FA3FF] px-2 py-1 rounded-[3px] hover:bg-[#1E2D4A] transition-colors"
                >
                  <Download size={11} />
                  Export
                </button>
                <button
                  onClick={() => setChartModal(null)}
                  className="w-6 h-6 flex items-center justify-center text-[#8A99B3] hover:text-[#FF4D4D] hover:bg-[#FF4D4D]/10 rounded-[3px] transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Chart */}
            <div ref={chartDlRef} className="p-5">
              <ResponsiveContainer width="100%" height={260}>
                {chartModal.chartType === 'bar' ? (
                  <BarChart data={chartModal.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" />
                    <XAxis dataKey="label" tick={{ fill: '#8A99B3', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#8A99B3', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F1729', border: '1px solid #1E2D4A', borderRadius: 4, fontSize: 12 }}
                      labelStyle={{ color: '#8A99B3' }}
                      itemStyle={{ color: '#4FA3FF' }}
                    />
                    <Bar dataKey="value" fill="#2F80ED" radius={[3, 3, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={chartModal.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" />
                    <XAxis dataKey="label" tick={{ fill: '#8A99B3', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#8A99B3', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F1729', border: '1px solid #1E2D4A', borderRadius: 4, fontSize: 12 }}
                      labelStyle={{ color: '#8A99B3' }}
                      itemStyle={{ color: '#4FA3FF' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#2F80ED"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#4FA3FF' }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

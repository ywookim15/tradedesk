'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Mic, MicOff, Volume2, VolumeX, Trash2, Zap, Brain, Radio } from 'lucide-react'
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

// ── Types & constants ─────────────────────────────────────────────────────────
type GeminiContent = { role: 'user' | 'model'; parts: [{ text: string }] }

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function toHistory(msgs: ChatMessage[]): GeminiContent[] {
  return msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }))
}

const FREE_LIMIT = 10
const WAVE_DELAYS = [0, 0.12, 0.24, 0.08, 0.18, 0.04, 0.16]

const STATUS_META: Record<AssistantStatus, { label: string; bg: string; glow: string; text: string }> = {
  idle:      { label: 'Idle',      bg: '#0F1729', glow: 'none',                           text: '#8A99B3' },
  listening: { label: 'Listening', bg: '#00C896', glow: '0 0 32px rgba(0,200,150,0.55)',   text: '#00C896' },
  thinking:  { label: 'Thinking',  bg: '#2F80ED', glow: '0 0 32px rgba(47,128,237,0.55)', text: '#2F80ED' },
  speaking:  { label: 'Speaking',  bg: '#4FA3FF', glow: '0 0 32px rgba(79,163,255,0.55)', text: '#4FA3FF' },
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Hey! I'm your TradeDesk AI assistant. Enable "Always Listening" and say "Hey buddy" to activate me hands-free, or tap the mic button to speak directly. I'll give you real-time market data, technical reads, and trading analysis on demand.`,
  timestamp: new Date(),
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

  // Refs — stable access inside async callbacks / event handlers
  const messagesRef  = useRef(messages)
  const statusRef    = useRef<AssistantStatus>('idle')
  const alwaysOnRef  = useRef(false)
  const voiceOutRef  = useRef(true)
  const queriesRef   = useRef(initQ)
  const voiceRef     = useRef<SpeechSynthesisVoice | null>(null)
  const wakeRef      = useRef<SRInstance | null>(null)
  const queryRef     = useRef<SRInstance | null>(null)
  const startWakeRef = useRef<() => void>(() => {})
  const startQryRef  = useRef<() => void>(() => {})
  const sendMsgRef   = useRef<(t: string) => void>(() => {})
  const isMounted    = useRef(true)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const chatRef      = useRef<HTMLDivElement>(null)

  // Sync refs
  useEffect(() => { messagesRef.current = messages    }, [messages])
  useEffect(() => { statusRef.current   = status      }, [status])
  useEffect(() => { alwaysOnRef.current = alwaysOn    }, [alwaysOn])
  useEffect(() => { voiceOutRef.current = voiceOut    }, [voiceOut])
  useEffect(() => { queriesRef.current  = queriesUsed }, [queriesUsed])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, transcript])


  // Cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false
      wakeRef.current?.abort()
      queryRef.current?.abort()
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    }
  }, [])

  // Load voices + check SR support
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!makeSR()) setNoSpeech(true)
    const load = () => {
      const vs = speechSynthesis.getVoices()
      voiceRef.current =
        vs.find(v => /samantha|karen|victoria|moira|ava|nicky|zira|google uk english female/i.test(v.name)) ??
        vs.find(v => v.lang.startsWith('en')) ??
        vs[0] ?? null
    }
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // ── speak ──────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!voiceOutRef.current || typeof speechSynthesis === 'undefined') return
    speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    if (voiceRef.current) utt.voice = voiceRef.current
    utt.rate = 0.95; utt.pitch = 1.05
    utt.onstart = () => { if (isMounted.current) setStatus('speaking') }
    utt.onend   = () => {
      if (!isMounted.current) return
      setStatus('idle')
      if (alwaysOnRef.current) startWakeRef.current()
    }
    utt.onerror = () => { if (isMounted.current) setStatus('idle') }
    speechSynthesis.speak(utt)
  }, [])

  // ── sendMessage ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || statusRef.current === 'thinking') return
    if (!isPro && queriesRef.current >= FREE_LIMIT) { setLimitReached(true); return }

    const historyForApi = toHistory(messagesRef.current.filter(m => m.id !== 'welcome'))

    if (!isMounted.current) return
    setMessages(prev => [...prev, { id: uid(), role: 'user', content: trimmed, timestamp: new Date() }])
    setTranscript('')
    setStatus('thinking')

    try {
      const res = await fetch('/api/ai/chat', {
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

    } catch {
      if (!isMounted.current) return
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant',
        content: 'Network error — check your connection and try again.',
        timestamp: new Date(),
      }])
      setStatus('idle')
    }
  }, [isPro, speak])

  useEffect(() => { sendMsgRef.current = sendMessage }, [sendMessage])

  // ── Voice recognition (stable, runs once, all state via refs) ─────────────
  useEffect(() => {
    function startQuery() {
      const sr = makeSR()
      if (!sr) return
      queryRef.current?.abort()
      if (!isMounted.current) return
      setStatus('listening')
      setTranscript('')
      let final = ''

      sr.continuous = false; sr.interimResults = true; sr.lang = 'en-US'

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
        const query = final.trim().replace(/^hey\s+buddy[,.]?\s*/i, '').trim()
        if (query) {
          sendMsgRef.current(query)
        } else {
          setStatus('idle'); setTranscript('')
          if (alwaysOnRef.current) setTimeout(() => startWakeRef.current(), 200)
        }
      }

      sr.onerror = (e) => {
        queryRef.current = null
        if (e.error !== 'aborted' && isMounted.current) {
          setStatus('idle'); setTranscript('')
          if (alwaysOnRef.current) setTimeout(() => startWakeRef.current(), 500)
        }
      }

      try { sr.start(); queryRef.current = sr } catch { /* permission denied */ }
    }

    function startWake() {
      if (statusRef.current !== 'idle') return
      const sr = makeSR()
      if (!sr) return
      wakeRef.current?.abort()

      sr.continuous = true; sr.interimResults = true; sr.lang = 'en-US'

      sr.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i][0].transcript.toLowerCase().includes('hey buddy')) {
            sr.abort(); wakeRef.current = null
            startQryRef.current()
            return
          }
        }
      }

      sr.onend = () => {
        wakeRef.current = null
        if (alwaysOnRef.current && statusRef.current === 'idle') {
          setTimeout(() => startWakeRef.current(), 200)
        }
      }

      sr.onerror = (e) => {
        wakeRef.current = null
        if (e.error !== 'aborted') {
          setTimeout(() => {
            if (alwaysOnRef.current && statusRef.current === 'idle') startWakeRef.current()
          }, 1500)
        }
      }

      try { sr.start(); wakeRef.current = sr } catch { /* permission denied */ }
    }

    startQryRef.current  = startQuery
    startWakeRef.current = startWake

    return () => { wakeRef.current?.abort(); queryRef.current?.abort() }
  }, []) // empty deps — reads all mutable state via refs

  // Start/stop wake-word detection when toggle changes
  useEffect(() => {
    if (alwaysOn && statusRef.current === 'idle') {
      startWakeRef.current()
    } else if (!alwaysOn) {
      wakeRef.current?.abort(); wakeRef.current = null
    }
  }, [alwaysOn])

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleMicClick = useCallback(() => {
    if (status === 'listening') {
      queryRef.current?.abort(); queryRef.current = null
      setStatus('idle'); setTranscript('')
      if (alwaysOnRef.current) startWakeRef.current()
    } else if (status === 'idle' || status === 'speaking') {
      speechSynthesis?.cancel()
      startQryRef.current()
    }
  }, [status])

  const stopAction = useCallback(() => {
    speechSynthesis?.cancel()
    queryRef.current?.abort(); queryRef.current = null
    setStatus('idle'); setTranscript('')
    if (alwaysOnRef.current) setTimeout(() => startWakeRef.current(), 200)
  }, [])

  const clearChat = useCallback(() => {
    setMessages([WELCOME]); setLimitReached(false); setTranscript('')
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const meta       = STATUS_META[status]
  const isAnimated = status === 'listening' || status === 'speaking'
  const waveColor  = status === 'listening' ? '#00C896' : '#4FA3FF'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#1E2D4A] flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
            AI Voice Assistant
          </h1>
          <p className="text-xs text-[#8A99B3] mt-0.5">
            {noSpeech
              ? 'Voice not supported in this browser — try Chrome or Edge'
              : `Hey ${userName} · Say "Hey buddy" or tap the mic`}
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

      {/* ── Body: chat (left) + status (right) ───────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row-reverse">

        {/* ── Status panel (right on desktop, top strip on mobile) ────────── */}
        <aside className="lg:w-72 xl:w-80 border-b lg:border-b-0 lg:border-l border-[#1E2D4A] flex lg:flex-col items-center lg:justify-start gap-4 lg:gap-6 px-4 lg:px-6 py-3 lg:py-8 flex-shrink-0">

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

          {/* Status label + waveform (horizontal on mobile, vertical on desktop) */}
          <div className="flex lg:flex-col items-center gap-3 lg:gap-4">
            <p className="text-xs font-semibold tracking-wide" style={{ color: meta.text }}>
              {meta.label}
            </p>
            {/* Waveform bars */}
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

          {/* Live transcript (desktop only) */}
          {transcript && (
            <p className="hidden lg:block text-[11px] text-[#8A99B3] text-center leading-relaxed max-w-[200px] italic">
              &ldquo;{transcript}&rdquo;
            </p>
          )}

          {/* Spacer (desktop) */}
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
              {/* Toggle pill */}
              <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${alwaysOn ? 'bg-[#2F80ED]' : 'bg-[#1E2D4A]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${alwaysOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>

          {/* Query quota bar (desktop) */}
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

        {/* ── Chat panel ────────────────────────────────────────────────────── */}
        <section ref={chatRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-3">

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-up`}>
              <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#2F80ED] text-white rounded-[6px] rounded-br-none'
                  : 'bg-[#0F1729] border border-[#1E2D4A] card-glow text-[#F0F4FF] rounded-[6px] rounded-bl-none'
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
              <div className="bg-[#0F1729] border border-[#1E2D4A] card-glow rounded-[6px] rounded-bl-none px-4 py-3">
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

      {/* ── Voice control bar ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[#1E2D4A] px-4 sm:px-6 py-4 bg-[#0A0F1E]">
        <div className="flex items-center justify-between gap-4">

          {/* Always-listening toggle (left) */}
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
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
              status === 'listening'
                ? 'bg-[#00C896] text-white shadow-[0_0_24px_rgba(0,200,150,0.6)]'
                : status === 'speaking'
                ? 'bg-[#4FA3FF]/20 border-2 border-[#4FA3FF] text-[#4FA3FF]'
                : 'bg-[#0F1729] border-2 border-[#1E2D4A] text-[#8A99B3] hover:border-[#2F80ED] hover:text-[#2F80ED]'
            }`}
          >
            {status === 'listening' ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Right: stop speaking / query count */}
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
    </div>
  )
}

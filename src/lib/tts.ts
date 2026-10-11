/* Speech: real voice clips cut from the class videos when one exists, otherwise speech synthesis.
   Sentences of the master texts and vocabulary words have recordings (src/data/voice.json). Lookup is
   by normalised text, so any call that speaks one of those exact texts (text page, vocab, grammar
   examples quoted from the text…) gets the human voice. */
import voice from '../data/voice.json';
import { UNITS } from './course';
import { h, ic } from './dom';
import { Bus, Settings } from './store';
import { kataToHira, plain, speechText } from './text';
import { toast } from './toast';

const VOICE = voice as unknown as { text: Record<string, Record<string, string>>; vocab: Record<string, string> };

const vnorm = (s: unknown) => kataToHira(String(s || '').normalize('NFKC')).replace(/[\s、。，．,.!！?？「」『』（）()…・〜～]/g, '');
let VMAP: Record<string, string> | null = null;
function voiceMap() {
  if (VMAP) return VMAP;
  const m: Record<string, string> = {};
  UNITS.forEach((u) => {
    const t = VOICE.text[u.id] || {};
    let k = 0;
    u.sections.forEach((sec) => sec.paragraphs.forEach((p) => p.forEach((s) => {
      const f = t[k]; k++;
      if (!f) return;
      m[vnorm(speechText(s.jp))] = f;
      m[vnorm(plain(s.jp))] = f;
    })));
    u.vocab.forEach((v) => {
      const f = VOICE.vocab[v.id];
      if (!f) return;
      m[vnorm(v.kana.replace(/[～〜]/g, ''))] = f;
      if (v.kanji) m[vnorm(v.kanji.replace(/[～〜]/g, ''))] = f;
    });
  });
  return (VMAP = m);
}
const clipFor = (text: string) => (Settings.get('realVoice') === false ? null : voiceMap()[vnorm(text)] || null);

export interface SpeakOpts { rate?: number }

const hasSynth = typeof window !== 'undefined' && 'speechSynthesis' in window;

export const TTS = {
  ok: hasSynth,
  voices: [] as SpeechSynthesisVoice[],
  voice: null as SpeechSynthesisVoice | null,
  warned: false,
  cur: null as SpeechSynthesisUtterance | null,
  audio: null as HTMLAudioElement | null,
  clipFor,
  hasClip: (text: string) => !!clipFor(text),
  clipCount() {
    return { text: Object.values(VOICE.text).reduce((s, x) => s + Object.keys(x).length, 0), vocab: Object.keys(VOICE.vocab).length };
  },
  /** play a recorded clip; resolves when it ends (or fails → falls back to synthesis) */
  playClip(url: string, text: string, opts?: SpeakOpts): Promise<void> {
    return new Promise((resolve) => {
      this.stop();
      const a = this.audio || (this.audio = new Audio());
      a.preload = 'auto';
      let done = false;
      const fail = () => { if (done) return; done = true; a.onended = a.onerror = null; this.synth(text, opts).then(resolve); };
      a.onended = () => { if (!done) { done = true; a.onended = a.onerror = null; resolve(); } };
      a.onerror = fail;
      a.src = url;
      // recordings play at natural speed unless the reader picked a speed on the text page
      a.playbackRate = (opts && opts.rate) || Settings.get('clipRate') || 1;
      try { a.preservesPitch = true; } catch (e) { /* older engines */ }
      const pr = a.play();
      if (pr && pr.catch) pr.catch(fail);
    });
  },
  init() {
    if (!this.ok) return;
    const load = () => {
      this.voices = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
      this.pick();
      Bus.emit('voices', this.voices);
    };
    load();
    try { speechSynthesis.addEventListener('voiceschanged', load); } catch (e) { speechSynthesis.onvoiceschanged = load; }
  },
  pick() {
    const pref = Settings.get('voice');
    const order = [/Nanami/i, /Google/i, /Keita/i, /Haruka/i, /Ayumi/i, /Kyoko/i, /Otoya/i, /Ichiro/i, /Sayaka/i];
    this.voice = this.voices.find((v) => v.name === pref) || null;
    if (!this.voice) for (const re of order) { this.voice = this.voices.find((v) => re.test(v.name)) || null; if (this.voice) break; }
    if (!this.voice) this.voice = this.voices[0] || null;
  },
  speak(text: string, opts?: SpeakOpts): Promise<void> {
    const clip = clipFor(text);
    if (clip) return this.playClip(clip, text, opts || {});
    return this.synth(text, opts);
  },
  synth(text: string, opts?: SpeakOpts): Promise<void> {
    const o = opts || {};
    return new Promise((resolve) => {
      if (!this.ok) { this.warn(); resolve(); return; }
      if (!this.voices.length) { this.voices = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang)); this.pick(); }
      if (!this.voice && !this.warned) this.warn();
      this.stopClip();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'ja-JP';
      if (this.voice) u.voice = this.voice;
      u.rate = o.rate || Settings.get('rate') || 0.9;
      let done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      u.onend = fin; u.onerror = fin;
      this.cur = u;
      speechSynthesis.speak(u);
      // safety net: some engines never fire onend
      setTimeout(fin, 1500 + String(text).length * 450 / (u.rate || 1));
    });
  },
  stopClip() { if (this.audio) { const a = this.audio; a.pause(); if (a.onended) a.onended(new Event('ended')); } },
  stop() { this.stopClip(); if (this.ok) speechSynthesis.cancel(); },
  warn() {
    this.warned = true;
    toast('Máy chưa có giọng đọc tiếng Nhật — hãy mở bằng Microsoft Edge.', 5000);
  },
};

/** a small speaker button */
export const speakBtn = (text: string, title?: string) => h('button', {
  class: 'speak', title: title || 'Nghe', type: 'button', 'aria-label': title || 'Nghe',
  onclick: (e: Event) => { e.stopPropagation(); TTS.speak(text); },
}, ic('volume'));

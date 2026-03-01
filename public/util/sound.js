// speech recognition
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const LANGUAGE_STORAGE_KEY = "scat6.language";
const DEFAULT_LANGUAGE_CODE = "en";
const DEFAULT_SPEECH_LOCALE = "en-US";
const LANGUAGE_TO_LOCALE = {
  en: "en-US",
  dk: "da-DK",
  da: "da-DK",
};

function getSelectedLanguageCode() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && typeof stored === "string") return stored.toLowerCase();
  } catch {}
  const htmlLang =
    document?.documentElement?.lang?.trim?.().toLowerCase?.() ?? "";
  return htmlLang || DEFAULT_LANGUAGE_CODE;
}

function resolveSpeechLocale(lang) {
  if (lang && typeof lang === "string") return lang;
  const selected = getSelectedLanguageCode();
  if (selected.includes("-")) return selected;
  return LANGUAGE_TO_LOCALE[selected] ?? DEFAULT_SPEECH_LOCALE;
}

let listening = false;
const handlers = [];
export function startListening(onResult) {
  if (onResult) {
    handlers.push(onResult);
  }

  if (listening) {
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.lang = resolveSpeechLocale();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.start();
  listening = recognition;

  recognition.addEventListener("result", (e) => {
    const message = e.results[e.results.length - 1][0].transcript;
    console.log("Heard:", message);
    for (const handler of handlers) {
      handler(message);
    }
  });
  recognition.addEventListener("end", () => {
    if (listening) {
      console.log("Restarting speech recognition");
      recognition.start();
    }
  });
}
export function abortListening() {
  if (listening) {
    const recognition = listening;
    listening = false;
    recognition.abort();
  }
}
export function stopListening() {
  if (listening) {
    const recognition = listening;
    listening = false;
    return recognition.stop();
  }
}
export async function listenOnce() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = resolveSpeechLocale();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.start();

  return await new Promise((resolve) => {
    recognition.addEventListener("result", (e) => {
      const message = e.results[0][0].transcript;
      resolve(message);
    });
  });
}

// speech synthesis
window.lastAbort = 0;
const synth = window.speechSynthesis;
function getBestVoiceForLocale(locale) {
  const voices = synth.getVoices();
  if (!voices?.length) return null;
  const target = locale.toLowerCase();
  const exact = voices.find((voice) => voice.lang?.toLowerCase() === target);
  if (exact) return exact;
  const prefix = target.split("-")[0];
  return (
    voices.find((voice) => voice.lang?.toLowerCase()?.startsWith(prefix)) ??
    null
  );
}

export function speak(text, lang, cancelPrevious = true) {
  if (cancelPrevious && isSpeaking()) {
    abortSpeaking();
  }
  const locale = resolveSpeechLocale(lang);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  const voice = getBestVoiceForLocale(locale);
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}
window.speak = speak;
export function isSpeaking() {
  return synth.speaking;
}
export function abortSpeaking() {
  window.lastAbort = Date.now();
  synth.cancel();
}
window.abortSpeaking = abortSpeaking;

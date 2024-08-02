// speech recognition
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

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
  recognition.lang = "en-US";
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
  recognition.lang = "en-US";
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
const synth = window.speechSynthesis;
export function speak(text, lang = "en-US") {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  synth.speak(utterance);
}
window.speak = speak;
export function isSpeaking() {
  return synth.speaking;
}
export function abortSpeaking() {
  synth.cancel();
}

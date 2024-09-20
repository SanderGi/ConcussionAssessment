import { tests, syncData, connectUser } from "./userData.js";
import { confirmAthleteInfo } from "./util/popup.js";
import { abortSpeaking, isSpeaking, speak } from "./util/sound.js";

// ============================ Session/Local Storage Keys ============================
const TEST_PHASE = "test-phase";
const TEST = "test";

// ============================ Getters ============================
export function getTest() {
  const test = JSON.parse(sessionStorage.getItem(TEST)) ?? {};
  return test;
}
window.getTest = getTest;

export function getAthleteName() {
  const test = getTest();
  const athlete_name = test?.athlete_name ?? "Athlete";
  return athlete_name;
}

export function getChecked(classname) {
  return [...document.getElementsByClassName(classname)]
    .filter((el) => el.checked)
    .map((el) => el.parentElement.textContent);
}
window.getChecked = getChecked;

export function getRadioInt(name) {
  return parseInt(
    document.querySelector('input[name="' + name + '"]:checked')?.value
  );
}
window.getRadioInt = getRadioInt;

// ============================ Components ============================
export function startCountdown(button, seconds) {
  const originalText = button.textContent;
  const originalOnClick = button.onclick;
  button.disabled = true;
  button.textContent = `${seconds} seconds left`;
  button.classList.add("button--red");
  button.classList.remove("button--green");
  if (window.countdownAudioEnabled) speak(seconds);
  const interval = setInterval(() => {
    seconds--;
    button.textContent = `${seconds} seconds left`;
    if (seconds <= 0) {
      clearInterval(interval);
      button.classList.remove("button--red");
      button.classList.add("button--green");
      button.textContent = originalText;
      button.onclick = originalOnClick;
      if (window.countdownAudioEnabled) speak("Time is up");
    } else {
      if (window.countdownAudioEnabled) speak(seconds);
    }
  }, 1000);
  button.disabled = false;
  button.onclick = () => {
    clearInterval(interval);
    button.classList.remove("button--red");
    button.classList.add("button--green");
    button.textContent = originalText;
    button.onclick = originalOnClick;
    if (window.countdownAudioEnabled) speak("Countdown canceled");
  };
}
window.startCountdown = startCountdown;

export async function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export async function readListOneWPS(list, startDelay = 0) {
  const lastAbort = window.lastAbort;
  if (startDelay > 0) {
    while (isSpeaking()) await wait(0.1);
    await wait(startDelay);
  }
  for (const word of list) {
    await wait(1);
    while (isSpeaking()) await wait(0.1);
    if (window.lastAbort > lastAbort) return;
    speak(word, "en-US", false);
  }
}
window.readListOneWPS = readListOneWPS;

window.countdownAudioEnabled =
  localStorage.getItem("countdownAudioEnabled") === "true";
for (const btn of document.getElementsByClassName("countdown-audio")) {
  const icon = btn.querySelector('i[class*="fa-volume"]');
  btn.onclick = () => {
    if (icon.classList.contains("fa-volume-high")) {
      disableCountdownAudio(btn, icon);
    } else {
      enableCountdownAudio(btn, icon);
    }
  };
  if (window.countdownAudioEnabled) {
    enableCountdownAudio(btn, icon);
  } else {
    disableCountdownAudio(btn, icon);
  }
}
function enableCountdownAudio(btn, icon) {
  icon.classList.remove("fa-volume-xmark");
  icon.classList.add("fa-volume-high");
  btn.classList.remove("button--red");
  btn.classList.add("button--green");
  window.countdownAudioEnabled = true;
  localStorage.setItem("countdownAudioEnabled", "true");
}
function disableCountdownAudio(btn, icon) {
  icon.classList.remove("fa-volume-high");
  icon.classList.add("fa-volume-xmark");
  btn.classList.add("button--red");
  btn.classList.remove("button--green");
  window.countdownAudioEnabled = false;
  localStorage.setItem("countdownAudioEnabled", "false");
}

// ============================ Manage Test ============================
export function renderCurrentTestSection() {
  renderTestSection(sessionStorage.getItem(TEST_PHASE) ?? "test-management");
}

export function renderTestSection(test) {
  sessionStorage.setItem(TEST_PHASE, test);
  for (const section of document.querySelectorAll("main")) {
    section.style.display = "none";
  }
  document.getElementById(test).style.display = "flex";

  document.dispatchEvent(
    new CustomEvent("renderTestSection", { detail: test })
  );
}
window.renderTestSection = renderTestSection;

export async function saveTestResult(key, value) {
  const test = getTest();
  if (value !== test[key]) {
    test[key] = value;
    test.test_updated_at = Date.now();
    tests[test.test_id] = test;
    sessionStorage.setItem(TEST, JSON.stringify(test));
    await syncData();
  }
}
window.saveTestResult = saveTestResult;

export async function endTest() {
  const test = getTest();
  if (test.test_id) {
    tests[test.test_id] = test;
    await syncData();
  }
  renderTestSection("test-management");
  sessionStorage.removeItem(TEST);
  sessionStorage.removeItem(TEST_PHASE);
}
window.endTest = endTest;

export function viewResults(test) {
  sessionStorage.setItem(TEST, JSON.stringify(test));
  renderTestSection("results");
}

export async function startTest(pastTests) {
  let defaultExaminerName = "";
  const user = await connectUser();
  if (user) {
    defaultExaminerName = user.name;
  }
  if (Object.keys(tests).length > 0) {
    defaultExaminerName = Object.values(tests)[0].examiner_name;
  }
  const test = await confirmAthleteInfo(pastTests, defaultExaminerName);
  if (!test) return;

  sessionStorage.setItem(TEST, JSON.stringify(test));

  if (test.test_type === "IMMEDIATE") {
    renderTestSection("red-flags");
  } else if (test.test_type === "BASELINE") {
    renderTestSection("symptom-evaluation-baseline");
  } else if (test.test_type === "SUSPECTED/POST") {
    renderTestSection("symptom-evaluation-post");
  } else if (test.test_type === "NO-TEST") {
    tests[test.test_id] = test;
    await syncData();
  } else {
    throw new Error("Invalid test type: " + test.test_type);
  }
}

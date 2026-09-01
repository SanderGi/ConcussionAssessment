import { tests, syncData, connectUser, saveLocalTests } from "./userData.js";
import { confirm, confirmAthleteInfo } from "./util/popup.js";
import { abortSpeaking, isSpeaking, speak } from "./util/sound.js";
import { uploadTest } from "./util/googleForm.js";
import { isPostInjuryTestType } from "./util/testType.js";

const t = (key, fallback) => window.__scat6T?.(key, fallback) ?? fallback;
const tf = (key, vars, fallback) =>
  window.__scat6Format?.(key, vars, fallback) ??
  fallback.replace(/\{\{(\w+)\}\}/g, (_, token) => vars?.[token] ?? "");

// ============================ Session/Local Storage Keys ============================
const TEST_PHASE = "test-phase";
const TEST_PHASE_HISTORY = "test-phase-history";
const TEST = "test";
const NON_TEST_PHASES = new Set(["test-management", "results"]);
const visitedTestPhases = new Set();

function iconControlLabel(element) {
  if (element.classList.contains("fa-volume-high")) return "Read instructions aloud";
  if (element.classList.contains("fa-circle-check")) return "Mark response correct";
  if (element.classList.contains("fa-circle-xmark")) return "Mark response incorrect";
  if (element.classList.contains("fa-pen-to-square")) return "Edit response numbers";
  if (element.classList.contains("fa-rotate-right")) return "Redo trial";
  return null;
}

export function enhanceKeyboardControls(root = document) {
  const selector = [
    "[data-keyboard-control]",
    "i[onclick]",
    "i[data-action]",
    "#digit-sets i.fa-circle-check",
    "#digit-sets i.fa-circle-xmark",
  ].join(",");
  const controls = root.matches?.(selector)
    ? [root, ...root.querySelectorAll(selector)]
    : [...root.querySelectorAll(selector)];
  for (const control of controls) {
    if (control.dataset.keyboardEnabled === "true") continue;
    control.dataset.keyboardEnabled = "true";
    control.tabIndex = 0;
    if (!control.hasAttribute("role")) control.setAttribute("role", "button");
    const label = iconControlLabel(control);
    if (label && !control.hasAttribute("aria-label")) {
      control.setAttribute("aria-label", label);
    }
    control.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      control.click();
    });
  }
}
window.enhanceKeyboardControls = enhanceKeyboardControls;

enhanceKeyboardControls();
new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) enhanceKeyboardControls(node);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

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
    .map(
      (el) => el.parentElement.dataset.value || el.parentElement.textContent
    );
}
window.getChecked = getChecked;

export function getRadioInt(name) {
  return parseInt(
    document.querySelector('input[name="' + name + '"]:checked')?.value
  );
}
window.getRadioInt = getRadioInt;

// ============================ Components ============================
let cancelActiveCountdown = null;
export function startCountdown(button, seconds) {
  cancelActiveCountdown?.();
  const originalText = button.textContent;
  const originalOnClick = button.onclick;
  button.disabled = true;
  button.textContent = tf(
    "runtime.timer.seconds_left",
    { seconds },
    "{{seconds}} seconds left"
  );
  button.classList.add("button--red");
  button.classList.remove("button--green");
  if (window.countdownAudioEnabled) speak(seconds);
  const resetCountdown = (message = null) => {
    clearInterval(interval);
    button.classList.remove("button--red");
    button.classList.add("button--green");
    button.textContent = originalText;
    button.onclick = originalOnClick;
    if (cancelActiveCountdown === resetCountdown) cancelActiveCountdown = null;
    if (message && window.countdownAudioEnabled) speak(message);
  };
  const interval = setInterval(() => {
    seconds--;
    button.textContent = tf(
      "runtime.timer.seconds_left",
      { seconds },
      "{{seconds}} seconds left"
    );
    if (seconds <= 0) {
      resetCountdown(t("runtime.timer.time_up", "Time is up"));
    } else {
      if (window.countdownAudioEnabled) speak(seconds);
    }
  }, 1000);
  button.disabled = false;
  button.onclick = () => {
    resetCountdown(
      t("runtime.timer.countdown_canceled", "Countdown canceled")
    );
  };
  cancelActiveCountdown = resetCountdown;
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
    speak(word, undefined, false);
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
function getSessionArray(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function setSessionArray(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function resetTestNavigation() {
  sessionStorage.removeItem(TEST_PHASE_HISTORY);
  visitedTestPhases.clear();
}

function updateBackButtons() {
  const canGoBack = getSessionArray(TEST_PHASE_HISTORY).length > 0;
  for (const button of document.querySelectorAll(
    ".test-navigation-button--back"
  )) {
    button.disabled = !canGoBack;
  }
}

function setupTestNavigationControls() {
  for (const section of document.querySelectorAll("main")) {
    if (NON_TEST_PHASES.has(section.id)) continue;

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className =
      "button test-navigation-button test-navigation-button--back";
    backButton.setAttribute("aria-label", "Go back to the previous screen");
    backButton.title = "Back";
    backButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
    backButton.addEventListener("click", goBackTestSection);

    const exitButton = document.createElement("button");
    exitButton.type = "button";
    exitButton.className =
      "button button--red test-navigation-button test-navigation-button--exit";
    exitButton.setAttribute("aria-label", "Exit assessment");
    exitButton.title = "Exit assessment";
    exitButton.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i>';
    exitButton.addEventListener("click", async () => {
      const shouldExit = await confirm(
        "Exit this assessment and return to the main menu? Values on the current screen that have not been submitted will be lost."
      );
      if (shouldExit) await endTest();
    });

    section.append(backButton, exitButton);
  }
  updateBackButtons();
}

export function renderCurrentTestSection() {
  renderTestSection(sessionStorage.getItem(TEST_PHASE) ?? "test-management", {
    forceInitialize: true,
    trackHistory: false,
  });
}

export function renderTestSection(
  test,
  { forceInitialize = false, navigation = "forward", trackHistory = true } = {}
) {
  const target = document.getElementById(test);
  if (!target) {
    console.error(`Unknown test section: ${test}`);
    return false;
  }

  const current = sessionStorage.getItem(TEST_PHASE);
  if (current && current !== test) {
    cancelActiveCountdown?.();
    abortSpeaking();
    document.dispatchEvent(
      new CustomEvent("beforeRenderTestSection", {
        detail: { from: current, to: test, navigation },
      })
    );
  }

  if (
    trackHistory &&
    current &&
    current !== test &&
    !NON_TEST_PHASES.has(current)
  ) {
    const history = getSessionArray(TEST_PHASE_HISTORY);
    if (history.at(-1) !== current) history.push(current);
    setSessionArray(TEST_PHASE_HISTORY, history);
  }

  const isRevisit = visitedTestPhases.has(test) && !forceInitialize;
  if (!NON_TEST_PHASES.has(test)) visitedTestPhases.add(test);

  sessionStorage.setItem(TEST_PHASE, test);
  for (const section of document.querySelectorAll("main")) {
    section.style.display = "none";
  }
  target.style.display = "flex";
  window.scrollTo(0, 0);
  updateBackButtons();

  document.dispatchEvent(
    new CustomEvent(
      isRevisit && !NON_TEST_PHASES.has(test)
        ? "resumeTestSection"
        : "renderTestSection",
      { detail: test }
    )
  );
  return true;
}
window.renderTestSection = renderTestSection;

export function goBackTestSection() {
  const history = getSessionArray(TEST_PHASE_HISTORY);
  const current = sessionStorage.getItem(TEST_PHASE);
  let previous = null;
  while (history.length > 0 && !previous) {
    const candidate = history.pop();
    if (
      candidate !== current &&
      !NON_TEST_PHASES.has(candidate) &&
      document.getElementById(candidate)
    ) {
      previous = candidate;
    }
  }
  setSessionArray(TEST_PHASE_HISTORY, history);
  if (!previous) {
    updateBackButtons();
    return false;
  }
  return renderTestSection(previous, {
    navigation: "back",
    trackHistory: false,
  });
}
window.goBackTestSection = goBackTestSection;

setupTestNavigationControls();

export function saveTestResult(key, value) {
  const test = getTest();
  if (value !== test[key]) {
    test[key] = value;
    test.test_updated_at = Date.now();
    tests[test.test_id] = test;
    sessionStorage.setItem(TEST, JSON.stringify(test));
    saveLocalTests();
    const sync = syncData();
    sync.catch((err) => console.error("Background sync failed:", err));
    return sync;
  }
  return Promise.resolve();
}
window.saveTestResult = saveTestResult;

export async function endTest() {
  renderTestSection("test-management", { trackHistory: false });
  await shareTestData();
  sessionStorage.removeItem(TEST);
  sessionStorage.removeItem(TEST_PHASE);
  resetTestNavigation();
}
window.endTest = endTest;

export function viewResults(test) {
  resetTestNavigation();
  sessionStorage.setItem(TEST, JSON.stringify(test));
  renderTestSection("results", { trackHistory: false });
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
  resetTestNavigation();

  if (test.test_type === "IMMEDIATE") {
    renderTestSection("red-flags");
  } else if (test.test_type === "BASELINE") {
    renderTestSection("symptom-evaluation-baseline");
  } else if (isPostInjuryTestType(test.test_type)) {
    renderTestSection("symptom-evaluation-post");
  } else if (test.test_type === "NO-TEST") {
    tests[test.test_id] = test;
    await syncData();
  } else {
    throw new Error("Invalid test type: " + test.test_type);
  }
}

export async function shareTestData(overwrite_as_permissible = null) {
  const test = getTest();
  if (overwrite_as_permissible === null && !test.permission_to_upload) return;
  if (overwrite_as_permissible === false) {
    for (const t of Object.values(tests)) {
      t.permission_to_upload = false;
      tests[t.test_id] = t;
    }
    sessionStorage.setItem(TEST, JSON.stringify(tests[test.test_id]));
    await syncData();
    return;
  }
  for (const t of Object.values(tests)) {
    if (t.athlete_id === "deleted") {
      continue;
    }
    const uploaded_already = t.uploaded_timestamp >= t.test_updated_at;
    if (!uploaded_already || !t.permission_to_upload) {
      t.test_updated_at = Date.now();
      t.permission_to_upload = true;
      tests[t.test_id] = t;
    }
    if (uploaded_already) continue;
    const uploadedVersion = t.test_updated_at;
    await uploadTest({
      test_id: t.test_id,
      test_created_at: t.test_created_at,
      test_updated_at: t.test_updated_at,
      test_type: t.test_type,
      examiner_name_hash: Array.from(
        new Uint8Array(
          await window.crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(t.examiner_name)
          )
        )
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      athlete_id: t.athlete_id,
      athlete_birth_timestamp: t.athlete_birth_timestamp,
      athlete_sex: t.athlete_sex,
      athlete_dominant_hand: t.athlete_dominant_hand,
      athlete_year_in_school: t.athlete_year_in_school,
      athlete_years_of_education: t.athlete_years_of_education,
      athlete_first_language: t.athlete_first_language,
      athlete_preferred_language: t.athlete_preferred_language,
      injury_timestamp: t.injury_timestamp,
      num_past_concussions: t.num_past_concussions,
      most_recent_concussion_timestamp: t.most_recent_concussion_timestamp,
      most_recent_recovery_time_days: t.most_recent_recovery_time_days,
      primary_symptoms: t.primary_symptoms,
      primary_symptoms_other: t.primary_symptoms_other,
      hospitalized_for_head_injury: t.hospitalized_for_head_injury,
      diagnosed_headache_disorder_or_migraine:
        t.diagnosed_headache_disorder_or_migraine,
      diagnosed_learning_disability_or_dyslexia:
        t.diagnosed_learning_disability_or_dyslexia,
      diagnosed_attention_deficit_disorder:
        t.diagnosed_attention_deficit_disorder,
      diagnosed_psychological_disorder: t.diagnosed_psychological_disorder,
      current_medications: t.current_medications,
      notes: t.notes,
      red_flags: t.red_flags,
      observable_signs_source: t.observable_signs_source,
      observable_signs: t.observable_signs,
      glasgow_coma_scale: t.glasgow_coma_scale,
      glasgow_e: t.glasgow_e,
      glasgow_v: t.glasgow_v,
      glasgow_m: t.glasgow_m,
      cervical_spine: t.cervical_spine,
      coordination: t.coordination,
      coordination_abnomalities: t.coordination_abnomalities,
      maddocks_score: t.maddocks_score,
      symptom_number: t.symptom_number,
      symptom_severity: t.symptom_severity,
      symptom_scores: t.symptom_scores,
      symptoms_worse_with_physical: t.symptoms_worse_with_physical,
      symptoms_worse_with_mental: t.symptoms_worse_with_mental,
      symptoms_percentage_normal: t.symptoms_percentage_normal,
      symptoms_description: t.symptoms_description,
      orientation: t.orientation,
      immediate_memory: t.immediate_memory,
      immediate_memory_timestamp: t.immediate_memory_timestamp,
      immediate_memory_score_by_trial_by_word:
        t.immediate_memory_score_by_trial_by_word,
      concentration: t.concentration,
      concentration_digit_list: t.concentration_digit_list,
      concentration_digits: t.concentration_digits,
      concentration_months: t.concentration_months,
      concentration_months_time_sec: t.concentration_months_time_sec,
      cognitive_total: t.cognitive_total,
      mBESS_pose_error_photos: t.mBESS_pose_error_photos,
      mBESS_double_errors: t.mBESS_double_errors,
      mBESS_single_errors: t.mBESS_single_errors,
      mBESS_tandem_errors: t.mBESS_tandem_errors,
      mBESS_total_errors: t.mBESS_total_errors,
      mBESS_foam_double_errors: t.mBESS_foam_double_errors,
      mBESS_foam_single_errors: t.mBESS_foam_single_errors,
      mBESS_foam_tandem_errors: t.mBESS_foam_tandem_errors,
      mBESS_foam_total_errors: t.mBESS_foam_total_errors,
      tandem_gait_fastest_time: t.tandem_gait_fastest_time,
      tandem_gait_average_time: t.tandem_gait_average_time,
      tandem_gait_times_by_trial: t.tandem_gait_times_by_trial,
      dual_task_fastest_time: t.dual_task_fastest_time,
      dual_task_accuracy: t.dual_task_accuracy,
      dual_task_starting_integer: t.dual_task_starting_integer,
      delayed_recall_by_word: t.delayed_recall_by_word,
      delayed_recall: t.delayed_recall,
      delayed_recall_timestamp: t.delayed_recall_timestamp,
      different_from_usual: t.different_from_usual,
      decision: t.decision,
      test_notes: t.test_notes,
      signed: t.signed,
      signed_timestamp: t.signed_timestamp,
      title_or_specialty: t.title_or_specialty,
    });
    t.uploaded_timestamp = uploadedVersion;
    tests[t.test_id] = t;
  }
  sessionStorage.setItem(TEST, JSON.stringify(tests[test.test_id]));
  await syncData();
}
window.shareTestData = shareTestData;
document.onvisibilitychange = async () => {
  if (
    document.visibilityState === "hidden" &&
    sessionStorage.getItem(TEST) !== null
  ) {
    await shareTestData();
  }
};

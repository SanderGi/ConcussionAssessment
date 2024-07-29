import { tests, syncData, connectUser } from "./userData.js";
import { confirmAthleteInfo } from "./util/popup.js";

// ============================ Session/Local Storage Keys ============================
const TEST_PHASE = "test-phase";
const TEST = "test";

// ============================ Getters ============================
export function getTest() {
  const test = JSON.parse(sessionStorage.getItem(TEST));
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
  test[key] = value;
  tests[test.test_id] = test;
  sessionStorage.setItem(TEST, JSON.stringify(test));
  await syncData();
}
window.saveTestResult = saveTestResult;

export function endTest() {
  const test = getTest();
  tests[test.test_id] = test;
  sessionStorage.removeItem(TEST);
  sessionStorage.removeItem(TEST_PHASE);
  renderTestSection("test-management");
}
window.endTest = endTest;

export async function startTest(pastTests) {
  let defaultExaminerName = "William Brown";
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

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  alert,
  confirm,
  prompt,
  syncSettings,
  confirmAthleteInfo,
} from "./popup.js";
import {
  putAppDataFile,
  deleteAppDataFile,
  getAppDataFile,
} from "./appData.js";
const Chart = window.Chart;

// ============================ Feature Detection ============================
if (!window.crypto?.subtle) {
  alert(
    "Your browser does not support the Web Cryptography API. Please use a different browser."
  );
}

// ============================ Data Syncing Logic ============================
const firebaseConfig = {
  apiKey: "AIzaSyBOXpDbVaCLdbecVBxCUks4ifTDQF9BnTw",
  authDomain: "scat6-web.firebaseapp.com",
  projectId: "scat6-web",
  appId: "1:535942499060:web:996d268dcdeb684d5a2ca1",
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
auth.useDeviceLanguage();

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/drive.appdata");

let _user = null;
async function connectUser() {
  if (localStorage.getItem("synced") !== "true") {
    return null;
  }

  const saved = _user ?? JSON.parse(sessionStorage.getItem("_user") ?? "null");
  if (saved && saved.expiration > Date.now() / 1000 + 60 * 5) {
    _user = saved;
    return _user;
  }

  let signinResult;
  try {
    signinResult = await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error(err);
    await alert(
      "This device is synced with your Google Drive. Please sign in to confirm your identity."
    );
    signinResult = await signInWithPopup(auth, googleProvider);
  }
  const credential = GoogleAuthProvider.credentialFromResult(signinResult);

  const name = signinResult.user.displayName;
  const email = signinResult.user.email;

  _user = {
    name,
    email,
    picture: signinResult.user.photoURL,
    uid: signinResult.user.uid,
    credential,
    lastSignIn: signinResult.user.metadata.lastSignInTime,
    expiration: JSON.parse(atob(credential.idToken.split(".")[1])).exp,
  };

  sessionStorage.setItem("_user", JSON.stringify(_user));

  return _user;
}

async function disconnectUser() {
  await auth.signOut();
  localStorage.removeItem("synced");
  sessionStorage.removeItem("_user");
  location.reload();
}

async function clearLocalData() {
  await auth.signOut();
  localStorage.clear();
  sessionStorage.clear();
  location.reload();
}

async function deleteRemoteData() {
  const user = await connectUser();
  if (!user) return;

  try {
    await deleteAppDataFile(user);
  } catch (err) {
    console.error(err);
    await alert(
      "Failed to delete GDrive data. Please try re-syncing this device."
    );
  }
}

async function syncData() {
  const user = await connectUser();
  if (!user) return;

  const remoteData = await getAppDataFile(user);
  for (const [key, value] of Object.entries(remoteData)) {
    _tests[key] = value;
  }

  localStorage.setItem("lastSync", new Date().toUTCString());

  let changed = false;
  for (const key of Object.keys(_tests)) {
    if (!(key in remoteData)) {
      changed = true;
      break;
    }
  }
  if (!changed) return;

  await putAppDataFile(_tests, user);
}

/**
 * @typedef {Object} Test
 * @property {string} test_id
 * @property {number} test_timestamp
 * @property {'IMMEDIATE' | 'BASELINE' | 'SUSPECTED'} test_type
 * @property {string} athlete_id
 * @property {string} athlete_name
 * @property {number} athlete_birth_timestamp
 * @property {string} athlete_sex
 * @property {string} athlete_dominant_hand
 * @property {string} examiner_name
 * @property {string} team_or_school
 * @property {number} injury_timestamp
 * @property {number} num_past_concussions
 * @property {number} most_recent_concussion_timestamp
 * @property {number} most_recent_recovery_time_days
 * @property {string} primary_symptoms
 *
 * @property {boolean} hospitalized_for_head_injury
 * @property {boolean} diagnosed_headache_disorder_or_migraine
 * @property {boolean} diagnosed_learning_disability_or_dyslexia
 * @property {boolean} diagnosed_attention_deficit_disorder
 * @property {boolean} diagnosed_psychological_disorder
 * @property {string} current_medications
 * @property {string} notes
 *
 * @property {"YES" | "NO"} [red_flags] whether red flags are present
 * @property {"WITNESSED" | "VIDEO" | "NO"} [observable_signs] how/if the injury was observed
 * @property {number} [glasgow_coma_scale] out of 15
 * @property {number} [maddocks_score] out of 5
 * @property {number} [symptom_number] out of 22
 * @property {number} [symptom_severity] out of 132
 * @property {number} [orientation] out of 5
 * @property {number} [immediate_memory] out of 30
 * @property {number} [concentration] out of 5
 * @property {number} [delayed_Recall] out of 10
 * @property {number} [cognitive_total] out of 50 (sum of orientation, immediate_memory, concentration, delayed_recall)
 * @property {number} [mBESS_total_errors] out of 30
 * @property {number} [tandem_gait_fastest_time] in seconds
 * @property {number} [dual_task_fastest_time] in seconds
 */
/** @type {Record<string, Test>} */
const _tests = JSON.parse(localStorage.getItem("tests") ?? "{}");
/** @type {Record<string, Test>} */
const $tests = new Proxy(_tests, {
  set: (target, key, value) => {
    target[key] = value;
    localStorage.setItem("tests", JSON.stringify(target));
    syncData();
    computeAthletes();
    return true;
  },
  deleteProperty: (target, key) => {
    delete target[key];
    localStorage.setItem("tests", JSON.stringify(target));
    syncData();
    computeAthletes();
    return true;
  },
});
/** @type {Record<string, Test[]>} */
const athletes = {}; // will be populated on load
function computeAthletes() {
  // clear athletes
  for (const athlete of Object.keys(athletes)) {
    delete athletes[athlete];
  }

  // group tests by athlete id
  for (const [key, value] of Object.entries($tests)) {
    if (value.athlete_id in athletes) {
      athletes[value.athlete_id].push(key);
    } else {
      athletes[value.athlete_id] = [key];
    }
  }
  // sort by timestamp ascending
  for (const athlete of Object.values(athletes)) {
    athlete.sort((a, b) => $tests[a].test_timestamp - $tests[b].test_timestamp);
  }
}

// ============================ UI Elements ============================
const deleteAllButton = document.getElementById("delete-all-button");
const syncButton = document.getElementById("sync-button");
const searchInput = document.getElementById("search-input");
const athleteNumSelect = document.getElementById("number-of-athletes");
const addAthleteButton = document.getElementById("add-athlete-button");

deleteAllButton.onclick = async () => {
  if (await confirm("Are you sure you want to delete all data?")) {
    await deleteRemoteData();
    await clearLocalData();
  }
};

function showConnected(user) {
  if (user) {
    syncButton.innerHTML = `Synced &nbsp; <img style="width: 1em; height: 1em; border-radius: 50%; margin: auto" src="${user.picture}">`;
    syncButton.classList.add("button--green");
  } else {
    syncButton.innerHTML =
      'Sync &nbsp; <i class="fa-brands fa-google-drive"></i>';
    syncButton.classList.remove("button--green");
  }
}

syncButton.onclick = async () => {
  let user = await connectUser();
  let action = "SYNC";
  if (user) {
    const { name, email, lastSignIn } = user;

    action = await syncSettings(
      name,
      email,
      `Last confirmed identity on ${lastSignIn} <br><br> Last synced on ${localStorage.getItem(
        "lastSync"
      )}`
    );
  } else {
    localStorage.setItem("synced", "true");
    user = await connectUser();
  }

  if (action === "UNLINK") {
    if (
      await confirm(
        "This will delete all data from this device but keep it on your GDrive. Are you sure?"
      )
    ) {
      await clearLocalData();
    }
  } else if (action === "DELETE_DRIVE") {
    if (
      await confirm(
        "This will delete all data from your GDrive but keep it on this device. Are you sure?"
      )
    ) {
      await deleteRemoteData();
      await disconnectUser();
    }
  } else {
    try {
      await syncData();
      showConnected(user);
    } catch (err) {
      console.error(err);
      await alert(
        "Failed to sync data. Make sure you checked the box to give the app permission to add app data to your Google Drive."
      );
      await disconnectUser();
    }
  }
};

window.renderTestSection = (test) => {
  sessionStorage.setItem("test-phase", test);
  for (const section of document.querySelectorAll("main")) {
    section.style.display = "none";
  }
  document.getElementById(test).style.display = "flex";

  document.dispatchEvent(
    new CustomEvent("renderTestSection", { detail: test })
  );
};

window.saveTestResult = (key, value) => {
  const test = JSON.parse(sessionStorage.getItem("test"));
  test[key] = value;
  $tests[test.test_id] = test;
  sessionStorage.setItem("test", JSON.stringify(test));
};

window.endTest = () => {
  const test = JSON.parse(sessionStorage.getItem("test"));
  $tests[test.test_id] = test;
  sessionStorage.removeItem("test");
  sessionStorage.removeItem("test-phase");
  renderTestSection("test-management");
  showAthletes();
};

async function startTest(pastTests) {
  let defaultExaminerName = "William Brown";
  const user = await connectUser();
  if (user) {
    defaultExaminerName = user.name;
  }
  if (Object.keys($tests).length > 0) {
    defaultExaminerName = Object.values($tests)[0].examiner_name;
  }
  const test = await confirmAthleteInfo(pastTests, defaultExaminerName);
  if (!test) return;

  sessionStorage.setItem("test", JSON.stringify(test));

  if (test.test_type === "IMMEDIATE") {
    renderTestSection("red-flags");
  } else if (test.test_type === "BASELINE") {
    renderTestSection("symptom-evaluation-baseline");
  } else if (test.test_type === "SUSPECTED/POST") {
    renderTestSection("symptom-evaluation-post");
  } else if (test.test_type === "NO-TEST") {
    $tests[test.test_id] = test;
  } else {
    throw new Error("Invalid test type: " + test.test_type);
  }
}

addAthleteButton.onclick = async () => {
  await startTest([]);
  showAthletes();
};

function showAthlete(athlete_id) {
  /** @type {Test} */
  const athlete = $tests[athletes[athlete_id].at(-1)];
  const container = document.getElementById("athletes");

  const section = document.createElement("section");
  section.id = "athlete-" + athlete_id;
  section.className = "athlete";
  section.innerHTML = /*html*/ `
    <div class="left-align spread-inline">
        ${athlete.athlete_name} (${athlete_id.split("-")[0]})
        <div>
            <button class="button" onclick="testAthlete('${athlete_id}')">Test &nbsp; <i class="fa-solid fa-flask-vial"></i></button>
            <button class="button" onclick="showAthleteResults('${athlete_id}')">Results &nbsp; <i class="fa-solid fa-clipboard-list"></i></button>
            <button class="button button--red" onclick="deleteAthlete('${athlete_id}')">Delete &nbsp; <i class="fa-solid fa-trash"></i></button>
        </div>
    </div>
  `;
  container.appendChild(section);
}

function showAthletes() {
  const container = document.getElementById("athletes");
  container.innerHTML = "";

  const athleteIds = Object.keys(athletes);
  athleteIds.sort((a, b) => {
    const athleteA = $tests[athletes[a].at(-1)];
    const athleteB = $tests[athletes[b].at(-1)];
    const similarityA = calcSimilarity(
      athleteA.athlete_name,
      searchInput.value
    );
    const similarityB = calcSimilarity(
      athleteB.athlete_name,
      searchInput.value
    );
    return similarityB - similarityA;
  });

  for (
    let i = 0;
    i < Math.min(athleteNumSelect.value, athleteIds.length);
    i++
  ) {
    showAthlete(athleteIds[i]);
  }
}

searchInput.oninput = showAthletes;
athleteNumSelect.oninput = showAthletes;

window.testAthlete = async (athlete_id) => {
  const athlete = athletes[athlete_id];
  if (!athlete) return;

  const tests = athlete.map((key) => $tests[key]);
  await startTest(tests);
};

window.deleteAthlete = async (athlete_id) => {
  if (await confirm("Are you sure you want to delete this athlete's data?")) {
    for (const test of athletes[athlete_id]) {
      delete $tests[test];
    }
    document.getElementById("athlete-" + athlete_id).remove();
  }
};

window.showAthleteResults = async (athlete_id) => {
  const container = document.getElementById("athlete-" + athlete_id);
  let canvas = container.querySelector("canvas");
  if (container.querySelector("canvas")) {
    canvas.remove();
    return;
  }

  const athlete = athletes[athlete_id];
  if (!athlete) return;

  /** @type {Test[]} */
  const tests = athlete.map((key) => $tests[key]);

  canvas = document.createElement("canvas");
  document.getElementById("athlete-" + athlete_id).appendChild(canvas);
  new Chart(canvas, {
    type: "line",
    data: {
      labels: tests.map((test) => new Date(test.test_timestamp).toDateString()),
      datasets: [
        {
          label: "Glasgow Coma Scale (X/15)",
          data: tests.map((test) => test.glasgow_coma_scale),
        },
        {
          label: "Maddocks Score (X/5)",
          data: tests.map((test) => test.maddocks_score),
        },
        {
          label: "Symptom Number (X/22)",
          data: tests.map((test) => test.symptom_number),
        },
        {
          label: "Symptom Severity (X/132)",
          data: tests.map((test) => test.symptom_severity),
        },
        {
          label: "Orientation (X/5)",
          data: tests.map((test) => test.orientation),
          hidden: true,
        },
        {
          label: "Immediate Memory (X/30)",
          data: tests.map((test) => test.immediate_memory),
          hidden: true,
        },
        {
          label: "Concentration (X/5)",
          data: tests.map((test) => test.concentration),
          hidden: true,
        },
        {
          label: "Delayed Recall (X/10)",
          data: tests.map((test) => test.delayed_recall),
          hidden: true,
        },
        {
          label: "Cognitive Total (X/50)",
          data: tests.map((test) => test.cognitive_total),
        },
        {
          label: "mBESS Total Errors (X/30)",
          data: tests.map((test) => test.mBESS_total_errors),
        },
        {
          label: "Tandem Gait Fastest Time",
          data: tests.map((test) => test.tandem_gait_fastest_time),
        },
        {
          label: "Dual Task Fastest Time",
          data: tests.map((test) => test.dual_task_fastest_time),
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(255, 255, 255, 0.3)",
          },
        },
        x: {
          grid: {
            color: "rgba(255, 255, 255, 0.3)",
          },
        },
      },
      xAxis: {
        type: "time",
      },
      plugins: {
        tooltip: {
          callbacks: {
            afterTitle: (items) => tests[items[0].dataIndex].test_type,
          },
        },
      },
    },
  });
};

// ============================ Setup on Load ============================
window.onload = async () => {
  if (sessionStorage.getItem("test-phase")) {
    renderTestSection(sessionStorage.getItem("test-phase"));
  }

  const user = await connectUser();
  showConnected(user);
  await syncData();
  computeAthletes();
  showAthletes();
};

// ============================ Search Logic ============================
/**
 * Calculates the similatity between two strings.
 * @param {string} str1 the first sctring to compare
 * @param {string} str2 the second string to compare
 * @returns the negated Levenshtein Distance between the two strings but normalized for the string lengths.
 */
export function calcSimilarity(str1, str2) {
  return -LevenshteinDistance(str1, str2) / Math.max(str1.length, str2.length);
}

/**
 * Calculates the Levenshtein Distance between two strings using the iterative matrix algorithm.
 * @param {string} str1 the first sctring to compare
 * @param {string} str2 the second string to compare
 * @returns the Levenshtein Distance between the two strings.
 */
function LevenshteinDistance(str1, str2) {
  let matrix = Array(str1.length + 1)
    .fill()
    .map(() => Array(str2.length + 1).fill(0));

  for (let i = 1; i <= str1.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 1; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      let subcost = str1.charAt(i) === str2.charAt(j) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + subcost
      );
    }
  }

  return matrix[str1.length][str2.length];
}

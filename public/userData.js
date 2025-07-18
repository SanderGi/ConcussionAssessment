import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  setAppDataFile,
  deleteAppDataFile,
  getAppDataFile,
} from "./util/gdrive.js";
import { alert } from "./util/popup.js";

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

// ============================ Session/Local Storage Keys ============================
const LASTSYNC = "lastSync"; // UTC String of last sync time
const TESTS = "tests"; // Local copy of tests data
const SYNCED = "synced"; // "true" iff the device is synced with GDrive
const USER = "user"; // User data from Google Auth
const KEY = "key"; // Key for encrypting/decrypting data

// ============================ Connect/Disconnect ============================
let _user = null;
export async function connectUser() {
  if (localStorage.getItem(SYNCED) !== "true") {
    return null;
  }

  const saved = _user ?? JSON.parse(sessionStorage.getItem(USER) ?? "null");
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
    accessToken: credential.accessToken,
    lastSignIn: signinResult.user.metadata.lastSignInTime,
    expiration: JSON.parse(atob(credential.idToken.split(".")[1])).exp,
  };

  sessionStorage.setItem(USER, JSON.stringify(_user));

  return _user;
}

export async function disconnectUser() {
  await auth.signOut();
  localStorage.removeItem(SYNCED);
  localStorage.removeItem(LASTSYNC);
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(USER);
  location.reload();
}

// ============================ Remote Data ============================
// we encrypt the data to be prepared to store it somewhere else in the future and only keep the key in GDrive
const KEY_FILE = "key.json";
const DATA_FILE = "data.json";

async function getKey(user) {
  let key = null;
  let file =
    JSON.parse(localStorage.getItem(KEY) ?? "null") ??
    (await getAppDataFile(user.accessToken, KEY_FILE));
  if (file) {
    // file already exists, parse it
    const algorithm = {
      name: file.algorithm.name,
      iv: Uint8Array.from(file.algorithm.iv),
    };
    const aes256key = await window.crypto.subtle.importKey(
      "jwk",
      file.key,
      algorithm,
      true,
      ["encrypt", "decrypt"]
    );
    key = { algorithm, aes256key };
  } else {
    // file does not exist, create a new key and file
    file = {};
    const encryptionType = "AES-GCM";
    const aes256key = await window.crypto.subtle.generateKey(
      {
        name: encryptionType,
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
    const algorithm = {
      name: encryptionType,
      iv: window.crypto.getRandomValues(new Uint8Array(96)),
    };
    file.algorithm = {
      name: encryptionType,
      iv: Array.from(algorithm.iv),
    };
    file.key = await window.crypto.subtle.exportKey("jwk", aes256key);
    await setAppDataFile(file, user.accessToken, KEY_FILE);
    key = { algorithm, aes256key };
  }

  localStorage.setItem(KEY, JSON.stringify(file));
  return key;
}

async function getRemoteData() {
  const user = await connectUser();
  if (!user) return null;

  const { algorithm, aes256key } = await getKey(user);
  const data = await getAppDataFile(user.accessToken, DATA_FILE);
  if (!data) return null;

  const decrypted = await window.crypto.subtle.decrypt(
    algorithm,
    aes256key,
    Uint8Array.from(data).buffer
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function setRemoteData(data) {
  const user = await connectUser();
  if (!user) throw new Error("User not connected.");

  const { algorithm, aes256key } = await getKey(user);
  const encrypted = await window.crypto.subtle.encrypt(
    algorithm,
    aes256key,
    new TextEncoder().encode(JSON.stringify(data))
  );
  await setAppDataFile(
    Array.from(new Uint8Array(encrypted)),
    user.accessToken,
    DATA_FILE
  );
}

export async function deleteRemoteData() {
  const user = await connectUser();
  if (!user) return;

  try {
    await deleteAppDataFile(user.accessToken, KEY_FILE);
    await deleteAppDataFile(user.accessToken, DATA_FILE);
  } catch (err) {
    console.error(err);
    await alert(
      "Failed to delete GDrive data. Please try re-syncing this device."
    );
  }
}

// ============================ Data Syncing Logic ============================
/**
 * @typedef {Object} Test
 * @property {string} test_id
 * @property {number} test_created_at
 * @property {number} test_updated_at
 * @property {'IMMEDIATE' | 'BASELINE' | 'SUSPECTED'} test_type
 * @property {string} athlete_id
 * @property {string} athlete_name
 * @property {number} athlete_birth_timestamp
 * @property {string} athlete_sex
 * @property {'Left' | 'Right' | 'Ambidextrous'} athlete_dominant_hand
 * @property {number} athlete_year_in_school
 * @property {number} athlete_years_of_education
 * @property {string} athlete_first_language
 * @property {string} athlete_preferred_language
 * @property {string} examiner_name
 * @property {string} team_or_school
 * @property {number} injury_timestamp
 * @property {number} num_past_concussions
 * @property {number} most_recent_concussion_timestamp
 * @property {number} most_recent_recovery_time_days
 * @property {string} primary_symptoms
 * @property {string} primary_symptoms_other
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
 * @property {"WITNESSED" | "VIDEO" | "NO"} [observable_signs_source] how/if the injury was observed
 * @property {string[]} [observable_signs] the list of observed signs
 * @property {number} [glasgow_coma_scale] out of 15
 * @property {'1' | '2' | '3' | '4'} [glasgow_e] best eye response
 * @property {'1' | '2' | '3' | '4' | '5'} [glasgow_v] best verbal response
 * @property {'1' | '2' | '3' | '4' | '5' | '6'} [glasgow_m] best motor response
 * @property {number} [glasgow_timestamp] Date.now() when glasgow was completed
 * @property {string[]} [cervical_spine] the list of checked cervical spine prompts
 * @property {string[]} [coordination] the list of checked coordination prompts
 * @property {string} [coordination_abnomalities] description of any coordination and ocular/motor abnormalities
 * @property {string[]} [maddocks] list of correctly answered maddocks questions
 * @property {number} [maddocks_score] out of 5
 * @property {number} [symptom_number] out of 22
 * @property {number} [symptom_severity] out of 132
 * @property {number[]} [symptom_scores] 22 scores each from 0-6 inclusive representing each symptom
 * @property {boolean} [symptoms_worse_with_physical] true if symptoms get worse with physical activity
 * @property {boolean} [symptoms_worse_with_mental] true if symptoms get worse with mental activity
 * @property {number} [symptoms_percentage_normal] how normal the athlete feels out of 100 (where 100 is perfectly normal)
 * @property {string} [symptoms_description] if not 100% normal, description of how the athlete feels
 * @property {string[]} [orientation_correct] list of correctly answered orientation questions
 * @property {number} [orientation] out of 5
 * @property {number} [immediate_memory] out of 30
 * @property {string[]} [immediate_memory_words] list of 10 words used for immediate memory test
 * @property {number} [immediate_memory_timestamp] Date.now() when immediate memory was completed
 * @property {boolean[][]} [immediate_memory_score_by_trial_by_word] arr[trial_n][word_ix] is true iff word_ix was correct in trial trial_n
 * @property {number} [concentration] out of 5
 * @property {'A' | 'B' | 'C'} [concentration_digit_list] which of the three official SCAT6 digit lists is used
 * @property {boolean[][]} [concentration_digits] arr[row][attempt] true iff correct, false iff incorrect, and undefined iff not attempted
 * @property {boolean[]} [concentration_months] arr[month] correct
 * @property {number} [concentration_months_time_sec] number of seconds used on concentration reverse months task
 * @property {number} [cognitive_total] out of 50 (sum of orientation, immediate_memory, concentration, delayed_recall)
 * @property {object} [mBESS_pose_error_photos] maps test field like `mBESS_double_errors` to error photo list [{ error: "error description", photo: "photo url"}]
 * @property {number} [mBESS_double_errors] out of 10
 * @property {number} [mBESS_single_errors] out of 10
 * @property {number} [mBESS_tandem_errors] out of 10
 * @property {number} [mBESS_total_errors] out of 30
 * @property {number} [mBESS_foam_double_errors] out of 10
 * @property {number} [mBESS_foam_single_errors] out of 10
 * @property {number} [mBESS_foam_tandem_errors] out of 10
 * @property {number} [mBESS_foam_total_errors] out of 30
 * @property {number} [tandem_gait_fastest_time] in seconds
 * @property {number} [tandem_gait_average_time] in seconds
 * @property {number[]} [tandem_gait_times_by_trial] in seconds
 * @property {number} [dual_task_fastest_time] in seconds
 * @property {number} [dual_task_accuracy] in percent of correct responses
 * @property {number} [dual_task_starting_integer] starting number for the fastest time
 * @property {boolean[]} [delayed_recall_by_word] arr[i] is true iff word i was recalled correctly
 * @property {number} [delayed_recall] out of 10
 * @property {number} [delayed_recall_timestamp] Date.now() when delayed recall was started
 * @property {"YES" | "NO" | "N/A"} [different_from_usual] if examiner knows the athlete, are they acting different from their usual self
 * @property {"YES" | "NO" | "DEFERRED"} [decision] the decision made by the examiner, yes for concussion, no for healthy
 * @property {string} [test_notes] clinical notes regarding the test
 * @property {boolean} [signed] whether the test was signed by the examiner
 * @property {number} [signed_timestamp] Date.now() when the test was signed
 * @property {string} [title_or_specialty] the title or specialty of the examiner
 * @property {string} [registration_or_license_number] the examiner's registration or license number (if applicable)
 *
 * @property {boolean} [permission_to_upload] true iff the health professional has given permission to upload tests
 * @property {boolean} [uploaded] true iff the test has been uploaded
 */
/** @type {Record<string, Test>} */
export const tests = JSON.parse(localStorage.getItem(TESTS) ?? "{}");

/** @type {Record<string, Test[]>} */
export const athletes = {}; // will be populated on load
function computeAthletes() {
  // clear athletes
  for (const athlete of Object.keys(athletes)) {
    delete athletes[athlete];
  }

  // group tests by athlete id
  for (const [key, value] of Object.entries(tests)) {
    if (value.athlete_id === "deleted") {
      continue;
    }
    if (value.athlete_id in athletes) {
      athletes[value.athlete_id].push(key);
    } else {
      athletes[value.athlete_id] = [key];
    }
  }

  // sort by timestamp ascending
  for (const athlete of Object.values(athletes)) {
    athlete.sort((a, b) => tests[a].test_created_at - tests[b].test_created_at);
  }
}

export async function clearLocalData() {
  localStorage.clear();
  sessionStorage.clear();
  await auth.signOut();
  location.reload();
}

export async function syncData() {
  // merge remote data with local data
  const remoteData = (await getRemoteData()) ?? {};
  for (const [key, value] of Object.entries(remoteData)) {
    const updated_at = value.test_updated_at;
    const existing_updated_at = tests[key]?.test_updated_at;
    if (!existing_updated_at || existing_updated_at < updated_at) {
      tests[key] = value;
    }
  }
  computeAthletes();

  // save data
  localStorage.setItem(LASTSYNC, new Date().toUTCString());
  localStorage.setItem(TESTS, JSON.stringify(tests));

  if (await connectUser()) {
    await setRemoteData(tests);
  }
}

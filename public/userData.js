import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  setAppDataFile,
  deleteAllAppDataFiles,
  getAppDataFileCandidates,
  selectAppDataFile,
} from "./util/gdrive.js";
import {
  clearWorkspaceCache,
  getActiveWorkspaceState,
  getWorkspaceData,
  isWorkspaceApiAvailable,
  setWorkspaceData,
} from "./util/workspace.js";
import { syncNonWorkspaceAnalyticsState } from "./util/analytics.js";
import {
  createDriveBundle,
  createKeyFile,
  decryptJSON,
  encryptJSON,
  importKeyFile,
  isDriveBundle,
} from "./util/encryption.js";
import { alert, select } from "./util/popup.js";
import {
  mergeTestsByUpdatedAt,
  parseStoredTests,
} from "./util/testStore.js";

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
const TESTS_RESET_AT = "testsResetAt"; // Deliberate local dataset replacement

// ============================ Connect/Disconnect ============================
let _user = null;
function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export async function connectUser() {
  if (localStorage.getItem(SYNCED) !== "true") {
    return null;
  }

  const saved = _user ?? JSON.parse(sessionStorage.getItem(USER) ?? "null");
  if (saved && saved.idToken && saved.expiration > Date.now() / 1000 + 60 * 5) {
    _user = saved;
    return _user;
  }

  let signinResult;
  try {
    signinResult = await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error(err);
    const action = await select(
      "This device is synced with your Google Drive. Please sign in to confirm your identity.",
      [
        ["SIGN_IN", "Sign In"],
        ["DISCONNECT", "Disconnect This Device", "button--red"],
      ]
    );
    if (action === "DISCONNECT") {
      await disconnectUser();
      return null;
    }
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
    idToken: credential.idToken,
    accessToken: credential.accessToken,
    lastSignIn: signinResult.user.metadata.lastSignInTime,
    expiration: decodeJwtPayload(credential.idToken)?.exp ?? 0,
  };

  sessionStorage.setItem(USER, JSON.stringify(_user));

  return _user;
}

export async function disconnectUser() {
  await auth.signOut();
  clearWorkspaceCache();
  localStorage.removeItem(SYNCED);
  localStorage.removeItem(LASTSYNC);
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(USER);
  location.reload();
}

// ============================ Remote Data ============================
// SECURITY TODO: the key and ciphertext intentionally remain together in the
// SCAT6 Drive bundle to make updates atomic and recover old mismatched files.
// This is only obfuscation against accidental disclosure, not confidentiality;
// move key material outside Google Drive when real encryption is implemented.
const KEY_FILE = "key.json";
const DATA_FILE = "data.json";
const BUNDLE_FILE = "scat6-data.json";

export class DriveDataDecryptionError extends Error {
  constructor() {
    super(
      "SCAT6 Drive data could not be decrypted. The app data may be corrupted."
    );
    this.name = "DriveDataDecryptionError";
    this.code = "DRIVE_DATA_CORRUPT";
  }
}

let activeDriveKey = null;

async function tryDecrypt(data, keyFile) {
  const key = await importKeyFile(keyFile, window.crypto);
  return { data: await decryptJSON(data, key, window.crypto), key };
}

async function recoverDriveState(user) {
  const recovered = {};
  let preferred = null;
  let encryptedDataExists = false;

  const bundles = await getAppDataFileCandidates(
    user.accessToken,
    BUNDLE_FILE
  );
  encryptedDataExists ||= bundles.length > 0;
  for (const candidate of bundles) {
    if (!isDriveBundle(candidate.data)) continue;
    try {
      const decrypted = await tryDecrypt(
        candidate.data.data,
        candidate.data.key
      );
      mergeTestsByUpdatedAt(recovered, decrypted.data);
      preferred ??= {
        keyFile: candidate.data.key,
        key: decrypted.key,
        fileId: candidate.id,
      };
    } catch {
      // Try every self-contained duplicate before declaring corruption.
    }
  }
  if (preferred) {
    selectAppDataFile(BUNDLE_FILE, preferred.fileId);
    activeDriveKey = { uid: user.uid, ...preferred };
    return { data: recovered, ...preferred };
  }

  const [keyCandidates, dataCandidates] = await Promise.all([
    getAppDataFileCandidates(user.accessToken, KEY_FILE),
    getAppDataFileCandidates(user.accessToken, DATA_FILE),
  ]);
  encryptedDataExists ||= dataCandidates.length > 0;
  for (const dataCandidate of dataCandidates) {
    for (const keyCandidate of keyCandidates) {
      try {
        const decrypted = await tryDecrypt(
          dataCandidate.data,
          keyCandidate.data
        );
        mergeTestsByUpdatedAt(recovered, decrypted.data);
        preferred ??= {
          keyFile: keyCandidate.data,
          key: decrypted.key,
          keyFileId: keyCandidate.id,
          dataFileId: dataCandidate.id,
        };
        break;
      } catch {
        // Duplicate files from old concurrent syncs may not be matching pairs.
      }
    }
  }
  if (preferred) {
    selectAppDataFile(KEY_FILE, preferred.keyFileId);
    selectAppDataFile(DATA_FILE, preferred.dataFileId);
    activeDriveKey = { uid: user.uid, ...preferred };
    return { data: recovered, ...preferred };
  }

  if (encryptedDataExists) throw new DriveDataDecryptionError();

  for (const keyCandidate of keyCandidates) {
    try {
      const key = await importKeyFile(keyCandidate.data, window.crypto);
      activeDriveKey = {
        uid: user.uid,
        keyFile: keyCandidate.data,
        key,
        keyFileId: keyCandidate.id,
      };
      return { data: null, ...activeDriveKey };
    } catch {
      // Ignore malformed orphaned keys and generate a replacement below.
    }
  }

  const generated = await createKeyFile(window.crypto);
  activeDriveKey = { uid: user.uid, keyFile: generated.file, key: generated.key };
  return { data: null, ...activeDriveKey };
}

async function getRemoteData() {
  const user = await connectUser();
  if (!user) return null;

  return (await recoverDriveState(user)).data;
}

async function setRemoteData(data) {
  const user = await connectUser();
  if (!user) throw new Error("User not connected.");

  if (!activeDriveKey || activeDriveKey.uid !== user.uid) {
    await recoverDriveState(user);
  }
  const encrypted = await encryptJSON(data, activeDriveKey.key, window.crypto);
  await setAppDataFile(
    createDriveBundle(activeDriveKey.keyFile, encrypted),
    user.accessToken,
    BUNDLE_FILE
  );
}

export async function deleteRemoteData() {
  const user = await connectUser();
  if (!user) return;

  try {
    await Promise.all([
      deleteAllAppDataFiles(user.accessToken, BUNDLE_FILE),
      deleteAllAppDataFiles(user.accessToken, KEY_FILE),
      deleteAllAppDataFiles(user.accessToken, DATA_FILE),
    ]);
    activeDriveKey = null;
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
 * @property {'IMMEDIATE' | 'BASELINE' | 'SUSPECTED/POST' | 'POST-INJURY' | 'SUSPECTED' | 'NO-TEST'} test_type
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
 * @property {number} [uploaded_timestamp] timestamp of most recent upload if any
 */
/** @type {Record<string, Test>} */
export const tests = parseStoredTests(localStorage.getItem(TESTS));
let observedTestsResetAt = Number(localStorage.getItem(TESTS_RESET_AT) ?? 0);

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

function replaceTestsInMemory(nextTests) {
  for (const key of Object.keys(tests)) delete tests[key];
  Object.assign(tests, nextTests ?? {});
}

export function saveLocalTests() {
  const storedResetAt = Number(localStorage.getItem(TESTS_RESET_AT) ?? 0);
  if (storedResetAt > observedTestsResetAt) {
    replaceTestsInMemory({});
    observedTestsResetAt = storedResetAt;
  }
  mergeTestsByUpdatedAt(tests, parseStoredTests(localStorage.getItem(TESTS)));
  computeAthletes();
  localStorage.setItem(LASTSYNC, new Date().toUTCString());
  localStorage.setItem(TESTS, JSON.stringify(tests));
}

export function replaceLocalTests(nextTests) {
  observedTestsResetAt = Date.now();
  localStorage.setItem(TESTS_RESET_AT, String(observedTestsResetAt));
  replaceTestsInMemory(nextTests);
  computeAthletes();
  localStorage.setItem(LASTSYNC, new Date().toUTCString());
  localStorage.setItem(TESTS, JSON.stringify(tests));
}

export function clearLocalTests() {
  replaceLocalTests({});
  sessionStorage.removeItem("test");
  sessionStorage.removeItem("test-phase");
}

export async function hydrateLocalFromWorkspaceSourceOfTruth(
  user,
  workspaceId
) {
  const sharedData = await getWorkspaceData(user.idToken, workspaceId);
  replaceLocalTests(sharedData);
}

export async function clearLocalData() {
  localStorage.clear();
  sessionStorage.clear();
  clearWorkspaceCache();
  await auth.signOut();
  location.reload();
}

async function performSync({
  pullDrive = true,
  pullWorkspace = true,
  pushWorkspace = true,
} = {}) {
  // merge remote data with local data
  if (pullDrive) {
    const remoteData = (await getRemoteData()) ?? {};
    mergeTestsByUpdatedAt(tests, remoteData);
  }

  const connectedUser = await connectUser();
  if (
    pullWorkspace &&
    connectedUser?.idToken &&
    (await isWorkspaceApiAvailable())
  ) {
    try {
      const workspace = await getActiveWorkspaceState(connectedUser.idToken);
      if (workspace) {
        const sharedData = await getWorkspaceData(
          connectedUser.idToken,
          workspace.id
        );
        mergeTestsByUpdatedAt(tests, sharedData);
      }
    } catch (err) {
      console.warn("Shared workspace pull skipped:", err?.message ?? err);
    }
  }

  saveLocalTests();

  if (connectedUser) {
    await setRemoteData(tests);
    if (
      pushWorkspace &&
      connectedUser.idToken &&
      (await isWorkspaceApiAvailable())
    ) {
      try {
        const workspace = await getActiveWorkspaceState(connectedUser.idToken);
        if (workspace) {
          await setWorkspaceData(connectedUser.idToken, workspace.id, tests);
        }
      } catch (err) {
        console.warn("Shared workspace push skipped:", err?.message ?? err);
      }
    }
  }

  await syncNonWorkspaceAnalyticsState(tests);
}

async function performSyncWithCrossTabLock(options) {
  if (!navigator.locks?.request) return performSync(options);
  return navigator.locks.request("scat6-data-sync", { mode: "exclusive" }, () =>
    performSync(options)
  );
}

let queuedSyncOptions = null;
let activeSync = null;

function mergeSyncOptions(current, next) {
  if (!current) return next;
  return {
    pullDrive: current.pullDrive || next.pullDrive,
    pullWorkspace: current.pullWorkspace || next.pullWorkspace,
    pushWorkspace: current.pushWorkspace || next.pushWorkspace,
  };
}

/**
 * Queue a background sync. Calls made while a sync is active are coalesced into
 * one follow-up pass so network writes never overlap or finish out of order.
 * Awaiting the returned promise waits for the active pass and all work queued
 * behind it, but callers may intentionally leave it unawaited to keep UI flows
 * responsive.
 */
export function syncData({
  pullDrive = true,
  pullWorkspace = true,
  pushWorkspace = true,
} = {}) {
  queuedSyncOptions = mergeSyncOptions(queuedSyncOptions, {
    pullDrive,
    pullWorkspace,
    pushWorkspace,
  });

  if (!activeSync) {
    activeSync = (async () => {
      let firstError = null;
      try {
        while (queuedSyncOptions) {
          const options = queuedSyncOptions;
          queuedSyncOptions = null;
          try {
            await performSyncWithCrossTabLock(options);
          } catch (err) {
            firstError ??= err;
          }
        }
        if (firstError) throw firstError;
      } finally {
        activeSync = null;
      }
    })();
  }

  return activeSync;
}

window.addEventListener("storage", (event) => {
  if (event.key === null) {
    observedTestsResetAt = 0;
    replaceTestsInMemory({});
    computeAthletes();
    sessionStorage.removeItem("test");
    sessionStorage.removeItem("test-phase");
    document.dispatchEvent(new CustomEvent("scat6TestsUpdated"));
    return;
  }
  if (event.key === TESTS_RESET_AT) {
    const resetAt = Number(event.newValue ?? 0);
    if (resetAt > observedTestsResetAt) {
      observedTestsResetAt = resetAt;
      replaceTestsInMemory({});
      computeAthletes();
      sessionStorage.removeItem("test");
      sessionStorage.removeItem("test-phase");
      document.dispatchEvent(new CustomEvent("scat6TestsUpdated"));
    }
    return;
  }
  if (event.key !== TESTS || !event.newValue) return;
  mergeTestsByUpdatedAt(tests, parseStoredTests(event.newValue));
  computeAthletes();
  document.dispatchEvent(new CustomEvent("scat6TestsUpdated"));
});

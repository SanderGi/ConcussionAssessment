import {
  assess_double_pose,
  assess_tandem_pose,
  assess_single_pose,
} from "./util/pose.js";
import {
  startListening,
  abortListening,
  speak,
  isSpeaking,
  abortSpeaking,
} from "./util/sound.js";
import {
  getAthleteName,
  saveTestResult,
  getTest,
  renderTestSection,
} from "./testManager.js";
import { alert, bessEndMenu } from "./util/popup.js";

// ============================ Stages ============================
const FIRST_POSE = "DOUBLE";
const FIRST_FOAM_POSE = "DOUBLE_FOAM";
const POSES = {
  DOUBLE: {
    description:
      "please stand straight with hands on your hips and feet touching",
    image: "./assets/double_leg.png",
    assess_fx: assess_double_pose,
    test_field: "mBESS_double_errors",
    next: "TANDEM",
  },
  TANDEM: {
    description:
      "please stand heel-to-toe (non-dominant foot in the back) with hands on your hips",
    image: "./assets/tandem_stance.png",
    assess_fx: assess_tandem_pose,
    test_field: "mBESS_tandem_errors",
    next: "SINGLE",
  },
  SINGLE: {
    description:
      "please stand on your non-dominant leg with hands on your hips",
    image: "./assets/single_leg.png",
    assess_fx: assess_single_pose,
    test_field: "mBESS_single_errors",
    next: "END",
  },
  DOUBLE_FOAM: {
    description:
      "please stand straight with hands on your hips and feet touching on foam",
    image: "./assets/double_foam.png",
    assess_fx: assess_double_pose,
    test_field: "mBESS_foam_double_errors",
    next: "TANDEM_FOAM",
  },
  TANDEM_FOAM: {
    description:
      "please stand heel-to-toe (non-dominant foot in the back) with hands on your hips on foam",
    image: "./assets/tandem_foam.png",
    assess_fx: assess_tandem_pose,
    test_field: "mBESS_foam_tandem_errors",
    next: "SINGLE_FOAM",
  },
  SINGLE_FOAM: {
    description:
      "please stand on your non-dominant leg with hands on your hips on foam",
    image: "./assets/single_foam.png",
    assess_fx: assess_single_pose,
    test_field: "mBESS_foam_single_errors",
    next: "END",
  },
};

function activateNextPose() {
  const pose =
    POSES[
      status_id.startsWith("BEGIN_")
        ? status_id.slice("BEGIN_".length)
        : status_id
    ];
  const next_pose = pose.next != "END" ? POSES[pose.next] : null;
  if (next_pose) {
    abortSpeaking();
    setIntstructions(
      `${getAthleteName()}, ${next_pose.description}:`,
      next_pose.image,
      `New pose: ${getAthleteName()}, ${next_pose.description}`
    );
    setStatus(`BEGIN_${pose.next}`);
  } else {
    endBess();
  }
}
window.activateNextPose = activateNextPose; // for DEBUGGING

// map pose.test_field to [{ error: "error description", photo: "photo url"}]
const POSE_ERROR_PHOTOS = new Proxy(
  JSON.parse(sessionStorage.getItem("POSE_ERROR_PHOTOS") ?? "{}"),
  {
    set: function (target, key, value) {
      target[key] = value;
      sessionStorage.setItem("POSE_ERROR_PHOTOS", JSON.stringify(target));
      return true;
    },
    get: function (target, key) {
      return new Proxy(target[key] ?? [], {
        set: function (subtarget, subkey, subvalue) {
          subtarget[subkey] = subvalue;
          POSE_ERROR_PHOTOS[key] = subtarget;
          return true;
        },
      });
    },
  }
);

// ============================ UI Elements ============================
const statusElement = document.getElementById("status");
const instructionsElement = document.getElementById("instructions");

let status_id;
function setStatus(id, status, color) {
  if (status) {
    statusElement.innerHTML = status;
  }
  if (color) {
    statusElement.style.backgroundColor = color;
  }
  status_id = id;

  if (status_id === "") {
    setStatus(`BEGIN_${FIRST_POSE}`);
    setIntstructions(
      `${getAthleteName()}, ${POSES[FIRST_POSE].description}:`,
      POSES[FIRST_POSE].image,
      `${getAthleteName()}, ${POSES[FIRST_POSE].description}`
    );
  }
}

let instruction_text;
function setIntstructions(text, image, voice_message) {
  if (text === instruction_text) return;
  if (voice_message) {
    speak(voice_message);
  }
  instructionsElement.textContent = text;
  if (image) {
    instructionsElement.innerHTML += `<img src="${image}" style="height: 6cm; margin: 6px">`;
  }
}

// ============================ Setup ============================
tracker.setModel("BlazePoseFull");
tracker.elCanvas = "#canvas";
tracker.elVideo = "#video";
tracker.idealFacingMode = "environment";

document.addEventListener("renderTestSection", async (event) => {
  if (event.detail === "bess") {
    tracker.idealWidth = window.innerWidth;
    tracker.idealHeight = window.innerHeight;
    tracker.run("camera");

    tracker.faceModel = await faceLandmarksDetection.createDetector(
      faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
      { maxFaces: 1, runtime: "tfjs", refineLandmarks: false }
    );
  }
});

// ============================ Pose Assessment ============================
// direct the athlete to assume the current pose
async function begin_pose(poses, assess_fx, next_action) {
  const error = await assess_fx(poses);
  if (error) {
    setStatus(status_id, error, "red");
  } else {
    setStatus(
      status_id,
      `Pose looks good! Click to start the 20 second trial where the pose must be held <button class="button button--green" data-action="${next_action}">Start Timer</button>`,
      "green"
    );
  }
}

// assess their ability to hold the pose
let errors = 0;
let last_error = 0;
let seconds_left = 20;
let good_frames = 0;
let total_frames = 0;
async function count_pose_errors(poses, assess_fx) {
  total_frames += 1;
  const error = await assess_fx(poses);
  if (error) {
    setStatus(status_id, error, "red");
    if (Date.now() - last_error > 2000) {
      // Only count errors if they are at least 2 seconds apart to give time to correct
      errors += 1;
      last_error = Date.now();
      speak(error);
      POSE_ERROR_PHOTOS[POSES[status_id].test_field].push({
        error,
        photo: await tracker.capturePhoto(false),
      });
    }
  } else {
    good_frames += 1;
    setStatus(
      status_id,
      `Pose looks good! ${seconds_left} seconds left. Errors: ${errors}`,
      "green"
    );
  }
}

// ============================ Timer Logic ============================
statusElement.addEventListener("click", async (event) => {
  const action = event.target.dataset.action;
  if (!action) return;

  if (!action.startsWith("start-timer-")) return;
  const pose_id = action.slice("start-timer-".length);
  const pose = POSES[pose_id];

  errors = 0;
  last_error = 0;
  good_frames = 0;
  total_frames = 0;
  seconds_left = 20;
  POSE_ERROR_PHOTOS[pose.test_field] = [];
  setStatus(pose_id, "Pose looks good! 20 seconds left.", "green");
  const timer = setInterval(() => {
    seconds_left -= 1;
    if (seconds_left == 0) {
      clearInterval(timer);
      if (good_frames / total_frames < 0.25) {
        errors = 10; // if the pose is not held for at least 5 seconds, count as 10 errors
      }
      saveTestResult(pose.test_field, errors);
      activateNextPose();
    } else {
      setIntstructions(
        `${seconds_left} seconds left. ${getAthleteName()}, ${
          pose.description
        }:`,
        pose.image,
        isSpeaking() ? null : `${seconds_left}`
      );
    }
  }, 1000);
});

// ============================ End Menu ============================
async function endBess() {
  abortSpeaking();
  const test = getTest();
  test.mBESS_total_errors =
    test.mBESS_double_errors +
    test.mBESS_tandem_errors +
    test.mBESS_single_errors;
  saveTestResult("mBESS_total_errors", test.mBESS_total_errors);
  test.mBESS_foam_total_errors =
    test.mBESS_foam_double_errors +
    test.mBESS_foam_tandem_errors +
    test.mBESS_foam_single_errors;
  if (!isNaN(test.mBESS_foam_total_errors)) {
    saveTestResult("mBESS_foam_total_errors", test.mBESS_foam_total_errors);
  }

  const action = await bessEndMenu(test, POSE_ERROR_PHOTOS);
  if (action == "NEXT") {
    tracker.stop();
    abortListening();
    renderTestSection("tandem-gait");
  } else if (action == "FOAM") {
    const pose = POSES[FIRST_FOAM_POSE];
    setIntstructions(
      `${getAthleteName()}, ${pose.description}:`,
      pose.image,
      `${getAthleteName()}, ${pose.description}`
    );
    setStatus(`BEGIN_${FIRST_FOAM_POSE}`);
  } else if (action == "RETRY") {
    setStatus("");
  } else if (action == "REDO_MANUALLY") {
    tracker.stop();
    abortListening();
    renderTestSection("manual-bess");
  }
}

// ============================ Pose Assessment Loop ============================
// listen for when the camera is ready
let _prev_status = "";
tracker.on("statuschange", function (status) {
  if (status === _prev_status) return;
  setStatus(status, status, "gray");
  _prev_status = status;
});

// run pose assessment loop every 30 frames
let count = 0;
tracker.on("beforeupdate", (poses) => {
  count %= 30;
  if (count === 0) {
    if (status_id === "END") {
      // DO NOTHING
    } else if (status_id.startsWith("BEGIN")) {
      const pose_id = status_id.slice("BEGIN_".length);
      const pose = POSES[pose_id];
      begin_pose(poses, pose.assess_fx, `start-timer-${pose_id}`);
    } else {
      const pose_id = status_id;
      const pose = POSES[pose_id];
      count_pose_errors(poses, pose.assess_fx);
    }
  }
  count += 1;
});

// ============================ Video Error Handling ============================
tracker.on("detectorerror", async (error) => {
  console.error(error);
  await alert(
    "Unexpected error deciphering the pose. Skipping to manual assessment."
  );
  abortListening();
  tracker.stop();
  renderTestSection("manual-bess");
});
tracker.on("videoerror", async (error) => {
  console.error(error);
  await alert(
    "Unexpected error with the camera. Skipping to manual assessment."
  );
  abortListening();
  tracker.stop();
  renderTestSection("manual-bess");
});

// ============================ Mirror Video ============================
// mirror video if needed (store preference in localStorage)
function toggleMirror() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const mirrored = video.style.transform === "scaleX(-1)";
  video.style.transform = mirrored ? "scaleX(1)" : "scaleX(-1)";
  canvas.style.transform = mirrored ? "scaleX(1)" : "scaleX(-1)";
  return !mirrored;
}
document.getElementById("mirror-button").addEventListener("click", () => {
  const mirrored = toggleMirror();
  localStorage.setItem("mirror", mirrored);
});
if (localStorage.getItem("mirror") === "true") {
  toggleMirror();
}

// ============================ Voice Control ============================
const voiceCtrlButton = document.getElementById("voice-ctrl-button");
function toggleVoiceControl() {
  voiceCtrlButton.classList.toggle("button--green");
  const voiceEnabled = voiceCtrlButton.classList.contains("button--green");
  localStorage.setItem("voice", voiceEnabled);
  if (voiceEnabled) {
    speak(
      "Say 'mirror' to toggle the mirror effect. Say 'next' to move to the next pose. Say 'skip' to skip the test."
    );
    startListening((message) => {
      message = message.toLowerCase();
      if (message.includes("mirror")) {
        toggleMirror();
      } else if (message.includes("next") || message.includes("start")) {
        const action = statusElement.querySelector("button")?.dataset?.action;
        if (action) {
          statusElement.querySelector("button").click();
        }
      } else if (message.includes("skip")) {
        abortListening();
        tracker.stop();
        renderTestSection("manual-bess");
      }
    });
  } else {
    abortListening();
  }
}
voiceCtrlButton.addEventListener("click", toggleVoiceControl);
if (localStorage.getItem("voice") === "true") {
  toggleVoiceControl();
}

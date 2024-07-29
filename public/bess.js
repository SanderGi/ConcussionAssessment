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
} from "./util/sound.js";
import { getAthleteName, saveTestResult } from "./testManager.js";
import { alert } from "./util/popup.js";

// stages
const FIRST_POSE = "DOUBLE";
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

// ui elements
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

// setup pose detection
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

// pose detection
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

async function end_bess() {
  // TODO
}

// timer logic
statusElement.addEventListener("click", async (event) => {
  const action = event.target.dataset.action;
  if (!action) return;

  if (!action.startsWith("start-timer-")) return;
  const pose_id = action.slice("start-timer-".length);
  const pose = POSES[pose_id];
  const next_pose = pose.next != "END" ? POSES[pose.next] : null;

  setStatus(pose_id, "Pose looks good! 20 seconds left.", "green");
  errors = 0;
  last_error = 0;
  good_frames = 0;
  total_frames = 0;
  seconds_left = 20;
  const timer = setInterval(() => {
    seconds_left -= 1;
    if (seconds_left == 0) {
      clearInterval(timer);
      if (good_frames / total_frames < 0.25) {
        errors = 10; // if the pose is not held for at least 5 seconds, count as 10 errors
      }
      saveTestResult(pose.test_field, errors);
      if (next_pose) {
        setIntstructions(
          `${getAthleteName()}, ${next_pose.description}:`,
          next_pose.image,
          `Next pose: ${getAthleteName()}, ${next_pose.description}`
        );
        setStatus(`BEGIN_${pose.next}`);
      } else {
        end_bess();
      }
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
      // TODO
    } else if (status_id.startsWith("BEGIN")) {
      const pose_id = status_id.split("_")[1];
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

// handle video errors
tracker.on("detectorerror", async (error) => {
  console.error(error);
  await alert(
    "Unexpected error deciphering the pose. Skipping to manual assessment."
  );
  renderTestSection("manual-bess");
});
tracker.on("videoerror", async (error) => {
  console.error(error);
  await alert(
    "Unexpected error with the camera. Skipping to manual assessment."
  );
  renderTestSection("manual-bess");
});

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

// voice control
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
      if (message.includes("mirror")) {
        toggleMirror();
      } else if (message.includes("next") || message.includes("start")) {
        const action = statusElement.querySelector("button")?.dataset?.action;
        if (action) {
          statusElement.querySelector("button").click();
        }
      } else if (message.includes("skip")) {
        abortListening();
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

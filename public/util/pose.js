import { getAthleteName } from "../testManager.js";

// ============== Math Utils ==============
function getEucledianDistance(x1, y1, x2, y2, z1, z2) {
  return Math.sqrt(
    (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1)
  );
}

function getMidPoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

function getScaledDistance(a, b, scale = 1) {
  return getEucledianDistance(a.x, a.y, b.x, b.y, a.z, b.z) / scale;
}

function getFaceBoundingBox(pose) {
  const x = Math.min(...pose.keypoints.map((kp) => kp.x));
  const y = Math.min(...pose.keypoints.map((kp) => kp.y)) * 0.6;
  const width = Math.max(...pose.keypoints.map((kp) => kp.x)) - x;
  const height = Math.max(...pose.keypoints.map((kp) => kp.y)) * 0.6 - y;
  const boundingBox = [x, y, width, height];
  return boundingBox;
}

// ============== Pose Utils ==============
async function isEyesClosed(boundingBox, eyeAspectRatioThreshold = 0.013) {
  let isEyeClosed = true;
  let image = tracker.video;
  // clip video to bounding box to improve accuracy when the subject is far away
  if (boundingBox) {
    const [x, y, width, height] = boundingBox;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(tracker.video, x, y, width, height, 0, 0, width, height);
    image = canvas;
  }
  const predictions = await tracker.faceModel.estimateFaces(image);
  if (predictions.length > 0) {
    const prediction = predictions[0];
    const rightEye = prediction.keypoints.filter(
      (kp) => kp.name === "rightEye"
    );
    const [lowerRight, upperRight] =
      rightEye[0].y > rightEye[1].y
        ? [rightEye[1], rightEye[0]]
        : [rightEye[0], rightEye[1]];

    const leftEye = prediction.keypoints.filter((kp) => kp.name === "leftEye");
    const [lowerLeft, upperLeft] =
      leftEye[0].y > leftEye[1].y
        ? [leftEye[1], leftEye[0]]
        : [leftEye[0], leftEye[1]];

    const averageRight = getMidPoint(lowerRight, upperRight);
    const averageLeft = getMidPoint(lowerLeft, upperLeft);
    const distance = getScaledDistance(averageLeft, averageRight, 1);
    const rightHeight = getEucledianDistance(
      0,
      lowerRight.y,
      0,
      upperRight.y,
      0,
      0
    );
    const leftHeight = getEucledianDistance(
      0,
      lowerLeft.y,
      0,
      upperLeft.y,
      0,
      0
    );
    const leftEAR = leftHeight / distance;
    const rightEAR = rightHeight / distance;

    isEyeClosed =
      leftEAR <= eyeAspectRatioThreshold || rightEAR <= eyeAspectRatioThreshold;
  } else {
    console.log("No face detected");
  }
  return isEyeClosed;
}

// ============== Preprogrammed Poses ==============
export async function assess_double_pose(poses) {
  if (poses.length === 0) {
    return "Can't find athlete. Please make sure they are fully in frame.";
  } else if (poses.length > 1) {
    return `Multiple people detected. Please make sure only ${getAthleteName()} is in frame.`;
  } else {
    const pose = poses[0];
    const left_shoulder = pose.keypoints3D.find(
      (kp) => kp.name === "left_shoulder"
    );
    const right_shoulder = pose.keypoints3D.find(
      (kp) => kp.name === "right_shoulder"
    );
    const left_elbow = pose.keypoints3D.find((kp) => kp.name === "left_elbow");
    const right_elbow = pose.keypoints3D.find(
      (kp) => kp.name === "right_elbow"
    );
    const left_wrist = pose.keypoints3D.find((kp) => kp.name === "left_wrist");
    const right_wrist = pose.keypoints3D.find(
      (kp) => kp.name === "right_wrist"
    );
    const left_hip = pose.keypoints3D.find((kp) => kp.name === "left_hip");
    const right_hip = pose.keypoints3D.find((kp) => kp.name === "right_hip");
    const left_ankle = pose.keypoints3D.find((kp) => kp.name === "left_ankle");
    const right_ankle = pose.keypoints3D.find(
      (kp) => kp.name === "right_ankle"
    );

    const body_parts = [
      left_shoulder,
      right_shoulder,
      left_elbow,
      right_elbow,
      left_wrist,
      right_wrist,
      left_hip,
      right_hip,
      left_ankle,
      right_ankle,
    ];
    const display_names = [
      "Left shoulder",
      "Right shoulder",
      "Left elbow",
      "Right elbow",
      "Left wrist",
      "Right wrist",
      "Left hip",
      "Right hip",
      "Left ankle",
      "Right ankle",
    ];
    for (let i = 0; i < body_parts.length; i++) {
      if (body_parts[i].score < tracker.minScore) {
        return `${display_names[i]} not detected. Please make sure it is fully in frame and you are facing the camera straight on.`;
      }
    }

    // calibration length
    const shoulderWidth = getEucledianDistance(
      left_shoulder.x,
      left_shoulder.y,
      right_shoulder.x,
      right_shoulder.y,
      left_shoulder.z,
      right_shoulder.z
    );

    const left_hand_hip_distance = getScaledDistance(
      left_wrist,
      left_hip,
      shoulderWidth
    );
    if (left_hand_hip_distance > 0.8) {
      return "Left hand is too far from the hip. Please move it closer.";
    }
    const right_hand_hip_distance = getScaledDistance(
      right_wrist,
      right_hip,
      shoulderWidth
    );
    if (right_hand_hip_distance > 0.8) {
      return "Right hand is too far from the hip. Please move it closer.";
    }

    const minZ = Math.min(...body_parts.map((kp) => kp.z));
    const maxZ = Math.max(...body_parts.map((kp) => kp.z));
    const foward_backward_bending_factor = (maxZ - minZ) / shoulderWidth;
    if (foward_backward_bending_factor > 1.4) {
      return "Please stand straight without bending/twisting knees or upper body.";
    }

    const left_hip_shoulder_distance = getEucledianDistance(
      left_hip.x,
      0,
      left_shoulder.x,
      0,
      0,
      0
    );
    const right_hip_shoulder_distance = getEucledianDistance(
      right_hip.x,
      0,
      right_shoulder.x,
      0,
      0,
      0
    );
    const max_hip_shoulder_distance = Math.max(
      left_hip_shoulder_distance,
      right_hip_shoulder_distance
    );
    const left_right_bending_factor = max_hip_shoulder_distance / shoulderWidth;
    if (left_right_bending_factor > 0.24) {
      return "Please stand straight without moving hips side to side.";
    }

    const ankle_distance = getScaledDistance(
      left_ankle,
      right_ankle,
      shoulderWidth
    );
    if (ankle_distance > 0.4) {
      return "Please keep feet together.";
    }

    const elbow_distance = getScaledDistance(
      left_elbow,
      right_elbow,
      shoulderWidth
    );
    if (elbow_distance < 1.7) {
      return "Please bend both elbows without twisting the shoulders.";
    }

    if (await isEyesClosed(getFaceBoundingBox(pose))) {
      return null;
    } else {
      return "Please close your eyes.";
    }
  }
}

export async function assess_tandem_pose(poses) {
  if (poses.length === 0) {
    return "Can't find athlete. Please make sure they are fully in frame.";
  } else if (poses.length > 1) {
    return `Multiple people detected. Please make sure only ${getAthleteName()} is in frame.`;
  } else {
    const pose = poses[0];
    const left_shoulder = pose.keypoints3D.find(
      (kp) => kp.name === "left_shoulder"
    );
    const right_shoulder = pose.keypoints3D.find(
      (kp) => kp.name === "right_shoulder"
    );
    const left_elbow = pose.keypoints3D.find((kp) => kp.name === "left_elbow");
    const right_elbow = pose.keypoints3D.find(
      (kp) => kp.name === "right_elbow"
    );
    const left_wrist = pose.keypoints3D.find((kp) => kp.name === "left_wrist");
    const right_wrist = pose.keypoints3D.find(
      (kp) => kp.name === "right_wrist"
    );
    const left_hip = pose.keypoints3D.find((kp) => kp.name === "left_hip");
    const right_hip = pose.keypoints3D.find((kp) => kp.name === "right_hip");
    const left_knee = pose.keypoints3D.find((kp) => kp.name === "left_knee");
    const right_knee = pose.keypoints3D.find((kp) => kp.name === "right_knee");
    const left_ankle = pose.keypoints3D.find((kp) => kp.name === "left_ankle");
    const right_ankle = pose.keypoints3D.find(
      (kp) => kp.name === "right_ankle"
    );
    const left_heel = pose.keypoints3D.find((kp) => kp.name === "left_heel");
    const right_heel = pose.keypoints3D.find((kp) => kp.name === "right_heel");
    const left_foot_index = pose.keypoints3D.find(
      (kp) => kp.name === "left_foot_index"
    );
    const right_foot_index = pose.keypoints3D.find(
      (kp) => kp.name === "right_foot_index"
    );

    const body_parts = [
      left_shoulder,
      right_shoulder,
      left_elbow,
      right_elbow,
      left_wrist,
      right_wrist,
      left_hip,
      right_hip,
      left_knee,
      right_knee,
      left_ankle,
      right_ankle,
      left_heel,
      right_heel,
      left_foot_index,
      right_foot_index,
    ];
    const display_names = [
      "Left shoulder",
      "Right shoulder",
      "Left elbow",
      "Right elbow",
      "Left wrist",
      "Right wrist",
      "Left hip",
      "Right hip",
      "Left knee",
      "Right knee",
      "Left ankle",
      "Right ankle",
      "Left heel",
      "Right heel",
      "Left forefoot",
      "Right forefoot",
    ];
    for (let i = 0; i < body_parts.length; i++) {
      if (body_parts[i].score < tracker.minScore) {
        return `${display_names[i]} not detected. Please make sure it is fully in frame and you are facing the camera straight on.`;
      }
    }
  }
}

export async function assess_single_pose(poses) {}

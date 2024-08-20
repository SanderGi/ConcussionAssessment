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
async function isEyesClosed(boundingBox, eyeAspectRatioThreshold = null) {
  eyeAspectRatioThreshold =
    eyeAspectRatioThreshold ?? window.eyeAspectRatioThreshold ?? 0.013;

  if (!tracker.faceModel) return true;

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

    if (window.bessCalibrate) {
      window.eyeAspectRatioThreshold = Math.max(
        eyeAspectRatioThreshold,
        Math.min(leftEAR, rightEAR)
      );
    }
  } else {
    console.log("No face detected");
  }
  return isEyeClosed;
}

function getShoulderWidth(pose) {
  const left_shoulder = pose.keypoints3D.find(
    (kp) => kp.name === "left_shoulder"
  );
  const right_shoulder = pose.keypoints3D.find(
    (kp) => kp.name === "right_shoulder"
  );
  return getEucledianDistance(
    left_shoulder.x,
    left_shoulder.y,
    right_shoulder.x,
    right_shoulder.y,
    left_shoulder.z,
    right_shoulder.z
  );
}

function checkHandsOnHips(pose, threshold = null) {
  threshold = threshold ?? window.handsOnHipThreshold ?? 0.9;

  const left_wrist = pose.keypoints3D.find((kp) => kp.name === "left_wrist");
  const right_wrist = pose.keypoints3D.find((kp) => kp.name === "right_wrist");
  const left_hip = pose.keypoints3D.find((kp) => kp.name === "left_hip");
  const right_hip = pose.keypoints3D.find((kp) => kp.name === "right_hip");
  const shoulderWidth = getShoulderWidth(pose);

  const left_hand_hip_distance = getScaledDistance(
    left_wrist,
    left_hip,
    shoulderWidth
  );
  const right_hand_hip_distance = getScaledDistance(
    right_wrist,
    right_hip,
    shoulderWidth
  );

  if (window.bessCalibrate) {
    window.handsOnHipThreshold = Math.max(
      threshold,
      left_hand_hip_distance,
      right_hand_hip_distance
    );
  }

  if (left_hand_hip_distance > threshold) {
    return "Left hand is too far from the hip. Please move it closer.";
  }
  if (right_hand_hip_distance > threshold) {
    return "Right hand is too far from the hip. Please move it closer.";
  }
  return null;
}

function checkStandingStraight(
  pose,
  forward_threshold = null,
  side_threshold = null
) {
  forward_threshold =
    forward_threshold ?? window.standingStraightForwardThreshold ?? 1.9;
  side_threshold =
    side_threshold ?? window.standingStraightSideThreshold ?? 0.3;

  const shoulderWidth = getShoulderWidth(pose);
  const left_shoulder = pose.keypoints3D.find(
    (kp) => kp.name === "left_shoulder"
  );
  const right_shoulder = pose.keypoints3D.find(
    (kp) => kp.name === "right_shoulder"
  );
  const left_hip = pose.keypoints3D.find((kp) => kp.name === "left_hip");
  const right_hip = pose.keypoints3D.find((kp) => kp.name === "right_hip");
  const body_parts = [
    pose.keypoints3D.find((kp) => kp.name === "nose"),
    left_shoulder,
    right_shoulder,
    pose.keypoints3D.find((kp) => kp.name === "left_elbow"),
    pose.keypoints3D.find((kp) => kp.name === "right_elbow"),
    pose.keypoints3D.find((kp) => kp.name === "left_wrist"),
    pose.keypoints3D.find((kp) => kp.name === "right_wrist"),
    left_hip,
    right_hip,
    pose.keypoints3D.find((kp) => kp.name === "left_ankle"),
    pose.keypoints3D.find((kp) => kp.name === "right_ankle"),
  ];

  const minZ = Math.min(...body_parts.map((kp) => kp.z));
  const maxZ = Math.max(...body_parts.map((kp) => kp.z));
  const foward_backward_bending_factor = (maxZ - minZ) / shoulderWidth;

  if (window.bessCalibrate) {
    window.standingStraightForwardThreshold = Math.max(
      forward_threshold,
      foward_backward_bending_factor
    );
    window.standingStraightForwardLenientThreshold = Math.max(
      window.standingStraightForwardLenientThreshold ?? 2.0,
      foward_backward_bending_factor
    );
  }

  if (foward_backward_bending_factor > forward_threshold) {
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

  if (window.bessCalibrate) {
    window.standingStraightSideThreshold = Math.max(
      side_threshold,
      left_right_bending_factor
    );
    window.standingStraightSideLenientThreshold = Math.max(
      window.standingStraightSideLenientThreshold ?? 0.4,
      left_right_bending_factor
    );
  }

  if (left_right_bending_factor > side_threshold) {
    return "Please stand straight without moving hips side to side.";
  }

  return null;
}

function checkFeetTogether(pose, threshold = null) {
  threshold = threshold ?? window.feetTogetherThreshold ?? 0.5;

  const left_ankle = pose.keypoints3D.find((kp) => kp.name === "left_ankle");
  const right_ankle = pose.keypoints3D.find((kp) => kp.name === "right_ankle");
  const shoulderWidth = getShoulderWidth(pose);

  const ankle_distance = getScaledDistance(
    left_ankle,
    right_ankle,
    shoulderWidth
  );

  if (window.bessCalibrate) {
    window.feetTogetherThreshold = Math.max(threshold, ankle_distance);
  }

  if (ankle_distance > threshold) {
    return "Please keep feet together.";
  }
  return null;
}

function checkOneFootLifted(pose, threshold = null) {
  threshold = threshold ?? window.footLiftedThreshold ?? 0.1;

  const left_ankle = pose.keypoints3D.find((kp) => kp.name === "left_ankle");
  const right_ankle = pose.keypoints3D.find((kp) => kp.name === "right_ankle");
  const shoulderWidth = getShoulderWidth(pose);

  const height_diff = Math.abs(left_ankle.y - right_ankle.y) / shoulderWidth;

  if (window.bessCalibrate) {
    window.footLiftedThreshold = Math.min(threshold, height_diff);
  }

  if (height_diff < threshold) {
    return "Please lift dominant foot off the ground.";
  }
  return null;
}

function checkKneesTogether(pose, threshold = null) {
  threshold = threshold ?? window.kneesTogetherThreshold ?? 0.5;

  const left_knee = pose.keypoints3D.find((kp) => kp.name === "left_knee");
  const right_knee = pose.keypoints3D.find((kp) => kp.name === "right_knee");
  const shoulderWidth = getShoulderWidth(pose);

  const knee_distance = getScaledDistance(left_knee, right_knee, shoulderWidth);

  if (window.bessCalibrate) {
    window.kneesTogetherThreshold = Math.max(threshold, knee_distance);
  }

  if (knee_distance > threshold) {
    return "Please keep knees together.";
  }
  return null;
}

function checkHeelToToe(
  pose,
  depth_threshold = null,
  alignment_threshold = null
) {
  depth_threshold = depth_threshold ?? window.heelToToeDepthThreshold ?? 0.1;
  alignment_threshold =
    alignment_threshold ?? window.heelToToeAlignmentThreshold ?? 0.2;

  const left_ankle = pose.keypoints3D.find((kp) => kp.name === "left_ankle");
  const right_ankle = pose.keypoints3D.find((kp) => kp.name === "right_ankle");
  const shoulderWidth = getShoulderWidth(pose);

  if (
    left_ankle.score < tracker.minScore &&
    right_ankle.score < tracker.minScore
  ) {
    return "The dominant foot must be visible in front of the non-dominant foot.";
  }

  const depth = Math.abs(left_ankle.z - right_ankle.z) / shoulderWidth;
  const xdiff = Math.abs(left_ankle.x - right_ankle.x) / shoulderWidth;

  if (window.bessCalibrate) {
    window.heelToToeDepthThreshold = Math.min(depth_threshold, depth);
    window.heelToToeAlignmentThreshold = Math.max(alignment_threshold, xdiff);
  }

  if (depth < depth_threshold) {
    return "Please move the dominant foot further forward.";
  }
  if (xdiff > alignment_threshold) {
    return "Please align the heel of the dominant foot with the toe of the non-dominant foot.";
  }
  return null;
}

function checkElbowsBend(pose, threshold = null) {
  threshold = threshold ?? window.elbowApartThreshold ?? 1.6;

  const left_elbow = pose.keypoints3D.find((kp) => kp.name === "left_elbow");
  const right_elbow = pose.keypoints3D.find((kp) => kp.name === "right_elbow");
  const shoulderWidth = getShoulderWidth(pose);

  const elbow_distance = getScaledDistance(
    left_elbow,
    right_elbow,
    shoulderWidth
  );

  if (window.bessCalibrate) {
    window.elbowApartThreshold = Math.min(threshold, elbow_distance);
  }

  if (elbow_distance < threshold) {
    return "Please bend both elbows without twisting the shoulders.";
  }
  return null;
}

function checkVisible(pose, ids, display_names) {
  for (let i = 0; i < ids.length; i++) {
    const body_part = pose.keypoints3D.find((kp) => kp.name === ids[i]);
    if (body_part.score < tracker.minScore) {
      return `${display_names[i]} not detected. Please make sure it is fully in frame and you are facing the camera straight on.`;
    }
  }
  return null;
}

// ============== Preprogrammed Poses ==============
export async function assess_double_pose(poses) {
  if (poses.length === 0) {
    return "Can't find athlete. Please make sure they are fully in frame.";
  } else if (poses.length > 1) {
    return `Multiple people detected. Please make sure only ${getAthleteName()} is in frame.`;
  } else {
    const pose = poses[0];

    const body_parts = [
      "left_shoulder",
      "right_shoulder",
      "left_elbow",
      "right_elbow",
      "left_wrist",
      "right_wrist",
      "left_hip",
      "right_hip",
      "left_knee",
      "right_knee",
      "left_ankle",
      "right_ankle",
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
    ];
    const visibilityError = checkVisible(pose, body_parts, display_names);
    if (visibilityError) {
      return visibilityError;
    }

    const handsOnHipsError = checkHandsOnHips(pose);
    if (handsOnHipsError) {
      return handsOnHipsError;
    }

    const standingStraightError = checkStandingStraight(pose);
    if (standingStraightError) {
      return standingStraightError;
    }

    const feetTogetherError = checkFeetTogether(pose);
    if (feetTogetherError) {
      return feetTogetherError;
    }

    const kneesTogetherError = checkKneesTogether(pose);
    if (kneesTogetherError) {
      return kneesTogetherError;
    }

    const elbowBendError = checkElbowsBend(pose);
    if (elbowBendError) {
      return elbowBendError;
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

    const body_parts = [
      "left_shoulder",
      "right_shoulder",
      "left_elbow",
      "right_elbow",
      "left_wrist",
      "right_wrist",
      "left_hip",
      "right_hip",
      "left_knee",
      "right_knee",
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
    ];
    const visibilityError = checkVisible(pose, body_parts, display_names);
    if (visibilityError) {
      return visibilityError;
    }

    const handsOnHipsError = checkHandsOnHips(pose);
    if (handsOnHipsError) {
      return handsOnHipsError;
    }

    const standingStraightError = checkStandingStraight(
      pose,
      window.standingStraightForwardLenientThreshold ?? 2.0
    );
    if (standingStraightError) {
      return standingStraightError;
    }

    const heelToToeError = checkHeelToToe(pose);
    if (heelToToeError) {
      return heelToToeError;
    }

    const elbowBendError = checkElbowsBend(pose);
    if (elbowBendError) {
      return elbowBendError;
    }

    if (await isEyesClosed(getFaceBoundingBox(pose))) {
      return null;
    } else {
      return "Please close your eyes.";
    }
  }
}

export async function assess_single_pose(poses) {
  if (poses.length === 0) {
    return "Can't find athlete. Please make sure they are fully in frame.";
  } else if (poses.length > 1) {
    return `Multiple people detected. Please make sure only ${getAthleteName()} is in frame.`;
  } else {
    const pose = poses[0];

    const body_parts = [
      "left_shoulder",
      "right_shoulder",
      "left_elbow",
      "right_elbow",
      "left_wrist",
      "right_wrist",
      "left_hip",
      "right_hip",
      "left_knee",
      "right_knee",
      "left_ankle",
      "right_ankle",
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
    ];
    const visibilityError = checkVisible(pose, body_parts, display_names);
    if (visibilityError) {
      return visibilityError;
    }

    const handsOnHipsError = checkHandsOnHips(pose);
    if (handsOnHipsError) {
      return handsOnHipsError;
    }

    const standingStraightError = checkStandingStraight(
      pose,
      window.standingStraightForwardLenientThreshold ?? 2.0,
      window.standingStraightSideLenientThreshold ?? 0.4
    );
    if (standingStraightError) {
      return standingStraightError;
    }

    const elbowBendError = checkElbowsBend(pose);
    if (elbowBendError) {
      return elbowBendError;
    }

    const oneFootLiftedError = checkOneFootLifted(pose);
    if (oneFootLiftedError) {
      return oneFootLiftedError;
    }

    if (await isEyesClosed(getFaceBoundingBox(pose))) {
      return null;
    } else {
      return "Please close your eyes.";
    }
  }
}

#!/usr/bin/env node
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const TEMPLATE_DIR = join(ROOT, "templates");
const I18N_DIR = join(ROOT, "i18n");
const TRANSLATIONS_DIR = join(I18N_DIR, "translations");
const PUBLIC_TRANSLATIONS_DIR = join(PUBLIC_DIR, "i18n", "translations");
const GENERATED_MARKER =
  "<!-- GENERATED FILE. DO NOT EDIT DIRECTLY. Edit templates and run scripts/build-i18n.mjs -->";

const languagesConfig = JSON.parse(
  readFileSync(join(I18N_DIR, "languages.json"), "utf8")
);
const defaultLanguage = languagesConfig.default;
const supportedLanguages = languagesConfig.supported;

const runtimeEntries = {
  "runtime.sync.sync": {
    source: "Sync",
    locations: ["public/scripts.js showConnected() button label"],
    value: "Sync",
  },
  "runtime.sync.synced": {
    source: "Synced",
    locations: ["public/scripts.js showConnected() button label"],
    value: "Synced",
  },
  "runtime.confirm.delete_all": {
    source: "Are you sure you want to delete all data?",
    locations: ["public/scripts.js deleteAllButton.onclick"],
    value: "Are you sure you want to delete all data?",
  },
  "runtime.confirm.delete_athlete": {
    source: "Are you sure you want to delete this athlete's data?",
    locations: ["public/scripts.js window.deleteAthlete"],
    value: "Are you sure you want to delete this athlete's data?",
  },
  "runtime.confirm.unlink": {
    source:
      "This will delete all data from this device but keep it on your GDrive. Are you sure?",
    locations: ["public/scripts.js syncButton.onclick action=UNLINK"],
    value:
      "This will delete all data from this device but keep it on your GDrive. Are you sure?",
  },
  "runtime.confirm.delete_drive": {
    source:
      "This will delete all data from your GDrive but keep it on this device. Are you sure?",
    locations: ["public/scripts.js syncButton.onclick action=DELETE_DRIVE"],
    value:
      "This will delete all data from your GDrive but keep it on this device. Are you sure?",
  },
  "runtime.alert.sync_failed": {
    source:
      "Failed to sync data. Make sure you checked the box to give the app permission to add app data to your Google Drive.",
    locations: ["public/scripts.js syncButton.onclick catch"],
    value:
      "Failed to sync data. Make sure you checked the box to give the app permission to add app data to your Google Drive.",
  },
  "runtime.sync.last_identity": {
    source:
      "Last confirmed identity on {{lastSignIn}} <br><br> Last synced on {{lastSync}}",
    locations: [
      "public/scripts.js syncButton.onclick syncSettings description",
    ],
    value:
      "Last confirmed identity on {{lastSignIn}} <br><br> Last synced on {{lastSync}}",
  },
  "runtime.lang.aria": {
    source: "Select language",
    locations: [
      "templates/index.template.html header language selector aria-label",
    ],
    value: "Select language",
  },
  "runtime.popup.ok": {
    source: "OK",
    locations: ["public/util/popup.js"],
    value: "OK",
  },
  "runtime.popup.cancel": {
    source: "CANCEL",
    locations: ["public/util/popup.js"],
    value: "CANCEL",
  },
  "runtime.popup.end_test": {
    source: "END TEST",
    locations: ["public/util/popup.js"],
    value: "END TEST",
  },
  "runtime.popup.keep_testing": {
    source: "KEEP TESTING",
    locations: ["public/util/popup.js"],
    value: "KEEP TESTING",
  },
  "runtime.popup.remove_from_play_default": {
    source:
      "Remove athlete from play for immediate medical assessment or transport to hospital/medical center.",
    locations: ["public/util/popup.js removeAthleteFromPlayAlert default"],
    value:
      "Remove athlete from play for immediate medical assessment or transport to hospital/medical center.",
  },
  "runtime.popup.remove_from_play_spinal": {
    source:
      "Spinal immobilization and cervical collar. Then remove athlete from play for immediate medical assessment or transport to hospital/medical center.",
    locations: [
      "public/util/popup.js removeAthleteFromPlayAlert cervical spine",
      "templates/index.template.html cervical-spine button",
    ],
    value:
      "Spinal immobilization and cervical collar. Then remove athlete from play for immediate medical assessment or transport to hospital/medical center.",
  },
  "runtime.popup.enter_athlete": {
    source: "Enter Athlete Information",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Enter Athlete Information",
  },
  "runtime.popup.confirm_athlete": {
    source: "Confirm Athlete Information",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Confirm Athlete Information",
  },
  "runtime.popup.athlete_name": {
    source: "Athlete Name:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Athlete Name:",
  },
  "runtime.popup.id_number": {
    source: "ID Number:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "ID Number:",
  },
  "runtime.popup.time_exam": {
    source: "Time of Examination:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Time of Examination:",
  },
  "runtime.popup.time_injury": {
    source: "Time of Injury (if applicable):",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Time of Injury (if applicable):",
  },
  "runtime.popup.dob": {
    source: "Date of Birth:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Date of Birth:",
  },
  "runtime.popup.sex": {
    source: "Sex:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Sex:",
  },
  "runtime.popup.sex_male": {
    source: "Male",
    locations: ["public/util/popup.js confirmAthleteInfo sex option"],
    value: "Male",
  },
  "runtime.popup.sex_female": {
    source: "Female",
    locations: ["public/util/popup.js confirmAthleteInfo sex option"],
    value: "Female",
  },
  "runtime.popup.sex_prefer_not_to_say": {
    source: "Prefer Not To Say",
    locations: ["public/util/popup.js confirmAthleteInfo sex option"],
    value: "Prefer Not To Say",
  },
  "runtime.popup.sex_other": {
    source: "Other",
    locations: ["public/util/popup.js confirmAthleteInfo sex option"],
    value: "Other",
  },
  "runtime.popup.dom_hand": {
    source: "Dominant Hand:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Dominant Hand:",
  },
  "runtime.popup.hand_right": {
    source: "Right",
    locations: ["public/util/popup.js confirmAthleteInfo dominant hand option"],
    value: "Right",
  },
  "runtime.popup.hand_left": {
    source: "Left",
    locations: ["public/util/popup.js confirmAthleteInfo dominant hand option"],
    value: "Left",
  },
  "runtime.popup.hand_ambidextrous": {
    source: "Ambidextrous",
    locations: ["public/util/popup.js confirmAthleteInfo dominant hand option"],
    value: "Ambidextrous",
  },
  "runtime.popup.current_school_year": {
    source: "Current Year in School (if applicable):",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Current Year in School (if applicable):",
  },
  "runtime.popup.years_edu": {
    source: "Total Years of Education Completed:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Total Years of Education Completed:",
  },
  "runtime.popup.first_lang": {
    source: "First Language:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "First Language:",
  },
  "runtime.popup.preferred_lang": {
    source: "Preferred Language:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Preferred Language:",
  },
  "runtime.popup.examiner": {
    source: "Examiner Name:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Examiner Name:",
  },
  "runtime.popup.team_school": {
    source: "Sport/Team/School:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Sport/Team/School:",
  },
  "runtime.popup.conc_history": {
    source: "Concussion History",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Concussion History",
  },
  "runtime.popup.n_past": {
    source: "Number of Past Concussions:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Number of Past Concussions:",
  },
  "runtime.popup.recent_date": {
    source: "Most Recent Concussion Date:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Most Recent Concussion Date:",
  },
  "runtime.popup.recovery_days": {
    source: "Most Recent Recovery Time (days):",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Most Recent Recovery Time (days):",
  },
  "runtime.popup.primary_symptoms": {
    source: "Primary Symptoms:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Primary Symptoms:",
  },
  "runtime.popup.med_bg": {
    source: "Medical Background",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Medical Background",
  },
  "runtime.popup.start_assessment": {
    source: "Start Assessment",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Start Assessment",
  },
  "runtime.popup.download_zip": {
    source: "Download ZIP",
    locations: ["public/util/popup.js bulkExportOptions"],
    value: "Download ZIP",
  },
  "runtime.popup.stop_sync": {
    source: "Stop Sync",
    locations: ["public/util/popup.js syncSettings"],
    value: "Stop Sync",
  },
  "runtime.popup.close_settings": {
    source: "Close Settings",
    locations: ["public/util/popup.js syncSettings"],
    value: "Close Settings",
  },
  "runtime.popup.placeholder_athlete_name": {
    source: "Athlete name",
    locations: ["public/util/popup.js confirmAthleteInfo placeholder"],
    value: "Athlete name",
  },
  "runtime.popup.placeholder_unique_id": {
    source: "Unique ID",
    locations: ["public/util/popup.js confirmAthleteInfo placeholder"],
    value: "Unique ID",
  },
  "runtime.popup.placeholder_english": {
    source: "English",
    locations: ["public/util/popup.js confirmAthleteInfo placeholder"],
    value: "English",
  },
  "runtime.popup.placeholder_examiner_name": {
    source: "Your first and last name",
    locations: ["public/util/popup.js confirmAthleteInfo placeholder"],
    value: "Your first and last name",
  },
  "runtime.popup.placeholder_team_school": {
    source: "Varsity X at Y High School",
    locations: ["public/util/popup.js confirmAthleteInfo placeholder"],
    value: "Varsity X at Y High School",
  },
  "runtime.popup.placeholder_list_other_symptoms": {
    source: "List other symptoms",
    locations: ["public/util/popup.js confirmAthleteInfo placeholder"],
    value: "List other symptoms",
  },
  "runtime.popup.placeholder_list_medications": {
    source: "List medications",
    locations: ["public/util/popup.js confirmAthleteInfo placeholder"],
    value: "List medications",
  },
  "runtime.popup.placeholder_describe_selections": {
    source: "Describe any selections above",
    locations: ["public/util/popup.js confirmAthleteInfo placeholder"],
    value: "Describe any selections above",
  },
  "runtime.popup.symptom_confusion": {
    source: "Confusion.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Confusion.",
  },
  "runtime.popup.symptom_headache": {
    source: "Headache.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Headache.",
  },
  "runtime.popup.symptom_double_blurry_vision": {
    source: "Double/Blurry Vision.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Double/Blurry Vision.",
  },
  "runtime.popup.symptom_dizziness_imbalance": {
    source: "Dizziness/Imbalance.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Dizziness/Imbalance.",
  },
  "runtime.popup.symptom_nausea_vomiting": {
    source: "Nausea/Vomiting.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Nausea/Vomiting.",
  },
  "runtime.popup.symptom_memory_loss": {
    source: "Memory Loss.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Memory Loss.",
  },
  "runtime.popup.symptom_ringing_ears": {
    source: "Ringing Ears.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Ringing Ears.",
  },
  "runtime.popup.symptom_difficulty_concentrating": {
    source: "Difficulty Concentrating.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Difficulty Concentrating.",
  },
  "runtime.popup.symptom_sensitivity_light": {
    source: "Sensitivity to Light.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Sensitivity to Light.",
  },
  "runtime.popup.symptom_loss_smell_taste": {
    source: "Loss of Smell/Taste.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Loss of Smell/Taste.",
  },
  "runtime.popup.symptom_trouble_sleeping": {
    source: "Trouble Sleeping.",
    locations: ["public/util/popup.js confirmAthleteInfo symptoms"],
    value: "Trouble Sleeping.",
  },
  "runtime.popup.other": {
    source: "Other:",
    locations: ["public/util/popup.js confirmAthleteInfo"],
    value: "Other:",
  },
  "runtime.popup.med_bg_question": {
    source: "Has the athlete ever been (if yes, describe below):",
    locations: ["public/util/popup.js confirmAthleteInfo medical background"],
    value: "Has the athlete ever been (if yes, describe below):",
  },
  "runtime.popup.hospitalized_head_injury": {
    source: "Hospitalized for head injury.",
    locations: ["public/util/popup.js confirmAthleteInfo medical background"],
    value: "Hospitalized for head injury.",
  },
  "runtime.popup.diagnosed_headache_migraine": {
    source: "Diagnosed with a headache disorder or migraine.",
    locations: ["public/util/popup.js confirmAthleteInfo medical background"],
    value: "Diagnosed with a headache disorder or migraine.",
  },
  "runtime.popup.diagnosed_learning_dyslexia": {
    source: "Diagnosed with a learning disability or dyslexia.",
    locations: ["public/util/popup.js confirmAthleteInfo medical background"],
    value: "Diagnosed with a learning disability or dyslexia.",
  },
  "runtime.popup.diagnosed_adhd": {
    source: "Diagnosed with attention deficit hyperactivity disorder (ADHD).",
    locations: ["public/util/popup.js confirmAthleteInfo medical background"],
    value: "Diagnosed with attention deficit hyperactivity disorder (ADHD).",
  },
  "runtime.popup.diagnosed_psych": {
    source: "Diagnosed with depression, anxiety or a psychological disorder.",
    locations: ["public/util/popup.js confirmAthleteInfo medical background"],
    value: "Diagnosed with depression, anxiety or a psychological disorder.",
  },
  "runtime.popup.current_medications": {
    source: "Current Medications:",
    locations: ["public/util/popup.js confirmAthleteInfo medical background"],
    value: "Current Medications:",
  },
  "runtime.popup.notes": {
    source: "Notes:",
    locations: ["public/util/popup.js confirmAthleteInfo medical background"],
    value: "Notes:",
  },
  "runtime.popup.immediate_text": {
    source:
      "The immediate assessment should be completed \"on-field\" after the first aid/emergency care priorities are completed.",
    locations: ["public/util/popup.js confirmAthleteInfo start assessment"],
    value:
      "The immediate assessment should be completed \"on-field\" after the first aid/emergency care priorities are completed.",
  },
  "runtime.popup.cognitive_text": {
    source:
      "The \"cognitive screening\" portion of the baseline and post injury assessments should be completed in a distraction-free environment with the athlete in a resting state.",
    locations: ["public/util/popup.js confirmAthleteInfo start assessment"],
    value:
      "The \"cognitive screening\" portion of the baseline and post injury assessments should be completed in a distraction-free environment with the athlete in a resting state.",
  },
  "runtime.popup.hcp_only_text": {
    source:
      "For Use by Health Care Professionals Only. See the original",
    locations: ["public/util/popup.js confirmAthleteInfo start assessment"],
    value: "For Use by Health Care Professionals Only. See the original",
  },
  "runtime.popup.detailed_instructions": {
    source: "Detailed Instructions",
    locations: ["public/util/popup.js confirmAthleteInfo start assessment"],
    value: "Detailed Instructions",
  },
  "runtime.popup.attest_hcp": {
    source:
      "I hereby attest that I am a medical or Health Care Professional authorized to use this tool:",
    locations: ["public/util/popup.js confirmAthleteInfo start assessment"],
    value:
      "I hereby attest that I am a medical or Health Care Professional authorized to use this tool:",
  },
  "runtime.popup.immediate": {
    source: "Immediate",
    locations: ["public/util/popup.js confirmAthleteInfo action button"],
    value: "Immediate",
  },
  "runtime.popup.baseline": {
    source: "Baseline",
    locations: ["public/util/popup.js confirmAthleteInfo action button"],
    value: "Baseline",
  },
  "runtime.popup.suspected_post": {
    source: "Suspected/Post-Injury",
    locations: ["public/util/popup.js confirmAthleteInfo action button"],
    value: "Suspected/Post-Injury",
  },
  "runtime.popup.save_info_no_test": {
    source: "Save Info w/o Test",
    locations: ["public/util/popup.js confirmAthleteInfo action button"],
    value: "Save Info w/o Test",
  },
  "runtime.bess.pose.double": {
    source: "please stand straight with hands on your hips and feet touching",
    locations: ["public/bess.js pose description"],
    value: "please stand straight with hands on your hips and feet touching",
  },
  "runtime.bess.pose.tandem": {
    source:
      "please stand heel-to-toe (non-dominant foot in the back) with hands on your hips",
    locations: ["public/bess.js pose description"],
    value:
      "please stand heel-to-toe (non-dominant foot in the back) with hands on your hips",
  },
  "runtime.bess.pose.single": {
    source: "please stand on your non-dominant leg with hands on your hips",
    locations: ["public/bess.js pose description"],
    value: "please stand on your non-dominant leg with hands on your hips",
  },
  "runtime.bess.pose.double_foam": {
    source:
      "please stand straight with hands on your hips and feet touching on foam",
    locations: ["public/bess.js pose description"],
    value:
      "please stand straight with hands on your hips and feet touching on foam",
  },
  "runtime.bess.pose.tandem_foam": {
    source:
      "please stand heel-to-toe (non-dominant foot in the back) with hands on your hips on foam",
    locations: ["public/bess.js pose description"],
    value:
      "please stand heel-to-toe (non-dominant foot in the back) with hands on your hips on foam",
  },
  "runtime.bess.pose.single_foam": {
    source:
      "please stand on your non-dominant leg with hands on your hips on foam",
    locations: ["public/bess.js pose description"],
    value:
      "please stand on your non-dominant leg with hands on your hips on foam",
  },
  "runtime.bess.new_pose_prefix": {
    source: "New pose:",
    locations: ["public/bess.js activateNextPose"],
    value: "New pose:",
  },
  "runtime.bess.calibrate_prompt": {
    source:
      "Attempting to calibrate the pose detection model to the current pose. Please hold the pose for 10 seconds.",
    locations: ["public/bess.js bessCalibrateBtn.onclick"],
    value:
      "Attempting to calibrate the pose detection model to the current pose. Please hold the pose for 10 seconds.",
  },
  "runtime.bess.calibrate_complete": {
    source: "Calibration complete",
    locations: ["public/bess.js bessCalibrateBtn.onclick"],
    value: "Calibration complete",
  },
  "runtime.bess.camera_notice": {
    source: "The automated balance system will use the camera.",
    locations: ["public/bess.js renderTestSection"],
    value: "The automated balance system will use the camera.",
  },
  "runtime.bess.status.pose_good_start": {
    source:
      "Pose looks good! Click to start the 20 second trial where the pose must be held",
    locations: ["public/bess.js begin_pose"],
    value:
      "Pose looks good! Click to start the 20 second trial where the pose must be held",
  },
  "runtime.bess.start_timer": {
    source: "Start Timer",
    locations: ["public/bess.js begin_pose button"],
    value: "Start Timer",
  },
  "runtime.bess.status.pose_good_seconds_errors": {
    source: "Pose looks good! {{seconds}} seconds left. Errors: {{errors}}",
    locations: ["public/bess.js count_pose_errors"],
    value: "Pose looks good! {{seconds}} seconds left. Errors: {{errors}}",
  },
  "runtime.bess.status.pose_good_20": {
    source: "Pose looks good! 20 seconds left.",
    locations: ["public/bess.js timer start"],
    value: "Pose looks good! 20 seconds left.",
  },
  "runtime.bess.status.seconds_left_instruction": {
    source: "{{seconds}} seconds left. {{athleteName}}, {{description}}:",
    locations: ["public/bess.js timer tick"],
    value: "{{seconds}} seconds left. {{athleteName}}, {{description}}:",
  },
  "runtime.bess.error.detector": {
    source: "Unexpected error deciphering the pose. Skipping to manual assessment.",
    locations: ["public/bess.js detectorerror"],
    value: "Unexpected error deciphering the pose. Skipping to manual assessment.",
  },
  "runtime.bess.error.video": {
    source: "Unexpected error with the camera. Skipping to manual assessment.",
    locations: ["public/bess.js videoerror"],
    value: "Unexpected error with the camera. Skipping to manual assessment.",
  },
  "runtime.bess.voice.help": {
    source:
      "Say 'mirror' to toggle the mirror effect. Say 'next' to move to the next pose. Say 'skip' to skip the test.",
    locations: ["public/bess.js voice control"],
    value:
      "Say 'mirror' to toggle the mirror effect. Say 'next' to move to the next pose. Say 'skip' to skip the test.",
  },
  "runtime.bess.error.left_hand_far": {
    source: "Left hand is too far from the hip. Please move it closer.",
    locations: ["public/util/pose.js checkHandsOnHips"],
    value: "Left hand is too far from the hip. Please move it closer.",
  },
  "runtime.bess.error.right_hand_far": {
    source: "Right hand is too far from the hip. Please move it closer.",
    locations: ["public/util/pose.js checkHandsOnHips"],
    value: "Right hand is too far from the hip. Please move it closer.",
  },
  "runtime.bess.error.stand_straight_no_bending": {
    source:
      "Please stand straight without bending/twisting knees or upper body.",
    locations: ["public/util/pose.js checkStandingStraight"],
    value: "Please stand straight without bending/twisting knees or upper body.",
  },
  "runtime.bess.error.stand_straight_no_side": {
    source: "Please stand straight without moving hips side to side.",
    locations: ["public/util/pose.js checkStandingStraight"],
    value: "Please stand straight without moving hips side to side.",
  },
  "runtime.bess.error.feet_together": {
    source: "Please keep feet together.",
    locations: ["public/util/pose.js checkFeetTogether"],
    value: "Please keep feet together.",
  },
  "runtime.bess.error.lift_dominant_foot": {
    source: "Please lift dominant foot off the ground.",
    locations: ["public/util/pose.js checkOneFootLifted"],
    value: "Please lift dominant foot off the ground.",
  },
  "runtime.bess.error.knees_together": {
    source: "Please keep knees together.",
    locations: ["public/util/pose.js checkKneesTogether"],
    value: "Please keep knees together.",
  },
  "runtime.bess.error.dominant_foot_visible": {
    source: "The dominant foot must be visible in front of the non-dominant foot.",
    locations: ["public/util/pose.js checkHeelToToe"],
    value: "The dominant foot must be visible in front of the non-dominant foot.",
  },
  "runtime.bess.error.move_dominant_forward": {
    source: "Please move the dominant foot further forward.",
    locations: ["public/util/pose.js checkHeelToToe"],
    value: "Please move the dominant foot further forward.",
  },
  "runtime.bess.error.align_heel_toe": {
    source:
      "Please align the heel of the dominant foot with the toe of the non-dominant foot.",
    locations: ["public/util/pose.js checkHeelToToe"],
    value:
      "Please align the heel of the dominant foot with the toe of the non-dominant foot.",
  },
  "runtime.bess.error.bend_elbows": {
    source: "Please bend both elbows without twisting the shoulders.",
    locations: ["public/util/pose.js checkElbowsBend"],
    value: "Please bend both elbows without twisting the shoulders.",
  },
  "runtime.bess.error.part_not_detected": {
    source:
      "{{part}} not detected. Please make sure it is fully in frame and you are facing the camera straight on.",
    locations: ["public/util/pose.js checkVisible"],
    value:
      "{{part}} not detected. Please make sure it is fully in frame and you are facing the camera straight on.",
  },
  "runtime.bess.error.cant_find_athlete": {
    source: "Can't find athlete. Please make sure they are fully in frame.",
    locations: ["public/util/pose.js assess_*_pose"],
    value: "Can't find athlete. Please make sure they are fully in frame.",
  },
  "runtime.bess.error.multiple_people": {
    source:
      "Multiple people detected. Please make sure only {{athleteName}} is in frame.",
    locations: ["public/util/pose.js assess_*_pose"],
    value:
      "Multiple people detected. Please make sure only {{athleteName}} is in frame.",
  },
  "runtime.bess.error.close_eyes": {
    source: "Please close your eyes.",
    locations: ["public/util/pose.js assess_*_pose"],
    value: "Please close your eyes.",
  },
  "runtime.bess.part.left_shoulder": {
    source: "Left shoulder",
    locations: ["public/util/pose.js body part labels"],
    value: "Left shoulder",
  },
  "runtime.bess.part.right_shoulder": {
    source: "Right shoulder",
    locations: ["public/util/pose.js body part labels"],
    value: "Right shoulder",
  },
  "runtime.bess.part.left_elbow": {
    source: "Left elbow",
    locations: ["public/util/pose.js body part labels"],
    value: "Left elbow",
  },
  "runtime.bess.part.right_elbow": {
    source: "Right elbow",
    locations: ["public/util/pose.js body part labels"],
    value: "Right elbow",
  },
  "runtime.bess.part.left_wrist": {
    source: "Left wrist",
    locations: ["public/util/pose.js body part labels"],
    value: "Left wrist",
  },
  "runtime.bess.part.right_wrist": {
    source: "Right wrist",
    locations: ["public/util/pose.js body part labels"],
    value: "Right wrist",
  },
  "runtime.bess.part.left_hip": {
    source: "Left hip",
    locations: ["public/util/pose.js body part labels"],
    value: "Left hip",
  },
  "runtime.bess.part.right_hip": {
    source: "Right hip",
    locations: ["public/util/pose.js body part labels"],
    value: "Right hip",
  },
  "runtime.bess.part.left_knee": {
    source: "Left knee",
    locations: ["public/util/pose.js body part labels"],
    value: "Left knee",
  },
  "runtime.bess.part.right_knee": {
    source: "Right knee",
    locations: ["public/util/pose.js body part labels"],
    value: "Right knee",
  },
  "runtime.bess.part.left_ankle": {
    source: "Left ankle",
    locations: ["public/util/pose.js body part labels"],
    value: "Left ankle",
  },
  "runtime.bess.part.right_ankle": {
    source: "Right ankle",
    locations: ["public/util/pose.js body part labels"],
    value: "Right ankle",
  },
  "runtime.delayed_recall.need_immediate_missing": {
    source:
      "The Immediate Memory section must be completed at least 5 minutes before this section. It has not been completed at all.",
    locations: ["public/delayed-recall.js"],
    value:
      "The Immediate Memory section must be completed at least 5 minutes before this section. It has not been completed at all.",
  },
  "runtime.delayed_recall.back_to_immediate": {
    source: "Back to the Immediate Memory section",
    locations: ["public/delayed-recall.js"],
    value: "Back to the Immediate Memory section",
  },
  "runtime.delayed_recall.need_immediate_wait": {
    source:
      "The Immediate Memory section must be completed at least 5 minutes before this section. Delayed Recall will open in {{seconds}} seconds.",
    locations: ["public/delayed-recall.js"],
    value:
      "The Immediate Memory section must be completed at least 5 minutes before this section. Delayed Recall will open in {{seconds}} seconds.",
  },
  "runtime.delayed_recall.starting": {
    source: "Starting...",
    locations: ["public/delayed-recall.js"],
    value: "Starting...",
  },
  "runtime.delayed_recall.instructions": {
    source:
      "Examiner, read the below instructions and select the words that the athlete can remember from the Immediate Memory section.",
    locations: ["public/delayed-recall.js"],
    value:
      "Examiner, read the below instructions and select the words that the athlete can remember from the Immediate Memory section.",
  },
  "runtime.delayed_recall.prompt": {
    source:
      "Do you remember the list of words read a few times earlier during the immediate memory section? Tell me as many words from the list as you can remember in any order",
    locations: ["public/delayed-recall.js"],
    value:
      "Do you remember the list of words read a few times earlier during the immediate memory section? Tell me as many words from the list as you can remember in any order",
  },
  "runtime.delayed_recall.words_missing": {
    source: "Somehow the list of words was not saved.",
    locations: ["public/delayed-recall.js"],
    value: "Somehow the list of words was not saved.",
  },
  "runtime.delayed_recall.view_results": {
    source: "View Test Results",
    locations: ["public/delayed-recall.js"],
    value: "View Test Results",
  },
  "runtime.404.title": {
    source: "Page Not Found",
    locations: ["public/404.html"],
    value: "Page Not Found",
  },
  "runtime.404.message": {
    source:
      "The specified file was not found on this website. Please check the URL for mistakes and try again.",
    locations: ["public/404.html"],
    value:
      "The specified file was not found on this website. Please check the URL for mistakes and try again.",
  },
  "runtime.404.why": {
    source: "Why am I seeing this?",
    locations: ["public/404.html"],
    value: "Why am I seeing this?",
  },
  "runtime.404.details": {
    source:
      "This page was generated by the Firebase Command-Line Interface. To modify it, edit the <code>404.html</code> file in your project's configured <code>public</code> directory.",
    locations: ["public/404.html"],
    value:
      "This page was generated by the Firebase Command-Line Interface. To modify it, edit the <code>404.html</code> file in your project's configured <code>public</code> directory.",
  },
  "runtime.test_type.immediate": {
    source: "Immediate",
    locations: ["public/scripts.js translateTestType"],
    value: "Immediate",
  },
  "runtime.test_type.baseline": {
    source: "Baseline",
    locations: ["public/scripts.js translateTestType"],
    value: "Baseline",
  },
  "runtime.test_type.post_injury": {
    source: "Post-Injury",
    locations: ["public/scripts.js translateTestType"],
    value: "Post-Injury",
  },
  "runtime.test_type.no_test": {
    source: "No Test",
    locations: ["public/scripts.js translateTestType"],
    value: "No Test",
  },
  "runtime.test_mgmt.no_baselines": {
    source: "No baselines found for this athlete.",
    locations: ["public/scripts.js showAthleteResults"],
    value: "No baselines found for this athlete.",
  },
  "runtime.test_mgmt.last_baseline": {
    source: "Last baseline ({{date}}): {{score}} / 80",
    locations: ["public/scripts.js showAthleteResults"],
    value: "Last baseline ({{date}}): {{score}} / 80",
  },
  "runtime.test_mgmt.no_post_injuries": {
    source: "No post-injuries found for this athlete.",
    locations: ["public/scripts.js showAthleteResults"],
    value: "No post-injuries found for this athlete.",
  },
  "runtime.test_mgmt.last_post_injury": {
    source: "Last post-injury ({{date}}): {{score}} / 80",
    locations: ["public/scripts.js showAthleteResults"],
    value: "Last post-injury ({{date}}): {{score}} / 80",
  },
  "runtime.test_mgmt.no_tests": {
    source: "No tests found for this athlete. ",
    locations: ["public/scripts.js showAthleteResults"],
    value: "No tests found for this athlete. ",
  },
  "runtime.test_mgmt.click_test_button": {
    source: "Click the Test button to start a new test.",
    locations: ["public/scripts.js showAthleteResults"],
    value: "Click the Test button to start a new test.",
  },
  "runtime.test_mgmt.open_test_details": {
    source: "Open Test Details",
    locations: ["public/scripts.js showAthleteResults"],
    value: "Open Test Details",
  },
  "runtime.test_mgmt.chart.errors_title": {
    source: "Errors, Fastest Times, and Symptoms (lower is better)",
    locations: ["public/scripts.js showAthleteResults chart title"],
    value: "Errors, Fastest Times, and Symptoms (lower is better)",
  },
  "runtime.test_mgmt.chart.symptom_number": {
    source: "Symptom Number (X/22)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Symptom Number (X/22)",
  },
  "runtime.test_mgmt.chart.symptom_severity": {
    source: "Symptom Severity (X/132)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Symptom Severity (X/132)",
  },
  "runtime.test_mgmt.chart.mbess_total_errors": {
    source: "mBESS Total Errors (X/30)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "mBESS Total Errors (X/30)",
  },
  "runtime.test_mgmt.chart.tandem_fastest_time": {
    source: "Tandem Gait Fastest Time",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Tandem Gait Fastest Time",
  },
  "runtime.test_mgmt.chart.dual_task_fastest_time": {
    source: "Dual Task Fastest Time",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Dual Task Fastest Time",
  },
  "runtime.test_mgmt.click_mbess_data_point": {
    source: "Click on an mBESS Total Errors data point to see pose error photos.",
    locations: ["public/scripts.js showAthleteResults chart details"],
    value: "Click on an mBESS Total Errors data point to see pose error photos.",
  },
  "runtime.test_mgmt.no_pose_error_photos": {
    source: "No pose error photos found for this test.",
    locations: ["public/scripts.js showAthleteResults chart details"],
    value: "No pose error photos found for this test.",
  },
  "runtime.test_mgmt.chart.scores_title": {
    source: "Scores (higher is better)",
    locations: ["public/scripts.js showAthleteResults chart title"],
    value: "Scores (higher is better)",
  },
  "runtime.test_mgmt.chart.glasgow": {
    source: "Glasgow Coma Scale (X/15)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Glasgow Coma Scale (X/15)",
  },
  "runtime.test_mgmt.chart.maddocks": {
    source: "Maddocks Score (X/5)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Maddocks Score (X/5)",
  },
  "runtime.test_mgmt.chart.orientation": {
    source: "Orientation (X/5)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Orientation (X/5)",
  },
  "runtime.test_mgmt.chart.immediate_memory": {
    source: "Immediate Memory (X/30)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Immediate Memory (X/30)",
  },
  "runtime.test_mgmt.chart.concentration": {
    source: "Concentration (X/5)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Concentration (X/5)",
  },
  "runtime.test_mgmt.chart.delayed_recall": {
    source: "Delayed Recall (X/10)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Delayed Recall (X/10)",
  },
  "runtime.test_mgmt.chart.cognitive_total": {
    source: "Cognitive Total (X/50)",
    locations: ["public/scripts.js showAthleteResults chart dataset"],
    value: "Cognitive Total (X/50)",
  },
  "runtime.common.yes": {
    source: "Yes",
    locations: ["public/results.js"],
    value: "Yes",
  },
  "runtime.common.no": {
    source: "No",
    locations: ["public/results.js"],
    value: "No",
  },
  "runtime.common.na": {
    source: "N/A",
    locations: ["public/results.js"],
    value: "N/A",
  },
  "runtime.common.yes_upper": {
    source: "YES",
    locations: ["public/results.js report"],
    value: "YES",
  },
  "runtime.common.no_upper": {
    source: "NO",
    locations: ["public/results.js report"],
    value: "NO",
  },
  "runtime.sources.title": {
    source: "Sources",
    locations: ["public/util/popup.js showSources"],
    value: "Sources",
  },
  "runtime.sources.scat6_supplement": {
    source: "SCAT6 Supplementary Material",
    locations: ["public/util/popup.js showSources"],
    value: "SCAT6 Supplementary Material",
  },
  "runtime.sources.concussion_training": {
    source: "Concussion training and information",
    locations: ["public/util/popup.js showSources"],
    value: "Concussion training and information",
  },
  "runtime.sources.bess_manual": {
    source: "BESS Manual",
    locations: ["public/util/popup.js showSources"],
    value: "BESS Manual",
  },
  "runtime.sources.healthy_risk_bess_tandem_dual": {
    source: "Healthy/risk ranges for BESS, tandem and dual gait",
    locations: ["public/util/popup.js showSources"],
    value: "Healthy/risk ranges for BESS, tandem and dual gait",
  },
  "runtime.sources.healthy_risk_memory": {
    source: "Healthy/risk ranges for immediate/delayed recall",
    locations: ["public/util/popup.js showSources"],
    value: "Healthy/risk ranges for immediate/delayed recall",
  },
  "runtime.sources.symptom_severity_study": {
    source: "Symptom severity study",
    locations: ["public/util/popup.js showSources"],
    value: "Symptom severity study",
  },
  "runtime.sources.scat6_results_study": {
    source: "SCAT6 results study",
    locations: ["public/util/popup.js showSources"],
    value: "SCAT6 results study",
  },
  "runtime.results.table.domain": {
    source: "Domain",
    locations: ["public/results.js results table header"],
    value: "Domain",
  },
  "runtime.results.table.current_score": {
    source: "Current Score",
    locations: ["public/results.js results table header"],
    value: "Current Score",
  },
  "runtime.results.table.last_baseline": {
    source: "Last Baseline",
    locations: ["public/results.js results table header"],
    value: "Last Baseline",
  },
  "runtime.results.table.last_post_injury": {
    source: "Last Post-Injury",
    locations: ["public/results.js results table header"],
    value: "Last Post-Injury",
  },
  "runtime.results.table.healthy_range": {
    source: "Healthy Range",
    locations: ["public/results.js results table header"],
    value: "Healthy Range",
  },
  "runtime.results.table.increased_risk_range": {
    source: "Increased Risk Range",
    locations: ["public/results.js results table header"],
    value: "Increased Risk Range",
  },
  "runtime.results.row.date": {
    source: "Date",
    locations: ["public/results.js results table row label"],
    value: "Date",
  },
  "runtime.results.row.symptoms": {
    source: "Symptoms (of 22)",
    locations: ["public/results.js results table row label"],
    value: "Symptoms (of 22)",
  },
  "runtime.results.row.severity": {
    source: "Severity (of 132)",
    locations: ["public/results.js results table row label"],
    value: "Severity (of 132)",
  },
  "runtime.results.range.low": {
    source: "low",
    locations: ["public/results.js symptom severity range"],
    value: "low",
  },
  "runtime.results.range.moderate": {
    source: "moderate",
    locations: ["public/results.js symptom severity range"],
    value: "moderate",
  },
  "runtime.results.range.high": {
    source: "high",
    locations: ["public/results.js symptom severity range"],
    value: "high",
  },
  "runtime.results.row.orientation": {
    source: "Orientation (of 5)",
    locations: ["public/results.js results table row label"],
    value: "Orientation (of 5)",
  },
  "runtime.results.row.immediate_memory": {
    source: "Immediate Memory (of 30)",
    locations: ["public/results.js results table row label"],
    value: "Immediate Memory (of 30)",
  },
  "runtime.results.row.concentration": {
    source: "Concentration (of 5)",
    locations: ["public/results.js results table row label"],
    value: "Concentration (of 5)",
  },
  "runtime.results.row.delayed_recall": {
    source: "Delayed Recall (of 10)",
    locations: ["public/results.js results table row label"],
    value: "Delayed Recall (of 10)",
  },
  "runtime.results.row.recall_delay": {
    source: "Recall Delay (seconds)",
    locations: ["public/results.js results table row label"],
    value: "Recall Delay (seconds)",
  },
  "runtime.results.row.cognitive_total": {
    source: "Cognitive Total (of 50)",
    locations: ["public/results.js results table row label"],
    value: "Cognitive Total (of 50)",
  },
  "runtime.results.row.bess": {
    source: "BESS (of 30)",
    locations: ["public/results.js results table row label"],
    value: "BESS (of 30)",
  },
  "runtime.results.row.bess_foam": {
    source: "BESS Foam (of 30)",
    locations: ["public/results.js results table row label"],
    value: "BESS Foam (of 30)",
  },
  "runtime.results.row.tandem_fastest": {
    source: "Tandem Gait Fastest (sec)",
    locations: ["public/results.js results table row label"],
    value: "Tandem Gait Fastest (sec)",
  },
  "runtime.results.row.dual_task_fastest": {
    source: "Dual Task Fastest (sec)",
    locations: ["public/results.js results table row label"],
    value: "Dual Task Fastest (sec)",
  },
  "runtime.results.row.dual_task_accuracy": {
    source: "Dual Task Accuracy (%)",
    locations: ["public/results.js results table row label"],
    value: "Dual Task Accuracy (%)",
  },
  "runtime.results.different_prompt": {
    source:
      "If the athlete was known to you prior to their injury, are they different from their usual self?",
    locations: ["public/results.js different from normal prompt"],
    value:
      "If the athlete was known to you prior to their injury, are they different from their usual self?",
  },
  "runtime.results.decision_title": {
    source: "Decision",
    locations: ["public/results.js decision section"],
    value: "Decision",
  },
  "runtime.results.diagnosed_prompt": {
    source: "Concussion diagnosed?",
    locations: ["public/results.js decision section"],
    value: "Concussion diagnosed?",
  },
  "runtime.results.deferred": {
    source: "Deferred",
    locations: ["public/results.js decision section"],
    value: "Deferred",
  },
  "runtime.results.notes": {
    source: "Notes",
    locations: ["public/results.js notes label"],
    value: "Notes",
  },
  "runtime.results.hcp_attestation_title": {
    source: "Health Care Professional Attestation",
    locations: ["public/results.js attestation section"],
    value: "Health Care Professional Attestation",
  },
  "runtime.results.hcp_attestation_body": {
    source:
      "I am an HCP and I have personally administered or supervised the administration of this SCAT6.",
    locations: ["public/results.js attestation section"],
    value:
      "I am an HCP and I have personally administered or supervised the administration of this SCAT6.",
  },
  "runtime.results.name": {
    source: "Name",
    locations: ["public/results.js labels"],
    value: "Name",
  },
  "runtime.results.title_specialty": {
    source: "Title/Specialty",
    locations: ["public/results.js labels"],
    value: "Title/Specialty",
  },
  "runtime.results.registration_license": {
    source: "Registration/License Number (if applicable)",
    locations: ["public/results.js labels"],
    value: "Registration/License Number (if applicable)",
  },
  "runtime.results.signature_date": {
    source: "Signature Date",
    locations: ["public/results.js labels"],
    value: "Signature Date",
  },
  "runtime.results.signature_checkbox": {
    source: "Checking this box is equivalent to signing a paper SCAT6",
    locations: ["public/results.js labels"],
    value: "Checking this box is equivalent to signing a paper SCAT6",
  },
  "runtime.results.export.choose": {
    source: "Choose an export option:",
    locations: ["public/results.js export fallback select"],
    value: "Choose an export option:",
  },
  "runtime.results.export.overall_report": {
    source: "Overall Report",
    locations: ["public/results.js export fallback select"],
    value: "Overall Report",
  },
  "runtime.results.export.full_scat6": {
    source: "Full SCAT6",
    locations: ["public/results.js export fallback select"],
    value: "Full SCAT6",
  },
  "runtime.results.export.raw_csv": {
    source: "Raw CSV",
    locations: ["public/results.js export fallback select"],
    value: "Raw CSV",
  },
  "runtime.results.export.cancel": {
    source: "Cancel",
    locations: ["public/results.js export fallback select"],
    value: "Cancel",
  },
  "runtime.results.export.failed_load_template": {
    source: "Failed to load the SCAT6 template.",
    locations: ["public/results.js exportSCAT6pdf fetch fail"],
    value: "Failed to load the SCAT6 template.",
  },
  "runtime.results.report.title_for": {
    source: "SCAT6 report for {{athleteName}}",
    locations: ["public/results.js generateReportHTML title"],
    value: "SCAT6 report for {{athleteName}}",
  },
  "runtime.results.report.test_active": {
    source: "Test Active",
    locations: ["public/results.js generateReportHTML"],
    value: "Test Active",
  },
  "runtime.results.report.test_type": {
    source: "Test Type",
    locations: ["public/results.js generateReportHTML"],
    value: "Test Type",
  },
  "runtime.results.report.injury_time": {
    source: "Injury Time",
    locations: ["public/results.js generateReportHTML"],
    value: "Injury Time",
  },
  "runtime.results.report.examiner": {
    source: "Examiner",
    locations: ["public/results.js generateReportHTML"],
    value: "Examiner",
  },
  "runtime.results.report.examiner_credentials": {
    source: "Examiner Credentials",
    locations: ["public/results.js generateReportHTML"],
    value: "Examiner Credentials",
  },
  "runtime.results.report.signed": {
    source: "Signed",
    locations: ["public/results.js generateReportHTML"],
    value: "Signed",
  },
  "runtime.results.report.primary_symptoms": {
    source: "Primary Symptoms",
    locations: ["public/results.js generateReportHTML"],
    value: "Primary Symptoms",
  },
  "runtime.results.report.feels_normal": {
    source: "Feels Normal",
    locations: ["public/results.js generateReportHTML"],
    value: "Feels Normal",
  },
  "runtime.results.report.worse_physical": {
    source: "Worse with Physical Activity",
    locations: ["public/results.js generateReportHTML"],
    value: "Worse with Physical Activity",
  },
  "runtime.results.report.worse_mental": {
    source: "Worse with Mental Activity",
    locations: ["public/results.js generateReportHTML"],
    value: "Worse with Mental Activity",
  },
  "runtime.results.report.symptom_description": {
    source: "Symptom Description",
    locations: ["public/results.js generateReportHTML"],
    value: "Symptom Description",
  },
  "runtime.results.report.different_from_normal": {
    source: "Different from Normal",
    locations: ["public/results.js generateReportHTML"],
    value: "Different from Normal",
  },
  "runtime.results.report.concussion_diagnosis": {
    source: "Concussion Diagnosis",
    locations: ["public/results.js generateReportHTML"],
    value: "Concussion Diagnosis",
  },
  "runtime.results.report.athlete_info": {
    source: "Athlete Information",
    locations: ["public/results.js generateReportHTML"],
    value: "Athlete Information",
  },
  "runtime.results.report.birth": {
    source: "Birth",
    locations: ["public/results.js generateReportHTML"],
    value: "Birth",
  },
  "runtime.results.report.sex": {
    source: "Sex",
    locations: ["public/results.js generateReportHTML"],
    value: "Sex",
  },
  "runtime.results.report.dominant_hand": {
    source: "Dominant Hand",
    locations: ["public/results.js generateReportHTML"],
    value: "Dominant Hand",
  },
  "runtime.results.report.year_in_school": {
    source: "Year in School",
    locations: ["public/results.js generateReportHTML"],
    value: "Year in School",
  },
  "runtime.results.report.years_education": {
    source: "Years of Education",
    locations: ["public/results.js generateReportHTML"],
    value: "Years of Education",
  },
  "runtime.results.report.first_language": {
    source: "First Language",
    locations: ["public/results.js generateReportHTML"],
    value: "First Language",
  },
  "runtime.results.report.preferred_language": {
    source: "Preferred Language",
    locations: ["public/results.js generateReportHTML"],
    value: "Preferred Language",
  },
  "runtime.results.report.team_school": {
    source: "Team/School",
    locations: ["public/results.js generateReportHTML"],
    value: "Team/School",
  },
  "runtime.results.report.past_concussions": {
    source: "Number of Past Concussions",
    locations: ["public/results.js generateReportHTML"],
    value: "Number of Past Concussions",
  },
  "runtime.results.report.most_recent_concussion": {
    source: "Most Recent Concussion",
    locations: ["public/results.js generateReportHTML"],
    value: "Most Recent Concussion",
  },
  "runtime.results.report.most_recent_recovery_time": {
    source: "Most Recent Recovery Time",
    locations: ["public/results.js generateReportHTML"],
    value: "Most Recent Recovery Time",
  },
  "runtime.results.report.days": {
    source: "days",
    locations: ["public/results.js generateReportHTML"],
    value: "days",
  },
  "runtime.results.report.mbess_error_photos": {
    source: "mBESS Error Photos",
    locations: ["public/results.js generateReportHTML"],
    value: "mBESS Error Photos",
  },
  "runtime.results.report.no_pose_error_photos": {
    source: "No pose error photos taken for this test.",
    locations: ["public/results.js generateReportHTML"],
    value: "No pose error photos taken for this test.",
  },
  "runtime.results.report.double_leg_errors": {
    source: "Double-Leg Errors",
    locations: ["public/results.js generateReportHTML"],
    value: "Double-Leg Errors",
  },
  "runtime.results.report.tandem_errors": {
    source: "Tandem Errors",
    locations: ["public/results.js generateReportHTML"],
    value: "Tandem Errors",
  },
  "runtime.results.report.single_leg_errors": {
    source: "Single-Leg Errors",
    locations: ["public/results.js generateReportHTML"],
    value: "Single-Leg Errors",
  },
  "runtime.results.report.double_leg_foam_errors": {
    source: "Double-Leg Foam Errors",
    locations: ["public/results.js generateReportHTML"],
    value: "Double-Leg Foam Errors",
  },
  "runtime.results.report.tandem_foam_errors": {
    source: "Tandem Foam Errors",
    locations: ["public/results.js generateReportHTML"],
    value: "Tandem Foam Errors",
  },
  "runtime.results.report.single_leg_foam_errors": {
    source: "Single-Leg Foam Errors",
    locations: ["public/results.js generateReportHTML"],
    value: "Single-Leg Foam Errors",
  },
};

function slugify(source) {
  const cleaned = source
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return cleaned || "text";
}

function simpleHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function shouldIgnoreText(text) {
  if (!text) return true;
  if (!text.trim()) return true;
  if (text.includes("__SCAT6_PROTECTED_")) return true;
  if (!/[A-Za-z]/.test(text)) return true;
  if (/^[\u00a0\s\|]+$/.test(text)) return true;
  if (/^(\{|\}|\[|\]|\(|\)|\+|\-|\/|\*)+$/.test(text.trim())) return true;
  return false;
}

function findLine(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= index) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return hi + 1;
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function protectNonTranslatableBlocks(html) {
  const blocks = [];
  const tokenized = html.replace(
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,
    (match) => {
      const token = `__SCAT6_PROTECTED_${blocks.length}__`;
      blocks.push(match);
      return token;
    }
  );
  return { tokenized, blocks };
}

function restoreProtectedBlocks(html, blocks) {
  let out = html;
  for (let i = 0; i < blocks.length; i += 1) {
    out = out.replace(`__SCAT6_PROTECTED_${i}__`, blocks[i]);
  }
  return out;
}

function extractTextEntries(filePath, html) {
  const entries = new Map();
  const lines = lineStarts(html);
  const { tokenized } = protectNonTranslatableBlocks(html);
  const textNodeRegex = />([^<>]+)</g;
  let match = textNodeRegex.exec(tokenized);

  while (match) {
    const source = match[1].replace(/\s+/g, " ").trim();
    if (!shouldIgnoreText(source)) {
      const entryId = `html.${slugify(source)}.${simpleHash(source)}`;
      const line = findLine(lines, match.index);
      const loc = `${relative(ROOT, filePath)}:${line}`;
      if (!entries.has(entryId)) {
        entries.set(entryId, { source, locations: [loc], value: source });
      } else {
        entries.get(entryId).locations.push(loc);
      }
    }
    match = textNodeRegex.exec(tokenized);
  }

  // Include translatable HTML attributes that are user-visible.
  const attrRegex = /\b(?:placeholder|aria-label|title)\s*=\s*"([^"]+)"/g;
  let attrMatch = attrRegex.exec(tokenized);
  while (attrMatch) {
    const source = attrMatch[1].replace(/\s+/g, " ").trim();
    if (!shouldIgnoreText(source)) {
      const entryId = `html_attr.${slugify(source)}.${simpleHash(source)}`;
      const line = findLine(lines, attrMatch.index);
      const loc = `${relative(ROOT, filePath)}:${line}`;
      if (!entries.has(entryId)) {
        entries.set(entryId, { source, locations: [loc], value: source });
      } else {
        entries.get(entryId).locations.push(loc);
      }
    }
    attrMatch = attrRegex.exec(tokenized);
  }

  return entries;
}

function ensureAbsoluteAssetPaths(html) {
  let out = html;
  out = out.replace(
    /(["'`])\.\/(assets|lib|bess\.js|tandem-gait\.js|dual-task\.js|delayed-recall\.js|results\.js|scripts\.js|styles\.css|404\.html)/g,
    "$1/$2"
  );
  out = out.replace(/(["'`])assets\//g, "$1/assets/");
  out = out.replace(/(["'`])lib\//g, "$1/lib/");
  out = out.replace(/(["'`])styles\.css\1/g, "$1/styles.css$1");
  out = out.replace(/(["'`])scripts\.js\1/g, "$1/scripts.js$1");
  out = out.replace(/import\('\.\/(lib|util|assets)\//g, "import('/$1/");
  return out;
}

function injectLanguageControls(html) {
  const languageControl = /* html */ `
    <label id="language-globe-button" class="language-globe-button">
        <i class="fa-solid fa-globe"></i>
        <select id="language-select"
                class="language-select"
                aria-label="Select language">
        </select>
    </label>`;

  const target = '<button class="button button--red" id="delete-all-button">';
  if (!html.includes('id="language-menu-button"') && html.includes(target)) {
    html = html.replace(target, `${languageControl}\n            ${target}`);
  }
  return html;
}

function injectI18nRuntime(html, languageCode, languageLabel, language) {
  const runtimeStrings = Object.fromEntries(
    Object.entries(language.runtime ?? {}).map(([key, value]) => [
      key,
      value.value,
    ])
  );

  const messages = {};
  for (const entry of Object.values(language.entries ?? {}))
    messages[entry.source] = entry.value;
  for (const entry of Object.values(language.runtime ?? {}))
    messages[entry.source] = entry.value;

  const configScript = /* html */ `
    <script>
        window.__SCAT6_I18N = {
            language: ${JSON.stringify(languageCode)},
            languageLabel: ${JSON.stringify(languageLabel)},
            defaultLanguage: ${JSON.stringify(defaultLanguage)},
            supportedLanguages: ${JSON.stringify(supportedLanguages)},
            storageKey: "scat6.language",
            runtime: ${JSON.stringify(runtimeStrings)},
            messages: ${JSON.stringify(messages)}
        };
        window.__scat6T = (key, fallback = "") => window.__SCAT6_I18N?.runtime?.[key] ?? fallback;
        window.__scat6Format = (key, vars = {}, fallback = "") => {
            const template = window.__scat6T(key, fallback);
            return template.replace(/\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}/g, (_, name) => String(vars[name] ?? ""));
        };
        window.__scat6TranslateText = (source) => window.__SCAT6_I18N?.messages?.[source] ?? source;
        window.__scat6TranslateInElement = (root) => {
            if (!root) return;
            const skip = new Set(["SCRIPT", "STYLE"]);
            const translateChunk = (chunk) => {
                const normalized = chunk.replace(/\\s+/g, " ").trim();
                if (!normalized) return chunk;
                const translated = window.__scat6TranslateText(normalized);
                if (translated === normalized) return chunk;
                const lead = chunk.match(/^\\s*/)?.[0] ?? "";
                const tail = chunk.match(/\\s*$/)?.[0] ?? "";
                return lead + translated + tail;
            };

            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                if (!skip.has(node.parentElement?.tagName)) {
                    node.textContent = translateChunk(node.textContent ?? "");
                }
                node = walker.nextNode();
            }

            const attrs = ["placeholder", "aria-label", "title"];
            if (root.querySelectorAll) {
                root.querySelectorAll("*").forEach((el) => {
                    attrs.forEach((attr) => {
                        const value = el.getAttribute(attr);
                        if (!value) return;
                        const translated = window.__scat6TranslateText(value);
                        if (translated !== value) el.setAttribute(attr, translated);
                    });
                });
            }
        };
    </script>
    <script>
        (function initializeLanguageSelector() {
            const cfg = window.__SCAT6_I18N;
            const path = window.location.pathname;
            const suffix = window.location.search + window.location.hash;
            const saved = localStorage.getItem(cfg.storageKey);
            const supported = new Set(cfg.supportedLanguages.map((lang) => lang.code));
            const active = supported.has(saved) ? saved : cfg.defaultLanguage;
            const toPath = (code) => (code === cfg.defaultLanguage ? '/index.html' : '/' + code + '/index.html');

            if ((path === '/' || path === '/index.html') && active !== cfg.defaultLanguage) {
                window.location.replace(toPath(active) + suffix);
                return;
            }

            localStorage.setItem(cfg.storageKey, cfg.language);
            window.addEventListener('DOMContentLoaded', () => {
                window.__scat6TranslateInElement(document.body);

                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) window.__scat6TranslateInElement(node);
                        });
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });

                const globeButton = document.getElementById('language-globe-button');
                const select = document.getElementById('language-select');
                if (!globeButton || !select) return;

                globeButton.setAttribute(
                  'aria-label',
                  window.__scat6T('runtime.lang.aria', 'Select language')
                );

                // Populate select options
                console.log("Supported", cfg.supportedLanguages)
                cfg.supportedLanguages.forEach((lang) => {
                    const option = document.createElement('option');
                    option.value = lang.code;
                    option.textContent = lang.label;
                    if (lang.code === cfg.language) option.selected = true;
                    select.appendChild(option);
                });

                // Clicking globe opens native select
                globeButton.addEventListener('click', () => {
                    select.focus();
                    select.click();
                });

                select.addEventListener('change', () => {
                    const next = select.value;
                    if (!supported.has(next)) return;
                    localStorage.setItem(cfg.storageKey, next);
                    window.location.assign(toPath(next) + suffix);
                });
            });
        })();
    </script>`;

  return html.replace("</head>", `${configScript}\n  </head>`);
}

function translateHtmlTextNodes(html, translationMap) {
  const { tokenized, blocks } = protectNonTranslatableBlocks(html);
  let translated = tokenized.replace(/>([^<>]+)</g, (full, chunk) => {
    const normalized = chunk.replace(/\s+/g, " ").trim();
    if (shouldIgnoreText(normalized)) return full;
    if (!Object.hasOwn(translationMap, normalized)) return full;
    const lead = chunk.match(/^\s*/)?.[0] ?? "";
    const tail = chunk.match(/\s*$/)?.[0] ?? "";
    return `>${lead}${translationMap[normalized]}${tail}<`;
  });

  translated = translated.replace(
    /\b(placeholder|aria-label|title)\s*=\s*"([^"]+)"/g,
    (full, attr, value) => {
      const normalized = value.replace(/\s+/g, " ").trim();
      if (!normalized) return full;
      if (!Object.hasOwn(translationMap, normalized)) return full;
      return `${attr}="${translationMap[normalized]}"`;
    }
  );

  return restoreProtectedBlocks(translated, blocks);
}

function sortObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

function loadLocale(languageCode, catalogEntries) {
  const localePath = join(TRANSLATIONS_DIR, `${languageCode}.json`);
  const existing = existsSync(localePath)
    ? JSON.parse(readFileSync(localePath, "utf8"))
    : { meta: {}, entries: {}, runtime: {} };

  const entries = {};
  for (const [key, entry] of Object.entries(catalogEntries)) {
    const previous = existing.entries?.[key];
    entries[key] = {
      source: entry.source,
      locations: entry.locations,
      value: previous?.value ?? entry.source,
    };
  }

  const runtime = {};
  for (const [key, entry] of Object.entries(runtimeEntries)) {
    const previous = existing.runtime?.[key];
    runtime[key] = {
      source: entry.source,
      locations: entry.locations,
      value: previous?.value ?? entry.value,
    };
  }

  const out = {
    meta: {
      language: languageCode,
      defaultLanguage,
      generatedAt: new Date().toISOString(),
      note: "Each entry stores the English source text, all known locations, and the translated value for this language.",
    },
    entries: sortObject(entries),
    runtime: sortObject(runtime),
  };

  writeFileSync(localePath, `${JSON.stringify(out, null, 2)}\n`);
  return out;
}

function buildCatalog() {
  const templates = [join(TEMPLATE_DIR, "index.template.html")];

  const all = new Map();
  for (const templatePath of templates) {
    const html = readFileSync(templatePath, "utf8");
    const extracted = extractTextEntries(templatePath, html);
    for (const [key, value] of extracted.entries()) {
      if (!all.has(key)) {
        all.set(key, value);
      } else {
        all.get(key).locations.push(...value.locations);
      }
    }
  }

  return sortObject(Object.fromEntries(all));
}

function writeOutput(language, localeData) {
  const langCode = language.code;
  const langLabel = language.label;

  const translationMap = {};
  for (const entry of Object.values(localeData.entries ?? {})) {
    translationMap[entry.source] = entry.value;
  }

  const templates = [
    {
      input: join(TEMPLATE_DIR, "index.template.html"),
      output:
        langCode === defaultLanguage
          ? join(PUBLIC_DIR, "index.html")
          : join(PUBLIC_DIR, langCode, "index.html"),
      injectSelector: true,
      injectRuntime: true,
    },
  ];

  for (const item of templates) {
    let html = readFileSync(item.input, "utf8");
    html = ensureAbsoluteAssetPaths(html);
    if (item.injectSelector) html = injectLanguageControls(html);
    if (item.injectRuntime)
      html = injectI18nRuntime(html, langCode, langLabel, localeData);
    html = translateHtmlTextNodes(html, translationMap);
    html = html.replace(/<html([^>]*)>/, (_, attrs) => {
      const cleaned = attrs.replace(/\s+lang="[^"]*"/g, '');
      return `<html${cleaned} lang="${langCode}">`;
    });
    mkdirSync(dirname(item.output), { recursive: true });
    writeFileSync(item.output, `${GENERATED_MARKER}\n${html}`);
  }
}

function writePublicLocale(languageCode, localeData) {
  mkdirSync(PUBLIC_TRANSLATIONS_DIR, { recursive: true });
  writeFileSync(
    join(PUBLIC_TRANSLATIONS_DIR, `${languageCode}.json`),
    `${JSON.stringify(localeData, null, 2)}\n`
  );
}

function cleanOldLanguageDirectories() {
  for (const entry of readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (supportedLanguages.some((lang) => lang.code === entry.name)) {
      rmSync(join(PUBLIC_DIR, entry.name), { recursive: true, force: true });
    }
  }
}

function main() {
  mkdirSync(TRANSLATIONS_DIR, { recursive: true });

  const catalog = buildCatalog();
  writeFileSync(
    join(I18N_DIR, "catalog.en.json"),
    `${JSON.stringify(
      {
        meta: {
          language: "en",
          generatedAt: new Date().toISOString(),
          note: "Generated from templates. Keys are deduplicated by normalized source text. Duplicate phrases are kept as one entry unless manually split by meaning.",
        },
        entries: catalog,
      },
      null,
      2
    )}\n`
  );

  cleanOldLanguageDirectories();

  for (const language of supportedLanguages) {
    const locale = loadLocale(language.code, catalog);
    writePublicLocale(language.code, locale);
    writeOutput(language, locale);
  }
}

main();

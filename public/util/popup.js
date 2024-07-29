export async function alert(message) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
    <p>${message}</p>
    <button class="button">OK</button>
  `;
    dialog.lastElementChild.onclick = () => {
      dialog.remove();
      resolve();
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
window.alert = alert;

export async function confirm(message) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <p>${message}</p>
      <button class="button">OK</button>
      <button class="button button--red">CANCEL</button>
    `;
    dialog.children[1].onclick = () => {
      dialog.remove();
      resolve(true);
    };
    dialog.lastElementChild.onclick = () => {
      dialog.remove();
      resolve(false);
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
window.confirm = confirm;

export async function prompt(message) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <p>${message}</p>
      <input type="text" />
      <button class="button">OK</button>
      <button class="button button--red">CANCEL</button>
    `;
    dialog.children[2].onclick = () => {
      dialog.remove();
      resolve(dialog.children[1].value);
    };
    dialog.lastElementChild.onclick = () => {
      dialog.remove();
      resolve(null);
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
window.prompt = prompt;

export async function syncSettings(name, email, status) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <p>Connected to ${name} (${email})</p>
      <p>${status}</p>
      <button class="button button--red" data-action="UNLINK">Unlink Device</button>
      <button class="button button--red" data-action="DELETE_DRIVE">Stop Sync</button>
      <button class="button" data-action="STAY_SYNCED">Close Settings</button>
    `;
    dialog.onclick = (e) => {
      if (e.target.tagName === "BUTTON") {
        dialog.remove();
        resolve(e.target.dataset.action);
      }
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

/** @typedef {import('../scripts.js').Test} Test */
/**
 * Prompts the user to start a new test. Returns the test metadata (athlete name, timestamps, etc.) if the user confirms, null otherwise.
 * @param {Test[]} pastTests the list of tests that have been recorded so far for this athlete, sorted by timestamp ascending
 */
export async function confirmAthleteInfo(
  pastTests,
  defaultExaminerName = "Alex M"
) {
  const test_id = window.crypto.randomUUID();
  const test_created_at = Date.now();
  const test_updated_at = Date.now();
  const athlete_id = pastTests.at(-1)?.athlete_id ?? window.crypto.randomUUID();
  const athlete_name =
    pastTests.at(-1)?.athlete_name ??
    ["Tyler", "Michael", "Taylor", "Emily"][Math.floor(Math.random() * 4)];
  const athlete_birth_timestamp =
    pastTests.at(-1)?.athlete_birth_timestamp ??
    Date.now() - 16 * 365 * 24 * 60 * 60 * 1000;
  const athlete_sex =
    pastTests.at(-1)?.athlete_sex ?? ["Tyler", "Michael"].includes(athlete_name)
      ? "Male"
      : "Female";
  const athlete_dominant_hand =
    pastTests.at(-1)?.athlete_dominant_hand ?? "Right";
  const examiner_name = pastTests.at(-1)?.examiner_name ?? defaultExaminerName;
  const team_or_school =
    pastTests.at(-1)?.team_or_school ??
    "Varsity Cello Music at Aureole High School";
  const injury_timestamp = Date.now();
  const num_past_concussions =
    pastTests.length > 0
      ? pastTests.at(-1)?.num_past_concussions +
        (pastTests.at(-1).test_type == "IMMEDIATE" ? 1 : 0)
      : 2;
  const most_recent_concussion_timestamp =
    pastTests.at(-1)?.injury_timestamp ?? Date.now() - 80 * 24 * 60 * 60 * 1000;
  const most_recent_recovery_time_days =
    pastTests.at(-1)?.most_recent_recovery_time_days ?? 10;
  const primary_symptoms =
    pastTests.at(-1)?.primary_symptoms ??
    "Confusion, Headache, Double/Blurry Vision, Dizziness/Imbalance, Nausea/Vomiting, Memory Loss, Ringing Ears, Difficulty Concentrating, Sensitivity to Light, Loss of Smell/Taste, Trouble Sleeping";
  const hospitalized_for_head_injury =
    pastTests.at(-1)?.hospitalized_for_head_injury ?? false;
  const diagnosed_headache_disorder_or_migraine =
    pastTests.at(-1)?.diagnosed_headache_disorder_or_migraine ?? false;
  const diagnosed_learning_disability_or_dyslexia =
    pastTests.at(-1)?.diagnosed_learning_disability_or_dyslexia ?? false;
  const diagnosed_attention_deficit_disorder =
    pastTests.at(-1)?.diagnosed_attention_deficit_disorder ?? false;
  const diagnosed_psychological_disorder =
    pastTests.at(-1)?.diagnosed_psychological_disorder ?? false;
  const current_medications = pastTests.at(-1)?.current_medications ?? "";
  const notes = pastTests.at(-1)?.notes ?? "";

  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <h3>${
        pastTests.length == 0
          ? "Enter Athlete Information"
          : "Confirm Athlete Information"
      }</h3>
      <label class="left-align spread-inline">Athlete Name: <input type="text" placeholder="Athlete name" value="${athlete_name}" id="athlete_name" /></label>
      <label class="left-align spread-inline">ID Number: <input type="text" placeholder="Unique ID" value="${athlete_id}" id="athlete_id" /></label>
      <label class="left-align spread-inline">Time of Injury (if applicable): <input type="datetime-local" value="${
        new Date(injury_timestamp - new Date().getTimezoneOffset() * 60 * 1000)
          .toISOString()
          .split(".")[0]
      }" id="injury_timestamp" /></label>
      <label class="left-align spread-inline">Date of Birth: <input type="date" value="${
        new Date(athlete_birth_timestamp).toISOString().split("T")[0]
      }" id="athlete_birth_timestamp" /></label>
      <label class="left-align spread-inline">Sex: <select id="athlete_sex">
        <option value="Male" ${
          athlete_sex === "Male" ? "selected" : ""
        }>Male</option>
        <option value="Female" ${
          athlete_sex === "Female" ? "selected" : ""
        }>Female</option>
        <option value="Prefer Not To Say" ${
          athlete_sex === "Prefer Not To Say" ? "selected" : ""
        }>Prefer Not To Say</option>
        <option value="Other" ${
          athlete_sex === "Other" ? "selected" : ""
        }>Other</option>
      </select></label>
      <label class="left-align spread-inline">Dominant Hand: <select id="athlete_dominant_hand">
        <option value="Right" ${
          athlete_dominant_hand === "Right" ? "selected" : ""
        }>Right</option>
        <option value="Left" ${
          athlete_dominant_hand === "Left" ? "selected" : ""
        }>Left</option>
        <option value="Ambidextrous" ${
          athlete_dominant_hand === "Ambidextrous" ? "selected" : ""
        }>Ambidextrous</option>
      </select></label>
      <label class="left-align spread-inline">Examiner Name: <input type="text" placeholder="Examiner name" value="${examiner_name}" id="examiner_name" /></label>
      <label class="left-align spread-inline">Team or School: <input type="text" placeholder="Team or school" value="${team_or_school}" id="team_or_school" /></label>
      
      <h4>Concussion History</h4>
      <label class="left-align spread-inline">Number of Past Concussions: <input type="number" value="${num_past_concussions}" id="num_past_concussions" /></label>
      <label class="left-align spread-inline">Most Recent Concussion Date: <input type="date" value="${
        new Date(most_recent_concussion_timestamp).toISOString().split("T")[0]
      }" id="most_recent_concussion_timestamp" /></label>
      <label class="left-align spread-inline">Most Recent Recovery Time (days): <input type="number" value="${most_recent_recovery_time_days}" id="most_recent_recovery_time_days" /></label>
      <label class="left-align spread-inline">Primary Symptoms: <input type="text" placeholder="Symptoms" class="fill-spread" value="${primary_symptoms}" id="primary_symptoms" /></label>
      
      <h4>Medical Background</h4>
      <p style="margin-top: 0">Has the athlete ever been (if yes, describe below):</p>
      <label class="left-align spread-inline" style="flex-wrap: nowrap">Hospitalized for head injury: <input type="checkbox" ${
        hospitalized_for_head_injury ? "checked" : ""
      } id="hospitalized_for_head_injury" /></label>
      <label class="left-align spread-inline" style="flex-wrap: nowrap">Diagnosed with a headache disorder or migraine: <input type="checkbox" ${
        diagnosed_headache_disorder_or_migraine ? "checked" : ""
      } id="diagnosed_headache_disorder_or_migraine" /></label>
      <label class="left-align spread-inline" style="flex-wrap: nowrap">Diagnosed with a learning disability or dyslexia: <input type="checkbox" ${
        diagnosed_learning_disability_or_dyslexia ? "checked" : ""
      } id="diagnosed_learning_disability_or_dyslexia" /></label>
      <label class="left-align spread-inline" style="flex-wrap: nowrap">Diagnosed with attention deficit hyperactivity disorder (ADHD): <input type="checkbox" ${
        diagnosed_attention_deficit_disorder ? "checked" : ""
      } id="diagnosed_attention_deficit_disorder" /></label>
      <label class="left-align spread-inline" style="flex-wrap: nowrap">Diagnosed with depression, anxiety or a psychological disorder: <input type="checkbox" ${
        diagnosed_psychological_disorder ? "checked" : ""
      } id="diagnosed_psychological_disorder" /></label>
      <label class="left-align spread-inline" style="margin-top: 0.8em">Current Medications: <input type="text" placeholder="List medications" class="fill-spread" value="${current_medications}" id="current_medications" /></label>
      <label class="left-align spread-inline">Notes: <input type="text" placeholder="Describe any selections above" class="fill-spread" value="${notes}" id="notes" /></label>
      
      <h4>Start Assessment</h4>
      <p  style="margin-top: 0">The immediate assessment should be completed "on-field" after the first aid/emergency care priorities are completed.</p>
      <p>The "cognitive screening" portion of the baseline and post injury assessments should be completed in a distraction-free environment with the athlete in a resting state.</p>
      <button class="button button--green" data-action="IMMEDIATE">Immediate</button>
      <button class="button" data-action="BASELINE">Baseline</button>
      <button class="button" data-action="SUSPECTED/POST">Suspected/Post-Injury</button>
      <button class="button" data-action="NO-TEST">Save Info w/o Test</button>
      <button class="button button--red" data-action="CANCEL">CANCEL</button>
    `;
    dialog.onclick = (event) => {
      if (event.target.tagName !== "BUTTON") return;
      dialog.remove();
      const action = event.target.dataset.action;
      if (action === "CANCEL") return resolve(null);
      resolve({
        test_id,
        test_created_at,
        test_updated_at,
        test_type: action,
        athlete_id: dialog.querySelector("#athlete_id").value,
        athlete_name: dialog.querySelector("#athlete_name").value,
        athlete_birth_timestamp: Date.parse(
          dialog.querySelector("#athlete_birth_timestamp").value
        ),
        athlete_sex: dialog.querySelector("#athlete_sex").value,
        athlete_dominant_hand: dialog.querySelector("#athlete_dominant_hand")
          .value,
        examiner_name: dialog.querySelector("#examiner_name").value,
        team_or_school: dialog.querySelector("#team_or_school").value,
        injury_timestamp: Date.parse(
          dialog.querySelector("#injury_timestamp").value
        ),
        num_past_concussions: parseInt(
          dialog.querySelector("#num_past_concussions").value
        ),
        most_recent_concussion_timestamp: Date.parse(
          dialog.querySelector("#most_recent_concussion_timestamp").value
        ),
        most_recent_recovery_time_days: parseInt(
          dialog.querySelector("#most_recent_recovery_time_days").value
        ),
        primary_symptoms: dialog.querySelector("#primary_symptoms").value,
      });
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

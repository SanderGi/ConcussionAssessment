import { saveTestResult, endTest, renderTestSection } from "../testManager.js";

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

export async function show(imgUrl, altText) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
    <img src="${imgUrl}" alt="${altText}" style="max-width: 100%"><br>
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
window.show = show;

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

export async function prompt(message, defaultValue = "") {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <p>${message}</p>
      <input type="text" value="${defaultValue}"/>
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

export async function select(message, values) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <p>${message}</p>
      ${values
        .map(
          (v) =>
            /* html */ `<button class="button ${
              v.length > 2 ? v[2] : ""
            }" data-value="${v[0]}">${v[1]}</button>`
        )
        .join("")}
    `;
    dialog.onclick = (e) => {
      if (e.target.tagName != "BUTTON") return;
      dialog.remove();
      resolve(e.target.dataset.value);
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
window.select = select;

export async function bulkExportOptions() {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    dialog.innerHTML = /* html */ `
      <p>Select the date range of tests to bulk export:</p>
      <input type="date" value="${twoYearsAgo.toISOString().split("T")[0]}"/>
      to
      <input type="date" value="${new Date().toISOString().split("T")[0]}"/>
      <button class="button" data-value="ok">Download ZIP</button>
      <button class="button button--red" data-value="cancel">CANCEL</button>
    `;
    dialog.onclick = (e) => {
      if (e.target.tagName != "BUTTON") return;
      if (e.target.dataset.value == "ok") {
        dialog.remove();
        resolve(
          [...dialog.querySelectorAll('input[type="date"]')].map((el) =>
            new Date(el.value).getTime()
          )
        );
      }
      if (e.target.dataset.value == "cancel") {
        dialog.remove();
        resolve(null);
      }
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

export async function removeAthleteFromPlayAlert(
  next,
  message = "Remove athlete from Play for Immediate Medical Assessment or Transport to Hospital/Medical Center"
) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <p>${message}</p>
      <button class="button">END TEST</button>
      <button class="button button--orange">KEEP TESTING</button>
    `;
    dialog.children[1].onclick = async () => {
      dialog.remove();
      await endTest();
      resolve(true);
    };
    dialog.lastElementChild.onclick = () => {
      dialog.remove();
      renderTestSection(next);
      resolve(false);
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
window.removeAthleteFromPlayAlert = removeAthleteFromPlayAlert;

export async function showSources() {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <h3>Sources</h3>
      <ul style="text-align: left; margin: auto; width: fit-content">
        <li>SCAT6 Supplementary Material: <a href="./assets/SCAT6-Detailed-Instructions.pdf" target="_blank">SCAT6</a></li>
        <li>Concussion training and information: <a href="https://www.cdc.gov/headsup/index.html" target="_blank">CDC's Heads Up</a></li>
        <li>BESS Manual: <a href="https://atriumhealth.org/documents/carolinasrehab/bess_manual_.pdf" target="_blank">University of North Carolina</a></li>
        <li>Healthy/Risk ranges for BESS, Tandem and Dual Gait: <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7987555/" target="_blank">Van Deventer et al.</a></li>
        <li>Healthy/Risk ranges for Immediate/Delayed Recall: <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6109942/" target="_blank">Norheim et al.</a></li>
        <li>Symptom Severity Study: <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8583872/" target="_blank">Langer et al.</a></li>
        <li>SCAT6 Results Study: <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6326330/" target="_blank">Mistry and Rainer</a></li>
      </ul>
      <br>
      <button class="button" autofocus>OK</button>
    `;
    dialog.lastElementChild.onclick = () => {
      dialog.remove();
      resolve();
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

function getSequence(start, decrement, length) {
  return Array.from({ length }, (_, i) => start - i * decrement);
}
export async function sequencePrompt() {
  const randomStart = Math.floor(Math.random() * 16 + 84);
  const randomSequence = getSequence(randomStart, 7, 13);

  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <label class="left-align spread-inline green" style="flex-wrap: nowrap; margin-bottom: 0.4em;">Start: <input type="number" value="${randomStart}" /></label>
      <label class="left-align spread-inline green" style="flex-wrap: nowrap; margin-bottom: 0.4em;">Decrement: <input type="number" value="7" /></label>
      <label class="left-align spread-inline green" style="flex-wrap: nowrap; margin-bottom: 0.4em;">Length: <input type="number" value="13" /></label>
      <label class="left-align spread-inline green" style="flex-wrap: nowrap; margin-bottom: 0.4em;">Sequence: <input type="text" value="${randomSequence.join(
        ","
      )}" /></label>
      <button class="button">OK</button>
      <button class="button button--red">CANCEL</button>
    `;
    dialog.addEventListener("input", (e) => {
      if (e.target.tagName === "INPUT") {
        const start = parseInt(dialog.children[0].querySelector("input").value);
        const decrement = parseInt(
          dialog.children[1].querySelector("input").value
        );
        const length = parseInt(
          dialog.children[2].querySelector("input").value
        );
        const sequence = getSequence(start, decrement, length);
        dialog.children[3].querySelector("input").value = sequence.join(",");
      }
    });
    dialog.children[4].onclick = () => {
      dialog.remove();
      const answer = dialog.children[3].querySelector("input").value;
      const numbers = answer.split(",").map((n) => parseInt(n.trim()));
      numbers.reverse();
      resolve(numbers);
    };
    dialog.lastElementChild.onclick = () => {
      dialog.remove();
      resolve(null);
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

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

export async function BessConfig() {
  window.eyeAspectRatioThreshold ||= 0.013;
  window.handsOnHipThreshold ||= 0.9;
  window.standingStraightForwardThreshold ||= 1.9;
  window.standingStraightForwardLenientThreshold ||= 2.0;
  window.standingStraightSideThreshold ||= 0.3;
  window.standingStraightSideLenientThreshold ||= 0.4;
  window.feetTogetherThreshold ||= 0.5;
  window.footLiftedThreshold ||= 0.1;
  window.kneesTogetherThreshold ||= 0.5;
  window.heelToToeDepthThreshold ||= 0.1;
  window.heelToToeAlignmentThreshold ||= 0.2;
  window.elbowApartThreshold ||= 1.6;

  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <h3>BESS Configuration</h3>
      <p style="margin-top: 0">Except for the "Foot Lifted" and "Elbows Apart" thresholds, smaller is stricter and greater values are more lenient.</p>
      <label class="left-align
        spread-inline">Eye Aspect Ratio Threshold: <input type="number" value="${window.eyeAspectRatioThreshold}" id="eyeAspectRatioThreshold" /></label>
      <label class="left-align spread-inline">Hands on Hip Threshold: <input type="number" value="${window.handsOnHipThreshold}" id="handsOnHipThreshold" /></label>
      <label class="left-align spread-inline">Standing Straight Forward Threshold: <input type="number" value="${window.standingStraightForwardThreshold}" id="standingStraightForwardThreshold" /></label>
      <label class="left-align spread-inline">Standing Straight Forward Lenient Threshold: <input type="number" value="${window.standingStraightForwardLenientThreshold}" id="standingStraightForwardLenientThreshold" /></label>
      <label class="left-align spread-inline">Standing Straight Side Threshold: <input type="number" value="${window.standingStraightSideThreshold}" id="standingStraightSideThreshold" /></label>
      <label class="left-align spread-inline">Standing Straight Side Lenient Threshold: <input type="number" value="${window.standingStraightSideLenientThreshold}" id="standingStraightSideLenientThreshold" /></label>
      <label class="left-align spread-inline">Feet Together Threshold: <input type="number" value="${window.feetTogetherThreshold}" id="feetTogetherThreshold" /></label>
      <label class="left-align spread-inline">Foot Lifted Threshold: <input type="number" value="${window.footLiftedThreshold}" id="footLiftedThreshold" /></label>
      <label class="left-align spread-inline">Knees Together Threshold: <input type="number" value="${window.kneesTogetherThreshold}" id="kneesTogetherThreshold" /></label>
      <label class="left-align spread-inline">Heel To Toe Depth Threshold: <input type="number" value="${window.heelToToeDepthThreshold}" id="heelToToeDepthThreshold" /></label>
      <label class="left-align spread-inline">Heel To Toe Alignment Threshold: <input type="number" value="${window.heelToToeAlignmentThreshold}" id="heelToToeAlignmentThreshold" /></label>
      <label class="left-align spread-inline">Elbow Apart Threshold: <input type="number" value="${window.elbowApartThreshold}" id="elbowApartThreshold" /></label>
      <button class="button button--green">Save</button>
    `;
    dialog.onclick = (e) => {
      if (e.target.tagName === "BUTTON") {
        window.eyeAspectRatioThreshold = parseFloat(
          dialog.querySelector("#eyeAspectRatioThreshold").value
        );
        window.handsOnHipThreshold = parseFloat(
          dialog.querySelector("#handsOnHipThreshold").value
        );
        window.standingStraightForwardThreshold = parseFloat(
          dialog.querySelector("#standingStraightForwardThreshold").value
        );
        window.standingStraightForwardLenientThreshold = parseFloat(
          dialog.querySelector("#standingStraightForwardLenientThreshold").value
        );
        window.standingStraightSideThreshold = parseFloat(
          dialog.querySelector("#standingStraightSideThreshold").value
        );
        window.standingStraightSideLenientThreshold = parseFloat(
          dialog.querySelector("#standingStraightSideLenientThreshold").value
        );
        window.feetTogetherThreshold = parseFloat(
          dialog.querySelector("#feetTogetherThreshold").value
        );
        window.footLiftedThreshold = parseFloat(
          dialog.querySelector("#footLiftedThreshold").value
        );
        window.kneesTogetherThreshold = parseFloat(
          dialog.querySelector("#kneesTogetherThreshold").value
        );
        window.heelToToeDepthThreshold = parseFloat(
          dialog.querySelector("#heelToToeDepthThreshold").value
        );
        window.heelToToeAlignmentThreshold = parseFloat(
          dialog.querySelector("#heelToToeAlignmentThreshold").value
        );
        window.elbowApartThreshold = parseFloat(
          dialog.querySelector("#elbowApartThreshold").value
        );
        dialog.remove();
        resolve();
      }
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

export function errorPhotosToHTML(error_photos_arr) {
  return (
    error_photos_arr
      .map(
        (e) =>
          `<div style="background-color: red" class="center">${e.error}</div><img src="${e.photo}" style="max-width: 100%; max-height: 10em; margin: 0.5em;">`
      )
      .join("") || "No errors detected."
  );
}
export async function bessEndMenu(test, error_photos) {
  return new Promise((resolve) => {
    let foam_html = /* html */ `<button class="button" data-action="FOAM">Take Test</button>`;
    if (!isNaN(test.mBESS_foam_total_errors)) {
      foam_html = /* html */ `
        <label style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">Double Leg Stance: <span><input style="min-width: 10ch; width: 10ch;" value="${
          test.mBESS_foam_double_errors
        }" type="number" data-field="mBESS_foam_double_errors"> of 10 <input type="checkbox" class="expander" data-expand="double-foam-details"></span></label>
        <div id="double-foam-details" style="display: none;">
          Normally 0.33 ± 0.90. Here are the ${
            error_photos.mBESS_foam_double_errors.length
          } auto identified errors:<br><br>
          ${errorPhotosToHTML(error_photos.mBESS_foam_double_errors)}
        </div>
        <label style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">Tandem Stance: <span><input style="min-width: 10ch; width: 10ch;" value="${
          test.mBESS_foam_tandem_errors
        }" type="number" data-field="mBESS_foam_tandem_errors"> of 10 <input type="checkbox" class="expander" data-expand="tandem-foam-details"></span></label>
        <div id="tandem-foam-details" style="display: none;">
          Normally 5.06 ± 2.80. Here are the ${
            error_photos.mBESS_foam_tandem_errors.length
          } auto identified errors:<br><br>
          ${errorPhotosToHTML(error_photos.mBESS_foam_tandem_errors)}
        </div>
        <label style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">Single Leg Stance: <span><input style="min-width: 10ch; width: 10ch;" value="${
          test.mBESS_foam_single_errors
        }" type="number" data-field="mBESS_foam_single_errors"> of 10 <input type="checkbox" class="expander" data-expand="single-foam-details"></span></label>
        <div id="single-foam-details" style="display: none;">
          Normally 3.65 ± 2.62. Here are the ${
            error_photos.mBESS_foam_single_errors.length
          } auto identified errors:<br><br>
          ${errorPhotosToHTML(error_photos.mBESS_foam_single_errors)}
        </div>
        <label style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">Total Errors: <span><input style="min-width: 10ch; width: 10ch;" value="${
          test.mBESS_foam_total_errors
        }" type="number" disabled data-field="mBESS_foam_total_errors"> of 30 <input type="checkbox" class="expander" data-expand="total-foam-details"></span></label>
        <div id="total-foam-details" style="display: none;">
          Normally 8.65 ± 5.13. Combined foam and hard floor errors is normally 12.03 ± 7.34.
        </div>
        <button class="button button--red" data-action="FOAM">Retry</button>
      `;
    }

    const dialog = document.createElement("dialog");
    dialog.innerHTML = /* html */ `
      <h3 style="margin-bottom: 0">BESS</h3>
      <label style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">Double Leg Stance: <span><input style="min-width: 10ch; width: 10ch;" value="${
        test.mBESS_double_errors
      }" type="number" data-field="mBESS_double_errors"> of 10 <input type="checkbox" class="expander" data-expand="double-details"></span></label>
      <div id="double-details" style="display: none;">
        Normally 0.009 ± 0.12. Here are the ${
          error_photos.mBESS_double_errors.length
        } auto identified errors:<br><br>
        ${errorPhotosToHTML(error_photos.mBESS_double_errors)}
      </div>
      <label style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">Tandem Stance: <span><input style="min-width: 10ch; width: 10ch;" value="${
        test.mBESS_tandem_errors
      }" type="number" data-field="mBESS_tandem_errors"> of 10 <input type="checkbox" class="expander" data-expand="tandem-details"></span></label>
      <div id="tandem-details" style="display: none;">
        Normally 2.45 ± 2.33. Here are the ${
          error_photos.mBESS_tandem_errors.length
        } auto identified errors:<br><br>
        ${errorPhotosToHTML(error_photos.mBESS_tandem_errors)}
      </div>
      <label style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">Single Leg Stance: <span><input style="min-width: 10ch; width: 10ch;" value="${
        test.mBESS_single_errors
      }" type="number" data-field="mBESS_single_errors"> of 10 <input type="checkbox" class="expander" data-expand="single-details"></span></label>
      <div id="single-details" style="display: none;">
        Normally 0.91 ± 1.36. Here are the ${
          error_photos.mBESS_single_errors.length
        } auto identified errors:<br><br>
        ${errorPhotosToHTML(error_photos.mBESS_single_errors)}
      </div>
      <label style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">Total Errors: <span><input style="min-width: 10ch; width: 10ch;" value="${
        test.mBESS_total_errors
      }" type="number" disabled data-field="mBESS_total_errors"> of 30 <input type="checkbox" class="expander" data-expand="total-details"></span></label>
      <div id="total-details" style="display: none;">
        Normally 3.37 ± 3.10.
      </div>
      <button class="button button--red" data-action="RETRY">Retry</button>
      <h3 style="margin-bottom: 0">On Foam (optional)</h3>
      <p>The foam test requires a 50cm x 40cm x 6cm foam pad. Recommended model is the <a href="http://www.power-systems.com/" target="_blank">Power Systems Airex Balance Pad 81000</a>.</p>
      ${foam_html}
      <hr>
      <button class="button" data-action="REDO_MANUALLY">Redo Manually</button>
      <button class="button button--green" data-action="NEXT">Move on to Tandem Gait &nbsp; <i class="fa-solid fa-forward"></i></button>
    `;
    dialog.onclick = (e) => {
      if (e.target.tagName === "BUTTON") {
        dialog.remove();
        resolve(e.target.dataset.action);
      }
    };
    dialog.oninput = (e) => {
      const field = e.target.dataset.field;
      const value = parseInt(e.target.value);
      if (!field) {
        return;
      }
      test[field] = value;
      saveTestResult(field, value);
      if (field.includes("mBESS_foam")) {
        test.mBESS_foam_total_errors =
          test.mBESS_foam_double_errors +
          test.mBESS_foam_single_errors +
          test.mBESS_foam_tandem_errors;
        dialog.querySelector(`[data-field="mBESS_foam_total_errors"]`).value =
          test.mBESS_foam_total_errors;
        saveTestResult("mBESS_foam_total_errors", test.mBESS_foam_total_errors);
      } else {
        test.mBESS_total_errors =
          test.mBESS_double_errors +
          test.mBESS_single_errors +
          test.mBESS_tandem_errors;
        dialog.querySelector(`[data-field="mBESS_total_errors"]`).value =
          test.mBESS_total_errors;
        saveTestResult("mBESS_total_errors", test.mBESS_total_errors);
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
  const athlete_year_in_school = pastTests.at(-1)?.athlete_year_in_school ?? 10;
  const athlete_years_of_education =
    pastTests.at(-1)?.athlete_years_of_education ?? 10;
  const athlete_first_language =
    pastTests.at(-1)?.athlete_first_language ?? "English";
  const athlete_preferred_language =
    pastTests.at(-1)?.athlete_preferred_language ?? "English";
  const examiner_name = pastTests.at(-1)?.examiner_name ?? defaultExaminerName;
  const team_or_school = pastTests.at(-1)?.team_or_school ?? "";
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
  const primary_symptoms_other = pastTests.at(-1)?.primary_symptoms_other ?? "";
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
    dialog.style.maxWidth = "700px";
    dialog.innerHTML = /* html */ `
      <h3>${
        pastTests.length == 0
          ? "Enter Athlete Information"
          : "Confirm Athlete Information"
      }</h3>
      <label class="left-align spread-inline">Athlete Name: <input type="text" placeholder="Athlete name" value="${athlete_name}" id="athlete_name" /></label>
      <label class="left-align spread-inline">ID Number: <input type="text" placeholder="Unique ID" value="${athlete_id}" id="athlete_id" /></label>
      <label class="left-align spread-inline">Time of Examination: <input type="datetime-local" value="${
        new Date(test_created_at - new Date().getTimezoneOffset() * 60 * 1000)
          .toISOString()
          .split(".")[0]
      }" id="test_created_at" /></label>
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
      <label class="left-align spread-inline">Current Year in School (if applicable): <input type="number" value="${athlete_year_in_school}" id="athlete_year_in_school" /></label>
      <label class="left-align spread-inline">Total Years of Education Completed: <input type="number" value="${athlete_years_of_education}" id="athlete_years_of_education" /></label>
      <label class="left-align spread-inline">First Language: <input type="text" placeholder="English" value="${athlete_first_language}" id="athlete_first_language" /></label>
      <label class="left-align spread-inline">Preferred Language: <input type="text" placeholder="English" value="${athlete_preferred_language}" id="athlete_preferred_language" /></label>
      <label class="left-align spread-inline">Examiner Name: <input type="text" placeholder="Your first and last name" value="${examiner_name}" id="examiner_name" /></label>
      <label class="left-align spread-inline">Sport/Team/School: <input type="text" placeholder="Varsity X at Y High School" value="${team_or_school}" id="team_or_school" /></label>
      
      <h4>Concussion History</h4>
      <label class="left-align spread-inline">Number of Past Concussions: <input type="number" value="${num_past_concussions}" id="num_past_concussions" /></label>
      <label class="left-align spread-inline">Most Recent Concussion Date: <input type="date" value="${
        new Date(most_recent_concussion_timestamp).toISOString().split("T")[0]
      }" id="most_recent_concussion_timestamp" /></label>
      <label class="left-align spread-inline">Most Recent Recovery Time (days): <input type="number" value="${most_recent_recovery_time_days}" id="most_recent_recovery_time_days" /></label>
      <p style="margin-bottom: 0.2em;">Primary Symptoms:</p>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Confusion") ? "checked" : ""
      } name="primary_symptoms" value="Confusion" /> Confusion.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Headache") ? "checked" : ""
      } name="primary_symptoms" value="Headache" /> Headache.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Double/Blurry Vision") ? "checked" : ""
      } name="primary_symptoms" value="Double/Blurry Vision" /> Double/Blurry Vision.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Dizziness/Imbalance") ? "checked" : ""
      } name="primary_symptoms" value="Dizziness/Imbalance" /> Dizziness/Imbalance.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Nausea/Vomiting") ? "checked" : ""
      } name="primary_symptoms" value="Nausea/Vomiting" /> Nausea/Vomiting.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Memory Loss") ? "checked" : ""
      } name="primary_symptoms" value="Memory Loss" /> Memory Loss.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Ringing Ears") ? "checked" : ""
      } name="primary_symptoms" value="Ringing Ears" /> Ringing Ears.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Difficulty Concentrating") ? "checked" : ""
      } name="primary_symptoms" value="Difficulty Concentrating" /> Difficulty Concentrating.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Sensitivity to Light") ? "checked" : ""
      } name="primary_symptoms" value="Sensitivity to Light" /> Sensitivity to Light.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Loss of Smell/Taste") ? "checked" : ""
      } name="primary_symptoms" value="Loss of Smell/Taste" /> Loss of Smell/Taste.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        primary_symptoms.includes("Trouble Sleeping") ? "checked" : ""
      } name="primary_symptoms" value="Trouble Sleeping" /> Trouble Sleeping.</label>
      <label class="left-align spread-inline">Other: <input type="text" placeholder="List other symptoms" value="${primary_symptoms_other}" class="fill-spread" id="primary_symptoms_other" /></label>
      
      <h4>Medical Background</h4>
      <p style="margin-top: 0">Has the athlete ever been (if yes, describe below):</p>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        hospitalized_for_head_injury ? "checked" : ""
      } id="hospitalized_for_head_injury" />Hospitalized for head injury.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        diagnosed_headache_disorder_or_migraine ? "checked" : ""
      } id="diagnosed_headache_disorder_or_migraine" />Diagnosed with a headache disorder or migraine.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        diagnosed_learning_disability_or_dyslexia ? "checked" : ""
      } id="diagnosed_learning_disability_or_dyslexia" />Diagnosed with a learning disability or dyslexia.</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        diagnosed_attention_deficit_disorder ? "checked" : ""
      } id="diagnosed_attention_deficit_disorder" />Diagnosed with attention deficit hyperactivity disorder (ADHD).</label>
      <label class="left-align" style="flex-wrap: nowrap; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" ${
        diagnosed_psychological_disorder ? "checked" : ""
      } id="diagnosed_psychological_disorder" />Diagnosed with depression, anxiety or a psychological disorder.</label>
      <label class="left-align spread-inline" style="margin-top: 0.8em">Current Medications: <input type="text" placeholder="List medications" class="fill-spread" value="${current_medications}" id="current_medications" /></label>
      <label class="left-align spread-inline">Notes: <input type="text" placeholder="Describe any selections above" class="fill-spread" value="${notes}" id="notes" /></label>
      
      <h4>Start Assessment</h4>
      <p  style="margin-top: 0">The immediate assessment should be completed "on-field" after the first aid/emergency care priorities are completed.</p>
      <p>The "cognitive screening" portion of the baseline and post injury assessments should be completed in a distraction-free environment with the athlete in a resting state.</p>
      <p>For Use by Health Care Professionals Only. See the original <a href="./assets/SCAT6-Detailed-Instructions.pdf">Detailed Instructions</a>.</p>
      <label class="left-align spread-inline">I hereby attest that I am a medical or Health Care Professional authorized to use this tool: <input type="checkbox"></label><br><br>
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
        test_created_at: Date.parse(
          dialog.querySelector("#test_created_at").value
        ),
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
        athlete_year_in_school: parseInt(
          dialog.querySelector("#athlete_year_in_school").value
        ),
        athlete_years_of_education: parseInt(
          dialog.querySelector("#athlete_years_of_education").value
        ),
        athlete_first_language: dialog.querySelector("#athlete_first_language")
          .value,
        athlete_preferred_language: dialog.querySelector(
          "#athlete_preferred_language"
        ).value,
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
        primary_symptoms: Array.from(
          dialog.querySelectorAll('input[name="primary_symptoms"]:checked')
        )
          .map((el) => el.value)
          .join(", "),
        primary_symptoms_other: dialog.querySelector("#primary_symptoms_other")
          .value,
        current_medications: dialog.querySelector("#current_medications").value,
        notes: dialog.querySelector("#notes").value,
        permission_to_upload: pastTests.at(-1)?.permission_to_upload ?? false,
      });
    };
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

window.addEventListener("click", (e) => {
  if (e.target.classList.contains("expander")) {
    const details = document.getElementById(e.target.dataset.expand);
    details.style.display = e.target.checked ? "block" : "none";
  }
});

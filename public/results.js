import { getTest, saveTestResult, shareTestData } from "./testManager.js";
import { tests, athletes } from "./userData.js";
import {
  showSources,
  errorPhotosToHTML,
  bulkExportOptions,
} from "./util/popup.js";
import { text2image } from "./util/text2image.js";

const content = document.getElementById("results-content");

document.addEventListener("renderTestSection", async (event) => {
  if (event.detail !== "results") {
    return;
  }

  const test = getTest();
  document.getElementById("checkbox-share-test-results").checked =
    test.permission_to_upload;
  const athleteTests = Object.values(tests).filter(
    (t) => t.athlete_id === test.athlete_id
  );
  const lastBaseline =
    athleteTests.findLast(
      (t) => t.test_type === "BASELINE" && t.test_id != test.test_id
    ) ?? {};
  const lastPostInjury =
    athleteTests.findLast(
      (t) => t.test_type === "POST-INJURY" && t.test_id != test.test_id
    ) ?? {};

  test.cognitive_total =
    test.orientation +
    test.immediate_memory +
    test.concentration +
    test.delayed_recall;
  saveTestResult("cognitive_total", test.cognitive_total);

  function isValue(field, value) {
    return test[field] === value ? "outline: 2px solid var(--secondary)" : "";
  }
  function recallDelaySeconds(test) {
    if (!test.delayed_recall_timestamp) return "--";
    const diff =
      test.delayed_recall_timestamp - test.immediate_memory_timestamp;
    if (isNaN(diff)) return "--";
    return (diff / 1000).toFixed(0);
  }
  content.innerHTML = /*html*/ `
    <table style="margin-left: auto; margin-right: auto">
      <thead><tr><th>Domain</th><th>Current Score</th><th>Last Baseline</th><th>Last Post Injury</th><th>Healthy Range <i class="fa-solid fa-circle-info" data-action="SOURCES"></i></th><th>Increased Risk Range <i class="fa-solid fa-circle-info" data-action="SOURCES"></i></th></tr></thead>
      <tbody>
        <tr><!-- DATE -->
          <td data-title="Domain">Date</td>
          <td data-title="Current Score">${
            test.test_created_at
              ? new Date(test.test_created_at).toLocaleDateString()
              : "--"
          }</td>
          <td data-title="Last Baseline">${
            lastBaseline.test_created_at
              ? new Date(lastBaseline.test_created_at).toLocaleDateString()
              : "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.test_created_at
              ? new Date(lastPostInjury.test_created_at).toLocaleDateString()
              : "--"
          }</td>
          <td data-title="Healthy Range">--</td>
          <td data-title="Increased Risk Range">--</td>
        </tr>
        <tr><!-- Symptom Number -->
          <td data-title="Domain" style="white-space: nowrap">Symptoms (of 22)</td>
          <td data-title="Current Score">${test.symptom_number ?? "--"}</td>
          <td data-title="Last Baseline">${
            lastBaseline.symptom_number ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.symptom_number ?? "--"
          }</td>
          <td data-title="Healthy Range">&lt;2</td>
          <td data-title="Increased Risk Range">>3</td>
        </tr>
        <tr><!-- Symptom Severity -->
          <td data-title="Domain" style="white-space: nowrap">Severity (of 132)</td>
          <td data-title="Current Score">${test.symptom_severity ?? "--"}</td>
          <td data-title="Last Baseline">${
            lastBaseline.symptom_severity ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.symptom_severity ?? "--"
          }</td>
          <td data-title="Healthy Range">0-25 (low)</td>
          <td data-title="Increased Risk Range">26-75 (moderate)<br> >76 (high)</td>
        </tr>
        <tr><!-- Orientation -->
          <td data-title="Domain" style="white-space: nowrap">Orientation (of 5)</td>
          <td data-title="Current Score">${test.orientation ?? "--"}</td>
          <td data-title="Last Baseline">${
            lastBaseline.orientation ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.orientation ?? "--"
          }</td>
          <td data-title="Healthy Range">4-5</td>
          <td data-title="Increased Risk Range">0-4</td>
        </tr>
        <tr><!-- Immediate Memory -->
          <td data-title="Domain" style="white-space: nowrap">Immediate Memory (of 30)</td>
          <td data-title="Current Score">${test.immediate_memory ?? "--"}</td>
          <td data-title="Last Baseline">${
            lastBaseline.immediate_memory ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.immediate_memory ?? "--"
          }</td>
          <td data-title="Healthy Range">20-30</td>
          <td data-title="Increased Risk Range">0-20</td>
        </tr>
        <tr><!-- Concentration -->
          <td data-title="Domain" style="white-space: nowrap">Concentration (of 5)</td>
          <td data-title="Current Score">${test.concentration ?? "--"}</td>
          <td data-title="Last Baseline">${
            lastBaseline.concentration ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.concentration ?? "--"
          }</td>
          <td data-title="Healthy Range">4-5</td>
          <td data-title="Increased Risk Range">0-4</td>
        </tr>
        <tr><!-- Delayed Recall -->
          <td data-title="Domain" style="white-space: nowrap">Delayed Recall (of 10)</td>
          <td data-title="Current Score">${test.delayed_recall ?? "--"}</td>
          <td data-title="Last Baseline">${
            lastBaseline.delayed_recall ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.delayed_recall ?? "--"
          }</td>
          <td data-title="Healthy Range">6-10</td>
          <td data-title="Increased Risk Range">0-5</td>
        </tr>
        <tr><!-- Recall Delay -->
          <td data-title="Domain" style="white-space: nowrap">Recall Delay (seconds)</td>
          <td data-title="Current Score">${recallDelaySeconds(test)}</td>
          <td data-title="Last Baseline">${recallDelaySeconds(
            lastBaseline
          )}</td>
          <td data-title="Last Post Injury">${recallDelaySeconds(
            lastPostInjury
          )}</td>
          <td data-title="Healthy Range">300+</td>
          <td data-title="Increased Risk Range">&lt;300</td>
        </tr>
        <tr><!-- Cognitive Total -->
          <td data-title="Domain" style="white-space: nowrap">Cognitive Total (of 50)</td>
          <td data-title="Current Score">${test.cognitive_total ?? "--"}</td>
          <td data-title="Last Baseline">${
            lastBaseline.cognitive_total ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.cognitive_total ?? "--"
          }</td>
          <td data-title="Healthy Range">40-50</td>
          <td data-title="Increased Risk Range">0-40</td>
        </tr>
        <tr><!-- BESS -->
          <td data-title="Domain" style="white-space: nowrap">BESS (of 30)</td>
          <td data-title="Current Score">${test.mBESS_total_errors ?? "--"}</td>
          <td data-title="Last Baseline">${
            lastBaseline.mBESS_total_errors ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.mBESS_total_errors ?? "--"
          }</td>
          <td data-title="Healthy Range">0-6</td>
          <td data-title="Increased Risk Range">6-30</td>
        </tr>
        <tr><!-- BESS Foam -->
          <td data-title="Domain" style="white-space: nowrap">BESS Foam (of 30)</td>
          <td data-title="Current Score">${
            test.mBESS_foam_total_errors ?? "--"
          }</td>
          <td data-title="Last Baseline">${
            lastBaseline.mBESS_foam_total_errors ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.mBESS_foam_total_errors ?? "--"
          }</td>
          <td data-title="Healthy Range">0-13</td>
          <td data-title="Increased Risk Range">13-30</td>
        </tr>
        <tr><!-- Tandem Gait Fastest -->
          <td data-title="Domain" style="white-space: nowrap">Tandem Gait fastest (sec)</td>
          <td data-title="Current Score">${
            test.tandem_gait_fastest_time ?? "--"
          }</td>
          <td data-title="Last Baseline">${
            lastBaseline.tandem_gait_fastest_time ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.tandem_gait_fastest_time ?? "--"
          }</td>
          <td data-title="Healthy Range">13-16</td>
          <td data-title="Increased Risk Range">21-27</td>
        </tr>
        <tr><!-- Dual Task Fastest -->
          <td data-title="Domain" style="white-space: nowrap">Dual Task fastest (sec)</td>
          <td data-title="Current Score">${
            test.dual_task_fastest_time ?? "--"
          }</td>
          <td data-title="Last Baseline">${
            lastBaseline.dual_task_fastest_time ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.dual_task_fastest_time ?? "--"
          }</td>
          <td data-title="Healthy Range">18-23</td>
          <td data-title="Increased Risk Range">30-37</td>
        </tr>
        <tr><!-- Dual Task Accuracy -->
          <td data-title="Domain" style="white-space: nowrap">Dual Task Accuracy (%)</td>
          <td data-title="Current Score">${
            test.dual_task_accuracy?.toFixed(0) ?? "--"
          }</td>
          <td data-title="Last Baseline">${
            lastBaseline.dual_task_accuracy?.toFixed(0) ?? "--"
          }</td>
          <td data-title="Last Post Injury">${
            lastPostInjury.dual_task_accuracy?.toFixed(0) ?? "--"
          }</td>
          <td data-title="Healthy Range">86-93</td>
          <td data-title="Increased Risk Range">76-84</td>
        </tr>
      </tbody>
    </table>
    <p style="margin-top: 0">If the athlete was known to you prior to their injury, are they different from their usual self?</p>
    <button data-action="DIFFERENT-YES" class="button button--red" style="${isValue(
      "different_from_usual",
      "YES"
    )}">Yes</button>
    <button data-action="DIFFERENT-NO" class="button button--green" style="${isValue(
      "different_from_usual",
      "NO"
    )}">No</button>
    <button data-action="DIFFERENT-N/A" class="button" style="${isValue(
      "different_from_usual",
      "N/A"
    )}">N/A</button>
    <h3>Decision</h3>
    <p style="margin-top: 0">Concussion diagnosed?</p>
    <button data-action="CONCUSSION-YES" class="button button--red" style="${isValue(
      "decision",
      "YES"
    )}">Yes</button>
    <button data-action="CONCUSSION-NO" class="button button--green" style="${isValue(
      "decision",
      "NO"
    )}">No</button>
    <button data-action="CONCUSSION-DEFERRED" class="button" style="${isValue(
      "decision",
      "DEFERRED"
    )}">Deferred</button>
    <p>Notes</p>
    <textarea data-action="NOTES" class="textarea">${
      test.test_notes ?? ""
    }</textarea>
    <h3>Health Care Professional Attestation</h3>
    <p>I am an HCP and I have personally administered or supervised the administration of this SCAT6.</p>
    <label class="left-align spread-inline" style="flex-wrap: nowrap; margin-bottom: 0.8em;">Name: <input data-action="NAME" type="text" value="${
      test.examiner_name
    }"></label>
    <label class="left-align spread-inline" style="flex-wrap: nowrap; margin-bottom: 0.8em;">Title/Specialty: <input data-action="TITLE_OR_SPECIALTY" type="text" value="${
      test.title_or_specialty ?? ""
    }"></label>
    <label class="left-align spread-inline" style="flex-wrap: nowrap; margin-bottom: 0.8em;">Registration/License number (if applicable): <input data-action="REGISTRATION_OR_LICENSE" type="text" value="${
      test.registration_or_license_number ?? ""
    }"></label>
    <label class="left-align spread-inline" style="flex-wrap: nowrap; margin-bottom: 0.8em;">Signature Date: <input type="datetime-local" value="${
      new Date(
        (test.signed_timestamp ?? Date.now()) -
          new Date().getTimezoneOffset() * 60 * 1000
      )
        .toISOString()
        .split(".")[0]
    }" data-action="SIGNATURE-TIMESTAMP" /></label>
    <label class="left-align spread-inline" style="flex-wrap: nowrap; margin-bottom: 0.4em;">Checking this box is equivalent to signing a paper SCAT6: <input data-action="SIGNATURE" type="checkbox" ${
      test.signed ? "checked" : ""
    }></label>
  `;

  content.onclick = (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    if (action.startsWith("DIFFERENT-")) {
      const value = action.slice("DIFFERENT-".length);
      saveTestResult("different_from_usual", value);
      for (const btn of content.querySelectorAll(
        "button[data-action*='DIFFERENT-']"
      )) {
        btn.style.outline = "";
      }
      e.target.style.outline = "2px solid var(--secondary)";
    } else if (action.startsWith("CONCUSSION-")) {
      const value = action.slice("CONCUSSION-".length);
      saveTestResult("decision", value);
      for (const btn of content.querySelectorAll(
        "button[data-action*='CONCUSSION-']"
      )) {
        btn.style.outline = "";
      }
      e.target.style.outline = "2px solid var(--secondary)";
    } else if (action === "SIGNATURE") {
      saveTestResult("signed", e.target.checked);
      if (e.target.checked) {
        saveTestResult(
          "signed_timestamp",
          new Date(
            document.querySelector('[data-action="SIGNATURE-TIMESTAMP"]').value
          ).getTime()
        );
      } else {
        saveTestResult("signed_timestamp", null);
      }
    } else if (action === "SOURCES") {
      showSources();
    }
  };

  content.oninput = (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    if (action === "NOTES") {
      saveTestResult("test_notes", e.target.value);
    } else if (action === "TITLE_OR_SPECIALTY") {
      saveTestResult("title_or_specialty", e.target.value);
    } else if (action === "REGISTRATION_OR_LICENSE") {
      saveTestResult("registration_or_license_number", e.target.value);
    } else if (action === "NAME") {
      saveTestResult("examiner_name", e.target.value);
    }
  };
});

// Export
const exportSelect = document.getElementById("export-results-select");
document
  .getElementById("export-results")
  .addEventListener("click", async () => {
    try {
      exportSelect.showPicker();
    } catch {
      exportSelect.value = await select("Choose an export option:", [
        ["Report", "Overall Report"],
        ["SCAT6", "Full SCAT6"],
        ["CSV", "Raw CSV"],
        ["none", "Cancel", "button--red"],
      ]);
      exportSelect.dispatchEvent(
        new Event("change", { bubbles: true, cancelable: false })
      );
    }
    shareTestData();
  });
exportSelect.addEventListener("change", () => {
  const selected = exportSelect.value;
  exportSelect.value = "none";
  const test = getTest();
  if (selected === "SCAT6") {
    exportSCAT6pdf(test);
  } else if (selected === "Report") {
    const iframe = document.getElementById("print-frame");
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(generateReportHTML(test));
    doc.close();
    iframe.onload = function () {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
  } else if (selected === "CSV") {
    let csv = "key,value";
    for (const [key, value] of Object.entries(test)) {
      csv += "\n" + key + ',"' + value + '"';
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SCAT6_${test.athlete_name}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});

document
  .getElementById("export-selected")
  .addEventListener("click", async () => {
    const range = await bulkExportOptions();
    if (range === null) return;
    const [start_timestamp, end_timestamp] = range;
    const files = [];
    for (const [athlete_id, test_ids] of Object.entries(athletes)) {
      const athlete_name = tests[test_ids.at(-1)].athlete_name.replace(
        " ",
        "_"
      );
      for (const test_id of test_ids) {
        /** @type {import("./userData.js").Test} */
        const test = tests[test_id];
        if (
          test.test_created_at > end_timestamp ||
          test.test_created_at < start_timestamp
        ) {
          continue;
        }
        const pdf = await exportSCAT6pdf(test, false);
        files.push([
          `${athlete_id.slice(0, 4)}-${athlete_name}/${timestampToYYYYMMDD(
            test.test_created_at
          )}.pdf`,
          pdf,
        ]);
      }
    }
    await downloadZipOfPdfs("exported_selection.zip", files);
  });

function formatDate(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

/** @param {import("./userData.js").Test} data */
function generateReportHTML(data) {
  let html = `<html><head><title>SCAT6 Report for ${data.athlete_name}</title><style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1, h2 { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        td, th { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
        th { background-color: #f2f2f2; text-align: left; }
        </style></head><body>`;

  html += `<h1>SCAT6 Report for ${data.athlete_name}</h1>`;
  html += `
    <div style="display: grid; grid-template-columns: 2fr 1fr; row-gap: 0.5em;">
      <span><strong>Test Active</strong>: ${formatDate(
        data.test_created_at
      )} - ${formatDate(data.test_updated_at)}</span>
      <span><strong>Test Type</strong>: ${data.test_type}</span>
      <span><strong>Injury Time</strong>: ${formatDate(
        data.injury_timestamp
      )}</span>
      <span><strong>Examiner</strong>: ${data.examiner_name}</span>
      <span><strong>Examiner Credentials</strong>: ${
        data.title_or_specialty
      } (${data.registration_or_license_number})</span>
      <span><strong>Signed</strong>: ${
        data.signed ? formatDate(data.signed_timestamp) : "NO"
      }</span>
    </div>
  `;
  const score_table = content.querySelector("table").outerHTML;
  html += score_table;
  html += `
    <br><strong>Primary Symptoms</strong>: ${data.primary_symptoms}${
    data.primary_symptoms_other.length > 0 ? ", " : ""
  }${data.primary_symptoms_other}<br>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; row-gap: 0.5em; margin-top: 0.5em; margin-bottom: 0.5em;">
      <span><strong>Feels Normal</strong>: ${
        data.symptoms_percentage_normal
      }%</span>
      <span><strong>Worse when Physical</strong>: ${
        data.symptoms_worse_with_physical ? "YES" : "NO"
      }</span>
      <span><strong>Worse when Thinking</strong>: ${
        data.symptoms_worse_with_mental ? "YES" : "NO"
      }</span>
    </div>
    <strong>Symptom Description</strong>: ${data.symptoms_description}<br>
    <hr>
    <div style="display: grid; grid-template-columns: 1fr 1fr; row-gap: 0.5em; margin-top: 0.5em; margin-bottom: 0.5em;">
      <span><strong>Different From Normal</strong>: ${
        data.different_from_usual
      }</span>
      <span><strong>Concussion Diagnosis</strong>: ${data.decision}</span>
    </div>
    <strong>Notes</strong>: ${data.test_notes}
  `;
  html += `
    <h2 style="page-break-before: always;">Athlete Info</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; row-gap: 0.5em;">
      <span><strong>Name</strong>: ${data.athlete_name}</span>
      <span><strong>Birth</strong>: ${new Date(
        data.athlete_birth_timestamp
      ).toLocaleDateString()}</span>
      <span><strong>Sex</strong>: ${data.athlete_sex}</span>
      <span><strong>Dominant Hand</strong>: ${data.athlete_dominant_hand}</span>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; row-gap: 0.5em; margin-top: 0.5em;">
      <span><strong>Year in School</strong>: ${
        data.athlete_year_in_school
      }</span>
      <span><strong>Years of Education</strong>: ${
        data.athlete_years_of_education
      }</span>
      <span><strong>First Language</strong>: ${
        data.athlete_first_language
      }</span>
      <span><strong>Preferred Language</strong>: ${
        data.athlete_preferred_language
      }</span>
      <span><strong>Team/School</strong>: ${data.team_or_school}</span>
      <span><strong>Number of Past Concussions</strong>: ${
        data.num_past_concussions
      }</span>
      <span><strong>Most Recent Concussion</strong>: ${new Date(
        data.most_recent_concussion_timestamp
      ).toLocaleDateString()}</span>
      <span><strong>Most Recent Recovery Time</strong>: ${
        data.most_recent_recovery_time_days
      } days</span>
    </div>
  `;
  html += `<h2 style="page-break-before: always;">mBESS Error Photos</h2>`;
  const errorPhotos = data.mBESS_pose_error_photos;
  if (!errorPhotos) {
    html += "No pose error photos taken for this test.";
  } else {
    const doubleErrors = errorPhotos.mBESS_double_errors ?? [];
    const tandemErrors = errorPhotos.mBESS_tandem_errors ?? [];
    const singleErrors = errorPhotos.mBESS_single_errors ?? [];
    const doubleFoamErrors = errorPhotos.mBESS_foam_double_errors ?? [];
    const tandemFoamErrors = errorPhotos.mBESS_foam_tandem_errors ?? [];
    const singleFoamErrors = errorPhotos.mBESS_foam_single_errors ?? [];
    if (doubleErrors.length > 0) {
      html += `<h3>Double Leg Errors (${data.mBESS_double_errors})</h3>`;
      html += errorPhotosToHTML(doubleErrors);
    }
    if (tandemErrors.length > 0) {
      html += `<h3>Tandem Errors (${data.mBESS_tandem_errors})</h3>`;
      html += errorPhotosToHTML(tandemErrors);
    }
    if (singleErrors.length > 0) {
      html += `<h3>Single Leg Errors (${data.mBESS_single_errors})</h3>`;
      html += errorPhotosToHTML(singleErrors);
    }
    if (doubleFoamErrors.length > 0) {
      html += `<h3>Double Leg Foam Errors (${data.mBESS_foam_double_errors})</h3>`;
      html += errorPhotosToHTML(doubleFoamErrors);
    }
    if (tandemFoamErrors.length > 0) {
      html += `<h3>Tandem Foam Errors (${data.mBESS_foam_tandem_errors})</h3>`;
      html += errorPhotosToHTML(tandemFoamErrors);
    }
    if (singleFoamErrors.length > 0) {
      html += `<h3>Single Leg Foam Errors (${data.mBESS_foam_single_errors})</h3>`;
      html += errorPhotosToHTML(singleFoamErrors);
    }
  }

  html += `</body></html>`;
  return html;
}

function timestampToYYYYMMDD(timestamp) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const offset_date = new Date(date.getTime() - offset * 60 * 1000);
  return offset_date.toISOString().split("T")[0].replaceAll("-", "/");
}

function timestampToHHmm(timestamp) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  const hour24 = date.getHours();
  const minutes = date.getMinutes();
  return (
    String(hour24).padStart(2, "0") + ":" + String(minutes).padStart(2, "0")
  );
}

function timestampToMMDDYYYYhhmmssA(timestamp) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // The hour '0' should be '12'
  hours = String(hours).padStart(2, "0"); // Pad for single-digit hours
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
}

/** @param {import("./userData.js").Test} test */
async function exportSCAT6pdf(test, download = true) {
  const fields = {
    // directly copied fields
    athlete_name: test.athlete_name,
    athlete_year_in_school: test.athlete_year_in_school,
    athlete_years_of_education: test.athlete_years_of_education,
    athlete_first_language: test.athlete_first_language,
    athlete_preferred_language: test.athlete_preferred_language,
    examiner_name: test.examiner_name,
    team_or_school: test.team_or_school,
    num_past_concussions: test.num_past_concussions,
    most_recent_recovery_time_days: test.most_recent_recovery_time_days,
    current_medications: test.current_medications,
    notes: test.notes,
    glasgow_coma_scale: test.glasgow_coma_scale,
    coordination_abnomalities: test.coordination_abnomalities,
    maddocks_score: test.maddocks_score,
    symptom_number: test.symptom_number,
    symptom_severity: test.symptom_severity,
    symptoms_percentage_normal: test.symptoms_percentage_normal,
    symptoms_description: test.symptoms_description,
    orientation: test.orientation,
    immediate_memory: test.immediate_memory,
    concentration: test.concentration,
    mBESS_double_errors: test.mBESS_double_errors,
    mBESS_single_errors: test.mBESS_single_errors,
    mBESS_tandem_errors: test.mBESS_tandem_errors,
    mBESS_foam_double_errors: test.mBESS_foam_double_errors,
    mBESS_foam_single_errors: test.mBESS_foam_single_errors,
    mBESS_foam_tandem_errors: test.mBESS_foam_tandem_errors,
    tandem_gait_fastest_time: test.tandem_gait_fastest_time,
    dual_task_fastest_time: test.dual_task_fastest_time,
    delayed_recall: test.delayed_recall,
    test_notes: test.test_notes,
    title_or_specialty: test.title_or_specialty,
    registration_or_license_number: test.registration_or_license_number,
    athlete_dominant_hand: test.athlete_dominant_hand,
    red_flags: test.red_flags,
    observable_signs_source: test.observable_signs_source,
    different_from_usual: test.different_from_usual,
    cognitive_total: test.cognitive_total,
    cognitive_total_copy: test.cognitive_total,
    mBESS_total_errors: test.mBESS_total_errors,
    mBESS_total_errors_copy: test.mBESS_total_errors,
    mBESS_foam_total_errors: test.mBESS_foam_total_errors,
    glasgow_e: test.glasgow_e,
    glasgow_v: test.glasgow_v,
    glasgow_m: test.glasgow_m,
    concentration_digit_list: test.concentration_digit_list,
    concentration_months_time_sec: test.concentration_months_time_sec,
    tandem_gait_average_time: test.tandem_gait_average_time,
    dual_task_starting_integer: test.dual_task_starting_integer,

    // special fields
    athlete_id: test.athlete_id.split("-")[0],
    primary_symptoms:
      test.primary_symptoms +
      (test.primary_symptoms_other.length > 0 ? ", " : "") +
      test.primary_symptoms_other,
    test_date: timestampToYYYYMMDD(test.test_created_at),
    athlete_birth_date: timestampToYYYYMMDD(test.athlete_birth_timestamp),
    injury_date: timestampToYYYYMMDD(test.injury_timestamp),
    injury_time: timestampToHHmm(test.injury_timestamp),
    most_recent_concussion_datetime: timestampToMMDDYYYYhhmmssA(
      test.most_recent_concussion_timestamp
    ),
    immediate_memory_datetime: timestampToMMDDYYYYhhmmssA(
      test.immediate_memory_timestamp
    ),
    delayed_recall_datetime: timestampToMMDDYYYYhhmmssA(
      test.delayed_recall_timestamp
    ),
    decision:
      test.decision === "YES"
        ? "CONCUSSED"
        : test.decision === "NO"
        ? "HEALTHY"
        : "DEFERRED",
    dual_task_num_errors: Math.round(
      (13 * (100 - test.dual_task_accuracy)) / 100
    ),
    hospitalized_for_head_injury: test.hospitalized_for_head_injury
      ? "YES"
      : "NO",
    diagnosed_headache_disorder_or_migraine:
      test.diagnosed_headache_disorder_or_migraine ? "YES" : "NO",
    diagnosed_learning_disability_or_dyslexia:
      test.diagnosed_learning_disability_or_dyslexia ? "YES" : "NO",
    diagnosed_attention_deficit_disorder:
      test.diagnosed_attention_deficit_disorder ? "YES" : "NO",
    diagnosed_psychological_disorder: test.diagnosed_psychological_disorder
      ? "YES"
      : "NO",
    glassgow_date: timestampToYYYYMMDD(test.glasgow_timestamp),
    glasgow_time: timestampToHHmm(test.glasgow_timestamp),
    symptoms_worse_with_physical: test.symptoms_worse_with_physical
      ? "YES"
      : "NO",
    symptoms_worse_with_mental: test.symptoms_worse_with_mental ? "YES" : "NO",
  };
  // conditional fields
  if (test.signed) {
    fields["signature"] = test.examiner_name;
    fields["signed_date"] = timestampToYYYYMMDD(test.signed_timestamp);
  }
  if (test.test_type !== "IMMEDIATE") {
    fields["test_type"] = test.test_type;
  }
  if (["Male", "Female", "Prefer Not To Say"].includes(test.athlete_sex)) {
    fields["athlete_sex"] = test.athlete_sex;
  } else {
    fields["athlete_sex_other"] = test.athlete_sex;
  }
  if (test.observable_signs) {
    const signs = ["Lyi", "Fal", "Bal", "Dis", "Bla", "Fac", "Imp", "Hig"];
    for (let ix = 1; ix <= signs.length; ix++) {
      fields[`observable_signs_${ix}`] = "NO";
    }
    for (const sign of test.observable_signs) {
      const ix = signs.indexOf(sign.substring(0, 3)) + 1;
      fields[`observable_signs_${ix}`] = "YES";
    }
    if (test.observable_signs) {
      fields["observable_signs_failed"] =
        test.observable_signs.length !== 0 ? "YES" : "NO";
    }
  }
  if (test.glasgow_coma_scale !== undefined) {
    fields["glasgow_failed"] = test.glasgow_coma_scale < 15 ? "YES" : "NO";
  }
  if (test.cervical_spine) {
    const cervical_spine = ["Ath", "The", "If ", "Lim"];
    for (let ix = 1; ix <= cervical_spine.length; ix++) {
      fields[`cervical_spine_${ix}`] = "NO";
    }
    for (const selected of test.cervical_spine) {
      const ix = cervical_spine.indexOf(selected.substring(0, 3)) + 1;
      fields[`cervical_spine_${ix}`] = "YES";
    }
    if (test.cervical_spine) {
      fields["cervical_spine_failed"] =
        test.cervical_spine.length === 2 &&
        test.cervical_spine[0].substring(0, 3) === "If " &&
        test.cervical_spine[1].substring(0, 3) === "Lim"
          ? "NO"
          : "YES";
    }
  }
  if (
    test.immediate_memory_words &&
    ["Anchor", "Wagon", "Bubble"].includes(test.immediate_memory_words.at(-1))
  ) {
    fields["immediate_memory_words"] = test.immediate_memory_words.at(-1);
  }
  if (test.coordination) {
    const coordination = ["Coo", "Ocu", "Obs"];
    for (let ix = 1; ix <= coordination.length; ix++) {
      fields[`coordination_${ix}`] = "NO";
    }
    for (const selected of test.coordination) {
      const ix = coordination.indexOf(selected.substring(0, 3)) + 1;
      fields[`coordination_${ix}`] = "YES";
    }
    fields["coordination_failed"] =
      test.coordination.length === 3 ? "NO" : "YES";
  }
  if (test.maddocks) {
    const maddocks = ["What v", "Which ", "Who sc", "What t", "Did yo"];
    for (let ix = 1; ix <= maddocks.length; ix++) {
      fields[`maddocks_${ix}`] = "NO";
    }
    for (const selected of test.maddocks) {
      const ix = maddocks.indexOf(selected.substring(0, 6)) + 1;
      fields[`maddocks_${ix}`] = "YES";
    }
    fields["maddocks_failed"] = test.maddocks_score === 5 ? "NO" : "YES";
  }
  for (
    let ix = 1;
    test.symptom_scores && ix <= test.symptom_scores.length;
    ix++
  ) {
    fields[`symptoms_${ix}`] = "" + test.symptom_scores[ix - 1];
  }
  if (test.orientation_correct) {
    const orientation = [
      "What month is i",
      "What is the dat",
      "What is the day",
      "What year is it",
      "What time is it",
    ];
    for (let ix = 1; ix <= orientation.length; ix++) {
      fields[`orientation_${ix}`] = "NO";
    }
    for (const selected of test.orientation_correct) {
      const ix = orientation.indexOf(selected.substring(0, 15)) + 1;
      fields[`orientation_${ix}`] = "YES";
    }
  }
  if (test.immediate_memory_score_by_trial_by_word) {
    for (
      let trial = 0;
      trial < test.immediate_memory_score_by_trial_by_word.length;
      trial++
    ) {
      let trial_score = 0;
      for (
        let word = 0;
        word < test.immediate_memory_score_by_trial_by_word[trial].length;
        word++
      ) {
        if (test.immediate_memory_score_by_trial_by_word[trial][word]) {
          fields[`immediate_memory_${trial + 1}_${word + 1}`] = "YES";
          trial_score += 1;
        } else {
          fields[`immediate_memory_${trial + 1}_${word + 1}`] = "NO";
        }
      }
      fields[`immediate_memory_${trial + 1}`] = trial_score;
    }
  }
  if (test.concentration_digits) {
    fields["concentration_digits"] = 0;
    for (let row = 0; row < test.concentration_digits.length; row++) {
      let row_value = 0;
      for (
        let attempt = 0;
        attempt < test.concentration_digits[row].length;
        attempt++
      ) {
        if (test.concentration_digits[row][attempt] === undefined) {
          // don't select any option since this was not attempted
        } else if (test.concentration_digits[row][attempt]) {
          fields[`concentration_digits_${row + 1}_${attempt + 1}`] = "YES";
          row_value = 1;
        } else {
          fields[`concentration_digits_${row + 1}_${attempt + 1}`] = "NO";
        }
      }
      fields[`concentration_digits_${row + 1}`] =
        row_value === 1 ? "YES" : "NO";
      fields["concentration_digits"] += row_value;
    }
  }
  if (test.concentration_months) {
    let errors = 0;
    for (let month = 0; month < test.concentration_months.length; month++) {
      fields[`concentration_months_${month + 1}`] =
        test.concentration_months[month];
      if (!test.concentration_months[month]) {
        errors += 1;
      }
    }
    fields["concentration_months_errors"] = errors;
    fields["concentration_months"] =
      test.concentration - fields["concentration_digits"];
  }
  if (test.tandem_gait_times_by_trial) {
    for (
      let trial = 0;
      trial < test.tandem_gait_times_by_trial.length;
      trial++
    ) {
      fields[`tandem_gait_times_${trial + 1}`] =
        test.tandem_gait_times_by_trial[trial];
    }
  }
  if (test.delayed_recall_by_word) {
    for (let word = 0; word < test.delayed_recall_by_word.length; word++) {
      fields[`delayed_recall_by_word_${word + 1}`] = test
        .delayed_recall_by_word[word]
        ? "YES"
        : "NO";
    }
  }

  // fill form using pdf-lib: https://pdf-lib.js.org/docs/api/classes/pdffield
  const {
    PDFDocument,
    PDFTextField,
    PDFCheckBox,
    PDFRadioGroup,
    PDFSignature,
    drawImage,
    degrees,
  } = window.PDFLib;
  const res = await fetch("./assets/SCAT6.pdf");
  if (!res.ok) {
    alert("Failed to load SCAT6 template");
    return;
  }
  const scat6_buf = await res.arrayBuffer();
  const scat6 = await PDFDocument.load(scat6_buf);
  const form = scat6.getForm();
  for (const field of form.getFields()) {
    const key = field.getName();
    const value = fields[key];
    if (value === undefined || value === null || Number.isNaN(value)) continue;
    if (field instanceof PDFTextField) {
      field.setText(value.toString());
    } else if (field instanceof PDFCheckBox) {
      if (value) {
        field.check();
      } else {
        field.uncheck();
      }
    } else if (field instanceof PDFRadioGroup) {
      if (field.getOptions().includes(value)) {
        field.select(value);
      } else {
        throw new Error(
          "Invalid radio option " +
            value +
            "(valid: " +
            field.getOptions() +
            ")"
        );
      }
    } else if (field instanceof PDFSignature) {
      const { base64url, imgWidth, imgHeight } = await text2image(
        test.examiner_name
      );
      const base64sig = base64url.replace("data:image/png;base64,", "");
      const pdfLibSigImg = await scat6.embedPng(base64sig);
      const pdfLibSigImgName = key + "_img";
      field.acroField.getWidgets().forEach((widget) => {
        const { context } = widget.dict;
        const { width, height } = widget.getRectangle();

        const appearance = [
          ...drawImage(pdfLibSigImgName, {
            x: 0,
            y: 0,
            width: (imgWidth * height) / imgHeight,
            height: height,
            rotate: degrees(0),
            xSkew: degrees(0),
            ySkew: degrees(0),
          }),
        ];

        const stream = context.formXObject(appearance, {
          Resources: { XObject: { [pdfLibSigImgName]: pdfLibSigImg.ref } },
          BBox: context.obj([0, 0, width, height]),
          Matrix: context.obj([1, 0, 0, 1, 0, 0]),
        });
        const streamRef = context.register(stream);

        widget.setNormalAppearance(streamRef);
      });
    } else {
      throw new Error("Field type not implemented: " + field);
    }
  }

  // form.flatten(); // prevent editing fields further
  const filled_buf = await scat6.save();

  // download filled PDF
  if (download) {
    const blob = new Blob([filled_buf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SCAT6_${test.athlete_name}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    return filled_buf;
  }
}

async function downloadZipOfPdfs(zipname, pdfUrlsOrBuffers) {
  const zip = new window.JSZip();

  // Iterate over your PDF sources (URLs or ArrayBuffers/Buffers)
  for (const [filename, source] of pdfUrlsOrBuffers) {
    // 1. Load the PDF data (assuming 'source' is a URL or buffer)
    const pdfBytes =
      typeof source === "string"
        ? await fetch(source).then((res) => res.arrayBuffer())
        : source; // Use source directly if it's already a buffer

    // 2. Add the PDF data to the zip file
    // The second argument must be raw data (Blob, Buffer, etc.)
    zip.file(filename, pdfBytes);
  }

  // 3. Generate the ZIP file content as a Blob (browser) or Buffer (Node.js)
  const zipContent = await zip.generateAsync({ type: "blob" });

  // 4. Trigger download
  const url = URL.createObjectURL(zipContent);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

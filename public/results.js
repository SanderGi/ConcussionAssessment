import { getTest, saveTestResult } from "./testManager.js";
import { tests } from "./userData.js";
import { showSources, errorPhotosToHTML } from "./util/popup.js";

const content = document.getElementById("results-content");

document.addEventListener("renderTestSection", async (event) => {
  if (event.detail !== "results") {
    return;
  }

  const test = getTest();
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

// PDF Export
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

document.getElementById("export-results").addEventListener("click", () => {
  const test = getTest();
  const iframe = document.getElementById("print-frame");
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(generateReportHTML(test));
  doc.close();

  iframe.onload = function () {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };
});

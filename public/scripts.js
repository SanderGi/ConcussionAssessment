import { renderCurrentTestSection } from "./testManager.js";
import {
  tests,
  athletes,
  connectUser,
  syncData,
  deleteRemoteData,
  clearLocalData,
  disconnectUser,
} from "./userData.js";
import { startTest } from "./testManager.js";
import { alert, confirm, syncSettings } from "./util/popup.js";
import { calcSimilarity } from "./util/fuzzysearch.js";
const Chart = window.Chart;
/** @typedef {import('./userData.js').Test} Test */

// ============================ Feature Detection ============================
if (!window.crypto?.subtle) {
  alert(
    "Your browser does not support the Web Cryptography API. Please use a different browser."
  );
}

// ============================ Setup ============================

window.onload = async () => {
  const user = await connectUser();
  showConnected(user);
  await syncData();

  renderCurrentTestSection();
};

document.addEventListener("renderTestSection", async (event) => {
  if (event.detail === "test-management") {
    showAthletes();
  }
});

// ============================ UI Elements ============================
const deleteAllButton = document.getElementById("delete-all-button");
const syncButton = document.getElementById("sync-button");
const searchInput = document.getElementById("search-input");
const athleteNumSelect = document.getElementById("number-of-athletes");
const addAthleteButton = document.getElementById("add-athlete-button");

deleteAllButton.onclick = async () => {
  if (await confirm("Are you sure you want to delete all data?")) {
    await deleteRemoteData();
    await clearLocalData();
  }
};

function showConnected(user) {
  if (user) {
    syncButton.innerHTML = `Synced &nbsp; <img style="width: 1em; height: 1em; border-radius: 50%; margin: auto" src="${user.picture}">`;
    syncButton.classList.add("button--green");
  } else {
    syncButton.innerHTML =
      'Sync &nbsp; <i class="fa-brands fa-google-drive"></i>';
    syncButton.classList.remove("button--green");
  }
}

syncButton.onclick = async () => {
  let user = await connectUser();
  let action = "SYNC";
  if (user) {
    const { name, email, lastSignIn } = user;

    action = await syncSettings(
      name,
      email,
      `Last confirmed identity on ${lastSignIn} <br><br> Last synced on ${localStorage.getItem(
        "lastSync"
      )}`
    );
  } else {
    localStorage.setItem("synced", "true");
    user = await connectUser();
  }

  if (action === "UNLINK") {
    if (
      await confirm(
        "This will delete all data from this device but keep it on your GDrive. Are you sure?"
      )
    ) {
      await clearLocalData();
    }
  } else if (action === "DELETE_DRIVE") {
    if (
      await confirm(
        "This will delete all data from your GDrive but keep it on this device. Are you sure?"
      )
    ) {
      await deleteRemoteData();
      await disconnectUser();
    }
  } else {
    try {
      await syncData();
      showConnected(user);
    } catch (err) {
      console.error(err);
      await alert(
        "Failed to sync data. Make sure you checked the box to give the app permission to add app data to your Google Drive."
      );
      await disconnectUser();
    }
  }
};

addAthleteButton.onclick = async () => {
  await startTest([]);
  showAthletes();
};

function showAthlete(athlete_id) {
  /** @type {Test} */
  const athlete = tests[athletes[athlete_id].at(-1)];
  const container = document.getElementById("athletes");

  const section = document.createElement("section");
  section.id = "athlete-" + athlete_id;
  section.className = "athlete";
  section.innerHTML = /*html*/ `
    <div class="left-align spread-inline">
        ${athlete.athlete_name} (${athlete_id.split("-")[0]})
        <div>
            <button class="button" onclick="testAthlete('${athlete_id}')">Test &nbsp; <i class="fa-solid fa-flask-vial"></i></button>
            <button class="button" onclick="showAthleteResults('${athlete_id}')">Results &nbsp; <i class="fa-solid fa-clipboard-list"></i></button>
            <button class="button button--red" onclick="deleteAthlete('${athlete_id}')">Delete &nbsp; <i class="fa-solid fa-trash"></i></button>
        </div>
    </div>
  `;
  container.appendChild(section);
}

function showAthletes() {
  const container = document.getElementById("athletes");
  container.innerHTML = "";

  const athleteIds = Object.keys(athletes);
  athleteIds.sort((a, b) => {
    const athleteA = tests[athletes[a].at(-1)];
    const athleteB = tests[athletes[b].at(-1)];
    const similarityA = calcSimilarity(
      athleteA.athlete_name,
      searchInput.value
    );
    const similarityB = calcSimilarity(
      athleteB.athlete_name,
      searchInput.value
    );
    return similarityB - similarityA;
  });

  for (
    let i = 0;
    i < Math.min(athleteNumSelect.value, athleteIds.length);
    i++
  ) {
    showAthlete(athleteIds[i]);
  }
}

searchInput.oninput = showAthletes;
athleteNumSelect.oninput = showAthletes;

window.testAthlete = async (athlete_id) => {
  const athlete = athletes[athlete_id];
  if (!athlete) return;

  const athleteTests = athlete.map((key) => tests[key]);
  await startTest(athleteTests);
  showAthletes();
};

window.deleteAthlete = async (athlete_id) => {
  if (await confirm("Are you sure you want to delete this athlete's data?")) {
    for (const test of athletes[athlete_id]) {
      tests[test].athlete_id = "deleted";
    }
    document.getElementById("athlete-" + athlete_id).remove();
    await syncData();
  }
};

window.showAthleteResults = async (athlete_id) => {
  const athlete = athletes[athlete_id];
  if (!athlete) return;

  /** @type {Test[]} */
  const athleteTests = athlete.map((key) => tests[key]);
  const lastBaseline = athleteTests.findLast(
    (test) => test.test_type === "BASELINE"
  );
  const lastPostInjury = athleteTests.findLast(
    (test) => test.test_type === "POST-INJURY"
  );

  const container = document.getElementById("athlete-" + athlete_id);

  for (const canvas of container.getElementsByTagName("canvas")) {
    canvas.remove();
    container.lastChild.remove();
    return;
  }

  const summary = document.createElement("div");
  summary.innerHTML = `
    Last Baseline (${new Date(lastBaseline?.test_created_at)}): ${
    lastBaseline?.mBESS_total_errors + lastBaseline?.cognitive_total
  } / 80
    <br>
    Last Post Injury (${new Date(lastPostInjury?.test_created_at)}): ${
    lastPostInjury?.mBESS_total_errors + lastPostInjury?.cognitive_total
  } / 80
  `;
  container.appendChild(summary);

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  new Chart(canvas, {
    type: "line",
    data: {
      labels: athleteTests.map((test) =>
        new Date(test.test_created_at).toDateString()
      ),
      datasets: [
        {
          label: "Glasgow Coma Scale (X/15)",
          data: athleteTests.map((test) => test.glasgow_coma_scale),
        },
        {
          label: "Maddocks Score (X/5)",
          data: athleteTests.map((test) => test.maddocks_score),
        },
        {
          label: "Symptom Number (X/22)",
          data: athleteTests.map((test) => test.symptom_number),
        },
        {
          label: "Symptom Severity (X/132)",
          data: athleteTests.map((test) => test.symptom_severity),
        },
        {
          label: "Orientation (X/5)",
          data: athleteTests.map((test) => test.orientation),
          hidden: true,
        },
        {
          label: "Immediate Memory (X/30)",
          data: athleteTests.map((test) => test.immediate_memory),
          hidden: true,
        },
        {
          label: "Concentration (X/5)",
          data: athleteTests.map((test) => test.concentration),
          hidden: true,
        },
        {
          label: "Delayed Recall (X/10)",
          data: athleteTests.map((test) => test.delayed_recall),
          hidden: true,
        },
        {
          label: "Cognitive Total (X/50)",
          data: athleteTests.map((test) => test.cognitive_total),
        },
        {
          label: "mBESS Total Errors (X/30)",
          data: athleteTests.map((test) => test.mBESS_total_errors),
        },
        {
          label: "Tandem Gait Fastest Time",
          data: athleteTests.map((test) => test.tandem_gait_fastest_time),
        },
        {
          label: "Dual Task Fastest Time",
          data: athleteTests.map((test) => test.dual_task_fastest_time),
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(255, 255, 255, 0.3)",
          },
        },
        x: {
          grid: {
            color: "rgba(255, 255, 255, 0.3)",
          },
        },
      },
      xAxis: {
        type: "time",
      },
      plugins: {
        tooltip: {
          callbacks: {
            afterTitle: (items) => athleteTests[items[0].dataIndex].test_type,
          },
        },
      },
    },
  });
};

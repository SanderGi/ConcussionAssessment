function getCell(field) {
  return tandemData.querySelector(`[data-field="${field}"]`);
}

function saveResults() {
  const time1 = parseFloat(getCell("trial1").textContent);
  const time2 = parseFloat(getCell("trial2").textContent);
  const time3 = parseFloat(getCell("trial3").textContent);
  const fastest_time = parseFloat(getCell("fastest").textContent);
  const average_time = parseFloat(getCell("average").textContent);
  saveTestResult("tandem_gait_fastest_time", fastest_time);
  saveTestResult("tandem_gait_average_time", average_time);
  saveTestResult("tandem_gait_times_by_trial", [time1, time2, time3]);
}

const startDualTaskGait = document.getElementById("start-dual-task-gait");
startDualTaskGait.addEventListener("click", () => {
  saveResults();
  renderTestSection("dual-task-gait");
});
const skipToDelayedRecall = document.getElementById("skip-to-delayed-recall");
skipToDelayedRecall.addEventListener("click", () => {
  saveResults();
  renderTestSection("delayed-recall");
});

let startTime = 0;
let timer = null;
const tandemData = document.getElementById("tandem-data");
tandemData.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  if (action.startsWith("start-")) {
    const trial = action.slice("start-".length);
    e.target.textContent = "Stop Timer";
    e.target.classList.remove("button--green");
    e.target.classList.add("button--red");
    e.target.dataset.action = "stop-" + trial;
    const timeSpan = document.createElement("span");
    timeSpan.style.fontFamily = "var(--mono-space)";
    timeSpan.textContent = "0.00";
    e.target.parentElement.prepend(timeSpan);
    startTime = Date.now();
    timer = setInterval(() => {
      timeSpan.textContent = ((Date.now() - startTime) / 1000).toFixed(2);
    }, 100);
  } else if (action.startsWith("stop-")) {
    clearInterval(timer);
    const trial = action.slice("stop-".length);
    const seconds = (Date.now() - startTime) / 1000;
    const trialCell = getCell(`trial${trial}`);

    const redoBtn = document.createElement("i");
    redoBtn.className = "fa-solid fa-rotate-right";
    redoBtn.style.fontSize = "0.8em";
    redoBtn.style.cursor = "pointer";
    redoBtn.onclick = () => {
      trialCell.innerHTML = `<button data-action="start-${trial}" class="button button--green">Start Timer</button>`;
      trialCell.dataset.redo = "true";
    };

    e.target.parentElement.replaceChildren(seconds.toFixed(2), " ", redoBtn);

    updateTime();
    if (+trial < 3) {
      if (trialCell.dataset.redo === "true") return;
      getCell(`trial${+trial + 1}`).innerHTML = `<button data-action="start-${
        +trial + 1
      }" class="button button--green">Start Timer</button>`;
    } else {
      startDualTaskGait.style.display = "inline";
      skipToDelayedRecall.style.display = "inline";
    }
  }
});

function updateTime() {
  const time1 = parseFloat(getCell("trial1").textContent);
  const time2 = parseFloat(getCell("trial2").textContent);
  const time3 = parseFloat(getCell("trial3").textContent);
  getCell("fastest").textContent =
    Math.min(time1 || Infinity, time2 || Infinity, time3 || Infinity).toFixed(
      2
    );
  const notNaNCount = [time1, time2, time3].filter((t) => !isNaN(t)).length;
  getCell("average").textContent = (
    ((time1 || 0) + (time2 || 0) + (time3 || 0)) /
    notNaNCount
  ).toFixed(2);
}

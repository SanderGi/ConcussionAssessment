const startDualTaskGait = document.getElementById("start-dual-task-gait");
startDualTaskGait.addEventListener("click", () => {
  saveTestResult(
    "tandem_gait_fastest_time",
    parseFloat(
      tandemData.querySelector(`[data-title="Fastest (seconds)"]`).textContent
    )
  );
  renderTestSection("dual-task-gait");
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
    const trialCell = tandemData.querySelector(
      `[data-title="Trial ${trial} (seconds)"]`
    );

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
      tandemData.querySelector(
        `[data-title="Trial ${+trial + 1} (seconds)"]`
      ).innerHTML = `<button data-action="start-${
        +trial + 1
      }" class="button button--green">Start Timer</button>`;
    } else {
      startDualTaskGait.style.display = "inline";
    }
  }
});

function updateTime() {
  const time1 = parseFloat(
    tandemData.querySelector(`[data-title="Trial 1 (seconds)"]`).textContent
  );
  const time2 = parseFloat(
    tandemData.querySelector(`[data-title="Trial 2 (seconds)"]`).textContent
  );
  const time3 = parseFloat(
    tandemData.querySelector(`[data-title="Trial 3 (seconds)"]`).textContent
  );
  tandemData.querySelector(`[data-title="Fastest (seconds)"]`).textContent =
    Math.min(time1 || Infinity, time2 || Infinity, time3 || Infinity).toFixed(
      2
    );
  const notNaNCount = [time1, time2, time3].filter((t) => !isNaN(t)).length;
  tandemData.querySelector(`[data-title="Average (seconds)"]`).textContent = (
    ((time1 || 0) + (time2 || 0) + (time3 || 0)) /
    notNaNCount
  ).toFixed(2);
}

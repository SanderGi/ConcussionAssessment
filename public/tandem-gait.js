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
    startTime = Date.now();
    timer = setInterval(() => {
      e.target.innerHTML = `Stop Timer (<span style="font-family:var(--mono-space)">${(
        (Date.now() - startTime) /
        1000
      ).toFixed(2)}</span>)`;
    }, 100);
  } else if (action.startsWith("stop-")) {
    clearInterval(timer);
    const trial = action.slice("stop-".length);
    const seconds = (Date.now() - startTime) / 1000;
    e.target.parentElement.contentEditable = "true";
    e.target.parentElement.dataset.value = seconds;
    e.target.parentElement.oninput = updateTime;
    e.target.replaceWith(document.createTextNode(seconds.toFixed(2)));
    updateTime();
    if (+trial < 3) {
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

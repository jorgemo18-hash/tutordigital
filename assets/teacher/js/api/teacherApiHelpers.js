import { termKeyFromMonthKey } from "../notebook.js";

export function formatRequestId(body) {
  return body?.requestId || body?.request_id || "";
}

export function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isYMD(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

export function getTaskRangeParams(range = "today") {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  let end = new Date(start);
  if (range === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end = new Date(start);
  } else if (range === "week") {
    end.setDate(end.getDate() + 6);
  }
  return {
    from: formatYMD(start),
    to: formatYMD(end),
  };
}

export function getNotebookRangeParams(state) {
  const now = new Date();
  if (!state.notebookMonth) {
    state.notebookMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  if (!state.notebookTerm) {
    state.notebookTerm = termKeyFromMonthKey(state.notebookMonth);
  }

  const mode = state.notebookMode || "month";

  if (mode === "custom") {
    const from = state.notebookCustomFrom || formatYMD(now);
    const to = state.notebookCustomTo || from;
    return { from, to };
  }

  if (mode === "week") {
    const offset = state.notebookWeekOffset || 0;
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return { from: formatYMD(monday), to: formatYMD(friday) };
  }

  const [yearStr, monthStr] = state.notebookMonth.split("-");
  const year = Number(yearStr) || now.getFullYear();
  const month = Number(monthStr) || now.getMonth() + 1;

  if (mode === "month") {
    const fromDate = new Date(year, month - 1, 1);
    const toDate = new Date(year, month, 0);
    const from = formatYMD(fromDate);
    const to = formatYMD(toDate);
    return { from, to };
  }

  // Academic year: t1=Sep-Dec (start year), t2=Jan-Mar (start+1), t3=Apr-Jun (start+1)
  const nowMonth = now.getMonth() + 1;
  const academicStartYear = nowMonth >= 9 ? now.getFullYear() : now.getFullYear() - 1;

  let startMonth, endMonth, termYear;
  if (state.notebookTerm === "t2") {
    startMonth = 1; endMonth = 3; termYear = academicStartYear + 1;
  } else if (state.notebookTerm === "t3") {
    startMonth = 4; endMonth = 6; termYear = academicStartYear + 1;
  } else {
    startMonth = 9; endMonth = 12; termYear = academicStartYear;
  }
  return { from: formatYMD(new Date(termYear, startMonth - 1, 1)), to: formatYMD(new Date(termYear, endMonth, 0)) };
}

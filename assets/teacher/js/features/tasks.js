import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { getActiveGroupId } from "../../../shared/js/groupState.js";
import { getTaskRangeParams } from "../api/teacherApiHelpers.js";
import { getTenant } from "../bootstrap/teacherBootstrap.js";
import { mapTaskFromApi } from "../tasks.js";

export async function loadTasksForActiveGroup(ctx) {
  const { state } = ctx;
  const groupId = getActiveGroupId(getTenant());
  if (!groupId) {
    state.data.tasks = [];
    ctx.renderPlanner();
    await ctx.refreshNotebookForActiveGroup();
    return;
  }

  const range = getTaskRangeParams(state.range);
  const res = await apiFetch(
    `/api/v1/tasks?group_id=${encodeURIComponent(groupId)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&limit=200&offset=0`
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/login";
      return;
    }
    state.data.tasks = [];
    ctx.renderPlanner();
    await ctx.refreshNotebookForActiveGroup();
    return;
  }

  const items = body?.data?.items || [];
  state.data.tasks = items.map((item) =>
    mapTaskFromApi(item, state.tenantId, state.currentTeacherId)
  );
  ctx.renderPlanner();
  await ctx.refreshNotebookForActiveGroup();
}

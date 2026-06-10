import { getTenantSlug } from "../../shared/js/auth.js";

export function normalizeStudentCourse(raw = "") {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s
    .replace(/\s+/g, " ")
    .replace(/eso/gi, "ESO")
    .replace(/bach/gi, "Bach")
    .replace(/bachillerato/gi, "Bachillerato")
    .replace(/primaria/gi, "Primaria")
    .trim();
}

export function extractStudentCourseFromText(text = "") {
  const t = String(text || "").trim();
  if (!t) return "";

  const m1 = t.match(/\b([4-6])\s*º?\s*(primaria)\b/i);
  if (m1) return normalizeStudentCourse(`${m1[1]} Primaria`);

  const m2 = t.match(/\b([1-4])\s*º?\s*(eso)\b/i);
  if (m2) return normalizeStudentCourse(`${m2[1]} ESO`);

  const m3 = t.match(/\b([1-2])\s*º?\s*(bach|bachillerato)\b/i);
  if (m3) return normalizeStudentCourse(`${m3[1]} Bachillerato`);

  const m4 = t.match(/\b([1-4])\s*º?\s*ESO\b/i);
  if (m4) return normalizeStudentCourse(`${m4[1]} ESO`);

  return "";
}

export function getStudentCourseKey() {
  const tenant = getTenantSlug();
  return tenant ? `ttd_studentCourse_${tenant}` : "";
}

export function getStoredStudentCourse() {
  try {
    const key = getStudentCourseKey();
    if (!key) return "";
    return normalizeStudentCourse(localStorage.getItem(key) || "");
  } catch {
    return "";
  }
}

export function storeStudentCourse(course = "") {
  const c = normalizeStudentCourse(course);
  if (c) localStorage.setItem(getStudentCourseKey(), c);
}
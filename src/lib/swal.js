// @ts-nocheck — SweetAlertOptions overloads reject loose `icon`/`text`/`html` pairing from helpers.
import Swal from "sweetalert2";

/**
 * Stage-themed prompts — https://sweetalert2.github.io/
 * Use instead of window.alert / window.confirm so actions feel consistent app-wide.
 */
const base = {
  background: "#0f172a",
  color: "#f1f5f9",
  confirmButtonColor: "#0891b2",
  cancelButtonColor: "#64748b",
};

function formatBody(message) {
  const text = typeof message === "string" ? message : String(message);
  if (text.includes("\n")) {
    return { text: undefined, html: text.replace(/\n/g, "<br>") };
  }
  return { text, html: undefined };
}

/** Replaces window.alert */
export async function swalAlert(message) {
  const { text, html } = formatBody(message);
  await Swal.fire({
    ...base,
    icon: "info",
    title: "",
    text,
    html,
    confirmButtonText: "OK",
  });
}

export async function swalSuccess(message, title = "Done") {
  const { text, html } = formatBody(message);
  await Swal.fire({ ...base, icon: "success", title, text, html });
}

export async function swalError(message, title = "Error") {
  const { text, html } = formatBody(message);
  await Swal.fire({ ...base, icon: "error", title, text, html });
}

/**
 * Replaces window.confirm — returns true if user confirmed.
 * @param {string} message
 * @param {{ title?: string, confirmText?: string, cancelText?: string, icon?: string }} [options]
 */
export async function swalConfirm(message, options = {}) {
  const {
    title = "Are you sure?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    icon = "warning",
  } = options;
  const { text, html } = formatBody(message);
  const r = await Swal.fire({
    ...base,
    icon,
    title,
    text,
    html,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    focusCancel: true,
  });
  return r.isConfirmed;
}

/** Replaces window.prompt — returns trimmed text, or `null` if dismissed. */
export async function swalPrompt(message, options = {}) {
  const {
    title = "",
    placeholder = "",
    confirmText = "OK",
    cancelText = "Cancel",
  } = options;
  const { text, html } = formatBody(message);
  const r = await Swal.fire({
    ...base,
    title,
    text,
    html,
    input: "text",
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
  });
  if (!r.isConfirmed) return null;
  const v = r.value;
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

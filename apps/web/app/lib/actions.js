export function runAction(action) {
  if (action.kind === "open_link") window.open(action.value, "_blank", "noopener");
  if (action.kind === "open_map") {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(action.value)}`,
      "_blank",
      "noopener",
    );
  }
  if (action.kind === "call") window.open(`tel:${action.value}`);
  if (action.kind === "copy_text" || action.kind === "copy_command" || action.kind === "add_to_calendar") {
    navigator.clipboard.writeText(action.value).catch(() => {});
  }
}

export function keepsText(action) {
  return action.kind === "copy_text" || action.kind === "copy_command" || action.kind === "add_to_calendar";
}

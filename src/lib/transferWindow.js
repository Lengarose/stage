/** Dates from transferWindowActions carry explicit offsets. Midnight is exact. */
export function isTransferWindowOpen(window,now=Date.now()) {
  if (!window || String(window.status || "").toLowerCase() !== "open") return false;
  if(window.start_date){const start=Date.parse(window.start_date);if(!Number.isFinite(start)||start>now)return false;}
  if(!window.end_date)return true;
  const end=Date.parse(window.end_date);
  return Number.isFinite(end)&&now<end;
}

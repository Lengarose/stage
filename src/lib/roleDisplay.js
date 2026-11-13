/** Display terminology only: persisted role keys remain backwards compatible. */
export function roleDisplayText(value) {
  return String(value ?? '').replace(/\bPresidents\b/g, 'Managers').replace(/\bPresident\b/g, 'Manager')
    .replace(/\bpresidents\b/g, 'managers').replace(/\bpresident\b/g, 'manager')
    .replace(/\bPrésidents\b/g, 'Managers').replace(/\bPrésident\b/g, 'Manager')
    .replace(/\bprésidents\b/g, 'managers').replace(/\bprésident\b/g, 'manager');
}

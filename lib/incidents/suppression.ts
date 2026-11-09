// Small-group suppression (Incident operations engineering tab, §6).
// A figure drawn from fewer than k staff becomes one person's score, so it is
// merged or hidden at query time. Screens and exports call the same function.
//
// Merge order per section: 15 → 30 → 60-minute windows; then sections are
// merged within the hour; anything still below k is suppressed.
//
// Staff counts: merging windows takes the MAX across windows (the same person
// may work both, so summing would overstate distinct staff); merging sections
// SUMS (staff are assigned to one section at a time). Both choices err toward
// suppressing more, not less.
//
// Limitation: this does not do complementary suppression across separately
// published tables; keep totals off any screen that also shows these cells.

export interface WindowCell {
  location_id: string;
  section: string;
  /** ISO start of the window. */
  window_start: string;
  window_minutes: 15 | 30 | 60;
  staff_on_shift: number;
  value: number;
}

export interface DisplayCell {
  location_id: string;
  sections: string[];
  window_start: string;
  window_minutes: 15 | 30 | 60;
  staff_on_shift: number;
  value: number | null;
  status: "shown" | "suppressed";
  note: string | null;
}

/** PROPOSED: the owner sets k per outlet with HR or legal input. */
export const PROPOSED_MIN_STAFF = 3;

const floorTo = (iso: string, minutes: number) => {
  const ms = Date.parse(iso);
  const step = minutes * 60_000;
  return new Date(Math.floor(ms / step) * step).toISOString();
};

function mergeWindows(cells: WindowCell[], minutes: 30 | 60): WindowCell[] {
  const groups = new Map<string, WindowCell[]>();
  for (const cell of cells) {
    const key = floorTo(cell.window_start, minutes);
    groups.set(key, [...(groups.get(key) ?? []), cell]);
  }
  return [...groups.entries()].map(([start, group]) => ({
    location_id: group[0].location_id,
    section: group[0].section,
    window_start: start,
    window_minutes: minutes,
    staff_on_shift: Math.max(...group.map((cell) => cell.staff_on_shift)),
    value: group.reduce((sum, cell) => sum + cell.value, 0),
  }));
}

const shown = (cell: WindowCell, sections = [cell.section]): DisplayCell => ({
  location_id: cell.location_id,
  sections,
  window_start: cell.window_start,
  window_minutes: cell.window_minutes,
  staff_on_shift: cell.staff_on_shift,
  value: cell.value,
  status: "shown",
  note: null,
});

export function suppressSmallGroups(cells: WindowCell[], k: number = PROPOSED_MIN_STAFF): DisplayCell[] {
  if (!Number.isInteger(k) || k < 1) throw new RangeError("k must be a positive integer");
  const output: DisplayCell[] = [];

  // Work one location-hour at a time.
  const hours = new Map<string, WindowCell[]>();
  for (const cell of cells) {
    const key = `${cell.location_id}|${floorTo(cell.window_start, 60)}`;
    hours.set(key, [...(hours.get(key) ?? []), cell]);
  }

  for (const [key, hourCells] of hours) {
    const [location_id, hourStart] = key.split("|");
    const failing: WindowCell[] = []; // section-level 60-minute cells still below k

    const bySection = new Map<string, WindowCell[]>();
    for (const cell of hourCells) bySection.set(cell.section, [...(bySection.get(cell.section) ?? []), cell]);

    for (const sectionCells of bySection.values()) {
      if (sectionCells.every((cell) => cell.staff_on_shift >= k)) {
        output.push(...sectionCells.map((cell) => shown(cell)));
        continue;
      }
      const thirty = mergeWindows(sectionCells, 30);
      if (thirty.every((cell) => cell.staff_on_shift >= k)) {
        output.push(...thirty.map((cell) => shown(cell)));
        continue;
      }
      const sixty = mergeWindows(sectionCells, 60)[0];
      if (sixty.staff_on_shift >= k) output.push(shown(sixty));
      else failing.push(sixty);
    }

    if (failing.length === 0) continue;
    const staff = failing.reduce((sum, cell) => sum + cell.staff_on_shift, 0);
    const sections = failing.map((cell) => cell.section).sort();
    if (staff >= k) {
      output.push({
        location_id,
        sections,
        window_start: hourStart,
        window_minutes: 60,
        staff_on_shift: staff,
        value: failing.reduce((sum, cell) => sum + cell.value, 0),
        status: "shown",
        note: "sections merged to protect staff",
      });
    } else {
      output.push({
        location_id,
        sections,
        window_start: hourStart,
        window_minutes: 60,
        staff_on_shift: staff,
        value: null,
        status: "suppressed",
        note: `suppressed: fewer than ${k} staff`,
      });
    }
  }

  return output.sort((a, b) => a.window_start.localeCompare(b.window_start) || a.sections.join().localeCompare(b.sections.join()));
}

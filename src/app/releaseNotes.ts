export type ReleaseNotesPatch = {
  version: string;
  notes: string[];
};

// Newest patch first.
export const RELEASE_NOTES: ReleaseNotesPatch[] = [
  {
    version: "0.3.1",
    notes: ["Further app fixes and optimizations."],
  },
  {
    version: "0.2.9",
    notes: [
      "Renamed Share to Ratio in the skills table and added a Crit+Heavy column.",
      "Improved Damage Over Time overlays: renamed Stability to Rotation consistency and clarified Burst damage labeling/tooltips.",
      "Refreshed the Target Overview layout (more compact, better alignment with table columns) and moved Compare/Export buttons into their own column.",
      "Moved the Character card above Logs and updated its layout (class + weapon combo row, weapons shown as “A | B”).",
      "Added Pull numbering formatting (e.g. Pull # 1) in tabs and overview.",
      "Improved default zoom scaling for 1080p/1440p displays.",
    ],
  },
  {
    version: "0.2.7",
    notes: [
      "Refactored Burst detection to use local spikes (smoothed DPS vs rolling median baseline) with hysteresis, minimum duration, refractory time, and gap/segment awareness.",
      "Replaced the Burst chip with a stable Burst intensity % that ramps up before a burst, holds at 100% during a burst window, then decays after.",
      "Adjusted burst peak markers to land on the highest DPS point within each burst window.",
      "Renamed Sessions to Pulls across the UI for more accurate terminology.",
      "Improved Release Notes UI",
    ],
  },
  {
    version: "0.2.6",
    notes: [
      "Added DPS / Cumulative tabs on the Damage Over Time graph.",
      "Added Burst and Stability overlays with improved burst detection.",
      "Added a click-to-pin graph tooltip with a close button and scrollable skill list (with icons).",
      "Improved All Pulls timeline rendering by removing large gaps between pulls.",
      "Fixed timeline generation to include every second (fills missing seconds with 0 damage) for correct graphs.",
      "Added per-second skill execution details to the timeline and tooltip.",
      "Added sortable columns (asc/desc) on the skills table (all except Skill) while keeping the default order unchanged.",
      "Pinned the Total row at the bottom of the skills table and improved the table layout behavior.",
      "Updated various UI styles to better match the app theme (tooltips/toggles/cards/spacing).",
    ],
  },
];

// Duplicate of `TimelineLabels.js` left over from the Jest → Bun test migration.
// Bundlers disagree on which extension wins (vite resolves `.js` first, bun resolves `.jsx` first),
// so this file only re-exports the real implementation to keep a single source of truth.
export { HtxTimelineLabels, TimelineLabelsModel } from "./TimelineLabels.js";

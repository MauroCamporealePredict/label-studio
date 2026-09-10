import { clamp } from "../../../../utils/utilities";
import type { TimelineRegionKeyframe } from "../../Types";

/** Default timeline viewport height when `timelineHeight` is not set on `<Video>`. */
export const DEFAULT_TIMELINE_VIEWPORT_HEIGHT = 64;

/**
 * Height of a single region row in the timeline.
 * Keep in sync with `.keypoints` in `Keypoints.prefix.css` — the virtual scrolling math here
 * and the rendered row have to agree or rows drift out of the viewport as you scroll.
 */
export const KEYPOINT_ROW_HEIGHT = 24;

const KEYPOINT_VIRTUAL_OVERSCAN = 5;

export const computeKeypointsVirtualBounds = (
  scrollTop: number,
  regionsLength: number,
  viewportHeight: number,
  rowHeight = KEYPOINT_ROW_HEIGHT,
  extra = KEYPOINT_VIRTUAL_OVERSCAN,
): [number, number] => {
  const sIdx = clamp(Math.ceil(scrollTop / rowHeight) - 1, 0, regionsLength);
  const visibleRows = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const eIdx = clamp(sIdx + visibleRows - 1, 0, regionsLength);

  return [clamp(sIdx - extra, 0, regionsLength), clamp(eIdx + extra, 0, regionsLength)];
};

export interface Lifespan {
  offset: number;
  width: number;
  length: number;
  enabled: boolean;
  start: number;
  points: TimelineRegionKeyframe[];
  locked?: boolean;
}

export const visualizeLifespans = (keyframes: TimelineRegionKeyframe[], step: number, locked = false) => {
  if (keyframes.length === 0) return [];

  const lifespans: Lifespan[] = [];
  const start = keyframes[0].frame - 1;

  for (let i = 0, l = keyframes.length; i < l; i++) {
    const lastSpan = lifespans[lifespans.length - 1];
    const point = keyframes[i];
    const prevPoint = keyframes[i - 1];
    const offset = (point.frame - start - 1) * step;

    if (!lastSpan || !lastSpan?.enabled) {
      lifespans.push({
        offset,
        width: 0,
        length: 0,
        enabled: point.enabled,
        start: point.frame,
        points: [point],
        locked,
      });
    } else if (prevPoint?.enabled) {
      lastSpan.width = (point.frame - lastSpan.points[0].frame) * step;
      lastSpan.length = point.frame - lastSpan.start;
      lastSpan.enabled = point.enabled;
      lastSpan.points.push(point);
    }
  }

  return lifespans;
};

/** Inclusive `[start, end]` frame range */
export type FrameInterval = [number, number];

/**
 * Frame ranges covered by a region. A lifespan whose last keyframe is still enabled runs to the
 * end of the video, which is why `totalFrames` is needed to close it.
 */
export const lifespanIntervals = (keyframes: TimelineRegionKeyframe[], totalFrames: number): FrameInterval[] => {
  return visualizeLifespans(keyframes, 1).map((span) => [
    span.start,
    span.enabled ? totalFrames : span.start + span.length,
  ]);
};

/** Does the region cover any frame inside `[from, to]`? */
export const coversFrameRange = (
  keyframes: TimelineRegionKeyframe[],
  from: number,
  to: number,
  totalFrames: number,
) => {
  return lifespanIntervals(keyframes, totalFrames).some(([start, end]) => start <= to && end >= from);
};

/** Union of the given ranges; ranges that touch frame to frame are joined into one */
export const mergeIntervals = (intervals: FrameInterval[]): FrameInterval[] => {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: FrameInterval[] = [];

  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];

    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
};

/**
 * Ranges covered by two or more of the given ranges — the parts where regions sharing a row
 * would be drawn on top of each other.
 */
export const overlappingIntervals = (intervals: FrameInterval[]): FrameInterval[] => {
  // a range ends *after* its last frame, so a range ending at 5 and one starting at 5 do overlap
  const events: FrameInterval[] = intervals.flatMap(([start, end]) => [
    [start, 1],
    [end + 1, -1],
  ]);

  // closing before opening on the same frame, so ranges that merely touch don't count
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const overlaps: FrameInterval[] = [];
  let depth = 0;
  let start: number | null = null;

  for (const [frame, delta] of events) {
    const previous = depth;

    depth += delta;

    if (previous < 2 && depth >= 2) {
      start = frame;
    } else if (previous >= 2 && depth < 2 && start !== null) {
      overlaps.push([start, frame - 1]);
      start = null;
    }
  }

  return overlaps;
};

/** Rebuild the keyframes a timeline row renders from a set of ranges */
export const intervalsToSequence = (intervals: FrameInterval[]): TimelineRegionKeyframe[] => {
  return intervals.flatMap(([start, end]) =>
    start === end
      ? [{ frame: start, enabled: false }]
      : [
          { frame: start, enabled: true },
          { frame: end, enabled: false },
        ],
  );
};

export const findClosestKeypoint = (frames: number[], position: number, direction: -1 | 1) => {
  const targetFrames = frames.filter((f) => (direction === -1 ? f < position : f > position));

  return targetFrames[direction === -1 ? targetFrames.length - 1 : 0] ?? position;
};

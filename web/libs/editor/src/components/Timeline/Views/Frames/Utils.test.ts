import { describe, expect, it } from "bun:test";
import {
  computeKeypointsVirtualBounds,
  coversFrameRange,
  DEFAULT_TIMELINE_VIEWPORT_HEIGHT,
  intervalsToSequence,
  KEYPOINT_ROW_HEIGHT,
  lifespanIntervals,
  mergeIntervals,
  overlappingIntervals,
} from "./Utils";

/** Previous hardcoded viewport used by KeypointsVirtual before FIT-2656. */
const LEGACY_VIRTUAL_VIEWPORT = 165;
const OVERSCAN = 5;

/** Rows that fit in `height`, so these expectations survive a change of row height */
const rowsIn = (height: number) => Math.ceil(height / KEYPOINT_ROW_HEIGHT);

describe("computeKeypointsVirtualBounds", () => {
  it("covers all visible rows for default timeline height at scrollTop 0", () => {
    const [start, end] = computeKeypointsVirtualBounds(0, 20, DEFAULT_TIMELINE_VIEWPORT_HEIGHT);

    expect(start).toBe(0);
    expect(end).toBe(rowsIn(DEFAULT_TIMELINE_VIEWPORT_HEIGHT) - 1 + OVERSCAN);
  });

  it("renders more rows than legacy 165px window for tall timelines (FIT-2656)", () => {
    const regionsLength = 20;
    const [, legacyEnd] = computeKeypointsVirtualBounds(0, regionsLength, LEGACY_VIRTUAL_VIEWPORT);
    const [, tallEnd] = computeKeypointsVirtualBounds(0, regionsLength, 300);

    expect(tallEnd).toBeGreaterThan(legacyEnd);
    // a 300px viewport must cover every row visible without scrolling, plus the overscan
    expect(tallEnd).toBeGreaterThanOrEqual(rowsIn(300));
  });

  it("includes the last row when the full timeline fits in the viewport", () => {
    const regionsLength = 20;
    const viewportHeight = regionsLength * KEYPOINT_ROW_HEIGHT;
    const [, end] = computeKeypointsVirtualBounds(0, regionsLength, viewportHeight);

    expect(end).toBe(regionsLength);
  });

  it("does not extend past region count", () => {
    const [start, end] = computeKeypointsVirtualBounds(0, 5, 300);

    expect(start).toBe(0);
    expect(end).toBe(5);
  });

  it("shifts window when scrolled vertically", () => {
    const scrollTop = KEYPOINT_ROW_HEIGHT * 10;
    const [start, end] = computeKeypointsVirtualBounds(scrollTop, 30, DEFAULT_TIMELINE_VIEWPORT_HEIGHT);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
  });
});

describe("coversFrameRange", () => {
  const TOTAL = 100;
  /** a closed span, the shape a TimelineLabels region serializes to */
  const span = (start: number, end: number) => [
    { frame: start, enabled: true },
    { frame: end, enabled: false },
  ];

  it("is false for a region with no keyframes", () => {
    expect(coversFrameRange([], 1, 50, TOTAL)).toBe(false);
  });

  it("finds a region fully inside the window", () => {
    expect(coversFrameRange(span(10, 20), 5, 30, TOTAL)).toBe(true);
  });

  it("finds a region that only overlaps the window", () => {
    expect(coversFrameRange(span(10, 20), 15, 30, TOTAL)).toBe(true);
    expect(coversFrameRange(span(10, 20), 1, 12, TOTAL)).toBe(true);
  });

  it("counts a window touching the region edges", () => {
    expect(coversFrameRange(span(10, 20), 20, 30, TOTAL)).toBe(true);
    expect(coversFrameRange(span(10, 20), 1, 10, TOTAL)).toBe(true);
  });

  it("rejects a region outside the window", () => {
    expect(coversFrameRange(span(10, 20), 21, 30, TOTAL)).toBe(false);
    expect(coversFrameRange(span(10, 20), 1, 9, TOTAL)).toBe(false);
  });

  it("treats a single-frame region as covering just that frame", () => {
    expect(coversFrameRange([{ frame: 7, enabled: false }], 7, 7, TOTAL)).toBe(true);
    expect(coversFrameRange([{ frame: 7, enabled: false }], 8, 12, TOTAL)).toBe(false);
  });

  it("runs a span left enabled to the end of the video", () => {
    const openEnded = [{ frame: 5, enabled: true }];

    expect(coversFrameRange(openEnded, 90, TOTAL, TOTAL)).toBe(true);
    expect(coversFrameRange(openEnded, 1, 4, TOTAL)).toBe(false);
  });

  it("ignores the gap between two spans of the same region", () => {
    const withGap = [...span(5, 10), ...span(40, 50)];

    expect(coversFrameRange(withGap, 20, 30, TOTAL)).toBe(false);
    expect(coversFrameRange(withGap, 42, 45, TOTAL)).toBe(true);
  });
});

describe("lifespanIntervals", () => {
  it("reads a closed range straight off the keyframes", () => {
    expect(
      lifespanIntervals(
        [
          { frame: 3, enabled: true },
          { frame: 9, enabled: false },
        ],
        100,
      ),
    ).toEqual([[3, 9]]);
  });

  it("closes an open ended range at the end of the video", () => {
    expect(lifespanIntervals([{ frame: 3, enabled: true }], 100)).toEqual([[3, 100]]);
  });

  it("returns one range per lifespan", () => {
    const keyframes = [
      { frame: 3, enabled: true },
      { frame: 9, enabled: false },
      { frame: 20, enabled: true },
      { frame: 25, enabled: false },
    ];

    expect(lifespanIntervals(keyframes, 100)).toEqual([
      [3, 9],
      [20, 25],
    ]);
  });
});

describe("mergeIntervals", () => {
  it("joins overlapping ranges", () => {
    expect(
      mergeIntervals([
        [1, 10],
        [5, 20],
      ]),
    ).toEqual([[1, 20]]);
  });

  it("joins ranges that touch frame to frame", () => {
    expect(
      mergeIntervals([
        [1, 5],
        [6, 10],
      ]),
    ).toEqual([[1, 10]]);
  });

  it("keeps ranges with a gap apart", () => {
    expect(
      mergeIntervals([
        [1, 5],
        [8, 10],
      ]),
    ).toEqual([
      [1, 5],
      [8, 10],
    ]);
  });

  it("swallows a range contained in another", () => {
    expect(
      mergeIntervals([
        [1, 20],
        [5, 10],
      ]),
    ).toEqual([[1, 20]]);
  });

  it("does not care about the input order", () => {
    expect(
      mergeIntervals([
        [8, 10],
        [1, 5],
      ]),
    ).toEqual([
      [1, 5],
      [8, 10],
    ]);
  });
});

describe("overlappingIntervals", () => {
  it("finds nothing when ranges are apart", () => {
    expect(
      overlappingIntervals([
        [1, 5],
        [8, 10],
      ]),
    ).toEqual([]);
  });

  it("does not count ranges that only touch frame to frame", () => {
    expect(
      overlappingIntervals([
        [1, 5],
        [6, 10],
      ]),
    ).toEqual([]);
  });

  it("finds the shared part of two ranges", () => {
    expect(
      overlappingIntervals([
        [1, 10],
        [6, 20],
      ]),
    ).toEqual([[6, 10]]);
  });

  it("counts a single shared frame", () => {
    expect(
      overlappingIntervals([
        [1, 5],
        [5, 10],
      ]),
    ).toEqual([[5, 5]]);
  });

  it("reports the contained range when one swallows another", () => {
    expect(
      overlappingIntervals([
        [1, 20],
        [5, 10],
      ]),
    ).toEqual([[5, 10]]);
  });

  it("reports each overlapping stretch separately", () => {
    expect(
      overlappingIntervals([
        [1, 10],
        [5, 8],
        [30, 40],
        [35, 50],
      ]),
    ).toEqual([
      [5, 8],
      [35, 40],
    ]);
  });

  it("keeps a stretch covered by three ranges as one", () => {
    expect(
      overlappingIntervals([
        [1, 10],
        [3, 8],
        [4, 6],
      ]),
    ).toEqual([[3, 8]]);
  });
});

describe("intervalsToSequence", () => {
  it("turns a range into an enabled and a disabled keyframe", () => {
    expect(intervalsToSequence([[3, 9]])).toEqual([
      { frame: 3, enabled: true },
      { frame: 9, enabled: false },
    ]);
  });

  it("turns a single frame range into one disabled keyframe", () => {
    expect(intervalsToSequence([[4, 4]])).toEqual([{ frame: 4, enabled: false }]);
  });

  it("round-trips through lifespanIntervals", () => {
    const intervals: [number, number][] = [
      [3, 9],
      [20, 25],
    ];

    expect(lifespanIntervals(intervalsToSequence(intervals), 100)).toEqual(intervals);
  });
});

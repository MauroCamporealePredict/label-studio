import { fireEvent, render } from "@testing-library/react";
import { Keypoints } from "./Keypoints";
import { TimelineContext } from "../../Context";
import { cn } from "../../../../utils/bem";
import type { TimelineRegion } from "../../Types";

const sel = (block: string, elem?: string) => {
  const c = elem ? cn(block).elem(elem) : cn(block);
  return `.${c.toClassName().split(" ")[0]}`;
};

const STEP = 10;

const sequence = (start: number, end: number) => [
  { frame: start, enabled: true },
  { frame: end, enabled: false },
];

const member = (id: string, start: number, end: number): TimelineRegion =>
  ({
    id,
    label: "Moving",
    color: "#ff0000",
    visible: true,
    selected: false,
    timeline: true,
    sequence: sequence(start, end),
  }) as TimelineRegion;

function renderRow(region: TimelineRegion, onSelectRegion?: any) {
  return render(
    <TimelineContext.Provider
      value={
        { position: 0, length: 100, regions: [], step: STEP, playing: false, visibleWidth: 100, seekOffset: 0 } as any
      }
    >
      <Keypoints region={region} startOffset={0} renderable onSelectRegion={onSelectRegion} />
    </TimelineContext.Provider>,
  );
}

const lifespans = () => document.querySelectorAll("[data-lifespan]");
const overlaps = () => document.querySelectorAll(sel("keypoints", "overlap"));

describe("Keypoints", () => {
  describe("a plain row", () => {
    it("draws its own lifespans and marks no overlap", () => {
      renderRow(member("r1", 1, 10));

      expect(lifespans()).toHaveLength(1);
      expect(overlaps()).toHaveLength(0);
    });

    it("reports its own id when clicked", () => {
      const onSelectRegion = mock();
      renderRow(member("r1", 1, 10), onSelectRegion);

      fireEvent.click(lifespans()[0]);

      expect(onSelectRegion).toHaveBeenCalledWith(expect.anything(), "r1", true);
    });
  });

  describe("a row grouping several regions of one label", () => {
    const grouped = (overlapRanges: [number, number][] = []): TimelineRegion =>
      ({
        id: "label:Moving",
        label: "Moving",
        color: "#ff0000",
        visible: true,
        selected: false,
        timeline: true,
        // the merged sequence the row would show on its own
        sequence: sequence(1, 25),
        members: [member("a", 1, 10), member("b", 15, 25)],
        overlaps: overlapRanges,
      }) as TimelineRegion;

    it("draws one lifespan per region instead of the merged one", () => {
      renderRow(grouped());

      expect(lifespans()).toHaveLength(2);
    });

    it("reports the region under the cursor, not the row", () => {
      const onSelectRegion = mock();
      renderRow(grouped(), onSelectRegion);

      fireEvent.click(lifespans()[1]);

      expect(onSelectRegion).toHaveBeenCalledWith(expect.anything(), "b", true);
    });

    it("falls back to the row when the click misses every region", () => {
      const onSelectRegion = mock();
      renderRow(grouped(), onSelectRegion);

      fireEvent.click(document.querySelector("[data-timeline-strip]") as Element);

      expect(onSelectRegion).toHaveBeenCalledWith(expect.anything(), "label:Moving", true);
    });

    it("hatches the stretch where two regions overlap", () => {
      renderRow(grouped([[6, 10]]));

      const [hatch] = Array.from(overlaps()) as HTMLElement[];

      expect(hatch).toBeDefined();
      // frames 6 to 10 inclusive, laid out on the same grid as the lifespans
      expect(hatch.style.left).toBe(`${5 * STEP + STEP / 2}px`);
      expect(hatch.style.width).toBe(`${5 * STEP}px`);
    });
  });
});

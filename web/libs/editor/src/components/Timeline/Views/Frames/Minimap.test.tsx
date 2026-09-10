import { render } from "@testing-library/react";
import { Minimap } from "./Minimap";
import { TimelineContext } from "../../Context";
import { cn } from "../../../../utils/bem";

const sel = (block: string, elem?: string) => {
  const c = elem ? cn(block).elem(elem) : cn(block);
  return `.${c.toClassName().split(" ")[0]}`;
};

const region = (id: string, start = 1, end = 10) => ({
  id,
  index: 0,
  label: id,
  color: "#ff0000",
  visible: true,
  selected: false,
  timeline: true,
  sequence: [
    { frame: start, enabled: true },
    { frame: end, enabled: false },
  ],
});

function renderMinimap(regions: any[]) {
  return render(
    <TimelineContext.Provider
      value={
        {
          position: 0,
          length: 100,
          regions,
          step: 10,
          playing: false,
          settings: {},
          visibleWidth: 100,
          seekOffset: 0,
          data: undefined,
        } as any
      }
    >
      <Minimap />
    </TimelineContext.Provider>,
  );
}

const bands = () => document.querySelectorAll(sel("minimap", "region"));

describe("Minimap", () => {
  it("draws a band for every region, not just the first few", () => {
    const regions = Array.from({ length: 12 }, (_, i) => region(`r${i}`));

    renderMinimap(regions);

    expect(bands()).toHaveLength(12);
  });

  it("skips the 'new' placeholder row, which has nothing to draw", () => {
    const regions = [{ ...region("new"), sequence: [] }, region("r1"), region("r2")];

    renderMinimap(regions);

    expect(bands()).toHaveLength(2);
  });
});

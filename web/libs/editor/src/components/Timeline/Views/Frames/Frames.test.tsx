import { act, render, screen } from "@testing-library/react";
import * as resizeObserverModule from "@humansignal/core/hooks/useResizeObserver";
import * as keypointsModule from "./Keypoints";
import { Frames } from "./Frames";
import { KEYPOINT_ROW_HEIGHT } from "./Utils";
import type { TimelineRegion } from "../../Types";
import { cn } from "../../../../utils/bem";

const sel = (block: string, elem?: string) => {
  const c = elem ? cn(block).elem(elem) : cn(block);
  return `.${c.toClassName().split(" ")[0]}`;
};

const defaultProps = {
  step: 10,
  offset: 0,
  position: 1,
  length: 100,
  playing: false,
  regions: [
    {
      id: "r1",
      index: 0,
      label: "Region 1",
      color: "#ff0000",
      visible: true,
      selected: false,
      sequence: [],
      timeline: true,
    },
  ] as any,
  onScroll: mock(),
  onPositionChange: mock(),
  onResize: mock(),
};

describe("Frames", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    spyOn(resizeObserverModule, "useResizeObserver").mockReturnValue({ width: 400 } as any);
    spyOn(keypointsModule, "Keypoints").mockImplementation((() => <div data-testid="keypoints-mock" />) as any);
  });

  it("renders timeline frames structure", () => {
    render(<Frames {...defaultProps} />);
    expect(document.querySelector(sel("timeline-frames"))).toBeInTheDocument();
    expect(document.querySelector(sel("timeline-frames", "controls"))).toBeInTheDocument();
    expect(document.querySelector(sel("timeline-frames", "scroll"))).toBeInTheDocument();
    expect(document.querySelector(sel("timeline-frames", "background"))).toBeInTheDocument();
  });

  it("renders indicator element", () => {
    render(<Frames {...defaultProps} />);
    expect(document.querySelector(sel("timeline-frames", "indicator"))).toBeInTheDocument();
  });

  it("renders keypoints virtual list", () => {
    render(<Frames {...defaultProps} />);
    expect(screen.getByTestId("keypoints-mock")).toBeInTheDocument();
  });

  it("uses leftOffset when provided", () => {
    const { container } = render(<Frames {...defaultProps} leftOffset={200} />);
    const labelsBg = container.querySelector(sel("timeline-frames", "labels-bg"));
    expect(labelsBg).toHaveStyle({ width: "200px" });
  });

  it("calls onResize when layout is computed", () => {
    render(<Frames {...defaultProps} />);
    expect(defaultProps.onResize).toHaveBeenCalled();
  });

  it("handles wheel scroll on scroll area", async () => {
    render(<Frames {...defaultProps} />);
    const scrollArea = document.querySelector(sel("timeline-frames", "scroll"));
    expect(scrollArea).toBeInTheDocument();
    Object.defineProperty(scrollArea, "scrollWidth", { value: 2000, configurable: true });
    Object.defineProperty(scrollArea, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(scrollArea, "scrollHeight", { value: 200, configurable: true });
    Object.defineProperty(scrollArea, "clientHeight", { value: 100, configurable: true });
    await act(async () => {
      scrollArea?.dispatchEvent(new WheelEvent("wheel", { deltaX: 50, deltaY: 0, bubbles: true }));
    });
    expect(defaultProps.onScroll).toHaveBeenCalled();
  });

  it("handles mouse leave to clear hover offset", () => {
    render(<Frames {...defaultProps} />);
    const scrollArea = document.querySelector(sel("timeline-frames", "scroll"));
    scrollArea?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(document.querySelector(sel("timeline-frames", "hover"))).not.toBeInTheDocument();
  });

  it("handles indicator mouse down for position change", async () => {
    const onPositionChange = mock();
    render(<Frames {...defaultProps} onPositionChange={onPositionChange} />);
    const indicator = document.querySelector(sel("timeline-frames", "indicator"));
    const scrollArea = document.querySelector(sel("timeline-frames", "scroll"));
    Object.defineProperty(scrollArea, "scrollWidth", { value: 2000, configurable: true });
    Object.defineProperty(indicator, "clientWidth", { value: 10, configurable: true });
    Object.defineProperty(indicator, "offsetLeft", { value: 150, configurable: true });
    await act(async () => {
      indicator?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, pageX: 160 }));
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, pageX: 200 }));
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    expect(onPositionChange).toHaveBeenCalled();
  });

  it("syncs offset when offset prop changes", () => {
    const { rerender } = render(<Frames {...defaultProps} offset={0} />);
    const scrollArea = document.querySelector(sel("timeline-frames", "scroll")) as HTMLDivElement;
    expect(scrollArea).toBeInTheDocument();
    rerender(<Frames {...defaultProps} offset={2} />);
    expect(scrollArea).toBeInTheDocument();
  });

  it("renders with empty regions", () => {
    render(<Frames {...defaultProps} regions={[]} />);
    expect(document.querySelector(sel("timeline-frames"))).toBeInTheDocument();
  });

  it("renders with length 0 without throwing", () => {
    render(<Frames {...defaultProps} length={0} />);
    expect(document.querySelector(sel("timeline-frames"))).toBeInTheDocument();
  });

  it("applies height style when height prop is provided", () => {
    const { container } = render(<Frames {...defaultProps} height={200} />);
    const root = container.querySelector(sel("timeline-frames")) as HTMLElement;
    expect(root?.style.getPropertyValue("--view-height")).toBe("200px");
  });

  it("calls onStartDrawing when clicking on keyframes area with no region", async () => {
    const onStartDrawing = mock(
      () => ({ id: "new", ranges: [{ start: 1, end: 1 }], object: { length: 100 }, setRange: mock() }) as any,
    );
    render(<Frames {...defaultProps} onStartDrawing={onStartDrawing} />);
    const scrollArea = document.querySelector(sel("timeline-frames", "scroll")) as HTMLElement;
    expect(scrollArea).toBeInTheDocument();
    scrollArea.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    await act(async () => {
      const ev = new MouseEvent("mousedown", {
        bubbles: true,
        clientX: 200,
        clientY: 10,
      });
      Object.defineProperty(ev, "pageX", { value: 200, configurable: true });
      Object.defineProperty(ev, "target", { value: scrollArea, configurable: true });
      scrollArea.dispatchEvent(ev);
    });
    expect(onStartDrawing).toHaveBeenCalled();
  });

  it("scrolls position when position prop changes outside visible range", () => {
    const onScroll = mock();
    const { rerender } = render(<Frames {...defaultProps} position={1} offset={0} onScroll={onScroll} />);
    const scrollArea = document.querySelector(sel("timeline-frames", "scroll")) as HTMLDivElement;
    if (scrollArea) {
      Object.defineProperty(scrollArea, "scrollWidth", { value: 2000, configurable: true });
      Object.defineProperty(scrollArea, "clientWidth", { value: 400, configurable: true });
    }
    rerender(<Frames {...defaultProps} position={50} offset={0} onScroll={onScroll} />);
    expect(onScroll).toHaveBeenCalled();
  });

  it("clamps edited timeline region start frame to the first frame", async () => {
    const setRange = mock();
    const onStartDrawing = mock(() => ({
      id: "r1",
      ranges: [{ start: 5, end: 10 }],
      object: { length: 100 },
      setRange,
    }));

    render(
      <Frames
        {...defaultProps}
        onStartDrawing={onStartDrawing}
        regions={[
          {
            ...defaultProps.regions[0],
            sequence: [
              { frame: 5, enabled: true },
              { frame: 10, enabled: false },
            ],
          },
        ]}
      />,
    );

    const scrollArea = document.querySelector(sel("timeline-frames", "scroll")) as HTMLElement;
    const regionRow = document.createElement("div");
    regionRow.dataset.id = "r1";
    regionRow.dataset.start = "5";
    regionRow.dataset.end = "10";
    scrollArea.appendChild(regionRow);
    expect(scrollArea).toBeInTheDocument();

    scrollArea.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      const mouseDown = new MouseEvent("mousedown", {
        bubbles: true,
        clientX: 190,
        clientY: 10,
      });
      Object.defineProperty(mouseDown, "pageX", { value: 190, configurable: true });
      Object.defineProperty(mouseDown, "target", { value: regionRow, configurable: true });
      scrollArea.dispatchEvent(mouseDown);

      const mouseMove = new MouseEvent("mousemove", {
        bubbles: true,
        clientX: 100,
        clientY: 10,
      });
      Object.defineProperty(mouseMove, "pageX", { value: 100, configurable: true });
      document.dispatchEvent(mouseMove);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(onStartDrawing).toHaveBeenCalledWith({ region: "r1", frame: 5 });
    expect(setRange).toHaveBeenCalledWith([1, 10], { mode: "edit" });
  });
  describe("keypoints container height", () => {
    const keypointsBox = () => document.querySelector(sel("timeline-frames", "keypoints")) as HTMLElement;
    const region = (id: string) => ({
      id,
      index: 0,
      label: id,
      color: "#ff0000",
      visible: true,
      selected: false,
      sequence: [],
      timeline: true,
    });

    it("reserves one row per region", () => {
      const regions = [region("r1"), region("r2")] as any;
      render(<Frames {...defaultProps} regions={regions} />);

      expect(keypointsBox().style.height).toBe(`${2 * KEYPOINT_ROW_HEIGHT}px`);
    });
  });

  describe("scrolling to the regions inside a picked seeker window", () => {
    const VIEWPORT = 5 * KEYPOINT_ROW_HEIGHT;
    const ROWS = 20;

    /** region covering [start, end]; `null` means an empty row like the "new" placeholder */
    const region = (id: string, range: [number, number] | null): TimelineRegion =>
      ({
        id,
        index: 0,
        label: id,
        color: "#ff0000",
        visible: true,
        selected: false,
        timeline: true,
        sequence: range
          ? [
              { frame: range[0], enabled: true },
              { frame: range[1], enabled: false },
            ]
          : [],
      }) as any;

    /** rows of empty regions with one annotated row at `hitIndex` */
    const rows = (hitIndex: number, range: [number, number]) =>
      Array.from({ length: ROWS }, (_, i) => (i === hitIndex ? region(`hit${i}`, range) : region(`r${i}`, null)));

    const scrollEl = () => document.querySelector(sel("timeline-frames", "scroll")) as HTMLElement;

    const setup = (regions: TimelineRegion[]) => {
      const view = render(<Frames {...defaultProps} regions={regions as any} seekWindow={null} />);
      const el = scrollEl();

      // jsdom has no layout, so the viewport and content sizes have to be declared
      Object.defineProperty(el, "clientHeight", { value: VIEWPORT, configurable: true });
      Object.defineProperty(el, "scrollHeight", { value: ROWS * KEYPOINT_ROW_HEIGHT, configurable: true });

      return view;
    };

    it("scrolls the matching region to the top of the visible area", () => {
      const hitIndex = 15;
      const { rerender } = setup(rows(hitIndex, [1, 20]));

      rerender(
        <Frames
          {...defaultProps}
          regions={rows(hitIndex, [1, 20]) as any}
          seekWindow={{ frame: 0, anchor: "window", nonce: 1 }}
        />,
      );

      expect(scrollEl().scrollTop).toBe(hitIndex * KEYPOINT_ROW_HEIGHT);
    });

    it("picks the most recent region, which is the topmost row of the matching ones", () => {
      // regions are listed newest first, so row 3 was annotated after row 9
      const regions = Array.from({ length: ROWS }, (_, i) =>
        i === 3 || i === 9 ? region(`hit${i}`, [1, 20]) : region(`r${i}`, null),
      );
      const { rerender } = setup(regions);

      rerender(
        <Frames {...defaultProps} regions={regions as any} seekWindow={{ frame: 0, anchor: "window", nonce: 1 }} />,
      );

      expect(scrollEl().scrollTop).toBe(3 * KEYPOINT_ROW_HEIGHT);
    });

    it("leaves the timeline alone when the picked window has no annotations", () => {
      // the only region sits far past the visible window, which starts at frame 1
      const regions = rows(15, [90, 95]);
      const { rerender } = setup(regions);

      rerender(
        <Frames {...defaultProps} regions={regions as any} seekWindow={{ frame: 0, anchor: "window", nonce: 1 }} />,
      );

      expect(scrollEl().scrollTop).toBe(0);
    });

    it("scrolls to the top even when the region is already visible further down", () => {
      const regions = rows(2, [1, 20]);
      const { rerender } = setup(regions);

      rerender(
        <Frames {...defaultProps} regions={regions as any} seekWindow={{ frame: 0, anchor: "window", nonce: 1 }} />,
      );

      expect(scrollEl().scrollTop).toBe(2 * KEYPOINT_ROW_HEIGHT);
    });

    it("scrolls when a point on the bar is clicked, not just when the window is dragged", () => {
      const hitIndex = 12;
      const regions = rows(hitIndex, [1, 20]);
      const { rerender } = setup(regions);

      // clicking frame 5 keeps the window on screen, so the window to look at is the current one
      rerender(
        <Frames {...defaultProps} regions={regions as any} seekWindow={{ frame: 5, anchor: "position", nonce: 1 }} />,
      );

      expect(scrollEl().scrollTop).toBe(hitIndex * KEYPOINT_ROW_HEIGHT);
    });

    it("uses the page the click pages to when the clicked frame is off screen", () => {
      // framesInView is 25 here, so clicking frame 60 pages to frames 51-75
      const hitIndex = 7;
      const regions = Array.from({ length: ROWS }, (_, i) =>
        i === hitIndex ? region(`hit${i}`, [55, 60]) : region(`r${i}`, null),
      );
      const { rerender } = setup(regions);

      rerender(
        <Frames {...defaultProps} regions={regions as any} seekWindow={{ frame: 60, anchor: "position", nonce: 1 }} />,
      );

      expect(scrollEl().scrollTop).toBe(hitIndex * KEYPOINT_ROW_HEIGHT);
    });

    it("picks the row whose region inside the window is the most recent one", () => {
      // row 2 sits higher because of a recent region outside the window, but the newest region
      // that is actually inside it belongs to row 6
      const regions = Array.from({ length: ROWS }, (_, i) => {
        if (i === 2) {
          return {
            ...region("grouped-old", null),
            members: [
              { ...region("far", [80, 90]), index: 99 },
              { ...region("old", [1, 10]), index: 1 },
            ],
          };
        }
        if (i === 6) {
          return { ...region("grouped-new", null), members: [{ ...region("recent", [1, 10]), index: 50 }] };
        }
        return region(`r${i}`, null);
      });
      const { rerender } = setup(regions as any);

      rerender(
        <Frames {...defaultProps} regions={regions as any} seekWindow={{ frame: 0, anchor: "window", nonce: 1 }} />,
      );

      expect(scrollEl().scrollTop).toBe(6 * KEYPOINT_ROW_HEIGHT);
    });

    it("stops at the end of the content for the last rows, which can't reach the top", () => {
      const regions = rows(ROWS - 1, [1, 20]);
      const { rerender } = setup(regions);

      rerender(
        <Frames {...defaultProps} regions={regions as any} seekWindow={{ frame: 0, anchor: "window", nonce: 1 }} />,
      );

      expect(scrollEl().scrollTop).toBe(ROWS * KEYPOINT_ROW_HEIGHT - VIEWPORT);
    });
  });
});

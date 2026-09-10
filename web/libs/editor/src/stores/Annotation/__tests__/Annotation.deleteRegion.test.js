/**
 * Regression tests for `Annotation#deleteRegion()` and the region selection.
 *
 * Selecting a region pushes its labels into the control tags, so deleting a selected region
 * has to drop it from the selection as well, or those labels stay selected with no region
 * behind them. `AreaMixin#deleteRegion()` already did that, but direct callers — the trash
 * button in the details panel — did not.
 */
if (typeof globalThis.structuredClone === "undefined") {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

mockModule("keymaster", () => {
  let scope = "all";
  const keymaster = () => {};
  keymaster.unbind = () => {};
  keymaster.setScope = (nextScope) => {
    scope = nextScope ?? scope;
  };
  keymaster.getScope = () => scope;
  return { __esModule: true, default: keymaster };
});

import "../../../tags/visual/View";
import "../../../tags/object/Image/Image.js";
import "../../../tags/control/Labels/Labels.jsx";
import AppStore from "../../AppStore";

const CONFIG =
  '<View><Image name="img" value="$img" /><Labels name="l" toName="img"><Label value="A" /><Label value="B" /></Labels></View>';

/** `RegionStore#select()` applies the labels through a debounced call */
const flushSelectionDebounce = () => new Promise((resolve) => setTimeout(resolve, 60));

function setup() {
  const store = AppStore.create(
    {
      config: CONFIG,
      task: { id: 1, data: JSON.stringify({ img: "https://example.com/img.jpg" }) },
      interfaces: ["basic"],
    },
    { events: { hasEvent: mock(() => false), invoke: mock() }, messages: {}, settings: {} },
  );
  store.initializeStore({});
  const annotation = store.annotationStore.addAnnotation({ result: [] });
  store.annotationStore.selectAnnotation(annotation.id);

  const image = annotation.names.get("img");
  const control = annotation.names.get("l");
  const region = annotation.createResult(
    { x: 0, y: 0, width: 20, height: 20 },
    { labels: ["A"] },
    control,
    image,
    true,
  );

  return { annotation, control, region };
}

const selectedLabels = (control) => control.selectedLabels.map((l) => l.value);

describe("Annotation#deleteRegion()", () => {
  it("selects the region's labels in the control when the region is selected", async () => {
    const { annotation, control, region } = setup();

    annotation.toggleRegionSelection(region, true);
    await flushSelectionDebounce();

    expect(annotation.selectionSize).toBe(1);
    expect(selectedLabels(control)).toEqual(["A"]);
  });

  it("clears the selection and the labels when a selected region is deleted", async () => {
    const { annotation, control, region } = setup();

    annotation.toggleRegionSelection(region, true);
    await flushSelectionDebounce();
    expect(selectedLabels(control)).toEqual(["A"]);

    annotation.deleteRegion(region);

    expect(annotation.selectionSize).toBe(0);
    expect(selectedLabels(control)).toEqual([]);

    // and the pending debounced update must not bring them back
    await flushSelectionDebounce();
    expect(selectedLabels(control)).toEqual([]);
  });

  it("leaves labels selected on purpose when the region was not selected", async () => {
    const { annotation, control, region } = setup();

    // labels the user picked to draw the next region should survive an unrelated deletion
    control.tiedChildren[1].setSelected(true);

    annotation.deleteRegion(region);
    await flushSelectionDebounce();

    expect(selectedLabels(control)).toEqual(["B"]);
  });
});

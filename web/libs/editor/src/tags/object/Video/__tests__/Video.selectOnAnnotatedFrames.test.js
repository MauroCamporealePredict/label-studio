/**
 * The `selectRegionOnlyOnAnnotatedFrames` attribute of the Video tag only seeds a session
 * toggle that annotators can flip from the timeline settings, so the attribute value must
 * not be read directly anywhere the toggle is meant to win.
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

import "../../../visual/View";
import "../../Video";
import AppStore from "../../../../stores/AppStore";

function createVideoTag(attrs = "") {
  const store = AppStore.create(
    {
      config: `<View><Video name="video" value="$video" ${attrs} /></View>`,
      task: { id: 1, data: JSON.stringify({ video: "/video.mp4" }) },
      interfaces: ["basic"],
    },
    { events: { hasEvent: mock(() => false), invoke: mock() }, messages: {}, settings: {} },
  );
  store.initializeStore({});
  const annotation = store.annotationStore.addAnnotation({ result: [] });
  store.annotationStore.selectAnnotation(annotation.id);

  return annotation.names.get("video");
}

describe("Video#selectOnAnnotatedFramesOnly", () => {
  it("is off unless the attribute asks for it", () => {
    expect(createVideoTag().selectOnAnnotatedFramesOnly).toBe(false);
  });

  it("is seeded by the selectRegionOnlyOnAnnotatedFrames attribute", () => {
    expect(createVideoTag('selectRegionOnlyOnAnnotatedFrames="true"').selectOnAnnotatedFramesOnly).toBe(true);
  });

  it("can be flipped afterwards without touching the attribute", () => {
    const video = createVideoTag('selectRegionOnlyOnAnnotatedFrames="true"');

    video.setSelectOnAnnotatedFramesOnly(false);

    expect(video.selectOnAnnotatedFramesOnly).toBe(false);
    expect(video.selectregiononlyonannotatedframes).toBe(true);
  });
});

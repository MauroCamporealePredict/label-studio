/**
 * Unit tests for TimelineLabels recording mode (tags/control/TimelineLabels.js).
 *
 * Recording reuses the drag API of the timeline (`Video#startDrawing()` →
 * `TimelineRegion#setRange()` → `Video#finishDrawing()`), so the video tag is faked
 * with just that surface plus the observable `frame` the recording reacts to.
 */
import { observable, runInAction } from "mobx";
import { destroy, getRoot, types } from "mobx-state-tree";

import Registry from "../../../core/Registry";
import Tree from "../../../core/Tree";
import "../../visual/View";
import "../Label";
import "../Labels/Labels";
import "../TimelineLabels";

let video;
let createdRegions;
let mockAnnotation;
let mockRoot;

/**
 * Regions are real MST nodes so that `isAlive()` stays reactive: the recording has to
 * notice a deleted region, and a plain object would make `isAlive()` a constant.
 */
const FakeRegion = types
  .model("FakeRegion", {
    id: types.identifier,
    start: types.number,
    end: types.number,
  })
  .views((self) => ({
    get ranges() {
      return [{ start: self.start, end: self.end }];
    },
  }))
  .actions((self) => ({
    setRange([start, end]) {
      self.start = start;
      self.end = end;
    },
  }));

const FakeRegionStore = types.model("FakeRegionStore", { regions: types.array(FakeRegion) }).actions((self) => ({
  add(frame) {
    self.regions.push({ id: `r${self.regions.length}`, start: frame, end: frame });
    return self.regions[self.regions.length - 1];
  },
  // a protected tree can only be modified from an action, which is also how the
  // real app deletes regions (`Annotation#removeArea()`)
  remove(region) {
    destroy(region);
  },
}));

/** Minimal stand-in for the Video tag: observable frame + the drawing API */
function createVideo() {
  const state = observable({ frame: 1, length: 100 });
  const store = FakeRegionStore.create({ regions: [] });

  return {
    type: "video",
    name: "vid",
    ref: { current: { playing: false } },
    get frame() {
      return state.frame;
    },
    get length() {
      return state.length;
    },
    play() {
      this.ref.current.playing = true;
    },
    pause() {
      this.ref.current.playing = false;
    },
    seekTo(frame) {
      runInAction(() => {
        state.frame = frame;
      });
    },
    /** delete a region the way the outliner / details panel does */
    deleteRegion(region) {
      store.remove(region);
    },
    /** stands in for the store unselecting labels in `afterCreateResult()` */
    onRegionCreated: null,
    startDrawing: mock(function startDrawing({ frame }) {
      const region = store.add(frame);
      createdRegions.push(region);
      video.onRegionCreated?.();
      return region;
    }),
    finishDrawing: mock(),
  };
}

function createTag(config) {
  const storeRef = { task: { dataObj: {} } };
  const treeConfig = Tree.treeToModel(config, storeRef);
  const ViewModel = Registry.getModelByTag("view");
  const root = ViewModel.create(treeConfig);

  return root.children.find((c) => c.type === "timelinelabels");
}

const CONFIG = (attrs = "") => `<View>
  <TimelineLabels name="tl" toName="vid" ${attrs}>
    <Label value="A" />
    <Label value="B" />
  </TimelineLabels>
</View>`;

beforeEach(() => {
  clearAllMocks();
  window.STORE_INIT_OK = true;
  createdRegions = [];
  video = createVideo();
  mockAnnotation = {
    id: 1,
    isReadOnly: () => false,
    names: new Map([["vid", video]]),
    regionStore: { regions: [] },
    selectedRegions: [],
    selectedDrawingRegions: [],
    unselectAll: mock(),
  };
  mockRoot = {
    task: { dataObj: {} },
    annotationStore: {
      addErrors: mock(),
      selected: mockAnnotation,
      selectedHistory: mockAnnotation,
    },
  };

  getRoot.mockImplementation((node) => {
    if (node && ["label", "timelinelabels"].includes(node.type)) return mockRoot;
    return globalThis.__mstOriginals.getRoot(node);
  });
});

afterEach(() => {
  window.STORE_INIT_OK = undefined;
});

describe("TimelineLabels recording mode", () => {
  it("is opt-in and off by default", () => {
    expect(createTag(CONFIG()).recordingmode).toBe(false);
    expect(createTag(CONFIG('recordingMode="true"')).recordingmode).toBe(true);
  });

  it("does not touch the default click behavior when disabled", () => {
    const tag = createTag(CONFIG());
    const [labelA] = tag.tiedChildren;

    labelA.onLabelInteract();

    expect(labelA.selected).toBe(true);
    expect(tag.isRecording).toBe(false);
    expect(video.startDrawing).not.toHaveBeenCalled();
  });

  it("creates a region only once the video actually plays and extends it frame by frame", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA] = tag.tiedChildren;

    labelA.onLabelInteract();
    expect(tag.isRecording).toBe(true);
    // nothing is drawn until the video plays
    expect(video.startDrawing).not.toHaveBeenCalled();

    video.play();
    video.seekTo(2);
    expect(video.startDrawing).toHaveBeenCalledTimes(1);
    expect(createdRegions[0].ranges[0]).toEqual({ start: 1, end: 2 });

    video.seekTo(5);
    expect(video.startDrawing).toHaveBeenCalledTimes(1);
    expect(createdRegions[0].ranges[0]).toEqual({ start: 1, end: 5 });
  });

  it("keeps the recorded label selected even though creating a result unselects labels", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA] = tag.tiedChildren;

    // the store unselects the labels right after the region is created
    video.onRegionCreated = () => tag.unselectAll();

    labelA.onLabelInteract();
    video.play();
    video.seekTo(3);

    expect(video.startDrawing).toHaveBeenCalledTimes(1);
    expect(labelA.selected).toBe(true);
  });

  it("stops and closes the region when the same label is clicked again", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA] = tag.tiedChildren;

    labelA.onLabelInteract();
    video.play();
    video.seekTo(4);

    labelA.onLabelInteract();

    expect(tag.isRecording).toBe(false);
    expect(labelA.selected).toBe(false);
    expect(video.finishDrawing).toHaveBeenCalledWith({ mode: "new" });

    // further playback doesn't extend the closed region anymore
    video.seekTo(9);
    expect(createdRegions[0].ranges[0]).toEqual({ start: 1, end: 4 });
  });

  it("closes the current region and opens a new one when another label is clicked", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA, labelB] = tag.tiedChildren;

    labelA.onLabelInteract();
    video.play();
    video.seekTo(4);

    labelB.onLabelInteract();
    expect(labelA.selected).toBe(false);
    expect(labelB.selected).toBe(true);
    expect(tag.isRecording).toBe(true);

    video.seekTo(7);

    expect(createdRegions).toHaveLength(2);
    expect(createdRegions[0].ranges[0]).toEqual({ start: 1, end: 4 });
    // the new region starts on the frame after the one that closed the previous region,
    // otherwise frame 4 would carry both labels
    expect(createdRegions[1].ranges[0]).toEqual({ start: 5, end: 7 });
  });

  it("never leaves a frame carrying two labels when switching", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA, labelB] = tag.tiedChildren;

    labelA.onLabelInteract();
    video.play();
    video.seekTo(4);
    labelB.onLabelInteract();
    video.seekTo(7);

    const [first, second] = createdRegions.map((r) => r.ranges[0]);

    expect(second.start).toBeGreaterThan(first.end);
  });

  it("starts on the frame on screen when nothing was recorded before", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA, labelB] = tag.tiedChildren;

    // armed but never played, so there is no region to run into
    labelA.onLabelInteract();
    video.seekTo(12);
    labelB.onLabelInteract();

    video.play();
    video.seekTo(15);

    expect(createdRegions[0].ranges[0]).toEqual({ start: 12, end: 15 });
  });

  it("stays armed but doesn't record while the video is paused or scrubbed", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA] = tag.tiedChildren;

    labelA.onLabelInteract();
    // scrubbing the timeline while paused labels nothing
    video.seekTo(20);
    expect(video.startDrawing).not.toHaveBeenCalled();
    expect(tag.isRecording).toBe(true);

    video.play();
    video.seekTo(21);
    expect(createdRegions[0].ranges[0]).toEqual({ start: 20, end: 21 });

    video.pause();
    video.seekTo(50);
    expect(createdRegions[0].ranges[0]).toEqual({ start: 20, end: 21 });
  });

  it("closes the region and deselects the label at the end of the video", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA] = tag.tiedChildren;

    labelA.onLabelInteract();
    video.play();
    video.seekTo(100);

    expect(tag.isRecording).toBe(false);
    expect(labelA.selected).toBe(false);
    expect(createdRegions[0].ranges[0]).toEqual({ start: 1, end: 100 });
    expect(video.finishDrawing).toHaveBeenCalledWith({ mode: "new" });
  });

  it("stops and deselects the label as soon as the recorded region is deleted", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA] = tag.tiedChildren;

    labelA.onLabelInteract();
    video.play();
    video.seekTo(4);
    expect(tag.isRecording).toBe(true);
    expect(labelA.selected).toBe(true);

    // deleting the region must stop the recording straight away, not on the next played frame
    video.deleteRegion(createdRegions[0]);

    expect(tag.isRecording).toBe(false);
    expect(labelA.selected).toBe(false);

    // and playback must not resurrect it
    video.seekTo(9);
    expect(video.startDrawing).toHaveBeenCalledTimes(1);
  });

  it("deselects the label when recording stops because the annotation became read-only", () => {
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA] = tag.tiedChildren;

    labelA.onLabelInteract();
    video.play();
    mockAnnotation.isReadOnly = () => true;
    video.seekTo(3);

    expect(tag.isRecording).toBe(false);
    expect(labelA.selected).toBe(false);
    expect(video.startDrawing).not.toHaveBeenCalled();
  });

  it("does not record in read-only mode", () => {
    mockAnnotation.isReadOnly = () => true;
    const tag = createTag(CONFIG('recordingMode="true"'));
    const [labelA] = tag.tiedChildren;

    labelA.onLabelInteract();

    expect(tag.isRecording).toBe(false);
    expect(video.startDrawing).not.toHaveBeenCalled();
  });
});

import { reaction } from "mobx";
import { observer } from "mobx-react";
import { isAlive, types } from "mobx-state-tree";

import Registry from "../../core/Registry";
import { guidGenerator } from "../../core/Helpers";
import SelectedModelMixin from "../../mixins/SelectedModel";
import { isDefined } from "../../utils/utilities";
import ControlBase from "./Base";
import { HtxLabels, LabelsModel } from "./Labels/Labels";

/**
 * Use the TimelineLabels tag to classify video frames. This can be a single frame or a span of frames.
 *
 * First, select a label and then click once to annotate a single frame. Click and drag to annotate multiple frames.
 *
 * ![Screenshot of video with frame classification](../images/timelinelabels.png)
 *
 * Use with the `<Video>` control tag.
 *
 * !!! info Tip
 *     You can increase the height of the timeline using the `timelineHeight` parameter on the `<Video>` tag.
 *
 * ### Recording mode
 *
 * With `recordingMode="true"` clicking a label starts a "recording": while the video is playing every frame
 * that goes by is added to a region labeled with that label. Clicking the same label again stops the recording,
 * clicking another label closes the current region and starts a new one. Recording stays armed while the video
 * is paused and only extends the region during playback, so scrubbing the timeline doesn't label anything.
 *
 * @example
 * <View>
 *   <Header>Label timeline spans:</Header>
 *   <Video name="video" value="$video" />
 *   <TimelineLabels name="timelineLabels" toName="video">
 *     <Label value="Nothing" background="#944BFF"/>
 *     <Label value="Movement" background="#98C84E"/>
 *   </TimelineLabels>
 * </View>
 * @example <caption>Label frames by playing the video instead of dragging on the timeline</caption>
 * <View>
 *   <Video name="video" value="$video" />
 *   <TimelineLabels name="timelineLabels" toName="video" recordingMode="true">
 *     <Label value="Nothing" background="#944BFF"/>
 *     <Label value="Movement" background="#98C84E"/>
 *   </TimelineLabels>
 * </View>
 * @name TimelineLabels
 * @regions TimelineRegion
 * @meta_title TimelineLabels tag
 * @meta_description Classify video frames using TimelineLabels.
 * @param {string} name Name of the element
 * @param {string} toName Name of the video element
 * @param {boolean} [recordingMode=false] Label frames while the video is playing: click a label to start recording, click it again to stop
 */
const TagAttrs = types.model({
  toname: types.maybeNull(types.string),
  recordingmode: types.optional(types.boolean, false),
});

const ModelAttrs = types.model("TimelineLabelsModel", {
  pid: types.optional(types.string, guidGenerator),
  type: "timelinelabels",
});

const Composition = types.compose(
  "TimelineLabelsModel",
  ControlBase,
  LabelsModel,
  ModelAttrs,
  TagAttrs,
  SelectedModelMixin.props({ _child: "LabelModel" }),
);

/**
 * Recording mode: a label click arms the recording and every frame played after that extends
 * a single timeline region. It reuses exactly the same region API as drawing on the timeline
 * (`Video#startDrawing()` → `TimelineRegion#setRange()` → `Video#finishDrawing()`), so the
 * produced regions are indistinguishable from the ones created by dragging.
 * @see Timeline/Views/Frames#onFrameScrub() - the drag-based counterpart
 */
const TimelineLabelsModel = Composition.volatile(() => ({
  isRecording: false,
  /** label being recorded, kept selected for the whole recording */
  recordingLabel: null,
  /** region currently being extended; created lazily on the first played frame */
  recordingRegion: null,
  recordingStartFrame: null,
  recordingDisposer: null,
})).actions((self) => ({
  /**
   * Called by `Label#onLabelInteract()` before the default label selection happens.
   * @param {Object} label the clicked label
   * @returns {boolean} true if the interaction was handled here and shouldn't be processed further
   */
  handleLabelInteract(label) {
    if (!self.recordingmode) return false;
    if (self.annotation.isReadOnly()) return false;

    // while nothing is being recorded let the default behavior handle labeling of selected regions
    if (!self.isRecording) {
      const hasSelectedRegions = self.annotation.selectedRegions.some((r) => r.parent?.name === self.toname);

      if (hasSelectedRegions) return false;
    }

    const wasRecordingThisLabel = self.isRecording && self.recordingLabel === label;
    // The frame on screen has already been recorded into the region we are about to close, so
    // the new one has to start on the next one — otherwise that frame carries both labels.
    const closedAt =
      self.recordingRegion && isAlive(self.recordingRegion) ? self.recordingRegion.ranges[0]?.end : null;

    self.stopRecording();
    self.unselectAll();

    // clicking the label that is being recorded just stops the recording
    if (wasRecordingThisLabel) return true;

    label.setSelected(true);
    self.startRecording(label, isDefined(closedAt) ? closedAt + 1 : undefined);

    return true;
  },

  /**
   * @param {Object} label label to record
   * @param {number} [startFrame] frame to start from; defaults to the frame on screen
   */
  startRecording(label, startFrame) {
    const video = self.toNameTag;

    if (!video) return;

    self.isRecording = true;
    self.recordingLabel = label;
    self.recordingRegion = null;
    self.recordingStartFrame = startFrame ?? video.frame;
    // `isAlive` is observable, so deleting the region (from the outliner, the details panel
    // or an undo) stops the recording right away instead of on the next played frame
    self.recordingDisposer = reaction(
      () => ({
        frame: video.frame,
        regionAlive: !self.recordingRegion || isAlive(self.recordingRegion),
      }),
      ({ frame, regionAlive }) => {
        if (!regionAlive) return self.stopRecording();
        self.extendRecording(frame);
      },
    );
  },

  /**
   * Extend (or lazily create) the recorded region up to the given frame.
   * Only frames played by the player are recorded, so pausing keeps the recording armed
   * and scrubbing the timeline while paused doesn't label anything.
   * @param {number} frame current frame of the video
   */
  extendRecording(frame) {
    const video = self.toNameTag;

    if (!self.isRecording || !video) return;

    if (!video.ref.current?.playing) {
      // while the recording is only armed, scrubbing just moves the point it will start from,
      // so resuming playback never labels frames backwards
      if (!self.recordingRegion) self.recordingStartFrame = frame;
      return;
    }

    if (self.annotation.isReadOnly()) return self.stopRecording();
    // the region can be deleted from the outliner in the middle of a recording
    if (self.recordingRegion && !isAlive(self.recordingRegion)) return self.stopRecording();

    if (!self.recordingRegion) {
      // the region is created out of the currently selected labels, so make sure ours is selected
      if (self.recordingLabel && !self.recordingLabel.selected) {
        self.unselectAll();
        self.recordingLabel.setSelected(true);
      }

      const start = Math.min(self.recordingStartFrame ?? frame, frame);
      const region = video.startDrawing({ frame: start });

      if (!region) return self.stopRecording();

      self.recordingRegion = region;
      self.recordingStartFrame = start;
      // creating a result unselects the labels (unless "keep labels selected" is on),
      // but the recorded label should stay highlighted until the recording is stopped
      self.recordingLabel?.setSelected(true);
    }

    const start = Math.min(self.recordingStartFrame, frame);
    const end = Math.max(self.recordingStartFrame, frame);

    self.recordingRegion.setRange([start, end], { mode: "new" });

    // the video can't go any further, so close the region
    if (video.length && frame >= video.length) self.stopRecording();
  },

  stopRecording() {
    self.recordingDisposer?.();
    self.recordingDisposer = null;

    if (self.recordingRegion && isAlive(self) && isAlive(self.recordingRegion) && self.toNameTag) {
      self.toNameTag.finishDrawing({ mode: "new" });
    }

    // a label that is no longer recording must not stay highlighted, otherwise it looks
    // armed while it isn't — this also covers the stops we trigger ourselves
    // (region deleted, read-only, end of the video)
    if (isAlive(self)) self.recordingLabel?.setSelected(false);

    self.isRecording = false;
    self.recordingLabel = null;
    self.recordingRegion = null;
    self.recordingStartFrame = null;
  },

  beforeDestroy() {
    self.recordingDisposer?.();
    self.recordingDisposer = null;
  },
}));

const HtxTimelineLabels = observer(({ item }) => {
  return <HtxLabels item={item} />;
});

Registry.addTag("timelinelabels", TimelineLabelsModel, HtxTimelineLabels);

export { HtxTimelineLabels, TimelineLabelsModel };

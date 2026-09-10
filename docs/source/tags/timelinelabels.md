---
title: TimelineLabels
type: tags
order: 429
meta_title: TimelineLabels tag
meta_description: Classify video frames using TimelineLabels.
---

Use the TimelineLabels tag to classify video frames. This can be a single frame or a span of frames.

First, select a label and then click once to annotate a single frame. Click and drag to annotate multiple frames.

![Screenshot of video with frame classification](../images/timelinelabels.png)

Use with the `<Video>` control tag.

!!! info Tip
    You can increase the height of the timeline using the `timelineHeight` parameter on the `<Video>` tag.

### Recording mode

With `recordingMode="true"` clicking a label starts a "recording": while the video is playing every frame
that goes by is added to a region labeled with that label. Clicking the same label again stops the recording,
clicking another label closes the current region and starts a new one. Recording stays armed while the video
is paused and only extends the region during playback, so scrubbing the timeline doesn't label anything.

{% insertmd includes/tags/timelinelabels.md %}

### Example
```html
<View>
  <Header>Label timeline spans:</Header>
  <Video name="video" value="$video" />
  <TimelineLabels name="timelineLabels" toName="video">
    <Label value="Nothing" background="#944BFF"/>
    <Label value="Movement" background="#98C84E"/>
  </TimelineLabels>
</View>
```
**Example** *(Label frames by playing the video instead of dragging on the timeline)*  
```html
<View>
  <Video name="video" value="$video" />
  <TimelineLabels name="timelineLabels" toName="video" recordingMode="true">
    <Label value="Nothing" background="#944BFF"/>
    <Label value="Movement" background="#98C84E"/>
  </TimelineLabels>
</View>
```

### Parameters

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | Name of the element |
| value | <code>string</code> |  | URL of the video |
| [frameRate] | <code>number</code> | <code>24</code> | video frame rate per second; default is 24; can use task data like `$fps` |
| [sync] | <code>string</code> |  | object name to sync with |
| [muted] | <code>boolean</code> | <code>false</code> | muted video |
| [height] | <code>number</code> | <code>600</code> | height of the video player |
| [timelineHeight] | <code>number</code> | <code>64</code> | height of the timeline with regions |
| [defaultPlaybackSpeed] | <code>number</code> | <code>1</code> | default playback speed the player should start with when loaded |
| [minPlaybackSpeed] | <code>number</code> | <code>1</code> | minimum allowed playback speed; defaultPlaybackSpeed cannot be set below this value |
| [showCurrentFrameLabel] | <code>boolean</code> | <code>false</code> | show the labels covering the frame on screen over the top left corner of the video |
| [groupTimelineRowsByLabel] | <code>boolean</code> | <code>false</code> | give each label a single timeline row holding all of its regions, instead of one row per region; stretches where two regions of the same label overlap are hatched |
| [selectRegionOnlyOnAnnotatedFrames] | <code>boolean</code> | <code>false</code> | on the timeline, select a region only when clicking its annotated frames instead of anywhere on its row; sets the initial value of the matching toggle in the timeline settings, which annotators can then flip themselves |


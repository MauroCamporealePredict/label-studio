import chroma from "chroma-js";
import { type FC, memo, type MouseEvent, useCallback, useContext, useMemo } from "react";
import { cn } from "../../../../utils/bem";
import { clamp } from "../../../../utils/utilities";
import { TimelineContext } from "../../Context";
import type { TimelineRegion } from "../../Types";
import "./Keypoints.prefix.css";
import { type Lifespan, visualizeLifespans } from "./Utils";

export interface KeypointsProps {
  idx?: number;
  region: TimelineRegion;
  startOffset: number;
  renderable: boolean;
  onSelectRegion?: (e: MouseEvent<HTMLDivElement>, id: string, select?: boolean) => void;
}

export const Keypoints: FC<KeypointsProps> = ({ idx, region, startOffset, renderable, onSelectRegion }) => {
  const { step, seekOffset, visibleWidth, length } = useContext(TimelineContext);
  const { label, color, visible, sequence, selected, timeline, locked, members, overlaps } = region;

  const extraSteps = useMemo(() => {
    return Math.round(visibleWidth / 2);
  }, [visibleWidth]);

  const minVisibleKeypointPosition = useMemo(() => {
    return clamp(seekOffset - extraSteps, 0, length);
  }, [seekOffset, extraSteps, length]);

  const maxVisibleKeypointPosition = useMemo(() => {
    return clamp(seekOffset + visibleWidth + extraSteps, 0, length);
  }, [seekOffset, visibleWidth, extraSteps, length]);

  const firstPoint = sequence[0];
  const start = firstPoint ? firstPoint.frame - 1 : 0;
  const offset = firstPoint ? start * step : startOffset;

  const styles = useMemo(
    () => ({
      "--offset": `${startOffset}px`,
      "--color": color,
      "--point-color": chroma(color).alpha(1).css(),
      "--lifespan-color": chroma(color)
        .alpha(visible ? 0.4 : 1)
        .css(),
    }),
    [startOffset, color, visible],
  );

  const inView = useCallback(
    (spans: Lifespan[]) =>
      spans.map((span) => {
        span.points = span.points.filter(({ frame }) => {
          return frame >= minVisibleKeypointPosition && frame <= maxVisibleKeypointPosition;
        });

        return span;
      }),
    [minVisibleKeypointPosition, maxVisibleKeypointPosition],
  );

  const lifespans = useMemo(() => {
    if (!renderable || members) return [];

    return inView(visualizeLifespans(sequence, step, locked));
  }, [sequence, step, renderable, members, inView, locked]);

  /** grouped rows draw each region separately so a click still resolves to the one under it */
  const memberLifespans = useMemo(() => {
    if (!renderable || !members) return [];

    return members.map((member) => ({
      id: member.id,
      offset: member.sequence[0] ? (member.sequence[0].frame - 1) * step : startOffset,
      lifespans: inView(visualizeLifespans(member.sequence, step, member.locked)),
    }));
  }, [members, step, renderable, inView, startOffset]);

  const onSelectRegionHandler = useCallback(
    (e: MouseEvent<HTMLDivElement>, select?: boolean) => {
      e.stopPropagation();
      // on a grouped row the nearest id is the span under the cursor, not the row itself
      const target = (e.target as Element)?.closest?.("[data-id]") as HTMLElement | null;

      onSelectRegion?.(e, target?.dataset.id ?? region.id, select);
    },
    [region.id, onSelectRegion],
  );

  // will work only for TimelineRegions; sequence for them is 2 or even 1 point (1 for instants)
  const range = timeline ? sequence.map((s) => s.frame) : [];

  return (
    <div
      className={cn("keypoints").mod({ selected, timeline }).toClassName()}
      style={styles as any}
      data-id={region.id}
      data-start={range[0]}
      data-end={range[1]}
      data-locked={locked || undefined}
    >
      <div className={cn("keypoints").elem("label").toClassName()} onClick={onSelectRegionHandler}>
        <div className={cn("keypoints").elem("name").toClassName()}>{label}</div>
        <div className={cn("keypoints").elem("data").toClassName()}>
          <div className={cn("keypoints").elem("data-item").mod({ faded: true }).toClassName()}>{idx}</div>
        </div>
      </div>
      {/*
        The strip spans the whole timeline width, so a click lands on it even far away from the
        annotated frames. `Video#selectRegionOnlyOnAnnotatedFrames` uses these two markers to tell
        "clicked this region's frames" from "clicked an empty spot on this region's row".
        @see HtxVideo#handleSelectRegion()
      */}
      <div
        className={cn("keypoints").elem("keypoints").toClassName()}
        data-timeline-strip
        onClick={(e: any) => onSelectRegionHandler(e, true)}
      >
        {members ? (
          memberLifespans.map((member) => (
            <LifespansList
              key={member.id}
              regionId={member.id}
              lifespans={member.lifespans}
              step={step}
              visible={visible}
              offset={member.offset}
            />
          ))
        ) : (
          <LifespansList lifespans={lifespans} step={step} visible={visible} offset={offset} />
        )}
        {overlaps?.map(([from, to]) => (
          <div
            key={`overlap-${from}-${to}`}
            className={cn("keypoints").elem("overlap").toClassName()}
            style={{ left: (from - 1) * step + step / 2, width: (to - from + 1) * step }}
          />
        ))}
      </div>
    </div>
  );
};

interface LifespansListProps {
  lifespans: Lifespan[];
  step: number;
  offset: number;
  visible: boolean;
  regionId?: string;
}

const LifespansList: FC<LifespansListProps> = ({ lifespans, step, offset, visible, regionId }) => {
  return (
    <>
      {lifespans.map((lifespan, i) => {
        const isLast = i + 1 === lifespans.length;
        const { points, ...data } = lifespan;

        return (
          <LifespanItem
            key={`${i}-${points.length}-${isLast}-${visible}`}
            mainOffset={offset}
            step={step}
            isLast={isLast}
            visible={visible}
            points={points.map(({ frame }) => frame)}
            regionId={regionId}
            {...data}
          />
        );
      })}
    </>
  );
};

interface LifespanItemProps {
  mainOffset: number;
  width: string | number;
  step: number;
  start: number;
  offset: number;
  enabled: boolean;
  visible: boolean;
  isLast: boolean;
  points: number[];
  locked?: boolean;
  regionId?: string;
}

const LifespanItem: FC<LifespanItemProps> = memo(
  ({ mainOffset, width, start, step, offset, enabled, visible, isLast, points, locked, regionId }) => {
    const left = mainOffset + offset + step / 2;
    const right = isLast && enabled ? 0 : "auto";
    const finalWidth = isLast && enabled ? "auto" : width;
    const style = useMemo(() => {
      return { left, width: finalWidth, right };
    }, [left, right, finalWidth]);

    return (
      // on a grouped row `regionId` puts the region id on the span itself, so clicking and edge
      // dragging keep resolving to the region under the cursor rather than to the row
      <div
        className={cn("keypoints").elem("lifespan").mod({ hidden: !visible, instant: !width }).toClassName()}
        style={style}
        data-lifespan
        data-id={regionId}
      >
        {points.map((frame, i) => {
          const left = (frame - start) * step;

          return (
            <div
              key={i}
              className={cn("keypoints").elem("point").mod({ last: !!left, locked }).toClassName()}
              style={{ left }}
            />
          );
        })}
      </div>
    );
  },
);

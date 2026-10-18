import React, { memo, useRef, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import LogRow from './LogRow';

/**
 * Virtualized log list. Uses react-virtuoso (already a Bruno dependency) so the
 * console can sustain high-rate streams without rendering every row. The list
 * auto-sticks to the bottom (follow mode) but stops following when the user
 * scrolls up — this implements the "pause auto-scroll while inspecting earlier
 * entries" requirement without pausing the stream itself.
 */
const LogList = memo(({ entries, selectedEntryId, onSelect, paused, onPauseStream, onResumeStream }) => {
  const virtuosoRef = useRef(null);
  const followingRef = useRef(true);

  const atBottomStateChange = useCallback(
    (atBottom) => {
      const wasFollowing = followingRef.current;
      followingRef.current = atBottom;
      // If the user scrolled back to the bottom while paused, resume following.
      if (atBottom && !wasFollowing && paused) {
        onResumeStream?.();
      }
      // If the user scrolled away from the bottom, pause auto-scroll only (not the stream).
      if (!atBottom && !paused) {
        onPauseStream?.();
      }
    },
    [paused, onPauseStream, onResumeStream]
  );

  const rowRenderer = useCallback(
    (index) => {
      const entry = entries[index];
      if (!entry) return null;
      return (
        <LogRow
          entry={entry}
          isSelected={selectedEntryId === entry.id}
          onClick={() => onSelect?.(entry.id)}
        />
      );
    },
    [entries, selectedEntryId, onSelect]
  );

  if (!entries.length) {
    return (
      <div className="obs-empty">
        <div>No logs yet.</div>
        <div style={{ fontSize: 11 }}>Add a log source above, then send a request to your local backend.</div>
      </div>
    );
  }

  return (
    <div className="obs-list">
      <Virtuoso
        ref={virtuosoRef}
        data={entries}
        itemContent={rowRenderer}
        followOutput={'smooth'}
        atBottomStateChange={atBottomStateChange}
        increaseViewportBy={{ top: 400, bottom: 400 }}
        initialTopMostItemIndex={Math.max(0, entries.length - 1)}
        style={{ height: '100%' }}
      />
    </div>
  );
});

export default LogList;

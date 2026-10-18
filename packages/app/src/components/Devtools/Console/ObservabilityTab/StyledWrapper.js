import styled from 'styled-components';

/**
 * Styled wrapper for the Local Observability tab. Reuses the existing `console`
 * theme tokens so it matches the Console / Network tabs and inherits dark-mode
 * support automatically. Layout follows the Bruno convention: a single styled
 * root + Tailwind utility classes for spacing/flex.
 */

const severityColor = (sev) => {
  switch (sev) {
    case 'ERROR':
    case 'FATAL':
      return 'hsl(8, 70%, 60%)';
    case 'WARN':
      return 'hsl(41, 93%, 65%)';
    case 'INFO':
      return 'hsl(190, 82%, 72%)';
    case 'DEBUG':
      return 'hsl(260, 75%, 78%)';
    case 'TRACE':
      return 'hsl(0, 0%, 60%)';
    default:
      return 'hsl(0, 0%, 75%)';
  }
};

const StyledWrapper = styled.div`
  width: 100%;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: ${(props) => props.theme.console.bg};
  color: ${(props) => props.theme.console.messageColor};
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  overflow: hidden;

  .obs-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: ${(props) => props.theme.console.headerBg};
    border-bottom: 1px solid ${(props) => props.theme.console.border};
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .obs-toolbar-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .obs-search {
    flex: 1 1 220px;
    min-width: 160px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: ${(props) => props.theme.console.bg};
    border: 1px solid ${(props) => props.theme.console.border};
    border-radius: 4px;
    padding: 2px 8px;

    input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: ${(props) => props.theme.console.messageColor};
      font-family: inherit;
      font-size: 12px;
      padding: 3px 0;
    }
    input::placeholder { color: ${(props) => props.theme.console.emptyColor}; }
  }

  .obs-sev {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .obs-sev-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    padding: 2px 6px;
    border: 1px solid ${(props) => props.theme.console.border};
    border-radius: 4px;
    background: transparent;
    color: ${(props) => props.theme.console.countColor};
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    user-select: none;
    transition: background 0.1s ease, opacity 0.1s ease;
    opacity: 0.45;

    &.active {
      opacity: 1;
      color: ${(props) => props.theme.console.messageColor};
      background: ${(props) => props.theme.console.buttonHoverBg};
      border-color: ${(props) => props.theme.console.border};
    }
    &:hover { opacity: 0.85; }
    &.active:hover { opacity: 1; }
  }

  .obs-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 1px solid ${(props) => props.theme.console.border};
    border-radius: 4px;
    background: transparent;
    color: ${(props) => props.theme.console.buttonColor};
    cursor: pointer;
    transition: background 0.1s ease;

    &:hover {
      background: ${(props) => props.theme.console.buttonHoverBg};
      color: ${(props) => props.theme.console.buttonHoverColor};
    }
    &.danger:hover { color: hsl(8, 70%, 65%); }
  }

  .obs-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border: 1px solid ${(props) => props.theme.console.border};
    border-radius: 4px;
    background: transparent;
    color: ${(props) => props.theme.console.buttonColor};
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.1s ease;

    &:hover { background: ${(props) => props.theme.console.buttonHoverBg}; color: ${(props) => props.theme.console.buttonHoverColor}; }
    &.primary { border-color: ${(props) => props.theme.primary.subtle}; color: ${(props) => props.theme.primary.strong}; }
  }

  .obs-session-select {
    background: ${(props) => props.theme.console.bg};
    border: 1px solid ${(props) => props.theme.console.border};
    border-radius: 4px;
    color: ${(props) => props.theme.console.messageColor};
    font-family: inherit;
    font-size: 12px;
    padding: 3px 6px;
    max-width: 260px;
    option { color: #000; }
  }

  .obs-source-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: ${(props) => props.theme.console.bg};
    border-bottom: 1px solid ${(props) => props.theme.console.border};
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .obs-source-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border: 1px solid ${(props) => props.theme.console.border};
    border-radius: 10px;
    background: ${(props) => props.theme.console.headerBg};
    color: ${(props) => props.theme.console.messageColor};
    font-size: 11px;

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: hsl(140, 72%, 60%);
      flex-shrink: 0;
    }
    .dot.following { background: hsl(140, 72%, 60%); }
    .dot.paused { background: hsl(41, 93%, 65%); }
    .dot.error, .dot.missing { background: hsl(8, 70%, 60%); }
    .dot.exited, .dot.stopped { background: hsl(0, 0%, 55%); }
    .dot.starting, .dot.rotated, .dot.truncated { background: hsl(190, 82%, 72%); }

    .chip-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip-actions { display: inline-flex; gap: 3px; margin-left: 4px; }
    .chip-actions button {
      background: transparent; border: none; color: inherit; cursor: pointer; padding: 0;
      display: inline-flex; opacity: 0.6;
      &:hover { opacity: 1; }
    }
  }

  .obs-body {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
  }

  .obs-list-wrap {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .obs-list {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .obs-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 2px 10px;
    font-size: 12px;
    line-height: 1.45;
    cursor: pointer;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    transition: background 0.08s ease;

    &:hover { background: ${(props) => props.theme.console.logHoverBg}; }
    &.selected { background: rgba(0, 120, 212, 0.18); }

    .row-ts { color: ${(props) => props.theme.console.timestampColor}; flex-shrink: 0; white-space: nowrap; }
    .row-sev {
      flex-shrink: 0;
      min-width: 46px;
      font-weight: 600;
      color: ${(p) => severityColor(p['data-sev'])};
      text-align: left;
    }
    .row-src { flex-shrink: 0; color: ${(props) => props.theme.console.countColor}; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-msg { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-word; color: ${(props) => props.theme.console.messageColor}; }
  }

  .obs-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 6px;
    color: ${(props) => props.theme.console.emptyColor};
    padding: 24px;
    text-align: center;
  }

  .obs-details {
    width: 420px;
    max-width: 60%;
    flex-shrink: 0;
    border-left: 1px solid ${(props) => props.theme.console.border};
    background: ${(props) => props.theme.console.bg};
    overflow-y: auto;
    padding: 10px 12px;
    font-size: 12px;

    .details-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .details-title { color: ${(props) => props.theme.console.titleColor}; font-weight: 600; }
    .details-actions { display: flex; gap: 4px; }

    .details-section { margin-bottom: 12px; }
    .details-section h4 {
      color: ${(props) => props.theme.console.countColor};
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 4px 0;
      font-weight: 600;
    }
    .details-meta {
      display: grid;
      grid-template-columns: 90px 1fr;
      gap: 3px 8px;
      word-break: break-word;
    }
    .details-meta dt { color: ${(props) => props.theme.console.countColor}; }
    .details-meta dd { margin: 0; color: ${(props) => props.theme.console.messageColor}; }
    .details-pre {
      background: ${(props) => props.theme.console.bg};
      border: 1px solid ${(props) => props.theme.console.border};
      border-radius: 4px;
      padding: 8px;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      font-size: 11px;
      max-height: 280px;
      overflow: auto;
      margin: 0;
    }
    .details-stack { color: hsl(8, 70%, 65%); }
  }

  .obs-add-modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50;
    display: flex; align-items: center; justify-content: center;
  }
  .obs-add-modal {
    width: 480px; max-width: 90vw;
    background: ${(props) => props.theme.console.dropdownBg};
    border: 1px solid ${(props) => props.theme.console.border};
    border-radius: 8px;
    padding: 16px;
    display: flex; flex-direction: column; gap: 10px;
    color: ${(props) => props.theme.console.messageColor};
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .obs-add-modal h3 { margin: 0; font-size: 14px; color: ${(props) => props.theme.console.titleColor}; }
  .obs-add-modal label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
  .obs-add-modal input, .obs-add-modal textarea {
    background: ${(props) => props.theme.console.bg};
    border: 1px solid ${(props) => props.theme.console.border};
    border-radius: 4px;
    color: ${(props) => props.theme.console.messageColor};
    padding: 6px 8px;
    font-family: inherit;
    font-size: 12px;
  }
  .obs-add-modal .row { display: flex; gap: 8px; }
  .obs-add-modal .row > * { flex: 1; }
  .obs-add-modal .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  .obs-add-modal .hint { color: ${(props) => props.theme.console.countColor}; font-size: 11px; }
`;

export default StyledWrapper;

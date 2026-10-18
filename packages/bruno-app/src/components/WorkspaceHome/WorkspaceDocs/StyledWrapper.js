import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  /* ─── Header ───────────────────────────────────────── */
  .docs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 16px;
    border-bottom: 1px solid ${(props) => props.theme.workspace.border};
    flex-shrink: 0;
  }

  .docs-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    color: ${(props) => props.theme.text};
    letter-spacing: 0.01em;
  }

  .docs-title-icon {
    color: ${(props) => props.theme.colors.text.muted};
    opacity: 0.7;
  }

  .edit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    border: none;
    background: transparent;
    color: ${(props) => props.theme.colors.text.muted};
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;

    &:hover {
      background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg, 0.8)};
      color: ${(props) => props.theme.text};
    }
  }

  /* ─── Content area ─────────────────────────────────── */
  .docs-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: ${(props) => rgba(props.theme.sidebar.muted, 0.3)};
      border-radius: 4px;
    }
  }

  /* ─── Editor container ─────────────────────────────── */
  .editor-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .editor-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 10px;
  }

  .save-btn {
    padding: 6px 14px;
    background: ${(props) => props.theme.button.secondary.bg};
    color: ${(props) => props.theme.button.secondary.color};
    border: 1px solid ${(props) => props.theme.button.secondary.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      border-color: ${(props) => props.theme.button.secondary.hoverBorder};
    }
  }

  /* ─── Empty state ──────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px 20px;
    height: 100%;
    gap: 0;
  }

  .empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: ${(props) => props.theme.border.radius.md};
    border: 1px solid ${(props) => rgba(props.theme.brand, 0.2)};
    color: ${(props) => props.theme.brand};
    margin-bottom: 18px;
    background: ${(props) => rgba(props.theme.brand, 0.06)};
    opacity: 0.75;
  }

  .empty-text {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};
    margin-bottom: 12px;
    line-height: 1.55;
    opacity: 0.85;
  }

  .suggestions-list {
    list-style: none;
    padding: 0;
    margin: 0 0 22px 0;
    text-align: left;
    align-self: flex-start;

    li {
      font-size: ${(props) => props.theme.font.size.sm};
      color: ${(props) => props.theme.colors.text.muted};
      padding: 3px 0;

      &::before {
        content: '\\2022';
        color: ${(props) => props.theme.brand};
        margin-right: 7px;
      }
    }
  }

  /* ─── Add docs button ──────────────────────────────── */
  .add-docs-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    background: transparent;
    color: ${(props) => props.theme.brand};
    border: 1px solid ${(props) => rgba(props.theme.brand, 0.5)};
    border-radius: ${(props) => props.theme.border.radius.base};
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 500;
    cursor: pointer;
    transition: all 0.18s ease;
    letter-spacing: 0.01em;

    &:hover {
      background: ${(props) => rgba(props.theme.brand, 0.08)};
      border-color: ${(props) => rgba(props.theme.brand, 0.75)};
      box-shadow: 0 0 12px ${(props) => rgba(props.theme.brand, 0.1)};
    }
  }

  /* ─── AI sparkle badge ─────────────────────────────── */
  .ai-sparkle {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${(props) => rgba(props.theme.brand, 0.45)};
    pointer-events: none;
  }
`;

export default StyledWrapper;

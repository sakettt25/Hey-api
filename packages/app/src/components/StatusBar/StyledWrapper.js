import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    height: 1.875rem; /* 30px */
    background: ${(props) => props.theme.statusBar?.bg || props.theme.sidebar?.bg || '#131418'};
    border-top: 1px solid ${(props) => props.theme.statusBar?.border || props.theme.border?.border0 || 'rgba(255, 255, 255, 0.08)'};
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
    color: ${(props) => props.theme.statusBar?.color || props.theme.sidebar?.color || 'rgb(160, 160, 160)'};
    font-size: ${(props) => props.theme.font.size.xs || '11px'};
    user-select: none;
    position: relative;
    z-index: 5;
    letter-spacing: 0.01em;
  }

  .status-bar-section {
    display: flex;
    align-items: center;
    height: 100%;
  }

  /* ─── Left Section: Workspace, Stats, Branch ─── */
  .status-bar-left {
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
  }

  .status-bar-chips {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }

  .footer-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.04)};
    border: 1px solid ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.08)};
    border-radius: 5px;
    font-size: 11px;
    font-weight: 500;
    color: ${(props) => props.theme.sidebar?.color || 'inherit'};
    user-select: none;
    white-space: nowrap;
    transition: all 0.15s ease;

    &:hover {
      background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.08)};
      border-color: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.18)};
    }

    .chip-icon {
      flex-shrink: 0;
      opacity: 0.85;

      &.workspace-icon {
        color: ${(props) => props.theme.workspace?.accent || props.theme.brand || '#3b82f6'};
      }

      &.stats-icon {
        color: ${(props) => props.theme.colors?.text?.yellow || '#e5c07b'};
      }

      &.git-icon {
        color: ${(props) => props.theme.colors?.text?.green || '#10b981'};
      }
    }

    .chip-label {
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip-value {
      font-weight: 600;
      color: ${(props) => props.theme.sidebar?.color || 'inherit'};
    }

    .chip-unit {
      opacity: 0.6;
      font-size: 10.5px;
    }

    .chip-dot {
      opacity: 0.35;
      margin: 0 1px;
    }
  }

  /* ─── Center Section: Command Palette / Search Dock ─── */
  .status-bar-center {
    flex: 1;
    justify-content: center;
    pointer-events: auto;
  }

  .footer-search-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 22px;
    width: 250px;
    max-width: 100%;
    padding: 0 10px;
    background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.04)};
    border: 1px solid ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.09)};
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    outline: none;
    color: ${(props) => props.theme.statusBar?.color || 'inherit'};

    &:hover {
      background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.09)};
      border-color: ${(props) => (props.theme.brand ? props.theme.brand + '80' : 'rgba(59, 130, 246, 0.5)')};
      box-shadow: 0 0 12px ${(props) => (props.theme.brand ? props.theme.brand + '18' : 'rgba(59, 130, 246, 0.12)')};
      color: ${(props) => props.theme.text || '#ffffff'};
    }

    &:focus-visible {
      border-color: ${(props) => props.theme.brand || '#3b82f6'};
    }

    .search-icon {
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.15s ease;
    }

    &:hover .search-icon {
      opacity: 1;
      color: ${(props) => props.theme.brand || '#3b82f6'};
    }

    .search-placeholder {
      flex: 1;
      text-align: left;
      font-size: 11px;
      opacity: 0.6;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.01em;
    }

    &:hover .search-placeholder {
      opacity: 0.85;
    }

    .search-kbd {
      flex-shrink: 0;
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: ${(props) => props.theme.statusBar?.color || 'inherit'};
      opacity: 0.8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.02em;
    }
  }

  /* ─── Right Section: Tools, Controls, Brand Capsule ─── */
  .status-bar-right {
    flex: 1;
    justify-content: flex-end;
    gap: 8px;
  }

  .status-tool-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .footer-tool-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.04)};
    border: 1px solid ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.08)};
    border-radius: 5px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    color: ${(props) => props.theme.statusBar?.color || 'inherit'};
    transition: all 0.15s ease;
    white-space: nowrap;
    user-select: none;
    outline: none;

    &:hover {
      background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.09)};
      border-color: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.18)};
      color: ${(props) => props.theme.text || '#ffffff'};
    }

    &:active {
      transform: scale(0.98);
    }

    .tool-icon {
      flex-shrink: 0;
      opacity: 0.75;
    }

    .tool-label {
      font-size: 11px;
      letter-spacing: 0.01em;
    }

    .healthy-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
      display: inline-block;
      margin-left: 1px;
    }

    .error-badge {
      font-size: 9.5px;
      font-weight: 700;
      color: #ffffff;
      background: #ef4444;
      padding: 0 5px;
      border-radius: 8px;
      line-height: 14px;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
      margin-left: 2px;
    }

    &.has-errors {
      border-color: rgba(239, 68, 68, 0.3);
      color: ${(props) => props.theme.colors?.text?.danger || '#ef4444'};

      &:hover {
        background: rgba(239, 68, 68, 0.12);
        border-color: rgba(239, 68, 68, 0.5);
      }
    }
  }

  /* Icon cluster for Settings, Theme, Notifications, GitHub */
  .status-icon-cluster {
    display: flex;
    align-items: center;
    gap: 1px;
    height: 22px;
    padding: 0 2px;
    background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.03)};
    border: 1px solid ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.07)};
    border-radius: 5px;

    .footer-icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 100%;
      cursor: pointer;
      position: relative;
      outline: none;
      border-radius: 3px;
      border: none;
      background: transparent;
      color: ${(props) => props.theme.statusBar?.color || 'inherit'};
      opacity: 0.7;
      transition: all 0.15s ease;

      &:hover {
        opacity: 1;
        background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.12)};
        color: ${(props) => props.theme.text || '#ffffff'};
      }

      &.notifications-wrapper {
        padding: 0;
      }
    }
  }

  .status-bar-divider {
    width: 1px;
    height: 12px;
    background: ${(props) => props.theme.statusBar?.border || 'rgba(255, 255, 255, 0.1)'};
    opacity: 0.35;
    margin: 0 1px;
  }

  /* Hey API Brand & Copyright */
  .status-brand-group {
    display: flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
    user-select: none;
  }

  .footer-author {
    font-size: 10.5px;
    opacity: 0.45;
    letter-spacing: 0.01em;
    transition: opacity 0.15s ease;

    &:hover {
      opacity: 0.8;
    }
  }

  .footer-brand-capsule {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 11px;
    font-size: 11px;
    font-weight: 600;
    color: ${(props) => props.theme.sidebar?.color || 'inherit'};
    cursor: default;
    transition: all 0.15s ease;

    &:hover {
      border-color: rgba(99, 102, 241, 0.5);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.22);
    }

    .brand-name {
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .brand-badge {
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 4px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: ${(props) => props.theme.brand || '#60a5fa'};
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.02em;
    }
  }
`;

export default StyledWrapper;

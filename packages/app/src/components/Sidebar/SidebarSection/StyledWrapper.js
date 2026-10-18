import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  height: 100%;

  .sidebar-section {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;

    &.expanded {
      flex: 1 1 0%;
      min-height: 0;
    }

    &:not(.expanded) {
      flex: 0 0 auto;
    }

    &.multi-expanded {
      flex: 1 1 0%;
      margin-bottom: 0;
    }
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 6px 6px 6px 10px;
    min-height: 30px;
    height: 30px;
    user-select: none;
    transition: background-color 0.12s ease;
    flex-shrink: 0;
    border-bottom: 1px solid transparent;

    &:hover {
      background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg, 0.55)};
    }

    .section-header-left {
      display: flex;
      align-items: center;
      gap: 7px;
      flex: 1;
      min-width: 0;
      cursor: pointer;

      &:hover {
        .section-toggle {
          display: flex;
        }

        .section-toggle {
          background: ${(props) => rgba(props.theme.dropdown.hoverBg, 0.8)};
          color: ${(props) => props.theme.text} !important;
        }

        .section-icon {
          display: none;
        }
      }
    }
  }

  .section-icon-wrapper {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.12s ease;
  }

  .section-toggle {
    display: none;
    border-radius: 4px;
  }

  .section-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: ${(props) => props.theme.brand};
    opacity: 0.55;
  }

  .section-title {
    color: ${(props) => props.theme.sidebar.color};
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.55;
  }

  .section-actions {
    display: flex;
    align-items: center;
    gap: 1px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.12s ease;
  }

  .section-header:hover .section-actions {
    opacity: 1;
  }

  .section-content {
    display: flex;
    flex-direction: column;
    flex: 1 1 0%;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;

    &::-webkit-scrollbar {
      width: 3px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: ${(props) => rgba(props.theme.sidebar.muted, 0.25)};
      border-radius: 3px;
    }
  }
`;

export default StyledWrapper;

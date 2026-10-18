import styled from 'styled-components';
import { rgba } from 'polished';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  min-height: 0;
  overflow: hidden;
  padding-top: 4px;
  padding-bottom: 0;

  .collections-list {
    flex: 1 1 0%;
    min-height: 0;
    padding-top: 4px;
    padding-bottom: 4px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .collections-footer {
    padding: 8px 10px;
    border-top: 1px solid ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.1)};
    flex-shrink: 0;
    background: ${(props) => props.theme.sidebar.bg};
  }

  .new-collection-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.2)};
    background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.05)};
    color: ${(props) => props.theme.sidebar.color};
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: ${(props) => rgba(props.theme.sidebar.collection.item.hoverBg || '#ffffff', 0.12)};
      border-color: ${(props) => props.theme.brand || '#3b82f6'};
    }

    &:active {
      transform: scale(0.99);
    }
  }
`;

export default Wrapper;

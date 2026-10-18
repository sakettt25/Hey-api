import { css } from 'styled-components';

const sidebarRowStyles = ({ selectedClass, keyboardFocusedClass, actionsClass }) => css`
  height: 1.625rem;
  cursor: pointer;
  user-select: none;
  border-left: 3px solid transparent;
  transition: background 0.1s ease;

  .${actionsClass} {
    visibility: hidden;
    transition: opacity 0.1s ease;
  }

  &:hover,
  &:focus-within,
  &.${keyboardFocusedClass} {
    background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    .${actionsClass} {
      visibility: visible;
      background-color: transparent !important;
    }
  }

  .${actionsClass}[aria-expanded='true'] {
    visibility: visible;
  }

  &.${selectedClass} {
    background: ${(props) => props.theme.sidebar.collection.item.bg};
    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.bg} !important;
    }
  }

  &.${keyboardFocusedClass} {
    border-top: 1px solid ${(props) => props.theme.sidebar.collection.item.focusBorder};
    border-bottom: 1px solid ${(props) => props.theme.sidebar.collection.item.focusBorder};
    outline: none;
  }
`;

export default sidebarRowStyles;

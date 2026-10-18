import styled from 'styled-components';

const Wrapper = styled.div`
  height: 2.25rem;

  .url-input-group {
    border: ${(props) => props.theme.requestTabPanel.url.border};
    border-radius: ${(props) => props.theme.border.radius.base};
    flex: 1;
    min-width: 0;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus-within {
      border-color: ${(props) => props.theme.input.focusBorder};
      box-shadow: 0 0 0 2px ${(props) => props.theme.input.focusBorder}22;
    }
  }
`;

export default Wrapper;

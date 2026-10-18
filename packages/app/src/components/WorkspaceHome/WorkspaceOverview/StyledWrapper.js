import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  flex: 1 1 0%;
  min-height: 0;

  .overview-layout {
    display: flex;
    height: 100%;
  }

  /* ─── Left main panel ─────────────────────────────── */
  .overview-main {
    flex: 3;
    padding: 24px 20px 20px;
    overflow-y: auto;
    border-right: 1px solid ${(props) => props.theme.workspace.border};

    /* custom scrollbar */
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

  /* ─── Right docs panel ────────────────────────────── */
  .overview-docs {
    display: flex;
    flex: 2;
    flex-direction: column;
    overflow: hidden;
  }

  /* ─── Overview heading ────────────────────────────── */
  .overview-heading {
    font-size: ${(props) => props.theme.font.size.lg};
    font-weight: 600;
    color: ${(props) => props.theme.text};
    letter-spacing: -0.02em;
    margin-bottom: 20px;
  }

  /* ─── Stat cards row ──────────────────────────────── */
  .stats-row {
    display: flex;
    gap: 14px;
    margin-bottom: 22px;
  }

  .stat-card {
    flex: 1;
    background: ${(props) => props.theme.copperGradientCard || props.theme.background?.surface0 || '#2a2a2a'};
    border: 1px solid ${(props) => rgba(props.theme.brand, 0.18)};
    border-radius: ${(props) => props.theme.border.radius.md};
    padding: 14px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    &:hover {
      border-color: ${(props) => rgba(props.theme.brand, 0.34)};
      box-shadow: 0 4px 16px ${(props) => rgba(props.theme.brand, 0.08)};
    }

    /* subtle shimmer on top edge */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${(props) => rgba(props.theme.brand, 0.5)}, transparent);
    }
  }

  .stat-label {
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 500;
    color: ${(props) => rgba(props.theme.brand, 0.85)};
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .stat-value-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: 6px;
  }

  .stat-value {
    font-size: 32px;
    font-weight: 700;
    color: ${(props) => props.theme.text};
    line-height: 1;
    letter-spacing: -0.03em;
  }

  /* ─── Mini bar-chart sparkline ────────────────────── */
  .stat-sparkline {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 32px;
    padding-bottom: 2px;
  }

  .sparkline-bar {
    width: 4px;
    border-radius: 2px 2px 0 0;
    background: ${(props) => rgba(props.theme.brand, 0.45)};
    transition: background 0.2s ease;

    .stat-card:hover & {
      background: ${(props) => rgba(props.theme.brand, 0.65)};
    }
  }

  /* ─── Section headings ────────────────────────────── */
  .section-title {
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    color: ${(props) => props.theme.colors.text.muted};
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  /* ─── Quick Actions section ───────────────────────── */
  .quick-actions-section {
    margin-bottom: 22px;
  }

  .quick-actions-buttons {
    display: flex;
    gap: 10px;
  }

  .quick-action-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 18px 12px 14px;
    background: ${(props) => props.theme.copperGradientCard || rgba(props.theme.brand, 0.1)};
    border: 1px solid ${(props) => rgba(props.theme.brand, 0.2)};
    border-radius: ${(props) => props.theme.border.radius.md};
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${(props) => rgba(props.theme.brand, 0.45)}, transparent);
    }

    &:hover {
      border-color: ${(props) => rgba(props.theme.brand, 0.5)};
      box-shadow: 0 4px 14px ${(props) => rgba(props.theme.brand, 0.12)};
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }

    .quick-action-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1.5px solid ${(props) => rgba(props.theme.brand, 0.55)};
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${(props) => props.theme.brand};
    }

    .quick-action-label {
      font-size: ${(props) => props.theme.font.size.sm};
      font-weight: 500;
      color: ${(props) => rgba(props.theme.text, 0.85)};
      white-space: nowrap;
    }
  }

  /* ─── Collections section ─────────────────────────── */
  .collections-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
`;

export default StyledWrapper;

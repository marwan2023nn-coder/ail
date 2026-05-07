// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Tooltip} from 'react-bootstrap';
import styled, {createGlobalStyle, css} from 'styled-components';

export const Header = styled.div`
    
`;

export const SubHeader = styled.div`
    font-size: 11px;
   
    opacity: 0.56;
`;

export const HorizontalSpacer = styled.div<{ $size: number }>`
   margin-inline-start: ${(props) => props.$size}px;
`;

export const VerticalSpacer = styled.div<{ $size: number }>`
    margin-top: ${(props) => props.$size}px;
`;

export const StyledTooltip = styled(Tooltip)<{$isDisabled?: boolean}>`
  ${({$isDisabled}) => $isDisabled && css`
      display: none;
      background-color: rgb(var(--button-bg-rgb)) !important;
  `}
`;

export const CallsTooltipStyle = createGlobalStyle`
  .tooltip .tooltip-inner {
    background-color: #00987e !important;
    color: #ffffff !important;
  }

  .tooltip .tooltip-arrow::before {
    border-color: rgb(var(--button-bg-rgb)) !important;
  }

  .bs-tooltip-top .arrow::before,
  .bs-tooltip-auto[x-placement^="top"] .arrow::before,
  .bs-tooltip-top .tooltip-arrow::before,
  .bs-tooltip-auto[data-popper-placement^="top"] .tooltip-arrow::before {
    border-top-color: rgb(var(--button-bg-rgb)) !important;
  }

  .bs-tooltip-right .arrow::before,
  .bs-tooltip-auto[x-placement^="right"] .arrow::before,
  .bs-tooltip-end .tooltip-arrow::before,
  .bs-tooltip-auto[data-popper-placement^="right"] .tooltip-arrow::before {
    border-right-color: rgb(var(--button-bg-rgb)) !important;
  }

  .bs-tooltip-bottom .arrow::before,
  .bs-tooltip-auto[x-placement^="bottom"] .arrow::before,
  .bs-tooltip-bottom .tooltip-arrow::before,
  .bs-tooltip-auto[data-popper-placement^="bottom"] .tooltip-arrow::before {
    border-bottom-color: rgb(var(--button-bg-rgb)) !important;
  }

  .bs-tooltip-left .arrow::before,
  .bs-tooltip-auto[x-placement^="left"] .arrow::before,
  .bs-tooltip-start .tooltip-arrow::before,
  .bs-tooltip-auto[data-popper-placement^="left"] .tooltip-arrow::before {
    border-left-color: rgb(var(--button-bg-rgb)) !important;
  }
`;

export const Spinner = styled.span<{$size: number}>`
  width: ${({$size}) => $size}px;
  height: ${({$size}) => $size}px;
  border-radius: 50%;
  display: inline-block;
  border-top: 2px solid #166DE0;
  border-right: 2px solid transparent;
  box-sizing: border-box;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

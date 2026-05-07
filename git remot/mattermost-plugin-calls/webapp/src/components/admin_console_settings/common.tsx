// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import GenericModal from 'src/components/generic_modal';
import CompassIcon from 'src/components/icons/compassIcon';
import styled from 'styled-components';

export const leftCol = 'col-sm-4';
export const rightCol = 'col-sm-8';

export const LabelRow = styled.div`
    display: flex;
`;

export const Label = styled.span`
    margin-inline-end: 8px;
`;

export const EnterprisePill = ({children}: {children: ReactNode}) => (
    <Enterprise>
        <CompassIcon icon={'key-variant'}/>
        {children}
    </Enterprise>
);

const Enterprise = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    padding: 2px 6px 2px 2px;
    border-radius: 4px;
    height: 20px;
    gap: 1px;  // compass-icons have a 2.4px horizontal margin

    font-family: 'Effra_Trial_Rg';
    font-size: 12px;
    
    line-height: 16px;

    background: rgba(var(--button-bg-rgb), 0.12);
    color: var(--button-bg);

    >i {
        font-size: 12px;
    }
`;

export const LeftBox = styled.div`
    display: flex;
    flex-direction: column;
    padding: 24px;
    max-width: 584px;
    background: var(--center-channel-bg);
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
`;

export const Title = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Effra_Trial_Rg', sans-serif;
    
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-text);
`;

export const Text = styled.div`
    font-family: 'Effra_Trial_Rg';
   
    font-size: 12px;
    line-height: 16px;
    color: var(--center-channel-text);
`;

export const Footer = styled.div`
    display: flex;
`;

export const FooterText = styled.div`
    display: flex;
    align-items: center;
    font-family: 'Effra_Trial_Rg';
   
    font-size: 10px;
    line-height: 16px;
    color: rgba(var(--center-channel-text-rgb), 0.72);
`;

export const ModalTitle = styled.div`
    font-family: 'Effra_Trial_Rg', sans-serif;
    font-style: normal;
    
    font-size: 22px;
    line-height: 28px;
    text-align: center;
`;

export const ModalBody = styled.div`
    font-family: 'Effra_Trial_Rg';
    font-style: normal;
   
    font-size: 14px;
    line-height: 20px;
`;

export const ModalFooterContainer = styled.div`
    display: flex;
    justify-content: center;
`;

export const StyledModal = styled(GenericModal)`
    text-align: center;
`;

export const RadioInput = styled.input<{disabled: boolean}>`
&& {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid rgba(var(--center-channel-color-rgb),0.24);
  border-radius: 50%;
  color: rgba(var(--center-channel-color-rgb),0.24);
  appearance: none;
  place-content: center;
  cursor: pointer;
  background-color: white;
  margin: 0;
  opacity: ${({disabled}) => (disabled ? 0.5 : 1.0)};
  cursor: ${({disabled}) => (disabled ? 'not-allowed' : 'pointer')};

  &:checked {
    border-color: var(--denim-button-bg);
  }

  &::before {
    width: 8px;
    height: 8px;
    background: var(--denim-button-bg);
    content: "";
    border-radius: 50%;
    transform: scale(0);
    transform-origin: center center;
    transition: 200ms transform ease-in-out;
  }

  &:checked::before {
    transform: scale(1);
  }
}
`;

export const RadioInputLabel = styled.label<{$disabled: boolean}>`
  display: inline-flex;
  margin-top: 8px;
  margin-inline-end: 24px;
  width: fit-content;
  flex-direction: row;
  align-items: center;
  margin-bottom: 0;
  cursor: pointer;
  font-size: 14px;
 
  gap: 8px;
  line-height: 20px;

  opacity: ${({$disabled}) => ($disabled ? 0.5 : 1.0)};
  cursor: ${({$disabled}) => ($disabled ? 'not-allowed' : 'pointer')};
`;

export const SectionTitle = styled.div`
  font-family: 'Effra_Trial_Rg', sans-serif;
  font-size: 16px;
  
  line-height: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const UnavailableSubtitle = styled.div`
  color: var(--center-channel-color-72);
  font-family: " 'Effra_Trial_Rg'";
  font-size: 14px;
  font-style: italic;
 
  line-height: 20px;
`;

export const TextInput = styled.input<{disabled: boolean}>`
&& {
  cursor: ${({disabled}) => (disabled ? 'not-allowed' : 'auto')};
}
`;

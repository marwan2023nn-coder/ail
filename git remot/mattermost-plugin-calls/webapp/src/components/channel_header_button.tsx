// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId, getUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import React, {useState} from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {Header, Spinner, SubHeader} from 'src/components/shared';
import {
    areGroupCallsAllowed,
    callsShowButton,
    channelIDForCurrentCall,
    clientConnecting,
    currentChannelHasCall,
    isCloudProfessionalOrEnterpriseorEnterpriseAdvanceOrTrial,
    isCloudStarter,
    isLimitRestricted,
    maxParticipants,
} from 'src/selectors';
import {getUserIdFromDM, isDMChannel} from 'src/utils';
import styled, {css} from 'styled-components';

const ChannelHeaderButton = () => {
    const channel = useSelector(getCurrentChannel);
    const currentUserID = useSelector(getCurrentUserId);
    const otherUserID = getUserIdFromDM(channel?.name || '', currentUserID);
    const otherUser = useSelector((state: GlobalState) => getUser(state, otherUserID));
    const isDeactivatedDM = isDMChannel(channel) && otherUser?.delete_at > 0;
    const show = useSelector((state: GlobalState) => callsShowButton(state, channel?.id || ''));
    const inCall = useSelector(channelIDForCurrentCall) === channel?.id;
    const hasCall = useSelector(currentChannelHasCall);
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const cloudStarter = useSelector(isCloudStarter);
    const isCloudPaid = useSelector(isCloudProfessionalOrEnterpriseorEnterpriseAdvanceOrTrial);
    const limitRestricted = useSelector(isLimitRestricted);
    const maxCallParticipants = useSelector(maxParticipants);
    const isChannelArchived = channel && channel.delete_at > 0;
    const isClientConnecting = useSelector(clientConnecting);
    const callsAllowed = useSelector(areGroupCallsAllowed) || isDMChannel(channel);

    const {formatMessage} = useIntl();

    const [joining, setJoining] = useState(false); // doesn't matter, will be set below
    const onClick = () => setJoining(hasCall);

    if (!show || !channel || !callsAllowed) {
        return null;
    }

    const restricted = limitRestricted || isChannelArchived || isDeactivatedDM;
    const withUpsellIcon = (limitRestricted && cloudStarter && !inCall);

    let callButtonText;
    if (hasCall) {
        callButtonText = formatMessage({defaultMessage: 'الانضمام إلى المكالمة'});
    } else {
        callButtonText = formatMessage({defaultMessage: 'بدء المكالمة'});
    }

    if (isClientConnecting && joining) {
        callButtonText = formatMessage({defaultMessage: 'جارٍ الانضمام إلى المكالمة...'});
    } else if (isClientConnecting) {
        // eslint-disable-next-line unused-imports/no-unused-vars
        callButtonText = formatMessage({defaultMessage: 'جارٍ بدء المكالمة...'});
    }

    const button = (
        <CallButton
            id='calls-join-button'
            className={'IconContainer-hXqplC cshkYr control ' + (inCall || restricted ? 'disabled' : '')}
            style={{display: 'flex',
                width: '18px',
                placeItems: 'center',
                placeContent: 'center',
                border: 'none',
                background: 'rgba(0, 0, 0, 0)',
                borderRadius: '4px',
                color: '#00987e',
                padding: '0px',
                margin: '0px',
            }}
            disabled={isChannelArchived || isDeactivatedDM}
            $restricted={restricted}
            $isCloudPaid={isCloudPaid}
            $isClientConnecting={isClientConnecting}
            onClick={onClick}
        >
            {isClientConnecting ? <Spinner $size={12}/> : <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 512 512'
                width={'17px'}
                height={'16px'}
            // eslint-disable-next-line react/jsx-closing-bracket-location
            >
                <path
                    d='M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z'
                    fill='rgb(var(--button-bg-rgb))'
                />
            </svg>
            }
            {/* <CallButtonText>
                {callButtonText}
            </CallButtonText> */}
            {withUpsellIcon &&
                <UpsellIcon className={'icon icon-key-variant'}/>
            }
        </CallButton>
    );

    if (isChannelArchived) {
        return (
            <OverlayTrigger
                placement='bottom'
                rootClose={true}
                overlay={
                    <Tooltip id='tooltip-limit-header'>
                        {formatMessage({defaultMessage: 'المكالمات غير متاحة في القنوات المؤرشفة.'})}
                    </Tooltip>
                }
            >
                {button}
            </OverlayTrigger>
        );
    }

    if (isDeactivatedDM) {
        return (
            <OverlayTrigger
                placement='bottom'
                rootClose={true}
                overlay={
                    <Tooltip id='tooltip-limit-header'>
                        {formatMessage({defaultMessage: 'المكالمات غير متاحة في المحادثة المباشرة مع مستخدم معطل.'})}
                    </Tooltip>
                }
            >
                {button}
            </OverlayTrigger>
        );
    }

    if (withUpsellIcon) {
        return (
            <OverlayTrigger
                placement='bottom'
                rootClose={true}
                overlay={
                    <Tooltip id='tooltip-limit-header'>
                        <Header>
                            {formatMessage({defaultMessage: 'Workspace Cloud Professional feature'})}
                        </Header>
                        <SubHeader>
                            {formatMessage({defaultMessage: 'هذه ميزة مدفوعة، متاحة مع تجربة مجانية لمدة 30 يومًا'})}
                        </SubHeader>
                    </Tooltip>
                }
            >
                {button}
            </OverlayTrigger>
        );
    }

    // TODO: verify isCloudPaid message (asked in channel)
    if (limitRestricted && !inCall) {
        return (
            <OverlayTrigger
                placement='bottom'
                rootClose={true}
                overlay={
                    <Tooltip id='tooltip-limit-header'>
                        <Header>
                            {formatMessage({defaultMessage: 'هذه المكالمة وصلت إلى الحد الأقصى من {count, plural, =1 {مشارك واحد} other {# مشاركين}}.'}, {count: maxCallParticipants})}
                        </Header>

                        {cloudStarter && !isAdmin &&
                        <SubHeader>
                            {formatMessage({defaultMessage: 'اتصل بمسؤول النظام الخاص بك لمزيد من المعلومات حول سعة المكالمة.'})}
                        </SubHeader>
                        }
                        {cloudStarter && isAdmin &&
                        <SubHeader>
                            {formatMessage({defaultMessage: 'قم بالترقية إلى Cloud Professional أو Cloud Enterprise لتمكين المكالمات الجماعية لأكثر من {count, plural, =1 {مشارك واحد} other {# مشاركين}}.'}, {count: maxCallParticipants})}
                        </SubHeader>
                        }
                        {isCloudPaid &&
                        <SubHeader>
                            {formatMessage({defaultMessage: 'حاليًا، {count} هو الحد الأقصى لعدد المشاركين في المكالمات السحابية.'}, {count: maxCallParticipants})}
                        </SubHeader>
                        }
                    </Tooltip>
                }
            >
                {button}
            </OverlayTrigger>
        );
    }

    return button;
};

const CallButton = styled.button<{ $restricted: boolean, $isCloudPaid: boolean, $isClientConnecting: boolean }>`
    gap: 6px;

    // &&& is to override the call-button styles
    &&& {
        ${(props) => props.$restricted && css`
            color: rgba(var(--center-channel-color-rgb), 0.48);
            border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
            margin-inline-end: 4px;
        `}
        cursor: ${(props) => (props.$restricted && props.$isCloudPaid ? 'not-allowed' : 'pointer')};
    }

    ${(props) => props.$isClientConnecting && css`
      &&&& {
        background: rgba(var(--button-bg-rgb), 0.12);
        color: #00987e;
      }
    `}
`;

const UpsellIcon = styled.i`
    // &&&&& is to override the call-button styles
    &&&&& {
        position: absolute;
        inset-inline-end: 52px;
        top: 12px;
        color: #00987e;
        width: 16px;
        height: 16px;
        background-color: var(--center-channel-bg);
        border-radius: 50%;
    }
`;

// eslint-disable-next-line unused-imports/no-unused-vars
const CallButtonText = styled.span`
  &&&& {
    font-size: 12px;
    line-height: 16px;
    
    display: none;

  }
`;

export default ChannelHeaderButton;

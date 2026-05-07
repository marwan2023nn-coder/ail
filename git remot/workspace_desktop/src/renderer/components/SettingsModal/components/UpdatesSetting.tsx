// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {FormattedMessage} from 'react-intl';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import CheckSetting from './CheckSetting';

import './UpdatesSetting.scss';

export default function UpdatesSetting({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    id,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onSave,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    value,
}: {
    id: string;
    onSave: (key: string, value: boolean) => void;
    value: boolean;
}) {
    return (
        <>
            {/* <CheckSetting
                id={id}
                onSave={onSave}
                value={value}
                label={
                    <FormattedMessage
                        id='renderer.components.settingsPage.updates.automatic'
                        defaultMessage='Automatically check for updates'
                    />
                }
                subLabel={
                    <div className='UpdatesSetting__subLabel'>
                        <FormattedMessage
                            id='renderer.components.settingsPage.updates.automatic.description'
                            defaultMessage='If enabled, updates to the Desktop App will download automatically and you will be notified when ready to install.'
                        />
                        <button
                            className='UpdatesSetting__button btn btn-primary'
                            id='checkForUpdatesNow'
                            onClick={window.desktop.checkForUpdates}
                        >
                            <FormattedMessage
                                id='renderer.components.settingsPage.updates.checkNow'
                                defaultMessage='Check for Updates Now'
                            />
                        </button>
                    </div>
                }
            /> */}
        </>
    );
}

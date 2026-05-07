// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties} from 'react';

type Props = {
    className?: string,
    fill?: string,
    style?: CSSProperties,
}

export default function LeaveCallIcon(props: Props) {
    return (
        <svg
            {...props}
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
            role='img'
        >
            <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M17 10.5C17 10.7761 16.7761 11 16.5 11L13.5 11C13.2239 11 13 10.7761 13 10.5V7.5C13 7.22386 13.2239 7 13.5 7C13.7761 7 14 7.22386 14 7.5V9.29289L17.1464 6.14645C17.3417 5.95118 17.6583 5.95118 17.8536 6.14645C18.0488 6.34171 18.0488 6.65829 17.8536 6.85355L14.7071 10L16.5 10C16.7761 10 17 10.2239 17 10.5Z'
                fill='white'
            />
            <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M5 7C5 5.89543 5.89543 5 7 5H7.91442C8.488 5 8.98798 5.39037 9.1271 5.94683L9.86429 8.89562C9.98627 9.38353 9.80396 9.89703 9.40162 10.1988L8.5392 10.8456C8.44965 10.9128 8.43018 11.0111 8.45533 11.0798C9.21234 13.1463 10.8537 14.7877 12.9202 15.5447C12.9889 15.5698 13.0872 15.5504 13.1544 15.4608L13.8012 14.5984C14.103 14.196 14.6165 14.0137 15.1044 14.1357L18.0532 14.8729C18.6096 15.012 19 15.512 19 16.0856V17C19 18.1046 18.1046 19 17 19H15.5C9.70101 19 5 14.299 5 8.5V7Z'
                fill='white'
            />
        </svg>
    );
}

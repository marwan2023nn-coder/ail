// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

/**
 * A function component for inlining SVG code for animation logo loader
 */
function LoadingAnimation() {
    return (
        <svg
            width='104'
            height='104'
            viewBox='0 0 104 104'
            xmlns='http://www.w3.org/2000/svg'
        >
            <defs>
                <linearGradient
                    id='LoadingAnimation__spinner-gradient'
                    x1='0%'
                    y1='72px'
                    x2='0%'
                    y2='32px'
                    gradientUnits='userSpaceOnUse'
                >
                    <stop
                        offset='0'
                        className='LoadingAnimation__spinner-gradient-color'
                        stopOpacity='1'
                    />
                    <stop
                        offset='1'
                        className='LoadingAnimation__spinner-gradient-color'
                        stopOpacity='0'
                    />
                </linearGradient>
                <mask id='LoadingAnimation__base-wipe-mask'>
                    <rect
                        x='0'
                        y='0'
                        width='104'
                        height='104'
                        fill='transparent'
                    />
                    <g className='LoadingAnimation__compass-base-mask-container'>
                        <circle
                            className='LoadingAnimation__compass-base-mask'
                            r='27'
                            cx='52'
                            cy='52'
                            fill='transparent'
                            stroke='black'
                            strokeWidth='54'
                        />
                    </g>
                </mask>
                <mask id='LoadingAnimation__base-mask'>
                    <rect
                        x='0'
                        y='0'
                        width='104'
                        height='104'
                        fill='white'
                    />
                    <circle
                        r='37'
                        cx='54'
                        cy='46'
                        fill='black'
                    />
                    <g className='LoadingAnimation__compass-needle-behind-mask'>
                        <g transform='translate(54,46)'>
                            <g transform='translate(-29, -61.3)'>
                                <path
                                    d='M1.02596 3.4953C0.396676 3.81378 0 4.45911 0 5.1644V26.4087C0 27.114 0.396676 27.7593 1.02596 28.0778L7.52933 31.3691C8.77365 31.9988 10.2447 31.0946 10.2447 29.7V1.87312C10.2447 0.478518 8.77365 -0.425715 7.52933 0.204023L1.02596 3.4953Z'
                                    fill='black'
                                />
                            </g>
                        </g>
                    </g>
                    <g className='LoadingAnimation__compass-needle-front-mask'>
                        <g transform='translate(54,46)'>
                            <g transform='translate(-29,-61.3)'>
                                <path
                                    d='M1.02596 3.4953C0.396676 3.81378 0 4.45911 0 5.1644V26.4087C0 27.114 0.396676 27.7593 1.02596 28.0778L7.52933 31.3691C8.77365 31.9988 10.2447 31.0946 10.2447 29.7V1.87312C10.2447 0.478518 8.77365 -0.425715 7.52933 0.204023L1.02596 3.4953Z'
                                    fill='black'
                                />
                            </g>
                        </g>
                    </g>
                </mask>
                <mask id='LoadingAnimation__spinner-left-half-mask'>
                    <rect
                        x='0'
                        y='0'
                        width='52'
                        height='104'
                        fill='white'
                    />
                    <circle
                        className='LoadingAnimation__spinner-mask'
                        r='20'
                        cx='52'
                        cy='52'
                        fill='black'
                    />
                </mask>
                <mask id='LoadingAnimation__spinner-right-half-mask'>
                    <rect
                        x='52'
                        y='0'
                        width='52'
                        height='104'
                        fill='white'
                    />
                    <circle
                        className='LoadingAnimation__spinner-mask'
                        r='20'
                        cx='52'
                        cy='52'
                        fill='black'
                    />
                </mask>
            </defs>
            <g
                className='LoadingAnimation__spinner-container'
            >
                <g className='LoadingAnimation__spinner'>
                    <circle
                        r='25'
                        cx='52'
                        cy='52'
                        fill='currentColor'
                        mask='url(#LoadingAnimation__spinner-left-half-mask)'
                    />
                    <circle
                        r='25'
                        cx='52'
                        cy='52'
                        fill='url(#LoadingAnimation__spinner-gradient)'
                        mask='url(#LoadingAnimation__spinner-right-half-mask)'
                    />
                </g>
            </g>
            <g className='LoadingAnimation__compass'>
                <g
                    className='LoadingAnimation__compass-base-container'
                    mask='url(#LoadingAnimation__base-wipe-mask)'
                >
                    <circle
                        className='LoadingAnimation__compass-base'
                        r='52'
                        cx='52'
                        cy='52'
                        fill='transparent'
                        mask='url(#LoadingAnimation__base-mask)'
                    />
                </g>
                <g className='LoadingAnimation__compass-needle-container'>
                    <g className='LoadingAnimation__compass-needle'>
                        <g transform='translate(52,52)'>
                            <g transform='translate(-14,-16) scale(1.5)'>
                                <path
                                    d='M26.5303 3.4953C27.1596 3.81378 27.5562 4.45911 27.5562 5.1644V26.4087C27.5562 27.114 27.1596 27.7593 26.5303 28.0778L20.0269 31.3691C18.7826 31.9988 17.3115 31.0946 17.3115 29.7V1.87312C17.3115 0.478518 18.7826 -0.425715 20.0269 0.204023L26.5303 3.4953Z'
                                    fill='#00987E'
                                />
                                <path
                                    d='M1.02596 3.4953C0.396676 3.81378 0 4.45911 0 5.1644V26.4087C0 27.114 0.396676 27.7593 1.02596 28.0778L7.52933 31.3691C8.77365 31.9988 10.2447 31.0946 10.2447 29.7V1.87312C10.2447 0.478518 8.77365 -0.425715 7.52933 0.204023L1.02596 3.4953Z'
                                    fill='#00987E'
                                />
                            </g>
                        </g>
                    </g>
                </g>
            </g>
        </svg>
    );
}

export default LoadingAnimation;

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import bing from 'assets/sounds/bing.mp3';
import Buzz from 'assets/sounds/Buzz.mp3';
import crackle from 'assets/sounds/crackle.mp3';
import ding from 'assets/sounds/ding.mp3';
import down from 'assets/sounds/down.mp3';
import hello from 'assets/sounds/hello.mp3';
import ripple from 'assets/sounds/ripple.mp3';
import upstairs from 'assets/sounds/upstairs.mp3';
const DEFAULT_WIN7 = 'Ding';
const notificationSounds = new Map([
    [DEFAULT_WIN7, ding],
    ['Bing', bing],
    ['Crackle', crackle],
    ['Down', down],
    ['Hello', hello],
    ['Ripple', ripple],
    ['Upstairs', upstairs],
    ['Buzz', Buzz],
]);

let canPlaySound = true;

export const playSound = (soundName: string) => {
    const sound = notificationSounds.get(soundName);
    if (soundName && sound && canPlaySound) {
        canPlaySound = false;
        setTimeout(() => {
            canPlaySound = true;
        }, 3000);
        const audio = new Audio(sound);
        audio.play().catch((err) => {
            // "AbortError: The play() request was interrupted by a call to pause()."
            // This can happen if the audio is paused or replaced before it starts playing.
            if (err.name !== 'AbortError') {
                console.error('Failed to play notification sound', err);
            }
        });
    }
};

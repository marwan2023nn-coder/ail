// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ar from './ar.json';
import en from './en.json';

export type Language = {
    value: string;
    name: string;
    order: number;
    url: Record<string, string>;
};

export const languages: Record<string, Language> = {
    ar: {
        value: 'ar',
        name: 'عربي ',
        order: 0,
        url: ar,
    },
    en: {
        value: 'en',
        name: 'English',
        order: 1,
        url: en,
    },
};

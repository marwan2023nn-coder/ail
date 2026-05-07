// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';

export default class JsonFileManager<T> {
    jsonFile: string;
    json: T;
    private saving?: Promise<void>;

    constructor(file: string) {
        this.jsonFile = file;
        try {
            this.json = JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch (err) {
            this.json = {} as T;
        }
    }

    write(json: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const tmpFile = `${this.jsonFile}.tmp`;
            fs.writeFile(tmpFile, json, (err) => {
                if (err) {
                    // No real point in bringing electron-log into this otherwise electron-free file
                    // eslint-disable-next-line no-console
                    console.error(err);
                    reject(err);
                    return;
                }

                fs.rename(tmpFile, this.jsonFile, (renameErr) => {
                    if (renameErr) {
                        // eslint-disable-next-line no-console
                        console.error(renameErr);
                        try {
                            fs.unlinkSync(tmpFile);
                        } catch (e) {
                            // ignore
                        }
                        reject(renameErr);
                        return;
                    }
                    resolve();
                });
            });
        });
    }

    writeToFile(): Promise<void> {
        const json = JSON.stringify(this.json, undefined, 2);
        if (this.saving) {
            this.saving = this.saving.then(() => this.write(json));
        } else {
            this.saving = this.write(json);
        }
        return this.saving;
    }

    setJson(json: T): void {
        this.json = json;
        this.writeToFile();
    }

    saveSync(): void {
        const json = JSON.stringify(this.json, undefined, 2);
        const tmpFile = `${this.jsonFile}.tmp`;
        try {
            fs.writeFileSync(tmpFile, json, 'utf-8');
            fs.renameSync(tmpFile, this.jsonFile);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        }
    }

    setValue(key: keyof T, value: T[keyof T]): void {
        this.json[key] = value;
        this.writeToFile();
    }

    getValue(key: keyof T): T[keyof T] {
        return this.json[key];
    }
}

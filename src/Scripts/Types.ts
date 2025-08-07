import { IAudioMetadata } from "music-metadata";

export interface CompletedInfo {
    track: string,
    artist: string,
    album: string,
    duration: string,
    result: string,
    download?: (item: HTMLAnchorElement) => void
}

export type DurationResult =
    | { success: true, duration: number }
    | { success: false, error: string | Event };
export type TagResult =
    | { success: true; content: IAudioMetadata }
    | { success: false; error: Error | string };

export interface Options {
    sendAlbum: boolean,
    sendArtist: boolean,
    sendDuration: boolean,
    secondDifference: number,
    useQ: boolean,
    useFileName: boolean,
    forceFileName: boolean,
    enforceSeconds: boolean,
    keepJson: boolean,
    keepTxt: boolean,
    keepLrc: boolean,
    useFS: boolean,
    minWait: number,
    maxWait: number,
    allowedExtensions: string
    checkLrc: boolean
    checkOnlyLrcFileName: boolean
}

export enum DialogEnum {
    NONE = 0,
    OPEN_SOURCE = 1,
    PRIVACY = 2
}

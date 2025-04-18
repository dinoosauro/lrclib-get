import { CompletedInfo, DurationResult, Options, TagResult } from "./Types"
import HandleRelativePath from "./HandleRelativePath";
import WriteOperation from "./WriteOperation";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";

interface Props {
    /**
     * The list of files that should be converted
     */
    files: File[] | FileList,
    /**
     * The callback used to update the table with the completed/failed operations in React
     */
    updateState?: React.Dispatch<React.SetStateAction<CompletedInfo[]>>,
    /**
     * The settings chosen by the user
     */
    options: Options,
    /**
     * Optional parameter. If provided, the website will use the File System API to directly write the files on the device.
     */
    handle?: FileSystemDirectoryHandle,
    anchorUpdate?: React.Dispatch<React.SetStateAction<HTMLAnchorElement[]>>,
    progress?: React.RefObject<HTMLProgressElement | null>
}
export default async function FileLogic({ files, updateState, options, handle, anchorUpdate, progress }: Props) {
    /**
     * The string that contains all the errors that'll be written in the output file.
     */
    let errorContainer = "";
    const zipFile = new ZipWriter(new BlobWriter());
    if (progress?.current) progress.current.max += (files.length - (progress.current.value === 0 && progress.current.max === 1 ? 1 : 0));
    for (const item of files) {
        if (progress?.current) progress.current.value = (progress.current.value ?? 0) + 1;
        if (options.checkLrc) {
            /**
             * All the .lrc files that are in the selected subfolder
             */
            const availableLyrics = Array.from(files).filter(item => item.name.endsWith(".lrc"));
            if (options.checkOnlyLrcFileName) { // Check if a LRC file with the same name as the track exists, even if it's in another folder.
                const fileName = item.name.substring(0, item.name.lastIndexOf("."));
                if (availableLyrics.findIndex(file => file.name.substring(0, file.name.lastIndexOf(".")) === fileName) !== -1) continue;
            } else { // Check that a LRC file with the same name as the track exists, and it's located in the same folder.
                let filePath = HandleRelativePath(item);
                if (availableLyrics.findIndex(file => HandleRelativePath(file) === filePath) !== -1) continue;;
            }
        }
        const result = await new Promise<TagResult>((res) => {
            if (options.forceFileName) res({ success: false, error: "Not required." });
            // @ts-ignore
            (jsmediatags as typeof jsmediatags).read(item, {
                onSuccess(data) {
                    res({ success: true, content: data })
                },
                onError(error) {
                    res({ success: false, error });
                },
            })
        });
        /**
         * The URL used to fetch lyrics
         */
        let reqUrl = "";
        const seconds = await new Promise<DurationResult>((res) => {
            if (!options.sendDuration) res({ success: false, error: "Not required." }); else {
                const audio = new Audio(URL.createObjectURL(item));
                audio.onloadedmetadata = () => {
                    res({ success: true, duration: audio.duration })
                }
                audio.onerror = (err) => res({ success: false, error: err });
            }
        });
        /**
         * The fetched metadata of the track, along with its success/failure
         */
        let infoConversion: CompletedInfo = { track: item.name.substring(0, item.name.lastIndexOf(".")), artist: "", album: "", duration: seconds.success ? seconds.duration.toString() : "", result: "" };
        if (result.success) { // Metadata fetched
            const [album, artist, track] = [result.content.tags.album, result.content.tags.TPE2?.data ?? result.content.tags.artist, result.content.tags.title ?? item.name.substring(0, item.name.lastIndexOf("."))];
            if ((album || !options.sendAlbum) && track && (artist || !options.sendArtist) && (seconds.success || !options.sendDuration)) {
                reqUrl = `https://lrclib.net/api/search?${options.useQ ? "q" : "track_name"}=${encodeURIComponent(track)}${options.sendArtist && artist ? `${options.useQ ? " " : "&artist_name="}${encodeURIComponent(artist)}` : ""}${options.sendAlbum && album ? `${options.useQ ? " " : "&album_name="}${encodeURIComponent(album)}` : ""}`;
            }
            infoConversion.track = track;
            infoConversion.artist = artist || "-";
            infoConversion.album = album || "-";
        }
        if (reqUrl === "" && options.useFileName) { // Not enough metadata fetched. Use the file name.
            reqUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(item.name.substring(0, item.name.lastIndexOf(".")))}`
        }
        if (reqUrl !== "") {
            const req = await fetch(reqUrl, {
                headers: {
                    "X-User-Agent": `LRCLib-Get ${window.version} (https://github.com/dinoosauro/lrclib-get)`,
                    "Content-Type": "application/json"
                }
            });
            if (req.ok) {
                const res = await req.json();
                if (res.length === 0) {
                    errorUpdate("DATABASE ITEM NOT FOUND", item, infoConversion);
                    await nextTimeout();
                    continue;
                }
                const path = HandleRelativePath(item);
                let selectedItem = -1;
                if (seconds.success) {
                    for (let i = 0; i < res.length; i++) {
                        const [resDuration, fileDuration] = [+res[i].duration.toFixed(0), +seconds.duration.toFixed(0)]
                        if ((resDuration - options.secondDifference) < fileDuration && (resDuration + options.secondDifference) > fileDuration) {
                            selectedItem = i;
                            break;
                        }
                    }
                }
                if (!seconds.success || !options.enforceSeconds) selectedItem = 0;
                if ((!res[selectedItem].plainLyrics && !res[selectedItem].syncedLyrics) || selectedItem === -1) {
                    errorUpdate("DATABASE ITEM NOT FOUND", item, infoConversion);
                    await nextTimeout();
                    continue;
                }
                options.keepJson && await WriteOperation(handle ?? zipFile, `json/${path}.json`, JSON.stringify(res));
                options.keepTxt && await WriteOperation(handle ?? zipFile, `plain/${path}.txt`, res[selectedItem].plainLyrics);
                options.keepLrc && await WriteOperation(handle ?? zipFile, `synced/${path}.lrc`, res[selectedItem].syncedLyrics);

                updateState && updateState(prevState => [...prevState, {
                    ...infoConversion,
                    result: "Successful",
                    download: async (item: HTMLAnchorElement) => { // This function is called if there's no Blob URL associated with this.
                        const zip = new ZipWriter(new BlobWriter());
                        await zip.add(`${path}.json`, new TextReader(JSON.stringify(res)));
                        await zip.add(`${path}.txt`, new TextReader(res[selectedItem].plainLyrics));
                        await zip.add(`${path}.lrc`, new TextReader(res[selectedItem].syncedLyrics));
                        item.href = URL.createObjectURL(await zip.close());
                        item.download = `${path.substring(path.lastIndexOf("/") + 1)}.zip`;
                        item.click();
                    }
                }]);

            } else if (req.status === 404) {
                errorUpdate("DATABASE ITEM NOT FOUND", item, infoConversion);
            } else errorUpdate(`SERVER ERROR: ${req.status}`, item, infoConversion);
            await nextTimeout();
        } else errorUpdate(`MISSING FILE INFORMATION`, item, infoConversion);
    }
    /**
     * Update the table and the error string due to this failure.
     * @param type description of the error
     * @param file the File that caused the error
     * @param info optional. Add metadata to the table even if there has been an error
     */
    function errorUpdate(type: string, file: File, info?: CompletedInfo) {
        errorContainer += `[${type}] ${file._path || file.name}\n`;
        updateState && updateState(prevState => [...prevState, {
            track: info?.track || file.name,
            artist: info?.artist || "-",
            album: info?.album || "-",
            duration: info?.duration || "-",
            result: `Error: ${type}`,
        }])
    };
    errorContainer !== "" && await WriteOperation(handle ?? zipFile, `LRCLib-Get-${files[0]._path?.substring(0, files[0]._path?.indexOf("/"))}-Errors-${Date.now()}.txt`, errorContainer);
    if (!handle) {
        const download = `LyricsDownload-${files[0]._path?.substring(0, files[0]._path?.indexOf("/"))}-${Date.now()}.zip`;
        const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(await zipFile.close()),
            download,
            textContent: download,
            target: "_blank"
        });
        a.click();
        anchorUpdate && anchorUpdate(prev => { console.log(prev); return [...prev, a] });
    }
    function nextTimeout() {
        return new Promise(res => {
            setTimeout(res, Math.floor(Math.random() * (options.maxWait - options.minWait) + options.minWait))
        })
    }
}

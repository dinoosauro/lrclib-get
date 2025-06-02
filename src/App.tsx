import { useEffect, useRef, useState } from "react";
import { CompletedInfo, DialogEnum, Options } from "./Scripts/Types";
import FileLogic from "./Scripts/FileLogic";
import Dialog from "./Dialog";
import Licenses from "./Scripts/Licenses";
import VanillaHTMLConverter from "./VanillaHTMLConverter";
import GetDroppedFiles from "./Scripts/GetDroppedFiles";
declare global {
  interface Window {
    version: string,
    showDirectoryPicker?: ({ id, mode }: { id: string, mode: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>,
  }
  interface File {
    _path: string
  }
}

export default function App() {
  const [state, updateState] = useState<CompletedInfo[]>([]);
  const [dialog, showDialog] = useState<DialogEnum>(DialogEnum.NONE);
  const [mainLinks, updateMainLinks] = useState<HTMLAnchorElement[]>([]);
  let isUpdatedFromLocalStorage = useRef<boolean>(false);
  /**
   * Check if the file has one of the allowed extensions by the user
   * @param file the file path (string)
   * @returns true if the lyrics of the file should be fetched, false otherwise.
   */
  function checkAllowedExtension(file: string) {
    for (const extension of options.current.allowedExtensions.split(",")) {
      if (file.endsWith(extension)) return true;
    }
    return false;
  }
  async function pickFiles(directory = false) {
    if (directory && options.current.useFS && window.showDirectoryPicker) { // Get write access to a directory using the File System API
      try {
        const directory = await window.showDirectoryPicker({ id: "LRCLibGet-Folder", mode: "readwrite" });
        const arr: File[] = [];
        /**
         * Recursively fetch the files in that folder.
         * @param handle the FileSystemDirectoryHandle of this folder
         * @param path the relative path of this folder
         */
        async function getFiles(handle: FileSystemDirectoryHandle, path = directory.name) { // path is automatically set to "directory.name" to emulate the webkitRelativePath, that adds the main folder name at the start. It's important to keep it since the HandleRelativePath function automatically deletes the first folder from the path string.
          for await (const entry of handle.values()) {
            if (entry.kind === "file") {
              const file = await entry.getFile();
              file._path = `${path}/${entry.name}`; // The _path property is used so that the relative path can be added also when using the File System API
              checkAllowedExtension(file._path) && arr.push(file);
            } else await getFiles(await handle.getDirectoryHandle(entry.name), `${path}/${entry.name}`);
          }
        }
        await getFiles(directory);
        await FileLogic({ files: arr, updateState, options: options.current, handle: directory, anchorUpdate: updateMainLinks, progress });
        return;
      } catch (ex) {
        console.warn(ex);
      }
    }
    const input = document.createElement("input");
    input.multiple = true;
    input.webkitdirectory = directory;
    input.type = "file";
    input.onchange = async () => {
      if (input.files) {
        for (let i = 0; i < input.files.length; i++) input.files[i]._path = input.files[i].webkitRelativePath; // The _path property is used so that the relative path can be added also when using the File System API
        await FileLogic({ files: directory ? Array.from(input.files).filter(item => checkAllowedExtension(item._path)) : input.files, updateState, options: options.current, anchorUpdate: updateMainLinks, progress });
      }
    };
    input.click();
  }
  const options = useRef<Options>({
    sendAlbum: true,
    sendArtist: true,
    sendDuration: true,
    secondDifference: 5,
    useQ: false,
    useFileName: true,
    forceFileName: false,
    enforceSeconds: false,
    keepJson: true,
    keepTxt: true,
    keepLrc: true,
    useFS: false,
    minWait: 100,
    maxWait: 400,
    allowedExtensions: "",
    checkLrc: false,
    checkOnlyLrcFileName: false
  });
  const progress = useRef<HTMLProgressElement>(null);
  const autoHeightItems: (HTMLElement | null)[] = [];
  useEffect(() => {
    for (const item of autoHeightItems) {
      if (!item) continue;
      (item.closest(".card")?.getBoundingClientRect().width ?? Infinity) < (275 * window.devicePixelRatio) && item.classList.add("autoHeight");
      window.addEventListener("resize", () => {
        item.classList[(item.closest(".card")?.getBoundingClientRect().width ?? Infinity) < (275 * window.devicePixelRatio) ? "add" : "remove"]("autoHeight");
      })
    };
    document.body.addEventListener("drop", async (e) => { // Handle dropped files
      e.preventDefault();
      if (e.dataTransfer?.items) {
        const outputArr = await GetDroppedFiles(Array.from(e.dataTransfer.items).map(item => item.webkitGetAsEntry()).filter(item => !!item)); // Get the files to convert
        // If the user has enabled custom allowed extensions, an alert will be shown saying that only those items will be considered. This alert will be shown only one time.
        const arr = (localStorage.getItem("LRCLibGet-AlertShown") ?? ",").split(",");
        if (options.current.allowedExtensions !== "" && arr.indexOf("AllowedExtensionsWhenDropping") === -1) {
          alert("Only files with the allowed extensions will be fetched. You can change, or disable, allowed extensions from the settings. This alert won't be shown again.");
          arr.push("AllowedExtensionsWhenDropping");
          localStorage.setItem("LRCLibGet-AlertShown", arr.join(","));
        }
        document.body.classList.remove("drop");
        await FileLogic({ files: outputArr.filter(item => checkAllowedExtension(item._path)), updateState, options: options.current, anchorUpdate: updateMainLinks, progress });
      }
    });
    /**
     * The last date the "drop" event was dispatched. This is used so that, if there's no drag element in 200ms, the drag interface will be removed.
     */
    let dropDate = Date.now();
    document.body.addEventListener("dragover", (e) => {
      e.preventDefault();
      document.body.classList.add("drop");
      dropDate = Date.now();
    });
    setInterval(() => {
      if (Date.now() > (dropDate + 200)) document.body.classList.remove("drop");
    }, 200);
  }, [])
  if (!isUpdatedFromLocalStorage.current) {
    isUpdatedFromLocalStorage.current = true;
    const prevOptions = JSON.parse(localStorage.getItem("LRCLibGet-Options") ?? "{}") as CompletedInfo;
    // @ts-ignore
    for (let key in prevOptions) options.current[key] = prevOptions[key];
  }
  /**
   * Update the Settings
   * @param key the key to update in the Options
   * @param value the new value
   */
  function updateRef(key: keyof Options, value: typeof options.current[keyof typeof options.current]) {
    // @ts-ignore
    options.current[key] = value;
    localStorage.setItem("LRCLibGet-Options", JSON.stringify(options.current));
  }
  return <>
    <header className="flex hcenter gap">
      <img src="./icon.svg" width={48} height={48} />
      <h1>LRCLib Get</h1>
    </header>
    <p>Download the synced lyrics of your music files from LRCLib, directly from your browser.</p>
    <div className="flex gap">
      <button onClick={() => pickFiles()}>Pick files</button>
      <button onClick={() => pickFiles(true)}>Pick folder</button>
    </div>
    <br></br>
    <div className="card">
      <h2>Settings:</h2>
      <div className="flex wrap gap">
        <div className="card" style={{ backgroundColor: "var(--tableheader)" }}>
          <h3>Metadata usage:</h3>
          <p>Choose which metadata should be used to get the correct lyrics for your songs.</p>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.sendAlbum} onChange={(e) => updateRef("sendAlbum", e.target.checked)}></input><span>Check album name</span>
          </label>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.sendArtist} onChange={(e) => updateRef("sendArtist", e.target.checked)}></input><span>Check artist name</span>
          </label>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.sendDuration} onChange={(e) => updateRef("sendDuration", e.target.checked)}></input><span>Check audio duration</span>
          </label>
        </div>
        <div className="card" style={{ backgroundColor: "var(--tableheader)" }}>
          <h3>Save:</h3>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.useFS} onChange={(e) => updateRef("useFS", e.target.checked)}></input><span>Use the File System API (if available)</span>
          </label>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.keepTxt} onChange={(e) => updateRef("keepTxt", e.target.checked)}></input><span>Save the plain lyrics</span>
          </label>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.keepLrc} onChange={(e) => updateRef("keepLrc", e.target.checked)}></input><span>Save the synced lyrics</span>
          </label>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.keepJson} onChange={(e) => updateRef("keepJson", e.target.checked)}></input><span>Save the JSON response</span>
          </label>
        </div>
        <div className="card" style={{ backgroundColor: "var(--tableheader)" }}>
          <h3>Folder-specific options:</h3>
          <label className="flex hcenter margin marginInner autoWidth" ref={ref => { autoHeightItems.push(ref); return; }}>
            <span>Fetch only the lyrics of the files that end with (comma-separated list):</span><input type="text" defaultValue={options.current.allowedExtensions} onChange={(e) => updateRef("allowedExtensions", e.target.value)}></input>
          </label>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" onChange={(e) => updateRef("checkLrc", e.target.checked)} defaultChecked={options.current.checkLrc}></input>
            <span className="flex marginInner hcenter" ref={ref => { autoHeightItems.push(ref); return; }}>
              <span>Don't fetch lyrics if a .LRC file with the same name is available</span>
              <select defaultValue={options.current.checkOnlyLrcFileName ? "everywhere" : "same"} onChange={(e) => updateRef("checkOnlyLrcFileName", e.target.value === "everywhere")}>
                <option value={"same"}>in the same folder</option>
                <option value={"everywhere"}>in any subfolder of the selected one</option>
              </select>
            </span>
          </label>
        </div>
        <div className="card" style={{ backgroundColor: "var(--tableheader)" }}>
          <h3>Advanced:</h3>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.useFileName} onChange={(e) => updateRef("useFileName", e.target.checked)}></input>
            <span className="flex marginInner hcenter" ref={ref => { autoHeightItems.push(ref); return; }}>
              <span>Use the file name</span>
              <select defaultValue={options.current.forceFileName ? "always" : "metadata"} onChange={(e) => {
                updateRef("forceFileName", e.target.value === "always");
              }}>
                <option value={"metadata"}>if metadata can't be fetched</option>
                <option value={"always"}>always</option>
              </select>
            </span>
          </label>
          <label className="flex hcenter margin marginInner">
            <span>Allow this difference in seconds between the original track and the fetched lyrics:</span> <input type="number" defaultValue={options.current.secondDifference} min={0} onChange={(e) => updateRef("enforceSeconds", +e.target.value)}></input>
          </label>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.enforceSeconds} onChange={(e) => updateRef("enforceSeconds", e.target.checked)}></input><span>Skip track if none of the available lyrics matches the length of your track (by checking the interval chosen above)</span>
          </label>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.useQ} onChange={(e) => updateRef("useQ", e.target.checked)}></input><span>Use the "q" parameter in the LRCLib API</span>
          </label>
          <label>
            <span>Wait a random number between </span> <input type="number" defaultValue={options.current.minWait} min={0} onChange={(e) => updateRef("minWait", +e.target.value)}></input> <span>and</span> <input type="number" defaultValue={options.current.maxWait} min={0} onChange={(e) => updateRef("maxWait", +e.target.value)}></input> <span> milliseconds before fetching the next lyrics file</span>
          </label>
        </div>
      </div>
    </div><br></br>
    <div className="card">
      <h2>Converted files:</h2>
      <p>A zip file with all the files will be downloaded at the end. You can click on a track name to download the zip file with only that track data.</p>
      <progress ref={progress} value={0} max={0}></progress><br></br><br></br>
      <div style={{ overflow: "auto", maxWidth: "100%" }}>
        <table>
          <thead>
            <tr>
              <th>Track name:</th>
              <th>Artist:</th>
              <th>Album:</th>
              <th>Duration:</th>
              <th>Status:</th>
            </tr>
          </thead>
          <tbody>
            {state.map((item, i) => <tr style={{ backgroundColor: item.result === "Successful" ? "var(--green)" : "var(--red)" }} key={`ContentPosition-${i}`}>
              <td>
                <a style={{ textDecoration: item.download ? "underline" : "" }} onClick={(e) => {
                  if (!item.download || (e.target as HTMLAnchorElement).href) return;
                  item.download(e.target as HTMLAnchorElement);
                }}>{item.track}</a>
              </td>
              <td>{item.artist}</td>
              <td>{item.album}</td>
              <td>{item.duration}</td>
              <td>{item.result}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div><br></br>
    <div className="card anchorBlock">
      <h2>Redownload zip files</h2>
      <p>Some browsers might block the download of files. If this happens for a single track, click again on the link and it should work. If this happens for the entire conversion, you can find here the links:</p>
      {mainLinks.map(item => <VanillaHTMLConverter key={item.href} child={item}></VanillaHTMLConverter>)}
    </div><br></br>
    <p>
      <a style={{ textDecoration: "underline", marginRight: "10px" }} onClick={() => showDialog(DialogEnum.OPEN_SOURCE)}>Show open source licenses</a>
      <a style={{ textDecoration: "underline" }} onClick={() => showDialog(DialogEnum.PRIVACY)}>Privacy</a>
    </p>
    <p>Version {window.version} | This project is in no way affiliated with LRCLib.</p>
    {dialog === DialogEnum.OPEN_SOURCE ? <>
      <Dialog close={() => showDialog(DialogEnum.NONE)}>
        <h2>Open source licenses</h2>
        <p>Below are reported the licenses of the libraries used to make LRCLib-Get:</p>
        {[{
          name: "jsmediatags", author: `2009 Opera Software ASA

Copyright (c) 2015 António Afonso

Copyright (c) 2008 Jacob Seidelin, http://blog.nihilogic.dk/

Copyright (c) 2010 Joshua Kifer`, type: "bsd", link: "https://github.com/aadsm/jsmediatags"
        }, {
          name: `zip.js`, type: "bsd", link: `https://github.com/gildas-lormeau/zip.js/`, author: `2023, Gildas Lormeau`
        }, {
          name: "React", type: "mit", link: "https://github.com/facebook/react", author: "Meta Platforms, Inc. and affiliates."
        },
        {
          name: "Vite", type: "mit", link: "https://github.com/vitejs/vite", author: "2019-present, VoidZero Inc. and Vite contributors"
        }, {
          name: "Fluent UI System Icons", type: "mit", author: "2020 Microsoft Corporation", link: "https://github.com/microsoft/fluentui-system-icons"
        }].map(({ name, author, type, link }) => <><div className="card" style={{ backgroundColor: "var(--tableheader)" }}>
          <h3><a target="_blank" href={link}>{name}</a></h3>
          <p style={{ whiteSpace: "pre-line" }}>
            {Licenses[type as "bsd"](author)}
          </p>
        </div><br></br></>)}
      </Dialog>
    </> : dialog === DialogEnum.PRIVACY ? <>
      <Dialog close={() => showDialog(DialogEnum.NONE)}>
        <h3>Privacy Notice:</h3>
        <p>This website connects to the <a href="https://lrclib.net" target="_blank">LRCLib API</a> to fetch lyrics. We share with them only the information about the audio track, and you're able to choose which fields should be sent. We'll also send this website's name and this website's version. By using this tool, you also agree to their Terms of Service and Privacy Policy.</p><br></br>
        <p>This website also connects to Google Fonts to display the fonts used in this webpage, and to JSDelivr to fetch the "jsmediatags" library. No data is shared with them.</p>
      </Dialog>
    </> : <></>}
  </>
}
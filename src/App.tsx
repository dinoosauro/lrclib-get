import { useRef, useState } from "react";
import { CompletedInfo, DialogEnum, Options } from "./Scripts/Types";
import FileLogic from "./Scripts/FileLogic";
import Dialog from "./Dialog";
import Licenses from "./Scripts/Licenses";
import VanillaHTMLConverter from "./VanillaHTMLConverter";
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
  function getExtensions() {
    return prompt("Convert only the files that ends with:\nYou can divide the extensions with a comma.") || undefined;
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
              arr.push(file);
            } else await getFiles(await handle.getDirectoryHandle(entry.name), `${path}/${entry.name}`);
          }
        }
        await getFiles(directory);
        await FileLogic({ files: arr, updateState, options: options.current, handle: directory, anchorUpdate: updateMainLinks, extensions: getExtensions() });
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
        await FileLogic({ files: input.files, updateState, options: options.current, anchorUpdate: updateMainLinks, extensions: directory ? getExtensions() : undefined });
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
    maxWait: 400
  });
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
          <h3>Advanced:</h3>
          <label className="flex hcenter margin marginInner">
            <input type="checkbox" defaultChecked={options.current.useFileName} onChange={(e) => updateRef("useFileName", e.target.checked)}></input><span>Use the file name</span> <select onChange={(e) => {
              updateRef("forceFileName", e.target.value === "always");
            }}>
              <option value={"metadata"}>if metadata can't be fetched</option>
              <option value={"always"}>always</option>
            </select>
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
          <label className="flex hcenter margin marginInner">
            <span>Wait a random number between </span> <input type="number" defaultValue={options.current.minWait} min={0} onChange={(e) => updateRef("minWait", +e.target.value)}></input> <span>and</span> <input type="number" defaultValue={options.current.maxWait} min={0} onChange={(e) => updateRef("maxWait", +e.target.value)}></input> <span> milliseconds before fetching the next lyrics file</span>
          </label>
        </div>
      </div>
    </div><br></br>
    <div className="card">
      <h2>Converted files:</h2>
      <p>A zip file with all the files will be downloaded at the end. You can click on a track name to download the zip file with only that track data.</p>
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
    </div><br></br>
    <div className="card anchorBlock">
      <h2>Redownload zip files</h2>
      <p>Some browsers might block the download of files. If this happens for a single track, click again on the link and it should work. If this happens for the entire conversion, you can find here below the links</p>
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
          name: `JSZip`, type: "mit", link: `https://github.com/Stuk/jszip`, author: `2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso`
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
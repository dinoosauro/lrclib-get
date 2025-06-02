/**
 * Converts an array of FileSystemEntries to a File Array, by fetching files in all the subdirectories.
 * This is currently used only when dropping files.
 * @param items the array of File System Entries to consider
 * @returns A File array, with all the files in the File System Entry
 */
export default async function GetDroppedFiles(items: FileSystemEntry[]) {
    const outputArr: File[] = [];
    /**
     * Add a file or a directory in the output array
     * @param path the folder structure where the current entry is located
     * @param item the FileSystemEntry
     */
    async function addFile(path = "", item: FileSystemEntry) {
        if (item.isFile) {
            await new Promise<void>((res) => {
                (item as FileSystemFileEntry).file((file) => {
                    file._path = `${path}${path !== "" ? "/" : ""}${file.name}`; // Update file path with the diirectory
                    outputArr.push(file);
                    res();
                }, (err) => {
                    console.error(err);
                    res();
                });
            })
        } else if (item.isDirectory) {
            await new Promise<void>((res) => {
                (item as FileSystemDirectoryEntry).createReader().readEntries(async (entries) => {
                    for (const entry of entries) await addFile(`${path}${path !== "" ? "/" : "TempFolder/"}${item.name}`, entry); // The script automatically deletes the first folder, so we need to put a random folder name first.
                    res();
                }, (err) => {
                    console.error(err);
                    res();
                });
            })
        }
    }
    for (const item of items) item && await addFile(undefined, item);
    return outputArr;
}
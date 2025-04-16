/**
 * Get the relative of the file, without its extension. If not available, the file name is used.
 * @param file the File object
 * @returns the path of the file
 */
export default function HandleRelativePath(file: File) {
    if ((file._path || "") === "") return file.name.substring(0, file.name.lastIndexOf("."));
    let path = file._path.substring(0, file._path.lastIndexOf("."));
    return path.substring(path.indexOf("/") + 1);
}
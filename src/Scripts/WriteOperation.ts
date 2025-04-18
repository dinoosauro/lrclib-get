import { TextReader, ZipWriter } from "@zip.js/zip.js";

/**
 * Write a file using the provided handle or zip file
 * @param handle the FileSystemDirectoryHandle or ZipWriter object used for this operation
 * @param path the path where the file should be written
 * @param content the content of the file
 */
export default async function WriteOperation(handle: ZipWriter<Blob> | FileSystemDirectoryHandle, path: string, content: any) {
    if (!content) return;
    if (handle instanceof FileSystemDirectoryHandle) {
        const split = path.split("/");
        const name = split.pop() ?? `${Math.random()}`;
        for (const subpath of split) handle = await (handle as FileSystemDirectoryHandle).getDirectoryHandle(subpath, { create: true });
        const file = await handle.getFileHandle(name, { create: true });
        const writable = await file.createWritable();
        await writable.write(content);
        await writable.close();
        return;
    }
    await handle.add(path, new TextReader(content))
}
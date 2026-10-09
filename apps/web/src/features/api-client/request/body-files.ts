/** Access to the tab's picked files, for the body panes that pick them. */
export interface BodyFilesProps {
	files: ReadonlyMap<string, File>;
	/** Keeps (or with `null` forgets) the bytes behind a `FileRef.fileId`. */
	setFile: (fileId: string, file: File | null) => void;
}

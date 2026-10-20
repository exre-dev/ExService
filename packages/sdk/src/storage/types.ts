export type Medium = 'file' | 'cos'
export type UploadData = Blob | Uint8Array

export interface UploadOptions {
  medium?: Medium
  contentType?: string
}

export interface Storage {
  upload(key: string, data: UploadData, options?: UploadOptions): Promise<string>
}

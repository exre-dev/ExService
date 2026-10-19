import {
  prepareStorageUpload,
  uploadStorageContent,
  completeStorageUpload,
  getStoredFile,
} from './handlers.js'

export const operations = {
  prepareStorageUpload,
  uploadStorageContent,
  completeStorageUpload,
  getStoredFile,
} as const

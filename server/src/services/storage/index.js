import { LocalStorageProvider } from "./local.storage.js";

// Currently uses LocalStorageProvider; can easily switch to CloudinaryStorageProvider or S3StorageProvider via env
const storageProvider = new LocalStorageProvider();

export const uploadMediaFiles = async (files = []) => {
  if (!files || files.length === 0) return [];
  const uploadPromises = files.map((file) => storageProvider.save(file));
  return Promise.all(uploadPromises);
};

export const deleteMediaFile = async (filename) => {
  return storageProvider.delete(filename);
};

export { storageProvider };

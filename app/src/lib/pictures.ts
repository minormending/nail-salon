import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { useStore } from '../state/store';

const FOLDER = 'pictures';

function picturesDir(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Finds a saved picture even if the app's document folder moved (iOS can change its path). */
function findPicture(uri: string): File | null {
  try {
    const file = new File(uri);
    if (file.exists) return file;
    const name = uri.split('/').pop();
    if (name) {
      const moved = new File(Paths.document, FOLDER, name);
      if (moved.exists) return moved;
    }
  } catch {
    // fall through
  }
  return null;
}

/** Removes a saved picture file. Never throws; a missing file is fine. */
export function deletePicture(uri: string | undefined): void {
  if (!uri || uri.startsWith('data:')) return;
  try {
    findPicture(uri)?.delete();
  } catch {
    // already gone
  }
}

/**
 * Captures the framed picture view as a PNG into the app's document folder
 * (`pictures/<itemId>-<timestamp>.png`), replaces the item's previous picture, and records
 * its uri on the item. Returns the new uri.
 */
export async function savePicture(viewRef: Parameters<typeof captureRef>[0], itemId: string): Promise<string> {
  const tmpUri = await captureRef(viewRef, { format: 'png', quality: 1, result: 'tmpfile' });
  const store = useStore.getState();
  const previous = store.items.find((it) => it.id === itemId)?.pictureUri;

  let uri = tmpUri;
  if (Platform.OS !== 'web') {
    const dest = new File(picturesDir(), `${itemId}-${Date.now()}.png`);
    await new File(tmpUri).move(dest, { overwrite: true });
    uri = dest.uri;
  }
  deletePicture(previous);
  useStore.getState().updateItem(itemId, { pictureUri: uri });
  return uri;
}

/**
 * Opens the system share sheet for the item's saved picture (this is where a grown-up
 * can save to Photos). Returns false if there is no saved picture yet.
 */
export async function shareItem(itemId: string): Promise<boolean> {
  const uri = useStore.getState().items.find((it) => it.id === itemId)?.pictureUri;
  if (!uri) return false;
  const file = uri.startsWith('data:') ? null : findPicture(uri);
  if (!uri.startsWith('data:') && !file) return false;
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file ? file.uri : uri, { mimeType: 'image/png' });
    return true;
  } catch {
    return false;
  }
}

let opening;
function db() {
  opening ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('birdecho', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('discoveries', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(new Error('Your browser could not open the discovery journal. Check your storage settings.')); };
  });
  return opening;
}
async function transaction(mode, callback) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('discoveries', mode); const request = callback(tx.objectStore('discoveries'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(new Error('Could not save your journal. Your browser storage may be full.'));
    tx.onabort = () => reject(new Error('Journal storage was interrupted. Please try again.'));
  });
}
export const getDiscoveries = () => transaction('readonly', store => store.getAll());
export const saveDiscovery = discovery => transaction('readwrite', store => store.put(discovery));
export const removeDiscovery = id => transaction('readwrite', store => store.delete(id));

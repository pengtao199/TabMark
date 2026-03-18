export function getFixedShortcuts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('fixedShortcuts', (result) => {
      resolve(result.fixedShortcuts || []);
    });
  });
}

export function getBlacklist() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('blacklist', (result) => {
      resolve(result.blacklist || []);
    });
  });
}

export function addToBlacklist(domain) {
  return new Promise((resolve) => {
    chrome.storage.sync.get('blacklist', (result) => {
      let blacklist = result.blacklist || [];
      if (!blacklist.includes(domain)) {
        blacklist.push(domain);
        chrome.storage.sync.set({ blacklist }, () => {
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
}

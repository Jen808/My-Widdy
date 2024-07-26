const { contextBridge, ipcRenderer } = require('electron');
const { shell } = require('electron');


(async () => {
  const Store = (await import('electron-store')).default;
  const store = new Store();

  contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
    store: {
      get: (key, defaultValue) => store.get(key, defaultValue),
      set: (key, value) => store.set(key, value)
    }
  });
})();


window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (event) => {
    if (event.target.tagName === 'A' && event.target.href.startsWith('http')) {
      event.preventDefault(); // 기본 링크 동작 막기
      shell.openExternal(event.target.href); // 기본 브라우저에서 링크 열기
    }
  });
});

window.addEventListener('DOMContentLoaded', () => {
  // Preload script to make necessary modules available in the renderer process
});
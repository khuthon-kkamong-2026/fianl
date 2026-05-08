const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('slowbro', {
  version: '1.0.0'
});

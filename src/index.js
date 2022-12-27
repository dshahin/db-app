const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('config.db');
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}



const createWindow = () => {
  
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  let config = {};
  const win = BrowserWindow.fromWebContents(mainWindow.webContents)
  db.serialize( () => {
    db.run("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY ON CONFLICT REPLACE, value TEXT)");
    
    db.each("SELECT key, value FROM config", (err, row) => {
      console.log({row})
        config[row.key] = row.value;
        if(row.key === 'title'){
          win.setTitle(config.title)
        }
    });

  });

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  

  
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', ()=>{
  ipcMain.on('set-title', handleSetTitle);
  ipcMain.on('set-csv', handleSetCSV);
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
function handleSetTitle (event, title) {
  const webContents = event.sender
  const win = BrowserWindow.fromWebContents(webContents)
  db.serialize(() => {
      
      const stmt = db.prepare("INSERT OR REPLACE INTO config VALUES ('title',?)");
      stmt.run(title);
      stmt.finalize();
  });
  win.setTitle(title)
}


function handleSetCSV (event, text) {
  const webContents = event.sender
  const csvText = text;
  const lines = csvText.split(/\n/);
  console.log(lines[0]);
  console.log(`${lines.length} lines`);
  createTable(lines)
}

function createTable(lines){
  let headers = lines.shift();
  headers = headers.replaceAll(/\(|\)|\%|\?|\#/g, '');
  headers = headers.replaceAll(' ', '_');
  var query = `CREATE TABLE INPUT_CSV ( ${headers} );`
  console.log(query)
  db.serialize( () => {
    db.run('DROP TABLE IF EXISTS INPUT_CSV');
    db.run(query);
     
    for(let line of lines){
      if(line.length){
        let insert_stmt = `INSERT INTO INPUT_CSV VALUES(${line})`;
        console.log(insert_stmt)
        db.run(insert_stmt);
      }
    }
  });

}

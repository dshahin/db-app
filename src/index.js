const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('config.db');
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const config = {
  client: {
    id: '3MVG957CwCMEFdzdnrnTdHZZrsJ4hNVm4.WkDZVGW4LSTwE0w91RXPWmlkvwMgCbqtvbdNZDIU7mO8VAdhblx',
    secret: '08979DB39440B8365DE5380A1E8B86116E5070D03349AB69F0AF41DD3AB6AD19'
  },
  auth: {
    tokenHost: 'https://test.salesforce.com',
    authorizePath: '/services/oauth2/authorize',
    tokenPath: '/services/oauth2/token'
  }
};

const { ClientCredentials, ResourceOwnerPassword, AuthorizationCode } = require('simple-oauth2');
const client = new AuthorizationCode(config);

const authorizationUri = client.authorizeURL({
  redirect_uri: 'electron://oauth-callback',
  scope: 'full refresh_token offline_access'
});

const createWindow = () => {
  
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

     // Open the DevTools.
     mainWindow.webContents.openDevTools();


     

  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log({url})
    const code = /\?code=(.+)$/.exec(url);
    if (code) {
      console.log({code})
      event.preventDefault();
      let decoded = decodeURIComponent(code[1])
      requestToken(decoded, mainWindow);
    }else{
      console.log('no code')
    }
  });

  mainWindow.webContents.on('did-navigate', (event, url) => {
    // mainWindow.webContents.executeJavaScript(`
    //   alert('foo')
    // `);
    console.log(url)
  });

  

  // and load the index.html of the app.
  // mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  let config = {};
  const win = BrowserWindow.fromWebContents(mainWindow.webContents)
  db.serialize( () => {
    db.run("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY ON CONFLICT REPLACE, value TEXT)");
    
    db.each("SELECT key, value FROM config", async (err, row) => {
      console.log({row})
        config[row.key] = row.value;
        if(row.key === 'title'){
          win.setTitle(config.title)
        }
        let accessToken = {};
        if(row.key === 'access_token'){
          accessToken = client.createToken(JSON.parse(row.value));
          if(accessToken.expired()){
            try {
              console.error('expired token');
              const refreshParams = {
                scope: 'full',
              };
        
              accessToken = await accessToken.refresh(refreshParams);
              setConfig('access_token', JSON.stringify(accessToken))
              
            } catch (error) {
              console.log('Error refreshing access token: ', error.message);
            }
          }
          console.log('hey',accessToken);
          mainWindow.loadFile(path.join(__dirname, 'index.html'));
        }else{
          mainWindow.loadURL(authorizationUri);
        }
    });
    //no db? load the oauth page
    mainWindow.loadURL(authorizationUri);
  });

  
  
  

  
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
  setConfig('title',title);
  win.setTitle(title)
}

function requestToken(code, mainWindow) {
  const tokenConfig = {
    code: code,
    redirect_uri: 'electron://oauth-callback'
  };

  client.getToken(tokenConfig)
    .then((AccessToken) => {
      console.log({AccessToken})
      // You can now use the access token to make API requests
      setConfig('access_token', JSON.stringify(AccessToken))
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    })
    .catch((error) => {
      console.log('Access Token Error', error.message);
    });
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

function setConfig(key,value){
  db.serialize(() => {
    const stmt = db.prepare("INSERT OR REPLACE INTO config VALUES (?,?)");
    stmt.run(key,value);
    stmt.finalize();
  });
}

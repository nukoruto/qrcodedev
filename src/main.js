const { app, BrowserWindow } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const QRCode = require('qrcode');
const sharp = require('sharp');
const { ipcMain } = require('electron');
const electron = require('electron');

const os = require('os');
const hostname = os.hostname();
const username = os.userInfo().username;

// ディレクトリパスの設定
const baseDirectory = `\\\\${hostname}\\Users\\${username}\\Desktop\\data\\data`;
const qrcodePath = path.join(baseDirectory, '..', 'qrcode');

// メインウィンドウの作成
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadFile('index.html');
  return mainWindow;
}

// ディレクトリの作成（存在しない場合）
async function ensureDirectories() {
  await fs.ensureDir(baseDirectory);
  await fs.ensureDir(qrcodePath);
}

// QRコード生成とフォルダ名の追加
async function createQRCodeForFolders() {
  try {
    const folders = await fs.readdir(baseDirectory, { withFileTypes: true });
    const totalFolders = folders.filter(folder => folder.isDirectory() && folder.name !== 'qrcode').length;

    // 合計フォルダ数を送信
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow.webContents.send('qr-total-files', totalFolders);

    // TTFフォントのパスとBase64エンコード
    const fontPath = path.join(__dirname, 'NotoSansJP-VariableFont_wght.ttf');
    const fontBase64 = fs.readFileSync(fontPath).toString('base64');

    let processedFolders = 0;

    for (const folder of folders) {
      if (folder.isDirectory() && folder.name !== 'qrcode') {
        const folderPath = path.join(baseDirectory, folder.name);
        const qrFilePath = path.join(qrcodePath, `${folder.name}.png`);
    
        // 親ディレクトリを除外し、folder.name のみを取得
        const qrData = path.relative(baseDirectory, folderPath).replace(/\\/g, '/');
    
        // 処理開始メッセージを送信
        mainWindow.webContents.send('qr-generation-progress', { file: folder.name, status: 'processing' });
    
        try {
          const qrBuffer = await QRCode.toBuffer(qrData, { type: 'png', width: 400 });
          const textSvg = `
            <svg width="400" height="50" xmlns="http://www.w3.org/2000/svg">
              <style>
                @font-face {
                  font-family: "CustomFont";
                  src: url("data:font/ttf;base64,${fontBase64}") format("truetype");
                }
                .custom-text {
                  font-family: "CustomFont";
                  font-size: 20px;
                  fill: black;
                }
              </style>
              <text x="200" y="35" text-anchor="middle" class="custom-text">${folder.name}</text>
            </svg>
          `;
          const textBuffer = Buffer.from(textSvg);
    
          await sharp({
            create: {
              width: 400,
              height: 450,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
          })
            .composite([
              { input: qrBuffer, top: 0, left: 0 },
              { input: textBuffer, top: 400, left: 0 },
            ])
            .toFile(qrFilePath);
    
          mainWindow.webContents.send('qr-generation-progress', { file: folder.name, status: 'completed' });
          processedFolders++;
        } catch (err) {
          mainWindow.webContents.send('qr-generation-progress', { file: folder.name, status: 'error' });
        }
      }
    }
    
  } catch (error) {
    console.error('Error generating QR codes:', error);
  }
}


// アプリの初期化処理
app.whenReady().then(async () => {
  try {
    const mainWindow = createWindow();
    await ensureDirectories();
    await createQRCodeForFolders();
  } catch (error) {
    console.error('Initialization error:', error);
  }
});

// アプリ終了時の処理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

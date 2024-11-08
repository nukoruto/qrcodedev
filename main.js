const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const QRCode = require('qrcode');

const os = require('os');
const hostname = os.hostname();
const username = os.userInfo().username;

// ディレクトリパスの設定
const baseDirectory = `\\\\${hostname}\\Users\\${username}\\Desktop\\data`;
const tenkenPath = path.join(baseDirectory, 'tenken');
const manualPath = path.join(baseDirectory, 'manual');
const qrTenkenPath = path.join(baseDirectory, 'qrcode', 'tenken');
const qrManualPath = path.join(baseDirectory, 'qrcode', 'manual');

// メインウィンドウの作成
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('index.html');
  return mainWindow;
}

// ディレクトリの作成（存在しない場合）
async function ensureDirectories() {
  await fs.ensureDir(tenkenPath);
  await fs.ensureDir(manualPath);
  await fs.ensureDir(qrTenkenPath);
  await fs.ensureDir(qrManualPath);
}

// QRコードの生成と進行状況の送信
async function createQRCodeForFiles(mainWindow) {
  const createQRCode = async (srcPath, destPath) => {
    const files = await fs.readdir(srcPath);
    for (const file of files) {
      if (file.endsWith('.xlsx')) {  // Excelファイルのみに限定
        const filePath = path.join(srcPath, file);
        const qrFilePath = path.join(destPath, `${path.parse(file).name}.png`);
        const qrData = `file://${filePath}`;

        // 変換開始を通知
        mainWindow.webContents.send('qr-generation-progress', { file, status: 'processing' });

        // QRコードの生成と保存
        await QRCode.toFile(qrFilePath, qrData, { type: 'png' });
        
        // 変換完了を通知
        mainWindow.webContents.send('qr-generation-progress', { file, status: 'completed' });
      }
    }
  };

  // tenkenフォルダとmanualフォルダのファイルに対して処理
  await createQRCode(tenkenPath, qrTenkenPath);
  await createQRCode(manualPath, qrManualPath);
}

// アプリの初期化処理
app.whenReady().then(async () => {
  const mainWindow = createWindow();
  await ensureDirectories();
  await createQRCodeForFiles(mainWindow);
});

// アプリ終了時の処理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

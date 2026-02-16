const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

// පරණ Tun Address Error එක Fix කරන්න බලෙන්ම Environment Variable එක සෙට් කරනවා
process.env.ENABLE_DEPRECATED_TUN_ADDRESS_X = 'true';

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
let sbProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;

function getIconPath() {
  let iconPath;
  if (app.isPackaged) {
    iconPath = path.join(process.resourcesPath, 'public', 'icon.png');
    if (!fs.existsSync(iconPath)) { iconPath = path.join(__dirname, '../../public/icon.png'); }
  } else { iconPath = path.join(process.cwd(), 'public', 'icon.png'); }
  return iconPath;
}

// --- Sing-box Config (Stability Optimized) ---
function generateSingboxConfig(vlessLink) {
  try {
    if (!vlessLink || typeof vlessLink !== 'string') return false;
    const url = new URL(vlessLink.trim());
    const params = new URLSearchParams(url.search);
    const serverHost = url.hostname;
    const serverPort = parseInt(url.port);
    const sni = params.get("sni") || serverHost;
    const fp = params.get("fp") || "chrome";
    const pathVal = params.get("path") || "/";
    const host = params.get("host") || "";

    const config = {
      "log": { "level": "fatal", "timestamp": true },
      "dns": {
        "servers": [
          { "tag": "cloudflare", "address": "1.1.1.1", "detour": "proxy" },
          { "tag": "local", "address": "local", "detour": "direct" }
        ],
        "rules": [ { "domain": [serverHost], "server": "local" } ],
        "final": "cloudflare",
        "strategy": "ipv4_only"
      },
      "inbounds": [{
        "type": "tun", 
        "tag": "tun-in", 
        "interface_name": "tun0", 
        "inet4_address": "172.19.0.1/30", 
        "auto_route": true, 
        "strict_route": false, // ✅ Safe Mode: "පරණ ලෙඩේ" නොවෙන්න මේක false කළා
        "stack": "system", 
        "mtu": 1280, 
        "sniff": true
      }],
      "outbounds": [
        {
          "type": "vless", "tag": "proxy", "server": serverHost, "server_port": serverPort, "uuid": url.username, "packet_encoding": "xudp",
          "tls": { "enabled": true, "server_name": sni, "insecure": true, "utls": { "enabled": true, "fingerprint": fp } },
          "transport": params.get("type") === "ws" ? { "type": "ws", "path": pathVal, "headers": { "Host": host } } : undefined
        },
        { "type": "direct", "tag": "direct" }
      ],
      "route": { "auto_detect_interface": true, "final": "proxy" }
    };
    fs.writeFileSync(path.join(process.cwd(), 'config.json'), JSON.stringify(config, null, 2));
    return true;
  } catch (e) { return false; }
}

function cleanUpProcesses(callback) {
  exec('taskkill /F /IM sing-box.exe', () => {
    exec('powershell -Command "Get-NetIPInterface -AddressFamily IPv4 | Set-NetIPInterface -InterfaceMetric 0"');
    setTimeout(() => { if (callback) callback(); }, 2500); 
  });
}

function createTray() {
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('TEAM ROA NET');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; cleanUpProcesses(() => app.quit()); } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show(); });
}

function createWindow() {
  const iconPath = getIconPath();
  mainWindow = new BrowserWindow({
    width: 420, height: 750, frame: false, resizable: false, transparent: true, backgroundColor: '#00000000',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    icon: iconPath
  });
  if (VITE_DEV_SERVER_URL) mainWindow.loadURL(VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  mainWindow.on('close', (event) => { if (!isQuitting) { event.preventDefault(); mainWindow.hide(); return false; } });
  if (!VITE_DEV_SERVER_URL) autoUpdater.checkForUpdatesAndNotify();
}

ipcMain.on('start-tunnel', (event, data) => {
  let vlessLink = typeof data === 'string' ? data : data.link;
  if (!generateSingboxConfig(vlessLink)) { event.reply('xray-log', "Error: Invalid Link!"); return; }

  cleanUpProcesses(() => {
    const sbPath = path.join(process.cwd(), 'resources', 'sing-box.exe');
    event.reply('xray-log', "Starting Tunnel...");
    sbProcess = spawn(sbPath, ['run', '-c', 'config.json']);

    sbProcess.stderr.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes("Access is denied")) event.reply('xray-log', "❌ ERROR: Run as Administrator!");
      else if (msg.includes("FATAL") || msg.includes("ERROR")) event.reply('xray-log', `LOG: ${msg}`);
    });
    
    // *** 🔒 ULTIMATE ROUTER BLOCK (Metric Force) ***
    setTimeout(() => {
      event.reply('xray-log', "⚡ Optimizing Route Priority...");
      // Metric 1 (High) for VPN, Metric 6000 (Low) for Router
      exec('powershell -Command "Set-NetIPInterface -InterfaceAlias \'tun0\' -InterfaceMetric 1"');
      exec('powershell -Command "Get-NetIPInterface -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -ne \'tun0\'} | Set-NetIPInterface -InterfaceMetric 6000"');
      exec('ipconfig /flushdns');
      event.reply('xray-log', "✅ TUNNEL ACTIVE & SECURED");
    }, 5000); 
  });
});

ipcMain.on('stop-tunnel', (event) => { cleanUpProcesses(() => { sbProcess = null; event.reply('xray-log', "Disconnected."); }); });
ipcMain.on('close-app', () => { if (mainWindow) mainWindow.hide(); });
ipcMain.on('minimize-app', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('toggle-startup', (event, enable) => { app.setLoginItemSettings({ openAtLogin: enable, path: app.getPath('exe') }); });

app.whenReady().then(() => { createWindow(); createTray(); });
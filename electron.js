const path = require("path")

const { app, BrowserWindow, Menu, nativeImage, Tray } = require("electron")
const isDev = require("electron-is-dev")

let tray = null
function createTray () {
	const icon = path.join(__dirname, './public/logo512.png')
	const trayicon = nativeImage.createFromPath(icon)
	tray = new Tray(trayicon.resize({ width: 16 }))
	const contextMenu = Menu.buildFromTemplate([{
		label: 'Show App',
		click: () => {
			createWindow()
		}
	}, {
		label: 'Quit',
		click: () => {
			app.quit()
		}
	}])

	tray.setContextMenu(contextMenu)
}

function createWindow() {
	// Create the tray
	if (!tray) {
		createTray()
	}

	// Show the dock icon since there's now a window.
	if (process.platform === 'darwin') {
		app.dock.show()
	}

	// Create the browser window.
	const win = new BrowserWindow({
		width: 1350,
		height: 800,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true,
		}
	})
	
	// and load the index.html of the app.
	// win.loadFile("index.html");
	win.loadURL(
		isDev
			? "http://localhost:3000"
			: `file://${path.join(__dirname, "../build/index.html")}`
	)
		
	// Open the DevTools.
	if (isDev) {
		win.webContents.openDevTools({ mode: "detach" });
	}
}
	
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);


app.on("window-all-closed", () => {
	if (process.platform === 'darwin') {
		app.dock.hide()
	}
});

// app.on("activate", () => {
// 	// On macOS it's common to re-create a window in the app when the
// 	// dock icon is clicked and there are no other windows open.
// 	if (BrowserWindow.getAllWindows().length === 0) {
// 		createWindow();
// 	}
// });

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

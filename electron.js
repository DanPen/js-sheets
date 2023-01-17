const path = require("path")

const { app, BrowserWindow, Menu, nativeImage, Tray, ipcMain, ipcRenderer, dialog } = require("electron")
const isDev = require("electron-is-dev")

const isMac = process.platform === 'darwin'
const menuTemplate = [
	// { role: 'appMenu' }
	...(isMac ? [{
		label: app.name,
		submenu: [
		{ role: 'about' },
		{ type: 'separator' },
		{ role: 'services' },
		{ type: 'separator' },
		{ role: 'hide' },
		{ role: 'hideOthers' },
		{ role: 'unhide' },
		{ type: 'separator' },
		{ role: 'quit' }
		]
	}] : []),
	// { role: 'fileMenu' }
	{
		label: 'File',
		submenu: [
			{
				label: 'New Database',
				accelerator: 'CmdOrCtrl+N',
				click () {
					createEditorWindow()
				}
			},
			{ type: 'separator' },
			{
				label: 'Open...',
				accelerator: 'CmdOrCtrl+O',
				click () {
					openFile()
				}
			},
			{
				id: 'save',
				label: 'Save...',
				accelerator: 'CmdOrCtrl+S',
				click () {
					saveFile()
				}
			},
			{ type: 'separator' },
			isMac ? { role: 'close' } : { role: 'quit' }
		]
	},
	// { role: 'editMenu' }
	{
		label: 'Edit',
		submenu: [
			{ role: 'undo' },
			{ role: 'redo' },
			{ type: 'separator' },
			{ role: 'cut' },
			{ role: 'copy' },
			{ role: 'paste' },
			...(isMac ? [
				{ role: 'pasteAndMatchStyle' },
				{ role: 'delete' },
				{ role: 'selectAll' },
				{ type: 'separator' },
				{
					label: 'Speech',
					submenu: [
						{ role: 'startSpeaking' },
						{ role: 'stopSpeaking' }
					]
				}
			] : [
				{ role: 'delete' },
				{ type: 'separator' },
				{ role: 'selectAll' }
			])
		]
	},
	// { role: 'viewMenu' }
	{
		label: 'View',
		submenu: [
			{ role: 'reload' },
			{ role: 'forceReload' },
			{ role: 'toggleDevTools' },
			{ type: 'separator' },
			{ role: 'resetZoom' },
			{ role: 'zoomIn' },
			{ role: 'zoomOut' },
			{ type: 'separator' },
			{ role: 'togglefullscreen' }
		]
	},
	// { role: 'windowMenu' }
	{
		label: 'Window',
		submenu: [
			{ role: 'minimize' },
			{ role: 'zoom' },
			...(isMac ? [
				{ type: 'separator' },
				{ role: 'front' },
				{ type: 'separator' },
				{ role: 'window' }
			] : [
				{ role: 'close' }
			])
		]
	}
]

let tray = null
function createTray () {
	const icon = path.join(__dirname, './public/logo512.png')
	const trayicon = nativeImage.createFromPath(icon)
	tray = new Tray(trayicon.resize({ width: 16 }))
	const contextMenu = Menu.buildFromTemplate([{
		label: 'Show App',
		click: () => {
			createEditorWindow()
		}
	}, {
		label: 'Quit',
		click: () => {
			app.quit()
		}
	}])

	tray.setContextMenu(contextMenu)
}

function createEditorWindow (file) {
	// Create the tray
	if (!tray) {
		createTray()
	}

	// Show the dock icon since there's now a window.
	if (process.platform === 'darwin') {
		app.dock.show()
	}

	const menu = Menu.buildFromTemplate(menuTemplate)
	Menu.setApplicationMenu(menu)

	let x, y
	const currentWindow = BrowserWindow.getFocusedWindow()
	if (currentWindow) {
		const [ currentWindowX, currentWindowY ] = currentWindow.getPosition();
		x = currentWindowX + 8
		y = currentWindowY + 28
	}

	// Create the browser window.
	const win = new BrowserWindow({
		x,
		y,
		width: 1350,
		height: 800,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true,
		},
		title: 'loading...'
	})

	if (file) {
		win.webContents.on('did-finish-load', () => {
			win.setTitle(path.basename(file))
			win.setRepresentedFilename(file)
		})

		ipcMain.on('store-ready', (event) => {
			event.reply('open-file', file)
		})
	}

	else {
		win.webContents.on('did-finish-load', () => {
			win.setTitle('untitled')
		})
	}

	// Handle saving of files
	ipcMain.on('save-file', (event, _path) => {
		
	})

	win.on('close', () => {
		Menu.getApplicationMenu().getMenuItemById('save').enabled = false
	})

	win.on('blur', () => {
		Menu.getApplicationMenu().getMenuItemById('save').enabled = false
	})

	win.on('focus', () => {
		Menu.getApplicationMenu().getMenuItemById('save').enabled = true
	})


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
app.whenReady().then(createEditorWindow);


app.on("window-all-closed", () => {
	if (process.platform === 'darwin') {
		app.dock.hide()
	}
});

// app.on("activate", () => {
// 	// On macOS it's common to re-create a window in the app when the
// 	// dock icon is clicked and there are no other windows open.
// 	if (BrowserWindow.getAllWindows().length === 0) {
// 		createEditorWindow();
// 	}
// });

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


async function openFile () {
	const { filePaths } = await dialog.showOpenDialog({
		properties: ['openFile'],
		defaultPath: app.getPath('documents'),
		filters: [{ name: 'JSXL', extensions: ['jsxl'] }]
	})

	if (filePaths.length === 0) {
		return
	}

	const file = filePaths[0]

	createEditorWindow(file)
}

function saveFile () {
	const currentWindow = BrowserWindow.getFocusedWindow()
	if (!currentWindow) {
		return
	}

	const file = dialog.showSaveDialog(currentWindow, {
		title: 'Save your database',
		defaultPath: app.getPath('documents'),
		filters: [
			{ name: 'JSXL Files', extensions: ['jsxl'] }
		]
	})

	if (file) {
		console.log(file)
	}
}
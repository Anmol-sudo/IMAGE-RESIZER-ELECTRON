const path = require("path");
const os = require("os");
const fs = require("fs");
// const resizeImg = require("resize-img");
const sharp = require("sharp");
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");

const isDev = process.env.NODE_ENV !== "development";
const isMac = process.platform === "darwin";

let mainWindow;

// Create the main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: "Image Resizer",
    width: isDev ? 1000 : 500,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Open devtools if in dev env
  // if (isDev) {
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.loadFile(path.join(__dirname, "./renderer/index.html"));
}

// Create about window
function createAboutWindow() {
  const aboutWindow = new BrowserWindow({
    title: "About Image Resizer",
    width: 300,
    height: 300,
  });

  aboutWindow.loadFile(path.join(__dirname, "./renderer/about.html"));
}

// App is ready
app.whenReady().then(() => {
  createMainWindow();

  // Implement menu
  const mainMenu = Menu.buildFromTemplate(menu);
  Menu.setApplicationMenu(mainMenu);

  // remove mainWindow from memory on close
  mainWindow.on('closed', () => (mainWindow = null));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Menu template
const menu = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []),
  {
    role: "fileMenu",
  },
  ...(!isMac
    ? [
        {
          label: "Help",
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []),
];

// Respond to ipcRenderer resize
ipcMain.on("image:resize", (e, options) => {
  options.dest = path.join(os.homedir(), "Image Resizer");
  resizeImage(options);
});

ipcMain.handle("get-file-path", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["jpg", "png", "jpeg", "gif"] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});


async function resizeImage({ imgPath, width, height, dest }) {
  try {
    console.log("Dest: ", dest);
    
    // Read image buffer
    const buffer = fs.readFileSync(imgPath);

    const resizedBuffer = await sharp(buffer)
      .resize(+width, +height, {
        fit: "cover", 
        position: "centre",
      })
      .toBuffer();

    // Create filename
    const filename = path.basename(imgPath);

    // Ensure destination folder exists
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Write resized image to destination
    const outputPath = path.join(dest, filename);
    fs.writeFileSync(outputPath, resizedBuffer);

    console.log(outputPath);

    // Notify renderer that the image is done
    mainWindow.webContents.send("image:done");

    // Open destination folder
    shell.openPath(dest);
  } catch (error) {
    console.error("Error resizing image:", error);
  }
}


app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});

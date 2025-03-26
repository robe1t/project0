const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

// 获取用户数据目录下的 data 文件夹路径
const dataPath = path.join(app.getPath('userData'), 'data')
const todosPath = path.join(dataPath, 'todos.json')

console.log('数据目录路径:', dataPath)
console.log('待办事项文件路径:', todosPath)

// 确保数据目录存在
function ensureDataDirectory() {
  try {
    console.log('检查数据目录是否存在...')
    if (!fs.existsSync(dataPath)) {
      console.log('数据目录不存在，正在创建...')
      fs.mkdirSync(dataPath, { recursive: true })
      console.log('数据目录创建成功:', dataPath)
    } else {
      console.log('数据目录已存在:', dataPath)
    }
    
    // 检查目录是否可写
    console.log('检查目录权限...')
    const testFile = path.join(dataPath, 'test.txt')
    fs.writeFileSync(testFile, 'test')
    fs.unlinkSync(testFile)
    console.log('数据目录权限正常')
    
    // 检查todos.json是否存在
    if (!fs.existsSync(todosPath)) {
      console.log('todos.json不存在，创建空文件...')
      fs.writeFileSync(todosPath, '[]')
      console.log('todos.json创建成功')
    } else {
      console.log('todos.json已存在')
    }
    
    return true
  } catch (error) {
    console.error('创建或检查数据目录失败:', error)
    return false
  }
}

// 读取待办事项
function readTodos() {
  try {
    console.log('尝试读取待办事项...')
    if (fs.existsSync(todosPath)) {
      const data = fs.readFileSync(todosPath, 'utf8')
      console.log('读取到的原始数据:', data)
      const todos = JSON.parse(data)
      console.log('成功读取待办事项:', todos)
      // 确保日期格式正确
      return todos.map(todo => ({
        ...todo,
        createdAt: new Date(todo.createdAt),
        updatedAt: new Date(todo.updatedAt)
      }))
    }
    console.log('待办事项文件不存在，返回空数组')
    return []
  } catch (error) {
    console.error('读取待办事项失败:', error)
    return []
  }
}

// 保存待办事项
function saveTodos(todos) {
  try {
    console.log('准备保存待办事项...')
    // 确保数据是可序列化的
    const serializableTodos = todos.map(todo => ({
      ...todo,
      createdAt: todo.createdAt ? new Date(todo.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: todo.updatedAt ? new Date(todo.updatedAt).toISOString() : new Date().toISOString()
    }))
    
    // 使用同步写入确保数据被保存
    const jsonData = JSON.stringify(serializableTodos, null, 2)
    console.log('准备写入的数据:', jsonData)
    fs.writeFileSync(todosPath, jsonData)
    console.log('待办事项已保存到:', todosPath)
    return { success: true }
  } catch (error) {
    console.error('保存待办事项失败:', error)
    return { success: false, error: error.message }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    }
  })

  // 根据环境加载不同的URL
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 添加调试信息
  win.webContents.on('did-finish-load', () => {
    console.log('窗口加载完成')
    // 注入 ipcRenderer
    win.webContents.executeJavaScript(`
      window.ipcRenderer = require('electron').ipcRenderer;
    `)
  })

  win.webContents.on('ipc-message', (event, channel) => {
    console.log('收到 IPC 消息:', channel)
  })
}

// 注册 IPC 处理程序
ipcMain.handle('todos:get', async () => {
  try {
    const todos = readTodos()
    console.log('获取待办事项:', todos)
    return { success: true, data: todos }
  } catch (error) {
    console.error('获取待办事项失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('todos:save', async (event, todos) => {
  try {
    console.log('准备保存待办事项:', todos)
    const result = saveTodos(todos)
    console.log('保存结果:', result)
    return result
  } catch (error) {
    console.error('保存待办事项失败:', error)
    return { success: false, error: error.message }
  }
})

// 在应用退出时保存数据
app.on('before-quit', async () => {
  console.log('应用即将退出')
  // 确保所有窗口都已关闭
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.close()
    }
  }
})

app.whenReady().then(() => {
  console.log('应用启动...')
  // 确保数据目录存在
  if (!ensureDataDirectory()) {
    console.error('无法创建或访问数据目录，应用可能无法正常工作')
  }
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
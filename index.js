const express = require('express')
const { InMemorySessionStore } = require('./sessionStore')
const sessionStore = new InMemorySessionStore();
const app = express()
const chatServer = require('http').createServer(app)
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto');
const { maxHeaderSize } = require('http');
const randomId = () => crypto.randomBytes(8).toString("hex");
const io = require('socket.io')(chatServer, {
  cors: {
    origin: "http://localhost:3000  ",
  }
})

io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  console.log('前端紀錄的sessionID', sessionID)
  if (sessionID) {
    const session = sessionStore.findSession(sessionID)
    // 有 session 不必再次進行登入
    if (session) {
      socket.sessionID = sessionID
      socket.userID = session.userID
      socket.username = session.username
      return next()
    }
  }
  // 從前端設定的 username
  const username = socket.handshake.auth.username
  // 前端也有檢查，但後端也有檢查更安全
  if (!username) {
    return next(new Error("invalid username"))
  }
  socket.sessionID = randomId()
  socket.userID = randomId()
  socket.username = username
  next()
})

io.on('connection', (socket) => {
  console.log('sessionid', socket.sessionID)
  // 改為儲存一個我們自己設定 session，原先是使用 socket.io 給的 id，但重新整理頁面就會再生成一個新的(這樣每次都得登入)
  sessionStore.saveSession(socket.sessionID, {
    userID: socket.userID,
    username: socket.username,
    connected: true
  })
  
  socket.emit("session", {
    sessionID: socket.sessionID,
    userID: socket.userID,
  })

  socket.join(socket.userID)

  const users = [];
  sessionStore.findAllSessions().forEach((session) => {
    users.push({
      userID: session.userID,
      username: session.username,
      connected: session.connected,
    })
  })
  socket.emit("users", users)

  // 通知已經在線上的人，有新的使用者上線
  socket.broadcast.emit("user connected", {
    userID: socket.userID,
    username: socket.username,
    connected: true
  });

  // 因為現在 join 都不是使用 socket 給的id，所以
  socket.on('private message', ({to, content}) => {
    socket.to(to).to(socket.userID).emit("private message", {
      content,
      from: socket.userID,
      to,
    });
  })


  socket.on("disconnect", async () => {
    // 需要確認我們自己創的 userID 是不是不存在 io 中
    const matchingSockets = await io.in(socket.userID).allSockets()
    const isDisconnected = matchingSockets.size === 0
    if (isDisconnected) {
      socket.broadcast.emit("user disconnect", socket.userID)

      sessionStore.saveSession(socket.sessionID, {
        userID: socket.userID,
        username: socket.username,
        connected: false
      })
    }
  });
});

app.listen(4000)
chatServer.listen(4001)

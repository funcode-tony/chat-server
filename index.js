const express = require('express')
const app = express()
const chatServer = require('http').createServer(app)
const { v4: uuidv4 } = require('uuid')
const io = require('socket.io')(chatServer, {
  cors: {
    origin: "http://localhost:3000  ",
  }
})

io.use((socket, next) => {
  // 從前端設定的 username
  const username = socket.handshake.auth.username
  // 前端也有檢查，但後端也有檢查更安全
  if (!username) {
    return next(new Error("invalid username"))
  }
  socket.username = username
  next()
})

io.on('connection', (socket) => {
  const users = [];

  for (let [id, socket] of io.of("/").sockets) {
    users.push({
      userID: id,
      username: socket.username
    })
  }

  socket.emit("users", users)

  socket.broadcast.emit("user connected", {
    userID: socket.id,
    username: socket.username,
  });

  socket.on('sendPrivateMessage', ({to, from, content}) => {
    console.log('from',from, 'to----', to);
    socket.to(to).emit("receive-private-message", {
      content,
      from,
      to,
    });
  })

  // socket.on("joinroom", ({ id, name, roomId }) => {
  //   const index = chatRooms.findIndex(room => room.id === roomId)
  //   chatRooms[index].userNumber++;
    
  //   socket.join(roomId)

  //   console.log(roomId);
  //   // socket.emit("joinSuccess", {
  //   //   success: true,
  //   //   message: `您已加入xx室`,
  //   // });
  //   io.to(roomId).emit("joinSuccess", {
  //     message: `${name} 已加入xx室`,
  //   });
   
  // });

  socket.on("disconnect", () => {
    console.log("離線囉");
  });
});

app.listen(4000)
chatServer.listen(4001)

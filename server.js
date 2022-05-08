const Port = process.env.PORT || 500;
const express = require('express');
const app = express();
const http = require('http');
const { resourceUsage } = require('process');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: "*" }
});

app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

let userList = new Map();
let roomData = {};

function getRoom(socket){
  let roomList = [...socket.rooms];
  if (!roomList[1]) {
    io.to(socket.id).emit('error');
    return;
  }
  return roomList[1];
}

function sortObject(o, target, round){
  let a = []
  for (let O in o) {
    a.push({username: O, points: o[O].points, round: o[O].round});
  }
  return a.sort((a,b)=> b.points - a.points); 
}

io.on('connection', socket => {
  console.log(`Client joined with ID: ${socket.id}`);
  console.log(`Currently ${io.engine.clientsCount} clients connected.`);

  deleteUnusedRoomData();

  socket.on('set-username', username => {
    username = username.toUpperCase();
    let listofUsernames = Array.from(io.sockets.sockets).map(socket => socket[1].username);
    if (listofUsernames.includes(username)) {
      io.to(socket.id).emit('valid-username', false)
    } else {
      io.to(socket.id).emit('valid-username', true)
      socket.username = username;
      userList.set(socket.id, username);
      console.log(`Username ${username} applied to ID ${socket.id}`);
    };
  })

  socket.on('join-room', room => {
    if(!roomData[room]) {
      Object.assign(roomData, {
        [room]: {
          running: true,
          users: {}
        }
      })
    };
    room = parseInt(room);
    socket.join(room);
    console.log(`${userList.get(socket.id)} joined ${room}`);
    io.to(socket.id).emit('joined-room', 'yes!');
    let idsInRoom = io.sockets.adapter.rooms.get(room);
    console.log(idsInRoom);
    let userInRoom = [...idsInRoom].map(x => userList.get(x));
    console.log(userInRoom);
    console.log(roomData);
    io.to(room).emit('player-joined', userInRoom);
  })

  socket.on('room-exist', room => {
    let listOfRooms = [ ...io.sockets.adapter.rooms.keys()];
    io.to(socket.id).emit('room-exist-return', listOfRooms.includes(parseInt(room)));
  })

  socket.on('host-start', data => {
    let room = getRoom(socket);
    data.currentRound = 1;
    Object.assign(roomData[room], data);
    console.log(roomData[room]);
    io.to(room).emit('round-start', roomData[room]);
  });

  socket.on('next-round', data => {
    let room = getRoom(socket);
    let targetRoom = roomData[room]
    if (targetRoom.currentRound < targetRoom.numberOfRounds){
      targetRoom.currentRound++;
    }
    console.log(roomData[room]);
    io.to(room).emit('round-start', roomData[room]);
  });

  socket.on('user-round', data => {
    let room = getRoom(socket);
    if (!data.won) {
      data.points = 0;
    } else {
      data.points = 6 - data.turns;
    }

    let targetRoom = roomData[room];
    let userStore = targetRoom.users;
    let username = socket.username;

    if (userStore[username]){
      userStore[username].points = userStore[username].points + data.points;
      userStore[username].round = data.currentRound;
    } else {
      let initData = {
        [username]: {
          points: data.points,
          round: data.currentRound
        }
      }
      Object.assign(userStore, initData);
    }
    let leaderboard = sortObject(userStore);
    console.log(leaderboard);
    io.to(room).emit('leaderboard-update', leaderboard);
  });
});

function deleteUnusedRoomData(){
  let currentRoomData = Object.keys(roomData);
  if (currentRoomData.length === 0) return;
  console.log(currentRoomData);
  let listOfRooms = [ ...io.sockets.adapter.rooms.keys()];
  for (let i = 0; i < currentRoomData.length; i++){
    let targetData = parseInt(currentRoomData[i]);
    if (listOfRooms.includes(targetData)) break; 
    console.log(`Deleting data for room ${targetData}`);
    delete roomData[targetData];
  }
}

server.listen(Port, () => {
  console.log(`listening on ${Port}`);
});

// TO DO:
/* 
  Make host settings apply to the game
  Generating a random film.
  
  Set status of room, so users can't join if mid-game.
    Or don't, maybe see if joining mid-game could work?
*/

const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');
const { Client } = require('pg');
const timestamp = require('time-stamp');
var validator = require('validator');

const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');

const router = require('./router');

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const users = [];
const DATABASE_URL = process.env.DATABASE_URL;
const admins = [];

app.use(cors());
app.use(router);

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect();

client.query(`SELECT * from admin`, (err, res) => {
  if (err) throw err;
  for (let row of res.rows) {
    const temp = { name: row.username, email: row.email };
    admins.push(temp)
  }
  // client.end();
});


io.on('connect', (socket) => {
  socket.on('join', ({ name, room, email }, callback) => {
    if(users.find((user) => user.email === email)) {
      return callback('You are already in session. Only one session per mail!');
    }
    const status = "Waiting";
    const conversations = [];
    const { error, user } = addUser({ id: socket.id, name, room, email, status, conversations });
    
    if(error) return callback(error);
    // console.log(email);
    // console.log(socket.id);
    const temp = admins.findIndex((admin) => admin.email === email);
    // console.log(temp);
    // console.log(admins);
    if (temp === -1) {
      users.push(user);
    } else {
      const index = users.findIndex((user) => user.room === room);
      if (index === -1) {
        return callback('Tutors are not allowed as users');
      }
      users[index].status = "Connected";
    }

    socket.join(user.room);

    socket.emit('message', { user: 'Admin', text: `Welcome ${user.name}.`});
    socket.broadcast.to(user.room).emit('message', { user: 'Admin', text: `${user.name} has joined!` });

    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);
    //If user is a student => user.conversations = message
    //If user is a tutor => tutor room id => student user.conversations = message
    // console.log(user);
    if (!users.includes(user)) {
      const text = "Tutor: "+message;
      user.conversations.push(text);
    } else {
      const usersVar = getUsersInRoom(user.room);
      const userVar = usersVar.filter((item) => !users.includes(item));
      const text = "User: "+message;
      if (userVar.length !== 0) {
        userVar[0].conversations.push(text);
      }
    }

    io.to(user.room).emit('message', { user: user.name, text: message });

    callback();
  });

  socket.on('getInfo', (callback) => {
    socket.emit('comeOn', { users });
    callback();
  });


  socket.on('newAdmin', (adminObject, callback) => {
    if (validator.isEmail(adminObject.email)) {
      const array = [adminObject.name, adminObject.email];
      client.query(`INSERT INTO admin(username, email) VALUES($1,$2) RETURNING *`, array, (err, res) => {
        if (err) throw err;
        for (let row of res.rows) {
          console.log(JSON.stringify(row));
        }
        // client.end();
      });
      const temp = { name: adminObject.name, email: adminObject.email };
      admins.push(temp);
      callback(true);
    } else {
      callback(false);
    }
  })

  socket.on('checkAdmin', (data) => {
      const mail = data.mail;
      // console.log(data.mail);
      const temp = admins.findIndex((admin) => admin.email === mail);
      let name = '';
      let email = '';
      if (temp === -1) {
        const boolean = false;
        socket.emit('adminDetails', { boolean, name, email });
      } else {
        const boolean = true;
        name = admins[temp].name;
        email = admins[temp].email;
        // console.log(name);
        // console.log(email);
        socket.emit('adminDetails', { boolean, name, email });
      }
  })

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    
    if(user) {
      
      if (!users.includes(user)) {
        const time_stamp = timestamp('YYYY/MM/DD') + " " + timestamp('HH:mm:ss');
        const myArray = user.conversations.map((item) => `"${item}"`).join(', ');
        const array = [time_stamp, "{"+myArray+"}", user.email];


        client.query(`INSERT INTO conversations(time_stamp, conversation, email) VALUES($1,$2,$3) RETURNING *`, array, (err, res) => {
          if (err) throw err;
          for (let row of res.rows) {
            console.log(JSON.stringify(row));
          }
          // client.end();
        });
      }

      const index = users.findIndex((user) => user.id === socket.id);
      if(index !== -1) {
        users.splice(index, 1)[0];
      }

      io.to(user.room).emit('message', { user: 'Admin', text: `${user.name} has left.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room)});
    }
  })
});

server.listen(process.env.PORT || 5000, () => console.log(`Server has started.`));
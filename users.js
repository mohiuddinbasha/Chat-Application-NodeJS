const users = [];

const addUser = ({ id, name, room, email, status, conversations }) => {
  // console.log("name: "+name);
  // console.log("room: "+room);
  name = name.trim();
  room = room.trim().toLowerCase();

  const existingUser = users.find((user) => user.room === room && user.name === name);

  if(!name || !room) return { error: 'Name is required.' };
  if(existingUser) return { error: 'Username is taken.' };

  const user = { id, name, room, email, status, conversations };

  users.push(user);

  return { user };
}

const removeUser = (id) => {
  const index = users.findIndex((user) => user.id === id);

  if(index !== -1) return users.splice(index, 1)[0];
}

const getUser = (id) => users.find((user) => user.id === id);

const getUsersInRoom = (room) => users.filter((user) => user.room === room);

module.exports = { addUser, removeUser, getUser, getUsersInRoom };
import { Server } from "socket.io";
// import { v4 } from "uuid";

const io = new Server({
  cors: {
    origin: "http://localhost:3000",
  },
  /* options */
});

// io.engine.generateId = (req) => {
//   return v4(); // must be unique across all Socket.IO servers
// };
io.on("connection", (socket) => {
  socket.join("cw");
  // console.log(socket.rooms); // Set { <socket.id>, "room1" }
  socket.on("connect", () => {
    console.log(socket.id); // ojIckSD2jqNzOqIrAGzL
  });
  socket.on("message", (message: string) => {
    // console.log(socket.id, message); // ojIckSD2jqNzOqIrAGzL
    console.log(message);
    socket.broadcast.emit("message", message);
  });
});
io.listen(4000);

import { Server } from "socket.io";
import { v4 } from "uuid";

const io = new Server({
  /* options */
});

// io.engine.generateId = (req) => {
//   return v4(); // must be unique across all Socket.IO servers
// };
io.on("connection", (socket) => {
  // ...
  console.log(socket.rooms); // Set { <socket.id> }
  socket.join("room1");
  console.log(socket.rooms); // Set { <socket.id>, "room1" }
  socket.on("connect", () => {
    console.log(socket.id); // ojIckSD2jqNzOqIrAGzL
  });
});

// io.engine.on("headers", (headers, req) => {
//   headers["test"] = "789";
//   console.log(headers);
// });
io.listen(3001);

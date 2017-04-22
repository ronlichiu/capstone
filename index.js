const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

var numOfUsers = 0;
var canvasSnapshot = ["{\"objects\":[],\"background\":\"\"}"];
var modeSelected = false;
var canvas = {
  height: 0,
  width: 0
};

function onConnection(socket) {
  numOfUsers++;
  console.log(numOfUsers + " user(s) connected.");

  if (numOfUsers != 1) {
    if (modeSelected) {
      var data = [canvasSnapshot[0], 1];
      var launchData = [canvas.height, canvas.width, canvasSnapshot.length];
      socket.emit("canvasOnLaunch", launchData);
      socket.emit("onCanvasChange", data);
    } else {
      socket.emit("waitLaunch");
    }
  } else {
    socket.emit("firstLaunch");
  }

  socket.on("firstLaunchSelected", function(data) {
    //console.log(data[2].length);
    modeSelected = true;
    canvas.height = data[0];
    canvas.width = data[1];
    canvasSnapshot = data[2];
    var launchData = [canvas.height, canvas.width, canvasSnapshot.length];
    socket.emit("canvasOnLaunch", launchData);
    var data = [canvasSnapshot[0], 1];
    socket.emit("onCanvasChange", data);
    socket.broadcast.emit("onCanvasChange", data);
  });

  socket.on("onCanvasChange", (data) => {
    socket.broadcast.emit("onCanvasChange", data);
    canvasSnapshot[data[1] - 1] = data[0];
    //console.log(canvasSnapshot.length);
    //console.log(data);
  });

  socket.on("addPage", function() {
    var empty = "{\"objects\":[],\"background\":\"\"}";
    canvasSnapshot.push(empty);
    socket.emit("changePage", empty);
    socket.broadcast.emit("otherAddPage");
    //console.log("length: " + canvasSnapshot.length);
  });

  socket.on("getPage", (pageNum) => {
    //console.log(canvasSnapshot[pageNum - 1]);
    socket.emit("changePage", canvasSnapshot[pageNum - 1]);
    //console.log(canvasSnapshot);
  });

  socket.on("importedPDF", (dataJ) => {
    var data = JSON.parse(dataJ);
    canvas.height = data.height;
    canvas.width = data.width;
    canvasSnapshot = data.canvas;
    //console.log(data.canvas.length);
    //console.log(canvasSnapshot[0]);
    var canvasData = [canvasSnapshot[0], 1];
    socket.emit("onCanvasChange", canvasData);
    var launchData = [canvas.height, canvas.width, canvasSnapshot.length];
    socket.broadcast.emit("canvasOnLaunch", launchData);
    socket.broadcast.emit("onCanvasChange", data);
    socket.emit("canvasOnLaunch", launchData);
    modeSelected = true;
  });

  socket.on("exportPage", function() {
    socket.emit("exportPage", canvasSnapshot);
  });

  socket.on("disconnect", function() {
    numOfUsers--;
    console.log("User disconnected. Current user(s): " + numOfUsers);
  });

}

io.on("connection", onConnection);

http.listen(port, () => console.log('listening on port ' + port));

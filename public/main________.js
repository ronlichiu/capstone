'use strict';

(function() {

  var socket = io();
  var canvas = document.getElementsByClassName('whiteboard')[0];
  var colors = document.getElementsByClassName('color');
  var context = canvas.getContext('2d');

  var current = {
    color: 'black'
  };
  var drawing = false;

  var dragText = {
    active: false,
    dragging: false,
    text: "",
    textX: 0,
    textY: 0,
    textWidth: 0,
    textHeight: 0
  }


  canvas.addEventListener('mousedown', onMouseDown, false);
  canvas.addEventListener('mouseup', onMouseUp, false);
  canvas.addEventListener('mouseout', onMouseUp, false);
  canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

  for (var i = 0; i < colors.length; i++){
    colors[i].addEventListener('click', onColorUpdate, false);
  }

  socket.on('drawing', onDrawingEvent);

  window.addEventListener('resize', onResize, false);
  //Initialize the computing figures for drawing,
  //Including the width & height of the canvas
  var style = window.getComputedStyle(canvas);
  var styleW = style.getPropertyValue("width");
  var styleH = style.getPropertyValue("height");
  canvas.width = parseInt(styleW.substring(0, styleW.lastIndexOf("px")));
  canvas.height = parseInt(styleH.substring(0, styleH.lastIndexOf("px")));
  var offsetPosX, offsetPosY;
  onResize();


  function drawLine(x0, y0, x1, y1, color, emit){
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
    context.closePath();

    if (!emit) { return; }
    var w = canvas.width;
    var h = canvas.height;

    socket.emit('drawing', {
      x0: x0 / w,
      y0: y0 / h,
      x1: x1 / w,
      y1: y1 / h,
      color: color
    });
  }

  function onMouseDown(e){
    if (!dragText.active) {
      drawing = true;
      current.x = e.clientX - offsetPosX;
      current.y = e.clientY - offsetPosY;
      //console.log("x: " + current.x);
      //console.log("y: " + current.y);
    } else {
      if ((e.clientX - offsetPosX >= dragText.textX) && (e.clientX - offsetPosX <= dragText.textX + dragText.textWidth) && (e.clientY - offsetPosY >= dragText.textY) && (e.clientY - offsetPosY <= dragText.textY + dragText.textHeight)) {
          dragText.dragging = true;
      }

    }
  }

  function onMouseUp(e){
    if (drawing) {
      drawing = false;
      drawLine(current.x, current.y, e.clientX - offsetPosX, e.clientY - offsetPosY, current.color, true);
      socket.emit('capture', canvas.toDataURL());
    } else if (dragText.active && dragText.dragging) {
      //Covers the current with the dimmed background
      loadCanvas(dimmedCanvas);

      dragText.textX = e.clientX - offsetPosX;
      dragText.textY = e.clientY - offsetPosY;
      drawText(dragText.text, dragText.textX, dragText.textY);
      dragText.dragging = false;
    }
  }

  function onMouseMove(e){
    if (drawing) {
      drawLine(current.x, current.y, e.clientX - offsetPosX, e.clientY - offsetPosY, current.color, true);
      //console.log("currentX: " + current.x);
      current.x = e.clientX - offsetPosX;
      current.y = e.clientY - offsetPosY;
    } else if (dragText.active && dragText.dragging) {
      loadCanvas(dimmedCanvas);

      dragText.textX = e.clientX - offsetPosX;
      dragText.textY = e.clientY - offsetPosY;
      drawText(dragText.text, dragText.textX, dragText.textY);
    }
  }

  function onColorUpdate(e){
    current.color = e.target.className.split(' ')[2];
    //console.log(current.color);
    document.getElementById("colorDropdown").style.color = current.color;
  }

  // limit the number of events per second
  function throttle(callback, delay) {
    var previousCall = new Date().getTime();
    return function() {
      var time = new Date().getTime();

      if ((time - previousCall) >= delay) {
        previousCall = time;
        callback.apply(null, arguments);
      }
    };
  }

  function onDrawingEvent(data){
    var w = canvas.width;
    var h = canvas.height;
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
  }

  // make the canvas fill its parent
  function onResize() {
    //canvas.width = window.innerWidth;
    //canvas.height = window.innerHeight;
    var rect = canvas.getBoundingClientRect();
    offsetPosX = rect.left;
    offsetPosY = rect.top;
  }



//Self developed
  function loadCanvas(dataURL) {
    var imgObj = new Image();
    imgObj.src = dataURL;
    imgObj.onload = function() {
      context.drawImage(imgObj, 0, 0);
      console.log("loaded");
    };
  }

  function slCanvas(dataURL) {
    var imgObj = new Image();
    imgObj.src = dataURL;
    imgObj.onload = function() {
      context.drawImage(imgObj, 0, 0);
      console.log("loaded.");
      var returnData = canvas.toDataURL();
      console.log("saved.");
      return returnData;
    };
  }

  socket.on('loadCanvas', function(canvasData) {
    loadCanvas(canvasData);
    //console.log("test");
  });

  var canvasSnapshot, dimmedCanvas;
  $(document).ready(function() {
    $(".itConfirmDiv").hide();

    $("#insertTextBtn").click(function() {
      $("#itInput").val("");
    });

    $("#itInsertBtn").click(function() {
      canvasSnapshot = canvas.toDataURL();
      context.save();
      context.fillStyle = "#999999";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();
      dimmedCanvas = slCanvas(canvasSnapshot);
      $(".canvas-toolbar").hide();
      $(".itConfirmDiv").show();

      drawText($("#itInput").val(), 300, 200);

      dragText.active = true;
    });

    $("#try").click(function() {
      dimmedCanvas = slCanvas(canvasSnapshot);
      loadCanvas(dimmedCanvas);
    });

  });

  function drawText(text, x, y){
    context.save();
    context.textBaseline = "top";
    context.fillStyle = "#FFFFFF";
    var font = "16px sans-serif";
    context.font = font;
    var w = context.measureText(text).width;
    context.fillRect(x, y, w, parseInt(font, 10));
    context.fillStyle = current.color;
    context.fillText(text, x, y);
    context.restore();

    dragText.text = text;
    dragText.textX = x;
    dragText.textY = y;
    dragText.textWidth = w;
    dragText.textHeight = parseInt(font, 10);
  }



})();

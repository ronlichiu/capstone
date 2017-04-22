'use strict';

(function() {
  var socket = io();

  var currentColor = "black";
  var canvas = new fabric.Canvas("whiteboard", {
    height: 480,
    width: 720
  });

  var mode = "";

  var page = {
    current: 1,
    maxPage: 1
  };

  $(document).ready(function() {
    //$("#modalUpload").modal("show");
    $(".container").hide();

    $("#modalOnLaunch input:radio[name=modalOnLaunch-radio]").change(function() {
      $(".modalOnLaunch-body td.isChecked").removeClass("isChecked");
      $(this).parent().parent().addClass("isChecked");
      $("#modalOnLaunch button").prop("disabled", false);
    });

    $("#modalOnLaunch button").click(function() {
      var value = $("#modalOnLaunch input:radio[name=modalOnLaunch-radio]:checked").val();
      if (value == "blank") {
        $(".container").show();
        $("#modalOnLaunch").modal("hide");
        var canvasData = ["{\"objects\":[],\"background\":\"\"}"];
        var data = [canvas.height, canvas.width, canvasData];
        socket.emit("firstLaunchSelected", data);
      } else if (value == "pdf") {
        $("#modalOnLaunch").modal("hide");
        $("#modalUpload").modal("show");
      }
    });

    var files;
    $("#modalUpload input:file").change(function(e) {
      $("#modalUpload button").prop("disabled", false);
      files = e.target.files;
    });

    var renderedPDF_fabric = [];
    var $btn;
    function renderPDF(pdfDoc, scale, counter) {
      pdfDoc.getPage(counter).then(function(page) {
        var tmpCanvas = document.getElementById("whiteboard");
        var context = tmpCanvas.getContext("2d");
        var renderContext = {
          canvasContext: context,
          viewport: page.getViewport(scale)
        };
        var renderTask = page.render(renderContext);
        renderTask.then(function() {
          //console.log(tmpCanvas.toDataURL());
          var tempCapture = tmpCanvas.toDataURL();
          context.clearRect(0, 0, tmpCanvas.height, tmpCanvas.width);
          canvas.setBackgroundImage(tempCapture, function() {
            var temp = JSON.stringify(canvas.toJSON());
            renderedPDF_fabric.push(temp);
            canvas.clear();
            console.log('Page rendered ' + counter);
            counter++;
            //console.log(renderedPDF_fabric);
            if (counter > pdfDoc.numPages) {
              var data = {
                canvas: renderedPDF_fabric,
                height: canvas.height,
                width: canvas.width
              }
              //console.log(data.canvas);
              socket.emit("importedPDF", JSON.stringify(data));
              $btn.button("reset");
              $("#modalUpload").modal("hide");
              return;
            } else {
              $("#pageNav").append("<option value=\"" + counter + "\">Page " + counter + "</option>");
              renderPDF(pdfDoc, scale, counter);
            }
          });
        });
      });
    }

    $("#modalUpload button").click(function() {
      $btn = $(this).button("loading");
      //console.log(files);
      if (FileReader && files && files.length) {
        var reader = new FileReader();
        var extension = files[0].name.split(".").pop().toLowerCase();
        if (extension == "pdf") {
          reader.onload = function(e) {
            PDFJS.workerSrc = "js/pdf.worker.js";
            PDFJS.getDocument(e.target.result).then(function(pdfDoc) {
              var scale = 1;
              page.maxPage = pdfDoc.numPages;
              pdfDoc.getPage(1).then(function(page) {
                var viewport = page.getViewport(scale);
                resetCanvas(viewport.height, viewport.width);
              });
              if (page.maxPage > 1) {
                $("#nextPage").prop("disabled", false);
              }
              var counter = 1;
              renderPDF(pdfDoc, scale, counter);
              //console.log(pdfDoc.numPages);
            });
          }
          reader.readAsDataURL(files[0]);
        } else {
          $("#modalUpload input:file").val("");
          $("#modalUpload button").prop("disabled", true);
          $("#modalUpload .errField").show();
          $("#modalUpload").modal("show");
        }
      }
    });

    $(".color").click(function() {
      var classExt = $(this).attr("class");
      currentColor = classExt.substring(classExt.lastIndexOf("color-") + 6);
      $("#colorDropdown").attr("style", "color:" + currentColor);

      //Change color for drawing
      canvas.freeDrawingBrush.color = currentColor;
    });

    $(".stateChangeBtn").click(function() {
      if ($(this).hasClass("btn-default")) {
        $(this).removeClass("btn-default");
        $(this).addClass("btn-primary");
        if (mode != "") {
          $("#" + mode).removeClass("btn-primary");
          $("#" + mode).addClass("btn-default");
        }
        mode = $(this).attr("id");
      } else {
        $(this).removeClass("btn-primary");
        $(this).addClass("btn-default");
        mode = "";
      }

      //If drawing button is clicked after state change
      if ($(this).attr("id") == "drawing") {
        if ($(this).hasClass("btn-default")) { //in focus orginial
          canvas.isDrawingMode = false;
        } else {
          canvas.isDrawingMode = true;
        }
      }
    });

    $(".itConfirmDiv").hide();

    $("#insertTextBtn").click(function() {
      var text = new fabric.IText("", {
        fontSize: 20,
        fontFamily: 'Arial',
        left: 300,
        top: 200,
        fill: currentColor
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
    });

    $("#addPageBtn").click(function() {
      socket.emit("addPage");
      page.maxPage++;
      page.current = page.maxPage;
      $("#pageNav").append("<option value=\"" + page.maxPage + "\">Page " + page.maxPage + "</option>");
      //console.log(page.maxPage);
      $("#pageNav").val(page.maxPage);
      $("previousPageBtn").prop("disabled", false);
    });

    $("#pageNav").change(function() {
      socket.emit("getPage", $("#pageNav").val());
      page.current = $("#pageNav").val();
    });

    $("#exportBtn").click(function() {
      socket.emit("exportPage");
    });

    $(document).keydown(function(e) {
      //console.log(e.which);
      if (e.which == 46) {
        canvas.getActiveObject().remove();
      }
    });

    $("#previousPageBtn").click(function() {
      $("#pageNav option[value=" + page.current + "]").prop("selected", false);
      page.current--;
      socket.emit("getPage", page.current);
      $("#nextPageBtn").prop("disabled", false);
      $("#pageNav option[value=" + page.current + "]").prop("selected", true);
      if (page.current == 1) {
        $(this).prop("disabled", true);
      }
    });

    $("#nextPageBtn").click(function() {
      $("#pageNav option[value=" + page.current + "]").prop("selected", false);
      page.current++;
      socket.emit("getPage", page.current);
      $("#previousPageBtn").prop("disabled", false);
      $("#pageNav option[value=" + page.current + "]").prop("selected", true);
      if (page.current == page.maxPage) {
        $(this).prop("disabled", true);
      }
    });

  });

  function resetCanvas(h, w) {
    canvas.dispose();
    canvas = new fabric.Canvas("whiteboard", {
      height: h,
      width: w
    });

    canvas.on("path:created", emitCanvas);
    canvas.on("object:modified", emitCanvas);
    canvas.on("text:editing:entered", emitCanvas);
  }

  //When object is added
  function emitCanvas() {
    //console.log("change received.");
    var dataPackage = [JSON.stringify(canvas.toJSON()), page.current];
    socket.emit("onCanvasChange", dataPackage);
  }

  socket.on("onCanvasChange", function(data) {
    //console.log(data);
    if (data[1] == page.current) {
      canvas.loadFromJSON(data[0], function() {
        //console.log("loaded.");
        canvas.renderAll();
      });
    }

    $("#modalLoad").modal("hide");
    $(".container").show();
  });

  socket.on("changePage", function(data) {
    canvas.clear();
    canvas.loadFromJSON(data, function() {
      //console.log("loaded.");
      canvas.renderAll();
    });
  });

  socket.on("otherAddPage", function() {
    page.maxPage++;
    $("#pageNav").append("<option value=\"" + page.maxPage + "\">Page " + page.maxPage + "</option>");
  });

  socket.on("firstLaunch", function(){
    $("#modalOnLaunch").modal("show");
  });

  socket.on("waitLaunch", function() {
    $("#modalLoad").modal("show");
  });


  socket.on("canvasOnLaunch", function(data) {
    //console.log(data);
    resetCanvas(data[0], data[1]);
    for (var i=2; i<=data[2]; i++) {
      $("#pageNav").append("<option value=\"" + i + "\">Page " + i + "</option>");
    }
    page.maxPage = data[2];
    if (page.maxPage > 1) {
      $("#nextPageBtn").prop("disabled", false);
    }
    socket.emit("getPage", 1);
  });

  function exportPage(data, doc) {
    var item = data.shift();
    var tempCanvas = new fabric.Canvas("exporter", {
      height: canvas.height,
      width: canvas.width
    });
    tempCanvas.loadFromJSON(item, function() {
      var dataURL = tempCanvas.toDataURL({
        format: 'jpeg'
      });
      //console.log(dataURL);
      //console.log(canvas.width);
      doc.addImage(dataURL, 0, 0, 0, 0);
      tempCanvas.dispose();
      if (data.length > 0) {
        doc.addPage();
        exportPage(data, doc);
      } else {
        doc.save("export.pdf");
        //console.log("done");
      }
    });
  }

  socket.on("exportPage", function(data) {
    var doc = new jsPDF({
      unit: "pt"
    });
    exportPage(data, doc);
  });

  canvas.on("path:created", emitCanvas);
  canvas.on("object:modified", emitCanvas);
  canvas.on("text:editing:entered", emitCanvas);

})();

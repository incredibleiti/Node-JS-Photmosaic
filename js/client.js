/*
  - Drag File In
  - Display Dragged File in Canvas
  - Request tiles from remote server
  - Replace image with tile mosaic one complete row at a time
*/

var MAX_HEIGHT = 640;
var MAX_WIDTH = 640;

var TILE_PIXELS = TILE_WIDTH * TILE_HEIGHT;

var dropper = document.getElementById('dropper');

var canvas = document.getElementById('mosaic');
var context = canvas.getContext('2d');

dropper.ondragover = function() {
  this.className = 'hover';
  return false;
}

dropper.ondragleave = function () {
  this.className = '';
  return false;
}

dropper.ondrop = function (e) {
  this.className = '';
  e.stopPropagation();
  e.preventDefault();

  process_image(e.dataTransfer.files[0])

  return false;
}

document.getElementById('inputFile').onchange = function(e) {
  if (e.target.files && e.target.files[0]) {
    process_image(e.target.files[0]);
  }
  return false;
}


function process_image(file) {
  var canvas = document.getElementById('mosaic');
  var context = canvas.getContext('2d');
  context.fillStyle = "rgb(255,255,255)"; // a crude way to handle images with transparency
  context.fillRect(0, 0, MAX_WIDTH, MAX_HEIGHT);

  reader = new FileReader();

  reader.onload = function (event) {
    var img = new Image();
    img.src = event.target.result;

    img.onload = function() {
      // loading
      var width = img.width;
      var height = img.height;

      var scaled_w, scaled_h;

      if (width > height) {
        scaled_w = MAX_WIDTH;
        scaled_h = MAX_HEIGHT * height/width ;
      } else {
        scaled_h = MAX_HEIGHT;
        scaled_w = width/height * MAX_WIDTH;
      }

      scaled_w |= 0;
      scaled_h |= 0; // truncate to integer

      context.drawImage(img, 0, 0, scaled_w, scaled_h);

      // averaging
      var rows = Math.ceil(scaled_h/TILE_HEIGHT);
      var cols = Math.ceil(scaled_w/TILE_WIDTH);

      // each row is first rendered to an off-screen canvas
      // to collect all row tiles
      var row_canvas = document.createElement('canvas');
      row_canvas.width = cols * TILE_WIDTH;
      row_canvas.height = TILE_HEIGHT;
      var row_context = row_canvas.getContext('2d');

      for (var row_no = 0; row_no < rows; row_no++) {
        var tile_y = row_no * TILE_HEIGHT;

        var row_promises = [];
        row_promises.push(new Promise(function(resolve,reject){
          resolve(tile_y);
        }));

        for (var col_no = 0; col_no < cols; col_no++) {
          var tile_x = col_no * TILE_WIDTH;

          var tile = context.getImageData(tile_x, tile_y, TILE_WIDTH, TILE_HEIGHT);
          var tile_hex = average_tile_colour_hex(tile.data);

          row_promises.push(
            new Promise(function (resolve, reject) {
              var remote_tile = new Image();
              remote_tile.onload = function(e) {
                var img = e.target;
                resolve({
                  img: img,
                  x: img.dataset.x,
                  y: img.dataset.y
                });
              };
              remote_tile.src = '/color/' + tile_hex;
              remote_tile.dataset.x = tile_x;
              remote_tile.dataset.y = tile_y;

            })
          );
        }

        Promise.all(row_promises).then(
          function(values) {
            // first resolved promise is the Y coordinate of the row
            var y_offset = values.shift();
            // render all tiles to one row
            values.map(function(img_data) {
              row_context.drawImage(img_data.img, img_data.x, 0);
            });
            // render one row to main canvas
            context.drawImage(row_canvas, 0, y_offset);
          },
          function (reason) {
            console.log(reason);
          }
        );
      }
    }
  }
  reader.readAsDataURL(file);
}

function average_tile_colour_hex(img_data) {
  var tile_sum = [0,0,0];
  var tile_avg = [0,0,0];
  var tile_hex = '';

  // loop through all pixels in one tile
  for (var i = 0; i < TILE_PIXELS; i++) {
    // loop through one pixel's r,g,b dimensions
    for (var j = 0; j < 3; j++) {
      tile_sum[j] += img_data[j + i*4];
    }
  }

  tile_avg = tile_sum.map(function(sum) {
    return (sum / TILE_PIXELS) | 0;
  })

  tile_hex = tile_avg.map(function(colour_value) {
    var hex = (colour_value).toString(16);
    if (hex.length < 2) {
      hex = '0'+hex;
    }
    return hex;
  }).join('');

  return tile_hex;
}

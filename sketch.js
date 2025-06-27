let sourceImage;
let tileLayer;

const TILE_SIZE = 100;
const previewWidth = 1200;
const previewHeight = 628;

const bgColor = '#f6f2df';
const colors = ['#ef3f35', '#329758', '#3356a3', '#fae25e', '#f6f2df'];

let scale;
let minScale, maxScale;
let imgX, imgY;

let imagePlaced = false;
let dragging = false;
let dragOffsetX, dragOffsetY;

let grayscaleMode = true;
let contrastFactor = 1.3;
let grainLevel = 15;

function setup() {
  const canvas = createCanvas(previewWidth, previewHeight);
  canvas.parent('canvasContainer');

  tileLayer = createGraphics(previewWidth, previewHeight);
  noLoop();

  // Load default image (optional)
  loadImage('source.jpg', img => {
    sourceImage = img;
    resetImagePositionAndScale();
    redraw();
  }, () => {
    console.warn("source.jpg not found, upload an image.");
  });

  // Connect sidebar controls
  document.getElementById('grayscaleToggle').addEventListener('change', () => {
    grayscaleMode = document.getElementById('grayscaleToggle').checked;
    if (imagePlaced) redraw();
  });

  document.getElementById('contrast').addEventListener('input', (e) => {
    contrastFactor = parseFloat(e.target.value);
    if (imagePlaced) redraw();
  });

  document.getElementById('noise').addEventListener('input', (e) => {
    grainLevel = parseInt(e.target.value);
    if (imagePlaced) redraw();
  });

  document.getElementById('imageInput').addEventListener('change', handleFile);

  // Add button event listeners
  document.getElementById('drawTilesBtn').addEventListener('click', () => {
    if (!sourceImage) return alert("Upload and place an image first.");
    imagePlaced = true;
    drawTiles();
    redraw();
    console.log("Tiles drawn.");
  });

  document.getElementById('saveImageBtn').addEventListener('click', () => {
    if (!imagePlaced) return alert("Draw tiles first.");
    saveFinalImage();
  });
}

function draw() {
  background(bgColor);

  if (sourceImage) {
    let scaledWidth = sourceImage.width * scale;
    let scaledHeight = sourceImage.height * scale;

    if (imagePlaced) {
      let filteredImg = getFilteredImage();
      image(filteredImg, imgX, imgY, scaledWidth, scaledHeight);
    } else {
      image(sourceImage, imgX, imgY, scaledWidth, scaledHeight);
    }
  }

  if (imagePlaced) {
    image(tileLayer, 0, 0);
  }
}

function getFilteredImage() {
  let pg = createGraphics(sourceImage.width, sourceImage.height);
  pg.image(sourceImage, 0, 0);

  if (grayscaleMode) {
    pg.filter(GRAY);
  }

  addGrain(pg);
  boostContrast(pg);
  multiplyBlend(pg, bgColor);

  return pg;
}

function addGrain(pg) {
  pg.loadPixels();
  for (let i = 0; i < pg.pixels.length; i += 4) {
    let noiseAmount = random(-grainLevel, grainLevel);
    for (let c = 0; c < 3; c++) {
      let val = pg.pixels[i + c] + noiseAmount;
      pg.pixels[i + c] = constrain(val, 0, 255);
    }
  }
  pg.updatePixels();
}

function boostContrast(pg) {
  pg.loadPixels();
  for (let i = 0; i < pg.pixels.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = pg.pixels[i + c] / 255.0;
      val = ((val - 0.5) * contrastFactor + 0.5) * 255;
      pg.pixels[i + c] = constrain(val, 0, 255);
    }
  }
  pg.updatePixels();
}

function multiplyBlend(pg, bgColorStr) {
  pg.loadPixels();

  let bgCol = color(bgColorStr);
  let bgR = red(bgCol);
  let bgG = green(bgCol);
  let bgB = blue(bgCol);

  for (let i = 0; i < pg.pixels.length; i += 4) {
    pg.pixels[i] = (pg.pixels[i] * bgR) / 255;
    pg.pixels[i + 1] = (pg.pixels[i + 1] * bgG) / 255;
    pg.pixels[i + 2] = (pg.pixels[i + 2] * bgB) / 255;
  }

  pg.updatePixels();
}

function mousePressed() {
  if (!imagePlaced && sourceImage) {
    let scaledWidth = sourceImage.width * scale;
    let scaledHeight = sourceImage.height * scale;
    if (
      mouseX >= imgX && mouseX <= imgX + scaledWidth &&
      mouseY >= imgY && mouseY <= imgY + scaledHeight
    ) {
      dragging = true;
      dragOffsetX = mouseX - imgX;
      dragOffsetY = mouseY - imgY;
    }
  }
}

function mouseDragged() {
  if (dragging && !imagePlaced) {
    imgX = mouseX - dragOffsetX;
    imgY = mouseY - dragOffsetY;
    redraw();
  }
}

function mouseReleased() {
  dragging = false;
}

function mouseWheel(event) {
  if (!imagePlaced && sourceImage) {
    let e = event.delta > 0 ? 1 : -1;

    let oldWidth = sourceImage.width * scale;
    let oldHeight = sourceImage.height * scale;

    let centerX = imgX + oldWidth / 2;
    let centerY = imgY + oldHeight / 2;

    scale -= e * 0.05;
    scale = constrain(scale, minScale, maxScale);

    let newWidth = sourceImage.width * scale;
    let newHeight = sourceImage.height * scale;

    imgX = centerX - newWidth / 2;
    imgY = centerY - newHeight / 2;

    redraw();
  }
}

function keyPressed() {
  if (key === 'p' || key === 'P') {
    if (!sourceImage) return;
    imagePlaced = true;
    drawTiles();
    redraw();
    console.log("Image placed, tiles drawn.");
  }
  else if ((key === ' ' || keyCode === ENTER) && imagePlaced) {
    drawTiles();
    redraw();
    console.log("Tiles redrawn.");
  }
  else if (key === 's' || key === 'S') {
    if (!imagePlaced) {
      console.log("Place the image first by pressing 'P'");
      return;
    }
    saveFinalImage();
  }
}

function saveFinalImage() {
  let output = createGraphics(width, height);

  if (sourceImage) {
    let scaledWidth = sourceImage.width * scale;
    let scaledHeight = sourceImage.height * scale;

    if (imagePlaced) {
      let filteredImg = getFilteredImage();
      output.image(filteredImg, imgX, imgY, scaledWidth, scaledHeight);
    } else {
      output.image(sourceImage, imgX, imgY, scaledWidth, scaledHeight);
    }
  }

  output.image(tileLayer, 0, 0);

  let filename = 'output-' + year() + nf(month(), 2) + nf(day(), 2) + '-' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2) + '.png';
  output.save(filename);
  console.log("Saved " + filename);
}

function drawTiles() {
  tileLayer.clear();
  tileLayer.noStroke();

  let cols = ceil(width / TILE_SIZE);
  let rows = ceil(height / TILE_SIZE);

  let gridHeight = rows * TILE_SIZE;
  let offsetYGrid = (height - gridHeight) / 2;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (random(1) < 0.1) {
        let px = x * TILE_SIZE;
        let py = offsetYGrid + y * TILE_SIZE;

        tileLayer.fill(colors[int(random(colors.length))]);
        tileLayer.rect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type.startsWith('image')) {
    let reader = new FileReader();
    reader.onload = function(evt) {
      loadImage(evt.target.result, img => {
        sourceImage = img;
        resetImagePositionAndScale();
        imagePlaced = false;
        redraw();
        console.log('New image loaded');
      });
    };
    reader.readAsDataURL(file);
  } else {
    console.log('Not an image file!');
  }
}

function resetImagePositionAndScale() {
  scale = width / sourceImage.width;
  minScale = scale * 0.5;
  maxScale = scale * 3;

  let scaledWidth = sourceImage.width * scale;
  let scaledHeight = sourceImage.height * scale;

  imgX = (width - scaledWidth) / 2;
  imgY = (height - scaledHeight) / 2;
}

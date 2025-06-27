let sourceImage;
let tileLayer;

const TILE_SIZE = 100;

const previewWidth = 1200;
const previewHeight = 628;

const bgColor = '#f6f2df';
const colors = [
  '#ef3f35', // red
  '#329758', // green
  '#3356a3', // blue
  '#fae25e', // yellow
  '#f6f2df'  // bg color (optional "empty")
];

let scale;      // zoom factor for image
let minScale, maxScale;
let imgX, imgY;   // image top-left position on canvas

let imagePlaced = false;

let dragging = false;
let dragOffsetX, dragOffsetY;

let grayscaleMode = true;

// File input element for uploading images
let imgInput;

function setup() {
  createCanvas(previewWidth, previewHeight);

  sourceImage = loadImage('source.jpg', () => {
    resetImagePositionAndScale();
    redraw();
  }, () => {
    console.error("source.jpg not found. Upload a new image.");
  });

  tileLayer = createGraphics(previewWidth, previewHeight);

  noStroke();
  noLoop();

  // Create file input and position below canvas
  imgInput = createFileInput(handleFile);
  imgInput.position(10, height + 10);
}

function draw() {
  background(bgColor);

  if (sourceImage) {
    let scaledWidth = sourceImage.width * scale;
    let scaledHeight = sourceImage.height * scale;

    // Draw image with grayscale toggle and filters if placed
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
  // Create a graphics buffer for filters
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

if (!grayscaleMode) {
  reduceSaturation(pg, 0.5); // 50% saturation reduction (adjust as needed)
}

function addGrain(pg) {
  pg.loadPixels();
  for (let i = 0; i < pg.pixels.length; i += 4) {
    let noiseAmount = random(-15, 15);
    for (let c = 0; c < 3; c++) {
      let val = pg.pixels[i + c] + noiseAmount;
      pg.pixels[i + c] = constrain(val, 0, 255);
    }
  }
  pg.updatePixels();
}

function boostContrast(pg) {
  pg.loadPixels();
  const factor = 1.3; // contrast factor
  for (let i = 0; i < pg.pixels.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = pg.pixels[i + c] / 255.0;
      val = ((val - 0.5) * factor + 0.5) * 255;
      pg.pixels[i + c] = constrain(val, 0, 255);
    }
  }
  pg.updatePixels();
}

function multiplyBlend(pg, bgColorStr) {
  pg.loadPixels();

  // Convert background color to RGB
  let bgCol = color(bgColorStr);
  let bgR = red(bgCol);
  let bgG = green(bgCol);
  let bgB = blue(bgCol);

  for (let i = 0; i < pg.pixels.length; i += 4) {
    // Multiply blend: (source * bg) / 255
    pg.pixels[i] = (pg.pixels[i] * bgR) / 255;     // R
    pg.pixels[i + 1] = (pg.pixels[i + 1] * bgG) / 255; // G
    pg.pixels[i + 2] = (pg.pixels[i + 2] * bgB) / 255; // B
  }

  pg.updatePixels();
}

function reduceSaturation(pg, amount) {
  // amount: 0 = no change, 1 = fully desaturated (grayscale)
  pg.loadPixels();
  for (let i = 0; i < pg.pixels.length; i += 4) {
    let r = pg.pixels[i];
    let g = pg.pixels[i + 1];
    let b = pg.pixels[i + 2];

    // Convert RGB to HSL to isolate saturation
    let c = rgbToHsl(r, g, b);

    // Reduce saturation by "amount"
    c[1] = c[1] * (1 - amount);

    // Convert back to RGB
    let rgb = hslToRgb(c[0], c[1], c[2]);

    pg.pixels[i] = rgb[0];
    pg.pixels[i + 1] = rgb[1];
    pg.pixels[i + 2] = rgb[2];
  }
  pg.updatePixels();
}

function mousePressed() {
  if (!imagePlaced && sourceImage) {
    let scaledWidth = sourceImage.width * scale;
    let scaledHeight = sourceImage.height * scale;

    if (mouseX >= imgX && mouseX <= imgX + scaledWidth &&
        mouseY >= imgY && mouseY <= imgY + scaledHeight) {
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
  else if (key === 'g' || key === 'G') {
    grayscaleMode = !grayscaleMode;
    redraw();
    console.log("Grayscale mode: " + (grayscaleMode ? "ON" : "OFF"));
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

// Handles image file upload from user
function handleFile(file) {
  if (file.type === 'image') {
    loadImage(file.data, img => {
      sourceImage = img;
      resetImagePositionAndScale();
      imagePlaced = false;
      tileLayer.clear();   // clear old tiles
      redraw();
      console.log('New image loaded');
    });
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

// Converts RGB (0-255) to HSL (H: 0-1, S: 0-1, L: 0-1)
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  let max = max3(r, g, b), min = min3(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    let hue2rgb = function(p, q, t) {
      if(t < 0) t += 1;
      if(t > 1) t -= 1;
      if(t < 1/6) return p + (q - p) * 6 * t;
      if(t < 1/2) return q;
      if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    }
    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [r * 255, g * 255, b * 255];
}

function max3(a,b,c) { return (a>b && a>c) ? a : (b>c) ? b : c; }
function min3(a,b,c) { return (a<b && a<c) ? a : (b<c) ? b : c; }

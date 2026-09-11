let sourceImage;
let tileLayer;

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
let mouseWheelTimeout;

let tileSize = 100;
let grayscaleMode = true;
let contrastFactor = 1.3;
let grainLevel = 15;
let tileDensity = 0.1;
let tileVariationPercent = 0;
let clusteringEnabled = false;

// 'none' | 'squares' | 'circles'
let tileShape = 'none';

let cachedFilteredImage = null;

// Debounce handle shared across slider callbacks
let redrawTimeout;

// Pinch-zoom state for touch
let lastPinchDist = null;

// ---------------------------------------------------------------------------
// Filter cache
// ---------------------------------------------------------------------------
function invalidateFilterCache() {
  cachedFilteredImage = null;
}

function updateFilteredImageAndRedraw() {
  if (imagePlaced) {
    cachedFilteredImage = getFilteredImage();
    redraw();
  }
}

function isMouseOverUI() {
  const active = document.activeElement;
  return (
    active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'BUTTON' ||
      active.tagName === 'SELECT' ||
      active.tagName === 'TEXTAREA'
    )
  );
}

// ---------------------------------------------------------------------------
// Enable / disable tile controls based on tileShape
// ---------------------------------------------------------------------------
function updateControlAvailability() {
  const tileControlsDisabled = (tileShape === 'none');
  const clusterDisabled = tileControlsDisabled; // clustering makes no sense without tiles

  ['tileSize', 'density', 'tileVariation'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = tileControlsDisabled;
  });

  const clusterEl = document.getElementById('clusterToggle');
  if (clusterEl) {
    clusterEl.disabled = clusterDisabled;
    // Visually grey out the label too
    const label = clusterEl.closest('label');
    if (label) label.style.opacity = clusterDisabled ? '0.5' : '1';
  }

  // Also grey the labels of the sliders for visual consistency
  ['tileSize', 'density', 'tileVariation'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) label.style.opacity = tileControlsDisabled ? '0.5' : '1';
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
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

  // --- Connect sidebar controls ---
  document.getElementById('grayscaleToggle').addEventListener('change', () => {
    grayscaleMode = document.getElementById('grayscaleToggle').checked;
    invalidateFilterCache();
    updateFilteredImageAndRedraw();
  });

  document.getElementById('contrast').addEventListener('input', (e) => {
    contrastFactor = parseFloat(e.target.value);
    clearTimeout(redrawTimeout);
    invalidateFilterCache();
    redrawTimeout = setTimeout(updateFilteredImageAndRedraw, 30);
  });

  document.getElementById('noise').addEventListener('input', (e) => {
    grainLevel = parseInt(e.target.value);
    clearTimeout(redrawTimeout);
    invalidateFilterCache();
    redrawTimeout = setTimeout(updateFilteredImageAndRedraw, 30);
  });

  document.getElementById('tileSize').addEventListener('input', (e) => {
    tileSize = parseInt(e.target.value);
    if (imagePlaced) {
      drawTiles();
      redraw();
    }
  });

  document.getElementById('density').addEventListener('input', (e) => {
    tileDensity = parseFloat(e.target.value);
    if (imagePlaced) {
      drawTiles();
      redraw();
    }
  });

  document.getElementById('tileVariation').addEventListener('input', (e) => {
    tileVariationPercent = parseInt(e.target.value);
    if (imagePlaced) {
      drawTiles();
      redraw();
    }
  });

  document.getElementById('clusterToggle').addEventListener('change', (e) => {
    clusteringEnabled = e.target.checked;
    if (imagePlaced) {
      drawTiles();
      redraw();
    }
  });

  // Tile shape radios
  document.querySelectorAll('input[name="tileShape"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      tileShape = e.target.value;
      updateControlAvailability();
      if (imagePlaced) {
        drawTiles();
        redraw();
      }
    });
  });

  document.getElementById('imageInput').addEventListener('change', handleFile);

  document.getElementById('drawTilesBtn').addEventListener('click', () => {
    if (!sourceImage) {
      alert("Please upload an image first.");
      return;
    }
    imagePlaced = true;
    cachedFilteredImage = getFilteredImage();
    drawTiles();
    redraw();
    console.log("Tiles drawn.");
  });

  document.getElementById('saveImageBtn').addEventListener('click', () => {
    if (!imagePlaced) {
      alert("Please draw tiles first.");
      return;
    }
    saveFinalImage();
  });

  // Initialize control state based on default tileShape ('none')
  updateControlAvailability();
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------
function draw() {
  background(bgColor);

  if (sourceImage) {
    let scaledWidth = sourceImage.width * scale;
    let scaledHeight = sourceImage.height * scale;

    let imgToDraw = (imagePlaced && cachedFilteredImage)
      ? cachedFilteredImage
      : sourceImage;

    image(imgToDraw, imgX, imgY, scaledWidth, scaledHeight);
  }

  if (imagePlaced) {
    image(tileLayer, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Zoom helper (shared by mouse wheel + pinch)
// ---------------------------------------------------------------------------
function zoomAt(newScale) {
  newScale = constrain(newScale, minScale, maxScale);
  if (newScale === scale) return;

  let oldWidth = sourceImage.width * scale;
  let oldHeight = sourceImage.height * scale;

  let centerX = imgX + oldWidth / 2;
  let centerY = imgY + oldHeight / 2;

  scale = newScale;

  let newWidth = sourceImage.width * scale;
  let newHeight = sourceImage.height * scale;

  imgX = centerX - newWidth / 2;
  imgY = centerY - newHeight / 2;
}

// ---------------------------------------------------------------------------
// Mouse input
// ---------------------------------------------------------------------------
function mousePressed() {
  if (document.elementFromPoint(mouseX, mouseY)?.closest('#sidebar')) return;

  if (sourceImage) {
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
  if (dragging && !isMouseOverUI()) {
    imgX = mouseX - dragOffsetX;
    imgY = mouseY - dragOffsetY;
    loop();
  }
}

function mouseReleased() {
  dragging = false;
  noLoop();
  redraw();
}

function mouseWheel(event) {
  const sidebar = document.getElementById('sidebar');
  const rect = sidebar.getBoundingClientRect();

  if (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  ) {
    return false;
  }

  if (sourceImage) {
    let e = event.delta > 0 ? 1 : -1;
    zoomAt(scale - e * 0.05);

    loop();
    clearTimeout(mouseWheelTimeout);
    mouseWheelTimeout = setTimeout(() => {
      noLoop();
      redraw();
    }, 100);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Touch input (mobile) — only active on the canvas, not the sidebar
// ---------------------------------------------------------------------------
function isTouchOnCanvas(t) {
  const canvas = document.querySelector('#canvasContainer canvas');
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  return (
    t.x >= rect.left && t.x <= rect.right &&
    t.y >= rect.top  && t.y <= rect.bottom
  );
}

function touchStarted() {
  // If the touch began on the sidebar, let the browser handle scrolling
  if (touches.length > 0 && !isTouchOnCanvas(touches[0])) {
    return true; // don't preventDefault → native scroll works
  }

  if (touches.length === 2) {
    lastPinchDist = dist(
      touches[0].x, touches[0].y,
      touches[1].x, touches[1].y
    );
    return false;
  }

  mousePressed();
  return false;
}

function touchMoved() {
  // Ignore touch-moves that didn't start on the canvas
  if (touches.length > 0 && !isTouchOnCanvas(touches[0])) {
    return true;
  }

  if (touches.length === 2 && lastPinchDist !== null) {
    const d = dist(
      touches[0].x, touches[0].y,
      touches[1].x, touches[1].y
    );
    const delta = d - lastPinchDist;
    zoomAt(scale + delta * 0.005);
    lastPinchDist = d;
    loop();
    return false;
  }

  if (dragging && !isMouseOverUI()) {
    imgX = mouseX - dragOffsetX;
    imgY = mouseY - dragOffsetY;
    loop();
  }
  return false;
}

function touchEnded() {
  if (touches.length > 0 && !isTouchOnCanvas(touches[0])) {
    return true;
  }

  if (touches.length < 2) {
    lastPinchDist = null;
  }
  dragging = false;
  noLoop();
  redraw();
  return false;
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------
function keyPressed() {
  if (key === 'p' || key === 'P') {
    if (!sourceImage) return;
    imagePlaced = true;
    cachedFilteredImage = getFilteredImage();
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

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
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

  let filename = 'output-' +
    year() + nf(month(), 2) + nf(day(), 2) + '-' +
    nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2) + '.png';

  output.save(filename);
  console.log("Saved " + filename);
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------
function drawTiles() {
  tileLayer.clear();

  // No shape selected → leave the tile layer empty
  if (tileShape === 'none') {
    return;
  }

  tileLayer.noStroke();

  let cols = ceil(width / tileSize);
  let rows = ceil(height / tileSize);
  let grid = [];

  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      let placeTile = false;

      if (clusteringEnabled) {
        let neighbors = 0;
        if (x > 0 && grid[y][x - 1]) neighbors++;
        if (y > 0 && grid[y - 1][x]) neighbors++;

        let chance = tileDensity;
        if (neighbors > 0) chance += 0.2;

        placeTile = random(1) < chance;
      } else {
        placeTile = random(1) < tileDensity;
      }

      grid[y][x] = placeTile;

      if (placeTile) {
        let px = x * tileSize;
        let py = y * tileSize;

        tileLayer.fill(colors[int(random(colors.length))]);

        let variationAmount = tileSize * (tileVariationPercent / 100);
        let sizeOffset = random(-variationAmount, variationAmount);
        let actualSize = tileSize + sizeOffset;

        if (tileShape === 'circles') {
          tileLayer.ellipse(px + tileSize / 2, py + tileSize / 2, actualSize * 0.9);
        } else {
          tileLayer.rect(px, py, actualSize, actualSize);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// File input
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Reset position/scale
// ---------------------------------------------------------------------------
function resetImagePositionAndScale() {
  scale = width / sourceImage.width;
  minScale = scale * 0.5;
  maxScale = scale * 3;

  let scaledWidth = sourceImage.width * scale;
  let scaledHeight = sourceImage.height * scale;

  imgX = (width - scaledWidth) / 2;
  imgY = (height - scaledHeight) / 2;
}
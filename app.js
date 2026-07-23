const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cardsDiv = document.getElementById('cards');
const startBtn = document.getElementById('startBtn');

let cvReady = false;
let running = false;

// Wait for OpenCV
function waitForOpenCV() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.cv && cv.Mat) {
        cvReady = true;
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

// Start camera
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  video.srcObject = stream;

  await new Promise(r => video.onloadedmetadata = r);

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  running = true;
  detectLoop();
}

// Detection loop
function detectLoop() {
  if (!running) return;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const thresh = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  // Preprocess
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);

  cv.adaptiveThreshold(
    blur,
    thresh,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    11,
    2
  );

  // Find contours
  cv.findContours(
    thresh,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

  let detected = [];

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);

    // Filter small contours
    if (area < 5000) continue;

    const peri = cv.arcLength(cnt, true);
    const approx = new cv.Mat();

    cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

    // Card should be a quadrilateral
    if (approx.rows === 4) {
      const rect = cv.boundingRect(approx);

      // Draw rectangle
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 3;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

      detected.push({
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height
      });
    }

    approx.delete();
  }

  // Update overlay
  if (detected.length === 0) {
    cardsDiv.innerHTML = 'No cards detected';
  } else {
    cardsDiv.innerHTML = detected
      .map((_, i) => `<div class="card">Card ${i+1}</div>`)
      .join('');
  }

  // Cleanup
  src.delete();
  gray.delete();
  blur.delete();
  thresh.delete();
  contours.delete();
  hierarchy.delete();

  requestAnimationFrame(detectLoop);
}

// Button
startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  startBtn.textContent = 'Loading OpenCV...';

  await waitForOpenCV();

  startBtn.textContent = 'Starting camera...';

  await startCamera();

  startBtn.style.display = 'none';
});

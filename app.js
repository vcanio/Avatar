const rig = document.querySelector("#avatarRig");
const avatarImage = document.querySelector("#avatarImage");
const statusEl = document.querySelector("#status");
const levelBar = document.querySelector("#levelBar");
const levelText = document.querySelector("#levelText");
const readout = document.querySelector("#readout");
const micButton = document.querySelector("#micButton");
const demoButton = document.querySelector("#demoButton");
const titleInput = document.querySelector("#titleInput");
const presentationTitle = document.querySelector("#presentationTitle");
const avatarSelect = document.querySelector("#avatarSelect");
const backgroundSelect = document.querySelector("#backgroundSelect");

// Elementos del modo de grabación/presentación
const appContainer = document.querySelector(".app");
const stagePanel = document.querySelector(".stage-panel");
const recordingModeButton = document.querySelector("#recordingModeButton");
const floatingControlBar = document.querySelector("#floatingControlBar");
const floatMicButton = document.querySelector("#floatMicButton");
const floatExitButton = document.querySelector("#floatExitButton");

const controls = {
  sensitivity: document.querySelector("#sensitivity"),
  smoothing: document.querySelector("#smoothing"),
  mouthX: document.querySelector("#mouthX"),
  mouthY: document.querySelector("#mouthY"),
  mouthWidth: document.querySelector("#mouthWidth"),
  maxOpen: document.querySelector("#maxOpen"),
  avatarScale: document.querySelector("#avatarScale"),
};

const avatarPresets = {
  avatarA: {
    src: "assets/Avatar1.png",
    alt: "Vicente",
    mouthX: 50,
    mouthY: 55.7,
    mouthWidth: 6.4,
    maxOpen: 4.4,
  },
  avatarB: {
    src: "assets/Avatar2.png",
    alt: "Paulo",
    mouthX: 50,
    mouthY: 66.8,
    mouthWidth: 10.6,
    maxOpen: 4.9,
  },
};

const backgroundClasses = ["bg-screen", "bg-warm", "bg-clean", "bg-presentation", "bg-chroma"];

let audioContext;
let analyser;
let inputData;
let source;
let stream;
let animationId;
let demo = false;
let currentOpen = 0;
let rawLevel = 0;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function setStatus(text, mode = "") {
  statusEl.textContent = text;
  statusEl.className = `status-pill ${mode}`.trim();
}

function applyRigControls() {
  rig.style.setProperty("--mouth-x", `${controls.mouthX.value}%`);
  rig.style.setProperty("--mouth-y", `${controls.mouthY.value}%`);
  rig.style.setProperty("--mouth-w", `${controls.mouthWidth.value}%`);
  rig.style.setProperty("--avatar-scale", controls.avatarScale.value);
  setMouth(currentOpen, clamp(rawLevel * Number(controls.sensitivity.value)));
}

function setMouth(openAmount, levelAmount = openAmount) {
  const open = clamp(openAmount);
  const level = clamp(levelAmount);
  const maxOpen = Number(controls.maxOpen.value);
  const holeHeight = 5 + open * maxOpen * 10;

  rig.style.setProperty("--mouth-open", open.toFixed(3));
  rig.style.setProperty("--mouth-hole-h", `${holeHeight.toFixed(2)}%`);
  rig.style.setProperty("--mouth-shadow-opacity", (0.16 + open * 0.5).toFixed(3));
  rig.style.setProperty("--mouth-shadow-scale", (0.75 + open * 0.25).toFixed(3));
  rig.style.setProperty("--mouth-hole-y", `${(open * 2).toFixed(2)}%`);
  rig.style.setProperty("--teeth-opacity", clamp((open - 0.24) * 2.4).toFixed(3));
  rig.style.setProperty("--tongue-opacity", (open * 0.8).toFixed(3));
  rig.style.setProperty("--closed-opacity", clamp(1 - open * 4).toFixed(3));
  levelBar.style.width = `${Math.round(level * 100)}%`;
  levelText.textContent = `${Math.round(level * 100)}%`;
}

function stopLoop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = undefined;
  }
}

function stopMic() {
  stopLoop();

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = undefined;
  }

  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }

  audioContext = undefined;
  analyser = undefined;
  source = undefined;
  inputData = undefined;
}

function updateAudioLevel() {
  if (demo) {
    const t = performance.now() / 1000;
    rawLevel =
      0.08 +
      Math.max(0, Math.sin(t * 4.8)) * 0.32 +
      Math.max(0, Math.sin(t * 9.7 + 1.2)) * 0.18;
  } else if (analyser && inputData) {
    analyser.getFloatTimeDomainData(inputData);

    let sum = 0;
    for (let i = 0; i < inputData.length; i += 1) {
      sum += inputData[i] * inputData[i];
    }

    rawLevel = Math.sqrt(sum / inputData.length);
  }

  const sensitivity = Number(controls.sensitivity.value);
  const smoothing = Number(controls.smoothing.value);
  const noiseFloor = demo ? 0.02 : 0.018;
  const targetOpen = clamp((rawLevel - noiseFloor) * sensitivity);

  currentOpen += (targetOpen - currentOpen) * smoothing;
  setMouth(currentOpen, clamp(rawLevel * sensitivity));

  animationId = requestAnimationFrame(updateAudioLevel);
}

async function startMic() {
  demo = false;
  stopMic();
  setStatus("Solicitando", "");
  readout.textContent = "El navegador espera el permiso del microfono.";

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.35;
    inputData = new Float32Array(analyser.fftSize);
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    currentOpen = 0;
    micButton.textContent = "Detener microfono";
    floatMicButton.textContent = "Detener micrófono";
    floatMicButton.classList.remove("primary");
    setStatus("En vivo", "live");
    readout.textContent = "Habla cerca del microfono y ajusta la sensibilidad si hace falta.";
    stopLoop();
    updateAudioLevel();
  } catch (error) {
    setStatus("Sin permiso", "");
    readout.textContent =
      "No pude abrir el microfono. Revisa el permiso del navegador o usa Demo.";
    micButton.textContent = "Activar microfono";
    stopMic();
  }
}

function startDemo() {
  stopMic();
  demo = true;
  currentOpen = 0;
  micButton.textContent = "Activar microfono";
  floatMicButton.textContent = "Activar micrófono";
  floatMicButton.classList.add("primary");
  setStatus("Demo", "demo");
  readout.textContent = "Demo activa.";
  stopLoop();
  updateAudioLevel();
}

function pauseAll() {
  demo = false;
  stopMic();
  currentOpen = 0;
  rawLevel = 0;
  setMouth(0, 0);
  micButton.textContent = "Activar microfono";
  floatMicButton.textContent = "Activar micrófono";
  floatMicButton.classList.add("primary");
  setStatus("En pausa", "");
  readout.textContent = "Listo para hablar";
}

function applyAvatarPreset() {
  const preset = avatarPresets[avatarSelect.value];
  avatarImage.src = preset.src;
  avatarImage.alt = preset.alt;
  controls.mouthX.value = preset.mouthX;
  controls.mouthY.value = preset.mouthY;
  controls.mouthWidth.value = preset.mouthWidth;
  controls.maxOpen.value = preset.maxOpen;
  applyRigControls();
}

function applyStageBackground() {
  clearStageBackground();
  stagePanel.classList.add(`bg-${backgroundSelect.value}`);
}

function clearStageBackground() {
  stagePanel.classList.remove("bg-screen", "bg-warm", "bg-clean", "bg-presentation", "bg-chroma");
}

function applyBackground() {
  rig.classList.remove(...backgroundClasses);
  clearStageBackground();

  if (backgroundSelect.value !== "studio") {
    rig.classList.add(`bg-${backgroundSelect.value}`);
  }

  if (appContainer.classList.contains("recording-mode")) {
    applyStageBackground();
  }
}

function updatePresentationTitle() {
  const title = titleInput.value.trim() || "Titulo de la presentacion";
  presentationTitle.textContent = title;
}

Object.values(controls).forEach((control) => {
  control.addEventListener("input", applyRigControls);
});

avatarSelect.addEventListener("change", applyAvatarPreset);
backgroundSelect.addEventListener("change", applyBackground);
titleInput.addEventListener("input", updatePresentationTitle);

micButton.addEventListener("click", () => {
  if (stream) {
    pauseAll();
    return;
  }

  startMic();
});

demoButton.addEventListener("click", () => {
  if (demo) {
    pauseAll();
  } else {
    startDemo();
  }
});

applyAvatarPreset();
applyBackground();
updatePresentationTitle();
setMouth(0, 0);

// Funciones del modo grabación
let floatControlTimeout;

function showFloatingControlsTemporarily() {
  floatingControlBar.classList.add("visible");
  clearTimeout(floatControlTimeout);
  floatControlTimeout = setTimeout(() => {
    if (appContainer.classList.contains("recording-mode")) {
      floatingControlBar.classList.remove("visible");
    }
  }, 2500);
}

function hideFloatingControls() {
  floatingControlBar.classList.remove("visible");
  clearTimeout(floatControlTimeout);
}

function toggleRecordingMode(forceState) {
  const isRecording = forceState !== undefined ? forceState : !appContainer.classList.contains("recording-mode");

  if (isRecording) {
    appContainer.classList.add("recording-mode");
    applyStageBackground();
    showFloatingControlsTemporarily();

    // Entrar en pantalla completa
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("No se pudo iniciar pantalla completa:", err);
      });
    }
  } else {
    appContainer.classList.remove("recording-mode");
    clearStageBackground();
    hideFloatingControls();

    // Salir de pantalla completa
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.warn("No se pudo salir de pantalla completa:", err);
      });
    }
  }
}

// Sincronizar el estado del modo de grabación con cambios nativos de pantalla completa (ej: presionar Escape)
document.addEventListener("fullscreenchange", () => {
  const isCurrentlyFullscreen = !!document.fullscreenElement;
  const isRecordingMode = appContainer.classList.contains("recording-mode");
  if (!isCurrentlyFullscreen && isRecordingMode) {
    toggleRecordingMode(false);
  }
});


// Event listeners del modo grabación
recordingModeButton.addEventListener("click", () => {
  toggleRecordingMode(true);
});

floatExitButton.addEventListener("click", () => {
  toggleRecordingMode(false);
});

floatMicButton.addEventListener("click", () => {
  if (stream) {
    pauseAll();
  } else {
    startMic();
  }
});

document.addEventListener("mousemove", () => {
  if (appContainer.classList.contains("recording-mode")) {
    showFloatingControlsTemporarily();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (appContainer.classList.contains("recording-mode")) {
      toggleRecordingMode(false);
    }
  } else if (e.key.toLowerCase() === "h") {
    toggleRecordingMode();
  }
});

if (!navigator.mediaDevices?.getUserMedia) {
  micButton.disabled = true;
  floatMicButton.disabled = true;
  readout.textContent = "Este navegador no expone acceso al microfono en esta pagina.";
}

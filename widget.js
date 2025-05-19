
// widget.js

let wmsBaseUrl = "";
let availableLayers = [];
let availableTimes = [];
let selectedLayer = "";
let selectedTime = "";

const container = document.createElement("div");
container.style.padding = "10px";
container.innerHTML = `
  <input id="wms-url" placeholder="Lim inn WMS GetCapabilities-URL" style="width: 100%; margin-bottom: 5px;" />
  <button id="wms-load">Last inn WMS</button>
  <select id="wms-layers" style="width: 100%; margin-top: 10px;"></select>
  <input type="datetime-local" id="wms-time" style="width: 100%; margin-top: 5px; display: none;" />
  <img id="wms-map" style="width: 100%; margin-top: 10px; object-fit: cover;" />
`;
document.body.appendChild(container);

document.getElementById("wms-load").addEventListener("click", async () => {
  wmsBaseUrl = document.getElementById("wms-url").value;
  if (!wmsBaseUrl.toLowerCase().includes("service=wms")) {
    wmsBaseUrl += (wmsBaseUrl.includes("?") ? "&" : "?") + "service=WMS&request=GetCapabilities";
  }
  const xml = await fetch(wmsBaseUrl).then(res => res.text());
  parseGetCapabilities(xml);
});

function parseGetCapabilities(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const layers = Array.from(xml.querySelectorAll("Layer > Layer"));

  const select = document.getElementById("wms-layers");
  select.innerHTML = "";
  availableLayers = layers.map(layer => {
    const name = layer.querySelector("Name")?.textContent;
    const title = layer.querySelector("Title")?.textContent;
    const times = Array.from(layer.querySelectorAll("Dimension[name=\"time\"]"))
      .map(dim => dim.textContent.split(",")[0]);

    const option = document.createElement("option");
    option.value = name;
    option.textContent = title || name;
    select.appendChild(option);

    return { name, title, times };
  });

  select.addEventListener("change", () => {
    selectedLayer = select.value;
    const layerData = availableLayers.find(l => l.name === selectedLayer);
    updateTimeSelector(layerData?.times || []);
  });

  selectedLayer = select.value;
  updateTimeSelector(availableLayers[0]?.times || []);
  subscribeToCamera();
}

function updateTimeSelector(times) {
  const timeInput = document.getElementById("wms-time");
  if (times.length > 0) {
    timeInput.style.display = "block";
    timeInput.value = times[0];
    selectedTime = times[0];
    timeInput.addEventListener("change", () => {
      selectedTime = timeInput.value;
    });
  } else {
    timeInput.style.display = "none";
    selectedTime = "";
  }
}

function subscribeToCamera() {
  StreamBIM.viewer.onCameraChanged(async () => {
    const bbox = await getCurrentBBox();
    if (bbox) updateWMSImage(bbox);
  });
}

async function getCurrentBBox() {
  const camera = await StreamBIM.viewer.getCamera();
  if (!camera || !camera.boundingBox) return null;
  const { min, max } = camera.boundingBox;
  return [
    min.x.toFixed(2),
    min.y.toFixed(2),
    max.x.toFixed(2),
    max.y.toFixed(2),
  ];
}

function updateWMSImage(bbox) {
  if (!selectedLayer) return;
  const baseUrl = wmsBaseUrl.split("?")[0];
  const params = {
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: selectedLayer,
    styles: "",
    crs: "EPSG:25833",
    bbox: bbox.join(","),
    width: 512,
    height: 512,
    format: "image/png",
    transparent: "TRUE"
  };

  if (selectedTime) {
    params.time = selectedTime;
  }

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const url = `${baseUrl}?${query}`;
  document.getElementById("wms-map").src = url;
}

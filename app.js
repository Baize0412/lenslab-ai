const $ = s => document.querySelector(s);
const els = {
  tabs: [...document.querySelectorAll('.mode-tab')], modeLabel: $('.mode-label'), engineStatus: $('#engineStatus'), fileInput: $('#fileInput'), uploadButton: $('#uploadButton'), dropzone: $('#dropzone'), previewPanel: $('#previewPanel'), previewImage: $('#previewImage'), overlayCanvas: $('#overlayCanvas'), cameraPanel: $('#cameraPanel'), cameraVideo: $('#cameraVideo'), cameraCanvas: $('#cameraCanvas'), cameraButton: $('#cameraButton'), stopCameraButton: $('#stopCameraButton'), clearButton: $('#clearButton'), analyzeButton: $('#analyzeButton'), progressWrap: $('#progressWrap'), progressBar: $('#progressBar'), progressLabel: $('#progressLabel'), resultTitle: $('#resultTitle'), resultCount: $('#resultCount'), resultsList: $('#resultsList'), tipMode: $('#tipMode'), toast: $('#toast'), toolCard: $('.tool-card'), filters: $('#objectFilters')
};
const state = { mode: 'objects', filter: 'all', imageReady: false, stream: null, models: {}, pending: {}, runningModes: {}, detecting: false, session: 0, imageUrl: null, lastFrame: -1 };
const modeInfo = { objects: ['物品识别 / OBJECT DETECTION', '物品识别'], gestures: ['手势识别 / GESTURE RECOGNITION', '手势识别'], emotions: ['表情识别 / FACIAL EXPRESSION', '表情识别'] };
const gestureLabels = { Open_Palm: ['张开手掌 / 举手势', 'OPEN PALM'], Victory: ['比耶 / 胜利手势', 'VICTORY'], Thumb_Up: ['点赞', 'THUMBS UP'], Thumb_Down: ['拇指向下', 'THUMBS DOWN'], Pointing_Up: ['指向上方', 'POINTING UP'], ILoveYou: ['我爱你手势', 'I LOVE YOU'], Closed_Fist: ['握拳', 'CLOSED FIST'], None: ['检测到手 · 未匹配手势', 'UNMATCHED HAND'] };
const objectNames = {person:'人',bicycle:'自行车',car:'汽车',motorcycle:'摩托车',airplane:'飞机',bus:'公交车',train:'火车',truck:'卡车',boat:'船','traffic light':'交通灯','fire hydrant':'消防栓','stop sign':'停车标志','parking meter':'停车计时器',bench:'长椅',bird:'鸟',cat:'猫',dog:'狗',horse:'马',sheep:'羊',cow:'牛',elephant:'大象',bear:'熊',zebra:'斑马',giraffe:'长颈鹿',backpack:'背包',umbrella:'雨伞',handbag:'手提包',tie:'领带',suitcase:'行李箱',frisbee:'飞盘',skis:'滑雪板',snowboard:'单板滑雪板','sports ball':'球',kite:'风筝','baseball bat':'棒球棒','baseball glove':'棒球手套',skateboard:'滑板',surfboard:'冲浪板','tennis racket':'网球拍',bottle:'瓶子','wine glass':'酒杯',cup:'杯子',fork:'叉子',knife:'刀',spoon:'勺子',bowl:'碗',banana:'香蕉',apple:'苹果',sandwich:'三明治',orange:'橙子',broccoli:'西兰花',carrot:'胡萝卜','hot dog':'热狗',pizza:'披萨',donut:'甜甜圈',cake:'蛋糕',chair:'椅子',couch:'沙发','potted plant':'盆栽',bed:'床','dining table':'餐桌',toilet:'马桶',tv:'电视',laptop:'笔记本电脑',mouse:'鼠标',remote:'遥控器',keyboard:'键盘','cell phone':'手机',microwave:'微波炉',oven:'烤箱',toaster:'烤面包机',sink:'水槽',refrigerator:'冰箱',book:'书',clock:'时钟',vase:'花瓶',scissors:'剪刀','teddy bear':'玩具熊','hair drier':'吹风机',toothbrush:'牙刷'};
const fruits = new Set(['apple', 'banana', 'orange']);
const food = new Set(['banana','apple','orange','broccoli','carrot','sandwich','hot dog','pizza','donut','cake']);
function wasteHint(name) {
  if (food.has(name)) return '厨余垃圾 · 去除包装后投放';
  if (name === 'bottle') return '可回收物候选 · 普通饮料瓶请倒空；药品瓶、污染瓶另查当地规则';
  if (name === 'book') return '可回收物候选 · 干净纸质书籍';
  if (['laptop','cell phone','keyboard','mouse','tv','remote'].includes(name)) return '电子废弃物 · 交专门回收点，电池单独处理';
  return '分类待确认 · 材质、污染情况与当地规则决定类别';
}
function toast(message) { els.toast.textContent = message; els.toast.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => els.toast.classList.remove('show'), 4200); }
function progress(value, label) { els.progressWrap.classList.remove('hidden'); els.progressBar.style.width = `${value}%`; els.progressLabel.textContent = label; }
function engine(label, ready = false) { els.engineStatus.textContent = label; els.engineStatus.previousElementSibling.style.background = ready ? '#91c66d' : '#ff9276'; }
function clearCanvas(canvas) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
function render(items, title, note = '') {
  els.resultTitle.textContent = title; els.resultCount.textContent = String(items.length).padStart(2, '0'); els.resultsList.replaceChildren();
  if (!items.length) { const empty = document.createElement('div'); empty.className = 'empty-result'; empty.textContent = '暂未发现清晰目标，请调整光线、距离或换一张图片。'; els.resultsList.append(empty); }
  for (const item of items) {
    const row = document.createElement('div'); row.className = 'result-row';
    const name = document.createElement('div'); name.className = 'result-name'; name.textContent = item.name;
    const sub = document.createElement('small'); sub.textContent = item.sub; name.append(sub);
    const track = document.createElement('div'); track.className = 'confidence-track';
    const fill = document.createElement('div'); fill.className = 'confidence-fill'; const score = Math.round(Math.max(0, Math.min(1, item.score)) * 100); fill.style.width = `${score}%`; track.append(fill);
    const value = document.createElement('div'); value.className = 'confidence-value'; value.textContent = item.strength ? `强度 ${score}` : `${score}%`;
    row.append(name, track, value); els.resultsList.append(row);
  }
  if (note) { const p = document.createElement('p'); p.className = 'recognition-note'; p.textContent = note; els.resultsList.append(p); }
}
function emptyResults() { els.resultTitle.textContent = '等待图片或摄像头'; els.resultCount.textContent = '—'; els.resultsList.innerHTML = '<div class="empty-result"><span class="empty-orbit">+</span><p>上传图片或打开摄像头，<br>查看 AI 识别结果</p></div>'; }
function stopCamera() {
  state.session++; state.stream?.getTracks().forEach(track => track.stop()); state.stream = null; els.cameraVideo.srcObject = null;
  els.cameraPanel.classList.add('hidden'); els.dropzone.classList.remove('hidden'); els.cameraButton.classList.remove('hidden'); els.analyzeButton.classList.remove('hidden'); els.analyzeButton.disabled = true; els.progressWrap.classList.add('hidden'); engine('引擎待启动');
}
function resetInput() {
  stopCamera(); state.imageReady = false; if (state.imageUrl) URL.revokeObjectURL(state.imageUrl); state.imageUrl = null; els.fileInput.value = ''; els.previewPanel.classList.add('hidden'); clearCanvas(els.overlayCanvas); emptyResults();
}
function setMode(mode) {
  if (state.detecting) return; resetInput(); state.mode = mode; const info = modeInfo[mode]; els.modeLabel.textContent = info[0]; els.tipMode.textContent = info[1]; els.filters.classList.toggle('hidden', mode !== 'objects');
  els.tabs.forEach(tab => { const active = tab.dataset.mode === mode; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', active); });
}
function selectImage(file) {
  if (state.detecting) return;
  if (!file?.type.startsWith('image/')) return toast('请选择 JPG、PNG 或 WEBP 图片');
  if (file.size > 10 * 1024 * 1024) return toast('图片大小请控制在 10MB 以内');
  resetInput(); state.imageUrl = URL.createObjectURL(file);
  els.previewImage.onload = () => { els.dropzone.classList.add('hidden'); els.previewPanel.classList.remove('hidden'); state.imageReady = true; els.analyzeButton.disabled = false; engine('图片已载入'); };
  els.previewImage.onerror = () => { resetInput(); toast('无法读取这张图片，请换成 JPG 或 PNG'); }; els.previewImage.src = state.imageUrl;
}
function fitCanvas(canvas, source) {
  const rect = source.getBoundingClientRect(), scale = devicePixelRatio || 1; canvas.width = Math.max(1, Math.round(rect.width * scale)); canvas.height = Math.max(1, Math.round(rect.height * scale)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
}
function drawBoxes(canvas, source, predictions) {
  fitCanvas(canvas, source); const ctx = canvas.getContext('2d'), sx = canvas.width / (source.naturalWidth || source.videoWidth), sy = canvas.height / (source.naturalHeight || source.videoHeight);
  ctx.lineWidth = Math.max(2, canvas.width / 360); ctx.font = `600 ${Math.max(12, canvas.width / 45)}px sans-serif`;
  for (const p of predictions) { const [x,y,w,h] = p.bbox, text = `${objectNames[p.class] || p.class} ${Math.round(p.score*100)}%`; ctx.strokeStyle = '#d6f25b'; ctx.strokeRect(x*sx,y*sy,w*sx,h*sy); ctx.fillStyle = '#d6f25b'; ctx.fillRect(x*sx,Math.max(0,y*sy-25),ctx.measureText(text).width+14,25); ctx.fillStyle='#161b19'; ctx.fillText(text,x*sx+7,Math.max(18,y*sy-7)); }
}
function drawLandmarks(canvas, source, groups) {
  fitCanvas(canvas, source); const ctx = canvas.getContext('2d'); ctx.fillStyle = '#d6f25b';
  for (const points of groups) for (const p of points) { ctx.beginPath(); ctx.arc(p.x*canvas.width,p.y*canvas.height,Math.max(1.5,canvas.width/280),0,Math.PI*2); ctx.fill(); }
}
async function cached(key, create) {
  if (state.models[key]) return state.models[key];
  if (!state.pending[key]) state.pending[key] = create().then(model => state.models[key] = model).finally(() => delete state.pending[key]);
  return state.pending[key];
}
async function loadVision() {
  return cached('vision', async () => { progress(25,'正在加载视觉引擎…'); const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm'); state.models.fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'); return vision; });
}
async function loadModel(mode) {
  if (mode === 'objects') return cached('objects', async () => { progress(25,'正在加载物品识别模型…'); return cocoSsd.load({base:'mobilenet_v2'}); });
  const vision = await loadVision(), key = mode === 'gestures' ? 'gesture' : 'face';
  return cached(key, async () => {
    progress(60,'正在加载识别模型…'); const Task = key === 'gesture' ? vision.GestureRecognizer : vision.FaceLandmarker;
    const options = { baseOptions: { modelAssetPath: key === 'gesture' ? 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task' : 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate:'GPU' }, runningMode:'IMAGE', ...(key === 'gesture' ? {numHands:2} : {numFaces:3,outputFaceBlendshapes:true}) };
    let model; try { model = await Task.createFromOptions(state.models.fileset, options); } catch { options.baseOptions.delegate='CPU'; model = await Task.createFromOptions(state.models.fileset, options); }
    state.runningModes[key] = 'IMAGE'; return model;
  });
}
function expression(categories) {
  const get = name => categories.find(c => c.categoryName === name)?.score || 0;
  const candidates = [{name:'微笑',sub:'SMILE',score:(get('mouthSmileLeft')+get('mouthSmileRight'))/2},{name:'张嘴 / 惊讶样表情',sub:'OPEN MOUTH',score:get('jawOpen')},{name:'皱眉',sub:'FROWN',score:(get('browDownLeft')+get('browDownRight'))/2}];
  candidates.sort((a,b)=>b.score-a.score); return candidates[0].score > .35 ? candidates[0] : {name:'自然 / 平静样表情',sub:'NEUTRAL',score:1-candidates[0].score};
}
async function infer(source, canvas, mode, video, session) {
  const model = await loadModel(mode); if (session !== state.session) return; progress(85,'AI 正在观察…');
  if (mode === 'objects') {
    let predictions = await model.detect(source,20,.35); if (session !== state.session) return;
    if (state.filter === 'fruits') predictions = predictions.filter(p => fruits.has(p.class)); drawBoxes(canvas,source,predictions);
    render(predictions.map(p => ({name:objectNames[p.class]||p.class,sub:state.filter==='waste'?wasteHint(p.class):p.class.toUpperCase(),score:p.score})), predictions.length ? `发现 ${predictions.length} 个${state.filter==='fruits'?'水果':'目标'}` : '等待清晰目标', state.filter==='waste'?'分类由识别物品推导，仅供常见物品参考；材质、污染情况与当地规定需人工确认。':state.filter==='fruits'?'当前预训练模型支持苹果、香蕉、橙子。':'物品模型支持 80 类日常目标。');
  } else {
    const key = mode==='gestures'?'gesture':'face', runningMode = video?'VIDEO':'IMAGE';
    if (state.runningModes[key] !== runningMode) { await model.setOptions({runningMode}); state.runningModes[key]=runningMode; } if (session !== state.session) return;
    const result = mode==='gestures' ? (video?model.recognizeForVideo(source,performance.now()):model.recognize(source)) : (video?model.detectForVideo(source,performance.now()):model.detect(source));
    if (mode==='gestures') {
      const items=(result.gestures||[]).map((g,i)=>{const top=g[0],labels=gestureLabels[top?.categoryName]||gestureLabels.None;return {name:labels[0],sub:`手 ${i+1} · ${labels[1]}`,score:top?.score||0};});
      render(items,items.length?'识别到手势':'等待手势','举手势以张开手掌识别；不判断手臂是否举过头顶。'); drawLandmarks(canvas,source,result.landmarks||[]);
    } else {
      const items=(result.faceBlendshapes||[]).map((face,i)=>{const e=expression(face.categories);return {...e,sub:`人脸 ${i+1} · ${e.sub}`,strength:true};});
      render(items,items.length?'面部表情特征':'等待人脸','显示面部动作特征与相对强度，不代表真实情绪或心理状态。'); drawLandmarks(canvas,source,result.faceLandmarks||[]);
    }
  }
  engine('引擎已就绪',true); els.progressWrap.classList.add('hidden');
}
function busy(value) { state.detecting=value; els.tabs.forEach(t=>t.disabled=value); els.cameraButton.disabled=value; els.clearButton.disabled=value; els.analyzeButton.disabled=value || !state.imageReady; }
async function analyzeImage() {
  if (!state.imageReady || state.detecting) return; busy(true); els.toolCard.classList.add('analyzing'); const session=state.session;
  try { await infer(els.previewImage,els.overlayCanvas,state.mode,false,session); } catch(error) { console.error(error); toast('识别失败，请刷新后重试'); engine('需要重试'); }
  finally { busy(false); els.toolCard.classList.remove('analyzing'); els.progressWrap.classList.add('hidden'); }
}
async function startCamera() {
  if (state.detecting || state.stream) return; resetInput(); const session=state.session; els.cameraButton.disabled=true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:720}},audio:false});
    if (session!==state.session) {stream.getTracks().forEach(t=>t.stop());return;}
    state.stream=stream; els.cameraVideo.srcObject=stream; els.dropzone.classList.add('hidden'); els.cameraPanel.classList.remove('hidden'); els.cameraButton.classList.add('hidden'); els.analyzeButton.classList.add('hidden'); await els.cameraVideo.play(); state.lastFrame=-1;
    await loadModel(state.mode); if (session!==state.session) return; cameraLoop(session);
  } catch(error) { console.error(error); stopCamera(); toast('无法启动摄像头或模型，请检查权限后重试'); } finally {els.cameraButton.disabled=false;}
}
async function cameraLoop(session) {
  if (!state.stream || session!==state.session) return;
  try { if (els.cameraVideo.readyState>=2 && els.cameraVideo.currentTime!==state.lastFrame) { state.lastFrame=els.cameraVideo.currentTime; await infer(els.cameraVideo,els.cameraCanvas,state.mode,true,session); } }
  catch(error) { if(session===state.session){console.error(error);stopCamera();toast('实时识别失败，请重新打开摄像头');} return; }
  if(session===state.session) setTimeout(()=>cameraLoop(session),state.mode==='objects'?300:100);
}
els.tabs.forEach(tab=>tab.addEventListener('click',()=>setMode(tab.dataset.mode)));
els.filters.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;els.filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));clearCanvas(els.overlayCanvas);emptyResults();}));
els.uploadButton.addEventListener('click',()=>els.fileInput.click()); els.dropzone.addEventListener('click',e=>{if(!e.target.closest('button'))els.fileInput.click();});
els.fileInput.addEventListener('change',e=>selectImage(e.target.files[0]));
['dragenter','dragover'].forEach(type=>els.dropzone.addEventListener(type,e=>{e.preventDefault();els.dropzone.style.background='#f0f6d4';}));
['dragleave','drop'].forEach(type=>els.dropzone.addEventListener(type,e=>{e.preventDefault();els.dropzone.style.background='';}));
els.dropzone.addEventListener('drop',e=>selectImage(e.dataTransfer.files[0])); els.clearButton.addEventListener('click',resetInput); els.analyzeButton.addEventListener('click',analyzeImage); els.cameraButton.addEventListener('click',startCamera); els.stopCameraButton.addEventListener('click',stopCamera); window.addEventListener('pagehide',stopCamera);
engine('引擎待启动');

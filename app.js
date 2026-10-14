const $ = selector => document.querySelector(selector);
const ui = {
  cameraInput: $('#cameraInput'), albumInput: $('#albumInput'), cameraButton: $('#cameraButton'), albumButton: $('#albumButton'),
  clearButton: $('#clearButton'), preview: $('#preview'), viewerEmpty: $('#viewerEmpty'), video: $('#cameraVideo'), liveBadge: $('#liveBadge'), loading: $('#loading'), loadingText: $('#loadingText'),
  result: $('#result'), confidence: $('#confidence'), resultIcon: $('#resultIcon'), resultCategory: $('#resultCategory'), resultItem: $('#resultItem'), resultAdvice: $('#resultAdvice')
};
const names = {apple:'苹果',banana:'香蕉',orange:'橙子',broccoli:'西兰花',carrot:'胡萝卜',sandwich:'三明治','hot dog':'热狗',pizza:'披萨',donut:'甜甜圈',cake:'蛋糕',bottle:'瓶子',book:'书本','cell phone':'手机',laptop:'笔记本电脑',keyboard:'键盘',mouse:'鼠标',remote:'遥控器',tv:'电视',clock:'时钟',vase:'花瓶',cup:'杯子','wine glass':'酒杯',bowl:'碗',fork:'叉子',knife:'刀',spoon:'勺子',toothbrush:'牙刷',scissors:'剪刀','hair drier':'吹风机',backpack:'背包',handbag:'手提包',umbrella:'雨伞',tie:'领带',suitcase:'行李箱',chair:'椅子',couch:'沙发','potted plant':'盆栽'};
const food = new Set(['apple','banana','orange','broccoli','carrot']);
const preparedFood = new Set(['sandwich','hot dog','pizza','donut','cake']);
const electronics = new Set(['cell phone','laptop','keyboard','mouse','remote','tv','hair drier']);
const recyclable = new Set(['book','bottle','fork','knife','spoon','scissors','backpack','handbag','tie','suitcase']);
const potentialWaste = new Set([...food,...preparedFood,...electronics,'bottle','book','cup','wine glass','bowl','fork','knife','spoon','toothbrush','scissors','clock','vase','backpack','handbag','umbrella','tie','suitcase','chair','couch','potted plant']);
const state = {model:null, modelPromise:null, imageUrl:null, requestId:0, stream:null, cameraStarting:false, timer:null, inference:Promise.resolve()};

function setResult(category, item, advice, icon, tone = 'neutral', score = null, estimated = false) {
  ui.result.dataset.tone = tone;
  ui.resultCategory.textContent = category;
  ui.resultItem.textContent = item;
  ui.resultAdvice.textContent = advice;
  ui.resultIcon.textContent = icon;
  ui.confidence.classList.toggle('hidden', score === null && !estimated);
  ui.confidence.textContent = estimated || (score !== null && score < .55) ? '初步建议' : '分类建议';
}
function classify(label) {
  if (food.has(label) || preparedFood.has(label)) return ['不可回收垃圾', '食物部分投厨余垃圾桶；包装请另行分类。', '◌', 'food'];
  if (electronics.has(label)) return ['可回收垃圾', '送电子产品专门回收点，电池请单独处理。', '♻', 'recycle'];
  if (label === 'book') return ['可回收垃圾', '保持纸张干净、干燥，投入可回收物桶。', '♻', 'recycle'];
  if (label === 'bottle') return ['可回收垃圾', '普通饮料瓶倒空后回收；药品瓶请单独处理。', '♻', 'recycle', true];
  if (recyclable.has(label)) return ['可回收垃圾', '金属或干净织物可回收；塑料餐具投其他垃圾。', '♻', 'recycle', true];
  if (label === 'wine glass') return ['可回收垃圾', '玻璃杯可回收；破损时包好，避免划伤。', '♻', 'recycle', true];
  if (label === 'potted plant') return ['不可回收垃圾', '植物部分按当地厨余规则投放，花盆另行分类。', '◌', 'food', true];
  if (['chair','couch'].includes(label)) return ['其他垃圾', '大件物品请预约回收或送到指定收集点。', '▤', 'other'];
  if (label === 'clock') return ['其他垃圾', '取出电池单独投放，钟表可交专门回收点。', '▤', 'other', true];
  if (['cup','bowl','vase'].includes(label)) return ['其他垃圾', '陶瓷类投其他垃圾；玻璃、金属材质可回收。', '▤', 'other', true];
  return ['其他垃圾', '普通杂物投其他垃圾；电池、药品请单独处理。', '▤', 'other', true];
}
function reset() {
  state.requestId += 1;
  stopCamera();
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = null;
  ui.preview.removeAttribute('src');
  ui.preview.classList.add('hidden');
  ui.viewerEmpty.classList.remove('hidden');
  ui.clearButton.classList.add('hidden');
  ui.clearButton.textContent = '重拍 ×';
  ui.clearButton.setAttribute('aria-label', '移除照片');
  ui.loading.classList.add('hidden');
  ui.cameraInput.value = '';
  ui.albumInput.value = '';
  setResult('等待识别', '可回收 / 不可回收 / 其他垃圾', '轻触画面实时识别，或拍照、相册选图。', '⌕');
}
function stopCamera() {
  clearTimeout(state.timer);
  state.timer = null;
  state.cameraStarting = false;
  const stream = state.stream;
  state.stream = null;
  if (stream) stream.getTracks().forEach(track => track.stop());
  ui.video.pause();
  ui.video.srcObject = null;
  ui.video.classList.add('hidden');
  ui.liveBadge.classList.add('hidden');
}
function detect(model, source, requestId) {
  const task = state.inference.then(() => requestId === state.requestId ? model.detect(source, 20, .2) : []);
  state.inference = task.catch(() => {});
  return task;
}
function showPredictions(predictions, live = false) {
  const candidate = predictions.filter(item => potentialWaste.has(item.class)).sort((a,b) => b.score - a.score)[0];
  if (!candidate) {
    setResult('其他垃圾', '暂按其他垃圾考虑', '电池、药品请单独处理；拍清楚后可获得更准建议。', '▤', 'other', null, true);
    return;
  }
  const [category,advice,icon,tone,estimated = false] = classify(candidate.class);
  const tentative = estimated || candidate.score < .55;
  setResult(category, `${tentative ? '可能是' : '识别到'}${names[candidate.class] || candidate.class}`, advice, icon, tone, candidate.score, estimated);
}
async function startCamera() {
  if (state.cameraStarting || state.stream) return;
  reset();
  const requestId = state.requestId;
  state.cameraStarting = true;
  ui.viewerEmpty.classList.add('hidden');
  ui.loading.classList.remove('hidden');
  ui.loadingText.textContent = '请允许使用前置摄像头…';
  ui.clearButton.textContent = '停止 ×';
  ui.clearButton.setAttribute('aria-label', '停止实时识别');
  ui.clearButton.classList.remove('hidden');
  setResult('正在打开摄像头', '允许权限后开始实时识别', '画面只在当前设备上处理。', '◌');
  let cameraOpened = false;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('CameraUnavailable');
    const stream = await navigator.mediaDevices.getUserMedia({audio:false, video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:480}}});
    if (requestId !== state.requestId) {stream.getTracks().forEach(track => track.stop()); return;}
    state.stream = stream;
    cameraOpened = true;
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (requestId === state.requestId) {
        reset();
        setResult('摄像头已断开', '点击画面重新打开', '也可以拍照或从相册选图。', '!', 'uncertain');
      }
    }, {once:true}));
    ui.video.srcObject = stream;
    ui.video.classList.remove('hidden');
    await ui.video.play();
    if (requestId !== state.requestId) return;
    ui.loadingText.textContent = '正在加载识别模型…';
    const model = await loadModel();
    if (requestId !== state.requestId) return;
    state.cameraStarting = false;
    ui.loading.classList.add('hidden');
    ui.liveBadge.classList.remove('hidden');
    const frame = document.createElement('canvas');
    const context = frame.getContext('2d');
    async function nextFrame() {
      if (requestId !== state.requestId || !state.stream) return;
      try {
        if (ui.video.readyState >= 2 && ui.video.videoWidth) {
          const scale = Math.min(1, 640 / Math.max(ui.video.videoWidth, ui.video.videoHeight));
          frame.width = Math.round(ui.video.videoWidth * scale);
          frame.height = Math.round(ui.video.videoHeight * scale);
          context.drawImage(ui.video, 0, 0, frame.width, frame.height);
          const predictions = await detect(model, frame, requestId);
          if (requestId !== state.requestId) return;
          showPredictions(predictions, true);
        }
        if (requestId === state.requestId) state.timer = setTimeout(nextFrame, 700);
      } catch (error) {
        if (requestId !== state.requestId) return;
        reset();
        setResult('实时识别失败', '点击画面重新尝试', '也可以拍照或从相册选图。', '!', 'uncertain');
      }
    }
    nextFrame();
  } catch (error) {
    if (requestId !== state.requestId) return;
    reset();
    if (['NotAllowedError','PermissionDeniedError'].includes(error.name)) {
      setResult('需要摄像头权限', '请允许浏览器使用摄像头', '允许权限后点击画面重试，或使用相册选图。', '!', 'uncertain');
    } else if (cameraOpened) {
      setResult('实时识别未启动', '请检查网络后重试', '点击画面重试，或使用拍照、相册选图。', '!', 'uncertain');
    } else {
      setResult('无法打开摄像头', '请检查摄像头是否可用', '可尝试在手机浏览器打开，或使用相册选图。', '!', 'uncertain');
    }
  }
}
async function loadModel() {
  if (state.model) return state.model;
  if (!state.modelPromise) {
    if (typeof cocoSsd === 'undefined') throw new Error('识别库未加载');
    state.modelPromise = cocoSsd.load({base:'mobilenet_v2'}).then(model => state.model = model).catch(error => {state.modelPromise = null; throw error;});
  }
  return state.modelPromise;
}
async function analyze(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {setResult('无法读取图片','请选择 JPG、PNG 或 WEBP 图片。','换一张照片后重试。','!','uncertain');return;}
  if (file.size > 15 * 1024 * 1024) {setResult('图片过大','请选择小于 15MB 的图片。','换一张照片后重试。','!','uncertain');return;}
  reset();
  const requestId = ++state.requestId;
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = URL.createObjectURL(file);
  ui.preview.src = state.imageUrl;
  ui.preview.classList.remove('hidden');
  ui.viewerEmpty.classList.add('hidden');
  ui.clearButton.classList.remove('hidden');
  ui.loading.classList.remove('hidden');
  ui.loadingText.textContent = '正在加载识别模型…';
  setResult('正在识别', '请稍候', '图片只在当前设备上处理。', '◌');
  try {
    const image = new Image();
    image.src = state.imageUrl;
    await image.decode();
    if (requestId !== state.requestId) return;
    const model = await loadModel();
    if (requestId !== state.requestId) return;
    ui.loadingText.textContent = '正在分析照片…';
    const predictions = await detect(model, image, requestId);
    if (requestId !== state.requestId) return;
    showPredictions(predictions);
  } catch (error) {
    console.error(error);
    if (requestId === state.requestId) setResult('识别失败','模型暂时无法加载。','请检查网络连接，然后重新选择照片。','!','uncertain');
  } finally {
    if (requestId === state.requestId) ui.loading.classList.add('hidden');
  }
}
ui.viewerEmpty.addEventListener('click', startCamera);
ui.cameraButton.addEventListener('click', () => { if (state.stream || state.cameraStarting) reset(); ui.cameraInput.click(); });
ui.albumButton.addEventListener('click', () => ui.albumInput.click());
ui.cameraInput.addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; analyze(file); });
ui.albumInput.addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; analyze(file); });
ui.clearButton.addEventListener('click', reset);
document.addEventListener('visibilitychange', () => { if (document.hidden && (state.stream || state.cameraStarting)) reset(); });
window.addEventListener('pagehide', reset);

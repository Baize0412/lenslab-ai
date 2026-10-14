const $ = selector => document.querySelector(selector);
const ui = {
  cameraInput: $('#cameraInput'), albumInput: $('#albumInput'), cameraButton: $('#cameraButton'), albumButton: $('#albumButton'),
  clearButton: $('#clearButton'), preview: $('#preview'), viewerEmpty: $('#viewerEmpty'), loading: $('#loading'), loadingText: $('#loadingText'),
  result: $('#result'), confidence: $('#confidence'), resultIcon: $('#resultIcon'), resultCategory: $('#resultCategory'), resultItem: $('#resultItem'), resultAdvice: $('#resultAdvice')
};
const names = {apple:'苹果',banana:'香蕉',orange:'橙子',broccoli:'西兰花',carrot:'胡萝卜',sandwich:'三明治','hot dog':'热狗',pizza:'披萨',donut:'甜甜圈',cake:'蛋糕',bottle:'瓶子',book:'书本','cell phone':'手机',laptop:'笔记本电脑',keyboard:'键盘',mouse:'鼠标',remote:'遥控器',tv:'电视',clock:'时钟',vase:'花瓶',cup:'杯子','wine glass':'酒杯',bowl:'碗',fork:'叉子',knife:'刀',spoon:'勺子',toothbrush:'牙刷',scissors:'剪刀','hair drier':'吹风机',backpack:'背包',handbag:'手提包',umbrella:'雨伞',tie:'领带',suitcase:'行李箱',chair:'椅子',couch:'沙发','potted plant':'盆栽'};
const food = new Set(['apple','banana','orange','broccoli','carrot']);
const preparedFood = new Set(['sandwich','hot dog','pizza','donut','cake']);
const electronics = new Set(['cell phone','laptop','keyboard','mouse','remote','tv','hair drier']);
const potentialWaste = new Set([...food,...preparedFood,...electronics,'bottle','book','cup','wine glass','bowl','fork','knife','spoon','toothbrush','scissors','clock','vase','backpack','handbag','umbrella','tie','suitcase','chair','couch','potted plant']);
const state = {model:null, modelPromise:null, imageUrl:null, requestId:0};

function setResult(category, item, advice, icon, tone = 'neutral', score = null) {
  ui.result.dataset.tone = tone;
  ui.resultCategory.textContent = category;
  ui.resultItem.textContent = item;
  ui.resultAdvice.textContent = advice;
  ui.resultIcon.textContent = icon;
  ui.confidence.classList.toggle('hidden', score === null);
  if (score !== null) ui.confidence.textContent = `识别可信度 ${Math.round(score * 100)}%`;
}
function classify(label) {
  if (food.has(label)) return ['厨余垃圾', '去除塑料袋、贴纸等包装后投放。', '◌', 'food'];
  if (preparedFood.has(label)) return ['厨余垃圾', '食物部分属于厨余；包装请按材质另行分类。', '◌', 'food'];
  if (label === 'book') return ['可回收物', '干净、干燥的纸质书本可回收。', '♻', 'recycle'];
  if (electronics.has(label)) return ['电子废弃物', '交给电子产品回收点；电池请单独处理。', '▣', 'electronic'];
  if (label === 'bottle') return ['先确认材质', '饮料瓶倒空后通常可回收；药品瓶或污染瓶需按当地规定。', '?', 'uncertain'];
  if (['cup','wine glass','bowl','fork','knife','spoon'].includes(label)) return ['先确认材质', '同类物品可能由不同材质制成，请按材质和污染情况分类。', '?', 'uncertain'];
  return ['需要人工判断', '仅凭照片无法确认材质和用途，请参考当地分类规则。', '?', 'uncertain'];
}
function reset() {
  state.requestId += 1;
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = null;
  ui.preview.removeAttribute('src');
  ui.preview.classList.add('hidden');
  ui.viewerEmpty.classList.remove('hidden');
  ui.clearButton.classList.add('hidden');
  ui.loading.classList.add('hidden');
  ui.cameraInput.value = '';
  ui.albumInput.value = '';
  setResult('等待照片', '拍照或选图后显示分类建议', '建议只拍一个物品，保持光线充足。', '⌕');
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
    await ui.preview.decode();
    if (requestId !== state.requestId) return;
    const model = await loadModel();
    if (requestId !== state.requestId) return;
    ui.loadingText.textContent = '正在分析照片…';
    const predictions = await model.detect(ui.preview, 20, .3);
    if (requestId !== state.requestId) return;
    const candidate = predictions.filter(item => potentialWaste.has(item.class)).sort((a,b) => b.score - a.score)[0];
    if (!candidate) {setResult('暂时无法判断','没有识别到可分类的常见物品。','请靠近物品、保持光线充足，重新拍一张。','?','uncertain');return;}
    const [category,advice,icon,tone] = classify(candidate.class);
    setResult(category,`${names[candidate.class] || candidate.class} · 分类建议`,advice,icon,tone,candidate.score);
  } catch (error) {
    console.error(error);
    if (requestId === state.requestId) setResult('识别失败','模型暂时无法加载。','请检查网络连接，然后重新选择照片。','!','uncertain');
  } finally {
    if (requestId === state.requestId) ui.loading.classList.add('hidden');
  }
}
ui.cameraButton.addEventListener('click', () => ui.cameraInput.click());
ui.albumButton.addEventListener('click', () => ui.albumInput.click());
ui.cameraInput.addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; analyze(file); });
ui.albumInput.addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; analyze(file); });
ui.clearButton.addEventListener('click', reset);

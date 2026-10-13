# LensLab · AI 图像识别

一个无需后端的浏览器端视觉实验室，支持：

- 物品识别：TensorFlow.js COCO-SSD
- 手势识别：MediaPipe Gesture Recognizer（举手、比耶、点赞、握拳等）
- 人脸表情：MediaPipe Face Landmarker blendshapes（微笑、张嘴、皱眉、自然表情等，显示面部动作强度）
- 水果模式：支持苹果、香蕉、橙子
- 常见垃圾分类提示：根据物品标签给出投放建议，材质、污染情况和当地规则需人工确认
- 图片上传、拖放和摄像头实时识别
- 识别过程在浏览器本地完成，图片不会上传
- `qr.html?url=...` 可为部署后的公网地址生成二维码

## 本地运行

直接用静态服务器打开（摄像头需要 HTTPS 或 localhost）：

```bash
python3 -m http.server 4173
```

打开 http://localhost:4173 。

## 公网访问

https://baize0412.github.io/lenslab-ai/

## 模型与范围

网页从官方 CDN 和模型托管地址加载推理代码、WASM 与预训练模型，首次识别需要网络，之后由浏览器缓存。图片与摄像头画面在浏览器本地处理，不上传。物品模型支持 COCO 80 类目标；举手势指张开手掌，不判断手臂位置；表情结果描述面部动作，不判断真实心理状态。

资源来源：TensorFlow.js 4.22.0（Apache-2.0）、COCO-SSD 2.2.3（Apache-2.0）、MediaPipe Tasks Vision 0.10.21（Apache-2.0）、QRCode.js 1.0.0（MIT）。模型分别来自 Google 官方 tfjs-models 和 mediapipe-models 存储库。

## GitHub Pages

仓库已包含 `.github/workflows/pages.yml`。将仓库推送到 GitHub 后，在仓库 Settings → Pages 中选择 GitHub Actions，工作流会自动发布站点。

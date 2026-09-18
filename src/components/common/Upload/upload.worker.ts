/**
 * 文件 Hash Worker（基于 spark-md5）
 *
 * 特性：
 *  - 全量 hash，秒传 / 断点续传 100% 准确
 *  - 流式 append，内存只跟单分片大小挂钩
 *  - 主线程 transfer ArrayBuffer 零拷贝
 *  - 进度节流上报
 *  - 支持 cancel
 */

import SparkMD5 from "spark-md5";

interface InitMessage {
  type: "init";
  fileName: string;
  fileSize: number;
  totalChunks: number;
}

interface ChunkMessage {
  type: "chunk";
  index: number;
  buffer: ArrayBuffer;
}

interface CancelMessage {
  type: "cancel";
}

type WorkerMessage = InitMessage | ChunkMessage | CancelMessage;

let spark: SparkMD5.ArrayBuffer | null = null;
let fileName = "";
let fileSize = 0;
let totalChunks = 0;
let receivedChunks = 0;
let canceled = false;
let finished = false;
let lastReport = 0;

function reportProgress(force = false): void {
  const now = Date.now();
  if (!force && now - lastReport < 60) return;
  lastReport = now;

  globalThis.postMessage({
    type: "progress",
    received: receivedChunks,
    total: totalChunks,
    percent: totalChunks > 0 ? Math.round((receivedChunks / totalChunks) * 100) : 0,
  });
}

function appendMeta(): void {
  if (!spark) return;
  const meta = new TextEncoder().encode(`${fileName}:${fileSize}:`);
  spark.append(meta.buffer as ArrayBuffer);
}

async function finalize(): Promise<void> {
  if (finished) return;
  finished = true;

  if (canceled) {
    globalThis.postMessage({ type: "canceled" });
    return;
  }

  try {
    if (!spark) throw new Error("spark-md5 未初始化");
    const hash = spark.end();
    globalThis.postMessage({ type: "complete", hash });
  } catch (err) {
    globalThis.postMessage({
      type: "error",
      message: (err as Error).message || "hash 计算失败",
    });
  } finally {
    spark = null;
    receivedChunks = 0;
    totalChunks = 0;
    fileName = "";
    fileSize = 0;
  }
}

globalThis.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === "init") {
    spark = new SparkMD5.ArrayBuffer();
    fileName = msg.fileName;
    fileSize = msg.fileSize;
    totalChunks = msg.totalChunks;
    receivedChunks = 0;
    canceled = false;
    finished = false;
    lastReport = 0;

    appendMeta();
    globalThis.postMessage({ type: "ready" });
    return;
  }

  if (msg.type === "chunk") {
    if (!spark || canceled || finished) return;

    spark.append(msg.buffer);
    receivedChunks++;

    reportProgress();

    if (receivedChunks === totalChunks) {
      reportProgress(true);
      await finalize();
    }
    return;
  }

  if (msg.type === "cancel") {
    canceled = true;
    spark = null;
    globalThis.postMessage({ type: "canceled" });
  }
};

export {};

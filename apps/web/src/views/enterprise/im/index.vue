<script setup lang="ts">
import type {
  ImFrame,
  ImLimits,
  ImMessage,
  MentionMember,
} from '@antdv/common-ui/im';

import { computed, onBeforeUnmount, ref } from 'vue';

import { Alert, Card, Space } from '@antdv/common-ui';
import {
  configureIm,
  createConfiguredIm,
  createMemoryTransport,
  DEFAULT_LIMITS,
  ImPanel,
  MESSAGE_VIRTUALIZE_THRESHOLD,
  resetImRuntime,
} from '@antdv/common-ui/im';
import { message } from '@antdv/popup-ui';
import { Badge, Button, Separator } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * IM 即时通讯示例。
 *
 * **全程离线**：传输层用 `createMemoryTransport({ server })`，"服务端"就是本页闭包里的一段剧本函数。
 * 它不是 socket 的近似，而是同一契约的另一种实现 —— 出帧照样走 `encodeFrame` → `decodeFrame`，
 * 断线照样排队。所以在这里跑通的链路换到 `createSocketTransport({ url })` 不会失真。
 * 接真实长连接只有两个动作：`configureIm({ transport })`（或只给 `url`）与把 `userId` 换成宿主登录态，
 * 状态机、面板、输入区三处代码一行都不用改 —— 这就是本包不 import `~/api`、不 `new WebSocket` 的换取方式。
 *
 * 分工口径：`core/use-im.ts` 是唯一的状态机（乐观发送 + ack 改名 + 已读回执 + typing 节流 + 撤回窗口），
 * `components/*` 只画在 core 的形状上，基础控件全部来自 `@antdv/shadcn-ui`；
 * 实时通信本身仍然住在 `@antdv/request`（两处各起心跳与重连是线上最难查的那类故障），
 * 失败提示也留给宿主决定形态（包只发事件，连 `@antdv/popup-ui` 都不依赖）。
 */

const SELF = 'me';
const PEER = 'peer';
const COLLEAGUE = 'p2';
const SINGLE_ID = 'c-single';
const GROUP_ID = 'c-group';

/** 剧本用的确定性话术：来回几句就够看清气泡、状态图标与"正在输入" */
const REPLIES = [
  '收到，我看一下这份报表的口径。',
  '聚合那层已经按 region 分好了，你要的是明细还是汇总？',
  '好的，下午三点前给你。',
  '这条我得确认下，稍等。',
];

let replyCursor = 0;
let peerCursor = 0;

/** 演示"发送失败 → 重发"：翻一次开关，下一台上行帧就换一条 `ack:failed` */
const forceNextFailure = ref(false);

/** 本页把正文上限压到 30 字，好让"超限即禁用发送并说出原因"这条路真的走到 */
const composerLimits: Partial<ImLimits> = {
  maxAttachmentsPerMessage: 2,
  maxMessageLength: 30,
};

const members: MentionMember[] = [
  { id: PEER, name: '李珊' },
  { id: COLLEAGUE, name: '王工' },
  { id: SELF, name: '我' },
];

const nameOf = (userId: string): string =>
  members.find((member) => member.id === userId)?.name ?? userId;

/** 头像地址由宿主给：`avatarOf` 返回 undefined 时组件退化成占位，不自己猜 CDN */
const avatarOf = (userId: string): string | undefined =>
  userId === SELF ? undefined : `https://sealed.example/avatar/${userId}.png`;

/**
 * 演示时钟：注入的 `now()` 同时决定乐观消息的时间戳与撤回窗口判定。
 * 所以"撤回超窗"在这里是点一下按钮就能看到的结果，而不是等两分钟。
 */
const clock = ref(Date.now());
const timers: ReturnType<typeof setTimeout>[] = [];

/**
 * 历史存档：从现在往前每 3 分钟一条，共 400 条。
 * 只把最近 120 条塞进 seed —— 超过 `MESSAGE_VIRTUALIZE_THRESHOLD`（100）才会走虚拟列表，
 * 剩下的靠上滑翻页，游标是「本页最早一条的 createdAt」而不是 offset
 * （用 offset 翻页时中间只要有人发言，下一页就重复或漏一条）。
 */
const ARCHIVE_SIZE = 400;
const SEEDED_COUNT = 120;

const archive: ImMessage[] = Array.from(
  { length: ARCHIVE_SIZE },
  (_, index) => {
    const createdAt = Date.now() - (ARCHIVE_SIZE - index) * 180_000;
    const mine = index % 5 === 2;
    const text = mine
      ? `同步进度：第 ${index + 1} 条我方发言`
      : `第 ${index + 1} 条：这块的口径再对一次`;
    return {
      body: text,
      conversationId: SINGLE_ID,
      createdAt,
      id: `arch-${index}`,
      kind: 'text',
      senderId: mine ? SELF : PEER,
      text,
    };
  },
);

/** 剧本服务端：上行帧进、下行帧出，全部同步或延时 emit，不碰网络 */
function scriptedServer(frame: ImFrame, emit: (frame: ImFrame) => void): void {
  if (frame.type === 'send') {
    const sent = frame.payload.message;
    if (forceNextFailure.value) {
      forceNextFailure.value = false;
      emit({
        payload: {
          clientId: sent.id,
          reason: '本地剧本模拟的发送失败',
          status: 'failed',
        },
        type: 'ack',
      });
      return;
    }
    // ack 带 serverId 时状态机原地改名：气泡不闪、引用与回复仍然指得上
    emit({
      payload: {
        clientId: sent.id,
        serverId: `srv-${sent.id}`,
        status: 'sent',
      },
      type: 'ack',
    });
    if (sent.conversationId !== SINGLE_ID) return;
    const text = REPLIES[replyCursor++ % REPLIES.length] ?? '收到。';
    const reply: ImMessage = {
      body: text,
      conversationId: SINGLE_ID,
      createdAt: clock.value,
      id: `peer-${peerCursor++}`,
      kind: 'text',
      senderId: PEER,
      text,
    };
    // 先「正在输入」再回话最后收起：这三帧的顺序就是真实客户端看到的样子
    timers.push(
      setTimeout(
        () =>
          emit({
            payload: { conversationId: SINGLE_ID, typing: true, userId: PEER },
            type: 'typing',
          }),
        260,
      ),
      setTimeout(
        () => emit({ payload: { message: reply }, type: 'message' }),
        1200,
      ),
      setTimeout(
        () =>
          emit({
            payload: { conversationId: SINGLE_ID, typing: false, userId: PEER },
            type: 'typing',
          }),
        1300,
      ),
    );
    return;
  }
  if (frame.type === 'history') {
    const {
      before,
      conversationId,
      limit = DEFAULT_LIMITS.historyPageSize,
    } = frame.payload;
    if (conversationId !== SINGLE_ID) {
      emit({
        payload: { conversationId, hasMore: false, messages: [] },
        type: 'history',
      });
      return;
    }
    const older = archive.filter(
      (item) => item.createdAt < (before ?? Date.now()),
    );
    const page = older.slice(-limit);
    // 故意延时一帧再回：真实长连接的"上一页"是有往返的，而同步回帧会让这一页与用户那次滚动
    // 落进同一个 flush —— 补偿逻辑（`anchorTo:'end'` 的偏移、贴底重钉的距离判据）读到的都是
    // 上一帧的位置，于是演示里能看到"翻页瞬间跳位"，而线上换 `createSocketTransport` 反而不复现。
    // 延时让剧本和真实传输同形，e2e 才测得到"在途不连发"这条链路。
    timers.push(
      setTimeout(
        () =>
          emit({
            payload: {
              conversationId,
              hasMore: older.length > page.length,
              messages: page,
            },
            type: 'history',
          }),
        120,
      ),
    );
  }
}

const transport = createMemoryTransport({ server: scriptedServer });

configureIm({
  // blob URL 的 `revokeObjectURL` 时机只有握住 File 的宿主知道，所以包不自己造，由这里注入
  createObjectUrl: (source) => URL.createObjectURL(source as Blob),
  now: () => clock.value,
  transport,
  userId: SELF,
});

const { im } = createConfiguredIm({
  seed: {
    conversations: [
      {
        id: SINGLE_ID,
        kind: 'single',
        memberIds: [SELF, PEER],
        title: '李珊',
        unread: 0,
      },
      {
        id: GROUP_ID,
        kind: 'group',
        memberIds: [SELF, PEER, COLLEAGUE],
        title: '报表项目群',
        unread: 3,
      },
    ],
    messages: archive.slice(-SEEDED_COUNT),
  },
});

transport.connect();
im.openConversation(SINGLE_ID);

const unreadTotal = computed(() =>
  im.conversations.value.reduce((sum, item) => sum + item.unread, 0),
);

const isVirtualized = computed(
  () => im.messages.value.length > MESSAGE_VIRTUALIZE_THRESHOLD,
);

const frameTail = computed(() => im.frames.value.slice(-8).reverse());

/** 群里的未读靠"对方发言"演示：直接造一条下行帧，不经服务端 */
function peerSpeaksInGroup(): void {
  const text = `@我 第 ${peerCursor++} 条：这份 DSL 我要看下校验规则`;
  const next: ImMessage = {
    body: text,
    conversationId: GROUP_ID,
    createdAt: clock.value,
    id: `grp-${peerCursor}`,
    kind: 'text',
    mentions: [SELF],
    senderId: COLLEAGUE,
    text,
  };
  transport.emitFrame({ payload: { message: next }, type: 'message' });
}

/** 在线状态一帧一个人，列表项上的小圆点跟着变 */
function togglePresence(): void {
  const online = im.presences.value[PEER] !== 'online';
  transport.emitFrame({
    payload: { presence: online ? 'online' : 'away', userId: PEER },
    type: 'presence',
  });
}

/** 坏帧：诊断通道给的是一段可展示的文案，面板顶上一条可关的红条，不是异常也不是 toast */
function emitBadFrame(): void {
  transport.emitDiagnostic(
    '服务端返回了无法解析的帧（示例诊断；真实场景多为灰度期协议不匹配）',
    '{oops',
  );
}

/** 撤回：窗口内成功、超窗给出原因，两种结果都是 `ImActionOutcome`，界面不猜 */
function recallLast(): void {
  const last = im.messages.value
    .filter((item) => item.senderId === SELF)
    .at(-1);
  if (last === undefined) {
    message.info('先自己发一条消息，再点「撤回最近一条」');
    return;
  }
  const outcome = im.recall(last.id);
  if (!outcome.ok) message.warning(outcome.reason ?? '撤回失败');
}

/** 把注入的时钟往前拨过撤回窗口：状态机读的就是这个值，所以当场就超窗 */
function advanceClock(): void {
  clock.value += DEFAULT_LIMITS.recallWindowMs + 1;
  message.info(
    `时钟已拨到 ${new Date(clock.value).toLocaleTimeString()}（超过撤回窗口）`,
  );
}

/** 附件怎么打开是宿主的决定：包只把 (attachment, message) 交回来，不猜预览还是下载 */
function onOpenAttachment(): void {
  message.info('收到 openAttachment —— 预览/下载/新窗口由宿主决定');
}

function resetRuntime(): void {
  resetImRuntime();
  message.info('已清空注入的运行时；本页刷新后会重新 configure 一次');
}

onBeforeUnmount(() => {
  for (const timer of timers) clearTimeout(timer);
  timers.length = 0;
  transport.disconnect();
});

const containerClassName = cn('space-y-6');
const hintClassName = cn('text-sm', 'leading-relaxed', 'text-muted-foreground');
const codeClassName = cn(
  'rounded-sm',
  'bg-muted',
  'px-1',
  'py-0.5',
  'font-mono',
  'text-xs',
);
</script>

<template>
  <div :class="containerClassName">
    <!-- 1. 面板 -->
    <Card title="会话面板（列表 + 消息流 + 输入区）" variant="borderless">
      <Alert
        show-icon
        type="info"
        message="全程离线：服务端是本页的一段剧本函数"
        description="出帧照样走 encodeFrame → decodeFrame，断线照样排队，所以这里跑通的链路换到 createSocketTransport 不会失真。"
      />
      <p :class="cn(hintClassName, 'mt-3')">
        seed 给单聊灌了 <code :class="codeClassName">120</code> 条消息，超过
        <code :class="codeClassName">MESSAGE_VIRTUALIZE_THRESHOLD =
          {{ MESSAGE_VIRTUALIZE_THRESHOLD }}</code>， 所以这一栏走
        <code :class="codeClassName">@tanstack/vue-virtual</code>
        的虚拟列表（锚定在末尾）。 滚到顶会发一帧
        <code :class="codeClassName">history</code>，剧本按
        <code :class="codeClassName">before</code> 游标回一页 —— 补滚动位置由
        <code :class="codeClassName">MessagePane</code> 的
        <code :class="codeClassName">classifyChange</code> 判定，
        正在看历史的用户不会被拽回底部。
      </p>
      <Space :size="4" class="mt-3" wrap>
        <Badge variant="outline">{{ im.status.value }}</Badge>
        <Badge variant="secondary">
          当前会话 {{ im.activeConversationId.value ?? '—' }}
        </Badge>
        <Badge variant="secondary">未读合计 {{ unreadTotal }}</Badge>
        <Badge :variant="isVirtualized ? 'secondary' : 'outline'">
          {{ im.messages.value.length }} 条{{
            isVirtualized ? '（虚拟列表）' : '（整表）'
          }}
        </Badge>
      </Space>
      <Space :size="4" class="mt-3" wrap>
        <Button size="sm" variant="outline" @click="peerSpeaksInGroup">
          让同事在群里发言
        </Button>
        <Button size="sm" variant="outline" @click="togglePresence">
          切换对方在线状态
        </Button>
        <Button size="sm" variant="outline" @click="forceNextFailure = true">
          让下一条发送失败
        </Button>
        <Button size="sm" variant="outline" @click="advanceClock">
          把时钟拨过撤回窗口
        </Button>
        <Button size="sm" variant="outline" @click="recallLast">
          撤回最近一条
        </Button>
        <Button size="sm" variant="outline" @click="emitBadFrame">
          塞一条坏帧
        </Button>
        <Button size="sm" variant="ghost" @click="resetRuntime">
          清空注入的运行时
        </Button>
      </Space>
      <Separator class="my-4" />
      <ImPanel
        :avatar-of="avatarOf"
        :im="im"
        :limits="composerLimits"
        :members="members"
        :name-of="nameOf"
        class="h-[560px]"
        self-id="me"
        @open-attachment="onOpenAttachment"
      />
      <p :class="cn(hintClassName, 'mt-2')">
        正文上限被这页压到
        <code :class="codeClassName">30</code> 字：超限时按钮禁用并且
        <strong>原因直接写在输入区下方</strong> —— 禁用后的按钮收不到
        click，靠"点了才说原因"等于永远不说。
        「先自己发一条，再点撤回最近一条」可以看撤回窗口内外的两种结果；
        把时钟拨过窗口之后，同一条会给出「已超过撤回时限（2 分钟）」。
      </p>
    </Card>

    <!-- 2. 帧日志 -->
    <Card title="协议帧（上行 / 下行都记，最近 8 条）" variant="borderless">
      <p :class="hintClassName">
        <code :class="codeClassName">im.frames</code>
        是状态机留下的环形日志（上限
        <code :class="codeClassName">FRAME_LOG_LIMIT = 50</code>）。"消息没发出去"到底是没进队列、 transport 没连上，还是服务端回了
        <code :class="codeClassName">ack:failed</code>， 看一眼顺序就知道 ——
        这也是本页敢用假传输做回归的底气。
      </p>
      <pre
        class="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs"
        >{{ JSON.stringify(frameTail, null, 2) }}</pre>
    </Card>

    <!-- 3. 口径说明 -->
    <Card title="几条写在包里的硬口径" variant="borderless">
      <ul class="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
        <li>
          乐观发送：本地先出 <code :class="codeClassName">pending</code> 气泡，
          <code :class="codeClassName">ack</code> 带
          <code :class="codeClassName">serverId</code> 时原地改名， 失败进
          outbox 并可 <code :class="codeClassName">retry</code>。
        </li>
        <li>
          未读只在「不是当前会话且不是自己发的」时累加；正在看的会话收到即已读，并回一帧
          <code :class="codeClassName">read</code>；翻历史页永远不算未读，也不改
          <code :class="codeClassName">lastMessageAt</code>（否则翻到很久以前会让会话跳到列表最前面）。
        </li>
        <li>
          <code :class="codeClassName">typing</code> 上行按
          {{ DEFAULT_LIMITS.typingThrottleMs }} ms 节流、 对端状态
          {{ Math.round(DEFAULT_LIMITS.typingTimeoutMs / 1000) }} s
          无刷新自动收起 —— 没有后者，对方关了页面时"正在输入"会永远挂着。
        </li>
        <li>
          撤回时限判定用注入的
          <code :class="codeClassName">now()</code>，所以演示与单测里跨窗是确定的，不用真等。
        </li>
        <li>
          草稿按会话分桶且只活在组件里：落 localStorage
          属于宿主策略（有的租户要求"离开即清空"）。
        </li>
      </ul>
      <p :class="cn(hintClassName, 'mt-3')">
        出厂限额：正文 {{ DEFAULT_LIMITS.maxMessageLength }} 字 / 附件
        {{ DEFAULT_LIMITS.maxAttachmentsPerMessage }} 个 ×
        {{ DEFAULT_LIMITS.maxAttachmentSizeMb }} MB / 历史每页
        {{ DEFAULT_LIMITS.historyPageSize }} 条 / 撤回
        {{ Math.round(DEFAULT_LIMITS.recallWindowMs / 60_000) }} 分钟。宿主在
        <code :class="codeClassName">configureIm({ limits })</code> 里逐档覆盖，
        输入区与状态机吃同一份 ——
        两边口径不一致时，界面拦不住而状态机偷偷丢消息。
      </p>
    </Card>

    <!-- 4. 接线说明 -->
    <Card title="接到真实长连接上" variant="borderless">
      <p :class="hintClassName">
        只有两个接线点：<code :class="codeClassName">configureIm()</code>
        注入传输层与登录态，
        <code :class="codeClassName">createConfiguredIm()</code>
        装一套实例。实时通信本身仍然住在
        <code :class="codeClassName">@antdv/request</code>：本包只有
        <code :class="codeClassName">core/transport.ts</code> 一个文件允许
        import 它，且只调 <code :class="codeClassName">useWebSocket</code>。
      </p>
      <pre class="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{{
        `import { createSocketTransport } from '@antdv/common-ui/im';\n\nconfigureIm({\n  // 1) 地址与鉴权都在宿主侧：url 写成函数，登录后再算\n  transport: createSocketTransport({\n    url: () => 'wss://' + location.host + '/im',\n  }),\n  // 2) 字符串与函数两种写法都收：登录态会变就给函数\n  userId: () => userStore.userId,\n  // 3) 逐档增量覆盖，其余仍用出厂值\n  limits: { maxMessageLength: 500 },\n});\n\nconst { im } = createConfiguredIm({ seed: initialFromServer });\n// 心跳、重连、离线排队（超上限才丢弃并报诊断）全在 transport 里\nim.connect();`
      }}</pre>
      <p :class="cn(hintClassName, 'mt-2')">
        要接自己那套 WS 实现也不必改本包：写一个满足
        <code :class="codeClassName">ImTransport</code>（<code
          :class="codeClassName"
          >status</code>
        / <code :class="codeClassName">on</code> /
        <code :class="codeClassName">send</code> /
        <code :class="codeClassName">connect</code> /
        <code :class="codeClassName">disconnect</code>） 的对象交给
        <code :class="codeClassName">configureIm({ transport })</code> 就行 ——
        本页的
        <code :class="codeClassName">createMemoryTransport</code>
        就是这么一个实现。
      </p>
    </Card>
  </div>
</template>

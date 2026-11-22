/* 同殿静默共处：参考韩国 Sansa（山寺）线上寺庙的多人设定。
   零注册、随机道号、看得见满殿其他香客、没有聊天/好友/排行榜，
   唯一的社会性动作是「合掌致意」；什么都不做挂机放空也算玩。

   数据面用云端数据库做轻量状态同步：每个客户端定时 upsert 自己的一行，
   再拉取 20 秒内仍在上报的其他人。表内只有展示用的昵称、衣色、坐标与
   动作姿态，没有任何身份、账号或隐私数据。云端不可用（本地预览、CDN
   被挡、额度用尽、未登录正式域名）时一律退回「独拜」，单人玩法完全不受影响。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  /* 由云服务激活返回的 publicConfig 原样写入前端。应用复用同一个
     applicationId，重新发布不会换域名，因此这个 endpoint 保持稳定。
     严禁改成从 window.location / 环境变量推导：服务端按 Origin 精确校验。 */
  var PUBLIC_CONFIG = {
    endpoint: 'https://wbapp-wretyamznrhexg0387oxjb.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_WrETYamZnrhEXG0387OxjB_x5ZXvMtecM8PQyf6CCRs6TeyBBb401Qt'
  };

  /* 纯 HTML 项目用 CDN 的 IIFE 构建（@dev 通道），不引入打包器。 */
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js';

  var HEARTBEAT_MS = 3000;   /* 上报自身状态的间隔 */
  var FETCH_MS = 3200;       /* 拉取同殿香客与致意的间隔 */
  var TTL_MS = 20000;        /* 超过 20 秒没上报就当作已离殿 */
  var GREET_TTL_MS = 30000;  /* 合掌致意只保留 30 秒内的新消息 */
  var GREET_POSE_MS = 4200;  /* 合十姿态在角色身上停留的时间 */
  var MAX_PEERS = 60;        /* 同屏最多渲染 60 位真人香客 */

  /* Sansa 式随机法号，改成青城道观的意象：形容词 + 的 + 名词。
     免注册、不捏脸，打开即有一个安静的身份。 */
  var ADJ = ['清澈', '温暖', '宁静', '澄明', '闲散', '柔软', '无事', '自在',
    '安稳', '半醒', '淡淡', '清亮', '疏懒', '朴素'];
  var NOUN = ['松风', '雨滴', '山岚', '炉烟', '石泉', '云影', '晚钟', '苔痕',
    '月光', '清风', '溪声', '香灰', '鹤影', '微尘'];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randomDaoHao() { return pick(ADJ) + '的' + pick(NOUN); }

  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* 隐私模式下忽略 */ }
  }

  function makeClientId() {
    var saved = readStore('caishen.clientId');
    if (saved) { return saved; }
    var rnd = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    writeStore('caishen.clientId', rnd);
    return rnd;
  }

  function outfitById(id) {
    var list = (CS.Config && CS.Config.OUTFITS) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { return list[i]; }
    }
    return list[0] || { id: 'red', robe: '#d8323c', robeDark: '#a71f2b', trim: '#ffd45e' };
  }

  /* 把云端错误翻译成人话；不把原始错误、令牌或行数据抛给界面。 */
  function friendlyError(err) {
    var msg = String((err && (err.message || err.code)) || err || '');
    if (/401|credential|publishable|origin|403/i.test(msg)) {
      return '同殿只在正式分享域名下开放';
    }
    if (/42P01/i.test(msg)) { return '同殿尚未就绪'; }
    if (/42501/i.test(msg)) { return '同殿权限暂未开放'; }
    if (/quota|credit|limit/i.test(msg)) { return '云端额度暂不可用'; }
    if (/fetch|network|timeout|failed/i.test(msg)) { return '网络未连通'; }
    return '同殿暂时断开';
  }

  function Multiplayer(game) {
    this.game = game;
    this.cloud = null;
    this.sdkState = 'idle';       /* idle | loading | ready | failed */
    this.state = 'loading';       /* loading | online | offline */
    this.reason = '';
    this.id = makeClientId();
    this.nickname = randomDaoHao();
    this.outfitId = 'red';
    this.peers = [];
    this.rawPeers = [];
    this.lastGreetingId = 0;
    this.selfGreetUntil = 0;
    this.started = false;
    this.busy = false;
    this.busySince = 0;
    this.failCount = 0;
    this.heartbeatTimer = null;
    this.fetchTimer = null;
    this.lastHeartbeat = 0;
    this.lastFetch = 0;
  }

  /* 异步加载 SDK，避免 CDN 慢或不可达时卡住整个页面。 */
  Multiplayer.prototype.loadSDK = function () {
    var self = this;
    if (this.sdkState !== 'idle') { return; }
    if (window.WorkBuddyCloud && window.WorkBuddyCloud.createWorkBuddyCloud) {
      this.finishSDK();
      return;
    }
    if (!document.createElement || !document.head) {
      this.sdkState = 'failed';
      this.markOffline('当前环境不支持云端连接');
      return;
    }
    this.sdkState = 'loading';
    var s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = function () { self.finishSDK(); };
    s.onerror = function () {
      self.sdkState = 'failed';
      self.markOffline('道乐与单人膜拜照常可用');
    };
    document.head.appendChild(s);
  };

  Multiplayer.prototype.finishSDK = function () {
    var self = this;
    try {
      if (!window.WorkBuddyCloud || !window.WorkBuddyCloud.createWorkBuddyCloud) {
        throw new Error('SDK global missing');
      }
      this.cloud = window.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: PUBLIC_CONFIG.endpoint,
        oauthRelayBaseUrl: PUBLIC_CONFIG.oauthRelayBaseUrl,
        publishableKey: PUBLIC_CONFIG.publishableKey
      });
      this.sdkState = 'ready';
      if (this.started) {
        this.state = 'loading';
        this.reason = '';
        this.heartbeat();
        this.fetchAll();
      }
    } catch (e) {
      this.sdkState = 'failed';
      this.markOffline(friendlyError(e));
    }
  };

  Multiplayer.prototype.markOffline = function (reason) {
    this.state = 'offline';
    this.reason = reason || '';
    this.peers = [];
    this.rawPeers = [];
  };

  /* 进庙才加入同殿；登录页不产生任何云端写入。 */
  Multiplayer.prototype.start = function (identity) {
    var name = identity && identity.name ? String(identity.name).slice(0, 12) : '';
    this.nickname = name || this.nickname || randomDaoHao();
    this.outfitId = (identity && identity.outfit && identity.outfit.id) || 'red';
    this.started = true;
    this.loadSDK();
    var self = this;
    /* 无头逻辑桩可能没有定时器 API；缺失时不影响同步方法的手动调用。 */
    if (!this.heartbeatTimer && typeof window.setInterval === 'function') {
      this.heartbeatTimer = window.setInterval(function () { self.heartbeat(); }, HEARTBEAT_MS);
    }
    if (!this.fetchTimer && typeof window.setInterval === 'function') {
      this.fetchTimer = window.setInterval(function () { self.fetchAll(); }, FETCH_MS);
    }
    /* 请求也可能既不成功也不报错（例如 Origin 被网关静默拦下），
       9 秒仍没有任何回应就明确切到「独拜」，不让界面永远停在连接中。 */
    if (typeof window.setTimeout === 'function') {
      window.setTimeout(function () {
        if (self.started && self.state === 'loading') {
          self.markOffline('云端暂不可达，先独自拜一会儿');
        }
      }, 9000);
    }
    this.heartbeat();
    this.fetchAll();
  };

  Multiplayer.prototype.snapshot = function () {
    var g = this.game;
    var p = g && g.player;
    if (!p) { return null; }
    return {
      client_id: this.id,
      nickname: this.nickname,
      outfit: this.outfitId,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      pose: p.pose || 'idle',
      dir: p.dir || 'up',
      facing: (typeof p.facing === 'number' && isFinite(p.facing)) ? p.facing : null,
      merit: g.merit || 0,
      bows: g.bows || 0,
      greeting_at: Date.now() < this.selfGreetUntil
        ? new Date(this.selfGreetUntil - GREET_POSE_MS).toISOString() : null,
      updated_at: new Date().toISOString()
    };
  };

  /* 用 async/await 承接 PostgREST 的 { data, error } 信封；
     请求长时间挂起时靠 busySince 超时解锁，不让一次卡住断掉后续心跳。 */
  Multiplayer.prototype.heartbeat = async function () {
    if (!this.canCall()) { return; }
    if (this.busy && Date.now() - this.busySince < 8000) { return; }
    var row = this.snapshot();
    if (!row) { return; }
    this.busy = true;
    this.busySince = Date.now();
    try {
      var res = await this.cloud.database.from('presence')
        .upsert(row, { onConflict: 'client_id' });
      this.onResult(res);
    } catch (err) {
      this.onFailure(err);
    }
  };

  Multiplayer.prototype.fetchAll = async function () {
    if (!this.canCall()) { return; }
    var since = new Date(Date.now() - TTL_MS).toISOString();
    try {
      var res = await this.cloud.database.from('presence')
        .select('client_id,nickname,outfit,x,y,pose,dir,facing,merit,bows,greeting_at,updated_at')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(MAX_PEERS + 1);
      if (res && res.error) { this.onFailure(res.error); return; }
      this.onResult(res);
      this.applyPeers(Array.isArray(res && res.data) ? res.data : []);
      this.fetchGreetings();
    } catch (err) {
      this.onFailure(err);
    }
  };

  Multiplayer.prototype.fetchGreetings = async function () {
    if (!this.canCall()) { return; }
    var since = new Date(Date.now() - GREET_TTL_MS).toISOString();
    try {
      var res = await this.cloud.database.from('greetings')
        .select('id,from_id,from_name,created_at')
        .eq('to_id', this.id)
        .gte('created_at', since)
        .order('id', { ascending: false })
        .limit(8);
      if (res && res.error) { this.onFailure(res.error); return; }
      var rows = Array.isArray(res && res.data) ? res.data : [];
      for (var i = rows.length - 1; i >= 0; i--) {
        var r = rows[i];
        if (r.id > this.lastGreetingId) {
          this.lastGreetingId = r.id;
          this.onGreetingReceived(r.from_name || '一位香客');
        }
      }
    } catch (err) {
      this.onFailure(err);
    }
  };

  Multiplayer.prototype.onGreetingReceived = function (fromName) {
    var g = this.game;
    if (!g) { return; }
    if (g.audio && g.audio.play) { g.audio.play('chime'); }
    if (g.ui && g.ui.toast) { g.ui.toast('「' + fromName + '」向你合掌致意'); }
  };

  Multiplayer.prototype.applyPeers = function (rows) {
    var now = Date.now();
    var out = [];
    var raw = [];
    for (var i = 0; i < rows.length && out.length < MAX_PEERS; i++) {
      var r = rows[i];
      if (!r || r.client_id === this.id) { continue; }
      var gAt = r.greeting_at ? new Date(r.greeting_at).getTime() : 0;
      var greeting = gAt > 0 && now - gAt < GREET_POSE_MS;
      var pose = greeting ? 'greet' : (r.pose || 'idle');
      raw.push(r);
      out.push({
        client_id: r.client_id,
        name: r.nickname || '同殿香客',
        outfit: outfitById(r.outfit),
        x: Number(r.x) || 0,
        y: Number(r.y) || 0,
        pose: pose,
        dir: r.dir || 'up',
        facing: (typeof r.facing === 'number' && isFinite(r.facing)) ? r.facing : null,
        merit: r.merit || 0,
        bows: r.bows || 0,
        scale: 0.84
      });
    }
    this.rawPeers = raw;
    this.peers = out;
    /* 供 3D 渲染层直接读取，避免主循环与网络层互相引用。 */
    if (this.game && this.game.scene) { this.game.scene.remotes = out; }
  };

  /* 唯一的社交动作：向某位香客合掌。没有任何文字、好友或聊天。 */
  Multiplayer.prototype.greet = function (peerId) {
    var self = this;
    var target = null;
    for (var i = 0; i < this.peers.length; i++) {
      if (this.peers[i].client_id === peerId) { target = this.peers[i]; break; }
    }
    if (!target && this.peers.length && !peerId) {
      target = this.nearestPeer();
    }
    if (!target) { return false; }
    if (!this.canCall()) {
      if (this.game && this.game.ui) {
        this.game.ui.toast('同殿未连接，先独自拜一会儿吧');
      }
      return false;
    }
    this.selfGreetUntil = Date.now() + GREET_POSE_MS;
    if (this.game && this.game.scene) {
      this.game.scene.selfGreetUntil = this.selfGreetUntil;
    }
    if (this.game && this.game.audio) { this.game.audio.play('chime'); }
    if (this.game && this.game.ui) {
      this.game.ui.toast('已向「' + target.name + '」合掌');
    }
    /* greet 保持同步返回布尔值，云端写入放到内部异步任务里。 */
    (async function () {
      try {
        var res = await self.cloud.database.from('greetings')
          .insert({ from_id: self.id, to_id: target.client_id, from_name: self.nickname });
        if (res && res.error) { self.onFailure(res.error); return; }
        self.onResult(res);
        self.heartbeat();   /* 立刻把合十姿态推给对方 */
      } catch (err) {
        self.onFailure(err);
      }
    })();
    return true;
  };

  Multiplayer.prototype.nearestPeer = function () {
    var p = this.game && this.game.player;
    if (!p || !this.peers.length) { return null; }
    var best = null, bestD = Infinity;
    for (var i = 0; i < this.peers.length; i++) {
      var q = this.peers[i];
      var d = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
      if (d < bestD) { bestD = d; best = q; }
    }
    return best;
  };

  /* 点击画面时判断有没有点到某位香客（逻辑坐标，半径 42）。 */
  Multiplayer.prototype.hitPeer = function (x, y) {
    var best = null, bestD = 42 * 42;
    for (var i = 0; i < this.peers.length; i++) {
      var q = this.peers[i];
      var d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
      if (d < bestD) { bestD = d; best = q; }
    }
    return best;
  };

  Multiplayer.prototype.canCall = function () {
    return !!(this.started && this.cloud && this.sdkState === 'ready');
  };

  Multiplayer.prototype.onResult = function (res) {
    this.busy = false;
    if (res && res.error) { this.onFailure(res.error); return; }
    this.failCount = 0;
    if (this.state !== 'online') {
      this.state = 'online';
      this.reason = '';
    }
  };

  Multiplayer.prototype.onFailure = function (err) {
    this.busy = false;
    this.failCount += 1;
    this.reason = friendlyError(err);
    /* 连续失败不刷屏：只在第一次与每第 5 次切换提示，游戏本身不受影响。 */
    if (this.failCount >= 2) {
      this.state = 'offline';
      this.peers = [];
      this.rawPeers = [];
      if (this.game && this.game.scene) { this.game.scene.remotes = []; }
    }
  };

  /* 供 HUD 与验证脚本读取的可核验状态。 */
  Multiplayer.prototype.status = function () {
    return {
      sdkState: this.sdkState,
      state: this.state,
      reason: this.reason,
      started: this.started,
      clientId: this.id,
      nickname: this.nickname,
      peerCount: this.peers.length,
      onlineCount: this.peers.length + (this.state === 'online' ? 1 : 0),
      lastGreetingId: this.lastGreetingId,
      failCount: this.failCount,
      heartbeatMs: HEARTBEAT_MS,
      fetchMs: FETCH_MS,
      ttlMs: TTL_MS,
      maxPeers: MAX_PEERS
    };
  };

  Multiplayer.prototype.stop = function () {
    if (this.heartbeatTimer && typeof window.clearInterval === 'function') {
      window.clearInterval(this.heartbeatTimer);
    }
    if (this.fetchTimer && typeof window.clearInterval === 'function') {
      window.clearInterval(this.fetchTimer);
    }
    this.heartbeatTimer = null;
    this.fetchTimer = null;
    this.started = false;
    this.peers = [];
    if (this.game && this.game.scene) { this.game.scene.remotes = []; }
  };

  CS.Multiplayer = Multiplayer;
  CS.Multiplayer.randomDaoHao = randomDaoHao;
})(window.CS);

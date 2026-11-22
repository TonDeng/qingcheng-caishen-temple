/* 财神庙互动场景：登录层、HUD、提示与帮助弹层。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  function UI(game) {
    this.game = game;
    this.login = document.getElementById('loginOverlay');
    this.help = document.getElementById('helpOverlay');
    this.name = document.getElementById('hudName');
    this.tag = document.getElementById('hudTag');
    this.merit = document.getElementById('hudMerit');
    this.incense = document.getElementById('hudIncense');
    this.bows = document.getElementById('hudBows');
    this.bows108 = document.getElementById('hudBows108');
    this.beads = document.getElementById('hudBeads');
    this.peers = document.getElementById('hudPeers');
    this.link = document.getElementById('hudLink');
    this.hint = document.getElementById('hudHint');
    this.musicBtn = document.getElementById('btnMusic');
    this.standBtn = document.getElementById('btnStand');
    this.zenBtn = document.getElementById('btnZen');
    this.toastEl = document.getElementById('toast');
    this.last = {};
    this.toastTimer = null;
    this.restoreName();
  }

  /* Sansa 式零门槛：没有保存过名字就先赐一个随机道号，留空也能直接入殿。 */
  UI.prototype.randomName = function () {
    return (CS.Multiplayer && CS.Multiplayer.randomDaoHao)
      ? CS.Multiplayer.randomDaoHao() : '清澈的松风';
  };

  UI.prototype.restoreName = function () {
    var saved = null;
    try { saved = window.localStorage.getItem('caishen.name'); } catch (e) { /* 隐私模式 */ }
    var input = document.getElementById('playerName');
    if (!input) { return; }
    /* 已经敲过名字就不覆盖，避免刷新或脚本预填时被随机道号冲掉。 */
    if (input.value && input.value.trim()) { return; }
    input.value = saved || this.randomName();
  };

  UI.prototype.saveName = function (name) {
    try { window.localStorage.setItem('caishen.name', name); } catch (e) { /* 同上 */ }
  };

  UI.prototype.hideLogin = function () {
    this.login.classList.add('hidden');
  };

  UI.prototype.setIdentity = function (name) {
    this.name.textContent = name;
    if (this.tag) { this.tag.textContent = '同殿静候中'; }
    this.saveName(name);
  };

  UI.prototype.setHint = function (text) {
    if (this.hint) { this.hint.textContent = text; }
  };

  UI.prototype.toast = function (text) {
    var el = this.toastEl;
    if (!el) { return; }
    el.textContent = text;
    el.classList.add('show');
    if (this.toastTimer) { window.clearTimeout(this.toastTimer); }
    this.toastTimer = window.setTimeout(function () {
      el.classList.remove('show');
    }, 2400);
  };

  UI.prototype.update = function () {
    var g = this.game;
    if (!g.running) { return; }
    var values = {
      merit: g.merit,
      incense: g.incenseCount,
      bows: g.bows,
      bows108: g.bows108,
      beads: g.beads
    };
    if (this.last.merit !== values.merit) {
      this.merit.textContent = values.merit;
      this.last.merit = values.merit;
    }
    if (this.last.incense !== values.incense) {
      this.incense.textContent = values.incense;
      this.last.incense = values.incense;
    }
    if (this.last.bows !== values.bows) {
      this.bows.textContent = values.bows;
      this.last.bows = values.bows;
    }
    if (this.last.bows108 !== values.bows108 && this.bows108) {
      this.bows108.textContent = values.bows108;
      this.last.bows108 = values.bows108;
    }
    if (this.last.beads !== values.beads && this.beads) {
      this.beads.textContent = values.beads;
      this.last.beads = values.beads;
    }

    /* 同殿状态：只显示人数与连接情况，不展示任何排行榜或个人资料。 */
    var st = g.multi ? g.multi.status() : null;
    var peerCount = st ? Math.max(1, st.onlineCount) : 1;
    var linkText = !st || st.state === 'loading' ? '连接中'
      : (st.state === 'online' ? '已入殿' : '独拜');
    if (this.last.peers !== peerCount) {
      if (this.peers) { this.peers.textContent = peerCount; }
      this.last.peers = peerCount;
    }
    if (this.last.link !== linkText) {
      if (this.link) {
        this.link.textContent = linkText;
        this.link.classList.toggle('offline', linkText === '独拜');
        this.link.title = (st && st.reason) || '';
      }
      this.last.link = linkText;
    }

    var sitting = g.player && (g.player.action === 'sitting' || g.player.action === 'worship');
    if (this.last.sitting !== sitting) {
      this.standBtn.classList.toggle('ready', !!sitting);
      this.last.sitting = sitting;
    }
  };

  /* 放空模式：数字与提示淡出，控件仍可用，随时能「回来」。 */
  UI.prototype.setZen = function (on) {
    document.body.classList.toggle('zen', !!on);
    if (this.zenBtn) {
      this.zenBtn.innerHTML = on ? '回来 <small>Z</small>' : '放空 <small>Z</small>';
      this.zenBtn.classList.toggle('on', !!on);
    }
  };

  UI.prototype.setMusic = function (on) {
    this.musicBtn.textContent = on ? '♫ 道乐 开' : '♪ 道乐 关';
    this.musicBtn.classList.toggle('off', !on);
  };

  UI.prototype.toggleHelp = function (force) {
    var show = (typeof force === 'boolean') ? force : this.help.classList.contains('hidden');
    this.help.classList.toggle('hidden', !show);
  };

  CS.UI = UI;
})(window.CS);

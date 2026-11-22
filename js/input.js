/* 财神庙互动场景：键盘、鼠标、触摸与虚拟摇杆输入。
   三种输入最终都汇入同一个 intent 或同一个动作入口。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  function Input(game) {
    this.game = game;
    this.keys = {};
    this.joy = { x: 0, y: 0 };
    this.pointerStart = null;
    this.joyPointer = null;
    this.bind();
  }

  Input.prototype.bind = function () {
    var self = this;
    var game = this.game;

    /* 键盘。 */
    window.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) {
        e.preventDefault();
      }
      if (self.keys[k]) { return; }
      self.keys[k] = true;
      if (!game.running) { return; }
      if (k === 'e') { game.doWorship(); }
      else if (k === 'f') { game.doIncense(); }
      else if (k === ' ' || k === 'escape') { game.doStand(); }
      else if (k === 'm') { game.toggleMusic(); }
      else if (k === 'h' || k === '?') { game.toggleHelp(); }
      else if (k === 'g') { game.greetPeer(null); }
      else if (k === 'b') { game.bead(); }
      else if (k === 'z') { game.toggleZen(); }
    });
    window.addEventListener('keyup', function (e) {
      self.keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener('blur', function () { self.keys = {}; });

    /* 画布点击寻路与热点交互。 */
    var canvas = game.canvas;
    canvas.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || !game.running) { return; }
      var p = game.toLogical(e.clientX, e.clientY);
      var hit = game.scene.hitTest(p.x, p.y);
      game.scene.highlightId = hit ? (hit.type === 'censer' ? 'censer' : hit.data.id) : null;
      canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    });
    canvas.addEventListener('pointerleave', function () {
      if (game.scene) { game.scene.highlightId = null; }
    });
    canvas.addEventListener('pointerdown', function (e) {
      if (!game.running) { return; }
      self.pointerStart = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', function (e) {
      if (!game.running || !self.pointerStart) { return; }
      var d = Math.sqrt(
        (e.clientX - self.pointerStart.x) * (e.clientX - self.pointerStart.x) +
        (e.clientY - self.pointerStart.y) * (e.clientY - self.pointerStart.y)
      );
      self.pointerStart = null;
      if (d > 14) { return; }
      var p = game.toLogical(e.clientX, e.clientY);
      game.audio.play('click');
      /* 点到同殿香客就是合掌致意（Sansa 唯一的社交动作），
         优先于蒲团/地面，避免站位重叠时误判成落座。 */
      if (game.multi) {
        var peer = game.multi.hitPeer(p.x, p.y);
        if (peer) {
          game.greetPeer(peer.client_id);
          return;
        }
      }
      var hit = game.scene.hitTest(p.x, p.y);
      if (hit && hit.type === 'censer') {
        game.player.goToCenser();
      } else if (hit && hit.type === 'cushion') {
        game.player.goToCushion(hit.data, true);
      } else {
        var moving = game.player.walkTo(p.x, p.y, null);
        if (moving !== false) { game.setHint('正在走向指定位置…'); }
      }
    });

    /* 虚拟摇杆。 */
    var pad = document.getElementById('joystick');
    var knob = document.getElementById('joystickKnob');
    if (pad && knob) {
      var updateJoy = function (e) {
        var rect = pad.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var max = rect.width * 0.34;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        self.joy.x = dx / max;
        self.joy.y = dy / max;
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      };
      pad.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        self.joyPointer = e.pointerId;
        if (pad.setPointerCapture) { pad.setPointerCapture(e.pointerId); }
        updateJoy(e);
      });
      pad.addEventListener('pointermove', function (e) {
        if (self.joyPointer !== e.pointerId) { return; }
        e.preventDefault();
        updateJoy(e);
      });
      var endJoy = function (e) {
        if (self.joyPointer !== e.pointerId) { return; }
        self.joyPointer = null;
        self.joy.x = 0; self.joy.y = 0;
        knob.style.transform = 'translate(0px,0px)';
      };
      pad.addEventListener('pointerup', endJoy);
      pad.addEventListener('pointercancel', endJoy);
    }

    /* 动作按钮。 */
    var map = [
      ['btnWorship', function () { game.doWorship(); }],
      ['btnIncense', function () { game.doIncense(); }],
      ['btnStand', function () { game.doStand(); }],
      ['btnMusic', function () { game.toggleMusic(); }],
      ['btnHelp', function () { game.toggleHelp(); }],
      ['btnHelpClose', function () { game.toggleHelp(false); }],
      ['btnLogin', function () { game.startFromLogin(); }],
      ['btnGreet', function () { game.greetPeer(null); }],
      ['btnBead', function () { game.bead(); }],
      ['btnZen', function () { game.toggleZen(); }]
    ];
    for (var i = 0; i < map.length; i++) {
      var el = document.getElementById(map[i][0]);
      if (el) { el.addEventListener('click', map[i][1]); }
    }

    /* 竖屏下同殿面板默认折叠，点计数行展开 / 收起，避免压住财神像。 */
    var fellow = document.getElementById('fellowToggle');
    if (fellow) {
      fellow.addEventListener('click', function () {
        var open = document.body.classList.toggle('fellow-open');
        var arrow = document.getElementById('fellowArrow');
        if (arrow) { arrow.textContent = open ? '▴' : '▾'; }
      });
    }

    /* 「换一个」重新赐道号：免注册，想换几个都可以。 */
    var dice = document.getElementById('btnDice');
    if (dice) {
      dice.addEventListener('click', function () {
        var input = document.getElementById('playerName');
        if (input) {
          input.value = (CS.Multiplayer && CS.Multiplayer.randomDaoHao)
            ? CS.Multiplayer.randomDaoHao() : '清澈的松风';
        }
      });
    }

    /* 昵称输入框回车直接进庙。 */
    var nameInput = document.getElementById('playerName');
    if (nameInput) {
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { game.startFromLogin(); }
      });
    }

    /* 服饰选择。 */
    var chips = document.querySelectorAll('.outfit-chip');
    for (var j = 0; j < chips.length; j++) {
      chips[j].addEventListener('click', function () {
        for (var k = 0; k < chips.length; k++) { chips[k].classList.remove('active'); }
        this.classList.add('active');
        game.selectedOutfit = parseInt(this.getAttribute('data-index'), 10) || 0;
      });
    }
  };

  Input.prototype.getIntent = function () {
    var vx = 0, vy = 0;
    if (this.keys['a'] || this.keys['arrowleft']) { vx -= 1; }
    if (this.keys['d'] || this.keys['arrowright']) { vx += 1; }
    if (this.keys['w'] || this.keys['arrowup']) { vy -= 1; }
    if (this.keys['s'] || this.keys['arrowdown']) { vy += 1; }
    vx += this.joy.x;
    vy += this.joy.y;
    return { vx: vx, vy: vy };
  };

  CS.Input = Input;
})(window.CS);

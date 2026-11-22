/* 财神庙互动场景：卡通小人的状态机、移动与交互动作。 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var C = CS.Config;
  var Art = CS.Art;

  function Player(game, name, outfit) {
    this.game = game;
    this.name = name;
    this.outfit = outfit;
    this.x = C.SPAWN.x;
    this.y = C.SPAWN.y;
    this.dir = 'up';
    /* 3D 专用：坐下/叩拜/上香时朝向最近神龛的弧度；自由移动时为 null。
       2D 回退仍使用上面的四方向 dir。 */
    this.facing = null;
    this.phase = Math.random() * 6;
    this.scale = 1;
    this.showName = true;

    /* none | moving | sitting | worship | incense */
    this.action = 'none';
    this.pose = 'idle';
    this.dest = null;
    this.pending = null;
    this.autoWorship = false;
    this.cushion = null;
    this.timer = 0;
    this.nextBeat = 0;
    this.stuck = 0;
    this.detour = 0;
    this.detourSide = 1;
    this.lastX = this.x;
    this.lastY = this.y;
    this.boundaryHintAt = 0;
  }

  /* ---------- 可行走判定 ---------- */

  Player.prototype.canStand = function (x, y) {
    /* 缓冲只留在外接框上，内部矩形一律按原始边界判定。
       早先每个矩形都各自内缩 6，而相邻矩形只重叠 10，
       拜台→外庭(y≈885)、拜台→西廊(x≈45)、拜台→东廊(x≈1555)
       会留下 2 单位真空：角色在低步长帧里恰好停在缝上就再也退不出去。 */
    var W = C.WORLD;
    if (x < W.minX + 6 || x > W.maxX - 6 ||
        y < W.minY + 6 || y > W.maxY - 6) { return false; }
    var inRect = false;
    for (var i = 0; i < C.WALKABLE.length; i++) {
      var r = C.WALKABLE[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        inRect = true; break;
      }
    }
    if (!inRect) { return false; }
    for (var j = 0; j < C.OBSTACLES.length; j++) {
      var o = C.OBSTACLES[j];
      var dx = x - o.x, dy = y - o.y;
      if (Math.sqrt(dx * dx + dy * dy) < o.r + 12) { return false; }
    }
    return true;
  };

  /* 点击到不可站立的位置时，吸附到附近可站立点；若目标远在可行走区之外，
     沿点击方向走到能走的最远处，绝不把目标退回角色当前位置
     （那会造成「点了没反应、还一直显示正在走向指定位置」）。 */
  Player.prototype.snap = function (x, y) {
    if (this.canStand(x, y)) { return { x: x, y: y }; }
    /* 先就近绕开蒲团边缘、香炉与小障碍。 */
    for (var radius = 16; radius <= 160; radius += 16) {
      for (var a = 0; a < 16; a++) {
        var ang = a * Math.PI / 8;
        var nx = x + Math.cos(ang) * radius;
        var ny = y + Math.sin(ang) * radius;
        if (this.canStand(nx, ny)) { return { x: nx, y: ny }; }
      }
    }
    /* 跟随镜头下点击画面下半部会换算到身后数百单位，竖屏更会超出外庭边界。
       此时从角色当前位置沿方向逐段探测，取连续可达的最远一点。 */
    var dx = x - this.x, dy = y - this.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > 8) {
      var ux = dx / len, uy = dy / len;
      var best = null;
      for (var step = 12; step <= len; step += 12) {
        var px = this.x + ux * step, py = this.y + uy * step;
        if (!this.canStand(px, py)) { break; }
        best = { x: px, y: py };
      }
      if (best && Math.sqrt(
        (best.x - this.x) * (best.x - this.x) +
        (best.y - this.y) * (best.y - this.y)) > 8) { return best; }
    }
    return { x: this.x, y: this.y };
  };

  /* ---------- 朝向 ---------- */

  /* 落座与上香时，脸要对着最近的一龛财神，而不是一律朝正北。
     3D 模型正面是本地 +Z，rotation.y=PI 时朝殿内 -Z；
     因此以 PI 为基准，按神龛相对位置叠加一个受限的左右偏角。
     dy 取绝对值只用于算偏角大小，dx 的正负决定偏向哪一侧。 */
  Player.prototype.facingToShrine = function () {
    var best = null, bd = Infinity;
    for (var i = 0; i < C.STATUES.length; i++) {
      var s = C.STATUES[i];
      var dx = s.x - this.x, dy = s.y - this.y;
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = { dx: dx, dy: dy }; }
    }
    if (!best) { return Math.PI; }
    var offset = Math.atan2(best.dx, Math.abs(best.dy)) * 0.7;
    return Math.PI - offset;
  };

  /* ---------- 动作入口 ---------- */

  Player.prototype.walkTo = function (x, y, pending) {
    if (this.action === 'worship' || this.action === 'incense') { return false; }
    if (this.action === 'sitting') { this.standUp(false); }
    var p = this.snap(x, y);
    /* 确实无处可去时明确告诉玩家，不要进入 moving 状态挂着走路提示。 */
    if (Math.sqrt(
      (p.x - this.x) * (p.x - this.x) +
      (p.y - this.y) * (p.y - this.y)) < 8) {
      this.game.setHint('那边已经走到头啦，换个方向再点一次。');
      return false;
    }
    this.dest = p;
    this.pending = pending || null;
    this.autoWorship = false;
    this.facing = null;
    this.action = 'moving';
    this.pose = 'walk';
    this.stuck = 0;
    this.detour = 0;
    return true;
  };

  Player.prototype.goToCushion = function (cushion, autoWorship) {
    var p = this.snap(cushion.x, cushion.y + 8);
    if (this.action === 'sitting') { this.standUp(false); }
    this.dest = p;
    this.pending = { type: 'cushion', data: cushion };
    this.autoWorship = !!autoWorship;
    this.facing = null;
    this.action = 'moving';
    this.pose = 'walk';
    this.stuck = 0;
    this.detour = 0;
    this.game.setHint('正走向蒲团，请稍候…');
  };

  Player.prototype.goToCenser = function () {
    if (this.action === 'sitting' || this.action === 'worship') { this.standUp(false); }
    this.dest = { x: C.CENSER.stand.x, y: C.CENSER.stand.y };
    this.pending = { type: 'censer', data: C.CENSER };
    this.facing = null;
    this.action = 'moving';
    this.pose = 'walk';
    this.stuck = 0;
    this.detour = 0;
    this.game.setHint('正走向香炉，请稍候…');
  };

  Player.prototype.sitDown = function (cushion) {
    this.cushion = cushion;
    this.game.scene.occupied[cushion.id] = 'player';
    this.x = cushion.x;
    this.y = cushion.y + 8;
    this.action = 'sitting';
    this.pose = 'sit';
    this.dir = 'up';
    this.facing = this.facingToShrine();
    this.dest = null;
    this.pending = null;
    this.game.audio.play('sit');
    this.game.setHint('已落座，面向财神。点击「膜拜」行三拜，点击「起身」离开蒲团。');
    if (this.autoWorship) {
      this.autoWorship = false;
      this.startWorship();
    }
  };

  Player.prototype.startWorship = function () {
    if (this.action === 'worship' || this.action === 'incense') { return; }
    if (this.action !== 'sitting') {
      var target = this.game.scene.nearestFreeCushion(this.x, this.y);
      if (!target) {
        this.game.setHint('蒲团都被占满了，请稍等片刻。');
        return;
      }
      this.goToCushion(target, true);
      return;
    }
    this.action = 'worship';
    this.pose = 'worship';
    this.timer = 0;
    this.nextBeat = 0.55;
    this.game.setHint('面向财神诚心三拜，功德无量…');
  };

  Player.prototype.startIncense = function () {
    if (this.action === 'worship' || this.action === 'incense') { return; }
    if (this.action === 'sitting') { this.standUp(false); }
    var d = Math.sqrt(
      (this.x - C.CENSER.stand.x) * (this.x - C.CENSER.stand.x) +
      (this.y - C.CENSER.stand.y) * (this.y - C.CENSER.stand.y)
    );
    if (d > 26) { this.goToCenser(); return; }
    this.x = C.CENSER.stand.x;
    this.y = C.CENSER.stand.y;
    this.dir = 'up';
    this.facing = this.facingToShrine();
    this.action = 'incense';
    this.pose = 'incense';
    this.timer = 0;
    this.litDone = false;
    this.offerDone = false;
    this.game.setHint('焚香祈愿中…');
  };

  Player.prototype.standUp = function (notify) {
    if (this.cushion) {
      this.game.scene.occupied[this.cushion.id] = false;
      this.cushion = null;
    }
    this.action = 'none';
    this.pose = 'idle';
    this.dest = null;
    this.pending = null;
    this.facing = null;
    this.timer = 0;
    if (notify !== false) { this.game.setHint('已起身。走到蒲团或香炉附近就能继续祈福。'); }
  };

  /* ---------- 到达目标 ---------- */

  Player.prototype.arrive = function () {
    var pending = this.pending;
    this.dest = null;
    this.pending = null;
    this.action = 'none';
    this.pose = 'idle';
    /* 点地面走到位后收掉「正在走向指定位置…」，避免一直挂着像卡死。 */
    if (!pending) {
      this.game.setHint('已走到。点击地面可继续走动，点蒲团落座膜拜。');
      return;
    }
    if (pending.type === 'cushion') {
      this.sitDown(pending.data);
    } else if (pending.type === 'censer') {
      this.startIncense();
    }
  };

  /* ---------- 主更新 ---------- */

  Player.prototype.update = function (dt, intent) {
    var manual = intent && (Math.abs(intent.vx) > 0.08 || Math.abs(intent.vy) > 0.08);

    if (this.action === 'worship') {
      this.timer += dt;
      this.pose = 'worship';
      while (this.timer >= this.nextBeat && this.nextBeat <= 2.6) {
        this.worshipBeat();
        this.nextBeat += 0.9;
      }
      if (this.timer >= 3.0) {
        this.action = 'sitting';
        this.pose = 'sit';
        this.game.setHint('三拜礼成。可再次膜拜，或点击「起身」。');
      }
      return;
    }

    if (this.action === 'incense') {
      this.timer += dt;
      this.pose = 'incense';
      if (!this.litDone && this.timer >= 0.85) {
        this.litDone = true;
        this.game.audio.play('ignite');
        this.game.scene.sparkBurst(C.CENSER.x, C.CENSER.y - 40, 12);
      }
      if (!this.offerDone && this.timer >= 1.45) {
        this.offerDone = true;
        this.game.scene.incenseCount = Math.min(9, this.game.scene.incenseCount + 1);
        this.game.addIncense();
        this.game.addMerit(15, this.x, this.y - 70, '+15 功德 · 香火 +1');
        this.game.scene.sparkBurst(C.CENSER.x, C.CENSER.y - 36, 22);
        this.game.scene.celebrate(C.CENSER.x, C.CENSER.y - 20);
        this.game.audio.play('chime');
      }
      if (this.timer >= 2.35) {
        this.action = 'none';
        this.pose = 'idle';
        this.game.setHint('上香礼成。愿新岁财源广进，福泽绵长。');
      }
      return;
    }

    /* 手动输入优先，会打断自动寻路。 */
    if (manual && this.action === 'moving') {
      this.dest = null;
      this.pending = null;
      this.autoWorship = false;
      this.action = 'none';
      this.game.setHint('已停下脚步，改为手动走动。');
    }
    if (manual && this.action === 'sitting') { this.standUp(false); }

    var vx = 0, vy = 0;
    if (manual) {
      var len = Math.sqrt(intent.vx * intent.vx + intent.vy * intent.vy);
      if (len > 1) { intent.vx /= len; intent.vy /= len; len = 1; }
      vx = intent.vx;
      vy = intent.vy;
    } else if (this.action === 'moving' && this.dest) {
      var dx = this.dest.x - this.x, dy = this.dest.y - this.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      /* dt 上限 0.05 时单帧可走 16.5 单位，若仍要求距离 <5 才算到达，
         低帧率设备会在目标两侧反复过冲、永远停在「正在走向蒲团」。
         到达阈值按本帧步长自适应，并直接落到 snap 过的可站立目标点。 */
      var arriveR = Math.max(5, C.SPEED * dt);
      if (dist <= arriveR) {
        this.x = this.dest.x;
        this.y = this.dest.y;
        this.arrive();
        return;
      }
      vx = dx / dist;
      vy = dy / dist;
      /* 遇到障碍时短暂侧向绕行。 */
      if (this.detour > 0) {
        this.detour -= dt;
        var sideX = -vy * this.detourSide;
        var sideY = vx * this.detourSide;
        vx = vx * 0.35 + sideX;
        vy = vy * 0.35 + sideY;
        var nl = Math.sqrt(vx * vx + vy * vy) || 1;
        vx /= nl; vy /= nl;
      }
    } else {
      this.pose = (this.action === 'sitting') ? 'sit' : 'idle';
      return;
    }

    var speed = C.SPEED * dt;
    this.tryMove(vx * speed, vy * speed);
    this.pose = 'walk';
    this.action = manual ? 'none' : (this.action === 'moving' ? 'moving' : this.action);

    /* 方向：以位移较大的轴为准。 */
    if (Math.abs(vx) > Math.abs(vy) * 1.15) {
      this.dir = vx > 0 ? 'right' : 'left';
    } else if (Math.abs(vy) > 0.05) {
      this.dir = vy > 0 ? 'down' : 'up';
    }

    if (this.action === 'moving') {
      var dx2 = this.x - this.lastX, dy2 = this.y - this.lastY;
      if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < 0.4) {
        this.stuck += dt;
        if (this.stuck > 0.35 && this.detour <= 0) {
          this.detour = 0.45;
          this.detourSide = -this.detourSide;
          this.stuck = 0;
        }
        if (this.stuck > 1.6) {
          /* 长时间无法靠近时结束寻路，避免角色原地抖动。 */
          this.dest = null;
          this.pending = null;
          this.action = 'none';
          this.pose = 'idle';
          this.game.setHint('这条路走不通，请换个位置再点一次。');
          return;
        }
      } else {
        this.stuck = 0;
      }
    }
    this.lastX = this.x;
    this.lastY = this.y;
  };

  Player.prototype.tryMove = function (dx, dy) {
    var moved = false;
    if (dx !== 0 && this.canStand(this.x + dx, this.y)) { this.x += dx; moved = true; }
    if (dy !== 0 && this.canStand(this.x, this.y + dy)) {
      this.y += dy; moved = true;
    } else if (dy > 0 && this.y > C.GATE_Y - 70) {
      this.notifyBoundary();
    }
    return moved;
  };

  /* 退到山门时不再静默卡住：明确说明这里是院门、回身就是法堂。
     四秒节流，避免按住 S 时把提示刷成一串。 */
  Player.prototype.notifyBoundary = function () {
    var now = Date.now();
    if (this.boundaryHintAt && now - this.boundaryHintAt < 4000) { return; }
    this.boundaryHintAt = now;
    this.game.setHint('已到山门 · 回身入殿，前面还有一整堂蒲团等你。');
  };

  Player.prototype.worshipBeat = function () {
    this.game.bows += 1;
    /* Sansa 式「百八拜」功课：每次叩拜都算一轮，满 108 归零重来。 */
    if (this.game.addBow) { this.game.addBow(); }
    this.game.audio.play('bell');
    this.game.scene.sparkBurst(this.x, this.y - 46, 9);
    this.game.addMerit(10, this.x, this.y - 78, '+10 功德');
  };

  Player.prototype.draw = function (ctx, t) {
    /* 3D 模式下角色模型由 world3d.poseCharacter 驱动。 */
    if (this.game.world) { return; }
    if (this.action === 'worship') {
      Art.drawWorshipAura(ctx, this.x, this.y, t, 1);
    } else if (this.action === 'incense') {
      Art.drawWorshipAura(ctx, this.x, this.y, t, 0.45);
    }
    Art.drawCharacter(ctx, {
      x: this.x, y: this.y,
      pose: this.pose, dir: this.dir,
      outfit: this.outfit, name: this.name,
      scale: this.scale, phase: this.phase,
      showName: this.showName
    }, t);
  };

  CS.Player = Player;
})(window.CS);

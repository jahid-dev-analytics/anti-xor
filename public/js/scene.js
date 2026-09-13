(function(){
  'use strict';
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM) document.documentElement.classList.add('rm');
  var mobileQ = window.matchMedia('(max-width: 820px)');
  var clamp = function(v,a,b){ return v<a?a:v>b?b:v; };
  var lerp = function(a,b,t){ return a+(b-a)*t; };
  var smooth = function(t){ t=clamp(t,0,1); return t*t*(3-2*t); };
  var win = function(p,a,b){ return clamp((p-a)/(b-a),0,1); };

  /* ---------------- skyline planes (hero) ---------------- */
  function skyline(svg, n, hMin, hMax, fill, windows, seed){
    var s = seed, rnd = function(){ s = (s*9301+49297)%233280; return s/233280; };
    var x = 0, out = '';
    while (x < 1000){
      var w = 18 + rnd()*46, h = hMin + rnd()*(hMax-hMin);
      var y = 300 - h;
      out += '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+(h+2).toFixed(1)+'" fill="'+fill+'"/>';
      if (rnd() > .6) out += '<rect x="'+(x+w*.35).toFixed(1)+'" y="'+(y-10-rnd()*24).toFixed(1)+'" width="'+(w*.3).toFixed(1)+'" height="40" fill="'+fill+'"/>';
      if (windows){
        var cols = Math.max(1, Math.floor(w/9)), rows = Math.floor(h/12);
        for (var r=0;r<rows;r++) for (var c=0;c<cols;c++){
          if (rnd() < .22){
            var warm = rnd() < .75;
            out += '<rect x="'+(x+3+c*9).toFixed(1)+'" y="'+(y+6+r*12).toFixed(1)+'" width="3.2" height="4.4" fill="'+(warm?'#FFD9A8':'#C5F55A')+'" opacity="'+(0.35+rnd()*0.5).toFixed(2)+'"/>';
          }
        }
      }
      x += w + 2 + rnd()*10;
    }
    svg.innerHTML = out;
  }
  skyline(document.getElementById('skyFar'), 0, 60, 200, '#141c1a', false, 7);
  skyline(document.getElementById('skyNear'), 0, 40, 260, '#0A100E', true, 23);

  /* ---------------- hero car: a pre-rendered turntable ----------------
     The car used to be built, lit and rasterised in WebGL on every visit. It
     is now 24 frames rendered ahead of time by tools/turntable — the same
     model, but drawn at twice the size and downscaled, which no realtime
     frame budget would have allowed. The scroll still turns it a full 360°;
     it picks a frame instead of a camera angle.

     The frames carry an alpha channel, so the skyline still shows through,
     and they are drawn into the same fixed canvas the WebGL used — nothing
     else on the page had to move. */
  var canvas = document.getElementById('gl');
  var ctx = canvas.getContext('2d');
  var FRAMES = 24, FRAME_AR = 720/1200;
  var frames = new Array(FRAMES);

  /* A phone never needs 1200px of car, and the half-size set costs a third of
     what the full one does over a mobile connection. */
  var SET = '/assets/car/' + (mobileQ.matches ? 'sm/' : '');
  function frameSrc(i){ return SET + 'f' + (i < 10 ? '0' : '') + i + '.webp'; }
  function load(i){
    var im = new Image();
    im.decoding = 'async';
    im.src = frameSrc(i);
    frames[i] = im;
  }
  /* Frame 0 is the hero pose and is wanted immediately. The other 23 are not
     needed until the visitor scrolls into the turn, and firing all of them at
     once competes with the stylesheet and the fonts for the first screen — so
     they wait for load, then go out in one burst while the hero is being read. */
  load(0);
  function loadRest(){ for (var i = 1; i < FRAMES; i++) load(i); }
  if (document.readyState === 'complete') loadRest();
  else window.addEventListener('load', loadRest);

  /* Frame 0 was rendered at this angle and the rest step evenly around from
     it, so an angle maps straight to a frame with no lookup table. */
  var BASE_ANG = -0.6;
  function frameAt(ang){
    var i = Math.round((ang - BASE_ANG) / (Math.PI * 2) * FRAMES) % FRAMES;
    return frames[(i + FRAMES) % FRAMES];
  }

  var W=0, H=0, DPR=1, VH = window.innerHeight, VW = window.innerWidth;
  function lockViewport(){
    VH = window.innerHeight; VW = window.innerWidth;
    document.documentElement.style.setProperty('--vh', VH + 'px');
  }
  function resize(){
    DPR = Math.min(window.devicePixelRatio||1, 2);
    W = VW; H = VH;
    canvas.style.height = VH + 'px';
    canvas.width = Math.round(W*DPR); canvas.height = Math.round(H*DPR);
    /* scale once here so everything below can think in CSS pixels */
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  lockViewport(); resize();
  var rsT;
  window.addEventListener('resize', function(){
    clearTimeout(rsT);
    rsT = setTimeout(function(){
      /* mobile browsers fire resize as the toolbar hides; only relayout on a real change */
      if (window.innerWidth !== VW || Math.abs(window.innerHeight - VH) > 160){ lockViewport(); resize(); }
    }, 120);
  });
  window.addEventListener('orientationchange', function(){ setTimeout(function(){ lockViewport(); resize(); }, 300); });

  /* cx/cy are where the frame's centre sits as a fraction of the viewport,
     wide is its width as a fraction of it — the same three numbers the camera
     dolly used to produce, now applied to a picture. */
  var car = { ang:BASE_ANG, cx:0.68, cy:0.54, wide:0.62 };
  var cur = { ang:BASE_ANG, cx:0.68, cy:0.54, wide:0.62 };

  function draw(){
    ctx.clearRect(0, 0, W, H);
    var img = frameAt(cur.ang);
    /* a frame still in flight simply is not drawn; the next tick picks it up */
    if (!img || !img.complete || !img.naturalWidth) return;
    var w = W * cur.wide, h = w * FRAME_AR;
    ctx.drawImage(img, cur.cx*W - w/2, cur.cy*H - h/2, w, h);
  }

  /* ---------------- scroll score ---------------- */
  var acts = {};
  Array.prototype.forEach.call(document.querySelectorAll('[data-act]'), function(el){ acts[el.getAttribute('data-act')] = el; });
  var planes = Array.prototype.slice.call(document.querySelectorAll('[data-plane]'));
  var lines = Array.prototype.slice.call(document.querySelectorAll('.turn .line'));
  var track = document.getElementById('track'), fcards = Array.prototype.slice.call(track.children);
  var pick = document.getElementById('pick'), feats = Array.prototype.slice.call(document.querySelectorAll('.feat'));
  var streaksEl = document.querySelector('.streaks');
  var lastY = window.scrollY, vel = 0;

  function progress(el){
    var r = el.getBoundingClientRect(), vh = VH;
    var span = el.offsetHeight - vh;
    return span > 0 ? clamp(-r.top/span, 0, 1) : clamp(-r.top/vh, 0, 1);
  }

  function tick(){
    var y = window.scrollY, vh = VH, mob = mobileQ.matches;
    vel = lerp(vel, Math.min(Math.abs(y-lastY)/40, 1), 0.12); lastY = y;
    var v = RM ? 0 : vel;
    streaksEl.style.setProperty('--v', v.toFixed(3));

    /* act 1 · hero parallax */
    var p1 = clamp(y/vh, 0, 1);
    planes.forEach(function(pl){ pl.style.transform = 'translate3d(0,' + (-p1*vh*parseFloat(pl.getAttribute('data-plane'))).toFixed(1) + 'px,0)'; });

    /* act 2 · the turn */
    var turn = acts.turn, p2 = progress(turn);
    var r2 = turn.getBoundingClientRect();
    turn.style.setProperty('--p', win(p2, 0.02, 0.2).toFixed(3));
    var inTurn = smooth(win(p2, 0, 0.14));
    /* the hero holds the car off to the right of the copy; the turn brings it
       to the middle and closer, which the camera dolly used to do */
    car.cx   = lerp(mob ? 0.50 : 0.68, 0.50, inTurn);
    car.cy   = lerp(mob ? 0.62 : 0.54, mob ? 0.52 : 0.52, inTurn);
    car.wide = lerp(mob ? 1.00 : 0.62, mob ? 1.12 : 0.80, inTurn);
    var spin = smooth(win(p2, 0.12, 0.92));
    car.ang = BASE_ANG + p1*0.25 + spin*Math.PI*2;
    if (RM){ car.ang = BASE_ANG; car.cx = mob ? 0.50 : 0.68; }
    var afterTurn = r2.bottom < vh ? clamp((vh - r2.bottom)/(vh*0.4), 0, 1) : 0;
    canvas.style.opacity = (1 - afterTurn).toFixed(2);
    canvas.style.visibility = afterTurn >= 1 ? 'hidden' : 'visible';

    var slots = [[0.14,0.34],[0.34,0.54],[0.54,0.74],[0.74,0.94]];
    lines.forEach(function(ln, i){
      if (RM) return;
      var a = slots[i][0], b = slots[i][1];
      var t = win(p2, a, b), o = Math.min(win(t,0,0.18), 1-win(t,0.82,1));
      ln.style.opacity = o.toFixed(3);
      ln.style.transform = 'translate3d(0,' + ((1-o)*22).toFixed(1) + 'px,0)';
    });

    /* act 3 · fleet pan */
    var p3 = progress(acts.fleet);
    if (!RM){
      var tw = track.scrollWidth, vw = VW;
      var tx = -(tw - vw) * smooth(p3);
      track.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,0,0)';
      var best = null, bestD = 1e9;
      fcards.forEach(function(c){
        var d = (c.offsetLeft + c.offsetWidth/2 + tx - vw/2)/vw;
        c.style.transform = 'rotateY(' + (-d*28).toFixed(2) + 'deg) translateZ(' + (-Math.abs(d)*220).toFixed(1) + 'px)';
        if (Math.abs(d) < bestD){ bestD = Math.abs(d); best = c; }
      });
      fcards.forEach(function(c){ c.classList.toggle('is-on', c === best); });
    }

    /* act 4 · reveal + kinetic */
    var p4 = progress(acts.proof);
    if (!RM){
      var wipe = smooth(win(p4, 0.0, 0.34));
      pick.style.clipPath = 'inset(0 ' + ((1-wipe)*100).toFixed(2) + '% 0 0 round 30px)';
      feats.forEach(function(f, i){
        var t = smooth(win(p4, 0.30 + i*0.12, 0.44 + i*0.12));
        f.style.opacity = t.toFixed(3); f.style.transform = 'translate3d(0,' + ((1-t)*22).toFixed(1) + 'px,0)';
      });
    }

    /* smooth the car */
    var k = RM ? 1 : 0.16;
    cur.ang  = lerp(cur.ang,  car.ang,  k);
    cur.cx   = lerp(cur.cx,   car.cx,   k);
    cur.cy   = lerp(cur.cy,   car.cy,   k);
    cur.wide = lerp(cur.wide, car.wide, k);
    if (afterTurn < 1) draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------------- act 5 · pointer tilt ---------------- */
  var quotes = document.getElementById('quotes');
  if (!RM && window.matchMedia('(pointer:fine)').matches){
    quotes.addEventListener('mousemove', function(e){
      var c = e.target.closest('.q'); if (!c) return;
      var r = c.getBoundingClientRect(), dx = (e.clientX - r.left)/r.width - .5, dy = (e.clientY - r.top)/r.height - .5;
      c.style.transform = 'rotateY(' + (dx*10).toFixed(2) + 'deg) rotateX(' + (-dy*8).toFixed(2) + 'deg) translateZ(12px)';
    });
    Array.prototype.forEach.call(quotes.children, function(c){ c.addEventListener('mouseleave', function(){ c.style.transform = ''; }); });
  }

  /* ---------------- act 3 · choosing a vehicle ----------------
     These cards carry an arrow, so they promise to do something. They used to
     only add .is-on — which the scroll loop above overwrites on the very next
     frame, so a click had no visible effect at all. A choice now:
       - sticks, in its own class the scroll loop does not touch
       - names itself on the booking button, so the choice is carried forward
       - takes the visitor to the booking form, which is the point of choosing
  */
  var chosen = null;
  var bookForm = document.querySelector('.book form.bar');
  var bookLabel = bookForm && bookForm.querySelector('.pill span');
  var bookSection = document.getElementById('book');

  fcards.forEach(function(c){
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', function(){
      chosen = (c.querySelector('h3') || {}).textContent || '';
      chosen = chosen.replace(/\s+/g, ' ').trim();
      fcards.forEach(function(x){
        var on = x === c;
        x.classList.toggle('is-picked', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (bookLabel) bookLabel.textContent = 'Search ' + chosen;
      if (bookSection) bookSection.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* The confirmation lived in an inline onsubmit attribute on the form, which
     meant the chosen vehicle could never appear in it. */
  if (bookForm) bookForm.addEventListener('submit', function(e){
    e.preventDefault();
    if (bookLabel) bookLabel.textContent = chosen ? 'Request sent · ' + chosen : 'Request sent';
  });
})();

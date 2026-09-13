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

  /* ---------------- WebGL car ---------------- */
  var canvas = document.getElementById('gl');
  var gl = canvas.getContext('webgl', { antialias:true, alpha:true, premultipliedAlpha:true });
  var GL = !!gl;

  var VS = [
    'attribute vec3 aPos; attribute vec3 aNor; attribute float aGlass; attribute float aPart;',
    'uniform mat4 uProj, uView, uModel; uniform mat3 uNormal;',
    'varying vec3 vW, vN, vM; varying float vGlass, vPart;',
    'void main(){ vec4 w = uModel*vec4(aPos,1.0); vW = w.xyz; vN = normalize(uNormal*aNor); vM = aPos; vGlass = aGlass; vPart = aPart;',
    '  gl_Position = uProj*uView*w; }'
  ].join('\n');

  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'varying vec3 vW, vN, vM; varying float vGlass, vPart;',
    'uniform vec3 uCam; uniform float uHead, uMirror, uStudio;',
    'vec3 env(vec3 R){',
    '  float y = R.y;',
    '  vec3 c = mix(vec3(0.010,0.016,0.014), vec3(0.05,0.08,0.07), smoothstep(-1.0,1.0,y));',
    '  float hz = exp(-pow(y*13.0,2.0));',
    '  c += hz * vec3(0.95,0.55,0.28) * (0.5+0.5*R.x) * 0.45 * (1.0-0.6*uStudio);',
    '  float s1 = smoothstep(0.50,0.56,y)*smoothstep(0.74,0.68,y);',
    '  float s2 = smoothstep(0.84,0.88,y)*smoothstep(0.99,0.95,y);',
    '  c += (s1*1.3 + s2*0.9) * vec3(0.95,1.0,0.96) * (0.45+0.9*uStudio);',
    '  float s3 = smoothstep(0.12,0.18,y)*smoothstep(0.40,0.34,y) * smoothstep(0.1,0.7,-R.z);',
    '  c += s3 * vec3(0.62,0.95,0.35) * (0.7+0.8*uStudio);',
    '  float s4 = smoothstep(-0.02,0.04,y)*smoothstep(0.16,0.10,y) * smoothstep(0.0,0.6,R.z);',
    '  c += s4 * vec3(1.0,0.85,0.7) * 0.35;',
    '  return c; }',
    'void main(){',
    '  if (vPart > 8.5){',   /* contact shadow quad */
    '    float d = length(vec2(vM.x/2.6, vM.z/1.15));',
    '    float a = 0.85*(1.0-smoothstep(0.35,1.0,d));',
    '    gl_FragColor = vec4(0.0,0.0,0.0,a); return; }',
    '  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);',
    '  if (dot(N,V) < 0.0) N = -N;',
    '  float NdV = max(dot(N,V), 0.0);',
    '  vec3 base; float rough; float metal; float f0;',
    '  bool glass = (vPart < 0.5) && (vM.y > vGlass);',
    '  if (vPart < 0.5){',
    '    if (glass){ base = vec3(0.008,0.012,0.012); rough = 0.06; metal = 0.9; f0 = 0.05; }',
    '    else { base = vec3(0.040,0.085,0.062); rough = 0.22; metal = 0.55; f0 = 0.06; }',
    '  } else if (vPart < 1.5){ base = vec3(0.055,0.06,0.056); rough = 0.9; metal = 0.0; f0 = 0.03; }',
    '  else if (vPart < 2.5){ base = vec3(0.13,0.145,0.135); rough = 0.34; metal = 0.85; f0 = 0.35; }',
    '  else { base = vec3(0.77,0.96,0.35); rough = 0.5; metal = 0.2; f0 = 0.1; }',
    '  vec3 L1 = normalize(vec3(0.55,0.75,0.6)); vec3 C1 = vec3(1.0,0.86,0.72)*1.15;',
    '  vec3 L2 = normalize(vec3(-0.7,0.45,-0.55)); vec3 C2 = vec3(0.55,0.85,0.55)*0.55;',
    '  vec3 diff = base * (1.0-metal) * (max(dot(N,L1),0.0)*C1 + max(dot(N,L2),0.0)*C2 + 0.35*env(N));',
    '  float shin = mix(300.0, 6.0, rough);',
    '  vec3 H1 = normalize(L1+V); vec3 H2 = normalize(L2+V);',
    '  float F = f0 + (1.0-f0)*pow(1.0-NdV, 5.0);',
    '  vec3 spec = (pow(max(dot(N,H1),0.0),shin)*C1 + pow(max(dot(N,H2),0.0),shin)*C2) * (F*(1.0-rough*0.5)+0.05);',
    '  vec3 R = reflect(-V, N);',
    '  vec3 refl = env(R) * mix(F, 1.0, metal) * (1.0 - rough*0.75);',
    '  vec3 col = diff + spec + refl;',
    '  if (vPart < 0.5 && !glass){ col += pow(1.0-NdV, 3.0) * vec3(0.55,0.95,0.42) * 0.22; }',
    '  if (vPart > 2.5){ col += base*0.9; }',
    /* head and tail lights carved by position */
    '  if (vPart < 0.5){',
    '    float hx = smoothstep(1.96,2.02,vM.x);',
    '    float hy = smoothstep(0.50,0.53,vM.y)*smoothstep(0.66,0.63,vM.y);',
    '    float hz = smoothstep(0.38,0.42,abs(vM.z))*smoothstep(0.86,0.82,abs(vM.z));',
    '    col += hx*hy*hz * vec3(0.9,1.0,0.92) * uHead * 2.6;',
    '    float tx = smoothstep(-2.02,-2.08,vM.x);',
    '    float ty = smoothstep(0.66,0.69,vM.y)*smoothstep(0.78,0.75,vM.y);',
    '    float tz = smoothstep(0.86,0.82,abs(vM.z))*smoothstep(0.22,0.28,abs(vM.z));',
    '    col += tx*ty*tz * vec3(1.0,0.16,0.10) * 1.2;',
    '  }',
    '  col = col/(col+vec3(0.9));',      /* soft tone map */
    '  col = pow(col, vec3(0.92));',
    '  float a = 1.0;',
    '  if (uMirror > 0.5){ float fade = clamp(1.0 + vW.y/1.5, 0.0, 1.0); fade *= fade; col *= 0.42*fade; a = 0.85*fade; }',
    '  gl_FragColor = vec4(col*a, a); }'
  ].join('\n');

  function compile(type, src){
    var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); GL = false; }
    return sh;
  }

  /* ---- geometry ---- */
  var P=[], Nn=[], Gl=[], Pt=[], I=[];
  function v3(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
  function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function norm(a){ var l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; }
  function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }

  /* rows: array of rings, each ring an array of [x,y,z]; glassRows: per-row glass line; centerOf(pt,i) for outward test */
  function grid(rows, wrapCols, part, glassRows, centerOf){
    var R = rows.length, K = rows[0].length, base = P.length/3;
    for (var i=0;i<R;i++) for (var j=0;j<K;j++){
      var p = rows[i][j];
      var i0 = Math.max(i-1,0), i1 = Math.min(i+1,R-1);
      var j0 = wrapCols ? (j-1+K)%K : Math.max(j-1,0), j1 = wrapCols ? (j+1)%K : Math.min(j+1,K-1);
      var ti = v3(rows[i1][j], rows[i0][j]), tj = v3(rows[i][j1], rows[i][j0]);
      var n = norm(cross(tj, ti));
      var c = centerOf(p, i);
      if (dot(n, v3(p, c)) < 0) n = [-n[0],-n[1],-n[2]];
      if (Math.hypot(n[0],n[1],n[2]) < 0.5) n = norm(v3(p,c));
      if (Math.hypot(n[0],n[1],n[2]) < 0.5) n = [0,0,(p[2]-c[2]) < 0 ? -1 : 1];
      P.push(p[0],p[1],p[2]); Nn.push(n[0],n[1],n[2]); Gl.push(glassRows ? glassRows[i] : 99); Pt.push(part);
    }
    var JK = wrapCols ? K : K-1;
    for (i=0;i<R-1;i++) for (j=0;j<JK;j++){
      var a = base+i*K+j, b = base+i*K+(j+1)%K, c2 = base+(i+1)*K+j, d = base+(i+1)*K+(j+1)%K;
      I.push(a,c2,b, b,c2,d);
    }
  }

  var X1 = 2.25;
  function section(x){
    var ax = Math.abs(x);
    var y0 = 0.25 + 0.07*smooth((ax-1.5)/0.75);
    var ys = 0.66 + 0.22*Math.exp(-Math.pow(x/1.9,2)) - 0.03*(x/X1);
    var sig = x > -0.35 ? 1.18 : 0.88;
    var bell = Math.exp(-Math.pow((x+0.35)/sig, 4));
    var h = ys + 0.04 + 0.46*bell;
    var w = 0.92 - 0.10*Math.pow(x/X1, 4);
    var capW = 0.32, s = 1;
    if (ax > X1-capW){ var t=(ax-(X1-capW))/capW; s = Math.max(Math.sqrt(Math.max(0,1-t*t)), 0.03); }
    var pts = [], k, t2;
    for (k=0;k<6;k++){ t2=k/5; pts.push([y0, -w + 2*w*t2]); }
    for (k=1;k<=5;k++){ t2=k/5; pts.push([y0+(ys-y0)*t2, w*(1+0.035*Math.sin(Math.PI*t2)-0.04*t2)]); }
    var wr = w*0.96;
    for (k=1;k<=10;k++){ t2=k/10; var u=1-t2;
      pts.push([u*u*ys + 2*u*t2*h + t2*t2*h, u*u*wr + 2*u*t2*(wr*0.72)]); }
    for (k=1;k<=10;k++){ t2=k/10; u=1-t2;
      pts.push([u*u*h + 2*u*t2*h + t2*t2*ys, -(2*u*t2*(wr*0.72) + t2*t2*wr)]); }
    for (k=1;k<=4;k++){ t2=k/5; pts.push([ys+(y0-ys)*t2, -w*(1+0.035*Math.sin(Math.PI*(1-t2))-0.04*(1-t2))]); }
    var cy = (y0+h)/2;
    var ring = pts.map(function(p){ return [x, cy+(p[0]-cy)*s, p[1]*s]; });
    return { ring: ring, glass: (bell > 0.3) ? ys + 0.035 : 99, cy: cy };
  }
  (function body(){
    var SL = 120, rows = [], glass = [], cys = [];
    for (var i=0;i<=SL;i++){ var x = -X1 + 2*X1*i/SL; var sc = section(x); rows.push(sc.ring); glass.push(sc.glass); cys.push(sc.cy); }
    grid(rows, true, 0, glass, function(p,i){ return [p[0], cys[i], 0]; });
  })();
  function revolve(profile, cx, cy, cz, sign, part, segs){
    var rows = [];
    for (var a=0;a<=segs;a++){ var th = a/segs*Math.PI*2, ring = [];
      for (var k=0;k<profile.length;k++){ var r = profile[k][0], z = profile[k][1]*sign;
        ring.push([cx + r*Math.cos(th), cy + r*Math.sin(th), cz + z]); }
      rows.push(ring); }
    grid(rows, false, part, null, function(p){ return [cx, cy, cz]; });
  }
  [[-1.42, 0.88],[-1.42,-0.88],[1.42,0.88],[1.42,-0.88]].forEach(function(wp){
    var sign = wp[1] > 0 ? 1 : -1, cx = wp[0], cz = wp[1], cy = 0.34;
    revolve([[0.23,-0.17],[0.30,-0.16],[0.335,-0.10],[0.34,0],[0.335,0.10],[0.30,0.16],[0.23,0.17]], cx, cy, cz, sign, 1, 40);
    revolve([[0.0,0.13],[0.15,0.15],[0.215,0.158],[0.23,0.145],[0.235,0.12]], cx, cy, cz, sign, 2, 40);
    revolve([[0.0,-0.13],[0.22,-0.14]], cx, cy, cz, sign, 2, 24);
    revolve([[0.235,0.12],[0.255,0.15],[0.245,0.175],[0.225,0.165]], cx, cy, cz, sign, 3, 40);
  });
  (function shadow(){
    var base = P.length/3;
    var q = [[-3.2,0.004,-1.7],[3.2,0.004,-1.7],[3.2,0.004,1.7],[-3.2,0.004,1.7]];
    q.forEach(function(p){ P.push(p[0],p[1],p[2]); Nn.push(0,1,0); Gl.push(99); Pt.push(9); });
    I.push(base,base+1,base+2, base,base+2,base+3);
  })();

  /* ---- matrices ---- */
  function perspective(fov, aspect, n, f){ var t=1/Math.tan(fov/2), nf=1/(n-f);
    return new Float32Array([t/aspect,0,0,0, 0,t,0,0, 0,0,(f+n)*nf,-1, 0,0,2*f*n*nf,0]); }
  function lookAt(e, c, up){
    var z = norm(v3(e,c)), x = norm(cross(up,z)), y = cross(z,x);
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -dot(x,e), -dot(y,e), -dot(z,e), 1]); }
  function model(tx,ty,tz, ang, my){ var c=Math.cos(ang), s=Math.sin(ang);
    return new Float32Array([c,0,-s,0, 0,my,0,0, s,0,c,0, tx,ty,tz,1]); }
  function nmat(ang, my){ var c=Math.cos(ang), s=Math.sin(ang);
    return new Float32Array([c,0,-s, 0,my,0, s,0,c]); }

  var prog, loc = {}, idxCount = I.length, shadowStart = I.length-6;
  if (GL){
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); GL = false; }
  }
  if (GL){
    gl.useProgram(prog);
    function attr(name, data, size){
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      var l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    }
    attr('aPos', P, 3); attr('aNor', Nn, 3); attr('aGlass', Gl, 1); attr('aPart', Pt, 1);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    var ext = gl.getExtension('OES_element_index_uint');
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ext ? new Uint32Array(I) : new Uint16Array(I), gl.STATIC_DRAW);
    var itype = ext ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    ['uProj','uView','uModel','uNormal','uCam','uHead','uMirror','uStudio'].forEach(function(n){ loc[n] = gl.getUniformLocation(prog, n); });
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0,0,0,0);
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
    if (GL) gl.viewport(0,0,canvas.width,canvas.height);
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

  var car = { x:1.95, ang:-0.6, camY:1.15, camZ:8.4, tgtY:0.55, head:0.7, studio:0, alpha:1 };
  var cur = { ang:-0.6, x:1.95, camZ:8.4, tgtY:0.55, head:0.7 };

  function draw(){
    if (!GL) return;
    var mob = mobileQ.matches, aspect = W/H;
    var fov = mob ? 0.78 : 0.56;
    var eye = [0.0, car.camY, cur.camZ], tgt = [0, cur.tgtY, 0];
    var proj = perspective(fov, aspect, 0.1, 60), view = lookAt(eye, tgt, [0,1,0]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(loc.uProj, false, proj); gl.uniformMatrix4fv(loc.uView, false, view);
    gl.uniform3fv(loc.uCam, eye); gl.uniform1f(loc.uHead, cur.head); gl.uniform1f(loc.uStudio, car.studio);
    /* mirror */
    gl.uniform1f(loc.uMirror, 1);
    gl.uniformMatrix4fv(loc.uModel, false, model(cur.x,0,0,cur.ang,-1)); gl.uniformMatrix3fv(loc.uNormal, false, nmat(cur.ang,-1));
    gl.drawElements(gl.TRIANGLES, shadowStart, itype, 0);
    /* shadow */
    gl.uniform1f(loc.uMirror, 0);
    gl.depthMask(false);
    gl.uniformMatrix4fv(loc.uModel, false, model(cur.x,0,0,cur.ang,1)); gl.uniformMatrix3fv(loc.uNormal, false, nmat(cur.ang,1));
    gl.drawElements(gl.TRIANGLES, 6, itype, shadowStart*(ext?4:2));
    gl.depthMask(true);
    /* car */
    gl.drawElements(gl.TRIANGLES, shadowStart, itype, 0);
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
    var heroX = mob ? 0 : 1.95;
    var heroTgtY = mob ? 3.9 : 0.55, heroZ = mob ? 14.0 : 8.4;
    var inTurn = win(p2, 0, 0.14);
    car.x = lerp(heroX, 0, smooth(inTurn));
    car.tgtY = lerp(heroTgtY, mob ? 1.25 : 0.62, smooth(inTurn));
    car.camZ = lerp(heroZ, mob ? 10.5 : 7.7, smooth(inTurn));
    var spin = smooth(win(p2, 0.12, 0.92));
    car.ang = -0.6 + p1*0.25 + spin*Math.PI*2;
    car.camY = 1.15 + Math.sin(spin*Math.PI)*0.45;
    car.head = 0.55 + v*2.6 + 0.25*Math.max(0, Math.cos(car.ang+0.6)) ;
    car.studio = win(p2, 0.0, 0.25);
    if (RM){ car.ang = -0.6; car.x = heroX; car.head = 0.7; car.studio = 0; }
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
    cur.ang = lerp(cur.ang, car.ang, k); cur.x = lerp(cur.x, car.x, k);
    cur.camZ = lerp(cur.camZ, car.camZ, k); cur.tgtY = lerp(cur.tgtY, car.tgtY, k); cur.head = lerp(cur.head, car.head, 0.2);
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

  /* fleet cards: tap selects */
  fcards.forEach(function(c){ c.addEventListener('click', function(){ fcards.forEach(function(x){ x.classList.remove('is-on'); }); c.classList.add('is-on'); }); });
})();

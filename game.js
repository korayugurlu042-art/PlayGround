(() => {
  'use strict';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('nextCanvas');
  const nctx = nextCanvas.getContext('2d');
  const houseCanvas = document.getElementById('houseCanvas');
  const hctx = houseCanvas.getContext('2d');
  const COLS = 10, ROWS = 18, CW = 43, CH = 38, BX = 35, BY = 17;
  const SHAPES = [
    {name:'I', color:'#74c4b0', cells:[[0,1],[1,1],[2,1],[3,1]]},
    {name:'O', color:'#e8c66f', cells:[[1,0],[2,0],[1,1],[2,1]]},
    {name:'T', color:'#b18ad0', cells:[[1,0],[0,1],[1,1],[2,1]]},
    {name:'S', color:'#a9cd78', cells:[[1,0],[2,0],[0,1],[1,1]]},
    {name:'Z', color:'#e1846b', cells:[[0,0],[1,0],[1,1],[2,1]]},
    {name:'J', color:'#79a8d1', cells:[[0,0],[0,1],[1,1],[2,1]]},
    {name:'L', color:'#d99566', cells:[[2,0],[0,1],[1,1],[2,1]]}
  ];
  const COLORS = Object.fromEntries(SHAPES.map(s => [s.name, s.color]));
  let board = newBoard(), piece = null, nextPiece = null, state = 'ready', score = 0, lines = 0, level = 1;
  let lastTime = 0, fallTimer = 0, soft = false, particles = [], audio = null, soundOn = true;
  let best = Number(localStorage.getItem('blockBeamBest') || 0);
  document.getElementById('best').textContent = String(best).padStart(5, '0');

  function newBoard(){ return Array.from({length:ROWS}, () => Array(COLS).fill(null)); }
  function pick(){ const s = SHAPES[Math.floor(Math.random() * SHAPES.length)]; return {name:s.name,color:s.color,cells:s.cells.map(([x,y])=>[x,y]),x:3,y:-1}; }
  function clonePiece(p){ return {name:p.name,color:p.color,cells:p.cells.map(c=>[...c]),x:p.x,y:p.y}; }
  function reset(){
    board = newBoard(); score = 0; lines = 0; level = 1; nextPiece = pick(); piece = pick();
    state = 'playing'; lastTime = 0; fallTimer = 0; soft = false; particles=[];
    document.getElementById('startOverlay').classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    document.getElementById('status').innerHTML = '<span></span> BUILDING IN PROGRESS';
    document.getElementById('status').classList.add('playing'); updateUI(); playTone(520,.08); requestAnimationFrame(loop);
  }
  function valid(p){
    return p.cells.every(([dx,dy])=>{const x=p.x+dx,y=p.y+dy;return x>=0&&x<COLS&&y<ROWS&&(y<0||!board[y][x]);});
  }
  function shift(dx,dy){if(state!=='playing')return false;const q=clonePiece(piece);q.x+=dx;q.y+=dy;if(valid(q)){piece=q;return true;}return false;}
  function rotate(){
    if(state!=='playing')return; const q=clonePiece(piece);
    q.cells=q.cells.map(([x,y])=>[2-y,x]);
    let minX=Math.min(...q.cells.map(c=>c[0])),minY=Math.min(...q.cells.map(c=>c[1]));
    q.cells=q.cells.map(([x,y])=>[x-minX,y-minY]);
    for(const kick of [0,-1,1,-2,2]){const r=clonePiece(q);r.x+=kick;if(valid(r)){piece=r;playTone(480,.045);return;}}
  }
  function lock(){
    let above=false;
    piece.cells.forEach(([dx,dy])=>{const x=piece.x+dx,y=piece.y+dy;if(y<0)above=true;else board[y][x]=piece.color;});
    if(above){endGame();return;}
    let removed=0;
    for(let y=ROWS-1;y>=0;){if(board[y].every(Boolean)){board.splice(y,1);board.unshift(Array(COLS).fill(null));removed++;}else y--;}
    if(removed){const points=[0,100,300,500,800][removed]||800;score+=points*level;lines+=removed;spawnSparkles();playTone(690,.12);setTimeout(()=>playTone(890,.13),90);}
    else playTone(220,.035);
    level=1+Math.floor(lines/5);
    piece=nextPiece;piece.x=3;piece.y=-1;nextPiece=pick();
    if(!valid(piece))endGame(); updateUI();
  }
  function hardDrop(){if(state!=='playing')return;let n=0;while(shift(0,1))n++;score+=n*2;lock();playTone(170,.06);updateUI();}
  function endGame(){state='over';document.getElementById('gameOverOverlay').classList.remove('hidden');document.getElementById('status').innerHTML='<span></span> THE SITE IS FULL';document.getElementById('status').classList.remove('playing');if(score>best){best=score;localStorage.setItem('blockBeamBest',best);document.getElementById('best').textContent=String(best).padStart(5,'0');}}
  function updateUI(){
    document.getElementById('score').textContent=String(score).padStart(5,'0');
    document.getElementById('lines').textContent=String(lines).padStart(2,'0');
    document.getElementById('level').textContent=String(level).padStart(2,'0');
    const progress=lines%13, pct=Math.min(100,Math.round(progress/12*100));
    document.getElementById('progressText').textContent=`${pct}%`;
    document.getElementById('progressBar').style.width=`${pct}%`;
    document.getElementById('chapter').textContent=String(Math.floor(lines/12)+1).padStart(2,'0');
    const stage=progress;
    const names=['The little starter','The little starter','The little starter','The little starter','The little starter','The little starter','A home in the making','A home in the making','A home in the making','A home in the making','A home in the making','A home in the making','Your very own home'];
    document.getElementById('houseName').textContent=names[stage];
    const messages=['Clear lines to lay the foundation.','A fresh plot, full of possibility.','The first floorboards are in.','A solid place to start.','Look at that foundation grow.','A little more room to dream.','The walls are coming together.','Starting to feel like home.','Windows for the morning light.','Almost time to move in.','The roof is nearly yours.','Just a few finishing touches.','A home, built one block at a time!'];
    document.getElementById('houseMessage').textContent=messages[stage];
    drawNext();drawHouse(stage);
  }
  function block(g,x,y,w,h,color,alpha=1){
    g.save();g.globalAlpha=alpha;
    g.fillStyle='rgba(5,12,10,.5)';g.fillRect(x+2,y+3,w-1,h-1);
    g.fillStyle=color;g.fillRect(x+1,y+1,w-3,h-3);
    g.fillStyle='rgba(255,255,255,.25)';g.fillRect(x+2,y+2,w-5,2);g.fillRect(x+2,y+2,2,h-5);
    g.fillStyle='rgba(5,15,12,.18)';g.fillRect(x+w-4,y+3,2,h-6);g.fillRect(x+3,y+h-4,w-6,2);
    g.fillStyle='rgba(255,255,255,.06)';g.fillRect(x+5,y+5,Math.max(3,w-11),Math.max(2,h-11));
    g.restore();
  }
  function drawBoard(){
    const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
    const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#14211e');bg.addColorStop(1,'#111a18');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const glow=ctx.createRadialGradient(255,220,10,250,300,390);glow.addColorStop(0,'rgba(91,126,87,.10)');glow.addColorStop(1,'rgba(13,22,19,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.strokeStyle='rgba(188,220,177,.045)';ctx.lineWidth=1;
    for(let i=0;i<7;i++){let x=i%2?12:488;ctx.beginPath();ctx.moveTo(x,30+i*92);ctx.lineTo(x+(i%2?8:-8),33+i*92);ctx.stroke();}
    const bw=COLS*CW,bh=ROWS*CH;
    ctx.fillStyle='#101917';ctx.fillRect(BX-5,BY-5,bw+10,bh+10);
    ctx.strokeStyle='rgba(198,226,180,.12)';ctx.strokeRect(BX-5.5,BY-5.5,bw+11,bh+11);
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const px=BX+x*CW,py=BY+y*CH;
      ctx.fillStyle=(x+y)%2?'rgba(130,163,137,.025)':'rgba(130,163,137,.04)';ctx.fillRect(px,py,CW-1,CH-1);
      if(board[y][x]) block(ctx,px+1,py+1,CW-2,CH-2,board[y][x]);
    }
    if(piece&&state!=='over'){
      let gy=piece.y;while(valid({...piece,y:gy+1}))gy++;
      if(gy!==piece.y)piece.cells.forEach(([dx,dy])=>{if(gy+dy>=0)block(ctx,BX+(piece.x+dx)*CW+2,BY+(gy+dy)*CH+2,CW-5,CH-5,piece.color,.22);});
      piece.cells.forEach(([dx,dy])=>{if(piece.y+dy>=0)block(ctx,BX+(piece.x+dx)*CW+1,BY+(piece.y+dy)*CH+1,CW-2,CH-2,piece.color);});
    }
    ctx.restore();
    particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.life-=1;ctx.globalAlpha=Math.max(0,p.life/34);ctx.fillStyle='#d5ef9e';ctx.fillRect(p.x,p.y,2,2);});ctx.globalAlpha=1;
  }
  function drawNext(){
    nctx.clearRect(0,0,200,130);if(!nextPiece)return;
    const cells=nextPiece.cells;let maxX=Math.max(...cells.map(c=>c[0]))+1,maxY=Math.max(...cells.map(c=>c[1]))+1;
    const size=25,x0=(200-maxX*size)/2,y0=(98-maxY*size)/2+7;
    cells.forEach(([x,y])=>block(nctx,x0+x*size,y0+y*size,size-1,size-1,nextPiece.color));
  }
  function spawnSparkles(){for(let i=0;i<38;i++)particles.push({x:BX+Math.random()*COLS*CW,y:BY+Math.random()*ROWS*CH,life:18+Math.random()*18});}
  function cube(g,x,y,z,color,scale=1){
    const u=19*scale,v=10*scale,d=19*scale;
    const sx=160+(x-z)*u, sy=156+(x+z)*v-y*d;
    g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+u,sy+v);g.lineTo(sx,sy+2*v);g.lineTo(sx-u,sy+v);g.closePath();g.fillStyle=shade(color,1.08);g.fill();g.strokeStyle='rgba(26,39,30,.28)';g.lineWidth=.6;g.stroke();
    g.beginPath();g.moveTo(sx-u,sy+v);g.lineTo(sx,sy+2*v);g.lineTo(sx,sy+2*v+d);g.lineTo(sx-u,sy+v+d);g.closePath();g.fillStyle=shade(color,.70);g.fill();g.stroke();
    g.beginPath();g.moveTo(sx+u,sy+v);g.lineTo(sx,sy+2*v);g.lineTo(sx,sy+2*v+d);g.lineTo(sx+u,sy+v+d);g.closePath();g.fillStyle=shade(color,.84);g.fill();g.stroke();
  }
  function shade(hex,k){const v=parseInt(hex.slice(1),16),r=Math.min(255,Math.round((v>>16)*k)),g=Math.min(255,Math.round(((v>>8)&255)*k)),b=Math.min(255,Math.round((v&255)*k));return `rgb(${r},${g},${b})`;}
  function drawHouse(stage=0){
    hctx.clearRect(0,0,320,210);
    const sky=hctx.createLinearGradient(0,0,0,200);sky.addColorStop(0,'#1b2c28');sky.addColorStop(1,'#172521');hctx.fillStyle=sky;hctx.fillRect(0,0,320,210);
    hctx.fillStyle='rgba(182,211,144,.08)';hctx.beginPath();hctx.arc(245,37,18,0,Math.PI*2);hctx.fill();hctx.fillStyle='rgba(208,228,167,.5)';hctx.beginPath();hctx.arc(245,37,7,0,Math.PI*2);hctx.fill();
    // Little distant pines
    for(const [x,y,s] of [[35,96,.55],[280,90,.7],[63,105,.38],[252,103,.42]]){hctx.fillStyle='#25382e';hctx.beginPath();hctx.moveTo(x,y-29*s);hctx.lineTo(x-12*s,y);hctx.lineTo(x+12*s,y);hctx.fill();hctx.fillStyle='#314737';hctx.fillRect(x-2*s,y,4*s,12*s);}
    // Floating meadow base
    hctx.beginPath();hctx.moveTo(160,93);hctx.lineTo(291,142);hctx.lineTo(160,194);hctx.lineTo(29,142);hctx.closePath();hctx.fillStyle='#526c46';hctx.fill();
    hctx.beginPath();hctx.moveTo(29,142);hctx.lineTo(160,194);hctx.lineTo(160,205);hctx.lineTo(29,153);hctx.closePath();hctx.fillStyle='#344d39';hctx.fill();
    hctx.beginPath();hctx.moveTo(291,142);hctx.lineTo(160,194);hctx.lineTo(160,205);hctx.lineTo(291,153);hctx.closePath();hctx.fillStyle='#405a3d';hctx.fill();
    // A flat, tile-lined meadow keeps the empty plot airy until construction begins.
    hctx.save();hctx.strokeStyle='rgba(194,218,156,.12)';hctx.lineWidth=.7;
    for(let i=1;i<8;i++){const t=i/8;hctx.beginPath();hctx.moveTo(29+131*t,142+52*t);hctx.lineTo(291-131*t,142+52*t);hctx.stroke();}
    for(let i=1;i<8;i++){const t=i/8;hctx.beginPath();hctx.moveTo(160-131*t,93+49*t);hctx.lineTo(160-131*t,194-52*t);hctx.stroke();hctx.beginPath();hctx.moveTo(160+131*t,93+49*t);hctx.lineTo(160+131*t,194-52*t);hctx.stroke();}
    hctx.restore();
    hctx.fillStyle='#b9cc83';hctx.fillRect(79,142,2,2);hctx.fillRect(239,149,2,2);hctx.fillRect(102,160,2,2);hctx.fillRect(222,129,2,2);
    if(stage>=1){for(let x=0;x<4;x++)for(let z=0;z<3;z++)cube(hctx,x+.5,z+.5,1,'#997950',.88);}
    const wallColor='#d6c69a';
    let wallH=stage<2?0:stage<4?1:stage<6?2:stage<8?3:stage<10?4:4;
    if(wallH){
      for(let y=1;y<=wallH;y++){
        for(let x=0;x<4;x++){cube(hctx,x+.5,-.05,y,wallColor,.9);cube(hctx,x+.5,3.05,y,wallColor,.9);}
        for(let z=0;z<3;z++){cube(hctx,-.05,z+.5,y,wallColor,.9);cube(hctx,4.05,z+.5,y,wallColor,.9);}
      }
      // honey-colored front door and window inset
      if(wallH>=2){cube(hctx,2.1,-.08,1,'#72553a',.67);cube(hctx,.8,-.08,2,'#83bdaf',.59);cube(hctx,3.25,-.08,2,'#83bdaf',.59);}
    }
    if(stage>=10){
      for(let layer=0;layer<3;layer++){
        const z=layer;
        for(let x=-1;x<6;x++)cube(hctx,x,z-.5,5+layer,'#a85e4b',.92);
        for(let x=-1;x<6;x++)cube(hctx,x,3.5-z,5+layer,'#bc7053',.92);
      }
    }
    // Window shine and small chimney
    if(stage>=7&&stage<10){cube(hctx,1.2,1.4,wallH+1,'#94c9b8',.56);cube(hctx,3.3,1.4,wallH+1,'#94c9b8',.56);}
    if(stage>=11){cube(hctx,3.55,2.4,7,'#8e6245',.7);}
    // Warm pixel path
    for(let i=0;i<3;i++)cube(hctx,2.1,-1.2-i*.75,0,'#c7ae70',.66);
    if(stage>=12){hctx.fillStyle='rgba(242,219,135,.20)';hctx.fillRect(182,113,8,13);}
    // twinkling fireflies
    hctx.fillStyle='rgba(205,227,144,.8)';hctx.fillRect(45,53,2,2);hctx.fillRect(270,69,2,2);hctx.fillRect(224,90,2,2);
  }
  function loop(t){
    if(state!=='playing')return;
    const dt=Math.min(50,t-(lastTime||t));lastTime=t;fallTimer+=dt;
    const interval=soft?45:Math.max(100,750-(level-1)*58);
    if(fallTimer>=interval){fallTimer=0;if(!shift(0,1))lock();}
    drawBoard();requestAnimationFrame(loop);
  }
  function startPause(){if(state==='ready'){reset();return;}if(state==='playing'){state='paused';document.getElementById('pauseOverlay').classList.remove('hidden');document.getElementById('status').innerHTML='<span></span> TAKING A BREATHER';document.getElementById('status').classList.remove('playing');}else if(state==='paused'){resume();}}
  function resume(){if(state!=='paused')return;state='playing';lastTime=0;document.getElementById('pauseOverlay').classList.add('hidden');document.getElementById('status').innerHTML='<span></span> BUILDING IN PROGRESS';document.getElementById('status').classList.add('playing');requestAnimationFrame(loop);}
  function action(a){if(state==='ready'){reset();return;}if(state!=='playing')return;switch(a){case'left':if(shift(-1,0))playTone(330,.025);break;case'right':if(shift(1,0))playTone(370,.025);break;case'rotate':rotate();break;case'down':if(!shift(0,1))lock();else{score++;updateUI();}break;case'drop':hardDrop();break;case'pause':startPause();break;}drawBoard();}
  document.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();if(['arrowleft','arrowright','arrowdown','arrowup',' ','w','a','s','d','p','enter'].includes(k))e.preventDefault();
    if(k==='enter'){if(state==='ready'||state==='over')reset();else if(state==='paused')resume();return;}
    if(k==='p'||k==='escape'){startPause();return;}
    const map={arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowup:'rotate',w:'rotate',arrowdown:'down',s:'down',' ':'drop'};if(map[k])action(map[k]);
  });
  document.getElementById('startButton').addEventListener('click',reset);
  document.getElementById('resumeButton').addEventListener('click',resume);
  document.getElementById('retryButton').addEventListener('click',reset);
  document.querySelectorAll('.mobile-controls button').forEach(button=>{
    const a=button.dataset.action;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);action(a);if(a==='down'){soft=true;}});
    const stop=()=>{soft=false;};button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop);
  });
  document.getElementById('soundToggle').addEventListener('click',()=>{soundOn=!soundOn;document.getElementById('soundIcon').textContent=soundOn?'♫':'♪';document.getElementById('soundToggle').style.opacity=soundOn?'1':'.62';if(soundOn)playTone(520,.07);});
  function playTone(freq,duration){if(!soundOn)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch(_){}}
  drawBoard();drawHouse(0);drawNext();
})();

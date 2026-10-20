import * as THREE from 'three';
import './styles.css';

const $ = (id) => document.getElementById(id);
const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

const flowers = [
  { id:'peony', name:'Sarah Bernhardt', common:'Peony', latin:'Paeonia lactiflora', kicker:'PAEONIA LACTIFLORA', caption:'Softness, made visible.', petalTag:'Layered petals', toneTag:'Blush', colors:['#e8a1b1','#f3bac7','#f7d4d4','#f3c7ce'], center:'#d8a34b', count:12, layers:4, length:0.86, width:0.32, open:-0.10, closed:1.25, wave:0.10, kind:'ruffled' },
  { id:'rose', name:'Velvet Nocturne', common:'Rose', latin:'Rosa × hybrida', kicker:'ROSA × HYBRIDA', caption:'A quiet kind of devotion.', petalTag:'Spiral rosette', toneTag:'Velvet red', colors:['#9b3851','#b64d65','#d06c7e','#e398a4'], center:'#e2bc70', count:9, layers:4, length:0.78, width:0.28, open:-0.05, closed:1.34, wave:0.06, kind:'rose' },
  { id:'tulip', name:'Apricot Impression', common:'Tulip', latin:'Tulipa gesneriana', kicker:'TULIPA GESNERIANA', caption:'A little light, held in a cup.', petalTag:'Sculpted cup', toneTag:'Apricot', colors:['#e5a078','#f0b18d','#f6c6a8'], center:'#e4bb65', count:6, layers:1, length:1.05, width:0.40, open:0.05, closed:1.52, wave:0.06, kind:'tulip' },
  { id:'orchid', name:'Phalaenopsis Pearl', common:'Orchid', latin:'Phalaenopsis amabilis', kicker:'PHALAENOPSIS AMABILIS', caption:'Unexpected, and entirely itself.', petalTag:'Sculptural petals', toneTag:'Pearl', colors:['#e7dce6','#d8c5df','#f7ebf2'], center:'#e2a74f', count:6, layers:2, length:0.88, width:0.32, open:-0.02, closed:1.18, wave:0.12, kind:'orchid' },
  { id:'camellia', name:'Winter’s Blush', common:'Camellia', latin:'Camellia japonica', kicker:'CAMELLIA JAPONICA', caption:'A stillness that holds its shape.', petalTag:'Tightly layered', toneTag:'Rose quartz', colors:['#c96c84','#dc8da1','#f0bec7','#f6d6d9'], center:'#ddad52', count:11, layers:3, length:0.80, width:0.29, open:-0.08, closed:1.30, wave:0.08, kind:'round' },
  { id:'waterlily', name:'Moonwater', common:'Water lily', latin:'Nymphaea odorata', kicker:'NYMPHAEA ODORATA', caption:'Where the light rests.', petalTag:'Radial star bloom', toneTag:'Pearl / blue', colors:['#c7d9e9','#dce7f1','#f2edf3'], center:'#e7be67', count:14, layers:3, length:0.90, width:0.20, open:-0.18, closed:1.18, wave:0.025, kind:'slender' },
];
const environments = {
  studio:{name:'Porcelain studio', bg:'#e9e5df', ground:'#e0dbd3', fog:'#e9e5df', light:'#fff8f1', accent:'#d5aa8d', mood:'warm'},
  greenhouse:{name:'Twilight greenhouse', bg:'#dbe0d8', ground:'#cfd6ca', fog:'#dbe0d8', light:'#e4f0df', accent:'#869a7c', mood:'green'},
  pond:{name:'Moonlit pond', bg:'#dce1e8', ground:'#a8bdc4', fog:'#dce1e8', light:'#e0e9fa', accent:'#8c9fba', mood:'blue'},
  meadow:{name:'Aurora meadow', bg:'#e3dfea', ground:'#c8d8c8', fog:'#e3dfea', light:'#f2e6fb', accent:'#b3a1cb', mood:'lilac'},
};

const state = {
  flowerIndex:0, environment:'studio', targetBloom:0.68, bloom:0.68,
  autoRotate:true, particles:true, mode:'open', cameraOn:false, modelReady:false, modelFailed:false,
  lang:'en', gesture:'Waiting for input', confidence:0, latency:0, rawOpen:0,
  filteredOpen:0.5, filteredPinch:0.5, neutralOffset:0, calibrationValue:0.5,
  candidateGesture:'', candidateFrames:0, stableGesture:'', handledGesture:'', lastGestureAt:0,
  lastWrist:null, lastWristTime:0, lastInferenceAt:0, inferFps:0,
};

// Three.js scene: animated articulated petals are deliberately meshes, not Gaussian splats.
const stage = $('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(environments.studio.bg);
scene.fog = new THREE.Fog(environments.studio.fog, 8, 22);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 2.55, 9.8);
camera.lookAt(0, 1.65, 0);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'flowerCanvas';
renderer.domElement.setAttribute('aria-label','Interactive 3D flower. Drag to rotate.');
stage.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight('#fffaf4','#6d746b',2.0));
const keyLight = new THREE.DirectionalLight('#fff4e8',3.0); keyLight.position.set(4,7,5); keyLight.castShadow = true; keyLight.shadow.mapSize.set(1024,1024); scene.add(keyLight);
const fillLight = new THREE.DirectionalLight('#d8e0fb',1.6); fillLight.position.set(-5,3,1); scene.add(fillLight);
const rimLight = new THREE.PointLight('#f1b6c6',30,10); rimLight.position.set(1.5,4,0.3); scene.add(rimLight);
const floorMat = new THREE.MeshStandardMaterial({ color:environments.studio.ground, roughness:0.92, metalness:0.02 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60,60), floorMat); floor.rotation.x=-Math.PI/2; floor.position.y=-0.035; floor.receiveShadow=true; scene.add(floor);
const disc = new THREE.Mesh(new THREE.CircleGeometry(2.1,72),new THREE.MeshStandardMaterial({color:'#f5eee7',roughness:0.8,metalness:0.03})); disc.rotation.x=-Math.PI/2; disc.position.y=-0.016; disc.receiveShadow=true; scene.add(disc);
const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.0,48),new THREE.MeshBasicMaterial({color:'#9e8b7e',transparent:true,opacity:0.10,depthWrite:false})); shadowDisc.rotation.x=-Math.PI/2; shadowDisc.position.y=-0.008; shadowDisc.scale.set(1.3,0.5,1); scene.add(shadowDisc);
const flowerRig = new THREE.Group(); flowerRig.position.y=0.06; scene.add(flowerRig);
const flowerHead = new THREE.Group(); flowerHead.position.set(0,2.27,0); flowerRig.add(flowerHead);
const petalPivots = [];
const pollenGroup = new THREE.Group(); scene.add(pollenGroup);
const pollen = [];
for(let i=0;i<74;i++){
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.012 + Math.random()*0.013,6,6),new THREE.MeshBasicMaterial({color:i%4===0?'#d8a46f':'#fff9ef',transparent:true,opacity:0.65,depthWrite:false}));
  m.position.set((Math.random()-0.5)*5,Math.random()*4.5,(Math.random()-0.5)*2.5); m.userData.phase=Math.random()*Math.PI*2; m.userData.speed=0.25+Math.random()*0.6; pollenGroup.add(m); pollen.push(m);
}
const envDecoration = new THREE.Group(); scene.add(envDecoration);
const envMaterialObjects = [];
function addEnvDecor(){
  // Glasshouse mullions
  for (const x of [-3.2,-2.35,2.35,3.2]) { const mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.04,5,8),new THREE.MeshStandardMaterial({color:'#92a698',transparent:true,opacity:0.16,roughness:0.3,metalness:0.2}));mesh.position.set(x,2.4,-1.4);envDecoration.add(mesh);envMaterialObjects.push(mesh.material); }
  // Pond ripples and lily pads
  for(let i=0;i<5;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(0.4+i*.28,0.42+i*.28,72),new THREE.MeshBasicMaterial({color:'#e5edf4',transparent:true,opacity:0.0,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(-1.5+i*.65,0.008+i*.0005,-0.5);ring.userData.pondRing=true;envDecoration.add(ring);envMaterialObjects.push(ring.material);}
  for(let i=0;i<3;i++){const pad=new THREE.Mesh(new THREE.CircleGeometry(0.22+i*.04,7),new THREE.MeshStandardMaterial({color:'#7f9f92',roughness:0.55,transparent:true,opacity:0.0}));pad.rotation.x=-Math.PI/2;pad.position.set(-1.3+i*0.9,0.018,-0.55+i*.25);pad.userData.pondPad=true;envDecoration.add(pad);envMaterialObjects.push(pad.material);}
  // Meadow specks
  for(let i=0;i<20;i++){const orb=new THREE.Mesh(new THREE.SphereGeometry(0.025,6,6),new THREE.MeshBasicMaterial({color:i%2?'#dfc8e8':'#d6d6a4',transparent:true,opacity:0.0}));orb.position.set((Math.random()-.5)*6,Math.random()*3.1,(Math.random()-.5)*2);orb.userData.meadow=true;envDecoration.add(orb);envMaterialObjects.push(orb.material);}
  // Background vertical arch shapes in the studio
  for(let i=0;i<3;i++){const arch=new THREE.Mesh(new THREE.TorusGeometry(1.9+i*.55,0.012,6,100,Math.PI),new THREE.MeshBasicMaterial({color:'#c2a692',transparent:true,opacity:0.18}));arch.position.set(0,2.1,-2.5-i*.2);arch.rotation.z=Math.PI;arch.scale.y=1.22;envDecoration.add(arch);envMaterialObjects.push(arch.material);}
}
addEnvDecor();

function petalGeometry(length,width,kind,wave){
  const along=22, across=12, positions=[], indices=[];
  for(let i=0;i<=along;i++){
    const u=i/along;
    let envelope=Math.pow(Math.sin(Math.PI*u),kind==='slender'?0.58:kind==='tulip'?0.56:kind==='ruffled'?0.48:0.72);
    if(kind==='rose') envelope*=0.82+0.18*Math.sin(u*Math.PI*4);
    if(kind==='ruffled') envelope*=0.88+0.12*Math.sin(u*Math.PI*7);
    const localWidth=width*envelope*(0.92+wave*Math.sin(u*Math.PI*5));
    for(let j=0;j<=across;j++){
      const v=(j/across)*2-1;
      const z=v*localWidth;
      const y=(0.12*Math.sin(Math.PI*u))+(0.09*(1-v*v)*Math.sin(Math.PI*u)) + wave*0.24*Math.sin(u*Math.PI*5+v*1.4)*Math.abs(v);
      positions.push(u*length,y,z);
    }
  }
  for(let i=0;i<along;i++)for(let j=0;j<across;j++){
    const a=i*(across+1)+j,b=a+across+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function material(color, opacity=1){return new THREE.MeshPhysicalMaterial({color,roughness:0.43,metalness:0.015,side:THREE.DoubleSide,transparent:opacity<1,opacity,clearcoat:0.18,clearcoatRoughness:0.65});}
function addLeaf(parent, sign, y){
  const g=new THREE.Group(); g.position.set(sign*0.02,y,0); g.rotation.y=sign*0.28;g.rotation.z=sign*0.45;
  const leafGeo=petalGeometry(0.93,0.24,'slender',0.035);
  const leaf=new THREE.Mesh(leafGeo,new THREE.MeshStandardMaterial({color:'#69866d',roughness:0.65,side:THREE.DoubleSide}));leaf.scale.set(1,0.7,1);leaf.castShadow=true;g.add(leaf);
  const vein=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.009,0.76,5),new THREE.MeshStandardMaterial({color:'#a4b49a',roughness:0.8}));vein.position.set(0.38,0.075,0);vein.rotation.z=Math.PI/2;g.add(vein);parent.add(g);
}
function clearGroup(group){while(group.children.length){const child=group.children.pop();child.traverse?.(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}}
function buildFlower(spec){
  clearGroup(flowerRig);petalPivots.length=0;
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.064,2.32,14),new THREE.MeshStandardMaterial({color:'#66816a',roughness:0.78}));stem.position.set(0,1.13,0);stem.castShadow=true;stem.receiveShadow=true;flowerRig.add(stem);
  addLeaf(flowerRig,-1,0.64);addLeaf(flowerRig,1,1.05);
  const head=new THREE.Group();head.position.set(0,2.26,0);flowerRig.add(head);
  const sepalGroup=new THREE.Group();head.add(sepalGroup);
  for(let i=0;i<5;i++){const s=new THREE.Mesh(petalGeometry(0.42,0.105,'slender',0.02),new THREE.MeshStandardMaterial({color:'#738b70',roughness:0.76,side:THREE.DoubleSide}));s.rotation.y=(Math.PI*2*i)/5;s.rotation.z=-0.20;s.position.y=-0.035;s.scale.set(1,0.9,1);sepalGroup.add(s);}
  for(let layer=0;layer<spec.layers;layer++){
    const count=Math.max(5,Math.round(spec.count*(layer===0?1:(layer===1?0.9:layer===2?0.8:0.68))));
    const angleOffset=layer%2?Math.PI/count:0;
    const scaleLength=1-layer*0.105; const radius=0.025+layer*0.025;
    for(let i=0;i<count;i++){
      const petalGroup=new THREE.Group();petalGroup.position.set(Math.cos(0)*radius,layer*0.025,0);
      petalGroup.rotation.y=(Math.PI*2*i/count)+angleOffset+(spec.kind==='rose'?layer*0.26:0);
      petalGroup.rotation.z=spec.closed;
      const shade=spec.colors[(i+layer*2)%spec.colors.length];
      const geo=petalGeometry(spec.length*scaleLength,spec.width*scaleLength,spec.kind,spec.wave);
      const mesh=new THREE.Mesh(geo,material(shade,0.99));mesh.castShadow=true;mesh.receiveShadow=true;petalGroup.add(mesh);
      petalGroup.userData={layer,petalIndex:i,count,spec,baseRadius:radius,baseY:layer*0.025,seed:(i/count)*Math.PI*2};
      head.add(petalGroup);petalPivots.push(petalGroup);
    }
  }
  // The throat, pollen and stamens occupy a constrained central zone above the innermost petal layer.
  const centerMat=new THREE.MeshStandardMaterial({color:spec.center,roughness:0.45,metalness:0.12});
  const center=new THREE.Mesh(new THREE.SphereGeometry(spec.id==='tulip'?0.095:0.14,24,18),centerMat);center.position.y=0.09;center.scale.set(1,0.68,1);center.castShadow=true;head.add(center);
  const stamenCount=spec.id==='tulip'?8:spec.id==='orchid'?12:20;
  for(let i=0;i<stamenCount;i++){
    const a=i/stamenCount*Math.PI*2;const r=0.07+((i%3)*0.017);const h=0.12+(i%4)*0.023;
    const stalk=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.009,h,6),new THREE.MeshStandardMaterial({color:'#c99b47',roughness:0.55}));stalk.position.set(Math.cos(a)*r,0.13+h/2,Math.sin(a)*r);stalk.rotation.z=-Math.cos(a)*0.08;stalk.rotation.x=Math.sin(a)*0.08;head.add(stalk);
    const anther=new THREE.Mesh(new THREE.SphereGeometry(0.022,8,8),new THREE.MeshStandardMaterial({color:'#efcf85',roughness:0.4}));anther.position.set(Math.cos(a)*(r+0.01),0.13+h,Math.sin(a)*(r+0.01));head.add(anther);
  }
  // Selected flowers have a tiny botanical accent instead of a generic glow.
  const glint=new THREE.Mesh(new THREE.SphereGeometry(0.025,8,8),new THREE.MeshBasicMaterial({color:'#fff0c6'}));glint.position.set(0.16,0.26,0.035);head.add(glint);
  state.flowerIndex=flowers.findIndex(f=>f.id===spec.id);state.targetBloom=state.bloom;
  $('stageKicker').textContent=spec.kicker;$('stageFlowerName').textContent=spec.name;$('stageFlowerCaption').textContent=spec.caption;
  $('inspectorName').textContent=spec.common;$('inspectorLatin').textContent=spec.latin;$('petalTag').textContent=spec.petalTag;$('toneTag').textContent=spec.toneTag;
  $('specimenNo').innerHTML=String(state.flowerIndex+1).padStart(2,'0')+' <small>/ 06</small>';$('specimenThumb').style.setProperty('--flower-tone',spec.colors[0]);$('specimenThumb').innerHTML=`<span>${spec.id==='tulip'?'✿':spec.id==='orchid'?'❋':'✿'}</span>`;
  document.querySelectorAll('.flower-card').forEach((el,i)=>el.classList.toggle('selected',i===state.flowerIndex));
  document.querySelector('.panel-count').textContent=String(state.flowerIndex+1).padStart(2,'0')+' / 06';
  applyBloomImmediate(); toast(`${spec.common} selected`);
}
function applyBloomImmediate(){updateBloomPose(state.bloom);}
function updateBloomPose(bloom){
  for(const pivot of petalPivots){
    const d=pivot.userData;const spec=d.spec;const layer=d.layer;
    const openAngle=spec.open + (spec.kind==='rose'?layer*0.035:layer*0.018);
    const closedAngle=spec.closed - layer*0.03;
    const spread=lerp(closedAngle,openAngle,bloom);
    pivot.rotation.z=spread+Math.sin(d.seed*1.8)*spec.wave*0.13;
    pivot.scale.setScalar(lerp(0.43,1,bloom));
    const radius=d.baseRadius+lerp(0.00,layer*0.025,bloom);
    pivot.position.x=Math.cos(0)*radius;pivot.position.y=d.baseY+Math.sin(d.seed)*0.012;
  }
  $('bloomState').innerHTML=`${Math.round(bloom*100)}<span>%</span>`;
}

function selectFlower(index){const next=(index+flowers.length)%flowers.length;if(next===state.flowerIndex)return;state.bloom=state.bloom;buildFlower(flowers[next]);}
function selectEnvironment(key){if(!environments[key])return;state.environment=key;document.querySelectorAll('.env-btn').forEach(b=>b.classList.toggle('active',b.dataset.env===key));$('sceneBadgeText').textContent=environments[key].name.toUpperCase();sceneTarget.bg=new THREE.Color(environments[key].bg);sceneTarget.ground=new THREE.Color(environments[key].ground);sceneTarget.fog=new THREE.Color(environments[key].fog);keyLight.color.set(environments[key].light);rimLight.color.set(environments[key].accent);toast(`${environments[key].name} selected`);}
const sceneTarget={bg:new THREE.Color(environments.studio.bg),ground:new THREE.Color(environments.studio.ground),fog:new THREE.Color(environments.studio.fog)};
function buildGallery(){const wrap=$('flowerGallery');wrap.innerHTML='';flowers.forEach((f,i)=>{const b=document.createElement('button');b.className='flower-card'+(i===state.flowerIndex?' selected':'');b.dataset.flower=i;b.setAttribute('aria-label',`Select ${f.common}`);b.innerHTML=`<span class="mini-flower" style="--tone:${f.colors[0]};--tone2:${f.colors[1]||f.colors[0]}"><i></i><i></i><i></i><i></i><i></i></span><span class="flower-card-text"><b>${f.common}</b><small>${f.latin.split(' ')[0]}</small></span><span class="flower-card-number">0${i+1}</span>`;b.addEventListener('click',()=>selectFlower(i));wrap.appendChild(b);});}
buildGallery();buildFlower(flowers[0]);

// WebGL sizing and rendering.
function resize(){const rect=stage.getBoundingClientRect();const w=Math.max(1,rect.width);const h=Math.max(1,rect.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);new ResizeObserver(resize).observe(stage);resize();
let lastFrame=performance.now();let autoRotationOffset=0;
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-lastFrame)/1000,0.05);lastFrame=now;
  state.bloom=lerp(state.bloom,state.targetBloom,1-Math.exp(-dt*5.4));updateBloomPose(state.bloom);
  if(state.autoRotate && !dragging){flowerRig.rotation.y += dt*0.14;autoRotationOffset=flowerRig.rotation.y;updateAxisUIFromRig(false);}
  scene.background.lerp(sceneTarget.bg,0.03);scene.fog.color.lerp(sceneTarget.fog,0.03);floorMat.color.lerp(sceneTarget.ground,0.03);disc.material.color.lerp(new THREE.Color(state.environment==='pond'?'#bfced6':state.environment==='meadow'?'#d1d4c9':state.environment==='greenhouse'?'#d0d5ca':'#f5eee7'),0.035);
  pollenGroup.visible=state.particles;
  for(const p of pollen){p.position.y += Math.sin(now*0.00045+p.userData.phase)*dt*0.08;p.position.x += Math.sin(now*0.00021+p.userData.phase)*dt*p.userData.speed*0.18;if(p.position.y>5)p.position.y=0.1;}
  envDecoration.children.forEach(o=>{const m=o.material;if(o.userData.pondRing){m.opacity=state.environment==='pond'?0.30:0.0;}else if(o.userData.pondPad){m.opacity=state.environment==='pond'?0.75:0.0;}else if(o.userData.meadow){m.opacity=state.environment==='meadow'?0.75:0.0;o.position.y += Math.sin(now*0.0007+o.position.x)*dt*0.05;}else if(o.geometry?.type==='TorusGeometry'){m.opacity=state.environment==='studio'?0.23:0.04;}else if(o.geometry?.type==='CylinderGeometry'){m.opacity=state.environment==='greenhouse'?0.26:0.07;}});
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);

// Interaction: drag object rotation, orbit-like zoom, exact XYZ degrees.
let dragging=false,dragStart=null;
renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;dragStart={x:e.clientX,y:e.clientY,rx:flowerRig.rotation.x,ry:flowerRig.rotation.y};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!dragging||!dragStart)return;state.autoRotate=false;$('autoRotateBtn').setAttribute('aria-pressed','false');flowerRig.rotation.y=dragStart.ry+(e.clientX-dragStart.x)*0.008;flowerRig.rotation.x=dragStart.rx+(e.clientY-dragStart.y)*0.006;updateAxisUIFromRig(false);});
renderer.domElement.addEventListener('pointerup',()=>{dragging=false;dragStart=null;});renderer.domElement.addEventListener('pointercancel',()=>{dragging=false;dragStart=null;});
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();camera.position.z=clamp(camera.position.z+e.deltaY*0.004,6.2,13.5);},{passive:false});
function updateAxisUIFromRig(updateRig=true){const ids=['rotateX','rotateY','rotateZ'];['x','y','z'].forEach((axis,i)=>{const deg=Math.round(THREE.MathUtils.radToDeg(flowerRig.rotation[axis]));$(ids[i]).value=deg;$(`${ids[i]}Value`).textContent=`${deg<0?'−':''}${Math.abs(deg)}°`;});}
['x','y','z'].forEach((axis,i)=>$(`rotate${axis.toUpperCase()}`).addEventListener('input',e=>{flowerRig.rotation[axis]=THREE.MathUtils.degToRad(Number(e.target.value));$(`rotate${axis.toUpperCase()}Value`).textContent=`${Number(e.target.value)<0?'−':''}${Math.abs(Number(e.target.value))}°`;}));
$('resetRotationBtn').addEventListener('click',()=>{flowerRig.rotation.set(THREE.MathUtils.degToRad(-8),THREE.MathUtils.degToRad(18),0);camera.position.set(0,2.55,9.8);camera.lookAt(0,1.65,0);updateAxisUIFromRig();toast('Rotation reset');});
$('autoRotateBtn').addEventListener('click',()=>{state.autoRotate=!state.autoRotate;$('autoRotateBtn').setAttribute('aria-pressed',String(state.autoRotate));$('autoRotateBtn').classList.toggle('is-on',state.autoRotate);toast(state.autoRotate?'Auto rotation on':'Auto rotation off');});
$('bloomToggleBtn').addEventListener('click',()=>{state.targetBloom=state.targetBloom>0.5?0:1;toast(state.targetBloom>0.5?'Bloom opening':'Bloom closing');});
$('particlesBtn').addEventListener('click',()=>{state.particles=!state.particles;$('particlesBtn').classList.toggle('is-on',state.particles);toast(state.particles?'Pollen enabled':'Pollen paused');});
document.querySelectorAll('.env-btn').forEach(b=>b.addEventListener('click',()=>selectEnvironment(b.dataset.env)));
document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;document.querySelectorAll('.mode-btn').forEach(el=>el.classList.toggle('active',el===b));const desc={open:'Move fingers apart to bloom; fold them to close.',pinch:'Pinch thumb and index together for precise control.',shortcuts:'Fist closes · open palm blooms · V changes scene.',manual:'Camera detection is paused; use the bloom controls.'};$('modeDescription').textContent=desc[state.mode];updateLiveGuide(latestPoints?analyzeLandmarks(latestPoints):null);}));

let toastTimer=0;function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1850);}

// Hand landmark worker and temporal gesture filtering.
let stream=null,worker=null,frameBusy=false,rafId=0,lastVideoFrameTime=-1,lastFrameSent=0,latestPoints=null,lastStableAt=0;
const video=$('cameraFeed'), overlay=$('landmarkCanvas'), ctx=overlay.getContext('2d');
const HAND_CONNECTIONS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
function highlightGestureShortcut(gesture){
  const normalized=(gesture==='Swipe left'||gesture==='Swipe right')?'Swipe':(gesture||'');
  document.querySelectorAll('.gesture-vocabulary [data-gesture]').forEach(el=>el.classList.toggle('is-active',el.dataset.gesture===normalized));
}
function setGestureGuide(phase,title,detail,step=1,meterLabel='HAND TRACKING',meterValue='READY WHEN YOU ARE',progress=0){
  const guide=$('gestureGuide');if(!guide)return;
  if(state.lang==='zh'){
    // Localize the live instruction copy based on the original English keys.
    // Apply direct title lookup separately to keep localization stable even if a title is translated above.
    const titleMap={
      'Start with your camera':'从摄像头开始','Allow camera access':'允许摄像头访问','Preparing hand recognition':'正在准备手势识别','Place one hand in frame':'将一只手放入画面','Move your fingers to shape the bloom':'移动手指控制花朵','Open palm detected':'已识别张开手掌','Closed hand detected':'已识别握拳','Pinch detected — fine control':'已识别捏合动作','Bring thumb and index finger together':'捏合拇指与食指','Hold your fist to close':'保持握拳以闭合花朵','Hold an open palm to bloom':'保持张开手掌以绽放','Show a V sign to change scene':'做出 V 字手势切换场景','Give a thumbs-up for pollen':'竖起拇指控制花粉','Swipe left for the previous flower':'向左滑动切换上一朵','Swipe right for the next flower':'向右滑动切换下一朵','Try one of the gesture shortcuts':'试试快捷手势','Manual control is active':'已启用手动控制','Camera needs a secure page':'摄像头需要安全网页','Camera permission is needed':'需要摄像头权限','Could not start the camera':'无法启动摄像头','Hand model could not load':'手势模型加载失败','Recognition paused':'手势识别已暂停','Camera stopped safely':'摄像头已安全关闭'};
    const detailsMap={
      'Start with your camera':'点击“启用手势追踪”，并允许浏览器访问摄像头。视频仅在本设备上分析。','Allow camera access':'在浏览器提示中选择“允许”。只有点击启动按钮后才会打开摄像头，画面不会上传。','Preparing hand recognition':'请保持此面板打开，等待本地模型加载。如果加载失败，可改用手动或演示控制。','Place one hand in frame':'让整个手掌和指尖保持在摄像头预览内，使用稳定光线，并将手移动到画面中央。','Move your fingers to shape the bloom':'张开手指让花瓣开放，轻轻收拢手指让花朵闭合。动作放慢、幅度清晰，效果会更平滑。','Open palm detected':'手指已伸展，花朵正在开放；慢慢收拢手指即可让花瓣闭合。','Closed hand detected':'手指已收拢，花朵正在闭合；慢慢张开手指即可让花瓣开放。','Pinch detected — fine control':'拇指与食指靠得越近，花朵开放度越高；逐渐拉开两指即可让花朵闭合。花瓣会跟随两指距离变化。','Bring thumb and index finger together':'让拇指与食指指尖靠近，再慢慢拉开距离来调整开放度。其余手指放松会让识别更稳定。','Hold your fist to close':'自然握拳并短暂停留，触发“闭合花朵”。','Hold an open palm to bloom':'舒展手指并短暂停留，触发“花朵绽放”。','Show a V sign to change scene':'伸出食指与中指，收拢其他手指并短暂停留，即可切换到下一个环境。','Give a thumbs-up for pollen':'保持竖起拇指片刻，即可开启或关闭漂浮花粉粒子。','Swipe left for the previous flower':'在摄像头画面中清晰、短促地向左移动手腕。','Swipe right for the next flower':'在摄像头画面中清晰、短促地向右移动手腕。','Try one of the gesture shortcuts':'握拳关闭花朵 · 张开手掌绽放 · V 字切换环境 · 竖起拇指切换花粉 · 左右滑动切换花型。','Manual control is active':'摄像头可以继续追踪，但手势不会改变花朵。请使用演示滑块、绽放按钮或花型图库。','Camera needs a secure page':'请通过 HTTPS 或 localhost 打开应用，然后再次点击“启用手势追踪”。','Camera permission is needed':'打开浏览器的此网站权限设置并允许使用摄像头，然后再次点击启动按钮。','Could not start the camera':'检查摄像头是否连接、是否被其他应用占用，然后重试。手动控制仍可使用。','Hand model could not load':'请检查网络后停止并重新启动摄像头。仍可使用手动控制和演示手势。','Recognition paused':'识别工作线程已停止。请停止并重新启动摄像头；手动与演示控制仍然可用。','Camera stopped safely':'视频流已释放。准备好时可以重新启用手势追踪，或继续使用手动和演示控制。'};
    const originalTitle=Object.keys(titleMap).find(k=>titleMap[k]===title)||title;
    title=titleMap[originalTitle]||title;detail=detailsMap[originalTitle]||detail;
    const labels={'HAND TRACKING':'手势追踪','MODEL STATUS':'模型状态','HAND DETECTION':'手部检测','FLOWER OPENING':'花朵开放度','PINCH / PRECISION':'捏合精度','RECOGNIZED GESTURE':'当前手势','CONTROL SOURCE':'控制方式','CAMERA ACCESS':'摄像头访问','CAMERA PERMISSION':'摄像头权限','CAMERA STATUS':'摄像头状态'};
    meterLabel=labels[meterLabel]||meterLabel;
    if(/^\d+% BLOOM$/.test(meterValue))meterValue=meterValue.replace(/(\d+)% BLOOM/,'$1% 花朵开放度');
    const values={'READY WHEN YOU ARE':'准备就绪','WAITING FOR YOU':'等待授权','LOADING MODEL…':'正在加载模型…','SEARCHING FOR HAND':'正在寻找手部','PERMISSION DENIED':'权限被拒绝','START FAILED':'启动失败','UNAVAILABLE':'不可用','LOAD FAILED':'加载失败','WORKER ERROR':'识别进程错误','STOPPED':'已停止','MANUAL / DEMO':'手动 / 演示'};
    meterValue=values[meterValue]||({'FIST':'握拳','OPEN PALM':'张开手掌','V SIGN':'V 字手势','THUMB UP':'竖起拇指','SWIPE LEFT':'向左滑动','SWIPE RIGHT':'向右滑动','NEUTRAL':'待识别'}[meterValue]||meterValue);
  }
  guide.dataset.guideState=phase;if($('guideTitle').textContent!==title)$('guideTitle').textContent=title;if($('guideText').textContent!==detail)$('guideText').textContent=detail;
  const stepText=state.lang==='zh'?`步骤 ${String(step).padStart(2,'0')} / 03`:`STEP ${String(step).padStart(2,'0')} / 03`;if($('guideStepBadge').textContent!==stepText)$('guideStepBadge').textContent=stepText;
  [1,2,3].forEach((n)=>$('guideProgress'+n).classList.toggle('active',n<=step));
  if($('guideMeterLabel').textContent!==meterLabel)$('guideMeterLabel').textContent=meterLabel;if($('guideMeterValue').textContent!==meterValue)$('guideMeterValue').textContent=meterValue;$('guideMeterFill').style.width=`${Math.round(clamp(progress)*100)}%`;
  const icons={off:'◉',permission:'⌁',loading:'◌',searching:'◎',open:'✋',pinch:'🤏',shortcuts:'✧',manual:'☝',error:'!',ready:'✦',stopped:'◉'};
  $('guideIcon').textContent=icons[phase]||'✧';
}
function updateLiveGuide(features){
  if(!state.cameraOn){highlightGestureShortcut('');setGestureGuide('off','Start with your camera','Activate hand tracking, then allow camera access. Video is analyzed on this device only.',1,'HAND TRACKING','READY WHEN YOU ARE',0);return;}
  if(state.modelFailed){highlightGestureShortcut('');setGestureGuide('error','Hand model could not load','Check your internet connection, then stop and restart the camera. Manual controls and Demo Gesture remain available.',2,'MODEL STATUS','LOAD FAILED',0);return;}
  if(!state.modelReady){highlightGestureShortcut('');setGestureGuide('loading','Preparing hand recognition','Keep this panel open while the on-device model loads. If it fails, switch to Manual or Demo Gesture.',2,'MODEL STATUS','LOADING MODEL…',0.18);return;}
  if(state.mode==='manual'){highlightGestureShortcut('');setGestureGuide('manual','Manual control is active','Camera tracking is available, but gestures will not change the flower in Manual mode. Use Demo Gesture, Bloom flower, or the gallery.',3,'CONTROL SOURCE','MANUAL / DEMO',0.35);return;}
  if(!features){highlightGestureShortcut('');setGestureGuide('searching','Place one hand in frame','Show your full palm, keep fingertips visible, and use steady light. Move your hand toward the center of the camera preview.',2,'HAND DETECTION','SEARCHING FOR HAND',0.08);return;}
  const activeShortcut=(state.mode==='shortcuts' && (state.stableGesture==='Swipe left'||state.stableGesture==='Swipe right'))?state.stableGesture:features.gesture;highlightGestureShortcut(activeShortcut);
  const bloomPct=Math.round(state.targetBloom*100);
  if(state.mode==='open'){
    let title='Move your fingers to shape the bloom',detail='Spread your fingers to open the petals; curl them gently to close. Try slow, clear movements for the smoothest response.';
    if(state.filteredOpen>.76){title='Open palm detected';detail='Your fingers are extended. The flower is unfolding; slowly curl your fingers to close it.';}
    else if(state.filteredOpen<.24){title='Closed hand detected';detail='Your fingers are folded. The flower is closing; slowly spread your fingers to open it.';}
    setGestureGuide('open',title,detail,3,'FLOWER OPENING',`${bloomPct}% BLOOM`,state.filteredOpen);
  }else if(state.mode==='pinch'){
    const pinching=state.filteredPinch>.68;
    setGestureGuide('pinch',pinching?'Pinch detected — fine control':'Bring thumb and index finger together',pinching?'Bring thumb and index closer to increase the bloom; widen the gap gradually to close it. The flower follows your pinch distance.':'Touch thumb and index together, then widen the gap slowly to adjust the bloom. Keep the other fingers relaxed.',3,'PINCH / PRECISION',`${bloomPct}% BLOOM`,state.filteredPinch);
  }else if(state.mode==='shortcuts'){
    const g=features.gesture||'Neutral';
    const guides={
      'Fist':['Hold your fist to close','Keep a gentle fist steady for a moment to trigger “Close flower”.',0],
      'Open palm':['Hold an open palm to bloom','Stretch your fingers comfortably and hold briefly to trigger “Bloom flower”.',1],
      'V sign':['Show a V sign to change scene','Raise your index and middle fingers, fold the others, and hold briefly to move to the next environment.',2],
      'Thumb up':['Give a thumbs-up for pollen','Hold your thumb up briefly to toggle the floating pollen particles.',3],
      'Swipe left':['Swipe left for the previous flower','Move your wrist clearly left across the camera view in one short, deliberate motion.',4],
      'Swipe right':['Swipe right for the next flower','Move your wrist clearly right across the camera view in one short, deliberate motion.',4],
      'Neutral':['Try one of the gesture shortcuts','Fist closes the flower · open palm blooms · V changes environment · thumbs-up toggles pollen · swipe changes flower.',0],
    };
    const [title,detail,active]=guides[g]||guides.Neutral;
    setGestureGuide('shortcuts',title,detail,3,'RECOGNIZED GESTURE',g.toUpperCase(),active/4);
  }
}
function setCameraUi(on){state.cameraOn=on;$('cameraCard').classList.toggle('active',on);$('startCameraBtn').classList.toggle('camera-active',on);$('cameraBtnText').textContent=on?'Hand tracking active':'Activate hand tracking';$('inputStatus').innerHTML=on?'<i></i> LIVE':'<i></i> STANDBY';$('inputStatus').classList.toggle('live',on);$('cameraPlaceholder').classList.toggle('hidden',on);$('stopCameraBtn').disabled=!on;$('cameraChip').textContent=on?'ON-DEVICE ML':'LOCAL VISION';}
function setCameraMessage(text,isError=false){const el=$('cameraMessage');if(el.textContent!==text)el.textContent=text;el.classList.toggle('error',isError);}
function fitOverlay(){const box=overlay.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);overlay.width=Math.round(box.width*dpr);overlay.height=Math.round(box.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(fitOverlay).observe(overlay);fitOverlay();
function drawLandmarks(points){const w=overlay.clientWidth,h=overlay.clientHeight;ctx.clearRect(0,0,w,h);if(!points||!state.cameraOn)return;ctx.lineWidth=1.35;ctx.strokeStyle='rgba(247,218,207,.86)';ctx.fillStyle='#fff9ec';for(const [a,b] of HAND_CONNECTIONS){ctx.beginPath();ctx.moveTo(points[a].x*w,points[a].y*h);ctx.lineTo(points[b].x*w,points[b].y*h);ctx.stroke();}for(const p of points){ctx.beginPath();ctx.arc(p.x*w,p.y*h,2,0,Math.PI*2);ctx.fill();}}
function analyzeLandmarks(points){
  if(!points||points.length<21)return null;const wrist=points[0];
  const fingerData=[{tip:8,base:5,pip:6},{tip:12,base:9,pip:10},{tip:16,base:13,pip:14},{tip:20,base:17,pip:18}];
  const ext=fingerData.map(f=>{const base=Math.max(0.001,dist(points[f.base],wrist));const ratio=dist(points[f.tip],wrist)/base;return clamp((ratio-1.02)/0.72);});
  const thumbBase=Math.max(0.001,dist(points[2],points[5]));const thumbRatio=dist(points[4],points[5])/thumbBase;const thumbExt=clamp((thumbRatio-0.9)/0.85);
  const openness=(ext.reduce((a,b)=>a+b,0)+thumbExt)/5;
  const palmWidth=Math.max(0.001,dist(points[5],points[17]));const pinchDist=dist(points[4],points[8])/palmWidth;const pinch=1-clamp((pinchDist-0.18)/0.86);
  const extFlags=[thumbExt>0.45,...ext.map(v=>v>0.50)];const count=extFlags.filter(Boolean).length;
  let gesture='Neutral';
  if(count<=1)gesture='Fist';else if(count>=4)gesture='Open palm';else if(extFlags[1]&&extFlags[2]&&!extFlags[3]&&!extFlags[4])gesture='V sign';
  const thumbUp=thumbExt>0.62 && points[4].y < points[3].y-0.07 && ext.slice(1).filter(v=>v>0.5).length<=1;
  if(thumbUp)gesture='Thumb up';
  return {openness,pinch,gesture,extFlags,count};
}
function smoothFeature(prev,next,alpha=0.22){return prev+(next-prev)*alpha;}
function classifyTemporal(raw,points,timestamp){
  let gesture=raw?.gesture||'No hand';
  if(points&&points[0]){
    const now=performance.now();const wrist={x:points[0].x,y:points[0].y};
    if(state.lastWrist){const dt=now-state.lastWristTime;const dx=wrist.x-state.lastWrist.x;if(dt>0&&dt<320&&Math.abs(dx)>0.13&&state.mode==='shortcuts'&&now-state.lastGestureAt>1050){gesture=dx<0?'Swipe left':'Swipe right';state.lastGestureAt=now;}}
    state.lastWrist=wrist;state.lastWristTime=now;
  } else {state.lastWrist=null;}
  if(gesture===state.candidateGesture)state.candidateFrames++;else{state.candidateGesture=gesture;state.candidateFrames=1;}
  if(state.candidateFrames>=4&&gesture!==state.stableGesture){state.stableGesture=gesture;return gesture;}
  return null;
}
function handleStableGesture(gesture){if(!gesture)return;const now=performance.now();if(now-state.lastGestureAt<680&&gesture!=='Swipe left'&&gesture!=='Swipe right')return;
  if(state.mode==='shortcuts'){
    if(gesture==='Fist'&&state.handledGesture!=='Fist'){state.targetBloom=0;toast('Flower closing');}
    else if(gesture==='Open palm'&&state.handledGesture!=='Open palm'){state.targetBloom=1;toast('Bloom opening');}
    else if(gesture==='V sign'&&state.handledGesture!=='V sign'){const keys=Object.keys(environments);selectEnvironment(keys[(keys.indexOf(state.environment)+1)%keys.length]);}
    else if(gesture==='Thumb up'&&state.handledGesture!=='Thumb up'){state.particles=!state.particles;$('particlesBtn').classList.toggle('is-on',state.particles);toast(state.particles?'Pollen enabled':'Pollen paused');}
    else if(gesture==='Swipe left'){selectFlower(state.flowerIndex-1);state.lastGestureAt=now;}
    else if(gesture==='Swipe right'){selectFlower(state.flowerIndex+1);state.lastGestureAt=now;}
    if(['Fist','Open palm','V sign','Thumb up'].includes(gesture))state.lastGestureAt=now;
    if(gesture!=='Neutral'&&gesture!=='No hand')state.handledGesture=gesture;
    if(gesture==='Neutral'||gesture==='No hand')state.handledGesture='';
  }
}
function consumeFrame(data){
  frameBusy=false;
  if(!state.cameraOn)return;
  state.latency=data.latency||0;$('latencyValue').textContent=`${Math.round(state.latency)} ms`;$('handednessValue').textContent=data.handedness||'—';
  const points=data.points;
  if(!points){latestPoints=null;state.confidence=0;state.gesture='No hand detected';$('gestureName').textContent='No hand detected';$('confidenceValue').textContent='—';$('confidenceBar').style.width='0%';setCameraMessage('No hand in view. Try centering your palm in the frame.');$('rawOpenValue').textContent='—';updateLiveGuide(null);drawLandmarks(null);return;}
  latestPoints=points;state.confidence=clamp(data.confidence||0);const features=analyzeLandmarks(points);if(!features)return;
  state.rawOpen=features.openness;state.filteredOpen=smoothFeature(state.filteredOpen,features.openness,0.24);state.filteredPinch=smoothFeature(state.filteredPinch,features.pinch,0.26);
  state.gesture=features.gesture;$('gestureName').textContent=features.gesture;$('confidenceValue').textContent=`${Math.round(state.confidence*100)}%`;$('confidenceBar').style.width=`${state.confidence*100}%`;$('rawOpenValue').textContent=state.rawOpen.toFixed(2);$('smoothOpenValue').textContent=state.filteredOpen.toFixed(2);
  const detectedFps=1000/Math.max(1,(performance.now()-state.lastInferenceAt));state.inferFps=smoothFeature(state.inferFps||detectedFps,detectedFps,0.2);$('cameraFps').textContent=`${Math.min(60,Math.round(state.inferFps))} FPS`;
  if(state.mode==='open'){state.targetBloom=clamp((state.filteredOpen-state.neutralOffset-0.03)/0.88);}
  else if(state.mode==='pinch'){state.targetBloom=clamp(state.filteredPinch);}
  else if(state.mode==='shortcuts'){
    const stable=classifyTemporal(features,points,data.timestamp);if(stable)handleStableGesture(stable);
  }
  setCameraMessage(state.mode==='open'?'Tracking locally · finger openness controls the bloom.':state.mode==='pinch'?'Tracking locally · thumb–index pinch controls the bloom.':state.mode==='shortcuts'?'Hold a gesture briefly to trigger a command.':'Detection is on; manual mode ignores gestures.');
  updateLiveGuide(features);drawLandmarks(points);
}
function frameLoop(){if(!state.cameraOn)return;rafId=requestAnimationFrame(frameLoop);if(!state.modelReady||!video.videoWidth||video.readyState<2||frameBusy)return;const now=performance.now();if(now-lastFrameSent<38||video.currentTime===lastVideoFrameTime)return;lastFrameSent=now;lastVideoFrameTime=video.currentTime;frameBusy=true;state.lastInferenceAt=now;createImageBitmap(video).then(bitmap=>{if(!state.cameraOn||!worker){bitmap.close();frameBusy=false;return;}worker.postMessage({type:'frame',bitmap,timestamp:Math.round(now)},[bitmap]);}).catch(error=>{frameBusy=false;setCameraMessage(`Frame error: ${error.message}`,true);});}
async function startCamera(){
  if(state.cameraOn)return;
  if(!navigator.mediaDevices?.getUserMedia){setCameraMessage('Camera access is not supported here. Open this page on HTTPS or localhost.',true);setGestureGuide('error','Camera needs a secure page','Open the app on HTTPS or localhost, then try Activate hand tracking again.',1,'CAMERA ACCESS','UNAVAILABLE',0);toast('Camera unavailable');return;}
  $('startCameraBtn').disabled=true;state.modelFailed=false;setCameraMessage('Requesting camera permission…');setGestureGuide('permission','Allow camera access','Choose Allow in your browser prompt. The camera is started only after you click the button, and frames stay on this device.',1,'CAMERA PERMISSION','WAITING FOR YOU',0.08);
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}},audio:false});
    video.srcObject=stream;await video.play();
    state.cameraOn=true;setCameraUi(true);setCameraMessage('Loading the on-device hand model…');setGestureGuide('loading','Loading hand recognition','Your camera is active. The hand model is initializing locally; next, place one hand in the preview.',2,'MODEL STATUS','LOADING MODEL…',0.18);
    worker=new Worker(new URL('./hand-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=(event)=>{const data=event.data||{};if(data.type==='ready'){state.modelReady=true;setCameraMessage('Hand model ready. Show one hand to begin.');updateLiveGuide(null);toast('Hand model ready');rafId=requestAnimationFrame(frameLoop);}else if(data.type==='result'){consumeFrame(data);}else if(data.type==='error'){state.modelReady=false;state.modelFailed=true;state.mode='manual';document.querySelectorAll('.mode-btn').forEach(el=>el.classList.toggle('active',el.dataset.mode==='manual'));setCameraMessage(`Model load failed: ${data.message}. Manual and demo controls still work.`,true);setGestureGuide('error','Hand model could not load','Check your internet connection, then stop and restart the camera. Manual controls and Demo Gesture remain available.',2,'MODEL STATUS','LOAD FAILED',0);toast('Hand model could not load; manual mode enabled');}else if(data.type==='frame-error'){setCameraMessage(data.message,true);}};
    worker.onerror=(error)=>{setCameraMessage(`Model worker error: ${error.message||'unknown error'}. Manual controls remain available.`,true);state.modelReady=false;state.modelFailed=true;setGestureGuide('error','Recognition paused','The hand-tracking worker stopped. Stop and restart the camera to retry; Manual and Demo Gesture still work.',2,'MODEL STATUS','WORKER ERROR',0);};
    worker.postMessage({type:'init'});
  }catch(error){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;state.cameraOn=false;setCameraUi(false);let message=error?.name==='NotAllowedError'?'Camera permission was denied. Allow camera access in your browser to use gesture control.':error?.name==='NotFoundError'?'No camera was found on this device.':'Unable to start camera: '+(error?.message||'unknown error');setCameraMessage(message,true);const denied=error?.name==='NotAllowedError';setGestureGuide('error',denied?'Camera permission is needed':'Could not start the camera',denied?'Open your browser site settings, allow camera access, then click Activate hand tracking again.':'Check that a camera is connected and not in use by another app, then retry. Manual controls remain available.',1,'CAMERA STATUS',denied?'PERMISSION DENIED':'START FAILED',0);toast('Could not start camera');}
  finally{$('startCameraBtn').disabled=false;}
}
function stopCamera(){cancelAnimationFrame(rafId);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(worker){worker.onmessage=null;worker.terminate();worker=null;}video.pause();video.srcObject=null;state.cameraOn=false;state.modelReady=false;state.modelFailed=false;frameBusy=false;latestPoints=null;ctx.clearRect(0,0,overlay.width,overlay.height);setCameraUi(false);$('cameraFps').textContent='— FPS';$('gestureName').textContent='Waiting for input';$('confidenceValue').textContent='—';$('confidenceBar').style.width='0%';setCameraMessage('Camera stopped. Manual controls are ready.');setGestureGuide('stopped','Camera stopped safely','The video stream has been released. Restart hand tracking whenever you are ready; manual and demo controls still work.',1,'CAMERA STATUS','STOPPED',0);toast('Camera released');}
$('startCameraBtn').addEventListener('click',startCamera);$('stopCameraBtn').addEventListener('click',stopCamera);
$('diagnosticsToggle').addEventListener('click',()=>{const open=!$('diagnostics').classList.contains('open');$('diagnostics').classList.toggle('open',open);$('diagnosticsToggle').setAttribute('aria-expanded',String(open));$('diagnosticsToggle').textContent=open?'DIAG ↙':'DIAG ↗';});
$('calibrateBtn').addEventListener('click',()=>{if(!state.cameraOn||!latestPoints){toast('Show your hand to calibrate');return;}const features=analyzeLandmarks(latestPoints);if(!features){toast('Hand not detected');return;}state.neutralOffset=features.openness-0.48;state.filteredOpen=features.openness;state.filteredPinch=features.pinch;toast('Hand baseline calibrated');});

// Demo is part of the same state path; it animates real petal geometry without camera access.
const demo=document.createElement('div');demo.className='demo-control';demo.innerHTML='<label for="demoSlider">DEMO GESTURE <span>NO CAMERA REQUIRED</span></label><input id="demoSlider" type="range" min="0" max="100" value="68" aria-label="Simulated hand openness"/><div class="demo-ends"><span>FIST / CLOSED</span><span>OPEN PALM / BLOOM</span></div>';document.querySelector('.inspector-panel').insertBefore(demo,document.querySelector('.diagnostics'));
$('demoSlider').addEventListener('input',e=>{const n=Number(e.target.value)/100;if(!state.cameraOn||state.mode==='manual'||!state.modelReady){state.targetBloom=n;$('bloomState').innerHTML=`${Math.round(n*100)}<span>%</span>`;}else{toast('Switch to Manual mode or stop camera to use the demo slider');}});

function runCommand(raw){const v=raw.trim().toLowerCase();if(!v)return;const match=flowers.findIndex(f=>f.common.toLowerCase()===v||f.name.toLowerCase()===v||f.latin.toLowerCase()===v||f.id===v);if(match>=0){selectFlower(match);return;}if(['open','bloom','open flower','绽放','开放'].includes(v)){state.targetBloom=1;toast('Bloom opening');return;}if(['close','fold','close flower','闭合','关闭'].includes(v)){state.targetBloom=0;toast('Bloom closing');return;}if(['next','next flower','下一朵'].includes(v)){selectFlower(state.flowerIndex+1);return;}if(['previous','prev','previous flower','上一朵'].includes(v)){selectFlower(state.flowerIndex-1);return;}if(['next environment','scene','下一场景'].includes(v)){const keys=Object.keys(environments);selectEnvironment(keys[(keys.indexOf(state.environment)+1)%keys.length]);return;}const envKey=Object.keys(environments).find(k=>k===v||environments[k].name.toLowerCase()===v);if(envKey){selectEnvironment(envKey);return;}toast('Command not recognized');}
const command=document.createElement('form');command.className='command-form';command.innerHTML='<span>⌘</span><input id="commandInput" placeholder="Try: open, rose, next scene…" aria-label="Flower command"/><button type="submit" aria-label="Run command">↗</button>';document.querySelector('.intro-panel').append(command);command.addEventListener('submit',e=>{e.preventDefault();runCommand($('commandInput').value);$('commandInput').value='';});
window.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,button,select'))return;if(e.key==='ArrowRight'){selectFlower(state.flowerIndex+1);e.preventDefault();}else if(e.key==='ArrowLeft'){selectFlower(state.flowerIndex-1);e.preventDefault();}else if(e.code==='Space'){state.targetBloom=state.targetBloom>0.5?0:1;e.preventDefault();}else if(e.key.toLowerCase()==='r'){$('resetRotationBtn').click();}else if(['1','2','3','4'].includes(e.key)){selectEnvironment(['studio','greenhouse','pond','meadow'][Number(e.key)-1]);}});
$('aboutBtn').addEventListener('click',()=>$('aboutDialog').showModal());$('closeAboutBtn').addEventListener('click',()=>$('aboutDialog').close());$('aboutDialog').addEventListener('click',e=>{if(e.target===$('aboutDialog'))$('aboutDialog').close();});
$('languageBtn').addEventListener('click',()=>{state.lang=state.lang==='en'?'zh':'en';$('languageBtn').textContent=state.lang==='en'?'EN / 中':'中 / EN';document.documentElement.lang=state.lang==='en'?'en':'zh-CN';if(state.lang==='zh'){document.querySelector('.top-center').lastElementChild.textContent='手势驱动的交互式植物研究';document.querySelector('.intro-panel h1').innerHTML='让自然<br/>跟随<em>你。</em>';$('cameraBtnText').textContent=state.cameraOn?'手势追踪已开启':'启用手势追踪';document.querySelector('.gesture-hint .hint-label').textContent='试试一个手势';document.querySelector('.gesture-hint p').textContent='张开手掌，让花瓣舒展。捏合手指，进行精细控制。';document.querySelector('.gesture-guide-head > span').innerHTML='<i class=\"guide-live-dot\"></i> 实时手势指引';document.querySelector('.gesture-vocabulary').innerHTML='<span data-gesture=\"Fist\"><b>✊</b>闭合</span><span data-gesture=\"Open palm\"><b>✋</b>绽放</span><span data-gesture=\"V sign\"><b>V</b>切场景</span><span data-gesture=\"Thumb up\"><b>👍</b>花粉</span><span data-gesture=\"Swipe\"><b>↔</b>切花型</span>';toast('已切换为中文界面');}else{document.querySelector('.top-center').lastElementChild.textContent='AN INTERACTIVE BOTANICAL STUDY';document.querySelector('.intro-panel h1').innerHTML='Let nature<br/>follow <em>you.</em>';$('cameraBtnText').textContent=state.cameraOn?'Hand tracking active':'Activate hand tracking';document.querySelector('.gesture-hint .hint-label').textContent='TRY A GESTURE';document.querySelector('.gesture-hint p').textContent='Open your hand to unfold the petals. Pinch for precision.';document.querySelector('.gesture-guide-head > span').innerHTML='<i class=\"guide-live-dot\"></i> REAL-TIME HAND GUIDE';document.querySelector('.gesture-vocabulary').innerHTML='<span data-gesture=\"Fist\"><b>✊</b>Close</span><span data-gesture=\"Open palm\"><b>✋</b>Bloom</span><span data-gesture=\"V sign\"><b>V</b>Scene</span><span data-gesture=\"Thumb up\"><b>👍</b>Pollen</span><span data-gesture=\"Swipe\"><b>↔</b>Flower</span>';toast('English interface');}updateLiveGuide(latestPoints?analyzeLandmarks(latestPoints):null);});

// Graceful WebGL fallback. Controls and demo still remain available if rendering fails.
if(!renderer.capabilities.isWebGL2 && !renderer.capabilities.isWebGL1){stage.classList.add('webgl-fallback');toast('WebGL is unavailable; try another browser.');}
window.addEventListener('beforeunload',()=>{stopCamera();renderer.dispose();});
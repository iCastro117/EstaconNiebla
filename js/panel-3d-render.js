// Panel 3D Real - Renderizado en el contenedor panel-3d
async function inicializarPanel3D(containerId, dataPath = 'panel_data.json') {
  const container = document.getElementById(containerId);
  if (!container) return;

  let AVG_HUMIDITY = '59%';
  let AVG_TEMP = '19.9°C';
  let AVG_LITERS = '0.02 L';

  try {
    const response = await fetch(dataPath);
    const data = await response.json();
    AVG_HUMIDITY = data.AVG_HUMIDITY || AVG_HUMIDITY;
    AVG_TEMP = data.AVG_TEMP || AVG_TEMP;
    AVG_LITERS = data.AVG_LITERS || AVG_LITERS;
  } catch (e) {
    console.warn('No se pudo cargar panel_data.json:', e);
  }

  // Importar Three.js dinámicamente
  const THREE = await import('https://unpkg.com/three@0.168.0/build/three.module.js');
  const { OrbitControls } = await import('https://unpkg.com/three@0.168.0/examples/jsm/controls/OrbitControls.js');
  const { CSS2DRenderer, CSS2DObject } = await import('https://unpkg.com/three@0.168.0/examples/jsm/renderers/CSS2DRenderer.js');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, container.clientWidth/container.clientHeight, .1, 100);
  camera.position.set(6.4,3.7,8.4);

  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.position='absolute';
  labelRenderer.domElement.style.inset='0';
  labelRenderer.domElement.style.pointerEvents='none';
  container.appendChild(labelRenderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff,0x6b4a2c,2.4));
  const key = new THREE.DirectionalLight(0xfff4e5,4.2);
  key.position.set(-4,7,6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xb6e8ff,2.2);
  fill.position.set(5,3,-4); scene.add(fill);
  const rim = new THREE.PointLight(0x70dcff,25,16,2);
  rim.position.set(4,2,5); scene.add(rim);

  const controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .055;
  controls.enablePan = false;
  controls.minDistance = 5.0;
  controls.maxDistance = 13.0;
  controls.target.set(0,.05,0);
  controls.update();

  const root = new THREE.Group();
  root.rotation.y = -.25;
  scene.add(root);

  function bambooTexture(){
    const c=document.createElement('canvas'); c.width=256; c.height=512;
    const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,256,0);
    g.addColorStop(0,'#68401f'); g.addColorStop(.18,'#a86e37');
    g.addColorStop(.5,'#c48a4d'); g.addColorStop(.82,'#9a6030');
    g.addColorStop(1,'#5b351b');
    x.fillStyle=g; x.fillRect(0,0,c.width,c.height);
    for(let i=0;i<80;i++){
      const px=Math.random()*256;
      const a=.03+Math.random()*.08;
      x.strokeStyle=`rgba(60,32,12,${a})`;
      x.lineWidth=.4+Math.random()*1.2;
      x.beginPath(); x.moveTo(px,0); x.lineTo(px+Math.random()*8-4,512); x.stroke();
    }
    for(let y=70;y<512;y+=120){
      x.fillStyle='rgba(70,36,15,.16)';
      x.fillRect(0,y,256,6);
      x.fillStyle='rgba(240,187,111,.10)';
      x.fillRect(0,y+6,256,2);
    }
    const t=new THREE.CanvasTexture(c);
    t.colorSpace=THREE.SRGBColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(1,2);
    return t;
  }

  function meshTexture(){
    const c=document.createElement('canvas'); c.width=512; c.height=512;
    const x=c.getContext('2d');
    x.clearRect(0,0,512,512);
    x.fillStyle='rgba(116,79,55,.52)';
    x.fillRect(0,0,512,512);
    for(let i=0;i<=512;i+=8){
      x.strokeStyle='rgba(200,165,135,.62)';
      x.lineWidth=2;
      x.beginPath(); x.moveTo(i,0); x.lineTo(i,512); x.stroke();
    }
    for(let j=0;j<=512;j+=8){
      x.strokeStyle='rgba(74,46,31,.60)';
      x.lineWidth=2;
      x.beginPath(); x.moveTo(0,j); x.lineTo(512,j); x.stroke();
    }
    x.globalCompositeOperation='destination-out';
    for(let i=4;i<512;i+=8){
      for(let j=4;j<512;j+=8){
        x.fillStyle='rgba(0,0,0,.58)';
        x.fillRect(i-1.8,j-1.8,3.6,3.6);
      }
    }
    x.globalCompositeOperation='source-over';
    const t=new THREE.CanvasTexture(c);
    t.colorSpace=THREE.SRGBColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(2.4,2.8);
    return t;
  }

  const bambooTex=bambooTexture();
  const clothTex=meshTexture();

  const bambooMat = new THREE.MeshStandardMaterial({map:bambooTex, roughness:.62, metalness:0});
  const cutMat = new THREE.MeshStandardMaterial({color:0xd7aa70, roughness:.75});
  const ropeMat = new THREE.MeshStandardMaterial({color:0x4f2d1d, roughness:.9});
  const clothMat = new THREE.MeshPhysicalMaterial({map:clothTex, color:0xb19077, roughness:.88, metalness:0, transparent:true, opacity:.90, side:THREE.DoubleSide, alphaTest:.08});
  const woodBarMat = new THREE.MeshStandardMaterial({color:0x8c542c, roughness:.72});

  function cylBetween(a,b,r=.11,mat=bambooMat,parent=root,radial=20){
    const dir=new THREE.Vector3().subVectors(b,a);
    const len=dir.length();
    const g=new THREE.CylinderGeometry(r,r,len,radial,1,false);
    const m=new THREE.Mesh(g,mat);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());
    parent.add(m);
    return m;
  }

  function cutCap(p,dir,r=.12){
    const disc=new THREE.Mesh(new THREE.CircleGeometry(r,24),cutMat);
    disc.position.copy(p);
    disc.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir.clone().normalize());
    root.add(disc);
  }

  function ropeWrap(p,axis='x',scale=1,turns=6){
    const g=new THREE.Group();
    for(let i=0;i<turns;i++){
      const tor=new THREE.Mesh(new THREE.TorusGeometry(.145*scale,.018*scale,7,28), ropeMat);
      tor.position.y=(i-(turns-1)/2)*.026*scale;
      tor.rotation.x=Math.PI/2;
      g.add(tor);
    }
    if(axis==='z') g.rotation.z=Math.PI/2;
    if(axis==='x') g.rotation.x=0;
    g.position.copy(p);
    root.add(g);
    return g;
  }

  const topL = new THREE.Vector3(-1.48, 2.38, .48);
  const topR = new THREE.Vector3( 1.48, 2.38, .48);
  const botL = new THREE.Vector3(-1.78,-1.37, .48);
  const botR = new THREE.Vector3( 1.78,-1.37, .48);

  const frontFootL = new THREE.Vector3(-2.28,-2.68, 1.40);
  const frontFootR = new THREE.Vector3( 2.28,-2.68, 1.40);
  const rearFootL  = new THREE.Vector3(-2.25,-2.68,-1.45);
  const rearFootR  = new THREE.Vector3( 2.25,-2.68,-1.45);

  const apexL = new THREE.Vector3(-1.48,2.45,0);
  const apexR = new THREE.Vector3( 1.48,2.45,0);

  cylBetween(frontFootL,apexL,.145);
  cylBetween(rearFootL, apexL,.145);
  cylBetween(frontFootR,apexR,.145);
  cylBetween(rearFootR, apexR,.145);
  cylBetween(apexL,apexR,.135);
  cylBetween(frontFootL,frontFootR,.12);
  cylBetween(rearFootL,rearFootR,.11);
  cylBetween(frontFootL,rearFootL,.105);
  cylBetween(frontFootR,rearFootR,.105);
  cylBetween(botL,botR,.105,woodBarMat);
  cylBetween(new THREE.Vector3(-1.69,-1.25,.34), apexL,.075);
  cylBetween(new THREE.Vector3( 1.69,-1.25,.34), apexR,.075);

  cutCap(frontFootL,new THREE.Vector3(-.2,-1,.3),.145);
  cutCap(frontFootR,new THREE.Vector3(.2,-1,.3),.145);
  cutCap(rearFootL,new THREE.Vector3(-.2,-1,-.3),.145);
  cutCap(rearFootR,new THREE.Vector3(.2,-1,-.3),.145);

  [apexL,apexR,frontFootL,frontFootR,rearFootL,rearFootR, botL,botR, new THREE.Vector3(-2.27,-2.50,.0), new THREE.Vector3( 2.27,-2.50,.0)]
    .forEach((p,i)=>ropeWrap(p,i<6?'x':'z',.95,i<6?7:5));

  const pw=3.45, ph=3.70;
  const geo = new THREE.PlaneGeometry(pw,ph,30,36);
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), y=pos.getY(i);
    const z = Math.sin(y*2.1+x*.55)*.025 + Math.sin(x*3.1)*.012 + (Math.random()-.5)*.007;
    pos.setZ(i,z);
  }
  geo.computeVertexNormals();

  const cloth = new THREE.Mesh(geo,clothMat);
  cloth.position.set(0,.47,.58);
  cloth.rotation.x=-.075;
  root.add(cloth);

  const edgeMat = new THREE.MeshStandardMaterial({color:0x7b5138,roughness:.95});
  cylBetween(new THREE.Vector3(-1.72,-1.38,.59),new THREE.Vector3(-1.46,2.34,.59),.025,edgeMat);
  cylBetween(new THREE.Vector3( 1.72,-1.38,.59),new THREE.Vector3( 1.46,2.34,.59),.025,edgeMat);

  const blue = 0x19dcff;
  const blueLine = new THREE.LineBasicMaterial({color:blue,transparent:true,opacity:.95});
  const blueSoft = new THREE.LineBasicMaterial({color:blue,transparent:true,opacity:.35});
  const nodeMat = new THREE.MeshBasicMaterial({color:blue,transparent:true,opacity:.95});

  function line(points,mat=blueLine,parent=root){
    const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat);
    parent.add(l); return l;
  }

  function marker(p){
    const g=new THREE.Group();
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.05,18,18),nodeMat);
    const r1=new THREE.Mesh(new THREE.TorusGeometry(.13,.011,8,42),nodeMat);
    const r2=new THREE.Mesh(new THREE.TorusGeometry(.22,.008,8,42), new THREE.MeshBasicMaterial({color:blue,transparent:true,opacity:.30}));
    g.add(dot,r1,r2); g.position.copy(p); root.add(g); return g;
  }

  const mh = marker(new THREE.Vector3(-1.00, 1.08,.70));
  const mt = marker(new THREE.Vector3( 1.02, .50,.70));
  const ml = marker(new THREE.Vector3(-.30,-.92,.70));

  function tag(title,value,anchor,labelPos){
    const elbow = new THREE.Vector3((anchor.x+labelPos.x)*.52,labelPos.y,labelPos.z);
    line([anchor,elbow,labelPos],blueLine);
    line([anchor.clone().add(new THREE.Vector3(0,.055,0)), elbow.clone().add(new THREE.Vector3(0,.055,0)), labelPos.clone().add(new THREE.Vector3(0,.055,0))], blueSoft);
    const d=document.createElement('div');
    d.className='tag';
    d.innerHTML=`${title}<strong>${value}</strong>`;
    const o=new CSS2DObject(d);
    o.position.copy(labelPos);
    root.add(o);
    return o;
  }

  tag('Humedad promedio',AVG_HUMIDITY,mh.position.clone(),new THREE.Vector3(-3.20,1.85,.82));
  tag('Temperatura promedio',AVG_TEMP,mt.position.clone(),new THREE.Vector3( 3.10,1.15,.82));
  tag('Litros promedio registrados',AVG_LITERS,ml.position.clone(),new THREE.Vector3(-3.00,-1.65,.82));

  let t=0;
  function animate(){
    requestAnimationFrame(animate);
    t+=.01;
    controls.update();
    [mh,mt,ml].forEach((n,i)=>{
      n.children[1].scale.setScalar(1+Math.sin(t*2+i)*.08);
      n.children[2].rotation.z += .0035+i*.0004;
    });
    renderer.render(scene,camera);
    labelRenderer.render(scene,camera);
  }
  animate();

  const resizeHandler = () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  };

  window.addEventListener('resize', resizeHandler);
}

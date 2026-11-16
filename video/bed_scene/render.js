const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:720,height:1280}});
p.on('console',m=>console.log('LOG',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/scene.html');await p.waitForFunction(()=>window.ready);
const frames=process.argv[2]?process.argv[2].split(',').map(Number):[...Array(114).keys()];
fs.mkdirSync(__dirname+'/out',{recursive:true});
for(const i of frames){const d=await p.evaluate(i=>{draw(i);return document.getElementById('c').toDataURL('image/png')},i);
fs.writeFileSync(`${__dirname}/out/f${String(i).padStart(4,'0')}.png`,Buffer.from(d.split(',')[1],'base64'));}
await b.close();})();

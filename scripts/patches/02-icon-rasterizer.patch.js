/**
 * 02-icon-rasterizer.patch.js - Modular Domain Patch Rules
 */

const RULES = [
  {"label":"qG negative objId NPC model icon rasterizer","target":"ction QG(i,t,e){const n=new Int3","replacement":"ction QG(i,t,e){if(t<0){const n=new Int32Array(Yr*Ya),u=i.npcTypeLoader.load(-t),r=i.npcModelLoader.getModel(u,6561,0)||i.npcModelLoader.getModel(u,-1,-1);if(!r)return n;Be.setRaster(n,Yr,Ya),Be.setClip(0,0,Yr,Ya),Ri.setClip(),Ri.setViewport(18,16),Ri.rasterGouraudLowRes=!1,Ri.rasterAlpha=0,r.calculateBoundsCylinder();let bh=0,br=0;for(let c=0;c<r.verticesCount;c++){const vy=-r.verticesY[c];vy>bh&&(bh=vy);const vx=r.verticesX[c],vz=r.verticesZ[c],rd=Math.sqrt(vx*vx+vz*vz);rd>br&&(br=rd)}const ext=Math.max(bh,br*1.85,20),l=Math.round(ext*512/25),xan=190,yan=1740,h=Qs[xan&2047]*l>>16,d=Ms[xan&2047]*l>>16;WG(r,yan,0,xan,0,(bh/2|0)+h+2,d+2)&&$G(r,c=>i.textureLoader.getAverageHsl(c)),KG(n,Yr,Ya);for(let c=0;c<n.length;c++)n[c]!==0&&(n[c]|=4278190080);return n}const n=new Int3"}
];

function apply(code, replaceExact, symbols) {
  for (const rule of RULES) {
    code = replaceExact(code, rule.label, rule.target, rule.replacement);
  }
  return code;
}

module.exports = { RULES, apply };

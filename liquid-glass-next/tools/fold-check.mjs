// Self-check: dengan remap tAy = clamp((t-.6)/.4), pil acc tidak pernah menabrak tab row di sepanjang fold.
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t;
const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const TAB_ROW=62, ACC_H=48, INL_H=48, SP=8, NAV_G=19, INL_G=28, INL_SP=14, INL_LIFT=7, BOT=21;
let fails=0;
for (const W of [320, 360, 390, 430, 512]){
  const barW=W-2*NAV_G, H=844;
  const EXa={x:NAV_G,w:barW}, EXt={x:NAV_G,w:barW-SP-TAB_ROW};
  const INa={x:INL_G+INL_H+INL_SP,w:W-2*INL_G-2*INL_H-2*INL_SP}, INt={x:INL_G,w:INL_H};
  const EXay=H-BOT-TAB_ROW-SP-ACC_H, EXty=H-BOT-TAB_ROW, INy=H-(BOT+INL_LIFT)-INL_H;
  for (let i=0;i<=2000;i++){
    const t=i/2000;
    const v=clamp(t/.7,0,1), u=clamp((t-.55)/.45,0,1);
    const tA=v*v*(3-2*v), tAy=u*u*(3-2*u), tT=1-Math.pow(1-t,3);
    const acc={x:lerp(EXa.x,INa.x,tA),y:lerp(EXay,INy,tAy),w:lerp(EXa.w,INa.w,tA),h:ACC_H};
    const tabs={x:lerp(EXt.x,INt.x,tT),y:lerp(EXty,INy,tT),w:lerp(EXt.w,INt.w,tT),h:lerp(TAB_ROW,INL_H,tT)};
    if (hit(acc,tabs)){ console.log(`FAIL W=${W} t=${t.toFixed(3)}`, acc, tabs); fails++; break; }
  }
}
console.log(fails? `${fails} kegagalan` : 'PASS: 0 tabrakan acc vs tab row (W=320..512, t=0..1)');
process.exit(fails?1:0);

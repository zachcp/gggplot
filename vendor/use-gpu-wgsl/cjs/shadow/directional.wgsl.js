/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("sampleShadow applyDirectionalShadow @use-gpu/wgsl/use/types Light SurfaceFragment f32 optional link vec2<f32> u32 export sampleShadow return normal shadowBias shadowUV SHADOW_PAGE".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3,4]),[K]:[{[N]:_(3),[J]:_(3)},{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:55,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6,7]),[P]:[{[N]:"u",[T]:_(8)},{[N]:"i",[T]:_(9)},{[N]:"l",[T]:_(5)}]}}],[E]:[{[A]:129,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(5),[Z]:_([10]),[P]:[{[N]:"l",[T]:_(3)},{[N]:"s",[T]:_(4)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "shadow/directional",
  code: _(["use '",2,"'::{",3,",",4,"};@",6," @",7," fn ",0,"(u:",8,",i:u32,l:f32)->f32{",12," 1.0;}@",10," fn ",1,"(l:",3,",s:",4,",)->f32{let i=u32(l.shadowMap);let s1=s.position.xyz+s.",13,".xyz*l.",14,".z;var p=l.into*",C,"(s1,1.0);if(abs(p.x)>1.0||abs(p.y)>1.0){",12," 1.0;}p.y=-p.y;p.z=1.0+p.z;let n=dot(s.",13,".xyz,l.",13,".xyz);let s2=sqrt(1-n*n)/abs(n);let r=p.z;let d=r*(1.0+(l.",14,".x+s2*l.",14,".y));let b=l.shadowBlur;let s3=(l.",15,".zw-l.",15,".xy)*",16,";let r1=f32(b)/(2.0*s3);let u=clamp(p.xy*.5+.5,",8,"(r1),",8,"(1.0-r1));let _1=mix(l.",15,".xy,l.",15,".zw,u);var s4=0.0;if(b>=4){for(var y=-1.5;y<=1.5;y+=1.0){for(var x=-1.5;x<=1.5;x+=1.0){s4+=",0,"(_1+",8,"(x,y)/",16,",i,d);}}s4/=16.0;}else if(b==3){for(var y=-1.0;y<=1.0;y+=1.0){for(var x=-1.0;x<=1.0;x+=1.0){s4+=",0,"(_1+",8,"(x,y)/",16,",i,d);}}s4/=9.0;}else if(b==2){for(var y=-0.5;y<=0.5;y+=1.0){for(var x=-0.5;x<=0.5;x+=1.0){s4+=",0,"(_1+",8,"(x,y)/",16,",i,d);}}s4/=4.0;}else{s4+=",0,"(_1,i,d);}",12," s4;};\n"]).join(''),
  hash: 0x487fc07a00d3f,
  table,
  shake: [[55,[0,1]],[129,[1]]],
  tree: decompressAST([[1,0,54],[4,55,129,0],[1,0,9],[1,10,15],[2,9,21],[0,55,1061],[1,0,7],[2,11,33],[2,25,30],[2,8,23],[2,586,598],[2,138,150],[2,137,149],[2,68,80]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.applyDirectionalShadow = getSymbol("applyDirectionalShadow");
//# sourceMappingURL=directional.wgsl.js.map

/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../use/types.wgsl");
const m1 = require("../codec/octahedral.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("sampleShadow applyHemiShadow @use-gpu/wgsl/use/types Light SurfaceFragment @use-gpu/wgsl/codec/octahedral encodeHemiOctahedral f32 optional link vec2<f32> u32 export sampleShadow return position shadowBias shadowUV SHADOW_PAGE".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3,4]),[K]:[{[N]:_(3),[J]:_(3)},{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]}],[X]:[{[A]:116,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(7),[Z]:_([8,9]),[P]:[{[N]:"u",[T]:_(10)},{[N]:"i",[T]:_(11)},{[N]:"l",[T]:_(7)}]}}],[E]:[{[A]:190,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(7),[Z]:_([12]),[P]:[{[N]:"l",[T]:_(3)},{[N]:"s",[T]:_(4)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "shadow/hemi",
  code: _(["use '",2,"'::{",3,",",4,"};use '",5,"'::{",6,"};@",8," @",9," fn ",0,"(u:",10,",i:u32,l:f32)->f32{",14," 1.0;}@",12," fn ",1,"(l:",3,",s:",4,",)->f32{let i=u32(l.shadowMap);let t=l.",15,".xyz-s.",15,".xyz;let l1=length(t);let s1=s.",15,".xyz+s.normal.xyz*l.",16,".z*l1;let p=l.into*",C,"(s1,1.0);let n=dot(s.normal.xyz,t)/l1;let s2=sqrt(1-n*n)/abs(n);let z=length(p.xyz);let r=dot(",10,"(1.0,1.0/z),l.shadowDepth);let d=r*(1.0+(l.",16,".x+s2*l.",16,".y)*l1);if(d<0.0){",14," 1.0;}let b=l.shadowBlur;let s3=(l.",17,".zw-l.",17,".xy)*",18,";let r1=f32(b)/(2.0*s3);let u=clamp(",6,"(normalize(p.zxy))*.5+.5,",10,"(r1),",10,"(1.0-r1));let _1=mix(l.",17,".xy,l.",17,".zw,u);var s4=0.0;if(b>=4){for(var y=-1.5;y<=1.5;y+=1.0){for(var x=-1.5;x<=1.5;x+=1.0){s4+=",0,"(_1+",10,"(x,y)/",18,",i,d);}}s4/=16.0;}else if(b==3){for(var y=-1.0;y<=1.0;y+=1.0){for(var x=-1.0;x<=1.0;x+=1.0){s4+=",0,"(_1+",10,"(x,y)/",18,",i,d);}}s4/=9.0;}else if(b==2){for(var y=-0.5;y<=0.5;y+=1.0){for(var x=-0.5;x<=0.5;x+=1.0){s4+=",0,"(_1+",10,"(x,y)/",18,",i,d);}}s4/=4.0;}else{s4+=",0,"(_1,i,d);}",14," s4;};\n"]).join(''),
  hash: 0x513408918c7e7,
  table,
  shake: [[116,[0,1]],[190,[1]]],
  tree: decompressAST([[1,0,54],[1,55,115],[4,61,135,0],[1,0,9],[1,10,15],[2,9,21],[0,55,1153],[1,0,7],[2,11,26],[2,18,23],[2,8,23],[2,481,501],[2,204,216],[2,138,150],[2,137,149],[2,68,80]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0, "@use-gpu/wgsl/codec/octahedral": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.applyHemiShadow = getSymbol("applyHemiShadow");
//# sourceMappingURL=hemi.wgsl.js.map

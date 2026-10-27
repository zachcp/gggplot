/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../codec/normal16.wgsl");
const m1 = require("../use/view.wgsl");
const m2 = require("./outline-weight.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("loadNormal16 loadDepth getOverscanSize getOverscanScale getOutlineSample @use-gpu/wgsl/codec/normal16 decodeNormal16 decodeNormal16Plus @use-gpu/wgsl/use/view worldToView clipToView viewToClip viewToWorld clipXYToUV clipUVToXY to3D getViewPixelRatio ./outline-weight depthWeightPlus normalWeight facetWeight vec4<u32> link vec2<u32> u32 f32 vec2<f32> export decodeNormal16 decodeNormal16Plus normalWeight facetWeight loadNormal16 loadDepth normal".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([4]),[O]:[{[A]:0,[N]:_(5),[S]:_([6,7]),[K]:[{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)}]},{[A]:0,[N]:_(8),[S]:_([9,10,11,12,13,14,15,16]),[K]:[{[N]:_(9),[J]:_(9)},{[N]:_(10),[J]:_(10)},{[N]:_(11),[J]:_(11)},{[N]:_(12),[J]:_(12)},{[N]:_(13),[J]:_(13)},{[N]:_(14),[J]:_(14)},{[N]:_(15),[J]:_(15)},{[N]:_(16),[J]:_(16)}]},{[A]:0,[N]:_(17),[S]:_([18,19,20]),[K]:[{[N]:_(18),[J]:_(18)},{[N]:_(19),[J]:_(19)},{[N]:_(20),[J]:_(20)}]}],[X]:[{[A]:262,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(21),[Z]:_([22]),[P]:[{[N]:"x",[T]:_(23)},{[N]:"s",[T]:_(24)}]}},{[A]:314,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(25),[Z]:_([22]),[P]:[{[N]:"x",[T]:_(23)},{[N]:"s",[T]:_(24)}]}},{[A]:357,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(26),[Z]:_([22])}},{[A]:395,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:_(26),[Z]:_([22])}}],[E]:[{[A]:434,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:C,[Z]:_([27]),[P]:[{[N]:"t",[T]:_(26)}],[I]:_([3,2,0,1])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "outline/outline-sample",
  code: _(["use '",5,"'::{",6,",",6,"Plus};use '",8,"'::{",9,",",10,",",11,",",12,",",13,",",14,",",15,",",16,"};use '",17,"'::{",18,",",19,",",20,"};@",22," fn ",0,"(x:",23,",s:u32)->",21,";@",22," fn ",1,"(x:",23,",s:u32)->f32;@",22," fn ",2,"()->",26,";@",22," fn ",3,"()->",26,";@",27," fn ",4,"(t:",26,")->",C,"{let o=mix(",26,"(0.5),t,",3,"());let s=vec2<i32>(o*",2,"());var s1=",26,"(0.0);for(var i=0u;i<MSAA_SAMPLES;i++){var n:",D,";var n1:",D,";var n2:",D,";var n3:",D,";var n4:",D,";var s2:",21,";var f=1.0;if(HAS_INNER){s2=",0,"(",23,"(s),i);let s3=",0,"(",23,"(s+vec2<i32>(-1,0)),i);let s4=",0,"(",23,"(s+vec2<i32>(1,0)),i);let s5=",0,"(",23,"(s+vec2<i32>(0,-1)),i);let s6=",0,"(",23,"(s+vec2<i32>(0,1)),i);if(HAS_FACETS){let n5=",6,"Plus(s2);let n6=",6,"Plus(s3);let n7=",6,"Plus(s4);let n8=",6,"Plus(s5);let n9=",6,"Plus(s6);f=min(min(",20,"(n6.index,n5.index),",20,"(n7.index,n5.index),),min(",20,"(n8.index,n5.index),",20,"(n9.index,n5.index),),);n=n5.",34,";n1=n6.",34,";n2=n7.",34,";n3=n8.",34,";n4=n9.",34,";}else{n=",6,"(s2);n1=",6,"(s3);n2=",6,"(s4);n3=",6,"(s5);n4=",6,"(s6);}}let d=",1,"(",23,"(s),i);let d1=",1,"(",23,"(s+vec2<i32>(-1,0)),i);let d2=",1,"(",23,"(s+vec2<i32>(1,0)),i);let d3=",1,"(",23,"(s+vec2<i32>(0,-1)),i);let d4=",1,"(",23,"(s+vec2<i32>(0,1)),i);var n10:f32=1.0;if(HAS_INNER){let l=length(",26,"(s2.xy));let n11=",19,"(n1,n);let n12=",19,"(n2,n);let n13=",19,"(n3,n);let n14=",19,"(n4,n);n10=select(1.0,min(min(min(n11,n12),min(n13,n14)),f),l>0.0);}let d5=select(1.0,",18,"(d,d1,d2,d3,d4),d>0.0);s1+=",26,"(1.0-n10,1.0-d5);}return ",C,"(s1/f32(MSAA_SAMPLES),0.0,1.0);};\n"]).join(''),
  hash: 0xb13492c6f6de9,
  table,
  shake: [[262,[0,4]],[314,[1,4]],[357,[2,4]],[395,[3,4]],[434,[4]]],
  tree: decompressAST([[1,0,71],[1,72,194],[1,123,189],[1,67,118],[1,52,94],[1,43,80],[1,38,76],[0,39,1674],[1,0,7],[2,11,27],[2,68,84],[2,38,53],[2,202,214],[2,36,48],[2,52,64],[2,51,63],[2,52,64],[2,66,84],[2,30,48],[2,30,48],[2,30,48],[2,30,48],[2,33,44],[2,31,42],[2,37,48],[2,31,42],[2,107,121],[2,22,36],[2,22,36],[2,22,36],[2,22,36],[2,27,36],[2,33,42],[2,49,58],[2,48,57],[2,49,58],[2,110,122],[2,27,39],[2,27,39],[2,27,39],[2,98,113]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/normal16": m0, "@use-gpu/wgsl/use/view": m1, "./outline-weight": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getOutlineSample = getSymbol("getOutlineSample");
//# sourceMappingURL=outline-sample.wgsl.js.map

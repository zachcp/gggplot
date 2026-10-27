/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("Light PickVertex LightVertex SolidVertex ShadedVertex UIVertex DepthFragment RTFragment SurfaceFragment export matrix mat4x4<f32> into position normal color opts intensity f32 cutoff kind i32 shadowMap shadowBlur shadowDepth vec2<f32> shadowBias shadowUV scissor index u32 world tangent sdfConfig sdfUV clipUV textureUV textureST repeat mode shape radius border stroke fill alpha depth occlusion albedo emissive material export struct position normal scissor".split(' '));
const table = {[Y]:_([0,1,2,3,4,5,6,7,8]),[S]:_([0,1,2,3,4,5,6,7,8]),[W]:_([0,1,2,3,4,5,6,7,8]),[E]:[{[A]:0,[R]:_(0),[G]:1,[U]:{[N]:_(0),[Z]:_([9]),[M]:[{[N]:_(10),[T]:_(11)},{[N]:_(12),[T]:_(11)},{[N]:_(13),[T]:C},{[N]:_(14),[T]:C},{[N]:_(15),[T]:C},{[N]:_(16),[T]:C},{[N]:_(17),[T]:_(18)},{[N]:_(19),[T]:_(18)},{[N]:_(20),[T]:_(21)},{[N]:_(22),[T]:_(21)},{[N]:_(23),[T]:_(21)},{[N]:_(24),[T]:_(25)},{[N]:_(26),[T]:C},{[N]:_(27),[T]:C}]}},{[A]:251,[R]:_(1),[G]:1,[U]:{[N]:_(1),[Z]:_([9]),[M]:[{[N]:_(13),[T]:C},{[N]:_(28),[T]:C},{[N]:_(29),[T]:_(30)}]}},{[A]:326,[R]:_(2),[G]:1,[U]:{[N]:_(2),[Z]:_([9]),[M]:[{[N]:_(13),[T]:C},{[N]:_(29),[T]:_(30)}]}},{[A]:384,[R]:_(3),[G]:1,[U]:{[N]:_(3),[Z]:_([9]),[M]:[{[N]:_(13),[T]:C},{[N]:_(15),[T]:C},{[N]:"uv",[T]:C},{[N]:"st",[T]:C},{[N]:_(28),[T]:C},{[N]:_(29),[T]:_(30)}]}},{[A]:502,[R]:_(4),[G]:1,[U]:{[N]:_(4),[Z]:_([9]),[M]:[{[N]:_(13),[T]:C},{[N]:_(31),[T]:C},{[N]:_(14),[T]:C},{[N]:_(32),[T]:C},{[N]:_(15),[T]:C},{[N]:"uv",[T]:C},{[N]:"st",[T]:C},{[N]:_(28),[T]:C},{[N]:_(29),[T]:_(30)}]}},{[A]:672,[R]:_(5),[G]:1,[U]:{[N]:_(5),[Z]:_([9]),[M]:[{[N]:_(13),[T]:C},{[N]:"uv",[T]:_(25)},{[N]:_(33),[T]:C},{[N]:_(34),[T]:_(25)},{[N]:_(35),[T]:C},{[N]:_(36),[T]:_(25)},{[N]:_(37),[T]:_(25)},{[N]:_(38),[T]:_(21)},{[N]:_(39),[T]:_(21)},{[N]:_(40),[T]:C},{[N]:_(41),[T]:C},{[N]:_(42),[T]:C},{[N]:_(43),[T]:C},{[N]:_(44),[T]:C},{[N]:_(28),[T]:C},{[N]:_(29),[T]:_(30)}]}},{[A]:953,[R]:_(6),[G]:1,[U]:{[N]:_(6),[Z]:_([9]),[M]:[{[N]:_(45),[T]:_(18)},{[N]:_(46),[T]:_(18)}]}},{[A]:1004,[R]:_(7),[G]:1,[U]:{[N]:_(7),[Z]:_([9]),[M]:[{[N]:_(13),[T]:C},{[N]:_(14),[T]:C},{[N]:_(45),[T]:_(18)},{[N]:_(46),[T]:_(18)}]}},{[A]:1088,[R]:_(8),[G]:1,[U]:{[N]:_(8),[Z]:_([9]),[M]:[{[N]:_(13),[T]:C},{[N]:_(14),[T]:C},{[N]:_(47),[T]:C},{[N]:_(48),[T]:C},{[N]:_(49),[T]:C},{[N]:_(50),[T]:C},{[N]:_(46),[T]:_(18)}]}}]};
const data = {
  name: "use/types",
  code: _(["@",9," ",52," ",0,"{",10,":",11,",",12,":",11,",",13,":",C,",",14,":",C,",",15,":",C,",",16,":",C,",",17,":f32,",19,":f32,",20,":i32,",22,":i32,",23,":i32,",24,":",25,",",26,":",C,",",27,":",C,",};@",9," ",52," ",1,"{",13,":",C,",",28,":",C,",",29,":u32,};@",9," ",52," ",0,"Vertex{",13,":",C,",",29,":u32,};@",9," ",52," ",3,"{",13,":",C,",",15,":",C,",uv:",C,",st:",C,",",28,":",C,",",29,":u32,};@",9," ",52," ",4,"{",13,":",C,",",31,":",C,",",14,":",C,",",32,":",C,",",15,":",C,",uv:",C,",st:",C,",",28,":",C,",",29,":u32,};@",9," ",52," ",5,"{",13,":",C,",uv:",25,",",33,":",C,",",34,":",25,",",35,":",C,",",36,":",25,",",37,":",25,",",38,":i32,",39,":i32,",40,":",C,",",41,":",C,",",42,":",C,",",43,":",C,",",44,":",C,",",28,":",C,",",29,":u32,};@",9," ",52," ",6,"{",45,":f32,",46,":f32,};@",9," ",52," ",7,"{",13,":",C,",",14,":",C,",",45,":f32,",46,":f32,};@",9," ",52," ",8,"{",13,":",C,",",14,":",C,",",47,":",C,",",48,":",C,",",49,":",C,",",50,":",C,",",46,":f32,};\n"]).join(''),
  hash: 0xb2c8797fd2f30,
  table,
  shake: [[0,[0]],[251,[1]],[326,[2]],[384,[3]],[502,[4]],[672,[5]],[953,[6]],[1004,[7]],[1088,[8]]],
  tree: decompressAST([[0,0,250],[1,0,7],[2,15,20],[0,236,310],[1,0,7],[2,15,25],[0,60,117],[1,0,7],[2,15,26],[0,43,160],[1,0,7],[2,15,26],[0,103,272],[1,0,7],[2,15,27],[0,155,435],[1,0,7],[2,15,23],[0,266,316],[1,0,7],[2,15,28],[0,36,119],[1,0,7],[2,15,25],[0,69,222],[1,0,7],[2,15,30]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.Light = getSymbol("Light");
exports.PickVertex = getSymbol("PickVertex");
exports.LightVertex = getSymbol("LightVertex");
exports.SolidVertex = getSymbol("SolidVertex");
exports.ShadedVertex = getSymbol("ShadedVertex");
exports.UIVertex = getSymbol("UIVertex");
exports.DepthFragment = getSymbol("DepthFragment");
exports.RTFragment = getSymbol("RTFragment");
exports.SurfaceFragment = getSymbol("SurfaceFragment");
//# sourceMappingURL=types.wgsl.js.map

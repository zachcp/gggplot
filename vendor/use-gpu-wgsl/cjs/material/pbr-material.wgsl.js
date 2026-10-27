/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../fragment/pbr.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getAlbedo getEmissive getMetalness getRoughness getAlbedoMap getEmissiveMap getOcclusionMap getMetalnessRoughnessMap getPBRMaterial @use-gpu/wgsl/fragment/pbr PBRParams optional link f32 vec2<f32> export PBRParams optional return".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7,8]),[W]:_([8]),[O]:[{[A]:0,[N]:_(9),[S]:_([10]),[K]:[{[N]:_(10),[J]:_(10)}]}],[X]:[{[A]:46,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([11,12])}},{[A]:123,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:D,[Z]:_([11,12])}},{[A]:190,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(13),[Z]:_([11,12])}},{[A]:241,[R]:_(3),[G]:6,[F]:{[N]:_(3),[T]:_(13),[Z]:_([11,12])}},{[A]:292,[R]:_(4),[G]:6,[F]:{[N]:_(4),[T]:C,[Z]:_([11,12]),[P]:[{[N]:"u",[T]:_(14)}]}},{[A]:371,[R]:_(5),[G]:6,[F]:{[N]:_(5),[T]:C,[Z]:_([11,12]),[P]:[{[N]:"u",[T]:_(14)}]}},{[A]:452,[R]:_(6),[G]:6,[F]:{[N]:_(6),[T]:C,[Z]:_([11,12]),[P]:[{[N]:"u",[T]:_(14)}]}},{[A]:534,[R]:_(7),[G]:6,[F]:{[N]:_(7),[T]:C,[Z]:_([11,12]),[P]:[{[N]:"u",[T]:_(14)}]}}],[E]:[{[A]:625,[R]:_(8),[G]:1,[F]:{[N]:_(8),[T]:_(10),[Z]:_([15]),[P]:[{[N]:"c",[T]:C},{[N]:"m",[T]:C},{[N]:"m1",[T]:C}],[I]:_([0,3,2,1,4,5,6,7])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true,[_(5)]:true,[_(6)]:true,[_(7)]:true}};
const data = {
  name: "material/pbr-material",
  code: _(["use '",9,"'::{",10,"};@",11," @",12," fn ",0,"()->",C,"{",18," ",C,"(1.0,1.0,1.0,1.0);}@",11," @",12," fn ",1,"()->",D,"{",18," ",D,"(0.0);}@",11," @",12," fn ",2,"()->f32{",18," 1.0;}@",11," @",12," fn ",3,"()->f32{",18," 1.0;}@",11," @",12," fn ",0,"Map(u:",14,")->",C,"{",18," ",C,"(0.0);}@",11," @",12," fn ",1,"Map(u:",14,")->",C,"{",18," ",C,"(0.0);}@",11," @",12," fn ",6,"(u:",14,")->",C,"{",18," ",C,"(0.0);}@",11," @",12," fn ",2,"RoughnessMap(u:",14,")->",C,"{",18," ",C,"(0.0);}@",15," fn ",8,"(c:",C,",m:",C,",m1:",C,",)->",10,"{var a:",C,"=c*",0,"();var r:f32=",3,"();var m2:f32=",2,"();var e:",C,"=",C,"(",1,"(),0.0);var o:f32=1.0;if(HAS_ALBEDO_MAP){a*=",0,"Map(m.xy);}if(HAS_EMISSIVE_MAP){e*=",1,"Map(m.xy);}else if(HAS_OCCLUSION_MAP){o=",6,"(m.xy).x;}var m3=",C,"(m2,r,1.0,1.0);if(HAS_METALNESS_ROUGHNESS_MAP){m3*=",2,"RoughnessMap(m.xy).bgra;}",18," ",10,"(a,e,m3,o);}\n"]).join(''),
  hash: 0x1264a80612f250,
  table,
  shake: [[46,[0,8]],[123,[1,8]],[190,[2,8]],[241,[3,8]],[292,[4,8]],[371,[5,8]],[452,[6,8]],[534,[7,8]],[625,[8]]],
  tree: decompressAST([[1,0,45],[4,46,123,0],[1,0,9],[1,10,15],[2,9,18],[4,58,125,1],[1,0,9],[1,10,15],[2,9,20],[4,48,99,2],[1,0,9],[1,10,15],[2,9,21],[4,32,83,3],[1,0,9],[1,10,15],[2,9,21],[4,32,111,4],[1,0,9],[1,10,15],[2,9,21],[4,60,141,5],[1,0,9],[1,10,15],[2,9,23],[4,62,144,6],[1,0,9],[1,10,15],[2,9,24],[4,63,154,7],[1,0,9],[1,10,15],[2,9,33],[0,72,562],[1,0,7],[2,11,25],[2,55,64],[2,28,37],[2,22,34],[2,26,38],[2,41,52],[2,55,67],[2,44,58],[2,51,66],[2,92,116],[2,44,53]], table[S]),
};

const libs = {"@use-gpu/wgsl/fragment/pbr": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getPBRMaterial = getSymbol("getPBRMaterial");
//# sourceMappingURL=pbr-material.wgsl.js.map

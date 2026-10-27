/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("SH_DIFFUSE SH_SPECULAR auto export array(vec3<f32>(0.969269,0.927112,0.885442),vec3<f32>(0.647664,0.640325,0.686698),vec3<f32>(-0.709403,-0.653348,-0.617655),vec3<f32>(-0.186345,-0.168004,-0.162459),vec3<f32>(-0.490170,-0.444651,-0.401127),vec3<f32>(-0.498284,-0.455705,-0.425362),vec3<f32>(0.031365,0.028106,0.021393),vec3<f32>(-0.057400,-0.049962,-0.040700),vec3<f32>(0.013295,0.017533,0.012387),) value constant array(vec3<f32>(0.308528,0.295109,0.281845),vec3<f32>(0.309237,0.305733,0.327874),vec3<f32>(-0.338715,-0.311951,-0.294909),vec3<f32>(-0.088973,-0.080216,-0.077569),vec3<f32>(-0.624104,-0.566148,-0.510731),vec3<f32>(-0.634435,-0.580221,-0.541588),vec3<f32>(0.039935,0.035786,0.027238),vec3<f32>(-0.073084,-0.063614,-0.051820),vec3<f32>(0.016928,0.022324,0.015771),vec3<f32>(0.023993,0.023097,0.023107),vec3<f32>(1.608965,1.445314,1.267045),vec3<f32>(0.038017,0.041060,0.053180),vec3<f32>(0.102796,0.095323,0.084499),vec3<f32>(0.283943,0.252868,0.223028),vec3<f32>(-0.238779,-0.215720,-0.219193),vec3<f32>(0.376530,0.336082,0.304405),)".split(' '));
const table = {[S]:_([0,1]),[W]:_([0,1]),[E]:[{[A]:0,[R]:_(0),[G]:1,[_(6)]:{[N]:_(0),[T]:_(2),[Z]:_([3]),[_(5)]:_(4)}},{[A]:390,[R]:_(1),[G]:1,[_(6)]:{[N]:_(1),[T]:_(2),[Z]:_([3]),[_(5)]:_(7)}}]};
const data = {
  name: "env/road",
  code: _(["@",3," const ",0,"=",4,";@",3," const ",1,"=",7,";\n"]).join(''),
  hash: 0xdd179541a3509,
  table,
  shake: [[0,[0]],[390,[1]]],
  tree: decompressAST([[0,0,390],[1,0,7],[2,14,24],[0,376,1036],[1,0,7],[2,14,25]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.SH_DIFFUSE = getSymbol("SH_DIFFUSE");
exports.SH_SPECULAR = getSymbol("SH_SPECULAR");
//# sourceMappingURL=road.wgsl.js.map

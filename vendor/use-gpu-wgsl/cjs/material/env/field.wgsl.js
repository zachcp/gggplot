/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("SH_DIFFUSE SH_SPECULAR auto export array(vec3<f32>(0.849241,0.975323,1.010092),vec3<f32>(0.362624,0.501061,0.797497),vec3<f32>(-0.232352,-0.261513,-0.330679),vec3<f32>(-0.434627,-0.438521,-0.456706),vec3<f32>(-0.547447,-0.533903,-0.510425),vec3<f32>(-0.415733,-0.419625,-0.404393),vec3<f32>(-0.056177,-0.052826,-0.048512),vec3<f32>(0.234303,0.234442,0.232207),vec3<f32>(-0.068472,-0.046677,-0.024828),) value constant array(vec3<f32>(0.270322,0.310455,0.321522),vec3<f32>(0.173140,0.239239,0.380777),vec3<f32>(-0.110940,-0.124863,-0.157888),vec3<f32>(-0.207519,-0.209378,-0.218061),vec3<f32>(-0.697031,-0.679786,-0.649894),vec3<f32>(-0.529327,-0.534283,-0.514889),vec3<f32>(-0.071527,-0.067260,-0.061768),vec3<f32>(0.298324,0.298501,0.295655),vec3<f32>(-0.087182,-0.059431,-0.031613),vec3<f32>(0.007127,0.010646,0.016252),vec3<f32>(1.364066,1.301430,1.224293),vec3<f32>(-0.025764,-0.010439,0.011228),vec3<f32>(0.102041,0.088239,0.077058),vec3<f32>(0.023804,0.030902,0.039083),vec3<f32>(0.276720,0.274303,0.277140),vec3<f32>(0.250993,0.240548,0.228438),)".split(' '));
const table = {[S]:_([0,1]),[W]:_([0,1]),[E]:[{[A]:0,[R]:_(0),[G]:1,[_(6)]:{[N]:_(0),[T]:_(2),[Z]:_([3]),[_(5)]:_(4)}},{[A]:393,[R]:_(1),[G]:1,[_(6)]:{[N]:_(1),[T]:_(2),[Z]:_([3]),[_(5)]:_(7)}}]};
const data = {
  name: "env/field",
  code: _(["@",3," const ",0,"=",4,";@",3," const ",1,"=",7,";\n"]).join(''),
  hash: 0x3fa95d3b38905,
  table,
  shake: [[0,[0]],[393,[1]]],
  tree: decompressAST([[0,0,393],[1,0,7],[2,14,24],[0,379,1041],[1,0,7],[2,14,25]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.SH_DIFFUSE = getSymbol("SH_DIFFUSE");
exports.SH_SPECULAR = getSymbol("SH_SPECULAR");
//# sourceMappingURL=field.wgsl.js.map

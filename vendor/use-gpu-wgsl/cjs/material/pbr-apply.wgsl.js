/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../fragment/pbr.wgsl");
const m1 = require("../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("applyPBRMaterial @use-gpu/wgsl/fragment/pbr PBR @use-gpu/wgsl/use/types SurfaceFragment export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[O]:[{[A]:0,[N]:_(1),[S]:_([2]),[K]:[{[N]:_(2),[J]:_(2)}]},{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[E]:[{[A]:89,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:D,[Z]:_([5]),[P]:[{[N]:"N",[T]:D},{[N]:"L",[T]:D},{[N]:"V",[T]:D},{[N]:"s",[T]:_(4)}]}}]};
const data = {
  name: "material/pbr-apply",
  code: _(["use '",1,"'::{PBR};use '",3,"'::{",4,"};@",5," fn ",0,"(N:",D,",L:",D,",V:",D,",s:",4,",)->",D,"{return PBR(N,L,V,s.albedo.xyz,s.material.x,s.material.y);}\n"]).join(''),
  hash: 0x24ecec397e8d0,
  table,
  shake: [[89,[0]]],
  tree: decompressAST([[1,0,39],[1,40,88],[0,49,202],[1,0,7],[2,11,27],[2,55,70],[2,36,39]], table[S]),
};

const libs = {"@use-gpu/wgsl/fragment/pbr": m0, "@use-gpu/wgsl/use/types": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.applyPBRMaterial = getSymbol("applyPBRMaterial");
//# sourceMappingURL=pbr-apply.wgsl.js.map

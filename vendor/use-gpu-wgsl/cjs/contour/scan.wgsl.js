/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../use/array.wgsl");
const m1 = require("./types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("indirectDraw activeEdges activeCells markedCells vertexIndices getValueData getVolumeSize getVolumeLevel appendEdge appendVertex packEdgeId main @use-gpu/wgsl/use/array sizeToModulus3 packIndex3 ./types IndirectDrawMetaAtomic link <storage,read_write> array<u32> array<atomic<u32>> f32 u32 vec3<u32> optional void compute workgroup_size(4,4,4) export globalId builtin(global_invocation_id) packIndex3 var<storage,read_write> indirectDraw getValueData return appendEdge appendVertex packEdgeId globalId".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7,8,9,10,11]),[W]:_([11]),[O]:[{[A]:0,[N]:_(12),[S]:_([13,14]),[K]:[{[N]:_(13),[J]:_(13)},{[N]:_(14),[J]:_(14)}]},{[A]:0,[N]:_(15),[S]:_([16]),[K]:[{[N]:_(16),[J]:_(16)}]}],[X]:[{[A]:99,[R]:_(0),[G]:2,[V]:{[N]:_(0),[T]:_(16),[Z]:_([17]),[Q]:_(18)}},{[A]:164,[R]:_(1),[G]:2,[V]:{[N]:_(1),[T]:_(19),[Z]:_([17]),[Q]:_(18)}},{[A]:216,[R]:_(2),[G]:2,[V]:{[N]:_(2),[T]:_(19),[Z]:_([17]),[Q]:_(18)}},{[A]:268,[R]:_(3),[G]:2,[V]:{[N]:_(3),[T]:_(20),[Z]:_([17]),[Q]:_(18)}},{[A]:328,[R]:_(4),[G]:2,[V]:{[N]:_(4),[T]:_(19),[Z]:_([17]),[Q]:_(18)}},{[A]:382,[R]:_(5),[G]:2,[F]:{[N]:_(5),[T]:_(21),[Z]:_([17]),[P]:[{[N]:"i",[T]:_(22)}]}},{[A]:418,[R]:_(6),[G]:2,[F]:{[N]:_(6),[T]:_(23),[Z]:_([17])}},{[A]:456,[R]:_(7),[G]:6,[F]:{[N]:_(7),[T]:_(21),[Z]:_([24,17])}}],[E]:[{[A]:955,[R]:_(11),[G]:1,[F]:{[N]:_(11),[T]:_(25),[Z]:_([26,27,28]),[P]:[{[N]:_(29),[T]:_(23),[Z]:_([30])}],[I]:_([6,7,5,8,10,9])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true,[_(5)]:true,[_(6)]:true,[_(7)]:true}};
const data = {
  name: "contour/scan",
  code: _(["use '",12,"'::{",13,",",14,"};use '",15,"'::{",16,"};@",17," var",18,0,":",16,";@",17," var",18,1,":",19,";@",17," var",18,2,":",19,";@",17," var",18,3,":",20,";@",17," var",18,4,":",19,";@",17," fn ",5,"(i:u32)->f32{};@",17," fn ",6,"()->",23,"{};@",24," @",17," fn ",7,"()->f32{",35," 0.0;};fn ",8,"(i:u32){let n=atomicAdd(&",0,".instanceCount,1u);",1,"[n]=i;}fn ",9,"(i:u32){let g=",0,".generationIndex;let l=atomicMax(&",3,"[i],g);if(l !=g){let n=atomicAdd(&",0,".nextVertexIndex,1u);",2,"[n]=i;",4,"[i]=n;let d=(n/64u)+1u;atomicMax(&",0,".dispatchCount,d);}}fn ",10,"(i:",23,",a:u32)->u32{let s=vec4<u32>(i,a)<<vec4<u32>(0u,9u,18u,27u);",35," s.x|s.y|s.z|s.w;}@",26," @",27,"@",28," fn ",11,"(@",30,29,":",23,",){let s=",6,"();if(any(",29,">=(s-1u))){",35,";}let l=",7,"();let m=",13,"(s);let b=",14,"(",29,",m);let p=",5,"(b)-l;let p1=",5,"(b+",14,"(",23,"(1u,0u,0u),m))-l;let p2=",5,"(b+",14,"(",23,"(0u,1u,0u),m))-l;let p3=",5,"(b+",14,"(",23,"(0u,0u,1u),m))-l;let c=",29,".yzx*",29,".zxy;if(c.x>0u){if(p1*p<0.0){var a=1u;if(p1<p){a=2u;}",8,"(",10,"(",29,",a));",9,"(b-",14,"(",23,"(0u,1u,1u),m));",9,"(b-",14,"(",23,"(0u,1u,0u),m));",9,"(b-",14,"(",23,"(0u,0u,1u),m));",9,"(b);}}if(c.y>0u){if(p2*p<0.0){var a=3u;if(p2<p){a=4u;}",8,"(",10,"(",29,",a));",9,"(b-",14,"(",23,"(1u,0u,1u),m));",9,"(b-",14,"(",23,"(1u,0u,0u),m));",9,"(b-",14,"(",23,"(0u,0u,1u),m));",9,"(b);}}if(c.z>0u){if(p3*p<0.0){var a=5u;if(p3<p){a=6u;}",8,"(",10,"(",29,",a));",9,"(b-",14,"(",23,"(1u,1u,0u),m));",9,"(b-",14,"(",23,"(1u,0u,0u),m));",9,"(b-",14,"(",23,"(0u,1u,0u),m));",9,"(b);}}}\n"]).join(''),
  hash: 0x1f6763f24dc810,
  table,
  shake: [[99,[0,8,11,9]],[164,[1,8,11]],[216,[2,9,11]],[268,[3,9,11]],[328,[4,9,11]],[382,[5,11]],[418,[6,11]],[456,[7,11]],[510,[8,11]],[597,[9,11]],[846,[10,11]],[955,[11]]],
  tree: decompressAST([[1,0,58],[1,59,98],[1,40,105],[1,65,117],[1,52,104],[1,52,112],[1,60,114],[1,54,89],[1,36,73],[4,38,91,7],[1,0,9],[1,10,15],[2,9,23],[0,35,122],[2,3,13],[2,35,47],[2,31,42],[0,18,267],[2,3,15],[2,26,38],[2,46,57],[2,45,57],[2,33,44],[2,17,30],[2,47,59],[0,32,141],[2,3,13],[0,106,1323],[3,0,8],[3,9,31],[1,22,29],[2,11,15],[3,5,35],[2,57,70],[2,56,70],[2,23,37],[2,24,34],[2,29,41],[2,25,37],[2,15,25],[2,44,56],[2,15,25],[2,44,56],[2,15,25],[2,117,127],[2,11,21],[2,24,36],[2,15,25],[2,35,47],[2,15,25],[2,35,47],[2,15,25],[2,35,47],[2,66,76],[2,11,21],[2,24,36],[2,15,25],[2,35,47],[2,15,25],[2,35,47],[2,15,25],[2,35,47],[2,66,76],[2,11,21],[2,24,36],[2,15,25],[2,35,47],[2,15,25],[2,35,47],[2,15,25],[2,35,47]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/array": m0, "./types": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=scan.wgsl.js.map

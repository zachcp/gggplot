/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../fragment/sdf-2d.wgsl");
const m1 = require("../../use/color.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getMask getScissor getSDFRectangleFragment @use-gpu/wgsl/fragment/sdf-2d SDF getUVScale getBoxSDF getBorderBoxSDF getRoundedBorderBoxSDF @use-gpu/wgsl/use/color premultiply optional link vec2<f32> export i32 premultiply optional return".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5,6,7,8,9]),[K]:[{[N]:_(5),[J]:_(5)},{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)},{[N]:_(9),[J]:_(9)}]},{[A]:0,[N]:_(10),[S]:_([11]),[K]:[{[N]:_(11),[J]:_(11)}]}],[X]:[{[A]:148,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([12,13]),[P]:[{[N]:"u",[T]:_(14)}]}},{[A]:238,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([12,13]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}]}},{[A]:323,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:C,[Z]:_([12,13]),[P]:[{[N]:"c",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:399,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([15]),[P]:[{[N]:"u",[T]:_(14)},{[N]:"t",[T]:_(14)},{[N]:"t1",[T]:_(14)},{[N]:"c",[T]:C},{[N]:"s",[T]:_(14)},{[N]:"s1",[T]:C},{[N]:"r",[T]:_(16)},{[N]:"m",[T]:_(16)},{[N]:"s2",[T]:C},{[N]:"r1",[T]:C},{[N]:"b",[T]:C},{[N]:"s3",[T]:C},{[N]:"f",[T]:C},{[N]:"s4",[T]:C}],[I]:_([0,1,2])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "fragment/sdf-rectangle",
  code: _(["use '",4,"'::{SDF,",6,",",7,",",8,",",9,"};use '",10,"'::{",11,"};@",12," @",13," fn ",0,"(u:",14,")->",C,"{",19," ",C,"(0.0,0.0,0.0,0.0);};@",12," @",13," fn ",1,"(c:",C,",u:",C,",s:",C,")->",C,"{",19," c;}@",12," @",13," fn ",2,"(c:",C,",s:",C,")->",C,"{",19," c;}@",15," fn ",3,"(u:",14,",t:",14,",t1:",14,",c:",C,",s:",14,",s1:",C,",r:i32,m:i32,s2:",C,",r1:",C,",b:",C,",s3:",C,",f:",C,",s4:",C,",)->",C,"{var _1=f;var s5=s3;var s6=",6,"(s);var s7:SDF;var t2=",0,"(t);var s8=0.0;var m1=0.0;if(m==-1||m==-2){let s9=s1.x;var e=b.x;var b1=b.y;var d=(t2.a-0.75)*s9;var s10=(d+e/s1.y)/s6+0.5+b1;s7=SDF(s10,s10);if(m==-2){_1=",C,"(t2.rgb,_1.a);}}else{if(t2.a>0.0){if(((r==0||r==1)&&(t.x<0.0||t.x>1.0))||((r==0||r==2)&&(t.y<0.0||t.y>1.0))){t2.a=0.0;}if(t2.a>0.0){_1=",C,"(",11,"(_1).rgb*(1.0-t2.a)+t2.rgb,mix(_1.a,1.0,t2.a),);}}else{_1=",11,"(_1);}if(m==0){if(HAS_ALPHA_TO_DISCARD){if(_1.a<=0.0){discard;}}s7=",7,"(s2.xy,u,s6);}else if(m==1){s7=",8,"(s2.xy,b,u,s6);}else{s7=",9,"(s2.xy,b,r1,u,s6);}let b1=0.5;s7.outer+=b1;s7.inner+=b1;}if(u.x<c.x||u.y<c.y||u.x>c.z||u.y>c.w){",19," ",C,"(0.0);}var m2=clamp(s7.outer,0.0,1.0);if(DEBUG_SDF){var s10=4.0;var b2=0.0;if(m==-1||m==-2){s10=1.0;b2=6.0;}let o=(s7.outer-0.5)*s6/s10;var m3=(max(0.0,o+0.5+b2)% 1.0)-0.5;if(o<-b2){m3=1.0+(o+b2-1.0);}m1=clamp(1.0-abs(m3/s6)*s10,0.0,1.0);if((b.x !=b.y)||(b.z !=b.w)||(b.x !=b.z)){let o=(s7.inner-0.5)*s6/s10;let m3=((o+0.5+b2)% 1.0)-0.5;let m4=1.0*clamp(1.0-abs(m3/s6)*s10,0.0,1.0);if(s7.inner>-0.5){m1=m4+m1*0.5;}}}if(m2==0.0&&m1==0.0){",19," ",C,"(0.0);}var c1=_1;if(s7.outer !=s7.inner){var r2=1.0;if(s7.outer-s7.inner<1.0){r2=s7.outer-s7.inner;s7.inner=s7.outer-1.0;}let f=r2*clamp(1.0-s7.inner,0.0,1.0);c1=mix(_1,s5,f);}if(HAS_MASK){c1=",1,"(c1,",C,"(t,0.0,0.0),",C,"(t1,0.0,0.0));}if(HAS_SCISSOR){c1=",2,"(c1,s4);}if(!HAS_ALPHA_TO_COVERAGE){c1=",C,"((c1.rgb+m1)*c1.a*m2,c1.a*m2+m1);}else{c1=",C,"(c1.rgb+m1,c1.a*m2);}if(DEBUG_SDF){",19," ",C,"(mix(c1.rgb,",D,"(m1),0.5),c1.a);}",19," c1;}\n"]).join(''),
  hash: 0x1454168a4fdbb6,
  table,
  shake: [[148,[0,3]],[238,[1,3]],[323,[2,3]],[399,[3]]],
  tree: decompressAST([[1,0,102],[1,103,147],[4,45,134,0],[1,0,9],[1,10,15],[2,9,19],[4,71,156,1],[1,0,9],[1,10,15],[2,9,16],[4,66,142,2],[1,0,9],[1,10,15],[2,9,19],[0,57,1933],[1,0,7],[2,11,34],[2,225,235],[2,21,24],[2,11,21],[2,139,142],[2,180,191],[2,69,80],[2,78,87],[2,40,55],[2,39,61],[2,779,786],[2,75,85]], table[S]),
};

const libs = {"@use-gpu/wgsl/fragment/sdf-2d": m0, "@use-gpu/wgsl/use/color": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getSDFRectangleFragment = getSymbol("getSDFRectangleFragment");
//# sourceMappingURL=sdf-rectangle.wgsl.js.map

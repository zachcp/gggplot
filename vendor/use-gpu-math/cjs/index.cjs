"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
_export_star(require("./ease.cjs"), exports);
_export_star(require("./linalg.cjs"), exports);
_export_star(require("./matrix.cjs"), exports);
_export_star(require("./number.cjs"), exports);
_export_star(require("./polynomial.cjs"), exports);
_export_star(require("./vector.cjs"), exports);
function _export_star(from, to) {
    Object.keys(from).forEach(function(k) {
        if (k !== "default" && !Object.prototype.hasOwnProperty.call(to, k)) {
            Object.defineProperty(to, k, {
                enumerable: true,
                get: function() {
                    return from[k];
                }
            });
        }
    });
    return from;
}

//# sourceMappingURL=index.js.map
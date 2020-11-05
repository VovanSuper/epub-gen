"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toId = exports.isEmpty = exports.isString = void 0;
function isString(test) {
    return Object.prototype.toString.call(test) === '[object String]';
}
exports.isString = isString;
function isEmpty(value) {
    return (isString(value) && value.length === 0);
}
exports.isEmpty = isEmpty;
function toId(raw) {
    return raw.toLowerCase().replace(/[^\w]+/g, '-').replace('_', '-');
}
exports.toId = toId;

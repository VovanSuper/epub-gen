function isString(test: unknown): test is string {
  return Object.prototype.toString.call(test) === '[object String]';
}
function isEmpty(value: unknown) {
  return (isString(value) && value.length === 0);
}

function toId(raw: string): string {
  return raw.toLowerCase().replace(/[^\w]+/g, '-').replace('_', '-');
}

// module.exports = { isString };
export { isString, isEmpty, toId };
const {  } = require("ts-jest/presets/js-with-ts/jest-preset");

// require('ts-node/register');

module.exports = {
  // [...]
  // Replace `ts-jest` with the preset you want to use
  // from the above list
  preset: "ts-jest",
  testPathIgnorePatterns: ["/node_modules/", "./test.ts"]
};

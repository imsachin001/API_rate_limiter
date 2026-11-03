const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve("src/lua");
const destination = path.resolve("dist/src/lua");

fs.cpSync(source, destination, {
  recursive: true,
});

console.log("Lua scripts copied to dist/src/lua");
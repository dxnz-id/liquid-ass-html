const http = require("http");
const fs = require("fs");
const port = process.env.PORT || 8080;
const html = fs.readFileSync(__dirname + "/liquid-glass-ios-kit-v2.html");   // read once at boot

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  })
  .listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  })
  .on("error", err => {
    console.error(`Cannot listen on port ${port}: ${err.message}`);
    process.exit(1);
  });

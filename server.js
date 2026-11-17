const http = require("http");
const fs = require("fs");
const port = 3000;

http
  .createServer((req, res) => {
    fs.readFile("liquid-glass-ios-kit-v2.html", (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end("Error loading index.html");
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

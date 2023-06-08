const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();
const options = {
  key: fs.readFileSync('localhost-key.pem'),
  cert: fs.readFileSync('localhost.pem')
};

const server = https.createServer(options, app);


app.use(function(request, response, next){
     
    let now = new Date();
    let hour = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    let data = `${hour}:${minutes}:${seconds} ${request.method} ${request.url} ${request.get("user-agent")}`;
    console.log(data);
    fs.appendFile("server.log", data + "\n", function(){});
    next();
});

app.use(express.static(__dirname + "/main"));
 
app.use("/", function(request, response){
     
    response.send("<h1>Главная страница</h1>");
});

app.get('/', (req, res) => {
  res.send('Hello, HTTPS!');
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
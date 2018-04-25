const http = require("http");
const path = require("path");
const config = require("./config/default.json");
const fs = require('fs');
const mime = require('./mime');

class StaticServer {

	constructor () {
		this.port = config.port;
		this.root = config.root;
		this.indexPage = config.indexPage;
	}

	respondNotFound(req, res) {
		res.writeHead(404, {'Content-Type':'text/plain'});
		res.end(`<h1>Page Not Found</h1><p>The requested URL ${req.url} was not found on this server.`);
	}

	respondFile(pathName, req, res) {
		const readStream = fs.createReadStream(pathName);
		res.setHeader('Content-Type',mime.lookup(pathName));
		readStream.pipe(res);
	}

	routeHandler(pathName, req, res) {
		fs.stat(pathName, (err, stat) => {
			if (!err) {
				this.respondFile(pathName,req,res);
			} else {
				console.info(pathName);
				this.respondNotFound(req, res);
			}
		});
	}

	start () {
		http.createServer((req, res) => {
			const pathName = path.join(this.root, path.normalize(req.url));
			//res.writeHead(200);
			//res.end(`Requeste path: ${pathName}`);
			this.routeHandler(pathName, req, res);
		}).listen(this.port, err => {
			if (err) {
				console.error(err);
				console.info('Failed to start server.');
			} else {
				console.info(`Server started on port ${this.port}.`);
			}
		});
	}
}

module.exports = StaticServer;

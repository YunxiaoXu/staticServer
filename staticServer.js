const http = require("http");
const path = require("path");
const config = require("./config/default.json");
const fs = require('fs');
const mime = require('./mime');
const url = require('url')

const hasTrailingSlash = (str) => {
	if (str[str.length-1]=='/') {
		return true;
	} else {
		return false;
	}
}

class StaticServer {

	constructor () {
		this.port = config.port;
		this.root = config.root;
		this.indexPage = config.indexPage;
		this.enableCacheControl = config.cacheContron;
		this.enableExpires = config.expires;
		this.enableEtag = config.etag;
		this.enableLastModified = config.lastModified;
	}

	respondNotFound(req, res) {
		res.writeHead(404, {'Content-Type':'text/html'});
		res.end(`<h1>Page Not Found</h1><p>The requested URL ${req.url} was not found on this server.</p>`);
	}

	respondFile(pathName, req, res) {
		const readStream = fs.createReadStream(pathName);
		res.setHeader('Content-Type',mime.lookup(pathName));
		readStream.pipe(res);
	}

	respondDirectory (pathName, req, res) {
		const indexPagePath = path.join(pathName, this.indexPage);
		if (fs.existsSync(indexPagePath)) {
			this.respondFile(indexPagePath, req, res);
		} else {
			fs.readdir(pathName, (err, files) => {
				if (err) {
					res.writeHead(500);
					return res.end(err);
				}
				const requestPath = url.parse(req.url).pathname;
				let content = `<h1>Index of ${requestPath}</h1>`;
				files.forEach(file => {
					let itemLink = path.join(requestPath,file);
					const stat = fs.statSync(path.join(pathName,file));
					if (stat && stat.isDirectory()) {
						itemLink = path.join(itemLink, '/');
						file = path.join(file,'/');
					}
					content += `<p><a href='${itemLink}'>${file}</a></p>`;
				});
				res.writeHead(200,{'Content-Type':'text/html'});
				res.end(content);
			});
		}
	}

	respondRedirect (req, res) {
		const location = req.url + '/';
		res.writeHead(301, {
			'Location': location,
			'Content-Type': 'text/html'
		});
		res.end(`Redirecting to <a href='${location}'>${location}</a>`);
	}


	routeHandler(pathName, req, res) {
		fs.stat(pathName, (err, stat) => {
			if (!err) {
				const requestedPath = url.parse(req.url).pathname;
				if (hasTrailingSlash(requestedPath) && stat.isDirectory()) {
					this.respondDirectory(pathName, req, res);
				} else if (stat.isDirectory()) {
					this.respondRedirect(req, res);
				} else {
					this.respondFile(pathName,req,res);
				}
			} else {
				console.info(`.${req.url}`);
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

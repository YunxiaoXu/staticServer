const http = require("http");
const path = require("path");
const config = require("./config/default.json");
const fs = require('fs');
const mime = require('./mime');
const url = require('url');
const zlib = require('zlib');

const hasTrailingSlash = url => url[url.length - 1] === '/';

function getClientIp(req) {
	return req.headers['x-forwarded-for'] ||
	req.headers['x-real-ip'] ||
	req.headers['clientip'] ||
	req.connection.remoteAddress ||
	req.socket.remoteAddress ||
	req.connection.socket.remoteAddress
};

class StaticServer {

	constructor () {
		this.port = config.port;
		this.root = config.root;
		this.indexPage = config.indexPage;
		this.enableCacheControl = config.cacheContron;
		this.enableExpires = config.expires;
		this.enableETag = config.etag;
		this.enableLastModified = config.lastModified;
		this.maxAge = config.maxAge;
	}

	respondError(err, rea) {
		res.writeHead(500);
		return res.end(err);
	}

	respondNotFound(req, res) {
		res.writeHead(404, {'Content-Type':'text/html'});
		res.end(`<h1>Page Not Found</h1><p>The requested URL ${req.url} was not found on this server.</p><br/><p><a href='/'>back</a></p>`);
	}

	generateETag(stat) {
		const mtime = stat.mtime.getTime().toString(16);
		const size = stat.size.toString(16);
		return `W/"${size} - ${mtime}"`;
	}

	setFreshHeaders(stat, res) {
		const lastModified = stat.mtime.toUTCString();
		if (this.enableExpires) {
			const expireTime = (new Date(Date.now() + this.maxAge * 1000)).toUTCString();
			res.setHeader('Expires',expireTime);
		}
		if (this.enableLastModified) {
			res.setHeader('Last-Modified',lastModified);
		}
		if (this.enableETag) {
			res.setHeader('ETag',this.generateETag(stat));
		}
	}

	isFresh(reqHeaders, resHeaders) {
		const noneMatch = reqHeaders['if-none-match'];
		const lastModified = reqHeaders['if-modified-since'];
		if (!(noneMatch || lastModified)) return false;
		if (noneMatch && (noneMatch !== resHeaders['etag'])) return false;
		if (lastModified && (lastModified !== resHeaders['last-modified'])) return false;
		return true;
	}

	respond(pathName, req, res) {
		fs.stat(pathName, (err, stat) => {
			if (err) return respondError(err, res);
			this.setFreshHeaders(stat,res);
			if (this.isFresh(req.headers, res._headers)) {
				this.responseNotModified(res);
			} else {
				this.respondFile(stat, pathName, req, res);
			}
		});
	}

	responseNotModified(res) {
		res.statusCode = 304;
		res.end();
	}

	respondFile(stat, pathName, req, res) {
		let readStream;
		res.setHeader('Content-Type',mime.lookup(pathName));
		readStream = fs.createReadStream(pathName);
		readStream.pipe(res);
	}

	respondDirectory (pathName, req, res) {
		const indexPagePath = path.join(pathName, this.indexPage);
		if (fs.existsSync(indexPagePath)) {
			this.respond(indexPagePath, req, res);
		} else {
			fs.readdir(pathName, (err, files) => {
				if (err) {
					res.writeHead(500);
					return res.end(err);
				}
				const requestPath = url.parse(req.url).pathname;
				let content = `<h1>Index of ${requestPath}</h1><ul>`;
				files.forEach(file => {
					let itemLink = path.join(requestPath,file);
					const stat = fs.statSync(path.join(pathName,file));
					if (stat && stat.isDirectory()) {
						itemLink = path.join(itemLink, '/');
						file = path.join(file,'/');
					}
					content += `<li><a href='${itemLink}'>${file}</a></li>`;
				});
				content += '</ul>'
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
		/*var h = req.headers;
		console.info(h['x-forwarded-for']);
		console.info(h['x-real-ip']);
		console.info(h['clientip']);
		console.info(req.connection.remoteAddress);
		console.info(req.socket.remoteAddress);
		console.info(req.headers);*/
		console.info(new Date().toLocaleString() + ' -- ' + getClientIp(req) + ' -- ' + req.url);
		fs.stat(pathName, (err, stat) => {
			if (!err) {
				const requestedPath = url.parse(req.url).pathname;
				if (hasTrailingSlash(requestedPath) && stat.isDirectory()) {
					this.respondDirectory(pathName, req, res);
				} else if (stat.isDirectory()) {
					this.respondRedirect(req, res);
				} else {
					this.respond(pathName,req,res);
				}
			} else {
				console.info(`! error: .${req.url}`);
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
		}).listen(this.port, '0.0.0.0',err => {
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

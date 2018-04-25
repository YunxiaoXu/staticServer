const path = require('path');
const mimeTypes = require('./config/mime.json');

const lookup  = (pathName) => {
	let ext = path.extname(pathName);
	ext = ext.split('.').pop();
	return mimeTypes[ext] || mimeTypes['txt'];
}

module.exports = {
	lookup
};

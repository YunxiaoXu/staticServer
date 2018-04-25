#!/data/data/com.termux/files/usr/bin/env node

const StaticServer = require('./staticServer');

Server = new StaticServer();
Server.start();

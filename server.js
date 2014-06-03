
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");
const NET = require("net");
const LOGSTASH_AGENT = require("logstash/lib/agent");
const LOGSTASH_PATTERNS_LOADER = require("logstash/lib/lib/patterns_loader");
const LOGSTASH_LOGGER = require("logstash/node_modules/log4node");
const ZMQ = require("zmq");


ASSERT.equal(typeof process.env.PIO_SERVICE_DATA_BASE_PATH, "string", "'PIO_SERVICE_DATA_BASE_PATH' env var must be set!");

var TCP_PORT = process.env.TCP_PORT || null;


require("io.pinf.server.www").for(module, __dirname, function(app, config) {

	var logBasePath = PATH.join(
		process.env.PIO_SERVICE_DATA_BASE_PATH,
		"incoming"
	);

	if (!FS.existsSync(logBasePath)) {
		FS.mkdirsSync(logBasePath);
	}

	function pathForChannel (channel) {
		var path = PATH.join(
			logBasePath,
			channel.replace(/[^a-zA-Z0-9-_\.]/gi, "") + ".log"
		);
//console.log("path", path);
		return path;
	}

	function channelForUri (uri) {

console.log("for URI", uri);

		return uri || "all";
	}


	// TODO: Defend against attack.
	app.post(/\/record\/(.*)$/, function(req, res, next) {
		var channel = channelForUri(req.params[0]);
        // @see http://stackoverflow.com/a/19524949/330439
        var ip =
            req.headers['x-forwarded-for'] || 
            req.connection.remoteAddress || 
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
		return FS.appendFile(pathForChannel(channel), "[" + (new Date().toISOString()) + "][" + ip + "] " + JSON.stringify(req.body) + "\n", function (err) {
			if (err) return next(err);
			res.writeHead(200);
			return res.end("");
		});
	});


	var activeLogFiles = {};

	// TODO: Require auth.
	app.get(/\/list$/, function(req, res, next) {
		var payload = JSON.stringify(activeLogFiles, null, 4);
		res.writeHead(200, {
			"Content-Type": "application/json",
			"Content-Length": payload.length,
			"Cache-Control": "max-age=15"  // seconds
		});
		return res.end(payload);
	});


	if (TCP_PORT) {
		function startTCPServer(callback) {
			var files = {};
			function fileForChannel(channel) {
				if (!files[channel]) {
					var path = pathForChannel(channel);
					console.log("Open file '" + path + "' for channel '" + channel + "'");
					files[channel] = FS.createWriteStream(path, {
						flags: "a"
					});
					files[channel].on("error", function(err) {
						console.error(err.stack);
					});
					files[channel].on("close", function() {
						console.log("Close file:", channel);
						delete files[channel];
					});
				}
				return files[channel];
			}			
			var server = NET.createServer(function(connection) {
				connection.on("error", function(err) {
					console.error(err.stack);
				});
				connection.setEncoding('binary');
				var channel = null;
				connection.on("end", function() {
					console.log("End channel:", channel);
				});
				// TODO: Defend against attack.
				connection.on('data', function(data) {
					if (data.length > 0) {
						if (data[0] === 255) {
							connection.end();
							return;
						}
					}
					if (!channel) {
						var lines = data.toString().split("\n");
						// TODO: Route HTTP requests to same routes as above.
						var uri = lines[0].replace(/[\r]/g, "");
						channel = channelForUri(uri);
						console.log("Start channel:", channel);
						var file = fileForChannel(channel);
						file.write("\n----------[" + (new Date().toISOString()) + "][" + connection.remoteAddress + "]----------\n\n");
						file.write(lines.splice(1).join("\n"));
						connection.pipe(file, {
							flags: 'a',
							encoding: 'binary'
						});
					}
				});
			});
			server.on("error", function(err) {
				return callback(err);
			});
			return server.listen(TCP_PORT, function() {
			    console.log("TCP Logger: 0.0.0.0:" + TCP_PORT);
				return callback(null, server);
			});
		}

		startTCPServer(function(err, server) {
			if (err) {
				console.error("Error starting TCP server:", err.stack);
				return;
			}
			function shutdown() {
				server.close(function() {
					// Nothing more to do.
				});
			}
			process.on('SIGTERM', function() {
			  shutdown();
			});
			process.on('SIGINT', function() {
			  shutdown();
			});
		});
	}


	function initZeroMQServer(callback) {
		var server = ZMQ.socket("pull");
		server.on("error", callback);
		server.on("message", function(message) {			
			try {
				message = JSON.parse(message);
			} catch(err) {
				sonsole.error("Warning: Error '" + err.stack + "' parsing message:", message);
			}
			if (!activeLogFiles[message.path]) {
				activeLogFiles[message.path] = {
					messageIndex: 0
				};
			}
			activeLogFiles[message.path].messageIndex += 1;
		});
		console.log("Bind ZMQ server to: " + "tcp://127.0.0.1:5002");
		return server.bind("tcp://127.0.0.1:5002", function(err) {
			if (err) return callback(err);
			return callback(null, server);
		});
	}


	function initLogstash(callback) {

		LOGSTASH_LOGGER.setLogLevel("info");

		var agent = LOGSTASH_AGENT.create();
		agent.on("error", callback);

		LOGSTASH_PATTERNS_LOADER.add(PATH.join(require.resolve("logstash/lib/agent"), "../patterns"));

//input://file:///opt/logs/os.inception.server.*.log?type=services
//output://file:///opt/logs/activity.log?serializer=json_logstash

		return agent.start([
			'filter://add_host://',
		    'filter://add_timestamp://',
		    'filter://add_version://',
			"input://file:///opt/log/*.log",
			"output://zeromq://tcp://127.0.0.1:5002"
		], function(err) {
			if (err) {
				err.message += " (while loading config into logstash agent)";
				err.stack += "\n(while loading config into logstash agent)";
				return callback(err);
			}
			return callback(null, agent);
		});
	}


	// TODO: Return a promise here.
	return initZeroMQServer(function(err, server) {
		if (err) {
			console.error("Error starting ZeroMQ server:", err.stack);
			return;
		}
		if (server) {
			console.log("ZeroMQ server started!");
			function shutdown() {
				server.close(function() {
					// Nothing more to do.
				});
			}
			process.on('SIGTERM', function() {
			  shutdown();
			});
			process.on('SIGINT', function() {
			  shutdown();
			});
		}

		return initLogstash(function(err, agent) {
			if (err) {
				console.error("Error starting logstash agent:", err.stack);
				return;
			}
			if (agent) {
				console.log("Logstash agent started!");
				function shutdown() {
					agent.close(function() {
						// Nothing more to do.
					});
				}
				process.on('SIGTERM', function() {
				  shutdown();
				});
				process.on('SIGINT', function() {
				  shutdown();
				});
			}


		});

	});
});

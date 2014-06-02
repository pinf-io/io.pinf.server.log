
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");
const NET = require("net");


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
			// TODO: Listen for shutdown events and shutdown server.
		});
	}
});


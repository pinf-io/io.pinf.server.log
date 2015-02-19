
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");
const NET = require("net");
const STREAM = require("stream");
const ANSI_HTML_STREAM = require("ansi-html-stream");


const DB_NAME = "devcomp";

ASSERT.equal(typeof process.env.PIO_SERVICE_DATA_BASE_PATH, "string", "'PIO_SERVICE_DATA_BASE_PATH' env var must be set!");

var TCP_PORT = process.env.TCP_PORT || null;


require("io.pinf.server.www").for(module, __dirname, function(app, config, HELPERS) {

	var logBasePath = PATH.join(
		process.env.PIO_SERVICE_DATA_BASE_PATH,
		"incoming"
	);

	if (!FS.existsSync(logBasePath)) {
		FS.mkdirsSync(logBasePath);
	}


	app.use(function (req, res, next) {
		res.view.fireconsoleHost = config.config.fireconsoleHost;
		return next();
	});


	function pathForChannel (ip, channel, callback) {
		console.log("pathForChannel()", ip, channel);
		var path = PATH.join(
			logBasePath,
			ip,
			channel.replace(/[^a-zA-Z0-9-_\.]/gi, "") + ".log"
		);
		return FS.exists(PATH.dirname(path), function (exists) {
			if (exists) return callback(null, path);
			return FS.mkdirs(PATH.dirname(path), function(err) {
				if (err) return callback(err);
				return callback(null, path);
			});
		});
	}

	function channelForUri (uri) {
		return uri || "all";
	}

	function announceChannel(ip, channel, callback) {
		return HELPERS.r.tableEnsure(DB_NAME, "io_pinf_server_log", "incoming", function(err, incomingTable) {
            if (err) return callback(err);
			var record = {
        		id: ip + "/" + channel,
        		channel: channel,
        		ip: ip,
        		location: "",
				createdOn: Date.now(),
				meta: ""
        	};
        	record.updatedOn = record.createdOn;
			return incomingTable.insert(record).run(HELPERS.r.conn, function (err, result) {
                if (err) return callback(err);
                if (result.errors === 1 && /Duplicate primary key/.test(result.first_error)) {
					return incomingTable.get(record.id).update({
						updatedOn: record.createdOn
					}).run(HELPERS.r.conn, function (err, result) {
		                if (err) return callback(err);
			            return callback(null);
		            });
                }
	            return callback(null);
	        });
        });
	}

	function announceService(namespace, callback) {
		return HELPERS.r.tableEnsure(DB_NAME, "io_pinf_server_log", "service", function(err, serviceTable) {
            if (err) return callback(err);
			return serviceTable.get(namespace).run(HELPERS.r.conn, function (err, result) {
                if (err) return callback(err);
                var size = FS.statSync(namespace).size;
                if (result) {
                	if (result.size === size) {
			            return callback(null);
                	}
					return serviceTable.get(namespace).update({
						updatedOn: FS.statSync(namespace).mtime.getTime(),
						size: size
					}).run(HELPERS.r.conn, function (err, result) {
		                if (err) return callback(err);
			            return callback(null);
		            });
                } else {
					var record = {
		        		id: namespace,
		        		namespace: namespace,
						createdOn: Date.now(),
						size: size,
						meta: ""
		        	};
		        	record.updatedOn = record.createdOn;
					return serviceTable.insert(record).run(HELPERS.r.conn, function (err, result) {
		                if (err) return callback(err);
		                return callback(null);
		            });
                }
	            return callback(null);
            });
        });
	}


	var updateServiceThrottled__info = {};
	var updateServiceThrottled__pendingSync = null;
	function updateServiceThrottled(namespace, info) {
		function doSync(pending, callback) {
			return HELPERS.r.tableEnsure(DB_NAME, "io_pinf_server_log", "service", function(err, serviceTable) {
	            if (err) return callback(err);
	            var waitfor = HELPERS.API.WAITFOR.parallel(callback);
	            for (var namespace in pending) {
	            	waitfor(namespace, function(namespace, callback) {
	            		var info = pending[namespace];
						info.updatedOn = Date.now();
						return serviceTable.get(namespace).update(info).run(HELPERS.r.conn, function (err, result) {
			                if (err) return callback(err);
				            return callback(null);
			            });
	            	});
	            }
	            return waitfor();
	        });
		}
		updateServiceThrottled__info[namespace] = HELPERS.API.DEEPMERGE(updateServiceThrottled__info[namespace] || {}, info);
		if (updateServiceThrottled__pendingSync === null) {
			updateServiceThrottled__pendingSync = setTimeout(function() {
				updateServiceThrottled__pendingSync = null;
				var pending = updateServiceThrottled__info;
				updateServiceThrottled__info = {};
				return doSync(pending, function(err) {
					if (err) {
						console.error("Error updating service info:", err.stack);
					}
				})
			}, 5 * 1000);
		}
	}


	function parseLinesForMeta(ip, channel, lines, callback) {
		// TODO: Bring this in via config.
		var patterns = [
			new RegExp('^(\{"submodule":"stack".+"function":"logInstanceInformation".+\})$'),
			new RegExp('instance information (\{.+?\})[^\}]+\[logInstanceInformation\]')
		];
		var meta = null;
		lines.split("\n").forEach(function (line) {
			return patterns.forEach(function (re) {
				var m = re.exec(line);
				if (!m) return;
				try {
					meta = HELPERS.API.DEEPMERGE(meta || {}, JSON.parse(m[1]));
				} catch(err) {
					console.log("line", line);
					console.error("Error '" + err.message + "' parsing JSON: ", m[1]);
				}
			});
		});
		if (!meta) {
			return callback(null);
		}
//		console.log("Updating meta for '" + ip + "/" + channel + "':", meta);
		return HELPERS.r.tableEnsure(DB_NAME, "io_pinf_server_log", "incoming", function(err, incomingTable) {
            if (err) return callback(err);
            var info = {
				meta: meta,
				updatedOn: Date.now()
			};
			// TODO: Bring this in via config.
			if (meta["params"]) {
				if (meta["params"]["device id"]) {
					info.device = meta["params"]["device id"];
				}
				if (meta["params"]["instance id"]) {
					info.instance = meta["params"]["instance id"];
				}
				if (meta["params"]["authorized application id"]) {
					info.identity = meta["params"]["authorized application id"];
				}
				if (meta["params"]["message::AgentInfo"]) {
					if (meta["params"]["message::AgentInfo"]["user agent"]) {
						info.platform = meta["params"]["message::AgentInfo"]["user agent"];
					}
				}
			}
			return incomingTable.get(ip + "/" + channel).update(info).run(HELPERS.r.conn, function (err, result) {
	            if (err) return callback(err);
	            return callback(null);
	        });
        });
	}

	// TODO: Defend against attack.
	app.post(/\/record\/(.*)$/, function(req, res, next) {
        // @see http://stackoverflow.com/a/19524949/330439
        var ip =
            req.headers['x-forwarded-for'] || 
            req.connection.remoteAddress || 
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
		var channel = channelForUri(req.params[0]);
		return pathForChannel(ip, channel, function(err, path) {
			if (err) return next(err);
			return announceChannel(ip, channel, function(err) {
				if (err) return next(err);
				var lines = JSON.stringify(req.body);
				return parseLinesForMeta(ip, channel, lines, function (err) {
					if (err) return next(err);
					return FS.appendFile(path, "[" + (new Date().toISOString()) + "] " + lines + "\n", function (err) {
						if (err) return next(err);
						res.writeHead(200);
						return res.end("");
					});
				});
			});
		});
	});


	function fetch(req, res, path, next) {
		console.log("fetch log", path);		
		return FS.exists(path, function(exists) {
			if (!exists) {
				return res.end(JSON.stringify({
					startOffset: 0,
					offset: 0,
					size: 0,
					data: ""
				}));
			}
			return FS.open(path, "r", function(err, fd) {
				if (err) return next(err);
				function fetch(callback) {
					var offset = req.body.offset || 0;
					return FS.fstat(fd, function(err, stat) {
						if (err) return callback(err);
						if (offset >= stat.size) {
							offset = stat.size;
							return callback(null, {
								startOffset: offset,
								offset: offset,
								size: stat.size,
								data: ""
							});
						}
						var tailSize = 200000;
						if (offset === 0 && req.body.all !== true) {
							offset = stat.size - tailSize;
							if (offset < 0) offset = 0;
						}
						var buffer = new Buffer(stat.size - offset);
						return FS.read(fd, buffer, 0, buffer.length, offset, function(err) {
							if (err) return callback(err);
							var startOffset = offset;
							offset += buffer.length;
							return callback(null, {
								startOffset: startOffset,
								offset: offset,
								size: stat.size,
								data: buffer.toString()
							});
						});
					});
				}
				return fetch(function(err, data) {
					if (err) return next(err);
					return FS.close(fd, function(err) {
						if (err) return next(err);
						return res.end(JSON.stringify(data));
					});
				});
			});
		});
	}

	function download(req, res, path, filename, next) {
		if (req.query.format === "html") {
			res.setHeader("Content-Type", "text/html");
			res.write([
			'<html>',
	            '<head>',
	                '<link href="/log.css" rel="stylesheet">',
	            '</head>',
	            '<body>'].join("\n"));
			var ANSI_COLORS = [
	          ["0,0,0", "187, 0, 0", "0, 187, 0", "187, 187, 0", "0, 0, 187", "187, 0, 187", "0, 187, 187", "255,255,255" ],
	          ["85,85,85", "255, 85, 85", "0, 255, 0", "255, 255, 85", "85, 85, 255", "255, 85, 255", "85, 255, 255", "255,255,255" ]
	        ];
	        function colorForCode(num) {
		        if ((num >= 30) && (num < 38)) {
		          return "rgb(" + ANSI_COLORS[0][(num % 10)] + ")";
		        } else
		        if ((num >= 40) && (num < 48)) {
		          return "rgb(" + ANSI_COLORS[0][(num % 10)] + ")";
		        }
		    }
			var stream = ANSI_HTML_STREAM({
				chunked: false,
				theme: {
				  resets:    { '0': false },
				  bold:      { '1': { style: 'font-weight:bold' } },
				  underline: { '4': { style: 'text-decoration:underline' } },
				  foregrounds: {
				      '30': { style: 'color:' + colorForCode(30) }
				    , '31': { style: 'color:' + colorForCode(31) }
				    , '32': { style: 'color:' + colorForCode(32) }
				    , '33': { style: 'color:' + colorForCode(33) }
				    , '34': { style: 'color:' + colorForCode(34) }
				    , '35': { style: 'color:' + colorForCode(35) }
				    , '36': { style: 'color:' + colorForCode(36) }
				    , '37': { style: 'color:' + colorForCode(37) }
				    , '39': false // default
				  },
				  backgrounds: {
				      '40': { style: 'background-color:' + colorForCode(40) }
				    , '41': { style: 'background-color:' + colorForCode(41) }
				    , '42': { style: 'background-color:' + colorForCode(42) }
				    , '43': { style: 'background-color:' + colorForCode(43) }
				    , '44': { style: 'background-color:' + colorForCode(44) }
				    , '45': { style: 'background-color:' + colorForCode(45) }
				    , '46': { style: 'background-color:' + colorForCode(46) }
				    , '47': { style: 'background-color:' + colorForCode(47) }
				    , '49': false
				  }
				}
			});
			stream.on("error", next);
			stream.on("end", function() {
				res.end([
				    '</body>',
				'</html>'].join("\n"));
			});
			var file = FS.createReadStream(path);
			file.on("error", next);
			stream.on("data", function(chunk) {
//					chunk = chunk.replace(/\r?\n/g, "<br/>\n");
				res.write(chunk);
			});
			file.pipe(stream);
	        return;
		} else {
			res.setHeader("Content-Type", "text/plain");
			res.setHeader("Content-Disposition", 'attachment; filename="' + filename + '.log"');
			return res.end(FS.readFileSync(path));
		}
	}

    app.post('/incoming/fetch', function(req, res, next) {
    	var idParts = req.body.id.split("~");
    	var ip = idParts.shift();
    	var channel = idParts.join("~");
		return pathForChannel(ip, channel, function(err, path) {
			if (err) return next(err);
			return fetch(req, res, path, next);
		});
	});
    app.get('/incoming/download', function(req, res, next) {
    	var idParts = req.query.id.split("~");
    	var ip = idParts.shift();
    	var channel = idParts.join("~");
		return pathForChannel(ip, channel, function(err, path) {
			if (err) return next(err);
			return download(req, res, path, channel, next);
		});
    });


    app.post('/arbitrary/fetch', function(req, res, next) {
    	// TODO: Verify that we are allowed to access file by looking at config.
    	var path = req.body.id.replace(/~{2}/g, "__DASH__").replace(/~/g, "/").replace(/__DASH__/g, "~");
		return fetch(req, res, path, next);
	});
    app.get('/arbitrary/download', function(req, res, next) {
    	var path = req.query.id.replace(/~{2}/g, "__DASH__").replace(/~/g, "/").replace(/__DASH__/g, "~");
		return download(req, res, path, path.replace(/\//g, "-"), next);
	});


    app.post('/service/fetch', function(req, res, next) {
    	var path = req.body.id.replace(/\.{2}/g, "").replace(/~{2}/g, "__DASH__").replace(/~/g, "/").replace(/__DASH__/g, "~");
		return fetch(req, res, path, next);
	});
    app.get('/service/download', function(req, res, next) {
    	var path = req.query.id.replace(/\.{2}/g, "").replace(/~{2}/g, "__DASH__").replace(/~/g, "/").replace(/__DASH__/g, "~");
		return download(req, res, path, path.replace(/\//g, "-"), next);
	});

	// TODO: Require auth.
	app.get(/\/service\/list$/, function(req, res, next) {
		function getRecords(callback) {
			return HELPERS.r.tableEnsure(DB_NAME, "io_pinf_server_log", "service", {
				indexes: [
					"updatedOn"
				]
			}, function(err, table) {
				if (err) return callback(err);
				return table.orderBy({
            		index: HELPERS.r.desc("updatedOn")
            	}).run(HELPERS.r.conn, function(err, cursor) {
            		if (err) return callback(err);
//					if (!cursor.hasNext()) {
//						return callback(null, {});
//					}
					return cursor.toArray(function(err, results) {
	            		if (err) return callback(err);
	            		var records = {};
	            		results.forEach(function (record) {
	            			records[record.id] = record;
	            		});
						return callback(null, records);
					});
				});
			});
		}
		return getRecords(function(err, records) {
			if (err) return next(err);
			var payload = JSON.stringify(records, null, 4);
			res.writeHead(200, {
				"Content-Type": "application/json",
				"Content-Length": payload.length,
				"Cache-Control": "max-age=15"  // seconds
			});
			return res.end(payload);
		});
	});

	app.get(/\/incoming\/ip\/list$/, function(req, res, next) {
		function getRecords(callback) {
			return HELPERS.r.tableEnsure(DB_NAME, "io_pinf_server_log", "incoming", {
				indexes: [
					"updatedOn"
				]
			}, function(err, table) {
				if (err) return callback(err);
				return table.orderBy({
            		index: HELPERS.r.desc("updatedOn")
            	}).limit(25).run(HELPERS.r.conn, function(err, cursor) {
            		if (err) return callback(err);
//					if (!cursor.hasNext()) {
//						return callback(null, {});
//					}
					return cursor.toArray(function(err, results) {
	            		if (err) return callback(err);
	            		var records = {};
	            		results.forEach(function (record) {
	            			records[record.id] = record;
	            		});
						return callback(null, records);
					});
				});
			});
		}
		return getRecords(function(err, records) {
			if (err) return next(err);
			var payload = JSON.stringify(records, null, 4);
			res.writeHead(200, {
				"Content-Type": "application/json",
				"Content-Length": payload.length,
				"Cache-Control": "max-age=15"  // seconds
			});
			return res.end(payload);
		});
	});

	app.get(/\/incoming\/device\/list$/, function(req, res, next) {
		function getRecords(callback) {
			return HELPERS.r.tableEnsure(DB_NAME, "io_pinf_server_log", "incoming", {
				indexes: [
					"updatedOn"
				]
			}, function(err, table) {
				if (err) return callback(err);
				return table.orderBy({
            		index: HELPERS.r.desc("updatedOn")
            	}).filter(function(row) {
				    return row.hasFields('device');
				}).limit(25).run(HELPERS.r.conn, function(err, cursor) {
            		if (err) return callback(err);
//					if (!cursor.hasNext()) {
//						return callback(null, {});
//					}
					return cursor.toArray(function(err, results) {
	            		if (err) return callback(err);
	            		var records = {};
	            		results.forEach(function (record) {
	            			records[record.id] = record;
	            		});
						return callback(null, records);
					});
				});
			});
		}
		return getRecords(function(err, records) {
			if (err) return next(err);
			var payload = JSON.stringify(records, null, 4);
			res.writeHead(200, {
				"Content-Type": "application/json",
				"Content-Length": payload.length,
				"Cache-Control": "max-age=15"  // seconds
			});
			return res.end(payload);
		});
	});

	function incomingIdentityList (req, res, next) {
		function getRecords(args, callback) {
			return HELPERS.r.tableEnsure(DB_NAME, "io_pinf_server_log", "incoming", {
				indexes: [
					"updatedOn"
				]
			}, function(err, table) {
				if (err) return callback(err);

				var query = table.orderBy({
            		index: HELPERS.r.desc("updatedOn")
            	}).filter(function(row) {
				    return row.hasFields('identity');
				});

				if (args && args.filter) {
					// TODO: Use firenode query language to convert JSON into rethinkdb.
					if (args.filter.identity) {
						if (/^\/.+\/$/.test(args.filter.identity)) {
							console.log("Apply filter '" + args.filter.identity.substring(1, args.filter.identity.length-1) + "' as RegExp");
							query = query.filter(function(row) {
							    return row("identity").match(args.filter.identity.substring(1, args.filter.identity.length-1));
							});
						} else {
							console.log("Apply filter '" + args.filter.identity + "' as exact string");
							query = query.filter({
								identity: args.filter.identity
							});
						}
					}
				}
				return query.limit(25).run(HELPERS.r.conn, function(err, cursor) {
            		if (err) return callback(err);
//					if (!cursor.hasNext()) {
//						return callback(null, {});
//					}
					return cursor.toArray(function(err, results) {
	            		if (err) return callback(err);
	            		var records = {};
	            		results.forEach(function (record) {
	            			records[record.id] = record;
	            		});
						return callback(null, records);
					});
				});
			});
		}
		return getRecords(req.body || null, function(err, records) {
			if (err) return next(err);
			var payload = JSON.stringify(records, null, 4);
			res.writeHead(200, {
				"Content-Type": "application/json",
				"Content-Length": payload.length,
				"Cache-Control": "max-age=15"  // seconds
			});
			return res.end(payload);
		});
	};
	app.get(/\/incoming\/identity\/list$/, incomingIdentityList);
	app.post(/\/incoming\/identity\/list$/, incomingIdentityList);


	if (TCP_PORT) {
		function startTCPServer(callback) {
			var files = {};
			function fileForChannel(ip, channel, callback) {
				console.log("fileForChannel()", ip, channel);
				if (files[channel]) {
					console.log("Return existing file for channel '" + channel + "'");
					return callback(null, files[channel]);
				}
				return pathForChannel(ip, channel, function(err, path) {
					if (err) return callback(err);
					console.log("Determined path:", path);
					return announceChannel(ip, channel, function(err) {
						if (err) return callback(err);
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
						return callback(null, files[channel]);
					});
				});
			}			
			var server = NET.createServer(function(connection) {
		        var ip =
		            connection.remoteAddress ||
		            connection.socket.remoteAddress;
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
						// TODO: Is this the escape character?
						if (data[0] === 255) {
							connection.end();
							return;
						}
					}
					if (!channel) {
						var lines = data.toString().split("\n");
						// TODO: If a HTTP request is detected (vs an arbitrary protocol) route it using the HTTP logic above.
						var uri = lines[0].replace(/[\r]/g, "");
						channel = channelForUri(uri);
						console.log("Start channel:", ip, channel);
						return fileForChannel(ip, channel, function (err, file) {
							if (err) {
								console.error(err.stack);
								return connection.end();
							}
							console.log("Channel started and writing lines:", ip, channel);

//							file.write("\n----------[" + (new Date().toISOString()) + "][" + ip + "]----------\n\n");
							file.write(lines.splice(1).join("\n"));

							var monitor = new STREAM.Writable();
							monitor._write = function (chunk, encoding, callback) {
								return parseLinesForMeta(ip, channel, chunk.toString(), callback);
							}
							connection.pipe(monitor);

							return connection.pipe(file, {
								flags: 'a',
								encoding: 'binary'
							});
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


	function initServiceLogs(callback) {
		return FS.readdir("/opt/log", function(err, filenames) {
			if (err) return callback(err);
			var monitorFiles = {};
			var waitfor = HELPERS.API.WAITFOR.parallel(function (err) {
				if (err) return callback(err);
				setInterval(function () {
					Object.keys(monitorFiles).forEach(function (path) {
						FS.stat(path, function (err, stat) {
							if (err) {
								console.error(err.stack);
								return;
							}
							if (stat.size !== monitorFiles[path].size) {
								monitorFiles[path].size = stat.size;
								console.log("File '" + path + "' has changed in size:", stat.size);
								updateServiceThrottled(path, monitorFiles[path]);
							}
						});
					});
				}, 15 * 1000);
			});
			filenames.forEach(function (filename) {
				waitfor(function (done) {

					var path = PATH.join("/opt/log", filename);
					var size = FS.statSync(path).size;

					monitorFiles[path] = {
						size: size
					};

					return announceService(path, done);
				});
			});
			return waitfor();
		});
	}

	process.on('exit', function(code) {
		console.log("Processing exit code: " + code);
	});
	process.on('SIGQUIT', function() {
		console.log("Processing code: SIGQUIT");
	});
	process.on('SIGTERM', function() {
		console.log("Processing code: SIGTERM");
		process.exit(0);
	});


	// TODO: Return a promise here.
	return initServiceLogs(function(err) {
		if (err) {
			console.error("Error initializing service logs:", err.stack);
			return;
		}

		console.log("Monitoring service logs");
	});
});

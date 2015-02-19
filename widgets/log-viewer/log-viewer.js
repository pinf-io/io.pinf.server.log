
define(function() {

	return function() {
		var self = this;


		// Event listener to control this viewer from parent widgits.
		window.addEventListener("message", function (event) {
			if (/^\{/.test(event.data)) {
				var message = null;
				try {
					message = JSON.parse(event.data);
				} catch(err) {
					console.error("Error '" + err.message + "' while parsing JSON: " + event.data);
				}
				if (message) {
					if (message.request) {
						if (message.request.action === "init") {
							showList({
								filter: message.request.filter || null
							});
							return;
						}
					}
				}
			}
		}, false);


		// Listener to deal with detail log loading.
		var baseUrl = "http://io-pinf-server-log." + window.API.config.hostname + ":8013";

		var activeId = null;
		var loadId = null;
	    var buffer = [];
	    var blankPageLoadedListener = function(event) {
	    	if (typeof event.data === "string") {	
		    	if (event.data === "LOG_BLANK_PAGE_LOADED") {
			    	if (buffer === false) return;
			    	var buffered = buffer;
			    	buffer = false;
					if (loadId) {
						loadLog(loadId);
						loadId = null;
					}
			    	buffered.forEach(appendToLog);
		    	} else
		    	if (event.data === "CLEAR_LOG") {
		    		clearLog();
		    	}
		    } else
	    	if (typeof event.data === "object") {	
		    	if (event.data.action === "SYNC_MENU") {
					if (typeof event.data.startOffset !== "undefined") {
						$("DIV.start", self.tag).html("Start: " + event.data.startOffset);
					}
					if (typeof event.data.size !== "undefined") {
		            	$("DIV.size", self.tag).html("Size: " + event.data.size);
					}
				}
	    	}
	    };
	    window.addEventListener("message", blankPageLoadedListener, false);
	    self.on("destroy", function() {
		    window.removeEventListener("message", blankPageLoadedListener, false);
	    });

	    function clearLog() {
			buffer = [];
			$("IFRAME", self.tag).attr("src", baseUrl + "/log-viewer?time=" + Date.now());
	    }
	    function loadLog(id) {
	    	if (buffer === false) {
		    	$("IFRAME", self.tag)[0].contentWindow.postMessage({
		    		action: "FETCH_LOG",
		    		id: id
		    	}, "*");
		    } else {
		    	loadId = id;
		    }
	    }
	    function appendToLog(html) {
	    	if (buffer === false) {
		    	$("IFRAME", self.tag)[0].contentWindow.postMessage({
		    		action: "APPEND_HTML",
		    		html: html
		    	}, "*");
	    	} else {
	    		buffer.push(html);
	    	}
	    }

		function loadEarlier () {
	    	$("IFRAME", self.tag)[0].contentWindow.postMessage({
	    		action: "LOAD_EARLIER"
	    	}, "*");
		}

		// Trigger the detail display of a log file.
		self.api.showRawLogDialog = function(type, id, options) {
			try {

				console.log("[log-viewer] showRawLogDialog", type, id, options);

				options = options || {};

				$("DIV.view-log-list", self.tag).addClass("hidden");
				$("DIV.view-log-detail", self.tag).removeClass("hidden");

				// TODO: Get the microadjustment right and dynamic by seeing why we need it.
				$('.view-log-detail', self.tag).css('height', options.height || $(window).height()-5);

				if (options.buttons) {
					if (options.buttons.close === false) {
						$("BUTTON.button-close", self.tag).addClass("hidden");
					}
				}

				clearLog();
				appendToLog('<div class="alert alert-info">Loading ...</div>');
				activeId = type + "/" + id.replace(/~/g, "__DASH__").replace(/\//g, "~").replace(/__DASH__/g, "~~");
				(options.titleNode || $("DIV.title", self.tag)).html("Log Stream: " + activeId.split("/").slice(1).join("/").replace(/~{2}/g, "__DASH__").replace(/~/g, "/").replace(/__DASH__/g, "~"));
				if (options.titleNode) {
					$("DIV.title", self.tag).parent().parent().hide();
				}
				if (options.updateUrlHash) {
		            window.location.hash = "#/logs/" + activeId;
				}
	            loadLog(activeId);
				$('#modal-viewer-rawlog').modal({
					show: true
				});
			} catch (err) {
				console.error("showRawLogDialog()", err.stack);
				throw err;
			}
		}


		function showList (args) {
			if (!args && showList.args) {
				args = showList.args;
			} else if (args) {
				showList.args = args;
			}

			$('[x-widget="io.pinf.server.log/incoming-identified"]', self.tag).each(function () {
				$(this)[0]._firewidget.setFilter((args && args.filter) || null);
			});

			$("DIV.view-log-detail", self.tag).addClass("hidden");
			$("DIV.view-log-list", self.tag).removeClass("hidden");

			// TODO: Get the microadjustment right and dynamic by seeing why we need it.
			$('.view-log-list', self.tag).css('height', $(window).height()-5);
		}

/*
		function ensureFireConsole () {
			if (ensureFireConsole._instance) {
				return ensureFireConsole._instance;
			}
			var uri = "http://fireconsole-widget-console.os-inception-iae5f554-5.vm.cadorn.github.pinf.me:8013/demo.js";
			var deferred = self.API.Q.defer();
			$.pinf.sandbox(uri, function (sandbox) {
		        return sandbox.main(null).then(deferred.resolve, deferred.reject);
		    }, function (err) {
		        console.error("Error while loading bundle '" + uri + "':", err.stack);
		        return deferred.reject(err);
		    });
			return self.API.Q.when(deferred.promise).then(function (instance) {
				ensureFireConsole._instance = instance;
				return instance;
			});
		}
*/

		return self.hook(
			{
				"htm": "./" + self.widget.id + ".htm"
			},
			{
			},
			[
				{
					resources: [ "htm" ],
					handler: function (_htm) {

// TODO: Use this instance once fireconsole can act reliably without an iframe.
//						return ensureFireConsole().then(function (FIRECONSOLE) {
//console.log("FIRECONSOLE 111", FIRECONSOLE);

							return self.setHTM(_htm).then(function(tag) {

								if (
									typeof parent === "object" &&
									typeof parent.postMessage === "function"
								) {
									parent.postMessage("notify:IO-PINF-STACK:LOADED", "*");
								}

								$("BUTTON.button-loadearlier", tag).click(function() {
									loadEarlier();
								});
								$("BUTTON.button-showall", tag).click(function() {
									$("IFRAME", tag).attr("src", baseUrl + "/" + activeId.split("/").shift() + "/download?id=" + activeId.split("/").slice(1).join("/") + "&format=html&time=" + Date.now());
								});
								$("BUTTON.button-download", tag).click(function() {
									$("IFRAME", tag).attr("src", baseUrl + "/" + activeId.split("/").shift() + "/download?id=" + activeId.split("/").slice(1).join("/") + "&format=raw&time=" + Date.now());
								});
								$("BUTTON.button-print", tag).click(function() {
									$("IFRAME", tag)[0].contentWindow.postMessage("PRINT", "*");
								});
								$("BUTTON.button-close", tag).click(function () {
									showList();
								});

								return tag;
//							});
						});
					}
				}
			]
		);
	};
});


define(function() {

	return function() {
		var self = this;

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
						$("#modal-viewer-rawlog TD.menu DIV.start", self.tag).html("Start: " + event.data.startOffset);
					}
					if (typeof event.data.size !== "undefined") {
		            	$("#modal-viewer-rawlog TD.menu DIV.size", self.tag).html("Size: " + event.data.size);
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
			$("#modal-viewer-rawlog DIV.modal-body IFRAME", self.tag).attr("src", baseUrl + "/log-viewer?time=" + Date.now());
	    }
	    function loadLog(id) {
	    	if (buffer === false) {
		    	$("#modal-viewer-rawlog DIV.modal-body IFRAME", self.tag)[0].contentWindow.postMessage({
		    		action: "FETCH_LOG",
		    		id: id
		    	}, "*");
		    } else {
		    	loadId = id;
		    }
	    }
	    function appendToLog(html) {
	    	if (buffer === false) {
		    	$("#modal-viewer-rawlog DIV.modal-body IFRAME", self.tag)[0].contentWindow.postMessage({
		    		action: "APPEND_HTML",
		    		html: html
		    	}, "*");
	    	} else {
	    		buffer.push(html);
	    	}
	    }

		function showLogDialog (type, id, options) {
			options = options || {};
			clearLog();
			appendToLog('<div class="alert alert-info">Loading ...</div>');
			activeId = type + "/" + id.replace(/~/g, "__DASH__").replace(/\//g, "~").replace(/__DASH__/g, "~~");
			$("#modal-viewer-rawlog .modal-title", self.tag).html("Log Stream: " + activeId.split("/").slice(1).join("/").replace(/~{2}/g, "__DASH__").replace(/~/g, "/").replace(/__DASH__/g, "~"));
			if (options.updateUrlHash) {
	            window.location.hash = "#/logs/" + activeId;
			}
            loadLog(activeId);
			$('#modal-viewer-rawlog').modal({
				show: true
			});
		}

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
						return self.setHTM(_htm).then(function(tag) {

							$('#modal-viewer-rawlog', tag).modal({
								show: false
							});
							$("#modal-viewer-rawlog TD.menu BUTTON.button-showall", self.tag).click(function() {
								$("#modal-viewer-rawlog DIV.modal-body IFRAME", self.tag).attr("src", baseUrl + "/" + activeId.split("/").shift() + "/download?id=" + activeId.split("/").slice(1).join("/") + "&format=html&time=" + Date.now());
							});
							$("#modal-viewer-rawlog TD.menu BUTTON.button-download", self.tag).click(function() {
								$("#modal-viewer-rawlog DIV.modal-body IFRAME", self.tag).attr("src", baseUrl + "/" + activeId.split("/").shift() + "/download?id=" + activeId.split("/").slice(1).join("/") + "&format=raw&time=" + Date.now());
							});
							$("#modal-viewer-rawlog TD.menu BUTTON.button-print", self.tag).click(function() {
								$("#modal-viewer-rawlog DIV.modal-body IFRAME", self.tag)[0].contentWindow.postMessage("PRINT", "*");
							});
							$('#modal-viewer-rawlog', tag).on('show.bs.modal', function () {
								$('#modal-viewer-rawlog .modal-body', tag).css('height', $(window).height() - 160);
							});

							var tagContent = null;
							try {
								tagContent = JSON.parse(self.tagContent);
							} catch (err) {
								console.log("self.tagContent", self.tagContent);
								console.log("Error parsing json:", err.stack);
							}
							showLogDialog(tagContent.type, tagContent.logPath, {
								updateUrlHash: tagContent.updateUrlHash || false
							});
							return tag;
						});
					}
				}
			]
		);
	};
});

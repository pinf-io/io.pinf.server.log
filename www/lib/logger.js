
((function() {

    function init(exports) {

        var url = null;
        var channel = "all";
        var buffer = [];

        exports.setUrl = function(_url) {
            url = _url;
        }

        exports.setChannel = function(_channel) {
            if (!url) {
                throw new Error("'url must be set before channel can be set!");
            }
            channel = _channel;
            if (channel && buffer.length > 0) {
                buffer.forEach(function(args) {
                    return exports.log.apply(null, args);
                });
                buffer = [];
            }
        }

		exports.log = function() {
            if (!url || !channel) {
                buffer.push(Array.prototype.slice.call(arguments, 0));
                return;
            }
            var data = null;
            try {
                data = JSON.stringify(Array.prototype.slice.call(arguments, 0));
            } catch(err) {
                data = JSON.stringify({
                    error: err.stack
                });
            }
            return $.ajax({
                type: "POST",
                url: url + "/" + channel,
                data: data,
                dataType: "json",
                contentType: "application/json"
            });
		}

        // @see http://stackoverflow.com/a/10556743/330439
        window.onerror = function(msg, url, line) {
            if (console && console.error) {
                console.error("window.onerror", msg, url, line);
            }
            exports.log("window.onerror", msg, url, line);
            var suppressErrorAlert = true;
            // If you return true, then error alerts (like in older versions of 
            // Internet Explorer) will be suppressed.
            return suppressErrorAlert;
        };
    }

    // Check for AMD
    if (typeof define === "function") {
        define(function() {
            var exports = {};
            init(exports);
            return exports;
        });
    } else
    // Assume Browser
   	{
   		var exports = window.__LOGGER = {};
        init(exports);
    }

})());


const ASSERT = require("assert");
const NET = require("net");


describe("telnet", function() {

    var socket = null;

    it("connect", function(done) {
      socket = NET.createConnection({
        port: 8115,
        host: "os-inception-iae5f554-2.vm.cadorn.github.pinf.me"
      }, function() {
          return done();
      });
      return socket.on("error", done);
    });

    it("set channel", function(done) {
        socket.write("channel-telnet\n");
        return done();
    });

    it("log", function(done) {
        socket.write("line 1\n");
        socket.write("line 2\n");
        socket.write("line 3\n");
        return done();
    });

    it("shutdown", function(done) {
        socket.end();
        return done();
    });

});


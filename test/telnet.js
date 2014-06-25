
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs");
const NET = require("net");


function getHostname() {
    var path = PATH.join(__dirname, "../../../../.pio.sync", PATH.basename(PATH.dirname(__dirname)), ".pio.json");
    if (!FS.existsSync(path)) {
        throw new Error("This service must be deployed before it may be tested!");
    }
    var pioConfig = JSON.parse(FS.readFileSync(path));
    return pioConfig.config.pio.hostname;
}


describe("telnet", function() {

    describe("simple", function() {

        var socket = null;

        it("connect", function(done) {
          socket = NET.createConnection({
            port: 8115,
            host: getHostname()
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

    describe("tagging-raw", function() {

        var socket = null;

        it("connect", function(done) {
          socket = NET.createConnection({
            port: 8115,
            host: getHostname()
          }, function() {
              return done();
          });
          return socket.on("error", done);
        });

        it("set channel", function(done) {
            socket.write("deviceid1-instanceid\n");
            return done();
        });

        it("log", function(done) {
            socket.write("line 1\n");
            socket.write('15:29:19.218571 i: <0x3c88d18c> stack::Stack [28] instance information {"params":{"device id":"6A2A6F6F7B584B699F1E33F073776A47","instance id":"F93148DBBB264524A69607ED451AA5C1","authorized application id":"com.foo.testapp-MQyUrpOocft1FsVXiw0S-1405349013-2848484a851fc3bcec1ee30032a81d79eaab4b3a","message::AgentInfo":{"user agent":"SampleApp/1013 (iPhone OS 7.1.1;iPad) HOPID/1.0 (777)","name":"Sample App","image url":"http://images4.fanpop.com/image/photos/16100000/Cute-Kitten-kittens-16122946-1280-800.jpg","agent url":"http://foo.com/"}}} @stack_Stack.cpp(314) [logInstanceInformation]' + "\n");
            socket.write("line 2\n");
            socket.write('15:29:19.218571 i: <0x3c88d18c> stack::Stack [28] instance information {"params":{"device id":"6A2A6F6F7B584B699F1E33F073776A47","instance id":"F93148DBBB264524A69607ED451AA5C1","authorized application id":"com.foo.testapp-MQyUrpOocft1FsVXiw0S-1405349013-2848484a851fc3bcec1ee30032a81d79eaab4b3a","message::AgentInfo":{"user agent":"SampleApp/1013 (iPhone OS 7.1.1;iPad) HOPID/1.0 (777)","name":"Sample App","image url":"http://images4.fanpop.com/image/photos/16100000/Cute-Kitten-kittens-16122946-1280-800.jpg","agent url":"http://foo.com/"}}} @stack_Stack.cpp(314) [logInstanceInformation]' + "\n");
            socket.write("line 3\n");
            return done();
        });

        it("shutdown", function(done) {
            socket.end();
            return done();
        });

    });

    describe("tagging-json", function() {

        var socket = null;

        it("connect", function(done) {
          socket = NET.createConnection({
            port: 8115,
            host: getHostname()
          }, function() {
              return done();
          });
          return socket.on("error", done);
        });

        it("set channel", function(done) {
            socket.write("deviceid2-instanceid\n");
            return done();
        });

        it("log", function(done) {
            socket.write("line 1\n");
            socket.write('{"submodule":"stack","severity":"info","level":"basic","thread":"0x3c88d18c","function":"logInstanceInformation","file":"stack_Stack.cpp","line":314,"message":"instance information","time":"15:31:40.520020","object":{"stack::Stack":{"id":28}},"params":{"device id":"6A2A6F6F7B584B699F1E33F073776A47","instance id":"0B3805798F764C1786198A9572C3CD2E","authorized application id":"com.foo.testapp-bBosNu4oANxQQUFEt4tu-1405348771-d606887ba3e71c10f18d6fd9dd597fe5ccbd4719","message::AgentInfo":{"user agent":"SampleApp/1013 (iPhone OS 7.1.1;iPad) HOPID/1.0 (777)","name":"Sample App","image url":"http://images4.fanpop.com/image/photos/16100000/Cute-Kitten-kittens-16122946-1280-800.jpg","agent url":"http://foo.com/"}}}' + "\n");
            socket.write("line 2\n");
            socket.write('{"submodule":"stack","severity":"info","level":"basic","thread":"0x3c88d18c","function":"logInstanceInformation","file":"stack_Stack.cpp","line":314,"message":"instance information","time":"15:31:40.520020","object":{"stack::Stack":{"id":28}},"params":{"device id":"6A2A6F6F7B584B699F1E33F073776A47","instance id":"0B3805798F764C1786198A9572C3CD2E","authorized application id":"com.foo.testapp-bBosNu4oANxQQUFEt4tu-1405348771-d606887ba3e71c10f18d6fd9dd597fe5ccbd4719","message::AgentInfo":{"user agent":"SampleApp/1013 (iPhone OS 7.1.1;iPad) HOPID/1.0 (777)","name":"Sample App","image url":"http://images4.fanpop.com/image/photos/16100000/Cute-Kitten-kittens-16122946-1280-800.jpg","agent url":"http://foo.com/"}}}' + "\n");
            socket.write("line 3\n");
            return done();
        });

        it("shutdown", function(done) {
            socket.end();
            return done();
        });

    });

});


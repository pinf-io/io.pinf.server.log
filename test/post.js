
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs");
const REQUEST = require("request");


function getHostname() {
    var path = PATH.join(__dirname, "../../../../.pio.sync", PATH.basename(PATH.dirname(__dirname)), ".pio.json");
    if (!FS.existsSync(path)) {
        throw new Error("This service must be deployed before it may be tested!");
    }
    var pioConfig = JSON.parse(FS.readFileSync(path));
    return pioConfig.config.pio.hostname;
}


describe("post", function() {

    it("send", function(done) {

        return REQUEST({
            uri: "http://log." + getHostname() + "/record/channel-post",
            method: "POST",
            json: {
                "hello": "world"
            }
        }, function(err, res, body) {
            if (err) return done(err);

            ASSERT.equal(res.statusCode, 200);

            return done();
        });
    });

    it("tagging", function(done) {

        return REQUEST({
            uri: "http://log." + getHostname() + "/record/channel-post",
            method: "POST",
            json: {"submodule":"stack","severity":"info","level":"basic","thread":"0x3c88d18c","function":"logInstanceInformation","file":"stack_Stack.cpp","line":314,"message":"instance information","time":"15:31:40.520020","object":{"stack::Stack":{"id":28}},"params":{"device id":"6A2A6F6F7B584B699F1E33F073776A43","instance id":"0B3805798F764C1786198A9572C3CD2S","authorized application id":"com.foo.testapp-bBosNu4oANxQQUFEt4tu-1405348771-d606887ba3e71c10f18d6fd9dd597fe5ccbd4719","message::AgentInfo":{"user agent":"SampleApp/1013 (iPhone OS 7.1.1;iPad) HOPID/1.0 (777)","name":"Sample App","image url":"http://images4.fanpop.com/image/photos/16100000/Cute-Kitten-kittens-16122946-1280-800.jpg","agent url":"http://foo.com/"}}}
        }, function(err, res, body) {
            if (err) return done(err);

            ASSERT.equal(res.statusCode, 200);

            return done();
        });

    });

});

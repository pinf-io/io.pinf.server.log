
const ASSERT = require("assert");
const REQUEST = require("request");


describe("post", function() {

    it("send", function(done) {

      return REQUEST({
        uri: "http://log.os-inception-iae5f554-2.vm.cadorn.github.pinf.me/record/channel-post",
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

});

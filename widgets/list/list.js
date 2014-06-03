
define(function() {

	return function() {
		var self = this;

		return self.hook(
			{
				"htm": "./" + self.widget.id + ".htm"
			},
			{
				"files": "http://log.os-inception-iae5f554-2.vm.cadorn.github.pinf.me/list"				
			},
			[
				{
					resources: [ "htm" ],
					streams: [ "files" ],
					handler: function(_htm, _files) {

						_files.on("data", function(files) {
							return self.setHTM(_htm, {
								files: files
							});
						});

						return self.API.Q.resolve();
					}
				}
			]
		);
	};
});
